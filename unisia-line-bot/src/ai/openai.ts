import OpenAI from 'openai';
import { buildPromptWithHistory, FAQ_KNOWLEDGE } from './prompts.js';

if (!process.env.OPENAI_API_KEY) {
  console.warn('⚠️ OPENAI_API_KEY not configured - AI responses will be limited');
}

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// 海外関連のキーワード
const OVERSEAS_KEYWORDS = [
  '安全', '治安', 'ビザ', 'パスポート', '航空券', '保険',
  '持ち物', '準備', '両替', 'Wi-Fi', 'SIM', '空港',
  '入国', '出国', '時差', '気候', '天気', '物価',
  '言語', '英語', '観光', 'おすすめ', '旅行', '留学',
  'ワーホリ', '費用', '予算', '病院', '緊急', 'トラブル',
  '質問', '教えて', '知りたい', 'どう', '何',
];

// 各国の詳細な治安・旅行情報
const COUNTRY_SAFETY_INFO: Record<string, string> = {
  'アメリカ': `🇺🇸 アメリカの治安情報

【危険度】地域により差が大きい

【注意エリア】
・大都市のダウンタウン夜間
・治安の悪い地区（事前確認必須）
・観光地でのスリ・置き引き

【具体的な対策】
✅ 夜間の一人歩きは避ける
✅ 高価な物を見せびらかさない
✅ 車上荒らしに注意（車内に物を置かない）
✅ 銃犯罪のリスクあり（争いを避ける）

【緊急時】
・警察/救急: 911
・在米日本大使館: +1-202-238-6700

【ビザ】
ESTA（電子渡航認証）が必要
90日以内の観光なら取得可能
申請費用: $21（約3,000円）

【安心して楽しむコツ】
観光地や昼間の移動は基本的に安全です。事前に行く場所の治安を調べておけば問題ありません！`,

  'フィリピン': `🇵🇭 フィリピンの治安情報

【危険度】地域により注意が必要

【安全なエリア】
・セブ島のリゾートエリア
・マカティ（マニラのビジネス街）
・ボホール島、パラワン島

【注意エリア】
・マニラの一部地域（トンド等）
・ミンダナオ島の一部
・夜間のストリート

【具体的な対策】
✅ ジプニー（乗合バス）でのスリに注意
✅ 流しのタクシーは避ける（Grab推奨）
✅ 見知らぬ人からの飲食物は断る
✅ ATMは銀行内のものを使用

【緊急時】
・警察: 117
・在フィリピン日本大使館: +63-2-8551-5710

【ビザ】
30日以内の観光はビザ不要
延長も現地で可能

【Unisiaのおすすめ】
セブ島留学は治安も良く、コスパ最高！
多くの日本人が安全に留学しています✨`,

  '韓国': `🇰🇷 韓国の治安情報

【危険度】非常に安全

【特徴】
・日本と同程度の治安の良さ
・夜間でも比較的安全
・女性の一人旅も多い

【注意点】
✅ 梨泰院など繁華街での酔っ払いトラブル
✅ 観光地でのぼったくり（タクシー等）
✅ 地下鉄でのスリ（まれ）

【緊急時】
・警察: 112
・救急: 119
・在韓日本大使館: +82-2-2170-5200

【ビザ】
90日以内の観光はビザ不要
K-ETA（電子渡航認証）が必要

【安心ポイント】
日本語が通じる場所も多く、初めての海外旅行にもおすすめ！コンビニや交通機関も日本と似ていて安心です。`,

  'タイ': `🇹🇭 タイの治安情報

【危険度】観光地は比較的安全

【安全なエリア】
・バンコクの主要観光地
・プーケット、サムイ島のリゾート
・チェンマイ

【注意点】
✅ トゥクトゥクのぼったくり
✅ 宝石店詐欺（「今日だけ安い」に注意）
✅ スリ・置き引き（カオサン通り等）
✅ 見知らぬ人からの誘いは断る

【具体的な対策】
・Grabタクシーを使用
・貴重品は分散して持つ
・夜の繁華街は複数人で

【緊急時】
・ツーリストポリス: 1155
・在タイ日本大使館: +66-2-207-8500

【ビザ】
30日以内の観光はビザ不要

【おすすめ】
物価が安く、食事も美味しい！基本的な注意をすれば楽しい旅行ができます🍜`,

  '台湾': `🇹🇼 台湾の治安情報

【危険度】非常に安全（世界トップクラス）

【特徴】
・犯罪率が非常に低い
・夜市も夜遅くまで賑わい安全
・親日的で日本語が通じることも

【注意点】
✅ 観光地でのスリ（まれ）
✅ バイクが多いので交通事故に注意
✅ 夜市での食あたり（衛生面）

【緊急時】
・警察: 110
・救急: 119
・日本台湾交流協会: +886-2-2713-8000

【ビザ】
90日以内の観光はビザ不要

【安心ポイント】
日本人に大人気の旅行先！
初海外、女子旅、一人旅すべてにおすすめです✨
九份、夜市、小籠包など見どころ満載！`,

  'ハワイ': `🌺 ハワイの治安情報

【危険度】観光地は安全

【安全なエリア】
・ワイキキビーチ周辺
・アラモアナ
・主要リゾートホテル周辺

【注意エリア】
・ダウンタウン夜間
・カカアコ地区の一部
・ビーチでの置き引き

【具体的な対策】
✅ ビーチに貴重品を持っていかない
✅ レンタカーの車上荒らしに注意
✅ 高価な物を見せびらかさない

【緊急時】
・警察/救急: 911
・在ホノルル日本総領事館: +1-808-543-3111

【ビザ】
ESTA（電子渡航認証）が必要
$21（約3,000円）

【安心ポイント】
日本語対応のお店も多く、日本人観光客に慣れています。家族旅行、ハネムーンに最適！🏝️`,

  'グアム': `🏝️ グアムの治安情報

【危険度】比較的安全

【特徴】
・日本から約3.5時間と近い
・日本語が通じるお店が多い
・コンパクトで観光しやすい

【注意点】
✅ ビーチでの置き引き
✅ 夜間の一人歩き（タモン以外）
✅ 車上荒らし

【緊急時】
・警察/救急: 911
・在ハガッニャ日本総領事館: +1-671-646-1290

【ビザ】
45日以内はビザ不要（グアムビザ免除プログラム）
※ESTA不要

【安心ポイント】
短期間でも楽しめるリゾート！
家族旅行や初めての海外にぴったり。
免税ショッピングも魅力です🛍️`,

  'オーストラリア': `🇦🇺 オーストラリアの治安情報

【危険度】非常に安全

【特徴】
・先進国で治安は良好
・英語圏で過ごしやすい
・ワーホリ人気No.1

【注意点】
✅ 紫外線が非常に強い（日焼け対策必須）
✅ 海のクラゲ、サメに注意
✅ 野生動物との接触（ヘビ等）
✅ 都市部でのスリ（まれ）

【緊急時】
・警察/救急: 000
・在オーストラリア日本大使館: +61-2-6273-3244

【ビザ】
観光: ETA（電子渡航許可）$20
ワーホリ: Working Holiday Visa

【安心ポイント】
留学・ワーホリで長期滞在する日本人が多く、情報も豊富。治安の心配はほぼ不要！🦘`,

  'ベトナム': `🇻🇳 ベトナムの治安情報

【危険度】観光地は比較的安全

【注意点】
✅ バイクひったくり（最重要！）
  →バッグは道路と反対側に持つ
✅ タクシーぼったくり（Grab推奨）
✅ 観光地での押し売り
✅ 交通事故（バイクが非常に多い）

【具体的な対策】
・スマホは道端で使わない
・貴重品は首から下げるタイプを
・道路横断は現地の人と一緒に

【緊急時】
・警察: 113
・救急: 115
・在ベトナム日本大使館: +84-24-3846-3000

【ビザ】
15日以内の観光はビザ不要
※前回出国から30日以上経過が条件

【おすすめ】
物価が安く、食事が美味しい！
フォー、バインミーは絶品🍜`,

  'シンガポール': `🇸🇬 シンガポールの治安情報

【危険度】世界トップクラスに安全

【特徴】
・厳しい法律で犯罪率が極めて低い
・夜間でも安心して歩ける
・清潔で整備された都市

【注意点】
✅ ガムの持ち込み禁止
✅ 公共の場での飲食制限
✅ ゴミのポイ捨ては高額罰金
✅ 電子タバコ禁止

【緊急時】
・警察: 999
・救急: 995
・在シンガポール日本大使館: +65-6235-8855

【ビザ】
30日以内の観光はビザ不要

【安心ポイント】
治安の心配がほぼゼロ！
英語が通じ、多文化で食事も多彩。
初海外にも最適です✨`,
};

