/**
 * Decision Context
 *
 * The canonical normalized runtime context object consumed by the decision
 * engine, rules evaluator, and AI providers.
 *
 * ─── What DecisionContext is ─────────────────────────────────────────────────
 *
 *   DecisionContext is the single, fully-populated context object available
 *   at rule-evaluation time.  It composes signals from every source layer:
 *
 *     • VisitorContext (HTTP request signals)
 *     • VisitorHistory (first-party session history from Supabase)
 *     • Page-level metadata (pathname, pageType, templateKey — from RSC render)
 *     • Tenant configuration (tenantId, packageKey — from TenantSettings)
 *
 *   It extends RuleEvaluationContext so it is directly usable by
 *   buildMatchPredicate() and evaluateCondition() without any adapter.
 *
 * ─── Difference from existing types ─────────────────────────────────────────
 *
 *   VisitorContext     — request signals only (source, device, UTM, …)
 *   DecisionInput      — VisitorContext + history: VisitorHistory
 *   RuleEvaluationContext — DecisionInput + optional page props
 *   DecisionContext    — RuleEvaluationContext + packageKey (this file)
 *
 *   DecisionContext is the superset used in production at rule-eval time.
 *   It supersedes constructing a RuleEvaluationContext inline.
 *
 * ─── Building ────────────────────────────────────────────────────────────────
 *
 *   Use buildDecisionContext() — never construct the object inline.
 *   The builder applies safe defaults so a partially-populated call site
 *   never crashes the decision engine.
 *
 * @example
 * const ctx = buildDecisionContext({
 *   visitorContext: detectVisitorContext(request),
 *   history:        await fetchVisitorHistory(sessionId, tenantId),
 *   pathname:       "/",
 *   tenantId:       "workengine",
 *   pageType:       "landing",
 *   templateKey:    "standard-landing",
 *   packageKey:     "growth",
 * });
 *
 * // Pass to rules engine
 * const plan = rulesProvider.getHomepagePlan(ctx);
 *
 * // Build an AI-eligible context snapshot
 * import { getVarsForAI } from "@/context/registry";
 * const aiSnapshot = Object.fromEntries(
 *   getVarsForAI().map(v => [v.key, ctx[v.key as keyof DecisionContext] ?? null])
 * );
 */

import type { VisitorContext }       from "@/context/types";
import type { VisitorHistory }       from "@/context/visitor-history";
import type { PackageKey }           from "@/tenant/types";
import type { RuleEvaluationContext } from "./rules/field-registry";
import type { EnrichmentOutput }     from "@/enrichment/types";
import type { ClientContext }        from "@/context/client-context";
import type { DerivedContext }       from "@/context/derived-context";
import type { IntentContext }        from "@/context/intent-context";
import { emptyIntentContext }        from "@/context/intent-context";
import type { InterestScore, InterestContextVars } from "@/interest-profiles/types";

// ── DecisionContext type ───────────────────────────────────────────────────────

/**
 * The fully normalized runtime context object.
 *
 * Extends RuleEvaluationContext (which extends DecisionInput, which extends
 * VisitorContext) with the tenant's package tier so that rules can gate on
 * subscription level without a separate lookup.
 *
 * All optional fields default to `null` in buildDecisionContext(); no field
 * is ever `undefined` after the builder runs.
 */
export interface DecisionContext extends RuleEvaluationContext {
  /**
   * Tenant subscription tier.
   * Null when tenant settings are unavailable at render time.
   *
   * Maps to the "package" field in the context variable registry and
   * RuleFieldKey for rule condition evaluation.
   */
  packageKey: PackageKey | null;

  /**
   * Comma-joined keys of audience segments that matched for this visitor.
   *
   * Populated by evaluateAudienceSegments() after buildDecisionContext() has
   * assembled all context layers (interest scores, journey state, enrichment).
   * Apply via applyAudienceSegments(ctx, ids) to produce a new context.
   *
   * Null when no active segments exist or none matched the visitor.
   * Example: "high-intent-enterprise,returning-customer"
   */
  audienceSegmentIds: string | null;

  /**
   * Merged output from all enrichers that ran successfully.
   *
   * All fields are optional (`Partial<EnrichmentOutput>`) — only resolved
   * enricher fields are present. Field resolvers access individual keys via
   * `ctx.enrichment?.countryCode ?? null`.
   *
   * Populated by `applyEnrichment()` after `runEnrichmentPipeline()`.
   * Default: `{}` (empty partial — no enrichment available or pipeline skipped).
   */
  enrichment: Partial<EnrichmentOutput>;

