/**
 * B2B SaaS Blueprint — Tenant Template
 *
 * Reference implementation for B2B SaaS / Product-led Growth sites.
 *
 * ─── Client profile ───────────────────────────────────────────────────────────
 *
 *   Industry:  B2B software, SaaS platforms, developer tooling
 *   Goal:      Product-led conversion — awareness → trial / demo
 *   Tone:      Sharp, modern, product-confident — "the tool speaks for itself"
 *   Package:   Growth (adds adaptive landing pages for campaign traffic)
 *
 * ─── Theme ────────────────────────────────────────────────────────────────────
 *
 *   Preset:    saas-blueprint
 *   Primary:   Violet (#7c3aed) — modern, product-first, premium
 *   Radius:    Sharp — tight, clean edges match the SaaS product aesthetic
 *   Neutrals:  Cool zinc — neutral, versatile, pairs well with vivid accents
 *
 * ─── Adaptive homepage slots ──────────────────────────────────────────────────
 *
 *   Hero   → hero_saas_*   (5 variants — default through onboarding)
 *   Proof  → proof_saas_*  (4 variants — default, consideration, intent, reassurance)
 *   CTA    → cta_saas_*    (5 variants — default, demo, trial, onboarding, expansion)
 *
 * ─── Site architecture ────────────────────────────────────────────────────────
 *
 *   /                       Adaptive homepage (hero + proof + cta)
 *   /product                Product overview   featureGrid, textMedia, stats
 *   /pricing                Pricing page       pricingSection, faqSection, testimonialSection
 *   /cases                  Customer stories   listing, logoStrip
 *   /cases/[slug]           Case detail        articleMeta, articleBody, stats, relatedContent
 *   /integraties            Integrations       featureGrid, quickLinks
 *   /blog                   Blog listing       newsList
 *   /blog/[slug]            Blog article       articleMeta, articleBody, relatedContent
 *   /over-ons               About us           textMedia, teamSection, about
 *   /contact                Contact/support    contactSection, formSection
 *
 * ─── Navigation ───────────────────────────────────────────────────────────────
 *
 *   Primary nav (minimal, product-focused):
 *     Product               → /product
 *     Pricing               → /pricing
 *     Cases                 → /cases
 *     Integraties           → /integraties
 *     Blog                  → /blog
 *
 *   CTA buttons:
 *     "Probeer gratis"      → /signup  (primary — low friction)
 *     "Bekijk demo"         → /contact (secondary)
 *
 *   Footer cols:   Product, Pricing, Cases, Integraties, Blog, Over ons, Contact
 *   Footer legal:  Privacybeleid, Algemene voorwaarden, Status (uptime)
 *
 * ─── CMS block map ────────────────────────────────────────────────────────────
 *
 *   /product              featureGrid     3-column capability grid (icon, title, desc)
 *                         textMedia       alternating feature deep-dives (product shots)
 *                         stats           key platform metrics (users, uptime, data processed)
 *
 *   /pricing              pricingSection  tier cards (free / pro / enterprise)
 *                         faqSection      pricing FAQs (contracts, team seats, billing)
 *                         testimonialSection  quotes from paying customers
 *
 *   /cases                listing         case cards (company, logo, use case, outcome)
 *                         logoStrip       customer logo wall (trust signal)
 *
 *   /cases/[slug]         articleMeta     company, industry, team size, use case
 *                         articleBody     case narrative (challenge → solution → results)
 *                         stats           3–4 outcome metrics (time saved, growth, NPS)
 *                         relatedContent  2 related cases + product/integration links
 *
 *   /integraties          featureGrid     integration cards (logo, name, short desc, link)
 *                         quickLinks      category links (CRM, Analytics, Dev tools, etc.)
 *
 *   /blog                 newsList        article cards with category tag, date, thumbnail
 *
 *   /blog/[slug]          articleMeta     title, author, date, reading time, tags
 *                         articleBody     rich-text article with code blocks / screenshots
 *                         relatedContent  3 related articles or product pages
 *
 *   /over-ons             textMedia       founders story + office photo
 *                         teamSection     team cards (photo, name, role, area)
 *                         about           mission, investors, press mentions
 *
 *   /contact              contactSection  support email, Slack community link, office
 *                         formSection     contact / enterprise inquiry form → n8n
 *
 * ─── How to use this template ─────────────────────────────────────────────────
 *
 *   1. Copy this file to tenant/templates/<client-slug>-config.ts.
 *   2. Replace tenantId, name, canonicalHostname, and additionalHostnames.
 *   3. Update theme hex values to match the client's brand palette.
 *   4. Narrow variants[] to the keys the CMS team has actually written.
 *   5. Set analytics.measurementId to the client's GA4 property ID.
 *   6. Set contact.webhookUrl if client has their own n8n instance.
 *   7. Run getRequiredEnvVars() and set the listed env vars.
 *   8. Register all hostnames in resolve-tenant.ts.
 *
 * ─── Growth package note ──────────────────────────────────────────────────────
 *
 *   This template uses packageId: "growth" which unlocks:
 *     • adaptive-landing-pages — campaign URLs with their own adaptive pipeline
 *       (/lp/[campaign-slug] → fully personalised landing page per ad campaign)
 *
 *   The landing-page pipeline is configured separately via the campaign layer.
 *   No extra config in this file is required — enabledModules includes the module.
 */

