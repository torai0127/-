import { WebhookEvent, MessageEvent, TextMessage } from '@line/bot-sdk';
import { lineClient } from './client.js';
import { generateResponse, isOverseasQuestion } from '../ai/openai.js';
import { saveConversation, getConversationHistory } from '../db/conversations.js';
import { saveUnansweredQuestion, categorizeQuestion } from '../db/questions.js';

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
    const history = getConversationHistory(userId, 10);
    const aiResponse = await generateResponse(userMessage, history);
    
    // 会話を保存
    saveConversation({
      lineUserId: userId,
      userMessage,
      botResponse: aiResponse,
      timestamp: new Date().toISOString(),
    });

    // 手動対応が必要な場合、質問をデータベースに保存
    if (needsManualResponse(aiResponse) || !isOverseasQuestion(userMessage)) {
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
        messages: [{ type: 'text', text: aiResponse }],
      });
      console.log(`📤 Replied to ${userId}: ${aiResponse.substring(0, 50)}...`);
    } else {
      console.log(`📤 [Test Mode] Would reply: ${aiResponse.substring(0, 50)}...`);
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
