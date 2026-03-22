/**
 * AI Module — Shared Types
 *
 * This file is the single import point for types shared across the ai/ module.
 * It does not define implementations, read environment variables, or produce
 * side effects.
 *
 * ─── Where types live ─────────────────────────────────────────────────────────
 *
 *   Variant key types          — decision/types.ts        (source of truth)
 *   AI model output shape      — decision/ai-confidence-policy.ts  (source of truth)
 *   AI mode / provider config  — this file                (source of truth)
 *
 *   Re-exports from the decision layer are provided here so that consumers
 *   of the ai/ module can import everything from one place.
 *
 * ─── AI mode model ────────────────────────────────────────────────────────────
 *
 *   disabled  — AI is not active in any form.
 *               MC_HOMEPAGE_DECISION_PROVIDER=rules and SHADOW_AI_ENABLED is not "true".
 *               Homepage always uses the rules engine. No ai_decision_logs rows written.
 *
 *   shadow    — AI runs in parallel with the rules engine, but the rules plan is
 *               always served. Both plans are recorded in ai_decision_logs after
 *               the HTTP response is sent so there is zero impact on page latency.
 *               MC_HOMEPAGE_DECISION_PROVIDER=rules and SHADOW_AI_ENABLED=true.
 *
 *   live      — AI inference is on the critical path. When confidence >= threshold
 *               the AI plan is served; otherwise the rules plan is used as fallback.
 *               MC_HOMEPAGE_DECISION_PROVIDER=claude|openai.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   import type { AiMode, AiRuntimeConfig } from "@/ai/types";
 *   import { getAiRuntimeConfig }           from "@/ai/config";
 *   import type { AiModelContract }         from "@/ai/model-contract";
 */

// ── Re-exports from the decision layer ────────────────────────────────────────
// Imported here once so that consumers of the ai/ module have a single entry
// point and do not need to know which sub-package owns each type.

export type {
  HeroVariantKey,
  ProofVariantKey,
  CTAVariantKey,
  ExperiencePlan,
} from "@/decision/types";

/**
 * The structured output from one AI model call.
 *
 * Re-exported from decision/ai-confidence-policy so that ai/ module consumers
 * never need to import directly from the decision layer.
 *
 * Shape:
 *   plan         — the recommended ExperiencePlan (heroKey + proofKey + ctaKey + reason)
 *   confidence   — self-reported score in [0, 1]; undefined if the model did not score
 *   modelId      — stable model identifier string (e.g. "claude-3-5-haiku-20241022")
 *   latencyMs    — wall-clock inference time in ms (set by the adapter, not the model)
 *   rawReasoning — optional chain-of-thought text from the model
 *   inputTokens  — prompt token count for cost tracking
 *   outputTokens — completion token count for cost tracking
 */
export type { AiDecisionOutput } from "@/decision/ai-confidence-policy";

// ── AI mode ───────────────────────────────────────────────────────────────────

/**
 * The operational mode of the AI layer.
 *
 * Derived at runtime from environment variables by getAiMode() in ai/config.ts.
 * Never hard-code — always read via config.
 */
export type AiMode = "disabled" | "shadow" | "live";

// ── AI provider names ─────────────────────────────────────────────────────────

/**
 * The supported AI provider identifiers.
 *
 * These map to runtime adapter implementations in ai/providers/:
 *   claude  → Anthropic Claude via the Messages API.
 *             Requires ANTHROPIC_API_KEY.
 *             Default model: "claude-3-5-haiku-20241022"
 *   openai  → OpenAI GPT via the Chat Completions API.
 *             Requires OPENAI_API_KEY.
 *             Default model: "gpt-4o-mini"
 *   gemini  → Google Gemini via the Generative Language API.
 *             Requires GEMINI_API_KEY.
 *             Default model: "gemini-1.5-flash"
 *             ⚠ Adapter not yet implemented — routes to MockAiProvider.
 *
 * Future providers (Mistral, Cohere, etc.) will be added here.
 */
export type AiProviderName = "claude" | "openai" | "gemini";

// ── AI provider config ────────────────────────────────────────────────────────

/**
 * Runtime configuration snapshot for one AI provider.
 *
 * Produced by ai/config.ts; never construct manually.
 * Treat as read-only — it is a snapshot of env vars at cold-start.
 */
export interface AiProviderConfig {
  /**
   * The provider this config applies to.
   */
  name: AiProviderName;

  /**
   * The specific model to use for homepage decisioning.
   *
   * Examples:
   *   "claude-3-5-haiku-20241022"  (Anthropic — fast, cheap, recommended for decisioning)
   *   "claude-sonnet-4-6"          (Anthropic — richer reasoning)
   *   "gpt-4o-mini"                (OpenAI — comparable speed/cost tier)
   */
  modelId: string;

  /**
   * Whether the required API key env var is present and non-empty.
   *
   * `false` does NOT reveal the key value — it only indicates presence.
   * When false, the provider cannot be used and a config warning should be
   * surfaced in the dashboard.
   */
  hasApiKey: boolean;

  /**
   * Maximum wall-clock time in milliseconds to wait for a model response.
   *
   * Callers must abort the request if this is exceeded.
   * Default: 8 000 ms — keep comfortably below Next.js edge function limits.
   */
  timeoutMs: number;
}

// ── AI runtime config ─────────────────────────────────────────────────────────

/**
 * The fully resolved AI runtime configuration for this deployment.
 *
 * Produced once per process by getAiRuntimeConfig() in ai/config.ts.
 * All fields are derived from environment variables and never change at runtime.
 */
export interface AiRuntimeConfig {
  /**
   * The current operational mode.
   * @see AiMode
   */
  mode: AiMode;

  /**
   * Config for the provider running live (on the critical render path).
   * Non-null only when mode === "live".
   */
  liveProvider: AiProviderConfig | null;

  /**
   * Config for the provider running in shadow (off the critical render path).
   * Non-null only when mode === "shadow".
   */
  shadowProvider: AiProviderConfig | null;

  /**
   * Minimum model confidence score [0, 1] required to serve an AI plan.
   *
   * When the model reports confidence below this threshold the rules engine
   * is used instead and the AI plan is only logged.
   *
   * Sourced from MC_AI_CONFIDENCE_THRESHOLD. Default: 0.70.
   * Relevant only when mode === "live"; ignored in shadow mode.
   */
  confidenceThreshold: number;
}

// ── AI config issue ───────────────────────────────────────────────────────────

/**
 * A single validation problem detected in the AI configuration.
 *
 * Returned by validateAiConfig() in ai/config.ts.
 * Surface these in the dashboard settings page so operators can self-diagnose.
 */
export interface AiConfigIssue {
  /**
   * Machine-readable severity.
   *   error   — the AI layer cannot function (e.g. missing API key in live mode)
   *   warning — suboptimal but not fatal (e.g. non-default timeout, deprecated var)
   */
  severity: "error" | "warning";

  /**
   * Stable machine-readable code for programmatic handling.
   * Examples: "MISSING_API_KEY", "DEPRECATED_ENV_VAR", "TIMEOUT_OUT_OF_RANGE"
   */
  code: string;

  /**
   * Human-readable explanation suitable for the dashboard UI.
   */
  message: string;

  /**
   * The environment variable that caused the issue, when applicable.
   */
  envVar?: string;
}
