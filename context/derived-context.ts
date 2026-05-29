/**
 * Derived Context
 *
 * Computed signals derived from one or more other context layers
 * (enrichment, time, history, request).  No I/O — pure computation.
 *
 * These variables live in their own "derived" source layer, keeping them
 * separate from raw enrichment data and first-party history signals.
 * They are available to both the rules engine and AI providers.
 *
 * ─── Variable groups ──────────────────────────────────────────────────────────
 *
 *   Time derived      — daySegment, isWorkHours, isHoliday, season
 *   Weather derived   — isBadWeather, temperatureBucket
 *   Company derived   — companyType, industryGroup
 *   Campaign context  — channelGroup, campaignType, isRetargetedUser
 *   Behavior          — engagementScore, pagesVisited
 *   Funnel/lifecycle  — funnelStage, visitDepth
 *   Intent signals    — contentInterestCategory, isResearching, isReadyToConvert, primaryInterest
 *
 * ─── Computation ─────────────────────────────────────────────────────────────
 *
 *   `computeDerivedContext(ctx)` is a pure function that accepts a
 *   RuleEvaluationContext (after enrichment and time are populated) and
 *   returns a Partial<DerivedContext>.  A field is null when the input
 *   signals needed to compute it are unavailable.
 *
 * ─── Dependency order ────────────────────────────────────────────────────────
 *
 *   Derived context MUST be computed AFTER enrichment has been merged into
 *   the context, since weather-derived and company-derived fields read from
 *   `ctx.enrichment`.  Call `computeDerivedContext` at the very end of
 *   `buildDecisionContext`, after the enrichment pipeline and time context
 *   are both fully assembled.
 *
 * ─── Safety ───────────────────────────────────────────────────────────────────
 *
 *   Never throws — all computations guard against null/undefined inputs.
 *   A null value means "not enough data to derive this signal", which is
 *   distinct from a rule-relevant false or 0.
 */

import type { RuleEvaluationContext } from "@/decision/rules/field-registry";
import type { EnrichmentOutput }      from "@/enrichment/types";

// ── Derived enum types ─────────────────────────────────────────────────────────

/** Granular time-of-day bucket. Finer than `timeOfDay` (which uses 4 buckets). */
export type DaySegment =
  | "early-morning"  // 00:00–05:59
  | "morning"        // 06:00–08:59
  | "midday"         // 09:00–12:59
  | "afternoon"      // 13:00–17:59
  | "evening"        // 18:00–21:59
  | "night";         // 22:00–23:59

/** Calendar season derived from the current month. */
export type Season = "spring" | "summer" | "autumn" | "winter";

/** Bucketed temperature label derived from the raw weather temperature. */
export type TemperatureBucket = "freezing" | "cold" | "mild" | "warm" | "hot";

/** Company size segment derived from companySize enrichment field. */
export type CompanyType = "enterprise" | "mid-market" | "smb" | "startup" | "unknown";

/** Broad industry group derived from companyIndustry / crmIndustry enrichment fields. */
export type IndustryGroup =
  | "tech"
  | "finance"
  | "healthcare"
  | "manufacturing"
  | "retail"
  | "professional-services"
  | "other";

/** Marketing channel group derived from UTM parameters and traffic source. */
export type ChannelGroup =
  | "paid-search"
  | "paid-social"
  | "organic-search"
  | "organic-social"
  | "email"
  | "direct"
  | "referral"
  | "other";

/** Campaign intent category derived from UTM medium and campaign name. */
export type CampaignType =
  | "brand"
  | "demand-gen"
  | "retargeting"
  | "content"
  | "event"
  | "other"
  | "unknown";

/** Visitor funnel stage derived from history, CRM lifecycle, and intent signals. */
export type FunnelStage = "awareness" | "consideration" | "intent" | "decision";

/** Page content interest category derived from pathname and pageType. */
export type ContentInterestCategory =
  | "homepage"
  | "product"
  | "pricing"
  | "content"
  | "about"
  | "other";

