import { extractFlightParamsFromText } from './src/line/handler.js';

const userMessage = `いきたい地域: 羽田
いきたい時期: 7/28 〜 29
期間: 1泊2日
人数: 2人
出発空港: 福岡
片道/往復: 往復`;

const params = extractFlightParamsFromText(userMessage);

console.log('=== 航空券日付パーステスト ===');
console.log(JSON.stringify(params, null, 2));

const ok =
  params.destination === '羽田' &&
  params.origin === '福岡' &&
  params.departureDate?.endsWith('-07-28') &&
  params.returnDate?.endsWith('-07-29') &&
  params.adults === 2 &&
  params.tripType === 'round_trip';

console.log(ok ? '✅ PASS' : '❌ FAIL');

if (!ok) process.exit(1);
