import { getDatabase } from './index.js';

// 会話モードの種類
export type ConversationMode = 
  | 'idle'           // 通常待機
  | 'overseas_qa'    // 海外LINEサポート（質問対応）
  | 'emergency'      // 海外緊急サポート（手動）
  | 'study_abroad'   // 海外留学相談会（誘導後終了）
  | 'job_change'     // 帰国後転職サポート（手動）
  | 'insurance'      // 海外保険案内サポート（チャットボット）
  | 'flight';        // 格安航空券サポート（別ボット）

export interface UserState {
  lineUserId: string;
  currentMode: ConversationMode;
  modeData?: any;
  lastMessageAt: Date;
}

// 10分のタイムアウト（ミリ秒）
const CONVERSATION_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * ユーザーの会話状態を取得
 */
export function getUserState(lineUserId: string): UserState | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT line_user_id, current_mode, mode_data, last_message_at
    FROM user_conversation_state
    WHERE line_user_id = ?
  `).get(lineUserId) as any;
  
  if (!row) return null;
  
  return {
    lineUserId: row.line_user_id,
    currentMode: row.current_mode as ConversationMode,
    modeData: row.mode_data ? JSON.parse(row.mode_data) : null,
    lastMessageAt: new Date(row.last_message_at),
  };
}

/**
 * ユーザーの会話状態を更新
 */
export function setUserState(
  lineUserId: string, 
  mode: ConversationMode, 
  modeData?: any
): void {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO user_conversation_state (line_user_id, current_mode, mode_data, last_message_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(line_user_id) DO UPDATE SET
      current_mode = excluded.current_mode,
      mode_data = excluded.mode_data,
      last_message_at = datetime('now')
  `).run(lineUserId, mode, modeData ? JSON.stringify(modeData) : null);
}

/**
 * ユーザーの最終メッセージ時刻を更新
 */
export function updateLastMessageTime(lineUserId: string): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE user_conversation_state
    SET last_message_at = datetime('now')
    WHERE line_user_id = ?
  `).run(lineUserId);
}

/**
 * 会話がタイムアウトしているかチェック
 */
export function isConversationTimedOut(state: UserState): boolean {
  const now = new Date();
  const elapsed = now.getTime() - state.lastMessageAt.getTime();
  return elapsed > CONVERSATION_TIMEOUT_MS;
}

/**
 * 会話をリセット（アイドル状態に戻す）
 */
export function resetUserState(lineUserId: string): void {
  setUserState(lineUserId, 'idle', null);
}

/**
 * リッチメニューのキーワードからモードを検出
 */
export function detectModeFromKeyword(message: string): ConversationMode | null {
  // 緊急対応サポート
  if (message.includes('緊急対応サポート') || message.includes('緊急') && message.includes('サポート')) {
    return 'emergency';
  }
  if (message.includes('いかがなさいましたでしょうか')) {
    return 'emergency';
  }
  
  // 海外留学相談会
  if (message.includes('lin.ee/ZgWRQ6U')) {
    return 'study_abroad';
  }
  if (message.includes('海外留学') && (message.includes('相談') || message.includes('無料'))) {
    return 'study_abroad';
  }
  
  // 帰国後転職サポート
  if (message.includes('帰国後転職') || (message.includes('転職') && message.includes('サポート'))) {
    return 'job_change';
  }
  
  // 海外保険案内サポート - エルメからのテンプレート表示
  if (message.includes('海外保険') && message.includes('相談')) {
    return 'insurance';
  }
  if (message.includes('保険プラン') && message.includes('提案')) {
    return 'insurance';
  }
  // テンプレート形式を検出（エルメからの自動送信）
  if (message.includes('渡航期間') && message.includes('予算') && message.includes('到着国')) {
    return 'insurance';
  }
  
  // 海外LINEサポート
  if (message.includes('海外LINEサポート')) {
    return 'overseas_qa';
  }
  if (message.includes('ご質問をどうぞ') || message.includes('何でもお気軽に')) {
    return 'overseas_qa';
  }
  
  return null;
}

/**
 * 保険テンプレート入力かどうかを判定
 */
export function isInsuranceTemplateInput(message: string): boolean {
  // ユーザーが記入したテンプレート入力を検出
  // 「▶」の後に実際の値が入っている場合
  const hasFilledPeriod = /渡航期間[\s\S]*?▶[^\n]*\S+/.test(message) || /▶[^\n]*(?:週間|ヶ月|か月|年|日)/.test(message);
  const hasFilledBudget = /予算[\s\S]*?▶[^\n]*\S+/.test(message) || /▶[^\n]*(?:円|無料)/.test(message);
  const hasFilledCountry = /到着国[\s\S]*?▶[^\n]*\S+/.test(message);
  
  // 3つの項目すべてに値が入っている
  return hasFilledPeriod && hasFilledBudget && hasFilledCountry;
}

/**
 * 手動対応キューに追加
 */
export function addToManualQueue(
  lineUserId: string, 
  supportType: string, 
  initialMessage: string
): void {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO manual_support_queue (line_user_id, support_type, initial_message)
    VALUES (?, ?, ?)
  `).run(lineUserId, supportType, initialMessage);
}

/**
 * 手動対応キューの件数を取得
 */
export function getManualQueueCount(supportType?: string): number {
  const db = getDatabase();
  if (supportType) {
    const row = db.prepare(`
      SELECT COUNT(*) as count FROM manual_support_queue 
      WHERE support_type = ? AND status = 'waiting'
    `).get(supportType) as any;
    return row.count;
  }
  const row = db.prepare(`
    SELECT COUNT(*) as count FROM manual_support_queue WHERE status = 'waiting'
  `).get() as any;
  return row.count;
}
