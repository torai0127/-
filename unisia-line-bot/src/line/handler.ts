import { WebhookEvent, MessageEvent, TextMessage } from '@line/bot-sdk';
import { lineClient } from './client.js';
import { safeReplyText } from './safe-reply.js';
import { generateResponse, isOverseasQuestion } from '../ai/openai.js';
import { saveConversation, getConversationHistory } from '../db/conversations.js';
import { saveUnansweredQuestion, categorizeQuestion } from '../db/questions.js';
import {
  getUserState,
  setUserState,
  resetUserState,
  isConversationTimedOut,
  detectModeFromKeyword,
  isInsuranceTemplateInput,
  isInsuranceLikeMessage,
  isMenuTriggerMessage,
  isElmeAutomatedWelcome,
  isElmeAutomatedInsuranceWelcome,
  shouldSkipMenuWelcome,
  markMenuWelcomeSent,
  addToManualQueue,
  ConversationMode,
} from '../db/conversation-state.js';
import {
  getInsuranceWelcomeMessage,
  handleInsuranceMessage,
  isInsuranceTemplateRequest,
} from '../handlers/insurance.js';
import {
  getConsultationWelcomeMessage,
  handleConsultationMessage,
  isConsultationTemplateInput,
  isConsultationTemplateRequest,
  isElmeConsultationTemplateEcho,
} from '../handlers/consultation.js';

// 手動対応が必要かどうかを判定するキーワード
const MANUAL_RESPONSE_INDICATORS = [
  '担当スタッフ',
  '確認し',
  'しばらくお待ち',
  '専門スタッフ',
];

function needsManualResponse(response: string): boolean {
  return MANUAL_RESPONSE_INDICATORS.some(indicator => response.includes(indicator));
}

// 一般的な海外質問のキーワード（保険モードからの自動切替用）
const OVERSEAS_QUESTION_KEYWORDS = [
  '気温', '天気', '気候', '季節',
  '治安', '安全', '危険',
  '物価', '費用', '相場', '予算',
  'おすすめ', 'オススメ', 'お店', 'レストラン', '観光', 'スポット',
  'Wi-Fi', 'wifi', 'SIM', 'ネット',
  '文化', 'マナー', '言語', '言葉',
  '食事', 'グルメ', '料理', '食べ物',
  'ビザ', '入国', 'パスポート',
  '持ち物', '準備', '服装',
];

// 保険に関連するキーワード
const INSURANCE_KEYWORDS = [
  '保険', 'クレカ', 'クレジットカード', 'カード',
  '渡航期間', '予算', '到着国', '補償', '治療費',
];

/**
 * 保険モード中に一般的な海外質問かどうかを判定
 */
function isGeneralOverseasQuestion(message: string): boolean {
  // 保険関連キーワードが含まれていたら保険の質問
  if (INSURANCE_KEYWORDS.some(kw => message.includes(kw))) {
    return false;
  }
  // 一般的な海外質問キーワードが含まれていたら海外質問
  return OVERSEAS_QUESTION_KEYWORDS.some(kw => message.toLowerCase().includes(kw.toLowerCase()));
}

/** 航空券BOT向けメッセージ（誤着陸時は相談BOTで処理しない） */
function isFlightBotMessage(message: string): boolean {
  const flightKeywords = [
    'いきたい地域', '行きたい地域', 'いきたい時期', '行きたい時期',
    '出発空港', '片道/往復', '格安購入券', '格安航空券', '航空券サポート',
  ];
  if (flightKeywords.some(kw => message.includes(kw))) return true;
  if (message.includes('チェックイン') && message.includes('チェックアウト')) return true;
  if (message.includes('場所:') && message.includes('大人:')) return true;
  return false;
}

/**
 * リッチメニューの初期メッセージを返す
 */
