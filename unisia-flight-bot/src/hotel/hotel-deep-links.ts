/**
 * 各ホテル予約サイトへのディープリンク生成
 */

import { HotelSearchParams } from './travelpayouts-hotels';

export interface HotelDeepLinks {
  bookingCom: string;
  agoda: string;
  jalan: string;
  rakutenTravel: string;
  expedia: string;
  hotelsCom: string;
  trivago: string;
  tripCom: string;
}

/**
 * 日付をYYYYMMDD形式に変換
 */
function formatDateCompact(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

/**
 * 日付を確実にYYYY-MM-DD形式に変換
 */
function ensureDateFormat(dateStr: string): string {
  if (!dateStr) return '';
  
  // すでにYYYY-MM-DD形式の場合
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // YYYYMMDD形式の場合
  if (/^\d{8}$/.test(dateStr)) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
  
  // M/D形式の場合（現在年を使用）
  const mdMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (mdMatch) {
    const year = new Date().getFullYear();
    const month = mdMatch[1].padStart(2, '0');
    const day = mdMatch[2].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  return dateStr;
}

/**
 * Booking.com ディープリンク
 */
export function generateBookingComUrl(params: HotelSearchParams): string {
  const checkIn = ensureDateFormat(params.checkIn);
  const checkOut = ensureDateFormat(params.checkOut);
  
  const queryParams = new URLSearchParams({
    ss: params.location,
    checkin: checkIn,
    checkout: checkOut,
    group_adults: params.adults.toString(),
    no_rooms: (params.rooms || 1).toString(),
    group_children: (params.children || 0).toString(),
  });
  
  return `https://www.booking.com/searchresults.ja.html?${queryParams.toString()}`;
}

/**
 * Agoda ディープリンク
 */
export function generateAgodaUrl(params: HotelSearchParams): string {
  const checkIn = ensureDateFormat(params.checkIn);
  const checkOut = ensureDateFormat(params.checkOut);
  const los = calculateNights(checkIn, checkOut);
  
  const queryParams = new URLSearchParams({
    textToSearch: params.location,
    checkIn: checkIn,
    checkOut: checkOut,
    rooms: (params.rooms || 1).toString(),
    adults: params.adults.toString(),
    children: (params.children || 0).toString(),
    los: los.toString(),
  });
  
  // 子供の年齢があれば追加
  if (params.childrenAges && params.childrenAges.length > 0) {
    queryParams.set('childAges', params.childrenAges.join(','));
  }
  
  return `https://www.agoda.com/ja-jp/search?${queryParams.toString()}`;
}

/**
 * じゃらん ディープリンク
 */
export function generateJalanUrl(params: HotelSearchParams): string {
  const checkIn = ensureDateFormat(params.checkIn);
  const checkOut = ensureDateFormat(params.checkOut);
  const checkInCompact = formatDateCompact(checkIn);
  const nights = calculateNights(checkIn, checkOut);
  
  const queryParams = new URLSearchParams({
    stayYear: checkInCompact.substring(0, 4),
    stayMonth: checkInCompact.substring(4, 6),
    stayDay: checkInCompact.substring(6, 8),
    stayCount: nights.toString(),
    roomCount: (params.rooms || 1).toString(),
    adultNum: params.adults.toString(),
    keyword: params.location,
  });
  
  return `https://www.jalan.net/yw/ywLst.do?${queryParams.toString()}`;
}

/**
 * 楽天トラベル ディープリンク
 */
export function generateRakutenTravelUrl(params: HotelSearchParams): string {
  const checkIn = ensureDateFormat(params.checkIn);
  const checkOut = ensureDateFormat(params.checkOut);
  const checkInCompact = formatDateCompact(checkIn);
  const checkOutCompact = formatDateCompact(checkOut);
  const nights = calculateNights(checkIn, checkOut);
  
  const queryParams = new URLSearchParams({
    f_teikei: 'quick',
    f_heession: '1',
    f_tel: '0',
    f_cd1: '',
    f_cd2: '',
    f_flg: 'PLAN',
    f_hi1: checkInCompact,
    f_hi2: checkOutCompact,
    f_hak: nights.toString(),
    f_room: (params.rooms || 1).toString(),
    f_otona_su: params.adults.toString(),
    f_keyword: params.location,
  });
  
  return `https://travel.rakuten.co.jp/yado/search/list.do?${queryParams.toString()}`;
}

/**
 * Expedia ディープリンク
 */
export function generateExpediaUrl(params: HotelSearchParams): string {
  const checkIn = ensureDateFormat(params.checkIn);
  const checkOut = ensureDateFormat(params.checkOut);
  
  const queryParams = new URLSearchParams({
    q: params.location,
    d1: checkIn,
    d2: checkOut,
    adults: params.adults.toString(),
    rooms: (params.rooms || 1).toString(),
  });
  
  return `https://www.expedia.co.jp/Hotel-Search?${queryParams.toString()}`;
}

/**
 * Hotels.com ディープリンク
 */
export function generateHotelsComUrl(params: HotelSearchParams): string {
  const checkIn = ensureDateFormat(params.checkIn);
  const checkOut = ensureDateFormat(params.checkOut);
  
  const queryParams = new URLSearchParams({
    q: params.location,
    checkIn: checkIn,
    checkOut: checkOut,
    rooms: (params.rooms || 1).toString(),
    adults: params.adults.toString(),
  });
  
  return `https://jp.hotels.com/search.do?${queryParams.toString()}`;
}

/**
 * Trivago ディープリンク
 */
export function generateTrivagoUrl(params: HotelSearchParams): string {
  const checkIn = ensureDateFormat(params.checkIn);
  const checkOut = ensureDateFormat(params.checkOut);
  
  const queryParams = new URLSearchParams({
    query: params.location,
    startDate: checkIn,
    endDate: checkOut,
    roomNr: (params.rooms || 1).toString(),
    adults: params.adults.toString(),
    children: (params.children || 0).toString(),
  });
  
  return `https://www.trivago.jp/?${queryParams.toString()}`;
}

/**
 * Trip.com ディープリンク
 */
export function generateTripComUrl(params: HotelSearchParams): string {
  const checkIn = ensureDateFormat(params.checkIn);
  const checkOut = ensureDateFormat(params.checkOut);
  
  const queryParams = new URLSearchParams({
    city: params.location,
    checkin: checkIn,
    checkout: checkOut,
    adult: params.adults.toString(),
    room: (params.rooms || 1).toString(),
    child: (params.children || 0).toString(),
  });
  
  return `https://jp.trip.com/hotels/list?${queryParams.toString()}`;
}

/**
 * 全サイトのディープリンクを生成
 */
export function generateAllHotelDeepLinks(params: HotelSearchParams): HotelDeepLinks {
  return {
    bookingCom: generateBookingComUrl(params),
    agoda: generateAgodaUrl(params),
    jalan: generateJalanUrl(params),
    rakutenTravel: generateRakutenTravelUrl(params),
    expedia: generateExpediaUrl(params),
    hotelsCom: generateHotelsComUrl(params),
    trivago: generateTrivagoUrl(params),
    tripCom: generateTripComUrl(params),
  };
}

function calculateNights(checkIn: string, checkOut: string): number {
  const inDateStr = ensureDateFormat(checkIn);
  const outDateStr = ensureDateFormat(checkOut);
  const inDate = new Date(inDateStr);
  const outDate = new Date(outDateStr);
  const diff = outDate.getTime() - inDate.getTime();
  const nights = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return nights > 0 ? nights : 1;
}
