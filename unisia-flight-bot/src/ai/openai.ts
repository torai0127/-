import OpenAI from 'openai';
import { FLIGHT_BOT_SYSTEM_PROMPT } from './prompts.js';

if (!process.env.OPENAI_API_KEY) {
  console.warn('⚠️ OPENAI_API_KEY not configured - AI responses will be limited');
}

const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

interface ConversationEntry {
  userMessage: string;
  botResponse: string;
}

export async function generateFlightResponse(
  userMessage: string,
  history: ConversationEntry[],
  context?: {
    surveyData?: any;
    searchParams?: any;
  }
): Promise<string> {
  if (!openai) {
    return '申し訳ございません。現在AIアシスタントが利用できません。\n\n航空券をお探しの場合は、以下の形式でお知らせください：\n\n「○○から△△行き、□月□日出発」';
  }

  const formattedHistory = history.flatMap((entry) => [
    { role: 'user' as const, content: entry.userMessage },
    { role: 'assistant' as const, content: entry.botResponse },
  ]);

  let systemPrompt = FLIGHT_BOT_SYSTEM_PROMPT;
  
  if (context?.surveyData) {
    systemPrompt += `\n\n## このユーザーの登録情報
- 興味のある地域: ${context.surveyData.interestedRegions?.join(', ') || '未登録'}
- 出発空港: ${context.surveyData.departureAirports?.join(', ') || '未登録'}
- 予算: ${context.surveyData.budgetRange || '未登録'}
- 目的: ${context.surveyData.travelPurpose || '未登録'}`;
  }

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...formattedHistory,
    { role: 'user', content: userMessage },
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 800,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || 'エラーが発生しました。';
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw error;
  }
}

export interface ExtractedFlightParams {
  origin?: string;
  destination?: string;
  departureDate?: string;
  returnDate?: string;
  passengers?: number;
  adults?: number;
  children?: number;
  infantsOnLap?: number;
  tripType?: 'round_trip' | 'one_way';
  // 曖昧な日付指定用
  isFlexibleDate?: boolean;
  departureDateStart?: string;  // 期間の開始日
  departureDateEnd?: string;    // 期間の終了日
  stayDuration?: number;        // 滞在日数
}

export async function extractFlightParams(userMessage: string): Promise<ExtractedFlightParams | null> {
  if (!openai) return null;

  const today = new Date();
  const currentYear = today.getFullYear();
  const todayStr = today.toISOString().split('T')[0];

  const extractPrompt = `以下のメッセージから航空券検索の条件を抽出してください。
今日は${todayStr}です。年が指定されていない場合は${currentYear}年と仮定してください。
過去の日付の場合は翌年と仮定してください。

メッセージ: "${userMessage}"

【入力形式の例】
■ 自由形式:
「フィリピンに3月頃5泊6日で3人で行きたい」

■ リスト形式（エルメから送信される形式）:
「いきたい地域: フィリピン
いきたい時期: 3月ごろ
期間: 5泊6日
人数: 3人 妻・子供」

■ キーワードが含まれるメッセージ:
「・いきたい地域」「いきたい時期」「期間行きたい」「合計人数」などを含む場合も解析

【日付の解釈ルール】
■ 具体的な日付がある場合:
- 「6月28日」「2026-06-28」→ departureDate: "2026-06-28", isFlexibleDate: false

■ 曖昧な日付指定の場合（isFlexibleDate: true にする）:
- 「5月」「5月中」「5月ごろ」「5月頃」→ departureDateStart: "2026-05-01", departureDateEnd: "2026-05-31"
- 「5月末」「5月下旬」→ departureDateStart: "2026-05-20", departureDateEnd: "2026-05-31"
- 「5月前半」「5月上旬」→ departureDateStart: "2026-05-01", departureDateEnd: "2026-05-15"
- 「GW」「ゴールデンウィーク」→ departureDateStart: "2026-04-29", departureDateEnd: "2026-05-06"
- 「お盆」「8月お盆」→ departureDateStart: "2026-08-10", departureDateEnd: "2026-08-16"
- 「年末年始」→ departureDateStart: "2026-12-28", departureDateEnd: "2027-01-03"
- 「夏休み」→ departureDateStart: "2026-07-20", departureDateEnd: "2026-08-31"
- 「春休み」→ departureDateStart: "2026-03-20", departureDateEnd: "2026-04-05"

■ 滞在期間の解釈:
- 「1週間」「7日間」→ stayDuration: 7
- 「3泊4日」「5泊6日」→ stayDuration: 4, 6 (泊数+1)
- 「2週間」→ stayDuration: 14
- 「1ヶ月」→ stayDuration: 30
- 「3ヶ月」→ stayDuration: 90

■ 人数の解釈:
- 「3人」「3名」→ adults: 3
- 「大人2人、子供1人」→ adults: 2, children: 1
- 「夫婦と子供2人」「家族4人」→ adults: 2, children: 2
- 「3人 妻・子供」「家族3人」→ adults: 2, children: 1 (配偶者と子供がいる場合)
- 「赤ちゃん連れ」→ infantsOnLap: 1

JSON形式で回答（日本語の地名はそのまま）:
{
  "origin": "出発地（空港名または都市名、不明ならnull）",
  "destination": "目的地（国名または都市名、必須）",
  "isFlexibleDate": true/false,
  "departureDate": "具体的な出発日（YYYY-MM-DD、isFlexibleDate=falseの場合）",
  "departureDateStart": "出発期間の開始日（YYYY-MM-DD、isFlexibleDate=trueの場合）",
  "departureDateEnd": "出発期間の終了日（YYYY-MM-DD、isFlexibleDate=trueの場合）",
  "returnDate": "具体的な帰国日（YYYY-MM-DD、わかる場合）",
  "stayDuration": 滞在日数（数字、わかる場合）,
  "adults": 大人の人数（数字、デフォルト1）,
  "children": 子供の人数（数字、デフォルト0）,
  "infantsOnLap": 幼児の人数（数字、デフォルト0）,
  "tripType": "round_trip" または "one_way"
}

注意: 目的地（destination）が全く特定できない場合のみnullを返してください。
それ以外は部分的な情報でもできるだけ抽出してください。`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: extractPrompt }],
      max_tokens: 200,
      temperature: 0,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return null;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Error extracting flight params:', error);
    return null;
  }
}
