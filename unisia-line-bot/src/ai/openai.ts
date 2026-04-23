import OpenAI from 'openai';
import { buildPromptWithHistory, FAQ_KNOWLEDGE } from './prompts.js';

if (!process.env.OPENAI_API_KEY) {
  console.warn('⚠️ OPENAI_API_KEY not configured - AI responses will be limited');
}

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// 海外関連のキーワード
const OVERSEAS_KEYWORDS = [
  '安全', '治安', 'ビザ', 'パスポート', '航空券', '保険',
  '持ち物', '準備', '両替', 'Wi-Fi', 'SIM', '空港',
  '入国', '出国', '時差', '気候', '天気', '物価',
  '言語', '英語', '観光', 'おすすめ', '旅行', '留学',
  'ワーホリ', '費用', '予算', '病院', '緊急', 'トラブル',
  '質問', '教えて', '知りたい', 'どう', '何',
];

interface ConversationEntry {
  userMessage: string;
  botResponse: string;
}

export async function generateResponse(
  userMessage: string,
  history: ConversationEntry[]
): Promise<string> {
  // OpenAI未設定時のフォールバック応答
  if (!openai) {
    return getDefaultResponse(userMessage);
  }

  const formattedHistory = history.flatMap((entry) => [
    { role: 'user' as const, content: entry.userMessage },
    { role: 'assistant' as const, content: entry.botResponse },
  ]);

  const messages = buildPromptWithHistory(userMessage, formattedHistory);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content;
    
    if (!response) {
      return getDefaultResponse(userMessage);
    }

    return response;
  } catch (error) {
    console.error('OpenAI API error:', error);
    return getDefaultResponse(userMessage);
  }
}

/**
 * 海外関連の質問かどうか判定
 */
export function isOverseasQuestion(message: string): boolean {
  return OVERSEAS_KEYWORDS.some(keyword => message.includes(keyword));
}

/**
 * FAQから回答を検索
 */
