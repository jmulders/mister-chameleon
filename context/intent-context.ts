/**
 * Intent Context
 *
 * An explicit, manageable intent prediction layer on top of raw and derived
 * context signals.  It answers the question "what is this visitor trying to
 * accomplish?" in a normalised, debuggable form.
 *
 * ─── Architecture position ───────────────────────────────────────────────────
 *
 *   raw context (VisitorContext)
 *        ↓
 *   derived context (DerivedContext)
 *        ↓
 *   intent context (IntentContext)   ← YOU ARE HERE
 *        ↓
 *   decision engine / AI / rules
 *
 * ─── Design goals ────────────────────────────────────────────────────────────
 *
 *   • Explicit — every score is computed by deterministic, readable heuristics.
 *     No magic. The `intentReason` field explains exactly why the primary intent
 *     was inferred.
 *
 *   • Manageable — INTENT_DEFINITIONS exports the full signal model so the
 *     admin UI can display available intent types, contributing signals, and
 *     point weights without code changes.
 *
 *   • Stable — each intent type has a canonical key that rules, AI, and debug
 *     can reference by name (not just by numeric index).
 *
 *   • AI-ready — intentPrimary, intentConfidence, and individual scores are
 *     all included in the AI context snapshot.
 *
 * ─── Intent types ─────────────────────────────────────────────────────────────
 *
 *   demo       — Visitor wants a live product demo or sales conversation.
 *   research   — Visitor is gathering information, reading content, exploring.
 *   comparison — Visitor is actively comparing solutions / plans.
 *   trial      — Visitor wants to sign up for a free trial or get started.
 *   job        — Visitor is looking for employment.
 *   unknown    — Insufficient signals to determine intent.
 *
 * ─── Computation ─────────────────────────────────────────────────────────────
 *
 *   `computeIntentContext(signals)` is a pure function — no I/O, never throws.
 *
 *   Each intent type receives an independent score (0–100) based on weighted
 *   signal contributions.  The primary intent is the type with the highest
 *   score; the secondary is the runner-up when its score ≥ SECONDARY_THRESHOLD.
 *   Confidence is intentPrimary's score divided by 100.
 *
 *   Deterministic heuristics run first.  AI enrichment (planned) will be able
 *   to adjust individual scores without replacing this layer.
 *
 * ─── Adding a new intent type ─────────────────────────────────────────────────
 *
 *   1. Add the key to IntentType.
 *   2. Add a SignalContribution[] to INTENT_DEFINITIONS.
 *   3. Add the score field to IntentScores.
 *   4. Implement the scoring logic in computeIntentContext().
 *   5. Handle the key in applySignalContributions() if needed.
 *   6. Add the variable to context/registry.ts (source: "intent").
 */

import type { DerivedContext, FunnelStage } from "@/context/derived-context";
import type { VisitorHistory }              from "@/context/visitor-history";
import type { EnrichmentOutput }            from "@/enrichment/types";

// ── Intent type vocabulary ─────────────────────────────────────────────────────

/**
 * The canonical set of visitor intent types.
 *
 * Each type represents a distinct goal a visitor is likely pursuing.
 * The decision engine and AI providers reference these keys to select
 * variants that match the inferred intent.
 */
export type IntentType =
  | "demo"        // Wants a product demo or direct sales conversation
  | "research"    // Gathering information, reading content, exploring options
  | "comparison"  // Actively comparing solutions, pricing, or alternatives
  | "trial"       // Ready to sign up, start a trial, or register
  | "job"         // Looking for employment opportunities
  | "unknown";    // Insufficient signals to determine intent

// ── Intent scores ──────────────────────────────────────────────────────────────

/**
 * Individual intent propensity scores, each from 0 to 100.
 *
 * A score of 0 means no signals for that intent were observed.
 * A score of 100 means all strong signals aligned to that intent.
 * Scores are independent — multiple intents can score high simultaneously
 * (e.g. a returning visitor on the pricing page might score high for both
 * "comparison" and "trial").
 */
