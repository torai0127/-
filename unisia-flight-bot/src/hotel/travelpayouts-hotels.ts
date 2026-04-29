/**
 * Travelpayouts Hotels API 統合
 * 
 * 複数のホテル予約サイトの価格を集約して最安値を返す
 * https://support.travelpayouts.com/hc/en-us/categories/200358578
 */

export interface HotelSearchParams {
  location: string;          // 都市名または地域名
  checkIn: string;           // YYYY-MM-DD
  checkOut: string;          // YYYY-MM-DD
  adults: number;
  rooms?: number;
  children?: number;
  childrenAges?: number[];
  stars?: number;            // 最低星評価 (1-5)
  maxPrice?: number;         // 1泊あたりの上限（JPY）
}

export interface HotelResult {
  success: boolean;
  hotel?: {
    id: string;
    name: string;
    stars: number;
    rating?: number;
    reviewCount?: number;
    location: string;
    address?: string;
    pricePerNight: number;
    pricePerNightFormatted: string;
    totalPrice: number;
    totalPriceFormatted: string;
    marketPrice: number;
    marketPriceFormatted: string;
    savings: number;
    savingsFormatted: string;
    deepLink: string;
    imageUrl?: string;
    amenities?: string[];
  };
  error?: string;
}

const TRAVELPAYOUTS_HOTELS_API = 'https://engine.hotellook.com/api/v2';

// 都市名 → Travelpayouts Location ID マッピング
const CITY_LOCATION_IDS: Record<string, string> = {
  // 北米
  'バンクーバー': '2842',
  'vancouver': '2842',
  'トロント': '2843',
  'toronto': '2843',
  'ニューヨーク': '1499',
  'new york': '1499',
  'ロサンゼルス': '1497',
  'los angeles': '1497',
  'サンフランシスコ': '1500',
  'san francisco': '1500',
  'シアトル': '3131',
  'seattle': '3131',
  'ラスベガス': '1496',
  'las vegas': '1496',
  'ホノルル': '3138',
  'honolulu': '3138',
  'ハワイ': '3138',
  'hawaii': '3138',
  
  // アジア
  'ソウル': '2474',
  'seoul': '2474',
  '台北': '2469',
  'taipei': '2469',
  '香港': '2466',
  'hong kong': '2466',
  'シンガポール': '2468',
  'singapore': '2468',
  'バンコク': '2470',
  'bangkok': '2470',
  'バリ': '3059',
  'bali': '3059',
  'セブ': '3101',
  'cebu': '3101',
  'マニラ': '3100',
  'manila': '3100',
  'ホーチミン': '3108',
  'ho chi minh': '3108',
  'ハノイ': '3107',
  'hanoi': '3107',
  'クアラルンプール': '2471',
  'kuala lumpur': '2471',
  
  // ヨーロッパ
  'パリ': '2',
  'paris': '2',
  'ロンドン': '1',
  'london': '1',
  'ローマ': '3',
  'rome': '3',
  'バルセロナ': '4',
  'barcelona': '4',
  'アムステルダム': '7',
  'amsterdam': '7',
  
  // オセアニア
  'シドニー': '2488',
  'sydney': '2488',
  'メルボルン': '2489',
  'melbourne': '2489',
  'オークランド': '2496',
  'auckland': '2496',
  
  // 日本国内
  '東京': '2465',
  'tokyo': '2465',
  '大阪': '2530',
  'osaka': '2530',
  '京都': '2529',
  'kyoto': '2529',
  '福岡': '2528',
  'fukuoka': '2528',
  '札幌': '2531',
  'sapporo': '2531',
  '沖縄': '2532',
  '那覇': '2532',
  'okinawa': '2532',
};

// 国名 → 代表都市のマッピング
const COUNTRY_TO_CITY: Record<string, string> = {
  'カナダ': 'バンクーバー',
  'canada': 'バンクーバー',
  'アメリカ': 'ニューヨーク',
  'usa': 'ニューヨーク',
  '韓国': 'ソウル',
  'korea': 'ソウル',
  '台湾': '台北',
  'taiwan': '台北',
  'タイ': 'バンコク',
  'thailand': 'バンコク',
  'フィリピン': 'マニラ',
  'philippines': 'マニラ',
  'ベトナム': 'ホーチミン',
  'vietnam': 'ホーチミン',
  'インドネシア': 'バリ',
  'indonesia': 'バリ',
  'マレーシア': 'クアラルンプール',
  'malaysia': 'クアラルンプール',
  'フランス': 'パリ',
  'france': 'パリ',
  'イギリス': 'ロンドン',
  'uk': 'ロンドン',
  'イタリア': 'ローマ',
  'italy': 'ローマ',
  'スペイン': 'バルセロナ',
  'spain': 'バルセロナ',
  'オーストラリア': 'シドニー',
  'australia': 'シドニー',
  'ニュージーランド': 'オークランド',
  'new zealand': 'オークランド',
};

