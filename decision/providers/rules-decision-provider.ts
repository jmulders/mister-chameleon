/**
 * RulesDecisionProvider
 *
 * Resolves homepage plans from runtime-editable rules stored in
 * decision/rules/runtime-rules.json.
 *
 * ─── Evaluation pipeline ─────────────────────────────────────────────────────
 *
 *   1. Load rules from runtime-rules.json; fall back to SEED_RULES_CONFIG if
 *      the file is absent or fails validation.
 *   2. Sort compiled HomepageRules by priority (ascending).
 *   3. Iterate rules in priority order; return the plan of the first match.
 *   4. Return the stored defaultPlan when no rule matches.
 *
 * ─── Resilience layers ───────────────────────────────────────────────────────
 *
 *   Condition-level (evaluateCondition in stored-rule.ts)
 *     A field resolver that throws returns false for that leaf only; sibling
 *     OR branches are still evaluated.  An unknown field key also returns false
 *     with a logged warning.  Under normal operation, evaluateCondition never
 *     throws to its caller.
 *
 *   Rule-level (evaluateRules, this file)
 *     Each call to rule.match() is wrapped in try/catch.  This catches any
 *     error from hardcoded HomepageRule predicates (homepage-rules.ts) that
 *     bypass evaluateCondition, as well as any unexpected error that somehow
 *     escapes the condition-level handlers.  A throwing rule is skipped rather
 *     than aborting the evaluation loop.
 *
 *   Provider-level (getHomepagePlan, this file)
 *     An outer try/catch ensures the provider never rejects — it returns
 *     DEFAULT_HOMEPAGE_PLAN on any catastrophic failure (e.g. all rules throw,
 *     corrupt seed config, out-of-memory).
 *
 * ─── Context enrichment ──────────────────────────────────────────────────────
 *
 *   DecisionInput is widened to RuleEvaluationContext before evaluation.
 *   RuleEvaluationContext adds optional page-level fields (pathname, tenantId,
 *   pageType, templateKey).  Callers that want pathname-based or tenant-based
 *   rules can pass a RuleEvaluationContext — it extends DecisionInput and is
 *   accepted transparently.  Callers that pass a plain DecisionInput get the
 *   optional fields as undefined, which every field resolver handles gracefully.
 *
 * ─── Debug trace (development only) ─────────────────────────────────────────
 *
 *   In non-production environments, evaluateRules generates a RuleEvalTrace
 *   for every rule the engine touches.  These traces are emitted via
 *   logger.debug() so they appear in the dev terminal but never in production
 *   logs.
 *
 *   Per-rule trace log format:
 *
 *     Skipped rule  — compact single-line conditionSummary only; low noise.
 *     Matched rule  — full conditionDetail tree; enough to answer
 *                     "why did this rule fire?"
 *
 *   Example output for a matched two-condition group rule:
 *     [decision] Rule matched (priority 10) {
 *       ruleId: "homepage.google_mobile",
 *       ruleLabel: "Google on mobile",
 *       conditionSummary: "(Traffic source equals google AND Device type equals mobile) → ✓",
 *       conditionDetail: { kind: "group", logic: "and", matched: true, children: [...] },
 *       plan: { heroKey: "...", proofKey: "...", ctaKey: "..." }
 *     }
 *
 *   Example output for a skipped rule:
 *     [decision] Rule skipped (priority 5) {
 *       ruleId: "homepage.returning_cta_clicked",
 *       ruleLabel: "Returning visitor — CTA previously clicked",
 *       conditionSummary: "Returning visitor — CTA previously clicked → ✗"
 *     }
 *
 * ─── Fallback order ──────────────────────────────────────────────────────────
 *
 *   1. Valid runtime rules from runtime-rules.json (source: "runtime")
 *   2. Seed rules compiled from SEED_RULES_CONFIG   (source: "seed")
 *   3. DEFAULT_HOMEPAGE_PLAN                         (provider-level catch)
 */

