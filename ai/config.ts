/**
 * AI Module — Config Accessors
 *
 * Reads, validates, and exposes the AI layer configuration derived from
 * environment variables with optional per-tenant overrides.
 *
 * This is the single place in the codebase that touches `process.env` for
 * anything AI-related.
 *
 * ─── Server-side only ────────────────────────────────────────────────────────
 *
 *   This module must only be imported in server-side code (Server Components,
 *   Route Handlers, middleware, repository files).  It must NEVER be imported
 *   from client components — it references process.env keys that are not
 *   prefixed with NEXT_PUBLIC_ and would be undefined in the browser.
 *
 * ─── Resolution order ────────────────────────────────────────────────────────
 *
 *   1. tenant.ai settings  (TenantConfig.ai or TenantSettings.ai, when provided)
 *   2. Environment variables                                        (fallback)
 *
 *   When a tenant provides a provider slot but no apiKey, the env-based
 *   apiKey presence is used — the tenant setting never silently loses access to
 *   a platform key just because the per-tenant key was not configured.
 *   Conversely, when the tenant provides an apiKey but the env key is absent,
 *   hasApiKey is set to true so the provider is marked usable.
 *
 * ─── Environment variables consumed ──────────────────────────────────────────
 *
 *   MC_HOMEPAGE_DECISION_PROVIDER   "rules" | "claude" | "openai" | "gemini"
 *                                   "rules" (default) — AI is off
 *                                   "claude" | "openai" | "gemini" — AI is live
 *   DECISION_PROVIDER               Legacy alias, used when MC_HOMEPAGE_DECISION_PROVIDER
 *                                   is absent.  Being phased out.
 *
 *   SHADOW_AI_ENABLED               "true" to enable shadow mode.
 *                                   Only evaluated when live provider is "rules".
 *   SHADOW_AI_PROVIDER              "claude" | "openai" (default "claude")
 *                                   The provider to run in shadow.
 *
 *   MC_AI_CONFIDENCE_THRESHOLD      float in [0, 1]. Default: 0.70
 *
 *   ANTHROPIC_API_KEY               Required when provider is "claude".
 *   CLAUDE_MODEL                    Default: "claude-3-5-haiku-20241022"
 *   CLAUDE_DECISION_TIMEOUT         Integer ms. Default: 8000
 *
 *   OPENAI_API_KEY                  Required when provider is "openai".
 *   OPENAI_MODEL                    Default: "gpt-4o-mini"
 *
 *   GEMINI_API_KEY                  Required when provider is "gemini".
 *   GEMINI_MODEL                    Default: "gemini-1.5-flash"
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   import { getAiMode, getAiRuntimeConfig, validateAiConfig } from "@/ai/config";
 *
 *   // Env-only (no tenant override):
 *   const config = getAiRuntimeConfig();
 *
 *   // With static deployment config (TenantConfig from resolve-tenant):
 *   const tenantConfig = await getActiveTenant();
 *   const config       = getAiRuntimeConfig(tenantConfig);
 *
 *   // With dynamic admin settings (TenantSettings from tenant-store):
 *   const settings = await getTenantById("my-tenant");
 *   const config   = getTenantAiRuntimeConfig(settings);
 *
 *   const mode   = getAiMode();          // "disabled" | "shadow" | "live"
 *   const issues = validateAiConfig();   // AiConfigIssue[]
 */

import type {
  AiMode,
  AiProviderName,
  AiProviderConfig,
  AiRuntimeConfig,
  AiConfigIssue,
} from "./types";
import type { TenantConfig, TenantSettings, TenantAiSettings } from "@/tenant/types";

// ── Raw env readers ───────────────────────────────────────────────────────────
// Private helpers that read individual env vars.
// All defaults are expressed here so the rest of the module stays declarative.

function readDecisionProvider(): "rules" | AiProviderName {
  const raw =
    process.env.MC_HOMEPAGE_DECISION_PROVIDER ??
    process.env.DECISION_PROVIDER ??
    "rules";
  if (raw === "claude" || raw === "openai" || raw === "gemini") return raw;
  return "rules";
}

function readShadowEnabled(): boolean {
  return process.env.SHADOW_AI_ENABLED === "true";
}

