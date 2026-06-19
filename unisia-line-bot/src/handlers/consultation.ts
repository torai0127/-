import { generateResponse, getWeatherForCountry, getWeatherCityName } from '../ai/openai.js';
import { getSafetyInfo, formatSafetyInfo, normalizeCountryName, getCountryCode } from '../external/mofa-safety.js';
import { isInsuranceLikeMessage } from '../db/conversation-state.js';

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
  if (isInsuranceLikeMessage(message)) return false;
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
  let countryRaw: string | null = null;
  let topicRaw: string | null = null;

  // 相談国: フィリピン / 知りたい内容: 天気（1行形式）
  const inlineCountry = message.match(/相談国[:：]\s*([^\n]+)/);
  const inlineTopic = message.match(/知りたい内容[:：]\s*([^\n]+)/);
  if (inlineCountry?.[1]?.trim() && !inlineCountry[1].includes('知りたい')) {
    countryRaw = inlineCountry[1].trim();
  }
  if (inlineTopic?.[1]?.trim()) {
    topicRaw = inlineTopic[1].trim();
  }

  // ブロック内の最後の値を採用（Elmeテンプレ＋記入欄）
  if (!countryRaw || !topicRaw) {
    const lines = message.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('相談国')) {
        const sameLine = line.match(/相談国[:：]\s*(.+)/);
        if (sameLine?.[1]?.trim()) countryRaw = sameLine[1].trim();
        for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
          const v = lines[j].trim();
          if (v && !v.startsWith('知りたい') && !v.startsWith('━') && !v.startsWith('【')) {
            if (!v.includes('例') && v.length < 30) countryRaw = v.replace(/^▶[︎]?\s*/, '');
            break;
          }
        }
      }
      if (line.startsWith('知りたい内容')) {
        const sameLine = line.match(/知りたい内容[:：]\s*(.+)/);
        if (sameLine?.[1]?.trim()) topicRaw = sameLine[1].trim();
        for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
          const v = lines[j].trim();
          if (v && !v.startsWith('━') && !v.startsWith('【')) {
            if (!v.includes('例') && v.length < 30) topicRaw = v.replace(/^▶[︎]?\s*/, '');
            break;
          }
        }
      }
    }
  }

  if (!countryRaw || !topicRaw) return null;
  if (countryRaw.includes('知りたい内容')) return null;

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
  if (isInsuranceLikeMessage(trimmed)) return null;
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
  if (isInsuranceLikeMessage(message)) return null;
  return parseTemplateFields(message) || parseShortKeyword(message);
}

/**
 * Elmeが空テンプレを自動送信しただけか（記入済みは処理する）
 */
export function isElmeConsultationTemplateEcho(message: string): boolean {
  if (!message.includes('海外LINEサポート')) return false;
  if (!message.includes('相談国') || !message.includes('知りたい内容')) return false;
  if (parseConsultationInput(message)) return false;
  if (/相談国[:：]\s*\S/.test(message) && /知りたい内容[:：]\s*\S/.test(message)) {
    return false;
  }
  return true;
}

function buildConsultationHeader(parsed: ParsedConsultation): string {
  return `📍 ${parsed.country} × ${parsed.topicLabel}\n\n`;
}

