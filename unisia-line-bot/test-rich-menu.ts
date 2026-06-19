/**
 * リッチメニュー対応テスト
 */

import { initDatabase } from './src/db/index.js';
import {
  getUserState,
  setUserState,
  resetUserState,
  isConversationTimedOut,
  detectModeFromKeyword,
  isInsuranceTemplateInput,
} from './src/db/conversation-state.js';
import {
  getInsuranceWelcomeMessage,
  handleInsuranceMessage,
  parseInsuranceTemplate,
  parseCreditCards,
  generateCreditCardInsuranceRecommendation,
  generatePaidInsuranceRecommendation,
} from './src/handlers/insurance.js';
import {
  getConsultationWelcomeMessage,
  parseConsultationInput,
  isConsultationTemplateInput,
  isConsultationTemplateRequest,
} from './src/handlers/consultation.js';

// handler.tsから持ってきた自動切替テスト用関数
const OVERSEAS_QUESTION_KEYWORDS = [
  '気温', '天気', '気候', '季節',
  '治安', '安全', '危険',
  '物価', '費用', '相場', '予算',
  'おすすめ', 'オススメ', 'お店', 'レストラン', '観光', 'スポット',
  'Wi-Fi', 'wifi', 'SIM', 'ネット',
  '文化', 'マナー', '言語', '言葉',
  '食事', 'グルメ', '料理', '食べ物',
  'ビザ', '入国', 'パスポート',
  '持ち物', '準備', '服装',
];
const INSURANCE_KEYWORDS = [
  '保険', 'クレカ', 'クレジットカード', 'カード',
  '渡航期間', '予算', '到着国', '補償', '治療費',
];
function isGeneralOverseasQuestion(message: string): boolean {
  if (INSURANCE_KEYWORDS.some(kw => message.includes(kw))) return false;
  return OVERSEAS_QUESTION_KEYWORDS.some(kw => message.toLowerCase().includes(kw.toLowerCase()));
}

// DB初期化
initDatabase();

console.log('========================================');
console.log('🧪 リッチメニュー対応テスト');
console.log('========================================\n');

// テスト用ユーザーID
const testUserId = 'test_user_001';

// ========================================
// 0. 保険テンプレート入力検出テスト（最重要）
// ========================================
console.log('📌 0. 保険テンプレート入力検出テスト\n');

const templateInputs = [
  {
    name: 'ユーザーのテンプレート入力（実際の形式）',
    text: `・渡航期間
▶6ヶ月

・予算（0円もOK）
▶0円

・到着国
▶オーストラリア`,
    expected: true,
  },
  {
    name: 'エルメからの空テンプレート（未入力）',
    text: `・渡航期間
▶

・予算（0円もOK）
▶

・到着国
▶`,
    expected: false,
  },
  {
    name: '普通のメッセージ',
    text: 'オーストラリアの治安は？',
    expected: false,
  },
];

for (const t of templateInputs) {
  const result = isInsuranceTemplateInput(t.text);
  const status = result === t.expected ? '✅' : '❌';
  console.log(`${status} ${t.name}: ${result} (expected: ${t.expected})`);
}

// ========================================
// 0b. 相談テンプレート入力検出テスト
// ========================================
console.log('\n📌 0b. 相談テンプレート入力検出テスト\n');

const consultationInputs = [
  {
    name: 'ショートカット（天気）',
    text: 'フィリピン 天気',
    expectedCountry: 'フィリピン',
    expectedTopic: 'weather',
  },
  {
    name: 'ショートカット（治安）',
    text: '韓国 治安',
    expectedCountry: '韓国',
    expectedTopic: 'safety',
  },
  {
    name: 'テンプレート形式',
    text: `相談国: 台湾
知りたい内容: 物価`,
    expectedCountry: '台湾',
    expectedTopic: 'price',
  },
  {
    name: '保険テンプレ（誤検出しない）',
    text: `・渡航期間
▶6ヶ月

・予算（0円もOK）
▶0円

・到着国
▶オーストラリア`,
    expectedCountry: null,
    expectedTopic: null,
  },
];

for (const t of consultationInputs) {
  const parsed = parseConsultationInput(t.text);
  const ok = (parsed?.country === t.expectedCountry && parsed?.topic === t.expectedTopic)
    || (t.expectedCountry === null && parsed === null);
  console.log(`${ok ? '✅' : '❌'} ${t.name}: ${parsed ? `${parsed.country} / ${parsed.topic}` : 'null'}`);
}

console.log(`\n✅ テンプレ再表示: ${isConsultationTemplateRequest('テンプレート')}`);
console.log(`✅ 初回メッセージ先頭: ${getConsultationWelcomeMessage().substring(0, 20)}...`);

