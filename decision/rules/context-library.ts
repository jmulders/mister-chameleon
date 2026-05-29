/**
 * Context Library
 *
 * Named, reusable predicates that sit between raw signals (field values) and
 * rule conditions.  A ContextDefinition packages a RuleCondition under a stable
 * human-readable identifier so that multiple rules can reference the same
 * visitor segment without duplicating condition logic.
 *
 * ─── Architecture position ────────────────────────────────────────────────────
 *
 *   signals (field values)
 *     ↓
 *   contexts (ContextDefinition — named predicates over signals)
 *     ↓
 *   rule packs (RulePack — grouped rule sets with a shared theme)
 *     ↓
 *   decisions (ExperiencePlan selected by the first matching rule)
 *
 * ─── Why contexts? ────────────────────────────────────────────────────────────
 *
 *   Without contexts a rule like "Returning visitor from Google with 3+ page views"
 *   has to spell out every field condition inline.  Two separate rules targeting
 *   "high-engagement Google traffic" each carry an identical condition tree —
 *   any change must be made in two places.
 *
 *   With contexts:
 *     • { type: "context", contextId: "ctx_google_traffic" }
 *     • { type: "context", contextId: "ctx_high_engagement" }
 *
 *   The rule engine resolves each context ID once per evaluation and caches
 *   the result for the lifetime of the request — if three rules reference
 *   ctx_google_traffic, the underlying field lookup runs only once.
 *
 * ─── Built-in contexts ────────────────────────────────────────────────────────
 *
 *   Traffic / source
 *     ctx_google_traffic       — Traffic source is Google (organic)
 *     ctx_linkedin_traffic     — Traffic source is LinkedIn
 *     ctx_paid_traffic         — Traffic source is any paid channel
 *     ctx_direct_traffic       — Direct or unattributed traffic
 *     ctx_referral_traffic     — Referred from another site (non-social)
 *
 *   Visitor type
 *     ctx_new_visitor          — First-time visitor (visitType = "new")
 *     ctx_returning_visitor    — Returning visitor (visitType = "returning")
 *     ctx_returning_cta_clicked — Returning + previously clicked a CTA
 *     ctx_high_engagement      — 3+ page views in session history
 *
 *   Device
 *     ctx_mobile_device        — Mobile device detected
 *     ctx_desktop_device       — Desktop / laptop device detected
 *
 * ─── Adding a context ────────────────────────────────────────────────────────
 *
 *   1. Choose a stable `id` (prefix `ctx_`; never rename once deployed).
 *   2. Write the condition — any valid RuleCondition (field, named, group,
 *      or even another context reference).
 *   3. Add a descriptive `label` and `description`.
 *   4. Optionally add `tags` to group it in the admin UI filter.
 *   5. The context is immediately available in the condition editor as a new
 *      `{ type: "context", contextId: "<id>" }` leaf.
 *
 * ─── Evaluation ───────────────────────────────────────────────────────────────
 *
 *   evaluateContext(contextId, ctx)  — looks up the definition and runs
 *                                      evaluateCondition on its condition.
 *
 *   evaluateContexts(ctx)            — evaluates ALL registered contexts and
 *                                      returns a Map<contextId, boolean>.  This
 *                                      is called once per request so individual
 *                                      ContextCondition evaluations can short-
 *                                      circuit by consulting the pre-built map.
 *
 * ─── Backward compatibility ───────────────────────────────────────────────────
 *
 *   `NamedCondition` (type: "named") still works and still appears in the
 *   editor.  Named conditions are essentially anonymous inline contexts —
 *   the existing NAMED_CONDITIONS map continues to be the implementation for
 *   `ctx_returning_cta_clicked` and `ctx_high_engagement`.
 */

import { evaluateCondition }        from "./stored-rule";
import type { RuleCondition }       from "./stored-rule";
import type { RuleEvaluationContext } from "./field-registry";
import { logger }                   from "@/lib/logger";

