import { WebhookEvent, MessageEvent, TextMessage } from '@line/bot-sdk';
import { lineClient } from './client.js';
import { generateFlightResponse, extractFlightParams } from '../ai/openai.js';
import { 
  generateGoogleFlightsPrePurchaseEntryUrl, 
  formatSearchDescription,
  generateFlexibleDateSearchUrl,
  formatFlexibleDateDescription,
} from '../flight/google-flights.js';
import { getSafetyInfo, formatSafetyInfo } from '../external/mofa-safety.js';
import { getOrCreateUser, saveSurveyResponse, getSurveyResponse } from '../db/users.js';
import { saveConversation, getConversationHistory } from '../db/conversations.js';
import { 
  SURVEY_PROMPTS, 
  REGION_MAP, 
  AIRPORT_MAP, 
  BUDGET_MAP, 
  PURPOSE_MAP, 
  GOALS_MAP 
} from '../ai/prompts.js';

interface UserState {
  step: 'idle' | 'survey_region' | 'survey_airport' | 'survey_period' | 'survey_budget' | 'survey_purpose' | 'survey_goals' | 'flight_search';
  surveyData?: {
    interestedRegions?: string[];
    departureAirports?: string[];
    travelPeriod?: string;
    budgetRange?: string;
    travelPurpose?: string;
    overseasGoals?: string[];
  };
  flightSearchData?: {
    destination?: string;
    origin?: string;
    departureDate?: string;
    returnDate?: string;
  };
}

const userStates = new Map<string, UserState>();

function getUserState(userId: string): UserState {
  return userStates.get(userId) || { step: 'idle' };
}

function setUserState(userId: string, state: UserState): void {
  userStates.set(userId, state);
}

export async function handleEvent(event: WebhookEvent): Promise<void> {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return;
  }

  const messageEvent = event as MessageEvent;
  const textMessage = messageEvent.message as TextMessage;
  const userId = messageEvent.source.userId;
  
  if (!userId || !lineClient) {
    console.warn('No userId or lineClient');
    return;
  }

  const userMessage = textMessage.text.trim();
  console.log(`📩 Flight Bot received from ${userId}: ${userMessage}`);

  try {
    const user = getOrCreateUser(userId);
    const state = getUserState(userId);
    
    let response: string;
    
    if (userMessage === 'アンケート' || userMessage === '登録' || (!user.surveyCompleted && state.step === 'idle')) {
      setUserState(userId, { step: 'survey_region', surveyData: {} });
      response = SURVEY_PROMPTS.welcome;
    } else if (state.step.startsWith('survey_')) {
      response = await handleSurveyResponse(userId, userMessage, state);
    } else if (userMessage.includes('治安') || userMessage.includes('安全')) {
      response = await handleSafetyQuery(userMessage);
    } else if (userMessage.includes('航空券') || userMessage.includes('フライト') || userMessage.includes('行き')) {
      response = await handleFlightQuery(userId, userMessage);
    } else {
      response = await handleGeneralQuery(userId, userMessage);
    }

    saveConversation({
      lineUserId: userId,
      userMessage,
      botResponse: response,
      timestamp: new Date().toISOString(),
    });

    await lineClient.replyMessage({
      replyToken: messageEvent.replyToken,
      messages: [{ type: 'text', text: response }],
    });

    console.log(`📤 Replied to ${userId}`);
  } catch (error) {
    console.error('Error handling message:', error);
    
    await lineClient.replyMessage({
      replyToken: messageEvent.replyToken,
      messages: [{
        type: 'text',
        text: '申し訳ございません。エラーが発生しました。\nしばらくしてから再度お試しください。',
      }],
    });
  }
}

