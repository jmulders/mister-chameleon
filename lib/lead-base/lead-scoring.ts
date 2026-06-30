/**
 * Lead Base — "hotness" score.
 *
 * A composite 0–100 prioritization signal (identity depth + intent + recency +
 * engagement) for "who to act on". Pure + dependency-free so it's shared by the
 * admin list and unit tests. Not a CRM lead score.
 */

import type { IdentityLevel } from "./profile-gate";

export interface ScorableProfile {
  identityLevel: IdentityLevel;
  intentScore:   number | null;
  lastSeenAt:    string | null;
  visitCount:    number;
}

/** Per-tenant scoring tuning: component weight multipliers (default 1) + decay. */
export interface LeadScoreConfig {
  weights?: { level?: number; intent?: number; recency?: number; engagement?: number };
  /** Half-life (days) for time decay of the whole score; 0/undefined = no decay. */
  decayHalfLifeDays?: number;
}

const LEVEL_PTS: Record<IdentityLevel, number> = { anonymous: 0, recognised: 18, known: 30, customer: 40 };

export function leadScore(p: ScorableProfile, now: number = Date.now(), config?: LeadScoreConfig): number {
  const w = config?.weights ?? {};
  const levelPts   = (LEVEL_PTS[p.identityLevel] ?? 0)                          * (w.level      ?? 1);
  const intentPts  = Math.min(40, Math.max(0, (p.intentScore ?? 0)) * 0.4)     * (w.intent     ?? 1);
  const lastSeen   = p.lastSeenAt ? Date.parse(p.lastSeenAt) || 0 : 0;
  const ageDays    = lastSeen ? (now - lastSeen) / 86_400_000 : Infinity;
  const recencyPts = (ageDays < 1 ? 15 : ageDays < 7 ? 9 : ageDays < 30 ? 4 : 0) * (w.recency  ?? 1);
  const engagePts  = Math.min(5, Math.max(0, p.visitCount - 1))                * (w.engagement ?? 1);

  let score = levelPts + intentPts + recencyPts + engagePts;

  // Optional time decay — an old lead cools off (halves every `decayHalfLifeDays`).
  const hl = config?.decayHalfLifeDays ?? 0;
  if (hl > 0 && Number.isFinite(ageDays) && ageDays > 0) score *= Math.pow(0.5, ageDays / hl);

  return Math.round(Math.min(100, Math.max(0, score)));
}

export function scoreClass(score: number): string {
  if (score >= 60) return "bg-red-50 text-red-700";
  if (score >= 35) return "bg-amber-50 text-amber-700";
  return "bg-neutral-100 text-neutral-500";
}