// ── DerivedContext interface ────────────────────────────────────────────────────

/**
 * Computed context signals derived from other layers.
 *
 * All fields are nullable — null means "not enough data to compute this signal".
 * Consumers should treat null as "unknown", not as false/0.
 */
export interface DerivedContext {
  // ── Time derived ──────────────────────────────────────────────────────────

  /**
   * Granular time-of-day bucket in tenant local time.
   * Finer than `timeOfDay` (6 buckets vs 4).
   * null when currentHour is unavailable.
   */
  daySegment: DaySegment | null;

  /**
   * True on weekdays between 09:00 and 17:59 in tenant local time.
   * Useful for distinguishing B2B business-hours traffic from personal browsing.
   * null when currentHour or isWeekend is unavailable.
   */
  isWorkHours: boolean | null;

  /**
   * True when a seasonal event is currently active (seasonalEvent ≠ "none").
   * null when seasonalEvent is unavailable.
   */
  isHoliday: boolean | null;

  /**
   * Meteorological season in the tenant's local timezone.
   * null when month is unavailable.
   */
  season: Season | null;

  // ── Weather derived ────────────────────────────────────────────────────────

  /**
   * True when weather conditions are adverse: active precipitation, strong wind
   * (> 40 km/h), or very heavy cloud cover (> 85 %).
   * null when weather enrichment has not run.
   */
  isBadWeather: boolean | null;

  /**
   * Human-readable temperature bucket derived from temperatureNow.
   *   freezing — below 0 °C
   *   cold     — 0–9 °C
   *   mild     — 10–19 °C
   *   warm     — 20–29 °C
   *   hot      — 30 °C and above
   * null when weather enrichment has not run.
   */
  temperatureBucket: TemperatureBucket | null;

  // ── Company derived ────────────────────────────────────────────────────────

  /**
   * Company size segment derived from the `companySize` enrichment field.
   *   startup      — 1–50 employees
   *   smb          — 51–200 employees
   *   mid-market   — 201–1 000 employees
   *   enterprise   — 1 001+ employees
   *   unknown      — companySize is null or does not match a known pattern
   * null when no company was identified.
   */
  companyType: CompanyType | null;

  /**
   * Broad industry group derived from `companyIndustry` or `crmIndustry`.
   * null when no industry information is available.
   */
  industryGroup: IndustryGroup | null;

  // ── Campaign context ───────────────────────────────────────────────────────

  /**
   * Marketing channel group derived from UTM medium, UTM source, and traffic source.
   *   paid-search    — cpc / ppc / paid medium
   *   paid-social    — paid_social or social paid medium
   *   organic-search — organic / google source without paid medium
   *   organic-social — social / twitter / linkedin without paid medium
   *   email          — email / newsletter medium
   *   direct         — direct source (no referrer, no UTM)
   *   referral       — referrer with no UTM
   *   other          — everything else
   */
  channelGroup: ChannelGroup | null;

  /**
   * Campaign intent category derived from UTM medium and campaign name.
   *   brand        — campaign name contains "brand" or branded keywords
   *   demand-gen   — cpc / ppc medium without retargeting signal
   *   retargeting  — medium or campaign contains retargeting / remarketing
   *   content      — content / blog / resource medium
   *   event        — campaign name contains "event" or "webinar"
   *   other        — has UTM but doesn't fit above patterns
   *   unknown      — no UTM parameters present
   */
  campaignType: CampaignType | null;

  /**
   * True when the visitor has been here before (visitType = "returning"
   * or pageViewCount > 0).  Useful for retargeting-aware messaging.
   */
  isRetargetedUser: boolean | null;

  // ── Behavior & Engagement ──────────────────────────────────────────────────

  /**
   * Composite engagement score from 0 to 100.
   *
   * Components (all capped before summing):
   *   - Page views       : min(pageViewCount × 10, 40) — 0–40 pts
   *   - CTA interaction  : min(ctaClickCount × 15, 30) — 0–30 pts
   *   - Returning visitor: 20 pts when visitType = "returning"
   *   - Time signal      : 10 pts when daysSinceFirstSeen > 0
   *   Total capped at 100.
   */
  engagementScore: number | null;

