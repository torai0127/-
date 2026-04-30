import 'dotenv/config';
import { scrapeAllSites } from './dist/flight/scrapers/index.js';

async function main() {
  console.log('========================================');
  console.log('🧪 Flight Scraper Test');
  console.log('========================================\n');

  const result = await scrapeAllSites({
    origin: 'TYO',
    destination: 'YVR',  // バンクーバー
    departureDate: '2026-06-15',
    returnDate: '2026-06-22',
    adults: 2,
  });

  console.log('\n========================================');
  console.log('📊 Results Summary');
  console.log('========================================');
  console.log(`Sources checked: ${result.sourcesChecked.join(', ')}`);
  console.log(`Errors: ${result.errors.length}`);
  
  if (result.cheapest) {
    console.log(`\n🏆 CHEAPEST: ${result.cheapest.source}`);
    console.log(`   Price: ${result.cheapest.priceFormatted}`);
    console.log(`   Link: ${result.cheapest.deepLink.substring(0, 80)}...`);
  } else {
    console.log('\n❌ No prices found');
  }

  console.log('\n📋 All results:');
  for (const r of result.allResults) {
    if (r.success) {
      console.log(`   ✅ ${r.source}: ${r.priceFormatted}`);
    } else {
      console.log(`   ❌ ${r.source}: ${r.error}`);
    }
  }
}

main().catch(console.error);
