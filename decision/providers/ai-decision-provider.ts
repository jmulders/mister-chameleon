/**
 * AiDecisionProvider
 *
 * Concrete base class for AI-powered DecisionProviders.
 *
 * ─── Responsibility boundary ──────────────────────────────────────────────────
 *
 *   This class owns everything EXCEPT mode-specific wiring:
 *     ✓ Calls the inner (rules) provider to get a fallback plan
 *     ✓ Calls the AI provider in parallel with the fallback
 *     ✓ Normalises AI confidence values to [0, 1]
 *     ✓ Applies the confidence policy to the AI output
 *     ✓ Emits structured log lines for every decision path
 *     ✓ Persists an ai_decision_log row (fire-and-forget)
 *     ✓ Returns the correct plan to serve
 *     ✓ NEVER throws — all error paths return a valid ExperiencePlan
 *
 * ─── Direct usage (live mode) ─────────────────────────────────────────────────
 *
 *   // In app/page.tsx (live mode):
 *   const aiConfig      = getAiRuntimeConfig();
 *   const aiProvider    = createAiProvider(aiConfig.liveProvider);
 *   const decisionProvider = new AiDecisionProvider(
 *     baseDecisionProvider,   // fallback (rules + experiments)
 *     aiProvider,
 *     sessionId,
 *     DEFAULT_CONFIDENCE_POLICY,
 *     false,                  // shadowOnly = false → AI plan may be served
 *   );
 *
 * ─── Shadow mode ──────────────────────────────────────────────────────────────
 *
 *   Use ShadowAiDecisionProvider — a thin subclass that sets shadowOnly=true.
 *
 * ─── Decision paths ───────────────────────────────────────────────────────────
 *
 *   [USE_AI]
 *     AI inference succeeded, confidence ≥ threshold, plan is valid.
 *     → serve AI plan (live mode only).
 *
 *   [FALLBACK_CONTEXT_SPARSE]
 *     Visitor context had too few signals for AI to add value.
 *     → serve rules plan.  AI model is NOT called (skips the inference cost).
 *
 *   [FALLBACK_LOW_CONFIDENCE]
 *     AI produced a plan but confidence was absent, non-finite, or below threshold.
 *     → serve rules plan.
 *
 *   [FALLBACK_MISSING_FIELDS]
 *     AI produced a structurally incomplete plan (null/empty key).
 *     → serve rules plan.  shadow_plan contains the bad output for debugging.
 *
 *   [FALLBACK_INVALID_KEYS]
 *     AI produced unrecognised variant key values.
 *     → serve rules plan.  shadow_plan contains the bad output for debugging.
 *
 *   [AI_ERROR]
 *     AI provider returned ok:false or callAiModel() threw unexpectedly.
 *     → serve rules plan.  log level: warn.
 *
 *   [UNEXPECTED_ERROR]
 *     Outer safety net — any truly unexpected exception (e.g. logger throws).
 *     → serve the static EMERGENCY_FALLBACK_PLAN.  log level: error.
 *
 * ─── Shadow vs live mode ─────────────────────────────────────────────────────
 *
 *   In shadow mode (shadowOnly = true):
 *     - The rules plan is ALWAYS served regardless of verdict.
 *     - The AI call still happens; the log still records the AI plan.
 *     - This lets you observe AI quality before promoting to live.
 *
 *   In live mode (shadowOnly = false, the default):
 *     - USE_AI verdict → AI plan is served.
 *     - Any fallback verdict → rules plan is served.
 *
 * ─── Decision metadata ────────────────────────────────────────────────────────
 *
 *   After each `getHomepagePlan()` call, `lastDecisionMeta` is populated with
 *   a structured summary of what happened: ai_mode, ai_used, ai_confidence,
 *   and the fallback_reason (if any).  This is used by app/page.tsx for the
 *   dev diagnostics panel without requiring changes to the DecisionProvider
 *   interface.
 */