function buildResourceLinks(parsed: ParsedConsultation): string {
  const country = parsed.country;
  const code = getCountryCode(country);
  const mofaBase = 'https://www.anzen.mofa.go.jp/';
  const mofaCountry = code
    ? `https://www.anzen.mofa.go.jp/info/pcinfolist.html?cid=${code}`
    : mofaBase;
  const city = getWeatherCityName(country) || country;
  const wttrUrl = `https://wttr.in/${encodeURIComponent(city)}`;

  switch (parsed.topic) {
    case 'weather':
      return `🔗 リアルタイム天気リンク\n・wttr.in（${city}）\n${wttrUrl}\n・tenki.jp\nhttps://tenki.jp/\n・Weather.com\nhttps://weather.com/`;
    case 'safety':
      return `🔗 治安・安全情報\n・外務省 海外安全ホームページ\n${mofaCountry}\n・たびレジ（渡航届）\nhttps://www.tabisapro.jp/\n・外務省 危機管理情報\n${mofaBase}`;
    case 'politics':
      return `🔗 情勢・最新ニュース\n・外務省 海外安全\n${mofaCountry}\n・NHK WORLD JAPAN\nhttps://www3.nhk.or.jp/nhkworld/\n・BBC World News\nhttps://www.bbc.com/news/world`;
    case 'price':
      return `🔗 物価・生活費参考\n・Numbeo（物価比較）\nhttps://www.numbeo.com/cost-of-living/\n・外務省 各国・地域情報\n${mofaBase}\n・XE.com（為替）\nhttps://www.xe.com/`;
    case 'wifi':
      return `🔗 通信・Wi-Fi\n・Visit Japan Web（入国手続）\nhttps://vjw-lp.digital.go.jp/\n・Airalo（eSIM）\nhttps://www.airalo.com/\n・楽天モバイル 海外ロaming\nhttps://network.mobile.rakuten.co.jp/hawaii/`;
    case 'culture':
      return `🔗 文化・マナー\n・外務省 各国・地域情報\n${mofaBase}\n・JETRO 国・地域別情報\nhttps://www.jetro.go.jp/world/\n・大使館・領事館一覧\n${mofaBase}`;
    case 'food':
      return `🔗 グルメ・レストラン\n・TripAdvisor\nhttps://www.tripadvisor.jp/\n・Google Maps\nhttps://www.google.com/maps\n・食べログ（海外店舗も一部）\nhttps://tabelog.com/`;
    case 'tips':
      return `🔗 観光・おすすめ\n・TripAdvisor\nhttps://www.tripadvisor.jp/\n・Visit ${country}（国観光局サイトを検索）\n・外務省 旅行・滞在の注意\n${mofaCountry}`;
    default:
      return `🔗 参考リンク\n${mofaBase}`;
  }
}

function getPartialInputMessage(message: string): string | null {
  const countryMatch = message.match(/相談国[:：]\s*([^\n]+)/);
  const topicMatch = message.match(/知りたい内容[:：]\s*([^\n]+)/);
  const hasCountry = countryMatch?.[1]?.trim() && !countryMatch[1].includes('知りたい');
  const hasTopic = topicMatch?.[1]?.trim();

  const missing: string[] = [];
  if (!hasCountry) missing.push('相談国');
  if (!hasTopic) missing.push('知りたい内容');

  if (missing.length === 0 || missing.length === 2) return null;

  return `📝 あと${missing.length}項目のご記入が必要です

未入力: ${missing.join('、')}

例：
相談国: フィリピン
知りたい内容: 天気

💡 「フィリピン 天気」のショートカット入力もOKです！`;
}

async function buildTopicResponse(
  parsed: ParsedConsultation,
  history: ConversationEntry[],
): Promise<string> {
  const query = buildQuery(parsed);

  switch (parsed.topic) {
    case 'weather': {
      const weather = await getWeatherForCountry(parsed.country);
      if (weather) return weather;
      return await generateResponse(query, history);
    }
    case 'safety': {
      const safety = await getSafetyInfo(parsed.country);
      const faq = await generateResponse(query, history);
      if (safety) {
        return `${formatSafetyInfo(safety, false)}\n\n━━━━━━━━━━━━━━━\n\n${faq}`;
      }
      return faq;
    }
    case 'politics': {
      const safety = await getSafetyInfo(parsed.country);
      const faq = await generateResponse(`${parsed.country}の情勢は？`, history);
      if (safety) {
        return `${formatSafetyInfo(safety, true)}\n\n━━━━━━━━━━━━━━━\n\n${faq}`;
      }
      return faq;
    }
    default:
      return generateResponse(query, history);
  }
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
    const partial = getPartialInputMessage(userMessage);
    if (partial) return partial;
    return getConsultationWelcomeMessage();
  }

  const header = buildConsultationHeader(parsed);
  const body = await buildTopicResponse(parsed, history);
  const links = buildResourceLinks(parsed);

  return `${header}${body}

━━━━━━━━━━━━━━━

${links}

💡 他の内容も「${parsed.country} 物価」のように聞けます
「テンプレート」で入力フォーム再表示`;
}
