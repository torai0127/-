/**
 * トラベルコ (Travelko) スクレイパー
 * 
 * 日本最大級の旅行比較サイト
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { 
  FlightSearchParams, 
  ScrapedFlightResult, 
  normalizeAirportCode,
  getRandomUserAgent,
  randomDelay,
} from './base-scraper.js';

const TRAVELKO_BASE_URL = 'https://www.tour.ne.jp';

export async function scrapeTravelko(params: FlightSearchParams): Promise<ScrapedFlightResult> {
  try {
    const origin = normalizeAirportCode(params.origin);
    const destination = normalizeAirportCode(params.destination);
    
    console.log(`🔍 Travelko: Searching ${origin} → ${destination}`);
    
    await randomDelay();
    
    const searchUrl = generateTravelkoUrl(params);
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en;q=0.9',
        'Referer': TRAVELKO_BASE_URL,
      },
      timeout: 15000,
    });
    
    const $ = cheerio.load(response.data);
    
    // 最安値を探す
    let foundPrice: number = 0;
    
    // 価格セレクターを試す
    const priceSelectors = [
      '.price',
      '.lowest-price',
      '.min-price',
      '.result-price',
      '[data-price]',
      '.fare-price',
    ];
    
    for (const selector of priceSelectors) {
      $(selector).each((_, el) => {
        const text = $(el).text().replace(/[^\d]/g, '');
        const parsed = parseInt(text);
        if (parsed > 1000 && parsed < 10000000) {
          if (foundPrice === 0 || parsed < foundPrice) {
            foundPrice = parsed;
          }
        }
      });
    }
    
    // data-priceからも取得
    $('[data-price]').each((_, el) => {
      const dataPrice = $(el).attr('data-price');
      if (dataPrice) {
        const parsed = parseInt(dataPrice.replace(/,/g, ''));
        if (!isNaN(parsed) && parsed > 1000) {
          if (foundPrice === 0 || parsed < foundPrice) {
            foundPrice = parsed;
          }
        }
      }
    });
    
    if (foundPrice > 0) {
      console.log(`✅ Travelko: ¥${foundPrice.toLocaleString()}`);
      return {
        success: true,
        source: 'Travelko',
        price: foundPrice,
        priceFormatted: `¥${foundPrice.toLocaleString()}`,
        currency: 'JPY',
        deepLink: searchUrl,
      };
    }
    
    return {
      success: false,
      source: 'Travelko',
      error: 'Price not found',
    };
    
  } catch (error) {
    console.error('❌ Travelko error:', error instanceof Error ? error.message : error);
    return {
      success: false,
      source: 'Travelko',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * トラベルコのディープリンクを生成
 */
export function generateTravelkoUrl(params: FlightSearchParams): string {
  const origin = normalizeAirportCode(params.origin);
  const destination = normalizeAirportCode(params.destination);
  const depDate = params.departureDate.replace(/-/g, '');
  const retDate = params.returnDate?.replace(/-/g, '') || '';
  const adults = params.adults || 1;
  
  const tripType = params.returnDate ? '1' : '0';
  
  return `${TRAVELKO_BASE_URL}/air/list/${origin}/${destination}/${depDate}/${retDate}/${adults}/0/0/${tripType}/0/`;
}
