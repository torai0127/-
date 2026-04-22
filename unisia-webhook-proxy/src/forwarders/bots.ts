/**
 * 自社ボットへの転送
 */

import { forwardWebhook, ForwardResult } from './base.js';

/**
 * 海外相談ボットへ転送
 */
export async function forwardToConsultationBot(
  body: any,
  lineChannelSecret?: string
): Promise<ForwardResult> {
  const url = process.env.CONSULTATION_BOT_URL;
  
  if (!url) {
    console.error('CONSULTATION_BOT_URL not configured');
    return {
      success: false,
      responseTimeMs: 0,
      error: 'CONSULTATION_BOT_URL not configured',
    };
  }
  
  console.log(`📤 Forwarding to Consultation Bot: ${url}`);
  
  return forwardWebhook({
    url,
    body,
    headers: {},
    lineChannelSecret,
  });
}

/**
 * 航空券ボットへ転送
 */
export async function forwardToFlightBot(
  body: any,
  lineChannelSecret?: string
): Promise<ForwardResult> {
  const url = process.env.FLIGHT_BOT_URL;
  
  if (!url) {
    console.error('FLIGHT_BOT_URL not configured');
    return {
      success: false,
      responseTimeMs: 0,
      error: 'FLIGHT_BOT_URL not configured',
    };
  }
  
  console.log(`📤 Forwarding to Flight Bot: ${url}`);
  
  return forwardWebhook({
    url,
    body,
    headers: {},
    lineChannelSecret,
  });
}

/**
 * ターゲット名から転送関数を取得
 */
export function getBotForwarder(target: 'consultation' | 'flight') {
  switch (target) {
    case 'consultation':
      return forwardToConsultationBot;
    case 'flight':
      return forwardToFlightBot;
    default:
      throw new Error(`Unknown bot target: ${target}`);
  }
}
