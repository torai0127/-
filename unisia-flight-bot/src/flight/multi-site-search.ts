/**
 * 複数航空券サイトのディープリンク生成
 * 
 * 対応サイト:
 * - Google Flights (メイン)
 * - Skyscanner
 * - Kayak
 * - Trip.com
 * - エアトリ
 * - トラベルコ
 * - スカイチケット
 * - さくらトラベル
 * - Kiwi.com
 * - eDreams
 * - Momondo
 */

import { getAirportCode, generateGoogleFlightsQueryUrl, FlightSearchParams } from './google-flights.js';

export interface MultiSiteSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  adults?: number;
  children?: number;
  infantsOnLap?: number;
  cabinClass?: 'economy' | 'premium_economy' | 'business' | 'first';
  tripType?: 'round_trip' | 'one_way';
}

export interface SiteLink {
  siteName: string;
  siteNameJa: string;
  url: string;
  isAffiliate: boolean;
  priority: number;
}

export interface MultiSiteSearchResult {
  params: MultiSiteSearchParams;
  links: SiteLink[];
  googleFlightsUrl: string;
}

const CABIN_CLASS_MAP: Record<string, Record<string, string>> = {
  skyscanner: {
    economy: 'economy',
    premium_economy: 'premiumeconomy',
    business: 'business',
    first: 'first',
  },
  kayak: {
    economy: 'e',
    premium_economy: 'p',
    business: 'b',
    first: 'f',
  },
  tripcom: {
    economy: 'y',
    premium_economy: 'w',
    business: 'c',
    first: 'f',
  },
};

/**
 * 日付フォーマット変換
 */
function formatDate(isoDate: string, format: 'YYMMDD' | 'YYYYMMDD' | 'YYYY-MM-DD'): string {
  const [year, month, day] = isoDate.split('-');
  switch (format) {
    case 'YYMMDD':
      return `${year.slice(2)}${month}${day}`;
    case 'YYYYMMDD':
      return `${year}${month}${day}`;
    case 'YYYY-MM-DD':
    default:
      return isoDate;
  }
}

/**
 * Skyscanner URL生成
 * 形式: /transport/flights/出発/到着/日付/日付/?adults=X
 */
export function generateSkyscannerUrl(params: MultiSiteSearchParams): string {
  const originCode = getAirportCode(params.origin) || params.origin.toUpperCase();
  const destCode = getAirportCode(params.destination) || params.destination.toUpperCase();
  const adults = params.adults || 1;
  const children = params.children || 0;
  const infants = params.infantsOnLap || 0;
  
  const depDate = formatDate(params.departureDate, 'YYMMDD');
  
  let url: string;
  if (params.returnDate && params.tripType !== 'one_way') {
    const retDate = formatDate(params.returnDate, 'YYMMDD');
    url = `https://www.skyscanner.jp/transport/flights/${originCode.toLowerCase()}/${destCode.toLowerCase()}/${depDate}/${retDate}/`;
  } else {
    url = `https://www.skyscanner.jp/transport/flights/${originCode.toLowerCase()}/${destCode.toLowerCase()}/${depDate}/`;
  }
  
  const queryParams = new URLSearchParams({
    adults: adults.toString(),
    adultsv2: adults.toString(),
    cabinclass: CABIN_CLASS_MAP.skyscanner[params.cabinClass || 'economy'],
    children: children.toString(),
    infants: infants.toString(),
    rtn: params.returnDate && params.tripType !== 'one_way' ? '1' : '0',
    preferdirects: 'false',
  });
  
  if (children > 0) {
    const childAges = Array(children).fill('8').join('|');
    queryParams.set('childrenv2', childAges);
  }
  
  return `${url}?${queryParams.toString()}`;
}

/**
 * Momondo URL生成 (Skyscannerと同系列、同じ形式)
 */
