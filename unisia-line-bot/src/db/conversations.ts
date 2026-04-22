import { getDatabase } from './index.js';

interface ConversationInput {
  lineUserId: string;
  userMessage: string;
  botResponse: string;
  timestamp: string;
}

interface ConversationRecord {
  id: number;
  lineUserId: string;
  userMessage: string;
  botResponse: string;
  timestamp: string;
}

export function saveConversation(data: ConversationInput): void {
  const db = getDatabase();
  
  const insertConversation = db.prepare(`
    INSERT INTO conversations (line_user_id, user_message, bot_response, timestamp)
    VALUES (?, ?, ?, ?)
  `);
  
  insertConversation.run(
    data.lineUserId,
    data.userMessage,
    data.botResponse,
    data.timestamp
  );

  const upsertUser = db.prepare(`
    INSERT INTO users (line_user_id, last_contact, total_messages)
    VALUES (?, CURRENT_TIMESTAMP, 1)
    ON CONFLICT(line_user_id) DO UPDATE SET
      last_contact = CURRENT_TIMESTAMP,
      total_messages = total_messages + 1
  `);
  
  upsertUser.run(data.lineUserId);

  const today = new Date().toISOString().split('T')[0];
  const upsertAnalytics = db.prepare(`
    INSERT INTO analytics (date, total_conversations, unique_users)
    VALUES (?, 1, 1)
    ON CONFLICT(date) DO UPDATE SET
      total_conversations = total_conversations + 1
  `);
  
  upsertAnalytics.run(today);
}

export function getConversationHistory(
  lineUserId: string,
  limit: number = 10
): ConversationRecord[] {
  const db = getDatabase();
  
  const query = db.prepare(`
    SELECT 
      id,
      line_user_id as lineUserId,
      user_message as userMessage,
      bot_response as botResponse,
      timestamp
    FROM conversations
    WHERE line_user_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  
  const results = query.all(lineUserId, limit) as ConversationRecord[];
  return results.reverse();
}

export function getAllConversations(
  options: {
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  } = {}
): ConversationRecord[] {
  const db = getDatabase();
  const { limit = 100, offset = 0, startDate, endDate } = options;
  
  let whereClause = '';
  const params: (string | number)[] = [];
  
  if (startDate && endDate) {
    whereClause = 'WHERE timestamp BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }
  
  const query = db.prepare(`
    SELECT 
      id,
      line_user_id as lineUserId,
      user_message as userMessage,
      bot_response as botResponse,
      timestamp
    FROM conversations
    ${whereClause}
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `);
  
  params.push(limit, offset);
  return query.all(...params) as ConversationRecord[];
}

export function getAnalytics(days: number = 30): {
  date: string;
  totalConversations: number;
  uniqueUsers: number;
}[] {
  const db = getDatabase();
  
  const query = db.prepare(`
    SELECT 
      date,
      total_conversations as totalConversations,
      unique_users as uniqueUsers
    FROM analytics
    WHERE date >= date('now', ?)
    ORDER BY date DESC
  `);
  
  return query.all(`-${days} days`) as {
    date: string;
    totalConversations: number;
    uniqueUsers: number;
  }[];
}

export function getTopQuestions(limit: number = 20): {
  userMessage: string;
  count: number;
}[] {
  const db = getDatabase();
  
  const query = db.prepare(`
    SELECT 
      user_message as userMessage,
      COUNT(*) as count
    FROM conversations
    GROUP BY user_message
    ORDER BY count DESC
    LIMIT ?
  `);
  
  return query.all(limit) as { userMessage: string; count: number }[];
}

export function exportConversationsForTraining(): {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}[] {
  const db = getDatabase();
  
  const query = db.prepare(`
    SELECT 
      user_message as userMessage,
      bot_response as botResponse
    FROM conversations
    ORDER BY timestamp ASC
  `);
  
  const records = query.all() as { userMessage: string; botResponse: string }[];
  
  return records.map((record) => ({
    messages: [
      { role: 'user' as const, content: record.userMessage },
      { role: 'assistant' as const, content: record.botResponse },
    ],
  }));
}
