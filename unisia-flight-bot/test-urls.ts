import { generateGoogleFlightsPrePurchaseEntryUrl } from './src/flight/google-flights.js';

const testCases = [
  {
    name: "フィリピン / 福岡 / 3月中旬 / 3名（大人2、子供1）",
    params: {
      origin: "福岡",
      destination: "フィリピン",
      departureDate: "2027-03-15",
      returnDate: "2027-03-20",
      adults: 2,
      children: 1,
      infantsOnLap: 0,
      tripType: "round_trip" as const,
      cabinClass: "economy" as const,
    }
  },
  {
    name: "韓国 / 成田 / 5月GW / 2名",
    params: {
      origin: "成田",
      destination: "韓国",
      departureDate: "2027-05-03",
      returnDate: "2027-05-06",
      adults: 2,
      children: 0,
      infantsOnLap: 0,
      tripType: "round_trip" as const,
      cabinClass: "economy" as const,
    }
  },
  {
    name: "ハワイ / 関空 / 夏休み8月 / 4名（大人2、子供2）",
    params: {
      origin: "関空",
      destination: "ハワイ",
      departureDate: "2027-08-10",
      returnDate: "2027-08-17",
      adults: 2,
      children: 2,
      infantsOnLap: 0,
      tripType: "round_trip" as const,
      cabinClass: "economy" as const,
    }
  },
  {
    name: "タイ / 羽田 / 年末 / 1名",
    params: {
      origin: "羽田",
      destination: "タイ",
      departureDate: "2026-12-28",
      returnDate: "2027-01-03",
      adults: 1,
      children: 0,
      infantsOnLap: 0,
      tripType: "round_trip" as const,
      cabinClass: "economy" as const,
    }
  },
  {
    name: "オーストラリア / 新千歳 / 2月 / 2名",
    params: {
      origin: "新千歳",
      destination: "オーストラリア",
      departureDate: "2027-02-15",
      returnDate: "2027-02-25",
      adults: 2,
      children: 0,
      infantsOnLap: 0,
      tripType: "round_trip" as const,
      cabinClass: "economy" as const,
    }
  },
];

console.log("=== Google Flights URL テスト ===\n");

for (const tc of testCases) {
  console.log(`【${tc.name}】`);
  const url = generateGoogleFlightsPrePurchaseEntryUrl(tc.params);
  console.log(`URL: ${url}`);
  console.log(`---`);
}
