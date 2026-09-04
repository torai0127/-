import express from 'express';
import crypto from 'crypto';
import { WebhookEvent } from '@line/bot-sdk';
import dotenv from 'dotenv';
import { handleEvent } from './line/handler.js';
import { isLineConfigured, lineClient } from './line/client.js';
import { validateLineToken, getLastTokenValidation } from './line/token-validator.js';
import { initDatabase } from './db/index.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '';

initDatabase();

app.get('/health', async (_, res) => {
  const tokenStatus = await validateLineToken();
  res.json({ 
    status: tokenStatus.valid ? 'ok' : 'degraded',
    service: 'unisia-consultation-bot',
    lineConfigured: isLineConfigured(),
    lineTokenValid: tokenStatus.valid,
    lineTokenError: tokenStatus.error,
    timestamp: new Date().toISOString() 
  });
});

// Webhookはrawボディで受け取る（署名検証のため）
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-line-signature'] as string;
  const body = req.body as Buffer;
  const isInternalForward = req.headers['x-forwarded-from'] === 'unisia-webhook-proxy';
  
  // 署名検証（webhook-proxyからの内部転送はスキップ）
  if (LINE_CHANNEL_SECRET && signature && !isInternalForward) {
    const hash = crypto
      .createHmac('sha256', LINE_CHANNEL_SECRET)
      .update(body)
      .digest('base64');
    
    if (hash !== signature) {
      console.error('❌ Invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }
  
  let parsedBody;
  try {
    parsedBody = JSON.parse(body.toString());
  } catch (e) {
    console.error('❌ Failed to parse body');
    return res.status(400).json({ error: 'Invalid body' });
  }
  
  const events: WebhookEvent[] = parsedBody.events || [];
  console.log(`📨 Received ${events.length} event(s)`);
  
  // 返信トークン失効を防ぐため、処理完了後に200を返す
  for (const event of events) {
    try {
      await handleEvent(event);
    } catch (error) {
      console.error('Event handling error:', error);
    }
  }

  res.json({ success: true });
});

app.post('/api/notify/watch', express.json(), async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const lineUserId = String(req.body?.lineUserId || '').trim();
  const message = String(req.body?.message || '').trim();
  if (!lineUserId || !message) {
    return res.status(400).json({ error: 'lineUserId and message required' });
  }

  if (!lineClient) {
    return res.status(500).json({ error: 'LINE client not configured' });
  }

  let text = message;
  if (text.length > 4900) {
    text = text.slice(0, 4900);
  }

  try {
    await lineClient.pushMessage({
      to: lineUserId,
      messages: [{ type: 'text', text }],
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Watch notification error:', error);
    res.status(500).json({ success: false, error: 'Failed to send notification' });
  }
});

// その他のエンドポイント用
app.use(express.json());

app.listen(PORT, async () => {
  console.log(`🚀 Unisia Consultation Bot running on port ${PORT}`);
  console.log(`📡 Webhook URL: http://localhost:${PORT}/webhook`);
  if (!isLineConfigured()) {
    console.log('⚠️ Running in TEST MODE (LINE credentials not set)');
  } else {
    const tokenStatus = await validateLineToken();
    if (tokenStatus.valid) {
      console.log('✅ LINE token validated successfully');
    } else {
      console.error(`❌ LINE token INVALID: ${tokenStatus.error}`);
    }
  }

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