export interface IntentScores {
  /** Propensity for wanting a live demo or sales conversation (0–100). */
  readonly intentDemoScore:       number;
  /** Propensity for research behaviour — reading, exploring, comparing (0–100). */
  readonly intentResearchScore:   number;
  /** Propensity for actively comparing solutions or pricing plans (0–100). */
  readonly intentComparisonScore: number;
  /** Propensity for signing up or starting a free trial (0–100). */
  readonly intentTrialScore:      number;
  /** Propensity for job-seeking behaviour (0–100). */
  readonly intentJobScore:        number;
}

// ── IntentContext ──────────────────────────────────────────────────────────────

/**
 * The fully-resolved intent prediction for one visitor request.
 *
 * Always present in DecisionContext — never null at the top level.
 * Individual score fields are always numbers (not nullable).
 * intentSecondary is null when no runner-up intent reaches the threshold.
 */
export interface IntentContext extends IntentScores {
  /**
   * The inferred primary intent — the intent type with the highest score.
   * Falls back to "unknown" when all scores are 0.
   */
  readonly intentPrimary: IntentType;

  /**
   * The inferred secondary intent — the runner-up when its score ≥ SECONDARY_THRESHOLD (20).
   * Null when no secondary intent is strong enough or when all signals point to one intent.
   */
  readonly intentSecondary: IntentType | null;

  /**
   * Normalised confidence score for intentPrimary (0–1, two decimal places).
   * Derived as: primaryScore / 100.
   * A score of 0.5 means "possible but uncertain"; ≥ 0.7 means "strong signal".
   */
  readonly intentConfidence: number;

  /**
   * Short human-readable explanation of why intentPrimary was inferred.
   * Shows which signals contributed most, for debug overlay and AI context.
   * Example: "pricing page visit (+30) + hasClickedCta (+20) + funnelStage=decision (+20)"
   */
  readonly intentReason: string;
}

// ── Signal contribution model ──────────────────────────────────────────────────

/**
 * A single contributing signal rule for an intent type.
 *
 * Used by the admin UI (INTENT_DEFINITIONS) to show operators exactly which
 * signals contribute to each intent type and how many points each is worth.
 *
 * This is documentation-only — the actual scoring logic is in `computeIntentContext`.
 */
export interface SignalContribution {
  /** Human-readable label for this signal in the admin intent inspector. */
  readonly signal:       string;
  /** Maximum points this signal can contribute (before cap). */
  readonly maxPoints:    number;
  /** One-sentence description of when this signal fires. */
  readonly description:  string;
  /** Which context source provides this signal. */
  readonly source:
    | "pathname"
    | "derived"
    | "history"
    | "enrichment"
    | "utm"
    | "template";
}

/**
 * Full definition of a single intent type — metadata + contributing signals.
 *
 * Used by the admin intent inspection page to render a readable signal model.
 */
export interface IntentDefinition {
  /** Canonical intent type key. */
  readonly type:         IntentType;
  /** Human-readable display name. */
  readonly label:        string;
  /** One-sentence description of what this intent type represents. */
  readonly description:  string;
  /** Ordered list of signal contributions (highest-weight first). */
  readonly signals:      readonly SignalContribution[];
  /** Score at which this intent is considered a "strong" signal (typically 40+). */
  readonly strongThreshold: number;
}

// ── Intent definition registry ─────────────────────────────────────────────────

/**
 * The full signal model for all intent types.
 *
 * Exported so the admin UI can render it without code changes.
 * Also used as documentation for operators and AI prompt authors.
 */
