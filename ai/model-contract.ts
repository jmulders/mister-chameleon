/**
 * AI Module — Model Contract
 *
 * Defines the typed interface that every concrete AI model adapter must
 * satisfy.  The contract is intentionally minimal: callers provide a
 * DecisionInput and receive an AiDecisionOutput.  The adapter owns
 * everything in between — prompt construction, HTTP transport, response
 * parsing, and error normalisation.
 *
 * ─── Relationship to the rest of the AI layer ─────────────────────────────────
 *
 *   AiModelContract  (this file)
 *   └─ is implemented by concrete adapters (to be added in future steps):
 *        ai/providers/claude-adapter.ts   → calls Anthropic Messages API
 *        ai/providers/openai-adapter.ts   → calls OpenAI Chat Completions API
 *
 *   AiDecisionProvider  (decision/providers/ai-decision-provider.ts)
 *   └─ abstract base class — orchestrates the full decision pipeline:
 *        calls inner fallback provider + AI model in parallel,
 *        applies the confidence policy,
 *        logs and persists the result.
 *
 *   The separation means a ClaudeDecisionProvider can be as thin as:
 *
 *     class ClaudeDecisionProvider extends AiDecisionProvider {
 *       protected async callAiModel(input: DecisionInput) {
 *         return new ClaudeAdapter(config).callModel(input);
 *       }
 *     }
 *
 * ─── Adapter implementation contract ──────────────────────────────────────────
 *
 *   1. NEVER throw for expected model-layer errors (timeout, rate-limit, bad JSON,
 *      unexpected response shape).  Catch them and return a low-/undefined-confidence
 *      AiDecisionOutput so the confidence policy can route to the rules fallback.
 *
 *   2. May throw for truly unexpected errors (programmer mistakes, missing config).
 *      The AiDecisionProvider base class wraps callAiModel in a try/catch and
 *      falls back to the rules plan on any thrown error.
 *
 *   3. Always populate `modelId` with the canonical model identifier string
 *      (e.g. "claude-3-5-haiku-20241022").  This is written to ai_decision_logs
 *      and must be stable and machine-readable.
 *
 *   4. Always populate `latencyMs` with the wall-clock inference time.  Measure
 *      it inside the adapter using `Date.now()` before and after the API call.
 *
 *   5. Returned `plan.heroKey`, `plan.proofKey`, and `plan.ctaKey` must be the
 *      raw values from the model response — the confidence policy validates them
 *      and will gate on `FALLBACK_INVALID_OUTPUT` if they are unrecognised.
 *
 *   6. Keep the adapter stateless.  All configuration should be passed to the
 *      constructor or to callModel(); no mutable instance fields.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   import type { AiModelContract } from "@/ai/model-contract";
 *
 *   // In a concrete adapter:
 *   export class ClaudeAdapter implements AiModelContract { ... }
 *
 *   // In AiDecisionProvider subclass:
 *   protected async callAiModel(input: DecisionInput): Promise<AiDecisionOutput> {
 *     return this.adapter.callModel(input);
 *   }
 */

import type { DecisionInput } from "@/decision/types";
import type { AiDecisionOutput } from "@/decision/ai-confidence-policy";
import type { AiProviderConfig } from "./types";

// Re-export so callers can import input/output types from this file alone.
export type { DecisionInput, AiDecisionOutput };

// ── AiModelContract ───────────────────────────────────────────────────────────

/**
 * The minimal contract for a concrete AI model adapter.
 *
 * Concrete implementations receive a DecisionInput containing the full visitor
 * context (source, device, visit type, UTM params, behavioural history) and
 * return a structured AiDecisionOutput with a variant key plan and metadata.
 *
 * @see AiDecisionOutput for the full output shape.
 * @see AiDecisionProvider for the orchestration layer that calls this.
 *
 * @example
 * // Minimal adapter skeleton:
 * export class ClaudeAdapter implements AiModelContract {
 *   constructor(private readonly config: AiProviderConfig) {}
 *
 *   get modelId(): string {
 *     return this.config.modelId;
 *   }
 *
 *   async callModel(input: DecisionInput): Promise<AiDecisionOutput> {
 *     const start = Date.now();
 *     try {
 *       // ... build prompt, call API, parse response ...
 *       return { plan, confidence, modelId: this.modelId, latencyMs: Date.now() - start };
 *     } catch (err) {
 *       // Normalise to low-confidence output — do not rethrow
 *       return { plan: FALLBACK_PLAN, confidence: undefined, modelId: this.modelId, latencyMs: Date.now() - start };
 *     }
 *   }
 * }
 */