import type { ExperiencePlan, DecisionInput } from "@/decision/types";
import type { DecisionProvider } from "./decision-provider";
import {
  evaluateConfidencePolicy,
  policyResultToLogMeta,
  measureContextRichness,
  normaliseConfidence,
  DEFAULT_CONFIDENCE_POLICY,
  type AiDecisionOutput,
  type ConfidencePolicyConfig,
  type ConfidencePolicyResult,
  type PolicyVerdict,
} from "@/decision/ai-confidence-policy";
import { saveAiDecisionLog } from "@/data/repositories/ai-logs-repository";
import type { AiPlanSnapshot, AiContextSnapshot } from "@/data/types";
import { logger } from "@/lib/logger";
import type { AiProvider } from "@/ai/providers/base-provider";
import { buildHomepagePrompt } from "@/ai/prompt-builder";
import type { SlotModeRegistry } from "@/decision/slot-selection-mode";
import { allSlotsAiAssisted }   from "@/decision/slot-selection-mode";
import { assembleSlotPlan, type SlotPlanAssembly } from "@/decision/ai-selector";

// ── Decision metadata ─────────────────────────────────────────────────────────

/**
 * The reason the AI plan was not served.
 *
 *   null               — AI was used (no fallback)
 *   PolicyVerdict      — confidence policy rejected the plan
 *   "AI_ERROR"         — AI provider returned ok:false or threw
 *   "UNEXPECTED_ERROR" — outer safety net fired (should never happen)
 */
export type AiFallbackReason = PolicyVerdict | "AI_ERROR" | "UNEXPECTED_ERROR";

/**
 * Structured summary of what the AI layer did on the last `getHomepagePlan()`
 * call.  Populated regardless of outcome; null only before the first call.
 *
 * Useful for dev diagnostics, testing, and tracing.
 */
export interface AiDecisionMeta {
  /** "shadow" when shadowOnly=true; "live" otherwise. */
  aiMode: "shadow" | "live";

  /** True only in live mode when the AI plan passed all policy gates. */
  aiUsed: boolean;

  /**
   * Normalised AI self-reported confidence in [0, 1], or undefined when:
   *   • context was too sparse (AI not called)
   *   • AI provider errored
   *   • model did not return a valid confidence score
   */
  aiConfidence: number | undefined;

  /**
   * Structural validation score for the AI plan: 1.0 = all keys present and
   * in the authorised vocabulary; 0.0 = hard-validation failure.
   * Undefined when AI was not called (context sparse or AI error).
   */
  validationScore: number | undefined;

  /**
   * Visitor context strength score in [0, 1].
   * Measures how much the context signals support trusting the AI output.
   * Undefined when AI was not called (context sparse or AI error).
   */
  contextStrength: number | undefined;

  /**
   * Composite final confidence score in [0, 1]:
   *   finalConfidence = aiConfidence×0.60 + validationScore×0.20 + contextStrength×0.20
   * Undefined when AI was not called (context sparse or AI error).
   */
  finalConfidence: number | undefined;

  /**
   * The configured minimum finalConfidence threshold for this decision.
   * Populated from policy.minConfidence; always present regardless of outcome.
   */
  configuredThreshold: number;

  /**
   * Why the fallback was used, or null if the AI plan was served.
   * In shadow mode this is always non-null (even on USE_AI verdict)
   * because the rules plan is always served.
   */
  fallbackReason: AiFallbackReason | null;

  /** Provider name used for this decision (e.g. "ai:mock-deterministic-v1"). */
  providerName: string;
}

// ── Emergency fallback ────────────────────────────────────────────────────────

/**
 * Last-resort plan returned only by the outer safety-net catch block.
 * Uses the most conservative, broadly-applicable variant keys.
 * This should never be seen in production — if it is, a logger.error fires.
 */
const EMERGENCY_FALLBACK_PLAN: ExperiencePlan = {
  heroKey:  "hero_direct_brand",
  proofKey: "proof_platform",
  ctaKey:   "cta_meeting",
  reason:   "[EMERGENCY FALLBACK] Unexpected error in AiDecisionProvider.",
};

// ── AiDecisionProvider ────────────────────────────────────────────────────────

export class AiDecisionProvider implements DecisionProvider {
  /**
   * @param fallback      Inner provider used as the baseline / fallback.
   *                      Always runs in parallel with the AI call.
   * @param aiProvider    The AI provider to call for inference.
   * @param sessionId     Visitor's session UUID — written to the log row.
   * @param policy        Confidence thresholds (defaults to DEFAULT_CONFIDENCE_POLICY).
   * @param shadowOnly    When true, always serve the rules plan even on USE_AI verdict.
   *                      Useful during the shadow evaluation phase.
   * @param tenantId      Tenant slug written to the log row for per-tenant filtering
   *                      in the admin AI Logs dashboard.  Defaults to "" (no tenant).
   *                      Never pass API keys — use tenantId (slug) only.
   * @param slotRegistry  Optional per-slot mode configuration (Phase 1).
   *                      When absent or all slots are "ai-assisted", the existing
   *                      global-plan path is used (full backward compatibility).
   *                      When present with any non-ai-assisted slot, assembleSlotPlan()
   *                      is called after the global AI/rules decision to compose the
   *                      final plan one slot at a time.
   */
  constructor(
    protected readonly fallback:      DecisionProvider,
    private readonly _aiProvider:     AiProvider,
    protected readonly sessionId:     string,
    protected readonly policy:        ConfidencePolicyConfig = DEFAULT_CONFIDENCE_POLICY,
    protected readonly shadowOnly:    boolean = false,
    protected readonly tenantId:      string = "",
    protected readonly slotRegistry?: SlotModeRegistry,
  ) {}

