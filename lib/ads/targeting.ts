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

import type { RuleCondition } from "@/decision/rules/stored-rule";

export type AdFunnelStage =
  | "awareness" | "consideration" | "intent" | "high_intent" | "customer";

/** Targeting spec stored in ads.targeting. Empty = everyone. */
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
  /** Geo: ISO 3166-1 alpha-2 country codes to allow (case-insensitive). */
  countries?: string[];
  /** Firmographic: only serve to visitors matched to a company. */
  requireCompany?: boolean;
  /** Firmographic: company industry must contain one of these (case-insensitive). */
  industries?: string[];
  /** Firmographic: company size buckets to allow (e.g. "51-200"). */
  companySizes?: string[];
  /**
   * Advanced: a full decision-engine RuleCondition tree (AND/OR/NOT over the
   * platform's rule fields). Evaluated in serveAds against a cost-safe context
   * built from the AdAudience. AND-combined with the simple dimensions above.
   */
  rule?: RuleCondition;
}

/** The visitor's profile: behavioural (visitor_behavior_state) + geo (headers). */
export interface AdAudience {
  keywords:    string[];        // viewed_keywords
  funnelStage: AdFunnelStage;
  pageviews:   number;
  returning:   boolean;         // activity spans more than one calendar day
  /** True when a real behavioural profile row existed (gates behavioural targeting). */
  hasProfile:  boolean;
  /** ISO 3166-1 alpha-2 country (from request geo headers), or null. */
  country:     string | null;
  region:      string | null;
  /** Firmographic company match (IP→company), or null when unknown/unmatched. */
  company:     { name: string | null; industry: string | null; size: string | null } | null;
}

/** True when a spec uses any behavioural dimension (keywords/stage/audience/pageviews). */
export function usesBehaviouralTargeting(t: AdTargeting | null | undefined): boolean {
  if (!t) return false;
  return (Array.isArray(t.interestKeywords) && t.interestKeywords.length > 0)
    || (Array.isArray(t.funnelStages) && t.funnelStages.length > 0)
    || t.audience === "new" || t.audience === "returning"
    || (typeof t.minPageviews === "number" && t.minPageviews > 0);
}

/** True when a spec uses geo (country) targeting. */
export function usesGeoTargeting(t: AdTargeting | null | undefined): boolean {
  return !!t && Array.isArray(t.countries) && t.countries.length > 0;
}

/** True when a spec uses firmographic (company) targeting. */
export function usesFirmographicTargeting(t: AdTargeting | null | undefined): boolean {
  if (!t) return false;
  return t.requireCompany === true
    || (Array.isArray(t.industries) && t.industries.length > 0)
    || (Array.isArray(t.companySizes) && t.companySizes.length > 0);
}

/** True when a spec carries an advanced RuleCondition tree. */
export function usesRuleTargeting(t: AdTargeting | null | undefined): boolean {
  return !!t && !!t.rule && typeof t.rule === "object" && "type" in (t.rule as object);
}

/** True when a targeting spec imposes no constraints (show to everyone). */
export function isUntargeted(t: AdTargeting | null | undefined): boolean {
  return !usesBehaviouralTargeting(t) && !usesGeoTargeting(t)
    && !usesFirmographicTargeting(t) && !usesRuleTargeting(t);
}

/**
 * Whether an audience satisfies a targeting spec.
 * Untargeted ads match everyone (even with no audience). Behavioural dimensions
 * require a real profile (audience.hasProfile); geo requires a resolved country.
 */
export function matchesTargeting(
  targeting: AdTargeting | null | undefined,
  audience:  AdAudience | null | undefined,
): boolean {
  if (isUntargeted(targeting)) return true;
  if (!audience) return false;
  const t = targeting as AdTargeting;

  // Geo (country) — needs a resolved country.
  if (usesGeoTargeting(t)) {
    const want = t.countries!.map((c) => c.toUpperCase().trim()).filter(Boolean);
    if (!audience.country || !want.includes(audience.country.toUpperCase())) return false;
  }

  // Firmographic (company) — needs a resolved company match.
  if (usesFirmographicTargeting(t)) {
    const c = audience.company;
    if (!c) return false;
    if (t.requireCompany && !(c.name || c.industry || c.size)) return false;
    if (Array.isArray(t.industries) && t.industries.length > 0) {
      const ind = (c.industry ?? "").toLowerCase();
      if (!t.industries.some((x) => ind.includes(x.toLowerCase().trim()))) return false;
    }
    if (Array.isArray(t.companySizes) && t.companySizes.length > 0) {
      if (!c.size || !t.companySizes.map((s) => s.trim()).includes(c.size.trim())) return false;
    }
  }

  // Behavioural dimensions require a real behavioural profile.
  if (usesBehaviouralTargeting(t) && !audience.hasProfile) return false;

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

/** True when any of these ads uses firmographic targeting (drives IP→company enrichment). */
export function anyFirmographicAd(ads: ReadonlyArray<{ targeting: unknown }>): boolean {
  return ads.some((a) => usesFirmographicTargeting(parseAdTargeting(a.targeting)));
}

/** True when any of these ads carries an advanced RuleCondition (drives context build). */
export function anyRuleAd(ads: ReadonlyArray<{ targeting: unknown }>): boolean {
  return ads.some((a) => usesRuleTargeting(parseAdTargeting(a.targeting)));
}

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
  if (Array.isArray(r.countries)) {
    const cc = r.countries
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.toUpperCase().trim())
      .filter((x) => /^[A-Z]{2}$/.test(x));
    if (cc.length > 0) out.countries = cc;
  }
  if (r.requireCompany === true) out.requireCompany = true;
  if (Array.isArray(r.industries)) {
    const ind = r.industries.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean);
    if (ind.length > 0) out.industries = ind;
  }
  if (Array.isArray(r.companySizes)) {
    const sz = r.companySizes.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean);
    if (sz.length > 0) out.companySizes = sz;
  }
  // Advanced rule: pass through when it looks like a RuleCondition node.
  // Structural validation happens at evaluation time (evaluateCondition).
  if (r.rule && typeof r.rule === "object" && "type" in (r.rule as object)) {
    out.rule = r.rule as RuleCondition;
  }
  return out;
}
