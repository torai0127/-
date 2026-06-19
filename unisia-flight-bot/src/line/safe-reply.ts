import { lineClient } from './client.js';

/**
 * replyToken失効時（コールドスタート等）はpushMessageでフォールバック
 */
export async function safeReplyText(
  replyToken: string,
  userId: string,
  text: string
): Promise<boolean> {
  if (!lineClient) {
    console.error('❌ lineClient not configured');
    return false;
  }

  try {
    await lineClient.replyMessage({
      replyToken,
      messages: [{ type: 'text', text }],
    });
    return true;
  } catch (error) {
    console.error('❌ replyMessage failed, trying pushMessage:', error);
    try {
      await lineClient.pushMessage({
        to: userId,
        messages: [{ type: 'text', text }],
      });
      console.log('✅ pushMessage fallback succeeded');
      return true;
    } catch (pushError) {
      console.error('❌ pushMessage fallback also failed:', pushError);
      return false;
    }
  }
}
