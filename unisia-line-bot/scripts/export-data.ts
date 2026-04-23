/**
 * LINE会話データのエクスポートスクリプト
 * 
 * 使用方法:
 *   npx tsx scripts/export-data.ts [オプション]
 * 
 * オプション:
 *   --conversations  会話履歴をエクスポート
 *   --questions      未回答質問をエクスポート
 *   --insurance      保険相談データをエクスポート
 *   --manual         手動対応キューをエクスポート
 *   --all            全てエクスポート
 *   --format=csv     CSV形式（デフォルト）
 *   --format=json    JSON形式
 *   --days=N         過去N日分のみ（デフォルト: 全て）
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'bot.db');
const OUTPUT_DIR = path.join(process.cwd(), 'exports');

// 出力ディレクトリを作成
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// コマンドライン引数を解析
const args = process.argv.slice(2);
const options = {
  conversations: args.includes('--conversations') || args.includes('--all'),
  questions: args.includes('--questions') || args.includes('--all'),
  insurance: args.includes('--insurance') || args.includes('--all'),
  manual: args.includes('--manual') || args.includes('--all'),
  format: args.find(a => a.startsWith('--format='))?.split('=')[1] || 'csv',
  days: parseInt(args.find(a => a.startsWith('--days='))?.split('=')[1] || '0'),
};

// デフォルト: 何も指定がなければ全て
if (!options.conversations && !options.questions && !options.insurance && !options.manual) {
  options.conversations = true;
  options.questions = true;
  options.insurance = true;
  options.manual = true;
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

function getDateFilter(days: number): string {
  if (days <= 0) return '';
  const date = new Date();
  date.setDate(date.getDate() - days);
  return ` WHERE timestamp >= '${date.toISOString()}'`;
}

function exportToCSV(data: any[], filename: string) {
  if (data.length === 0) {
    console.log(`⚠️  ${filename}: データなし`);
    return;
  }
  
  const headers = Object.keys(data[0]);
  const rows = data.map(row => 
    headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      return str.includes(',') || str.includes('\n') ? `"${str}"` : str;
    }).join(',')
  );
  
  const csv = [headers.join(','), ...rows].join('\n');
  const filepath = path.join(OUTPUT_DIR, `${filename}_${timestamp}.csv`);
  fs.writeFileSync(filepath, csv, 'utf-8');
  console.log(`✅ ${filepath} (${data.length}件)`);
}

function exportToJSON(data: any[], filename: string) {
  if (data.length === 0) {
    console.log(`⚠️  ${filename}: データなし`);
    return;
  }
  
  const filepath = path.join(OUTPUT_DIR, `${filename}_${timestamp}.json`);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`✅ ${filepath} (${data.length}件)`);
}

function exportData(data: any[], filename: string) {
  if (options.format === 'json') {
    exportToJSON(data, filename);
  } else {
    exportToCSV(data, filename);
  }
}

console.log('========================================');
console.log('📊 LINE会話データ エクスポート');
console.log(`📅 ${new Date().toLocaleString('ja-JP')}`);
console.log(`📁 出力先: ${OUTPUT_DIR}`);
console.log('========================================\n');

try {
  // 会話履歴
  if (options.conversations) {
    const dateFilter = options.days > 0 
      ? ` WHERE timestamp >= datetime('now', '-${options.days} days')` 
      : '';
    const conversations = db.prepare(`
      SELECT 
        id,
        line_user_id,
        user_message,
        bot_response,
        timestamp
      FROM conversations
      ${dateFilter}
      ORDER BY timestamp DESC
    `).all();
    exportData(conversations, 'conversations');
  }

  // 未回答質問
  if (options.questions) {
    const questions = db.prepare(`
      SELECT 
        id,
        line_user_id,
        question,
        category,
        status,
        created_at
      FROM unanswered_questions
      ORDER BY created_at DESC
    `).all();
    exportData(questions, 'unanswered_questions');
  }

  // 保険相談
  if (options.insurance) {
    try {
      const insurance = db.prepare(`
        SELECT 
          id,
          line_user_id,
          travel_period,
          budget,
          destination,
          credit_cards,
          status,
          recommendation,
          created_at
        FROM insurance_consultations
        ORDER BY created_at DESC
      `).all();
      exportData(insurance, 'insurance_consultations');
    } catch (e) {
      console.log('⚠️  insurance_consultations: テーブルが存在しません');
    }
  }

  // 手動対応キュー
  if (options.manual) {
    try {
      const manual = db.prepare(`
        SELECT 
          id,
          line_user_id,
          support_type,
          initial_message,
          status,
          assigned_to,
          notes,
          created_at
        FROM manual_support_queue
        ORDER BY created_at DESC
      `).all();
      exportData(manual, 'manual_support_queue');
    } catch (e) {
      console.log('⚠️  manual_support_queue: テーブルが存在しません');
    }
  }

  console.log('\n✅ エクスポート完了');

} catch (error) {
  console.error('❌ エラー:', error);
  process.exit(1);
} finally {
  db.close();
}
