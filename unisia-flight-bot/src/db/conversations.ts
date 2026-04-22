import { getDatabase } from './index.js';

interface ConversationInput {
  lineUserId: string;
  userMessage: string;
  botResponse: string;
  timestamp: string;
  context?: string;
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
  
  db.prepare(`
    INSERT INTO conversations (line_user_id, user_message, bot_response, context, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    data.lineUserId,
    data.userMessage,
    data.botResponse,
    data.context || null,
    data.timestamp
  );
}

export function getConversationHistory(
  lineUserId: string,
  limit: number = 10
): ConversationRecord[] {
  const db = getDatabase();
  
  const rows = db.prepare(`
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
  `).all(lineUserId, limit) as ConversationRecord[];
  
  return rows.reverse();
}