function readShadowProvider(): AiProviderName {
  const raw = process.env.SHADOW_AI_PROVIDER ?? "claude";
  if (raw === "openai")  return "openai";
  if (raw === "gemini")  return "gemini";
  return "claude";
}

function readConfidenceThreshold(): number {
  const raw = process.env.MC_AI_CONFIDENCE_THRESHOLD;
  if (raw === undefined) return 0.70;
  const parsed = parseFloat(raw);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 1) return 0.70;
  return parsed;
}

function readClaudeModelId(): string {
  return process.env.CLAUDE_MODEL ?? "claude-3-5-haiku-20241022";
}

function readClaudeTimeoutMs(): number {
  const raw = process.env.CLAUDE_DECISION_TIMEOUT;
  if (raw === undefined) return 8_000;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return 8_000;
  return parsed;
}

function readOpenAiModelId(): string {
  return process.env.OPENAI_MODEL ?? "gpt-4o-mini";
}

function readGeminiModelId(): string {
  return process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
}

// API key presence checks — never expose the key value.
function hasAnthropicKey(): boolean {
  const key = process.env.ANTHROPIC_API_KEY;
  return typeof key === "string" && key.trim().length > 0;
}

function hasOpenAiKey(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return typeof key === "string" && key.trim().length > 0;
}

function hasGeminiKey(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return typeof key === "string" && key.trim().length > 0;
}

// ── Provider config builders ──────────────────────────────────────────────────

function buildClaudeConfig(): AiProviderConfig {
  return {
    name:      "claude",
    modelId:   readClaudeModelId(),
    hasApiKey: hasAnthropicKey(),
    timeoutMs: readClaudeTimeoutMs(),
  };
}

function buildOpenAiConfig(): AiProviderConfig {
  return {
    name:      "openai",
    modelId:   readOpenAiModelId(),
    hasApiKey: hasOpenAiKey(),
    timeoutMs: 8_000, // OpenAI timeout not yet separately configurable
  };
}

function buildGeminiConfig(): AiProviderConfig {
  return {
    name:      "gemini",
    modelId:   readGeminiModelId(),
    hasApiKey: hasGeminiKey(),
    timeoutMs: 8_000, // Gemini timeout not yet separately configurable
  };
}

function buildProviderConfig(name: AiProviderName): AiProviderConfig {
  switch (name) {
    case "claude":  return buildClaudeConfig();
    case "openai":  return buildOpenAiConfig();
    case "gemini":  return buildGeminiConfig();
  }
}

// ── Public accessors ──────────────────────────────────────────────────────────

/**
 * Returns the current operational mode of the AI layer.
 *
 * Derived purely from environment variables — no I/O.
 *
 * Mode resolution logic:
 *   1. If MC_HOMEPAGE_DECISION_PROVIDER is "claude" or "openai" → "live"
 *   2. Else if SHADOW_AI_ENABLED === "true"                     → "shadow"
 *   3. Otherwise                                                → "disabled"
 */
export function getAiMode(): AiMode {
  const liveProvider = readDecisionProvider();
  if (liveProvider !== "rules") return "live";
  if (readShadowEnabled())      return "shadow";
  return "disabled";
}

/**
 * Returns `true` when AI is active in any form (shadow or live).
 *
 * Convenience wrapper over getAiMode().
 */
export function isAiEnabled(): boolean {
  return getAiMode() !== "disabled";
}

/**
 * Returns `true` when AI plans are being served live to visitors.
 */
export function isAiLive(): boolean {
  return getAiMode() === "live";
}

/**
 * Returns `true` when AI is running in shadow (observation-only) mode.
 */
export function isAiShadow(): boolean {
  return getAiMode() === "shadow";
}

/**
 * Checks whether the required API key is present for the given provider.
 *
 * Only tests for presence — never reveals the key value.
 *
 * @param provider  The provider whose key to check.
 * @returns         true if the key env var is non-empty; false otherwise.
 */
export function checkApiKeyPresence(provider: AiProviderName): boolean {
  switch (provider) {
    case "claude": return hasAnthropicKey();
    case "openai": return hasOpenAiKey();
    case "gemini": return hasGeminiKey();
  }
}

