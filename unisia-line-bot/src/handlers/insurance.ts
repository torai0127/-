import { getDatabase } from '../db/index.js';
import { setUserState, getUserState } from '../db/conversation-state.js';

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

/**
 * 保険相談の初期メッセージ（コピペ用テンプレート）
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

ご記入いただければ、最適な保険プランをご提案します✨`;
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
 * テンプレート入力を解析
 */
export function parseInsuranceTemplate(message: string): InsuranceData | null {
  const data: InsuranceData = { step: 'waiting_template' };

  // コロン形式（相談BOTと同じ）
  const periodColon = message.match(/渡航期間[:：]\s*([^\n]+)/);
  const budgetColon = message.match(/予算[^:：\n]*[:：]\s*([^\n]+)/);
  const destColon = message.match(/到着国[:：]\s*([^\n]+)/);
  if (periodColon?.[1]?.trim()) data.travelPeriod = periodColon[1].trim();
  if (budgetColon?.[1]?.trim()) data.budget = budgetColon[1].trim();
  if (destColon?.[1]?.trim()) data.destination = destColon[1].trim();

  // 行ごとに分割して解析（▶形式）
  const lines = message.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const nextLine = lines[i + 1]?.trim() || '';
    
    // 渡航期間
    if (line.includes('渡航期間')) {
      // 次の行に値がある場合
      if (nextLine.startsWith('▶') || nextLine.startsWith('▶︎')) {
        const value = nextLine.replace(/^[▶︎▶]+\s*/, '').trim();
        if (value && !value.includes('例')) {
          data.travelPeriod = value;
        }
      }
    }
    
    // 予算
    if (line.includes('予算')) {
      if (nextLine.startsWith('▶') || nextLine.startsWith('▶︎')) {
        const value = nextLine.replace(/^[▶︎▶]+\s*/, '').trim();
        if (value && !value.includes('例')) {
          data.budget = value;
        }
      }
    }
    
    // 到着国
    if (line.includes('到着国')) {
      if (nextLine.startsWith('▶') || nextLine.startsWith('▶︎')) {
        const value = nextLine.replace(/^[▶︎▶]+\s*/, '').trim();
        if (value && !value.includes('例')) {
          data.destination = value;
        }
      }
    }
  }
  
  // 自然文からも抽出を試みる
  if (!data.travelPeriod) {
    const periodMatch = message.match(/(\d+(?:週間|ヶ月|か月|ヵ月|年|日間?))/);
    if (periodMatch) {
      data.travelPeriod = periodMatch[1];
    }
  }
  
  if (!data.budget) {
    const budgetMatch = message.match(/(?:予算|費用)[はが]?\s*(0円|無料|\d+[,，]?\d*円)/i) ||
                        message.match(/(0円|無料|\d+[,，]?\d*円)/);
    if (budgetMatch) {
      data.budget = budgetMatch[1];
    }
  }
  
  if (!data.destination) {
    const countries = ['フィリピン', 'アメリカ', '韓国', 'タイ', '台湾', 'ハワイ', 'グアム', 'オーストラリア', 'ベトナム', 'シンガポール', 'カナダ', 'イギリス', 'フランス', 'ドイツ', 'イタリア', 'スペイン'];
    for (const country of countries) {
      if (message.includes(country)) {
        data.destination = country;
        break;
      }
    }
  }
  
  // 必要な情報が揃っているかチェック
  if (data.travelPeriod && data.budget && data.destination) {
    // 予算が0円の場合はクレカ確認ステップへ
    if (data.budget === '0円' || data.budget === '0' || data.budget.includes('無料')) {
      data.step = 'asking_cards';
    } else {
      data.step = 'recommendation';
    }
    return data;
  }
  
  return null;
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
  const periodMatch = data.travelPeriod?.match(/(\d+)/);
  if (periodMatch) {
    const period = parseInt(periodMatch[1]);
    const periodUnit = data.travelPeriod?.includes('年') ? 'year' : 
                       data.travelPeriod?.includes('ヶ月') || data.travelPeriod?.includes('か月') ? 'month' : 'week';
    
    let daysNeeded = period;
    if (periodUnit === 'year') daysNeeded = period * 365;
    if (periodUnit === 'month') daysNeeded = period * 30;
    if (periodUnit === 'week') daysNeeded = period * 7;
    
    if (daysNeeded > totalCoverage) {
      response += `⚠️ 渡航期間が${data.travelPeriod}の場合、クレカだけでは足りない可能性があります。\n`;
      response += `追加で海外旅行保険のご検討をおすすめします。\n\n`;
      response += formatInsuranceLinksBlock(data.budget);
    }
  }

  response += `他にご不明点があればお気軽にどうぞ！`;
  
  return response;
}

/**
 * 有料保険の提案を生成
 */
export function generatePaidInsuranceRecommendation(data: InsuranceData): string {
  let response = `🛡️ おすすめの海外旅行保険をご紹介します！\n\n`;
  response += `【ご入力内容】\n`;
  response += `・渡航期間: ${data.travelPeriod}\n`;
  response += `・予算: ${data.budget}\n`;
  response += `・到着国: ${data.destination}\n\n`;

  response += formatInsuranceLinksBlock(data.budget);

  response += `📌 選び方のポイント\n\n`;
  response += `・治療費用は最低300万円以上がおすすめ\n`;
  response += `・${data.destination}渡航はクレカ対応の病院が多い\n`;
  response += `・キャッシュレス対応があると安心\n\n`;

  const budgetMatch = data.budget?.match(/(\d+)/);
  if (budgetMatch) {
    const budget = parseInt(budgetMatch[1], 10);
    if (budget < 3000) {
      response += `💡 予算${data.budget}なら「たびとも」がコスパ最強です！\n`;
      response += `👉 https://www.hs-hoken.jp/products/travel/tabidomo/\n`;
    } else if (budget < 10000) {
      response += `💡 予算${data.budget}なら「off!」でカスタマイズがおすすめ！\n`;
      response += `👉 https://www.sompo-japan.co.jp/kinsurance/travel/off/\n`;
    }
  }

  response += `\n※リンク先は各社公式サイトです。内容は最新情報をご確認ください。`;
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
      // 予算0円の場合
      if (parsed.step === 'asking_cards') {
        setUserState(lineUserId, 'insurance', parsed);
        return getAskCreditCardsMessage(parsed);
      }
      // 有料保険の提案
      setUserState(lineUserId, 'insurance', { ...parsed, step: 'completed' });
      return generatePaidInsuranceRecommendation(parsed);
    }
    
    // テンプレートが不完全な場合
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
