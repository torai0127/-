/**
 * プッシュ通知機能
 * セール情報や価格下落の通知を送信
 */

import { sendPushMessage, sendPushMessages } from '../line/client.js';
import { getUsersByRegion, getAllSurveyedUsers, getSurveyResponse } from '../db/users.js';
import { getSafetyInfo, formatSafetyInfo } from '../external/mofa-safety.js';
import { getDatabase } from '../db/index.js';

export interface FlightDeal {
  destination: string;
  originAirports: string[];
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  validUntil: string;
  description: string;
  bookingUrl?: string;
}

/**
 * 特定地域に興味のあるユーザーにセール情報を送信
 */
export async function sendDealNotification(deal: FlightDeal): Promise<{
  success: number;
  failed: number;
}> {
  const users = getUsersByRegion(deal.destination);
  
  let message = `🎉 【お得情報】${deal.destination}行き航空券セール！\n\n`;
  message += `✈️ ${deal.originAirports.join('・')}発\n`;
  message += `💰 ${deal.price.toLocaleString()}円〜`;
  
  if (deal.originalPrice && deal.discountPercent) {
    message += `（通常${deal.originalPrice.toLocaleString()}円 → ${deal.discountPercent}%OFF）`;
  }
  
  message += `\n\n📅 予約期限: ${deal.validUntil}\n`;
  message += `\n📝 ${deal.description}`;
  
  if (deal.bookingUrl) {
    message += `\n\n🔗 詳細・予約:\n${deal.bookingUrl}`;
  }
  
  let success = 0;
  let failed = 0;
  
  for (const user of users) {
    const result = await sendPushMessage(user.lineUserId, message);
    if (result) {
      success++;
      logNotification(user.lineUserId, 'deal', message);
    } else {
      failed++;
    }
  }
  
  console.log(`📤 Deal notification sent: ${success} success, ${failed} failed`);
  return { success, failed };
}

/**
 * 特定地域のユーザーに治安情報を送信
 */
export async function sendSafetyUpdate(country: string): Promise<{
  success: number;
  failed: number;
}> {
  const safetyInfo = await getSafetyInfo(country);
  if (!safetyInfo) {
    return { success: 0, failed: 0 };
  }
  
  const users = getUsersByRegion(country);
  const message = formatSafetyInfo(safetyInfo);
  
  let success = 0;
  let failed = 0;
  
  for (const user of users) {
    const result = await sendPushMessage(user.lineUserId, `📢 ${country}の最新安全情報\n\n${message}`);
    if (result) {
      success++;
      logNotification(user.lineUserId, 'safety', message);
    } else {
      failed++;
    }
  }
  
  return { success, failed };
}

/**
 * 全登録ユーザーにお知らせを送信
 */
export async function sendBroadcast(message: string): Promise<{
  success: number;
  failed: number;
}> {
  const users = getAllSurveyedUsers();
  
  let success = 0;
  let failed = 0;
  
  for (const user of users) {
    const result = await sendPushMessage(user.lineUserId, message);
    if (result) {
      success++;
      logNotification(user.lineUserId, 'broadcast', message);
    } else {
      failed++;
    }
  }
  
  return { success, failed };
}

/**
 * 個別ユーザーに興味地域の情報を送信
 */
export async function sendPersonalizedUpdate(userId: string): Promise<boolean> {
  const surveyData = getSurveyResponse(userId);
  if (!surveyData) {
    return false;
  }
  
  const messages: string[] = [];
  
  messages.push(`✨ あなたへのおすすめ情報 ✨\n\n興味のある地域: ${surveyData.interestedRegions.join('、')}`);
  
  for (const region of surveyData.interestedRegions.slice(0, 2)) {
    const safetyInfo = await getSafetyInfo(region);
    if (safetyInfo) {
      messages.push(formatSafetyInfo(safetyInfo));
    }
  }
  
  return await sendPushMessages(userId, messages);
}

/**
 * 通知履歴を保存
 */
function logNotification(lineUserId: string, type: string, content: string): void {
  const db = getDatabase();
  
  db.prepare(`
    INSERT INTO notifications (line_user_id, notification_type, content)
    VALUES (?, ?, ?)
  `).run(lineUserId, type, content);
}

/**
 * ユーザーの通知履歴を取得
 */
export function getNotificationHistory(lineUserId: string, limit: number = 10): {
  id: number;
  type: string;
  content: string;
  sentAt: string;
}[] {
  const db = getDatabase();
  
  return db.prepare(`
    SELECT 
      id,
      notification_type as type,
      content,
      sent_at as sentAt
    FROM notifications
    WHERE line_user_id = ?
    ORDER BY sent_at DESC
    LIMIT ?
  `).all(lineUserId, limit) as any[];
}
