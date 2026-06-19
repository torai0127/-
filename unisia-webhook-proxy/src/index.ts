import express from 'express';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { WebhookEvent } from '@line/bot-sdk';
import { initDatabase } from './db/index.js';
import { routeEvent, getTargetUrl } from './router.js';
import { logForward, getForwardStats } from './db/user-state.js';
import { forwardToConsultationBot, forwardToFlightBot } from './forwarders/bots.js';
import { forwardToMA, getMAConfig } from './forwarders/lstep-elme.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '';

initDatabase();

// Body を raw で受け取る（署名検証のため）
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

/**
 * ヘルスチェック
 */
app.get('/health', (_, res) => {
  res.json({
    status: 'ok',
    service: 'unisia-webhook-proxy',
    timestamp: new Date().toISOString(),
  });
});

/**
 * LINE Webhook エンドポイント
 */
app.post('/webhook', async (req, res) => {
  // 署名検証
  const signature = req.headers['x-line-signature'] as string;
  const body = req.body as Buffer;
  
  if (!verifySignature(body, signature)) {
    console.error('❌ Invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  const parsedBody = JSON.parse(body.toString());
  const events: WebhookEvent[] = parsedBody.events;
  
  console.log(`📨 Received ${events.length} event(s)`);
  
  // すぐにLINEに200を返す（タイムアウト防止）
  res.json({ success: true });
  
  // 非同期で転送処理
  for (const event of events) {
    try {
      await processEvent(event, parsedBody);
    } catch (error) {
      console.error('Error processing event:', error);
    }
  }
});

/**
 * イベント処理
 */
async function processEvent(event: WebhookEvent, originalBody: any): Promise<void> {
  const routingResult = routeEvent(event);
  const userId = getUserIdFromEvent(event);
  
  console.log(`🔀 Routing: ${routingResult.target} (${routingResult.reason})`);
  
  // 転送先に応じて処理
  let success = false;
  let responseTimeMs = 0;
  
  const singleEventBody = {
    ...originalBody,
    events: [event],
  };
  
  // 1. ボットへの転送（航空券 or 相談）
  switch (routingResult.target) {
    case 'consultation': {
      const result = await forwardToConsultationBot(singleEventBody, LINE_CHANNEL_SECRET);
      success = result.success;
      responseTimeMs = result.responseTimeMs;
      break;
    }
    
    case 'flight': {
      const result = await forwardToFlightBot(singleEventBody, LINE_CHANNEL_SECRET);
      success = result.success;
      responseTimeMs = result.responseTimeMs;
      break;
    }
    
    case 'ma': {
      // MAのみの場合は後で処理
      success = true;
      break;
    }
    
    case 'self': {
      success = true;
      break;
    }
  }
  
  // 2. エルメにも常に転送（BOT無反応時のフォールバック＋顧客管理）
  const elmeUrl = process.env.ELME_WEBHOOK_URL;
  if (elmeUrl) {
    try {
      const elmeResult = await forwardToMA(singleEventBody, { tool: 'elme', webhookUrl: elmeUrl });
      if (elmeResult.success) {
        console.log(`✅ Also forwarded to Elme (${elmeResult.responseTimeMs}ms)`);
      } else {
        console.warn(`⚠️ Failed to forward to Elme: ${elmeResult.error}`);
      }
    } catch (error) {
      console.warn('⚠️ Elme forward error:', error);
    }
  }
  
  // ログを保存
  if (userId) {
    const messageContent = getMessageContent(event);
    logForward({
      lineUserId: userId,
      messageType: event.type,
      messageContent,
      target: routingResult.target,
      success,
      responseTimeMs,
    });
  }
  
  if (success) {
    console.log(`✅ Forwarded to ${routingResult.target} (${responseTimeMs}ms)`);
  } else {
    console.error(`❌ Failed to forward to ${routingResult.target}${responseTimeMs ? ` (${responseTimeMs}ms)` : ''}`);
  }
}

/**
 * 署名検証
 */
function verifySignature(body: Buffer, signature: string): boolean {
  if (!LINE_CHANNEL_SECRET) {
    console.warn('⚠️ LINE_CHANNEL_SECRET not set, skipping verification');
    return true;
  }
  
  const hash = crypto
    .createHmac('sha256', LINE_CHANNEL_SECRET)
    .update(body)
    .digest('base64');
  
  return hash === signature;
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
 * イベントからメッセージ内容を取得
 */
function getMessageContent(event: WebhookEvent): string | undefined {
  if (event.type === 'message' && event.message.type === 'text') {
    return event.message.text;
  }
  if (event.type === 'postback') {
    return `postback: ${event.postback.data}`;
  }
  return undefined;
}

/**
 * 統計API
 */
app.get('/api/stats', (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const stats = getForwardStats();
  res.json({
    period: 'last 7 days',
    stats,
  });
});

/**
 * 設定確認API
 */
app.get('/api/config', (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  res.json({
    maTool: process.env.MA_TOOL || 'lstep',
    defaultForward: process.env.DEFAULT_FORWARD || 'ma',
    targets: {
      consultation: process.env.CONSULTATION_BOT_URL ? '✅ configured' : '❌ not set',
      flight: process.env.FLIGHT_BOT_URL ? '✅ configured' : '❌ not set',
      lstep: process.env.LSTEP_WEBHOOK_URL ? '✅ configured' : '❌ not set',
      elme: process.env.ELME_WEBHOOK_URL ? '✅ configured' : '❌ not set',
    },
  });
});

app.listen(PORT, () => {
  console.log(`🔀 Unisia Webhook Proxy running on port ${PORT}`);
  console.log(`📡 Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`🛠️ MA Tool: ${process.env.MA_TOOL || 'lstep'}`);
  console.log(`📍 Default Forward: ${process.env.DEFAULT_FORWARD || 'ma'}`);

  const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
  if (RENDER_URL) {
    const PING_INTERVAL = 10 * 60 * 1000;
    setInterval(async () => {
      try {
        const response = await fetch(`${RENDER_URL}/health`);
        if (response.ok) {
          console.log('💓 Keep-alive ping successful');
        }
      } catch {
        console.log('⚠️ Keep-alive ping failed');
      }
    }, PING_INTERVAL);
    console.log('💓 Keep-alive enabled: pinging every 10 minutes');
  }
});