import type { TenantTheme } from "@/design-system/theme/tenant-theme";
import { neutral } from "@/design-system/theme/tenant-theme";
import { createTenantConfig } from "./base-template";
import {
  createImplementationTemplate,
  toTenantConfigInput,
  type ImplementationTemplate,
} from "@/onboarding/implementation-template";

// ─────────────────────────────────────────────────────────────────────────────
// BRAND THEME — Violet, sharp radius, product-first
// ─────────────────────────────────────────────────────────────────────────────
//
// Violet reads as modern, technical, and premium without the cold distance
// of navy blue. Sharp radius matches the clean, precise product aesthetic.
// Zinc neutrals are more versatile than slate — handle both light and dark
// mode product screenshots cleanly.

const brand = {
  50:  "#f5f3ff",  // very light violet tint for callout backgrounds
  100: "#ede9fe",  // subtle tint for section backgrounds
  400: "#a78bfa",  // lighter violet for indicators
  500: "#7c3aed",  // PRIMARY — confident, modern violet
  600: "#6d28d9",  // hover — controlled darkening
  700: "#5b21b6",  // active/pressed — high contrast on dark
} as const;

/**
 * SaaS Blueprint brand theme.
 *
 * Violet primary, zinc neutrals, sharp radius.
 * Suitable for B2B SaaS products, developer tools, and product-led platforms.
 *
 * ← REPLACE: Update hex values for the client's brand palette.
 */