  // ── Chain access ─────────────────────────────────────────────────────────────

  /**
   * The inner fallback provider wrapped by this AI layer.
   * Exposed for provider-chain walking by buildDecisionTrace().
   *
   * In the standard stack this is an ExperimentDecisionProvider wrapping
   * a RulesDecisionProvider.
   */
  get fallbackProvider(): DecisionProvider {
    return this.fallback;
  }

  // ── Provider identity ────────────────────────────────────────────────────────

  /**
   * Stable name identifying this provider in logs and ai_decision_logs rows.
   * Format: "ai:<modelId>".
   *
   * Examples:
   *   "ai:mock-deterministic-v1"       (MockAiProvider — active today)
   *   "ai:claude-3-5-haiku-20241022"   (ClaudeAdapter — future)
   *   "ai:gpt-4o-mini"                 (OpenAiAdapter — future)
   */
  protected get providerName(): string {
    return `ai:${this._aiProvider.modelId}`;
  }

  /**
   * The active AI mode for this provider instance.
   * Derived from shadowOnly — "shadow" | "live".
   */
  protected get aiMode(): "shadow" | "live" {
    return this.shadowOnly ? "shadow" : "live";
  }

  // ── Decision metadata ────────────────────────────────────────────────────────

  private _lastDecisionMeta: AiDecisionMeta | null = null;

  /**
   * Structured summary of the most recent `getHomepagePlan()` call.
   * Null before the first call.  Suitable for dev diagnostics and testing.
   */
  get lastDecisionMeta(): AiDecisionMeta | null {
    return this._lastDecisionMeta;
  }

  // ── Last slot assembly (Phase 1 — per-slot mode result) ─────────────────────

  private _lastSlotAssembly: SlotPlanAssembly | null = null;

  /**
   * The per-slot plan assembly from the most recent `getHomepagePlan()` call.
   *
   * Populated when `slotRegistry` was provided and assembleSlotPlan() ran.
   * Null when AI is disabled, context was too sparse, or no slot registry is
   * configured (full backward compatibility for tenants without slot configs).
   *
   * Exposed publicly so buildDecisionTrace() can read lastSlotAssembly.perSlot
   * and populate DecisionTrace.perSlot for the admin debug panel.
   */
  get lastSlotAssembly(): SlotPlanAssembly | null {
    return this._lastSlotAssembly;
  }

  // ── Last prompt payload (for debug visibility) ───────────────────────────────

  private _lastPromptPayload: { userPrompt: string; signalCount: number } | null = null;

  /**
   * The exact user prompt sent to the AI model on the last `getHomepagePlan()` call.
   *
   * Null when:
   *   - No call has been made yet.
   *   - Context was too sparse (AI was not called).
   *   - The AI call errored before the prompt was built.
   *
   * Use this in the debug panel to verify what the AI actually received.
   * The system prompt is stable per tenant configuration and is NOT stored here
   * to avoid redundant data; retrieve it via `buildSystemPrompt(candidates)` if needed.
   */
  get lastPromptPayload(): { userPrompt: string; signalCount: number } | null {
    return this._lastPromptPayload;
  }

  // ── AI model call ────────────────────────────────────────────────────────────