  /**
   * Number of pages visited in this session (mirrors history.pageViewCount).
   * Exposed as a derived variable for AI context clarity.
   */
  pagesVisited: number | null;

  // ── Funnel & Lifecycle ────────────────────────────────────────────────────

  /**
   * Inferred funnel stage based on history signals and CRM lifecycle.
   *   awareness     — first or very early visit, no CRM signal
   *   consideration — 2+ page views, or CRM "lead"
   *   intent        — 5+ page views with CTA, or CRM "mql"
   *   decision      — clicked CTA, or CRM "sql" / "opportunity" / "customer"
   */
  funnelStage: FunnelStage | null;

  /**
   * Number of pages viewed in this session — "how deep" the visitor is.
   * Mirrors pagesVisited but named for funnel semantics.
   */
  visitDepth: number | null;

  // ── Intent Signals ────────────────────────────────────────────────────────

  /**
   * The content category of the current page, inferred from pathname and pageType.
   */
  contentInterestCategory: ContentInterestCategory | null;

  /**
   * True when the visitor shows research behaviour: 3+ page views without
   * a conversion signal (no CTA clicks, not in decision-stage CRM).
   */
  isResearching: boolean | null;

  /**
   * True when the visitor shows strong purchase intent:
   *   - Has clicked a CTA in this session, or
   *   - CRM lifecycle stage is "sql", "opportunity", or "customer".
   */
  isReadyToConvert: boolean | null;

  /**
   * Best-available label for what the visitor is most interested in.
   * Priority: utmTerm > contentInterestCategory > industryGroup.
   * null when none of these signals are available.
   */
  primaryInterest: string | null;
}

// ── Computation helpers ────────────────────────────────────────────────────────

function deriveDaySegment(hour: number | null | undefined): DaySegment | null {
  if (hour == null) return null;
  if (hour >= 0  && hour <= 5)  return "early-morning";
  if (hour >= 6  && hour <= 8)  return "morning";
  if (hour >= 9  && hour <= 12) return "midday";
  if (hour >= 13 && hour <= 17) return "afternoon";
  if (hour >= 18 && hour <= 21) return "evening";
  return "night";
}

function deriveSeason(month: number | null | undefined): Season | null {
  if (month == null) return null;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter"; // 12, 1, 2
}

function deriveTemperatureBucket(
  temp: number | null | undefined,
): TemperatureBucket | null {
  if (temp == null) return null;
  if (temp < 0)  return "freezing";
  if (temp < 10) return "cold";
  if (temp < 20) return "mild";
  if (temp < 30) return "warm";
  return "hot";
}

function deriveCompanyType(
  companySize: string | null | undefined,
): CompanyType | null {
  if (!companySize) return null;
  const s = companySize.toLowerCase();
  // Patterns: "1-10", "11-50", "51-200", "201-1000", "1001-5000", "5001+", etc.
  if (/^(1-10|11-50)$/.test(s))                    return "startup";
  if (/^(51-200)$/.test(s))                          return "smb";
  if (/^(201-500|501-1000|201-1000)$/.test(s))       return "mid-market";
  if (/^(1001|1001-|5001|10001|1000\+|5000\+|10000\+|enterprise)/i.test(s)) return "enterprise";
  // Common string formats from various providers
  if (s.includes("enterprise") || s.includes("large"))  return "enterprise";
  if (s.includes("mid") || s.includes("medium"))        return "mid-market";
  if (s.includes("small") || s.includes("smb"))         return "smb";
  if (s.includes("startup") || s.includes("micro"))     return "startup";
  return "unknown";
}

