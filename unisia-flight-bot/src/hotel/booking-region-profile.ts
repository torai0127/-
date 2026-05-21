/**
 * ユーザーの地域表記（日本語・英語）と Booking の dest ラベル / プロパティ URL 国コードを橋渡しする。
 * 「カナダ」が API 先頭の無関係エリアにマッチして東京のホテルになる事故を防ぐ。
 */

export interface RegionProfile {
  /** ユーザー入力と完全一致（trim）でマッチ。ASCII は小文字でも可 */
  exactNames: string[];
  /** dest の label / city / country に含まれる英語等（小文字で比較） */
  substrings: string[];
  /** Booking プロパティURLの /hotel/{cc}/ に期待する国コード */
  bookingCountryCodes: string[];
}

const PROFILES: RegionProfile[] = [
  { exactNames: ['カナダ', 'canada'], substrings: ['canada'], bookingCountryCodes: ['ca'] },
  { exactNames: ['アメリカ', '米国', 'アメリカ合衆国', 'usa', 'us', 'united states'], substrings: ['united states', 'u.s.', 'usa'], bookingCountryCodes: ['us'] },
  { exactNames: ['メキシコ', 'mexico'], substrings: ['mexico'], bookingCountryCodes: ['mx'] },
  { exactNames: ['フィリピン', 'philippines'], substrings: ['philippines', 'philippine'], bookingCountryCodes: ['ph'] },
  { exactNames: ['韓国', 'korea', 'south korea'], substrings: ['south korea', 'korea,'], bookingCountryCodes: ['kr'] },
  { exactNames: ['北朝鮮', 'north korea'], substrings: ['north korea'], bookingCountryCodes: ['kp'] },
  { exactNames: ['台湾', 'taiwan'], substrings: ['taiwan'], bookingCountryCodes: ['tw'] },
  { exactNames: ['タイ', 'thailand'], substrings: ['thailand'], bookingCountryCodes: ['th'] },
  { exactNames: ['ベトナム', 'vietnam'], substrings: ['vietnam'], bookingCountryCodes: ['vn'] },
  { exactNames: ['シンガポール', 'singapore'], substrings: ['singapore'], bookingCountryCodes: ['sg'] },
  { exactNames: ['マレーシア', 'malaysia'], substrings: ['malaysia'], bookingCountryCodes: ['my'] },
  { exactNames: ['インドネシア', 'indonesia'], substrings: ['indonesia'], bookingCountryCodes: ['id'] },
  { exactNames: ['インド', 'india'], substrings: ['india'], bookingCountryCodes: ['in'] },
  { exactNames: ['中国', 'china'], substrings: ['china'], bookingCountryCodes: ['cn'] },
  { exactNames: ['香港', 'hong kong', 'hongkong'], substrings: ['hong kong', 'hongkong'], bookingCountryCodes: ['hk'] },
  { exactNames: ['マカオ', 'macau', 'macao'], substrings: ['macau', 'macao'], bookingCountryCodes: ['mo'] },
  { exactNames: ['日本', 'japan'], substrings: ['japan'], bookingCountryCodes: ['jp'] },
  { exactNames: ['オーストラリア', 'australia'], substrings: ['australia'], bookingCountryCodes: ['au'] },
  { exactNames: ['ニュージーランド', 'new zealand'], substrings: ['new zealand'], bookingCountryCodes: ['nz'] },
  { exactNames: ['ハワイ', 'hawaii'], substrings: ['hawaii'], bookingCountryCodes: ['us'] },
  { exactNames: ['イギリス', '英国', 'uk', 'united kingdom', 'great britain', 'england'], substrings: ['united kingdom', 'england', 'scotland', 'wales', 'great britain'], bookingCountryCodes: ['gb'] },
  { exactNames: ['フランス', 'france'], substrings: ['france'], bookingCountryCodes: ['fr'] },
  { exactNames: ['パリ', 'paris'], substrings: ['paris', 'île-de-france', 'ile-de-france'], bookingCountryCodes: ['fr'] },
  { exactNames: ['イタリア', 'italy'], substrings: ['italy'], bookingCountryCodes: ['it'] },
  { exactNames: ['ドイツ', 'germany'], substrings: ['germany'], bookingCountryCodes: ['de'] },
  { exactNames: ['スペイン', 'spain'], substrings: ['spain'], bookingCountryCodes: ['es'] },
  { exactNames: ['ホンジュラス', 'honduras'], substrings: ['honduras'], bookingCountryCodes: ['hn'] },
  { exactNames: ['アルゼンチン', 'argentina'], substrings: ['argentina'], bookingCountryCodes: ['ar'] },
  { exactNames: ['ブラジル', 'brazil'], substrings: ['brazil'], bookingCountryCodes: ['br'] },
  { exactNames: ['チリ', 'chile'], substrings: ['chile'], bookingCountryCodes: ['cl'] },
  { exactNames: ['ペルー', 'peru'], substrings: ['peru'], bookingCountryCodes: ['pe'] },
  { exactNames: ['コロンビア', 'colombia'], substrings: ['colombia'], bookingCountryCodes: ['co'] },
  { exactNames: ['ポルトガル', 'portugal'], substrings: ['portugal'], bookingCountryCodes: ['pt'] },
  { exactNames: ['カンボジア', 'cambodia'], substrings: ['cambodia'], bookingCountryCodes: ['kh'] },
  { exactNames: ['ラオス', 'laos'], substrings: ['laos'], bookingCountryCodes: ['la'] },
  { exactNames: ['ミャンマー', 'myanmar', 'ビルマ'], substrings: ['myanmar'], bookingCountryCodes: ['mm'] },
  { exactNames: ['モルディブ', 'maldives'], substrings: ['maldives'], bookingCountryCodes: ['mv'] },
  { exactNames: ['トルコ', 'turkey', 'türkiye'], substrings: ['türkiye', 'turkey'], bookingCountryCodes: ['tr'] },
  { exactNames: ['エジプト', 'egypt'], substrings: ['egypt'], bookingCountryCodes: ['eg'] },
  { exactNames: ['モロッコ', 'morocco'], substrings: ['morocco'], bookingCountryCodes: ['ma'] },
  { exactNames: ['アラブ首長国連邦', 'uae', 'ドバイ', 'dubai'], substrings: ['united arab emirates', 'uae', 'dubai'], bookingCountryCodes: ['ae'] },
];