// ── Context definition ─────────────────────────────────────────────────────────

/**
 * A named, reusable predicate over visitor context signals.
 *
 * `condition` is any valid RuleCondition — including another ContextCondition
 * (contextId reference), which allows building contexts from contexts.
 * Circular references are detected at evaluation time and return false with
 * a warning.
 */
export interface ContextDefinition {
  /** Stable identifier — safe to reference in stored rules.  Never rename. */
  readonly id:          string;
  /** Human-readable name shown in the admin UI context picker. */
  readonly label:       string;
  /** One-sentence explanation of when this context fires. */
  readonly description: string;
  /**
   * The declarative condition that determines whether this context is active
   * for a given request.  JSON-serialisable (no functions).
   */
  readonly condition:   RuleCondition;
  /**
   * Grouping tags for filtering in the admin UI.
   * e.g. ["traffic", "source"], ["visitor", "engagement"]
   */
  readonly tags?:       readonly string[];
}

// ── Registry ───────────────────────────────────────────────────────────────────

/**
 * The authoritative map of all platform-defined contexts.
 *
 * Keys are context IDs (matching the `id` field inside each definition).
 * New contexts should be added here; never remove or rename existing entries
 * as stored rules may reference them by ID.
 */
export const CONTEXT_REGISTRY: Readonly<Record<string, ContextDefinition>> = {

  // ── Traffic source ─────────────────────────────────────────────────────────

  ctx_google_traffic: {
    id:          "ctx_google_traffic",
    label:       "Google traffic",
    description: "Visitor arrived via a Google search result (organic or unattributed Google source).",
    tags:        ["traffic", "source"],
    condition:   { type: "field", field: "source", operator: "equals", value: "google" },
  },

  ctx_linkedin_traffic: {
    id:          "ctx_linkedin_traffic",
    label:       "LinkedIn traffic",
    description: "Visitor arrived via LinkedIn (organic feed, DM link, or company page).",
    tags:        ["traffic", "source"],
    condition:   { type: "field", field: "source", operator: "equals", value: "linkedin" },
  },

  ctx_paid_traffic: {
    id:          "ctx_paid_traffic",
    label:       "Paid traffic",
    description: "Visitor arrived via any paid advertising channel.",
    tags:        ["traffic", "source", "paid"],
    condition:   { type: "field", field: "source", operator: "in", value: ["google_ads", "linkedin_ads", "meta_ads", "display"] },
  },

  ctx_direct_traffic: {
    id:          "ctx_direct_traffic",
    label:       "Direct / unattributed traffic",
    description: "Visitor has no detectable traffic source — typed the URL directly or attribution was stripped.",
    tags:        ["traffic", "source"],
    condition:   { type: "group", logic: "or", conditions: [
      { type: "field", field: "source", operator: "not_exists" },
      { type: "field", field: "source", operator: "equals", value: "direct" },
    ]},
  },

  ctx_referral_traffic: {
    id:          "ctx_referral_traffic",
    label:       "Referral traffic",
    description: "Visitor was referred from an external website (not a social platform).",
    tags:        ["traffic", "source"],
    condition:   { type: "field", field: "source", operator: "equals", value: "referral" },
  },

  // ── Visitor type ───────────────────────────────────────────────────────────

  ctx_new_visitor: {
    id:          "ctx_new_visitor",
    label:       "New visitor",
    description: "First-time visitor with no recorded history in this tenant's session database.",
    tags:        ["visitor", "history"],
    condition:   { type: "field", field: "visitType", operator: "equals", value: "new" },
  },

  ctx_returning_visitor: {
    id:          "ctx_returning_visitor",
    label:       "Returning visitor",
    description: "Visitor has been seen before — session history record exists.",
    tags:        ["visitor", "history"],
    condition:   { type: "field", field: "visitType", operator: "equals", value: "returning" },
  },

  ctx_returning_cta_clicked: {
    id:          "ctx_returning_cta_clicked",
    label:       "Returning visitor — CTA previously clicked",
    description: "Returning visitor whose session history shows they previously clicked a CTA on this tenant's site. Requires database-backed history.",
    tags:        ["visitor", "history", "engagement", "intent"],
    condition:   { type: "named", name: "returning_cta_clicked" },
  },

  ctx_high_engagement: {
    id:          "ctx_high_engagement",
    label:       "High-engagement visitor (3+ page views)",
    description: "Visitor has viewed 3 or more pages in their recorded history. Requires database-backed history.",
    tags:        ["visitor", "history", "engagement"],
    condition:   { type: "named", name: "high_engagement" },
  },

  // ── Device ─────────────────────────────────────────────────────────────────

  ctx_mobile_device: {
    id:          "ctx_mobile_device",
    label:       "Mobile device",
    description: "Visitor is browsing on a mobile device (phone or tablet).",
    tags:        ["device"],
    condition:   { type: "field", field: "device", operator: "in", value: ["mobile", "tablet"] },
  },

  ctx_desktop_device: {
    id:          "ctx_desktop_device",
    label:       "Desktop / laptop",
    description: "Visitor is browsing on a desktop or laptop computer.",
    tags:        ["device"],
    condition:   { type: "field", field: "device", operator: "equals", value: "desktop" },
  },

} as const;

