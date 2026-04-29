/**
 * エアトリ (Airtrip) スクレイパー
 * 
 * 日本のOTA
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

const AIRTRIP_BASE_URL = 'https://www.airtrip.jp';

export async function scrapeAirtrip(params: FlightSearchParams): Promise<ScrapedFlightResult> {
  try {
    const origin = normalizeAirportCode(params.origin);
    const destination = normalizeAirportCode(params.destination);
    
    console.log(`🔍 Airtrip: Searching ${origin} → ${destination}`);
    
    await randomDelay();
    
    const searchUrl = generateAirtripUrl(params);
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en;q=0.9',
        'Referer': AIRTRIP_BASE_URL,
      },
      timeout: 15000,
    });
    
    const $ = cheerio.load(response.data);
    
    let price: number | null = null;
    
    // 価格パターンを探す
    const priceSelectors = [
      '.price',
      '.fare',
      '.total-price',
      '.min-price',
      '[class*="price"]',
    ];
    
    for (const selector of priceSelectors) {
      $(selector).each((_, el) => {
        const text = $(el).text().replace(/[^\d]/g, '');
        const parsed = parseInt(text);
        if (parsed > 1000 && parsed < 10000000) {
          if (!price || parsed < price) {
            price = parsed;
          }
        }
      });
    }
    
    // ページ内のJSON/scriptから価格を探す
    if (!price) {
      const html = response.data;
      const priceMatches = html.match(/["']?price["']?\s*:\s*["']?(\d+)/gi);
      if (priceMatches) {
        for (const match of priceMatches) {
          const numMatch = match.match(/(\d+)/);
          if (numMatch) {
            const parsed = parseInt(numMatch[1]);
            if (parsed > 1000 && parsed < 10000000) {
              if (!price || parsed < price) {
                price = parsed;
              }
            }
          }
        }
      }
    }
    
    if (price) {
      console.log(`✅ Airtrip: ¥${price.toLocaleString()}`);
      return {
        success: true,
        source: 'Airtrip',
        price,
        priceFormatted: `¥${price.toLocaleString()}`,
        currency: 'JPY',
        deepLink: searchUrl,
      };
    }
    
    return {
      success: false,
      source: 'Airtrip',
      error: 'Price not found',
    };
    
  } catch (error) {
    console.error('❌ Airtrip error:', error instanceof Error ? error.message : error);
    return {
      success: false,
      source: 'Airtrip',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * エアトリのディープリンクを生成
 */
export function generateAirtripUrl(params: FlightSearchParams): string {
  const origin = normalizeAirportCode(params.origin);
  const destination = normalizeAirportCode(params.destination);
  const depDate = params.departureDate;
  const retDate = params.returnDate || '';
  const adults = params.adults || 1;
  
  const queryParams = new URLSearchParams({
    dep: origin,
    arr: destination,
    depdate: depDate,
    adult: adults.toString(),
  });
  
  if (retDate) {
    queryParams.set('retdate', retDate);
  }
  
  return `${AIRTRIP_BASE_URL}/intl/search?${queryParams.toString()}`;
}
