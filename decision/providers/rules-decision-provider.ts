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
  evaluateConditionTrace,
  ruleTraceToLogMeta,
  summariseTrace,
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
 * Load, validate, and compile the runtime rules.
 *
 * Returns a `storedRuleMap` (ruleId → StoredRule) alongside the compiled
 * HomepageRules.  The map gives the trace machinery access to the raw
 * RuleCondition descriptors without adding a dependency between HomepageRule
 * and the stored-rule types (which would create a circular import).
 */
function buildRuntimeRules(): {
  rules:          HomepageRule[];
  storedRuleMap:  ReadonlyMap<string, StoredRule>;
  defaultPlan:    ExperiencePlan;
  source:         "runtime" | "seed";
} {
  try {
    const raw       = fs.readFileSync(RULES_PATH, "utf8");
    const candidate = JSON.parse(raw) as unknown;
    const errors    = validateStoredConfig(candidate);

    if (errors.length === 0) {
      const config = candidate as StoredRulesConfig;
      const sorted = [...config.rules].sort((a, b) => a.priority - b.priority);
      return {
        rules:         sorted.map(compileStoredRule),
        storedRuleMap: new Map(sorted.map((r) => [r.id, r])),
        defaultPlan:   { ...config.defaultPlan },
        source:        "runtime",
      };
    }

    logger.warn("[decision] runtime-rules.json invalid — falling back to seed rules", {
      errors: errors.map((e) => `${e.field}: ${e.message}`),
    });
  } catch (err) {
    logger.warn("[decision] Failed to read runtime-rules.json — falling back to seed rules", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const sorted = [...SEED_RULES_CONFIG.rules].sort((a, b) => a.priority - b.priority);
  return {
    rules:         sorted.map(compileStoredRule),
    storedRuleMap: new Map(sorted.map((r) => [r.id, r])),
    defaultPlan:   { ...SEED_RULES_CONFIG.defaultPlan },
    source:        "seed",
  };
}

// ── Provider ──────────────────────────────────────────────────────────────────

export class RulesDecisionProvider implements DecisionProvider {
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
    try {
      const { rules, storedRuleMap, defaultPlan, source } = buildRuntimeRules();

      // Widen to RuleEvaluationContext so compiled predicates (which call
      // evaluateCondition internally) can resolve page-level fields when the
      // caller supplies them.  All new optional fields default to undefined,
      // which every field resolver handles safely.
      const ctx = input as RuleEvaluationContext;

      const matched = this.evaluateRules(ctx, rules, storedRuleMap, source);

      if (matched) {
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
    rulesSource:  "runtime" | "seed",
  ): HomepageRule | null {
    for (const rule of rules) {
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
    rulesSource:  "runtime" | "seed",
  ): void {
    try {
      const stored = storedRuleMap.get(rule.id);

      if (stored) {
        // Compiled stored rule — generate the full condition trace.
        const { trace } = evaluateConditionTrace(stored.condition, ctx);

        const ruleTrace: RuleEvalTrace = {
          ruleId:    rule.id,
          ruleLabel: rule.label,
          priority:  rule.priority,
          matched,
          condition: trace,
        };

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
            conditionSummary: summariseTrace(trace),
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