// ── Env-only baseline config ──────────────────────────────────────────────────
//
// Private helper that resolves AiRuntimeConfig purely from environment
// variables.  Used as the baseline before any tenant settings are applied.

function resolveFromEnv(): AiRuntimeConfig {
  const mode             = getAiMode();
  const liveProviderName = readDecisionProvider();
  const shadowProviderName = readShadowProvider();

  return {
    mode,

    liveProvider:
      mode === "live"
        ? buildProviderConfig(liveProviderName as AiProviderName)
        : null,

    shadowProvider:
      mode === "shadow"
        ? buildProviderConfig(shadowProviderName)
        : null,

    confidenceThreshold: readConfidenceThreshold(),
  };
}

// ── Tenant AI settings resolver ───────────────────────────────────────────────
//
// Core private helper that merges an optional TenantAiSettings on top of the
// env baseline.  Used by both getAiRuntimeConfig (TenantConfig path) and
// getTenantAiRuntimeConfig (TenantSettings path) — the shapes are identical.
//
// Resolution rules per provider slot:
//   - All three names ("claude", "openai", "gemini") are accepted; unknown names
//     (future providers not yet in AiProviderName) fall back to env.
//   - Model override: tenant wins over env default when present.
//   - API key: when the tenant supplies a key, hasApiKey → true; when absent,
//     the env key presence is preserved as-is.  A tenant config that omits
//     apiKey does NOT mask a platform key that is present in the environment.

function resolveWithAiSettings(ai: TenantAiSettings | undefined): AiRuntimeConfig {
  // No tenant AI settings → delegate to the env-only baseline.
  if (ai === undefined) return resolveFromEnv();

  const envConfig = resolveFromEnv();
  const mode: AiMode = ai.mode;

  /**
   * Merges a single tenant provider slot with the env-derived fallback.
   *
   * @param tenantCfg   The tenant's provider slot config (may be undefined).
   * @param envFallback The env-derived config for this slot.
   */
  function resolveTenantProvider(
    tenantCfg:   { name: string; apiKey?: string; model?: string } | undefined,
    envFallback: AiProviderConfig | null,
  ): AiProviderConfig | null {
    if (!tenantCfg) return envFallback;

    const { name } = tenantCfg;
    // Guard against provider names that are not yet in AiProviderName (e.g. a
    // future "mistral" before it is added to the type).  All current names
    // ("claude", "openai", "gemini") pass through to buildProviderConfig.
    if (name !== "claude" && name !== "openai" && name !== "gemini") {
      return envFallback;
    }

    const base = buildProviderConfig(name as AiProviderName);
    return {
      ...base,
      // Tenant model override takes precedence over the env default.
      modelId:  tenantCfg.model ?? base.modelId,
      // Mark key present when the tenant supplies one; otherwise keep the
      // env presence flag so a platform key is not masked by omission.
      hasApiKey: tenantCfg.apiKey != null ? true : base.hasApiKey,
    };
  }

  return {
    mode,

    liveProvider:
      mode === "live"
        ? resolveTenantProvider(
            ai.liveProvider,
            // Env fallback for the live slot — prefer the env-configured live
            // provider; build one from the env decision-provider name as last resort.
            envConfig.liveProvider ?? buildProviderConfig(
              (readDecisionProvider() as AiProviderName | "rules") === "rules"
                ? "claude"
                : (readDecisionProvider() as AiProviderName),
            ),
          )
        : null,

    shadowProvider:
      mode === "shadow"
        ? resolveTenantProvider(
            ai.shadowProvider,
            // Env fallback for the shadow slot.
            envConfig.shadowProvider ?? buildProviderConfig(readShadowProvider()),
          )
        : null,

    confidenceThreshold: ai.confidenceThreshold ?? envConfig.confidenceThreshold,
  };
}

