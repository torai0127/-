import { MiddlewareConfig, messagingApi } from '@line/bot-sdk';

const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const channelSecret = process.env.LINE_CHANNEL_SECRET;

if (!channelAccessToken) {
  console.error('❌ LINE_CHANNEL_ACCESS_TOKEN is not set!');
}
if (!channelSecret) {
  console.warn('⚠️ LINE_CHANNEL_SECRET is not set');
}
console.log(`🔧 LINE config: token=${channelAccessToken ? channelAccessToken.substring(0, 20) + '...' : 'NOT SET'}, secret=${channelSecret ? 'SET' : 'NOT SET'}`);

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
