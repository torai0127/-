import { getDatabase } from './index.js';

interface UnansweredQuestion {
  id?: number;
  lineUserId: string;
  question: string;
  category?: string;
  status?: 'pending' | 'answered' | 'ignored';
  manualResponse?: string;
  respondedAt?: string;
  createdAt?: string;
}

/**
 * 未回答の質問を保存
 */
export function saveUnansweredQuestion(data: {
  lineUserId: string;
  question: string;
  category?: string;
}): number {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    INSERT INTO unanswered_questions (line_user_id, question, category)
    VALUES (?, ?, ?)
  `);
  
  const result = stmt.run(data.lineUserId, data.question, data.category || null);
  console.log(`📝 Saved unanswered question: ${data.question.substring(0, 50)}...`);
  
  return result.lastInsertRowid as number;
}

/**
 * 未回答の質問一覧を取得
 */
export function getUnansweredQuestions(limit: number = 50): UnansweredQuestion[] {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    SELECT 
      id,
      line_user_id as lineUserId,
      question,
      category,
      status,
      manual_response as manualResponse,
      responded_at as respondedAt,
      created_at as createdAt
    FROM unanswered_questions
    WHERE status = 'pending'
    ORDER BY created_at DESC
    LIMIT ?
  `);
  
  return stmt.all(limit) as UnansweredQuestion[];
}

/**
 * 質問に回答を設定
 */
export function setQuestionResponse(id: number, response: string): void {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    UPDATE unanswered_questions
    SET manual_response = ?,
        status = 'answered',
        responded_at = datetime('now')
    WHERE id = ?
  `);
  
  stmt.run(response, id);
}

/**
 * 質問のカテゴリを判定
 */
export function categorizeQuestion(question: string): string {
  const lowerQ = question.toLowerCase();
  
  if (lowerQ.includes('治安') || lowerQ.includes('安全')) return 'safety';
  if (lowerQ.includes('ビザ') || lowerQ.includes('入国')) return 'visa';
  if (lowerQ.includes('持ち物') || lowerQ.includes('準備')) return 'preparation';
  if (lowerQ.includes('費用') || lowerQ.includes('予算') || lowerQ.includes('両替')) return 'money';
  if (lowerQ.includes('保険')) return 'insurance';
  if (lowerQ.includes('留学')) return 'study_abroad';
  if (lowerQ.includes('ワーホリ')) return 'working_holiday';
  if (lowerQ.includes('観光') || lowerQ.includes('旅行')) return 'travel';
  if (lowerQ.includes('緊急') || lowerQ.includes('トラブル')) return 'emergency';
  
  return 'general';
}

/**
 * 質問パターンを保存（学習用）
 */
export function saveQuestionPattern(pattern: string, category: string, response: string): void {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    INSERT INTO question_patterns (pattern, category, auto_response)
    VALUES (?, ?, ?)
    ON CONFLICT(pattern) DO UPDATE SET
      usage_count = usage_count + 1,
      auto_response = excluded.auto_response
  `);
  
  stmt.run(pattern, category, response);
}

/**
 * 類似の質問パターンを検索
 */
export function findSimilarPattern(question: string): string | null {
  const db = getDatabase();
  
  // 簡易的なキーワードマッチング
  const keywords = question.split(/[\s、。？！]+/).filter(k => k.length > 1);
  
  for (const keyword of keywords) {
    const stmt = db.prepare(`
      SELECT auto_response
      FROM question_patterns
      WHERE pattern LIKE ?
      ORDER BY usage_count DESC
      LIMIT 1
    `);
    
    const result = stmt.get(`%${keyword}%`) as { auto_response: string } | undefined;
    if (result?.auto_response) {
      return result.auto_response;
    }
  }
  
  return null;
}

/**
 * 統計情報を取得
 */
export function getQuestionStats(): {
  totalPending: number;
  totalAnswered: number;
  categoryCounts: Record<string, number>;
} {
  const db = getDatabase();
  
  const pendingStmt = db.prepare(`SELECT COUNT(*) as count FROM unanswered_questions WHERE status = 'pending'`);
  const answeredStmt = db.prepare(`SELECT COUNT(*) as count FROM unanswered_questions WHERE status = 'answered'`);
  const categoryStmt = db.prepare(`
    SELECT category, COUNT(*) as count 
    FROM unanswered_questions 
    GROUP BY category
  `);
  
  const pending = (pendingStmt.get() as { count: number }).count;
  const answered = (answeredStmt.get() as { count: number }).count;
  const categories = categoryStmt.all() as { category: string; count: number }[];
  
  const categoryCounts: Record<string, number> = {};
  for (const cat of categories) {
    categoryCounts[cat.category || 'general'] = cat.count;
  }
  
  return {
    totalPending: pending,
    totalAnswered: answered,
    categoryCounts,
  };
}