const SAAS_THEME: TenantTheme = {
  colors: {
    brand: {
      primary:       brand[500],   // #7c3aed — modern, product-confident violet
      primaryHover:  brand[600],   // #6d28d9 — controlled hover deepening
      primaryActive: brand[700],   // #5b21b6 — pressed/active
      primarySubtle: brand[50],    // #f5f3ff — very light tint for callouts
      primaryText:   neutral[0],   // #ffffff — white text on violet
      ring:          brand[500],   // #7c3aed — focus ring
      textBrand:     brand[500],   // #7c3aed — inline brand text (links, accents)
    },
    text: {
      text:        "#0f0a1e",     // very dark violet-black — sharp, distinct from pure black
      textMuted:   "#64748b",     // slate-500 — secondary labels, metadata
      textSubtle:  "#94a3b8",     // slate-400 — placeholders, disabled states
      textInverse: neutral[0],    // #ffffff — text on dark/violet backgrounds
    },
    background: {
      bg:        "#fafafa",       // near-white — slightly softer than pure white
      bgSubtle:  brand[50],       // #f5f3ff — very subtle violet tint for feature sections
      bgInverse: "#0d0a1a",       // very dark violet-black for dark sections
    },
    border: {
      border:       "#e4e4e7",    // zinc-200 — clean standard dividers
      borderStrong: "#d4d4d8",    // zinc-300 — prominent borders
    },
  },

  radius: "sharp",  // clean, precise — matches the product aesthetic

  meta: {
    name:    "SaaS Blueprint",           // ← REPLACE: product brand name
    tagline: "Product-led, sharp & modern", // ← REPLACE: product tagline
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// IMPLEMENTATION TEMPLATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * B2B SaaS blueprint implementation template.
 *
 * Pre-configured for a product-led B2B SaaS site:
 *   • Growth package (adds adaptive landing pages for campaign traffic)
 *   • Storyblok CMS (content team + developer collaboration)
 *   • Rules decisioning (visitor intent: channel, trial status, page depth)
 *   • GA4 analytics
 *   • All three adaptive blocks active (hero + proof + cta)
 *   • SaaS-specific variant keys throughout the buying journey
 *   • Contact form active (enterprise inquiry / demo request)
 *
 * Copy and customise per client — see file header for step-by-step guide.
 */
export const SAAS_IMPLEMENTATION: ImplementationTemplate =
  createImplementationTemplate({

    // ── Identity ───────────────────────────────────────────────────────────────

    tenantId:          "saas-client",         // ← REPLACE: "<product-slug>"
    name:              "SaaS Blueprint",      // ← REPLACE: product / company name
    canonicalHostname: "app.example.com",     // ← REPLACE: client's primary domain
    packageId:         "growth",              // growth unlocks adaptive landing pages
    createdAt:         "2026-01-01T00:00:00.000Z", // ← REPLACE: actual creation date

    additionalHostnames: [
      "www.example.com",       // ← REPLACE: www. root domain
      "saas-client.vercel.app", // ← REPLACE: Vercel preview URL (or remove)
      // "app.example.com",    // ← uncomment if the marketing site lives at root
    ],

    // ── Theme ──────────────────────────────────────────────────────────────────

    theme: SAAS_THEME,

    // ── CMS ───────────────────────────────────────────────────────────────────
    //
    // Storyblok — component-based editing works well for product marketing pages
    // (feature sections, pricing tiers, integration cards).
    //
    cmsProvider: "storyblok",
    cmsNotes:    "Storyblok space ID: XXXXX. EU region. Credentials in 1Password → Clients → [Product].",

    // ── Decision provider ─────────────────────────────────────────────────────
    //
    // Rules decisioning handles the SaaS buying funnel cleanly:
    //   • First visit via Google → educational default hero
    //   • Returning + /pricing visited → intent hero + trial CTA
    //   • Existing user (cookie) → onboarding / expansion hero
    //   • Post-conversion journey → onboarding CTA
    // Switch to "ai" when the product has enough variant options
    // and the team has reviewed the confidence policy.
    //
    decisionProvider: "rules",

    // ── Modules ───────────────────────────────────────────────────────────────
    //
    // Growth package modules:
    //   adaptive-landing-pages — campaign-specific landing pages (/lp/[slug])
    //   Each landing page runs its own adaptive pipeline with campaign-scoped
    //   variant keys and is configured via the campaign layer (separate from this file).
    //
    enabledModules: [
      "adaptive-website",       // adaptive homepage: hero + proof + cta pipeline
      "context-intelligence",   // visitor history + session signals for decisioning
      "adaptive-follow-up",     // n8n post-submission journey (trial welcome / demo confirm)
      "adaptive-landing-pages", // campaign landing pages (growth package)
    ],

    // ── Pages ─────────────────────────────────────────────────────────────────
    //
    // Adaptive pipeline on homepage only.
    // /lp/[slug] pages are handled by the adaptive-landing-pages module.
    // All other pages (/product, /pricing, etc.) are standard CMS slug pages.
    //
    pages: {
      homepage: true,
    },

    // ── Blocks ────────────────────────────────────────────────────────────────

    blocks: {
      hero:  true,   // product-value hero matched to trial/buying stage
      proof: true,   // social proof matched to evaluation stage
      cta:   true,   // conversion CTA matched to funnel position
    },

    // ── Variant keys ──────────────────────────────────────────────────────────
    //
    // SaaS-specific variants — designed for product-led growth funnels.
    //
    // Hero  (visitor stage in product journey):
    //   hero_saas_default             — first visit: general product value prop
    //   hero_saas_consideration       — returning, evaluating: comparison-friendly
    //   hero_saas_intent              — high-intent (pricing visited): direct conversion
    //   hero_saas_trial               — trial focus: low-friction "start free" message
    //   hero_saas_customer_onboarding — post-signup: next step in onboarding
    //
    // Proof (evaluation stage matched):
    //   proof_saas_default       — general credibility: platform value and explainability
    //   proof_saas_consideration — use cases / fit signals for active evaluators
    //   proof_saas_intent        — ROI / conversion impact proof for buyers
    //   proof_saas_reassurance   — safe fallback: no-lock-in, cancel-any-time
    //
    // CTA (funnel position matched):
    //   cta_saas_default    — "Ontdek hoe het werkt" — soft, educational CTA
    //   cta_saas_demo       — "Bekijk een demo" — mid-funnel visual buyers
    //   cta_saas_trial      — "Start gratis" — primary conversion on awareness visit
    //   cta_saas_onboarding — "Ga verder met je onboarding" — post-signup
    //   cta_saas_expansion  — "Bekijk uitbreidingsopties" — existing customer upsell
    //
    // ← NARROW: start with 2 hero + 2 proof + 2 cta; expand as content grows.
    //   Minimum recommended starter: hero_saas_default + hero_saas_trial,
    //   proof_saas_default + proof_saas_consideration, cta_saas_trial + cta_saas_demo.
    //
    variants: {
      hero:  [
        "hero_saas_default",
        "hero_saas_consideration",
        "hero_saas_intent",
        "hero_saas_trial",
        "hero_saas_customer_onboarding",
      ],
      proof: [
        "proof_saas_default",
        "proof_saas_consideration",
        "proof_saas_intent",
        "proof_saas_reassurance",
      ],
      cta: [
        "cta_saas_default",
        "cta_saas_demo",
        "cta_saas_trial",
        "cta_saas_onboarding",
        "cta_saas_expansion",
      ],
    },

    // ── Contact form ──────────────────────────────────────────────────────────
    //
    // Used for enterprise inquiries and demo requests.
    // Trial signups typically bypass this and go directly to the product.
    //
    contact: {
      enabled: true,
      // webhookUrl: "https://n8n.example.com/webhook/enterprise-intake",
    },

    // ── Analytics ─────────────────────────────────────────────────────────────

    analytics: {
      provider:                "ga4",
      measurementId:           "G-XXXXXXXXXX", // ← REPLACE: client's GA4 Measurement ID
      dashboardEnabled:        false,           // enable after first full variant cycle
      trackPageViews:          true,
      trackVariantServed:      true,            // essential for product-led A/B analysis
      trackContactSubmissions: true,            // tracks demo + enterprise form conversions
    },

    // ── Feature flags ─────────────────────────────────────────────────────────

    features: {
      diagnosticsBar:     false, // NEVER true in production
      contactForm:        true,  // enterprise inquiry + demo request forms active
      abTesting:          false, // set true when running a structured experiment
      aiDecisionProvider: false, // set true when decisionProvider switches to "ai"
    },
  });

// ─────────────────────────────────────────────────────────────────────────────
// TENANT CONFIG — register in resolve-tenant.ts
// ─────────────────────────────────────────────────────────────────────────────
//
//   import { SAAS_TENANT } from "./templates/saas-template";
//
//   const TENANT_REGISTRY: Record<string, TenantConfig> = {
//     "example.com":         SAAS_TENANT,
//     "www.example.com":     SAAS_TENANT,
//     "app.example.com":     SAAS_TENANT,
//   };
//
// ← REPLACE the export name to match the product (e.g. MYPRODUCT_TENANT)

/**
 * SaaS blueprint TenantConfig.
 * Rename this export when using as a real client config (e.g. MYAPP_TENANT).
 */
export const SAAS_TENANT = createTenantConfig(
  toTenantConfigInput(SAAS_IMPLEMENTATION)
);
