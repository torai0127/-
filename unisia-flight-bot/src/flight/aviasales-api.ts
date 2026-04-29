/**
 * Aviasales/Travelpayouts API 統合
 * 
 * 航空券のキャッシュ価格データを取得
 * https://support.travelpayouts.com/hc/en-us/categories/200358578
 */

export interface AviasalesSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
}

export interface AviasalesFlightResult {
  success: boolean;
  price?: number;
  priceFormatted?: string;
  airline?: string;
  flightNumber?: string;
  departureTime?: string;
  arrivalTime?: string;
  duration?: number;
  transfers?: number;
  deepLink?: string;
  error?: string;
}

const AVIASALES_API_BASE = 'https://api.travelpayouts.com/aviasales';

/**
 * 環境変数からAPIトークンを取得
 */
function getTravelpayoutsToken(): string | null {
  return process.env.TRAVELPAYOUTS_TOKEN || null;
}

/**
 * Aviasales APIが利用可能かチェック
 */
export function isAviasalesApiAvailable(): boolean {
  return !!getTravelpayoutsToken();
}

/**
 * 空港コードの正規化
 */
function normalizeAirportCode(code: string): string {
  const cityToCode: Record<string, string> = {
    '東京': 'TYO',
    'tokyo': 'TYO',
    '大阪': 'OSA',
    'osaka': 'OSA',
    '名古屋': 'NGO',
    'nagoya': 'NGO',
    '福岡': 'FUK',
    'fukuoka': 'FUK',
    '札幌': 'CTS',
    'sapporo': 'CTS',
    '沖縄': 'OKA',
    'okinawa': 'OKA',
    'ソウル': 'SEL',
    'seoul': 'SEL',
    '台北': 'TPE',
    'taipei': 'TPE',
    '香港': 'HKG',
    'hongkong': 'HKG',
    'シンガポール': 'SIN',
    'singapore': 'SIN',
    'バンコク': 'BKK',
    'bangkok': 'BKK',
    'ホノルル': 'HNL',
    'honolulu': 'HNL',
    'ハワイ': 'HNL',
    'hawaii': 'HNL',
    'ロサンゼルス': 'LAX',
    'los angeles': 'LAX',
    'ニューヨーク': 'NYC',
    'new york': 'NYC',
    'パリ': 'PAR',
    'paris': 'PAR',
    'ロンドン': 'LON',
    'london': 'LON',
    'セブ': 'CEB',
    'cebu': 'CEB',
    'マニラ': 'MNL',
    'manila': 'MNL',
    'フィリピン': 'MNL',
    'philippines': 'MNL',
    'ベトナム': 'SGN',
    'vietnam': 'SGN',
    'ホーチミン': 'SGN',
    'ハノイ': 'HAN',
    'hanoi': 'HAN',
  };
  
  const normalized = code.toLowerCase().trim();
  return cityToCode[normalized] || code.toUpperCase();
}

/**
 * Aviasales Data APIでフライト価格を検索（キャッシュデータ）
 */
export async function searchAviasales(params: AviasalesSearchParams): Promise<AviasalesFlightResult> {
  const token = getTravelpayoutsToken();
  
  if (!token) {
    return {
      success: false,
      error: 'TRAVELPAYOUTS_TOKEN not configured',
    };
  }
  
  try {
    const origin = normalizeAirportCode(params.origin);
    const destination = normalizeAirportCode(params.destination);
    
    // Prices for dates API - 特定の日付の価格を取得
    const queryParams = new URLSearchParams({
      origin,
      destination,
      departure_at: params.departureDate,
      currency: 'jpy',
      token,
      sorting: 'price',
      direct: 'false',
      limit: '1',
    });
    
    if (params.returnDate) {
      queryParams.set('return_at', params.returnDate);
    }
    
    console.log(`🔍 Aviasales API: Searching ${origin} → ${destination}...`);
    
    const response = await fetch(
      `${AVIASALES_API_BASE}/v3/prices_for_dates?${queryParams.toString()}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Aviasales API error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `API error: ${response.status}`,
      };
    }
    
    const data = await response.json() as { success?: boolean; data?: any[] };
    
    if (!data.success || !data.data || data.data.length === 0) {
      console.log('ℹ️ Aviasales API: No flights found');
      return {
        success: false,
        error: 'No flights found',
      };
    }
    
    // 最安値のフライトを取得
    const cheapest = data.data[0] as any;
    
    // ディープリンクを生成
    const deepLink = generateAviasalesDeepLink(origin, destination, params.departureDate, params.returnDate);
    
    const result: AviasalesFlightResult = {
      success: true,
      price: cheapest.price,
      priceFormatted: `¥${cheapest.price.toLocaleString()}`,
      airline: cheapest.airline,
      flightNumber: cheapest.flight_number,
      departureTime: cheapest.departure_at,
      arrivalTime: cheapest.return_at,
      duration: cheapest.duration,
      transfers: cheapest.transfers,
      deepLink,
    };
    
    console.log(`✅ Aviasales API: Found ¥${cheapest.price.toLocaleString()} (${cheapest.airline || 'Unknown'})`);
    
    return result;
    
  } catch (error) {
    console.error('❌ Aviasales API exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Aviasalesディープリンクを生成
 */
function generateAviasalesDeepLink(
  origin: string,
  destination: string,
  departureDate: string,
  returnDate?: string
): string {
  const token = getTravelpayoutsToken();
  const marker = token ? `723224` : ''; // Partner ID from Travelpayouts account
  
  // 日付形式変換（YYYY-MM-DD → DDMM）
  const formatDateShort = (date: string) => {
    const [y, m, d] = date.split('-');
    return `${d}${m}`;
  };
  
  const depDate = formatDateShort(departureDate);
  const retDate = returnDate ? formatDateShort(returnDate) : '';
  
  const route = returnDate 
    ? `${origin}${depDate}${destination}${retDate}`
    : `${origin}${depDate}${destination}1`;
  
  return `https://www.aviasales.com/search/${route}?marker=${marker}`;
}

/**
 * 最安値月間カレンダーを取得（価格トレンド表示用）
 */
export async function getMonthlyPrices(
  origin: string,
  destination: string,
  month: string // YYYY-MM format
): Promise<{ date: string; price: number }[]> {
  const token = getTravelpayoutsToken();
  
  if (!token) {
    return [];
  }
  
  try {
    const originCode = normalizeAirportCode(origin);
    const destCode = normalizeAirportCode(destination);
    
    const queryParams = new URLSearchParams({
      origin: originCode,
      destination: destCode,
      month,
      currency: 'jpy',
      token,
    });
    
    const response = await fetch(
      `${AVIASALES_API_BASE}/v3/grouped_prices?${queryParams.toString()}`
    );
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json() as { success?: boolean; data?: Record<string, any> };
    
    if (!data.success || !data.data) {
      return [];
    }
    
    return Object.entries(data.data).map(([date, info]: [string, any]) => ({
      date,
      price: info.price,
    }));
    
  } catch {
    return [];
  }
}
