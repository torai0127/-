import express from 'express';
import { middleware, WebhookEvent } from '@line/bot-sdk';
import dotenv from 'dotenv';
import { handleEvent } from './line/handler.js';
import { lineConfig, isLineConfigured } from './line/client.js';
import { initDatabase } from './db/index.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

initDatabase();

app.use(express.json());

app.get('/health', (_, res) => {
  res.json({ 
    status: 'ok', 
    service: 'unisia-consultation-bot',
    lineConfigured: isLineConfigured(),
    timestamp: new Date().toISOString() 
  });
});

// LINE Webhook（認証情報がある場合のみミドルウェア使用）
if (isLineConfigured()) {
  app.post(
    '/webhook',
    middleware(lineConfig),
    async (req, res) => {
      const events: WebhookEvent[] = req.body.events;
      
      try {
        await Promise.all(events.map(handleEvent));
        res.json({ success: true });
      } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );
} else {
  // テストモード（認証なし）
  app.post('/webhook', async (req, res) => {
    console.log('⚠️ Test mode: LINE credentials not configured');
    const events: WebhookEvent[] = req.body.events || [];
    
    try {
      for (const event of events) {
        console.log('📨 Received event:', event.type);
      }
      res.json({ success: true, testMode: true });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}

app.listen(PORT, () => {
  console.log(`🚀 Unisia Consultation Bot running on port ${PORT}`);
  console.log(`📡 Webhook URL: http://localhost:${PORT}/webhook`);
  if (!isLineConfigured()) {
    console.log('⚠️ Running in TEST MODE (LINE credentials not set)');
  }
});
