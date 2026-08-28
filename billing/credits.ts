/**
 * billing/credits.ts
 *
 * Chameleon Credits — the customer-facing billing abstraction.
 *
 * ─── What are Chameleon Credits? ─────────────────────────────────────────────
 *
 *   Credits are the unit of exchange visible to tenants.
 *   1 credit = €0.01 — credits map 1:1 to euro cents in the wallet.
 *   The underlying wallet stores `balance_cents`; credits = balance_cents.
 *
 *   This 1:1 mapping means no conversion math is needed at deduction time —
 *   existing enrichment-tracker.ts and wallet debit logic work unchanged.
 *   Credits are purely a presentation layer.
 *
 * ─── Credit categories ────────────────────────────────────────────────────────
 *
 *   Credits are organised into three categories that reflect what the platform
 *   is doing on behalf of the tenant:
 *
 *   Recognition  — Identifying who the visitor is.
 *                  ip_enrich, reverse_geocode, company_lookup, leadinfo_lookup.
 *                  Cost: 3 credits per live call.
 *
 *   Adaptation   — Choosing the right experience for the visitor.
 *                  intent_enrich, weather_enrich.
 *                  Cost: 3 credits per live call.
 *
 *   Brainpower   — Deep profile enrichment (quota-constrained external APIs).
 *                  ga4_history, crm_lookup.
 *                  Cost: 6 credits per live call.
 *
 * ─── Fallback modes ───────────────────────────────────────────────────────────
 *
 *   When a monthly spending limit is reached, the platform falls back
 *   automatically to the next available mode:
 *
 *   full_adaptive  — All categories enabled (normal operation).
 *   smart_lite     — Recognition only; Adaptation + Brainpower disabled.
 *                    Visitors still get geo-personalisation but no intent/CRM.
 *   default        — Static content; no enrichments at all. Zero credit cost.
 *
 * ─── Spending limit ───────────────────────────────────────────────────────────
 *
 *   Each tenant can have a monthly credit spending limit.
 *   0 = no limit (unlimited).
 *   When the limit is reached mid-month, the configured fallback mode kicks in
 *   until the next calendar month resets the counter.
 *
 * ─── Client safety ────────────────────────────────────────────────────────────
 *
 *   This file is safe to import in any context (server, client, edge).
 *   No env vars, no Supabase/Stripe imports — only types and pure functions.
 */

import type { UsageEventType } from "./types";

// ── Credit categories ──────────────────────────────────────────────────────────

export type CreditCategory = "recognition" | "adaptation" | "brainpower";

export interface CreditCategoryMeta {
  id:             CreditCategory;
  label:          string;
  description:    string;
  /** What enrichment types belong to this category (for UI). */
  enrichmentTypes: UsageEventType[];
  /** Tailwind colour token for badges/charts — without the `bg-` / `text-` prefix. */
  color:          "blue" | "purple" | "orange";
  /** Credits per live call for every type in this category. */
  creditsPerCall: number;
  /** Human-readable list of enrichment types shown in toggles. */
  exampleTypes:   string;
}

export const CREDIT_CATEGORIES: Record<CreditCategory, CreditCategoryMeta> = {
  recognition: {
    id:              "recognition",
    label:           "Recognition",
    description:     "Identifying who the visitor is — geo, company, network",
    enrichmentTypes: ["ip_enrich", "reverse_geocode", "company_lookup", "leadinfo_lookup"],
    color:           "blue",
    creditsPerCall:  3,
    exampleTypes:    "IP geo · Company lookup · Reverse geocode · Leadinfo",
  },
  adaptation: {
    id:              "adaptation",
    label:           "Adaptation",
    description:     "Choosing the right experience — intent signals and context",
    enrichmentTypes: ["intent_enrich", "weather_enrich"],
    color:           "purple",
    creditsPerCall:  3,
    exampleTypes:    "Intent enrichment · Weather context",
  },
  brainpower: {
    id:              "brainpower",
    label:           "Brainpower",
    description:     "Deep enrichment using quota-constrained external APIs",
    enrichmentTypes: ["ga4_history", "crm_lookup"],
    color:           "orange",
    creditsPerCall:  6,
    exampleTypes:    "GA4 history · CRM lookup",
  },
};