function getRichMenuInitialMessage(mode: ConversationMode): string {
  switch (mode) {
    case 'emergency':
      return `🚨 いかがなさいましたでしょうか？

こちらの緊急対応サポートでは優先的にサポートさせていただきます。

今の現状を詳しくご記入ください！！

━━━━━━━━━━━━━
⚠️ 緊急時の連絡先 ⚠️
━━━━━━━━━━━━━
・日本の外務省: +81-3-3580-3311
・最寄りの日本大使館/領事館
━━━━━━━━━━━━━

担当スタッフが確認次第、優先的に対応いたします。`;

    case 'study_abroad':
      return `✈️ 海外留学の無料相談をご希望ですね！

こちらの公式LINEを追加後、アンケートの回答をお願いします！

👇 こちらから友だち追加 👇
https://lin.ee/ZgWRQ6U

追加後、詳しいご案内をさせていただきます✨`;

    case 'job_change':
      return `💼 帰国後転職サポートをご希望ですね！

下記の質問にご回答をお願いいたします！
条件をもとにあなたに最適な転職先をご提案させていただきます！

━━━━━━━━━━━━━
📝 ご記入ください
━━━━━━━━━━━━━
・現在のご状況
▶︎（海外在住/帰国済み）

・希望の職種
▶︎

・希望の勤務地
▶︎

・経験・スキル
▶︎

・その他ご希望
▶︎
━━━━━━━━━━━━━

担当スタッフが確認後、ご連絡いたします。`;

    case 'insurance':
      return getInsuranceWelcomeMessage();

    case 'overseas_qa':
      return getConsultationWelcomeMessage();

    default:
      return '';
  }
}

/**
 * モードに応じた応答を生成
 */
async function handleModeResponse(
  userId: string,
  userMessage: string,
  mode: ConversationMode,
  modeData?: any
): Promise<string> {
  switch (mode) {
    case 'emergency':
      // 緊急サポート: 全て手動対応キューに追加
      addToManualQueue(userId, 'emergency', userMessage);
      return `📩 メッセージを受け付けました。

担当スタッフが確認次第、優先的に対応いたします。

追加の情報があれば、続けてお送りください。`;

    case 'job_change':
      // 転職サポート: 手動対応キューに追加
      addToManualQueue(userId, 'job_change', userMessage);
      return `📩 ご回答ありがとうございます！

担当スタッフが確認後、最適な転職先をご提案させていただきます。

追加の情報があれば、続けてお送りください。`;

    case 'study_abroad':
      // 留学相談: 誘導後は対応なし
      return `✈️ 留学相談は下記の公式LINEで承っております！

👇 こちらから友だち追加 👇
https://lin.ee/ZgWRQ6U

その他のご質問は、リッチメニューからお選びください。`;

    case 'insurance':
      // 保険相談: チャットボット対応
      return handleInsuranceMessage(userId, userMessage, modeData);

    case 'overseas_qa':
    default: {
      const history = getConversationHistory(userId, 10);
      if (isConsultationTemplateRequest(userMessage) || isConsultationTemplateInput(userMessage)) {
        return await handleConsultationMessage(userMessage, history);
      }
      return await generateResponse(userMessage, history);
    }
  }
}

/**
 * 相談BOTが処理すべきpostbackか判定
 */
function resolveConsultationPostbackMode(data: string): ConversationMode | null {
  // 航空券・タブ等は相談BOTでは処理しない
  if (
    data.includes('menu_flight') ||
    data.includes('flight_ticket') ||
    data.includes('action=flight') ||
    data.includes('tab_') ||
    data.includes('menu_main') ||
    data.includes('menu_lstep')
  ) {
    return null;
  }

  if (data.includes('insurance') || data.includes('menu_insurance')) {
    return 'insurance';
  }
  if (data.includes('emergency') || data.includes('menu_emergency')) {
    return 'emergency';
  }
  if (data.includes('study') || data.includes('menu_study')) {
    return 'study_abroad';
  }
  if (data.includes('job') || data.includes('menu_job')) {
    return 'job_change';
  }
  if (data.includes('line_support') || data.includes('menu_line_support')) {
    return 'overseas_qa';
  }

  return null;
}