export function generateMomondoUrl(params: MultiSiteSearchParams): string {
  const originCode = getAirportCode(params.origin) || params.origin.toUpperCase();
  const destCode = getAirportCode(params.destination) || params.destination.toUpperCase();
  const adults = params.adults || 1;
  const children = params.children || 0;
  
  const depDate = formatDate(params.departureDate, 'YYMMDD');
  
  let url: string;
  if (params.returnDate && params.tripType !== 'one_way') {
    const retDate = formatDate(params.returnDate, 'YYMMDD');
    url = `https://www.momondo.jp/flight-search/${originCode}-${destCode}/${depDate}/${retDate}`;
  } else {
    url = `https://www.momondo.jp/flight-search/${originCode}-${destCode}/${depDate}`;
  }
  
  const queryParams = new URLSearchParams({
    adults: adults.toString(),
    children: children.toString(),
    cabin: CABIN_CLASS_MAP.skyscanner[params.cabinClass || 'economy'],
    sort: 'bestflight_a',
  });
  
  return `${url}?${queryParams.toString()}`;
}

/**
 * Kayak URL生成
 */
export function generateKayakUrl(params: MultiSiteSearchParams): string {
  const originCode = getAirportCode(params.origin) || params.origin.toUpperCase();
  const destCode = getAirportCode(params.destination) || params.destination.toUpperCase();
  const adults = params.adults || 1;
  const children = params.children || 0;
  const cabin = CABIN_CLASS_MAP.kayak[params.cabinClass || 'economy'];
  
  // 乗客文字列: 1adults/children8 (8歳の子供)
  let paxStr = `${adults}adults`;
  if (children > 0) {
    const childAges = Array(children).fill('8').join(',');
    paxStr += `/children~${childAges}`;
  }
  
  if (params.returnDate && params.tripType !== 'one_way') {
    return `https://www.kayak.co.jp/flights/${originCode}-${destCode}/${params.departureDate}/${params.returnDate}/${paxStr}?sort=bestflight_a&fs=cabin=${cabin}`;
  } else {
    return `https://www.kayak.co.jp/flights/${originCode}-${destCode}/${params.departureDate}/${paxStr}?sort=bestflight_a&fs=cabin=${cabin}`;
  }
}

/**
 * Trip.com URL生成
 */
export function generateTripComUrl(params: MultiSiteSearchParams): string {
  const originCode = getAirportCode(params.origin) || params.origin.toUpperCase();
  const destCode = getAirportCode(params.destination) || params.destination.toUpperCase();
  const adults = params.adults || 1;
  const children = params.children || 0;
  const cabin = CABIN_CLASS_MAP.tripcom[params.cabinClass || 'economy'];
  
  const depDateFormatted = params.departureDate.replace(/-/g, '');
  
  if (params.returnDate && params.tripType !== 'one_way') {
    const retDateFormatted = params.returnDate.replace(/-/g, '');
    return `https://jp.trip.com/flights/${originCode.toLowerCase()}-to-${destCode.toLowerCase()}/tickets-${originCode.toLowerCase()}${destCode.toLowerCase()}?dcity=${originCode}&acity=${destCode}&ddate=${params.departureDate}&rdate=${params.returnDate}&flighttype=rt&adult=${adults}&child=${children}&infant=0&class=${cabin}&lowpricesource=searchform`;
  } else {
    return `https://jp.trip.com/flights/${originCode.toLowerCase()}-to-${destCode.toLowerCase()}/tickets-${originCode.toLowerCase()}${destCode.toLowerCase()}?dcity=${originCode}&acity=${destCode}&ddate=${params.departureDate}&flighttype=ow&adult=${adults}&child=${children}&infant=0&class=${cabin}&lowpricesource=searchform`;
  }
}

/**
 * エアトリ URL生成
 */
export function generateAirTripUrl(params: MultiSiteSearchParams): string {
  const originCode = getAirportCode(params.origin) || params.origin.toUpperCase();
  const destCode = getAirportCode(params.destination) || params.destination.toUpperCase();
  const adults = params.adults || 1;
  const children = params.children || 0;
  
  const depDate = params.departureDate.replace(/-/g, '');
  
  if (params.returnDate && params.tripType !== 'one_way') {
    const retDate = params.returnDate.replace(/-/g, '');
    return `https://overseas.airtrip.jp/air/search?from=${originCode}&to=${destCode}&ddate=${depDate}&rdate=${retDate}&adt=${adults}&chd=${children}&inf=0&cabin=Y&trip=RT`;
  } else {
    return `https://overseas.airtrip.jp/air/search?from=${originCode}&to=${destCode}&ddate=${depDate}&adt=${adults}&chd=${children}&inf=0&cabin=Y&trip=OW`;
  }
}