import fs from "fs";
import path from "path";
import type { ExperiencePlan, DecisionInput } from "../types";
import type { DecisionProvider } from "./decision-provider";
import { DEFAULT_HOMEPAGE_PLAN, type HomepageRule } from "../rules/homepage-rules";
import {
  compileStoredRule,
  validateStoredConfig,
  SEED_RULES_CONFIG,
  type StoredRulesConfig,
  type StoredRule,
} from "../rules/stored-rule";
import type { RuleEvaluationContext } from "../rules/field-registry";
import {
  generateRuleTrace,
  ruleTraceToLogMeta,
  summariseTrace,
  collectMatchedContextIds,
  type RuleEvalTrace,
} from "../rules/rule-trace";
import { logger } from "@/lib/logger";

// ── Trace guard ────────────────────────────────────────────────────────────────

/**
 * Condition trace generation is gated behind this flag.
 *
 * logger.debug() already suppresses output in production, but the guard also
 * prevents the diagnostic tree-walk CPU cost on every production request.
 * Flip to true in any environment to enable per-request traces.
 */
const TRACE_ENABLED = process.env.NODE_ENV !== "production";

// ── Rules path ─────────────────────────────────────────────────────────────────

const RULES_PATH = path.join(
  process.cwd(),
  "decision",
  "rules",
  "runtime-rules.json",
);

// ── Rule loading ──────────────────────────────────────────────────────────────

/**
 * Build the compiled rule set from a StoredRulesConfig.
 *
 * Returns a `storedRuleMap` (ruleId → StoredRule) alongside the compiled
 * HomepageRules.  The map gives the trace machinery access to the raw
 * RuleCondition descriptors without adding a dependency between HomepageRule
 * and the stored-rule types (which would create a circular import).
 */
function buildFromConfig(config: StoredRulesConfig, source: "db" | "runtime" | "seed"): {
  rules:          HomepageRule[];
  storedRuleMap:  ReadonlyMap<string, StoredRule>;
  defaultPlan:    ExperiencePlan;
  rulesEnabled:   boolean;
  source:         "db" | "runtime" | "seed";
} {
  const sorted = [...config.rules].sort((a, b) => a.priority - b.priority);
  return {
    rules:         sorted.map(compileStoredRule),
    storedRuleMap: new Map(sorted.map((r) => [r.id, r])),
    defaultPlan:   { ...config.defaultPlan },
    rulesEnabled:  config.rulesEnabled !== false,   // default true when absent
    source,
  };
}

/**
 * Load, validate, and compile the runtime rules from the JSON file.
 * Falls back to SEED_RULES_CONFIG when the file is absent or invalid.
 */
