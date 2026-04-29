/**
 * 航空券価格スクレイピング統合モジュール
 * 
 * 複数サイトから価格を取得し、最安値を返す
 * 
 * 対応サイト:
 * - Google Flights（Puppeteer）
 * - Skyscanner（Puppeteer）
 * - Aviasales API
 */

import { FlightSearchParams, ScrapedFlightResult, normalizeAirportCode } from './base-scraper.js';
import { generateSkyticketUrl } from './skyticket-scraper.js';
import { generateTripComUrl } from './trip-com-scraper.js';
import { generateTravelkoUrl } from './travelko-scraper.js';
import { generateAirtripUrl } from './airtrip-scraper.js';
import { searchAviasales, isAviasalesApiAvailable } from '../aviasales-api.js';
import { scrapeSitesWithPuppeteer } from './puppeteer-scraper.js';

export interface MultiSourceResult {
  success: boolean;
  cheapest?: {
    source: string;
    price: number;
    priceFormatted: string;
    deepLink: string;
  };
  allResults: ScrapedFlightResult[];
  sourcesChecked: string[];
  errors: string[];
}

// タイムアウト設定
const SCRAPE_TIMEOUT_MS = 12000;

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
 * 全サイトから価格を取得し、最安値を返す
 */
export async function scrapeAllSites(params: FlightSearchParams): Promise<MultiSourceResult> {
  const allResults: ScrapedFlightResult[] = [];
  const sourcesChecked: string[] = [];
  const errors: string[] = [];
  
  console.log('🔍 Starting multi-site price scraping...');
  console.log(`   Route: ${params.origin} → ${params.destination}`);
  console.log(`   Date: ${params.departureDate}${params.returnDate ? ` - ${params.returnDate}` : ''}`);
  
  // === Puppeteerでスクレイピング（Google Flights, Skyscanner）===
  try {
    console.log('🌐 Starting Puppeteer scraping...');
    const puppeteerResults = await withTimeout(
      scrapeSitesWithPuppeteer(params),
      60000, // 60秒タイムアウト
      []
    );
    
    for (const result of puppeteerResults) {
      sourcesChecked.push(result.source);
      allResults.push(result);
      
      if (!result.success && result.error) {
        errors.push(`${result.source}: ${result.error}`);
      }
    }
  } catch (error) {
    console.error('Puppeteer scraping error:', error);
    errors.push(`Puppeteer: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  // === Aviasales API ===
  if (isAviasalesApiAvailable()) {
    sourcesChecked.push('Aviasales');
    
    try {
      const result = await withTimeout(
        searchAviasales({
          origin: normalizeAirportCode(params.origin),
          destination: normalizeAirportCode(params.destination),
          departureDate: params.departureDate,
          returnDate: params.returnDate,
        }),
        SCRAPE_TIMEOUT_MS,
        { success: false, error: 'Timeout' }
      );
      
      if (result.success && result.price) {
        allResults.push({
          success: true,
          source: 'Aviasales',
          price: result.price,
          priceFormatted: result.priceFormatted || `¥${result.price.toLocaleString()}`,
          currency: 'JPY',
          deepLink: result.deepLink || '',
        });
        console.log(`✅ Aviasales: ¥${result.price.toLocaleString()}`);
      } else {
        errors.push(`Aviasales: ${result.error || 'No price found'}`);
        allResults.push({
          success: false,
          source: 'Aviasales',
          error: result.error || 'No price found',
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Aviasales: ${errorMsg}`);
    }
  }
  
  // 成功した結果のみフィルタリング
  const successfulResults = allResults.filter(r => r.success && r.price && r.price > 0);
  
  // 最安値を見つける
  let cheapest: MultiSourceResult['cheapest'] | undefined;
  
  if (successfulResults.length > 0) {
    successfulResults.sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
    const best = successfulResults[0];
    
    cheapest = {
      source: best.source,
      price: best.price!,
      priceFormatted: best.priceFormatted || `¥${best.price!.toLocaleString()}`,
      deepLink: best.deepLink || '',
    };
    
    console.log(`\n🏆 Cheapest: ${cheapest.source} - ${cheapest.priceFormatted}`);
  } else {
    console.log('\n⚠️ No prices found from any source');
  }
  
  // 結果サマリーを出力
  console.log(`\n📊 Results summary:`);
  console.log(`   Sources checked: ${sourcesChecked.length}`);
  console.log(`   Successful: ${successfulResults.length}`);
  console.log(`   Failed: ${allResults.length - successfulResults.length}`);
  
  return {
    success: !!cheapest,
    cheapest,
    allResults,
    sourcesChecked,
    errors,
  };
}

/**
 * 各サイトのディープリンクを生成
 */
export function generateAllDeepLinks(params: FlightSearchParams): Record<string, string> {
  return {
    skyticket: generateSkyticketUrl(params),
    tripCom: generateTripComUrl(params),
    travelko: generateTravelkoUrl(params),
    airtrip: generateAirtripUrl(params),
  };
}

export { FlightSearchParams, ScrapedFlightResult, normalizeAirportCode };
