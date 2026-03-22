/**
 * Example Client Tenant Configuration — Acme Growth Co.
 *
 * ─── Purpose ──────────────────────────────────────────────────────────────────
 *
 *   This file is the reference template for onboarding a second client tenant.
 *   It demonstrates every layer of TenantConfig that a real client engagement
 *   requires: identity, CMS provider, decision provider, feature flags, variant
 *   scope, block layout, contact routing, and brand theme.
 *
 *   It maps directly to the validation document at:
 *   docs/first-client-template-validation.md
 *
 * ─── Client snapshot ──────────────────────────────────────────────────────────
 *
 *   Client:           Acme Growth Co.
 *   Package:          Essential
 *   CMS:              Storyblok (mapped schema — REST API)
 *   Decision:         Rules-based (AI not yet activated)
 *   Homepage:         Adaptive (3-block layout)
 *   Landing pages:    Not in scope for this engagement
 *   Variant scope:    Narrowed — 2 hero, 2 proof, 2 CTA (see ACME_VARIANT_CONFIG)
 *   Contact routing:  Tenant-specific n8n webhook
 *   Theme:            Teal + warm neutral — "growth-focused B2B" feel
 *
 * ─── Status at time of writing ────────────────────────────────────────────────
 *
 *   Validation status:  AMBER — content partially ready, go-live pending
 *   Outstanding gap:    LinkedIn hero variant (hero_linkedin_vision) has no
 *                       Storyblok entry yet. Platform variant scope is narrowed
 *                       to exclude it until the client's content team delivers.
 *   A/B testing:        Off — will be enabled in a follow-up release once the
 *                       first monthly review confirms baseline performance.
 *
 * ─── To activate this tenant ──────────────────────────────────────────────────
 *
 *   1. Uncomment the import and registry entries in tenant/resolve-tenant.ts.
 *      (The commented placeholders labelled "Acme Growth Co." are ready.)
 *   2. Confirm STORYBLOK_ACCESS_TOKEN is set in the deployment environment.
 *   3. Update canonicalHostname to match the production domain.
 *   4. Run `npx tsc --noEmit` to confirm zero type errors.
 *   5. Deploy to staging. Validate the content checklist below.
 *   6. Promote to production once staging validation passes.
 *
 * ─── File map ─────────────────────────────────────────────────────────────────
 *
 *   tenant/example-client-config.ts  ← YOU ARE HERE
 *   tenant/resolve-tenant.ts         ← register hostnames here to activate
 *   docs/first-client-template-validation.md ← full validation record
 */

