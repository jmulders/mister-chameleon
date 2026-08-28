/**
 * billing/pricing.ts
 *
 * Enrichment pricing — unit prices in EUR with fractional precision.
 *
 * ─── Canonical pricing model (migration 065) ─────────────────────────────────
 *
 *   unit_price   — EUR charged per successful live API call.
 *                  Supports fractions: 0.030000 = €0.03, 0.001000 = €0.001.
 *
 *   credit_cost  — Credits deducted per call. Supports fractions: 3.000, 0.250.
 *
 *   internal_cost — Actual provider cost per call in EUR (margin analysis).
 *
 *   Authoritative source: `enrichment_pricing` table (migration 065).
 *   Static fallback: CREDIT_PRICING_DEFAULTS (compiled, never stale).
 *
 * ─── Backward compat ──────────────────────────────────────────────────────────
 *
 *   CREDIT_PRICING_DEFAULTS still ships `customer_price_cents` (INT cents) and
 *   `internal_cost_cents` (INT cents) for code that hasn't migrated yet.
 *   getAllActivePricing() now tries `enrichment_pricing` first, then falls
 *   back to `credit_pricing` (the old table, if it still exists), then returns
 *   an empty array so the static ENRICHMENT_PRICE_CENTS fallback kicks in.
 *
 * ─── Client safety ────────────────────────────────────────────────────────────
 *
 *   Static constants (CREDIT_PRICING_DEFAULTS, PRICING_FEATURE_KEYS, helpers)
 *   are safe to import anywhere.  Async DB functions must only be called from
 *   server components, API routes, or server actions.
 */

import type { SupabaseClient }            from "@supabase/supabase-js";
import type { CreditCategory }            from "./credits";
import type { CreditPricingRow, EnrichmentPricingDbRow } from "./types";

// ── Static defaults ────────────────────────────────────────────────────────────
//
// These match the seeds in migration 051.
// Keep in sync when adding new feature_keys to the DB table.

export interface StaticPricingEntry {
  feature_key:          string;
  category:             CreditCategory;
  /** Customer-facing credit cost per call (1 credit = €0.01). */
  customer_price_cents: number;
  /** Actual provider cost per call (optional; null = not tracked). */
  internal_cost_cents:  number | null;
  billing_unit:         "per_call" | "per_token" | "per_kb" | "per_request";
  description:          string;
}

export const CREDIT_PRICING_DEFAULTS: Record<string, StaticPricingEntry> = {
  // ── Recognition (3 credits / call) ──────────────────────────────────────────
  ip_enrich: {
    feature_key:          "ip_enrich",
    category:             "recognition",
    customer_price_cents: 3,
    internal_cost_cents:  1,
    billing_unit:         "per_call",
    description:          "IPinfo Lite — network ASN, org name, geo coordinates, domain",
  },
  reverse_geocode: {
    feature_key:          "reverse_geocode",
    category:             "recognition",
    customer_price_cents: 3,
    internal_cost_cents:  1,
    billing_unit:         "per_call",
    description:          "Latitude / longitude → structured address (LocationIQ / BigDataCloud)",
  },
  company_lookup: {
    feature_key:          "company_lookup",
    category:             "recognition",
    customer_price_cents: 3,
    internal_cost_cents:  2,
    billing_unit:         "per_call",
    description:          "Reverse-IP firmographics — company name, size, industry (OpenKvK / Clearbit)",
  },
  leadinfo_lookup: {
    feature_key:          "leadinfo_lookup",
    category:             "recognition",
    customer_price_cents: 3,
    internal_cost_cents:  3,
    billing_unit:         "per_call",
    description:          "B2B company identification via Leadinfo client-side identify flow",
  },
  firstparty_company_lookup: {
    feature_key:          "firstparty_company_lookup",
    category:             "recognition",
    customer_price_cents: 1,
    internal_cost_cents:  0,
    billing_unit:         "per_call",
    description:          "First-party company DB hit — served from the shared pool, no paid identify",
  },

  // ── Adaptation (3 credits / call) ───────────────────────────────────────────
  intent_enrich: {
    feature_key:          "intent_enrich",
    category:             "adaptation",
    customer_price_cents: 3,
    internal_cost_cents:  1,
    billing_unit:         "per_call",
    description:          "Behavioural intent and session engagement signals",
  },
  weather_enrich: {
    feature_key:          "weather_enrich",
    category:             "adaptation",
    customer_price_cents: 3,
    internal_cost_cents:  1,
    billing_unit:         "per_call",
    description:          "Open-Meteo current weather conditions and short forecast",
  },

  // ── Brainpower (6 credits / call) — quota-constrained external APIs ─────────
  ga4_history: {
    feature_key:          "ga4_history",
    category:             "brainpower",
    customer_price_cents: 6,
    internal_cost_cents:  4,
    billing_unit:         "per_call",
    description:          "Google Analytics 4 visitor session history and channel attribution",
  },
  crm_lookup: {
    feature_key:          "crm_lookup",
    category:             "brainpower",
    customer_price_cents: 6,
    internal_cost_cents:  5,
    billing_unit:         "per_call",
    description:          "HubSpot CRM contact and company record matching",
  },

  // ── Brainpower — AI generation (future use) ──────────────────────────────────
  hero_generation: {
    feature_key:          "hero_generation",
    category:             "brainpower",
    customer_price_cents: 10,
    internal_cost_cents:  8,
    billing_unit:         "per_call",
    description:          "AI-generated hero section content (headline, sub-headline, CTA)",
  },
  block_generation: {
    feature_key:          "block_generation",
    category:             "brainpower",
    customer_price_cents: 8,
    internal_cost_cents:  6,
    billing_unit:         "per_call",
    description:          "AI-generated page block content (proof, features, FAQs)",
  },
  blueprint_generation: {
    feature_key:          "blueprint_generation",
    category:             "brainpower",
    customer_price_cents: 15,
    internal_cost_cents:  12,
    billing_unit:         "per_call",
    description:          "AI-generated full page blueprint from a single URL",
  },
};