export const INTENT_DEFINITIONS: readonly IntentDefinition[] = [

  {
    type:            "demo",
    label:           "Demo / Sales",
    description:     "Visitor shows intent to engage with sales — they want a live demo, a call, or a direct conversation.",
    strongThreshold: 40,
    signals: [
      { signal: "CRM lifecycle = sql or opportunity",           maxPoints: 30, source: "enrichment", description: "CRM match indicates an active sales opportunity." },
      { signal: "Pathname contains /demo or /request-demo",    maxPoints: 25, source: "pathname",    description: "Direct navigation to a demo or booking page." },
      { signal: "funnelStage = decision",                      maxPoints: 20, source: "derived",     description: "Visitor is at the decision stage of the funnel." },
      { signal: "isReadyToConvert = true",                     maxPoints: 20, source: "derived",     description: "Visitor has clicked a CTA or is in a decision-stage CRM stage." },
      { signal: "Pathname contains /contact or /sales",        maxPoints: 15, source: "pathname",    description: "Navigation to a contact or sales page." },
      { signal: "channelGroup = paid-search + funnelStage = intent", maxPoints: 15, source: "derived", description: "High-intent paid search traffic at the intent stage." },
      { signal: "contentInterestCategory = product",           maxPoints: 10, source: "derived",     description: "Visitor is browsing product or feature pages." },
      { signal: "campaignType = demand-gen",                   maxPoints: 10, source: "derived",     description: "Visitor arrived via a demand-generation campaign." },
      { signal: "returning + ctaClickCount > 0",               maxPoints: 10, source: "history",     description: "Returning visitor who has already clicked a CTA." },
    ],
  },

  {
    type:            "research",
    label:           "Research",
    description:     "Visitor is in learning mode — reading content, exploring the site, gathering information without a clear conversion intent yet.",
    strongThreshold: 35,
    signals: [
      { signal: "isResearching = true",                        maxPoints: 40, source: "derived",     description: "3+ page views with no CTA click or decision-stage CRM signal." },
      { signal: "contentInterestCategory = content",           maxPoints: 25, source: "derived",     description: "Visitor is reading blog posts, guides, or resources." },
      { signal: "channelGroup = organic-search",               maxPoints: 15, source: "derived",     description: "Arrived via organic search — typically research-intent traffic." },
      { signal: "campaignType = content",                      maxPoints: 15, source: "derived",     description: "Arrived via a content marketing campaign (blog/guide)." },
      { signal: "pageViewCount ≥ 3",                           maxPoints: 15, source: "history",     description: "Multiple page views indicate exploration behaviour." },
      { signal: "UTM term contains 'guide', 'how', or 'what'", maxPoints: 15, source: "utm",         description: "Search term signals informational intent." },
      { signal: "funnelStage = awareness",                     maxPoints: 10, source: "derived",     description: "Visitor is in the early awareness stage." },
      { signal: "channelGroup = organic-social",               maxPoints: 10, source: "derived",     description: "Arrived via organic social — discovery/research traffic." },
      { signal: "funnelStage = consideration (no CTA click)",  maxPoints: 10, source: "derived",     description: "Consideration-stage visitor who hasn't converted yet." },
      { signal: "pageViewCount ≥ 6",                           maxPoints: 10, source: "history",     description: "Very deep page exploration indicates sustained research." },
    ],
  },

  {
    type:            "comparison",
    label:           "Comparison",
    description:     "Visitor is actively comparing solutions, pricing plans, or alternatives. High-value commercial intent.",
    strongThreshold: 40,
    signals: [
      { signal: "Pathname contains /compare, /vs, /alternatives", maxPoints: 60, source: "pathname", description: "Direct navigation to a comparison or alternatives page." },
      { signal: "contentInterestCategory = pricing",            maxPoints: 30, source: "derived",    description: "Visitor is on the pricing page — comparing tiers." },
      { signal: "UTM term contains 'vs', 'alternative', 'compare'", maxPoints: 30, source: "utm",   description: "Search keyword indicates comparison intent." },
      { signal: "channelGroup = paid-search + comparison path", maxPoints: 20, source: "derived",    description: "Paid search to a comparison page — high-intent signal." },
      { signal: "funnelStage = consideration",                  maxPoints: 15, source: "derived",    description: "Consideration-stage visitor is likely evaluating options." },
      { signal: "pageViewCount ≥ 2",                            maxPoints: 10, source: "history",    description: "Multiple page views may indicate cross-page comparison." },
    ],
  },

  {
    type:            "trial",
    label:           "Trial / Sign-up",
    description:     "Visitor is ready to take action — they want to sign up, start a free trial, or register.",
    strongThreshold: 40,
    signals: [
      { signal: "Pathname contains /trial, /signup, /register, /get-started", maxPoints: 50, source: "pathname", description: "Direct navigation to a trial, signup, or registration page." },
      { signal: "UTM campaign contains 'trial' or 'signup'",    maxPoints: 20, source: "utm",        description: "Campaign is driving trial signups." },
      { signal: "funnelStage = decision",                       maxPoints: 20, source: "derived",    description: "Decision-stage visitor is ready to commit." },
      { signal: "contentInterestCategory = pricing + hasClickedCta", maxPoints: 20, source: "derived", description: "Pricing page visit combined with CTA click." },
      { signal: "returning + ctaClickCount > 0",                maxPoints: 15, source: "history",    description: "Returning visitor who previously clicked a CTA." },
      { signal: "channelGroup = email",                         maxPoints: 15, source: "derived",    description: "Email channel visitors often respond to trial offers." },
      { signal: "campaignType = demand-gen + funnelStage = intent", maxPoints: 15, source: "derived", description: "Intent-stage visitor from a demand-gen campaign." },
    ],
  },

  {
    type:            "job",
    label:           "Job Seeking",
    description:     "Visitor is looking for employment opportunities — browsing vacancies, career pages, or applying.",
    strongThreshold: 40,
    signals: [
      { signal: "Pathname contains /jobs, /careers, /vacancies, /vacancy, /apply", maxPoints: 70, source: "pathname", description: "Direct navigation to career or vacancy pages." },
      { signal: "templateKey contains 'vacancy', 'jobs', or 'career'",  maxPoints: 40, source: "template", description: "Page template is a vacancy or careers template." },
      { signal: "UTM campaign contains 'jobs' or 'career'",              maxPoints: 25, source: "utm",      description: "Arrived via a job posting or career campaign." },
      { signal: "channelGroup = organic-search + job-path",              maxPoints: 15, source: "derived",  description: "Organic search to a jobs or careers page." },
    ],
  },

];