  /**
   * Client / device context — UA-parsed server fields + browser-collected signals.
   *
   * Server fields (deviceType, osName, osVersion, browserName, browserVersion,
   * engineName) are populated on every request from the User-Agent header.
   *
   * Client fields (isTouchDevice, viewportWidth, viewportHeight, pixelRatio,
   * preferredColorScheme, preferredLanguage, timeZone) are populated from the
   * mc_cc cookie, written by ClientContextCollector on the first page load.
   * Fields are null on the very first request; populated on all subsequent ones.
   *
   * Null when clientContext was not built at construction time.
   */
  clientContext: ClientContext | null;

  /**
   * Computed signals derived from all other context layers.
   *
   * Populated by computeDerivedContext() at the end of buildDecisionContext(),
   * after enrichment and time context have been fully assembled.
   *
   * All fields inside DerivedContext are individually nullable — a null field
   * means "not enough input data to compute this signal", not an error.
   *
   * Default: `{}` (empty partial — no derived context computed yet).
   */
  derived: Partial<DerivedContext>;

  /**
   * Explicit intent prediction layer.
   *
   * Populated by computeIntentContext() after derived context is available.
   * Exposes intentPrimary, intentSecondary, intentConfidence, and per-intent
   * propensity scores (0–100) for demo, research, comparison, trial, and job.
   *
   * Never null — defaults to emptyIntentContext() (all zeros, "unknown" primary)
   * when not yet computed.  Intent context lives under ctx.intent.* so it is
   * addressable as a distinct source group in the debug snapshot and registry.
   *
   * Populate by passing the result of:
   *   computeIntentContext({ pathname, derived, history, enrichment, ... })
   * or via applyIntentContext(ctx, computed) after buildDecisionContext().
   */
  intent: IntentContext;
}

// ── Builder options ────────────────────────────────────────────────────────────

/**
 * Inputs for buildDecisionContext().
 *
 * All fields except `visitorContext` and `history` are optional; the builder
 * supplies safe null defaults for absent fields.
 */
export interface BuildDecisionContextOptions {
  /** Raw request signals, from detectVisitorContext(). Always required. */
  visitorContext: VisitorContext;

  /**
   * First-party behavioural history for this session.
   * Pass emptyHistory() as a safe fallback when the DB query fails.
   */
  history: VisitorHistory;

  /**
   * Request pathname, e.g. "/" or "/blog/my-post".
   * Populated by the RSC page component.
   */
  pathname?: string | null;

  /**
   * Active tenant identifier.
   * Populated from TenantSettings.tenantId.
   */
  tenantId?: string | null;

  /**
   * Content category of the current page, e.g. "landing", "article".
   * Populated by the RSC page component or the CMS response.
   */
  pageType?: string | null;

  /**
   * Active page template key, e.g. "standard-landing".
   * Populated from PageConfig.templateKey.
   */
  templateKey?: string | null;

  /**
   * Tenant subscription tier.
   * Populated from TenantSettings.packageKey.
   */
  packageKey?: PackageKey | null;

  /**
   * Pre-resolved enrichment output.
   * Pass the result of `runEnrichmentPipeline().output` when available.
   * Defaults to `{}` when omitted.
   */
  enrichment?: Partial<EnrichmentOutput> | null;

  /**
   * Pre-resolved client/device context.
   * When provided, this value is used as-is.
   * Defaults to null when omitted (no client context available).
   */
  clientContext?: ClientContext | null;

  /**
   * Pre-computed derived context.
   * When provided, this value is used as-is (useful for testing).
   * Defaults to `{}` when omitted — no derived signals populated.
   * In production, pass the result of `computeDerivedContext(ctx)`.
   */
  derived?: Partial<DerivedContext> | null;

  /**
   * Pre-computed intent context.
   * When provided, this value is used as-is (useful for testing).
   * Defaults to emptyIntentContext() when omitted — "unknown" primary, all scores 0.
   * In production, pass the result of `computeIntentContext(signalBag)`.
   */
  intent?: IntentContext | null;

  /**
   * Pre-evaluated audience segment IDs for this visitor.
   *
   * Pass the result of `evaluateAudienceSegments(ctx, tenantId)` from
   * audience-segments/evaluate.ts.  Null when no segments matched.
   *
   * Typically applied via applyAudienceSegments(ctx, ids) AFTER all other
   * context layers have been assembled, because segment criteria can reference
   * any field in the final context (interest scores, journey state, etc.).
   */
  audienceSegmentIds?: string | null;

