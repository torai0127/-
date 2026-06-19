import { getDatabase } from '../db/index.js';
import { setUserState } from '../db/conversation-state.js';

// 保険相談のステップ
type InsuranceStep = 
  | 'waiting_template'  // テンプレート入力待ち
  | 'asking_cards'      // クレカ確認中
  | 'recommendation'    // 提案済み
  | 'completed';

interface InsuranceData {
  step: InsuranceStep;
  travelPeriod?: string;
  budget?: string;
  destination?: string;
  creditCards?: string[];
}

// クレカ付帯保険の情報
const CREDIT_CARD_INSURANCE: Record<string, {
  name: string;
  coverageDays: number;
  medicalCoverage: string;
  conditions: string;
}> = {
  '楽天カード': {
    name: '楽天カード',
    coverageDays: 90,
    medicalCoverage: '最大200万円',
    conditions: '旅行代金をカードで支払うこと',
  },
  'エポスカード': {
    name: 'エポスカード',
    coverageDays: 90,
    medicalCoverage: '最大270万円',
    conditions: '自動付帯（支払い条件なし）',
  },
  '三井住友カード': {
    name: '三井住友カード',
    coverageDays: 90,
    medicalCoverage: '最大100万円',
    conditions: '旅行代金をカードで支払うこと',
  },
  'JCBカード': {
    name: 'JCBカード',
    coverageDays: 90,
    medicalCoverage: '最大100万円',
    conditions: '旅行代金をカードで支払うこと',
  },
  'セゾンカード': {
    name: 'セゾンカード',
    coverageDays: 90,
    medicalCoverage: '最大300万円（ゴールド）',
    conditions: 'カード種別による',
  },
  'アメックス': {
    name: 'アメリカン・エキスプレス',
    coverageDays: 90,
    medicalCoverage: '最大300万円',
    conditions: '旅行代金をカードで支払うこと',
  },
  'dカード': {
    name: 'dカード',
    coverageDays: 90,
    medicalCoverage: '最大200万円（ゴールド）',
    conditions: 'ゴールド以上が条件',
  },
  'イオンカード': {
    name: 'イオンカード',
    coverageDays: 90,
    medicalCoverage: '最大50万円',
    conditions: '旅行代金をカードで支払うこと',
  },
};

// おすすめ海外保険（公式申込URL付き）
interface RecommendedInsurance {
  name: string;
  price: string;
  features: string[];
  url: string;
  budgetHint?: 'low' | 'mid' | 'high';
}

const RECOMMENDED_INSURANCE: RecommendedInsurance[] = [
  {
    name: '損保ジャパン「新・海外旅行保険off!」',
    price: '約1,000円〜/週',
    features: ['ネット申込で割引', 'カスタマイズ可能', '24時間日本語対応'],
    url: 'https://www.sompo-japan.co.jp/kinsurance/travel/off/',
    budgetHint: 'mid',
  },
  {
    name: 'エイチ・エス損保「たびとも」',
    price: '約500円〜/週',
    features: ['業界最安クラス', 'シンプルプラン', '当日申込OK'],
    url: 'https://www.hs-hoken.jp/products/travel/tabidomo/',
    budgetHint: 'low',
  },
  {
    name: 'ジェイアイ傷害火災「t@biho（タビホ）」',
    price: '約800円〜/週',
    features: ['リピーター割引', 'ファミリープラン', 'カスタマイズ豊富'],
    url: 'https://www.jihoken.co.jp/personal/travel/',
    budgetHint: 'mid',
  },
  {
    name: 'チューリッヒ「スーパー海外保険」',
    price: '約1,200円〜/週',
    features: ['治療費用1億円', '救援者費用充実', '長期滞在向け'],
    url: 'https://www.zurich.co.jp/car-and-leisure/travel/super/',
    budgetHint: 'high',
  },
];

/** 到着国別の医療リスク・補償目安 */
interface DestinationProfile {
  aliases: string[];
  medicalRisk: 'low' | 'mid' | 'high' | 'very_high';
  minCoverage: string;
  notes: string[];
  preferredInsurance: string[];
}