// 各国の総合旅行情報
const COUNTRY_TRAVEL_INFO: Record<string, {
  climate: string;
  price: string;
  wifi: string;
  food: string;
  culture: string;
  tips: string;
}> = {
  'アメリカ': {
    climate: `【気候】
・広大なため地域差が大きい
・西海岸（LA等）: 年中温暖
・東海岸（NY等）: 夏暑く冬寒い
・ハワイ: 年中常夏
・ベストシーズン: 4-6月、9-10月`,
    price: `【物価】
・日本より20-30%高い
・チップ文化あり（15-20%が目安）
・ファストフード: 約1,500円
・レストラン: 3,000-5,000円
・ホテル: 15,000-30,000円/泊`,
    wifi: `【Wi-Fi・通信】
・カフェ等で無料Wi-Fi普及
・SIM: T-Mobile、AT&T等
・eSIM: 10日5GB約2,000円〜
・Wi-Fiレンタル: 1日800円〜`,
    food: `【グルメ】
・ハンバーガー、ステーキが本場
・量が多い（シェア可）
・チップ必須（税抜の15-20%）
・タップウォーター（水道水）は無料
・ベジタリアン対応も豊富`,
    culture: `【文化・マナー】
・チップ文化（必須！）
・フレンドリーな接客が基本
・レディーファースト
・公共の場での飲酒禁止
・年齢確認厳格（ID必携）`,
    tips: `【旅のコツ】
・チップ用に1ドル札を多めに
・Uber/Lyftが便利
・国立公園パス($80)がお得
・アウトレットでブランド品を`,
  },

  'フィリピン': {
    climate: `【気候】
・熱帯性気候（年中暑い）
・乾季: 12-5月（ベストシーズン）
・雨季: 6-11月（スコールあり）
・平均気温: 26-32℃
・台風シーズン: 7-10月`,
    price: `【物価】
・日本の約1/3〜1/5
・ローカル食: 200-500円
・レストラン: 500-1,500円
・マッサージ: 500-1,000円/1h
・ホテル: 2,000-5,000円/泊`,
    wifi: `【Wi-Fi・通信】
・ショッピングモールでWi-Fiあり
・SIM: Globe、Smart（空港で購入）
・30日2GB: 約300円〜
・速度は日本より遅め`,
    food: `【グルメ】
・アドボ（肉の煮込み）
・シニガン（酸っぱいスープ）
・レチョン（豚の丸焼き）
・マンゴーが絶品！
・ジョリビー（現地ファストフード）`,
    culture: `【文化・マナー】
・フィリピーノホスピタリティ（親切）
・時間にルーズ（フィリピンタイム）
・宗教心が強い（カトリック）
・家族を大切にする文化
・チップは気持ち程度でOK`,
    tips: `【旅のコツ】
・Grabアプリ必須（タクシー配車）
・現金も多めに持つ（カード不可多い）
・セブなら英語留学がおすすめ
・アイランドホッピングを体験して！`,
  },

  '韓国': {
    climate: `【気候】
・日本と似ている（四季あり）
・春（3-5月）: 桜シーズン
・夏（6-8月）: 暑い・雨季
・秋（9-11月）: 紅葉ベストシーズン
・冬（12-2月）: 寒い（-10℃も）`,
    price: `【物価】
・日本とほぼ同じか少し安い
・屋台: 500-1,000円
・食堂: 800-1,500円
・焼肉: 2,000-4,000円
・ホテル: 5,000-15,000円/泊`,
    wifi: `【Wi-Fi・通信】
・カフェ等で無料Wi-Fi豊富
・SIM: KT、SK等（空港で）
・7日5GB: 約2,000円
・Wi-Fiレンタル: 1日500円〜`,
    food: `【グルメ】
・サムギョプサル（豚バラ焼肉）
・チキン（フライドチキン）
・ビビンバ、冷麺
・トッポギ（餅の甘辛炒め）
・カフェ文化が発達`,
    culture: `【文化・マナー】
・年上を敬う文化
・お酒は横を向いて飲む
・靴を脱ぐ店も多い
・チップ不要
・整形・美容への意識が高い`,
    tips: `【旅のコツ】
・T-moneyカード必須（交通系IC）
・深夜までお店が開いている
・美容・コスメがお得
・週末より平日がおすすめ`,
  },

  'タイ': {
    climate: `【気候】
・常夏（年中暑い）
・乾季: 11-2月（ベストシーズン）
・暑季: 3-5月（猛暑40℃近く）
・雨季: 6-10月（スコール）
・北部は朝晩涼しい`,
    price: `【物価】
・日本の約1/3
・屋台: 100-300円
・レストラン: 500-1,500円
・マッサージ: 500-1,500円/1h
・ホテル: 2,000-6,000円/泊`,
    wifi: `【Wi-Fi・通信】
・カフェ、ホテルでWi-Fiあり
・SIM: AIS、True（空港で）
・8日15GB: 約500円〜
・とにかく安い！`,
    food: `【グルメ】
・パッタイ（焼きそば）
・トムヤムクン
・グリーンカレー
・マンゴーもち米
・屋台で十分美味しい！`,
    culture: `【文化・マナー】
・仏教国（寺院では肌を隠す）
・王室への敬意は絶対
・頭を触らない（神聖な部位）
・足の裏を人に向けない
・チップは気持ち程度`,
    tips: `【旅のコツ】
・Grabアプリ必須
・値段交渉は笑顔で
・寺院用の羽織もの持参
・タイパンツをお土産に`,
  },

  '台湾': {
    climate: `【気候】
・亜熱帯（北部）/熱帯（南部）
・春（3-5月）: 温暖・雨少ない
・夏（6-9月）: 暑い・台風あり
・秋（10-11月）: ベストシーズン
・冬（12-2月）: 北部は肌寒い`,
    price: `【物価】
・日本の約2/3
・夜市: 200-500円
・レストラン: 500-1,500円
・タピオカ: 200-400円
・ホテル: 4,000-10,000円/泊`,
    wifi: `【Wi-Fi・通信】
・コンビニ等でWi-Fiあり
・SIM: 中華電信、台湾大哥大
・5日使い放題: 約1,500円
・空港カウンターで購入可`,
    food: `【グルメ】
・小籠包（鼎泰豐が有名）
・魯肉飯（ルーローファン）
・牛肉麺
・タピオカミルクティー
・夜市で食べ歩き！`,
    culture: `【文化・マナー】
・親日的でフレンドリー
・日本語が通じることも
・MRT内は飲食禁止
・チップ不要
・レシートは宝くじ付き`,
    tips: `【旅のコツ】
・悠遊カード必須（交通系IC）
・九份は平日午前がおすすめ
・夜市は夕方から
・茶藝館でお茶体験を`,
  },

  'ハワイ': {
    climate: `【気候】
・常夏（年中温暖）
・乾季: 4-10月（ベストシーズン）
・雨季: 11-3月（短時間の雨）
・平均気温: 24-30℃
・朝晩は涼しい`,
    price: `【物価】
・アメリカ本土より高い
・プレートランチ: 1,500円〜
・レストラン: 3,000-6,000円
・ABCストアで節約可
・ホテル: 20,000-50,000円/泊`,
    wifi: `【Wi-Fi・通信】
・カフェ、ホテルでWi-Fiあり
・SIM: T-Mobile等（ESTA国）
・Wi-Fiレンタル: 1日800円〜
・eSIM: 7日3GB約2,500円`,
    food: `【グルメ】
・ロコモコ
・ポキ（マグロ漬け）
・ガーリックシュリンプ
・アサイーボウル
・パンケーキ`,
    culture: `【文化・マナー】
・アロハスピリット（おおらか）
・チップ文化（15-20%）
・ビーチでの飲酒禁止
・環境保護意識が高い
・日焼け止めに規制あり`,
    tips: `【旅のコツ】
・レンタカーがあると便利
・早朝のダイヤモンドヘッド
・ノースショアでガーリックシュリンプ
・免税店でブランド品を`,
  },

  'シンガポール': {
    climate: `【気候】
・常夏（年中暑い）
・雨季: 11-1月（スコール多め）
・乾季: 2-10月
・平均気温: 27-32℃
・室内は冷房が強い`,
    price: `【物価】
・日本と同程度〜やや高い
・ホーカー: 500-800円
・レストラン: 2,000-5,000円
・ホテル: 10,000-30,000円/泊
・観光施設は高め`,
    wifi: `【Wi-Fi・通信】
・観光地でWi-Fiあり
・SIM: Singtel、StarHub
・7日100GB: 約1,500円
・空港で購入可`,
    food: `【グルメ】
・チキンライス（海南鶏飯）
・チリクラブ
・ラクサ（麺料理）
・カヤトースト
・ホーカー（屋台村）がおすすめ`,
    culture: `【文化・マナー】
・法律が厳格（罰金多い）
・ガム持込禁止
・MRT内飲食禁止
・ゴミのポイ捨て厳禁
・チップ不要`,
    tips: `【旅のコツ】
・EZリンクカード（交通系IC）
・ガーデンズバイザベイは夜に
・マリーナベイサンズの展望台
・冷房対策の羽織もの必須`,
  },

  'ベトナム': {
    climate: `【気候】
・北部（ハノイ）: 四季あり
・中部（ダナン）: 雨季9-12月
・南部（ホーチミン）: 常夏
・ベストシーズン: 11-4月
・雨季でもスコール型`,
    price: `【物価】
・日本の約1/4〜1/5
・フォー: 100-300円
・レストラン: 300-1,000円
・マッサージ: 500-1,000円/1h
・ホテル: 2,000-5,000円/泊`,
    wifi: `【Wi-Fi・通信】
・カフェ等でWi-Fi普及
・SIM: Viettel、Mobifone
・30日5GB: 約300円〜
・激安！空港で購入を`,
    food: `【グルメ】
・フォー（米麺）
・バインミー（サンドイッチ）
・生春巻き
・ブンチャー
・ベトナムコーヒー`,
    culture: `【文化・マナー】
・値段交渉が基本
・バイク社会（横断注意！）
・フレンドリーだが押しが強い
・チップは気持ち程度
・ベトナム戦争の歴史を尊重`,
    tips: `【旅のコツ】
・Grabアプリ必須
・スマホは道端で出さない
・値段交渉は笑顔で強気に
・アオザイをお土産に`,
  },

  'オーストラリア': {
    climate: `【気候】
・南半球で季節が逆
・夏（12-2月）: 暑い
・冬（6-8月）: 温暖（北部は暖かい）
・紫外線が非常に強い
・ベストシーズン: 9-11月（春）`,
    price: `【物価】
・日本より20-30%高い
・カフェ: 1,500-2,000円
・レストラン: 2,500-5,000円
・最低賃金が高い国
・ホテル: 10,000-25,000円/泊`,
    wifi: `【Wi-Fi・通信】
・カフェ等でWi-Fiあり
・SIM: Optus、Telstra
・28日35GB: 約3,000円
・国土が広いので要注意`,
    food: `【グルメ】
・オージービーフ
・ミートパイ
・フィッシュ&チップス
・フラットホワイト（コーヒー）
・ベジミート（好み分かれる）`,
    culture: `【文化・マナー】
・フレンドリーでカジュアル
・No worries（気にしない）精神
・チップ不要（サービス良ければ）
・エコ意識が高い
・時間にルーズな面も`,
    tips: `【旅のコツ】
・日焼け止め必須（SPF50以上）
・野生動物に近づきすぎない
・キャッシュレス普及
・ワーホリで稼ぐ人も多い`,
  },

  'グアム': {
    climate: `【気候】
・常夏（年中暖かい）
・乾季: 12-6月（ベストシーズン）
・雨季: 7-11月（スコールあり）
・平均気温: 26-30℃
・台風シーズンに注意`,
    price: `【物価】
・日本と同程度〜やや高い
・ファストフード: 1,200円〜
・レストラン: 2,500-4,000円
・免税でブランド品がお得
・ホテル: 10,000-25,000円/泊`,
    wifi: `【Wi-Fi・通信】
・ホテル、ショッピングセンターでWi-Fi
・SIM: IT&E、Docomo Pacific
・Wi-Fiレンタル: 1日700円〜
・日本からのレンタルが便利`,
    food: `【グルメ】
・チャモロ料理（地元料理）
・BBQリブ
・レッドライス
・アメリカンステーキ
・サンデーブランチがおすすめ`,
    culture: `【文化・マナー】
・チャモロ文化（先住民族）
・アメリカ文化ベース
・チップ文化（15-18%）
・フレンドリー
・日本人観光客に慣れている`,
    tips: `【旅のコツ】
・レンタカーがあると便利
・恋人岬で夕日を
・Kマートでお土産を
・タモン以外も探索して`,
  },
};

