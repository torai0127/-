import { WebhookEvent, MessageEvent, TextMessage } from '@line/bot-sdk';
import { lineClient } from './client.js';
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
  addToManualQueue,
  ConversationMode,
} from '../db/conversation-state.js';
import {
  getInsuranceWelcomeMessage,
  handleInsuranceMessage,
} from '../handlers/insurance.js';

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
      return `🌏 海外に関するご質問をどうぞ！

以下のような質問にお答えできます：
・各国の治安情報
・気候・ベストシーズン
・物価・費用
・おすすめのお店・エリア
・Wi-Fi・SIM情報
・文化・マナー
・持ち物・準備

何でもお気軽にご質問ください！`;

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
    default:
      // 海外質問: AI対応
      const history = getConversationHistory(userId, 10);
      return await generateResponse(userMessage, history);
  }
}

export async function handleEvent(event: WebhookEvent): Promise<void> {
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
    
    // ★ 保険テンプレート入力を最優先で検出
    if (isInsuranceTemplateInput(userMessage)) {
      console.log(`🛡️ Insurance template input detected`);
      
      // 保険モードに設定
      setUserState(userId, 'insurance', { step: 'waiting_template' });
      
      // テンプレートを処理
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
    
    // リッチメニューのキーワードを検出
    const newMode = detectModeFromKeyword(userMessage);
    
    // 新しいモードが検出された場合の処理
    if (newMode) {
      // 同じモードでも、保険モードの場合は継続処理
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
      
      // 異なるモードへの切り替え、または新規モード開始
      if (currentMode !== newMode || currentMode === 'idle') {
        console.log(`🔄 Mode switch: ${currentMode} -> ${newMode}`);
        setUserState(userId, newMode);
        
        // 初期メッセージを返す
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
          console.log(`📤 Initial message for mode ${newMode}`);
        }
        return;
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
