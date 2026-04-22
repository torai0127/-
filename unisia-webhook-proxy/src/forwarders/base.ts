/**
 * 転送の基底クラス・共通機能
 */

import axios, { AxiosError } from 'axios';
import crypto from 'crypto';

export interface ForwardRequest {
  url: string;
  body: any;
  headers: Record<string, string>;
  lineChannelSecret?: string;
}

export interface ForwardResult {
  success: boolean;
  statusCode?: number;
  responseTimeMs: number;
  error?: string;
}

/**
 * Webhookを転送
 */
export async function forwardWebhook(request: ForwardRequest): Promise<ForwardResult> {
  const startTime = Date.now();
  
  try {
    // LINE署名を再計算（転送先でも検証できるように）
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...request.headers,
    };
    
    // 署名を再生成
    if (request.lineChannelSecret) {
      const body = JSON.stringify(request.body);
      const signature = crypto
        .createHmac('sha256', request.lineChannelSecret)
        .update(body)
        .digest('base64');
      headers['x-line-signature'] = signature;
    }
    
    const response = await axios.post(request.url, request.body, {
      headers,
      timeout: 25000, // 25秒タイムアウト（LINEの制限内）
    });
    
    return {
      success: true,
      statusCode: response.status,
      responseTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    const axiosError = error as AxiosError;
    
    return {
      success: false,
      statusCode: axiosError.response?.status,
      responseTimeMs: Date.now() - startTime,
      error: axiosError.message,
    };
  }
}

/**
 * 複数の転送先に同時転送（フォールバック用）
 */
export async function forwardWithFallback(
  requests: ForwardRequest[]
): Promise<ForwardResult> {
  for (const request of requests) {
    const result = await forwardWebhook(request);
    if (result.success) {
      return result;
    }
    console.warn(`Forward failed to ${request.url}: ${result.error}`);
  }
  
  return {
    success: false,
    responseTimeMs: 0,
    error: 'All forward targets failed',
  };
}
