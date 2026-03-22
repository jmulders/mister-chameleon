/**
 * Default Client Template
 *
 * The canonical copy-paste starting point for a new client implementation.
 *
 * ─── How to use this file ─────────────────────────────────────────────────────
 *
 *   1. Copy this entire file to a new file named after your client:
 *        tenant/templates/<client-slug>-config.ts
 *
 *   2. Replace every value marked with  ← REPLACE  in the comments below.
 *      Start with the identity fields (tenantId, name, canonicalHostname).
 *
 *   3. Design the brand theme:
 *        a. Replace NEW_CLIENT_PRIMARY_* constants with the client's hex values.
 *        b. Update meta.name and meta.tagline.
 *
 *   4. Confirm provider choices with the client and update cmsProvider /
 *      decisionProvider if they differ from the defaults.
 *
 *   5. Populate the variant keys once the CMS content team has written
 *      the first round of variants. Start narrow — 2 per dimension is enough.
 *
 *   6. Generate the TenantConfig:
 *        const configInput = toTenantConfigInput(DEFAULT_CLIENT_IMPLEMENTATION);
 *        export const MY_CLIENT_TENANT = createTenantConfig(configInput);
 *
 *   7. Register the tenant in resolve-tenant.ts using all hostnames in
 *      additionalHostnames + canonicalHostname.
 *
 *   8. Set env vars from getRequiredEnvVars(DEFAULT_CLIENT_IMPLEMENTATION).
 *
 * ─── What this file provides ─────────────────────────────────────────────────
 *
 *   NEW_CLIENT_THEME         — placeholder brand theme (replace hex values)
 *   DEFAULT_CLIENT_IMPLEMENTATION — complete ImplementationTemplate with defaults
 *   NEW_CLIENT_TENANT        — derived TenantConfig ready to register
 *
 * ─── Package: essential ──────────────────────────────────────────────────────
 *
 *   This template is pre-configured for the Essential package:
 *     • Adaptive homepage (hero + proof + CTA blocks)
 *     • Rules-based decisioning (no AI cost on day one)
 *     • Storyblok CMS (most common client CMS)
 *     • Contact form → n8n webhook
 *     • GA4 analytics
 *     • No A/B experiments yet
 *
 *   Upgrade to growth or scale by changing packageId and enabling the
 *   appropriate modules and feature flags.
 *
 * ─── File map ─────────────────────────────────────────────────────────────────
 *
 *   onboarding/implementation-template.ts  ← types, factory, and query helpers
 *   tenant/templates/base-template.ts      ← TENANT_DEFAULTS and createTenantConfig
 *   tenant/templates/acme-growth-config.ts ← second real-client example
 *   tenant/templates/default-client-template.ts  ← YOU ARE HERE
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
// STEP 1 — BRAND THEME
// ─────────────────────────────────────────────────────────────────────────────
//
// Replace the hex values below with the client's brand palette.
//
// Convention: define a named colour scale (like `brand` or the client's
// colour name) with at least 7 steps: 50, 100, 400, 500 (primary),
// 600 (hover), 700 (active), 0/white.
//
// The platform's own palette tokens (design-system/tokens/colors.ts) are
// the MC default — do not modify them for a client. Instead, define the
// client's palette inline here, exactly as shown.
//
// Radius personality:
//   "sharp"     — crisp, SaaS / startup aesthetic
//   "balanced"  — default, works for most brands
//   "soft"      — rounded, friendly / consumer aesthetic

// ← REPLACE: define the client's primary colour scale
const clientBrand = {
  50:  "#f5f3ff",  // ← replace with client's lightest tint
  100: "#ede9fe",  // ← replace with client's subtle tint
  400: "#a78bfa",  // ← replace with client's lighter primary
  500: "#8b5cf6",  // ← replace with client's PRIMARY colour (main CTA bg)
  600: "#7c3aed",  // ← replace with client's hover colour
  700: "#6d28d9",  // ← replace with client's active / pressed colour
} as const;

/**
 * Client brand theme.
 *
 * ← REPLACE: Update meta.name and meta.tagline with the client's brand.
 * ← REPLACE: Update colours using the clientBrand scale above.
 * ← REPLACE: Set radius to match the client's design aesthetic.
 */
