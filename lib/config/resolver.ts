/**
 * Layered Configuration — Core Resolver
 *
 * Provides `layeredResolve()`: a generic utility that merges four configuration
 * layers (system → env → platform → tenant) and returns a `DomainResolution<T>`
 * with the effective merged config and provenance metadata.
 *
 * ─── Merge order (lowest → highest priority) ──────────────────────────────────
 *
 *   system   — compile-time safe defaults (never null, always present)
 *   env      — environment variable fallback
 *   platform — platform-wide DB default (platform_settings table)
 *   tenant   — per-tenant DB override
 *
 * Higher-priority layers win field-by-field.  A `null` or `undefined` value in
 * a higher layer does NOT shadow a concrete value in a lower layer; only
 * non-null/non-undefined fields override.
 *
 * ─── Source determination ─────────────────────────────────────────────────────
 *
 *   The `source` field in the result is the highest-priority layer that contains
 *   at least one non-null, non-undefined field.  Order: tenant > platform > env >
 *   system > none.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   import { layeredResolve } from "@/lib/config/resolver";
 *
 *   const resolution = layeredResolve(
 *     {
 *       system:   { transportType: "none" },
 *       env:      envResend ? { transportType: "resend", resendApiKey: key } : null,
 *       platform: platformSettings ?? null,
 *       tenant:   tenantTransport ?? null,
 *     },
 *     { transportType: "none" } as ResolvedEmailConfig,
 *   );
 */

import type { ConfigSource, DomainResolution } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if `obj` has at least one own enumerable key whose value is
 * neither null nor undefined.  Used to determine whether a layer "has" config.
 */
function hasAnyValue(obj: object | null | undefined): boolean {
  if (!obj) return false;
  return Object.values(obj).some((v) => v !== null && v !== undefined);
}

/**
 * Merges a source object into a target, skipping null/undefined source values.
 * Mutates `target` in place and returns it.
 */
function mergeNonNull<T extends object>(target: T, source: Partial<T> | null | undefined): T {
  if (!source) return target;
  for (const key of Object.keys(source) as (keyof T)[]) {
    const value = source[key];
    if (value !== null && value !== undefined) {
      target[key] = value as T[typeof key];
    }
  }
  return target;
}

// ─────────────────────────────────────────────────────────────────────────────
// layeredResolve
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Input layers for `layeredResolve()`.
 * Each layer is a partial config, or `null` if that layer isn't available.
 *
 * - `system`   — compile-time safe defaults; should generally be non-null.
 * - `env`      — values derived from environment variables.
 * - `platform` — values from the `platform_settings` database table.
 * - `tenant`   — values from the per-tenant database record.
 */
export interface ResolveInput<T extends object> {
  readonly system?:   Partial<T> | null;
  readonly env?:      Partial<T> | null;
  readonly platform?: Partial<T> | null;
  readonly tenant?:   Partial<T> | null;
}

/**
 * Merges four configuration layers and returns a `DomainResolution<T>`.
 *
 * Merge order (lowest → highest priority): system → env → platform → tenant.
 * Only non-null, non-undefined field values from higher layers override lower layers.
 *
 * @param layers  - The four optional configuration layers.
 * @param baseline - The baseline config that ensures all required fields are present
 *                   before any layer is applied.  Acts as the ultimate fallback.
 *
 * @returns A `DomainResolution<T>` with merged `config`, `source`, and layer metadata.
 */
export function layeredResolve<T extends object>(
  layers: ResolveInput<T>,
  baseline: T,
): DomainResolution<T> {
  const { system = null, env = null, platform = null, tenant = null } = layers;

  // Start from a copy of the baseline.
  const merged: T = { ...baseline };

  // Apply layers in ascending priority order.
  mergeNonNull(merged, system);
  mergeNonNull(merged, env);
  mergeNonNull(merged, platform);
  mergeNonNull(merged, tenant);

  // Determine the primary source (highest-priority layer with any value).
  let source: ConfigSource = "none";
  if (hasAnyValue(system))   source = "system";
  if (hasAnyValue(env))      source = "env";
  if (hasAnyValue(platform)) source = "platform";
  if (hasAnyValue(tenant))   source = "tenant";

  return {
    config:              merged,
    source,
    hasTenantOverride:   hasAnyValue(tenant),
    hasPlatformDefault:  hasAnyValue(platform),
    hasEnvFallback:      hasAnyValue(env),
    layers: {
      tenant:   tenant   ?? null,
      platform: platform ?? null,
      env:      env      ?? null,
      system:   system   ?? null,
    },
  };
}
