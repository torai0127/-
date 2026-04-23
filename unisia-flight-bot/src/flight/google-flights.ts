/**
 * Google Flights URL生成
 *
 * tfs= パラメータ (Protocol Buffers + Base64) を生成して
 * 検索結果ページに直接遷移できるURLを作成
 */

export interface FlightSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  /** 互換: 大人のみとみなす人数（adults/children 未指定時） */
  passengers?: number;
  adults?: number;
  children?: number;
  infantsOnLap?: number;
  cabinClass?: 'economy' | 'premium_economy' | 'business' | 'first';
  tripType?: 'round_trip' | 'one_way';
}

/** 曖昧な日付（期間指定）での検索用パラメータ */
export interface FlexibleDateSearchParams {
  origin: string;
  destination: string;
  departureDateStart: string;  // 期間の開始日
  departureDateEnd: string;    // 期間の終了日
  stayDuration?: number;       // 滞在日数
  adults?: number;
  children?: number;
  infantsOnLap?: number;
  cabinClass?: 'economy' | 'premium_economy' | 'business' | 'first';
  tripType?: 'round_trip' | 'one_way';
}

const AIRPORT_CODES: Record<string, string> = {
  // 日本
  成田: 'NRT',
  羽田: 'HND',
  東京: 'NRT',
  関空: 'KIX',
  関西: 'KIX',
  関西空港: 'KIX',
  大阪: 'KIX',
  伊丹: 'ITM',
  福岡: 'FUK',
  福岡空港: 'FUK',
  中部: 'NGO',
  セントレア: 'NGO',
  名古屋: 'NGO',
  新千歳: 'CTS',
  札幌: 'CTS',
  那覇: 'OKA',
  沖縄: 'OKA',
  仙台: 'SDJ',
  広島: 'HIJ',
  熊本: 'KMJ',
  長崎: 'NGS',
  鹿児島: 'KOJ',
  松山: 'MYJ',
  高松: 'TAK',
  宮崎: 'KMI',
  石垣: 'ISG',
  宮古: 'MMY',
  小松: 'KMQ',
  岡山: 'OKJ',
  高知: 'KCZ',
  北九州: 'KKJ',
  神戸: 'UKB',
  富山: 'TOY',
  新潟: 'KIJ',
  静岡: 'FSZ',
  茨城: 'IBR',
  
  // 韓国
  ソウル: 'ICN',
  仁川: 'ICN',
  金浦: 'GMP',
  釜山: 'PUS',
  済州: 'CJU',
  
  // 台湾
  台北: 'TPE',
  桃園: 'TPE',
  松山空港: 'TSA',
  高雄: 'KHH',
  
  // 中国
  北京: 'PEK',
  上海: 'PVG',
  香港: 'HKG',
  マカオ: 'MFM',
  広州: 'CAN',
  深圳: 'SZX',
  
  // 東南アジア
  バンコク: 'BKK',
  プーケット: 'HKT',
  チェンマイ: 'CNX',
  ホーチミン: 'SGN',
  ハノイ: 'HAN',
  ダナン: 'DAD',
  シンガポール: 'SIN',
  クアラルンプール: 'KUL',
  マニラ: 'MNL',
  セブ: 'CEB',
  バリ: 'DPS',
  ジャカルタ: 'CGK',
  ヤンゴン: 'RGN',
  プノンペン: 'PNH',
  シェムリアップ: 'REP',
  アンコールワット: 'REP',
  ビエンチャン: 'VTE',
  ルアンパバーン: 'LPQ',
  
  // インド・南アジア
  デリー: 'DEL',
  ムンバイ: 'BOM',
  コロンボ: 'CMB',
  スリランカ: 'CMB',
  モルディブ: 'MLE',
  マレ: 'MLE',
  カトマンズ: 'KTM',
  ネパール: 'KTM',
  
  // オセアニア
  シドニー: 'SYD',
  メルボルン: 'MEL',
  ブリスベン: 'BNE',
  ケアンズ: 'CNS',
  ゴールドコースト: 'OOL',
  パース: 'PER',
  オークランド: 'AKL',
  クイーンズタウン: 'ZQN',
  フィジー: 'NAN',
  ナンディ: 'NAN',
  タヒチ: 'PPT',
  ニューカレドニア: 'NOU',
  
  // ハワイ・グアム
  ホノルル: 'HNL',
  ハワイ: 'HNL',
  マウイ: 'OGG',
  コナ: 'KOA',
  カウアイ: 'LIH',
  グアム: 'GUM',
  サイパン: 'SPN',
  パラオ: 'ROR',
  
  // 北米
  ロサンゼルス: 'LAX',
  サンフランシスコ: 'SFO',
  ニューヨーク: 'JFK',
  シカゴ: 'ORD',
  シアトル: 'SEA',
  ダラス: 'DFW',
  マイアミ: 'MIA',
  アトランタ: 'ATL',
  ボストン: 'BOS',
  ラスベガス: 'LAS',
  デンバー: 'DEN',
  ワシントン: 'IAD',
  サンディエゴ: 'SAN',
  ポートランド: 'PDX',
  バンクーバー: 'YVR',
  トロント: 'YYZ',
  モントリオール: 'YUL',
  メキシコシティ: 'MEX',
  カンクン: 'CUN',
  
  // ヨーロッパ
  ロンドン: 'LHR',
  パリ: 'CDG',
  フランクフルト: 'FRA',
  ミュンヘン: 'MUC',
  アムステルダム: 'AMS',
  ローマ: 'FCO',
  ミラノ: 'MXP',
  バルセロナ: 'BCN',
  マドリード: 'MAD',
  リスボン: 'LIS',
  チューリッヒ: 'ZRH',
  ウィーン: 'VIE',
  プラハ: 'PRG',
  ブダペスト: 'BUD',
  アテネ: 'ATH',
  イスタンブール: 'IST',
  ヘルシンキ: 'HEL',
  コペンハーゲン: 'CPH',
  オスロ: 'OSL',
  ストックホルム: 'ARN',
  ダブリン: 'DUB',
  エディンバラ: 'EDI',
  ブリュッセル: 'BRU',
  モスクワ: 'SVO',
  
  // 中東
  ドバイ: 'DXB',
  アブダビ: 'AUH',
  ドーハ: 'DOH',
  カタール: 'DOH',
  
  // アフリカ
  カイロ: 'CAI',
  ヨハネスブルグ: 'JNB',
  ケープタウン: 'CPT',
  ナイロビ: 'NBO',
  モロッコ: 'CMN',
  
  // 南米
  サンパウロ: 'GRU',
  リオデジャネイロ: 'GIG',
  ブエノスアイレス: 'EZE',
  サンティアゴ: 'SCL',
  リマ: 'LIM',
  ボゴタ: 'BOG',
};

