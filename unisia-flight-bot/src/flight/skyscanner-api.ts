/**
 * Skyscanner API (Sky Scrapper via RapidAPI)
 * 
 * リアルタイムで航空券価格を取得
 * 
 * API登録: https://rapidapi.com/apiheya/api/sky-scrapper
 * 無料枠: 100リクエスト/月
 * 有料プラン: $10/月で1000リクエスト
 */

import { getAirportCode } from './google-flights.js';

const RAPIDAPI_HOST = 'sky-scrapper.p.rapidapi.com';

export interface SkyscannerSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  adults?: number;
  children?: number;
  infants?: number;
  cabinClass?: 'economy' | 'premium_economy' | 'business' | 'first';
  currency?: string;
  market?: string;
}

export interface SkyscannerAirportInfo {
  skyId: string;
  entityId: string;
  name: string;
  iata?: string;
}

export interface BookingAgent {
  id: string;
  name: string;
  price: number;
  priceFormatted: string;
  priceWithBaggage?: number;
  priceWithBaggageFormatted?: string;
  baggageIncluded: boolean;
  baggageWeight?: number;
  deepLink: string;
}

export interface SkyscannerFlightResult {
  price: number;
  priceFormatted: string;
  currency: string;
  deepLink: string;
  airlines: string[];
  departureTime: string;
  arrivalTime: string;
  duration: string;
  stops: number;
  itineraryId: string;
  bookingAgents?: BookingAgent[];
}

export interface CheapestOption {
  agentName: string;
  basePrice: number;
  basePriceFormatted: string;
  totalPriceWithBaggage: number;
  totalPriceWithBaggageFormatted: string;
  baggageIncluded: boolean;
  baggageWeight?: number;
  deepLink: string;
  airlines: string[];
  duration: string;
  stops: number;
  departureTime: string;
  arrivalTime: string;
}

export interface SkyscannerSearchResult {
  success: boolean;
  cheapestPrice?: number;
  cheapestPriceFormatted?: string;
  currency?: string;
  flights?: SkyscannerFlightResult[];
  deepLink?: string;
  cheapestOption?: CheapestOption;
  error?: string;
}

/**
 * RapidAPI キーを取得
 */
function getRapidApiKey(): string | null {
  return process.env.RAPIDAPI_KEY || null;
}

/**
 * 空港/都市を検索してSkyIdとEntityIdを取得
 */
