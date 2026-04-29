/**
 * Puppeteerベースのスクレイパー
 * 
 * JavaScriptが必要なサイトの価格を取得
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { FlightSearchParams, ScrapedFlightResult, normalizeAirportCode } from './base-scraper.js';

// ブラウザインスタンスの再利用
let browserInstance: Browser | null = null;

// 結果キャッシュ（同じ検索を繰り返さない）
const resultCache = new Map<string, { result: ScrapedFlightResult; timestamp: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30分

/**
 * キャッシュキーを生成
 */
function getCacheKey(source: string, params: FlightSearchParams): string {
  return `${source}:${params.origin}:${params.destination}:${params.departureDate}:${params.returnDate || ''}:${params.adults}`;
}

/**
 * キャッシュから結果を取得
 */
function getFromCache(source: string, params: FlightSearchParams): ScrapedFlightResult | null {
  const key = getCacheKey(source, params);
  const cached = resultCache.get(key);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`📦 Cache hit: ${source}`);
    return cached.result;
  }
  
  return null;
}

/**
 * 結果をキャッシュに保存
 */
function saveToCache(source: string, params: FlightSearchParams, result: ScrapedFlightResult): void {
  const key = getCacheKey(source, params);
  resultCache.set(key, { result, timestamp: Date.now() });
}

/**
 * ブラウザインスタンスを取得（再利用）
 */
async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }
  
  console.log('🚀 Launching browser...');
  
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
  
  browserInstance = await puppeteer.launch({
    headless: true,
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--single-process', // Renderの低メモリ環境向け
    ],
  });
  
  return browserInstance;
}

/**
 * ページを設定（Bot検出回避）
 */
async function setupPage(page: Page): Promise<void> {
  // User-Agent設定
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  
  // Viewport設定
  await page.setViewport({ width: 1920, height: 1080 });
  
  // WebDriver検出を回避
  await page.evaluateOnNewDocument(() => {
    // @ts-ignore - ブラウザコンテキストで実行
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    // @ts-ignore
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    // @ts-ignore
    Object.defineProperty(navigator, 'languages', { get: () => ['ja-JP', 'ja', 'en-US', 'en'] });
  });
}

/**
 * Google Flightsから価格を取得
 */