const TECH_KEYWORDS = [
  "software", "technology", "tech", "saas", "internet", "it ", "information technology",
  "cloud", "data", "ai ", "artificial intelligence", "cybersecurity", "semiconductor",
  "computer", "telecommunications", "telecom",
];
const FINANCE_KEYWORDS = [
  "finance", "financial", "banking", "bank", "insurance", "investment",
  "accounting", "capital", "asset", "fintech", "wealth",
];
const HEALTH_KEYWORDS = [
  "health", "medical", "pharma", "hospital", "clinic", "biotech", "life sciences",
  "healthcare", "wellness",
];
const MANUFACTURING_KEYWORDS = [
  "manufacturing", "industrial", "logistics", "supply chain", "automotive",
  "aerospace", "construction", "engineering", "energy",
];
const RETAIL_KEYWORDS = [
  "retail", "ecommerce", "e-commerce", "consumer goods", "fashion", "food", "restaurant",
  "hospitality", "travel", "tourism",
];
const PROFESSIONAL_SERVICES_KEYWORDS = [
  "consulting", "consultancy", "legal", "law", "accounting", "audit", "professional services",
  "marketing", "advertising", "pr ", "public relations", "recruiting", "staffing", "hr ",
];

function deriveIndustryGroup(
  companyIndustry: string | null | undefined,
  crmIndustry: string | null | undefined,
): IndustryGroup | null {
  const raw = (companyIndustry ?? crmIndustry ?? "").toLowerCase().trim();
  if (!raw) return null;

  for (const kw of TECH_KEYWORDS)                if (raw.includes(kw)) return "tech";
  for (const kw of FINANCE_KEYWORDS)             if (raw.includes(kw)) return "finance";
  for (const kw of HEALTH_KEYWORDS)              if (raw.includes(kw)) return "healthcare";
  for (const kw of MANUFACTURING_KEYWORDS)       if (raw.includes(kw)) return "manufacturing";
  for (const kw of RETAIL_KEYWORDS)              if (raw.includes(kw)) return "retail";
  for (const kw of PROFESSIONAL_SERVICES_KEYWORDS) if (raw.includes(kw)) return "professional-services";
  return "other";
}

function deriveChannelGroup(
  utmMedium:      string | null | undefined,
  utmSource:      string | null | undefined,
  source:         string,
  referrerDomain: string | null | undefined,
): ChannelGroup {
  const med = (utmMedium ?? "").toLowerCase();
  const src = (utmSource ?? source ?? "").toLowerCase();
  const ref = (referrerDomain ?? "").toLowerCase();

  // Paid-search
  if (["cpc", "ppc", "paidsearch", "paid_search", "paid search"].includes(med)) return "paid-search";
  if (med.includes("paid") && (src.includes("google") || src.includes("bing") || src.includes("search"))) return "paid-search";

  // Paid-social
  if (["paid_social", "paid-social", "paidsocial", "cpm"].includes(med) &&
      (src.includes("facebook") || src.includes("instagram") || src.includes("linkedin") || src.includes("twitter") || src.includes("tiktok"))) return "paid-social";
  if (med === "paid_social") return "paid-social";

  // Email
  if (["email", "newsletter", "e-mail"].includes(med)) return "email";
  if (src.includes("email") || src.includes("newsletter")) return "email";

  // Organic social
  if (["social", "organic-social", "organic_social"].includes(med)) return "organic-social";
  if (!med && (src === "linkedin" || src === "twitter" || src === "facebook" || src === "instagram")) return "organic-social";

  // Organic search
  if (["organic", "organic-search", "organic_search"].includes(med)) return "organic-search";
  if (!med && src === "google") return "organic-search";
  if (!med && (src === "google" || src === "bing" || src === "duckduckgo")) return "organic-search";

  // Content / other UTM mediums
  if (["content", "blog", "article", "resource"].includes(med)) return "other";

  // Direct
  if (source === "direct" && !utmMedium && !utmSource) return "direct";

  // Referral (has referrer but no UTM)
  if (ref && !utmMedium && !utmSource) return "referral";

  return "other";
}