// 各国のおすすめ店舗・エリア情報
const COUNTRY_SHOPS_INFO: Record<string, string> = {
  '韓国': `🍽️ 韓国のおすすめグルメスポット

【サムギョプサル（焼肉）】
📍 八色サムギョプサル（팔색삼겹살）
  └ 明洞・江南に店舗あり
  └ 8種類の味付け肉が人気
📍 姜虎東白丁（강호동백정）
  └ 有名人経営の人気店
  └ 新村・弘大エリア

【チキン】
📍 橋村チキン（교촌치킨）
  └ 韓国チキンチェーン大手
  └ ハニーコンボが定番
📍 BHCチキン
  └ プリンクルチキンが名物

【カフェ】
📍 CAFE ONION（カフェオニオン）
  └ 聖水洞の超人気カフェ
  └ 写真映えスポット
📍 Blue Bottle Coffee
  └ 聖水洞・三清洞

【おすすめエリア】
🗺️ 明洞: 観光・ショッピング
🗺️ 弘大: 若者・カフェ・ナイトライフ
🗺️ 聖水洞: おしゃれカフェ
🗺️ 広蔵市場: ローカルグルメ
🗺️ 北村韓屋村: 伝統的な街並み`,

  'タイ': `🍽️ タイのおすすめグルメスポット

【パッタイ】
📍 ティップサマイ（Thip Samai）
  └ バンコクで最も有名なパッタイ店
  └ 行列必至！夕方から営業
📍 Pad Thai Mae Am
  └ 地元民にも人気

【トムヤムクン】
📍 バーン・カニタ
  └ 高級タイ料理店
  └ 観光客にも安心
📍 ソンブーン・シーフード
  └ プーパッポンカリーも有名

【屋台・ナイトマーケット】
📍 ジョッドフェアーズ（Jodd Fairs）
  └ 新しくておしゃれ
📍 タラートロットファイ・ラチャダー
  └ 写真映えするナイトマーケット

【おすすめエリア】
🗺️ サイアム: ショッピング
🗺️ カオサン通り: バックパッカー街
🗺️ スクンビット: 日本人街もあり
🗺️ チャトゥチャック: 週末市場`,

  '台湾': `🍽️ 台湾のおすすめグルメスポット

【小籠包】
📍 鼎泰豐（ディンタイフォン）
  └ 世界的に有名！台北101店が人気
  └ 並ぶけど回転は早い
📍 明月湯包
  └ 地元民に愛される店
  └ 鼎泰豐より安くて美味

【魯肉飯】
📍 金峰魯肉飯
  └ 中正紀念堂近く
  └ 地元民御用達の名店
📍 天天利美食坊
  └ 西門町エリアで便利

【夜市】
📍 士林夜市
  └ 台北最大！観光客向け
📍 饒河街夜市
  └ 胡椒餅が有名
📍 寧夏夜市
  └ グルメ特化で美味しい店多い

【おすすめエリア】
🗺️ 西門町: 若者の街・原宿的
🗺️ 永康街: おしゃれグルメ街
🗺️ 九份: 千と千尋の世界観
🗺️ 淡水: 夕日が綺麗な港町`,

  'フィリピン': `🍽️ フィリピンのおすすめスポット

【レストラン】
📍 Jollibee（ジョリビー）
  └ フィリピンのファストフード王
  └ チキンジョイが名物！
📍 Mang Inasal
  └ チキンBBQチェーン
  └ 食べ放題のライスが嬉しい
📍 Max's Restaurant
  └ フィリピンチキンの老舗

【シーフード】
📍 Dampa（ダンパ）
  └ 市場で魚介を選んで調理
  └ マカティ、MOA近くにあり
📍 Isla Sugbu Seafood City（セブ）
  └ セブでの海鮮ならここ

【カフェ・スイーツ】
📍 Halo-Halo店
  └ フィリピンかき氷
  └ Chowkingが手軽
📍 Bo's Coffee
  └ フィリピンのスタバ的存在

【おすすめエリア（セブ）】
🗺️ ITパーク: 安全・カフェ多い
🗺️ アヤラモール: ショッピング
🗺️ マクタン島: リゾート・ビーチ`,

  'ハワイ': `🍽️ ハワイのおすすめグルメスポット

【ロコモコ】
📍 Rainbow Drive-In
  └ ローカルに愛される老舗
  └ カパフル通り
📍 Loco Moco Drive Inn
  └ 24時間営業で便利

【ガーリックシュリンプ】
📍 Giovanni's Shrimp Truck
  └ ノースショアの名物
  └ ハレイワエリア
📍 Romy's Kahuku
  └ 地元民おすすめ

【パンケーキ】
📍 Eggs 'n Things
  └ 日本人に大人気
  └ ホイップクリームたっぷり
📍 Bills Hawaii
  └ リコッタパンケーキ

【ポキ】
📍 Ono Seafood
  └ 地元で一番人気のポキ店
📍 Foodland（スーパー）
  └ 手軽に美味しいポキ

【おすすめエリア】
🗺️ ワイキキ: 観光・ビーチ
🗺️ アラモアナ: ショッピング
🗺️ カイルア: おしゃれな街
🗺️ ノースショア: サーフィン・自然`,

  'ベトナム': `🍽️ ベトナムのおすすめグルメスポット

【フォー】
📍 Pho Thin（ハノイ）
  └ ハノイNo.1のフォー店
  └ ローカル感満載
📍 Pho Hoa Pasteur（ホーチミン）
  └ 観光客にも入りやすい

【バインミー】
📍 Banh Mi Phuong（ホイアン）
  └ 世界一のバインミーと話題
📍 Banh Mi Huynh Hoa（ホーチミン）
  └ 行列ができる人気店

【ベトナムコーヒー】
📍 Cong Caphe
  └ レトロなチェーン店
  └ ココナッツコーヒーが人気
📍 The Coffee House
  └ モダンなカフェチェーン

【おすすめエリア】
🗺️ ホーチミン1区: 観光の中心
🗺️ ハノイ旧市街: 歴史的な街並み
🗺️ ダナン: ビーチリゾート
🗺️ ホイアン: ランタンの街`,

  'シンガポール': `🍽️ シンガポールのおすすめグルメスポット

【チキンライス】
📍 天天海南鶏飯
  └ マックスウェルフードセンター内
  └ ミシュランも認めた味
📍 文東記（Boon Tong Kee）
  └ チェーン店で入りやすい

【チリクラブ】
📍 JUMBO Seafood
  └ チリクラブの超有名店
  └ 要予約！クラークキー
📍 Long Beach Seafood
  └ ブラックペッパークラブも人気

【ホーカー（フードコート）】
📍 マックスウェルフードセンター
  └ 観光客にも行きやすい
📍 ラオパサ（Lau Pa Sat）
  └ 夜はサテー屋台が出現
📍 チャイナタウンコンプレックス
  └ ローカル感たっぷり

【おすすめエリア】
🗺️ マリーナベイ: 観光の中心
🗺️ チャイナタウン: グルメ・お土産
🗺️ リトルインディア: 異国情緒
🗺️ オーチャード: ショッピング`,

  'オーストラリア': `🍽️ オーストラリアのおすすめスポット

【カフェ（メルボルン）】
📍 Patricia Coffee Brewers
  └ メルボルンの名店
📍 Seven Seeds
  └ スペシャルティコーヒー
📍 Hardware Société
  └ 朝食が絶品

【シドニー】
📍 The Grounds of Alexandria
  └ インスタ映えカフェ
📍 Sydney Fish Market
  └ 新鮮なシーフード
📍 Pancakes on the Rocks
  └ 24時間営業のパンケーキ

【ステーキ】
📍 Rockpool Bar & Grill
  └ 高級ステーキハウス
📍 Hurricane's Grill
  └ リブが有名

【おすすめエリア】
🗺️ シドニー: オペラハウス・ハーバー
🗺️ メルボルン: カフェ文化・アート
🗺️ ケアンズ: グレートバリアリーフ
🗺️ ゴールドコースト: ビーチ`,

  'グアム': `🍽️ グアムのおすすめグルメスポット

【チャモロ料理】
📍 Proa（プロア）
  └ モダンチャモロ料理
  └ タモン・タムニンに店舗
📍 Jeff's Pirates Cove
  └ 海沿いのローカル店
  └ BBQリブが人気

【ステーキ】
📍 Lone Star Steakhouse
  └ アメリカンステーキ
📍 Tony Roma's
  └ リブが有名

【朝食・ブランチ】
📍 Eggs 'n Things
  └ ハワイ発パンケーキ店
📍 IHOP
  └ アメリカンブレックファスト

【ショッピング】
📍 Tギャラリア（DFS）
  └ 免税店・ブランド品
📍 マイクロネシアモール
  └ 地元最大のモール
📍 Kマート
  └ お土産の穴場！安い

【おすすめエリア】
🗺️ タモン: ホテル・ビーチ
🗺️ タムニン: ショッピング
🗺️ 恋人岬: 絶景スポット`,

  'アメリカ': `🍽️ アメリカのおすすめグルメ（主要都市）

【ニューヨーク】
📍 Shake Shack
  └ NYバーガーの代表格
📍 Katz's Delicatessen
  └ 映画にも登場した老舗
📍 Times Square周辺
  └ 観光向けレストラン多数

【ロサンゼルス】
📍 In-N-Out Burger
  └ 西海岸限定！必食
📍 The Original Farmers Market
  └ フードマーケット
📍 サンタモニカピア周辺

【ラスベガス】
📍 バフェ（食べ放題）
  └ Wicked Spoon
  └ Bacchanal Buffet
📍 ホテル内レストラン
  └ 有名シェフの店多数

【おすすめエリア】
🗺️ NY: タイムズスクエア・ブルックリン
🗺️ LA: サンタモニカ・ハリウッド
🗺️ SF: フィッシャーマンズワーフ`,
};