/**
 * トラベルコ URL生成
 */
export function generateTravelkoUrl(params: MultiSiteSearchParams): string {
  const originCode = getAirportCode(params.origin) || params.origin.toUpperCase();
  const destCode = getAirportCode(params.destination) || params.destination.toUpperCase();
  const adults = params.adults || 1;
  const children = params.children || 0;
  
  const depDate = params.departureDate.replace(/-/g, '');
  
  if (params.returnDate && params.tripType !== 'one_way') {
    const retDate = params.returnDate.replace(/-/g, '');
    return `https://www.tour.ne.jp/w_air/list/?dpt_airport=${originCode}&arr_airport=${destCode}&dpt=${depDate}&arr=${retDate}&adt=${adults}&chd=${children}&inf=0&cabin=economy&sort=price`;
  } else {
    return `https://www.tour.ne.jp/w_air/list/?dpt_airport=${originCode}&arr_airport=${destCode}&dpt=${depDate}&adt=${adults}&chd=${children}&inf=0&cabin=economy&sort=price&trip=ow`;
  }
}

/**
 * スカイチケット URL生成
 */
export function generateSkyticketUrl(params: MultiSiteSearchParams): string {
  const originCode = getAirportCode(params.origin) || params.origin.toUpperCase();
  const destCode = getAirportCode(params.destination) || params.destination.toUpperCase();
  const adults = params.adults || 1;
  const children = params.children || 0;
  
  if (params.returnDate && params.tripType !== 'one_way') {
    return `https://skyticket.jp/international_flights/?from=${originCode}&to=${destCode}&dep_date=${params.departureDate}&ret_date=${params.returnDate}&adult=${adults}&child=${children}&infant=0&trip_type=round`;
  } else {
    return `https://skyticket.jp/international_flights/?from=${originCode}&to=${destCode}&dep_date=${params.departureDate}&adult=${adults}&child=${children}&infant=0&trip_type=oneway`;
  }
}

/**
 * さくらトラベル URL生成
 */
export function generateSakuraTravelUrl(params: MultiSiteSearchParams): string {
  const originCode = getAirportCode(params.origin) || params.origin.toUpperCase();
  const destCode = getAirportCode(params.destination) || params.destination.toUpperCase();
  const adults = params.adults || 1;
  const children = params.children || 0;
  
  const depDate = params.departureDate.replace(/-/g, '');
  
  if (params.returnDate && params.tripType !== 'one_way') {
    const retDate = params.returnDate.replace(/-/g, '');
    return `https://www.sakuratravel.jp/international/search?departure=${originCode}&arrival=${destCode}&outbound=${depDate}&inbound=${retDate}&adults=${adults}&children=${children}&infants=0`;
  } else {
    return `https://www.sakuratravel.jp/international/search?departure=${originCode}&arrival=${destCode}&outbound=${depDate}&adults=${adults}&children=${children}&infants=0&oneway=1`;
  }
}

/**
 * Kiwi.com URL生成
 */
export function generateKiwiUrl(params: MultiSiteSearchParams): string {
  const originCode = getAirportCode(params.origin) || params.origin.toUpperCase();
  const destCode = getAirportCode(params.destination) || params.destination.toUpperCase();
  const adults = params.adults || 1;
  const children = params.children || 0;
  
  const depDate = params.departureDate.replace(/-/g, '-');
  
  if (params.returnDate && params.tripType !== 'one_way') {
    return `https://www.kiwi.com/jp/search/results/${originCode}/${destCode}/${depDate}/${params.returnDate}?adults=${adults}&children=${children}&infants=0&sortBy=price`;
  } else {
    return `https://www.kiwi.com/jp/search/results/${originCode}/${destCode}/${depDate}?adults=${adults}&children=${children}&infants=0&sortBy=price`;
  }
}

