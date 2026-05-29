/**
 * Corporate B2B Blueprint — Tenant Template
 *
 * Reference implementation for Corporate / Professional Services / B2B sites.
 *
 * ─── Client profile ───────────────────────────────────────────────────────────
 *
 *   Industry:  Professional services, consultancy, B2B enterprise
 *   Goal:      Generate qualified leads — awareness → demo/meeting
 *   Tone:      Authoritative, trustworthy, professional — "we know our domain"
 *   Package:   Essential (adaptive homepage + context intelligence + follow-up)
 *
 * ─── Theme ────────────────────────────────────────────────────────────────────
 *
 *   Preset:    corporate-b2b-blueprint
 *   Primary:   Corporate blue (#1d4ed8) — authority, trust, professionalism
 *   Radius:    Sharp — crisp, precise edges signal expertise and reliability
 *   Neutrals:  Cool slate — clean, focused, no-nonsense
 *
 * ─── Adaptive homepage slots ──────────────────────────────────────────────────
 *
 *   Hero   → hero_google_problem / hero_direct_brand / hero_consideration / hero_intent_direct
 *   Proof  → proof_cases / proof_vision / proof_platform
 *   CTA    → cta_meeting / cta_demo / cta_guide
 *
 * ─── Site architecture ────────────────────────────────────────────────────────
 *
 *   /                       Adaptive homepage (hero + proof + cta)
 *   /diensten               Services overview  featureGrid, textSection
 *   /diensten/[slug]        Service detail     textMedia, featureGrid, testimonialSection, ctaSection
 *   /over-ons               About us           textMedia, stats, teamSection, about
 *   /cases                  Case studies       listing, logoStrip
 *   /cases/[slug]           Case detail        articleMeta, articleBody, stats, relatedContent
 *   /nieuws                 News / insights    newsList
 *   /nieuws/[slug]          Article detail     articleMeta, articleBody, relatedContent
 *   /contact                Contact            contactSection, formSection, mapBlock
 *
 * ─── Navigation ───────────────────────────────────────────────────────────────
 *
 *   Primary nav (mega-menu):
 *     Diensten              → /diensten
 *       [Service sub-items] → /diensten/[slug]    (1 level deep)
 *     Cases                 → /cases
 *     Over ons              → /over-ons
 *     Nieuws                → /nieuws
 *
 *   CTA button:    "Plan een gesprek"  → /contact  (primary conversion)
 *   Footer cols:   Diensten, Cases, Over ons, Nieuws, Contact
 *   Footer legal:  Privacybeleid, Algemene voorwaarden
 *
 * ─── CMS block map ────────────────────────────────────────────────────────────
 *
 *   /diensten             featureGrid     service cards (icon, title, short desc, CTA)
 *                         textSection     category intro / positioning statement
 *
 *   /diensten/[slug]      textMedia       service overview with supporting visual (surface: default)
 *                         featureGrid     capability breakdown or methodology steps
 *                         testimonialSection  client quotes relevant to this service
 *                         ctaSection      bottom-of-page conversion (meeting / demo)
 *
 *   /over-ons             textMedia       mission + vision with leadership photo
 *                         stats           years in business, clients, countries, NPS
 *                         teamSection     leadership team cards (photo, name, role, LinkedIn)
 *                         about           history, milestones, accreditations
 *
 *   /cases                listing         case study cards (client, sector, outcome summary)
 *                         logoStrip       client logos strip (trust signal at top)
 *
 *   /cases/[slug]         articleMeta     client, sector, timeline, challenge
 *                         articleBody     rich-text case narrative
 *                         stats           3–4 outcome metrics (ROI, time saved, revenue)
 *                         relatedContent  2–3 related cases or service pages
 *
 *   /nieuws               newsList        insight/article cards with category, date, thumbnail
 *
 *   /nieuws/[slug]        articleMeta     title, author, publish date, estimated read
 *                         articleBody     rich-text article with embedded charts/images
 *                         relatedContent  3 related articles or cases
 *
 *   /contact              contactSection  office address, phone, email, team intro
 *                         formSection     contact form (name, company, message) → n8n
 *                         mapBlock        office location map (optional)
 *
 * ─── How to use this template ─────────────────────────────────────────────────
 *
 *   1. Copy this file to tenant/templates/<client-slug>-config.ts.
 *   2. Replace tenantId, name, canonicalHostname, and additionalHostnames.
 *   3. Update theme hex values to match the client's brand palette.
 *   4. Narrow variants[] to the keys the CMS team has written.
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
// BRAND THEME — Corporate blue, sharp radius
// ─────────────────────────────────────────────────────────────────────────────
//
// Corporate blue signals trust, authority, and expertise in a B2B context.
// Sharp radius projects precision and professionalism — no soft rounded edges.
// Cool slate neutrals keep the palette focused and serious.

const brand = {
  50:  "#eff6ff",  // very light blue for callout backgrounds
  100: "#dbeafe",  // subtle tint for section backgrounds
  400: "#60a5fa",  // lighter blue for indicators
  500: "#1d4ed8",  // PRIMARY — authoritative corporate blue
  600: "#1e40af",  // hover — deepens for clear affordance
  700: "#1e3a8a",  // active/pressed — darker for contrast
} as const;

/**
 * Corporate B2B Blueprint brand theme.
 *
 * Blue primary, slate neutrals, sharp radius.
 * Suitable for consultancy, professional services, and B2B enterprise sites.
 *
 * ← REPLACE: Update hex values for the client's brand palette.
 */
