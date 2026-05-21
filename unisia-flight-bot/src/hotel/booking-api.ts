/**
 * Booking.com API via RapidAPI (DataCrawler)
 * 
 * 全世界のホテルをリアルタイム価格で検索
 * 既存のRapidAPIキーを使用
 */

import {
  BOOKING_PRICE_SORT_HINT_LINE,
  buildBookingRegionalListUrl,
  buildBookingSearchFallbackUrl,
  extractBookingHotelCountryCode,
  extractBookingPropertyPageUrl,
  isBookingPropertyPageHref,
  mergeStayParamsOntoPropertyPage,
  parseBookingPropertyUrl,
  type BookingStayQuerySource,
} from './booking-property-url.js';
import { resolveRegionProfile, scoreDestinationAgainstProfile } from './booking-region-profile.js';

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
    /** 地域だけの一覧（名前を絞らない）。並び替えはBooking側で行う前提 */
    regionalSearchUrl?: string;
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

function pickBestDestination(results: DestinationResult[], query: string): DestinationResult {
  const normalized = query.trim().normalize('NFKC');
  const profile = resolveRegionProfile(normalized);
  let best = results[0];
  let bestScore = scoreDestinationAgainstProfile(best, profile, normalized);
  for (let i = 1; i < results.length; i++) {
    const s = scoreDestinationAgainstProfile(results[i], profile, normalized);
    if (s > bestScore) {
      best = results[i];
      bestScore = s;
    }
  }
  return best;
}

function toStaySource(params: HotelSearchParams): BookingStayQuerySource {
  return {
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    adults: params.adults,
    rooms: params.rooms || 1,
    children: params.children || 0,
  };
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

/** プロパティURLの国コードで絞り込み（APIが別国の最安を混ぜる事故の抑止） */
function filterHotelsByRegionCountry(
  hotels: HotelSearchResult[],
  locationQuery: string,
): HotelSearchResult[] {
  const profile = resolveRegionProfile(locationQuery.trim().normalize('NFKC'));
  if (!profile?.bookingCountryCodes.length) return hotels;

  const allow = profile.bookingCountryCodes;
  const positivelyMatched = hotels.filter((h) => {
    const cc = extractBookingHotelCountryCode(h.url);
    return cc !== null && allow.includes(cc);
  });

  if (positivelyMatched.length > 0) {
    console.log(`🌍 国コード一致 [${allow.join('|')}]: ${hotels.length} → ${positivelyMatched.length} 件`);
    return positivelyMatched;
  }

  // URLはあるが想定国外だけ → jp の最安だけ残る問題を除去（URL無しは様子見で残す）
  const stripped = hotels.filter((h) => {
    const cc = extractBookingHotelCountryCode(h.url);
    if (cc === null) return true;
    return allow.includes(cc);
  });

  if (stripped.length > 0) {
    const removed = hotels.length - stripped.length;
    console.log(`🌍 想定外国コードを除去: −${removed}件（残り ${stripped.length}）`);
    return stripped;
  }

  console.warn(
    `⚠️ 指定地域 (${allow.join('/')}) と一致するプロパティがありません — 結果を破棄（誤検出防止）`,
  );
  return [];
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

    const dest = pickBestDestination(data.data, query);
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

  const locationKey = params.location.trim().normalize('NFKC');

  // まず目的地のIDを取得
  const destination = await searchDestination(locationKey);
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

    hotels = filterHotelsByRegionCountry(hotels, locationKey);

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

    const stay = toStaySource(params);
    let propertyPageUrl = parseBookingPropertyUrl(cheapest.url);
    if (!propertyPageUrl && hotelId) {
      propertyPageUrl =
        (await fetchHotelDetailsPropertyUrl(hotelId, params)) ??
        (await fetchRoomListPropertyUrl(hotelId, params));
    }
    const destHint = { dest_id: destination.dest_id, search_type: destination.search_type };

    const searchBarContext =
      [destination.label, destination.city_name, locationKey].find((s) => (s || '').trim()) || '';

    const directHotelLink = propertyPageUrl
      ? mergeStayParamsOntoPropertyPage(propertyPageUrl, stay, {
          searchContext: searchBarContext,
        })
      : buildBookingSearchFallbackUrl(hotelName, locationKey, stay, destHint);

    const regionalSearchUrl = buildBookingRegionalListUrl(
      searchBarContext || locationKey,
      stay,
      destHint,
    );
    console.log(`🔗 Generated hotel link: ${directHotelLink}`);

    const result: HotelResult = {
      success: true,
      hotel: {
        id: hotelId,
        name: hotelName,
        stars: prop.qualityClass || prop.propertyClass || 0,
        rating: prop.reviewScore,
        reviewCount: prop.reviewCount,
        location: params.location?.trim().normalize('NFKC') || destination.city_name,
        pricePerNight,
        pricePerNightFormatted: `¥${pricePerNight.toLocaleString()}`,
        totalPrice,
        totalPriceFormatted: `¥${totalPrice.toLocaleString()}`,
        marketPrice,
        marketPriceFormatted: `¥${marketPrice.toLocaleString()}`,
        savings,
        savingsFormatted: `¥${savings.toLocaleString()}`,
        deepLink: directHotelLink,
        regionalSearchUrl,
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
 * RapidAPI getHotelDetails のレスポンスから正規プロパティURLを取得
 */
async function fetchHotelDetailsPropertyUrl(
  hotelId: string,
  params: HotelSearchParams,
): Promise<string | null> {
  const apiKey = getRapidApiKey();
  if (!apiKey || !hotelId) return null;

  try {
    const queryParams = new URLSearchParams({
      hotel_id: hotelId,
      arrival_date: params.checkIn,
      departure_date: params.checkOut,
      adults: params.adults.toString(),
      room_qty: (params.rooms || 1).toString(),
      languagecode: 'ja',
      currency_code: 'JPY',
    });

    if (params.children && params.children > 0 && params.childrenAges?.length) {
      queryParams.set('children_age', params.childrenAges.join(','));
    }

    const url = `${RAPIDAPI_BASE_URL}/getHotelDetails?${queryParams.toString()}`;
    const response = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': RAPIDAPI_HOST,
      },
    });

    if (!response.ok) {
      console.warn(`⚠️ getHotelDetails HTTP ${response.status}`);
      return null;
    }

    const payload = await response.json() as unknown;
    return extractBookingPropertyPageUrl(payload);
  } catch (error) {
    console.warn('⚠️ getHotelDetails failed:', error);
    return null;
  }
}

/** getHotelDetails でURLが取れないとき、getRoomList のJSONにもプロパティURLが載ることがある */
async function fetchRoomListPropertyUrl(
  hotelId: string,
  params: HotelSearchParams,
): Promise<string | null> {
  const apiKey = getRapidApiKey();
  if (!apiKey || !hotelId) return null;

  try {
    const queryParams = new URLSearchParams({
      hotel_id: hotelId,
      arrival_date: params.checkIn,
      departure_date: params.checkOut,
      adults: params.adults.toString(),
      room_qty: (params.rooms || 1).toString(),
      languagecode: 'ja',
      currency_code: 'JPY',
    });

    if (params.children && params.children > 0 && params.childrenAges?.length) {
      queryParams.set('children_age', params.childrenAges.join(','));
    }

    const url = `${RAPIDAPI_BASE_URL}/getRoomList?${queryParams.toString()}`;
    const response = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': RAPIDAPI_HOST,
      },
    });

    if (!response.ok) {
      console.warn(`⚠️ getRoomList HTTP ${response.status}`);
      return null;
    }

    const payload = await response.json() as unknown;
    return extractBookingPropertyPageUrl(payload);
  } catch (error) {
    console.warn('⚠️ getRoomList URL extract failed:', error);
    return null;
  }
}

