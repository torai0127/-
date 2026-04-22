import express from 'express';
import crypto from 'crypto';
import { WebhookEvent } from '@line/bot-sdk';
import dotenv from 'dotenv';
import { handleEvent } from './line/handler.js';
import { isLineConfigured } from './line/client.js';
import { initDatabase } from './db/index.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '';

initDatabase();

app.get('/health', (_, res) => {
  res.json({ 
    status: 'ok', 
    service: 'unisia-consultation-bot',
    lineConfigured: isLineConfigured(),
    timestamp: new Date().toISOString() 
  });
});

// Webhookはrawボディで受け取る（署名検証のため）
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-line-signature'] as string;
  const body = req.body as Buffer;
  
  // 署名検証
  if (LINE_CHANNEL_SECRET && signature) {
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
  
  // すぐに200を返す
  res.json({ success: true });
  
  // 非同期でイベント処理
  for (const event of events) {
    try {
      await handleEvent(event);
    } catch (error) {
      console.error('Event handling error:', error);
    }
  }
});

// その他のエンドポイント用
app.use(express.json());

app.listen(PORT, () => {
  console.log(`🚀 Unisia Consultation Bot running on port ${PORT}`);
  console.log(`📡 Webhook URL: http://localhost:${PORT}/webhook`);
  if (!isLineConfigured()) {
    console.log('⚠️ Running in TEST MODE (LINE credentials not set)');
  }
});
