/**
 * Mister Chameleon — Site Implementation Template
 *
 * The authoritative snapshot of the live misterchameleon.com deployment,
 * expressed as an ImplementationTemplate. This file serves three purposes:
 *
 *   1. Documentation  — one place to see every decision that was made when
 *                        the platform was configured for its own site.
 *
 *   2. Reference       — copy this file as a starting point for new tenants
 *                        that should match the MC site's setup (full feature
 *                        set, Sanity CMS, rules-based decisioning, Stripe
 *                        billing, contact form, analytics).
 *
 *   3. Re-deployment   — all env vars are enumerated here; running
 *                        getRequiredEnvVars(MISTER_CHAMELEON_IMPLEMENTATION)
 *                        returns the complete checklist for a fresh deploy.
 *
 * ─── Status ──────────────────────────────────────────────────────────────────
 *
 *   status: "live" — this is the running production deployment.
 *
 * ─── CMS provider ────────────────────────────────────────────────────────────
 *
 *   Primary:   Sanity (SANITY_PROJECT_ID must be set)
 *   Fallback:  Storyblok (STORYBLOK_ACCESS_TOKEN — if Sanity is absent)
 *   Dev/test:  mock (when neither CMS token is present)
 *
 *   The active provider is resolved at runtime in mister-chameleon-config.ts.
 *   Switching between Sanity and Storyblok is safe — no data is lost on either
 *   side, the unused provider simply becomes inactive.
 *
 * ─── Seed content ────────────────────────────────────────────────────────────
 *
 *   All marketing site pages and adaptive variants live in:
 *     cms/seed/marketing-site-pages.ts    — 16 EN + 16 NL locale pages
 *     cms/seed/marketing-site-variants.ts — hero / proof / cta / notification
 *                                           variant documents
 *
 *   Re-seed a Sanity dataset with:
 *     npx sanity dataset import <export.tar.gz> production --replace
 *   or run the platform's admin seed action from /admin/platform/cms.
 *
 * ─── File map ─────────────────────────────────────────────────────────────────
 *
 *   tenant/mister-chameleon-config.ts          ← runtime TenantConfig (env-driven)
 *   tenant/theme.ts                            ← MISTER_CHAMELEON_THEME
 *   tenant/templates/mister-chameleon-site-template.ts  ← YOU ARE HERE
 *   cms/seed/marketing-site-pages.ts           ← page content seed
 *   onboarding/implementation-template.ts      ← types + factory helpers
 */

import { createImplementationTemplate, toTenantConfigInput } from "@/onboarding/implementation-template";
import { createTenantConfig } from "./base-template";
import { MISTER_CHAMELEON_THEME } from "@/tenant/theme";

// ─────────────────────────────────────────────────────────────────────────────
// IMPLEMENTATION TEMPLATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The complete implementation specification for the live misterchameleon.com
 * deployment.
 *
 * Every field reflects a real production decision. Consult this object (and
 * the env var list below) when setting up a fresh deployment or a staging
 * environment.
 *
 * @example
 *   import { getRequiredEnvVars } from "@/onboarding/implementation-template";
 *   const vars = getRequiredEnvVars(MISTER_CHAMELEON_IMPLEMENTATION);
 *   vars.forEach(v => console.log(`[${v.required ? "required" : "optional"}] ${v.key}`));
 */