  /**
   * Per-profile interest scores for the current visitor.
   *
   * Pass the output of `scoreInterests(keywordCloud, activeProfiles)`.
   * Null when no active profiles are loaded or the visitor's keyword cloud is empty.
   *
   * Exposed via RuleEvaluationContext so field resolvers can access
   * individual profile scores (interestPricingScore, interestProductScore, etc.).
   */
  interestScores?: readonly InterestScore[] | null;

  /**
   * Pre-computed interest context variables derived from `interestScores`.
   *
   * Pass the output of `buildInterestContextVars(interestScores)`.
   * Null when `interestScores` is null or all scores are zero.
   *
   * Resolvers access it via `ctx.interestContext?.interestPrimary` etc.
   */
  interestContext?: InterestContextVars | null;
}

// ── Builder function ───────────────────────────────────────────────────────────

/**
 * Build a fully normalized DecisionContext from all available signal sources.
 *
 * ─── Safe defaults ────────────────────────────────────────────────────────────
 *
 *   All optional fields default to null when absent.  This ensures:
 *   - No rule condition crashes due to undefined field access.
 *   - Rule predicates that check `exists` / `not_exists` behave correctly.
 *   - AI context snapshots always have consistent keys.
 *
 * ─── Runtime safety ───────────────────────────────────────────────────────────
 *
 *   The builder wraps optional fields in `?? null` so no downstream code
 *   needs to guard against `undefined`.  Decision rules that rely on optional
 *   fields (pathname, pageType, templateKey, packageKey) should check for
 *   null rather than assuming a value is always present.
 *
 * @example
 * const ctx = buildDecisionContext({ visitorContext, history, pathname: "/" });
 * // ctx.pathname      === "/"
 * // ctx.packageKey    === null   (not provided → safe default)
 * // ctx.source        === "google"  (from visitorContext)
 */
export function buildDecisionContext(
  opts: BuildDecisionContextOptions,
): DecisionContext {
  return {
    // ── VisitorContext fields (from request signals) ─────────────────────────
    ...opts.visitorContext,

    // ── VisitorHistory (first-party session events) ──────────────────────────
    history: opts.history,

    // ── Page-level metadata ──────────────────────────────────────────────────
    pathname:    opts.pathname    ?? null,
    pageType:    opts.pageType    ?? null,
    templateKey: opts.templateKey ?? null,

    // ── Tenant configuration ─────────────────────────────────────────────────
    tenantId:   opts.tenantId   ?? null,
    packageKey: opts.packageKey ?? null,

    // ── Enrichment (external data, async pipeline) ───────────────────────────
    enrichment: opts.enrichment ?? {},

    // ── Client / device context ──────────────────────────────────────────────
    clientContext: opts.clientContext ?? null,

    // ── Derived context (computed from all other layers) ─────────────────────
    derived: opts.derived ?? {},

    // ── Intent context (explicit intent prediction layer) ────────────────────
    // Default to empty (all scores 0, "unknown" primary) when not supplied.
    // Callers should pass computeIntentContext(signalBag) or use applyIntentContext().
    intent: opts.intent ?? emptyIntentContext(),

    // ── Interest profile scoring ─────────────────────────────────────────────
    // Default to null; populate by running:
    //   const cloud   = accumulateKeywords(history.journey?.viewedKeywords ?? []);
    //   const scores  = scoreInterests(cloud, activeProfiles);
    //   const iCtx    = buildInterestContextVars(scores);
    // then pass { interestScores: scores, interestContext: iCtx } to the builder.
    interestScores:  opts.interestScores  ?? null,
    interestContext: opts.interestContext ?? null,

    // ── Audience segments ─────────────────────────────────────────────────────
    // Default to null; populate AFTER all other context layers are ready:
    //   const ids     = await evaluateAudienceSegments(ctx, tenantId);
    //   const finalCtx = applyAudienceSegments(ctx, ids);
    // or pass the pre-evaluated result directly here.
    audienceSegmentIds: opts.audienceSegmentIds ?? null,
  };
}

// ── applyEnrichment ────────────────────────────────────────────────────────────

/**
 * Merge enrichment pipeline output into a DecisionContext.
 *
 * Returns a new DecisionContext with the enrichment field updated.
 * Does NOT mutate the original context.
 *
 * Typical usage:
 * ```
 * const baseCtx    = buildDecisionContext({ visitorContext, history, ... });
 * const { output } = await runEnrichmentPipeline(enrichers, input);
 * const ctx        = applyEnrichment(baseCtx, output);
 * ```
 *
 * You may also pass `buildDecisionContext({ ..., enrichment: output })` directly
 * when the enrichment result is available at construction time.
 *
 * @param ctx    - Base DecisionContext to update.
 * @param output - Partial enrichment output from runEnrichmentPipeline().
 * @returns      - New DecisionContext with merged enrichment.
 */