function generateBookingUrl(params: HotelSearchParams, dest?: DestinationResult): string {
  return buildBookingRegionalListUrl(
    params.location.trim().normalize('NFKC'),
    toStaySource(params),
    dest?.dest_id ? { dest_id: dest.dest_id, search_type: dest.search_type } : undefined,
  );
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
  response += `📍 ${params.location || result.hotel?.location}\n`;
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
    
    const primaryLabel = isBookingPropertyPageHref(h.deepLink)
      ? '🔗 このホテルのページを開く'
      : '🔗 検索結果を開く（候補の宿）';
    response += `${primaryLabel}\n`;
    response += `${h.deepLink}\n\n`;

    if (h.regionalSearchUrl && h.regionalSearchUrl !== h.deepLink) {
      response += `━━━━━━━━━━━━━━━\n`;
      response += `📋 同じ日程で地域の宿を一覧で見る\n`;
      response += `━━━━━━━━━━━━━━━\n\n`;
      response += `${h.regionalSearchUrl}\n\n`;
      response += `${BOOKING_PRICE_SORT_HINT_LINE}\n\n`;
    } else {
      response += `${BOOKING_PRICE_SORT_HINT_LINE}\n\n`;
    }
    
  } else {
    response += `検索条件に合うホテルが見つかりませんでした。\n\n`;
    response += `🔗 他のサイトで検索する\n`;
    response += `${generateBookingUrl(params)}\n\n`;
    response += `${BOOKING_PRICE_SORT_HINT_LINE}\n`;
  }
  
  return response;
}