const COUNTRY_ALIASES: Record<string, string> = {
  '米国': 'アメリカ',
  'USA': 'アメリカ',
  'US': 'アメリカ',
  'セブ': 'フィリピン',
  'マニラ': 'フィリピン',
  'ソウル': '韓国',
  'プサン': '韓国',
  '釜山': '韓国',
  'バンコク': 'タイ',
  'プーケット': 'タイ',
  'チェンマイ': 'タイ',
  '台北': '台湾',
  '高雄': '台湾',
  'ホノルル': 'ハワイ',
  'ワイキキ': 'ハワイ',
  'オアフ': 'ハワイ',
  'シドニー': 'オーストラリア',
  'メルボルン': 'オーストラリア',
  'ケアンズ': 'オーストラリア',
  'ホーチミン': 'ベトナム',
  'ハノイ': 'ベトナム',
  'ダナン': 'ベトナム',
  'タモン': 'グアム',
};

/**
 * 国名を特定する
 */
function detectCountry(message: string): string | null {
  const countries = Object.keys(COUNTRY_SAFETY_INFO);
  for (const country of countries) {
    if (message.includes(country)) {
      return country;
    }
  }
  
  for (const [alias, country] of Object.entries(COUNTRY_ALIASES)) {
    if (message.includes(alias)) {
      return country;
    }
  }
  
  return null;
}

