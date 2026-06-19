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
function postbackMatches(data: string, pattern: string): boolean {
  if (data === pattern) return true;
  // Elme等が action=menu_flight_ticket 形式で送る場合
  return data.includes(pattern);
}

/**
 * ルール未登録のpostbackを推定（Elmeへ流す前にボットへ振り分け）
 */
function inferPostbackTarget(data: string): ForwardTarget | null {
  if (data.includes('menu_flight') || data.includes('flight_ticket') || data.includes('action=flight')) {
    return 'flight';
  }
  if (data.includes('menu_insurance') || data.includes('insurance')) {
    return 'consultation';
  }
  if (data.includes('menu_line_support') || data.includes('line_support')) {
    return 'consultation';
  }
  if (data.includes('menu_job') || data.includes('job_support')) {
    return 'consultation';
  }
  if (data.includes('menu_study') || data.includes('study_abroad')) {
    return 'consultation';
  }
  if (data.includes('menu_emergency') || data.includes('emergency')) {
    return 'consultation';
  }
  return null;
}

function routePostback(event: PostbackEvent, userId: string | null): RoutingResult {
  const data = event.postback.data;
  
  // ルールをチェック
  for (const rule of ROUTE_RULES) {
    if (rule.type === 'postback' && postbackMatches(data, rule.pattern)) {
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

  // 推定ルーティング（postback形式の揺れ対策）
  const inferred = inferPostbackTarget(data);
  if (inferred) {
    const newMode = targetToMode(inferred);
    if (userId && newMode !== 'default') {
      setUserMode(userId, newMode);
    }
    return {
      target: inferred,
      reason: `postback inferred: ${data}`,
      shouldUpdateMode: true,
      newMode,
    };
  }
  
  // マッチしない場合はデフォルト
  return getDefaultRoute(userId, `postback: ${data}`);
}

/**
 * 航空券検索フォーム（テンプレート）かどうか判定
 * これらのキーワードはモードに優先して航空券ボットに転送
 */
function isFlightSearchForm(text: string): boolean {
  const flightFormKeywords = [
    'いきたい地域', '行きたい地域', 'いきたい時期', '行きたい時期',
    '出発空港', '片道/往復',
  ];
  const hasFormKeyword = flightFormKeywords.some(kw => text.includes(kw));
  const hasStayPattern = /\d+泊/.test(text);
  return hasFormKeyword || hasStayPattern;
}

/** ホテル検索フォーム（航空券フロー続き） */
function isHotelSearchForm(text: string): boolean {
  if (text.includes('チェックイン') && text.includes('チェックアウト')) return true;
  if (text.includes('場所:') && (text.includes('大人:') || text.includes('部屋数:'))) return true;
  return false;
}

/** 航空券BOT管轄のメッセージ（相談BOTへ流さない） */
function isFlightBotMessage(text: string): boolean {
  if (isFlightSearchForm(text) || isHotelSearchForm(text)) return true;
  const shortFlightReplies = ['はい', 'いいえ', 'yes', 'no'];
  if (shortFlightReplies.includes(text.toLowerCase()) || shortFlightReplies.includes(text)) {
    return true; // ホテル提案への返答（flightモードと併用）
  }
  return false;
}

/** 海外Q&A（天気・治安など）— flightモード中でも相談BOTへ */
function isConsultationQuestion(text: string): boolean {
  if (isFlightSearchForm(text) || isHotelSearchForm(text)) return false;

  const qaKeywords = [
    '天気', '気温', '気候', '季節',
    '治安', '安全', '危険',
    '物価', '費用', '相場', '予算',
    'おすすめ', 'オススメ', '観光', 'スポット',
    'グルメ', '料理', '食べ物', 'レストラン',
    'Wi-Fi', 'wifi', 'SIM', 'ビザ', '入国', 'パスポート',
    '持ち物', '服装', '文化', 'マナー',
    '教えて', '知りたい', 'どう', '状況',
  ];
  if (qaKeywords.some(kw => text.includes(kw))) return true;

  const countries = [
    'フィリピン', '韓国', 'タイ', '台湾', 'ハワイ', 'グアム',
    'オーストラリア', 'ベトナム', 'シンガポール', 'アメリカ',
  ];
  if (countries.some(c => text.includes(c)) && !text.includes('いきたい') && !text.includes('チェックイン')) {
    return true;
  }

  return false;
}

/** リッチメニューからの相談モード切替テキスト */
function isConsultationMenuTrigger(text: string): boolean {
  const triggers = [
    '海外LINEサポート', '海外lineサポート', 'LINEサポート', 'lineサポート',
    '海外保険案内サポート', '海外保険サポート', '保険案内サポート',
    '帰国後転職サポート', '転職サポート',
    '海外留学無料相談会', '海外留学無料 相談会', '留学無料相談', '留学相談会',
    '海外緊急対応', '緊急対応',
    '海外相談', '相談したい',
  ];
  return triggers.some(t => text.includes(t));
}

/** リッチメニューからの航空券モード切替テキスト */
function isFlightMenuTrigger(text: string): boolean {
  const triggers = [
    '格安航空券サポート', '格安購入券サポート', '航空券サポート',
  ];
  return triggers.some(t => text.includes(t));
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
  
  // ★ 航空券検索フォームは最優先でflightに転送
  if (isFlightSearchForm(text)) {
    if (userId) setUserMode(userId, 'flight');
    return {
      target: 'flight',
      reason: 'flight search form (priority)',
      shouldUpdateMode: true,
      newMode: 'flight',
    };
  }

  // ★ ホテル検索フォーム（航空券→ホテルフロー）
  if (isHotelSearchForm(text)) {
    if (userId) setUserMode(userId, 'flight');
    return {
      target: 'flight',
      reason: 'hotel search form (flight flow)',
      shouldUpdateMode: true,
      newMode: 'flight',
    };
  }

  // ★ flightモード中は「はい」等の短い返答も航空券BOTへ（ホテル提案フロー）
  if (userId) {
    const currentMode = getUserMode(userId);
    if (currentMode === 'flight' && isFlightBotMessage(text) && !isConsultationMenuTrigger(text)) {
      touchUserMode(userId);
      return {
        target: 'flight',
        reason: 'sticky flight mode (hotel flow)',
        shouldUpdateMode: false,
      };
    }
  }

  // ★ 相談Q&Aはflightモードより優先（航空券後に天気・治安を聞くケース）
  if (isConsultationQuestion(text)) {
    if (userId) setUserMode(userId, 'consultation');
    return {
      target: 'consultation',
      reason: 'consultation Q&A (overrides flight mode)',
      shouldUpdateMode: true,
      newMode: 'consultation',
    };
  }

  // ★ 相談リッチメニュー文言もflightモードより優先
  if (isConsultationMenuTrigger(text)) {
    if (userId) setUserMode(userId, 'consultation');
    return {
      target: 'consultation',
      reason: 'consultation menu trigger (overrides flight mode)',
      shouldUpdateMode: true,
      newMode: 'consultation',
    };
  }

  // 航空券メニュー文言
  if (isFlightMenuTrigger(text)) {
    if (userId) setUserMode(userId, 'flight');
    return {
      target: 'flight',
      reason: 'flight menu trigger',
      shouldUpdateMode: true,
      newMode: 'flight',
    };
  }

  // 現在のモードをチェック（上記の明示切替より後）
  if (userId) {
    const currentMode = getUserMode(userId);

    if (currentMode !== 'default') {
      touchUserMode(userId);
      return {
        target: modeToTarget(currentMode),
        reason: `current mode: ${currentMode}`,
        shouldUpdateMode: false,
      };
    }
  }
  
  // キーワードルール（マッチしたらモードも設定）
  for (const rule of ROUTE_RULES) {
    if (rule.type === 'keyword' && text.includes(rule.pattern)) {
      const newMode = targetToMode(rule.target);
      
      // 航空券・相談に関するキーワードはモードを設定して継続会話を有効化
      if (userId && newMode !== 'default') {
        setUserMode(userId, newMode);
      }
      
      return {
        target: rule.target,
        reason: `keyword: ${rule.description}`,
        shouldUpdateMode: newMode !== 'default',
        newMode: newMode !== 'default' ? newMode : undefined,
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
