/**
 * Mister Chameleon Tenant Configuration
 *
 * The authoritative configuration for the default (and currently only)
 * deployment of the platform. All values are derived from environment
 * variables so that staging and production can differ without code changes.
 *
 * ─── Environment variables used ──────────────────────────────────────────────
 *
 *   NEXT_PUBLIC_SITE_URL          Canonical site URL, e.g. "https://misterchameleon.com"
 *                                 Hostname is extracted and stored in canonicalHostname.
 *                                 Falls back to "misterchameleon.com" if unset.
 *
 *   SANITY_PROJECT_ID             When present, cmsProvider is set to "sanity".
 *                                 The SanityProvider validates remaining Sanity vars
 *                                 (SANITY_DATASET, SANITY_API_VERSION) at first use.
 *
 *   STORYBLOK_ACCESS_TOKEN        When present (and SANITY_PROJECT_ID absent),
 *                                 cmsProvider is set to "storyblok".
 *
 *   When neither is set, cmsProvider falls back to "mock".
 *
 *   NODE_ENV                      "development" enables the diagnostics bar.
 *
 * ─── Why process.env is read directly here ───────────────────────────────────
 *
 *   This file does not import from @/lib/env intentionally. That module
 *   carries `import "server-only"`, which would prevent TenantConfig from
 *   being imported anywhere outside server-only paths. Reading process.env
 *   directly for these simple lookups avoids that constraint and keeps the
 *   tenant module importable in any server context without side-effects.
 *
 * ─── When to create a second config file ─────────────────────────────────────
 *
 *   Copy this file to tenant/<client-slug>-config.ts, fill in the values,
 *   and register the client's hostnames in TENANT_REGISTRY (resolve-tenant.ts).
 *   No other files need to change for the resolver to pick it up.
 */

import type { TenantConfig } from "./types";
import { MISTER_CHAMELEON_THEME } from "./theme";

// ── Derived constants ──────────────────────────────────────────────────────────

/**
 * Extract hostname from NEXT_PUBLIC_SITE_URL.
 * "https://misterchameleon.com" → "misterchameleon.com"
 * Falls back to the bare domain if the env var is absent or malformed.
 */
function deriveCanonicalHostname(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) return "misterchameleon.com";
  try {
    return new URL(raw).hostname;
  } catch {
    return "misterchameleon.com";
  }
}

// ── Config ────────────────────────────────────────────────────────────────────

/**
 * Mister Chameleon tenant configuration.
 *
 * This is the single source of truth for all deployment-level settings of
 * the default tenant. Import via the barrel (@/tenant) or directly from
 * this file when the full config is needed.
 *
 * @example
 *   import { MISTER_CHAMELEON_TENANT } from "@/tenant";
 *   console.log(MISTER_CHAMELEON_TENANT.tenantId); // "mister-chameleon"
 */
export const MISTER_CHAMELEON_TENANT: TenantConfig = {
  // ── Identity ────────────────────────────────────────────────────────────────
  tenantId: "mister-chameleon",
  name: "Mister Chameleon",
  canonicalHostname: deriveCanonicalHostname(),

  // ── Providers ───────────────────────────────────────────────────────────────
  //
  // cmsProvider mirrors the priority order in cms/providers/create-cms-provider.ts:
  //   1. Sanity     — SANITY_PROJECT_ID is set
  //   2. Storyblok  — STORYBLOK_ACCESS_TOKEN is set (and Sanity is not)
  //   3. Mock       — fallback when nothing is configured
  //
  // decisionProvider is "rules" — the only implemented provider today.
  // When AI providers are added, update DecisionProviderName and switch here.
  cmsProvider: process.env.SANITY_PROJECT_ID
    ? "sanity"
    : process.env.STORYBLOK_ACCESS_TOKEN
      ? "storyblok"
      : "mock",
  decisionProvider: "rules",

  // ── Features ────────────────────────────────────────────────────────────────
  features: {
    // Show the debug diagnostics bar only in local development.
    // Set NEXT_PUBLIC_DEBUG_DIAGNOSTICS=true to enable it in staging.
    diagnosticsBar:
      process.env.NODE_ENV === "development" ||
      process.env.NEXT_PUBLIC_DEBUG_DIAGNOSTICS === "true",
  },

  // ── Theme ────────────────────────────────────────────────────────────────────
  // The tenant theme drives CSS variable injection in the root layout.
  // Components consume these values via the CSS custom property cascade —
  // no component code changes when the theme changes.
  theme: MISTER_CHAMELEON_THEME,
};
