/**
 * Debug Context Snapshot
 *
 * Builds a fully-resolved snapshot of every context variable defined in the
 * registry, including variables that have not been resolved (null / missing).
 *
 * ─── Purpose ─────────────────────────────────────────────────────────────────
 *
 *   The DecisionTrace.context (TraceContextSnapshot) is intentionally limited
 *   to a small curated set of fields.  buildFullContextSnapshot() complements
 *   it by walking the entire CONTEXT_VARIABLES registry and resolving actual
 *   runtime values — including nulls — from a RuleEvaluationContext.
 *
 *   This is the data source for the ContextDebugPanel rendered in the dev
 *   diagnostics section of page.tsx.  It is never sent to the client or
 *   written to any log — it exists only for per-request server rendering
 *   of the debug overlay.
 *
 * ─── Resolution strategy ─────────────────────────────────────────────────────
 *
 *   source: "request" | "session" | "page" | "time"
 *     → top-level key on ctx (spread from VisitorContext + timeCtx)
 *
 *   source: "history"
 *     → ctx.history[key]
 *
 *   source: "tenant"  (only key: "package")
 *     → ctx.packageKey  (registry key "package" ≠ context property "packageKey")
 *
 *   source: "enrichment"
 *     → ctx.enrichment?.[key]
 *
 * ─── Safety ───────────────────────────────────────────────────────────────────
 *
 *   No raw IPs, no userAgent strings, no auth tokens are included in the output.
 *   The snapshot is dev-only; it is never rendered in NODE_ENV === "production"
 *   unless the caller explicitly opts in via ?debug=1.
 */

import type { RuleEvaluationContext } from "@/decision/rules/field-registry";
import {
  CONTEXT_VARIABLES,
  type ContextVarSource,
  type ContextVarType,
} from "@/context/registry";
import type { EnrichmentTrace, EnrichmentFieldTrace } from "@/enrichment/types";
import type { ScenarioOverrides } from "@/components/scenario/scenario-store";
import {
  matchContextDefinitions,
  type ContextMatch,
} from "@/context/library";
import type { ThemeDecisionTrace } from "@/decision/theme-decision";
import type { ScoringDebugPayload } from "@/lib/journey/types";
import type { KnownLeadContext } from "@/decision/decision-context";

// ── Public types ───────────────────────────────────────────────────────────────

/** Resolved runtime entry for a single context variable. */
export interface FullContextEntry {
  /** Stable registry key, e.g. "source", "countryCode". */
  key: string;
  /** Human-readable label for the admin UI. */
  label: string;
  /** One-sentence description of what the variable represents. */
  description: string;
  /** Value kind — determines display formatting. */
  type: ContextVarType;
  /** Which pipeline layer populates this variable. */
  source: ContextVarSource;
  /**
   * Resolved runtime value — the EFFECTIVE value after scenario overrides.
   * null when the variable was not populated (not an error — simply absent).
   */
  value: string | number | boolean | null;
  /** true when value !== null (i.e. the pipeline produced a value). */
  isResolved: boolean;
  /**
   * true when Scenario Control has an active override for this field.
   * Only populated when `scenarioOverrides` was passed to `buildFullContextSnapshot`.
   */
  isOverridden: boolean;
  /**
   * The raw (pre-override) value for this field, when it differs from the
   * effective value.  Only present when `rawCtx` was passed and `isOverridden`
   * is true.  Allows the debug UI to show "Raw: X → Override: Y".
   */
  rawValue?: string | number | boolean | null;
  /** Whether rules can reference this variable in conditions. */
  availableToRules: boolean;
  /** Whether AI providers include this variable in the context snapshot. */
  availableToAI: boolean;
  /**
   * Enrichment provenance trace for this field.
   * Only present for `source === "enrichment"` entries when an
   * `EnrichmentTrace` was passed to `buildFullContextSnapshot`.
   */
  trace?: EnrichmentFieldTrace;
}

