import OpenAI from 'openai';
import { buildPromptWithHistory } from './prompts.js';

if (!process.env.OPENAI_API_KEY) {
  console.warn('⚠️ OPENAI_API_KEY not configured - AI responses will be limited');
}

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

interface ConversationEntry {
  userMessage: string;
  botResponse: string;
}

export async function generateResponse(
  userMessage: string,
  history: ConversationEntry[]
): Promise<string> {
  // OpenAI未設定時のフォールバック応答
  if (!openai) {
    return `ご質問ありがとうございます。\n\n現在、AIアシスタントが設定されていないため、自動応答ができません。\n\n海外渡航に関するご相談は、公式サイトからお問い合わせください。`;
  }

  const formattedHistory = history.flatMap((entry) => [
    { role: 'user' as const, content: entry.userMessage },
    { role: 'assistant' as const, content: entry.botResponse },
  ]);

  const messages = buildPromptWithHistory(userMessage, formattedHistory);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content;
    
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    return response;
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw error;
  }
}