export async function handleEvent(event: WebhookEvent): Promise<void> {
  // Postbackイベント（リッチメニュータップ）の処理
  if (event.type === 'postback') {
    const postbackEvent = event as any;
    const userId = postbackEvent.source?.userId;
    const data = postbackEvent.postback?.data || '';
    
    if (!userId || !lineClient) {
      console.warn('No userId or lineClient for postback');
      return;
    }
    
    console.log(`📩 Postback received from ${userId}: ${data}`);

    const mode = resolveConsultationPostbackMode(data);
    if (!mode) {
      console.log(`⏭️ Ignoring non-consultation postback: ${data}`);
      return;
    }

    setUserState(userId, mode);
    const initialMessage = getRichMenuInitialMessage(mode);

    if (initialMessage) {
      await safeReplyText(postbackEvent.replyToken, userId, initialMessage);
      markMenuWelcomeSent(userId, mode);
      console.log(`📤 Postback reply sent for mode: ${mode}`);
    }
    return;
  }

  if (event.type !== 'message' || event.message.type !== 'text') {
    return;
  }

  const messageEvent = event as MessageEvent;
  const textMessage = messageEvent.message as TextMessage;
  const userId = messageEvent.source.userId;
  
  if (!userId) {
    console.warn('No userId found in event');
    return;
  }

  const userMessage = textMessage.text;
  console.log(`📩 Consultation Bot received from ${userId}: ${userMessage}`);

  // エルメ自動配信の挨拶文は再返信しない（postback直後の重複防止）
  if (isElmeAutomatedWelcome(userMessage) || isElmeConsultationTemplateEcho(userMessage)) {
    console.log(`⏭️ Skipping Elme automated welcome echo`);
    setUserState(userId, 'overseas_qa');
    return;
  }

  if (isElmeAutomatedInsuranceWelcome(userMessage)) {
    console.log(`⏭️ Skipping Elme automated insurance welcome echo`);
    setUserState(userId, 'insurance', { step: 'waiting_template' });
    return;
  }

  // 航空券・ホテルフローは航空券BOT管轄（誤着陸時は無視）
  if (isFlightBotMessage(userMessage)) {
    console.log(`⏭️ Ignoring flight/hotel message on consultation bot`);
    return;
  }

  try {
    // 現在のユーザー状態を取得
    let state = getUserState(userId);
    let currentMode = state?.currentMode || 'idle';
    
    // タイムアウトチェック（10分以上経過していたらリセット）
    if (state && isConversationTimedOut(state)) {
      console.log(`⏰ Conversation timed out for ${userId}, resetting to idle`);
      resetUserState(userId);
      state = null;
      currentMode = 'idle';
    }
    
    // ★ 保険テンプレ再表示（相談テンプレより先に判定）
    if (
      isInsuranceTemplateRequest(userMessage) ||
      (currentMode === 'insurance' && userMessage.trim() === 'テンプレート')
    ) {
      const response = getInsuranceWelcomeMessage();
      setUserState(userId, 'insurance', { step: 'waiting_template' });
      saveConversation({
        lineUserId: userId,
        userMessage,
        botResponse: response,
        timestamp: new Date().toISOString(),
      });
      if (lineClient) {
        await lineClient.replyMessage({
          replyToken: messageEvent.replyToken,
          messages: [{ type: 'text', text: response }],
        });
      }
      return;
    }

    // ★ 相談テンプレ再表示
    if (isConsultationTemplateRequest(userMessage) && currentMode !== 'insurance') {
      const response = getConsultationWelcomeMessage();
      setUserState(userId, 'overseas_qa');
      saveConversation({
        lineUserId: userId,
        userMessage,
        botResponse: response,
        timestamp: new Date().toISOString(),
      });
      if (lineClient) {
        await lineClient.replyMessage({
          replyToken: messageEvent.replyToken,
          messages: [{ type: 'text', text: response }],
        });
      }
      return;
    }

    // ★ 保険テンプレート入力（相談BOTより先に判定）
    if (isInsuranceTemplateInput(userMessage)) {
      console.log(`🛡️ Insurance template input detected`);
      
      setUserState(userId, 'insurance', { step: 'waiting_template' });
      const response = handleInsuranceMessage(userId, userMessage, { step: 'waiting_template' });
      
      saveConversation({
        lineUserId: userId,
        userMessage,
        botResponse: response,
        timestamp: new Date().toISOString(),
      });
      
      if (lineClient) {
        await lineClient.replyMessage({
          replyToken: messageEvent.replyToken,
          messages: [{ type: 'text', text: response }],
        });
        console.log(`📤 Insurance template response: ${response.substring(0, 50)}...`);
      }
      return;
    }

    // ★ 相談テンプレート／ショートカット入力（航空券・保険テンプレは除外）
    if (
      isConsultationTemplateInput(userMessage) &&
      !isInsuranceLikeMessage(userMessage) &&
      !userMessage.includes('航空券') &&
      !userMessage.includes('格安購入券') &&
      !userMessage.includes('いきたい地域')
    ) {
      console.log(`🌏 Consultation template/keyword input detected`);
      setUserState(userId, 'overseas_qa');
      const history = getConversationHistory(userId, 10);
      const response = await handleConsultationMessage(userMessage, history);
      saveConversation({
        lineUserId: userId,
        userMessage,
        botResponse: response,
        timestamp: new Date().toISOString(),
      });
      if (lineClient) {
        await lineClient.replyMessage({
          replyToken: messageEvent.replyToken,
          messages: [{ type: 'text', text: response }],
        });
        console.log(`📤 Consultation response: ${response.substring(0, 50)}...`);
      }
      return;
    }
    
    // リッチメニューのキーワードを検出（メニュー文言のみ初回挨拶を返す）
    const newMode = detectModeFromKeyword(userMessage);
    
    if (newMode) {
      if (currentMode === 'insurance' && newMode === 'insurance') {
        console.log(`📝 Continuing insurance mode`);
        const response = handleInsuranceMessage(userId, userMessage, state?.modeData);
        
        saveConversation({
          lineUserId: userId,
          userMessage,
          botResponse: response,
          timestamp: new Date().toISOString(),
        });
        
        if (lineClient) {
          await lineClient.replyMessage({
            replyToken: messageEvent.replyToken,
            messages: [{ type: 'text', text: response }],
          });
        }
        return;
      }

      // メニュー文言のときだけ挨拶を返す（質問文は下の通常処理へ）
      if (isMenuTriggerMessage(userMessage) && (currentMode !== newMode || currentMode === 'idle')) {
        if (shouldSkipMenuWelcome(userId, newMode)) {
          console.log(`⏭️ Skipping duplicate menu welcome for mode: ${newMode}`);
          setUserState(userId, newMode);
          return;
        }

        console.log(`🔄 Mode switch (menu): ${currentMode} -> ${newMode}`);
        setUserState(userId, newMode);

        const initialMessage = getRichMenuInitialMessage(newMode);
        
        saveConversation({
          lineUserId: userId,
          userMessage,
          botResponse: initialMessage,
          timestamp: new Date().toISOString(),
        });
        
        if (lineClient) {
          await lineClient.replyMessage({
            replyToken: messageEvent.replyToken,
            messages: [{ type: 'text', text: initialMessage }],
          });
          markMenuWelcomeSent(userId, newMode);
          console.log(`📤 Initial message for mode ${newMode}`);
        }
        return;
      }

      // モードだけ更新して質問処理を続行
      if (currentMode !== newMode) {
        console.log(`🔄 Mode update: ${currentMode} -> ${newMode}`);
        setUserState(userId, newMode);
        currentMode = newMode;
        state = getUserState(userId);
      }
    }
    
    // ★ 保険モード中に一般的な海外質問が来た場合、overseas_qaに自動切替
    if (currentMode === 'insurance' && isGeneralOverseasQuestion(userMessage)) {
      console.log(`🔄 Auto-switch from insurance to overseas_qa: "${userMessage.substring(0, 30)}..."`);
      setUserState(userId, 'overseas_qa');
      currentMode = 'overseas_qa';
    }
    
    // 現在のモードに応じて処理（保険モード中の継続処理も含む）
    const activeMode = currentMode === 'idle' ? 'overseas_qa' : currentMode;
    const modeData = state?.modeData;
    
    // モードに応じた応答を生成
    const response = await handleModeResponse(userId, userMessage, activeMode, modeData);
    
    // 会話を保存
    saveConversation({
      lineUserId: userId,
      userMessage,
      botResponse: response,
      timestamp: new Date().toISOString(),
    });

    // 手動対応が必要な場合、質問をデータベースに保存
    if (needsManualResponse(response) || 
        (activeMode === 'overseas_qa' && !isOverseasQuestion(userMessage))) {
      const category = categorizeQuestion(userMessage);
      saveUnansweredQuestion({
        lineUserId: userId,
        question: userMessage,
        category,
      });
      console.log(`📝 Saved for manual response: ${userMessage.substring(0, 50)}... (${category})`);
    }

    if (lineClient) {
      await lineClient.replyMessage({
        replyToken: messageEvent.replyToken,
        messages: [{ type: 'text', text: response }],
      });
      console.log(`📤 Replied (${activeMode}): ${response.substring(0, 50)}...`);
    } else {
      console.log(`📤 [Test Mode] Would reply: ${response.substring(0, 50)}...`);
    }
  } catch (error) {
    console.error('Error handling message:', error);
    
    // エラー時も質問を保存
    const category = categorizeQuestion(userMessage);
    saveUnansweredQuestion({
      lineUserId: userId,
      question: userMessage,
      category,
    });
    
    if (lineClient) {
      await lineClient.replyMessage({
        replyToken: messageEvent.replyToken,
        messages: [{
          type: 'text',
          text: 'ご質問ありがとうございます！\n\n内容を確認し、担当スタッフより回答させていただきます。\n\nしばらくお待ちください。',
        }],
      });
    }
  }
}
