/**
 * AI Providers — Base Interface and Disabled Implementation
 *
 * Defines the shared contract that every AI provider in the ai/providers/
 * directory must satisfy, and ships the DisabledAiProvider zero-case that
 * the factory returns whenever AI is off or misconfigured.
 *
 * ─── Layer responsibilities ───────────────────────────────────────────────────
 *
 *   AiProvider (this file)
 *   │  The calling interface.  Consumers ask for a suggestion and receive a
 *   │  typed result — either a successful AiDecisionOutput or a structured
 *   │  error.  Never throws.
 *   │
 *   ├─ DisabledAiProvider (this file)
 *   │     Returns ok:false / code:DISABLED immediately.
 *   │     Used when AI mode is "disabled" or the API key is absent.
 *   │
 *   ├─ MockAiProvider (mock-ai-provider.ts)
 *   │     Returns deterministic suggestions based on visitor source.
 *   │     Active today — no external API call needed.
 *   │
 *   ├─ ClaudeAdapter (future: ai/providers/claude-adapter.ts)
 *   │     Calls the Anthropic Messages API.
 *   │
 *   └─ OpenAiAdapter (future: ai/providers/openai-adapter.ts)
 *         Calls the OpenAI Chat Completions API.
 *
 * ─── Result contract ──────────────────────────────────────────────────────────
 *
 *   All providers return an AiProviderResult discriminated union.
 *   Callers always branch on `result.ok` before accessing `result.output`.
 *
 *   ok: true   → output is a valid AiDecisionOutput ready for the confidence
 *                policy in AiDecisionProvider.
 *
 *   ok: false  → reason and code describe what went wrong.  Callers should
 *                fall back to the rules engine without logging an error — many
 *                ok:false results are expected (disabled, sparse context, etc.).
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   import type { AiProvider, AiProviderResult } from "@/ai/providers/base-provider";
 *
 *   const result = await provider.suggest(input);
 *   if (!result.ok) {
 *     return fallbackPlan; // rules engine
 *   }
 *   // result.output: AiDecisionOutput — pass to evaluateConfidencePolicy()
 */

import type { DecisionInput } from "@/decision/types";
import type { AiDecisionOutput } from "@/decision/ai-confidence-policy";

// Re-export so callers can import everything AI-provider-related from here.
export type { DecisionInput, AiDecisionOutput };

// ── Error codes ───────────────────────────────────────────────────────────────

/**
 * Machine-readable error codes for failed AI provider calls.
 *
 * Stable strings — safe to store in ai_decision_logs or log aggregators.
 *
 * DISABLED         AI mode is "disabled", or no provider is configured.
 *                  This is an expected state, not an error worth alerting on.
 *
 * MISSING_API_KEY  The provider is configured but the required API key env var
 *                  is absent or empty.  Operator action required.
 *
 * MODEL_ERROR      The model API returned a non-success status or an unexpected
 *                  response shape that could not be parsed into a valid plan.
 *
 * PARSE_ERROR      The model returned a success status but the response body
 *                  could not be parsed as valid JSON or did not match the
 *                  expected output schema.
 *
 * TIMEOUT          The model call exceeded the configured timeoutMs.
 *                  The rules engine fallback was used.
 *
 * INVALID_KEYS     The model returned a structurally valid JSON object but one
 *                  or more variant keys are not in the allowed vocabulary.
 *                  Caught here before reaching the confidence policy.
 */
export type AiProviderErrorCode =
  | "DISABLED"
  | "MISSING_API_KEY"
  | "MODEL_ERROR"
  | "PARSE_ERROR"
  | "TIMEOUT"
  | "INVALID_KEYS";

// ── Result union ──────────────────────────────────────────────────────────────

/**
 * The typed result returned by AiProvider.suggest().
 *
 * Always branch on `result.ok` — never access `result.output` without checking.
 *
 * @example
 * const result = await provider.suggest(input);
 * if (result.ok) {
 *   const { output } = result;
 *   // pass output to evaluateConfidencePolicy()
 * } else {
 *   logger.debug("[ai] provider returned error", { code: result.code, reason: result.reason });
 *   return rulesProvider.getHomepagePlan(input);
 * }
 */