/**
 * Returns the fully resolved AI runtime configuration for this deployment.
 *
 * When called without arguments, all fields are derived from environment
 * variables only.  Pass a `TenantConfig` to layer per-tenant overrides on top
 * of the env baseline following the resolution order documented at the top of
 * this module.
 *
 * ─── When to use which entry point ───────────────────────────────────────────
 *
 *   getAiRuntimeConfig()              — env-only; suitable for global / non-
 *                                       tenant contexts (health checks, CLI).
 *   getAiRuntimeConfig(tenantConfig)  — static per-tenant deployment config;
 *                                       pass the TenantConfig from
 *                                       getActiveTenant() / resolveTenant().
 *   getTenantAiRuntimeConfig(settings)— dynamic admin-UI config; pass the
 *                                       TenantSettings loaded from the DB.
 *
 * @param tenant  Optional static deployment config (TenantConfig).
 *                When absent or when tenant.ai is undefined, falls back to
 *                environment variables.
 *
 * @example
 * // Env-only (backwards-compatible, zero-arg form):
 * const config = getAiRuntimeConfig();
 *
 * // With static tenant config from the resolver:
 * const tenantConfig = await getActiveTenant();
 * const config       = getAiRuntimeConfig(tenantConfig);
 *
 * if (config.mode === "live" && config.liveProvider?.hasApiKey) {
 *   // safe to instantiate the live AI provider
 * }
 */
export function getAiRuntimeConfig(tenant?: TenantConfig): AiRuntimeConfig {
  return resolveWithAiSettings(tenant?.ai);
}

/**
 * Validates the current AI configuration and returns any detected issues.
 *
 * Designed to be called from:
 *   - The dashboard settings / status page
 *   - Startup health-check endpoints
 *   - CI config-lint scripts
 *
 * An empty array means the configuration is valid.
 * Issues with severity "error" mean the AI layer will not function correctly.
 * Issues with severity "warning" are advisory.
 *
 * @returns  An array of AiConfigIssue objects, empty when everything is fine.
 *
 * @example
 * const issues = validateAiConfig();
 * const errors = issues.filter(i => i.severity === "error");
 * if (errors.length > 0) {
 *   logger.warn("[ai-config] AI misconfigured", { errors });
 * }
 */
export function validateAiConfig(): AiConfigIssue[] {
  const issues: AiConfigIssue[] = [];
  const mode = getAiMode();

  // ── Disabled — nothing to validate ────────────────────────────────────────
  if (mode === "disabled") return issues;

  // ── Determine the active provider for key checks ───────────────────────────
  const activeProvider: AiProviderName =
    mode === "live"
      ? (readDecisionProvider() as AiProviderName)
      : readShadowProvider();

  // ── API key presence ───────────────────────────────────────────────────────
  if (!checkApiKeyPresence(activeProvider)) {
    const envVar =
      activeProvider === "claude"  ? "ANTHROPIC_API_KEY" :
      activeProvider === "openai"  ? "OPENAI_API_KEY"    :
      /* gemini */                   "GEMINI_API_KEY";
    issues.push({
      severity: "error",
      code:     "MISSING_API_KEY",
      message:
        `AI mode is "${mode}" with provider "${activeProvider}" but ${envVar} is not set. ` +
        `The AI layer will fail at runtime until this is configured.`,
      envVar,
    });
  }

  // ── Confidence threshold range ─────────────────────────────────────────────
  const rawThreshold = process.env.MC_AI_CONFIDENCE_THRESHOLD;
  if (rawThreshold !== undefined) {
    const parsed = parseFloat(rawThreshold);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 1) {
      issues.push({
        severity: "warning",
        code:     "INVALID_CONFIDENCE_THRESHOLD",
        message:
          `MC_AI_CONFIDENCE_THRESHOLD="${rawThreshold}" is not a valid float in [0, 1]. ` +
          `Falling back to the default threshold of 0.70.`,
        envVar: "MC_AI_CONFIDENCE_THRESHOLD",
      });
    } else if (parsed < 0.5) {
      issues.push({
        severity: "warning",
        code:     "LOW_CONFIDENCE_THRESHOLD",
        message:
          `MC_AI_CONFIDENCE_THRESHOLD=${parsed} is below 0.5. ` +
          `This will cause low-confidence AI plans to be served more frequently. ` +
          `Consider raising the threshold (0.70–0.85) for a safer production deployment.`,
        envVar: "MC_AI_CONFIDENCE_THRESHOLD",
      });
    }
  }

  // ── Claude timeout range ───────────────────────────────────────────────────
  if (activeProvider === "claude") {
    const rawTimeout = process.env.CLAUDE_DECISION_TIMEOUT;
    if (rawTimeout !== undefined) {
      const parsed = parseInt(rawTimeout, 10);
      if (Number.isNaN(parsed) || parsed <= 0) {
        issues.push({
          severity: "warning",
          code:     "INVALID_CLAUDE_TIMEOUT",
          message:
            `CLAUDE_DECISION_TIMEOUT="${rawTimeout}" is not a positive integer. ` +
            `Falling back to the default of 8 000 ms.`,
          envVar: "CLAUDE_DECISION_TIMEOUT",
        });
      } else if (parsed > 9_000) {
        issues.push({
          severity: "warning",
          code:     "CLAUDE_TIMEOUT_TOO_HIGH",
          message:
            `CLAUDE_DECISION_TIMEOUT=${parsed} ms exceeds 9 000 ms. ` +
            `Next.js edge functions have a hard limit of ~10 000 ms. ` +
            `Consider a value of 5 000–8 000 ms to leave headroom.`,
          envVar: "CLAUDE_DECISION_TIMEOUT",
        });
      }
    }
  }

  // ── Legacy env var still present ──────────────────────────────────────────
  if (
    process.env.DECISION_PROVIDER !== undefined &&
    process.env.MC_HOMEPAGE_DECISION_PROVIDER === undefined
  ) {
    issues.push({
      severity: "warning",
      code:     "DEPRECATED_ENV_VAR",
      message:
        `DECISION_PROVIDER is set but the preferred variable MC_HOMEPAGE_DECISION_PROVIDER ` +
        `is absent. DECISION_PROVIDER still works but will be removed in a future release. ` +
        `Rename it to MC_HOMEPAGE_DECISION_PROVIDER.`,
      envVar: "DECISION_PROVIDER",
    });
  }

  return issues;
}

