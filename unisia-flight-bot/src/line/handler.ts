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

/**
 * 完全な航空券検索リクエストかどうか判定
 * （エルメのリッチメニューからのフォーム入力）
 */
function isCompleteFlightRequest(message: string): boolean {
  // 「いきたい地域」と「いきたい時期」または「期間」が含まれている場合
  const hasDestination = message.includes('いきたい地域') || message.includes('行きたい地域');
  const hasTime = message.includes('いきたい時期') || message.includes('行きたい時期') || message.includes('月');
  const hasDuration = message.includes('泊') || message.includes('期間') || message.includes('日間') || message.includes('週間');
  
  // 目的地 + 時期/期間のどちらかがあれば完全なリクエストとみなす
  return hasDestination && (hasTime || hasDuration);
}

/**
 * テキストから直接航空券パラメータを抽出
 */
function extractFlightParamsFromText(message: string): any {
  const result: any = {};
  
  // 目的地を抽出（いきたい地域: ○○ or 行きたい地域: ○○）
  const destMatch = message.match(/(?:いきたい地域|行きたい地域)[:\s：]*([^\n,、]+)/i);
  if (destMatch) {
    result.destination = destMatch[1].trim();
  }
  
  // 出発空港を抽出
  const airportMatch = message.match(/(?:空港|出発)[:\s：]*([^\n,、]+)/i);
  if (airportMatch) {
    result.origin = airportMatch[1].trim().replace('空港', '');
  }
  
  // 時期を抽出
  const timeMatch = message.match(/(?:いきたい時期|行きたい時期|出発時期)[:\s：]*([^\n,、]+)/i);
  if (timeMatch) {
    const timeStr = timeMatch[1].trim();
    result.isFlexibleDate = true;
    
    // 月を抽出
    const monthMatch = timeStr.match(/(\d+)月/);
    if (monthMatch) {
      const month = parseInt(monthMatch[1]);
      const year = new Date().getFullYear();
      const adjustedYear = month < new Date().getMonth() + 1 ? year + 1 : year;
      
      result.departureDateStart = `${adjustedYear}-${month.toString().padStart(2, '0')}-01`;
      result.departureDateEnd = `${adjustedYear}-${month.toString().padStart(2, '0')}-28`;
    }
  }
  
  // 期間を抽出（5泊6日など）
  const durationMatch = message.match(/(\d+)泊(\d+)?日?/);
  if (durationMatch) {
    result.stayDuration = parseInt(durationMatch[2] || durationMatch[1]) + (durationMatch[2] ? 0 : 1);
  }
  
  // 週間を抽出
  const weekMatch = message.match(/(\d+)週間/);
  if (weekMatch) {
    result.stayDuration = parseInt(weekMatch[1]) * 7;
  }
  
  // 人数を抽出
  const peopleMatch = message.match(/(?:人数|合計人数)[:\s：]*(\d+)人?/i);
  if (peopleMatch) {
    result.adults = parseInt(peopleMatch[1]);
  }
  
  // 大人と子供を抽出
  const adultMatch = message.match(/大人\s*(\d+)/);
  const childMatch = message.match(/子供\s*(\d+)/);
  if (adultMatch) {
    result.adults = parseInt(adultMatch[1]);
  }
  if (childMatch) {
    result.children = parseInt(childMatch[1]);
  }
  
  // 「妻・子供」「家族」などのパターン
  if (message.includes('妻') || message.includes('夫') || message.includes('配偶者')) {
    if (!result.adults || result.adults < 2) {
      result.adults = 2;
    }
  }
  if ((message.includes('子供') || message.includes('こども')) && !result.children) {
    result.children = 1;
  }
  
  return result;
}

/**
 * 航空券検索リクエストかどうか判定
 */