export function applyEnrichment(
  ctx: DecisionContext,
  output: Partial<EnrichmentOutput>,
): DecisionContext {
  return {
    ...ctx,
    enrichment: {
      ...ctx.enrichment,
      ...output,
    },
    // derived is preserved as-is; callers should re-run computeDerivedContext
    // if enrichment changes are expected to affect derived signals.
  };
}

// ── applyIntentContext ─────────────────────────────────────────────────────────

/**
 * Merge a computed IntentContext into a DecisionContext.
 *
 * Returns a new DecisionContext — does NOT mutate the original.
 * Call this after computeIntentContext() has been run with the fully-assembled
 * derived context and history.
 *
 * Typical usage:
 * ```
 * const baseCtx  = buildDecisionContext({ ..., derived });
 * const intent   = computeIntentContext({ pathname, derived, history, enrichment, ... });
 * const ctx      = applyIntentContext(baseCtx, intent);
 * ```
 */
export function applyIntentContext(
  ctx:    DecisionContext,
  intent: IntentContext,
): DecisionContext {
  return { ...ctx, intent };
}

// ── applyAudienceSegments ──────────────────────────────────────────────────────

/**
 * Merge evaluated audience segment IDs into a DecisionContext.
 *
 * Returns a new DecisionContext — does NOT mutate the original.
 * Call this after evaluateAudienceSegments() has been run against the fully
 * assembled context (post-enrichment, post-interest, post-intent).
 *
 * Typical usage:
 * ```
 * const baseCtx  = buildDecisionContext({ ... });
 * const ids      = await evaluateAudienceSegments(baseCtx, tenantId);
 * const ctx      = applyAudienceSegments(baseCtx, ids);
 * ```
 */
export function applyAudienceSegments(
  ctx: DecisionContext,
  audienceSegmentIds: string | null,
): DecisionContext {
  return { ...ctx, audienceSegmentIds };
}

// ── AI context snapshot helper ─────────────────────────────────────────────────

/**
 * Extracts the AI-eligible subset of a DecisionContext as a plain key→value
 * record, ready to attach to an AI decision request.
 *
 * Only variables where availableToAI = true in the context registry are
 * included.  All values are coerced to JSON-safe primitives.
 *
 * Does NOT import from @/context/registry at module load — uses a lazy
 * dynamic import pattern so this helper is tree-shakeable in edge environments.
 *
 * @example
 * const ctx = buildDecisionContext({ ... });
 * const snap = extractAIContext(ctx);
 * // { source: "linkedin", device: "desktop", visitType: "returning", ... }
 */
export async function extractAIContext(
  ctx: DecisionContext,
): Promise<Record<string, unknown>> {
  // Dynamically import the registry to avoid a module-load-time
  // dependency on context/registry from this decision-layer file.
  const { getVarsForAI } = await import("@/context/registry");

  const snapshot: Record<string, unknown> = {};

  for (const varDef of getVarsForAI()) {
    const key = varDef.key as keyof DecisionContext;

    if (varDef.source === "enrichment") {
      // Enrichment variables are nested under ctx.enrichment
      const enrichmentKey = varDef.key as keyof EnrichmentOutput;
      snapshot[varDef.key] = ctx.enrichment[enrichmentKey] ?? null;
    } else if (varDef.source === "history") {
      // History variables are nested under ctx.history
      const historyKey = key as keyof VisitorHistory;
      snapshot[varDef.key] = ctx.history[historyKey] ?? null;
    } else if (varDef.source === "client") {
      // Client variables are nested under ctx.clientContext
      const clientKey = varDef.key as keyof import("@/context/client-context").ClientContext;
      snapshot[varDef.key] = ctx.clientContext?.[clientKey] ?? null;
    } else if (varDef.source === "derived") {
      // Derived variables are nested under ctx.derived
      const derivedKey = varDef.key as keyof DerivedContext;
      snapshot[varDef.key] = ctx.derived[derivedKey] ?? null;
    } else if (varDef.source === "intent") {
      // Intent variables are nested under ctx.intent
      const intentKey = varDef.key as keyof IntentContext;
      snapshot[varDef.key] = ctx.intent[intentKey] ?? null;
    } else {
      const rawValue = ctx[key];
      snapshot[varDef.key] = rawValue ?? null;
    }
  }

  return snapshot;
}