const DESTINATION_PROFILES: DestinationProfile[] = [
  {
    aliases: ['アメリカ', '米国', 'USA', 'ハワイ', 'グアム'],
    medicalRisk: 'very_high',
    minCoverage: '3,000万円以上（1億円推奨）',
    notes: [
      '救急・入院の請求が数百万〜数千万円になるケースがあります',
      'クレカ付帯のみだと治療費上限が不足しがちです',
    ],
    preferredInsurance: ['チューリッヒ「スーパー海外保険」', '損保ジャパン「新・海外旅行保険off!」'],
  },
  {
    aliases: ['カナダ', 'イギリス', '英国', 'オーストラリア', '豪州', 'ニュージーランド'],
    medicalRisk: 'high',
    minCoverage: '3,000万円以上',
    notes: ['公立医療でも外国人は高額請求になりやすい国があります'],
    preferredInsurance: ['チューリッヒ「スーパー海外保険」', '損保ジャパン「新・海外旅行保険off!」'],
  },
  {
    aliases: ['フィリピン', 'タイ', 'ベトナム', 'カンボジア', 'インドネシア', 'マレーシア'],
    medicalRisk: 'mid',
    minCoverage: '1,000万円以上',
    notes: ['私立病院利用時は現地支払い→後日保険請求が一般的です', 'デング熱等の入院も想定しておくと安心です'],
    preferredInsurance: ['エイチ・エス損保「たびとも」', 'ジェイアイ傷害火災「t@biho（タビホ）」'],
  },
  {
    aliases: ['韓国', '台湾', 'シンガポール', '香港'],
    medicalRisk: 'mid',
    minCoverage: '1,000万円以上',
    notes: ['都市部は医療クオリティが高く、費用も中〜高程度です'],
    preferredInsurance: ['損保ジャパン「新・海外旅行保険off!」', 'エイチ・エス損保「たびとも」'],
  },
  {
    aliases: ['ヨーロッパ', 'フランス', 'ドイツ', 'イタリア', 'スペイン'],
    medicalRisk: 'high',
    minCoverage: '3,000万円以上',
    notes: ['長距離移動・盗難リスクもセットで検討しましょう'],
    preferredInsurance: ['損保ジャパン「新・海外旅行保険off!」', 'チューリッヒ「スーパー海外保険」'],
  },
];

const COUNTRY_ALIASES: Record<string, string> = {
  米国: 'アメリカ',
  USA: 'アメリカ',
  英国: 'イギリス',
  豪州: 'オーストラリア',
};

/**
 * 保険相談の初期メッセージ（コピペ用テンプレート）
 * ※文言は運用指定のため変更しない
 */
export function getInsuranceWelcomeMessage(): string {
  return `🛡️ 海外保険の無料相談をご希望ですね！

下記テンプレートをご記入ください！

・渡航期間
▶（例：2週間、3ヶ月、1年）

・予算（0円もOK）
▶（例：5,000円、0円）

・到着国
▶（例：フィリピン、アメリカ）

ご記入いただければ、最適な保険プランをご提案します✨

ーーーーーーーーーー
・渡航期間
▶

・予算（0円もOK）
▶

・到着国
▶`;
}

/**
 * 保険テンプレ再表示リクエストか
 */
export function isInsuranceTemplateRequest(message: string): boolean {
  const normalized = message.trim();
  if (normalized === '保険テンプレ' || normalized === '保険テンプレート') return true;
  if (normalized.includes('保険') && normalized.includes('テンプレ')) return true;
  return false;
}

/**
 * おすすめ保険リンクブロックを生成
 */
