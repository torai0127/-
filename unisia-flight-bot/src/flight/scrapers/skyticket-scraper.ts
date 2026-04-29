/**
 * スカイチケット (Skyticket) スクレイパー
 * 
 * 日本の格安航空券予約サイト
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

const SKYTICKET_BASE_URL = 'https://skyticket.jp';

export async function scrapeSkyticket(params: FlightSearchParams): Promise<ScrapedFlightResult> {
  try {
    const origin = normalizeAirportCode(params.origin);
    const destination = normalizeAirportCode(params.destination);
    
    // URL生成
    const depDate = params.departureDate.replace(/-/g, '');
    const retDate = params.returnDate?.replace(/-/g, '') || '';
    
    const tripType = params.returnDate ? 'RT' : 'OW';
    const adults = params.adults || 1;
    
    // スカイチケットの検索URL
    const searchUrl = `${SKYTICKET_BASE_URL}/international/search/${origin}/${destination}/${depDate}/${retDate}/${tripType}/${adults}/0/0/Y`;
    
    console.log(`🔍 Skyticket: Searching ${origin} → ${destination}`);
    
    await randomDelay();
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en;q=0.9',
        'Referer': SKYTICKET_BASE_URL,
      },
      timeout: 15000,
    });
    
    const $ = cheerio.load(response.data);
    
    // 最安値を取得（複数のセレクターを試す）
    let price: number | null = null;
    let priceText = '';
    
    // パターン1: 検索結果の最安値
    const priceSelectors = [
      '.price-lowest',
      '.lowest-price',
      '.min-price',
      '[data-price]',
      '.flight-price',
      '.total-price',
    ];
    
    for (const selector of priceSelectors) {
      const element = $(selector).first();
      if (element.length) {
        priceText = element.text().trim();
        const match = priceText.replace(/,/g, '').match(/(\d+)/);
        if (match) {
          price = parseInt(match[1]);
          break;
        }
      }
    }
    
    // パターン2: data属性から価格を取得
    if (!price) {
      $('[data-price]').each((_, el) => {
        const dataPrice = $(el).attr('data-price');
        if (dataPrice) {
          const parsed = parseInt(dataPrice.replace(/,/g, ''));
          if (!isNaN(parsed) && parsed > 0) {
            if (!price || parsed < price) {
              price = parsed;
            }
          }
        }
      });
    }
    
    if (price && price > 0) {
      console.log(`✅ Skyticket: ¥${price.toLocaleString()}`);
      
      return {
        success: true,
        source: 'Skyticket',
        price,
        priceFormatted: `¥${price.toLocaleString()}`,
        currency: 'JPY',
        deepLink: searchUrl,
      };
    }
    
    return {
      success: false,
      source: 'Skyticket',
      error: 'Price not found in page',
    };
    
  } catch (error) {
    console.error('❌ Skyticket error:', error instanceof Error ? error.message : error);
    return {
      success: false,
      source: 'Skyticket',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * スカイチケットのディープリンクを生成
 */
export function generateSkyticketUrl(params: FlightSearchParams): string {
  const origin = normalizeAirportCode(params.origin);
  const destination = normalizeAirportCode(params.destination);
  const depDate = params.departureDate.replace(/-/g, '');
  const retDate = params.returnDate?.replace(/-/g, '') || '';
  const tripType = params.returnDate ? 'RT' : 'OW';
  const adults = params.adults || 1;
  
  return `${SKYTICKET_BASE_URL}/international/search/${origin}/${destination}/${depDate}/${retDate}/${tripType}/${adults}/0/0/Y`;
}