  /**
   * Call the AI provider and return its output as an AiDecisionOutput.
   *
   * Translation contract:
   *
   *   AiProviderResult ok:true  → return result.output (pass through)
   *
   *   AiProviderResult ok:false → throw Error("[<code>] <reason>")
   *                               The outer getHomepagePlan handler catches this
   *                               and falls back to the rules plan at warn level.
   *
   * @param input  Visitor context and first-party history.
   * @returns      The AiDecisionOutput from the AI provider.
   * @throws       Error when the AI provider returns ok:false.
   */
  protected async callAiModel(input: DecisionInput): Promise<AiDecisionOutput> {
    const result = await this._aiProvider.suggest(input);

    if (!result.ok) {
      // Surface as a thrown Error so getHomepagePlan's AI_ERROR path handles
      // it cleanly: logs at warn level and falls back to the rules plan.
      throw new Error(
        `[${result.code}] AI provider "${this._aiProvider.providerName}" failed: ${result.reason}`,
      );
    }

    // ok:true — pass the output straight through.
    // The confidence policy, logging, and DB persistence are handled in getHomepagePlan.
    return result.output;
  }

  // ── DecisionProvider implementation ─────────────────────────────────────────

  /**
   * Resolve the homepage experience plan.
   *
   * SAFETY GUARANTEE: this method never throws.  All error paths are caught
   * and return a valid ExperiencePlan.  The outer catch is the last resort
   * and logs at error level if reached.
   */
  async getHomepagePlan(input: DecisionInput): Promise<ExperiencePlan> {
    try {
      return await this._getHomepagePlanInner(input);
    } catch (err) {
      // ── Outer safety net ──────────────────────────────────────────────────
      // This catch should be unreachable in normal operation — it exists to
      // guarantee that a bug in a helper (e.g. logger throwing) never crashes
      // the homepage render.
      logger.error("[ai-decision] Unexpected error — returning emergency fallback plan", {
        sessionId: this.sessionId,
        aiMode: this.aiMode,
        provider: this.providerName,
        error: err instanceof Error ? err.message : String(err),
      });
      this._lastDecisionMeta = {
        aiMode:              this.aiMode,
        aiUsed:              false,
        aiConfidence:        undefined,
        validationScore:     undefined,
        contextStrength:     undefined,
        finalConfidence:     undefined,
        configuredThreshold: this.policy.minConfidence,
        fallbackReason:      "UNEXPECTED_ERROR",
        providerName:        this.providerName,
      };
      this._lastSlotAssembly = null;
      return EMERGENCY_FALLBACK_PLAN;
    }
  }

  // ── Inner implementation (wrapped by outer safety net) ────────────────────