/**
 * eDreams URL生成
 */
export function generateEDreamsUrl(params: MultiSiteSearchParams): string {
  const originCode = getAirportCode(params.origin) || params.origin.toUpperCase();
  const destCode = getAirportCode(params.destination) || params.destination.toUpperCase();
  const adults = params.adults || 1;
  const children = params.children || 0;
  
  const tripType = params.returnDate && params.tripType !== 'one_way' ? 'R' : 'O';
  
  let url = `https://www.edreams.jp/travel/?type=F&tripType=${tripType}&departureCity=${originCode}&arrivalCity=${destCode}&departureDate=${params.departureDate}&adults=${adults}&children=${children}&infants=0`;
  
  if (params.returnDate && params.tripType !== 'one_way') {
    url += `&returnDate=${params.returnDate}`;
  }
  
  return url;
}

/**
 * 全サイトの検索リンクを生成
 */
export function generateAllSiteLinks(params: MultiSiteSearchParams): MultiSiteSearchResult {
  const flightParams: FlightSearchParams = {
    origin: params.origin,
    destination: params.destination,
    departureDate: params.departureDate,
    returnDate: params.returnDate,
    adults: params.adults,
    children: params.children,
    infantsOnLap: params.infantsOnLap,
    cabinClass: params.cabinClass,
    tripType: params.tripType,
  };
  
  const googleFlightsUrl = generateGoogleFlightsQueryUrl(flightParams);
  
  const links: SiteLink[] = [
    {
      siteName: 'Google Flights',
      siteNameJa: 'Google Flights',
      url: googleFlightsUrl,
      isAffiliate: false,
      priority: 1,
    },
    {
      siteName: 'Skyscanner',
      siteNameJa: 'Skyscanner',
      url: generateSkyscannerUrl(params),
      isAffiliate: true,
      priority: 2,
    },
    {
      siteName: 'Trip.com',
      siteNameJa: 'Trip.com',
      url: generateTripComUrl(params),
      isAffiliate: true,
      priority: 3,
    },
    {
      siteName: 'AirTrip',
      siteNameJa: 'エアトリ',
      url: generateAirTripUrl(params),
      isAffiliate: false,
      priority: 4,
    },
    {
      siteName: 'Travelko',
      siteNameJa: 'トラベルコ',
      url: generateTravelkoUrl(params),
      isAffiliate: false,
      priority: 5,
    },
    {
      siteName: 'Skyticket',
      siteNameJa: 'スカイチケット',
      url: generateSkyticketUrl(params),
      isAffiliate: false,
      priority: 6,
    },
    {
      siteName: 'Sakura Travel',
      siteNameJa: 'さくらトラベル',
      url: generateSakuraTravelUrl(params),
      isAffiliate: false,
      priority: 7,
    },
    {
      siteName: 'Kayak',
      siteNameJa: 'Kayak',
      url: generateKayakUrl(params),
      isAffiliate: false,
      priority: 8,
    },
    {
      siteName: 'Momondo',
      siteNameJa: 'Momondo',
      url: generateMomondoUrl(params),
      isAffiliate: false,
      priority: 9,
    },
    {
      siteName: 'Kiwi.com',
      siteNameJa: 'Kiwi.com',
      url: generateKiwiUrl(params),
      isAffiliate: false,
      priority: 10,
    },
    {
      siteName: 'eDreams',
      siteNameJa: 'eDreams',
      url: generateEDreamsUrl(params),
      isAffiliate: false,
      priority: 11,
    },
  ];
  
  return {
    params,
    links: links.sort((a, b) => a.priority - b.priority),
    googleFlightsUrl,
  };
}

/**
 * 主要サイトのリンクのみ生成（LINE表示用に絞り込み）
 */
export function generateTopSiteLinks(params: MultiSiteSearchParams, topN: number = 5): SiteLink[] {
  const result = generateAllSiteLinks(params);
  return result.links.slice(0, topN);
}
