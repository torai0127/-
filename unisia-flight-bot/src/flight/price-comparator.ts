/**
 * 複数APIを内部で比較し、最安値1件のみを返す
 * 
 * 比較対象:
 * - Kiwi.com API（複数OTA・航空会社を集約）
 * - Skyscanner API（複数予約サイトの価格を集約）
 * 
 * 荷物（20kg）込みの総額で比較
 */

import { 
  searchFlights as searchSkyscanner, 
  isSkyscannerApiAvailable,
  SkyscannerSearchResult,
} from './skyscanner-api.js';
import { searchKiwi, isKiwiApiAvailable, KiwiFlightResult } from './kiwi-api.js';
import { searchAviasales, isAviasalesApiAvailable, AviasalesFlightResult } from './aviasales-api.js';
import { MultiSiteSearchParams } from './multi-site-search.js';
import { generateGoogleFlightsQueryUrl, FlightSearchParams } from './google-flights.js';

export interface CheapestResult {
  source: 'kiwi' | 'skyscanner' | 'aviasales' | 'google';
  price: number;
  priceFormatted: string;
  totalWithBaggage: number;
  totalWithBaggageFormatted: string;
  baggageIncluded: boolean;
  baggageNote: string;
  deepLink: string;
  airlines: string[];
  duration?: string;
  stops: number;
  departureTime?: string;
  arrivalTime?: string;
}

export interface FlightComparisonResult {
  success: boolean;
  searchParams: MultiSiteSearchParams;
  cheapest?: CheapestResult;
  googleFlightsUrl: string;
  message: string;
  sourcesChecked: string[];
  error?: string;
}

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
 * キャビンクラス変換（Kiwi用）
 */
function toKiwiCabinClass(cabinClass?: string): 'M' | 'W' | 'C' | 'F' {
  switch (cabinClass) {
    case 'premium_economy': return 'W';
    case 'business': return 'C';
    case 'first': return 'F';
    default: return 'M';
  }
}

/**
 * 複数APIから価格を取得し、内部で比較して最安値1件のみを返す
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
  
  const candidates: CheapestResult[] = [];
  const sourcesChecked: string[] = [];
  const errors: string[] = [];
  
  console.log('🔍 Starting multi-source price comparison...');
  
  // 並列でAPI検索を実行
  const searchPromises: Promise<void>[] = [];
  
  // Kiwi.com API
  if (isKiwiApiAvailable()) {
    sourcesChecked.push('Kiwi.com');
    searchPromises.push(
      withTimeout(
        searchKiwi({
          origin: params.origin,
          destination: params.destination,
          departureDate: params.departureDate,
          returnDate: params.returnDate,
          adults: params.adults,
          children: params.children,
          cabinClass: toKiwiCabinClass(params.cabinClass),
        }),
        SEARCH_TIMEOUT_MS,
        { success: false, error: 'Timeout' } as KiwiFlightResult
      ).then((result) => {
        if (result.success && result.price) {
          candidates.push({
            source: 'kiwi',
            price: result.price,
            priceFormatted: result.priceFormatted || `¥${result.price.toLocaleString()}`,
            totalWithBaggage: result.price,
            totalWithBaggageFormatted: result.priceFormatted || `¥${result.price.toLocaleString()}`,
            baggageIncluded: result.baggageIncluded || false,
            baggageNote: result.baggageIncluded 
              ? '✅ 受託手荷物込み' 
              : '⚠️ 受託手荷物は別途料金',
            deepLink: result.deepLink || '',
            airlines: result.airlines || [],
            duration: result.durationFormatted,
            stops: result.stops || 0,
            departureTime: result.departureTime,
            arrivalTime: result.arrivalTime,
          });
          console.log(`✅ Kiwi.com: ¥${result.price.toLocaleString()}`);
        } else if (result.error) {
          errors.push(`Kiwi: ${result.error}`);
        }
      })
    );
  }
  
  // Skyscanner API
  if (isSkyscannerApiAvailable()) {
    sourcesChecked.push('Skyscanner');
    searchPromises.push(
      withTimeout(
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
      ).then((result) => {
        if (result.success && result.cheapestOption) {
          const opt = result.cheapestOption;
          candidates.push({
            source: 'skyscanner',
            price: opt.basePrice,
            priceFormatted: opt.basePriceFormatted,
            totalWithBaggage: opt.totalPriceWithBaggage,
            totalWithBaggageFormatted: opt.totalPriceWithBaggageFormatted,
            baggageIncluded: opt.baggageIncluded,
            baggageNote: opt.baggageIncluded 
              ? '✅ 20kg荷物込み' 
              : `⚠️ 荷物別途（+約¥${(opt.totalPriceWithBaggage - opt.basePrice).toLocaleString()}）`,
            deepLink: opt.deepLink,
            airlines: opt.airlines,
            duration: opt.duration,
            stops: opt.stops,
            departureTime: opt.departureTime,
            arrivalTime: opt.arrivalTime,
          });
          console.log(`✅ Skyscanner: ¥${opt.totalPriceWithBaggage.toLocaleString()}`);
        } else if (result.error) {
          errors.push(`Skyscanner: ${result.error}`);
        }
      })
    );
  }
  
  // Aviasales API (Travelpayouts)
  if (isAviasalesApiAvailable()) {
    sourcesChecked.push('Aviasales');
    searchPromises.push(
      withTimeout(
        searchAviasales({
          origin: params.origin,
          destination: params.destination,
          departureDate: params.departureDate,
          returnDate: params.returnDate,
        }),
        SEARCH_TIMEOUT_MS,
        { success: false, error: 'Timeout' } as AviasalesFlightResult
      ).then((result) => {
        if (result.success && result.price) {
          candidates.push({
            source: 'aviasales',
            price: result.price,
            priceFormatted: result.priceFormatted || `¥${result.price.toLocaleString()}`,
            totalWithBaggage: result.price,
            totalWithBaggageFormatted: result.priceFormatted || `¥${result.price.toLocaleString()}`,
            baggageIncluded: false,
            baggageNote: '⚠️ 受託手荷物は別途料金の可能性あり',
            deepLink: result.deepLink || '',
            airlines: result.airline ? [result.airline] : [],
            duration: result.duration ? `${Math.floor(result.duration / 60)}時間${result.duration % 60}分` : undefined,
            stops: result.transfers || 0,
            departureTime: result.departureTime,
            arrivalTime: result.arrivalTime,
          });
          console.log(`✅ Aviasales: ¥${result.price.toLocaleString()}`);
        } else if (result.error) {
          errors.push(`Aviasales: ${result.error}`);
        }
      })
    );
  }
  
  // 全API検索を待機
  await Promise.all(searchPromises);
  
  // 最安値を選定（荷物込み総額で比較）
  let cheapest: CheapestResult | undefined;
  
  if (candidates.length > 0) {
    candidates.sort((a, b) => a.totalWithBaggage - b.totalWithBaggage);
    cheapest = candidates[0];
    console.log(`🏆 Cheapest: ${cheapest.source} - ¥${cheapest.totalWithBaggage.toLocaleString()}`);
  }
  
  // 結果メッセージ生成
  let message: string;
  if (cheapest) {
    message = `最安値: ${cheapest.totalWithBaggageFormatted}〜（荷物込み）`;
  } else if (sourcesChecked.length === 0) {
    message = 'APIが未設定のため、Google Flightsで検索してください';
  } else {
    message = '価格情報を取得できませんでした。Google Flightsで検索してください';
  }
  
  return {
    success: !!cheapest,
    searchParams: params,
    cheapest,
    googleFlightsUrl,
    message,
    sourcesChecked,
    error: errors.length > 0 ? errors.join('; ') : undefined,
  };
}

/**
 * LINE応答用フォーマット
 * 
 * 最安値のリンクだけを表示（サイト名は非表示）
 */
