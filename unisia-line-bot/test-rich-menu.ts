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
} from './src/handlers/insurance.js';

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

// ========================================
// 完了
// ========================================
console.log('========================================');
console.log('✅ 全テスト完了');
console.log('========================================');
