/**
 * AI Config Resolver
 *
 * Resolves the effective AI provider configuration for a tenant using the
 * standard four-layer model:
 *
 *   tenant   → tenant_settings.settings.ai (TenantAiSettings)
 *   platform → platform_settings["ai"]     (PlatformAiSettings)
 *   env      → ANTHROPIC_API_KEY / OPENAI_API_KEY
 *   system   → { mode: "disabled" } (safe default — AI off until configured)
 *
 * Returns a `DomainResolution<ResolvedAiConfig>` with the merged config
 * and source metadata for admin UX and diagnostics.
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   `anthropicKey` and `openaiKey` are SERVER ONLY.
 *   Never pass `resolution.config` across a server→client boundary.
 */

import "server-only";

import { getTenantDomainConfig }         from "@/lib/config/tenant-store";
import { getPlatformAiSettings }         from "@/platform/platform-store";
import { layeredResolve }                from "@/lib/config/resolver";
import type { DomainResolution }         from "@/lib/config/types";
import type { TenantAiSettings }         from "@/tenant/types";
import type { PlatformAiSettings }       from "@/platform/platform-store";

// ANTHROPIC_API_KEY / OPENAI_API_KEY are not yet part of serverEnv.
// They are read via process.env directly in the env-layer section below.

// ─────────────────────────────────────────────────────────────────────────────
// ResolvedAiConfig
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The fully-resolved AI configuration for a tenant.
 *
 * Merges fields from `TenantAiSettings` and `PlatformAiSettings` with env
 * and system defaults.
 *
 * SERVER ONLY — contains decrypted API keys.
 */
export interface ResolvedAiConfig {
  /**
   * Operating mode for the AI decision provider on this tenant.
   * "disabled" → AI is off (default).
   * "shadow"   → AI runs but its output is not surfaced.
   * "live"     → AI output drives adaptive decisions.
   */
  mode: "disabled" | "shadow" | "live";

  /**
   * Platform-level Anthropic API key (fallback when tenant has no per-provider key).
   * SERVER ONLY.
   */
  anthropicKey?: string;

  /**
   * Platform-level OpenAI API key (fallback when tenant has no per-provider key).
   * SERVER ONLY.
   */
  openaiKey?: string;

  /**
   * Tenant-level AI provider configuration.
   * Contains per-slot (live / shadow) provider + model + optional per-tenant API key.
   */
  tenantAiSettings?: TenantAiSettings;

  /** Confidence threshold for AI-driven decisions (0–1). Defaults to 0.7. */
  confidenceThreshold?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveAiConfig
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves the effective AI configuration for `tenantId`.
 *
 * @param tenantId  Tenant slug, e.g. "acme".
 */
export async function resolveAiConfig(
  tenantId: string,
): Promise<DomainResolution<ResolvedAiConfig>> {
  const [tenantAi, platformResult] = await Promise.all([
    getTenantDomainConfig(tenantId, "ai"),
    getPlatformAiSettings(),
  ]);

  const platformAi: PlatformAiSettings | null =
    platformResult.ok ? platformResult.data : null;

  // ── Env layer ─────────────────────────────────────────────────────────────
  // ANTHROPIC_API_KEY / OPENAI_API_KEY are not yet exposed via serverEnv —
  // read them directly from process.env (server-only context is guaranteed
  // by the "server-only" import at the top of this file).
  const anthropicEnvKey = process.env.ANTHROPIC_API_KEY || undefined;
  const openaiEnvKey    = process.env.OPENAI_API_KEY    || undefined;
  const envLayer: Partial<ResolvedAiConfig> | null =
    anthropicEnvKey || openaiEnvKey
      ? { anthropicKey: anthropicEnvKey, openaiKey: openaiEnvKey }
      : null;

  // ── Platform layer ────────────────────────────────────────────────────────
  const platformLayer: Partial<ResolvedAiConfig> | null = platformAi
    ? {
        anthropicKey: platformAi.anthropicKey,
        openaiKey:    platformAi.openaiKey,
      }
    : null;

  // ── Tenant layer ──────────────────────────────────────────────────────────
  // TenantAiSettings has `mode` and nested provider config — map into flat shape.
  const tenantLayer: Partial<ResolvedAiConfig> | null =
    tenantAi && Object.keys(tenantAi).length > 0
      ? {
          mode:               tenantAi.mode,
          confidenceThreshold: tenantAi.confidenceThreshold,
          tenantAiSettings:   tenantAi as TenantAiSettings,
        }
      : null;

  const baseline: ResolvedAiConfig = { mode: "disabled" };

  return layeredResolve<ResolvedAiConfig>(
    {
      system:   { mode: "disabled" },
      env:      envLayer,
      platform: platformLayer,
      tenant:   tenantLayer,
    },
    baseline,
  );
}
