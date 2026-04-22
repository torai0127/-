import { WebhookEvent, MessageEvent, TextMessage } from '@line/bot-sdk';
import { lineClient } from './client.js';
import { generateResponse } from '../ai/openai.js';
import { saveConversation, getConversationHistory } from '../db/conversations.js';

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
  console.log(`📩 Received from ${userId}: ${userMessage}`);

  try {
    const history = getConversationHistory(userId, 10);
    const aiResponse = await generateResponse(userMessage, history);
    
    saveConversation({
      lineUserId: userId,
      userMessage,
      botResponse: aiResponse,
      timestamp: new Date().toISOString(),
    });

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
    
    if (lineClient) {
      await lineClient.replyMessage({
        replyToken: messageEvent.replyToken,
        messages: [{
          type: 'text',
          text: '申し訳ございません。一時的なエラーが発生しました。\nしばらくしてから再度お試しください。\n\n緊急のご相談は公式サイトからお問い合わせください。',
        }],
      });
    }
  }
}