// ========================================
// 1. キーワード検出テスト
// ========================================
console.log('\n📌 1. キーワード検出テスト\n');

const keywords = [
  { text: '緊急対応サポート', expected: 'emergency' },
  { text: 'いかがなさいましたでしょうか？', expected: 'emergency' },
  { text: 'https://lin.ee/ZgWRQ6U', expected: 'study_abroad' },
  { text: '海外留学の無料相談をご希望ですね', expected: 'study_abroad' },
  { text: '帰国後転職サポート', expected: 'job_change' },
  { text: '海外保険の無料相談', expected: 'insurance' },
  { text: '最適な保険プランをご提案します', expected: 'insurance' },
  { text: '渡航期間・予算・到着国のテンプレート', expected: 'insurance' },
  { text: '海外LINEサポート', expected: 'overseas_qa' },
  // エルメからの海外LINEサポート自動送信メッセージ
  { text: 'ご質問ありがとうございます！何か質問等あればご遠慮なくチャットにてご連絡ください！', expected: 'overseas_qa' },
  { text: '質問があります', expected: 'overseas_qa' },
  { text: 'オーストラリアの治安は？', expected: null },
];

for (const kw of keywords) {
  const result = detectModeFromKeyword(kw.text);
  const status = result === kw.expected ? '✅' : '❌';
  console.log(`${status} "${kw.text.substring(0, 20)}..." → ${result || 'null'} (expected: ${kw.expected || 'null'})`);
}

// ========================================
// 2. 会話状態管理テスト
// ========================================
console.log('\n📌 2. 会話状態管理テスト\n');

// 状態をリセット
resetUserState(testUserId);
console.log('✅ 状態リセット完了');

// 緊急モードに設定
setUserState(testUserId, 'emergency');
let state = getUserState(testUserId);
console.log(`✅ 緊急モード設定: currentMode = ${state?.currentMode}`);

// 保険モードに切り替え
setUserState(testUserId, 'insurance', { step: 'waiting_template' });
state = getUserState(testUserId);
console.log(`✅ 保険モードに切替: currentMode = ${state?.currentMode}, modeData = ${JSON.stringify(state?.modeData)}`);

// タイムアウトテスト（10分前の時刻をシミュレート）
const oldState = {
  lineUserId: testUserId,
  currentMode: 'insurance' as const,
  lastMessageAt: new Date(Date.now() - 11 * 60 * 1000), // 11分前
};
console.log(`✅ タイムアウトチェック (11分前): ${isConversationTimedOut(oldState) ? 'タイムアウト' : 'アクティブ'}`);

const recentState = {
  lineUserId: testUserId,
  currentMode: 'insurance' as const,
  lastMessageAt: new Date(Date.now() - 5 * 60 * 1000), // 5分前
};
console.log(`✅ タイムアウトチェック (5分前): ${isConversationTimedOut(recentState) ? 'タイムアウト' : 'アクティブ'}`);

// ========================================
// 3. 保険チャットボットテスト
// ========================================
console.log('\n📌 3. 保険チャットボットテスト\n');

// 初期メッセージ
console.log('--- 初期メッセージ ---');
console.log(getInsuranceWelcomeMessage().substring(0, 100) + '...\n');

// テンプレート解析テスト
console.log('--- テンプレート解析テスト ---');

const templates = [
  `・渡航期間
▶︎2週間

・予算（0円もOK）
▶︎0円

・到着国
▶︎フィリピン`,

  `・渡航期間
▶︎3ヶ月

・予算（0円もOK）
▶︎5000円

・到着国
▶︎アメリカ`,

  `渡航期間は1年、予算は0円、到着国はオーストラリアです`,
];

for (let i = 0; i < templates.length; i++) {
  const parsed = parseInsuranceTemplate(templates[i]);
  console.log(`テスト${i + 1}:`);
  if (parsed) {
    console.log(`  ✅ 期間: ${parsed.travelPeriod}, 予算: ${parsed.budget}, 国: ${parsed.destination}, ステップ: ${parsed.step}`);
  } else {
    console.log(`  ❌ 解析失敗`);
  }
}

// クレカ解析テスト
console.log('\n--- クレカ解析テスト ---');

const cardMessages = [
  '楽天カードとエポスカードを持っています',
  '三井住友、JCB、アメックスがあります',
  'セゾンとdカードとイオンカード',
];

for (const msg of cardMessages) {
  const cards = parseCreditCards(msg);
  console.log(`"${msg}" → [${cards.join(', ')}]`);
}

