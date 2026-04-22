import { MiddlewareConfig, messagingApi } from '@line/bot-sdk';

const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const channelSecret = process.env.LINE_CHANNEL_SECRET;

if (!channelAccessToken || !channelSecret) {
  console.warn('⚠️ LINE credentials not configured');
}

export function isLineConfigured(): boolean {
  return !!(channelAccessToken && channelSecret);
}

export const lineConfig: MiddlewareConfig = {
  channelAccessToken: channelAccessToken || '',
  channelSecret: channelSecret || '',
};

export const lineClient = channelAccessToken
  ? new messagingApi.MessagingApiClient({ channelAccessToken })
  : null;

export async function sendPushMessage(userId: string, message: string): Promise<boolean> {
  if (!lineClient) {
    console.error('LINE client not initialized');
    return false;
  }

  try {
    await lineClient.pushMessage({
      to: userId,
      messages: [{ type: 'text', text: message }],
    });
    return true;
  } catch (error) {
    console.error('Failed to send push message:', error);
    return false;
  }
}

export async function sendPushMessages(userId: string, messages: string[]): Promise<boolean> {
  if (!lineClient) {
    console.error('LINE client not initialized');
    return false;
  }

  try {
    await lineClient.pushMessage({
      to: userId,
      messages: messages.map((text) => ({ type: 'text' as const, text })),
    });
    return true;
  } catch (error) {
    console.error('Failed to send push messages:', error);
    return false;
  }
}
