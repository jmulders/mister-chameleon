/**
 * WorkEngine Tenant Configuration
 *
 * Deployment-level configuration for the WorkEngine tenant.
 *
 * ─── Identity ─────────────────────────────────────────────────────────────────
 *
 *   tenantId:  "workengine"
 *   name:      "WorkEngine"
 *   hostname:  workengine.io (production) / workengine.localhost:3000 (local dev)
 *
 * ─── Provider choices ────────────────────────────────────────────────────────
 *
 *   cmsProvider:      "sanity" — WorkEngine content lives in Sanity.
 *                     createCMSProvider() falls back to the mock provider when
 *                     SANITY_PROJECT_ID is not set in the environment.
 *   decisionProvider: "rules" — the deterministic rules engine.
 *                     Upgrade to "ai" once an AI provider is configured and
 *                     the shadow / live threshold policy is agreed.
 *
 * ─── Features ────────────────────────────────────────────────────────────────
 *
 *   diagnosticsBar — enabled in local development only (NODE_ENV === "development").
 *   contactForm    — enabled (routes through the global N8N_CONTACT_WEBHOOK_URL
 *                    unless overridden via a tenant-level contact.webhookUrl).
 *
 * ─── Theme ────────────────────────────────────────────────────────────────────
 *
 *   Uses the WORKENGINE_THEME (violet/purple palette, soft radius, heavy
 *   heading weight) — defined in tenant/workengine-theme.ts and backed by
 *   the "workengine" ThemePreset in design-system/theme/presets.ts.
 *
 *   Changing the visual brand → edit design-system/theme/presets.ts.
 *   The CSS var cascade propagates changes without any component edits.
 *
 * ─── How to go live ───────────────────────────────────────────────────────────
 *
 *   1. Provision a Sanity (or Storyblok / Statamic) project.
 *   2. Set SANITY_PROJECT_ID (or equivalent) in the deployment environment.
 *   3. Update cmsProvider here accordingly.
 *   4. Register the production hostname in resolve-tenant.ts (already done
 *      for workengine.io and www.workengine.io).
 *   5. Deploy — all other config is driven from this file + environment vars.
 */

import type { TenantConfig } from "./types";
import { WORKENGINE_THEME }  from "./workengine-theme";

// ── Config ────────────────────────────────────────────────────────────────────

/**
 * WorkEngine tenant configuration.
 *
 * @example
 *   import { WORKENGINE_TENANT } from "@/tenant/workengine-config";
 *   console.log(WORKENGINE_TENANT.tenantId); // "workengine"
 */
export const WORKENGINE_TENANT: TenantConfig = {
  // ── Identity ────────────────────────────────────────────────────────────────
  tenantId:          "workengine",
  name:              "WorkEngine",
  canonicalHostname: "workengine.io",

  // ── Providers ───────────────────────────────────────────────────────────────
  //
  // cmsProvider: "sanity" — WorkEngine content lives in the shared Sanity project.
  // createCMSProvider() falls back to the mock provider when SANITY_PROJECT_ID
  // is not set in the environment, so local dev without credentials still works.
  // decisionProvider: stays "rules" until AI layer is activated per-tenant.
  cmsProvider:      "sanity",
  decisionProvider: "rules",

  // ── Features ────────────────────────────────────────────────────────────────
  features: {
    // Show the debug diagnostics bar only in local development.
    // Set NEXT_PUBLIC_DEBUG_DIAGNOSTICS=true to enable in staging.
    diagnosticsBar:
      process.env.NODE_ENV === "development" ||
      process.env.NEXT_PUBLIC_DEBUG_DIAGNOSTICS === "true",

    // Contact form is active — uses the shared N8N_CONTACT_WEBHOOK_URL.
    contactForm: true,
  },

  // ── Theme ────────────────────────────────────────────────────────────────────
  // The WorkEngine theme drives CSS variable injection in the root layout.
  // Components consume these via the CSS custom property cascade — no
  // component code changes when the theme changes.
  //
  // Token summary (full spec in design-system/theme/presets.ts):
  //   --primary:          #8b5cf6  (violet-500 — vivid purple)
  //   --primary-hover:    #7c3aed  (violet-600)
  //   --section-hero-bg:  #2e1065  (violet-950 — deep purple hero)
  //   --card-radius:      1.5rem   (24px — soft personality)
  //   --font-heading-weight: 800   (heavy headings)
  //   --btn-shadow:        md elevation
  theme: WORKENGINE_THEME,
};
