/**
 * LINE Channel Access Token の有効性を起動時・ヘルスチェックで検証
 */

let lastValidation: { valid: boolean; checkedAt: string; error?: string } | null = null;

export async function validateLineToken(): Promise<{ valid: boolean; error?: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    lastValidation = { valid: false, checkedAt: new Date().toISOString(), error: 'LINE_CHANNEL_ACCESS_TOKEN not set' };
    return lastValidation;
  }

  try {
    const response = await fetch('https://api.line.me/v2/bot/info', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      lastValidation = { valid: true, checkedAt: new Date().toISOString() };
      return { valid: true };
    }

    const body = await response.text();
    const error = `LINE API ${response.status}: ${body.slice(0, 200)}`;
    lastValidation = { valid: false, checkedAt: new Date().toISOString(), error };
    console.error(`❌ LINE token validation failed: ${error}`);
    return { valid: false, error };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    lastValidation = { valid: false, checkedAt: new Date().toISOString(), error: message };
    console.error(`❌ LINE token validation error: ${message}`);
    return { valid: false, error: message };
  }
}

export function getLastTokenValidation() {
  return lastValidation;
}