function searchFAQ(message: string): string | null {
  const lowerMessage = message.toLowerCase();
  
  // 治安・安全に関する質問
  if (lowerMessage.includes('安全') || lowerMessage.includes('治安')) {
    const countries = ['アメリカ', 'フィリピン', '韓国', 'タイ', 'ベトナム', 'オーストラリア', 'ハワイ', 'グアム', '台湾'];
    for (const country of countries) {
      if (message.includes(country)) {
        return `${country}の治安についてですね。\n\n【基本的な注意点】\n・夜間の一人歩きは避ける\n・貴重品は分散して持つ\n・荷物から目を離さない\n・正規のタクシーを利用\n\n最新情報は外務省の海外安全ホームページもご確認ください。\n\n具体的に気になる点があれば、お気軽に質問してくださいね！`;
      }
    }
    return `海外の治安についてのご質問ですね。\n\n基本的にどの国でも：\n・夜間の一人歩きは避ける\n・貴重品は分散して持つ\n・正規のタクシーを利用\n\nが大切です。\n\nどの国に行かれる予定ですか？具体的にアドバイスしますね！`;
  }
  
  // 持ち物に関する質問
  if (lowerMessage.includes('持ち物') || lowerMessage.includes('準備') || lowerMessage.includes('必要なもの')) {
    return `海外旅行の持ち物ですね！\n\n【必須】\n□ パスポート（有効期限6ヶ月以上）\n□ 航空券/eチケット\n□ 現金・クレカ\n□ 海外旅行保険証\n□ スマホ・充電器\n□ 変換プラグ\n\n【あると便利】\n□ モバイルバッテリー\n□ Wi-Fi/SIM\n□ 常備薬\n□ 衛生用品\n\n行き先によって必要なものが変わります。どちらへ行かれますか？`;
  }
  
  // 両替に関する質問
  if (lowerMessage.includes('両替') || lowerMessage.includes('お金') || lowerMessage.includes('現金')) {
    return `両替についてですね！\n\n【お得な順】\n1. 現地ATMで海外キャッシング\n2. 現地の両替所（空港より街中）\n3. 日本の金券ショップ\n4. 日本の空港（レート悪め）\n\n【ポイント】\n・クレカ払いが一番お得なことも\n・現金は最低限に（盗難リスク）\n・複数の支払い手段を用意\n\n他に気になることはありますか？`;
  }
  
  // Wi-Fi・SIMに関する質問
  if (lowerMessage.includes('wifi') || lowerMessage.includes('wi-fi') || lowerMessage.includes('sim') || lowerMessage.includes('ネット')) {
    return `海外でのネット環境ですね！\n\n【選択肢】\n1. Wi-Fiレンタル（安心・簡単）\n2. 現地SIM（安い・中級者向け）\n3. eSIM（対応スマホなら便利）\n4. 海外ローミング（割高だが手軽）\n\n【おすすめ】\n・短期旅行 → Wi-Fiレンタル\n・長期滞在 → 現地SIM or eSIM\n・1日500〜1,000円が目安\n\nどのくらいの期間行かれますか？`;
  }
  
  // 保険に関する質問
  if (lowerMessage.includes('保険')) {
    return `海外旅行保険は絶対に入るべきです！\n\n【理由】\n・海外の医療費は超高額（盲腸で200万円以上も）\n・クレカ付帯だけでは補償不足のことも\n・携行品（盗難・紛失）補償も大事\n\n【目安】\n・短期旅行なら1,000〜3,000円程度\n\nUnisiaでは保険のご相談も承っています。お気軽にどうぞ！`;
  }
  
  // ビザに関する質問
  if (lowerMessage.includes('ビザ') || lowerMessage.includes('入国')) {
    return `ビザについてですね。\n\n【日本人が短期観光でビザ不要な国】\n・韓国、台湾、タイ、シンガポール\n・アメリカ（ESTA必要）\n・ヨーロッパ各国\nなど多数\n\n【ビザが必要な場合】\n・長期滞在（留学・ワーホリ）\n・一部の国への観光\n\nどちらの国に行かれますか？詳しくお伝えします！`;
  }
  
  // 時期・季節に関する質問
  if (lowerMessage.includes('いつ') || lowerMessage.includes('時期') || lowerMessage.includes('季節') || lowerMessage.includes('ベストシーズン')) {
    return `旅行の時期についてですね！\n\n【季節別おすすめ】\n🌸春（3-5月）：台湾、ベトナム\n🌻夏（6-8月）：バリ、ハワイ、北欧\n🍂秋（9-11月）：韓国、オーストラリア\n❄冬（12-2月）：タイ、グアム、オーロラ\n\nどんな旅行をお考えですか？目的に合わせてアドバイスしますね！`;
  }
  
  return null;
}

function getDefaultResponse(userMessage: string): string {
  // まずFAQから検索
  const faqResponse = searchFAQ(userMessage);
  if (faqResponse) {
    return faqResponse;
  }
  
  // キーワードベースのシンプルな応答
  const lowerMessage = userMessage.toLowerCase();
  
  if (lowerMessage.includes('留学')) {
    return `留学についてのご質問ですね！\n\n【Unisiaの留学サポート】\n・フィリピン・サイパン中心\n・大手より65%以上コスト削減\n・24時間LINEサポート\n\n期間や予算、目的を教えていただければ、具体的にご案内できます！`;
  }
  
  if (lowerMessage.includes('転職') || lowerMessage.includes('就職')) {
    return `帰国後のキャリアについてのご相談ですね。\n\n専門スタッフが対応いたしますので、しばらくお待ちください。`;
  }
  
  if (lowerMessage.includes('緊急') || lowerMessage.includes('助けて')) {
    return `緊急のご連絡ありがとうございます。\n\n担当者が確認次第、すぐにご連絡いたします。\n\n緊急の場合は、現地の日本大使館・領事館にもご連絡ください。`;
  }
  
  // 海外関連のキーワードがある場合
  if (isOverseasQuestion(userMessage)) {
    return `ご質問ありがとうございます！\n\nこちらの内容について確認し、回答いたします。\n\nもう少し詳しく教えていただけると、より具体的にお答えできます！\n\n例：\n・どの国に行きますか？\n・いつ頃の予定ですか？\n・何が心配ですか？`;
  }
  
  return `ご連絡ありがとうございます！\n\nお問い合わせ内容を確認し、担当スタッフより返信させていただきます。\n\nしばらくお待ちください。`;
}
