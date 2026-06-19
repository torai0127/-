import { generateResponse } from '../ai/openai.js';
import { getSafetyInfo, formatSafetyInfo, normalizeCountryName } from '../external/mofa-safety.js';

export type ConsultationTopic =
  | 'weather'
  | 'safety'
  | 'politics'
  | 'price'
  | 'wifi'
  | 'culture'
  | 'food'
  | 'tips';

export interface ParsedConsultation {
  country: string;
  topic: ConsultationTopic;
  topicLabel: string;
}

interface ConversationEntry {
  userMessage: string;
  botResponse: string;
}

export const CONSULTATION_TOPIC_OPTIONS = [
  { id: 'weather' as const, labels: ['天気', '気温', '気候'], display: '天気' },
  { id: 'safety' as const, labels: ['治安', '安全', '危険'], display: '治安' },
  { id: 'politics' as const, labels: ['政治', '情勢', '状況'], display: '情勢' },
  { id: 'price' as const, labels: ['物価', '費用', '予算', '相場'], display: '物価' },
  { id: 'wifi' as const, labels: ['wi-fi', 'wifi', 'sim', '通信', 'ネット'], display: 'Wi-Fi' },
  { id: 'culture' as const, labels: ['文化', 'マナー', '習慣'], display: '文化' },
  { id: 'food' as const, labels: ['グルメ', '食事', '料理', '食べ物'], display: 'グルメ' },
  { id: 'tips' as const, labels: ['おすすめ', 'コツ', '観光'], display: 'おすすめ' },
];

const SUPPORTED_COUNTRIES = [
  'フィリピン', '韓国', 'タイ', '台湾', 'ベトナム', 'シンガポール',
  'マレーシア', 'インドネシア', 'オーストラリア', 'ニュージーランド',
  'アメリカ', 'カナダ', 'イギリス', 'フランス', 'ドイツ', 'イタリア', 'スペイン',
  'グアム', 'サイパン', 'ハワイ', '香港', '中国', 'ドバイ', 'トルコ',
];

const COUNTRY_ALIASES: Record<string, string> = {
  '米国': 'アメリカ',
  'USA': 'アメリカ',
  'セブ': 'フィリピン',
  'マニラ': 'フィリピン',
  'ソウル': '韓国',
  '釜山': '韓国',
  'バンコク': 'タイ',
  'プーケット': 'タイ',
  '台北': '台湾',
  'ホノルル': 'ハワイ',
  'シドニー': 'オーストラリア',
  'ホーチミン': 'ベトナム',
  'ハノイ': 'ベトナム',
};

/**
 * 海外LINEサポートの初期メッセージ（テンプレート付き）
 */
export function getConsultationWelcomeMessage(): string {
  return `🌏 海外LINEサポート

ご連絡ありがとうございます！
下のテンプレートをコピーして、
必要な情報を入力してください👇

━━━━━━━━━━━━━━━

相談国: 
知りたい内容: 

━━━━━━━━━━━━━━━

【知りたい内容の例】
天気 / 治安 / 物価 / Wi-Fi / 文化 / グルメ / おすすめ / 情勢

【入力例①】天気
相談国: フィリピン
知りたい内容: 天気

【入力例②】治安
相談国: 韓国
知りたい内容: 治安

━━━━━━━━━━━━━━━

💡 ショートカット
「フィリピン 天気」のように
国名＋内容だけでもOKです！

🔗 天気・治安・情勢はリアルタイム情報も取得します`;
}

/**
 * テンプレート再表示リクエストか
 */
export function isConsultationTemplateRequest(message: string): boolean {
  const normalized = message.trim();
  const requests = ['相談テンプレ', 'テンプレート', '入力例', '相談テンプレート'];
  return requests.some(keyword => normalized === keyword || normalized.includes(keyword));
}

/**
 * テンプレート入力またはショートカット形式か
 */
export function isConsultationTemplateInput(message: string): boolean {
  return parseConsultationInput(message) !== null;
}