async function handleSurveyResponse(userId: string, message: string, state: UserState): Promise<string> {
  const surveyData = state.surveyData || {};
  
  switch (state.step) {
    case 'survey_region': {
      const selections = message.split(/[,、\s]+/).map(s => s.trim());
      const regions: string[] = [];
      
      for (const sel of selections) {
        if (REGION_MAP[sel]) {
          regions.push(...REGION_MAP[sel]);
        }
      }
      
      if (regions.length === 0) {
        regions.push(message);
      }
      
      surveyData.interestedRegions = [...new Set(regions)];
      setUserState(userId, { step: 'survey_airport', surveyData });
      return SURVEY_PROMPTS.departureAirport;
    }
    
    case 'survey_airport': {
      const selections = message.split(/[,、\s]+/).map(s => s.trim());
      const airports: string[] = [];
      
      for (const sel of selections) {
        if (AIRPORT_MAP[sel]) {
          airports.push(AIRPORT_MAP[sel]);
        } else {
          airports.push(sel);
        }
      }
      
      surveyData.departureAirports = airports;
      setUserState(userId, { step: 'survey_period', surveyData });
      return SURVEY_PROMPTS.travelPeriod;
    }
    
    case 'survey_period': {
      const periodMap: Record<string, string> = {
        '1': '1ヶ月以内',
        '2': '3ヶ月以内',
        '3': '半年以内',
        '4': '1年以内',
        '5': '未定',
      };
      surveyData.travelPeriod = periodMap[message] || message;
      setUserState(userId, { step: 'survey_budget', surveyData });
      return SURVEY_PROMPTS.budget;
    }
    
    case 'survey_budget': {
      surveyData.budgetRange = BUDGET_MAP[message] || message;
      setUserState(userId, { step: 'survey_purpose', surveyData });
      return SURVEY_PROMPTS.travelPurpose;
    }
    
    case 'survey_purpose': {
      surveyData.travelPurpose = PURPOSE_MAP[message] || message;
      setUserState(userId, { step: 'survey_goals', surveyData });
      return SURVEY_PROMPTS.overseasGoals;
    }
    
    case 'survey_goals': {
      const selections = message.split(/[,、\s]+/).map(s => s.trim());
      const goals: string[] = [];
      
      for (const sel of selections) {
        if (GOALS_MAP[sel]) {
          goals.push(GOALS_MAP[sel]);
        } else {
          goals.push(sel);
        }
      }
      
      surveyData.overseasGoals = goals;
      
      saveSurveyResponse({
        lineUserId: userId,
        interestedRegions: surveyData.interestedRegions || [],
        departureAirports: surveyData.departureAirports || [],
        travelPeriod: surveyData.travelPeriod,
        budgetRange: surveyData.budgetRange,
        travelPurpose: surveyData.travelPurpose,
        overseasGoals: surveyData.overseasGoals?.join(', '),
      });
      
      setUserState(userId, { step: 'idle' });
      return SURVEY_PROMPTS.complete;
    }
    
    default:
      setUserState(userId, { step: 'idle' });
      return '予期しないエラーが発生しました。最初からやり直してください。';
  }
}

async function handleSafetyQuery(message: string): Promise<string> {
  const countries = ['韓国', '台湾', 'タイ', 'ベトナム', 'シンガポール', 'フィリピン', 
                     'インドネシア', 'オーストラリア', 'アメリカ', 'グアム', 'サイパン', 'ハワイ'];
  
  for (const country of countries) {
    if (message.includes(country)) {
      const safetyInfo = await getSafetyInfo(country);
      if (safetyInfo) {
        return formatSafetyInfo(safetyInfo);
      }
    }
  }
  
  return '国名を指定してください。\n例：「韓国の治安」「タイは安全？」';
}

async function handleFlightQuery(userId: string, message: string): Promise<string> {
  const params = await extractFlightParams(message);
  const surveyData = getSurveyResponse(userId);
  
  if (!params?.destination) {
    const history = getConversationHistory(userId, 5);
    return await generateFlightResponse(message, history, { surveyData });
  }
  
  const origin = params.origin || surveyData?.departureAirports?.[0] || '成田';
  const adults = params.adults || params.passengers || 1;
  const children = params.children || 0;
  const infantsOnLap = params.infantsOnLap || 0;
  
  // 曖昧な日付指定の場合（「5月」「5月末」など）
  if (params.isFlexibleDate && params.departureDateStart && params.departureDateEnd) {
    const tripType: 'round_trip' | 'one_way' = params.tripType || 'round_trip';
    const flexibleParams = {
      origin,
      destination: params.destination,
      departureDateStart: params.departureDateStart,
      departureDateEnd: params.departureDateEnd,
      stayDuration: params.stayDuration,
      adults,
      children,
      infantsOnLap,
      tripType,
      cabinClass: 'economy' as const,
    };
    
    const searchUrl = generateFlexibleDateSearchUrl(flexibleParams);
    const description = formatFlexibleDateDescription(flexibleParams);
    
    let response = `✈️ 航空券検索条件（最安値を探す）\n\n${description}\n\n`;
    response += `🔗 この期間の最安値を見る\n${searchUrl}\n\n`;
    response += `💡 日付グリッドで最安値の日程が一目でわかります！\n`;
    response += `火・水曜出発が比較的安いこともあります。`;
    
    return response;
  }
  
  // 具体的な日付指定の場合
  if (params.departureDate) {
    const tripType: 'round_trip' | 'one_way' = params.tripType || (params.returnDate ? 'round_trip' : 'one_way');
    const searchParams = {
      origin,
      destination: params.destination,
      departureDate: params.departureDate,
      returnDate: params.returnDate,
      adults,
      children,
      infantsOnLap,
      tripType,
      cabinClass: 'economy' as const,
    };
    
    const entryUrl = generateGoogleFlightsPrePurchaseEntryUrl(searchParams);
    const description = formatSearchDescription(searchParams);

    let response = `✈️ 航空券検索条件\n\n${description}\n\n`;
    response += `🔗 Google Flights で検索結果を見る\n${entryUrl}\n\n`;
    response += `💡 火・水曜出発が比較的安いこともあります。`;
    
    return response;
  }
  
  const history = getConversationHistory(userId, 5);
  return await generateFlightResponse(message, history, { surveyData });
}

async function handleGeneralQuery(userId: string, message: string): Promise<string> {
  const surveyData = getSurveyResponse(userId);
  const history = getConversationHistory(userId, 5);
  
  return await generateFlightResponse(message, history, { surveyData });
}
