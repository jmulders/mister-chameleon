/**
 * Production tenant configs — static registry entries
 *
 * These two tenants run on stable custom domains (misterchameleon.nl,
 * steunles.nl). They were originally admin-provisioned (their config lived only
 * in the DB and resolved via the async store path), which meant a transient DB
 * miss on a cold serverless instance could fall back to FALLBACK_TENANT
 * (mister-chameleon) — the recurring "navigation flip-flop".
 *
 * Registering them in the STATIC TENANT_REGISTRY makes resolution synchronous
 * and I/O-free (resolve-tenant step 2), so their tenant identity can NEVER flip
 * to the fallback. The per-request design tokens + CMS site settings are still
 * read from the DB by tenantId (layout.tsx / createCMSProvider), so the visual
 * design and nav content stay fully DB-driven — only the host → tenantId mapping
 * is pinned here.
 *
 * `theme` is the base layer only; for theme="custom" tenants (statamic) the
 * admin design tokens override it, and for curated-theme tenants
 * (another-statamic → modern-green) layout.tsx derives the preset from
 * design.theme in the DB, so this value is just a safe fallback.
 *
 * To add another production domain: create a config here and register its
 * hostnames in resolve-tenant.ts TENANT_REGISTRY.
 */

import { MISTER_CHAMELEON_THEME } from "./theme";
import type { TenantConfig } from "./types";

const sharedFeatures = {
  diagnosticsBar:
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_DEBUG_DIAGNOSTICS === "true",
  contactForm: true,
} as const;

/** misterchameleon.nl — Statamic flat-file CMS tenant. */
export const STATAMIC_TENANT: TenantConfig = {
  tenantId:          "statamic",
  name:              "Mister Chameleon",
  canonicalHostname: "www.misterchameleon.nl",
  cmsProvider:       "statamic",
  decisionProvider:  "rules",
  features:          { ...sharedFeatures },
  theme:             MISTER_CHAMELEON_THEME,
  defaultLocale:     "nl",
  cms:               { statamicBaseUrl: "https://cms.misterchameleon.nl" },
};

/** steunles.nl — Statamic flat-file CMS tenant. */
export const ANOTHER_STATAMIC_TENANT: TenantConfig = {
  tenantId:          "another-statamic",
  name:              "Steunles",
  canonicalHostname: "www.steunles.nl",
  cmsProvider:       "statamic",
  decisionProvider:  "rules",
  features:          { ...sharedFeatures },
  theme:             MISTER_CHAMELEON_THEME,
  defaultLocale:     "nl",
  cms:               { statamicBaseUrl: "https://cms.steunles.nl" },
};
