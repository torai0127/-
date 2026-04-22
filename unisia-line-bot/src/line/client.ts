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
