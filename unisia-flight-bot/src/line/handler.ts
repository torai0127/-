import { WebhookEvent, MessageEvent, TextMessage } from '@line/bot-sdk';
import { lineClient } from './client.js';
import { generateFlightResponse, extractFlightParams } from '../ai/openai.js';
import { 
  generateGoogleFlightsQueryUrl, 
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
import { 
  compareFlightPrices, 
  formatComparisonResultForLine,
  formatSimpleResultForLine,
  isAnyApiAvailable,
} from '../flight/price-comparator.js';
import {
  searchCheapestHotel,
  formatHotelResultForLine,
  HotelSearchParams,
  isHotelApiAvailable,
} from '../hotel/booking-api.js';
import {
  extractHotelParams,
  createHotelContextFromFlight,
  generateHotelInputTemplate,
  FlightContext,
} from '../hotel/hotel-params.js';
import { generateBookingComUrl } from '../hotel/hotel-deep-links.js';

interface UserState {
  step: 'idle' | 'survey_region' | 'survey_airport' | 'survey_period' | 'survey_budget' | 'survey_purpose' | 'survey_goals' | 'flight_search' | 'hotel_ask' | 'hotel_search';
  timestamp?: number; // 状態が設定された時刻（ミリ秒）
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
  hotelContext?: FlightContext;
  hotelSearchData?: Partial<HotelSearchParams>;
}

const userStates = new Map<string, UserState>();

// ホテル提案のタイムアウト（15分）
const HOTEL_ASK_TIMEOUT_MS = 15 * 60 * 1000;

function getUserState(userId: string): UserState {
  const state = userStates.get(userId);
  if (!state) {
    return { step: 'idle' };
  }
  
  // hotel_ask状態で15分以上経過していたらリセット
  if (state.step === 'hotel_ask' && state.timestamp) {
    const elapsed = Date.now() - state.timestamp;
    if (elapsed > HOTEL_ASK_TIMEOUT_MS) {
      console.log(`⏰ Hotel ask timeout (${Math.round(elapsed / 60000)}min), resetting state`);
      userStates.set(userId, { step: 'idle' });
      return { step: 'idle' };
    }
  }
  
  return state;
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
  
  // 片道/往復を判定
  // テンプレート形式を優先（「片道/往復: 片道」「片道/往復: 往復」）
  const tripTypeMatch = message.match(/(?:片道\/往復|片道・往復|旅程)[:\s：]*([^\n,、]+)/i);
  if (tripTypeMatch) {
    const tripTypeValue = tripTypeMatch[1].trim().toLowerCase();
    if (tripTypeValue.includes('片道') || tripTypeValue === 'one way' || tripTypeValue === 'oneway') {
      result.tripType = 'one_way';
    } else if (tripTypeValue.includes('往復') || tripTypeValue === 'round trip' || tripTypeValue === 'roundtrip') {
      result.tripType = 'round_trip';
    }
  }
  
  // テンプレート形式でなければ、キーワードで判定
  if (!result.tripType) {
    const oneWayKeywords = ['片道', 'かたみち', 'one way', 'oneway', '行きのみ', '行きだけ'];
    const roundTripKeywords = ['往復', 'おうふく', 'round trip', 'roundtrip', '行き帰り'];
    
    const messageNormalized = message.toLowerCase();
    if (oneWayKeywords.some(k => messageNormalized.includes(k))) {
      result.tripType = 'one_way';
    } else if (roundTripKeywords.some(k => messageNormalized.includes(k))) {
      result.tripType = 'round_trip';
    }
  }
  // キーワードがなければデフォルトは往復（handleFlightQueryで設定）
  
  // 目的地を抽出（いきたい地域: ○○ or 行きたい地域: ○○）
  const destMatch = message.match(/(?:いきたい地域|行きたい地域)[:\s：]*([^\n,、]+)/i);
  if (destMatch) {
    result.destination = destMatch[1].trim();
  }
  
  // 出発空港を抽出（「出発空港」「空港」パターンに対応）
  const airportMatch = message.match(/(?:出発空港|空港)[:\s：]*([^\n,、]+)/i);
  if (airportMatch) {
    // コロンやスペースを除去して空港名のみ取得
    let airport = airportMatch[1].trim();
    // 先頭の「:」「：」を除去
    airport = airport.replace(/^[:\s：]+/, '').trim();
    // 「空港」を除去
    airport = airport.replace(/空港$/, '').trim();
    if (airport) {
      result.origin = airport;
    }
  }
  
  // 時期を抽出
  const timeMatch = message.match(/(?:いきたい時期|行きたい時期|出発時期)[:\s：]*([^\n,、]+)/i);
  if (timeMatch) {
    const timeStr = timeMatch[1].trim();
    const year = new Date().getFullYear();
    
    // パターン1: 具体的な日付範囲（○月○日〜○日、○月○〜○、○月○日〜○月○日）
    // 例: 「5月24〜25」「5月24日〜25日」「5月24〜25日」「5月24日〜6月1日」
    const dateRangeMatch = timeStr.match(/(\d+)月\s*(\d+)日?\s*[〜~ー－\-]+\s*(?:(\d+)月\s*)?(\d+)日?/);
    if (dateRangeMatch) {
      const startMonth = parseInt(dateRangeMatch[1]);
      const startDay = parseInt(dateRangeMatch[2]);
      const endMonth = dateRangeMatch[3] ? parseInt(dateRangeMatch[3]) : startMonth;
      const endDay = parseInt(dateRangeMatch[4]);
      
      const startAdjustedYear = startMonth < new Date().getMonth() + 1 ? year + 1 : year;
      const endAdjustedYear = endMonth < startMonth ? startAdjustedYear + 1 : startAdjustedYear;
      
      result.departureDate = `${startAdjustedYear}-${startMonth.toString().padStart(2, '0')}-${startDay.toString().padStart(2, '0')}`;
      result.returnDate = `${endAdjustedYear}-${endMonth.toString().padStart(2, '0')}-${endDay.toString().padStart(2, '0')}`;
      result.isFlexibleDate = false;
    }
    // パターン2: 具体的な出発日のみ（○月○日）
    else {
      const fullDateMatch = timeStr.match(/(\d+)月\s*(\d+)日/);
      if (fullDateMatch) {
        const month = parseInt(fullDateMatch[1]);
        const day = parseInt(fullDateMatch[2]);
        const adjustedYear = month < new Date().getMonth() + 1 ? year + 1 : year;
        
        result.departureDate = `${adjustedYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        result.isFlexibleDate = false;
      }
      // パターン3: 抽象的な期間（○月、○月上旬、○月末など）
      else {
        const monthMatch = timeStr.match(/(\d+)月/);
        if (monthMatch) {
          const month = parseInt(monthMatch[1]);
          const adjustedYear = month < new Date().getMonth() + 1 ? year + 1 : year;
          const lastDay = new Date(adjustedYear, month, 0).getDate();
          
          if (timeStr.includes('上旬') || timeStr.includes('頭') || timeStr.includes('初め') || timeStr.includes('初旬')) {
            result.departureDateStart = `${adjustedYear}-${month.toString().padStart(2, '0')}-01`;
            result.departureDateEnd = `${adjustedYear}-${month.toString().padStart(2, '0')}-10`;
            result.dateRangeLabel = '上旬';
          } else if (timeStr.includes('中旬') || timeStr.includes('半ば')) {
            result.departureDateStart = `${adjustedYear}-${month.toString().padStart(2, '0')}-11`;
            result.departureDateEnd = `${adjustedYear}-${month.toString().padStart(2, '0')}-20`;
            result.dateRangeLabel = '中旬';
          } else if (timeStr.includes('下旬') || timeStr.includes('末') || timeStr.includes('終わり')) {
            result.departureDateStart = `${adjustedYear}-${month.toString().padStart(2, '0')}-21`;
            result.departureDateEnd = `${adjustedYear}-${month.toString().padStart(2, '0')}-${lastDay}`;
            result.dateRangeLabel = '下旬';
          } else {
            result.departureDateStart = `${adjustedYear}-${month.toString().padStart(2, '0')}-01`;
            result.departureDateEnd = `${adjustedYear}-${month.toString().padStart(2, '0')}-${lastDay}`;
            result.dateRangeLabel = '';
          }
          result.isFlexibleDate = true;
        }
      }
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
 * メッセージからフライト検索コンテキストを抽出（ホテル検索用）
 */
function extractFlightContextFromMessage(message: string): FlightContext | null {
  const params = extractFlightParamsFromText(message);
  
  if (!params.destination) {
    return null;
  }
  
  // 出発日を決定
  let departureDate: string;
  let returnDate: string | undefined;
  
  if (params.departureDate) {
    departureDate = params.departureDate;
    returnDate = params.returnDate;
  } else if (params.departureDateStart && params.departureDateEnd) {
    // 抽象的な日付の場合は期間の中央
    const start = new Date(params.departureDateStart);
    const end = new Date(params.departureDateEnd);
    const mid = new Date((start.getTime() + end.getTime()) / 2);
    departureDate = mid.toISOString().split('T')[0];
    
    // 滞在日数があれば帰国日を計算
    if (params.stayDuration) {
      const ret = new Date(mid);
      ret.setDate(ret.getDate() + params.stayDuration - 1);
      returnDate = ret.toISOString().split('T')[0];
    }
  } else {
    // 日付情報がない場合は1ヶ月後
    const today = new Date();
    today.setMonth(today.getMonth() + 1);
    departureDate = today.toISOString().split('T')[0];
  }
  
  return {
    destination: params.destination,
    departureDate,
    returnDate,
    passengers: params.adults || 1,
  };
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
  // hotel_ask状態の場合はタイムスタンプを記録（タイムアウト管理用）
  if (state.step === 'hotel_ask') {
    state.timestamp = Date.now();
  }
  userStates.set(userId, state);
}

/**
 * 航空券検索の入力テンプレートを表示するキーワード
 */
function isFlightTemplateRequest(message: string): boolean {
  const templateKeywords = [
    '航空券',
    '航空券検索',
    'フライト検索',
    '飛行機',
    '飛行機検索',
  ];
  
  // 完全一致または末尾一致（「航空券を探して」などは除く）
  return templateKeywords.some(keyword => 
    message === keyword || 
    message === keyword + '検索' ||
    message === keyword + 'を検索'
  );
}

/**
 * 航空券検索の入力テンプレートを生成
 */
function getFlightSearchTemplate(): string {
  return `✈️ 航空券検索

下のテンプレートをコピーして、
必要な情報を入力してください👇

━━━━━━━━━━━━━━━

いきたい地域: 
いきたい時期: 
期間: 
人数: 
出発空港: 
片道/往復: 

━━━━━━━━━━━━━━━

【入力例①】往復の場合

いきたい地域: フィリピン
いきたい時期: 6月15日〜20日
期間: 5泊6日
人数: 2人（大人2）
出発空港: 福岡
片道/往復: 往復

━━━━━━━━━━━━━━━

【入力例②】片道の場合

いきたい地域: 韓国
いきたい時期: 7月1日
人数: 1人
出発空港: 成田
片道/往復: 片道

━━━━━━━━━━━━━━━

💡 入力のコツ
・地域は国名or都市名でOK
・時期は「5月」「GW」など曖昧でもOK
・人数は「大人2、子供1」のように詳しく書くと正確です
・片道/往復を省略した場合は「往復」として検索`;
}

export async function handleEvent(event: WebhookEvent): Promise<void> {
  // Postbackイベントの処理（リッチメニュータップ時）
  if (event.type === 'postback') {
    const postbackEvent = event as any;
    const userId = postbackEvent.source.userId;
    const data = postbackEvent.postback?.data || '';
    
    if (!userId || !lineClient) {
      console.warn('No userId or lineClient for postback');
      return;
    }
    
    console.log(`📩 Postback received from ${userId}: ${data}`);
    
    let response: string;
    
    // 航空券検索のpostback
    if (data === 'action=flight_search' || data.includes('flight')) {
      response = getFlightSearchTemplate();
    } else {
      response = 'メニューを選択してください。';
    }
    
    await lineClient.replyMessage({
      replyToken: postbackEvent.replyToken,
      messages: [{ type: 'text', text: response }],
    });
    
    return;
  }
  
  if (event.type !== 'message' || event.message.type !== 'text') {
    return;
  }

  const messageEvent = event as MessageEvent;
  const textMessage = messageEvent.message as TextMessage;
  const userId = messageEvent.source.userId;
  
  if (!userId) {
    console.warn('⚠️ No userId in event');
    return;
  }
  
  if (!lineClient) {
    console.error('❌ LINE client not initialized! Check LINE_CHANNEL_ACCESS_TOKEN');
    return;
  }

  const userMessage = textMessage.text.trim();
  console.log(`📩 Flight Bot received from ${userId}: ${userMessage.substring(0, 50)}...`);

  try {
    console.log('📝 Processing message...');
    const user = getOrCreateUser(userId);
    const state = getUserState(userId);
    
    let response: string;
    
    // 航空券検索のリクエストは常に優先（ホテル検索中でも）
    // リッチメニューから「航空券」とだけ送られた場合 → テンプレート表示
    if (isFlightTemplateRequest(userMessage)) {
      console.log('📋 Template request detected (resetting hotel state)');
      setUserState(userId, { step: 'idle' }); // ホテル状態をリセット
      response = getFlightSearchTemplate();
    }
    // エルメからの航空券検索フォーム（全ての条件が揃っている場合）
    else if (isCompleteFlightRequest(userMessage)) {
      console.log('✈️ Complete flight request detected');
      const flightResult = await handleFlightQuery(userId, userMessage);
      
      // フライト検索が成功したらホテル提案を追加
      const flightContext = extractFlightContextFromMessage(userMessage);
      if (flightContext) {
        setUserState(userId, { step: 'hotel_ask', hotelContext: flightContext });
        response = flightResult + generateHotelOfferMessage();
      } else {
        response = flightResult;
      }
      console.log('📤 Flight response ready:', response.substring(0, 100) + '...');
    } else if (userMessage === 'アンケート' || userMessage === '登録') {
      setUserState(userId, { step: 'survey_region', surveyData: {} });
      response = SURVEY_PROMPTS.welcome;
    } else if (state.step.startsWith('survey_')) {
      response = await handleSurveyResponse(userId, userMessage, state);
    } else if (userMessage.includes('治安') || userMessage.includes('安全')) {
      response = await handleSafetyQuery(userMessage);
    } else if (isFlightSearchRequest(userMessage)) {
      // 航空券検索キーワードがある場合はホテル状態をリセット
      setUserState(userId, { step: 'idle' });
      const flightResult = await handleFlightQuery(userId, userMessage);
      
      // フライト検索が成功したらホテル提案を追加
      const flightContext = extractFlightContextFromMessage(userMessage);
      if (flightContext) {
        setUserState(userId, { step: 'hotel_ask', hotelContext: flightContext });
        response = flightResult + generateHotelOfferMessage();
      } else {
        response = flightResult;
      }
    }
    // ホテル提案への応答をチェック（hotel_ask状態で「はい」「いいえ」のみ）
    else if (state.step === 'hotel_ask') {
      if (isHotelAffirmative(userMessage)) {
        console.log('🏨 Hotel affirmative response');
        const context = state.hotelContext;
        if (context) {
          setUserState(userId, { 
            step: 'hotel_search', 
            hotelContext: context,
            hotelSearchData: createHotelContextFromFlight(context),
          });
          response = generateHotelInputTemplate(context);
        } else {
          setUserState(userId, { step: 'hotel_search' });
          response = generateHotelInputTemplate();
        }
      } else if (isHotelNegative(userMessage)) {
        console.log('🏨 Hotel declined');
        setUserState(userId, { step: 'idle' });
        response = '承知しました！\n\n他にご質問がありましたらお気軽にどうぞ 😊';
      } else {
        // 「はい」「いいえ」以外の場合は状態をリセットして通常処理
        console.log('🔄 Resetting hotel_ask state, processing as general query');
        setUserState(userId, { step: 'idle' });
        response = await handleGeneralQuery(userId, userMessage);
      }
    }
    // ホテル検索中（hotel_search状態の場合）
    else if (state.step === 'hotel_search') {
      console.log('🏨 Hotel search in progress');
      response = await handleHotelQuery(userId, userMessage, state.hotelContext);
    } else {
      response = await handleGeneralQuery(userId, userMessage);
    }

    saveConversation({
      lineUserId: userId,
      userMessage,
      botResponse: response,
      timestamp: new Date().toISOString(),
    });

    console.log(`📤 Sending reply to ${userId}...`);
    console.log(`📄 Response length: ${response.length} chars`);
    
    try {
      await lineClient.replyMessage({
        replyToken: messageEvent.replyToken,
        messages: [{ type: 'text', text: response }],
      });
      console.log(`✅ Reply sent successfully to ${userId}`);
    } catch (replyError) {
      console.error('❌ Failed to send reply:', replyError);
      throw replyError;
    }
  } catch (error) {
    console.error('❌ Error handling message:', error);
    
    try {
      await lineClient.replyMessage({
        replyToken: messageEvent.replyToken,
        messages: [{
          type: 'text',
          text: '申し訳ございません。エラーが発生しました。\nしばらくしてから再度お試しください。',
        }],
      });
    } catch (e) {
      console.error('❌ Failed to send error message:', e);
    }
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
  console.log('🔍 handleFlightQuery started');
  
  // まず直接テキストから情報を抽出を試みる
  const directParams = extractFlightParamsFromText(message);
  console.log('📋 Direct params:', JSON.stringify(directParams));
  
  // OpenAIでも抽出を試みる（失敗してもdirectParamsで続行）
  let aiParams: any = {};
  try {
    aiParams = await extractFlightParams(message);
    console.log('🤖 AI params:', JSON.stringify(aiParams));
  } catch (error) {
    console.warn('⚠️ OpenAI extraction failed, using direct params only:', error);
  }
  
  // 両方をマージ（directParamsを優先）
  const params = {
    ...aiParams,
    ...directParams,
    destination: directParams.destination || aiParams?.destination,
    origin: directParams.origin || aiParams?.origin,
  };
  console.log('📦 Merged params:', JSON.stringify(params));
  
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
  const tripType: 'round_trip' | 'one_way' = params.tripType || 'round_trip';
  const isOneWay = tripType === 'one_way';
  
  // 滞在日数を計算（returnDateがある場合はそこから計算）- 片道の場合は不要
  let stayDuration: number = 7;
  if (!isOneWay) {
    if (params.returnDate && params.departureDate) {
      const dep = new Date(params.departureDate);
      const ret = new Date(params.returnDate);
      stayDuration = Math.ceil((ret.getTime() - dep.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    } else {
      stayDuration = params.stayDuration || 7;
    }
  }
  
  // 出発日・帰国日を決定
  let departureDate: string;
  let returnDate: string | undefined;
  
  // 抽象的な日付（「5月」「5月末」など）の場合は、期間の中央を出発日とする
  if (params.isFlexibleDate && params.departureDateStart && params.departureDateEnd) {
    const startDateObj = new Date(params.departureDateStart);
    const endDateObj = new Date(params.departureDateEnd);
    const midDate = new Date((startDateObj.getTime() + endDateObj.getTime()) / 2);
    departureDate = midDate.toISOString().split('T')[0];
    
    // 片道の場合は帰国日を設定しない
    if (!isOneWay) {
      const retDate = new Date(midDate);
      retDate.setDate(retDate.getDate() + stayDuration - 1);
      returnDate = retDate.toISOString().split('T')[0];
    }
  } else if (params.departureDate) {
    departureDate = params.departureDate;
    // 片道の場合は帰国日を設定しない
    if (!isOneWay) {
      if (params.returnDate) {
        returnDate = params.returnDate;
      } else {
        const depDate = new Date(departureDate);
        depDate.setDate(depDate.getDate() + stayDuration - 1);
        returnDate = depDate.toISOString().split('T')[0];
      }
    }
  } else {
    // 日付情報がない場合、1ヶ月後を出発日とする
    const today = new Date();
    today.setMonth(today.getMonth() + 1);
    departureDate = today.toISOString().split('T')[0];
    
    // 片道の場合は帰国日を設定しない
    if (!isOneWay) {
      const retDate = new Date(today);
      retDate.setDate(retDate.getDate() + stayDuration - 1);
      returnDate = retDate.toISOString().split('T')[0];
    }
  }
  
  // 検索パラメータを構築
  const searchParams = {
    origin,
    destination: params.destination,
    departureDate,
    returnDate,
    adults,
    children,
    infantsOnLap,
    tripType,
    cabinClass: 'economy' as const,
  };
  
  // いずれかのAPIが利用可能な場合は内部比較を実行
  if (isAnyApiAvailable()) {
    console.log('🔍 Starting multi-API price comparison...');
    
    try {
      const comparisonResult = await compareFlightPrices(searchParams);
      return formatComparisonResultForLine(comparisonResult);
    } catch (error) {
      console.error('Price comparison failed, falling back to simple result:', error);
      return formatSimpleResultForLine(searchParams);
    }
  }
  
  // APIが利用不可の場合はGoogle Flightsリンクのみ返す
  return formatSimpleResultForLine(searchParams);
}

async function handleGeneralQuery(userId: string, message: string): Promise<string> {
  const surveyData = getSurveyResponse(userId);
  const history = getConversationHistory(userId, 5);
  
  return await generateFlightResponse(message, history, { surveyData });
}

/**
 * ホテル検索の質問に対する応答を処理
 */
function isHotelAffirmative(message: string): boolean {
  const affirmatives = ['はい', 'お願い', 'yes', 'ホテル', 'ほてる', 'する', 'したい', '予約', 'うん', 'ええ', 'いいね'];
  const normalized = message.toLowerCase().trim();
  return affirmatives.some(a => normalized.includes(a));
}

function isHotelNegative(message: string): boolean {
  const negatives = ['いいえ', 'いや', 'いらない', '不要', 'no', 'やめ', '大丈夫', '結構', 'しない'];
  const normalized = message.toLowerCase().trim();
  return negatives.some(n => normalized.includes(n));
}

/**
 * ホテル検索クエリを処理
 */
async function handleHotelQuery(userId: string, message: string, context?: FlightContext): Promise<string> {
  console.log('🏨 handleHotelQuery started');
  
  const state = getUserState(userId);
  const existingParams = state.hotelSearchData || {};
  
  // コンテキストからデフォルト値を設定
  if (context) {
    existingParams.location = existingParams.location || context.destination;
    existingParams.checkIn = existingParams.checkIn || context.departureDate;
    existingParams.checkOut = existingParams.checkOut || context.returnDate;
    existingParams.adults = existingParams.adults || context.passengers;
  }
  
  // パラメータ抽出を試みる
  let extractedParams;
  try {
    extractedParams = await extractHotelParams(message, existingParams);
    console.log('🏨 Extracted hotel params:', JSON.stringify(extractedParams));
  } catch (error) {
    console.warn('⚠️ Hotel param extraction failed:', error);
    const missingFields: string[] = [];
    if (!existingParams.location) missingFields.push('location');
    if (!existingParams.checkIn) missingFields.push('checkIn');
    if (!existingParams.checkOut) missingFields.push('checkOut');
    
    extractedParams = {
      ...existingParams,
      location: existingParams.location || '',
      checkIn: existingParams.checkIn || '',
      checkOut: existingParams.checkOut || '',
      adults: existingParams.adults || 1,
      isComplete: false,
      missingFields,
    };
  }
  
  // 必須情報が揃っていない場合
  if (!extractedParams.isComplete && extractedParams.missingFields.length > 0) {
    // パラメータを保存して次回に引き継ぐ
    const paramsToSave: Partial<HotelSearchParams> = {
      location: extractedParams.location,
      checkIn: extractedParams.checkIn,
      checkOut: extractedParams.checkOut,
      adults: extractedParams.adults,
      rooms: extractedParams.rooms,
      children: extractedParams.children,
      stars: extractedParams.stars,
      maxPrice: extractedParams.maxPrice,
    };
    
    setUserState(userId, {
      ...state,
      step: 'hotel_search',
      hotelSearchData: paramsToSave,
      hotelContext: context,
    });
    
    let response = '🏨 ホテル検索\n\n';
    response += '以下の情報を教えてください:\n\n';
    
    if (extractedParams.missingFields.includes('location')) {
      response += '📍 宿泊先の都市\n';
      response += '　 例）バンクーバー、ソウル、バリ\n\n';
    }
    if (extractedParams.missingFields.includes('checkIn')) {
      response += '📅 チェックイン日\n';
      response += '　 例）5月15日、2024-05-15\n\n';
    }
    if (extractedParams.missingFields.includes('checkOut')) {
      response += '📅 チェックアウト日\n';
      response += '　 例）5月20日、5泊\n\n';
    }
    
    response += '💡 オプション（任意）:\n';
    response += '・星評価: 3つ星以上\n';
    response += '・予算: 1泊15000円まで';
    
    return response;
  }
  
  // パラメータが揃っているので検索実行
  setUserState(userId, { step: 'idle' });
  
  const searchParams: HotelSearchParams = {
    location: extractedParams.location || '',
    checkIn: extractedParams.checkIn || '',
    checkOut: extractedParams.checkOut || '',
    adults: extractedParams.adults || 1,
    rooms: extractedParams.rooms || 1,
    children: extractedParams.children || 0,
    stars: extractedParams.stars,
    maxPrice: extractedParams.maxPrice,
  };
  
  console.log('🔍 Searching for cheapest hotel...');
  
  const result = await searchCheapestHotel(searchParams);
  return formatHotelResultForLine(result, searchParams);
}

/**
 * ホテル提案メッセージを生成
 */
function generateHotelOfferMessage(): string {
  return `\n\n━━━━━━━━━━━━━━━\n\n🏨 ホテルは予約されますか？\n\n「はい」と返信すると、\n最安値のホテルをお探しします！`;
}
