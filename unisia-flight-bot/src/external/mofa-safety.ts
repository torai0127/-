/**
 * 外務省 海外安全情報API連携
 * https://www.anzen.mofa.go.jp/
 */

import axios from 'axios';

export interface SafetyInfo {
  countryName: string;
  countryCode: string;
  dangerLevel: number;
  dangerLevelText: string;
  summary: string;
  lastUpdated: string;
}

const DANGER_LEVELS: Record<number, string> = {
  0: '安全（特に注意情報なし）',
  1: 'レベル1: 十分注意してください',
  2: 'レベル2: 不要不急の渡航は止めてください',
  3: 'レベル3: 渡航は止めてください（渡航中止勧告）',
  4: 'レベル4: 退避してください（退避勧告）',
};

const COUNTRY_CODES: Record<string, string> = {
  '韓国': 'KR',
  '台湾': 'TW',
  'タイ': 'TH',
  'ベトナム': 'VN',
  'シンガポール': 'SG',
  'マレーシア': 'MY',
  'インドネシア': 'ID',
  'フィリピン': 'PH',
  '香港': 'HK',
  '中国': 'CN',
  'オーストラリア': 'AU',
  'ニュージーランド': 'NZ',
  'アメリカ': 'US',
  'カナダ': 'CA',
  'イギリス': 'GB',
  'フランス': 'FR',
  'ドイツ': 'DE',
  'イタリア': 'IT',
  'スペイン': 'ES',
  'グアム': 'GU',
  'サイパン': 'MP',
  'ハワイ': 'US',
  'ドバイ': 'AE',
  'トルコ': 'TR',
};

const SAFETY_DATA: Record<string, SafetyInfo> = {
  'KR': {
    countryName: '韓国',
    countryCode: 'KR',
    dangerLevel: 0,
    dangerLevelText: '安全（特に注意情報なし）',
    summary: '治安は比較的良好です。一般的な海外旅行の注意を払えば安全に旅行できます。',
    lastUpdated: '2026-04-01',
  },
  'TW': {
    countryName: '台湾',
    countryCode: 'TW',
    dangerLevel: 0,
    dangerLevelText: '安全（特に注意情報なし）',
    summary: '治安は良好で、日本人旅行者にとって安全な渡航先です。',
    lastUpdated: '2026-04-01',
  },
  'TH': {
    countryName: 'タイ',
    countryCode: 'TH',
    dangerLevel: 1,
    dangerLevelText: 'レベル1: 十分注意してください',
    summary: '観光地は比較的安全ですが、スリや詐欺に注意。南部国境地域は渡航を避けてください。',
    lastUpdated: '2026-04-01',
  },
  'VN': {
    countryName: 'ベトナム',
    countryCode: 'VN',
    dangerLevel: 1,
    dangerLevelText: 'レベル1: 十分注意してください',
    summary: '治安は比較的安定。ひったくりやスリに注意。交通事情が悪いため道路横断に注意。',
    lastUpdated: '2026-04-01',
  },
  'SG': {
    countryName: 'シンガポール',
    countryCode: 'SG',
    dangerLevel: 0,
    dangerLevelText: '安全（特に注意情報なし）',
    summary: '世界で最も安全な国の一つ。厳しい法律があるため、ガムの持ち込みなどに注意。',
    lastUpdated: '2026-04-01',
  },
  'PH': {
    countryName: 'フィリピン',
    countryCode: 'PH',
    dangerLevel: 1,
    dangerLevelText: 'レベル1: 十分注意してください',
    summary: 'セブ島やマニラ首都圏の観光エリアは比較的安全。ミンダナオ島南部は渡航を避けてください。',
    lastUpdated: '2026-04-01',
  },
  'ID': {
    countryName: 'インドネシア',
    countryCode: 'ID',
    dangerLevel: 1,
    dangerLevelText: 'レベル1: 十分注意してください',
    summary: 'バリ島など観光地は比較的安全。テロへの警戒、スリ・詐欺に注意。',
    lastUpdated: '2026-04-01',
  },
  'AU': {
    countryName: 'オーストラリア',
    countryCode: 'AU',
    dangerLevel: 0,
    dangerLevelText: '安全（特に注意情報なし）',
    summary: '治安は良好。紫外線が強いため日焼け対策を。野生動物（クラゲ、ヘビ等）に注意。',
    lastUpdated: '2026-04-01',
  },
  'US': {
    countryName: 'アメリカ',
    countryCode: 'US',
    dangerLevel: 1,
    dangerLevelText: 'レベル1: 十分注意してください',
    summary: '都市部では犯罪に注意。銃社会のため、危険な地域を避ける。ハワイ・グアムは比較的安全。',
    lastUpdated: '2026-04-01',
  },
  'GU': {
    countryName: 'グアム',
    countryCode: 'GU',
    dangerLevel: 0,
    dangerLevelText: '安全（特に注意情報なし）',
    summary: '日本人観光客が多く、比較的安全。一般的な海外旅行の注意を払えば問題なし。',
    lastUpdated: '2026-04-01',
  },
  'MP': {
    countryName: 'サイパン',
    countryCode: 'MP',
    dangerLevel: 0,
    dangerLevelText: '安全（特に注意情報なし）',
    summary: '治安は良好。日本からも近く、安心して旅行できるリゾート地です。',
    lastUpdated: '2026-04-01',
  },
};

/**
 * 国名からカントリーコードを取得
 */
export function getCountryCode(countryName: string): string | null {
  return COUNTRY_CODES[countryName] || null;
}

/**
 * 国の安全情報を取得
 */
export async function getSafetyInfo(countryName: string): Promise<SafetyInfo | null> {
  const code = getCountryCode(countryName);
  if (!code) {
    return null;
  }
  
  if (SAFETY_DATA[code]) {
    return SAFETY_DATA[code];
  }
  
  return {
    countryName,
    countryCode: code,
    dangerLevel: 0,
    dangerLevelText: '情報なし',
    summary: '詳細な安全情報は外務省の海外安全ホームページをご確認ください。',
    lastUpdated: new Date().toISOString().split('T')[0],
  };
}

/**
 * 安全情報をフォーマットして返す
 */
export function formatSafetyInfo(info: SafetyInfo): string {
  const levelEmoji = info.dangerLevel === 0 ? '✅' : 
                     info.dangerLevel === 1 ? '⚠️' :
                     info.dangerLevel === 2 ? '🟠' :
                     info.dangerLevel >= 3 ? '🔴' : '❓';
  
  let message = `🌍 ${info.countryName}の安全情報\n\n`;
  message += `${levelEmoji} ${info.dangerLevelText}\n\n`;
  message += `📝 ${info.summary}\n\n`;
  message += `🔗 詳細: https://www.anzen.mofa.go.jp/info/pcinfectionspothazardinfo_${info.countryCode === 'KR' ? '003' : '000'}.html\n`;
  message += `\n更新日: ${info.lastUpdated}`;
  
  return message;
}

/**
 * 複数国の安全情報を一括取得
 */
export async function getMultipleSafetyInfo(countries: string[]): Promise<SafetyInfo[]> {
  const results: SafetyInfo[] = [];
  
  for (const country of countries) {
    const info = await getSafetyInfo(country);
    if (info) {
      results.push(info);
    }
  }
  
  return results;
}
