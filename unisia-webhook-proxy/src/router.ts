/**
 * ルーティングロジック
 * Webhookイベントを解析し、適切な転送先を決定
 */

import { WebhookEvent, MessageEvent, PostbackEvent, TextMessage } from '@line/bot-sdk';
import { ROUTE_RULES, ForwardTarget, MODE_CONFIG, UserMode } from './config/routes.js';
import { getUserMode, setUserMode, touchUserMode } from './db/user-state.js';

export interface RoutingResult {
  target: ForwardTarget;
  reason: string;
  shouldUpdateMode: boolean;
  newMode?: UserMode;
}

/**
 * イベントの転送先を決定
 */
export function routeEvent(event: WebhookEvent): RoutingResult {
  const userId = getUserIdFromEvent(event);
  
  // Postbackイベント（リッチメニュータップなど）
  if (event.type === 'postback') {
    return routePostback(event as PostbackEvent, userId);
  }
  
  // メッセージイベント
  if (event.type === 'message') {
    const messageEvent = event as MessageEvent;
    
    if (messageEvent.message.type === 'text') {
      return routeTextMessage(messageEvent, userId);
    }
    
    // テキスト以外のメッセージはデフォルト転送
    return getDefaultRoute(userId, 'non-text message');
  }
  
  // その他のイベント（follow, unfollowなど）はMA（Lステップ/エルメ）へ
  return {
    target: 'ma',
    reason: `event type: ${event.type}`,
    shouldUpdateMode: false,
  };
}

/**
 * Postbackイベントのルーティング
 */
function routePostback(event: PostbackEvent, userId: string | null): RoutingResult {
  const data = event.postback.data;
  
  // ルールをチェック
  for (const rule of ROUTE_RULES) {
    if (rule.type === 'postback' && data === rule.pattern) {
      const newMode = targetToMode(rule.target);
      
      if (userId && newMode !== 'default') {
        setUserMode(userId, newMode);
      }
      
      return {
        target: rule.target,
        reason: `postback: ${rule.description}`,
        shouldUpdateMode: true,
        newMode,
      };
    }
  }
  
  // マッチしない場合はデフォルト
  return getDefaultRoute(userId, `postback: ${data}`);
}

/**
 * テキストメッセージのルーティング
 */
function routeTextMessage(event: MessageEvent, userId: string | null): RoutingResult {
  const text = (event.message as TextMessage).text.trim();
  
  // 終了キーワードチェック
  if (MODE_CONFIG.exitKeywords.some(kw => text.includes(kw))) {
    if (userId) {
      setUserMode(userId, 'default');
    }
    return {
      target: 'ma',
      reason: 'exit keyword',
      shouldUpdateMode: true,
      newMode: 'default',
    };
  }
  
  // プレフィックスルール（@相談 など）
  for (const rule of ROUTE_RULES) {
    if (rule.type === 'prefix' && text.startsWith(rule.pattern)) {
      const newMode = targetToMode(rule.target);
      
      if (userId && newMode !== 'default') {
        setUserMode(userId, newMode);
      }
      
      return {
        target: rule.target,
        reason: `prefix: ${rule.description}`,
        shouldUpdateMode: true,
        newMode,
      };
    }
  }
  
  // 現在のモードをチェック
  if (userId) {
    const currentMode = getUserMode(userId);
    
    if (currentMode !== 'default') {
      // モードが設定されている場合、そのモードの転送先へ
      touchUserMode(userId);
      
      return {
        target: modeToTarget(currentMode),
        reason: `current mode: ${currentMode}`,
        shouldUpdateMode: false,
      };
    }
  }
  
  // キーワードルール
  for (const rule of ROUTE_RULES) {
    if (rule.type === 'keyword' && text.includes(rule.pattern)) {
      return {
        target: rule.target,
        reason: `keyword: ${rule.description}`,
        shouldUpdateMode: false,
      };
    }
  }
  
  // デフォルト
  return getDefaultRoute(userId, 'no match');
}

/**
 * デフォルトの転送先を取得
 */
function getDefaultRoute(userId: string | null, reason: string): RoutingResult {
  const defaultTarget = (process.env.DEFAULT_FORWARD || 'ma') as ForwardTarget;
  
  return {
    target: defaultTarget,
    reason: `default (${reason})`,
    shouldUpdateMode: false,
  };
}

/**
 * イベントからユーザーIDを取得
 */
function getUserIdFromEvent(event: WebhookEvent): string | null {
  if ('source' in event && event.source.type === 'user') {
    return event.source.userId || null;
  }
  return null;
}

/**
 * ForwardTarget → UserMode 変換
 */
function targetToMode(target: ForwardTarget): UserMode {
  switch (target) {
    case 'consultation':
      return 'consultation';
    case 'flight':
      return 'flight';
    default:
      return 'default';
  }
}

/**
 * UserMode → ForwardTarget 変換
 */
function modeToTarget(mode: UserMode): ForwardTarget {
  switch (mode) {
    case 'consultation':
      return 'consultation';
    case 'flight':
      return 'flight';
    default:
      return 'ma';
  }
}

/**
 * 転送先のURLを取得
 */
export function getTargetUrl(target: ForwardTarget): string | null {
  switch (target) {
    case 'consultation':
      return process.env.CONSULTATION_BOT_URL || null;
    case 'flight':
      return process.env.FLIGHT_BOT_URL || null;
    case 'ma':
      const maTool = process.env.MA_TOOL || 'lstep';
      if (maTool === 'lstep') {
        return process.env.LSTEP_WEBHOOK_URL || null;
      } else {
        return process.env.ELME_WEBHOOK_URL || null;
      }
    case 'self':
      return null; // 自己処理
    default:
      return null;
  }
}