export const MISTER_CHAMELEON_IMPLEMENTATION = createImplementationTemplate({

  // ── Template metadata ──────────────────────────────────────────────────────

  id:        "mister-chameleon",
  status:    "live",
  packageId: "scale",              // Full-platform deployment — all modules active
  createdAt: "2024-01-01T00:00:00.000Z",

  // ── Identity ───────────────────────────────────────────────────────────────

  tenantId:          "mister-chameleon",
  name:              "Mister Chameleon",
  canonicalHostname: "misterchameleon.com",

  additionalHostnames: [
    "www.misterchameleon.com",
    // "staging.misterchameleon.com",  // ← uncomment if a staging CNAME is in use
  ],

  // ── Brand theme ────────────────────────────────────────────────────────────
  //
  // Indigo-violet palette (#6366f1 primary), "balanced" radius, slate neutrals.
  // Full definition lives in tenant/theme.ts — edit there to update the entire site.
  // Components consume values via CSS custom properties; no component code needs
  // to change when the theme changes.
  //
  // Quick reference:
  //   brand.primary       #6366f1  (indigo-500)
  //   brand.primaryHover  #4f46e5  (indigo-600)
  //   brand.primaryActive #4338ca  (indigo-700)
  //   neutral base        slate
  //   radius personality  balanced  (buttons: 8px · cards: 16px · popovers: 12px)

  theme: MISTER_CHAMELEON_THEME,

  // ── CMS provider ──────────────────────────────────────────────────────────
  //
  // Production: "sanity"
  //   - Set SANITY_PROJECT_ID + SANITY_API_TOKEN + SANITY_DATASET + SANITY_API_VERSION
  //   - Sanity Studio lives at /studio (served by Next.js embedded studio)
  //
  // Fallback: "storyblok" — activated when STORYBLOK_ACCESS_TOKEN is set and
  //   SANITY_PROJECT_ID is absent. Useful for agencies with an existing Storyblok
  //   space that want to run the MC site template.
  //
  // Dev / preview: "mock" — no credentials required; content is served from
  //   the mock provider in cms/providers/mock-provider.ts.

  cmsProvider:  "sanity",
  cmsNotes:     "Sanity project credentials in 1Password → Mister Chameleon → Sanity. EU region. Dataset: production.",
  decisionProvider: "rules",

  // ── Enabled modules ────────────────────────────────────────────────────────
  //
  // Full scale-package module set:
  //   adaptive-website       — core adaptive page pipeline (always required)
  //   context-intelligence   — visitor history + company enrichment signals
  //   adaptive-follow-up     — n8n post-submission journey automation
  //   adaptive-landing-pages — campaign-specific adaptive landing pages (scale)

  enabledModules: [
    "adaptive-website",
    "context-intelligence",
    "adaptive-follow-up",
    "adaptive-landing-pages",
  ],

  // ── Page types ─────────────────────────────────────────────────────────────

  pages: {
    homepage: true,
  },

  // ── Block configuration ────────────────────────────────────────────────────
  //
  // All three adaptive blocks are active on the homepage:
  //   hero     — headline, subheadline, primary CTA button
  //   proof    — social proof section (case studies or platform credibility)
  //   cta      — bottom-of-page conversion block

  blocks: {
    hero:  true,
    proof: true,
    cta:   true,
  },

  // ── Variant keys ───────────────────────────────────────────────────────────
  //
  // The decisioning engine only serves variant keys listed here.
  // Keys match the literal unions in decision/types.ts.
  // Seed documents for all variants are in cms/seed/marketing-site-variants.ts.
  //
  // Hero variants — audience-matched headlines:
  //   hero_google_problem   — traffic from paid search / problem-aware segment
  //   hero_direct_brand     — direct / branded traffic / already-aware segment
  //   hero_linkedin_vision  — LinkedIn referral / vision-led message
  //
  // Proof variants — social proof tone:
  //   proof_cases           — case study evidence (ROI-driven, results-first)
  //   proof_platform        — platform credibility (tech depth, architecture)
  //
  // CTA variants — conversion offer:
  //   cta_meeting           — primary CTA: book a demo / discovery call
  //   cta_platform          — secondary CTA: try the platform / see live demo
  //   cta_guide             — lead magnet CTA: download personalisation guide

  variants: {
    hero: [
      "hero_google_problem",
      "hero_direct_brand",
      "hero_linkedin_vision",
    ],
    proof: [
      "proof_cases",
      "proof_platform",
    ],
    cta: [
      "cta_meeting",
      "cta_platform",
      "cta_guide",
    ],
  },

  // ── Contact form ───────────────────────────────────────────────────────────
  //
  // The contact form (at /contact) routes submissions through n8n.
  // N8N_CONTACT_WEBHOOK_URL must be set in the deployment environment.
  // No per-tenant webhookUrl override — the platform-level webhook handles MC.

  contact: {
    enabled:    true,
    // webhookUrl: undefined — uses N8N_CONTACT_WEBHOOK_URL env var
  },

  // ── Analytics ──────────────────────────────────────────────────────────────
  //
  // PostHog is used for both product analytics and the admin analytics dashboard.
  // All three event types are tracked from day one.
  //
  // Env vars:
  //   NEXT_PUBLIC_POSTHOG_KEY   — PostHog project API key (client-side)
  //   NEXT_PUBLIC_POSTHOG_HOST  — PostHog EU cloud: https://eu.posthog.com
  //                               Defaults to https://app.posthog.com if absent.

  analytics: {
    provider:                "posthog",
    dashboardEnabled:        true,
    trackPageViews:          true,
    trackVariantServed:      true,
    trackContactSubmissions: true,
  },

  // ── Feature flags ──────────────────────────────────────────────────────────
  //
  // Production values for all flags:
  //
  //   diagnosticsBar     — false in production.
  //                        Enable temporarily via NEXT_PUBLIC_DEBUG_DIAGNOSTICS=true
  //                        for staging verification without a code deploy.
  //
  //   contactForm        — true. Disabling hides the /contact route and removes
  //                        the contact CTA from navigation.
  //
  //   abTesting          — true. MC runs experiments continuously; disable when
  //                        no active experiment is configured in Supabase.
  //
  //   aiDecisionProvider — false. Rules-based decisioning is used in production.
  //                        Set to true only after confidence policy review and
  //                        when decisionProvider is switched to "ai".

  features: {
    diagnosticsBar:     false,
    contactForm:        true,
    abTesting:          true,
    aiDecisionProvider: false,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// DERIVED TENANT CONFIG
// ─────────────────────────────────────────────────────────────────────────────
//
// The runtime TenantConfig is derived from the implementation template above
// via toTenantConfigInput() + createTenantConfig().
//
// NOTE: mister-chameleon-config.ts is the canonical runtime config file.
// It reads process.env directly to allow env-driven CMS provider selection
// (Sanity → Storyblok → mock priority). The export here is provided for
// tooling convenience (e.g. getImplementationChecklist, getRequiredEnvVars)
// and is NOT registered in resolve-tenant.ts — mister-chameleon-config.ts is.
//
// Consuming code should import from "@/tenant" (the barrel), not from here.

export const MISTER_CHAMELEON_TENANT_FROM_TEMPLATE = createTenantConfig(
  toTenantConfigInput(MISTER_CHAMELEON_IMPLEMENTATION)
);

// ─────────────────────────────────────────────────────────────────────────────
// ENVIRONMENT VARIABLES — COMPLETE REFERENCE
// ─────────────────────────────────────────────────────────────────────────────
//
// Every env var the platform reads for the MC deployment, grouped by concern.
// Mark as [required] in deployment secrets / Vercel env; [optional] degrade
// gracefully.
//
// ── Core / infrastructure ────────────────────────────────────────────────────
//
//   [required] NEXT_PUBLIC_SITE_URL
//     Canonical site URL including protocol, no trailing slash.
//     e.g. https://misterchameleon.com
//     Used for: absolute URL generation, OpenGraph, sitemaps.
//
//   [required] NEXT_PUBLIC_SUPABASE_URL
//     Supabase project REST + Auth URL.
//     e.g. https://xxxxxxxxxxxx.supabase.co
//
//   [required] NEXT_PUBLIC_SUPABASE_ANON_KEY
//     Supabase anonymous (public) key — safe in client bundle.
//
//   [required] SUPABASE_SERVICE_ROLE_KEY
//     Supabase service role key — server-only. Never expose client-side.
//     Used for: server actions, cron jobs, admin routes.
//
// ── CMS — Sanity (primary provider) ──────────────────────────────────────────
//
//   [required] SANITY_PROJECT_ID
//     Sanity.io project ID.  e.g. abc12345
//     Setting this activates the Sanity provider at runtime.
//
//   [required] SANITY_API_TOKEN
//     Sanity API token with at minimum Viewer access.
//     Used by server-side content fetches and the Admin CMS panel.
//
//   [required] SANITY_DATASET
//     Active Sanity dataset name.  e.g. production
//
//   [required] SANITY_API_VERSION
//     Sanity GROQ API version date string.  e.g. 2024-01-01
//
// ── CMS — Storyblok (fallback provider) ──────────────────────────────────────
//
//   [optional] STORYBLOK_ACCESS_TOKEN
//     Storyblok Content Delivery API token.
//     Set this (and unset SANITY_PROJECT_ID) to activate the Storyblok provider.
//     Found in: Storyblok → Settings → Access Tokens → Public token.
//
//   [optional] STORYBLOK_REGION
//     Storyblok API region: "eu" | "us" | "cn" | "ap" | "ca".
//     Defaults to "eu" if absent.
//
// ── Billing — Stripe ──────────────────────────────────────────────────────────
//
//   [required] STRIPE_SECRET_KEY
//     Stripe secret API key.  Format: sk_live_... / sk_test_...
//
//   [required] STRIPE_WEBHOOK_SECRET
//     Stripe webhook signing secret for /api/billing/webhook.
//     Format: whsec_...
//
//   [required] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
//     Stripe publishable key — exposed to the client for Stripe.js.
//     Format: pk_live_... / pk_test_...
//
//   ── Subscription plan price IDs ──────────────────────────────────────────
//
//   [required] STRIPE_PRICE_STARTER_MONTHLY   Starter plan, monthly billing
//   [required] STRIPE_PRICE_STARTER_ANNUAL    Starter plan, annual billing
//   [required] STRIPE_PRICE_GROWTH_MONTHLY    Growth plan, monthly billing
//   [required] STRIPE_PRICE_GROWTH_ANNUAL     Growth plan, annual billing
//   [required] STRIPE_PRICE_PRO_MONTHLY       Pro plan, monthly billing
//   [required] STRIPE_PRICE_PRO_ANNUAL        Pro plan, annual billing
//
//   ── Credit bundle price IDs ──────────────────────────────────────────────
//
//   [optional] STRIPE_PRICE_CREDITS_250       250-credit one-time bundle
//   [optional] STRIPE_PRICE_CREDITS_1000      1 000-credit one-time bundle
//   [optional] STRIPE_PRICE_CREDITS_5000      5 000-credit one-time bundle
//
//   ── Session top-up price IDs ─────────────────────────────────────────────
//
//   [optional] STRIPE_PRICE_SESSIONS_10K      10k additional sessions
//   [optional] STRIPE_PRICE_SESSIONS_50K      50k additional sessions
//   [optional] STRIPE_PRICE_SESSIONS_200K     200k additional sessions
//
// ── Email ─────────────────────────────────────────────────────────────────────
//
//   [required] RESEND_API_KEY
//     Resend API key for transactional email.  Format: re_...
//     When absent, email sending is silently skipped (safe for local dev).
//
//   [required] MAIL_FROM_ADDRESS
//     "From" address for all outbound email.  e.g. hello@misterchameleon.com
//
//   [required] BACKOFFICE_EMAIL
//     Default recipient for platform notifications (new signups, alerts).
//     e.g. team@misterchameleon.com
//
// ── Contact form / automation ─────────────────────────────────────────────────
//
//   [required] N8N_CONTACT_WEBHOOK_URL
//     n8n webhook endpoint that receives contact form submissions.
//     e.g. https://n8n.misterchameleon.com/webhook/contact-intake
//
// ── Analytics — PostHog ───────────────────────────────────────────────────────
//
//   [required] NEXT_PUBLIC_POSTHOG_KEY
//     PostHog project API key.  Format: phc_XXXXXXXXXXXX
//
//   [optional] NEXT_PUBLIC_POSTHOG_HOST
//     PostHog host URL.  Defaults to https://app.posthog.com.
//     Set to https://eu.posthog.com for EU-region hosting.
//
// ── Admin / diagnostics ───────────────────────────────────────────────────────
//
//   [optional] NEXT_PUBLIC_DEBUG_DIAGNOSTICS
//     Set to "true" to enable the diagnostics bar in non-development environments.
//     Useful for staging verification without a code change.
//     Never set in production.
//
// ─────────────────────────────────────────────────────────────────────────────
// SEED CONTENT REFERENCES
// ─────────────────────────────────────────────────────────────────────────────
//
// The complete site content is seeded from two files:
//
//   cms/seed/marketing-site-pages.ts
//     • 16 English locale pages (home, about, pricing, contact, how-it-works,
//       why-personalisation, the-engine, manifesto, roadmap, features,
//       features-segments, features-intent, features-enrichment,
//       features-testing, features-analytics, features-agency)
//     • 16 Dutch (nl) locale equivalents of the above
//     • Export: allMarketingPages — combined array of all page documents
//
//   cms/seed/marketing-site-variants.ts
//     • Hero variants:    hero_google_problem, hero_direct_brand, hero_linkedin_vision
//     • Proof variants:   proof_cases, proof_platform
//     • CTA variants:     cta_meeting, cta_platform, cta_guide
//     • Notification variants: announcement_new_feature, announcement_webinar, etc.
//     • Export: marketingSiteVariants — combined array of all variant documents
//
// To re-seed from the admin panel:
//   /admin/platform/cms → "Seed marketing site" button
//
// To re-seed from CLI (Sanity):
//   npx sanity dataset export production export.tar.gz  # backup first
//   npx ts-node scripts/seed-sanity.ts                  # re-run seed
//
// ─────────────────────────────────────────────────────────────────────────────
