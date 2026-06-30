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

const LEVEL_PTS: Record<IdentityLevel, number> = { anonymous: 0, recognised: 18, known: 30, customer: 40 };

export function leadScore(p: ScorableProfile, now: number = Date.now()): number {
  const levelPts   = LEVEL_PTS[p.identityLevel] ?? 0;
  const intentPts  = Math.min(40, Math.max(0, (p.intentScore ?? 0)) * 0.4);
  const lastSeen   = p.lastSeenAt ? Date.parse(p.lastSeenAt) || 0 : 0;
  const ageDays    = lastSeen ? (now - lastSeen) / 86_400_000 : Infinity;
  const recencyPts = ageDays < 1 ? 15 : ageDays < 7 ? 9 : ageDays < 30 ? 4 : 0;
  const engagePts  = Math.min(5, Math.max(0, p.visitCount - 1));
  return Math.round(Math.min(100, levelPts + intentPts + recencyPts + engagePts));
}

export function scoreClass(score: number): string {
  if (score >= 60) return "bg-red-50 text-red-700";
  if (score >= 35) return "bg-amber-50 text-amber-700";
  return "bg-neutral-100 text-neutral-500";
}