export type AiProviderResult =
  | AiProviderSuccess
  | AiProviderFailure;

/**
 * A successful AI provider call.
 *
 * `output` is a fully populated AiDecisionOutput ready to pass to
 * evaluateConfidencePolicy() in decision/ai-confidence-policy.ts.
 */
export interface AiProviderSuccess {
  ok: true;
  /** The structured model output including plan, confidence, and metadata. */
  output: AiDecisionOutput;
}

/**
 * A failed AI provider call.
 *
 * Callers should fall back to the rules engine and log at debug/warn level
 * depending on the code.  DISABLED is expected and should not be logged at all.
 */
export interface AiProviderFailure {
  ok: false;
  /** Machine-readable error code. @see AiProviderErrorCode */
  code: AiProviderErrorCode;
  /** Human-readable explanation for logging and the debug panel. */
  reason: string;
  /**
   * Optional partial output when the model returned something that was
   * structurally valid but failed a specific gate (e.g. INVALID_KEYS).
   * Useful for debugging what the model actually said.
   */
  partialOutput?: Partial<AiDecisionOutput>;
}

// ── AiProvider interface ──────────────────────────────────────────────────────

/**
 * The shared contract for every AI provider implementation.
 *
 * Implementations must:
 *
 *   1. Never throw.  All errors — including network failures, timeouts, and
 *      malformed responses — must be caught and returned as AiProviderFailure.
 *
 *   2. Always populate providerName and modelId with stable, loggable strings.
 *      These are written to ai_decision_logs rows.
 *
 *   3. Keep suggest() stateless.  The same input must always be safe to call
 *      concurrently from multiple requests.
 *
 *   4. Always set latencyMs in a successful output.  Measure it inside suggest()
 *      as wall-clock time around the actual model call (or simulated work).
 *
 * @see AiDecisionOutput for the full output shape.
 * @see AiProviderResult for the result union.
 */
export interface AiProvider {
  /**
   * Stable name identifying this provider implementation.
   * Written to ai_decision_logs.live_provider / shadow_provider.
   *
   * Examples: "mock", "ai:claude", "ai:openai", "disabled"
   */
  readonly providerName: string;

  /**
   * The model identifier used by this provider instance.
   * Written to ai_decision_logs.shadow_plan.modelId.
   *
   * Examples: "mock-deterministic-v1", "claude-3-5-haiku-20241022", "gpt-4o-mini"
   */
  readonly modelId: string;

  /**
   * Request a homepage plan suggestion for the given visitor input.
   *
   * @param input  The visitor context and behavioural history.
   * @returns      A Promise that always resolves.  Never rejects.
   */
  suggest(input: DecisionInput): Promise<AiProviderResult>;
}

// ── DisabledAiProvider ────────────────────────────────────────────────────────

/**
 * The zero-case provider returned by createAiProvider() when AI is off or
 * the required API key is absent.
 *
 * suggest() returns immediately with ok:false / code:DISABLED so callers
 * fall back to the rules engine without any latency or side effects.
 *
 * This is not an error state — it is the expected behaviour for deployments
 * that have not yet enabled the AI layer.
 *
 * @example
 * // The factory uses DisabledAiProvider automatically; rarely construct directly:
 * const provider = new DisabledAiProvider("AI mode is disabled.");
 * const result   = await provider.suggest(input);
 * // result → { ok: false, code: "DISABLED", reason: "AI mode is disabled." }
 */
export class DisabledAiProvider implements AiProvider {
  readonly providerName = "disabled" as const;
  readonly modelId      = "none"     as const;

  constructor(private readonly _reason: string) {}

  async suggest(_input: DecisionInput): Promise<AiProviderResult> {
    return {
      ok:     false,
      code:   "DISABLED",
      reason: this._reason,
    };
  }
}