const NEW_CLIENT_THEME: TenantTheme = {
  colors: {
    brand: {
      primary:       clientBrand[500],   // ← primary CTA, button background
      primaryHover:  clientBrand[600],   // ← button hover state
      primaryActive: clientBrand[700],   // ← button pressed state
      primarySubtle: clientBrand[50],    // ← light background tint for callouts
      primaryText:   neutral[0],         // ← text on primary background (usually white)
      ring:          clientBrand[500],   // ← keyboard focus ring
      textBrand:     clientBrand[600],   // ← inline brand-coloured text (links, accents)
    },
    text: {
      text:        neutral[900],  // ← main body copy (replace if brand uses off-black)
      textMuted:   neutral[500],  // ← secondary labels, metadata
      textSubtle:  neutral[400],  // ← placeholders, disabled states
      textInverse: neutral[0],    // ← text on dark/primary backgrounds
    },
    background: {
      bg:        neutral[50],   // ← page background (replace if brand uses cream / warm white)
      bgSubtle:  neutral[100],  // ← recessed sections, card backgrounds
      bgInverse: neutral[900],  // ← dark footer, hero sections with light text
    },
    border: {
      border:       neutral[200],  // ← standard dividers and input outlines
      borderStrong: neutral[300],  // ← prominent borders, focused input rings
    },
  },

  // ← REPLACE: "balanced" | "sharp" | "soft"
  radius: "balanced",

  meta: {
    name:    "New Client",          // ← REPLACE: client's brand display name
    tagline: "Describe the brand",  // ← REPLACE: one-line brand tagline
    // faviconPath: "/client-favicon.ico",  ← uncomment once client supplies asset
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — IMPLEMENTATION TEMPLATE
// ─────────────────────────────────────────────────────────────────────────────
//
// Fill in the identity and configuration fields below.
// Every ← REPLACE comment marks a field that must be updated before go-live.
// Fields with ← DEFAULT comments can be left as-is for a standard setup.

/**
 * Default client implementation template.
 *
 * Pre-configured for:
 *   • Essential package
 *   • Storyblok CMS
 *   • Rules decisioning
 *   • GA4 analytics
 *   • Adaptive homepage with all three blocks
 *   • Contact form active, using the shared n8n webhook
 *
 * Copy and customise this for each new client.
 */
export const DEFAULT_CLIENT_IMPLEMENTATION: ImplementationTemplate =
  createImplementationTemplate({

    // ── Template metadata ────────────────────────────────────────────────────

    // ← REPLACE: kebab-case slug matching the client's brand name
    tenantId: "new-client",

    // ← REPLACE: human-readable display name
    name: "New Client",

    // ← REPLACE: primary production hostname, no protocol, no trailing slash
    canonicalHostname: "example.com",

    // Package selection — determines capability set and module footprint
    // ← REPLACE if client is on growth or scale:
    //   "essential" | "growth" | "scale"
    packageId: "essential",

    // ISO 8601 timestamp — set to today's date when creating a real template
    createdAt: "2026-01-01T00:00:00.000Z",  // ← REPLACE: with actual creation date

    // ── Additional hostnames ─────────────────────────────────────────────────
    //
    // Register all the hostnames this tenant should answer to.
    // All entries here + canonicalHostname must be added to resolve-tenant.ts.
    //
    additionalHostnames: [
      "www.example.com",           // ← REPLACE: www. subdomain
      "example.vercel.app",        // ← REPLACE: Vercel preview URL (or remove)
      // "staging.example.com",    // ← uncomment if client uses a staging domain
    ],

    // ── Brand theme ──────────────────────────────────────────────────────────
    //
    // See NEW_CLIENT_THEME definition above — replace the hex values there.
    //
    theme: NEW_CLIENT_THEME,

    // ── CMS provider ─────────────────────────────────────────────────────────
    //
    // "storyblok"  — visual editor, component-based (most common for MC clients)
    // "sanity"     — structured content, powerful GROQ query language
    // "statamic"   — flat-file / Eloquent, strong for bespoke setups
    // "mock"       — dev and preview only; never in production
    //
    // ← REPLACE if client uses a different CMS
    cmsProvider: "storyblok",

    // Optional: notes for the implementation team (not used at runtime)
    // ← REPLACE: add space ID, region, credentials location
    cmsNotes: "Storyblok space ID: XXXXX. EU region. Credentials in 1Password → Clients → New Client.",

    // ── Decision provider ────────────────────────────────────────────────────
    //
    // "rules"  — safe default: zero AI cost, server-side rule evaluation.
    //            Change to "ai" only after confidence policy review.
    //
    // ← DEFAULT: leave as "rules" for all new clients
    decisionProvider: "rules",

    // ── Enabled modules ──────────────────────────────────────────────────────
    //
    // Essential package modules:
    //   "adaptive-website"      — adaptive homepage pipeline (always included)
    //   "context-intelligence"  — visitor history + contact enrichment
    //   "adaptive-follow-up"    — n8n post-submission journey
    //
    // Growth/scale add:
    //   "adaptive-landing-pages" — campaign-specific adaptive landing pages
    //
    // ← DEFAULT: correct for essential package. Update if package changes.
    enabledModules: [
      "adaptive-website",
      "context-intelligence",
      "adaptive-follow-up",
    ],

    // ── Page types ───────────────────────────────────────────────────────────
    //
    // Which adaptive page pipelines are active.
    // ← DEFAULT: homepage only (standard for essential package)
    pages: {
      homepage: true,
    },

    // ── Block configuration ──────────────────────────────────────────────────
    //
    // Which page section blocks are rendered.
    // Disable any blocks the client's design doesn't include.
    //
    // ← DEFAULT: all three blocks active (standard setup)
    blocks: {
      hero:  true,  // ← set false if the client's homepage has no adaptive hero
      proof: true,  // ← set false if the design has no social proof section
      cta:   true,  // ← set false if the design uses inline CTAs only
    },

    // ── Variant keys ─────────────────────────────────────────────────────────
    //
    // The decision engine will only serve variant keys listed here.
    // Start with the minimum viable set — the CMS content that's actually
    // been written. Expand as the client populates more content.
    //
    // Key strings must match the literal unions in decision/types.ts.
    //
    // ← REPLACE: narrow to the variant keys the client's CMS team has written.
    //   Minimum: 2 hero, 1 proof, 1 CTA. Typical starter: 2-3 per dimension.
    variants: {
      hero: [
        "hero_google_problem",  // ← keep, remove, or replace with client's first hero
        "hero_direct_brand",    // ← keep, remove, or replace with client's second hero
        // "hero_linkedin_vision", // ← uncomment when LinkedIn traffic is significant
      ],
      proof: [
        "proof_cases",    // ← keep if client has case study social proof
        "proof_platform", // ← keep if client emphasises platform/product credibility
      ],
      cta: [
        "cta_meeting",    // ← keep if primary CTA is book-a-call
        "cta_platform",   // ← keep if primary CTA is try-the-product / see demo
        // "cta_guide",   // ← uncomment if client has a downloadable lead magnet
      ],
    },

    // ── Contact form ─────────────────────────────────────────────────────────
    //
    // enabled      — whether the contact form is active for this tenant.
    // webhookUrl   — client-specific n8n webhook. When absent, the platform-level
    //               N8N_CONTACT_WEBHOOK_URL env var is used (shared MC instance).
    //
    // Set webhookUrl for clients who have their own n8n instance.
    // Leave webhookUrl undefined for clients using the shared MC n8n workflow.
    //
    contact: {
      enabled: true,  // ← set false if client routes leads through Calendly/HubSpot directly
      // webhookUrl: "https://n8n.example.com/webhook/contact-intake",
      //             ← uncomment and replace if client has their own n8n instance
    },

    // ── Analytics ────────────────────────────────────────────────────────────
    //
    // Determines env vars and event wiring for the deployment.
    // Not a runtime config field — drives the technical-setup checklist.
    //
    analytics: {
      // ← REPLACE: "none" | "ga4" | "plausible" | "posthog" | "custom"
      provider: "ga4",

      // ← REPLACE: the client's GA4 Measurement ID (format: G-XXXXXXXXXX)
      // Remove if provider !== "ga4"
      measurementId: "G-XXXXXXXXXX",

      // Analytics dashboard — enable once variant data has accumulated
      // ← DEFAULT: false (safe until first full variant cycle completes)
      dashboardEnabled: false,

      // Event tracking — all three are recommended from day one
      trackPageViews:          true,   // ← DEFAULT: always on
      trackVariantServed:      true,   // ← DEFAULT: enables per-variant segmentation
      trackContactSubmissions: true,   // ← DEFAULT: tracks lead form conversions
    },

    // ── Feature flags ─────────────────────────────────────────────────────────
    //
    // Explicit safe production values for all four flags.
    //
    features: {
      diagnosticsBar:     false,  // ← NEVER true in production
      contactForm:        true,   // ← set false if contact is disabled above
      abTesting:          false,  // ← set true only when an experiment is running
      aiDecisionProvider: false,  // ← set true only when decisionProvider is "ai"
    },
  });

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — DERIVE TENANT CONFIG
// ─────────────────────────────────────────────────────────────────────────────
//
// This derives a TenantConfig from the implementation template above.
// Once the template fields are filled in, this export is ready to register.
//
// Register NEW_CLIENT_TENANT in resolve-tenant.ts:
//
//   import { NEW_CLIENT_TENANT } from "./templates/default-client-template";
//   // (or from the renamed <client-slug>-config.ts)
//
//   const TENANT_REGISTRY: Record<string, TenantConfig> = {
//     "example.com":           NEW_CLIENT_TENANT,
//     "www.example.com":       NEW_CLIENT_TENANT,
//     "example.vercel.app":    NEW_CLIENT_TENANT,
//   };
//
// ← REPLACE: rename this export to match the client (e.g. ACME_TENANT)

/**
 * TenantConfig derived from the DEFAULT_CLIENT_IMPLEMENTATION template.
 *
 * Produced by projecting the ImplementationTemplate through toTenantConfigInput()
 * and then calling createTenantConfig(). This is the object that the resolver
 * and the rest of the runtime consume.
 *
 * ← REPLACE the export name when using this as a real client config,
 * e.g. export const ACME_TENANT = createTenantConfig(...)
 */
export const NEW_CLIENT_TENANT = createTenantConfig(
  toTenantConfigInput(DEFAULT_CLIENT_IMPLEMENTATION)
);

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 — ENV VAR CHECKLIST
// ─────────────────────────────────────────────────────────────────────────────
//
// To see which environment variables this template requires, run:
//
//   import { getRequiredEnvVars } from "@/onboarding/implementation-template";
//   const vars = getRequiredEnvVars(DEFAULT_CLIENT_IMPLEMENTATION);
//   vars.forEach(v => console.log(`${v.required ? "[required]" : "[optional]"} ${v.key}: ${v.description}`));
//
// For the default config above, the required vars are:
//
//   STORYBLOK_ACCESS_TOKEN         → CMS credentials
//   N8N_CONTACT_WEBHOOK_URL        → contact form webhook (unless per-client URL is set)
//   NEXT_PUBLIC_GA4_MEASUREMENT_ID → analytics
//
// ─────────────────────────────────────────────────────────────────────────────