/** Ordered list of categories for consistent display. */
export const CREDIT_CATEGORY_ORDER: CreditCategory[] = [
  "recognition",
  "adaptation",
  "brainpower",
];

// ── Event → category mapping ──────────────────────────────────────────────────

/**
 * Maps every UsageEventType to its CreditCategory.
 * Used for category breakdown in the billing dashboard and for
 * enforcing category-level cost controls at enrichment time.
 */
export const EVENT_CATEGORY: Record<UsageEventType, CreditCategory> = {
  // Recognition — identifying the visitor
  ip_enrich:       "recognition",
  reverse_geocode: "recognition",
  company_lookup:  "recognition",
  leadinfo_lookup: "recognition",
  firstparty_company_lookup: "recognition",

  // Adaptation — choosing the right experience
  intent_enrich:   "adaptation",
  weather_enrich:  "adaptation",

  // Brainpower — deep enrichment (quota-constrained, higher cost)
  ga4_history:     "brainpower",
  crm_lookup:      "brainpower",
};

// ── Fallback modes ─────────────────────────────────────────────────────────────

export type FallbackMode = "full_adaptive" | "smart_lite" | "default";

export interface FallbackModeMeta {
  id:               FallbackMode;
  label:            string;
  description:      string;
  /** Categories that remain active in this mode. */
  activeCategories: CreditCategory[];
  /**
   * Estimated credit cost per visitor as a ratio of full_adaptive (0.0–1.0).
   * Rough guidance for the UI — not a contractual guarantee.
   */
  estimatedCostRatio: number;
}

export const FALLBACK_MODES: Record<FallbackMode, FallbackModeMeta> = {
  full_adaptive: {
    id:               "full_adaptive",
    label:            "Full adaptive",
    description:      "All enrichments enabled — maximum personalisation.",
    activeCategories: ["recognition", "adaptation", "brainpower"],
    estimatedCostRatio: 1.0,
  },
  smart_lite: {
    id:               "smart_lite",
    label:            "Smart lite",
    description:      "Recognition only — geo and company signals, no deep enrichment.",
    activeCategories: ["recognition"],
    estimatedCostRatio: 0.5,
  },
  default: {
    id:               "default",
    label:            "Default (static)",
    description:      "No enrichments — static content only. Zero credit cost.",
    activeCategories: [],
    estimatedCostRatio: 0,
  },
};

/** Ordered list of fallback modes for dropdowns (best → cheapest). */
export const FALLBACK_MODE_ORDER: FallbackMode[] = [
  "full_adaptive",
  "smart_lite",
  "default",
];

// ── Credit settings ────────────────────────────────────────────────────────────

/**
 * Per-tenant credit controls.
 *
 * Stored in `platform_settings` as a JSON blob with key `credit_settings:{tenantId}`.
 * Loaded server-side in the billing page; saved via saveCreditSettingsAction.
 */
export interface CreditSettings {
  /**
   * Maximum credits the tenant may spend per calendar month.
   * 0 = no limit (unlimited spend).
   * When exceeded, `fallbackMode` kicks in automatically.
   */
  monthlyLimitCredits: number;

  /**
   * Fallback mode to engage when the monthly limit is reached.
   * Has no effect when monthlyLimitCredits = 0.
   */
  fallbackMode: FallbackMode;

  /**
   * Per-category kill switches.
   * A disabled category will never fire its enrichment types regardless
   * of the monthly limit — useful for permanent cost reduction.
   */
  enabledCategories: {
    recognition: boolean;
    adaptation:  boolean;
    brainpower:  boolean;
  };
}