/** Entries grouped by source, plus totals for the summary line. */
export interface FullContextSnapshot {
  /** All entries keyed by source group, in registry order. */
  bySource: Partial<Record<ContextVarSource, FullContextEntry[]>>;
  /** Number of variables that have a non-null resolved value. */
  totalResolved: number;
  /** Total number of variables in the registry. */
  totalVars: number;
  /**
   * Named audience profiles from the Context Library that matched the current
   * visitor.  Only populated when `includeContextLibrary` is set in options.
   *
   * Sorted by family order then definition order.
   */
  matchedContexts?: ContextMatch[];
  /**
   * Full theme decision trace from the most recent resolveThemeDecision() call.
   *
   * Includes trigger mode, all evaluated candidates, matched Context Library IDs,
   * and the winning rule/theme.  Passed in via options.themeDecision — this module
   * does not call resolveThemeDecision() itself to avoid circular dependencies
   * and double evaluation.
   *
   * Only populated when `themeDecision` is provided in options.
   */
  themeDecision?: ThemeDecisionTrace;
  /**
   * Behavioral scoring debug payload from the most recent full deriveBehaviorState()
   * call.  Shows which scoring rules fired, how much each contributed to
   * intentScore, and anti-noise metrics.
   *
   * Not available on every request — only populated when a fresh derivation was
   * triggered (e.g. after recording an event, or when debug mode forces recompute).
   * Callers pass it via options.scoringDebug.
   */
  scoringDebug?: ScoringDebugPayload;
  /**
   * Deterministic ABM identity, present only when the visitor arrived via a
   * personalized URL (the `mc_lead` cookie resolved to an active lead). Surfaces
   * the known account at a glance in the debug overlay, alongside the segment it
   * forced (see `forcedSegment`). Absent for anonymous traffic.
   */
  knownLead?: KnownLeadContext;
  /**
   * The audience-segment key the known lead forced into `audienceSegmentIds`
   * (the lead's `segment_hint`). Null when the lead had no linked segment.
   * Only present when `knownLead` is present.
   */
  forcedSegment?: string | null;
}

// Re-export for consumers that import from this module.
export type { ContextMatch };

// ── Source display order ───────────────────────────────────────────────────────

/**
 * Canonical display order for source groups in the debug panel.
 * Sources not in this list are appended after in insertion order.
 */
export const SOURCE_DISPLAY_ORDER: readonly ContextVarSource[] = [
  "request",
  "session",
  "history",
  "tenant",
  "page",
  "enrichment",
  "time",
  "client",
  "derived",
  "intent",
];

// ── Builder ────────────────────────────────────────────────────────────────────

/**
 * Walk the CONTEXT_VARIABLES registry and resolve every variable from the
 * provided RuleEvaluationContext, including variables that are null / absent.
 *
 * Safe to call on every request — pure transformation, no I/O, no side effects.
 *
 * @param ctx      The fully-populated evaluation context from buildDecisionContext().
 * @param options  Optional enrichment provenance data to annotate enrichment entries.
 * @returns        A grouped snapshot suitable for dev-overlay rendering.
 */
