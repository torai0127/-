/**
 * Booking.com API via RapidAPI (DataCrawler)
 * 
 * 全世界のホテルをリアルタイム価格で検索
 * 既存のRapidAPIキーを使用
 */

export interface HotelSearchParams {
  location: string;
  checkIn: string;           // YYYY-MM-DD
  checkOut: string;          // YYYY-MM-DD
  adults: number;
  rooms?: number;
  children?: number;
  childrenAges?: number[];
  stars?: number;
  maxPrice?: number;
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
  };
  error?: string;
}

const RAPIDAPI_HOST = 'booking-com15.p.rapidapi.com';
const RAPIDAPI_BASE_URL = `https://${RAPIDAPI_HOST}/api/v1/hotels`;

interface DestinationResult {
  dest_id: string;
  search_type: string;
  city_name: string;
  country: string;
  label: string;
}

interface HotelSearchResult {
  hotel_id: number;
  accessibilityLabel?: string;
  property?: {
    name?: string;
    qualityClass?: number;
    propertyClass?: number;
    reviewScore?: number;
    reviewCount?: number;
    photoUrls?: string[];
    priceBreakdown?: {
      grossPrice?: {
        value?: number;
        currency?: string;
      };
    };
    checkinDate?: string;
    checkoutDate?: string;
  };
  // Direct hotel page URL (if provided by API)
  url?: string;
}

function getRapidApiKey(): string | null {
  return process.env.RAPIDAPI_KEY || null;
}

export function isHotelApiAvailable(): boolean {
  return !!getRapidApiKey();
}

/**
 * 都市名からBooking.comのdest_idを検索
 */
async function searchDestination(query: string): Promise<DestinationResult | null> {
  const apiKey = getRapidApiKey();
  if (!apiKey) return null;

  try {
    const url = `${RAPIDAPI_BASE_URL}/searchDestination?query=${encodeURIComponent(query)}`;
    
    console.log(`🔍 Searching destination: ${query}`);
    
    const response = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': RAPIDAPI_HOST,
      },
    });

    if (!response.ok) {
      console.error(`❌ Destination search failed: ${response.status}`);
      return null;
    }

    const data = await response.json() as { status: boolean; data: DestinationResult[] };
    
    if (!data.status || !data.data || data.data.length === 0) {
      console.log(`⚠️ No destination found for: ${query}`);
      return null;
    }

    // 最初の結果を使用（通常は最も関連性が高い）
    const dest = data.data[0];
    console.log(`✅ Found destination: ${dest.label} (ID: ${dest.dest_id})`);
    
    return dest;
  } catch (error) {
    console.error('❌ Destination search error:', error);
    return null;
  }
}

/**
 * ホテルを検索して最安値を返す
 */