/**
 * 環境変数からAPIトークンを取得
 */
function getTravelpayoutsToken(): string | null {
  return process.env.TRAVELPAYOUTS_TOKEN || null;
}

/**
 * Hotels APIが利用可能かチェック
 */
export function isHotelApiAvailable(): boolean {
  return !!getTravelpayoutsToken();
}

/**
 * 都市名からLocation IDを取得
 */
function getLocationId(location: string): string | null {
  const normalized = location.toLowerCase().trim();
  
  // 直接マッチ
  if (CITY_LOCATION_IDS[normalized]) {
    return CITY_LOCATION_IDS[normalized];
  }
  if (CITY_LOCATION_IDS[location]) {
    return CITY_LOCATION_IDS[location];
  }
  
  // 国名から代表都市を取得
  const city = COUNTRY_TO_CITY[normalized] || COUNTRY_TO_CITY[location];
  if (city && CITY_LOCATION_IDS[city]) {
    return CITY_LOCATION_IDS[city];
  }
  
  return null;
}

/**
 * 都市名を正規化（表示用）
 */
export function normalizeCityName(location: string): string {
  const normalized = location.toLowerCase().trim();
  
  // 国名の場合は代表都市を返す
  const city = COUNTRY_TO_CITY[normalized] || COUNTRY_TO_CITY[location];
  if (city) {
    return city;
  }
  
  return location;
}

/**
 * ホテルを検索して最安値を返す
 */
