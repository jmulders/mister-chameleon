/**
 * billing/enrichment-pricing.ts
 *
 * Per-enrichment-type pricing configuration and stage label → event type mapping.
 *
 * ─── ARCHITECTURE NOTE (read this first) ──────────────────────────────────────
 *
 *   This file is the STATIC FALLBACK layer of the billing system.  It is NOT the
 *   source of truth for live pricing.
 *
 *   Live enrichment pricing is managed in the `credit_pricing` Supabase table and
 *   administered via Admin → Platform → Billing → Pricing.  The DB-backed system
 *   lives in billing/pricing.ts (CREDIT_PRICING_DEFAULTS + getCreditPricingRow /
 *   getAllActivePricing).
 *
 *   How the layers interact at runtime:
 *
 *     1. enrichment-tracker.ts calls getAllActivePricing() (billing/pricing.ts)
 *        once per pipeline trace to fetch the current DB pricing.
 *     2. For each billable stage, it resolves the price as:
 *        DB row → ENRICHMENT_PRICE_CENTS fallback → hard-coded 3¢ guard
 *
 *   ENRICHMENT_PRICE_CENTS (this file) is the fallback only.  When the
 *   credit_pricing table is seeded (use the "Seed defaults" button on the admin
 *   pricing page), the DB values take precedence and ENRICHMENT_PRICE_CENTS is
 *   effectively superseded.
 *
 *   ENRICHMENT_TYPE_CONFIG and STAGE_LABEL_TO_EVENT_TYPE are structural
 *   config — they define which stages exist, whether they are billable, and
 *   which event types map to which labels.  These do NOT affect the price.
 *
 * ─── Client safety ────────────────────────────────────────────────────────────
 *
 *   This file is pure static config — no env vars, no imports from Supabase or
 *   Stripe.  It is safe to import in any context (server, client, edge).
 *
 * ─── Pricing model ────────────────────────────────────────────────────────────
 *
 *   Credits are deducted only for live external API calls that returned data.
 *   Provider-cache hits and failed calls cost 0 credits regardless of type.
 *
 *   1 credit  = ~€0.03 overage cost (at plan's overageCentPerCredit rate).
 *
 * ─── Stage label mapping ──────────────────────────────────────────────────────
 *
 *   The enrichment pipeline records each stage with a human-readable `label`.
 *   This module maps those labels to UsageEventType values so the enrichment
 *   tracker can determine what to bill and how much.
 *
 *   Labels NOT in the map are silently skipped — not billed.
 *   "Leadinfo" is explicitly mapped to null to prevent double-billing with
 *   the client-side /api/enrichment/leadinfo route.
 */

import type { UsageEventType } from "./types";
import type { CreditCategory } from "./credits";

// ── Per-type pricing ──────────────────────────────────────────────────────────

export interface EnrichmentTypeConfig {
  /**
   * Credits deducted per successful live API call.
   * Cache hits always cost 0 regardless of this value.
   */
  creditsPerCall: number;

  /**
   * Human-readable display name for the admin billing panel.
   */
  displayName: string;

  /**
   * Human-readable description of what this enrichment type does.
   */
  description: string;

  /**
   * Whether this enrichment type is billable at all.
   * Non-billable types are tracked for analytics but never deduct credits.
   */
  billable: boolean;

  /**
   * Chameleon Credits category this enrichment type belongs to.
   * Drives the category breakdown in the billing dashboard and controls
   * which enrichments are disabled when a category is toggled off.
   *
   *   recognition — identifying the visitor (IP geo, company, reverse geocode)
   *   adaptation  — choosing the experience (intent, weather)
   *   brainpower  — deep enrichment (GA4 history, CRM lookup)
   */
  category: CreditCategory;
}

