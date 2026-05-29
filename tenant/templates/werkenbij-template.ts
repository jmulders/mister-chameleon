/**
 * Werkenbij Blueprint — Tenant Template
 *
 * Reference implementation for Employer Brand / Careers sites.
 *
 * ─── Client profile ───────────────────────────────────────────────────────────
 *
 *   Industry:  Any sector with recruitment marketing needs
 *   Goal:      Attract & convert talent — awareness → application
 *   Tone:      Warm, human, authentic — "this is a great place to work"
 *   Package:   Essential (adaptive homepage + context intelligence + follow-up)
 *
 * ─── Theme ────────────────────────────────────────────────────────────────────
 *
 *   Preset:    werkenbij-blueprint
 *   Primary:   Amber-orange (#f97316) — energetic, approachable, human
 *   Radius:    Soft — rounded corners match the warm, people-first tone
 *   Neutrals:  Warm stone (not cold slate) for a less corporate feel
 *
 * ─── Adaptive homepage slots ──────────────────────────────────────────────────
 *
 *   Hero   → hero_careers_*   (4 variants — awareness through high-intent)
 *   Proof  → proof_careers_*  (3 variants — culture, team spotlights, process)
 *   CTA    → cta_careers_*    (4 variants — browse, apply, open application, contact)
 *
 * ─── Site architecture ────────────────────────────────────────────────────────
 *
 *   /                       Adaptive homepage (hero + proof + cta)
 *   /vacatures              Vacancy listing    filterBar, listing, searchResults
 *   /vacatures/[slug]       Vacancy detail     vacancyMeta, articleBody, applyPanel, recruiterPanel
 *   /over-ons               About us           textSection, stats, about
 *   /cultuur                Culture            textMedia, featureGrid, testimonialSection
 *   /arbeidsvoorwaarden     Benefits           featureGrid, processSteps, quickLinks
 *   /blog                   Blog listing       newsList
 *   /blog/[slug]            Blog article       articleMeta, articleBody, relatedContent
 *   /contact                Contact            contactSection, formSection, mapBlock
 *
 * ─── Navigation ───────────────────────────────────────────────────────────────
 *
 *   Primary nav:
 *     Vacatures           → /vacatures
 *     Wie zijn wij?
 *       Over ons          → /over-ons
 *       Cultuur           → /cultuur
 *       Arbeidsvoorwaarden → /arbeidsvoorwaarden
 *     Blog                → /blog
 *     Contact             → /contact
 *
 *   CTA button:    "Bekijk vacatures"  → /vacatures
 *   Footer links:  Vacatures, Over ons, Cultuur, Arbeidsvoorwaarden, Blog, Contact
 *   Footer legal:  Privacy, Cookiebeleid, Algemene voorwaarden
 *
 * ─── CMS block map ────────────────────────────────────────────────────────────
 *
 *   /vacatures            filterBar       channel, function, location, employment-type filters
 *                         listing         vacancy cards with title, location, hours, apply CTA
 *                         searchResults   full-text search integration
 *
 *   /vacatures/[slug]     vacancyMeta     job title, location, team, hours, posted date
 *                         articleBody     rich-text job description (requirements, offer)
 *                         applyPanel      sticky apply form (or link to ATS)
 *                         recruiterPanel  recruiter photo, name, contact + social links
 *
 *   /over-ons             textSection     mission statement + key facts
 *                         stats           employee count, locations, tenure, rating
 *                         about           leadership, history, milestones
 *
 *   /cultuur              textMedia       intro with culture photography (surface: default)
 *                         featureGrid     6–8 culture pillars with icons
 *                         testimonialSection  employee quotes carousel
 *
 *   /arbeidsvoorwaarden   featureGrid     benefits grid (salary, flex, development, etc.)
 *                         processSteps    application process (apply → intake → offer)
 *                         quickLinks      deep-links to vacatures, open application, FAQ
 *
 *   /blog                 newsList        article cards with category, date, thumbnail
 *
 *   /blog/[slug]          articleMeta     title, author, publish date, reading time
 *                         articleBody     rich-text content with embedded media
 *                         relatedContent  3 related articles / vacatures
 *
 *   /contact              contactSection  office address, phone, recruiter intro
 *                         formSection     contact form → n8n webhook
 *                         mapBlock        office location map
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
// BRAND THEME — Warm amber-orange, soft radius
// ─────────────────────────────────────────────────────────────────────────────
//
// Amber-orange reads as energetic but human — distinct from the cold blue
// of most corporate sites. Soft radius reinforces the people-first tone.
// Warm stone neutrals (not slate) avoid the tech-company aesthetic.

const brand = {
  50:  "#fff7ed",  // warm white tint for callout backgrounds
  100: "#fef3e8",  // very light amber for subtle section backgrounds
  400: "#fb923c",  // lighter orange for hover indicators
  500: "#f97316",  // PRIMARY — main CTA, button backgrounds, links
  600: "#ea580c",  // hover state — slightly deeper orange
  700: "#c2410c",  // active/pressed state — deep burnt orange
} as const;

/**
 * Werkenbij Blueprint brand theme.
 *
 * Amber-orange primary, warm stone neutrals, soft radius.
 * Suitable for any careers / employer brand site.
 *
 * ← REPLACE: Update hex values for the client's brand palette.
 */