function buildRuntimeRules(): {
  rules:          HomepageRule[];
  storedRuleMap:  ReadonlyMap<string, StoredRule>;
  defaultPlan:    ExperiencePlan;
  rulesEnabled:   boolean;
  source:         "db" | "runtime" | "seed";
} {
  try {
    const raw       = fs.readFileSync(RULES_PATH, "utf8");
    const candidate = JSON.parse(raw) as unknown;
    const errors    = validateStoredConfig(candidate);

    if (errors.length === 0) {
      return buildFromConfig(candidate as StoredRulesConfig, "runtime");
    }

    logger.warn("[decision] runtime-rules.json invalid — falling back to seed rules", {
      errors: errors.map((e) => `${e.field}: ${e.message}`),
    });
  } catch (err) {
    logger.warn("[decision] Failed to read runtime-rules.json — falling back to seed rules", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return buildFromConfig(SEED_RULES_CONFIG, "seed");
}

// ── Provider ──────────────────────────────────────────────────────────────────

export class RulesDecisionProvider implements DecisionProvider {
  /**
   * Optional pre-loaded StoredRulesConfig to use instead of the JSON file.
   *
   * When supplied (e.g. from the DB-backed tenant rules), the provider skips
   * the runtime-rules.json read entirely and compiles from this config.
   * This is the mechanism that makes per-tenant rules + enabled flags work.
   *
   * When omitted (legacy path), the provider reads from runtime-rules.json as
   * before — backward compatible with existing callsites that pass no args.
   */
  private readonly _storedConfig: StoredRulesConfig | undefined;

  /**
   * When true, skip rule evaluation entirely and return the tenant's defaultPlan
   * — the same outcome as the tenant-level `rulesEnabled: false` switch.
   *
   * Used for visitors past the monthly session cap. Emptying audience segments
   * (what the holdout does) is NOT enough there: the rules engine still adapts on
   * source, device and visit type, so a Google visitor would keep getting the
   * Google hero. That is the product, delivered for free, to a tenant whose
   * bundle has run out.
   *
   * Separate from _storedConfig.rulesEnabled on purpose: that is the tenant's own
   * setting and must not be overwritten by a billing state.
   */
  private readonly _forceDefaultPlan: boolean;

  /**
   * Optional tenant id. When set, each rule match is recorded (fire-and-forget)
   * to the rule-fire log for the "do the rules actually fire" diagnostic. When
   * omitted (e.g. benchmarks, file-based runtime), no fire is recorded.
   */
  private readonly _tenantId: string | undefined;

  constructor(storedConfig?: StoredRulesConfig, forceDefaultPlan = false, tenantId?: string) {
    this._storedConfig     = storedConfig;
    this._forceDefaultPlan = forceDefaultPlan;
    this._tenantId         = tenantId;
  }

  /**
   * The rule that matched on the most recent getHomepagePlan() call.
   *
   * Reset to null at the start of each call and populated when a rule fires.
   * Null when no rule matched (default plan was used) or before the first call.
   *
   * Read by buildDecisionTrace() to populate DecisionTrace.matchedRule.
   */
  public lastMatchedRuleInfo: {
    ruleId:            string;
    ruleLabel:         string;
    priority:          number;
    packId?:           string;
    precedenceLevel?:  string;
    matchedContextIds: string[];
  } | null = null;

  /**
   * Convenience getter: the rule ID that matched on the most recent call, or
   * null when no rule matched / before the first call.
   *
   * Used by ExperimentDecisionProvider to look up plan experiments for the
   * matched rule without needing to read the full lastMatchedRuleInfo object.
   */
  get lastMatchedRuleId(): string | null {
    return this.lastMatchedRuleInfo?.ruleId ?? null;
  }

  /**
   * Context IDs that were active (matched true) on the most recent call.
   *
   * Collected from the matched rule's trace; empty when no rule matched or
   * when the winning rule had no ContextCondition leaves.
   * Exposed for debug panels that want to display "active contexts".
   */
  public lastMatchedContextIds: string[] = [];

  /**
   * Whether the rules engine was enabled for the most recent call.
   *
   * true  — rules were evaluated normally.
   * false — the tenant-level master switch was off; all rules were skipped.
   * null  — before the first call.
   *
   * Exposed for debug panels and DecisionTrace enrichment.
   */
  public lastRulesEnabled: boolean | null = null;

  /**
   * IDs of rules skipped on the most recent call because rule.enabled === false.
   * Empty array when no individually-disabled rules were encountered.
   * Exposed for debug visibility.
   */
  public lastDisabledRuleIds: string[] = [];

  /**
   * Resolve a homepage ExperiencePlan for the given input.
   *
   * Accepts DecisionInput (the required interface type) or a
   * RuleEvaluationContext (which extends DecisionInput with optional page-level
   * fields).  The optional fields default to undefined when not supplied, and
   * all field resolvers in FIELD_REGISTRY handle that gracefully.
   *
   * Never throws — returns DEFAULT_HOMEPAGE_PLAN on any unrecoverable error.
   */
  async getHomepagePlan(input: DecisionInput): Promise<ExperiencePlan> {
    this.lastMatchedRuleInfo  = null; // reset per-call so stale state never leaks
    this.lastRulesEnabled     = null;
    this.lastDisabledRuleIds  = [];
    this.lastMatchedContextIds = [];

    try {
      const { rules, storedRuleMap, defaultPlan, rulesEnabled, source } =
        this._storedConfig
          ? buildFromConfig(this._storedConfig, "db")
          : buildRuntimeRules();

      // ── Tenant-level master switch ──────────────────────────────────────────
      this.lastRulesEnabled = rulesEnabled;

      if (!rulesEnabled || this._forceDefaultPlan) {
        logger.debug("[decision] Rules engine skipped — using default plan", {
          rulesSource: source,
          reason:      !rulesEnabled ? "tenant_disabled" : "session_cap_reached",
        });
        return defaultPlan;
      }

      // Widen to RuleEvaluationContext so compiled predicates (which call
      // evaluateCondition internally) can resolve page-level fields when the
      // caller supplies them.  All new optional fields default to undefined,
      // which every field resolver handles safely.
      const ctx = input as RuleEvaluationContext;

      const matched = this.evaluateRules(ctx, rules, storedRuleMap, source);

      if (matched) {
        // Pull the raw stored rule to get pack/context metadata for the info object.
        const matchedStored = storedRuleMap.get(matched.id);

        this.lastMatchedRuleInfo = {
          ruleId:            matched.id,
          ruleLabel:         matched.label,
          priority:          matched.priority,
          packId:            matchedStored?.packId,
          precedenceLevel:   matchedStored?.precedenceLevel,
          matchedContextIds: this.lastMatchedContextIds,
        };

        // Rule-fire diagnostic: record which rule fired (fire-and-forget, never
        // awaited, never throws). Only when a tenantId is supplied. Dynamically
        // imported so the pure engine (and benchmarks) stay decoupled from the DB.
        if (this._tenantId) {
          const tid = this._tenantId;
          void import("@/lib/observability/rule-fire-store")
            .then((m) => m.recordRuleFire(tid, matched.id))
            .catch(() => { /* pre-migration / no DB: ignore */ });
        }

        const plan: ExperiencePlan = {
          ...matched.plan,
          reason: matched.reason,
        };
        return plan;
      }

      logger.debug("[decision] No rule matched — using default plan", {
        rulesSource: source,
        source:      input.source,
        device:      input.device,
        visitType:   input.visitType,
      });

      return defaultPlan;
    } catch (err) {
      logger.error("[decision] Unexpected error during rule evaluation", {
        error:  err instanceof Error ? err.message : String(err),
        source: input.source,
      });

      return DEFAULT_HOMEPAGE_PLAN;
    }
  }

  /**
   * Iterate compiled rules in priority order and return the first that matches.
   *
   * ─── Match logic ───────────────────────────────────────────────────────────
   *
   *   Each call to rule.match() is individually guarded:
   *   - For compiled StoredRules, match() delegates to evaluateCondition(),
   *     which handles per-condition errors internally and never throws.
   *   - For hardcoded HomepageRule predicates (homepage-rules.ts), any
   *     exception is caught here, logged with the rule ID, and the rule is
   *     skipped so evaluation continues with the next candidate.
   *
   * ─── Trace logic (dev only) ────────────────────────────────────────────────
   *
   *   When TRACE_ENABLED is true, a RuleEvalTrace is generated for every rule
   *   the engine evaluates (regardless of whether it matched).  Traces are
   *   emitted via logger.debug():
   *
   *   - Skipped rules: compact one-liner (conditionSummary only).
   *     This keeps the dev terminal readable — skipped rules are expected.
   *
   *   - Matched rule: full structured trace (conditionSummary + conditionDetail)
   *     so the developer can see exactly why the rule fired and what field
   *     values were compared.
   *
   *   Trace failures are swallowed without affecting the match result — they
   *   are surfaced as a separate debug entry so the developer knows tracing
   *   partially failed without masking the actual evaluation outcome.
   *
   * Returns null when no rule matches, signalling that the default plan should
   * be used.
   */
  private evaluateRules(
    ctx:          RuleEvaluationContext,
    rules:        readonly HomepageRule[],
    storedRuleMap: ReadonlyMap<string, StoredRule>,
    rulesSource:  "db" | "runtime" | "seed",
  ): HomepageRule | null {
    for (const rule of rules) {
      // ── Per-rule enabled check ──────────────────────────────────────────────
      if (rule.enabled === false) {
        this.lastDisabledRuleIds.push(rule.id);
        logger.debug(`[decision] Rule disabled (priority ${rule.priority}) — skipping`, {
          ruleId:    rule.id,
          ruleLabel: rule.label,
          rulesSource,
        });
        continue;
      }

      // ── Evaluate the rule (critical path) ──────────────────────────────────
      let matched = false;

      try {
        matched = rule.match(ctx);
      } catch (predicateError) {
        logger.warn("[decision] Rule predicate threw — skipping rule", {
          ruleId:    rule.id,
          ruleLabel: rule.label,
          error:
            predicateError instanceof Error
              ? predicateError.message
              : String(predicateError),
        });
        continue;
      }

      // ── Diagnostic trace (dev only, non-critical) ───────────────────────────
      if (TRACE_ENABLED) {
        this.traceRule(rule, matched, ctx, storedRuleMap, rulesSource);
      }

      if (matched) return rule;
    }

    return null;
  }

  /**
   * Generate and emit a diagnostic trace for one evaluated rule.
   *
   * This method is only called when TRACE_ENABLED is true.  All exceptions
   * are caught — a trace failure must never propagate to the caller.
   *
   * Skipped rules are logged with a compact summary (low noise).
   * The matched rule is logged with the full structured condition tree
   * (complete picture of why it fired).
   */
  private traceRule(
    rule:         HomepageRule,
    matched:      boolean,
    ctx:          RuleEvaluationContext,
    storedRuleMap: ReadonlyMap<string, StoredRule>,
    rulesSource:  "db" | "runtime" | "seed",
  ): void {
    try {
      const stored = storedRuleMap.get(rule.id);

      if (stored) {
        // Compiled stored rule — generate the full condition trace with
        // pack/context/precedence metadata baked in.
        const ruleTrace: RuleEvalTrace = generateRuleTrace(stored, matched, stored.condition, ctx);

        // Accumulate matched context IDs on the provider for debug panels.
        if (matched && ruleTrace.matchedContextIds.length > 0) {
          this.lastMatchedContextIds = [
            ...this.lastMatchedContextIds,
            ...ruleTrace.matchedContextIds,
          ];
        }

        if (matched) {
          // Full detail for the matched rule so the developer can answer
          // "exactly why did this rule fire and what were the field values?"
          logger.debug(`[decision] Rule matched (priority ${rule.priority})`, {
            ...ruleTraceToLogMeta(ruleTrace),
            rulesSource,
            plan: rule.plan,
          });
        } else {
          // Compact summary for skipped rules — readable without being noisy.
          logger.debug(`[decision] Rule skipped (priority ${rule.priority})`, {
            ruleId:           rule.id,
            ruleLabel:        rule.label,
            conditionSummary: summariseTrace(ruleTrace.condition),
            ...(stored.packId ? { packId: stored.packId } : {}),
          });
        }
      } else {
        // Hardcoded HomepageRule predicate (homepage-rules.ts) — no condition
        // descriptor available, so we emit a basic matched / skipped entry.
        const label = matched
          ? `[decision] Rule matched (priority ${rule.priority})`
          : `[decision] Rule skipped (priority ${rule.priority})`;

        logger.debug(label, {
          ruleId:    rule.id,
          ruleLabel: rule.label,
          matched,
          rulesSource,
          ...(matched ? { plan: rule.plan } : {}),
        });
      }
    } catch (traceErr) {
      // Trace generation failed — log a minimal entry so the developer knows
      // something went wrong without masking the underlying evaluation result.
      logger.debug("[decision] Trace generation failed for rule", {
        ruleId: rule.id,
        error:  traceErr instanceof Error ? traceErr.message : String(traceErr),
      });
    }
  }
}
