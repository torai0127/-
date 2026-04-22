/**
 * Lステップ / エルメ への転送
 * 
 * Lステップ: https://linestep.jp/
 * エルメ: https://elme.me/
 * 
 * どちらもLINE WebhookをそのままフォワードすればOK
 */

import { forwardWebhook, ForwardResult, ForwardRequest } from './base.js';

export interface MAToolConfig {
  tool: 'lstep' | 'elme';
  webhookUrl: string;
  lineChannelSecret?: string;
}

/**
 * Lステップへ転送
 */
export async function forwardToLstep(
  body: any,
  webhookUrl: string,
  lineChannelSecret?: string
): Promise<ForwardResult> {
  console.log(`📤 Forwarding to L-STEP: ${webhookUrl}`);
  
  return forwardWebhook({
    url: webhookUrl,
    body,
    headers: {},
    lineChannelSecret,
  });
}

/**
 * エルメへ転送
 */
export async function forwardToElme(
  body: any,
  webhookUrl: string,
  lineChannelSecret?: string
): Promise<ForwardResult> {
  console.log(`📤 Forwarding to ELME: ${webhookUrl}`);
  
  return forwardWebhook({
    url: webhookUrl,
    body,
    headers: {},
    lineChannelSecret,
  });
}

/**
 * 設定に基づいてMA（Lステップ/エルメ）へ転送
 */
export async function forwardToMA(
  body: any,
  config: MAToolConfig
): Promise<ForwardResult> {
  if (config.tool === 'lstep') {
    return forwardToLstep(body, config.webhookUrl, config.lineChannelSecret);
  } else {
    return forwardToElme(body, config.webhookUrl, config.lineChannelSecret);
  }
}

/**
 * 環境変数からMAツールの設定を取得
 */
export function getMAConfig(): MAToolConfig | null {
  const tool = (process.env.MA_TOOL || 'lstep') as 'lstep' | 'elme';
  
  let webhookUrl: string | undefined;
  
  if (tool === 'lstep') {
    webhookUrl = process.env.LSTEP_WEBHOOK_URL;
  } else {
    webhookUrl = process.env.ELME_WEBHOOK_URL;
  }
  
  if (!webhookUrl) {
    return null;
  }
  
  return {
    tool,
    webhookUrl,
    lineChannelSecret: process.env.LINE_CHANNEL_SECRET,
  };
}