/**
 * 会話履歴から国名を抽出
 */
function detectCountryFromHistory(history: ConversationEntry[]): string | null {
  // 直近の会話から国名を探す（新しい順）
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i];
    // ユーザーのメッセージから国を探す
    let country = detectCountry(entry.userMessage);
    if (country) return country;
    // ボットの応答から国を探す
    country = detectCountry(entry.botResponse);
    if (country) return country;
  }
  return null;
}

/**
 * 国の総合情報を取得
 */
function getCountryGeneralInfo(country: string, topic: string): string | null {
  const info = COUNTRY_TRAVEL_INFO[country];
  if (!info) return null;
  
  if (topic.includes('気候') || topic.includes('天気') || topic.includes('季節') || topic.includes('いつ')) {
    return `🌤️ ${country}の気候・ベストシーズン\n\n${info.climate}`;
  }
  if (topic.includes('物価') || topic.includes('お金') || topic.includes('費用') || topic.includes('予算')) {
    return `💰 ${country}の物価情報\n\n${info.price}`;
  }
  if (topic.includes('wifi') || topic.includes('wi-fi') || topic.includes('sim') || topic.includes('ネット') || topic.includes('通信')) {
    return `📱 ${country}のWi-Fi・通信情報\n\n${info.wifi}`;
  }
  if (topic.includes('食べ物') || topic.includes('グルメ') || topic.includes('料理') || topic.includes('食事') || topic.includes('ご飯')) {
    return `🍽️ ${country}のグルメ情報\n\n${info.food}`;
  }
  if (topic.includes('文化') || topic.includes('マナー') || topic.includes('習慣') || topic.includes('ルール')) {
    return `🙏 ${country}の文化・マナー\n\n${info.culture}`;
  }
  if (topic.includes('おすすめ') || topic.includes('コツ') || topic.includes('アドバイス') || topic.includes('ポイント')) {
    return `💡 ${country}旅行のコツ\n\n${info.tips}`;
  }
  
  return null;
}