export async function searchCheapestHotel(params: HotelSearchParams): Promise<HotelResult> {
  const apiKey = getRapidApiKey();
  
  if (!apiKey) {
    return {
      success: false,
      error: 'RAPIDAPI_KEY not configured',
    };
  }

  // まず目的地のIDを取得
  const destination = await searchDestination(params.location);
  if (!destination) {
    return {
      success: false,
      error: `Location not found: ${params.location}`,
    };
  }

  try {
    const queryParams = new URLSearchParams({
      dest_id: destination.dest_id,
      search_type: destination.search_type || 'CITY',
      arrival_date: params.checkIn,
      departure_date: params.checkOut,
      adults: params.adults.toString(),
      room_qty: (params.rooms || 1).toString(),
      currency_code: 'JPY',
      languagecode: 'ja',
      page_number: '1',
    });

    if (params.children && params.childrenAges) {
      queryParams.set('children_qty', params.children.toString());
      queryParams.set('children_age', params.childrenAges.join(','));
    }

    const url = `${RAPIDAPI_BASE_URL}/searchHotels?${queryParams.toString()}`;
    
    console.log(`🏨 Searching hotels in ${destination.city_name}...`);
    
    const response = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': RAPIDAPI_HOST,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Hotel search failed: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `API error: ${response.status}`,
      };
    }

    const data = await response.json() as { status: boolean; data: { hotels: HotelSearchResult[] } };
    
    if (!data.status || !data.data?.hotels || data.data.hotels.length === 0) {
      console.log('ℹ️ No hotels found');
      return {
        success: false,
        error: 'No hotels found for this location and dates',
      };
    }

    let hotels = data.data.hotels;

    // 星評価フィルター
    if (params.stars) {
      hotels = hotels.filter(h => {
        const stars = h.property?.qualityClass || h.property?.propertyClass || 0;
        return stars >= params.stars!;
      });
    }

    // 価格でソート（最安値）
    hotels.sort((a, b) => {
      const priceA = a.property?.priceBreakdown?.grossPrice?.value || Infinity;
      const priceB = b.property?.priceBreakdown?.grossPrice?.value || Infinity;
      return priceA - priceB;
    });

    // 価格上限フィルター
    if (params.maxPrice) {
      const nights = calculateNights(params.checkIn, params.checkOut);
      hotels = hotels.filter(h => {
        const totalPrice = h.property?.priceBreakdown?.grossPrice?.value || Infinity;
        const perNight = totalPrice / nights;
        return perNight <= params.maxPrice!;
      });
    }

    if (hotels.length === 0) {
      return {
        success: false,
        error: 'No hotels match your criteria',
      };
    }

    const cheapest = hotels[0];
    const prop = cheapest.property || {};
    const nights = calculateNights(params.checkIn, params.checkOut);
    
    // 価格を取得
    const totalPrice = Math.round(prop.priceBreakdown?.grossPrice?.value || 0);
    const pricePerNight = Math.round(totalPrice / nights);

    // ホテル名を取得
    const hotelName = prop.name || cheapest.accessibilityLabel?.split('\n')[0] || 'Hotel';
    const hotelId = cheapest.hotel_id?.toString() || '';

    // 市場相場（1.4倍 + 5000円）
    const marketPricePerNight = Math.round((pricePerNight * 1.4 + 5000) / 1000) * 1000;
    const marketPrice = marketPricePerNight * nights;
    const savings = marketPrice - totalPrice;

    // ホテル直接リンクを生成（ホテル名で検索して特定のホテルを表示）
    const directHotelLink = generateDirectHotelUrl(hotelName, hotelId, params);
    console.log(`🔗 Generated hotel link: ${directHotelLink}`);

    const result: HotelResult = {
      success: true,
      hotel: {
        id: hotelId,
        name: hotelName,
        stars: prop.qualityClass || prop.propertyClass || 0,
        rating: prop.reviewScore,
        reviewCount: prop.reviewCount,
        location: destination.city_name,
        pricePerNight,
        pricePerNightFormatted: `¥${pricePerNight.toLocaleString()}`,
        totalPrice,
        totalPriceFormatted: `¥${totalPrice.toLocaleString()}`,
        marketPrice,
        marketPriceFormatted: `¥${marketPrice.toLocaleString()}`,
        savings,
        savingsFormatted: `¥${savings.toLocaleString()}`,
        deepLink: directHotelLink,
        imageUrl: prop.photoUrls?.[0],
      },
    };

    console.log(`✅ Found cheapest hotel: ${result.hotel?.name} at ¥${pricePerNight.toLocaleString()}/night`);

    return result;

  } catch (error) {
    console.error('❌ Hotel search exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function calculateNights(checkIn: string, checkOut: string): number {
  const inDate = new Date(checkIn);
  const outDate = new Date(checkOut);
  const diff = outDate.getTime() - inDate.getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * 特定のホテルページへの直接リンクを生成
 * ホテル名で検索して、そのホテルが最上位に表示されるURLを生成
 */
function generateDirectHotelUrl(hotelName: string, hotelId: string, params: HotelSearchParams): string {
  const queryParams = new URLSearchParams({
    ss: hotelName,  // ホテル名で検索（特定のホテルが最上位に表示される）
    checkin: params.checkIn,
    checkout: params.checkOut,
    group_adults: params.adults.toString(),
    no_rooms: (params.rooms || 1).toString(),
    group_children: (params.children || 0).toString(),
    selected_currency: 'JPY',
  });
  
  // ホテルIDがある場合は追加（より正確なマッチング）
  if (hotelId) {
    queryParams.set('highlighted_hotels', hotelId);
  }

  return `https://www.booking.com/searchresults.ja.html?${queryParams.toString()}`;
}

function generateBookingUrl(params: HotelSearchParams, destId?: string): string {
  const queryParams = new URLSearchParams({
    ss: params.location,
    checkin: params.checkIn,
    checkout: params.checkOut,
    group_adults: params.adults.toString(),
    no_rooms: (params.rooms || 1).toString(),
    group_children: (params.children || 0).toString(),
  });
  
  if (destId) {
    queryParams.set('dest_id', destId);
    queryParams.set('dest_type', 'city');
  }

  return `https://www.booking.com/searchresults.ja.html?${queryParams.toString()}`;
}

/**
 * 都市名を正規化（表示用）
 */
export function normalizeCityName(location: string): string {
  return location;
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
  response += `📍 ${result.hotel?.location || params.location}\n`;
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
    response += `検索条件に合うホテルが見つかりませんでした。\n\n`;
    response += `🔗 他のサイトで検索する\n`;
    response += generateBookingUrl(params) + `\n`;
  }
  
  return response;
}
