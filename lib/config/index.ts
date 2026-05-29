/**
 * Layered Configuration — Public API
 *
 * Re-exports the core types, utility functions, and domain resolvers for the
 * platform's multi-tenant, layered configuration system.
 *
 * ─── Quick reference ──────────────────────────────────────────────────────────
 *
 *   Types & utilities:
 *     ConfigSource           — "tenant" | "platform" | "env" | "system" | "none"
 *     DomainResolution<T>    — result type from all resolvers
 *     sourceLabel(source)    — human-readable label for ConfigSource
 *     sourceBadgeClass(src)  — Tailwind class string for badge styling
 *     layeredResolve(...)    — generic merge utility (used by resolvers)
 *
 *   Domain resolvers (server-only):
 *     resolveEmailConfig(tenantId)      — transport, from, backoffice
 *     resolveAiConfig(tenantId)         — mode, provider keys
 *     resolveCrmConfig(tenantId)        — CRM provider + enablement
 *     resolveEnrichmentConfig(tenantId) — geo enrichment + API keys
 *     resolveFormsConfig(tenantId)      — form settings + effective recipients
 *
 *   Resolved config types:
 *     ResolvedEmailConfig
 *     ResolvedAiConfig
 *     ResolvedCrmConfig
 *     ResolvedEnrichmentConfig
 *     ResolvedFormsConfig
 *
 *   Tenant store (server-only):
 *     getTenantDomainConfig(tenantId, key)  — read a domain slice
 *     setTenantDomainConfig(tenantId, key, value)  — write a domain slice
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   All resolver functions and config types are SERVER ONLY.
 *   The `DomainResolution<T>.config` object may contain decrypted secrets.
 *   Never pass it across a server→client boundary.
 *
 *   For admin UIs, use only:
 *     - `resolution.source`
 *     - `resolution.hasTenantOverride`
 *     - `resolution.hasPlatformDefault`
 *     - `resolution.hasEnvFallback`
 *     - `sourceLabel()` / `sourceBadgeClass()` (safe string helpers)
 */

// ── Core types & utilities ────────────────────────────────────────────────────
export type { ConfigSource, DomainResolution } from "./types";
export {
  sourceLabel,
  sourceBadgeClass,
  sourceDescription,
} from "./types";
export { layeredResolve }                       from "./resolver";
export type { ResolveInput }                    from "./resolver";

// ── Tenant store (server-only) ────────────────────────────────────────────────
export {
  getTenantDomainConfig,
  setTenantDomainConfig,
} from "./tenant-store";
export type { TenantConfigDomains, TenantConfigDomainKey } from "./tenant-store";

// ── Domain resolvers (server-only) ────────────────────────────────────────────
export { resolveEmailConfig }       from "./resolvers/email";
export type { ResolvedEmailConfig } from "./resolvers/email";

export { resolveAiConfig }          from "./resolvers/ai";
export type { ResolvedAiConfig }    from "./resolvers/ai";

export { resolveCrmConfig }         from "./resolvers/crm";
export type { ResolvedCrmConfig }   from "./resolvers/crm";

export { resolveEnrichmentConfig }          from "./resolvers/enrichment";
export type { ResolvedEnrichmentConfig }    from "./resolvers/enrichment";

export { resolveFormsConfig }       from "./resolvers/forms";
export type { ResolvedFormsConfig } from "./resolvers/forms";