// ── Tenant-aware config override ──────────────────────────────────────────────

/**
 * Returns an AiRuntimeConfig resolved from dynamic TenantSettings (DB-backed,
 * admin-UI configurable), with a hard fallback to the env-based config when
 * settings are absent.
 *
 * Use this when you have a TenantSettings record loaded from the tenant store.
 * For static per-deployment config from TenantConfig, use getAiRuntimeConfig()
 * instead.
 *
 * ─── Override precedence ──────────────────────────────────────────────────────
 *
 *   tenant.ai.mode                         → config.mode
 *   tenant.ai.liveProvider.name            → live provider selection
 *   tenant.ai.liveProvider.model           → model ID override (live slot)
 *   tenant.ai.liveProvider.apiKey          → API key presence (live slot)
 *   tenant.ai.shadowProvider.name          → shadow provider selection
 *   tenant.ai.shadowProvider.model         → model ID override (shadow slot)
 *   tenant.ai.shadowProvider.apiKey        → API key presence (shadow slot)
 *   tenant.ai.confidenceThreshold          → config.confidenceThreshold
 *
 *   When a tenant provider slot is absent, the platform falls back to the
 *   env-derived provider for that slot (MC_HOMEPAGE_DECISION_PROVIDER /
 *   SHADOW_AI_PROVIDER).  When that is also absent the ultimate default is
 *   "claude".
 *
 *   Providers not yet implemented at the runtime layer (e.g. "gemini") fall
 *   back to the env-derived config for that slot.
 *
 * ─── Fallback ─────────────────────────────────────────────────────────────────
 *
 *   Passing null returns getAiRuntimeConfig() unchanged — env-only resolution.
 *
 * @param tenant  Loaded TenantSettings, or null to use env config.
 * @returns       Fully resolved AiRuntimeConfig ready for createAiProvider().
 *
 * @example
 * const tenant   = await getTenantById("mister-chameleon");
 * const aiConfig = getTenantAiRuntimeConfig(tenant);
 * // aiConfig reflects the tenant's stored AI mode, provider, and model.
 */
export function getTenantAiRuntimeConfig(
  tenant: TenantSettings | null,
): AiRuntimeConfig {
  // TenantSettings.ai is always present when a tenant record exists.
  // Pass it directly to the shared resolver; null/undefined falls back to env.
  return resolveWithAiSettings(tenant?.ai);
}
