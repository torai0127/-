/**
 * LINE会話データの統計表示スクリプト
 * 
 * 使用方法:
 *   npx tsx scripts/stats.ts
 */

import Database from 'better-sqlite3';
import * as path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'bot.db');
const db = new Database(DB_PATH);

console.log('========================================');
console.log('📊 LINE Bot 統計レポート');
console.log(`📅 ${new Date().toLocaleString('ja-JP')}`);
console.log('========================================\n');

try {
  // 全体統計
  console.log('📌 全体統計\n');
  
  const totalConversations = db.prepare('SELECT COUNT(*) as count FROM conversations').get() as any;
  console.log(`会話総数: ${totalConversations.count.toLocaleString()}件`);
  
  const uniqueUsers = db.prepare('SELECT COUNT(DISTINCT line_user_id) as count FROM conversations').get() as any;
  console.log(`ユニークユーザー数: ${uniqueUsers.count.toLocaleString()}人`);
  
  // 今日の統計
  const todayConversations = db.prepare(`
    SELECT COUNT(*) as count 
    FROM conversations 
    WHERE date(timestamp) = date('now')
  `).get() as any;
  console.log(`本日の会話数: ${todayConversations.count}件`);
  
  // 過去7日間
  const weekConversations = db.prepare(`
    SELECT COUNT(*) as count 
    FROM conversations 
    WHERE timestamp >= datetime('now', '-7 days')
  `).get() as any;
  console.log(`過去7日間の会話数: ${weekConversations.count}件`);

  // 未回答質問
  console.log('\n📌 未回答質問\n');
  
  try {
    const unanswered = db.prepare('SELECT COUNT(*) as count FROM unanswered_questions').get() as any;
    console.log(`未回答質問総数: ${unanswered.count}件`);
    
    const categories = db.prepare(`
      SELECT category, COUNT(*) as count 
      FROM unanswered_questions 
      GROUP BY category 
      ORDER BY count DESC
    `).all() as any[];
    
    if (categories.length > 0) {
      console.log('\nカテゴリ別:');
      categories.forEach(c => {
        console.log(`  - ${c.category || '未分類'}: ${c.count}件`);
      });
    }
  } catch (e) {
    console.log('テーブルが存在しません');
  }

  // 会話モード統計
  console.log('\n📌 会話モード統計\n');
  
  try {
    const modes = db.prepare(`
      SELECT current_mode, COUNT(*) as count 
      FROM user_conversation_state 
      GROUP BY current_mode 
      ORDER BY count DESC
    `).all() as any[];
    
    if (modes.length > 0) {
      modes.forEach(m => {
        console.log(`  - ${m.current_mode || 'idle'}: ${m.count}人`);
      });
    }
  } catch (e) {
    console.log('テーブルが存在しません');
  }

  // 保険相談統計
  console.log('\n📌 保険相談統計\n');
  
  try {
    const insuranceTotal = db.prepare('SELECT COUNT(*) as count FROM insurance_consultations').get() as any;
    console.log(`保険相談総数: ${insuranceTotal.count}件`);
    
    const destinations = db.prepare(`
      SELECT destination, COUNT(*) as count 
      FROM insurance_consultations 
      WHERE destination IS NOT NULL
      GROUP BY destination 
      ORDER BY count DESC
      LIMIT 5
    `).all() as any[];
    
    if (destinations.length > 0) {
      console.log('\n人気渡航先 TOP5:');
      destinations.forEach((d, i) => {
        console.log(`  ${i + 1}. ${d.destination}: ${d.count}件`);
      });
    }
  } catch (e) {
    console.log('テーブルが存在しません');
  }

  // 手動対応キュー
  console.log('\n📌 手動対応キュー\n');
  
  try {
    const pending = db.prepare(`
      SELECT support_type, COUNT(*) as count 
      FROM manual_support_queue 
      WHERE status = 'pending' OR status IS NULL
      GROUP BY support_type
    `).all() as any[];
    
    if (pending.length > 0) {
      console.log('未対応:');
      pending.forEach(p => {
        console.log(`  - ${p.support_type}: ${p.count}件`);
      });
    } else {
      console.log('未対応の依頼はありません');
    }
  } catch (e) {
    console.log('テーブルが存在しません');
  }

  // 日別会話数（過去7日）
  console.log('\n📌 日別会話数（過去7日）\n');
  
  const dailyStats = db.prepare(`
    SELECT 
      date(timestamp) as date,
      COUNT(*) as count,
      COUNT(DISTINCT line_user_id) as users
    FROM conversations 
    WHERE timestamp >= datetime('now', '-7 days')
    GROUP BY date(timestamp)
    ORDER BY date DESC
  `).all() as any[];
  
  if (dailyStats.length > 0) {
    dailyStats.forEach(d => {
      const bar = '█'.repeat(Math.min(Math.ceil(d.count / 5), 20));
      console.log(`${d.date}: ${bar} ${d.count}件 (${d.users}人)`);
    });
  }

  console.log('\n========================================');
  console.log('✅ レポート完了');
  console.log('========================================');

} catch (error) {
  console.error('❌ エラー:', error);
  process.exit(1);
} finally {
  db.close();
}