export function formatInsuranceLinksBlock(highlightBudget?: string): string {
  let block = `🔗 おすすめ海外旅行保険（公式サイト）\n\n`;

  let budgetNum: number | null = null;
  if (highlightBudget) {
    const m = highlightBudget.match(/(\d+)/);
    if (m) budgetNum = parseInt(m[1], 10);
  }

  for (const insurance of RECOMMENDED_INSURANCE) {
    const isRecommended =
      budgetNum !== null &&
      ((budgetNum < 3000 && insurance.budgetHint === 'low') ||
        (budgetNum >= 3000 && budgetNum < 10000 && insurance.budgetHint === 'mid') ||
        (budgetNum >= 10000 && insurance.budgetHint === 'high'));

    block += isRecommended ? `⭐ ` : '';
    block += `【${insurance.name}】\n`;
    block += `💰 ${insurance.price}\n`;
    block += `✅ ${insurance.features.join('\n✅ ')}\n`;
    block += `👉 ${insurance.url}\n\n`;
  }

  return block;
}

/**
 * 到着国を正規化
 */
function normalizeDestination(raw: string): string {
  const trimmed = raw.trim();
  for (const [alias, canonical] of Object.entries(COUNTRY_ALIASES)) {
    if (trimmed.includes(alias)) return canonical;
  }
  for (const profile of DESTINATION_PROFILES) {
    for (const alias of profile.aliases) {
      if (trimmed.includes(alias)) return alias;
    }
  }
  return trimmed;
}

/**
 * 到着国プロファイルを取得
 */
function getDestinationProfile(destination: string): DestinationProfile | null {
  const normalized = normalizeDestination(destination);
  return DESTINATION_PROFILES.find(p =>
    p.aliases.some(a => normalized.includes(a) || a.includes(normalized))
  ) || null;
}

/**
 * 渡航期間を日数に換算（概算）
 */
export function parseTravelPeriodDays(period?: string): number | null {
  if (!period) return null;
  const match = period.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const num = parseFloat(match[1]);
  if (period.includes('年')) return Math.round(num * 365);
  if (period.includes('ヶ月') || period.includes('か月') || period.includes('ヵ月')) return Math.round(num * 30);
  if (period.includes('週')) return Math.round(num * 7);
  if (period.includes('日')) return Math.round(num);
  return Math.round(num * 7); // 数字のみは週扱い
}

/**
 * 予算を円数値に換算
 */
export function parseBudgetYen(budget?: string): number {
  if (!budget) return -1;
  if (budget === '0' || budget.includes('0円') || budget.includes('無料')) return 0;
  const m = budget.replace(/[,，]/g, '').match(/(\d+)/);
  return m ? parseInt(m[1], 10) : -1;
}

/**
 * ▶形式のフィールド値を抽出（複数ブロックある場合は最後の入力を採用）
 */
function extractArrowField(message: string, labelIncludes: string): string | undefined {
  const lines = message.split('\n');
  let lastValue: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.includes(labelIncludes)) continue;

    const sameLine = line.match(/▶[︎]?\s*([^（(\n]+)/);
    if (sameLine?.[1]?.trim()) {
      const v = sameLine[1].trim();
      if (v && !v.startsWith('（') && !v.includes('例')) {
        lastValue = v;
      }
    }

    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      const next = lines[j].trim();
      if (next.startsWith('・') && !next.includes(labelIncludes)) break;
      if (next.startsWith('▶') || next.startsWith('▶︎')) {
        const v = next.replace(/^[▶︎▶]+\s*/, '').trim();
        if (v && !v.startsWith('（') && !v.includes('例')) {
          lastValue = v;
        }
        break;
      }
    }
  }

  return lastValue;
}

/**
 * テンプレート入力を解析
 */
