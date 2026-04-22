/**
 * 航空券ボットのローカル自己検証（LINE不要）
 *
 * 実行: npx tsx src/scripts/self-test.ts
 */

import {
  generateGoogleFlightsUrl,
  generateGoogleFlightsPrePurchaseEntryUrl,
  formatSearchDescription,
  getAirportCode,
  generateFlexibleDateSearchUrl,
  formatFlexibleDateDescription,
} from '../flight/google-flights.js';
import { getSafetyInfo, formatSafetyInfo } from '../external/mofa-safety.js';
import { initDatabase } from '../db/index.js';
import { getOrCreateUser, saveSurveyResponse, getSurveyResponse } from '../db/users.js';

const ok = (name: string, pass: boolean, detail?: string) => {
  console.log(pass ? `✅ ${name}` : `❌ ${name}`, detail ? `— ${detail}` : '');
  if (!pass) process.exitCode = 1;
};

async function main() {
  console.log('\n=== Unisia Flight Bot — 自己テスト ===\n');

  // 1) Google Flights URL
  const params = {
    origin: '成田',
    destination: '韓国',
    departureDate: '2026-06-01',
    returnDate: '2026-06-08',
    passengers: 1,
    cabinClass: 'economy' as const,
  };
  const url = generateGoogleFlightsUrl(params);
  ok('Google Flights URL が生成される', url.startsWith('https://www.google.com/travel/flights'), url);

  // === 様々な条件でのURL生成テスト ===
  console.log('\n--- 様々な条件での tfs URL テスト ---\n');

  // ケース1: 福岡→マニラ（往復・2大人1子）
  const phParams = {
    origin: '福岡空港',
    destination: 'フィリピン',
    departureDate: '2026-06-28',
    returnDate: '2026-09-28',
    adults: 2,
    children: 1,
    cabinClass: 'economy' as const,
  };
  const entry = generateGoogleFlightsPrePurchaseEntryUrl(phParams);
  ok(
    '福岡→マニラ（往復・2大人1子）',
    entry.includes('google.com/travel/flights/search?tfs='),
    entry.slice(0, 80) + '...'
  );

  // ケース2: 成田→バンコク（往復・1人）
  const bkkParams = {
    origin: '成田',
    destination: 'タイ',
    departureDate: '2026-07-15',
    returnDate: '2026-07-22',
    adults: 1,
  };
  const bkkUrl = generateGoogleFlightsPrePurchaseEntryUrl(bkkParams);
  ok(
    '成田→バンコク（往復・1人）',
    bkkUrl.includes('tfs='),
    bkkUrl.slice(0, 80) + '...'
  );

  // ケース3: 関空→ハワイ（往復・4人家族）
  const hnlParams = {
    origin: '関空',
    destination: 'ハワイ',
    departureDate: '2026-08-01',
    returnDate: '2026-08-10',
    adults: 2,
    children: 2,
  };
  const hnlUrl = generateGoogleFlightsPrePurchaseEntryUrl(hnlParams);
  ok(
    '関空→ハワイ（往復・2大人2子）',
    hnlUrl.includes('tfs='),
    hnlUrl.slice(0, 80) + '...'
  );

  // ケース4: 片道 - 羽田→ソウル（1人）
  const oneWayParams = {
    origin: '羽田',
    destination: 'ソウル',
    departureDate: '2026-05-01',
    tripType: 'one_way' as const,
    adults: 1,
  };
  const oneWayUrl = generateGoogleFlightsPrePurchaseEntryUrl(oneWayParams);
  ok(
    '羽田→ソウル（片道・1人）',
    oneWayUrl.includes('tfs='),
    oneWayUrl.slice(0, 80) + '...'
  );

  // ケース5: 札幌→台北（往復・3人）
  const tpeParams = {
    origin: '札幌',
    destination: '台湾',
    departureDate: '2026-09-10',
    returnDate: '2026-09-17',
    adults: 3,
  };
  const tpeUrl = generateGoogleFlightsPrePurchaseEntryUrl(tpeParams);
  ok(
    '札幌→台北（往復・3人）',
    tpeUrl.includes('tfs='),
    tpeUrl.slice(0, 80) + '...'
  );

  // ケース6: 大阪→パリ（往復・2人）
  const parParams = {
    origin: '大阪',
    destination: 'フランス',
    departureDate: '2026-10-01',
    returnDate: '2026-10-15',
    adults: 2,
  };
  const parUrl = generateGoogleFlightsPrePurchaseEntryUrl(parParams);
  ok(
    '大阪→パリ（往復・2人）',
    parUrl.includes('tfs='),
    parUrl.slice(0, 80) + '...'
  );

  // ケース7: 名古屋→シンガポール（往復・1大人1幼児）
  const sinParams = {
    origin: '名古屋',
    destination: 'シンガポール',
    departureDate: '2026-11-20',
    returnDate: '2026-11-27',
    adults: 1,
    infantsOnLap: 1,
  };
  const sinUrl = generateGoogleFlightsPrePurchaseEntryUrl(sinParams);
  ok(
    '名古屋→シンガポール（1大人1幼児）',
    sinUrl.includes('tfs='),
    sinUrl.slice(0, 80) + '...'
  );

  console.log('\n📌 テスト用（福岡→マニラ・6/28〜9/28・2大人1子）:\n', entry, '\n');

  // === 曖昧な日付（最安値検索）テスト ===
  console.log('\n--- 曖昧な日付での最安値検索テスト ---\n');

  // ケース: 「5月」福岡→マニラ（月全体）
  const mayParams = {
    origin: '福岡',
    destination: 'フィリピン',
    departureDateStart: '2026-05-01',
    departureDateEnd: '2026-05-31',
    stayDuration: 7,
    adults: 2,
  };
  const mayUrl = generateFlexibleDateSearchUrl(mayParams);
  ok(
    '福岡→マニラ「5月」（月全体・7日間・2人）',
    mayUrl.includes('google.com/travel/flights?q=') && mayUrl.includes('May'),
    mayUrl.slice(0, 100) + '...'
  );

  // ケース: 「5月末」関空→ハワイ
  const lateMayParams = {
    origin: '関空',
    destination: 'ハワイ',
    departureDateStart: '2026-05-20',
    departureDateEnd: '2026-05-31',
    stayDuration: 5,
    adults: 1,
  };
  const lateMayUrl = generateFlexibleDateSearchUrl(lateMayParams);
  ok(
    '関空→ハワイ「5月末」（下旬・5日間・1人）',
    lateMayUrl.includes('May') && lateMayUrl.includes('2026'),
    lateMayUrl.slice(0, 100) + '...'
  );

  // ケース: 「GW」成田→韓国
  const gwParams = {
    origin: '成田',
    destination: '韓国',
    departureDateStart: '2026-04-29',
    departureDateEnd: '2026-05-06',
    stayDuration: 4,
    adults: 2,
    children: 1,
  };
  const gwUrl = generateFlexibleDateSearchUrl(gwParams);
  ok(
    '成田→韓国「GW」（4日間・2大人1子）',
    gwUrl.includes('google.com/travel/flights?q='),
    gwUrl.slice(0, 100) + '...'
  );

  // 説明文テスト
  const flexDesc = formatFlexibleDateDescription(mayParams);
  ok(
    '曖昧日付の説明文に期間が含まれる',
    flexDesc.includes('出発期間') && flexDesc.includes('2026-05-01'),
    flexDesc.split('\n')[1]
  );

  console.log('\n📌 テスト用（5月・福岡→マニラ・7日間・2人）最安値検索:\n', mayUrl, '\n');

  const desc = formatSearchDescription(params);
  ok('検索説明文に出発地が含まれる', desc.includes('成田'), desc.split('\n')[0]);

  ok('成田 → NRT', getAirportCode('成田') === 'NRT');
  ok('韓国 → ICN', getAirportCode('韓国') === 'ICN');

  // 2) 外務省（静的データ）
  const safety = await getSafetyInfo('韓国');
  ok('韓国の安全情報が取得できる', safety !== null, safety?.countryName);
  if (safety) {
    const formatted = formatSafetyInfo(safety);
    ok('フォーマットに外務省リンクが含まれる', formatted.includes('anzen.mofa'), 'mofa link');
  }

  // 3) SQLite（アンケート保存）
  process.env.DATABASE_PATH = './data/self-test-flight.db';
  initDatabase();
  const testUserId = 'U_self_test_line_user';
  getOrCreateUser(testUserId, 'SelfTest');
  saveSurveyResponse({
    lineUserId: testUserId,
    interestedRegions: ['韓国', '台湾'],
    departureAirports: ['成田'],
    travelPeriod: '3ヶ月以内',
    budgetRange: '5〜10万円',
    travelPurpose: '観光',
    overseasGoals: 'グルメ, 観光',
  });
  const saved = getSurveyResponse(testUserId);
  ok('アンケートが保存・読込できる', saved !== null && saved.interestedRegions.includes('韓国'));

  // 4) OpenAI（任意）
  console.log('\n--- OpenAI（任意）---');
  if (!process.env.OPENAI_API_KEY) {
    console.log('⏭️  SKIP: OPENAI_API_KEY 未設定（.env に設定すると extractFlightParams 等も本番に近く試せます）');
  } else {
    const { extractFlightParams } = await import('../ai/openai.js');
    const extracted = await extractFlightParams('成田から韓国、2026-06-01出発、6月8日帰国');
    ok('extractFlightParams が動く', !!(extracted?.destination), JSON.stringify(extracted));
  }

  console.log('\n=== LINE 連携テストの手順 ===');
  console.log('1. .env に LINE_CHANNEL_* / OPENAI_API_KEY を設定');
  console.log('2. npm run dev（ポート 3001）');
  console.log('3. ngrok http 3001 → Webhook URL を LINE Developers に設定');
  console.log('4. ボットに「アンケート」または「韓国行きの航空券を探して」と送信\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