function deriveCampaignType(
  utmMedium:   string | null | undefined,
  utmCampaign: string | null | undefined,
): CampaignType {
  if (!utmMedium && !utmCampaign) return "unknown";

  const med  = (utmMedium   ?? "").toLowerCase();
  const camp = (utmCampaign ?? "").toLowerCase();

  if (med.includes("retarget") || med.includes("remarket") ||
      camp.includes("retarget") || camp.includes("remarket")) return "retargeting";

  if (camp.includes("brand") || med.includes("brand")) return "brand";

  if (camp.includes("event") || camp.includes("webinar") ||
      camp.includes("conference") || camp.includes("summit")) return "event";

  if (["email", "newsletter", "e-mail"].includes(med)) return "content";

  if (["content", "blog", "article", "resource", "guide"].includes(med)) return "content";

  if (["cpc", "ppc", "paidsearch", "paid_search"].includes(med)) return "demand-gen";
  if (["paid_social", "cpm", "display"].includes(med)) return "demand-gen";

  if (utmMedium || utmCampaign) return "other";
  return "unknown";
}

function deriveContentInterestCategory(
  pathname: string | null | undefined,
  pageType: string | null | undefined,
): ContentInterestCategory {
  const path = (pathname ?? "").toLowerCase();
  const type = (pageType ?? "").toLowerCase();

  if (path === "/" || type === "homepage") return "homepage";
  if (path.includes("/pricing") || path.includes("/plans") || path.includes("/tarif")) return "pricing";
  if (
    path.includes("/product") || path.includes("/feature") ||
    path.includes("/solution") || path.includes("/demo") ||
    path.includes("/platform") || type === "product"
  ) return "product";
  if (
    path.includes("/blog") || path.includes("/resource") ||
    path.includes("/guide") || path.includes("/article") ||
    path.includes("/whitepaper") || path.includes("/case-study") ||
    type === "article" || type === "blog" || type === "content"
  ) return "content";
  if (
    path.includes("/about") || path.includes("/company") ||
    path.includes("/team") || path.includes("/mission") ||
    type === "about"
  ) return "about";
  return "other";
}

// ── Main computation function ──────────────────────────────────────────────────

/**
 * Compute all derived context signals from the assembled RuleEvaluationContext.
 *
 * This is a pure function — no I/O, no side effects.
 * Call it after the full enrichment pipeline and time context have been applied.
 *
 * @param ctx  The fully-assembled context (enrichment + time already populated).
 * @returns    A Partial<DerivedContext> — all fields are present but may be null.
 */