/** All feature keys that have static pricing defaults. */
export const PRICING_FEATURE_KEYS = Object.keys(CREDIT_PRICING_DEFAULTS) as (keyof typeof CREDIT_PRICING_DEFAULTS)[];

// ── Static helpers (client-safe) ──────────────────────────────────────────────

/**
 * Get the static customer-facing credit price for a feature.
 * Returns 3 (the default) for unknown feature keys.
 */
export function getStaticCustomerPrice(featureKey: string): number {
  return CREDIT_PRICING_DEFAULTS[featureKey]?.customer_price_cents ?? 3;
}

/**
 * Get the static internal provider cost for a feature.
 * Returns null for unknown feature keys (cost not tracked).
 */
export function getStaticInternalCost(featureKey: string): number | null {
  return CREDIT_PRICING_DEFAULTS[featureKey]?.internal_cost_cents ?? null;
}

/**
 * Get the credit category for a feature key from static defaults.
 * Returns "recognition" as a safe fallback for unknown keys.
 */
export function getStaticCategory(featureKey: string): CreditCategory {
  return (CREDIT_PRICING_DEFAULTS[featureKey]?.category as CreditCategory) ?? "recognition";
}

/**
 * Compute the gross margin percentage for a feature based on static defaults.
 * Returns null when internal_cost_cents is not tracked.
 *
 * margin% = (customer_price - internal_cost) / customer_price × 100
 */
export function getStaticMarginPercent(featureKey: string): number | null {
  const entry = CREDIT_PRICING_DEFAULTS[featureKey];
  if (!entry || entry.internal_cost_cents == null || entry.customer_price_cents === 0) return null;
  const margin = (entry.customer_price_cents - entry.internal_cost_cents) / entry.customer_price_cents;
  return Math.round(margin * 100);
}

// ── DB helpers (server-only) ───────────────────────────────────────────────────

/**
 * Fetch all active rows from the canonical `enrichment_pricing` table.
 *
 * Falls back to the legacy `credit_pricing` table if `enrichment_pricing` is
 * missing (migration 065 not yet applied), then returns [] so callers use
 * the static ENRICHMENT_PRICE_CENTS fallback.
 *
 * Server-only — requires a Supabase client.
 */