/**
 * Price per live API call in euro cents.
 * Matches the seeds in migration 43 (enrichment_pricing table).
 *
 * This static map is used in enrichment-tracker.ts when no DB pricing row is
 * available (e.g. table missing or new enrichment type not yet seeded).
 *
 * 1-credit enrichments: 3 cents (€0.03)
 * 2-credit enrichments: 6 cents (€0.06)
 */
export const ENRICHMENT_PRICE_CENTS: Record<UsageEventType, number> = {
  ip_enrich:       3,
  reverse_geocode: 3,
  weather_enrich:  3,
  company_lookup:  3,
  intent_enrich:   3,
  leadinfo_lookup: 3,
  firstparty_company_lookup: 1,
  location_lookup: 1,
  ga4_history:     6,
  crm_lookup:      6,
};

/**
 * Fetch the current price in cents for an enrichment type.
 * First tries the database (enrichment_pricing table), falling back to
 * the static ENRICHMENT_PRICE_CENTS map.
 *
 * Pass a Supabase client only when you have one; otherwise the static
 * value is returned synchronously.
 */
export async function getEnrichmentPriceCents(
  enrichmentType: UsageEventType,
  client?: import("@supabase/supabase-js").SupabaseClient,
): Promise<number> {
  if (client) {
    try {
      const { data, error } = await client
        .from("enrichment_pricing")
        .select("unit_price_cents")
        .eq("enrichment_type", enrichmentType)
        .maybeSingle();

      if (!error && data) {
        return (data as { unit_price_cents: number }).unit_price_cents;
      }
    } catch {
      // Fall through to static default.
    }
  }
  return ENRICHMENT_PRICE_CENTS[enrichmentType] ?? 3;
}

export const ENRICHMENT_TYPE_CONFIG: Record<UsageEventType, EnrichmentTypeConfig> = {
  // ── Billable (1 credit) ────────────────────────────────────────────────────

  ip_enrich: {
    creditsPerCall: 1,
    displayName:    "IP Enrichment",
    description:    "IPinfo Lite — network ASN, org name, domain, and coordinates",
    billable:       true,
    category:       "recognition",
  },

  reverse_geocode: {
    creditsPerCall: 1,
    displayName:    "Reverse Geocode",
    description:    "Latitude/longitude → structured address (LocationIQ / BigDataCloud)",
    billable:       true,
    category:       "recognition",
  },

  weather_enrich: {
    creditsPerCall: 1,
    displayName:    "Weather",
    description:    "Open-Meteo — current weather conditions and forecast",
    billable:       true,
    category:       "adaptation",
  },

  company_lookup: {
    creditsPerCall: 1,
    displayName:    "Company Lookup",
    description:    "Reverse-IP firmographics (OpenKvK / Clearbit)",
    billable:       true,
    category:       "recognition",
  },

  intent_enrich: {
    creditsPerCall: 1,
    displayName:    "Intent Enrichment",
    description:    "Behavioural intent and engagement signals",
    billable:       true,
    category:       "adaptation",
  },

  leadinfo_lookup: {
    creditsPerCall: 1,
    displayName:    "Leadinfo",
    description:    "B2B company identification (billed at /api/enrichment/leadinfo)",
    billable:       true,
    category:       "recognition",
  },

  firstparty_company_lookup: {
    creditsPerCall: 1,
    displayName:    "First-party company DB",
    description:    "Company served from the shared first-party pool — cheaper than a paid identify",
    billable:       true,
    category:       "recognition",
  },

  location_lookup: {
    creditsPerCall: 0.5,
    displayName:    "Location (CBS)",
    description:    "First-party neighbourhood stats from CBS PC4 open data (urbanity, income band, business share)",
    billable:       true,
    category:       "recognition",
  },

  // ── Billable (2 credits) ───────────────────────────────────────────────────

  ga4_history: {
    creditsPerCall: 2,
    displayName:    "GA4 History",
    description:    "Google Analytics 4 visitor session history and channel data",
    billable:       true,
    category:       "brainpower",
  },

  crm_lookup: {
    creditsPerCall: 2,
    displayName:    "CRM Lookup",
    description:    "HubSpot CRM — contact and company record matching",
    billable:       true,
    category:       "brainpower",
  },
};

