/**
 * 複数サイトの価格比較ロジック
 * 
 * - Skyscanner APIから複数予約サイトの価格を取得
 * - 荷物（20kg）込みで最安値を判定
 * - 最安値のサイト1つだけを提示
 */

import { 
  searchFlights as searchSkyscanner, 
  isSkyscannerApiAvailable,
  SkyscannerSearchResult,
} from './skyscanner-api.js';
import { MultiSiteSearchParams } from './multi-site-search.js';
import { generateGoogleFlightsQueryUrl, FlightSearchParams } from './google-flights.js';

export interface CheapestSiteResult {
  siteName: string;
  siteNameJa: string;
  basePrice: number;
  basePriceFormatted: string;
  totalPriceWithBaggage: number;
  totalPriceWithBaggageFormatted: string;
  baggageIncluded: boolean;
  baggageNote: string;
  deepLink: string;
  airlines: string[];
  duration: string;
  stops: number;
  departureTime: string;
  arrivalTime: string;
}

export interface FlightComparisonResult {
  success: boolean;
  searchParams: MultiSiteSearchParams;
  
  cheapestSite?: CheapestSiteResult;
  googleFlightsUrl: string;
  
  message: string;
  error?: string;
}

/**
 * 価格取得のタイムアウト（ミリ秒）
 */
const SEARCH_TIMEOUT_MS = 15000;

/**
 * タイムアウト付きPromise
 */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/**
 * サイト名の日本語変換マップ
 */
const SITE_NAME_JA: Record<string, string> = {
  'Skyscanner': 'Skyscanner',
  'Trip.com': 'Trip.com',
  'Expedia': 'エクスペディア',
  'Booking.com': 'Booking.com',
  'Kiwi.com': 'Kiwi.com',
  'eDreams': 'eDreams',
  'Gotogate': 'Gotogate',
  'BudgetAir': 'BudgetAir',
  'Mytrip': 'Mytrip',
  'CheapOair': 'CheapOair',
  'Unknown': '比較サイト',
};

/**
 * 複数サイトから価格を取得し、最安値のサイト1つを返す
 * 
 * 価格が同じ場合は20kg荷物込みの総額で比較
 */
export async function compareFlightPrices(params: MultiSiteSearchParams): Promise<FlightComparisonResult> {
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
  
  let cheapestSite: CheapestSiteResult | undefined;
  let errorMessage: string | undefined;
  
  // Skyscanner APIで複数サイトの価格を取得
  if (isSkyscannerApiAvailable()) {
    console.log('🔍 Searching for cheapest flight across multiple booking sites...');
    
    const result = await withTimeout(
      searchSkyscanner({
        origin: params.origin,
        destination: params.destination,
        departureDate: params.departureDate,
        returnDate: params.returnDate,
        adults: params.adults,
        children: params.children,
        cabinClass: params.cabinClass,
      }),
      SEARCH_TIMEOUT_MS,
      { success: false, error: 'Timeout' } as SkyscannerSearchResult
    );
    
    if (result.success && result.cheapestOption) {
      const option = result.cheapestOption;
      
      cheapestSite = {
        siteName: option.agentName,
        siteNameJa: SITE_NAME_JA[option.agentName] || option.agentName,
        basePrice: option.basePrice,
        basePriceFormatted: option.basePriceFormatted,
        totalPriceWithBaggage: option.totalPriceWithBaggage,
        totalPriceWithBaggageFormatted: option.totalPriceWithBaggageFormatted,
        baggageIncluded: option.baggageIncluded,
        baggageNote: option.baggageIncluded 
          ? '✅ 20kg荷物込み' 
          : `⚠️ 荷物別途（+約¥${(option.totalPriceWithBaggage - option.basePrice).toLocaleString()}）`,
        deepLink: option.deepLink,
        airlines: option.airlines,
        duration: option.duration,
        stops: option.stops,
        departureTime: option.departureTime,
        arrivalTime: option.arrivalTime,
      };
      
      console.log(`✅ Cheapest: ${option.agentName} - ¥${option.totalPriceWithBaggage.toLocaleString()} (with 20kg baggage)`);
    } else if (result.error) {
      console.log(`⚠️ Search failed: ${result.error}`);
      errorMessage = result.error;
    }
  } else {
    console.log('ℹ️ Skyscanner API not configured');
    errorMessage = '価格取得APIが未設定のため、Google Flightsのリンクのみ表示します';
  }
  
  // 結果メッセージを生成
  let message: string;
  if (cheapestSite) {
    message = `最安値: ${cheapestSite.siteNameJa}（${cheapestSite.totalPriceWithBaggageFormatted}〜 / 荷物20kg込み）`;
  } else if (!isSkyscannerApiAvailable()) {
    message = '価格取得APIが未設定のため、リンクのみ表示します';
  } else {
    message = '価格情報を取得できませんでした';
  }
  
  return {
    success: !!cheapestSite,
    searchParams: params,
    cheapestSite,
    googleFlightsUrl,
    message,
    error: errorMessage,
  };
}

