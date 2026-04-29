/**
 * Trip.com スクレイパー
 * 
 * グローバルOTA - JSON APIエンドポイントを使用
 */

import axios from 'axios';
import { 
  FlightSearchParams, 
  ScrapedFlightResult, 
  normalizeAirportCode,
  getRandomUserAgent,
  randomDelay,
} from './base-scraper.js';

const TRIPCOM_API_URL = 'https://flights.ctrip.com/international/search/api/search/batchSearch';
const TRIPCOM_BASE_URL = 'https://jp.trip.com';

export async function scrapeTripCom(params: FlightSearchParams): Promise<ScrapedFlightResult> {
  try {
    const origin = normalizeAirportCode(params.origin);
    const destination = normalizeAirportCode(params.destination);
    
    console.log(`🔍 Trip.com: Searching ${origin} → ${destination}`);
    
    await randomDelay();
    
    // Trip.comの検索URLを生成
    const searchUrl = generateTripComUrl(params);
    
    // 直接ページをスクレイピング
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en;q=0.9',
        'Referer': TRIPCOM_BASE_URL,
      },
      timeout: 15000,
    });
    
    // ページ内のJSONデータを探す
    const html = response.data;
    
    // パターン1: window.__INITIAL_STATE__ からデータを抽出
    const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/);
    if (stateMatch) {
      try {
        const state = JSON.parse(stateMatch[1]);
        const flights = state?.flightList?.flights || state?.searchResult?.flights || [];
        
        if (flights.length > 0) {
          // 最安値を見つける
          let cheapest = Infinity;
          for (const flight of flights) {
            const price = flight.price?.totalPrice || flight.priceInfo?.price || flight.minPrice;
            if (price && price < cheapest) {
              cheapest = price;
            }
          }
          
          if (cheapest < Infinity) {
            console.log(`✅ Trip.com: ¥${cheapest.toLocaleString()}`);
            return {
              success: true,
              source: 'Trip.com',
              price: cheapest,
              priceFormatted: `¥${cheapest.toLocaleString()}`,
              currency: 'JPY',
              deepLink: searchUrl,
            };
          }
        }
      } catch (e) {
        // JSON解析エラー - 続行
      }
    }
    
    // パターン2: 価格パターンを正規表現で探す
    const priceMatches = html.match(/["']?(?:price|totalPrice|minPrice)["']?\s*:\s*(\d+)/gi);
    if (priceMatches && priceMatches.length > 0) {
      const prices: number[] = [];
      for (const match of priceMatches) {
        const numMatch = match.match(/(\d+)/);
        if (numMatch) {
          const price = parseInt(numMatch[1]);
          if (price > 1000 && price < 10000000) { // 合理的な価格範囲
            prices.push(price);
          }
        }
      }
      
      if (prices.length > 0) {
        const cheapest = Math.min(...prices);
        console.log(`✅ Trip.com: ¥${cheapest.toLocaleString()}`);
        return {
          success: true,
          source: 'Trip.com',
          price: cheapest,
          priceFormatted: `¥${cheapest.toLocaleString()}`,
          currency: 'JPY',
          deepLink: searchUrl,
        };
      }
    }
    
    return {
      success: false,
      source: 'Trip.com',
      error: 'Price not found',
    };
    
  } catch (error) {
    console.error('❌ Trip.com error:', error instanceof Error ? error.message : error);
    return {
      success: false,
      source: 'Trip.com',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Trip.comのディープリンクを生成
 */
export function generateTripComUrl(params: FlightSearchParams): string {
  const origin = normalizeAirportCode(params.origin);
  const destination = normalizeAirportCode(params.destination);
  const depDate = params.departureDate;
  const retDate = params.returnDate || '';
  const adults = params.adults || 1;
  const children = params.children || 0;
  
  const tripType = params.returnDate ? 'RT' : 'OW';
  
  if (tripType === 'RT') {
    return `${TRIPCOM_BASE_URL}/flights/${origin.toLowerCase()}-${destination.toLowerCase()}/tickets-${origin}${destination}?dcity=${origin}&acity=${destination}&ddate=${depDate}&rdate=${retDate}&adult=${adults}&child=${children}&class=Economy`;
  } else {
    return `${TRIPCOM_BASE_URL}/flights/${origin.toLowerCase()}-${destination.toLowerCase()}/tickets-${origin}${destination}?dcity=${origin}&acity=${destination}&ddate=${depDate}&adult=${adults}&child=${children}&class=Economy&triptype=OW`;
  }
}
