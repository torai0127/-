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
 * Booking.com ディープリンク
 */
export function generateBookingComUrl(params: HotelSearchParams): string {
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

/**
 * Agoda ディープリンク
 */
export function generateAgodaUrl(params: HotelSearchParams): string {
  const formatDate = (d: string) => d.replace(/-/g, '-');
  
  const queryParams = new URLSearchParams({
    city: params.location,
    checkIn: formatDate(params.checkIn),
    checkOut: formatDate(params.checkOut),
    rooms: (params.rooms || 1).toString(),
    adults: params.adults.toString(),
    children: (params.children || 0).toString(),
    los: calculateNights(params.checkIn, params.checkOut).toString(),
    childAges: params.childrenAges?.join(',') || '',
  });
  
  return `https://www.agoda.com/ja-jp/search?${queryParams.toString()}`;
}

/**
 * じゃらん ディープリンク
 */
export function generateJalanUrl(params: HotelSearchParams): string {
  const checkIn = params.checkIn.replace(/-/g, '');
  const checkOut = params.checkOut.replace(/-/g, '');
  
  const queryParams = new URLSearchParams({
    stayYear: checkIn.substring(0, 4),
    stayMonth: checkIn.substring(4, 6),
    stayDay: checkIn.substring(6, 8),
    stayCount: calculateNights(params.checkIn, params.checkOut).toString(),
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
  const checkIn = params.checkIn.replace(/-/g, '');
  const checkOut = params.checkOut.replace(/-/g, '');
  
  const queryParams = new URLSearchParams({
    f_teikei: 'quick',
    f_heession: '1',
    f_tel: '0',
    f_cd1: '',
    f_cd2: '',
    f_flg: 'PLAN',
    f_hi1: checkIn,
    f_hi2: checkOut,
    f_hak: calculateNights(params.checkIn, params.checkOut).toString(),
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
  const queryParams = new URLSearchParams({
    q: params.location,
    d1: params.checkIn,
    d2: params.checkOut,
    adults: params.adults.toString(),
    rooms: (params.rooms || 1).toString(),
  });
  
  return `https://www.expedia.co.jp/Hotel-Search?${queryParams.toString()}`;
}

/**
 * Hotels.com ディープリンク
 */
export function generateHotelsComUrl(params: HotelSearchParams): string {
  const formatDate = (d: string) => {
    const [y, m, day] = d.split('-');
    return `${y}-${m}-${day}`;
  };
  
  const queryParams = new URLSearchParams({
    q: params.location,
    checkIn: formatDate(params.checkIn),
    checkOut: formatDate(params.checkOut),
    rooms: (params.rooms || 1).toString(),
    adults: params.adults.toString(),
  });
  
  return `https://jp.hotels.com/search.do?${queryParams.toString()}`;
}

/**
 * Trivago ディープリンク
 */
export function generateTrivagoUrl(params: HotelSearchParams): string {
  const nights = calculateNights(params.checkIn, params.checkOut);
  
  // Trivagoは特殊なURL形式
  const queryParams = new URLSearchParams({
    query: params.location,
    startDate: params.checkIn,
    endDate: params.checkOut,
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
  const queryParams = new URLSearchParams({
    city: params.location,
    checkin: params.checkIn,
    checkout: params.checkOut,
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
  const inDate = new Date(checkIn);
  const outDate = new Date(checkOut);
  const diff = outDate.getTime() - inDate.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
