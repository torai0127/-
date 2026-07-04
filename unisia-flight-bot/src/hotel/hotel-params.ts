/**
 * ホテル検索パラメータ抽出
 */

import OpenAI from 'openai';
import { HotelSearchParams } from './travelpayouts-hotels';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ExtractedHotelParams extends HotelSearchParams {
  isComplete: boolean;
  missingFields: string[];
}

export interface FlightContext {
  destination: string;
  departureDate: string;
  returnDate?: string;
  passengers: number;
}

/**
 * フライトの検索結果からホテル検索のデフォルト値を生成
 */
export function createHotelContextFromFlight(flightContext: FlightContext): Partial<HotelSearchParams> {
  return {
    location: flightContext.destination,
    checkIn: flightContext.departureDate,
    checkOut: flightContext.returnDate || addDays(flightContext.departureDate, 1),
    adults: flightContext.passengers,
    rooms: Math.ceil(flightContext.passengers / 2),
  };
}

/**
 * 日付に日数を追加
 */
function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

/**
 * ユーザーメッセージからホテル検索パラメータを抽出
 */
export async function extractHotelParams(
  message: string,
  existingParams?: Partial<HotelSearchParams>
): Promise<ExtractedHotelParams> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  const defaultParams: ExtractedHotelParams = {
    location: existingParams?.location || '',
    checkIn: existingParams?.checkIn || '',
    checkOut: existingParams?.checkOut || '',
    adults: existingParams?.adults || 1,
    rooms: existingParams?.rooms || 1,
    children: existingParams?.children || 0,
    isComplete: false,
    missingFields: [],
  };
  
  try {
    const systemPrompt = `あなたはホテル予約アシスタントです。
ユーザーのメッセージからホテル検索条件を抽出してください。

今日の日付: ${todayStr}

既存の情報:
- 場所: ${existingParams?.location || '未設定'}
- チェックイン: ${existingParams?.checkIn || '未設定'}
- チェックアウト: ${existingParams?.checkOut || '未設定'}
- 大人: ${existingParams?.adults || '未設定'}名
- 部屋数: ${existingParams?.rooms || '未設定'}室

以下のJSON形式で回答してください:
{
  "location": "都市名（日本語）",
  "checkIn": "YYYY-MM-DD",
  "checkOut": "YYYY-MM-DD",
  "adults": 数値,
  "rooms": 数値,
  "children": 数値,
  "stars": 数値または null（星評価の希望があれば）,
  "maxPrice": 数値または null（1泊あたりの予算上限があれば、円単位）
}

注意:
- 日付が相対的（「来週」「3日後」など）な場合は具体的な日付に変換
- 「1週間」などの期間表現はチェックアウト日を計算
- ユーザーが新しく指定した情報は、既存の値を必ず上書きしてください
- ユーザーが明示的に指定していない項目のみ、既存の値を維持
- 情報がない項目はnull`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error('❌ Empty response from OpenAI');
      return defaultParams;
    }
    
    const parsed = JSON.parse(content);
    
    const result: ExtractedHotelParams = {
      location: parsed.location !== null && parsed.location !== undefined ? parsed.location : (existingParams?.location || ''),
      checkIn: parsed.checkIn !== null && parsed.checkIn !== undefined ? parsed.checkIn : (existingParams?.checkIn || ''),
      checkOut: parsed.checkOut !== null && parsed.checkOut !== undefined ? parsed.checkOut : (existingParams?.checkOut || ''),
      adults: parsed.adults !== null && parsed.adults !== undefined ? parsed.adults : (existingParams?.adults || 1),
      rooms: parsed.rooms !== null && parsed.rooms !== undefined ? parsed.rooms : (existingParams?.rooms || 1),
      children: parsed.children || 0,
      stars: parsed.stars || undefined,
      maxPrice: parsed.maxPrice || undefined,
      isComplete: false,
      missingFields: [],
    };
    
    // チェックアウトが「未定」や空の場合、チェックイン+1日をデフォルトに
    if ((!result.checkOut || result.checkOut === '未定') && result.checkIn) {
      result.checkOut = addDays(result.checkIn, 1);
      console.log(`📅 checkOut was empty/未定, set to ${result.checkOut}`);
    }
    
    // 必須フィールドのチェック
    if (!result.location) result.missingFields.push('location');
    if (!result.checkIn) result.missingFields.push('checkIn');
    if (!result.checkOut) result.missingFields.push('checkOut');
    
    result.isComplete = result.missingFields.length === 0;
    
    console.log(`✅ Extracted hotel params:`, result);
    
    return result;
    
  } catch (error) {
    console.error('❌ Failed to extract hotel params:', error);
    return defaultParams;
  }
}

/**
 * 不足情報を尋ねるメッセージを生成
 */
export function generateMissingFieldsMessage(missingFields: string[]): string {
  const fieldNames: Record<string, string> = {
    location: '宿泊先の都市',
    checkIn: 'チェックイン日',
    checkOut: 'チェックアウト日',
  };
  
  const missing = missingFields.map(f => fieldNames[f] || f);
  
  if (missing.length === 0) {
    return '';
  }
  
  return `以下の情報を教えてください:\n\n${missing.map(m => `・${m}`).join('\n')}`;
}

/**
 * ホテル検索の入力テンプレートを生成
 */
export function generateHotelInputTemplate(context?: FlightContext): string {
  let template = '📝 ホテル検索条件を入力してください\n\n';
  template += '以下をコピーして編集するか、\n条件を自由に入力してください：\n\n';
  template += '━━━━━━━━━━━━━━━\n';
  
  if (context) {
    template += `場所: ${context.destination}\n`;
    template += `チェックイン: ${context.departureDate}\n`;
    template += `チェックアウト: ${context.returnDate || '未定'}\n`;
    template += `大人: ${context.passengers}名\n`;
    template += `部屋数: ${Math.ceil(context.passengers / 2)}室\n`;
  } else {
    template += '場所: 東京\n';
    template += 'チェックイン: 2024-05-01\n';
    template += 'チェックアウト: 2024-05-03\n';
    template += '大人: 2名\n';
    template += '部屋数: 1室\n';
  }
  
  template += '━━━━━━━━━━━━━━━\n\n';
  template += '💡 オプション（任意）:\n';
  template += '・星評価: 3つ星以上\n';
  template += '・予算: 1泊15000円まで\n';
  
  return template;
}