export function resolveRegionProfile(location: string): RegionProfile | null {
  const t = location.trim().normalize('NFKC');
  if (!t) return null;
  const lower = t.toLowerCase();

  for (const p of PROFILES) {
    for (const n of p.exactNames) {
      if (n === t) return p;
      if (/^[a-z0-9\s.\-]+$/i.test(n) && n.toLowerCase() === lower) return p;
    }
  }
  return null;
}

export function scoreDestinationAgainstProfile(
  dest: { label: string; city_name: string; country: string; search_type?: string },
  profile: RegionProfile | null,
  rawQuery: string,
): number {
  const label = (dest.label || '').toLowerCase();
  const city = (dest.city_name || '').toLowerCase();
  const country = (dest.country || '').toLowerCase();
  const qc = rawQuery.trim().normalize('NFKC');
  const qAscii = qc.toLocaleLowerCase('en-US');

  let score = 0;

  if (qc) {
    if (label === qAscii || city === qAscii || country === qAscii) score = Math.max(score, 100);
    else if (label.startsWith(qAscii + ',') || label.startsWith(qc + '（')) score = Math.max(score, 95);
    else if (label.includes(qAscii) || city.includes(qAscii) || country.includes(qAscii)) score = Math.max(score, 85);
  }

  if (profile) {
    for (const s of profile.substrings) {
      const sl = s.toLowerCase();
      if (country.includes(sl) || label.includes(sl) || city.includes(sl)) {
        score = Math.max(score, 88);
        break;
      }
    }
    const st = (dest.search_type || '').toUpperCase();
    if (st === 'REGION' || st === 'COUNTRY') score += 12;
  }

  return score;
}
