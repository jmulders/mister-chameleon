/**
 * Behavioural ad targeting — pure matching.
 *
 * Ads may carry a simple behavioural targeting spec (ads.targeting jsonb). It is
 * evaluated against an AdAudience built from the visitor's journey/interest
 * profile — the behavioural data the advertiser decide branch already captures,
 * no paid enrichment. Pure and unit-tested so the match logic can't drift.
 *
 * An untargeted ad (empty spec) is shown to everyone. A targeted ad requires an
 * audience profile; without one it is not served.
 */

export type AdFunnelStage =
  | "awareness" | "consideration" | "intent" | "high_intent" | "customer";

/** Behavioural targeting spec stored in ads.targeting. Empty = everyone. */
export interface AdTargeting {
  /** Interest keywords to require (compared case-insensitively). */
  interestKeywords?: string[];
  /** "any" (default): at least one keyword matches. "all": every keyword. */
  keywordMatch?: "any" | "all";
  /** Restrict to these funnel stages. */
  funnelStages?: AdFunnelStage[];
  /** "any" (default) | "new" (first visit) | "returning". */
  audience?: "any" | "new" | "returning";
  /** Minimum pageviews in the visitor's history. */
  minPageviews?: number;
}

/** The visitor's behavioural profile, derived from visitor_behavior_state. */
export interface AdAudience {
  keywords:    string[];        // viewed_keywords
  funnelStage: AdFunnelStage;
  pageviews:   number;
  returning:   boolean;         // activity spans more than one calendar day
}

/** True when a targeting spec imposes no constraints (show to everyone). */
export function isUntargeted(t: AdTargeting | null | undefined): boolean {
  if (!t) return true;
  const hasKw    = Array.isArray(t.interestKeywords) && t.interestKeywords.length > 0;
  const hasStage = Array.isArray(t.funnelStages) && t.funnelStages.length > 0;
  const hasAud   = t.audience === "new" || t.audience === "returning";
  const hasMin   = typeof t.minPageviews === "number" && t.minPageviews > 0;
  return !(hasKw || hasStage || hasAud || hasMin);
}

/**
 * Whether an audience satisfies a targeting spec.
 * Untargeted ads match everyone (even with no audience). A targeted ad requires
 * an audience; without one it does not match.
 */
export function matchesTargeting(
  targeting: AdTargeting | null | undefined,
  audience:  AdAudience | null | undefined,
): boolean {
  if (isUntargeted(targeting)) return true;
  if (!audience) return false;
  const t = targeting as AdTargeting;

  if (Array.isArray(t.interestKeywords) && t.interestKeywords.length > 0) {
    const want = t.interestKeywords.map((k) => k.toLowerCase().trim()).filter(Boolean);
    const have = new Set(audience.keywords.map((k) => k.toLowerCase().trim()));
    const ok = t.keywordMatch === "all"
      ? want.every((k) => have.has(k))
      : want.some((k) => have.has(k));
    if (!ok) return false;
  }

  if (Array.isArray(t.funnelStages) && t.funnelStages.length > 0) {
    if (!t.funnelStages.includes(audience.funnelStage)) return false;
  }

  if (t.audience === "new"       && audience.returning)  return false;
  if (t.audience === "returning" && !audience.returning) return false;

  if (typeof t.minPageviews === "number" && t.minPageviews > 0) {
    if (audience.pageviews < t.minPageviews) return false;
  }

  return true;
}

const FUNNEL_STAGES: AdFunnelStage[] = ["awareness", "consideration", "intent", "high_intent", "customer"];

/** Defensively parse an ads.targeting jsonb value into a typed AdTargeting. */
export function parseAdTargeting(raw: unknown): AdTargeting {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: AdTargeting = {};
  if (Array.isArray(r.interestKeywords)) {
    const kws = r.interestKeywords.filter((x): x is string => typeof x === "string");
    if (kws.length > 0) out.interestKeywords = kws;
  }
  if (r.keywordMatch === "all" || r.keywordMatch === "any") out.keywordMatch = r.keywordMatch;
  if (Array.isArray(r.funnelStages)) {
    const st = r.funnelStages.filter((x): x is AdFunnelStage => typeof x === "string" && (FUNNEL_STAGES as string[]).includes(x));
    if (st.length > 0) out.funnelStages = st;
  }
  if (r.audience === "new" || r.audience === "returning" || r.audience === "any") out.audience = r.audience;
  if (typeof r.minPageviews === "number" && r.minPageviews > 0) out.minPageviews = r.minPageviews;
  return out;
}