export interface AiModelContract {
  /**
   * The canonical model identifier for this adapter instance.
   *
   * Must match the `modelId` field in every AiDecisionOutput returned by
   * callModel().  Written to ai_decision_logs and must be stable across
   * deployments (i.e. do not use aliases like "latest").
   *
   * Examples: "claude-3-5-haiku-20241022", "gpt-4o-mini"
   */
  readonly modelId: string;

  /**
   * Call the AI model and return its structured decision output.
   *
   * The adapter is responsible for:
   *   - Building a prompt from the DecisionInput.
   *   - Calling the model API with the configured timeout.
   *   - Parsing and validating the raw model response.
   *   - Measuring and populating latencyMs.
   *   - Returning a valid (possibly low-confidence) AiDecisionOutput on error.
   *
   * @param input  The visitor context and behavioural history for this request.
   *               Built by buildDecisionInput() in the page layer.
   *
   * @returns      A Promise that resolves to an AiDecisionOutput.
   *               Must not reject for expected model-layer errors.
   */
  callModel(input: DecisionInput): Promise<AiDecisionOutput>;
}

// ── AiModelAdapterConfig ──────────────────────────────────────────────────────

/**
 * Constructor argument type for concrete AiModelContract implementations.
 *
 * Adapters should accept an AiProviderConfig in their constructor so that
 * the modelId, timeout, and key presence are all resolved by ai/config.ts
 * before the adapter is instantiated — the adapter never reads process.env
 * directly.
 *
 * This keeps adapters testable: pass a mock AiProviderConfig in tests.
 */
export interface AiModelAdapterConfig extends AiProviderConfig {
  /**
   * The raw API key to use for this request.
   *
   * This is the only place in the ai/ module where the actual key value is
   * passed.  Obtain it from process.env inside the adapter factory function,
   * not inside the adapter class itself, to keep the class test-friendly.
   *
   * The ai/config module only checks for key *presence* (hasApiKey: boolean).
   * The factory function is responsible for reading the actual value.
   */
  apiKey: string;
}

// ── isValidAiDecisionOutput ────────────────────────────────────────────────────

/**
 * Runtime type guard for AiDecisionOutput.
 *
 * Use in adapter implementations to validate model responses before returning
 * them to the confidence policy.  Returns false for any structurally invalid
 * shape so the adapter can fall back gracefully rather than letting the policy
 * receive unexpected input.
 *
 * This guard checks structural completeness only — it does NOT validate that
 * variant keys are in the allowed set (that is the confidence policy's job).
 *
 * @example
 * const raw = parseModelResponse(apiResponse);
 * if (!isValidAiDecisionOutput(raw)) {
 *   return { plan: FALLBACK_PLAN, confidence: undefined, modelId, latencyMs };
 * }
 * return raw;
 */
export function isValidAiDecisionOutput(value: unknown): value is AiDecisionOutput {
  if (!value || typeof value !== "object") return false;

  const v = value as Record<string, unknown>;

  // plan must be present and have all three string keys + a reason string
  const plan = v.plan;
  if (!plan || typeof plan !== "object") return false;

  const p = plan as Record<string, unknown>;
  if (
    typeof p.heroKey  !== "string" || p.heroKey.trim()  === "" ||
    typeof p.proofKey !== "string" || p.proofKey.trim() === "" ||
    typeof p.ctaKey   !== "string" || p.ctaKey.trim()   === "" ||
    typeof p.reason   !== "string"
  ) {
    return false;
  }

  // modelId must be a non-empty string
  if (typeof v.modelId !== "string" || v.modelId.trim() === "") return false;

  // confidence is optional but must be numeric when present
  if (v.confidence !== undefined && typeof v.confidence !== "number") return false;

  // latencyMs is optional but must be numeric when present
  if (v.latencyMs !== undefined && typeof v.latencyMs !== "number") return false;

  return true;
}
