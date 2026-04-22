import { getDatabase } from './index.js';

export interface User {
  id: number;
  lineUserId: string;
  displayName: string | null;
  surveyCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SurveyResponse {
  id: number;
  lineUserId: string;
  interestedRegions: string[];
  departureAirports: string[];
  travelPeriod: string | null;
  budgetRange: string | null;
  travelPurpose: string | null;
  overseasGoals: string | null;
  createdAt: string;
}

export function getOrCreateUser(lineUserId: string, displayName?: string): User {
  const db = getDatabase();
  
  const existing = db.prepare(`
    SELECT * FROM users WHERE line_user_id = ?
  `).get(lineUserId) as any;
  
  if (existing) {
    return {
      id: existing.id,
      lineUserId: existing.line_user_id,
      displayName: existing.display_name,
      surveyCompleted: existing.survey_completed === 1,
      createdAt: existing.created_at,
      updatedAt: existing.updated_at,
    };
  }
  
  const result = db.prepare(`
    INSERT INTO users (line_user_id, display_name)
    VALUES (?, ?)
  `).run(lineUserId, displayName || null);
  
  return {
    id: result.lastInsertRowid as number,
    lineUserId,
    displayName: displayName || null,
    surveyCompleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function saveSurveyResponse(data: {
  lineUserId: string;
  interestedRegions: string[];
  departureAirports: string[];
  travelPeriod?: string;
  budgetRange?: string;
  travelPurpose?: string;
  overseasGoals?: string;
}): void {
  const db = getDatabase();
  
  db.prepare(`
    INSERT INTO survey_responses 
    (line_user_id, interested_regions, departure_airports, travel_period, budget_range, travel_purpose, overseas_goals)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.lineUserId,
    JSON.stringify(data.interestedRegions),
    JSON.stringify(data.departureAirports),
    data.travelPeriod || null,
    data.budgetRange || null,
    data.travelPurpose || null,
    data.overseasGoals || null
  );
  
  db.prepare(`
    UPDATE users SET survey_completed = 1, updated_at = CURRENT_TIMESTAMP
    WHERE line_user_id = ?
  `).run(data.lineUserId);
}

export function getSurveyResponse(lineUserId: string): SurveyResponse | null {
  const db = getDatabase();
  
  const row = db.prepare(`
    SELECT * FROM survey_responses 
    WHERE line_user_id = ? 
    ORDER BY created_at DESC LIMIT 1
  `).get(lineUserId) as any;
  
  if (!row) return null;
  
  return {
    id: row.id,
    lineUserId: row.line_user_id,
    interestedRegions: JSON.parse(row.interested_regions),
    departureAirports: JSON.parse(row.departure_airports),
    travelPeriod: row.travel_period,
    budgetRange: row.budget_range,
    travelPurpose: row.travel_purpose,
    overseasGoals: row.overseas_goals,
    createdAt: row.created_at,
  };
}

export function getUsersByRegion(region: string): User[] {
  const db = getDatabase();
  
  const rows = db.prepare(`
    SELECT u.* FROM users u
    JOIN survey_responses s ON u.line_user_id = s.line_user_id
    WHERE s.interested_regions LIKE ?
    AND u.survey_completed = 1
  `).all(`%"${region}"%`) as any[];
  
  return rows.map((row) => ({
    id: row.id,
    lineUserId: row.line_user_id,
    displayName: row.display_name,
    surveyCompleted: row.survey_completed === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function getAllSurveyedUsers(): User[] {
  const db = getDatabase();
  
  const rows = db.prepare(`
    SELECT * FROM users WHERE survey_completed = 1
  `).all() as any[];
  
  return rows.map((row) => ({
    id: row.id,
    lineUserId: row.line_user_id,
    displayName: row.display_name,
    surveyCompleted: true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}
