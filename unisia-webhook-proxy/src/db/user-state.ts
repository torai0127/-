import { getDatabase } from './index.js';
import { UserMode, MODE_CONFIG } from '../config/routes.js';

export interface UserState {
  lineUserId: string;
  currentMode: UserMode;
  updatedAt: string;
}

/**
 * ユーザーのモードを取得
 */
export function getUserMode(lineUserId: string): UserMode {
  const db = getDatabase();
  
  const row = db.prepare(`
    SELECT current_mode, updated_at FROM user_modes WHERE line_user_id = ?
  `).get(lineUserId) as { current_mode: string; updated_at: string } | undefined;
  
  if (!row) {
    return 'default';
  }
  
  // タイムアウトチェック
  const updatedAt = new Date(row.updated_at).getTime();
  const now = Date.now();
  
  if (now - updatedAt > MODE_CONFIG.sessionTimeout) {
    // タイムアウトしていたらdefaultに戻す
    setUserMode(lineUserId, 'default');
    return 'default';
  }
  
  return row.current_mode as UserMode;
}

/**
 * ユーザーのモードを設定
 */
export function setUserMode(lineUserId: string, mode: UserMode): void {
  const db = getDatabase();
  
  db.prepare(`
    INSERT INTO user_modes (line_user_id, current_mode, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(line_user_id) DO UPDATE SET
      current_mode = excluded.current_mode,
      updated_at = CURRENT_TIMESTAMP
  `).run(lineUserId, mode);
}

/**
 * ユーザーのモードをリセット
 */
export function resetUserMode(lineUserId: string): void {
  setUserMode(lineUserId, 'default');
}

/**
 * モードを更新（タイムスタンプのみ更新）
 */
export function touchUserMode(lineUserId: string): void {
  const db = getDatabase();
  
  db.prepare(`
    UPDATE user_modes SET updated_at = CURRENT_TIMESTAMP
    WHERE line_user_id = ?
  `).run(lineUserId);
}

/**
 * 転送ログを保存
 */
export function logForward(data: {
  lineUserId: string;
  messageType: string;
  messageContent?: string;
  target: string;
  success: boolean;
  responseTimeMs?: number;
}): void {
  const db = getDatabase();
  
  db.prepare(`
    INSERT INTO forward_logs 
    (line_user_id, message_type, message_content, target, success, response_time_ms)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    data.lineUserId,
    data.messageType,
    data.messageContent || null,
    data.target,
    data.success ? 1 : 0,
    data.responseTimeMs || null
  );
}

/**
 * 転送統計を取得
 */
export function getForwardStats(): {
  target: string;
  count: number;
  successRate: number;
}[] {
  const db = getDatabase();
  
  return db.prepare(`
    SELECT 
      target,
      COUNT(*) as count,
      ROUND(AVG(success) * 100, 1) as successRate
    FROM forward_logs
    WHERE created_at > datetime('now', '-7 days')
    GROUP BY target
  `).all() as any[];
}