export function parseInsuranceTemplate(message: string): InsuranceData | null {
  const data: InsuranceData = { step: 'waiting_template' };

  // コロン形式
  const periodColon = message.match(/渡航期間[:：]\s*([^\n]+)/);
  const budgetColon = message.match(/予算[^:：\n]*[:：]\s*([^\n]+)/);
  const destColon = message.match(/到着国[:：]\s*([^\n]+)/);
  if (periodColon?.[1]?.trim()) data.travelPeriod = periodColon[1].trim();
  if (budgetColon?.[1]?.trim()) data.budget = budgetColon[1].trim();
  if (destColon?.[1]?.trim()) data.destination = destColon[1].trim();

  // ▶形式（コピペブロック対応・最後の入力を優先）
  const periodArrow = extractArrowField(message, '渡航期間');
  const budgetArrow = extractArrowField(message, '予算');
  const destArrow = extractArrowField(message, '到着国');
  if (periodArrow) data.travelPeriod = periodArrow;
  if (budgetArrow) data.budget = budgetArrow;
  if (destArrow) data.destination = destArrow;

  // 自然文フォールバック
  if (!data.travelPeriod) {
    const periodMatch = message.match(/(\d+(?:\.\d+)?(?:週間|ヶ月|か月|ヵ月|年|日間?))/);
    if (periodMatch) data.travelPeriod = periodMatch[1];
  }

  if (!data.budget) {
    const budgetMatch =
      message.match(/(?:予算|費用)[はが]?\s*(0円|無料|\d+[,，]?\d*円)/i) ||
      message.match(/(0円|無料|\d+[,，]?\d*円)/);
    if (budgetMatch) data.budget = budgetMatch[1];
  }

  if (!data.destination) {
    const allCountries = [
      ...DESTINATION_PROFILES.flatMap(p => p.aliases),
      'フィリピン', '韓国', 'タイ', '台湾', 'ハワイ', 'グアム',
      'オーストラリア', 'ベトナム', 'シンガポール', 'カナダ',
      'イギリス', 'フランス', 'ドイツ', 'イタリア', 'スペイン', '中国', 'インド',
    ];
    for (const country of allCountries) {
      if (message.includes(country)) {
        data.destination = normalizeDestination(country);
        break;
      }
    }
  } else {
    data.destination = normalizeDestination(data.destination);
  }

  if (data.travelPeriod && data.budget && data.destination) {
    if (parseBudgetYen(data.budget) === 0) {
      data.step = 'asking_cards';
    } else {
      data.step = 'recommendation';
    }
    return data;
  }

  return null;
}

/**
 * 未入力項目の案内
 */
function getPartialInputMessage(data: Partial<InsuranceData>): string {
  const missing: string[] = [];
  if (!data.travelPeriod) missing.push('・渡航期間');
  if (!data.budget) missing.push('・予算（0円もOK）');
  if (!data.destination) missing.push('・到着国');

  return `📝 あと${missing.length}項目のご記入が必要です

未入力：
${missing.join('\n')}

下のコピペ欄に記入して、そのまま送信してください👇`;
}

/**
 * 国別アドバイス文
 */
function buildCountryAdviceSection(data: InsuranceData): string {
  const profile = getDestinationProfile(data.destination || '');
  if (!profile) {
    return `🌍 ${data.destination} 向けのポイント\n\n・治療費用は1,000万円以上の補償があると安心\n・携行品・航空機遅延もセットで確認しましょう\n\n`;
  }

  let section = `🌍 ${data.destination} 向けのポイント\n\n`;
  section += `・推奨補償額: ${profile.minCoverage}\n`;
  for (const note of profile.notes) {
    section += `・${note}\n`;
  }
  section += `\n`;
  return section;
}

/**
 * 渡航期間に応じたアドバイス
 */
function buildPeriodAdviceSection(data: InsuranceData): string {
  const days = parseTravelPeriodDays(data.travelPeriod);
  if (!days) return '';

  let section = `📅 渡航期間: ${data.travelPeriod}（約${days}日）\n\n`;

  if (days <= 14) {
    section += `・短期旅行なら「たびとも」「off!」の短期プランがコスパ良好です\n`;
  } else if (days <= 90) {
    section += `・1〜3ヶ月滞在はカスタマイズ型（off! / タビホ）がおすすめ\n`;
  } else {
    section += `・90日超の長期滞在はクレカ付帯の切替＋追加保険の併用を検討\n`;
    section += `・長期専用プラン（チューリッヒ等）も候補です\n`;
  }

  section += `\n`;
  return section;
}

