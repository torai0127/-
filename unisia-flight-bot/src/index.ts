import express from 'express';
import crypto from 'crypto';
import { WebhookEvent } from '@line/bot-sdk';
import dotenv from 'dotenv';
import { handleEvent } from './line/handler.js';
import { isLineConfigured } from './line/client.js';
import { initDatabase } from './db/index.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '';

initDatabase();

app.get('/health', (_, res) => {
  res.json({ 
    status: 'ok', 
    service: 'unisia-flight-bot',
    lineConfigured: isLineConfigured(),
    timestamp: new Date().toISOString() 
  });
});

// Webhookはrawボディとjsonの両方に対応
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  console.log('📨 Webhook received');
  
  let parsedBody;
  
  // リクエストボディがBufferの場合（LINE直接 or proxy経由）
  if (Buffer.isBuffer(req.body)) {
    const body = req.body as Buffer;
    const signature = req.headers['x-line-signature'] as string;
    
    // 署名検証（webhook-proxyからの転送時はスキップ可）
    // X-Forwarded-Fromヘッダーがある場合は内部転送とみなす
    const isInternalForward = req.headers['x-forwarded-from'] === 'unisia-webhook-proxy';
    
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
    
    try {
      parsedBody = JSON.parse(body.toString());
    } catch (e) {
      console.error('❌ Failed to parse body');
      return res.status(400).json({ error: 'Invalid body' });
    }
  } else {
    // JSONとして既にパースされている場合
    parsedBody = req.body;
  }
  
  const events: WebhookEvent[] = parsedBody.events || [];
  console.log(`📨 Received ${events.length} event(s)`);
  
  // すぐに200を返す
  res.json({ success: true });
  
  // 非同期でイベント処理
  for (const event of events) {
    console.log(`🔄 Processing event: ${event.type}`);
    try {
      await handleEvent(event);
      console.log(`✅ Event processed successfully`);
    } catch (error) {
      console.error('❌ Event handling error:', error);
    }
  }
});

app.post('/api/notify/deal', express.json(), async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const { sendDealNotification } = await import('./notification/push.js');
  
  try {
    const result = await sendDealNotification(req.body);
    res.json(result);
  } catch (error) {
    console.error('Notification error:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

app.post('/api/notify/broadcast', express.json(), async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const { sendBroadcast } = await import('./notification/push.js');
  
  try {
    const result = await sendBroadcast(req.body.message);
    res.json(result);
  } catch (error) {
    console.error('Broadcast error:', error);
    res.status(500).json({ error: 'Failed to send broadcast' });
  }
});

app.get('/api/stats', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const { getAllSurveyedUsers } = await import('./db/users.js');
  const users = getAllSurveyedUsers();
  
  res.json({
    totalUsers: users.length,
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`🛫 Unisia Flight Bot running on port ${PORT}`);
  console.log(`📡 Webhook URL: http://localhost:${PORT}/webhook`);
});