export async function searchAirport(query: string): Promise<SkyscannerAirportInfo | null> {
  const apiKey = getRapidApiKey();
  if (!apiKey) {
    console.warn('⚠️ RAPIDAPI_KEY not configured');
    return null;
  }
  
  try {
    const response = await fetch(
      `https://${RAPIDAPI_HOST}/api/v1/flights/searchAirport?query=${encodeURIComponent(query)}&locale=ja-JP`,
      {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': RAPIDAPI_HOST,
        },
      }
    );
    
    if (!response.ok) {
      console.error('Airport search failed:', response.status, response.statusText);
      return null;
    }
    
    const data = await response.json() as { status?: boolean; data?: any[] };
    
    if (data.status && data.data && data.data.length > 0) {
      const airport = data.data[0];
      return {
        skyId: airport.skyId,
        entityId: airport.entityId,
        name: airport.presentation?.title || airport.name || query,
        iata: airport.iata,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Airport search error:', error);
    return null;
  }
}

/**
 * 空港コードからSkyIdとEntityIdを取得するキャッシュ
 */
const airportCache = new Map<string, SkyscannerAirportInfo>();

async function getAirportInfo(code: string): Promise<SkyscannerAirportInfo | null> {
  const normalizedCode = code.toUpperCase();
  
  if (airportCache.has(normalizedCode)) {
    return airportCache.get(normalizedCode)!;
  }
  
  const info = await searchAirport(normalizedCode);
  if (info) {
    airportCache.set(normalizedCode, info);
  }
  
  return info;
}

/**
 * フライト検索を実行
 */
export async function searchFlights(params: SkyscannerSearchParams): Promise<SkyscannerSearchResult> {
  const apiKey = getRapidApiKey();
  if (!apiKey) {
    return {
      success: false,
      error: 'RAPIDAPI_KEY not configured. Please set the environment variable.',
    };
  }
  
  try {
    // 出発地・目的地の空港情報を取得
    const originCode = getAirportCode(params.origin) || params.origin;
    const destCode = getAirportCode(params.destination) || params.destination;
    
    const [originInfo, destInfo] = await Promise.all([
      getAirportInfo(originCode),
      getAirportInfo(destCode),
    ]);
    
    if (!originInfo || !destInfo) {
      return {
        success: false,
        error: `Airport not found: ${!originInfo ? params.origin : params.destination}`,
      };
    }
    
    // 検索パラメータを構築
    const searchParams = new URLSearchParams({
      originSkyId: originInfo.skyId,
      destinationSkyId: destInfo.skyId,
      originEntityId: originInfo.entityId,
      destinationEntityId: destInfo.entityId,
      date: params.departureDate,
      adults: (params.adults || 1).toString(),
      currency: params.currency || 'JPY',
      market: params.market || 'JP',
      countryCode: 'JP',
      locale: 'ja-JP',
    });
    
    if (params.returnDate) {
      searchParams.set('returnDate', params.returnDate);
    }
    if (params.children && params.children > 0) {
      searchParams.set('children', params.children.toString());
    }
    if (params.infants && params.infants > 0) {
      searchParams.set('infants', params.infants.toString());
    }
    if (params.cabinClass) {
      const cabinMap: Record<string, string> = {
        economy: 'economy',
        premium_economy: 'premium_economy',
        business: 'business',
        first: 'first',
      };
      searchParams.set('cabinClass', cabinMap[params.cabinClass] || 'economy');
    }
    
    console.log(`🔍 Skyscanner API: Searching ${originInfo.skyId} → ${destInfo.skyId} on ${params.departureDate}`);
    
    const response = await fetch(
      `https://${RAPIDAPI_HOST}/api/v1/flights/searchFlights?${searchParams.toString()}`,
      {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': RAPIDAPI_HOST,
        },
      }
    );
    
    if (!response.ok) {
      console.error('Flight search failed:', response.status, response.statusText);
      return {
        success: false,
        error: `API error: ${response.status}`,
      };
    }
    
    const data = await response.json() as { 
      status?: boolean; 
      data?: { 
        itineraries?: any[];
        agents?: Record<string, any>;
      } 
    };
    
    if (!data.status || !data.data) {
      return {
        success: false,
        error: 'No flight data returned',
      };
    }
    
    // 結果を解析
    const itineraries = data.data.itineraries || [];
    const agents = data.data.agents || {};
    
    if (itineraries.length === 0) {
      return {
        success: true,
        flights: [],
        error: 'No flights found for this route and date',
      };
    }
    
    const flights: SkyscannerFlightResult[] = [];
    let cheapestOption: CheapestOption | null = null;
    let cheapestTotalPrice = Infinity;
    
    // 20kg荷物の追加料金の推定値（サイトによって異なる）
    const ESTIMATED_BAGGAGE_COST: Record<string, number> = {
      'default': 3000,
      'Cebu Pacific': 4500,
      'AirAsia': 4000,
      'Jetstar': 3500,
      'Peach': 3000,
      'Spring Airlines': 2500,
      'Scoot': 3500,
      'VietJet': 3000,
    };
    
    for (const itinerary of itineraries.slice(0, 20)) {
      const legs = itinerary.legs || [];
      const outboundLeg = legs[0];
      
      if (!outboundLeg) continue;
      
      const airlines = outboundLeg.carriers?.marketing?.map((c: any) => c.name) || [];
      const duration = formatDuration(outboundLeg.durationInMinutes || 0);
      const stops = outboundLeg.stopCount || 0;
      const departureTime = outboundLeg.departure || '';
      const arrivalTime = outboundLeg.arrival || '';
      
      // 各予約サイト（pricingOptions）の価格を取得
      const pricingOptions = itinerary.pricingOptions || [];
      const bookingAgents: BookingAgent[] = [];
      
      for (const option of pricingOptions) {
        const agentIds = option.agentIds || [];
        const price = option.price?.raw || 0;
        const priceFormatted = option.price?.formatted || `¥${price.toLocaleString()}`;
        const deepLink = option.url || itinerary.deeplink || '';
        
        // 荷物が含まれているかチェック
        const farePolicy = option.farePolicy || {};
        const baggageAllowance = farePolicy.checkedBaggageAllowed;
        const baggageIncluded = baggageAllowance === true;
        
        // エージェント名を取得
        let agentName = 'Unknown';
        if (agentIds.length > 0 && agents[agentIds[0]]) {
          agentName = agents[agentIds[0]].name || 'Unknown';
        }
        
        // 荷物込みの総額を計算
        let priceWithBaggage = price;
        let baggageWeight: number | undefined;
        
        if (!baggageIncluded) {
          // 航空会社に応じた荷物料金を追加
          const mainAirline = airlines[0] || '';
          const baggageCost = ESTIMATED_BAGGAGE_COST[mainAirline] || ESTIMATED_BAGGAGE_COST['default'];
          priceWithBaggage = price + baggageCost;
          baggageWeight = 20;
        } else {
          baggageWeight = 20; // 含まれている場合
        }
        
        const agent: BookingAgent = {
          id: agentIds[0] || '',
          name: agentName,
          price,
          priceFormatted,
          priceWithBaggage,
          priceWithBaggageFormatted: `¥${priceWithBaggage.toLocaleString()}`,
          baggageIncluded,
          baggageWeight,
          deepLink,
        };
        
        bookingAgents.push(agent);
        
        // 最安値を更新（荷物込み総額で比較）
        if (priceWithBaggage < cheapestTotalPrice && price > 0) {
          cheapestTotalPrice = priceWithBaggage;
          cheapestOption = {
            agentName,
            basePrice: price,
            basePriceFormatted: priceFormatted,
            totalPriceWithBaggage: priceWithBaggage,
            totalPriceWithBaggageFormatted: `¥${priceWithBaggage.toLocaleString()}`,
            baggageIncluded,
            baggageWeight,
            deepLink,
            airlines,
            duration,
            stops,
            departureTime,
            arrivalTime,
          };
        } else if (priceWithBaggage === cheapestTotalPrice && cheapestOption) {
          // 価格が同じ場合、荷物込みの方を優先
          if (baggageIncluded && !cheapestOption.baggageIncluded) {
            cheapestOption = {
              agentName,
              basePrice: price,
              basePriceFormatted: priceFormatted,
              totalPriceWithBaggage: priceWithBaggage,
              totalPriceWithBaggageFormatted: `¥${priceWithBaggage.toLocaleString()}`,
              baggageIncluded,
              baggageWeight,
              deepLink,
              airlines,
              duration,
              stops,
              departureTime,
              arrivalTime,
            };
          }
        }
      }
      
      // pricingOptionsがない場合は従来の方法で処理
      if (pricingOptions.length === 0) {
        const price = itinerary.price?.raw || 0;
        const priceFormatted = itinerary.price?.formatted || `¥${price.toLocaleString()}`;
        const deepLink = itinerary.deeplink || '';
        
        // LCCかどうかで荷物込み価格を推定
        const mainAirline = airlines[0] || '';
        const isLCC = ['Cebu Pacific', 'AirAsia', 'Jetstar', 'Peach', 'Spring Airlines', 'Scoot', 'VietJet'].includes(mainAirline);
        const baggageIncluded = !isLCC;
        const baggageCost = isLCC ? (ESTIMATED_BAGGAGE_COST[mainAirline] || ESTIMATED_BAGGAGE_COST['default']) : 0;
        const priceWithBaggage = price + baggageCost;
        
        if (priceWithBaggage < cheapestTotalPrice && price > 0) {
          cheapestTotalPrice = priceWithBaggage;
          cheapestOption = {
            agentName: 'Skyscanner',
            basePrice: price,
            basePriceFormatted: priceFormatted,
            totalPriceWithBaggage: priceWithBaggage,
            totalPriceWithBaggageFormatted: `¥${priceWithBaggage.toLocaleString()}`,
            baggageIncluded,
            baggageWeight: 20,
            deepLink,
            airlines,
            duration,
            stops,
            departureTime,
            arrivalTime,
          };
        }
      }
      
      const flight: SkyscannerFlightResult = {
        price: itinerary.price?.raw || 0,
        priceFormatted: itinerary.price?.formatted || `¥${(itinerary.price?.raw || 0).toLocaleString()}`,
        currency: 'JPY',
        deepLink: itinerary.deeplink || '',
        airlines,
        departureTime,
        arrivalTime,
        duration,
        stops,
        itineraryId: itinerary.id || '',
        bookingAgents: bookingAgents.length > 0 ? bookingAgents : undefined,
      };
      
      flights.push(flight);
    }
    
    return {
      success: true,
      cheapestPrice: cheapestOption?.basePrice,
      cheapestPriceFormatted: cheapestOption?.basePriceFormatted,
      currency: 'JPY',
      flights,
      deepLink: cheapestOption?.deepLink,
      cheapestOption: cheapestOption ?? undefined,
    };
  } catch (error) {
    console.error('Skyscanner API error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 分を時間:分形式にフォーマット
 */
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) {
    return `${hours}時間${mins}分`;
  } else if (hours > 0) {
    return `${hours}時間`;
  } else {
    return `${mins}分`;
  }
}

/**
 * 価格カレンダーを取得（特定月の最安値一覧）
 */
export async function getPriceCalendar(
  origin: string,
  destination: string,
  yearMonth: string
): Promise<{ date: string; price: number }[]> {
  const apiKey = getRapidApiKey();
  if (!apiKey) {
    console.warn('⚠️ RAPIDAPI_KEY not configured');
    return [];
  }
  
  try {
    const originCode = getAirportCode(origin) || origin;
    const destCode = getAirportCode(destination) || destination;
    
    const [originInfo, destInfo] = await Promise.all([
      getAirportInfo(originCode),
      getAirportInfo(destCode),
    ]);
    
    if (!originInfo || !destInfo) {
      console.error('Airport not found for price calendar');
      return [];
    }
    
    const searchParams = new URLSearchParams({
      originSkyId: originInfo.skyId,
      destinationSkyId: destInfo.skyId,
      originEntityId: originInfo.entityId,
      destinationEntityId: destInfo.entityId,
      yearMonth,
      currency: 'JPY',
      market: 'JP',
      countryCode: 'JP',
      locale: 'ja-JP',
    });
    
    const response = await fetch(
      `https://${RAPIDAPI_HOST}/api/v1/flights/getPriceCalendar?${searchParams.toString()}`,
      {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': RAPIDAPI_HOST,
        },
      }
    );
    
    if (!response.ok) {
      console.error('Price calendar failed:', response.status);
      return [];
    }
    
    const data = await response.json() as { status?: boolean; data?: { flights?: { days?: any[] } } };
    
    if (!data.status || !data.data || !data.data.flights || !data.data.flights.days) {
      return [];
    }
    
    return data.data.flights.days.map((day: any) => ({
      date: day.day,
      price: day.price || 0,
    }));
  } catch (error) {
    console.error('Price calendar error:', error);
    return [];
  }
}

/**
 * APIが利用可能かチェック
 */
export function isSkyscannerApiAvailable(): boolean {
  return !!getRapidApiKey();
}
