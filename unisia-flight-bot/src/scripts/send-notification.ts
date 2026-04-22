/**
 * 通知送信スクリプト
 * 
 * 使い方:
 * npx tsx src/scripts/send-notification.ts deal --destination="韓国" --price=29800 --description="春セール！"
 * npx tsx src/scripts/send-notification.ts broadcast --message="お知らせです"
 * npx tsx src/scripts/send-notification.ts safety --country="タイ"
 */

import dotenv from 'dotenv';
dotenv.config();

import { initDatabase } from '../db/index.js';
import { sendDealNotification, sendBroadcast, sendSafetyUpdate } from '../notification/push.js';

async function main() {
  initDatabase();
  
  const [,, command, ...args] = process.argv;
  
  const parseArgs = (args: string[]): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const arg of args) {
      const match = arg.match(/^--(\w+)=(.+)$/);
      if (match) {
        result[match[1]] = match[2];
      }
    }
    return result;
  };
  
  const params = parseArgs(args);
  
  switch (command) {
    case 'deal': {
      if (!params.destination || !params.price) {
        console.error('Usage: deal --destination="韓国" --price=29800 --description="セール情報"');
        process.exit(1);
      }
      
      const result = await sendDealNotification({
        destination: params.destination,
        originAirports: (params.origins || '成田,羽田,関空').split(','),
        price: parseInt(params.price),
        originalPrice: params.originalPrice ? parseInt(params.originalPrice) : undefined,
        discountPercent: params.discount ? parseInt(params.discount) : undefined,
        validUntil: params.validUntil || '期間限定',
        description: params.description || '',
        bookingUrl: params.url,
      });
      
      console.log(`✅ Deal notification sent: ${result.success} success, ${result.failed} failed`);
      break;
    }
    
    case 'broadcast': {
      if (!params.message) {
        console.error('Usage: broadcast --message="お知らせ内容"');
        process.exit(1);
      }
      
      const result = await sendBroadcast(params.message);
      console.log(`✅ Broadcast sent: ${result.success} success, ${result.failed} failed`);
      break;
    }
    
    case 'safety': {
      if (!params.country) {
        console.error('Usage: safety --country="タイ"');
        process.exit(1);
      }
      
      const result = await sendSafetyUpdate(params.country);
      console.log(`✅ Safety update sent: ${result.success} success, ${result.failed} failed`);
      break;
    }
    
    default:
      console.log(`
Unisia Flight Bot - 通知送信スクリプト

Commands:
  deal      セール情報を送信
            --destination  目的地（必須）
            --price        価格（必須）
            --origins      出発空港（カンマ区切り、デフォルト: 成田,羽田,関空）
            --originalPrice 元の価格
            --discount     割引率
            --validUntil   有効期限
            --description  説明文
            --url          予約URL

  broadcast 全員にお知らせ
            --message      メッセージ（必須）

  safety    治安情報を送信
            --country      国名（必須）

Examples:
  npx tsx src/scripts/send-notification.ts deal --destination="韓国" --price=29800 --description="春セール！"
  npx tsx src/scripts/send-notification.ts broadcast --message="新機能リリースしました！"
  npx tsx src/scripts/send-notification.ts safety --country="タイ"
      `);
  }
  
  process.exit(0);
}

main().catch(console.error);