/**
 * 国名から治安情報を取得
 */
function getCountrySafetyInfo(message: string): string | null {
  for (const [country, info] of Object.entries(COUNTRY_SAFETY_INFO)) {
    if (message.includes(country)) {
      return info;
    }
  }
  
  // 別名・略称の対応
  const aliases: Record<string, string> = {
    '米国': 'アメリカ',
    'USA': 'アメリカ',
    'US': 'アメリカ',
    'セブ': 'フィリピン',
    'マニラ': 'フィリピン',
    'ソウル': '韓国',
    'プサン': '韓国',
    '釜山': '韓国',
    'バンコク': 'タイ',
    'プーケット': 'タイ',
    '台北': '台湾',
    'ホノルル': 'ハワイ',
    'ワイキキ': 'ハワイ',
    'シドニー': 'オーストラリア',
    'メルボルン': 'オーストラリア',
    'ケアンズ': 'オーストラリア',
    'ホーチミン': 'ベトナム',
    'ハノイ': 'ベトナム',
    'ダナン': 'ベトナム',
  };
  
  for (const [alias, country] of Object.entries(aliases)) {
    if (message.includes(alias)) {
      return COUNTRY_SAFETY_INFO[country] || null;
    }
  }
  
  return null;
}

interface ConversationEntry {
  userMessage: string;
  botResponse: string;
}

export async function generateResponse(
  userMessage: string,
  history: ConversationEntry[]
): Promise<string> {
  // まずFAQから検索（会話履歴も考慮）
  const faqResponse = searchFAQWithContext(userMessage, history);
  if (faqResponse) {
    return faqResponse;
  }
  
  // OpenAI未設定時のフォールバック応答
  if (!openai) {
    return getDefaultResponse(userMessage, history);
  }

  const formattedHistory = history.flatMap((entry) => [
    { role: 'user' as const, content: entry.userMessage },
    { role: 'assistant' as const, content: entry.botResponse },
  ]);

  const messages = buildPromptWithHistory(userMessage, formattedHistory);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content;
    
    if (!response) {
      return getDefaultResponse(userMessage, history);
    }

    return response;
  } catch (error) {
    console.error('OpenAI API error:', error);
    return getDefaultResponse(userMessage, history);
  }
}

/**
 * 海外関連の質問かどうか判定
 */
export function isOverseasQuestion(message: string): boolean {
  return OVERSEAS_KEYWORDS.some(keyword => message.includes(keyword));
}

/**
 * メッセージに国名らしき単語が含まれているか検出（登録外も含む）
 */
function hasCountryMention(message: string): boolean {
  // 一般的な国名パターン（登録外も含む）
  const countryPatterns = [
    /フランス/, /イタリア/, /スペイン/, /ドイツ/, /イギリス/,
    /中国/, /インド/, /ブラジル/, /メキシコ/, /カナダ/,
    /インドネシア/, /マレーシア/, /カンボジア/, /ミャンマー/, /ラオス/,
    /ニュージーランド/, /フィジー/, /モルディブ/, /ドバイ/, /エジプト/,
    /トルコ/, /ギリシャ/, /ポルトガル/, /オランダ/, /ベルギー/,
    /スイス/, /オーストリア/, /チェコ/, /ポーランド/, /ハンガリー/,
    /ロシア/, /北欧/, /スウェーデン/, /ノルウェー/, /フィンランド/, /デンマーク/,
    /クロアチア/, /モロッコ/, /南アフリカ/, /ケニア/, /タンザニア/,
    /アルゼンチン/, /ペルー/, /チリ/, /コロンビア/, /キューバ/,
  ];
  
  return countryPatterns.some(pattern => pattern.test(message));
}

/**
 * 会話の文脈を考慮してFAQから回答を検索
 */