// ── Intent definition lookup ───────────────────────────────────────────────────

/**
 * O(1) lookup map for intent definitions by type key.
 */
export const INTENT_DEFINITION_MAP: Readonly<Record<IntentType, IntentDefinition>> =
  Object.fromEntries(
    INTENT_DEFINITIONS.map((d) => [d.type, d]),
  ) as unknown as Readonly<Record<IntentType, IntentDefinition>>;

// ── Scoring constants ──────────────────────────────────────────────────────────

/**
 * Minimum score for a secondary intent to be reported.
 * Below this threshold, intentSecondary is null.
 */
const SECONDARY_THRESHOLD = 20;

/**
 * All scorable (non-unknown) intent types in priority order.
 * Unknown is excluded — it is the fallback, not a scored intent.
 */
const SCORABLE_INTENTS: readonly Exclude<IntentType, "unknown">[] = [
  "demo", "research", "comparison", "trial", "job",
];

// ── Internal scoring inputs ────────────────────────────────────────────────────

/**
 * Normalised signal inputs extracted from the full context chain.
 * All fields are non-nullable after normalisation.
 */
interface ScoringInputs {
  readonly pathname:                string;
  readonly funnelStage:             FunnelStage | null;
  readonly channelGroup:            DerivedContext["channelGroup"];
  readonly campaignType:            DerivedContext["campaignType"];
  readonly contentInterestCategory: DerivedContext["contentInterestCategory"];
  readonly isResearching:           boolean;
  readonly isReadyToConvert:        boolean;
  readonly hasClickedCta:           boolean;
  readonly ctaClickCount:           number;
  readonly pageViewCount:           number;
  readonly visitType:               "new" | "returning" | null;
  readonly crmLifecycleStage:       string;
  readonly utmTerm:                 string;
  readonly utmCampaign:             string;
  readonly templateKey:             string;
  readonly source:                  string;
}

