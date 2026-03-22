/**
 * Acme Growth Co. — Example Tenant Configuration
 *
 * This file demonstrates the complete onboarding pattern for a second tenant.
 * It is intentionally NOT live — hostnames are commented out in resolve-tenant.ts
 * until the client's domain and CMS credentials are ready.
 *
 * ─── What this example shows ─────────────────────────────────────────────────
 *
 *   1. Using createTenantConfig() to build from TENANT_DEFAULTS
 *   2. Supplying a brand-specific theme (teal / emerald palette)
 *   3. Switching cmsProvider to "storyblok"
 *   4. Narrowing the variant set to what the client's CMS actually contains
 *   5. Overriding the contact webhook URL for a client with their own n8n
 *   6. Enabling the contact form feature flag explicitly
 *
 * ─── To activate this tenant ─────────────────────────────────────────────────
 *
 *   1. Uncomment the Acme Growth Co. block in resolve-tenant.ts.
 *   2. Set STORYBLOK_ACCESS_TOKEN in the environment.
 *   3. Populate CMS content for the variant keys listed in `variants` below.
 *   4. Deploy — no other files need to change.
 *
 * ─── Theme notes ─────────────────────────────────────────────────────────────
 *
 *   Acme Growth Co. requested a "growth and momentum" feel — teal/emerald
 *   brand palette, sharp radius (startup/SaaS aesthetic), zinc neutrals.
 *
 *   The hex values are defined inline here because the platform's palette
 *   tokens (design-system/tokens/colors.ts) only ship the default indigo-violet
 *   brand. Per-client palettes live in their own config files.
 */

import type { TenantTheme } from "@/design-system/theme/tenant-theme";
import { neutral } from "@/design-system/theme/tenant-theme";
import { createTenantConfig } from "./base-template";

// ── Acme Growth Co. brand palette ─────────────────────────────────────────────
//
// Teal / emerald scale — "growth, momentum, trust".
// Values sourced from the Tailwind teal-500 family for reference;
// adjusted per the client's brand guide.

const teal = {
  50:  "#f0fdfa",
  100: "#ccfbf1",
  400: "#2dd4bf",
  500: "#14b8a6",  // primary
  600: "#0d9488",  // primary-hover
  700: "#0f766e",  // primary-active
} as const;

// ── Acme Growth Co. theme ──────────────────────────────────────────────────────

/**
 * Acme Growth Co. brand theme.
 *
 * Teal primary, zinc neutrals, sharp radius — startup / growth aesthetic.
 */
const ACME_GROWTH_THEME: TenantTheme = {
  colors: {
    brand: {
      primary:        teal[500],      // #14b8a6 — teal
      primaryHover:   teal[600],      // #0d9488
      primaryActive:  teal[700],      // #0f766e
      primarySubtle:  teal[50],       // #f0fdfa — very light teal tint
      primaryText:    neutral[0],     // #ffffff — white text on teal bg
      ring:           teal[500],      // #14b8a6 — focus ring matches primary
      textBrand:      teal[600],      // #0d9488 — slightly darker for inline text
    },
    text: {
      text:        neutral[900],    // #0f172a — near-black body copy
      textMuted:   neutral[500],    // #64748b — secondary labels
      textSubtle:  neutral[400],    // #94a3b8 — placeholder / disabled
      textInverse: neutral[0],      // #ffffff — on dark backgrounds
    },
    background: {
      bg:        neutral[50],     // #f8fafc — off-white page
      bgSubtle:  neutral[100],    // #f1f5f9 — recessed sections
      bgInverse: neutral[900],    // #0f172a — dark footer / hero sections
    },
    border: {
      border:       neutral[200],   // #e2e8f0
      borderStrong: neutral[300],   // #cbd5e1
    },
  },

  // "sharp" — crisp SaaS aesthetic requested by the client
  radius: "sharp",

  meta: {
    name:    "Acme Growth Co.",
    tagline: "Growth-driven marketing, simplified.",
    // faviconPath: "/acme-favicon.ico",  ← uncomment once client supplies asset
  },
};

// ── Acme Growth Co. tenant config ─────────────────────────────────────────────

/**
 * Acme Growth Co. tenant configuration.
 *
 * Built with createTenantConfig() — only the fields that differ from
 * TENANT_DEFAULTS need to be specified. Everything else inherits the
 * safe production defaults automatically.
 *
 * @example
 *   import { ACME_GROWTH_TENANT } from "@/tenant/templates/acme-growth-config";
 *   console.log(ACME_GROWTH_TENANT.tenantId); // "acme-growth"
 */
export const ACME_GROWTH_TENANT = createTenantConfig({
  // ── Identity ────────────────────────────────────────────────────────────────
  tenantId:          "acme-growth",
  name:              "Acme Growth Co.",
  canonicalHostname: "acmegrowth.com",

  // ── Theme ────────────────────────────────────────────────────────────────────
  theme: ACME_GROWTH_THEME,

  // ── CMS provider ─────────────────────────────────────────────────────────────
  //
  // Client uses Storyblok. Requires STORYBLOK_ACCESS_TOKEN in the deployment
  // environment. The region and version defaults (eu / published) are set
  // by serverEnv.storyblok — no extra env vars needed unless the client's
  // space is in a non-EU region.
  cmsProvider: "storyblok",

  // ── Decision provider ────────────────────────────────────────────────────────
  //
  // Rules engine is the safe default — zero AI cost, proven on day one.
  // Switch to "ai" once the client has reviewed and approved the confidence
  // policy and the AI provider is wired into their page.
  decisionProvider: "rules",

  // ── Variant subset ───────────────────────────────────────────────────────────
  //
  // Acme Growth Co. does not use the LinkedIn vision angle.
  // Their CMS team has populated only three hero variants, two proof variants,
  // and two CTA variants. Narrowing this list ensures the decision engine
  // never selects a key that has no CMS content behind it.
  variants: {
    hero:  ["hero_google_problem", "hero_direct_brand"],
    proof: ["proof_cases", "proof_platform"],
    cta:   ["cta_meeting", "cta_platform"],
  },

  // ── Feature flags ────────────────────────────────────────────────────────────
  features: {
    // diagnosticsBar defaults to false — leave it off in production
    contactForm:  true,    // Contact form active (default, but explicit for clarity)
    abTesting:    false,   // No experiments scheduled yet
  },

  // ── Contact / n8n ────────────────────────────────────────────────────────────
  //
  // Acme Growth Co. runs their own n8n instance with a dedicated workflow.
  // Their webhook URL overrides the platform-level N8N_CONTACT_WEBHOOK_URL.
  //
  // NOTE: Replace the placeholder with the real URL before going live.
  contact: {
    enabled:    true,
    webhookUrl: "https://n8n.acmegrowth.com/webhook/contact-intake",
  },
});
