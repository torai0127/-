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
  // OpenAI未設定時のフォールバック応答
  if (!openai) {
    return getDefaultResponse(userMessage);
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
      return getDefaultResponse(userMessage);
    }

    return response;
  } catch (error) {
    console.error('OpenAI API error:', error);
    return getDefaultResponse(userMessage);
  }
}

/**
 * 海外関連の質問かどうか判定
 */
export function isOverseasQuestion(message: string): boolean {
  return OVERSEAS_KEYWORDS.some(keyword => message.includes(keyword));
}

/**
 * FAQから回答を検索
 */
function searchFAQ(message: string): string | null {
  const lowerMessage = message.toLowerCase();
  
  // 治安・安全に関する質問
  if (lowerMessage.includes('安全') || lowerMessage.includes('治安')) {
    const safetyInfo = getCountrySafetyInfo(message);
    if (safetyInfo) {
      return safetyInfo;
    }
    return `海外の治安についてのご質問ですね。\n\nどの国に行かれる予定ですか？\n\n例：アメリカ、韓国、タイ、フィリピン、台湾、ハワイ、グアム、オーストラリアなど\n\n国名を教えていただければ、詳しい治安情報をお伝えします！`;
  }
  
  // 持ち物に関する質問
  if (lowerMessage.includes('持ち物') || lowerMessage.includes('準備') || lowerMessage.includes('必要なもの')) {
    return `海外旅行の持ち物ですね！\n\n【必須】\n□ パスポート（有効期限6ヶ月以上）\n□ 航空券/eチケット\n□ 現金・クレカ\n□ 海外旅行保険証\n□ スマホ・充電器\n□ 変換プラグ\n\n【あると便利】\n□ モバイルバッテリー\n□ Wi-Fi/SIM\n□ 常備薬\n□ 衛生用品\n\n行き先によって必要なものが変わります。どちらへ行かれますか？`;
  }
  
  // 両替に関する質問
  if (lowerMessage.includes('両替') || lowerMessage.includes('お金') || lowerMessage.includes('現金')) {
    return `両替についてですね！\n\n【お得な順】\n1. 現地ATMで海外キャッシング\n2. 現地の両替所（空港より街中）\n3. 日本の金券ショップ\n4. 日本の空港（レート悪め）\n\n【ポイント】\n・クレカ払いが一番お得なことも\n・現金は最低限に（盗難リスク）\n・複数の支払い手段を用意\n\n他に気になることはありますか？`;
  }
  
  // Wi-Fi・SIMに関する質問
  if (lowerMessage.includes('wifi') || lowerMessage.includes('wi-fi') || lowerMessage.includes('sim') || lowerMessage.includes('ネット')) {
    return `海外でのネット環境ですね！\n\n【選択肢】\n1. Wi-Fiレンタル（安心・簡単）\n2. 現地SIM（安い・中級者向け）\n3. eSIM（対応スマホなら便利）\n4. 海外ローミング（割高だが手軽）\n\n【おすすめ】\n・短期旅行 → Wi-Fiレンタル\n・長期滞在 → 現地SIM or eSIM\n・1日500〜1,000円が目安\n\nどのくらいの期間行かれますか？`;
  }
  
  // 保険に関する質問
  if (lowerMessage.includes('保険')) {
    return `海外旅行保険は絶対に入るべきです！\n\n【理由】\n・海外の医療費は超高額（盲腸で200万円以上も）\n・クレカ付帯だけでは補償不足のことも\n・携行品（盗難・紛失）補償も大事\n\n【目安】\n・短期旅行なら1,000〜3,000円程度\n\nUnisiaでは保険のご相談も承っています。お気軽にどうぞ！`;
  }
  
  // ビザに関する質問
  if (lowerMessage.includes('ビザ') || lowerMessage.includes('入国')) {
    return `ビザについてですね。\n\n【日本人が短期観光でビザ不要な国】\n・韓国、台湾、タイ、シンガポール\n・アメリカ（ESTA必要）\n・ヨーロッパ各国\nなど多数\n\n【ビザが必要な場合】\n・長期滞在（留学・ワーホリ）\n・一部の国への観光\n\nどちらの国に行かれますか？詳しくお伝えします！`;
  }
  
  // 時期・季節に関する質問
  if (lowerMessage.includes('いつ') || lowerMessage.includes('時期') || lowerMessage.includes('季節') || lowerMessage.includes('ベストシーズン')) {
    return `旅行の時期についてですね！\n\n【季節別おすすめ】\n🌸春（3-5月）：台湾、ベトナム\n🌻夏（6-8月）：バリ、ハワイ、北欧\n🍂秋（9-11月）：韓国、オーストラリア\n❄冬（12-2月）：タイ、グアム、オーロラ\n\nどんな旅行をお考えですか？目的に合わせてアドバイスしますね！`;
  }
  
  return null;
}

function getDefaultResponse(userMessage: string): string {
  // まずFAQから検索
  const faqResponse = searchFAQ(userMessage);
  if (faqResponse) {
    return faqResponse;
  }
  
  // キーワードベースのシンプルな応答
  const lowerMessage = userMessage.toLowerCase();
  
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