// ── Derived helpers ────────────────────────────────────────────────────────────

/** All registered context IDs — the union type mirrors CONTEXT_REGISTRY keys. */
export type ContextId = keyof typeof CONTEXT_REGISTRY;

/** All context IDs as a runtime array (for validation and UI pickers). */
export const ALL_CONTEXT_IDS: readonly string[] = Object.keys(CONTEXT_REGISTRY);

// ── Evaluation ─────────────────────────────────────────────────────────────────

/**
 * Evaluate a single named context against the visitor context.
 *
 * Looks up the ContextDefinition by ID, then delegates to evaluateCondition().
 * Returns false for unknown context IDs rather than throwing — corrupt stored
 * rules that reference a deleted context degrade gracefully.
 *
 * @param contextId  The context ID to evaluate (e.g. "ctx_google_traffic").
 * @param ctx        The full visitor evaluation context for this request.
 * @param seen       Internal cycle-detection set (do not pass externally).
 * @returns true if the context is active for this visitor; false otherwise.
 */
export function evaluateContext(
  contextId: string,
  ctx:       RuleEvaluationContext,
  seen:      ReadonlySet<string> = new Set(),
): boolean {
  const def = CONTEXT_REGISTRY[contextId];

  if (!def) {
    logger.warn("[decision/contexts] Unknown context ID — returning false", { contextId });
    return false;
  }

  // Cycle detection: a context whose condition eventually references itself.
  if (seen.has(contextId)) {
    logger.warn("[decision/contexts] Circular context reference detected — returning false", {
      contextId,
      chain: [...seen, contextId].join(" → "),
    });
    return false;
  }

  try {
    return evaluateCondition(def.condition, ctx);
  } catch (err) {
    logger.warn("[decision/contexts] evaluateContext threw — returning false", {
      contextId,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Pre-evaluate ALL registered contexts for a single request and return a
 * snapshot map.  Each context is evaluated exactly once; ContextConditions
 * within rule evaluation consult this map rather than re-evaluating.
 *
 * The returned map is passed into the RulesDecisionProvider so per-request
 * debug output can show which contexts were active for the visitor.
 *
 * @param ctx  The full visitor evaluation context for this request.
 * @returns    A `Map<contextId, boolean>` covering every registered context.
 */
export function evaluateAllContexts(
  ctx: RuleEvaluationContext,
): Map<string, boolean> {
  const result = new Map<string, boolean>();

  for (const id of ALL_CONTEXT_IDS) {
    result.set(id, evaluateContext(id, ctx));
  }

  return result;
}