const CORPORATE_B2B_THEME: TenantTheme = {
  colors: {
    brand: {
      primary:       brand[500],   // #1d4ed8 — authoritative corporate blue
      primaryHover:  brand[600],   // #1e40af — hover deepens slightly
      primaryActive: brand[700],   // #1e3a8a — pressed/active
      primarySubtle: brand[50],    // #eff6ff — very light tint for callouts
      primaryText:   neutral[0],   // #ffffff — white text on blue
      ring:          brand[500],   // #1d4ed8 — focus ring
      textBrand:     brand[500],   // #1d4ed8 — inline brand text (links, accents)
    },
    text: {
      text:        "#0f172a",     // slate-900 — near-black, sharp and legible
      textMuted:   "#475569",     // slate-600 — secondary labels
      textSubtle:  "#94a3b8",     // slate-400 — placeholders, disabled
      textInverse: neutral[0],    // #ffffff — text on dark backgrounds
    },
    background: {
      bg:        "#f8fafc",       // slate-50 — clean cool off-white
      bgSubtle:  "#f1f5f9",       // slate-100 — recessed sections, table rows
      bgInverse: "#0a1628",       // very dark navy for footer / hero inversions
    },
    border: {
      border:       "#e2e8f0",    // slate-200 — standard dividers
      borderStrong: "#cbd5e1",    // slate-300 — prominent borders, focused inputs
    },
  },

  radius: "sharp",  // crisp, precise — authority and expertise aesthetic

  meta: {
    name:    "Corporate B2B Blueprint",          // ← REPLACE: client brand name
    tagline: "Authority, trust & professionalism", // ← REPLACE: client positioning line
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// IMPLEMENTATION TEMPLATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Corporate B2B blueprint implementation template.
 *
 * Pre-configured for a corporate / professional services site:
 *   • Essential package
 *   • Storyblok CMS (structured content, visual editing for marketing team)
 *   • Rules decisioning (intent signals: search term, channel, page depth)
 *   • GA4 analytics
 *   • All three adaptive blocks active (hero + proof + cta)
 *   • Standard platform variant keys optimised for B2B buying journeys
 *   • Contact form active (meeting request / demo booking)
 *
 * Copy and customise per client — see file header for step-by-step guide.
 */
export const CORPORATE_B2B_IMPLEMENTATION: ImplementationTemplate =
  createImplementationTemplate({

    // ── Identity ───────────────────────────────────────────────────────────────

    tenantId:          "corporate-client",    // ← REPLACE: "<client-slug>"
    name:              "Corporate B2B Blueprint", // ← REPLACE: client name
    canonicalHostname: "example.com",         // ← REPLACE: client's primary domain
    packageId:         "essential",
    createdAt:         "2026-01-01T00:00:00.000Z", // ← REPLACE: actual creation date

    additionalHostnames: [
      "www.example.com",          // ← REPLACE: www. subdomain
      "corporate-client.vercel.app", // ← REPLACE: Vercel preview URL (or remove)
    ],

    // ── Theme ──────────────────────────────────────────────────────────────────

    theme: CORPORATE_B2B_THEME,

    // ── CMS ───────────────────────────────────────────────────────────────────
    //
    // Storyblok — visual editor suits marketing teams authoring cases,
    // insights, and service pages without developer involvement.
    //
    cmsProvider: "storyblok",
    cmsNotes:    "Storyblok space ID: XXXXX. EU region. Credentials in 1Password → Clients → [Client].",

    // ── Decision provider ─────────────────────────────────────────────────────
    //
    // Rules decisioning handles the classic B2B buying journey well:
    //   • Google/Bing search → problem-aware hero
    //   • LinkedIn organic → consideration / vision-led hero
    //   • Direct / brand → brand credibility hero
    //   • Returning + cases visited → intent-direct hero + meeting CTA
    // Switch to "ai" when the variant corpus reaches 8+ hero options.
    //
    decisionProvider: "rules",

    // ── Modules ───────────────────────────────────────────────────────────────

    enabledModules: [
      "adaptive-website",       // adaptive homepage: hero + proof + cta pipeline
      "context-intelligence",   // visitor history + session signals
      "adaptive-follow-up",     // n8n post-submission journey (meeting confirmation)
    ],

    // ── Pages ─────────────────────────────────────────────────────────────────
    //
    // Adaptive pipeline on homepage only.
    // All other pages (/diensten, /cases, etc.) are standard CMS slug pages.
    //
    pages: {
      homepage: true,
    },

    // ── Blocks ────────────────────────────────────────────────────────────────

    blocks: {
      hero:  true,   // channel-matched headline + positioning
      proof: true,   // intent-matched social proof (cases / vision / platform)
      cta:   true,   // stage-matched CTA (guide → demo → meeting)
    },

    // ── Variant keys ──────────────────────────────────────────────────────────
    //
    // Standard platform variants — well-suited for B2B buying journeys.
    //
    // Hero  (channel / intent matched):
    //   hero_google_problem    — search visitor: problem-first framing
    //   hero_linkedin_vision   — LinkedIn visitor: thought leadership angle
    //   hero_direct_brand      — direct / brand visitor: lead with authority
    //   hero_consideration     — returning visitor in research mode: fit messaging
    //   hero_intent_direct     — high-intent visitor: direct pitch, strong CTA
    //
    // Proof (intent matched):
    //   proof_cases            — concrete case studies and ROI for intent visitors
    //   proof_vision           — analyst quotes / awards for awareness visitors
    //   proof_platform         — scale and reliability stats for consideration
    //
    // CTA (funnel stage matched):
    //   cta_meeting            — mid/high funnel: "Plan een gesprek" (primary)
    //   cta_demo               — mid funnel: "Bekijk een demo" (visual buyers)
    //   cta_guide              — top of funnel: "Download het playbook" (nurture)
    //
    // ← NARROW: start with 2 hero + 1 proof + 1 cta; expand as CMS team adds content.
    //
    variants: {
      hero:  [
        "hero_google_problem",
        "hero_direct_brand",
        "hero_consideration",
        "hero_intent_direct",
        // "hero_linkedin_vision",  // ← uncomment when LinkedIn is a meaningful channel
      ],
      proof: [
        "proof_cases",
        "proof_vision",
        "proof_platform",
      ],
      cta: [
        "cta_meeting",
        "cta_demo",
        "cta_guide",
      ],
    },

    // ── Contact form ──────────────────────────────────────────────────────────
    //
    // Primary conversion event — meeting request / demo booking.
    //
    contact: {
      enabled: true,
      // webhookUrl: "https://n8n.example.com/webhook/contact-intake",
    },

    // ── Analytics ─────────────────────────────────────────────────────────────

    analytics: {
      provider:                "ga4",
      measurementId:           "G-XXXXXXXXXX", // ← REPLACE: client's GA4 Measurement ID
      dashboardEnabled:        false,
      trackPageViews:          true,
      trackVariantServed:      true,
      trackContactSubmissions: true,           // tracks meeting request conversions
    },

    // ── Feature flags ─────────────────────────────────────────────────────────

    features: {
      diagnosticsBar:     false, // NEVER true in production
      contactForm:        true,  // meeting request form active
      abTesting:          false,
      aiDecisionProvider: false,
    },
  });

// ─────────────────────────────────────────────────────────────────────────────
// TENANT CONFIG — register in resolve-tenant.ts
// ─────────────────────────────────────────────────────────────────────────────
//
//   import { CORPORATE_B2B_TENANT } from "./templates/corporate-b2b-template";
//
//   const TENANT_REGISTRY: Record<string, TenantConfig> = {
//     "example.com":     CORPORATE_B2B_TENANT,
//     "www.example.com": CORPORATE_B2B_TENANT,
//   };
//
// ← REPLACE the export name to match the client, e.g. DELOITTE_TENANT

/**
 * Corporate B2B blueprint TenantConfig.
 * Rename this export when using as a real client config (e.g. ACME_CORP_TENANT).
 */
export const CORPORATE_B2B_TENANT = createTenantConfig(
  toTenantConfigInput(CORPORATE_B2B_IMPLEMENTATION)
);