// ── Score computation helpers ──────────────────────────────────────────────────

function cap(score: number): number {
  return Math.min(Math.round(score), 100);
}

function pathIncludes(pathname: string, ...terms: string[]): boolean {
  return terms.some((t) => pathname.includes(t));
}

function scoreDemo(i: ScoringInputs): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (pathIncludes(i.pathname, "/demo", "/request-demo", "/book-demo", "/book-a-demo")) {
    score += 25; reasons.push("demo page (+25)");
  }
  if (pathIncludes(i.pathname, "/contact", "/sales", "/get-in-touch")) {
    score += 15; reasons.push("contact/sales page (+15)");
  }
  if (i.funnelStage === "decision") {
    score += 20; reasons.push("funnelStage=decision (+20)");
  }
  if (i.isReadyToConvert) {
    score += 20; reasons.push("isReadyToConvert (+20)");
  }
  if (i.channelGroup === "paid-search" && i.funnelStage === "intent") {
    score += 15; reasons.push("paid-search+intent (+15)");
  }
  if (i.contentInterestCategory === "product") {
    score += 10; reasons.push("product page (+10)");
  }
  if (i.campaignType === "demand-gen") {
    score += 10; reasons.push("demand-gen campaign (+10)");
  }
  if (["sql", "opportunity"].includes(i.crmLifecycleStage)) {
    score += 30; reasons.push(`CRM=${i.crmLifecycleStage} (+30)`);
  }
  if (i.visitType === "returning" && i.ctaClickCount > 0) {
    score += 10; reasons.push("returning+ctaClick (+10)");
  }

  return { score: cap(score), reasons };
}

function scoreResearch(i: ScoringInputs): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (i.isResearching) {
    score += 40; reasons.push("isResearching (+40)");
  }
  if (i.contentInterestCategory === "content") {
    score += 25; reasons.push("content page (+25)");
  }
  if (i.channelGroup === "organic-search") {
    score += 15; reasons.push("organic-search (+15)");
  }
  if (i.campaignType === "content") {
    score += 15; reasons.push("content campaign (+15)");
  }
  if (i.pageViewCount >= 3) {
    score += 15; reasons.push(`pageViews=${i.pageViewCount} (+15)`);
  }
  if (i.pageViewCount >= 6) {
    score += 10; reasons.push("pageViews≥6 (+10)");
  }
  if (/\b(guide|how|what|why|best|top)\b/i.test(i.utmTerm)) {
    score += 15; reasons.push("research UTM term (+15)");
  }
  if (i.funnelStage === "awareness") {
    score += 10; reasons.push("funnelStage=awareness (+10)");
  }
  if (i.channelGroup === "organic-social") {
    score += 10; reasons.push("organic-social (+10)");
  }
  if (i.funnelStage === "consideration" && !i.hasClickedCta) {
    score += 10; reasons.push("consideration+noCTA (+10)");
  }

  return { score: cap(score), reasons };
}

function scoreComparison(i: ScoringInputs): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  const isComparisonPath = pathIncludes(i.pathname,
    "/compare", "/vs", "/versus", "/alternatives", "/alternative",
  );
  if (isComparisonPath) {
    score += 60; reasons.push("comparison path (+60)");
  }
  if (i.contentInterestCategory === "pricing") {
    score += 30; reasons.push("pricing page (+30)");
  }
  if (/\b(vs|versus|alternative|compare|comparison|competitor)\b/i.test(i.utmTerm)) {
    score += 30; reasons.push("comparison UTM term (+30)");
  }
  if (i.channelGroup === "paid-search" && isComparisonPath) {
    score += 20; reasons.push("paid-search+comparison (+20)");
  }
  if (i.funnelStage === "consideration") {
    score += 15; reasons.push("funnelStage=consideration (+15)");
  }
  if (i.pageViewCount >= 2) {
    score += 10; reasons.push("multiPage (+10)");
  }

  return { score: cap(score), reasons };
}

