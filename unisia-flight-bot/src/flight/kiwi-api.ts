/**
 * Kiwi.com Tequila API 統合
 * 
 * 複数のOTA・航空会社の価格を内部で比較し、最安値を返す
 * https://tequila.kiwi.com/
 */

export interface KiwiSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  adults?: number;
  children?: number;
  cabinClass?: 'M' | 'W' | 'C' | 'F'; // M=Economy, W=Premium, C=Business, F=First
}

export interface KiwiFlightResult {
  success: boolean;
  price?: number;
  priceFormatted?: string;
  currency?: string;
  deepLink?: string;
  airlines?: string[];
  duration?: number;
  durationFormatted?: string;
  stops?: number;
  departureTime?: string;
  arrivalTime?: string;
  baggageIncluded?: boolean;
  baggageWeight?: number;
  error?: string;
}

const KIWI_API_BASE = 'https://tequila-api.kiwi.com';

/**
 * 環境変数からAPIキーを取得
 */
function getKiwiApiKey(): string | null {
  return process.env.KIWI_API_KEY || null;
}

/**
 * Kiwi.com APIが利用可能かチェック
 */
export function isKiwiApiAvailable(): boolean {
  return !!getKiwiApiKey();
}

/**
 * 空港コードをKiwi形式に変換
 */
function normalizeAirportCode(code: string): string {
  // 都市名から空港コードへのマッピング
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
  };
  
  const normalized = code.toLowerCase().trim();
  return cityToCode[normalized] || code.toUpperCase();
}

/**
 * 日付形式を変換 (YYYY-MM-DD → DD/MM/YYYY)
 */
function formatDateForKiwi(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * 分を時間:分形式に変換
 */
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}時間${mins > 0 ? `${mins}分` : ''}`;
}

/**
 * Kiwi.com APIでフライト検索
 */
export async function searchKiwi(params: KiwiSearchParams): Promise<KiwiFlightResult> {
  const apiKey = getKiwiApiKey();
  
  if (!apiKey) {
    return {
      success: false,
      error: 'KIWI_API_KEY not configured',
    };
  }
  
  try {
    const origin = normalizeAirportCode(params.origin);
    const destination = normalizeAirportCode(params.destination);
    const departureDate = formatDateForKiwi(params.departureDate);
    
    // クエリパラメータ構築
    const queryParams = new URLSearchParams({
      fly_from: origin,
      fly_to: destination,
      date_from: departureDate,
      date_to: departureDate,
      adults: (params.adults || 1).toString(),
      children: (params.children || 0).toString(),
      infants: '0',
      curr: 'JPY',
      locale: 'ja',
      sort: 'price', // 価格順
      limit: '1', // 最安のみ取得
      partner: 'unisia',
    });
    
    // 往復の場合
    if (params.returnDate) {
      const returnDate = formatDateForKiwi(params.returnDate);
      queryParams.set('return_from', returnDate);
      queryParams.set('return_to', returnDate);
      queryParams.set('flight_type', 'round');
    } else {
      queryParams.set('flight_type', 'oneway');
    }
    
    // キャビンクラス
    if (params.cabinClass) {
      queryParams.set('selected_cabins', params.cabinClass);
    }
    
    console.log(`🔍 Kiwi API: Searching ${origin} → ${destination}...`);
    
    const response = await fetch(
      `${KIWI_API_BASE}/v2/search?${queryParams.toString()}`,
      {
        headers: {
          'apikey': apiKey,
          'Accept': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Kiwi API error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `API error: ${response.status}`,
      };
    }
    
    const data = await response.json() as { data?: any[] };
    
    if (!data.data || data.data.length === 0) {
      console.log('ℹ️ Kiwi API: No flights found');
      return {
        success: false,
        error: 'No flights found',
      };
    }
    
    // 最安値のフライトを取得
    const cheapest = data.data[0] as any;
    
    // 航空会社名を抽出
    const airlines = [...new Set(
      cheapest.route?.map((r: any) => r.airline) || []
    )] as string[];
    
    // 荷物情報を確認
    const baggageInfo = cheapest.bags_price || {};
    const hasBaggage = cheapest.baglimit?.hold_weight > 0;
    const baggageWeight = cheapest.baglimit?.hold_weight || 0;
    
    // 20kg荷物の追加料金を計算
    let totalPrice = cheapest.price;
    if (!hasBaggage && baggageInfo['1']) {
      // 受託手荷物1個分の料金を加算
      totalPrice += baggageInfo['1'];
    }
    
    const result: KiwiFlightResult = {
      success: true,
      price: totalPrice,
      priceFormatted: `¥${totalPrice.toLocaleString()}`,
      currency: 'JPY',
      deepLink: cheapest.deep_link,
      airlines,
      duration: cheapest.duration?.total ? Math.floor(cheapest.duration.total / 60) : undefined,
      durationFormatted: cheapest.duration?.total 
        ? formatDuration(Math.floor(cheapest.duration.total / 60)) 
        : undefined,
      stops: cheapest.route ? cheapest.route.length - 1 : 0,
      departureTime: cheapest.local_departure,
      arrivalTime: cheapest.local_arrival,
      baggageIncluded: hasBaggage,
      baggageWeight,
    };
    
    console.log(`✅ Kiwi API: Found ¥${totalPrice.toLocaleString()} (${airlines.join(', ')})`);
    
    return result;
    
  } catch (error) {
    console.error('❌ Kiwi API exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