function searchFAQWithContext(message: string, history: ConversationEntry[]): string | null {
  const lowerMessage = message.toLowerCase();
  
  // まず現在のメッセージから国名を検出
  let country = detectCountry(message);
  
  // 登録外の国名が含まれている場合は、OpenAIに回答を委任するためnullを返す
  if (!country && hasCountryMention(message)) {
    console.log(`🌍 Unregistered country detected in: "${message.substring(0, 30)}..." - delegating to OpenAI`);
    return null;
  }
  
  // 国名がない場合のみ、会話履歴から検出（国名が明示されている場合は履歴を使わない）
  if (!country) {
    country = detectCountryFromHistory(history);
  }
  
  // 店・場所に関する質問（文脈から国を判断）
  if (lowerMessage.includes('お店') || lowerMessage.includes('店') || 
      lowerMessage.includes('どこ') || lowerMessage.includes('場所') ||
      lowerMessage.includes('おすすめの') || lowerMessage.includes('有名') ||
      lowerMessage.includes('人気') || lowerMessage.includes('行くべき')) {
    if (country && COUNTRY_SHOPS_INFO[country]) {
      return COUNTRY_SHOPS_INFO[country];
    }
    // 国が特定できない場合
    return `おすすめのお店を教えますね！\n\nどの国のお店をお探しですか？\n\n【対応国】\n🇰🇷韓国 🇹🇭タイ 🇹🇼台湾\n🇵🇭フィリピン 🌺ハワイ 🇻🇳ベトナム\n🇸🇬シンガポール 🇦🇺オーストラリア\n🏝️グアム 🇺🇸アメリカ\n\n例：「韓国のお店」「タイのおすすめ店」`;
  }
  
  // もっと教えて、詳しく、他には等の続きの質問
  if (lowerMessage.includes('もっと') || lowerMessage.includes('詳しく') || 
      lowerMessage.includes('他に') || lowerMessage.includes('それ以外')) {
    if (country) {
      // 直前の会話内容に応じて返す
      const lastBotResponse = history.length > 0 ? history[history.length - 1].botResponse : '';
      if (lastBotResponse.includes('グルメ') || lastBotResponse.includes('食べ物')) {
        return COUNTRY_SHOPS_INFO[country] || `${country}のおすすめ店舗情報をお伝えしますね！\n\n「${country}のお店」と聞いてください！`;
      }
      if (lastBotResponse.includes('治安') || lastBotResponse.includes('安全')) {
        const travelInfo = COUNTRY_TRAVEL_INFO[country];
        if (travelInfo) {
          return `${country}のさらに詳しい情報\n\n${travelInfo.tips}\n\n他に知りたいことはありますか？\n・物価\n・Wi-Fi\n・グルメ\n・文化`;
        }
      }
    }
  }
  
  // 国名が含まれている場合、国別の詳細情報を提供
  if (country) {
    // 治安・安全に関する質問
    if (lowerMessage.includes('安全') || lowerMessage.includes('治安') || lowerMessage.includes('危険')) {
      return getCountrySafetyInfo(message);
    }
    
    // お店・グルメスポットに関する質問
    if (lowerMessage.includes('お店') || lowerMessage.includes('店') || 
        lowerMessage.includes('レストラン') || lowerMessage.includes('カフェ') ||
        lowerMessage.includes('どこで食べ')) {
      return COUNTRY_SHOPS_INFO[country] || null;
    }
    
    // 気候・天気に関する質問
    if (lowerMessage.includes('気候') || lowerMessage.includes('天気') || lowerMessage.includes('季節') || lowerMessage.includes('いつ') || lowerMessage.includes('ベストシーズン')) {
      const info = getCountryGeneralInfo(country, message);
      if (info) return info;
    }
    
    // 物価に関する質問
    if (lowerMessage.includes('物価') || lowerMessage.includes('費用') || lowerMessage.includes('予算') || lowerMessage.includes('いくら')) {
      const info = getCountryGeneralInfo(country, '物価');
      if (info) return info;
    }
    
    // Wi-Fi・通信に関する質問
    if (lowerMessage.includes('wifi') || lowerMessage.includes('wi-fi') || lowerMessage.includes('sim') || lowerMessage.includes('ネット') || lowerMessage.includes('通信')) {
      const info = getCountryGeneralInfo(country, 'wifi');
      if (info) return info;
    }
    
    // グルメに関する質問
    if (lowerMessage.includes('食べ物') || lowerMessage.includes('グルメ') || lowerMessage.includes('料理') || lowerMessage.includes('食事') || lowerMessage.includes('ご飯') || lowerMessage.includes('おいしい') || lowerMessage.includes('名物')) {
      const info = getCountryGeneralInfo(country, 'グルメ');
      if (info) return info;
    }
    
    // 文化・マナーに関する質問
    if (lowerMessage.includes('文化') || lowerMessage.includes('マナー') || lowerMessage.includes('習慣') || lowerMessage.includes('ルール') || lowerMessage.includes('注意')) {
      const info = getCountryGeneralInfo(country, '文化');
      if (info) return info;
    }
    
    // おすすめ・コツに関する質問
    if (lowerMessage.includes('おすすめ') || lowerMessage.includes('コツ') || lowerMessage.includes('アドバイス') || lowerMessage.includes('ポイント') || lowerMessage.includes('教えて')) {
      // グルメ系のおすすめならお店情報を返す
      if (lastMentionedTopic(history) === 'food') {
        return COUNTRY_SHOPS_INFO[country] || getCountryGeneralInfo(country, 'おすすめ');
      }
      const info = getCountryGeneralInfo(country, 'おすすめ');
      if (info) return info;
    }
    
    // 国名だけの場合は総合情報を返す
    return getCountryOverview(country);
  }
  
  // 国名がない一般的な質問
  return searchGeneralFAQ(message);
}

/**
 * 直前の会話のトピックを判定
 */
function lastMentionedTopic(history: ConversationEntry[]): string | null {
  if (history.length === 0) return null;
  const lastResponse = history[history.length - 1].botResponse.toLowerCase();
  if (lastResponse.includes('グルメ') || lastResponse.includes('食べ物') || lastResponse.includes('料理')) {
    return 'food';
  }
  if (lastResponse.includes('治安') || lastResponse.includes('安全')) {
    return 'safety';
  }
  if (lastResponse.includes('気候') || lastResponse.includes('天気')) {
    return 'climate';
  }
  return null;
}

/**
 * 一般的なFAQから回答を検索（国名なし）
 */