export async function searchCheapestHotel(params: HotelSearchParams): Promise<HotelResult> {
  const token = getTravelpayoutsToken();
  
  if (!token) {
    return {
      success: false,
      error: 'TRAVELPAYOUTS_TOKEN not configured',
    };
  }
  
  const locationId = getLocationId(params.location);
  if (!locationId) {
    console.log(`⚠️ Unknown location: ${params.location}`);
    // Location IDが見つからない場合はディープリンクのみ生成
    return {
      success: false,
      error: `Location not found: ${params.location}`,
    };
  }
  
  try {
    const queryParams = new URLSearchParams({
      locationId,
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      adults: params.adults.toString(),
      rooms: (params.rooms || 1).toString(),
      currency: 'JPY',
      token,
      limit: '30',
    });
    
    if (params.children && params.childrenAges) {
      queryParams.set('children', params.children.toString());
      queryParams.set('childrenAges', params.childrenAges.join(','));
    }
    
    console.log(`🔍 Searching hotels in ${params.location} (ID: ${locationId})...`);
    
    const response = await fetch(
      `${TRAVELPAYOUTS_HOTELS_API}/cache.json?${queryParams.toString()}`
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Hotels API error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `API error: ${response.status}`,
      };
    }
    
    const data = await response.json() as any[];
    
    if (!data || data.length === 0) {
      console.log('ℹ️ No hotels found');
      return {
        success: false,
        error: 'No hotels found for this location and dates',
      };
    }
    
    // フィルタリング
    let filtered = data;
    
    // 星評価フィルター
    if (params.stars) {
      filtered = filtered.filter((h: any) => h.stars >= params.stars!);
    }
    
    // 価格上限フィルター（1泊あたり）
    if (params.maxPrice) {
      filtered = filtered.filter((h: any) => h.priceFrom <= params.maxPrice!);
    }
    
    if (filtered.length === 0) {
      console.log('ℹ️ No hotels match the criteria');
      return {
        success: false,
        error: 'No hotels match your criteria',
      };
    }
    
    // 価格でソート（最安値）
    filtered.sort((a: any, b: any) => a.priceFrom - b.priceFrom);
    
    const cheapest = filtered[0];
    const nights = calculateNights(params.checkIn, params.checkOut);
    const pricePerNight = cheapest.priceFrom;
    const totalPrice = pricePerNight * nights;
    
    // 市場相場（1.4倍 + 5000円）
    const marketPricePerNight = Math.round((pricePerNight * 1.4 + 5000) / 1000) * 1000;
    const marketPrice = marketPricePerNight * nights;
    const savings = marketPrice - totalPrice;
    
    // ディープリンク生成
    const deepLink = generateHotelDeepLink(cheapest.hotelId, params);
    
    const result: HotelResult = {
      success: true,
      hotel: {
        id: cheapest.hotelId?.toString() || '',
        name: cheapest.hotelName || 'Hotel',
        stars: cheapest.stars || 0,
        rating: cheapest.rating,
        reviewCount: cheapest.reviews,
        location: normalizeCityName(params.location),
        pricePerNight,
        pricePerNightFormatted: `¥${pricePerNight.toLocaleString()}`,
        totalPrice,
        totalPriceFormatted: `¥${totalPrice.toLocaleString()}`,
        marketPrice,
        marketPriceFormatted: `¥${marketPrice.toLocaleString()}`,
        savings,
        savingsFormatted: `¥${savings.toLocaleString()}`,
        deepLink,
      },
    };
    
    console.log(`✅ Found cheapest hotel: ${result.hotel?.name} at ¥${pricePerNight.toLocaleString()}/night`);
    
    return result;
    
  } catch (error) {
    console.error('❌ Hotels API exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 宿泊日数を計算
 */
function calculateNights(checkIn: string, checkOut: string): number {
  const inDate = new Date(checkIn);
  const outDate = new Date(checkOut);
  const diff = outDate.getTime() - inDate.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * ホテル詳細ページへのディープリンクを生成
 */
function generateHotelDeepLink(hotelId: string, params: HotelSearchParams): string {
  const marker = '723224'; // Travelpayouts Partner ID
  
  // Hotellookのディープリンク形式
  const queryParams = new URLSearchParams({
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    adults: params.adults.toString(),
    children: (params.children || 0).toString(),
    marker,
    currency: 'JPY',
    language: 'ja',
  });
  
  return `https://search.hotellook.com/hotels?hotelId=${hotelId}&${queryParams.toString()}`;
}

/**
 * 検索結果をLINE用にフォーマット
 */
export function formatHotelResultForLine(result: HotelResult, params: HotelSearchParams): string {
  const nights = calculateNights(params.checkIn, params.checkOut);
  
  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    return `${parseInt(m)}/${parseInt(d)}`;
  };
  
  let response = `🏨 ホテル検索結果\n\n`;
  response += `📍 ${normalizeCityName(params.location)}\n`;
  response += `📅 ${formatDate(params.checkIn)} 〜 ${formatDate(params.checkOut)}（${nights}泊）\n`;
  response += `👥 ${params.adults}名`;
  if (params.rooms && params.rooms > 1) {
    response += ` ${params.rooms}室`;
  }
  response += `\n\n`;
  
  if (result.success && result.hotel) {
    const h = result.hotel;
    
    response += `━━━━━━━━━━━━━━━\n`;
    response += `🏆 最安値ホテル\n`;
    response += `━━━━━━━━━━━━━━━\n\n`;
    
    response += `🏨 ${h.name}\n`;
    if (h.stars > 0) {
      response += `${'⭐'.repeat(h.stars)}\n`;
    }
    if (h.rating) {
      response += `📊 ${h.rating}/10`;
      if (h.reviewCount) {
        response += ` (${h.reviewCount.toLocaleString()}件のレビュー)`;
      }
      response += `\n`;
    }
    response += `\n`;
    
    response += `━━━━━━━━━━━━━━━\n`;
    response += `📊 価格比較\n`;
    response += `━━━━━━━━━━━━━━━\n\n`;
    
    response += `💴 市場相場: ${h.marketPriceFormatted}\n`;
    response += `💎 当サイト最安値: ${h.totalPriceFormatted}\n`;
    response += `　 （${h.pricePerNightFormatted}/泊 × ${nights}泊）\n`;
    response += `🎉 最大 ${h.savingsFormatted} お得！\n\n`;
    
    response += `🔗 このホテルを予約する\n`;
    response += `${h.deepLink}\n`;
    
  } else {
    // APIで見つからない場合は検索リンクを提供
    response += `検索条件に合うホテルが見つかりませんでした。\n\n`;
    response += `🔗 他のサイトで検索する\n`;
    response += generateBookingComUrl(params) + `\n`;
  }
  
  return response;
}

/**
 * Booking.com検索URL生成（フォールバック用）
 */
function generateBookingComUrl(params: HotelSearchParams): string {
  const queryParams = new URLSearchParams({
    ss: params.location,
    checkin: params.checkIn,
    checkout: params.checkOut,
    group_adults: params.adults.toString(),
    no_rooms: (params.rooms || 1).toString(),
    group_children: (params.children || 0).toString(),
  });
  
  return `https://www.booking.com/searchresults.ja.html?${queryParams.toString()}`;
}
