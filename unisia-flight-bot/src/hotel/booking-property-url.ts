/**
 * Booking.com プロパティURLの組み立て。
 *
 * 注意: `https://www.booking.com/hotel/index.ja.html?hotel_id=...` は 301 で
 * クエリがすべて落ち、トップの検索画面（日本語ロケールでは「パリ」既定など）に飛ぶため使わない。
 */

export interface BookingStayQuerySource {
  checkIn: string;
  checkOut: string;
  adults: number;
  rooms: number;
  children: number;
}

/** www / m サブドメインの正規プロパティページ（/hotel/{cc}/{slug}.html） */
export const BOOKING_PROPERTY_PAGE_RE =
  /https:\/\/(?:www|m)\.booking\.com\/hotel\/[a-z]{2}\/[^?\s"'<>#]+\.html/i;

export function normalizeToWwwBookingUrl(url: string): string {
  return url.replace(/^https:\/\/m\.booking\.com/i, 'https://www.booking.com');
}

/**
 * APIレスポンスJSONからプロパティページURLを探索（フィールド名がバージョンで変わりうるため走査）
 */
export function extractBookingPropertyPageUrl(payload: unknown): string | null {
  const candidates = new Set<string>();
  walkStrings(payload, (s) => {
    const m = s.match(BOOKING_PROPERTY_PAGE_RE);
    if (m) candidates.add(normalizeToWwwBookingUrl(m[0]));
  }, 0);
  if (candidates.size === 0) return null;
  return [...candidates].sort((a, b) => b.length - a.length)[0];
}

export function parseBookingPropertyUrl(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const m = raw.match(BOOKING_PROPERTY_PAGE_RE);
  if (!m) return null;
  return normalizeToWwwBookingUrl(m[0]);
}

/** `/hotel/ca/...` → `ca`。URLが無い・不正なときは null */
export function extractBookingHotelCountryCode(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const m = raw.match(/booking\.com\/hotel\/([a-z]{2})\//i);
  return m ? m[1].toLowerCase() : null;
}

/** 過去 `#hotelTmpl` で利用。プロパティ先頭オープン優先のためデフォルトでは付けない */
export const BOOKING_ROOM_RATES_HASH = 'hotelTmpl';

export interface MergeStayIntoPropertyOptions {
  /**
   * ページ上部ミニ検索に渡す地名（Bookingが無視することもある）。
   * 画像のような「ホテル个体ページの先頭＋検索バー」を狙うときに設定。
   */
  searchContext?: string;
}

/**
 * プロパティ**個別ホテル**のページを開く（写真・評価・ヘッダー検索バーが付くトップ）。
 * - `www.booking.com` のまま（モバイルでもアドレスバーが www になりやすい／画像のUIに近い）
 * - ハッシュは付けない（#hotelTmpl は料金表へ飛ばし、トップの物件ページとずれるため）
 */
export function mergeStayParamsOntoPropertyPage(
  propertyPageUrl: string,
  stay: BookingStayQuerySource,
  opts?: MergeStayIntoPropertyOptions,
): string {
  const u = new URL(normalizeToWwwBookingUrl(propertyPageUrl));
  u.hash = '';
  const qs = new URLSearchParams({
    checkin: stay.checkIn,
    checkout: stay.checkOut,
    group_adults: stay.adults.toString(),
    no_rooms: stay.rooms.toString(),
    group_children: stay.children.toString(),
    selected_currency: 'JPY',
    lang: 'ja',
  });
  const ctx = opts?.searchContext?.trim();
  if (ctx) qs.set('ss', ctx);
  qs.forEach((value, key) => u.searchParams.set(key, value));
  return u.toString();
}

/**
 * プロパティURLが解決できないときのフォールバック（検索結果）
 */
export interface BookingSearchDestHint {
  dest_id: string;
  search_type: string;
}

/** LINE用: Booking側はURLだけでは「並び替え：最安」を確定できない旨の短文 */
export const BOOKING_PRICE_SORT_HINT_LINE =
  '💡 一覧が開いたら「並び替え」または「並べ替え」から「料金・価格の安い順」を選ぶと、この条件の宿が安い順に並びます。';

/** 単体ホテルのプロパティURLか（一覧 searchresults と区別） */
export function isBookingPropertyPageHref(href: string): boolean {
  try {
    const { hostname, pathname } = new URL(href);
    if (!/^www\.booking\.com$/i.test(hostname) && !/^m\.booking\.com$/i.test(hostname)) return false;
    const m = /^\/hotel\/([a-z]{2})\/.+\.html$/i.exec(pathname);
    return !!(m && !pathname.includes('/hotel/index'));
  } catch {
    return (
      BOOKING_PROPERTY_PAGE_RE.test(href) && !/\/hotel\/index\.[^/]+\.html/i.test(href)
    );
  }
}

function buildJaSearchResultsUrl(
  ss: string | undefined,
  stay: BookingStayQuerySource,
  dest?: BookingSearchDestHint,
): string {
  const qs = new URLSearchParams({
    checkin: stay.checkIn,
    checkout: stay.checkOut,
    group_adults: stay.adults.toString(),
    no_rooms: stay.rooms.toString(),
    group_children: stay.children.toString(),
    selected_currency: 'JPY',
    lang: 'ja',
  });
  const t = ss?.trim();
  if (t) qs.set('ss', t);
  if (dest?.dest_id) {
    qs.set('dest_id', dest.dest_id);
    qs.set('dest_type', (dest.search_type || 'city').toLowerCase());
  }
  return `https://www.booking.com/searchresults.ja.html?${qs.toString()}`;
}

/**
 * **地域のみ** の検索一覧（ホテル名を ss に混ぜない）。最安順はユーザーがBooking上で並び替える前提。
 */
export function buildBookingRegionalListUrl(
  regionSearchText: string,
  stay: BookingStayQuerySource,
  dest?: BookingSearchDestHint,
): string {
  const t = regionSearchText.trim();
  return buildJaSearchResultsUrl(t || undefined, stay, dest);
}

/**
 * フォールバック検索。「カナダ」等は ss + RapidAPI が返した dest で地域がブレにくい
 */
export function buildBookingSearchFallbackUrl(
  hotelName: string,
  userLocation: string,
  stay: BookingStayQuerySource,
  dest?: BookingSearchDestHint,
): string {
  const ss = [userLocation.trim(), hotelName.trim()].filter(Boolean).join(' ').trim();
  return buildJaSearchResultsUrl(ss || undefined, stay, dest);
}

function walkStrings(node: unknown, fn: (s: string) => void, depth: number): void {
  if (depth > 24) return;
  if (typeof node === 'string') {
    fn(node);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) walkStrings(item, fn, depth + 1);
    return;
  }
  if (node && typeof node === 'object') {
    for (const v of Object.values(node)) walkStrings(v, fn, depth + 1);
  }
}
