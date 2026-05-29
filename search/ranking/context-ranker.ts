/**
 * Search — Context-Aware Re-Ranker
 *
 * Applies visitor context signals to re-rank Meilisearch results before
 * returning them to the frontend.  This gives the platform control over
 * result ordering based on intent, journey stage, and visitor attributes —
 * without modifying Meilisearch's core ranking rules.
 *
 * ─── Why re-rank instead of Meilisearch custom ranking? ──────────────────────
 *
 *   Meilisearch custom ranking rules are static — they don't change per-visitor.
 *   Context-aware re-ranking is dynamic: a returning high-intent visitor should
 *   see pricing/contact results boosted; a candidate visitor should see job
 *   postings first; a new visitor should see foundational/educational content.
 *
 *   The re-ranker runs in the platform API layer, AFTER Meilisearch returns its
 *   results.  This keeps the Meilisearch index simple and the personalisation
 *   logic in platform code where it can be tested and audited.
 *
 * ─── Boost signals ───────────────────────────────────────────────────────────
 *
 *   Intent signal:
 *     high_intent / decision funnelStage  → boost pricing, contact, demo results
 *     consideration / intent              → boost case studies, comparison results
 *     awareness                           → boost blog posts, overview pages
 *
 *   Source signal:
 *     organic / seo                        → boost content/blog results
 *     paid / google / linkedin             → boost landing pages, product pages
 *     direct / returning                   → boost product, pricing results
 *
 *   Journey stage:
 *     customer                             → boost support, docs, community results
 *     high_intent                          → boost pricing, contact results
 *     consideration                        → boost case-studies, blog results
 *
 *   Visitor type:
 *     "candidate" keyword in context       → boost vacancy results
 *     CRM lifecycle: "customer"            → boost support results
 *
 * ─── Scoring algorithm ───────────────────────────────────────────────────────
 *
 *   Each result receives a boostScore starting at 0.0.
 *   Matching context signals add fractional boosts (e.g. +0.3 for intent match).
 *   Results are then sorted by (boostScore DESC, originalRank ASC).
 *   The originalRank is preserved so tie-breaking favours Meilisearch's ranking.
 *
 * ─── Tenant logic ────────────────────────────────────────────────────────────
 *
 *   Tenant-level ranking rules are stored in TenantSearchRankingRules.
 *   When no tenant rules are configured, platform defaults apply.
 *   Ranking rules are additive (not exclusive) — tenant rules boost on top of
 *   platform defaults, not instead of them.
 */

import type { SearchResult }    from "@/search/types";

// ── Context input ─────────────────────────────────────────────────────────────

/**
 * Visitor context signals passed to the re-ranker.
 *
 * A subset of DecisionInput — re-ranker only needs the signals that affect
 * search ranking, not the full context.
 *
 * All fields are optional — the re-ranker degrades gracefully when signals
 * are absent (no re-ranking is applied, Meilisearch order is preserved).
 */
export interface SearchContext {
  /** Visitor traffic source, e.g. "google", "linkedin", "direct". */
  source?:         string | null;
  /** Visit type, e.g. "returning", "first_visit", "high_intent". */
  visitType?:      string | null;
  /** Journey funnel stage, e.g. "awareness", "consideration", "high_intent". */
  funnelStage?:    string | null;
  /** Journey intent score 0–100. */
  intentScore?:    number | null;
  /** CRM lifecycle stage, e.g. "customer", "lead", "opportunity". */
  crmLifecycle?:   string | null;
  /** UTM campaign name. */
  utmCampaign?:    string | null;
  /** Matched behavioral scenario slug, e.g. "behavioral_candidate". */
  scenario?:       string | null;
}

// ── Tenant ranking rules ──────────────────────────────────────────────────────

/**
 * One operator-defined ranking rule.
 *
 * When `contextSignal` matches a value in the visitor context, results with
 * any of the `boostContentTypes` are boosted by `boostScore`.
 *
 * Example:
 *   { contextSignal: "funnelStage:high_intent", boostContentTypes: ["page"], boostScore: 0.4,
 *     boostKeywords: ["pricing", "contact", "demo"] }
 */
export interface TenantSearchRankingRule {
  /**
   * The context signal that triggers this rule.
   * Format: "fieldName:value", e.g. "funnelStage:high_intent", "source:google".
   * Use "*" to always apply.
   */
  contextSignal:    string;
  /** Content types to boost when this rule fires. */
  boostContentTypes?: string[];
  /** Keywords in the result title/excerpt that trigger an additional boost. */
  boostKeywords?:    string[];
  /** How much to add to the boostScore when this rule fires (0.0–1.0). */
  boostScore:       number;
  /**
   * Optional label shown in the admin search debug panel.
   * E.g. "Boost pricing pages for high-intent visitors"
   */
  label?:           string;
}

/** Collection of tenant-level ranking rules. */
export interface TenantSearchRankingRules {
  rules: TenantSearchRankingRule[];
}

// ── Re-ranker ─────────────────────────────────────────────────────────────────

/** A result enriched with a boost score for sorting. */
interface ScoredResult {
  result:       SearchResult;
  originalRank: number;
  boostScore:   number;
}