function isFlightSearchRequest(message: string): boolean {
  const flightKeywords = [
    '航空券', 'フライト', '行きたい', '行き', 
    'いきたい地域', 'いきたい時期', '期間行きたい',
    '泊', '人数', '大人', '子供', '出発',
    '往復', '片道', '格安', 'チケット',
  ];
  
  return flightKeywords.some(keyword => message.includes(keyword));
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
    
    // エルメからの航空券検索フォーム（全ての条件が揃っている場合）
    if (isCompleteFlightRequest(userMessage)) {
      response = await handleFlightQuery(userId, userMessage);
    } else if (userMessage === 'アンケート' || userMessage === '登録') {
      setUserState(userId, { step: 'survey_region', surveyData: {} });
      response = SURVEY_PROMPTS.welcome;
    } else if (state.step.startsWith('survey_')) {
      response = await handleSurveyResponse(userId, userMessage, state);
    } else if (userMessage.includes('治安') || userMessage.includes('安全')) {
      response = await handleSafetyQuery(userMessage);
    } else if (isFlightSearchRequest(userMessage)) {
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
  // まず直接テキストから情報を抽出を試みる
  const directParams = extractFlightParamsFromText(message);
  
  // OpenAIでも抽出を試みる
  const aiParams = await extractFlightParams(message);
  
  // 両方をマージ（directParamsを優先）
  const params = {
    ...aiParams,
    ...directParams,
    destination: directParams.destination || aiParams?.destination,
    origin: directParams.origin || aiParams?.origin,
  };
  
  const surveyData = getSurveyResponse(userId);
  
  // 目的地が特定できない場合
  if (!params?.destination) {
    return `✈️ 航空券をお探しですね！

以下の情報を教えてください：

・行きたい国/地域
　例）フィリピン、韓国、ハワイ

・出発時期
　例）3月ごろ、GW、夏休み

・滞在期間
　例）5泊6日、1週間

・人数
　例）3人（大人2、子供1）

・出発空港（任意）
　例）福岡、成田、関空

これらをまとめて送っていただければ、最適な航空券検索リンクをお作りします！`;
  }
  
  const origin = params.origin || surveyData?.departureAirports?.[0] || '東京';
  const adults = params.adults || params.passengers || 1;
  const children = params.children || 0;
  const infantsOnLap = params.infantsOnLap || 0;
  const totalPassengers = adults + children;
  
  // 日付情報がない場合は、曖昧な検索として処理
  if (!params.departureDate && !params.departureDateStart) {
    // 滞在期間のみ指定されている場合、直近3ヶ月で検索
    const today = new Date();
    const threeMonthsLater = new Date(today);
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
    
    const tripType: 'round_trip' | 'one_way' = params.tripType || 'round_trip';
    const flexibleParams = {
      origin,
      destination: params.destination,
      departureDateStart: today.toISOString().split('T')[0],
      departureDateEnd: threeMonthsLater.toISOString().split('T')[0],
      stayDuration: params.stayDuration || 7,
      adults,
      children,
      infantsOnLap,
      tripType,
      cabinClass: 'economy' as const,
    };
    
    const searchUrl = generateFlexibleDateSearchUrl(flexibleParams);
    
    let response = `✈️ 航空券検索結果\n\n`;
    response += `📍 ${origin} → ${params.destination}\n`;
    response += `👥 ${totalPassengers}名`;
    if (children > 0) response += `（大人${adults}、子供${children}）`;
    response += `\n`;
    if (params.stayDuration) response += `📅 ${params.stayDuration}日間\n`;
    response += `\n🔗 最安値を探す\n${searchUrl}\n\n`;
    response += `💡 出発時期を教えていただければ、より正確な検索ができます！`;
    
    return response;
  }
  
  // 曖昧な日付指定の場合（「5月」「5月末」など）
  if (params.isFlexibleDate && params.departureDateStart && params.departureDateEnd) {
    const tripType: 'round_trip' | 'one_way' = params.tripType || 'round_trip';
    const flexibleParams = {
      origin,
      destination: params.destination,
      departureDateStart: params.departureDateStart,
      departureDateEnd: params.departureDateEnd,
      stayDuration: params.stayDuration || 7,
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
    response += `火・水曜出発が比較的安いことも多いです。`;
    
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
    response += `💡 火・水曜出発が比較的安いことも多いです。`;
    
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