export function buildFullContextSnapshot(
  ctx: RuleEvaluationContext,
  options?: {
    /**
     * Field-level provenance map from `buildDecisionContext`'s `onDebugInfo`
     * callback.  When present, enrichment entries are annotated with their
     * provider, source, cache status, and consumed inputs.
     */
    enrichmentTrace?: EnrichmentTrace;
    /**
     * Active scenario overrides from Scenario Control.
     * When provided, entries whose key matches an active override are marked
     * `isOverridden: true` so the debug UI can highlight them.
     */
    scenarioOverrides?: ScenarioOverrides | null;
    /**
     * The raw (pre-override) context — the output of `buildDecisionContext`
     * before `applyScenarioToDecisionContext` is applied.
     *
     * When provided, overridden fields include a `rawValue` so the debug UI
     * can display both the original value and the scenario-overridden value:
     *   Raw: "evening"  →  Override: "afternoon"
     */
    rawCtx?: RuleEvaluationContext;
    /**
     * When true, evaluate the Context Library and attach matched audience
     * profiles to `FullContextSnapshot.matchedContexts`.
     *
     * Only active + suggested definitions are evaluated.
     * Skipped by default to avoid the (minor) overhead when the debug panel
     * section is not visible.
     */
    includeContextLibrary?: boolean;
    /**
     * The theme decision trace produced by resolveThemeDecision() for this
     * request.  When provided, attached to `FullContextSnapshot.themeDecision`
     * so the debug panel can render the full theme explainability section.
     *
     * Callers (page.tsx, API routes) obtain this from their own call to
     * resolveThemeDecision() and pass it in here to avoid double evaluation.
     */
    themeDecision?: ThemeDecisionTrace;
    /**
     * Scoring debug payload from a fresh deriveBehaviorState() call.
     * When provided, the debug panel renders a detailed scoring breakdown
     * showing which rules contributed to intentScore, with decay and noise info.
     *
     * Only available after event recording triggers a fresh derivation.
     * Callers attach it from the DeriveResult returned by deriveBehaviorState().
     */
    scoringDebug?: ScoringDebugPayload;
    /**
     * The audience-segment key forced by the known ABM lead (its `segment_hint`),
     * surfaced next to the `knownLead` badge. Pass the resolved lead's segment.
     */
    forcedSegment?: string | null;
  },
): FullContextSnapshot {
  const bySource: Partial<Record<ContextVarSource, FullContextEntry[]>> = {};
  let totalResolved = 0;
  const totalVars = CONTEXT_VARIABLES.length;

  // Cast ctx once for dynamic field access — used for request/session/page/time.
  // Double-cast through unknown because RuleEvaluationContext has no index signature.
  const ctxAny = ctx as unknown as Record<string, unknown>;
  const historyAny = (ctx.history ?? {}) as unknown as Record<string, unknown>;
  const enrichmentAny = (
    (ctx as unknown as { enrichment?: Record<string, unknown> }).enrichment ?? {}
  ) as Record<string, unknown>;
  const derivedAny = (
    (ctx as unknown as { derived?: Record<string, unknown> }).derived ?? {}
  ) as Record<string, unknown>;
  const intentAny = (
    (ctx as unknown as { intent?: Record<string, unknown> }).intent ?? {}
  ) as Record<string, unknown>;
  // Interest fields (interestPrimary, interestSecondary, interestConfidence) are
  // stored in ctx.interestContext, not in ctx.history, even though the registry
  // declares source: "history" (conceptually correct — derived from visit history).
  // We fall back to interestContext when ctx.history doesn't have the key.
  const interestCtxAny = (
    (ctx as unknown as { interestContext?: Record<string, unknown> }).interestContext ?? {}
  ) as Record<string, unknown>;

  // Raw context accessors (pre-override) — used to populate rawValue on overridden entries.
  const rawCtx = options?.rawCtx;
  const rawCtxAny        = rawCtx ? (rawCtx as unknown as Record<string, unknown>) : undefined;
  const rawHistoryAny    = rawCtx ? ((rawCtx.history ?? {}) as unknown as Record<string, unknown>) : undefined;
  const rawEnrichmentAny = rawCtx
    ? (((rawCtx as unknown as { enrichment?: Record<string, unknown> }).enrichment ?? {}) as Record<string, unknown>)
    : undefined;
  const rawDerivedAny    = rawCtx
    ? (((rawCtx as unknown as { derived?: Record<string, unknown> }).derived ?? {}) as Record<string, unknown>)
    : undefined;
  const rawInterestCtxAny = rawCtx
    ? (((rawCtx as unknown as { interestContext?: Record<string, unknown> }).interestContext ?? {}) as Record<string, unknown>)
    : undefined;

  // Build the set of actively overridden keys for the isOverridden flag.
  const activeOverrideKeys = new Set<string>();
  if (options?.scenarioOverrides) {
    for (const [k, v] of Object.entries(options.scenarioOverrides)) {
      if (v !== undefined && k !== "enrichmentPatch") {
        activeOverrideKeys.add(k);
      }
    }
  }

  for (const varDef of CONTEXT_VARIABLES) {
    let raw: unknown;

    if (varDef.source === "history") {
      raw = historyAny[varDef.key];
      // Fallback: interest fields live in ctx.interestContext, not ctx.history.
      if ((raw === null || raw === undefined) && varDef.key in interestCtxAny) {
        raw = interestCtxAny[varDef.key];
      }
    } else if (varDef.source === "enrichment") {
      raw = enrichmentAny[varDef.key];
    } else if (varDef.source === "client") {
      // Client variables live under ctx.clientContext, not at the top level.
      const clientCtxAny = (
        (ctx as unknown as { clientContext?: Record<string, unknown> }).clientContext ?? {}
      ) as Record<string, unknown>;
      raw = clientCtxAny[varDef.key];
    } else if (varDef.source === "derived") {
      // Derived variables live under ctx.derived.
      raw = derivedAny[varDef.key];
    } else if (varDef.source === "intent") {
      // Intent variables live under ctx.intent.
      raw = intentAny[varDef.key];
    } else if (varDef.source === "tenant" && varDef.key === "package") {
      // Registry key "package" lives under ctx.packageKey in the context model.
      raw = ctxAny["packageKey"];
    } else {
      // request, session, page, time — all spread at the top level of ctx.
      raw = ctxAny[varDef.key];
    }

    // Treat null and undefined the same: "not resolved".
    // 0, false, "" are resolved values — they carry meaning.
    const isResolved = raw !== null && raw !== undefined;
    if (isResolved) totalResolved++;

    // Coerce to a JSON-safe primitive.
    const value: FullContextEntry["value"] = isResolved
      ? (raw as string | number | boolean)
      : null;

    // Resolve the raw (pre-override) value for fields that are overridden.
    const isOverridden = activeOverrideKeys.has(varDef.key);
    let rawValue: FullContextEntry["rawValue"] = undefined;
    if (isOverridden && rawCtxAny !== undefined) {
      let rawRaw: unknown;
      if (varDef.source === "history") {
        rawRaw = rawHistoryAny?.[varDef.key];
        if ((rawRaw === null || rawRaw === undefined) && rawInterestCtxAny && varDef.key in rawInterestCtxAny) {
          rawRaw = rawInterestCtxAny[varDef.key];
        }
      } else if (varDef.source === "enrichment") {
        rawRaw = rawEnrichmentAny?.[varDef.key];
      } else if (varDef.source === "derived") {
        rawRaw = rawDerivedAny?.[varDef.key];
      } else if (varDef.source === "tenant" && varDef.key === "package") {
        rawRaw = rawCtxAny["packageKey"];
      } else {
        // request, session, page, time — top-level
        rawRaw = rawCtxAny[varDef.key];
      }
      rawValue = rawRaw !== null && rawRaw !== undefined
        ? (rawRaw as string | number | boolean)
        : null;
    }

    // Attach enrichment provenance trace when available.
    const trace: EnrichmentFieldTrace | undefined =
      varDef.source === "enrichment" && options?.enrichmentTrace
        ? (options.enrichmentTrace as Record<string, EnrichmentFieldTrace>)[varDef.key]
        : undefined;

    const entry: FullContextEntry = {
      key:              varDef.key,
      label:            varDef.label,
      description:      varDef.description,
      type:             varDef.type,
      source:           varDef.source,
      value,
      isResolved,
      isOverridden,
      ...(rawValue !== undefined ? { rawValue } : {}),
      availableToRules: varDef.availableToRules,
      availableToAI:    varDef.availableToAI,
      ...(trace ? { trace } : {}),
    };

    if (!bySource[varDef.source]) bySource[varDef.source] = [];
    bySource[varDef.source]!.push(entry);
  }

  // Optionally run the Context Library matcher.
  const matchedContexts: ContextMatch[] | undefined = options?.includeContextLibrary
    ? matchContextDefinitions(ctx)
    : undefined;

  // Surface the deterministic ABM identity (present only when the mc_lead cookie
  // resolved to an active lead), so the debug overlay shows the known account.
  const knownLead = (ctx as unknown as { knownLead?: KnownLeadContext }).knownLead;

  return {
    bySource,
    totalResolved,
    totalVars,
    matchedContexts,
    ...(options?.themeDecision ? { themeDecision: options.themeDecision } : {}),
    ...(options?.scoringDebug  ? { scoringDebug:  options.scoringDebug  } : {}),
    ...(knownLead ? { knownLead, forcedSegment: options?.forcedSegment ?? null } : {}),
  };
}

// ── Formatting helpers (used by ContextDebugPanel) ─────────────────────────────

/**
 * Format a resolved context value for display.
 *
 * - boolean    → "true" / "false"
 * - number     → the number as a string
 * - string ""  → "(empty string)"
 * - string     → the string value
 * - null       → null (caller renders "(unresolved)" label)
 */
export function formatContextValue(
  entry: FullContextEntry,
): string | null {
  if (!entry.isResolved || entry.value === null) return null;
  if (typeof entry.value === "boolean") return entry.value ? "true" : "false";
  if (typeof entry.value === "number") return String(entry.value);
  if (entry.value === "") return "(empty string)";
  return String(entry.value);
}