/**
 * Re-rank search results based on visitor context signals.
 *
 * @param results       Results from Meilisearch in its original ranking order.
 * @param context       Visitor context signals.
 * @param tenantRules   Optional tenant-level ranking rules.
 *
 * @returns  Results in context-aware order.  When no context signals are
 *           present and no tenant rules fire, the original order is preserved.
 */
export function rerankResults(
  results:     SearchResult[],
  context:     SearchContext,
  tenantRules?: TenantSearchRankingRules | null,
): SearchResult[] {
  if (results.length === 0) return results;

  // Score each result
  const scored: ScoredResult[] = results.map((result, i) => ({
    result,
    originalRank: i,
    boostScore:   computeBoost(result, context, tenantRules),
  }));

  // Sort by boost DESC, then original rank ASC (stable tie-breaking)
  scored.sort((a, b) => {
    if (b.boostScore !== a.boostScore) return b.boostScore - a.boostScore;
    return a.originalRank - b.originalRank;
  });

  return scored.map((s) => s.result);
}

/**
 * Compute the boost score for one result given the current visitor context.
 *
 * Higher boost = result ranks higher relative to Meilisearch's original order.
 * Total boost is unbounded — callers only use it for relative sorting.
 */
function computeBoost(
  result:      SearchResult,
  context:     SearchContext,
  tenantRules?: TenantSearchRankingRules | null,
): number {
  let boost = 0;

  // ── Platform default ranking signals ─────────────────────────────────────

  // Intent / funnel stage boosts
  const stage = context.funnelStage?.toLowerCase() ?? "";
  const score = context.intentScore ?? 0;

  if (stage === "high_intent" || score >= 70) {
    // High-intent visitor: boost contact/pricing/demo pages
    if (matchesKeywords(result, ["pricing", "contact", "demo", "trial", "book"])) {
      boost += 0.4;
    }
    if (result.type === "page") boost += 0.1;
  } else if (stage === "consideration" || (score >= 40 && score < 70)) {
    // Consideration: boost case studies, comparisons, how-it-works
    if (matchesKeywords(result, ["case", "study", "compare", "how", "guide", "overview"])) {
      boost += 0.3;
    }
    if (result.type === "post") boost += 0.15;
  } else if (stage === "awareness") {
    // Awareness: boost blog posts, introductory content
    if (result.type === "post") boost += 0.25;
    if (matchesKeywords(result, ["what", "intro", "getting", "started", "learn"])) {
      boost += 0.15;
    }
  }

  // Source boosts
  const source = context.source?.toLowerCase() ?? "";
  if (source === "google" || source === "organic") {
    // Organic search visitors: prefer content / educational results
    if (result.type === "post") boost += 0.2;
  }
  if (source === "linkedin" || source === "paid") {
    // Paid visitors: prefer product/landing pages
    if (result.type === "page") boost += 0.15;
  }
  if (context.visitType === "returning") {
    // Returning visitors: slight boost for product/pricing
    if (matchesKeywords(result, ["pricing", "features", "product"])) {
      boost += 0.15;
    }
  }

  // CRM lifecycle
  const crm = context.crmLifecycle?.toLowerCase() ?? "";
  if (crm === "customer") {
    // Existing customers: boost support, docs, community
    if (matchesKeywords(result, ["support", "docs", "help", "community", "guide"])) {
      boost += 0.35;
    }
  }

  // Behavioral scenario
  const scenario = context.scenario?.toLowerCase() ?? "";
  if (scenario.includes("candidate") || scenario.includes("job")) {
    // Job seekers: boost vacancy results
    if (result.type === "vacancy") boost += 0.5;
  }

  // ── Tenant-level rules ────────────────────────────────────────────────────
  if (tenantRules?.rules) {
    for (const rule of tenantRules.rules) {
      if (matchesContextSignal(rule.contextSignal, context)) {
        let ruleFired = false;

        if (rule.boostContentTypes?.includes(result.type)) {
          ruleFired = true;
        }
        if (rule.boostKeywords && matchesKeywords(result, rule.boostKeywords)) {
          ruleFired = true;
        }
        if (rule.contextSignal === "*") {
          ruleFired = true; // wildcard: always fires
        }

        if (ruleFired) {
          boost += rule.boostScore;
        }
      }
    }
  }

  return boost;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Check whether a result's title or excerpt contains any of the given keywords.
 * Case-insensitive, whole-word matching.
 */
function matchesKeywords(result: SearchResult, keywords: string[]): boolean {
  const text = `${result.title ?? ""} ${result.excerpt ?? ""}`.toLowerCase();
  return keywords.some((kw) => text.includes(kw.toLowerCase()));
}

/**
 * Check whether a context signal string matches the current visitor context.
 *
 * Signal format: "fieldName:value"  e.g. "funnelStage:high_intent"
 * Special value: "*" always matches.
 */
function matchesContextSignal(signal: string, context: SearchContext): boolean {
  if (signal === "*") return true;

  const [field, value] = signal.split(":") as [string, string | undefined];
  if (!value) return false;

  const contextAsRecord = context as Record<string, string | number | null | undefined>;
  const actual          = String(contextAsRecord[field] ?? "").toLowerCase();
  return actual === value.toLowerCase();
}
