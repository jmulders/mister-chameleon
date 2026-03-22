/**
 * ShadowAiDecisionProvider
 *
 * Shadow-mode wrapper around AiDecisionProvider.
 *
 * ─── What this does ───────────────────────────────────────────────────────────
 *
 *   A thin subclass of AiDecisionProvider that forces shadowOnly = true,
 *   meaning:
 *
 *     - The rules plan is ALWAYS served to visitors.  Zero impact on UX.
 *     - The AI provider runs in parallel with the fallback for evaluation.
 *     - Both plans are logged to ai_decision_logs after the response is sent.
 *     - The AI dashboard shows live vs shadow agreement over time.
 *
 *   All orchestration logic (parallel run, confidence policy, logging, DB
 *   persistence) lives in the base AiDecisionProvider class.
 *
 * ─── How to wire it ───────────────────────────────────────────────────────────
 *
 *   // 1. Build the providers (in app/page.tsx):
 *   const aiConfig       = getAiRuntimeConfig();
 *   const rulesProvider  = new RulesDecisionProvider();
 *   const aiProvider     = createAiProvider(aiConfig.shadowProvider);
 *
 *   // 2. Create the shadow provider:
 *   const decisionProvider = new ShadowAiDecisionProvider(
 *     rulesProvider,
 *     aiProvider,
 *     sessionId,           // visitor's session UUID
 *   );
 *
 *   // 3. Use it exactly like any other DecisionProvider:
 *   const plan = await decisionProvider.getHomepagePlan(input);
 *   // ↑ Always the rules plan.  AI runs in the background.
 *
 * ─── Live mode ────────────────────────────────────────────────────────────────
 *
 *   For live mode (AI plan may be served), use AiDecisionProvider directly
 *   with shadowOnly = false (the default).
 *
 * ─── Decision flow (inherited from AiDecisionProvider) ───────────────────────
 *
 *   1. Context richness check — skip AI entirely when context is too sparse.
 *      Threshold controlled by `policy.minContextRichness` (default: 0.30).
 *
 *   2. Parallel run — fallback (rules) + AI fire simultaneously.
 *
 *   3. AI result translation — ok:true passes through; ok:false throws so the
 *      base class handles it via the [AI_ERROR] fallback path.
 *
 *   4. Confidence policy — evaluates the AI output against named gates.
 *      In shadow mode the verdict does NOT affect what is served; it is
 *      recorded in shadow_plan.policyVerdict for dashboard analysis.
 *
 *   5. Logging — structured log line written for every decision path.
 *
 *   6. DB persistence — ai_decision_logs row written fire-and-forget.
 *
 *   7. Return fallback plan — always, because shadowOnly = true.
 *
 * ─── AiProvider failure handling ──────────────────────────────────────────────
 *
 *   When aiProvider.suggest() returns ok:false, the base class catches the
 *   thrown Error, logs a warn, and returns the fallback plan cleanly:
 *
 *     - DISABLED / MISSING_API_KEY  → warn once then clean fallback
 *     - MODEL_ERROR / TIMEOUT       → warn then clean fallback
 *     - PARSE_ERROR / INVALID_KEYS  → warn then clean fallback
 *
 *   If the AI provider is reliably disabled, prefer not constructing
 *   ShadowAiDecisionProvider at all — use RulesDecisionProvider directly.
 *   The getAiRuntimeConfig() factory handles this routing.
 */

import type { AiProvider } from "@/ai/providers/base-provider";
import type { ConfidencePolicyConfig } from "@/decision/ai-confidence-policy";
import { DEFAULT_CONFIDENCE_POLICY } from "@/decision/ai-confidence-policy";
import type { DecisionProvider } from "./decision-provider";
import { AiDecisionProvider } from "./ai-decision-provider";

// ── ShadowAiDecisionProvider ──────────────────────────────────────────────────

/**
 * Shadow-mode DecisionProvider that wraps a rules-engine fallback and an AI
 * provider.
 *
 * Always serves the rules plan to visitors while logging AI suggestions in
 * parallel for evaluation in the AI dashboard.
 *
 * @see AiDecisionProvider  for all orchestration, logging, and persistence.
 * @see module JSDoc         for wiring instructions.
 */
export class ShadowAiDecisionProvider extends AiDecisionProvider {
  /**
   * @param fallback    The inner (rules) provider whose plan is always served.
   * @param aiProvider  The AI provider to call in shadow (from createAiProvider()).
   * @param sessionId   Visitor session UUID written to ai_decision_logs.
   * @param policy      Confidence thresholds (defaults to DEFAULT_CONFIDENCE_POLICY).
   *                    In shadow mode these gates do not affect what is served —
   *                    they determine the policyVerdict recorded in the log row,
   *                    giving a realistic preview of what live-mode behaviour
   *                    would look like.
   * @param tenantId    Tenant slug written to the log row for per-tenant filtering.
   *                    Defaults to "" (no tenant).  Never pass API keys.
   */
  constructor(
    fallback: DecisionProvider,
    aiProvider: AiProvider,
    sessionId: string,
    policy: ConfidencePolicyConfig = DEFAULT_CONFIDENCE_POLICY,
    tenantId: string = "",
  ) {
    // shadowOnly = true — the rules plan is ALWAYS returned to the caller.
    super(fallback, aiProvider, sessionId, policy, /* shadowOnly */ true, tenantId);
  }
}