  private async _getHomepagePlanInner(input: DecisionInput): Promise<ExperiencePlan> {
    // ── Fast path: skip AI when context is too sparse ─────────────────────
    // Evaluate context richness before spending tokens on the AI call.
    const contextRichness = measureContextRichness(input);

    if (contextRichness < this.policy.minContextRichness) {
      logger.debug("[ai-decision] Context too sparse — skipping AI call", {
        sessionId:    this.sessionId,
        aiMode:       this.aiMode,
        provider:     this.providerName,
        contextRichness,
        threshold:    this.policy.minContextRichness,
        source:       input.source,
        visitType:    input.visitType,
      });
      this._lastDecisionMeta = {
        aiMode:              this.aiMode,
        aiUsed:              false,
        aiConfidence:        undefined,
        validationScore:     undefined,
        contextStrength:     undefined,
        finalConfidence:     undefined,
        configuredThreshold: this.policy.minConfidence,
        fallbackReason:      "FALLBACK_CONTEXT_SPARSE",
        providerName:        this.providerName,
      };
      this._lastSlotAssembly = null;
      // No AI call, no log row — just return the rules plan directly.
      return this.fallback.getHomepagePlan(input);
    }

    // ── Capture prompt payload for debug visibility ───────────────────────
    // Build the prompt before the AI call so we can expose it via
    // lastPromptPayload regardless of whether the AI call succeeds.
    try {
      const { userPrompt, metadata } = buildHomepagePrompt(input);
      this._lastPromptPayload = { userPrompt, signalCount: metadata.signalCount };
    } catch {
      this._lastPromptPayload = null;
    }

    // ── Run fallback + AI in parallel ─────────────────────────────────────
    // Using Promise.allSettled so that an AI failure does not abort the
    // fallback resolution (they are independent).
    const [fallbackSettled, aiSettled] = await Promise.allSettled([
      this.fallback.getHomepagePlan(input),
      this.callAiModel(input),
    ]);

    // Unwrap fallback (should never reject given RulesDecisionProvider contract,
    // but guard defensively so we always have a valid plan to return)
    const fallbackPlan: ExperiencePlan =
      fallbackSettled.status === "fulfilled"
        ? fallbackSettled.value
        : {
            heroKey:  "hero_direct_brand",
            proofKey: "proof_platform",
            ctaKey:   "cta_meeting",
            reason:   "Emergency fallback: inner provider rejected unexpectedly.",
          };

    // ── Handle AI call failure ────────────────────────────────────────────
    if (aiSettled.status === "rejected") {
      const errorMsg =
        aiSettled.reason instanceof Error
          ? aiSettled.reason.message
          : String(aiSettled.reason);

      logger.warn("[ai-decision] AI model call failed — using rules plan", {
        sessionId:      this.sessionId,
        aiMode:         this.aiMode,
        provider:       this.providerName,
        aiUsed:         false,
        fallbackReason: "AI_ERROR",
        error:          errorMsg,
        source:         input.source,
      });

      this._lastDecisionMeta = {
        aiMode:              this.aiMode,
        aiUsed:              false,
        aiConfidence:        undefined,
        validationScore:     undefined,
        contextStrength:     undefined,
        finalConfidence:     undefined,
        configuredThreshold: this.policy.minConfidence,
        fallbackReason:      "AI_ERROR",
        providerName:        this.providerName,
      };
      this._lastSlotAssembly = null;
      // No log row for hard failures — the warn above is the signal.
      return fallbackPlan;
    }

    const aiOutput = aiSettled.value;

    // ── Evaluate the confidence policy ────────────────────────────────────
    const policyResult = evaluateConfidencePolicy(aiOutput, input, this.policy);

    // Decide what is actually served
    const useAiPlan = !this.shadowOnly && policyResult.verdict === "USE_AI";
    const liveProvider = useAiPlan ? this.providerName : "rules";

    // ── Phase 1: Per-slot assembly ────────────────────────────────────────────
    // When a slotRegistry is configured and at least one slot is non-ai-assisted,
    // compose the final plan one slot at a time based on each slot's mode.
    // When the registry is absent or all slots are ai-assisted, use the existing
    // global path — zero overhead for tenants without slot configuration.
    let servedPlan: ExperiencePlan;
    if (this.slotRegistry && !allSlotsAiAssisted(this.slotRegistry)) {
      const assembly = assembleSlotPlan(
        useAiPlan ? aiOutput.plan : null,
        fallbackPlan,
        useAiPlan,
        this.slotRegistry,
        input.variantCandidates,
        input,
      );
      this._lastSlotAssembly = assembly;
      servedPlan = assembly.plan;
    } else {
      // Existing global path — AI plan or rules plan wholesale.
      this._lastSlotAssembly = null;
      servedPlan = useAiPlan ? aiOutput.plan : fallbackPlan;
    }

    // Normalise confidence for meta/logging — ensures no NaN or Infinity leaks out
    const normConf = normaliseConfidence(aiOutput.confidence);

    // ── Capture decision metadata ─────────────────────────────────────────
    this._lastDecisionMeta = {
      aiMode:              this.aiMode,
      aiUsed:              useAiPlan,
      aiConfidence:        normConf,
      validationScore:     policyResult.validationScore,
      contextStrength:     policyResult.contextStrength,
      finalConfidence:     policyResult.finalConfidence,
      configuredThreshold: policyResult.configuredThreshold,
      // In shadow mode: verdict is informational (AI never served), so
      // fallbackReason reflects the policy gate result even on USE_AI
      // to clarify that serving the fallback was intentional, not a failure.
      fallbackReason: useAiPlan
        ? null
        : (this.shadowOnly && policyResult.verdict === "USE_AI"
          ? null                    // shadow: AI would have been used in live mode
          : policyResult.verdict),  // actual policy rejection
      providerName:        this.providerName,
    };

    // ── Emit structured log ───────────────────────────────────────────────
    this.emitDecisionLog(policyResult, aiOutput, fallbackPlan, servedPlan, input, useAiPlan, normConf);

    // ── Persist to ai_decision_logs (fire-and-forget) ─────────────────────
    void this.persistLog(aiOutput, policyResult, fallbackPlan, servedPlan, liveProvider, input);

    return servedPlan;
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private emitDecisionLog(
    policyResult: ConfidencePolicyResult,
    aiOutput: AiDecisionOutput,
    fallbackPlan: ExperiencePlan,
    servedPlan: ExperiencePlan,
    input: DecisionInput,
    usingAi: boolean,
    normConf: number | undefined,
  ): void {
    const logMeta = {
      sessionId:      this.sessionId,
      aiMode:         this.aiMode,
      aiUsed:         usingAi,
      fallbackReason: usingAi ? null : policyResult.verdict,
      shadowOnly:     this.shadowOnly,
      servedBy:       usingAi ? this.providerName : "rules",
      plansMatch:     plansAreEqual(aiOutput.plan, fallbackPlan),
      aiPlan: {
        heroKey:    aiOutput.plan.heroKey,
        proofKey:   aiOutput.plan.proofKey,
        ctaKey:     aiOutput.plan.ctaKey,
        confidence: normConf,
      },
      rulesPlan: {
        heroKey:  fallbackPlan.heroKey,
        proofKey: fallbackPlan.proofKey,
        ctaKey:   fallbackPlan.ctaKey,
      },
      source:        input.source,
      pageViewCount: input.history.pageViewCount,
      hasClickedCta: input.history.hasClickedCta,
      ...policyResultToLogMeta(policyResult, aiOutput),
    };

    if (policyResult.verdict === "USE_AI") {
      if (this.shadowOnly) {
        // Shadow mode: AI plan would have been used in live mode.
        // Log at info so operators can see AI quality without confusion about
        // why the rules plan was served.
        logger.info("[ai-decision] Shadow: AI plan would be served in live mode", logMeta);
      } else {
        logger.info("[ai-decision] AI plan accepted and served", logMeta);
      }
    } else {
      // Low confidence / sparse context / invalid output — log at warn so
      // operators notice if the AI is performing poorly.
      logger.warn(
        `[ai-decision] Policy fallback (${policyResult.verdict}): ${policyResult.summary}`,
        logMeta,
      );
    }
  }

  private async persistLog(
    aiOutput: AiDecisionOutput,
    policyResult: ConfidencePolicyResult,
    fallbackPlan: ExperiencePlan,
    servedPlan: ExperiencePlan,
    liveProvider: string,
    input: DecisionInput,
  ): Promise<void> {
    try {
      const shadowPlan: AiPlanSnapshot = {
        heroKey:             aiOutput.plan.heroKey,
        proofKey:            aiOutput.plan.proofKey,
        ctaKey:              aiOutput.plan.ctaKey,
        reason:              aiOutput.plan.reason,
        confidence:          normaliseConfidence(aiOutput.confidence),
        policyVerdict:       policyResult.verdict,
        contextRichness:     policyResult.contextRichness,
        validationScore:     policyResult.validationScore,
        contextStrength:     policyResult.contextStrength,
        finalConfidence:     policyResult.finalConfidence,
        configuredThreshold: policyResult.configuredThreshold,
        modelId:             aiOutput.modelId,
        latencyMs:           aiOutput.latencyMs,
        gateResults: policyResult.gates.map((g) => ({
          gate:   g.gate,
          passed: g.passed,
          score:  g.score,
        })),
      };

      const livePlan: AiPlanSnapshot = {
        heroKey:  servedPlan.heroKey,
        proofKey: servedPlan.proofKey,
        ctaKey:   servedPlan.ctaKey,
        reason:   servedPlan.reason,
      };

      const contextSnapshot: AiContextSnapshot = {
        source:         input.source,
        device:         input.device,
        visitType:      input.visitType,
        utmSource:      input.utmSource,
        utmMedium:      input.utmMedium,
        utmCampaign:    input.utmCampaign,
        referrerDomain: input.referrerDomain,
      };

      await saveAiDecisionLog({
        session_id:      this.sessionId,
        // tenant_id: store slug for per-tenant log filtering.
        // Omit (undefined) when no tenant context was provided — the column is
        // nullable and the dashboard treats NULL rows as "unknown tenant".
        // API keys are NEVER stored; this is the tenant slug only.
        tenant_id:       this.tenantId || undefined,
        page_type:       "homepage",
        live_provider:   liveProvider,
        live_plan:       livePlan,
        shadow_provider: this.providerName,
        shadow_plan:     shadowPlan,
        plans_match:     plansAreEqual(aiOutput.plan, fallbackPlan),
        context:         contextSnapshot,
      });
    } catch (err) {
      // Log but swallow — persistence errors must never affect request handling
      logger.warn("[ai-decision] Failed to persist ai_decision_log row", {
        sessionId: this.sessionId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function plansAreEqual(a: ExperiencePlan, b: ExperiencePlan): boolean {
  return a.heroKey === b.heroKey && a.proofKey === b.proofKey && a.ctaKey === b.ctaKey;
}