// クレカ保険提案テスト
console.log('\n--- クレカ保険提案テスト ---');

const insuranceData = {
  step: 'asking_cards' as const,
  travelPeriod: '6ヶ月',
  budget: '0円',
  destination: 'オーストラリア',
};

const cards = ['楽天カード', 'エポスカード', '三井住友カード'];
const recommendation = generateCreditCardInsuranceRecommendation(insuranceData, cards);
console.log(recommendation.substring(0, 500) + '...\n');

// ========================================
// 4. 会話フローシミュレーション
// ========================================
console.log('\n📌 4. 会話フローシミュレーション\n');

// シナリオ1: 保険相談（予算0円）
console.log('=== シナリオ1: 保険相談（予算0円） ===\n');

resetUserState(testUserId);
setUserState(testUserId, 'insurance', { step: 'waiting_template' });

// Step 1: テンプレート入力
const step1Input = `・渡航期間
▶︎3ヶ月

・予算（0円もOK）
▶︎0円

・到着国
▶︎フィリピン`;

console.log(`👤 ユーザー: (テンプレート入力)\n`);
let response = handleInsuranceMessage(testUserId, step1Input, { step: 'waiting_template' });
console.log(`🤖 ボット: ${response.substring(0, 200)}...\n`);

// Step 2: クレカ入力
console.log(`👤 ユーザー: 楽天カードとエポスカードを持っています\n`);
const newState = getUserState(testUserId);
response = handleInsuranceMessage(testUserId, '楽天カードとエポスカードを持っています', newState?.modeData);
console.log(`🤖 ボット: ${response.substring(0, 300)}...\n`);

// シナリオ2: 保険相談（予算あり）
console.log('=== シナリオ2: 保険相談（予算あり） ===\n');

resetUserState(testUserId);

const step2Input = `・渡航期間
▶︎1週間

・予算（0円もOK）
▶︎3000円

・到着国
▶︎韓国`;

console.log(`👤 ユーザー: (テンプレート入力)\n`);
response = handleInsuranceMessage(testUserId, step2Input, { step: 'waiting_template' });
console.log(`🤖 ボット: ${response.substring(0, 300)}...\n`);

// シナリオ3: アメリカ・高リスク国
console.log('=== シナリオ3: アメリカ（高額医療リスク） ===\n');

resetUserState(testUserId);
const step3Input = getInsuranceWelcomeMessage().replace(
  '・到着国\n▶',
  '・到着国\n▶アメリカ'
).split('ーーーーーーーーーー')[1] || '';

const filledAmerica = `・渡航期間
▶2週間

・予算（0円もOK）
▶8000円

・到着国
▶アメリカ`;

response = handleInsuranceMessage(testUserId, filledAmerica, { step: 'waiting_template' });
const hasZurich = response.includes('チューリッヒ') || response.includes('zurich');
console.log(`${hasZurich ? '✅' : '❌'} アメリカ向け高額補償案内: ${hasZurich}`);
console.log(`🤖 ボット: ${response.substring(0, 350)}...\n`);

// ========================================
// 5. 保険モードからの自動切替テスト
// ========================================
console.log('📌 5. 保険モードからの自動切替テスト\n');

const autoSwitchTests = [
  { text: '今のグアテマラの気温は？', expected: true, reason: '気温' },
  { text: 'タイの治安はどうですか？', expected: true, reason: '治安' },
  { text: '韓国のおすすめのお店を教えて', expected: true, reason: 'おすすめ/お店' },
  { text: 'ベトナムの物価は？', expected: true, reason: '物価' },
  { text: 'フィリピンでのWi-Fi事情は？', expected: true, reason: 'Wi-Fi' },
  { text: '保険の補償内容を教えて', expected: false, reason: '保険キーワード' },
  { text: 'クレカの付帯保険について', expected: false, reason: 'クレカキーワード' },
  { text: '治療費の上限は？', expected: false, reason: '治療費キーワード' },
  { text: 'ありがとうございます', expected: false, reason: '一般メッセージ' },
];

let autoSwitchSuccess = 0;
for (const test of autoSwitchTests) {
  const result = isGeneralOverseasQuestion(test.text);
  const ok = result === test.expected;
  if (ok) autoSwitchSuccess++;
  console.log(`${ok ? '✅' : '❌'} "${test.text.substring(0, 25)}..." → ${result ? 'overseas_qa' : 'insurance継続'} (${test.reason})`);
}
console.log(`\n✅ ${autoSwitchSuccess}/${autoSwitchTests.length} 成功\n`);

// ========================================
// 完了
// ========================================
console.log('========================================');
console.log('✅ 全テスト完了');
console.log('========================================');
