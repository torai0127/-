import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DATABASE_PATH || './data/proxy.db';

let db: Database.Database;

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized');
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
    -- ユーザーの現在モード
    CREATE TABLE IF NOT EXISTS user_modes (
      line_user_id TEXT PRIMARY KEY,
      current_mode TEXT NOT NULL DEFAULT 'default',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 転送ログ
    CREATE TABLE IF NOT EXISTS forward_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      line_user_id TEXT NOT NULL,
      message_type TEXT NOT NULL,
      message_content TEXT,
      target TEXT NOT NULL,
      success INTEGER NOT NULL,
      response_time_ms INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_forward_logs_user ON forward_logs(line_user_id);
    CREATE INDEX IF NOT EXISTS idx_forward_logs_target ON forward_logs(target);
  `);

  console.log('✅ Proxy Database initialized');
}

export function closeDatabase(): void {
  if (db) {
    db.close();
  }
}