const DESTINATION_CODES: Record<string, string> = {
  // アジア
  韓国: 'ICN',
  台湾: 'TPE',
  タイ: 'BKK',
  ベトナム: 'SGN',
  シンガポール: 'SIN',
  マレーシア: 'KUL',
  インドネシア: 'DPS',
  フィリピン: 'MNL',
  香港: 'HKG',
  マカオ: 'MFM',
  中国: 'PEK',
  カンボジア: 'REP',
  ミャンマー: 'RGN',
  ラオス: 'VTE',
  インド: 'DEL',
  スリランカ: 'CMB',
  ネパール: 'KTM',
  モルディブ: 'MLE',
  
  // オセアニア
  オーストラリア: 'SYD',
  ニュージーランド: 'AKL',
  フィジー: 'NAN',
  タヒチ: 'PPT',
  ニューカレドニア: 'NOU',
  
  // 太平洋
  ハワイ: 'HNL',
  グアム: 'GUM',
  サイパン: 'SPN',
  パラオ: 'ROR',
  
  // 北米
  アメリカ: 'LAX',
  カナダ: 'YVR',
  メキシコ: 'MEX',
  
  // ヨーロッパ
  イギリス: 'LHR',
  フランス: 'CDG',
  ドイツ: 'FRA',
  イタリア: 'FCO',
  スペイン: 'MAD',
  ポルトガル: 'LIS',
  オランダ: 'AMS',
  ベルギー: 'BRU',
  スイス: 'ZRH',
  オーストリア: 'VIE',
  チェコ: 'PRG',
  ポーランド: 'WAW',
  ハンガリー: 'BUD',
  ギリシャ: 'ATH',
  トルコ: 'IST',
  フィンランド: 'HEL',
  スウェーデン: 'ARN',
  ノルウェー: 'OSL',
  デンマーク: 'CPH',
  アイルランド: 'DUB',
  ロシア: 'SVO',
  クロアチア: 'ZAG',
  
  // 中東
  UAE: 'DXB',
  アラブ首長国連邦: 'DXB',
  カタール: 'DOH',
  イスラエル: 'TLV',
  ヨルダン: 'AMM',
  
  // アフリカ
  エジプト: 'CAI',
  南アフリカ: 'JNB',
  モロッコ: 'CMN',
  ケニア: 'NBO',
  エチオピア: 'ADD',
  タンザニア: 'DAR',
  
  // 南米
  ブラジル: 'GRU',
  アルゼンチン: 'EZE',
  チリ: 'SCL',
  ペルー: 'LIM',
  コロンビア: 'BOG',
};

