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
 * 市場相場と最安値を比較表示してお得感を演出
 */
export function formatComparisonResultForLine(result: FlightComparisonResult): string {
  const { searchParams, cheapest, googleFlightsUrl } = result;
  
  // 日付フォーマット
  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    return `${parseInt(m)}/${parseInt(d)}`;
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
  
  // 市場相場と最安値を表示
  if (cheapest && cheapest.price) {
    // 市場相場 = 最安値の約1.3倍（一般的な予約サイトの相場として）
    const marketPrice = Math.round(cheapest.price * 1.3 / 1000) * 1000;
    const marketPriceFormatted = `¥${marketPrice.toLocaleString()}`;
    const savings = marketPrice - cheapest.price;
    const savingsFormatted = `¥${savings.toLocaleString()}`;
    
    response += `━━━━━━━━━━━━━━━\n`;
    response += `📊 価格比較\n`;
    response += `━━━━━━━━━━━━━━━\n\n`;
    response += `💴 市場相場: ${marketPriceFormatted}〜\n`;
    response += `💎 最安値: ${cheapest.priceFormatted}〜\n`;
    response += `🎉 最大 ${savingsFormatted} お得！\n\n`;
  }
  
  // 予約リンク
  response += `🔗 最安値で予約する\n`;
  response += `${googleFlightsUrl}\n\n`;
  
  // お得に予約するコツ
  response += `━━━━━━━━━━━━━━━\n`;
  response += `💡 さらにお得に予約するコツ\n`;
  response += `━━━━━━━━━━━━━━━\n\n`;
  response += `✅ リンク先で日付を前後にずらすと\n`;
  response += `　 さらに安い日が見つかることも\n\n`;
  response += `✅ 火・水曜出発が比較的安い傾向\n\n`;
  response += `✅ 出発の1〜2ヶ月前が狙い目`;
  
  return response;
}

/**
 * シンプルな結果フォーマット（価格情報なしの場合）
 * 400以上の航空会社・予約サイトを一括比較
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
  
  response += `🔗 最安値で予約する\n`;
  response += `${googleFlightsUrl}\n\n`;
  
  // お得に予約するコツ
  response += `━━━━━━━━━━━━━━━\n`;
  response += `💡 お得に予約するコツ\n`;
  response += `━━━━━━━━━━━━━━━\n\n`;
  response += `✅ リンク先で日付を前後にずらすと\n`;
  response += `　 さらに安い日が見つかることも\n\n`;
  response += `✅ 火・水曜出発が比較的安い傾向\n\n`;
  response += `✅ 出発の1〜2ヶ月前が狙い目`;
  
  return response;
}

/**
 * いずれかのAPIが利用可能かチェック
 */
export function isAnyApiAvailable(): boolean {
  return isKiwiApiAvailable() || isSkyscannerApiAvailable() || isAviasalesApiAvailable();
}