import { createTenantConfig }   from "./templates/base-template";
import type { TenantTheme }     from "@/design-system/theme/tenant-theme";
import { neutral }              from "@/design-system/theme/tenant-theme";
import type {
  TenantVariantConfig,
  TenantBlockConfig,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// THEME
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Acme Growth Co. brand theme.
 *
 * Palette: Teal primary (#0d9488), warm off-white background.
 *
 * Design rationale:
 *   Teal communicates trust and forward motion — right for a B2B company
 *   selling growth-focused services. Warm off-white backgrounds soften the
 *   corporate edge while keeping the site readable and professional.
 *   "Soft" radius preset signals approachability (rounded cards and buttons).
 *
 * Colour accessibility:
 *   #0d9488 on white: contrast ratio ~4.7:1 (AA pass for large text).
 *   White on #0d9488: contrast ratio ~4.7:1 (AA pass for normal text).
 *   Text on bg (#fafaf9): effectively black on off-white — well above AAA.
 */
export const ACME_GROWTH_THEME: TenantTheme = {
  colors: {
    // ── Brand / interactive ───────────────────────────────────────────────────
    brand: {
      primary:        "#0d9488",   // teal-600
      primaryHover:   "#0f766e",   // teal-700
      primaryActive:  "#115e59",   // teal-800
      primarySubtle:  "#f0fdfa",   // teal-50 — very light tint for hover surfaces
      primaryText:    "#ffffff",   // white text on teal backgrounds
      ring:           "#0d9488",   // teal-600 — matches primary
      textBrand:      "#0f766e",   // teal-700 — slightly darker for inline text contrast
    },

    // ── Text ─────────────────────────────────────────────────────────────────
    text: {
      text:        "#1c1917",   // stone-900 — warm near-black body text
      textMuted:   "#78716c",   // stone-500 — secondary descriptions
      textSubtle:  "#a8a29e",   // stone-400 — placeholders, disabled
      textInverse: "#ffffff",   // white — on dark backgrounds
    },

    // ── Surfaces ─────────────────────────────────────────────────────────────
    background: {
      bg:        "#fafaf9",   // stone-50 — warm off-white page bg
      bgSubtle:  "#f5f5f4",   // stone-100 — recessed cards and inputs
      bgInverse: "#1c1917",   // stone-900 — dark hero or footer sections
    },

    // ── Borders ──────────────────────────────────────────────────────────────
    border: {
      border:       "#e7e5e4",   // stone-200
      borderStrong: "#d6d3d1",   // stone-300
    },
  },

  // ── Radius personality ───────────────────────────────────────────────────────
  // "soft" — generous rounded corners; approachable, modern B2B feel.
  // Corresponds to: buttons/inputs 12px, cards 24px, popovers 16px.
  radius: "soft",

  // ── Brand metadata ───────────────────────────────────────────────────────────
  meta: {
    name:        "Acme Growth Co.",
    tagline:     "B2B growth, built on insight.",
    faviconPath: "/tenants/acme-growth/favicon.ico",
    logoPath:    "/tenants/acme-growth/logo.svg",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT SCOPE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Narrowed variant scope for Acme Growth Co.
 *
 * The default variant config assumes all nine variant keys have CMS content.
 * Acme Growth's Storyblok workspace currently has entries for 6 of 9 variants.
 * The LinkedIn hero variant (hero_linkedin_vision) has not been written yet.
 *
 * This narrow scope ensures the decision engine never selects a variant key
 * that has no CMS content — preventing fallback serving for LinkedIn traffic.
 *
 * ─── Gap logged ────────────────────────────────────────────────────────────────
 *
 *   Missing: hero_linkedin_vision
 *   Owner:   Acme Growth content team
 *   Status:  Content brief issued (2026-03-18). Target delivery: 2026-03-25.
 *   Action:  When delivered, add "hero_linkedin_vision" to hero[] below and
 *            raise a release note to expand the variant scope.
 */
export const ACME_VARIANT_CONFIG: TenantVariantConfig = {
  hero: [
    "hero_google_problem",  // ✓ CMS content ready in Storyblok
    "hero_direct_brand",    // ✓ CMS content ready in Storyblok
    // "hero_linkedin_vision" — PENDING: content brief issued, not yet delivered
  ],
  proof: [
    "proof_cases",     // ✓ Three case study excerpts populated
    "proof_platform",  // ✓ Platform stats populated
    // "proof_vision" — deliberately excluded: does not match Acme's proof strategy
  ],
  cta: [
    "cta_meeting",   // ✓ Primary CTA — booking a call
    "cta_guide",     // ✓ Secondary CTA — lead magnet download
    // "cta_platform" — deliberately excluded: no platform trial offering
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK CONFIG
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All three blocks active for Acme Growth.
 *
 * The full hero → proof → CTA layout is confirmed in the design brief.
 * No blocks suppressed.
 */
export const ACME_BLOCK_CONFIG: TenantBlockConfig = {
  hero:  true,
  proof: true,
  cta:   true,
};

// ─────────────────────────────────────────────────────────────────────────────
// TENANT CONFIG
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Complete tenant configuration for Acme Growth Co.
 *
 * Created via createTenantConfig() — defaults from TENANT_DEFAULTS are applied
 * for any field not explicitly overridden here. See base-template.ts for the
 * full default set.
 *
 * @example
 *   import { ACME_GROWTH_TENANT } from "@/tenant/example-client-config";
 *   const theme = ACME_GROWTH_TENANT.theme;
 *   const variants = ACME_GROWTH_TENANT.variants;
 */
export const ACME_GROWTH_TENANT = createTenantConfig({
  // ── Identity ──────────────────────────────────────────────────────────────
  tenantId:          "acme-growth",
  name:              "Acme Growth Co.",

  // ── Hostname ──────────────────────────────────────────────────────────────
  // Kept as a placeholder to indicate the domain is not yet live.
  // Replace with "acmegrowth.com" when the production domain is confirmed.
  canonicalHostname: "acmegrowth.com",

  // ── Providers ─────────────────────────────────────────────────────────────
  //
  // CMS: Storyblok — mapped schema (REST API, managed delivery token).
  //   STORYBLOK_ACCESS_TOKEN must be set in the deployment environment.
  //   The Storyblok adapter handles schema mapping between Storyblok's
  //   content types and the platform's HeroBlockData / ProofBlockData / CTABlockData.
  //
  // Decision: Rules-based. AI not activated in the Essential package.
  //   Rules config is in decision/rules/ — will be customised in the
  //   technical-setup onboarding step.
  cmsProvider:      "storyblok",
  decisionProvider: "rules",

  // ── Feature flags ─────────────────────────────────────────────────────────
  //
  // diagnosticsBar: off (production default — never expose to client traffic)
  // contactForm:    on  (contact form active, routes to Acme's n8n webhook below)
  // abTesting:      off (no active experiments at go-live; enable in follow-up release)
  // aiDecisionProvider: off (not in Essential package; future upgrade path)
  features: {
    diagnosticsBar:     false,
    contactForm:        true,
    abTesting:          false,
    aiDecisionProvider: false,
  },

  // ── Contact config ────────────────────────────────────────────────────────
  //
  // Acme Growth has their own n8n instance — contact form submissions route
  // to their webhook rather than the global MC webhook.
  // The webhookUrl is stored here (server-only) rather than in an env var to
  // support per-tenant overrides without separate deployment configs.
  //
  // IMPORTANT: Replace the placeholder URL with the client's actual webhook
  // before activating. Confirm with the client that the n8n workflow is live
  // and the test payload has been received.
  contact: {
    enabled:    true,
    webhookUrl: "https://n8n.acmegrowth.com/webhook/mc-contact",  // ← confirm before go-live
  },

  // ── Variant scope ─────────────────────────────────────────────────────────
  //
  // Narrowed from the default 9-variant set (3×3) to 6 variants (2×3 hero,
  // 2×3 proof, 2×3 CTA). The LinkedIn hero variant is pending content delivery.
  // See ACME_VARIANT_CONFIG above for full gap notes.
  variants: ACME_VARIANT_CONFIG,

  // ── Block layout ─────────────────────────────────────────────────────────
  blocks: ACME_BLOCK_CONFIG,

  // ── Page config ───────────────────────────────────────────────────────────
  //
  // Homepage adaptive pipeline active.
  // Landing pages not in scope for this engagement (Essential package).
  pages: {
    homepage: true,
  },

  // ── Theme ─────────────────────────────────────────────────────────────────
  theme: ACME_GROWTH_THEME,
});
