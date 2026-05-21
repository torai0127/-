/**
 * 回帰チェック: hotel/index + hotel_id の壊れたパターンを再導入しない
 *
 *   npx tsx src/scripts/verify-booking-deep-link.ts
 */
import assert from 'node:assert/strict';

import {
  buildBookingRegionalListUrl,
  buildBookingSearchFallbackUrl,
  extractBookingHotelCountryCode,
  extractBookingPropertyPageUrl,
  isBookingPropertyPageHref,
  mergeStayParamsOntoPropertyPage,
  parseBookingPropertyUrl,
} from '../hotel/booking-property-url.js';

const stay = {
  checkIn: '2026-05-25',
  checkOut: '2026-05-28',
  adults: 1,
  rooms: 1,
  children: 0,
};

const merged = mergeStayParamsOntoPropertyPage(
  'https://www.booking.com/hotel/ca/samesun-vancouver-hostel.ja.html',
  stay,
  { searchContext: 'Vancouver' },
);
assert(merged.includes('checkin=2026-05-25'), 'checkin should be preserved');
assert(merged.includes('lang=ja'), 'lang=ja should be set');
assert(merged.startsWith('https://www.booking.com/'), 'property page on www');
assert(!merged.includes('#'), 'stay at property overview (no anchor to rate table)');
assert.equal(new URL(merged).searchParams.get('ss'), 'Vancouver', 'prefill mini search destination');
assert(!merged.includes('hotel/index'), 'must use property page path');

const fallback = buildBookingSearchFallbackUrl('Tatak Test', 'フィリピン', stay);
assert(fallback.includes('searchresults.ja.html'), 'fallback is search');
assert(fallback.startsWith('https://www.booking.com/'), 'www search fallback');
assert(fallback.includes('lang=ja'), 'lang on fallback');
const ssDecoded = new URL(fallback).searchParams.get('ss');
assert(ssDecoded?.includes('Tatak') && ssDecoded?.includes('フィリピン'), 'ss merges location + hotel');

const fallbackDest = buildBookingSearchFallbackUrl('Test', 'カナダ', stay, {
  dest_id: '999',
  search_type: 'COUNTRY',
});
assert(fallbackDest.includes('dest_id=999'));
assert(fallbackDest.includes('dest_type=country'));

assert.equal(extractBookingHotelCountryCode('https://www.booking.com/hotel/jp/foo.ja.html'), 'jp');
assert.equal(extractBookingHotelCountryCode('https://example.com/a'), null);

assert.equal(isBookingPropertyPageHref('https://www.booking.com/hotel/ca/foo.ja.html?x=1'), true);
assert.equal(isBookingPropertyPageHref('https://www.booking.com/searchresults.ja.html?ss=Tokyo'), false);
assert.equal(isBookingPropertyPageHref('https://www.booking.com/hotel/index.ja.html?hotel_id=1'), false);

const regional = buildBookingRegionalListUrl('Vancouver', stay, { dest_id: '42', search_type: 'city' });
assert(regional.includes('searchresults.ja.html'));
assert.equal(new URL(regional).searchParams.get('ss'), 'Vancouver');
assert(regional.includes('dest_id=42'));
const narrowed = buildBookingSearchFallbackUrl('Samesun', 'Vancouver', stay, {
  dest_id: '42',
  search_type: 'city',
});
assert.ok(
  new URL(narrowed).searchParams.get('ss')!.includes('Samesun'),
  'fallback ss includes hotel name',
);

const fromNested = extractBookingPropertyPageUrl({
  x: { deep: 'see https://www.booking.com/hotel/ph/foo.ja.html please' },
});
assert.equal(fromNested, 'https://www.booking.com/hotel/ph/foo.ja.html');

assert.equal(
  parseBookingPropertyUrl('https://m.booking.com/hotel/ph/bar.ja.html?x=1'),
  'https://www.booking.com/hotel/ph/bar.ja.html',
);

// 禁止パターン（本番で 301 されクエリが消える）
const broken = 'https://www.booking.com/hotel/index.ja.html?hotel_id=1&checkin=2026-01-01';
assert.equal(parseBookingPropertyUrl(broken), null);

console.log('verify-booking-deep-link: OK');