function detectTopic(text: string): { topic: ConsultationTopic; label: string } | null {
  const lower = text.toLowerCase();
  for (const option of CONSULTATION_TOPIC_OPTIONS) {
    if (option.labels.some(label => lower.includes(label.toLowerCase()))) {
      return { topic: option.id, label: option.display };
    }
  }
  return null;
}

function detectCountry(text: string): string | null {
  for (const country of SUPPORTED_COUNTRIES) {
    if (text.includes(country)) return country;
  }
  for (const [alias, country] of Object.entries(COUNTRY_ALIASES)) {
    if (text.includes(alias)) return country;
  }
  return normalizeCountryName(text);
}

function parseTemplateFields(message: string): ParsedConsultation | null {
  const countryPatterns = [
    /相談国[\s:：]*\n▶[^\n]*\n▶\s*([^\n]+)/,
    /相談国[\s:：]*\n▶\s*([^\n]+)/,
    /相談国[:：]\s*([^\n]+)/,
  ];
  const topicPatterns = [
    /知りたい内容[\s:：]*\n▶[^\n]*\n▶\s*([^\n]+)/,
    /知りたい内容[\s:：]*\n▶\s*([^\n]+)/,
    /知りたい内容[:：]\s*([^\n]+)/,
  ];

  let countryRaw: string | null = null;
  let topicRaw: string | null = null;

  for (const pattern of countryPatterns) {
    const match = message.match(pattern);
    if (match?.[1]?.trim()) {
      countryRaw = match[1].trim();
      break;
    }
  }

  for (const pattern of topicPatterns) {
    const match = message.match(pattern);
    if (match?.[1]?.trim()) {
      topicRaw = match[1].trim();
      break;
    }
  }

  if (!countryRaw || !topicRaw) return null;

  const country = detectCountry(countryRaw) || countryRaw.trim();
  const topicInfo = detectTopic(topicRaw);
  if (!topicInfo) return null;

  return {
    country,
    topic: topicInfo.topic,
    topicLabel: topicInfo.label,
  };
}

function parseShortKeyword(message: string): ParsedConsultation | null {
  const trimmed = message.trim();
  if (trimmed.includes('相談国') || trimmed.includes('知りたい内容')) {
    return null;
  }

  const country = detectCountry(trimmed);
  const topicInfo = detectTopic(trimmed);
  if (!country || !topicInfo) return null;

  return {
    country,
    topic: topicInfo.topic,
    topicLabel: topicInfo.label,
  };
}

/**
 * 相談入力を解析
 */
export function parseConsultationInput(message: string): ParsedConsultation | null {
  return parseTemplateFields(message) || parseShortKeyword(message);
}

function buildQuery(parsed: ParsedConsultation): string {
  switch (parsed.topic) {
    case 'weather':
      return `${parsed.country}の天気は？`;
    case 'safety':
    case 'politics':
      return `${parsed.country}の治安は？`;
    case 'price':
      return `${parsed.country}の物価は？`;
    case 'wifi':
      return `${parsed.country}のWi-Fiは？`;
    case 'culture':
      return `${parsed.country}の文化・マナーは？`;
    case 'food':
      return `${parsed.country}のグルメは？`;
    case 'tips':
      return `${parsed.country}のおすすめは？`;
    default:
      return `${parsed.country}について教えて`;
  }
}

/**
 * 相談メッセージを処理
 */
export async function handleConsultationMessage(
  userMessage: string,
  history: ConversationEntry[] = [],
): Promise<string> {
  if (isConsultationTemplateRequest(userMessage)) {
    return getConsultationWelcomeMessage();
  }

  const parsed = parseConsultationInput(userMessage);
  if (!parsed) {
    return getConsultationWelcomeMessage();
  }

  const query = buildQuery(parsed);
  const faqResponse = await generateResponse(query, history);

  if (parsed.topic === 'safety' || parsed.topic === 'politics') {
    const safetyInfo = await getSafetyInfo(parsed.country);
    if (safetyInfo) {
      const mofaBlock = formatSafetyInfo(safetyInfo, parsed.topic === 'politics');
      return `${mofaBlock}\n\n━━━━━━━━━━━━━━━\n\n${faqResponse}`;
    }
  }

  return faqResponse;
}