function searchGeneralFAQ(message: string): string | null {
  const lowerMessage = message.toLowerCase();
  
  // 治安・安全に関する質問（国名なし）
  if (lowerMessage.includes('安全') || lowerMessage.includes('治安')) {
    return `海外の治安についてのご質問ですね。\n\nどの国に行かれる予定ですか？\n\n【対応国】\n🇺🇸アメリカ 🇰🇷韓国 🇹🇭タイ\n🇵🇭フィリピン 🇹🇼台湾 🌺ハワイ\n🏝️グアム 🇦🇺オーストラリア\n🇻🇳ベトナム 🇸🇬シンガポール\n\n国名を教えてください！詳しい治安情報をお伝えします。`;
  }
  
  // 持ち物に関する質問
  if (lowerMessage.includes('持ち物') || lowerMessage.includes('準備') || lowerMessage.includes('必要なもの')) {
    return `✈️ 海外旅行の持ち物チェックリスト\n\n【必須アイテム】\n☑ パスポート（有効期限6ヶ月以上確認）\n☑ 航空券/eチケット\n☑ 現金・クレジットカード\n☑ 海外旅行保険証\n☑ スマホ・充電器\n☑ 変換プラグ（国によって形状異なる）\n\n【あると便利】\n☑ モバイルバッテリー\n☑ Wi-Fiルーター/SIM\n☑ 常備薬・酔い止め\n☑ マスク・衛生用品\n☑ ボールペン（入国カード用）\n\n【国別おすすめ】\n・東南アジア → 虫除け、日焼け止め\n・寒い国 → 防寒具\n・イスラム圏 → 肌を隠す服\n\nどちらへ行かれますか？`;
  }
  
  // 両替に関する質問
  if (lowerMessage.includes('両替') || lowerMessage.includes('現金')) {
    return `💱 海外での両替・お金事情\n\n【お得な順ランキング】\n1️⃣ 現地ATMで海外キャッシング\n2️⃣ 現地の街中の両替所\n3️⃣ 日本の金券ショップ\n4️⃣ 日本の空港（レート悪め）\n5️⃣ 現地空港（便利だが割高）\n\n【ポイント】\n✅ クレカ払いが一番お得なことも\n✅ 現金は最低限に（盗難リスク）\n✅ 複数の支払い手段を用意\n✅ 大きな紙幣は使いにくい\n\n【国別情報】\n・韓国、台湾 → クレカ普及\n・東南アジア → 現金メイン\n・アメリカ → チップ用に$1札を\n\nどちらの国に行かれますか？`;
  }
  
  // Wi-Fi・SIMに関する質問
  if (lowerMessage.includes('wifi') || lowerMessage.includes('wi-fi') || lowerMessage.includes('sim') || lowerMessage.includes('ネット')) {
    return `📱 海外でのネット接続方法\n\n【選択肢と特徴】\n\n1️⃣ Wi-Fiレンタル（初心者向け）\n・1日500〜1,000円\n・複数人でシェア可\n・充電の手間あり\n\n2️⃣ 現地SIM（コスパ最強）\n・東南アジアは激安（数百円〜）\n・空港で購入可能\n・SIMフリースマホ必須\n\n3️⃣ eSIM（便利！）\n・対応スマホならアプリで完結\n・SIM入替不要\n・airalo, Ubigiなどが人気\n\n4️⃣ 海外ローミング（手軽）\n・各キャリアのプラン確認\n・割高だが設定不要\n\nどちらの国に何日行かれますか？`;
  }
  
  // 保険に関する質問
  if (lowerMessage.includes('保険')) {
    return `🏥 海外旅行保険について\n\n【なぜ必須？】\n・海外の医療費は超高額！\n  └ 盲腸手術: 200〜300万円\n  └ 骨折: 50〜100万円\n  └ 入院1日: 5〜10万円\n\n【補償内容】\n✅ 治療費用（最重要！）\n✅ 救援者費用\n✅ 携行品損害（盗難・紛失）\n✅ 個人賠償責任\n✅ 航空機遅延費用\n\n【加入方法】\n・ネット申込: 500〜3,000円/週\n・空港カウンター: やや割高\n・クレカ付帯: 補償額を要確認\n\n⚠️ クレカ付帯だけでは不十分なことも！\n\nUnisiaでは保険のご相談も承っています！`;
  }
  
  // ビザに関する質問
  if (lowerMessage.includes('ビザ') || lowerMessage.includes('入国')) {
    return `🛂 ビザ・入国情報\n\n【日本人がビザ不要の国（短期観光）】\n・韓国: 90日（K-ETA必要）\n・台湾: 90日\n・タイ: 30日\n・シンガポール: 30日\n・フィリピン: 30日\n・ベトナム: 15日\n・アメリカ: 90日（ESTA必要）\n・オーストラリア: 90日（ETA必要）\n・ヨーロッパ（シェンゲン）: 90日\n\n【電子渡航認証が必要な国】\n・🇺🇸 ESTA（アメリカ）$21\n・🇰🇷 K-ETA（韓国）₩10,000\n・🇦🇺 ETA（オーストラリア）$20\n\n【ビザが必要な場合】\n・長期滞在（留学・ワーホリ）\n・就労目的\n\nどちらの国に行かれますか？`;
  }
  
  // 時期・季節に関する質問
  if (lowerMessage.includes('いつ') || lowerMessage.includes('時期') || lowerMessage.includes('季節') || lowerMessage.includes('ベストシーズン')) {
    return `📅 季節別おすすめ旅行先\n\n🌸【春（3-5月）】\n・台湾（温暖・雨少ない）\n・ベトナム（乾季）\n・韓国（桜シーズン）\n\n🌻【夏（6-8月）】\n・ハワイ（乾季）\n・オーストラリア（冬だが温暖）\n・ヨーロッパ\n\n🍂【秋（9-11月）】\n・韓国（紅葉）\n・台湾（ベストシーズン）\n・オーストラリア（春）\n\n❄️【冬（12-2月）】\n・タイ（乾季・ベスト）\n・グアム（乾季）\n・フィリピン（乾季）\n・シンガポール（年中OK）\n\nどんな旅行をお考えですか？`;
  }
  
  return null;
}

/**
 * 国の総合概要を返す
 */
function getCountryOverview(country: string): string {
  const safety = COUNTRY_SAFETY_INFO[country];
  const travel = COUNTRY_TRAVEL_INFO[country];
  
  if (!safety || !travel) {
    return `${country}についてですね！\n\n何を知りたいですか？\n・治安/安全\n・気候/ベストシーズン\n・物価/費用\n・Wi-Fi/通信\n・グルメ/食事\n・文化/マナー\n・おすすめ/コツ\n\n例：「${country}の治安は？」「${country}の物価は？」`;
  }
  
  return `📍 ${country}の基本情報\n\n${travel.climate.split('\n').slice(0, 3).join('\n')}\n\n${travel.price.split('\n').slice(0, 4).join('\n')}\n\n【もっと詳しく知りたい方】\n以下のキーワードで質問してください：\n・「${country} 治安」\n・「${country} 気候」\n・「${country} 物価」\n・「${country} グルメ」\n・「${country} Wi-Fi」\n・「${country} 文化」`;
}

function getDefaultResponse(userMessage: string, history: ConversationEntry[] = []): string {
  // キーワードベースのシンプルな応答
  const lowerMessage = userMessage.toLowerCase();
  
  // 会話履歴から国を検出
  const country = detectCountry(userMessage) || detectCountryFromHistory(history);
  
  // お店を聞かれた場合
  if (lowerMessage.includes('お店') || lowerMessage.includes('店') || 
      lowerMessage.includes('どこ') || lowerMessage.includes('場所')) {
    if (country && COUNTRY_SHOPS_INFO[country]) {
      return COUNTRY_SHOPS_INFO[country];
    }
  }
  
  if (lowerMessage.includes('留学')) {
    return `留学についてのご質問ですね！\n\n【Unisiaの留学サポート】\n・フィリピン・サイパン中心\n・大手より65%以上コスト削減\n・24時間LINEサポート\n\n期間や予算、目的を教えていただければ、具体的にご案内できます！`;
  }
  
  if (lowerMessage.includes('転職') || lowerMessage.includes('就職')) {
    return `帰国後のキャリアについてのご相談ですね。\n\n専門スタッフが対応いたしますので、しばらくお待ちください。`;
  }
  
  if (lowerMessage.includes('緊急') || lowerMessage.includes('助けて')) {
    return `緊急のご連絡ありがとうございます。\n\n担当者が確認次第、すぐにご連絡いたします。\n\n緊急の場合は、現地の日本大使館・領事館にもご連絡ください。`;
  }
  
  // 海外関連のキーワードがある場合
  if (isOverseasQuestion(userMessage)) {
    return `ご質問ありがとうございます！\n\nこちらの内容について確認し、回答いたします。\n\nもう少し詳しく教えていただけると、より具体的にお答えできます！\n\n例：\n・どの国に行きますか？\n・いつ頃の予定ですか？\n・何が心配ですか？`;
  }
  
  return `ご連絡ありがとうございます！\n\nお問い合わせ内容を確認し、担当スタッフより返信させていただきます。\n\nしばらくお待ちください。`;
}