/** Safe defaults used when no settings row exists in platform_settings. */
export const CREDIT_SETTINGS_DEFAULTS: CreditSettings = {
  monthlyLimitCredits: 0,
  fallbackMode:        "smart_lite",
  enabledCategories: {
    recognition: true,
    adaptation:  true,
    brainpower:  true,
  },
};

// ── Category usage summary ─────────────────────────────────────────────────────

/**
 * Aggregated credit consumption for a single category over a time window.
 * Computed client-side from EnrichmentUsageSummaryRow[] via computeCategoryBreakdown().
 */
export interface CategoryUsageSummary {
  category:      CreditCategory;
  totalCalls:    number;
  freshCalls:    number;
  cacheHits:     number;
  blockedCalls:  number;
  /** Credits actually deducted (fresh live calls only; cache hits = 0). */
  totalCredits:  number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Compute per-category usage from a flat enrichment_usage summary.
 *
 * Input shape matches EnrichmentUsageSummaryRow from billing/types.ts.
 * Returns one entry per category (even when zero calls were made).
 */
export function computeCategoryBreakdown(
  rows: Array<{
    enrichment_type:   string;
    call_count:        number;
    fresh_call_count:  number;
    cache_hit_count:   number;
    blocked_count:     number;
    total_price_cents: number;
  }>,
): CategoryUsageSummary[] {
  const buckets: Record<CreditCategory, CategoryUsageSummary> = {
    recognition: { category: "recognition", totalCalls: 0, freshCalls: 0, cacheHits: 0, blockedCalls: 0, totalCredits: 0 },
    adaptation:  { category: "adaptation",  totalCalls: 0, freshCalls: 0, cacheHits: 0, blockedCalls: 0, totalCredits: 0 },
    brainpower:  { category: "brainpower",  totalCalls: 0, freshCalls: 0, cacheHits: 0, blockedCalls: 0, totalCredits: 0 },
  };

  for (const row of rows) {
    const cat = EVENT_CATEGORY[row.enrichment_type as UsageEventType];
    if (!cat) continue;
    const b = buckets[cat];
    b.totalCalls   += row.call_count;
    b.freshCalls   += row.fresh_call_count;
    b.cacheHits    += row.cache_hit_count;
    b.blockedCalls += row.blocked_count;
    // total_price_cents = credits (1 cent = 1 credit in the wallet model)
    b.totalCredits += row.total_price_cents;
  }

  return CREDIT_CATEGORY_ORDER.map((cat) => buckets[cat]);
}

/**
 * Given the current month's spend and the tenant's credit settings,
 * return the effective operating mode.
 *
 * Returns "full_adaptive" when no limit is configured (monthlyLimitCredits = 0).
 */
export function getEffectiveMode(
  spentThisMonthCredits: number,
  settings: CreditSettings,
): FallbackMode {
  const { monthlyLimitCredits, fallbackMode } = settings;
  if (monthlyLimitCredits <= 0) return "full_adaptive";
  if (spentThisMonthCredits >= monthlyLimitCredits) return fallbackMode;
  return "full_adaptive";
}

/**
 * Estimate credits saved per month by disabling a category,
 * based on the category's share of this month's actual spend.
 *
 * Returns 0 when there is no usage data.
 */
export function estimateSavings(
  category: CreditCategory,
  breakdown: CategoryUsageSummary[],
): number {
  return breakdown.find((b) => b.category === category)?.totalCredits ?? 0;
}

/**
 * Format a credit count for display.
 * Uses locale-aware number formatting with the "cr" suffix.
 *
 * Examples:
 *   fmtCredits(0)     → "0 cr"
 *   fmtCredits(1234)  → "1.234 cr"   (nl-NL locale)
 *   fmtCredits(12340) → "12.340 cr"
 */
export function fmtCredits(credits: number): string {
  return `${credits.toLocaleString("nl-NL")} cr`;
}

/**
 * Convert a credit count to a euro display string.
 * 1 credit = €0.01 (100 credits = €1.00).
 */
export function creditsToEuro(credits: number): string {
  return `€${(credits / 100).toFixed(2)}`;
}