/**
 * 加入前チェックリスト
 */
function buildInsuranceChecklist(data: InsuranceData): string {
  const profile = getDestinationProfile(data.destination || '');
  const minCoverage = profile?.minCoverage || '1,000万円以上';

  return `📋 加入前チェックリスト

☑ 治療・救援費用: ${minCoverage}
☑ 渡航期間(${data.travelPeriod})をカバー
☑ 携行品損害（盗難・紛失）
☑ 航空機遅延・欠航
☑ クレカ付帯のみの場合は上限額を要確認

※各社サイトで最新の補償内容・料金をご確認ください\n\n`;
}

/**
 * 条件に最適な保険1社を選定
 */
function pickPrimaryInsurance(data: InsuranceData): RecommendedInsurance {
  const budget = parseBudgetYen(data.budget);
  const profile = getDestinationProfile(data.destination || '');
  const days = parseTravelPeriodDays(data.travelPeriod) || 7;

  if (profile?.preferredInsurance?.length) {
    for (const pref of profile.preferredInsurance) {
      const match = RECOMMENDED_INSURANCE.find(i => i.name === pref || i.name.includes(pref.replace(/.*「/, '').replace(/」.*/, '')));
      if (match) return match;
    }
  }

  if (profile?.medicalRisk === 'very_high' || profile?.medicalRisk === 'high') {
    return RECOMMENDED_INSURANCE.find(i => i.budgetHint === 'high') || RECOMMENDED_INSURANCE[3];
  }

  if (budget >= 0 && budget < 3000) {
    return RECOMMENDED_INSURANCE.find(i => i.budgetHint === 'low') || RECOMMENDED_INSURANCE[1];
  }

  if (days > 60) {
    return RECOMMENDED_INSURANCE.find(i => i.budgetHint === 'high') || RECOMMENDED_INSURANCE[3];
  }

  return RECOMMENDED_INSURANCE.find(i => i.budgetHint === 'mid') || RECOMMENDED_INSURANCE[0];
}

/**
 * 相談内容をDBに保存
 */
function saveInsuranceConsultation(lineUserId: string, data: InsuranceData): void {
  try {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO insurance_consultations (
        line_user_id, travel_period, budget, destination, credit_cards, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      lineUserId,
      data.travelPeriod || '',
      data.budget || '',
      data.destination || '',
      data.creditCards ? JSON.stringify(data.creditCards) : null,
      data.step
    );
  } catch {
    // テーブル未作成等は無視
  }
}

/**
 * 予算0円の場合のクレカ確認メッセージ
 */
export function getAskCreditCardsMessage(data: InsuranceData): string {
  return `📋 ご記入ありがとうございます！

【ご入力内容】
・渡航期間: ${data.travelPeriod}
・予算: ${data.budget}
・到着国: ${data.destination}

予算0円とのことで、クレジットカードの付帯保険を活用する方法をご提案します！

💳 お持ちのクレジットカードを教えてください

例：
・楽天カード
・エポスカード
・三井住友カード
・JCBカード
・セゾンカード
・アメックス
・dカード
・イオンカード

※複数お持ちの場合は全てお教えください
※3枚あれば最大9ヶ月分の保険をカバーできます！`;
}

/**
 * クレカ情報を解析
 */
export function parseCreditCards(message: string): string[] {
  const cards: string[] = [];
  const cardNames = Object.keys(CREDIT_CARD_INSURANCE);
  
  for (const cardName of cardNames) {
    if (message.includes(cardName) || message.toLowerCase().includes(cardName.toLowerCase())) {
      cards.push(cardName);
    }
  }
  
  // 一般的な表記も検出
  if (message.includes('楽天')) cards.push('楽天カード');
  if (message.includes('エポス')) cards.push('エポスカード');
  if (message.includes('三井住友') || message.includes('SMBC')) cards.push('三井住友カード');
  if (message.includes('JCB')) cards.push('JCBカード');
  if (message.includes('セゾン')) cards.push('セゾンカード');
  if (message.includes('アメックス') || message.includes('AMEX')) cards.push('アメックス');
  if (message.includes('dカード') || message.includes('ドコモ')) cards.push('dカード');
  if (message.includes('イオン')) cards.push('イオンカード');
  
  // 重複を削除
  return [...new Set(cards)];
}