export function formatComparisonResultForLine(result: FlightComparisonResult): string {
  const { searchParams, cheapest, googleFlightsUrl } = result;
  
  // 日付フォーマット
  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    return `${parseInt(m)}/${parseInt(d)}`;
  };
  
  // 時刻フォーマット
  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '';
    try {
      const date = new Date(timeStr);
      if (isNaN(date.getTime())) return '';
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } catch {
      return '';
    }
  };
  
  const depDate = formatDate(searchParams.departureDate);
  const retDate = searchParams.returnDate ? formatDate(searchParams.returnDate) : null;
  const dateRange = retDate ? `${depDate}〜${retDate}` : depDate;
  
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
  
  // 最安値があればその情報のみ表示
  if (cheapest && cheapest.deepLink) {
    // 価格
    response += `💰 ${cheapest.totalWithBaggageFormatted}〜 / 1名\n`;
    response += `　 ${cheapest.baggageNote}\n\n`;
    
    // フライト詳細
    if (cheapest.airlines && cheapest.airlines.length > 0) {
      response += `✈️ ${cheapest.airlines.join(' / ')}\n`;
    }
    
    const depTime = formatTime(cheapest.departureTime);
    const arrTime = formatTime(cheapest.arrivalTime);
    if (depTime && arrTime) {
      response += `🕐 ${depTime} → ${arrTime}\n`;
    }
    
    if (cheapest.duration) {
      response += `⏱️ ${cheapest.duration}\n`;
    }
    
    response += `🔄 ${cheapest.stops === 0 ? '直行便' : `乗継 ${cheapest.stops}回`}\n\n`;
    
    // 購入リンク
    response += `🔗 予約はこちら\n`;
    response += `${cheapest.deepLink}\n\n`;
    
    response += `💡 日付を変更すると、さらに安い便が見つかることも！`;
    
    return response;
  }
  
  // APIから価格が取得できなかった場合はGoogle Flightsを表示
  response += `🔗 航空券を検索\n`;
  response += `${googleFlightsUrl}\n\n`;
  
  response += `💡 日付を変更すると、さらに安い便が見つかることも！\n`;
  response += `💡 火・水曜出発が比較的安いことも多いです。`;
  
  return response;
}

/**
 * シンプルな結果フォーマット（API未設定の場合）
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
  
  response += `🔗 航空券を検索\n`;
  response += `${googleFlightsUrl}\n\n`;
  
  response += `💡 日付を変更すると、さらに安い便が見つかることも！\n`;
  response += `💡 火・水曜出発が比較的安いことも多いです。`;
  
  return response;
}

/**
 * いずれかのAPIが利用可能かチェック
 */
export function isAnyApiAvailable(): boolean {
  return isKiwiApiAvailable() || isSkyscannerApiAvailable() || isAviasalesApiAvailable();
}
