/**
 * ルーティング設定
 * リッチメニューのpostbackやキーワードに応じて転送先を決定
 */

export type ForwardTarget = 'consultation' | 'flight' | 'ma' | 'self';

export interface RouteRule {
  type: 'postback' | 'keyword' | 'prefix';
  pattern: string;
  target: ForwardTarget;
  description: string;
}

/**
 * ルーティングルール
 * 上から順に評価され、最初にマッチしたものが適用される
 */
export const ROUTE_RULES: RouteRule[] = [
  // ====================================
  // リッチメニュー（6ボタン）のPostback
  // ====================================
  
  // 格安購入券サポート → 航空券ボット
  { type: 'postback', pattern: 'menu_flight_ticket', target: 'flight', description: '格安購入券サポート' },
  { type: 'postback', pattern: 'menu_flight', target: 'flight', description: '航空券メニュー' },
  
  // 海外保険案内サポート → 相談ボット
  { type: 'postback', pattern: 'menu_insurance', target: 'consultation', description: '海外保険案内サポート' },
  
  // 海外LINEサポート → 相談ボット
  { type: 'postback', pattern: 'menu_line_support', target: 'consultation', description: '海外LINEサポート' },
  
  // 帰国後転職サポート → 相談ボット
  { type: 'postback', pattern: 'menu_job_support', target: 'consultation', description: '帰国後転職サポート' },
  
  // 海外留学無料 相談会 → 相談ボット
  { type: 'postback', pattern: 'menu_study_abroad', target: 'consultation', description: '海外留学無料相談会' },
  
  // 海外緊急対応 → 相談ボット
  { type: 'postback', pattern: 'menu_emergency', target: 'consultation', description: '海外緊急対応' },
  
  // ====================================
  // 上部タブのPostback
  // ====================================
  { type: 'postback', pattern: 'tab_advance', target: 'ma', description: 'アドバンスプラン' },
  { type: 'postback', pattern: 'tab_premium', target: 'ma', description: 'プレミアムプラン' },
  { type: 'postback', pattern: 'tab_other', target: 'ma', description: 'その他質問' },
  
  // ====================================
  // 汎用Postback
  // ====================================
  { type: 'postback', pattern: 'menu_consultation', target: 'consultation', description: '海外相談メニュー' },
  { type: 'postback', pattern: 'menu_lstep', target: 'ma', description: 'Lステップ/エルメメニュー' },
  { type: 'postback', pattern: 'menu_main', target: 'ma', description: 'メインメニュー' },
  
  // ====================================
  // プレフィックスによるルーティング
  // ====================================
  { type: 'prefix', pattern: '@相談', target: 'consultation', description: '相談モード切替' },
  { type: 'prefix', pattern: '@航空券', target: 'flight', description: '航空券モード切替' },
  { type: 'prefix', pattern: '@メイン', target: 'ma', description: 'メインモード切替' },
  
  // ====================================
  // リッチメニューからのテキストメッセージ対応
  // （エルメでテキスト送信設定の場合）
  // ====================================
  
  // 海外LINEサポート関連 → 相談ボット
  { type: 'keyword', pattern: '海外LINEサポート', target: 'consultation', description: 'リッチメニュー:海外LINE' },
  { type: 'keyword', pattern: '海外lineサポート', target: 'consultation', description: 'リッチメニュー:海外LINE' },
  { type: 'keyword', pattern: 'LINEサポート', target: 'consultation', description: 'リッチメニュー:海外LINE' },
  { type: 'keyword', pattern: 'lineサポート', target: 'consultation', description: 'リッチメニュー:海外LINE' },
  
  // 海外保険サポート関連 → 相談ボット
  { type: 'keyword', pattern: '海外保険案内サポート', target: 'consultation', description: 'リッチメニュー:保険' },
  { type: 'keyword', pattern: '海外保険サポート', target: 'consultation', description: 'リッチメニュー:保険' },
  { type: 'keyword', pattern: '保険案内サポート', target: 'consultation', description: 'リッチメニュー:保険' },
  
  // 帰国後転職サポート関連 → 相談ボット
  { type: 'keyword', pattern: '帰国後転職サポート', target: 'consultation', description: 'リッチメニュー:転職' },
  { type: 'keyword', pattern: '転職サポート', target: 'consultation', description: 'リッチメニュー:転職' },
  
  // 海外留学関連 → 相談ボット
  { type: 'keyword', pattern: '海外留学無料相談会', target: 'consultation', description: 'リッチメニュー:留学' },
  { type: 'keyword', pattern: '海外留学無料 相談会', target: 'consultation', description: 'リッチメニュー:留学' },
  { type: 'keyword', pattern: '留学無料相談', target: 'consultation', description: 'リッチメニュー:留学' },
  { type: 'keyword', pattern: '留学相談会', target: 'consultation', description: 'リッチメニュー:留学' },
  
  // 海外緊急対応 → 相談ボット
  { type: 'keyword', pattern: '海外緊急対応', target: 'consultation', description: 'リッチメニュー:緊急' },
  { type: 'keyword', pattern: '緊急対応', target: 'consultation', description: 'リッチメニュー:緊急' },
  
  // 格安航空券サポート関連 → 航空券ボット
  { type: 'keyword', pattern: '格安航空券サポート', target: 'flight', description: 'リッチメニュー:航空券' },
  { type: 'keyword', pattern: '格安購入券サポート', target: 'flight', description: 'リッチメニュー:航空券' },
  { type: 'keyword', pattern: '航空券サポート', target: 'flight', description: 'リッチメニュー:航空券' },
  
  // ====================================
  // キーワードによるルーティング
  // ====================================
  
  // 航空券ボットへ（格安購入券サポート関連）
  { type: 'keyword', pattern: '航空券', target: 'flight', description: '航空券検索' },
  { type: 'keyword', pattern: 'フライト', target: 'flight', description: 'フライト検索' },
  { type: 'keyword', pattern: '飛行機', target: 'flight', description: '飛行機検索' },
  { type: 'keyword', pattern: '格安', target: 'flight', description: '格安航空券' },
  { type: 'keyword', pattern: 'セール', target: 'flight', description: 'セール情報' },
  { type: 'keyword', pattern: 'アンケート', target: 'flight', description: 'アンケート' },
  
  // エルメのリッチメニューからの航空券検索フォーム
  { type: 'keyword', pattern: 'いきたい地域', target: 'flight', description: '航空券検索フォーム' },
  { type: 'keyword', pattern: 'いきたい時期', target: 'flight', description: '航空券検索フォーム' },
  { type: 'keyword', pattern: '期間行きたい', target: 'flight', description: '航空券検索フォーム' },
  { type: 'keyword', pattern: '行きたい', target: 'flight', description: '航空券検索' },
  
  // 相談ボットへ（その他5つのサポート関連）
  { type: 'keyword', pattern: '留学', target: 'consultation', description: '留学相談' },
  { type: 'keyword', pattern: 'ワーホリ', target: 'consultation', description: 'ワーホリ相談' },
  { type: 'keyword', pattern: '海外相談', target: 'consultation', description: '海外相談' },
  { type: 'keyword', pattern: '相談したい', target: 'consultation', description: '相談希望' },
  { type: 'keyword', pattern: '保険', target: 'consultation', description: '海外保険' },
  { type: 'keyword', pattern: '転職', target: 'consultation', description: '帰国後転職' },
  { type: 'keyword', pattern: '就職', target: 'consultation', description: '就職サポート' },
  { type: 'keyword', pattern: '相談会', target: 'consultation', description: '相談会' },
  { type: 'keyword', pattern: '緊急', target: 'consultation', description: '緊急対応' },
  { type: 'keyword', pattern: 'トラブル', target: 'consultation', description: 'トラブル対応' },
  { type: 'keyword', pattern: '助けて', target: 'consultation', description: '緊急対応' },
  
  // ====================================
  // 海外Q&A関連キーワード → 相談ボット
  // ====================================
  
  // 天気・気候
  { type: 'keyword', pattern: '天気', target: 'consultation', description: '天気情報' },
  { type: 'keyword', pattern: '気温', target: 'consultation', description: '気温情報' },
  { type: 'keyword', pattern: '気候', target: 'consultation', description: '気候情報' },
  { type: 'keyword', pattern: '季節', target: 'consultation', description: '季節情報' },

  // 治安・安全
  { type: 'keyword', pattern: '治安', target: 'consultation', description: '治安情報' },
  { type: 'keyword', pattern: '安全', target: 'consultation', description: '安全情報' },
  
  // 物価・費用
  { type: 'keyword', pattern: '物価', target: 'consultation', description: '物価情報' },
  { type: 'keyword', pattern: '費用', target: 'consultation', description: '費用情報' },
  { type: 'keyword', pattern: '相場', target: 'consultation', description: '相場情報' },
  
  // 観光・グルメ
  { type: 'keyword', pattern: 'おすすめ', target: 'consultation', description: 'おすすめ情報' },
  { type: 'keyword', pattern: 'オススメ', target: 'consultation', description: 'おすすめ情報' },
  { type: 'keyword', pattern: '観光', target: 'consultation', description: '観光情報' },
  { type: 'keyword', pattern: 'スポット', target: 'consultation', description: '観光スポット' },
  { type: 'keyword', pattern: 'グルメ', target: 'consultation', description: 'グルメ情報' },
  { type: 'keyword', pattern: '料理', target: 'consultation', description: '料理情報' },
  { type: 'keyword', pattern: '食べ物', target: 'consultation', description: '食べ物情報' },
  { type: 'keyword', pattern: 'レストラン', target: 'consultation', description: 'レストラン情報' },
  
  // 通信・準備
  { type: 'keyword', pattern: 'Wi-Fi', target: 'consultation', description: 'Wi-Fi情報' },
  { type: 'keyword', pattern: 'wifi', target: 'consultation', description: 'Wi-Fi情報' },
  { type: 'keyword', pattern: 'SIM', target: 'consultation', description: 'SIM情報' },
  { type: 'keyword', pattern: 'ビザ', target: 'consultation', description: 'ビザ情報' },
  { type: 'keyword', pattern: '入国', target: 'consultation', description: '入国情報' },
  { type: 'keyword', pattern: 'パスポート', target: 'consultation', description: 'パスポート情報' },
  { type: 'keyword', pattern: '持ち物', target: 'consultation', description: '持ち物情報' },
  { type: 'keyword', pattern: '服装', target: 'consultation', description: '服装情報' },
  
  // 文化・マナー
  { type: 'keyword', pattern: '文化', target: 'consultation', description: '文化情報' },
  { type: 'keyword', pattern: 'マナー', target: 'consultation', description: 'マナー情報' },
  
  // 国名（対応国）
  { type: 'keyword', pattern: 'フィリピン', target: 'consultation', description: 'フィリピン情報' },
  { type: 'keyword', pattern: '韓国', target: 'consultation', description: '韓国情報' },
  { type: 'keyword', pattern: 'タイ', target: 'consultation', description: 'タイ情報' },
  { type: 'keyword', pattern: '台湾', target: 'consultation', description: '台湾情報' },
  { type: 'keyword', pattern: 'ハワイ', target: 'consultation', description: 'ハワイ情報' },
  { type: 'keyword', pattern: 'グアム', target: 'consultation', description: 'グアム情報' },
  { type: 'keyword', pattern: 'オーストラリア', target: 'consultation', description: 'オーストラリア情報' },
  { type: 'keyword', pattern: 'ベトナム', target: 'consultation', description: 'ベトナム情報' },
  { type: 'keyword', pattern: 'シンガポール', target: 'consultation', description: 'シンガポール情報' },
  { type: 'keyword', pattern: 'アメリカ', target: 'consultation', description: 'アメリカ情報' },
];

/**
 * リッチメニューのpostback設定例
 */
export const RICH_MENU_POSTBACKS = {
  consultation: 'menu_consultation',
  flight: 'menu_flight',
  main: 'menu_main',
  lstep: 'menu_lstep',
};

/**
 * ユーザーモード（セッション中の状態）
 */
export type UserMode = 'default' | 'consultation' | 'flight';

/**
 * モードの持続設定
 */
export const MODE_CONFIG = {
  // モードが維持される時間（ミリ秒）
  sessionTimeout: 30 * 60 * 1000, // 30分
  
  // モード終了キーワード
  exitKeywords: ['終了', '戻る', 'メニュー', '@メイン'],
};