/** IATA → Google検索クエリ用の都市名（英語） */
const CITY_ENGLISH_BY_IATA: Record<string, string> = {
  FUK: 'Fukuoka',
  NRT: 'Tokyo',
  HND: 'Tokyo',
  KIX: 'Osaka',
  NGO: 'Nagoya',
  CTS: 'Sapporo',
  OKA: 'Okinawa',
  MNL: 'Manila',
  CEB: 'Cebu',
  BKK: 'Bangkok',
  DMK: 'Bangkok',
  ICN: 'Seoul',
  TPE: 'Taipei',
  SIN: 'Singapore',
  HNL: 'Honolulu',
  GUM: 'Guam',
  SPN: 'Saipan',
  LAX: 'Los Angeles',
  JFK: 'New York',
  LHR: 'London',
  CDG: 'Paris',
  SYD: 'Sydney',
};

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** Google Place ID (都市用) - tfs エンコードに使用 */
const GOOGLE_PLACE_IDS: Record<string, string> = {
  // 主要空港のみPlace IDを使用（マイナー空港は空港コードを直接使用）
  // 日本（主要空港のみ）
  TYO: '/m/07dfk',  // 東京（都市コード）
  NRT: '/m/07dfk',
  HND: '/m/07dfk',
  OSA: '/m/0d04z6', // 大阪（都市コード）
  KIX: '/m/0d04z6',
  ITM: '/m/0d04z6', // 伊丹
  FUK: '/m/0dttf',  // 福岡
  NGO: '/m/0hrpk',  // 名古屋
  CTS: '/m/01_d4',  // 札幌
  OKA: '/m/0k3ll',  // 沖縄/那覇
  // 以下の地方空港はPlace IDを使用せず、空港コードを直接使用
  // KMJ, NGS, KOJ, MYJ, TAK, KMI, ISG, MMY, SDJ, HIJ など
  
  // 韓国
  ICN: '/m/0hsqf',  // ソウル/仁川
  GMP: '/m/0hsqf',  // 金浦
  SEL: '/m/0hsqf',  // ソウル（都市）
  PUS: '/m/0fvxz',  // 釜山
  CJU: '/m/0160w',  // 済州
  
  // 台湾
  TPE: '/m/0ftkx',  // 台北/桃園
  TSA: '/m/0ftkx',  // 松山（台北）
  KHH: '/m/01b1jj', // 高雄
  
  // 中国
  PEK: '/m/01914',  // 北京
  PKX: '/m/01914',  // 北京大興
  PVG: '/m/06wjf',  // 上海/浦東
  SHA: '/m/06wjf',  // 上海虹橋
  HKG: '/m/03h64',  // 香港
  MFM: '/m/04bpx',  // マカオ
  CAN: '/m/01lfy',  // 広州
  SZX: '/m/01lm7p', // 深圳
  
  // 東南アジア
  BKK: '/m/0fnb4',  // バンコク/スワンナプーム
  DMK: '/m/0fnb4',  // ドンムアン
  SGN: '/m/0hn4h',  // ホーチミン
  HAN: '/m/0fnff',  // ハノイ
  DAD: '/m/027kp3', // ダナン
  SIN: '/m/06t2t',  // シンガポール
  KUL: '/m/04lh6',  // クアラルンプール
  MNL: '/m/0195pd', // マニラ
  CEB: '/m/01pfc7', // セブ
  DPS: '/m/026r8v', // バリ/デンパサール
  CGK: '/m/04f5n',  // ジャカルタ
  RGN: '/m/0fnc4',  // ヤンゴン
  PNH: '/m/0fndx',  // プノンペン
  REP: '/m/0fv9n',  // シェムリアップ
  VTE: '/m/0195q8', // ビエンチャン
  
  // インド・南アジア
  DEL: '/m/09f07',  // デリー
  BOM: '/m/04vmp',  // ムンバイ
  CMB: '/m/0fn7r',  // コロンボ
  MLE: '/m/04ty3',  // モルディブ/マレ
  KTM: '/m/04cx5',  // カトマンズ
  
  // オセアニア
  SYD: '/m/06y57',  // シドニー
  MEL: '/m/0chgzm', // メルボルン
  BNE: '/m/01m3b1', // ブリスベン
  AKL: '/m/0cjcr',  // オークランド
  CNS: '/m/01p74k', // ケアンズ
  NAN: '/m/0h3lt',  // フィジー/ナンディ
  PPT: '/m/05p7t',  // タヒチ
  
  // ハワイ・グアム・サイパン
  HNL: '/m/02hrh0', // ホノルル
  OGG: '/m/010016', // マウイ
  KOA: '/m/0rfyq',  // コナ
  LIH: '/m/0s5cg',  // カウアイ
  GUM: '/m/034m4',  // グアム
  SPN: '/m/01gr7x', // サイパン
  
  // 北米
  LAX: '/m/030qb3t',// ロサンゼルス
  SFO: '/m/0d6lp',  // サンフランシスコ
  JFK: '/m/02_286', // ニューヨーク
  EWR: '/m/02_286', // ニューアーク
  LGA: '/m/02_286', // ラガーディア
  ORD: '/m/01_d4l', // シカゴ
  SEA: '/m/0d9jr',  // シアトル
  DFW: '/m/0f2tj',  // ダラス
  MIA: '/m/0f2v0',  // マイアミ
  ATL: '/m/013yq',  // アトランタ
  BOS: '/m/01cx_',  // ボストン
  LAS: '/m/0cv3w',  // ラスベガス
  DEN: '/m/02cl1',  // デンバー
  IAD: '/m/0rh6k',  // ワシントンD.C.
  YVR: '/m/080h2',  // バンクーバー
  YYZ: '/m/0h7h6',  // トロント
  YUL: '/m/052p7',  // モントリオール
  MEX: '/m/0fwwg',  // メキシコシティ
  CUN: '/m/01p2m2', // カンクン
  
  // ヨーロッパ
  LHR: '/m/04jpl',  // ロンドン/ヒースロー
  LGW: '/m/04jpl',  // ガトウィック
  STN: '/m/04jpl',  // スタンステッド
  CDG: '/m/05qtj',  // パリ/シャルル・ド・ゴール
  ORY: '/m/05qtj',  // オルリー
  FRA: '/m/02j9z',  // フランクフルト
  MUC: '/m/02h6_6p',// ミュンヘン
  AMS: '/m/0k3p',   // アムステルダム
  FCO: '/m/06c62',  // ローマ
  MXP: '/m/04sqj',  // ミラノ
  BCN: '/m/01f62',  // バルセロナ
  MAD: '/m/056_y',  // マドリード
  LIS: '/m/04llb',  // リスボン
  ZRH: '/m/08966',  // チューリッヒ
  VIE: '/m/0fhzf',  // ウィーン
  PRG: '/m/05ywg',  // プラハ
  BUD: '/m/09blyk', // ブダペスト
  ATH: '/m/0n2z',   // アテネ
  IST: '/m/09949m', // イスタンブール
  DXB: '/m/0h7x',   // ドバイ
  DOH: '/m/0195g3', // ドーハ
  HEL: '/m/03hrz',  // ヘルシンキ
  CPH: '/m/01lfy',  // コペンハーゲン
  OSL: '/m/05l64',  // オスロ
  ARN: '/m/06np0',  // ストックホルム
  DUB: '/m/02cft',  // ダブリン
  EDI: '/m/02m77',  // エディンバラ
  
  // 中東・アフリカ
  CAI: '/m/01w2v',  // カイロ
  JNB: '/m/0j7nk',  // ヨハネスブルグ
  CPT: '/m/01yj2',  // ケープタウン
  NBO: '/m/05d49', // ナイロビ
  ADD: '/m/0dttg',  // アディスアベバ
  
  // 南米
  GRU: '/m/06dt8',  // サンパウロ
  GIG: '/m/0h1k6',  // リオデジャネイロ
  EZE: '/m/0130v',  // ブエノスアイレス
  SCL: '/m/0fvyg',  // サンティアゴ
  LIM: '/m/04sjm',  // リマ
  BOG: '/m/01ync',  // ボゴタ
};

