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

// おすすめ海外保険
const RECOMMENDED_INSURANCE = [
  {
    name: '損保ジャパン「新・海外旅行保険off!」',
    price: '約1,000円〜/週',
    features: ['ネット申込で割引', 'カスタマイズ可能', '24時間日本語対応'],
  },
  {
    name: 'エイチ・エス損保「たびとも」',
    price: '約500円〜/週',
    features: ['業界最安クラス', 'シンプルプラン', '当日申込OK'],
  },
  {
    name: 'ジェイアイ傷害火災「t@biho」',
    price: '約800円〜/週',
    features: ['リピーター割引', 'ファミリープラン', 'カスタマイズ豊富'],
  },
];

/**
 * 保険相談の初期メッセージ
 */
export function getInsuranceWelcomeMessage(): string {
  return `🛡️ 海外保険の無料相談をご希望ですね！

下記テンプレートをご記入ください！

・渡航期間
▶︎（例：2週間、3ヶ月、1年）

・予算（0円もOK）
▶︎（例：5,000円、0円）

・到着国
▶︎（例：フィリピン、アメリカ）

ご記入いただければ、最適な保険プランをご提案します✨`;
}

/**
 * テンプレート入力を解析
 */
export function parseInsuranceTemplate(message: string): InsuranceData | null {
  const data: InsuranceData = { step: 'waiting_template' };
  
  // 渡航期間を抽出
  const periodMatch = message.match(/渡航期間[：:\s▶︎]*([^\n・]+)/i) || 
                      message.match(/(\d+(?:週間|ヶ月|か月|ヵ月|年|日))/);
  if (periodMatch) {
    data.travelPeriod = periodMatch[1].trim();
  }
  
  // 予算を抽出
  const budgetMatch = message.match(/予算[：:\s▶︎]*([^\n・]+)/i) ||
                      message.match(/(0円|無料|\d+[,，]?\d*円)/);
  if (budgetMatch) {
    data.budget = budgetMatch[1].trim();
  }
  
  // 到着国を抽出
  const destMatch = message.match(/到着国[：:\s▶︎]*([^\n・]+)/i) ||
                    message.match(/(?:行き先|目的地)[：:\s]*([^\n・]+)/i);
  if (destMatch) {
    data.destination = destMatch[1].trim();
  }
  
  // 必要な情報が揃っているかチェック
  if (data.travelPeriod && data.budget && data.destination) {
    // 予算が0円の場合はクレカ確認ステップへ
    if (data.budget.includes('0') || data.budget.includes('無料')) {
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
  
  response += `📋 おすすめ保険プラン\n\n`;
  
  for (const insurance of RECOMMENDED_INSURANCE) {
    response += `【${insurance.name}】\n`;
    response += `💰 ${insurance.price}\n`;
    response += `✅ ${insurance.features.join('\n✅ ')}\n\n`;
  }
  
  response += `📌 選び方のポイント\n\n`;
  response += `・治療費用は最低300万円以上がおすすめ\n`;
  response += `・${data.destination}はクレカ対応の病院が多い\n`;
  response += `・キャッシュレス対応があると安心\n\n`;
  
  // 予算に応じたアドバイス
  const budgetMatch = data.budget?.match(/(\d+)/);
  if (budgetMatch) {
    const budget = parseInt(budgetMatch[1]);
    if (budget < 3000) {
      response += `💡 予算${data.budget}なら「たびとも」がコスパ最強です！\n`;
    } else if (budget < 10000) {
      response += `💡 予算${data.budget}なら「off!」でカスタマイズがおすすめ！\n`;
    }
  }
  
  response += `\n詳しいプランのご相談は、スタッフが対応いたします。\nお気軽にお問い合わせください！`;
  
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
    return `📝 情報が不足しています。\n\n以下のテンプレートに沿ってご記入ください：\n\n・渡航期間\n▶︎\n\n・予算（0円もOK）\n▶︎\n\n・到着国\n▶︎`;
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
