import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database.Database;

function getDbPath(): string {
  return process.env.DATABASE_PATH || './data/flight-bot.db';
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function initDatabase(): void {
  const dbPath = getDbPath();
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath);
  
  db.exec(`
    -- ユーザー基本情報
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      line_user_id TEXT UNIQUE NOT NULL,
      display_name TEXT,
      survey_completed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- アンケート回答
    CREATE TABLE IF NOT EXISTS survey_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      line_user_id TEXT NOT NULL,
      interested_regions TEXT NOT NULL,
      departure_airports TEXT NOT NULL,
      travel_period TEXT,
      budget_range TEXT,
      travel_purpose TEXT,
      overseas_goals TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (line_user_id) REFERENCES users(line_user_id)
    );

    -- フライト検索履歴
    CREATE TABLE IF NOT EXISTS flight_searches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      line_user_id TEXT NOT NULL,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      departure_date TEXT NOT NULL,
      return_date TEXT,
      passengers INTEGER DEFAULT 1,
      cabin_class TEXT DEFAULT 'economy',
      search_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 価格アラート設定
    CREATE TABLE IF NOT EXISTS price_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      line_user_id TEXT NOT NULL,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      target_price INTEGER,
      is_active INTEGER DEFAULT 1,
      last_notified_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 配信履歴
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      line_user_id TEXT NOT NULL,
      notification_type TEXT NOT NULL,
      content TEXT NOT NULL,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 会話ログ
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      line_user_id TEXT NOT NULL,
      user_message TEXT NOT NULL,
      bot_response TEXT NOT NULL,
      context TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_line_user_id ON users(line_user_id);
    CREATE INDEX IF NOT EXISTS idx_survey_line_user_id ON survey_responses(line_user_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_line_user_id ON price_alerts(line_user_id);
  `);

  console.log('✅ Flight Bot Database initialized');
}

export function closeDatabase(): void {
  if (db) {
    db.close();
  }
}