/**
 * LINE応答用のフォーマット済みメッセージを生成
 * 
 * 最安値のリンクだけを提示（サイト名は非表示）
 * Google Flightsより安いものがあればGoogle Flightsは非表示
 */
export function formatComparisonResultForLine(result: FlightComparisonResult): string {
  const { searchParams, cheapestSite, googleFlightsUrl } = result;
  
  // 日付フォーマット
  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    return `${parseInt(m)}/${parseInt(d)}`;
  };
  
  // 時刻フォーマット（ISO形式から HH:MM へ）
  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };
  
  const depDate = formatDate(searchParams.departureDate);
  const retDate = searchParams.returnDate ? formatDate(searchParams.returnDate) : null;
  const dateRange = retDate ? `${depDate}〜${retDate}` : depDate;
  
  // 人数
  const adults = searchParams.adults || 1;
  const children = searchParams.children || 0;
  let paxStr = `${adults + children}名`;
  if (children > 0) {
    paxStr = `${adults + children}名（大人${adults}、子供${children}）`;
  }
  
  let response = `✈️ 航空券検索結果\n\n`;
  response += `📍 ${searchParams.origin} → ${searchParams.destination}\n`;
  response += `📅 ${dateRange}\n`;
  response += `👥 ${paxStr}\n\n`;
  
  // 最安値があればそのリンクのみ表示
  if (cheapestSite) {
    // 価格（荷物込み総額）
    response += `💰 ${cheapestSite.totalPriceWithBaggageFormatted}〜 / 1名\n`;
    response += `　 ${cheapestSite.baggageNote}\n\n`;
    
    // フライト詳細
    if (cheapestSite.airlines.length > 0) {
      response += `✈️ ${cheapestSite.airlines.join(' / ')}\n`;
    }
    
    const depTime = formatTime(cheapestSite.departureTime);
    const arrTime = formatTime(cheapestSite.arrivalTime);
    if (depTime && arrTime) {
      response += `🕐 ${depTime} → ${arrTime}\n`;
    }
    
    if (cheapestSite.duration) {
      response += `⏱️ ${cheapestSite.duration}\n`;
    }
    
    response += `🔄 ${cheapestSite.stops === 0 ? '直行便' : `乗継 ${cheapestSite.stops}回`}\n\n`;
    
    // 購入リンク（サイト名なし）
    response += `🔗 予約はこちら\n`;
    response += `${cheapestSite.deepLink}\n\n`;
    
    response += `💡 日付を変更すると、さらに安い便が見つかることも！`;
    
    return response;
  }
  
  // 最安値が取得できなかった場合のみGoogle Flightsを表示
  response += `🔗 航空券を検索\n`;
  response += `${googleFlightsUrl}\n\n`;
  
  response += `💡 日付を変更すると、さらに安い便が見つかることも！`;
  
  return response;
}

/**
 * シンプルな結果フォーマット（価格取得なしの場合）
 * 
 * Google Flightsリンクのみ表示
 */
export function formatSimpleResultForLine(params: MultiSiteSearchParams): string {
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
  
  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    return `${parseInt(m)}/${parseInt(d)}`;
  };
  
  const depDate = formatDate(params.departureDate);
  const retDate = params.returnDate ? formatDate(params.returnDate) : null;
  const dateRange = retDate ? `${depDate}〜${retDate}` : depDate;
  
  const adults = params.adults || 1;
  const children = params.children || 0;
  let paxStr = `${adults + children}名`;
  if (children > 0) {
    paxStr = `${adults + children}名（大人${adults}、子供${children}）`;
  }
  
  let response = `✈️ 航空券検索結果\n\n`;
  response += `📍 ${params.origin} → ${params.destination}\n`;
  response += `📅 ${dateRange}\n`;
  response += `👥 ${paxStr}\n\n`;
  
  // Google Flights
  response += `🔗 Google Flightsで検索\n`;
  response += `${googleFlightsUrl}\n\n`;
  
  response += `💡 日付を変更すると、さらに安い便が見つかることも！\n`;
  response += `💡 火・水曜出発が比較的安いことも多いです。`;
  
  return response;
}