// ── Stage label → event type mapping ─────────────────────────────────────────
//
// Maps the StagedEnricher.label values (from staged-pipeline.ts / provider
// factory functions) to their corresponding UsageEventType.
//
// null = stage is not billable (request-time processing, free external API,
//        or tracked via a separate route).
//
// IMPORTANT: "Leadinfo" is mapped to null here because Leadinfo billing is
// handled at the /api/enrichment/leadinfo route (client-side identify flow).
// If a server-side Leadinfo stage is ever added to the pipeline, this mapping
// should be updated and double-billing logic added.

export const STAGE_LABEL_TO_EVENT_TYPE: Record<string, UsageEventType | null> = {
  // ── Billable ───────────────────────────────────────────────────────────────
  "IPinfo Lite":              "ip_enrich",
  "Reverse Geocode":          "reverse_geocode",
  "Weather":                  "weather_enrich",

  // Company lookup — multiple label variants across providers:
  //   "OpenKvK (NL registry)" = openkvk.ts (Dutch company registry)
  //   "OpenKvK"               = legacy label (kept for backward compat)
  //   "Clearbit"              = Clearbit Reveal reverse-IP lookup
  //   "company"               = generic company provider (company.ts)
  "OpenKvK (NL registry)":    "company_lookup",
  "OpenKvK":                  "company_lookup",
  "Clearbit":                 "company_lookup",
  "company":                  "company_lookup",

  // CRM lookup — multiple label variants across providers:
  //   "HubSpot CRM"           = staged-company-crm-chain.ts
  //   "HubSpot"               = legacy / abbreviated label
  //   "crm"                   = generic CRM provider (crm.ts)
  "HubSpot CRM":              "crm_lookup",
  "HubSpot":                  "crm_lookup",
  "crm":                      "crm_lookup",

  // Combined IP→Company→CRM enricher (ip-company-hubspot-enricher.ts).
  // Billed as crm_lookup (the heavier of the two operations it performs).
  "ip-company-hubspot":       "crm_lookup",

  "GA4 History":              "ga4_history",

  // ── Not billable via the generic tracker ────────────────────────────────────
  "CBS Location":             null,   // First-party location — billed separately (billing/location-billing.ts)
  "IP Classification":        null,   // In-process ASN/org pattern matching
  "Cloud Detection":          null,   // In-process ASN/org pattern matching
  "geo:headers":              null,   // CDN header parsing, no external I/O
  "geo:maxmind":              null,   // MaxMind GeoLite2 local DB, no API call
  "geo:ipapi":                null,   // Low-accuracy fallback only; not primary billing unit
  "geo":                      null,   // MaxMind label emitted by createMaxMindGeoEnricher (default label)
  "Seasonal Event":           null,   // Nager.Date free API / date math
  "account-list":             null,   // In-process domain match against tenant list; no external API
  "ads-attribution":          null,   // UTM param parsing; no external API call

  // ── Tracked separately via /api/enrichment/leadinfo ───────────────────────
  "Leadinfo":                 null,   // Billed per matched identify call, not here
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Look up how many credits a live API call for a given event type costs.
 * Returns 0 for unknown types (safe default — never over-bills).
 */
export function getCreditsPerCall(eventType: UsageEventType): number {
  return ENRICHMENT_TYPE_CONFIG[eventType]?.creditsPerCall ?? 0;
}

/**
 * Look up the display name for an event type.
 * Falls back to the raw event type string for unknown types.
 */
export function getEnrichmentDisplayName(eventType: string): string {
  return (
    (ENRICHMENT_TYPE_CONFIG as Record<string, EnrichmentTypeConfig>)[eventType]?.displayName ??
    eventType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
