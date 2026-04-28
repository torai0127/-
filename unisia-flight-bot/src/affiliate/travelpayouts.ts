/**
 * Travelpayouts アフィリエイトAPI
 * 
 * 対応サービス:
 * - Aviasales (航空券)
 * - Trip.com (航空券・ホテル)
 * 
 * 登録: https://www.travelpayouts.com/
 * API Doc: https://api.travelpayouts.com/documentation
 */

import { getAirportCode } from '../flight/google-flights.js';

const TRAVELPAYOUTS_API_BASE = 'https://api.travelpayouts.com';

export interface TravelpayoutsParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  adults?: number;
  tripClass?: 0 | 1 | 2; // 0: economy, 1: business, 2: first
}

export interface CachedPrice {
  value: number;
  origin: string;
  destination: string;
  departureAt: string;
  returnAt?: string;
  airline: string;
  flightNumber: string;
  transfers: number;
  expiresAt: string;
  foundAt: string;
}

export interface TravelpayoutsPriceResult {
  success: boolean;
  prices?: CachedPrice[];
  cheapestPrice?: number;
  error?: string;
}

/**
 * Travelpayouts APIトークンを取得
 */
function getTravelpayoutsToken(): string | null {
  return process.env.TRAVELPAYOUTS_TOKEN || null;
}

/**
 * Travelpayouts マーカー（アフィリエイトID）を取得
 */
function getTravelpayoutsMarker(): string {
  return process.env.TRAVELPAYOUTS_MARKER || '';
}

/**
 * 過去の検索データから最安値を取得（Data API v2）
 * ※リアルタイムではなく、キャッシュされた価格データ
 */
export async function getCachedPrices(params: TravelpayoutsParams): Promise<TravelpayoutsPriceResult> {
  const token = getTravelpayoutsToken();
  if (!token) {
    return {
      success: false,
      error: 'TRAVELPAYOUTS_TOKEN not configured',
    };
  }
  
  try {
    const originCode = getAirportCode(params.origin) || params.origin.toUpperCase();
    const destCode = getAirportCode(params.destination) || params.destination.toUpperCase();
    
    const searchParams = new URLSearchParams({
      currency: 'jpy',
      origin: originCode,
      destination: destCode,
      show_to_affiliates: 'true',
      sorting: 'price',
      limit: '10',
    });
    
    if (params.departureDate) {
      searchParams.set('depart_date', params.departureDate);
    }
    if (params.returnDate) {
      searchParams.set('return_date', params.returnDate);
    }
    if (params.tripClass !== undefined) {
      searchParams.set('trip_class', params.tripClass.toString());
    }
    
    const response = await fetch(
      `${TRAVELPAYOUTS_API_BASE}/v2/prices/latest?${searchParams.toString()}`,
      {
        method: 'GET',
        headers: {
          'X-Access-Token': token,
        },
      }
    );
    
    if (!response.ok) {
      console.error('Travelpayouts API error:', response.status);
      return {
        success: false,
        error: `API error: ${response.status}`,
      };
    }
    
    const data = await response.json() as { success?: boolean; data?: any[] };
    
    if (!data.success || !data.data) {
      return {
        success: false,
        error: 'No price data returned',
      };
    }
    
    const prices: CachedPrice[] = data.data.map((item: any) => ({
      value: item.value,
      origin: item.origin,
      destination: item.destination,
      departureAt: item.depart_date,
      returnAt: item.return_date,
      airline: item.airline,
      flightNumber: item.flight_number?.toString() || '',
      transfers: item.number_of_changes || 0,
      expiresAt: item.expires_at,
      foundAt: item.found_at,
    }));
    
    const cheapestPrice = prices.length > 0 ? Math.min(...prices.map(p => p.value)) : undefined;
    
    return {
      success: true,
      prices,
      cheapestPrice,
    };
  } catch (error) {
    console.error('Travelpayouts getCachedPrices error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 人気の目的地を取得
 */
export async function getPopularDestinations(origin: string): Promise<string[]> {
  const token = getTravelpayoutsToken();
  if (!token) {
    return [];
  }
  
  try {
    const originCode = getAirportCode(origin) || origin.toUpperCase();
    
    const response = await fetch(
      `${TRAVELPAYOUTS_API_BASE}/v1/city-directions?origin=${originCode}&currency=jpy`,
      {
        method: 'GET',
        headers: {
          'X-Access-Token': token,
        },
      }
    );
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json() as { success?: boolean; data?: Record<string, any> };
    
    if (!data.success || !data.data) {
      return [];
    }
    
    return Object.keys(data.data).slice(0, 10);
  } catch (error) {
    console.error('getPopularDestinations error:', error);
    return [];
  }
}

/**
 * Aviasalesアフィリエイトリンク生成
 */
export function generateAviasalesAffiliateLink(params: TravelpayoutsParams): string {
  const marker = getTravelpayoutsMarker();
  const originCode = getAirportCode(params.origin) || params.origin.toUpperCase();
  const destCode = getAirportCode(params.destination) || params.destination.toUpperCase();
  
  const depDate = params.departureDate.replace(/-/g, '');
  
  let url = `https://www.aviasales.com/search/${originCode}${depDate}${destCode}`;
  
  if (params.returnDate) {
    const retDate = params.returnDate.replace(/-/g, '');
    url += retDate;
  }
  
  url += `${params.adults || 1}`;
  
  if (marker) {
    url += `?marker=${marker}`;
  }
  
  return url;
}

/**
 * Trip.com アフィリエイトリンク生成
 */
export function generateTripComAffiliateLink(params: TravelpayoutsParams): string {
  const marker = getTravelpayoutsMarker();
  const originCode = getAirportCode(params.origin) || params.origin.toUpperCase();
  const destCode = getAirportCode(params.destination) || params.destination.toUpperCase();
  const adults = params.adults || 1;
  
  const tripType = params.returnDate ? 'rt' : 'ow';
  
  let url = `https://jp.trip.com/flights/${originCode.toLowerCase()}-to-${destCode.toLowerCase()}/tickets-${originCode.toLowerCase()}${destCode.toLowerCase()}`;
  url += `?dcity=${originCode}&acity=${destCode}&ddate=${params.departureDate}`;
  
  if (params.returnDate) {
    url += `&rdate=${params.returnDate}`;
  }
  
  url += `&flighttype=${tripType}&adult=${adults}&child=0&infant=0&class=y&lowpricesource=searchform`;
  
  if (marker) {
    url += `&allianceid=3838582&sid=${marker}`;
  }
  
  return url;
}

/**
 * Travelpayouts APIが利用可能かチェック
 */
export function isTravelpayoutsAvailable(): boolean {
  return !!getTravelpayoutsToken();
}