export function computeDerivedContext(
  ctx: RuleEvaluationContext,
): DerivedContext {
  const enrichment = (ctx as unknown as { enrichment?: Partial<EnrichmentOutput> }).enrichment ?? {};

  // ── Time derived ───────────────────────────────────────────────────────────

  const daySegment  = deriveDaySegment(ctx.currentHour);
  const season      = deriveSeason(ctx.month);
  const isWorkHours =
    ctx.currentHour != null && ctx.isWeekend != null
      ? !ctx.isWeekend && ctx.currentHour >= 9 && ctx.currentHour < 18
      : null;
  const seasonalEvent = ctx.seasonalEvent;
  const isHoliday =
    seasonalEvent != null
      ? seasonalEvent !== "none"
      : null;

  // ── Weather derived ────────────────────────────────────────────────────────

  const hasWeather = enrichment.weatherSource != null;

  const isBadWeather = hasWeather
    ? Boolean(
        enrichment.isRaining === true ||
        (enrichment.windSpeed != null && enrichment.windSpeed > 40) ||
        (enrichment.cloudCover != null && enrichment.cloudCover > 85),
      )
    : null;

  const temperatureBucket = hasWeather
    ? deriveTemperatureBucket(enrichment.temperatureNow)
    : null;

  // ── Company derived ────────────────────────────────────────────────────────

  const hasCompany = Boolean(enrichment.companyName ?? enrichment.crmCompanyName);

  const companyType = hasCompany
    ? deriveCompanyType(enrichment.companySize)
    : null;

  const industryGroup = (enrichment.companyIndustry ?? enrichment.crmIndustry)
    ? deriveIndustryGroup(enrichment.companyIndustry, enrichment.crmIndustry)
    : null;

  // ── Campaign context ───────────────────────────────────────────────────────

  const channelGroup = deriveChannelGroup(
    ctx.utmMedium,
    ctx.utmSource,
    ctx.source,
    ctx.referrerDomain,
  );

  const campaignType = deriveCampaignType(ctx.utmMedium, ctx.utmCampaign);

  const isRetargetedUser =
    ctx.visitType === "returning" ||
    (ctx.history?.pageViewCount != null && ctx.history.pageViewCount > 0);

  // ── Behavior & Engagement ──────────────────────────────────────────────────

  const pageViewCount = ctx.history?.pageViewCount ?? 0;
  const ctaClickCount = ctx.history?.ctaClickCount ?? 0;
  const hasClickedCta = ctx.history?.hasClickedCta ?? false;

  // daysSinceFirstSeen — mirrors the resolver in field-registry.ts
  const firstSeenAt = ctx.history?.firstSeenAt;
  const resolvedAt  = (ctx as unknown as { resolvedAt?: number }).resolvedAt;
  const daysSinceFirstSeen =
    firstSeenAt && resolvedAt && ctx.history?.fromDatabase
      ? Math.max(0, Math.floor((resolvedAt - new Date(firstSeenAt).getTime()) / 86_400_000))
      : 0;

  const engagementScore = Math.min(
    Math.round(
      Math.min(pageViewCount * 10, 40) +    // 0–40: page depth
      Math.min(ctaClickCount * 15, 30) +    // 0–30: CTA engagement
      (ctx.visitType === "returning" ? 20 : 0) +  // 20: returning visitor
      (daysSinceFirstSeen > 0 ? 10 : 0),   // 10: session age signal
    ),
    100,
  );

  const pagesVisited = pageViewCount;

  // ── Intent signals ─────────────────────────────────────────────────────────

  const crmStage = (enrichment.crmLifecycleStage ?? "").toLowerCase();
  const decisionStages = ["sql", "opportunity", "customer"];
  const intentStages   = ["mql", "lead"];

  const isReadyToConvert =
    hasClickedCta ||
    decisionStages.some((s) => crmStage === s);

  const isResearching =
    pageViewCount >= 3 && !isReadyToConvert && !hasClickedCta;

  const contentInterestCategory = deriveContentInterestCategory(
    (ctx as unknown as { pathname?: string }).pathname,
    (ctx as unknown as { pageType?: string }).pageType,
  );

  const primaryInterest: string | null =
    ctx.utmTerm ||
    (contentInterestCategory !== "other" && contentInterestCategory !== "homepage"
      ? contentInterestCategory
      : null) ||
    industryGroup ||
    null;

  // ── Funnel stage ───────────────────────────────────────────────────────────

  let funnelStage: FunnelStage;
  if (isReadyToConvert || decisionStages.some((s) => crmStage === s)) {
    funnelStage = "decision";
  } else if (
    (pageViewCount >= 5 && hasClickedCta) ||
    intentStages.some((s) => crmStage === s)
  ) {
    funnelStage = "intent";
  } else if (pageViewCount >= 2 || crmStage === "lead") {
    funnelStage = "consideration";
  } else {
    funnelStage = "awareness";
  }

  const visitDepth = pageViewCount;

  // ── Assemble ───────────────────────────────────────────────────────────────

  return {
    // Time
    daySegment,
    isWorkHours,
    isHoliday,
    season,
    // Weather
    isBadWeather,
    temperatureBucket,
    // Company
    companyType,
    industryGroup,
    // Campaign
    channelGroup,
    campaignType,
    isRetargetedUser,
    // Behavior
    engagementScore,
    pagesVisited,
    // Funnel
    funnelStage,
    visitDepth,
    // Intent
    contentInterestCategory,
    isResearching,
    isReadyToConvert,
    primaryInterest,
  };
}
