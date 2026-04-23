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
    
    // リッチメニューのキーワードを検出
    const newMode = detectModeFromKeyword(userMessage);
    
    // 新しいモードが検出された場合、モードを切り替え
    if (newMode) {
      console.log(`🔄 Mode switch: ${state?.currentMode || 'none'} -> ${newMode}`);
      setUserState(userId, newMode);
      
      // 初期メッセージを返す
      const initialMessage = getRichMenuInitialMessage(newMode);
      
      // 会話を保存
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
    
    // タイムアウトチェック（10分以上経過していたらリセット）
    if (state && isConversationTimedOut(state)) {
      console.log(`⏰ Conversation timed out for ${userId}, resetting to idle`);
      resetUserState(userId);
      state = null;
    }
    
    // 状態がない場合はデフォルトで海外Q&Aモード
    const currentMode = state?.currentMode || 'overseas_qa';
    const modeData = state?.modeData;
    
    // モードに応じた応答を生成
    const response = await handleModeResponse(userId, userMessage, currentMode, modeData);
    
    // 会話を保存
    saveConversation({
      lineUserId: userId,
      userMessage,
      botResponse: response,
      timestamp: new Date().toISOString(),
    });

    // 手動対応が必要な場合、質問をデータベースに保存
    if (needsManualResponse(response) || 
        (currentMode === 'overseas_qa' && !isOverseasQuestion(userMessage))) {
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
      console.log(`📤 Replied (${currentMode}): ${response.substring(0, 50)}...`);
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
