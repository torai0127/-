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
  // キーワードによるルーティング
  // ====================================
  
  // 航空券ボットへ（格安購入券サポート関連）
  { type: 'keyword', pattern: '航空券', target: 'flight', description: '航空券検索' },
  { type: 'keyword', pattern: 'フライト', target: 'flight', description: 'フライト検索' },
  { type: 'keyword', pattern: '飛行機', target: 'flight', description: '飛行機検索' },
  { type: 'keyword', pattern: '格安', target: 'flight', description: '格安航空券' },
  { type: 'keyword', pattern: 'セール', target: 'flight', description: 'セール情報' },
  { type: 'keyword', pattern: '治安', target: 'flight', description: '治安情報' },
  { type: 'keyword', pattern: 'アンケート', target: 'flight', description: 'アンケート' },
  
  // エルメのリッチメニューからの航空券検索フォーム
  { type: 'keyword', pattern: 'いきたい地域', target: 'flight', description: '航空券検索フォーム' },
  { type: 'keyword', pattern: 'いきたい時期', target: 'flight', description: '航空券検索フォーム' },
  { type: 'keyword', pattern: '期間行きたい', target: 'flight', description: '航空券検索フォーム' },
  { type: 'keyword', pattern: '泊', target: 'flight', description: '航空券検索（宿泊）' },
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