function scoreTrial(i: ScoringInputs): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (pathIncludes(i.pathname,
    "/trial", "/free-trial", "/signup", "/sign-up", "/register",
    "/get-started", "/start-free", "/start", "/onboarding",
  )) {
    score += 50; reasons.push("trial/signup path (+50)");
  }
  if (/\b(trial|signup|sign.up|register|get.started)\b/i.test(i.utmCampaign)) {
    score += 20; reasons.push("trial UTM campaign (+20)");
  }
  if (i.funnelStage === "decision") {
    score += 20; reasons.push("funnelStage=decision (+20)");
  }
  if (i.contentInterestCategory === "pricing" && i.hasClickedCta) {
    score += 20; reasons.push("pricing+ctaClick (+20)");
  }
  if (i.visitType === "returning" && i.ctaClickCount > 0) {
    score += 15; reasons.push("returning+ctaClick (+15)");
  }
  if (i.channelGroup === "email") {
    score += 15; reasons.push("email channel (+15)");
  }
  if (i.campaignType === "demand-gen" && i.funnelStage === "intent") {
    score += 15; reasons.push("demand-gen+intent (+15)");
  }

  return { score: cap(score), reasons };
}

function scoreJob(i: ScoringInputs): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (pathIncludes(i.pathname,
    "/jobs", "/careers", "/career", "/vacancies", "/vacancy", "/apply", "/work-with-us",
  )) {
    score += 70; reasons.push("careers/jobs path (+70)");
  }
  if (/vacancy|jobs|career|recruit/i.test(i.templateKey)) {
    score += 40; reasons.push("job template (+40)");
  }
  if (/\b(jobs|career|vacancy|vacancies|hiring|recruit)\b/i.test(i.utmCampaign)) {
    score += 25; reasons.push("jobs UTM campaign (+25)");
  }
  if (i.channelGroup === "organic-search" &&
      pathIncludes(i.pathname, "/jobs", "/careers", "/vacancies", "/vacancy")) {
    score += 15; reasons.push("organic-search+job-path (+15)");
  }

  return { score: cap(score), reasons };
}

// ── Main computation function ──────────────────────────────────────────────────

/**
 * Signals bag passed to computeIntentContext.
 *
 * Accepts the pieces of DecisionContext that intent scoring reads from so that
 * the function can be called without importing the full DecisionContext type
 * (avoiding a circular module dependency).
 */
export interface IntentSignalBag {
  readonly pathname:    string | null | undefined;
  readonly templateKey: string | null | undefined;
  readonly derived:     Partial<DerivedContext>;
  readonly history:     Pick<VisitorHistory, "pageViewCount" | "hasClickedCta" | "ctaClickCount">;
  readonly enrichment:  Partial<EnrichmentOutput>;
  readonly utmTerm:     string | null | undefined;
  readonly utmCampaign: string | null | undefined;
  readonly visitType:   "new" | "returning" | null | undefined;
  readonly source:      string;
}

/**
 * Compute the intent layer from all available context signals.
 *
 * Pure function — no I/O, never throws.  All inputs are guarded.
 *
 * @param signals  The signal bag assembled from the full DecisionContext.
 * @returns        A fully populated IntentContext — never null.
 */