export async function getAllEnrichmentPricing(
  client: SupabaseClient,
): Promise<EnrichmentPricingDbRow[]> {
  try {
    const { data, error } = await client
      .from("enrichment_pricing")
      .select("*")
      .eq("active", true)
      .order("category")
      .order("enrichment_type");

    if (error) {
      if (error.code !== "42P01" && error.code !== "PGRST205") {
        console.warn("[billing/pricing] getAllEnrichmentPricing DB error", {
          code: error.code, message: error.message,
          table: "enrichment_pricing",
        });
      }
      return [];
    }

    // ── Schema detection ─────────────────────────────────────────────────────
    //
    // Migration 065 changes enrichment_pricing from the old schema
    // (enrichment_type TEXT PK, unit_price_cents INTEGER) to the new schema
    // (id UUID PK, enrichment_type TEXT UNIQUE, unit_price NUMERIC).
    //
    // If the migration ran against an existing table via CREATE TABLE IF NOT EXISTS,
    // the new schema was silently NOT applied and rows will have unit_price_cents
    // but NOT unit_price.  In that case unit_price reads as undefined → NaN.
    //
    // Detect this by checking the first row and fall back to unit_price_cents/100
    // so downstream code never sees NaN.  The correct fix is to re-apply migration
    // 065 after the DROP TABLE was added (see migration file comments).
    const rawRows = (data ?? []) as Record<string, unknown>[];
    if (rawRows.length > 0 && rawRows[0]!["unit_price"] === undefined) {
      console.warn(
        "[billing/pricing] getAllEnrichmentPricing: old enrichment_pricing schema detected " +
        "(unit_price missing — migration 065 CREATE TABLE IF NOT EXISTS was a no-op). " +
        "Falling back to unit_price_cents/100. Apply migration 065 after adding the DROP TABLE fix.",
        { sampleRow: rawRows[0] },
      );
      return rawRows.map((r) => ({
        ...r,
        // Convert old unit_price_cents (INT, e.g. 3) → unit_price (EUR, e.g. 0.03)
        unit_price:   Number((r["unit_price_cents"] as number | undefined) ?? 0) / 100,
        // credit_cost was not in the old schema — default to unit_price_cents
        credit_cost:  Number((r["unit_price_cents"] as number | undefined) ?? 0) / 100,
        // id was not in the old schema — synthesize from enrichment_type
        id:           r["id"] ?? (r["enrichment_type"] as string),
        label:        r["label"] ?? (r["enrichment_type"] as string),
        category:     r["category"] ?? "recognition",
        billing_unit: r["billing_unit"] ?? "per_call",
        billable:     r["billable"] ?? true,
        active:       r["active"] ?? true,
      })) as unknown as EnrichmentPricingDbRow[];
    }

    // ── Success log — visible in server output for billing diagnosis ────────
    if (rawRows.length === 0) {
      console.warn(
        "[billing/pricing] getAllEnrichmentPricing: enrichment_pricing table is EMPTY. " +
        "No DB pricing available — enrichment-tracker will use static fallbacks. " +
        "Fix: open Admin → Platform → Billing → Pricing and click 'Seed defaults'.",
      );
    } else {
      console.log(
        "[billing/pricing] getAllEnrichmentPricing: loaded",
        rawRows.length,
        "rows:",
        rawRows.map((r) => `${r["enrichment_type"]}=credit_cost:${r["credit_cost"]}`).join(", "),
      );
    }

    return rawRows as unknown as EnrichmentPricingDbRow[];
  } catch (err) {
    console.warn("[billing/pricing] getAllEnrichmentPricing unexpected error", err);
    return [];
  }
}

/**
 * Resolve the admin-editable credit cost for one enrichment type.
 *
 * Source priority (the single pricing helper both the Leadinfo route and the
 * first-party billing use, so charges route through the same DB-editable table):
 *   1. enrichment_pricing.credit_cost from the DB (admin-editable, authoritative).
 *   2. `staticFallback` — the compiled default (caller supplies it, typically
 *      getStaticCustomerPrice(featureKey)) when the DB is empty or unreachable.
 *
 * Never throws.
 */
export async function resolveCreditCost(
  client: SupabaseClient,
  enrichmentType: string,
  staticFallback: number,
): Promise<number> {
  try {
    const rows = await getAllEnrichmentPricing(client);
    const row  = rows.find((r) => r.enrichment_type === enrichmentType);
    const dbCost = Number(row?.credit_cost);
    if (Number.isFinite(dbCost) && dbCost > 0) return dbCost;
  } catch { /* fall through to the static fallback */ }
  return staticFallback;
}