// ============================================================
// Protocol Buffers エンコード（tfs パラメータ生成用）
// ============================================================

function writeVarint(value: number): number[] {
  const bytes: number[] = [];
  while (value > 0x7f) {
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  bytes.push(value);
  return bytes;
}

function writeString(fieldNumber: number, str: string): number[] {
  const encoded = new TextEncoder().encode(str);
  const tag = (fieldNumber << 3) | 2; // wire type 2 = length-delimited
  return [...writeVarint(tag), ...writeVarint(encoded.length), ...encoded];
}

function writeInt(fieldNumber: number, value: number): number[] {
  const tag = (fieldNumber << 3) | 0; // wire type 0 = varint
  return [...writeVarint(tag), ...writeVarint(value)];
}

function writeMessage(fieldNumber: number, content: number[]): number[] {
  const tag = (fieldNumber << 3) | 2;
  return [...writeVarint(tag), ...writeVarint(content.length), ...content];
}

interface FlightLeg {
  date: string;           // YYYY-MM-DD
  originCode?: string;    // 空港コード (出発が空港の場合)
  originPlaceId?: string; // Google Place ID (出発が都市の場合)
  destCode?: string;      // 空港コード (到着が空港の場合)
  destPlaceId?: string;   // Google Place ID (到着が都市の場合)
}

function encodeLeg(leg: FlightLeg): number[] {
  const bytes: number[] = [];
  
  // field 2: 日付
  bytes.push(...writeString(2, leg.date));
  
  // field 13: 出発地
  if (leg.originPlaceId) {
    // 都市ID (field 2 = type, field 2 = place ID)
    const originMsg = [...writeInt(2, 2), ...writeString(2, leg.originPlaceId)];
    bytes.push(...writeMessage(13, originMsg));
  } else if (leg.originCode) {
    // 空港コード (field 2 = type, field 3 = airport code)
    const originMsg = [...writeInt(2, 1), ...writeString(3, leg.originCode)];
    bytes.push(...writeMessage(13, originMsg));
  }
  
  // field 14: 到着地
  if (leg.destPlaceId) {
    const destMsg = [...writeInt(2, 2), ...writeString(2, leg.destPlaceId)];
    bytes.push(...writeMessage(14, destMsg));
  } else if (leg.destCode) {
    const destMsg = [...writeInt(2, 1), ...writeString(3, leg.destCode)];
    bytes.push(...writeMessage(14, destMsg));
  }
  
  return bytes;
}

function getPlaceIdOrCode(code: string): { placeId?: string; airportCode?: string } {
  const placeId = GOOGLE_PLACE_IDS[code];
  if (placeId) {
    return { placeId };
  }
  return { airportCode: code };
}

/**
 * tfs パラメータを生成（Protocol Buffers + Base64）
 */
export function generateTfsParam(params: FlightSearchParams): string {
  const originCode = getAirportCode(params.origin) || params.origin.toUpperCase();
  const destCode = getAirportCode(params.destination) || params.destination.toUpperCase();
  const { adults, children, infantsOnLap } = resolvePassengers(params);
  
  const originInfo = getPlaceIdOrCode(originCode);
  const destInfo = getPlaceIdOrCode(destCode);
  
  const bytes: number[] = [];
  
  // field 1: 0x1c (28) - 不明だが固定値
  bytes.push(...writeInt(1, 28));
  
  // field 2: trip type (2 = 往復, 1 = 片道)
  const isRoundTrip = params.returnDate && params.tripType !== 'one_way';
  bytes.push(...writeInt(2, isRoundTrip ? 2 : 1));
  
  // field 3: 往路
  const outboundLeg: FlightLeg = {
    date: params.departureDate,
    originPlaceId: originInfo.placeId,
    originCode: originInfo.airportCode,
    destPlaceId: destInfo.placeId,
    destCode: destInfo.airportCode,
  };
  bytes.push(...writeMessage(3, encodeLeg(outboundLeg)));
  
  // field 3: 復路（往復の場合）
  if (isRoundTrip && params.returnDate) {
    const returnLeg: FlightLeg = {
      date: params.returnDate,
      originPlaceId: destInfo.placeId,
      originCode: destInfo.airportCode,
      destPlaceId: originInfo.placeId,
      destCode: originInfo.airportCode,
    };
    bytes.push(...writeMessage(3, encodeLeg(returnLeg)));
  }
  
  // field 8: 1 (固定)
  bytes.push(...writeInt(8, 1));
  
  // field 9: 1 (固定)
  bytes.push(...writeInt(9, 1));
  
  // field 14: 1 (固定)
  bytes.push(...writeInt(14, 1));
  
  // field 16: 乗客情報
  const passengerBytes: number[] = [];
  // 大人
  for (let i = 0; i < adults; i++) {
    passengerBytes.push(...writeInt(1, 1)); // 1 = adult
  }
  // 子供
  for (let i = 0; i < children; i++) {
    passengerBytes.push(...writeInt(1, 2)); // 2 = child
  }
  // 幼児（膝上）
  for (let i = 0; i < infantsOnLap; i++) {
    passengerBytes.push(...writeInt(1, 4)); // 4 = infant on lap
  }
  bytes.push(...writeMessage(16, passengerBytes));
  
  // field 19: 1 (固定)
  bytes.push(...writeInt(19, 1));
  
  // Base64 エンコード (URL safe)
  const base64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  return base64;
}

/**
 * Google Flights 検索結果ページURL（tfs パラメータ使用）
 * 検索結果が直接表示される
 */
export function generateGoogleFlightsSearchUrl(params: FlightSearchParams): string {
  const tfs = generateTfsParam(params);
  return `https://www.google.com/travel/flights/search?tfs=${tfs}&hl=ja&curr=JPY`;
}

// ============================================================
// 柔軟な日付検索（期間内の最安値を探す）
// ============================================================

const MONTH_NAMES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 
                         'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * 期間を説明する英語フレーズを生成
 * 例: "in May 2026", "in late May 2026", "from May 20 to May 31 2026"
 */
function buildDateRangePhrase(startDate: string, endDate: string): string {
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  
  if (!startYear || !startMonth || !startDay) return '';
  if (!endYear || !endMonth || !endDay) return '';
  
  const monthName = MONTH_NAMES_EN[startMonth - 1];
  
  // 同じ月の場合
  if (startYear === endYear && startMonth === endMonth) {
    // 月全体（1〜5日から25日以降）
    if (startDay <= 5 && endDay >= 25) {
      return `in ${monthName} ${startYear}`;
    }
    // 上旬（1〜5日から15日以下）
    if (startDay <= 5 && endDay <= 15) {
      return `in early ${monthName} ${startYear}`;
    }
    // 下旬（16日以降から月末）
    if (startDay >= 16 && endDay >= 25) {
      return `in late ${monthName} ${startYear}`;
    }
    // 中旬（10〜20日あたり）
    if (startDay >= 10 && startDay <= 15 && endDay >= 15 && endDay <= 25) {
      return `in mid ${monthName} ${startYear}`;
    }
    // その他の期間
    return `from ${monthName} ${startDay} to ${endDay} ${startYear}`;
  }
  
  // 月をまたぐ場合
  const endMonthName = MONTH_NAMES_EN[endMonth - 1];
  if (startYear === endYear) {
    return `from ${monthName} ${startDay} to ${endMonthName} ${endDay} ${startYear}`;
  }
  return `from ${monthName} ${startDay} ${startYear} to ${endMonthName} ${endDay} ${endYear}`;
}

/**
 * 柔軟な日付検索URL（期間内の最安値を探す）
 * 日付グリッドが表示され、最安値の日程が一目でわかる
 */
export function generateFlexibleDateSearchUrl(params: FlexibleDateSearchParams): string {
  const originCode = getAirportCode(params.origin) || params.origin.toUpperCase();
  const destCode = getAirportCode(params.destination) || params.destination.toUpperCase();
  const originCity = resolveCityEnglish(originCode);
  const destCity = resolveCityEnglish(destCode);
  
  const adults = params.adults || 1;
  const children = params.children || 0;
  const infantsOnLap = params.infantsOnLap || 0;
  
  const datePhrase = buildDateRangePhrase(params.departureDateStart, params.departureDateEnd);
  
  // 滞在期間の表現
  let stayPhrase = '';
  if (params.stayDuration) {
    if (params.stayDuration <= 7) {
      stayPhrase = ` for ${params.stayDuration} days`;
    } else if (params.stayDuration <= 14) {
      stayPhrase = ` for ${Math.round(params.stayDuration / 7)} weeks`;
    } else {
      stayPhrase = ` for ${Math.round(params.stayDuration / 30)} months`;
    }
  }
  
  // 人数表現
  const paxParts: string[] = [];
  if (adults > 0) paxParts.push(`${adults} adult${adults > 1 ? 's' : ''}`);
  if (children > 0) paxParts.push(`${children} child${children > 1 ? 'ren' : ''}`);
  if (infantsOnLap > 0) paxParts.push(`${infantsOnLap} infant${infantsOnLap > 1 ? 's' : ''}`);
  const paxStr = paxParts.join(' ');
  
  // 往復/片道
  const tripPhrase = params.tripType === 'one_way' ? 'One way' : 'Round trip';
  
  const q = `${tripPhrase} flights from ${originCity} (${originCode}) to ${destCity} (${destCode}) ${datePhrase}${stayPhrase}. ${paxStr}`;
  
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}&curr=JPY&hl=ja`;
}

/**
 * 期間の説明文を生成（日本語）
 */
export function formatFlexibleDateDescription(params: FlexibleDateSearchParams): string {
  const { origin, destination, departureDateStart, departureDateEnd, stayDuration } = params;
  const adults = params.adults || 1;
  const children = params.children || 0;
  const infantsOnLap = params.infantsOnLap || 0;
  
  const cabinNames: Record<string, string> = {
    economy: 'エコノミー',
    premium_economy: 'プレミアムエコノミー',
    business: 'ビジネス',
    first: 'ファースト',
  };
  
  let desc = `📍 ${origin} → ${destination}\n`;
  desc += `📅 出発期間: ${departureDateStart} 〜 ${departureDateEnd}\n`;
  if (stayDuration) {
    desc += `🗓️ 滞在期間: 約${stayDuration}日間\n`;
  }
  desc += `👤 ${buildPassengerEnglishClause(adults, children, infantsOnLap)}\n`;
  desc += `💺 ${cabinNames[params.cabinClass || 'economy'] || 'エコノミー'}`;
  return desc;
}

/**
 * 地名・空港名からIATAコードを取得
 */
export function getAirportCode(input: string): string | null {
  const normalized = input.trim();

  if (/^[A-Z]{3}$/i.test(normalized)) {
    return normalized.toUpperCase();
  }

  return AIRPORT_CODES[normalized] || DESTINATION_CODES[normalized] || null;
}

function resolveCityEnglish(iata: string): string {
  return CITY_ENGLISH_BY_IATA[iata] || iata;
}

/** YYYY-MM-DD → Jun 28, 2026（Google Flights の q= に近い形式） */
export function formatDateEnglishLong(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const mon = MONTHS_EN[m - 1] ?? 'Jan';
  return `${mon} ${d}, ${y}`;
}

function resolvePassengers(p: FlightSearchParams): { adults: number; children: number; infantsOnLap: number } {
  if (p.adults != null || p.children != null || p.infantsOnLap != null) {
    return {
      adults: Math.max(1, p.adults ?? 1),
      children: Math.max(0, p.children ?? 0),
      infantsOnLap: Math.max(0, p.infantsOnLap ?? 0),
    };
  }
  const n = Math.max(1, p.passengers ?? 1);
  return { adults: n, children: 0, infantsOnLap: 0 };
}

/** 「2 adults 1 child」形式（Google が解釈しやすい英語クエリ） */
export function buildPassengerEnglishClause(adults: number, children: number, infantsOnLap: number): string {
  const parts: string[] = [];
  if (adults === 1) parts.push('1 adult');
  else parts.push(`${adults} adults`);
  if (children === 1) parts.push('1 child');
  else if (children > 1) parts.push(`${children} children`);
  if (infantsOnLap === 1) parts.push('1 infant on lap');
  else if (infantsOnLap > 1) parts.push(`${infantsOnLap} infants on lap`);
  return parts.join(', ');
}

/**
 * Google Flights の q= 自然言語クエリ形式URL
 * 条件が検索フォームに自動入力される確実な方法
 */
export function generateGoogleFlightsQueryUrl(params: FlightSearchParams): string {
  const originCode = getAirportCode(params.origin) || params.origin.toUpperCase();
  const destCode = getAirportCode(params.destination) || params.destination.toUpperCase();
  const { adults, children, infantsOnLap } = resolvePassengers(params);

  // 人数表現
  const paxParts: string[] = [];
  if (adults > 0) paxParts.push(`${adults} adults`);
  if (children > 0) paxParts.push(`${children} children`);
  if (infantsOnLap > 0) paxParts.push(`${infantsOnLap} infants`);
  const paxStr = paxParts.join(' ');

  let q: string;
  if (params.returnDate && params.tripType !== 'one_way') {
    // 往復
    q = `Flights from ${originCode} to ${destCode} on ${params.departureDate} through ${params.returnDate} ${paxStr}`;
  } else {
    // 片道
    q = `Flights from ${originCode} to ${destCode} on ${params.departureDate} ${paxStr}`;
  }

  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}&curr=JPY&hl=ja`;
}