const WERKENBIJ_THEME: TenantTheme = {
  colors: {
    brand: {
      primary:       brand[500],   // #f97316 — energetic orange CTA
      primaryHover:  brand[600],   // #ea580c — hover deepens slightly
      primaryActive: brand[700],   // #c2410c — pressed/active
      primarySubtle: brand[50],    // #fff7ed — warm callout background
      primaryText:   neutral[0],   // #ffffff — white text on orange
      ring:          brand[500],   // #f97316 — focus ring
      textBrand:     brand[600],   // #ea580c — inline brand text
    },
    text: {
      text:        "#1c1412",     // warm near-black (slightly reddish) body copy
      textMuted:   "#78716c",     // stone-500 — secondary labels
      textSubtle:  "#a8a29e",     // stone-400 — placeholders, disabled
      textInverse: neutral[0],    // #ffffff — text on dark backgrounds
    },
    background: {
      bg:        "#fffaf7",       // warm off-white page background
      bgSubtle:  brand[100],      // #fef3e8 — recessed sections, card backs
      bgInverse: "#1c1412",       // warm dark for footer / hero inversions
    },
    border: {
      border:       "#e7e5e4",    // stone-200 — standard dividers
      borderStrong: "#d6d3d1",    // stone-300 — prominent borders
    },
  },

  radius: "soft",   // rounded — friendly, approachable, people-first

  meta: {
    name:    "Werkenbij Blueprint",         // ← REPLACE: "Werken bij [Client]"
    tagline: "Employer brand, warm & human",// ← REPLACE: client's employer value prop
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// IMPLEMENTATION TEMPLATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Werkenbij blueprint implementation template.
 *
 * Pre-configured for a careers / employer brand site:
 *   • Essential package
 *   • Storyblok CMS (visual editing suits the non-technical HR team)
 *   • Rules decisioning (visitor intent signals: job search, channel, career stage)
 *   • GA4 analytics
 *   • All three adaptive blocks active (hero + proof + cta)
 *   • Careers-specific variant keys throughout
 *   • Contact form active (open application / recruiter contact)
 *
 * Copy and customise per client — see file header for step-by-step guide.
 */
export const WERKENBIJ_IMPLEMENTATION: ImplementationTemplate =
  createImplementationTemplate({

    // ── Identity ───────────────────────────────────────────────────────────────

    tenantId:          "werkenbij-client",    // ← REPLACE: "werkenbij-<client-slug>"
    name:              "Werkenbij Blueprint", // ← REPLACE: "Werken bij [Client Name]"
    canonicalHostname: "werkenbij.example.com", // ← REPLACE: "werkenbij.example.com"
    packageId:         "essential",
    createdAt:         "2026-01-01T00:00:00.000Z", // ← REPLACE: actual creation date

    additionalHostnames: [
      "www.werkenbij.example.com",    // ← REPLACE: www. subdomain
      "werkenbij-client.vercel.app",  // ← REPLACE: Vercel preview URL (or remove)
    ],

    // ── Theme ──────────────────────────────────────────────────────────────────

    theme: WERKENBIJ_THEME,

    // ── CMS ───────────────────────────────────────────────────────────────────
    //
    // Storyblok — visual editor is the right choice for HR/recruitment teams
    // who are not technical. The component-based approach maps well to the
    // page structure (hero, vacancy card, benefits grid, etc.).
    //
    cmsProvider: "storyblok",
    cmsNotes:    "Storyblok space ID: XXXXX. EU region. Credentials in 1Password → Clients → [Client].",

    // ── Decision provider ─────────────────────────────────────────────────────
    //
    // Rules decisioning is ideal for careers sites — visitor intent maps
    // cleanly to channel signals (LinkedIn vs. Google vs. direct) and
    // session depth (first visit vs. returning, browsed vacatures vs. not).
    // No AI cost on day one; upgrade to "ai" when variant corpus grows.
    //
    decisionProvider: "rules",

    // ── Modules ───────────────────────────────────────────────────────────────

    enabledModules: [
      "adaptive-website",       // adaptive homepage: hero + proof + cta pipeline
      "context-intelligence",   // visitor history + session signals for decisioning
      "adaptive-follow-up",     // n8n post-submission journey (application confirmation)
    ],

    // ── Pages ─────────────────────────────────────────────────────────────────
    //
    // The adaptive pipeline runs on the homepage only.
    // All other pages (/vacatures, /cultuur, etc.) are standard CMS slug pages
    // rendered by app/[slug]/page.tsx — no adaptive pipeline, no variant keys.
    //
    pages: {
      homepage: true,
    },

    // ── Blocks ────────────────────────────────────────────────────────────────
    //
    // All three adaptive blocks active on the homepage:
    //   hero  — headline + subheadline tailored to visitor intent / channel
    //   proof — social proof angle tailored to intent (culture / team / process)
    //   cta   — primary call-to-action tailored to funnel stage
    //
    blocks: {
      hero:  true,
      proof: true,
      cta:   true,
    },

    // ── Variant keys ──────────────────────────────────────────────────────────
    //
    // Careers-specific variants — designed for talent acquisition funnels.
    //
    // Hero  (awareness → high-intent path):
    //   hero_careers_default      — first visit / unknown: brand intro, culture
    //   hero_careers_job_match    — job explorer / LinkedIn: role-led messaging
    //   hero_careers_high_intent  — returning / job page visited: urgency + direct apply
    //   hero_careers_reassurance  — drop-off recovery: remove friction, build trust
    //
    // Proof (channel-matched social proof):
    //   proof_careers_default     — general employer credibility (culture, values)
    //   proof_careers_team        — team spotlights for department-specific visitors
    //   proof_careers_reassurance — transparent process (removes application anxiety)
    //
    // CTA (funnel-stage matched):
    //   cta_careers_browse        — awareness: "Bekijk vacatures" (low friction)
    //   cta_careers_apply         — job interest / high-intent: "Solliciteer nu"
    //   cta_careers_open          — drop-off / no match: "Stuur open sollicitatie"
    //   cta_careers_contact       — post-submission: "Stel een vraag aan een recruiter"
    //
    // ← NARROW: start with 2 hero + 1 proof + 1 cta; expand as CMS team adds content.
    //
    variants: {
      hero:  [
        "hero_careers_default",
        "hero_careers_job_match",
        "hero_careers_high_intent",
        "hero_careers_reassurance",
      ],
      proof: [
        "proof_careers_default",
        "proof_careers_team",
        "proof_careers_reassurance",
      ],
      cta:   [
        "cta_careers_browse",
        "cta_careers_apply",
        "cta_careers_open",
        "cta_careers_contact",
      ],
    },

    // ── Contact form ──────────────────────────────────────────────────────────
    //
    // Used for both the contact page form and open applications.
    // Leave webhookUrl undefined to use the shared MC n8n instance.
    // Set per-client webhook when the client has their own n8n workflow.
    //
    contact: {
      enabled: true,
      // webhookUrl: "https://n8n.example.com/webhook/careers-intake",
    },

    // ── Analytics ─────────────────────────────────────────────────────────────

    analytics: {
      provider:                "ga4",
      measurementId:           "G-XXXXXXXXXX", // ← REPLACE: client's GA4 Measurement ID
      dashboardEnabled:        false,           // enable after first full variant cycle
      trackPageViews:          true,
      trackVariantServed:      true,            // enables per-variant segmentation
      trackContactSubmissions: true,            // tracks lead form / application starts
    },

    // ── Feature flags ─────────────────────────────────────────────────────────

    features: {
      diagnosticsBar:     false, // NEVER true in production
      contactForm:        true,  // contact + open application forms active
      abTesting:          false, // set true when running an experiment
      aiDecisionProvider: false, // set true when decisionProvider switches to "ai"
    },
  });

// ─────────────────────────────────────────────────────────────────────────────
// TENANT CONFIG — register in resolve-tenant.ts
// ─────────────────────────────────────────────────────────────────────────────
//
//   import { WERKENBIJ_TENANT } from "./templates/werkenbij-template";
//
//   const TENANT_REGISTRY: Record<string, TenantConfig> = {
//     "werkenbij.example.com":     WERKENBIJ_TENANT,
//     "www.werkenbij.example.com": WERKENBIJ_TENANT,
//   };
//
// ← REPLACE the export name to match the client, e.g. ACME_WERKENBIJ_TENANT

/**
 * Werkenbij blueprint TenantConfig.
 * Rename this export when using as a real client config (e.g. ACME_WERKENBIJ_TENANT).
 */
export const WERKENBIJ_TENANT = createTenantConfig(
  toTenantConfigInput(WERKENBIJ_IMPLEMENTATION)
);
