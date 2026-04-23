import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DATABASE_PATH || './data/conversations.db';

let db: Database.Database;

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function initDatabase(): void {
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(DB_PATH);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      line_user_id TEXT NOT NULL,
      user_message TEXT NOT NULL,
      bot_response TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_conversations_user_id 
    ON conversations(line_user_id);

    CREATE INDEX IF NOT EXISTS idx_conversations_timestamp 
    ON conversations(timestamp);

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      line_user_id TEXT UNIQUE NOT NULL,
      display_name TEXT,
      first_contact DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_contact DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_messages INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      total_conversations INTEGER DEFAULT 0,
      unique_users INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(date)
    );

    CREATE TABLE IF NOT EXISTS unanswered_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      line_user_id TEXT NOT NULL,
      question TEXT NOT NULL,
      category TEXT,
      status TEXT DEFAULT 'pending',
      manual_response TEXT,
      responded_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_unanswered_status 
    ON unanswered_questions(status);

    CREATE TABLE IF NOT EXISTS question_patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pattern TEXT NOT NULL,
      category TEXT,
      auto_response TEXT,
      usage_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 会話モード管理テーブル
    CREATE TABLE IF NOT EXISTS user_conversation_state (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      line_user_id TEXT UNIQUE NOT NULL,
      current_mode TEXT DEFAULT 'idle',
      mode_data TEXT,
      last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_user_state_mode 
    ON user_conversation_state(current_mode);

    -- 保険相談データテーブル
    CREATE TABLE IF NOT EXISTS insurance_consultations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      line_user_id TEXT NOT NULL,
      travel_period TEXT,
      budget TEXT,
      destination TEXT,
      credit_cards TEXT,
      status TEXT DEFAULT 'collecting',
      recommendation TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 手動対応キューテーブル
    CREATE TABLE IF NOT EXISTS manual_support_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      line_user_id TEXT NOT NULL,
      support_type TEXT NOT NULL,
      initial_message TEXT,
      status TEXT DEFAULT 'waiting',
      assigned_to TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('✅ Database initialized');
}

export function closeDatabase(): void {
  if (db) {
    db.close();
  }
}