export async function scrapeGoogleFlights(params: FlightSearchParams): Promise<ScrapedFlightResult> {
  const cached = getFromCache('GoogleFlights', params);
  if (cached) return cached;
  
  const origin = normalizeAirportCode(params.origin);
  const destination = normalizeAirportCode(params.destination);
  
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    
    await setupPage(page);
    
    // Google Flights検索URL
    const depDate = params.departureDate;
    const retDate = params.returnDate || '';
    const adults = params.adults || 1;
    
    const searchUrl = `https://www.google.com/travel/flights?q=Flights%20to%20${destination}%20from%20${origin}%20on%20${depDate}${retDate ? `%20return%20${retDate}` : ''}`;
    
    console.log(`🔍 Google Flights: ${origin} → ${destination}`);
    
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // 価格が表示されるまで待機
    await page.waitForSelector('[data-price]', { timeout: 15000 }).catch(() => null);
    
    // 少し待機してJSが完全に読み込まれるのを待つ
    await new Promise(r => setTimeout(r, 3000));
    
    // 価格を取得
    const priceData = await page.evaluate((): number | null => {
      // 複数のセレクターを試す
      const selectors = [
        '[data-price]',
        '[aria-label*="円"]',
        '.gws-flights-results__price',
        '.YMlIz',
      ];
      
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const text = el.textContent || el.getAttribute('data-price') || '';
          const match = text.replace(/,/g, '').match(/(\d{4,})/);
          if (match) {
            return parseInt(match[1]);
          }
        }
      }
      
      // aria-labelから価格を探す
      const allElements = document.querySelectorAll('[aria-label]');
      for (const el of allElements) {
        const label = el.getAttribute('aria-label') || '';
        if (label.includes('円')) {
          const match = label.replace(/,/g, '').match(/(\d{4,})/);
          if (match) {
            return parseInt(match[1]);
          }
        }
      }
      
      return null;
    });
    
    await page.close();
    
    if (priceData && priceData > 0) {
      const result: ScrapedFlightResult = {
        success: true,
        source: 'Google Flights',
        price: priceData,
        priceFormatted: `¥${priceData.toLocaleString()}`,
        currency: 'JPY',
        deepLink: searchUrl,
      };
      
      console.log(`✅ Google Flights: ¥${priceData.toLocaleString()}`);
      saveToCache('GoogleFlights', params, result);
      return result;
    }
    
    return {
      success: false,
      source: 'Google Flights',
      error: 'Price not found',
    };
    
  } catch (error) {
    console.error('❌ Google Flights error:', error instanceof Error ? error.message : error);
    return {
      success: false,
      source: 'Google Flights',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Skyscannerから価格を取得
 */
export async function scrapeSkyscanner(params: FlightSearchParams): Promise<ScrapedFlightResult> {
  const cached = getFromCache('Skyscanner', params);
  if (cached) return cached;
  
  const origin = normalizeAirportCode(params.origin);
  const destination = normalizeAirportCode(params.destination);
  
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    
    await setupPage(page);
    
    const depDate = params.departureDate.replace(/-/g, '');
    const retDate = params.returnDate?.replace(/-/g, '') || '';
    const adults = params.adults || 1;
    
    // Skyscanner検索URL
    const tripType = retDate ? '' : '/one-way';
    const searchUrl = retDate
      ? `https://www.skyscanner.jp/transport/flights/${origin.toLowerCase()}/${destination.toLowerCase()}/${depDate}/${retDate}/?adults=${adults}&adultsv2=${adults}&cabinclass=economy&children=0&childrenv2=&inboundaltsen498dd=false&infants=0&outboundaltsenabled=false&preferdirects=false&ref=home&rtn=1`
      : `https://www.skyscanner.jp/transport/flights/${origin.toLowerCase()}/${destination.toLowerCase()}/${depDate}/?adults=${adults}&adultsv2=${adults}&cabinclass=economy&children=0&childrenv2=&infants=0&outboundaltsenabled=false&preferdirects=false&ref=home&rtn=0`;
    
    console.log(`🔍 Skyscanner: ${origin} → ${destination}`);
    
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // 価格が表示されるまで待機
    await new Promise(r => setTimeout(r, 5000));
    
    // 価格を取得
    const priceData = await page.evaluate((): number | null => {
      const selectors = [
        '[class*="Price"]',
        '[class*="price"]',
        '[data-testid*="price"]',
      ];
      
      let minPrice = Infinity;
      
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const text = el.textContent || '';
          const match = text.replace(/,/g, '').match(/(\d{4,})/);
          if (match) {
            const price = parseInt(match[1]);
            if (price > 1000 && price < minPrice) {
              minPrice = price;
            }
          }
        }
      }
      
      return minPrice < Infinity ? minPrice : null;
    });
    
    await page.close();
    
    if (priceData && priceData > 0) {
      const result: ScrapedFlightResult = {
        success: true,
        source: 'Skyscanner',
        price: priceData,
        priceFormatted: `¥${priceData.toLocaleString()}`,
        currency: 'JPY',
        deepLink: searchUrl,
      };
      
      console.log(`✅ Skyscanner: ¥${priceData.toLocaleString()}`);
      saveToCache('Skyscanner', params, result);
      return result;
    }
    
    return {
      success: false,
      source: 'Skyscanner',
      error: 'Price not found',
    };
    
  } catch (error) {
    console.error('❌ Skyscanner error:', error instanceof Error ? error.message : error);
    return {
      success: false,
      source: 'Skyscanner',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * ブラウザを閉じる（クリーンアップ用）
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

/**
 * Puppeteerで全サイトをスクレイピング
 */
export async function scrapeSitesWithPuppeteer(params: FlightSearchParams): Promise<ScrapedFlightResult[]> {
  const results: ScrapedFlightResult[] = [];
  
  // 順番に実行（メモリ節約のため並列ではない）
  const scrapers = [
    scrapeGoogleFlights,
    scrapeSkyscanner,
  ];
  
  for (const scraper of scrapers) {
    try {
      const result = await scraper(params);
      results.push(result);
    } catch (error) {
      console.error('Scraper error:', error);
    }
  }
  
  return results;
}