export function computeIntentContext(signals: IntentSignalBag): IntentContext {
  // ── Normalise inputs ─────────────────────────────────────────────────────────

  const inputs: ScoringInputs = {
    pathname:                (signals.pathname ?? "/").toLowerCase(),
    funnelStage:             signals.derived.funnelStage ?? null,
    channelGroup:            signals.derived.channelGroup ?? null,
    campaignType:            signals.derived.campaignType ?? null,
    contentInterestCategory: signals.derived.contentInterestCategory ?? null,
    isResearching:           signals.derived.isResearching ?? false,
    isReadyToConvert:        signals.derived.isReadyToConvert ?? false,
    hasClickedCta:           signals.history.hasClickedCta,
    ctaClickCount:           signals.history.ctaClickCount,
    pageViewCount:           signals.history.pageViewCount,
    visitType:               signals.visitType ?? null,
    crmLifecycleStage:       (signals.enrichment.crmLifecycleStage ?? "").toLowerCase(),
    utmTerm:                 (signals.utmTerm     ?? "").toLowerCase(),
    utmCampaign:             (signals.utmCampaign ?? "").toLowerCase(),
    templateKey:             (signals.templateKey ?? "").toLowerCase(),
    source:                  (signals.source      ?? "").toLowerCase(),
  };

  // ── Score each intent type ───────────────────────────────────────────────────

  const demoResult       = scoreDemo(inputs);
  const researchResult   = scoreResearch(inputs);
  const comparisonResult = scoreComparison(inputs);
  const trialResult      = scoreTrial(inputs);
  const jobResult        = scoreJob(inputs);

  const scoreMap: Record<Exclude<IntentType, "unknown">, { score: number; reasons: string[] }> = {
    demo:       demoResult,
    research:   researchResult,
    comparison: comparisonResult,
    trial:      trialResult,
    job:        jobResult,
  };

  // ── Determine primary and secondary intent ───────────────────────────────────

  // Sort scorable intents by score descending.
  const sorted = [...SCORABLE_INTENTS].sort(
    (a, b) => scoreMap[b].score - scoreMap[a].score,
  );

  const primaryType  = sorted[0]!;
  const primaryScore = scoreMap[primaryType].score;
  const primaryReasons = scoreMap[primaryType].reasons;

  // Unknown when no positive signal at all.
  const intentPrimary: IntentType =
    primaryScore === 0 ? "unknown" : primaryType;

  // Secondary: runner-up that clears the threshold (and is not the primary).
  const secondaryType  = sorted[1]!;
  const secondaryScore = scoreMap[secondaryType].score;
  const intentSecondary: IntentType | null =
    secondaryScore >= SECONDARY_THRESHOLD && intentPrimary !== "unknown"
      ? secondaryType
      : null;

  // Confidence: primary score normalised to [0, 1].
  const intentConfidence = Math.round((primaryScore / 100) * 100) / 100;

  // Build reason string (compact, for debug overlay and AI context).
  const intentReason: string =
    intentPrimary === "unknown"
      ? "No significant intent signals detected."
      : [
          `${intentPrimary} (score ${primaryScore})`,
          primaryReasons.slice(0, 3).join(" · "),
        ].filter(Boolean).join(" — ");

  return {
    // Scores
    intentDemoScore:       demoResult.score,
    intentResearchScore:   researchResult.score,
    intentComparisonScore: comparisonResult.score,
    intentTrialScore:      trialResult.score,
    intentJobScore:        jobResult.score,
    // Normalised
    intentPrimary,
    intentSecondary,
    intentConfidence,
    intentReason,
  };
}

// ── Empty intent context (safe default before computation) ─────────────────────

/**
 * Returns an IntentContext with all scores at 0 and intent = "unknown".
 *
 * Used as the default value in buildDecisionContext() when no intent
 * context has been computed yet.  Keeps the context object fully typed
 * without triggering computation.
 */
export function emptyIntentContext(): IntentContext {
  return {
    intentDemoScore:       0,
    intentResearchScore:   0,
    intentComparisonScore: 0,
    intentTrialScore:      0,
    intentJobScore:        0,
    intentPrimary:         "unknown",
    intentSecondary:       null,
    intentConfidence:      0,
    intentReason:          "Intent not yet computed.",
  };
}