/**
 * クレカ付帯保険の提案を生成
 */
export function generateCreditCardInsuranceRecommendation(
  data: InsuranceData,
  cards: string[]
): string {
  let response = `🎉 クレカ付帯保険でカバーできます！\n\n`;
  response += `【ご入力内容】\n`;
  response += `・渡航期間: ${data.travelPeriod}\n`;
  response += `・到着国: ${data.destination}\n\n`;
  
  response += `💳 お持ちのカードの保険内容\n\n`;
  
  let totalCoverage = 0;
  let autoAttachCard = '';
  
  for (const card of cards) {
    const info = CREDIT_CARD_INSURANCE[card];
    if (info) {
      response += `【${info.name}】\n`;
      response += `・補償期間: ${info.coverageDays}日\n`;
      response += `・治療費用: ${info.medicalCoverage}\n`;
      response += `・条件: ${info.conditions}\n\n`;
      totalCoverage += info.coverageDays;
      
      if (info.conditions.includes('自動付帯')) {
        autoAttachCard = info.name;
      }
    }
  }
  
  // 活用方法の提案
  response += `📌 活用のポイント\n\n`;
  
  if (cards.length >= 3) {
    response += `✨ ${cards.length}枚お持ちなので、最大${Math.min(cards.length * 90, 270)}日分の保険をカバーできます！\n\n`;
    response += `【活用方法】\n`;
    response += `1️⃣ 1枚目: 出発〜90日目まで使用\n`;
    response += `2️⃣ 2枚目: 91日目に現地で交通費をカード決済\n`;
    response += `   → 新たに90日間の補償開始\n`;
    response += `3️⃣ 3枚目: 181日目に同様にカード決済\n`;
    response += `   → さらに90日間の補償開始\n\n`;
  } else if (cards.length >= 2) {
    response += `✨ ${cards.length}枚お持ちなので、最大180日分の保険をカバーできます！\n\n`;
    response += `【活用方法】\n`;
    response += `1️⃣ 1枚目で出発〜90日目まで\n`;
    response += `2️⃣ 91日目に2枚目で現地交通費を決済\n`;
    response += `   → 新たに90日間の補償開始\n\n`;
  } else {
    response += `1枚で90日間の補償がカバーできます。\n\n`;
  }
  
  if (autoAttachCard) {
    response += `💡 ${autoAttachCard}は自動付帯なので、持っているだけで補償されます！\n\n`;
  }
  
  // 渡航期間が長い場合の注意
  const daysNeeded = parseTravelPeriodDays(data.travelPeriod) || 0;
  const totalCoverage = cards.reduce((sum, card) => {
    const info = CREDIT_CARD_INSURANCE[card];
    return sum + (info?.coverageDays || 0);
  }, 0);

  if (daysNeeded > totalCoverage) {
    response += `⚠️ 渡航期間(${data.travelPeriod})に対し、クレカ付帯だけでは日数が不足する可能性があります。\n`;
    response += `追加で海外旅行保険のご検討をおすすめします。\n\n`;
    response += buildCountryAdviceSection(data);
    response += formatInsuranceLinksBlock(data.budget);
    response += buildInsuranceChecklist(data);
  } else if (getDestinationProfile(data.destination || '')?.medicalRisk === 'very_high') {
    response += `⚠️ ${data.destination}は医療費が高額になりやすい国です。\n`;
    response += `クレカ付帯の治療費上限を確認し、不足する場合は追加保険をご検討ください。\n\n`;
    const primary = pickPrimaryInsurance(data);
    response += `⭐ 追加候補: ${primary.name}\n👉 ${primary.url}\n\n`;
  }

  response += `他にご不明点があればお気軽にどうぞ！`;
  
  return response;
}

