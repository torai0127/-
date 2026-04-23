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
  `);

  console.log('✅ Database initialized');
}

export function closeDatabase(): void {
  if (db) {
    db.close();
  }
}
