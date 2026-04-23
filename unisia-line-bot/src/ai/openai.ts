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
    return getDefaultResponse(userMessage);
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
      return getDefaultResponse(userMessage);
    }

    return response;
  } catch (error) {
    console.error('OpenAI API error:', error);
    return getDefaultResponse(userMessage);
  }
}

function getDefaultResponse(userMessage: string): string {
  // キーワードベースのシンプルな応答
  const lowerMessage = userMessage.toLowerCase();
  
  if (lowerMessage.includes('留学')) {
    return `留学についてのご質問ありがとうございます！\n\n詳しいご相談は、担当スタッフが対応いたします。\nしばらくお待ちください。`;
  }
  
  if (lowerMessage.includes('保険')) {
    return `海外保険についてのご質問ですね。\n\n詳しい内容は担当スタッフがご案内いたします。\nしばらくお待ちください。`;
  }
  
  if (lowerMessage.includes('転職') || lowerMessage.includes('就職')) {
    return `帰国後のキャリアについてのご相談ですね。\n\n専門スタッフが対応いたしますので、しばらくお待ちください。`;
  }
  
  if (lowerMessage.includes('緊急') || lowerMessage.includes('助けて')) {
    return `緊急のご連絡ありがとうございます。\n\n担当者が確認次第、すぐにご連絡いたします。\n\n緊急の場合は、現地の日本大使館・領事館にもご連絡ください。`;
  }
  
  return `ご連絡ありがとうございます！\n\nお問い合わせ内容を確認し、担当スタッフより返信させていただきます。\n\nしばらくお待ちください。`;
}