/**
 * Fetch all active pricing rows.
 *
 * Tries `enrichment_pricing` first (migration 065 schema).
 * Falls back to `credit_pricing` (legacy schema) when enrichment_pricing is absent.
 * Returns legacy rows normalised to the CreditPricingRow shape for backward compat.
 *
 * Callers in enrichment-tracker.ts should migrate to getAllEnrichmentPricing().
 *
 * @deprecated Prefer getAllEnrichmentPricing() for new code.
 */
export async function getAllActivePricing(
  client: SupabaseClient,
): Promise<CreditPricingRow[]> {
  // Try the canonical enrichment_pricing table first
  const enrichmentRows = await getAllEnrichmentPricing(client);
  if (enrichmentRows.length > 0) {
    // Normalise to CreditPricingRow shape (unit_price → customer_price_cents)
    return enrichmentRows.map((r) => ({
      id:                   r.id,
      feature_key:          r.enrichment_type,
      category:             r.category as "recognition" | "adaptation" | "brainpower",
      customer_price_cents: Math.round(Number(r.unit_price) * 100),
      internal_cost_cents:  r.internal_cost != null ? Math.round(Number(r.internal_cost) * 100) : null,
      billing_unit:         r.billing_unit as CreditPricingRow["billing_unit"],
      description:          r.description ?? null,
      active:               true,
      created_at:           r.created_at,
      updated_at:           r.updated_at,
    }));
  }

  // Legacy fallback: credit_pricing (pre-migration-065)
  try {
    const { data, error } = await client
      .from("credit_pricing")
      .select("*")
      .eq("active", true)
      .order("category")
      .order("feature_key");

    if (error) {
      if (error.code !== "42P01" && error.code !== "PGRST205") {
        console.warn("[billing/pricing] getAllActivePricing legacy fallback error", {
          code: error.code, message: error.message, table: "credit_pricing",
        });
      }
      return [];
    }

    return (data ?? []) as CreditPricingRow[];
  } catch {
    return [];
  }
}

/**
 * Fetch a single pricing row by enrichment_type / feature_key.
 *
 * Tries enrichment_pricing first, then credit_pricing, then static defaults.
 * Server-only — requires a Supabase client.
 */
export async function getCreditPricingRow(
  client:     SupabaseClient,
  featureKey: string,
): Promise<StaticPricingEntry & { fromDb: boolean }> {
  try {
    // Try enrichment_pricing first
    const { data: epData, error: epError } = await client
      .from("enrichment_pricing")
      .select("*")
      .eq("enrichment_type", featureKey)
      .eq("active", true)
      .maybeSingle();

    if (!epError && epData) {
      const r = epData as EnrichmentPricingDbRow;
      return {
        feature_key:          r.enrichment_type,
        category:             r.category as CreditCategory,
        customer_price_cents: Math.round(Number(r.unit_price) * 100),
        internal_cost_cents:  r.internal_cost != null ? Math.round(Number(r.internal_cost) * 100) : null,
        billing_unit:         r.billing_unit as StaticPricingEntry["billing_unit"],
        description:          r.description ?? "",
        fromDb:               true,
      };
    }

    // Fallback to legacy credit_pricing
    const { data, error } = await client
      .from("credit_pricing")
      .select("*")
      .eq("feature_key", featureKey)
      .eq("active", true)
      .maybeSingle();

    if (error || !data) {
      return { ...(CREDIT_PRICING_DEFAULTS[featureKey] ?? _unknownEntry(featureKey)), fromDb: false };
    }

    const row = data as CreditPricingRow;
    return {
      feature_key:          row.feature_key,
      category:             row.category as CreditCategory,
      customer_price_cents: row.customer_price_cents,
      internal_cost_cents:  row.internal_cost_cents,
      billing_unit:         row.billing_unit as StaticPricingEntry["billing_unit"],
      description:          row.description ?? "",
      fromDb:               true,
    };
  } catch {
    return { ...(CREDIT_PRICING_DEFAULTS[featureKey] ?? _unknownEntry(featureKey)), fromDb: false };
  }
}

// ── Internal ──────────────────────────────────────────────────────────────────

function _unknownEntry(featureKey: string): StaticPricingEntry {
  return {
    feature_key:          featureKey,
    category:             "recognition",
    customer_price_cents: 3,
    internal_cost_cents:  null,
    billing_unit:         "per_call",
    description:          `Unknown feature: ${featureKey}`,
  };
}