/**
 * Skyscanner URL（確実に条件が入る）
 * 形式: /transport/flights/出発/到着/日付/日付/?adults=X&children=Y
 */
export function generateSkyscannerUrl(params: FlightSearchParams): string {
  const originCode = getAirportCode(params.origin) || params.origin.toUpperCase();
  const destCode = getAirportCode(params.destination) || params.destination.toUpperCase();
  const { adults, children, infantsOnLap } = resolvePassengers(params);

  // 日付形式: YYMMDD
  const formatDate = (d: string) => d.replace(/-/g, '').slice(2); // 2026-06-28 -> 260628
  const dep = formatDate(params.departureDate);

  let url: string;
  if (params.returnDate && params.tripType !== 'one_way') {
    const ret = formatDate(params.returnDate);
    url = `https://www.skyscanner.jp/transport/flights/${originCode.toLowerCase()}/${destCode.toLowerCase()}/${dep}/${ret}/`;
  } else {
    url = `https://www.skyscanner.jp/transport/flights/${originCode.toLowerCase()}/${destCode.toLowerCase()}/${dep}/`;
  }

  const queryParams = new URLSearchParams({
    adults: adults.toString(),
    adultsv2: adults.toString(),
    children: children.toString(),
    infants: infantsOnLap.toString(),
    cabinclass: params.cabinClass || 'economy',
    rtn: params.returnDate && params.tripType !== 'one_way' ? '1' : '0',
  });

  // 子供の年齢（仮に8歳）
  if (children > 0) {
    const childAges = Array(children).fill('8').join('|');
    queryParams.set('childrenv2', childAges);
  }

  return `${url}?${queryParams.toString()}`;
}