/**
 * 有料保険の提案を生成
 */
export function generatePaidInsuranceRecommendation(data: InsuranceData): string {
  const primary = pickPrimaryInsurance(data);

  let response = `🛡️ ${data.destination}向け・おすすめの海外旅行保険\n\n`;
  response += `【ご入力内容】\n`;
  response += `・渡航期間: ${data.travelPeriod}\n`;
  response += `・予算: ${data.budget}\n`;
  response += `・到着国: ${data.destination}\n\n`;

  response += buildCountryAdviceSection(data);
  response += buildPeriodAdviceSection(data);

  response += `⭐ 第一候補\n`;
  response += `【${primary.name}】\n`;
  response += `💰 ${primary.price}\n`;
  response += `✅ ${primary.features.join('\n✅ ')}\n`;
  response += `👉 ${primary.url}\n\n`;

  response += formatInsuranceLinksBlock(data.budget);
  response += buildInsuranceChecklist(data);

  response += `📌 選び方のポイント\n\n`;
  response += `・治療費用は${getDestinationProfile(data.destination || '')?.minCoverage || '1,000万円以上'}が目安\n`;
  response += `・${data.destination}渡航は公式サイトで補償内容を必ず確認\n`;
  response += `・申込は出発前日まで（当日申込可の商品もあります）\n\n`;

  response += `※リンク先は各社公式サイトです。`;
  return response;
}

/**
 * 保険相談のメッセージを処理
 */
export function handleInsuranceMessage(
  lineUserId: string,
  message: string,
  currentData?: InsuranceData
): string {
  if (isInsuranceTemplateRequest(message)) {
    setUserState(lineUserId, 'insurance', { step: 'waiting_template' });
    return getInsuranceWelcomeMessage();
  }

  // 新規または待機中の場合、テンプレート解析を試みる
  if (!currentData || currentData.step === 'waiting_template') {
    const parsed = parseInsuranceTemplate(message);
    
    if (parsed) {
      saveInsuranceConsultation(lineUserId, parsed);

      if (parsed.step === 'asking_cards') {
        setUserState(lineUserId, 'insurance', parsed);
        return getAskCreditCardsMessage(parsed);
      }

      setUserState(lineUserId, 'insurance', { ...parsed, step: 'completed' });
      return generatePaidInsuranceRecommendation(parsed);
    }

    // 部分入力の案内
    const partial: Partial<InsuranceData> = {
      travelPeriod: extractArrowField(message, '渡航期間'),
      budget: extractArrowField(message, '予算'),
      destination: extractArrowField(message, '到着国')
        ? normalizeDestination(extractArrowField(message, '到着国')!)
        : undefined,
    };
    const filledCount = [partial.travelPeriod, partial.budget, partial.destination].filter(Boolean).length;
    if (filledCount > 0 && filledCount < 3) {
      return getPartialInputMessage(partial);
    }
    
    return getInsuranceWelcomeMessage();
  }
  
  // クレカ確認中の場合
  if (currentData.step === 'asking_cards') {
    const cards = parseCreditCards(message);
    
    if (cards.length > 0) {
      currentData.creditCards = cards;
      currentData.step = 'completed';
      setUserState(lineUserId, 'insurance', currentData);
      return generateCreditCardInsuranceRecommendation(currentData, cards);
    }
    
    // カードが検出できない場合
    return `💳 クレジットカード名が確認できませんでした。\n\nお持ちのカードを教えてください：\n・楽天カード\n・エポスカード\n・三井住友カード\n・JCBカード\n・セゾンカード\n・アメックス\n・dカード\n・イオンカード\n\n※該当するカード名をそのままお送りください`;
  }
  
  // 完了後の追加質問
  return `ご質問ありがとうございます！\n\n保険について追加でご質問があればお気軽にどうぞ。\n\n別のサポートをご希望の場合は、リッチメニューからお選びください。`;
}
