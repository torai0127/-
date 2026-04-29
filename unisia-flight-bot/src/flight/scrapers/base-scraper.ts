/**
 * スクレイピングベースの価格取得
 * 
 * 各サイトから航空券価格を取得
 */

import axios from 'axios';

export interface FlightSearchParams {
  origin: string;           // 空港コード (TYO, FUK, etc.)
  destination: string;      // 空港コード or 都市名
  departureDate: string;    // YYYY-MM-DD
  returnDate?: string;      // YYYY-MM-DD (往復の場合)
  adults: number;
  children?: number;
  cabinClass?: 'economy' | 'premium_economy' | 'business' | 'first';
}

export interface ScrapedFlightResult {
  success: boolean;
  source: string;
  price?: number;
  priceFormatted?: string;
  currency?: string;
  airline?: string;
  deepLink?: string;
  error?: string;
}

// ユーザーエージェントをランダム化
const USER_AGENTS = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// リクエスト間隔をランダム化（レート制限回避）
export async function randomDelay(min: number = 500, max: number = 1500): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min) + min);
  await new Promise(resolve => setTimeout(resolve, delay));
}

// 都市名 → 空港コード変換
export const CITY_TO_AIRPORT: Record<string, string> = {
  // 日本
  '東京': 'TYO',
  'tokyo': 'TYO',
  '成田': 'NRT',
  '羽田': 'HND',
  '大阪': 'OSA',
  'osaka': 'OSA',
  '関空': 'KIX',
  '関西': 'KIX',
  '福岡': 'FUK',
  'fukuoka': 'FUK',
  '札幌': 'CTS',
  'sapporo': 'CTS',
  '那覇': 'OKA',
  '沖縄': 'OKA',
  'okinawa': 'OKA',
  '名古屋': 'NGO',
  'nagoya': 'NGO',
  '中部': 'NGO',
  
  // アジア
  'ソウル': 'ICN',
  'seoul': 'ICN',
  '台北': 'TPE',
  'taipei': 'TPE',
  '香港': 'HKG',
  'hong kong': 'HKG',
  'シンガポール': 'SIN',
  'singapore': 'SIN',
  'バンコク': 'BKK',
  'bangkok': 'BKK',
  'セブ': 'CEB',
  'cebu': 'CEB',
  'マニラ': 'MNL',
  'manila': 'MNL',
  'ホーチミン': 'SGN',
  'ハノイ': 'HAN',
  'クアラルンプール': 'KUL',
  'バリ': 'DPS',
  'bali': 'DPS',
  
  // 北米
  'バンクーバー': 'YVR',
  'vancouver': 'YVR',
  'トロント': 'YYZ',
  'toronto': 'YYZ',
  'ニューヨーク': 'NYC',
  'new york': 'NYC',
  'ロサンゼルス': 'LAX',
  'los angeles': 'LAX',
  'サンフランシスコ': 'SFO',
  'san francisco': 'SFO',
  'シアトル': 'SEA',
  'seattle': 'SEA',
  'ホノルル': 'HNL',
  'honolulu': 'HNL',
  'ハワイ': 'HNL',
  'hawaii': 'HNL',
  'グアム': 'GUM',
  'guam': 'GUM',
  
  // ヨーロッパ
  'パリ': 'PAR',
  'paris': 'PAR',
  'ロンドン': 'LON',
  'london': 'LON',
  'ローマ': 'ROM',
  'rome': 'ROM',
  'フランクフルト': 'FRA',
  'frankfurt': 'FRA',
  'アムステルダム': 'AMS',
  'amsterdam': 'AMS',
  
  // オセアニア
  'シドニー': 'SYD',
  'sydney': 'SYD',
  'メルボルン': 'MEL',
  'melbourne': 'MEL',
  'オークランド': 'AKL',
  'auckland': 'AKL',
  
  // 中東
  'ドバイ': 'DXB',
  'dubai': 'DXB',
};

export function normalizeAirportCode(location: string): string {
  const normalized = location.toLowerCase().trim();
  
  // 既に空港コードの場合
  if (/^[A-Z]{3}$/i.test(location)) {
    return location.toUpperCase();
  }
  
  // 都市名から変換
  return CITY_TO_AIRPORT[normalized] || CITY_TO_AIRPORT[location] || location.toUpperCase();
}

// 共通のHTTPクライアント設定
export function createHttpClient() {
  return axios.create({
    timeout: 15000,
    headers: {
      'User-Agent': getRandomUserAgent(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'ja,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    },
  });
}