/**
 * 往復・都市名付きの「探索」URL（自然文クエリ形式 - フォールバック用）
 */
export function generateGoogleFlightsExploreUrl(params: FlightSearchParams): string {
  const originCode = getAirportCode(params.origin) || params.origin.toUpperCase();
  const destCode = getAirportCode(params.destination) || params.destination.toUpperCase();
  const originCity = resolveCityEnglish(originCode);
  const destCity = resolveCityEnglish(destCode);
  const dep = formatDateEnglishLong(params.departureDate);
  const { adults, children, infantsOnLap } = resolvePassengers(params);

  let q: string;
  if (params.returnDate && (params.tripType !== 'one_way')) {
    const ret = formatDateEnglishLong(params.returnDate);
    const pax = buildPassengerEnglishClause(adults, children, infantsOnLap);
    q = `Round trip flights from ${originCity} (${originCode}) to ${destCity} (${destCode}) from ${dep} through ${ret}. ${pax}`;
  } else {
    const pax = buildPassengerEnglishClause(adults, children, infantsOnLap);
    q = `One way flights from ${originCity} (${originCode}) to ${destCity} (${destCode}) on ${dep}. ${pax}`;
  }

  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}&curr=JPY&hl=ja`;
}

/**
 * 互換用: 従来の短い q= 形式（シンプル検索）
 */
export function generateGoogleFlightsUrl(params: FlightSearchParams): string {
  const {
    origin,
    destination,
    departureDate,
    returnDate,
    tripType = returnDate ? 'round_trip' : 'one_way',
  } = params;

  const originCode = getAirportCode(origin) || origin;
  const destCode = getAirportCode(destination) || destination;

  return `https://www.google.com/travel/flights?q=Flights+from+${originCode}+to+${destCode}+on+${departureDate}${
    returnDate && tripType === 'round_trip' ? `+return+${returnDate}` : ''
  }&curr=JPY&hl=ja`;
}

/**
 * 推奨: 検索結果ページに直接遷移するURL（tfs パラメータ使用）
 * フライト一覧が表示された状態で開く
 */
export function generateGoogleFlightsPrePurchaseEntryUrl(params: FlightSearchParams): string {
  return generateGoogleFlightsSearchUrl(params);
}

/**
 * 検索条件の説明文を生成
 */
export function formatSearchDescription(params: FlightSearchParams): string {
  const {
    origin,
    destination,
    departureDate,
    returnDate,
    cabinClass = 'economy',
  } = params;
  const { adults, children, infantsOnLap } = resolvePassengers(params);

  const cabinNames: Record<string, string> = {
    economy: 'エコノミー',
    premium_economy: 'プレミアムエコノミー',
    business: 'ビジネス',
    first: 'ファースト',
  };

  let desc = `📍 ${origin} → ${destination}\n`;
  desc += `📅 出発: ${departureDate}\n`;
  if (returnDate) {
    desc += `📅 帰国: ${returnDate}\n`;
  }
  desc += `👤 ${buildPassengerEnglishClause(adults, children, infantsOnLap)}\n`;
  desc += `💺 ${cabinNames[cabinClass] || cabinClass}`;
  return desc;
}

export function getAvailableAirports(): { name: string; code: string }[] {
  return Object.entries(AIRPORT_CODES).map(([name, code]) => ({
    name,
    code,
  }));
}

export function getAvailableDestinations(): { name: string; code: string }[] {
  return Object.entries(DESTINATION_CODES).map(([name, code]) => ({
    name,
    code,
  }));
}
