/**
 * /admin/platform/billing/pricing
 *
 * Enrichment pricing configuration — reads/writes the `enrichment_pricing`
 * table (migration 065 / 072 canonical schema, fractional EUR values).
 *
 * ─── Data model ───────────────────────────────────────────────────────────────
 *
 *   enrichment_pricing.unit_price  — EUR per call (e.g. 0.030000 = €0.03)
 *   enrichment_pricing.credit_cost — credits per call (e.g. 3.000 or 0.250)
 *   enrichment_pricing.internal_cost — actual provider cost in EUR (nullable)
 *
 * ─── Table status detection ───────────────────────────────────────────────────
 *
 *   The page performs a lightweight schema check before fetching rows:
 *     • 42P01 / PGRST205 → table missing  → show migration banner
 *     • PGRST204          → old schema     → show schema-mismatch banner
 *     • no error          → proceed        → merge DB values with static defaults
 *
 *   After the banner is shown, static defaults are still rendered so the admin
 *   can see current prices without needing the DB to be populated.
 *
 * ─── Merge logic ──────────────────────────────────────────────────────────────
 *
 *   For each key in CREDIT_PRICING_DEFAULTS, the page merges:
 *     • DB row (when present)   → fromDb: true  → green "DB" badge
 *     • Static default (absent) → fromDb: false → "static" badge
 *
 * ─── Access control ───────────────────────────────────────────────────────────
 *
 *   Requires a platform-admin session (getRequiredAdminSession).
 */

import { createClient }              from "@supabase/supabase-js";
import { getRequiredAdminSession }   from "@/lib/admin-auth/authorization";
import { getAllEnrichmentPricing }   from "@/billing/pricing";
import { CREDIT_PRICING_DEFAULTS }   from "@/billing/pricing";
import type { StaticPricingEntry }   from "@/billing/pricing";
import type { EnrichmentPricingDbRow } from "@/billing/types";
import { ENRICHMENT_TYPE_CONFIG }    from "@/billing/enrichment-pricing";
import { PricingEditor }             from "@/components/admin/PricingEditor";
import { BillingNav }                from "@/components/admin/BillingNav";

export const dynamic = "force-dynamic";

// ── PricingDisplayRow — merged DB + static shape passed to PricingEditor ──────

export interface PricingDisplayRow {
  enrichment_type:  string;
  displayName:      string;
  category:         "recognition" | "adaptation" | "brainpower";
  /** EUR per call — e.g. 0.030000 */
  unit_price:       number;
  /** Credits per call — e.g. 3.000 or 0.250 */
  credit_cost:      number;
  /** Actual provider cost in EUR — nullable */
  internal_cost:    number | null;
  billing_unit:     "per_call" | "per_token" | "per_kb" | "per_request";
  description:      string;
  /** true when the value comes from the DB, false when using the static default */
  fromDb:           boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function featureDisplayName(enrichmentType: string): string {
  return (
    (ENRICHMENT_TYPE_CONFIG as Record<string, { displayName?: string }>)[enrichmentType]?.displayName ??
    enrichmentType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PricingConfigPage() {
  await getRequiredAdminSession();

  const db = createClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false } },
  );

  // ── Table status check ──────────────────────────────────────────────────────
  //
  // Select all columns written by upsertEnrichmentPricing / seedDefaultPricing
  // so that any missing column triggers PGRST204 here (not during a seed call).
  //
  //   42P01 / PGRST205 → table missing (migrations 065 + 072 not yet applied)
  //   PGRST204         → column missing — likely `category` (apply migration 075)
  //                      or `unit_price` (old 043 schema; apply migration 072)
  //   no error         → table present with correct schema → proceed

  const { error: schemaCheckError } = await db
    .from("enrichment_pricing")
    .select("id, unit_price, credit_cost, category, billing_unit, label")
    .limit(0);

  const tableMissing =
    !!schemaCheckError &&
    (schemaCheckError.code === "42P01" ||
     schemaCheckError.code === "PGRST205" ||
     String(schemaCheckError.message).includes("42P01"));

  // Detect which column is missing for a more precise banner message.
  const missingColumn =
    !tableMissing && schemaCheckError?.code === "PGRST204"
      ? (String(schemaCheckError.message).match(/the '(\w+)' column/)?.[1] ?? "unknown")
      : null;

  const oldSchema =
    !tableMissing &&
    !!schemaCheckError &&
    (schemaCheckError.code === "PGRST204" ||
     String(schemaCheckError.message).includes("unit_price") ||
     String(schemaCheckError.message).includes("category"));

  // ── Fetch live DB pricing rows ──────────────────────────────────────────────

  // getAllEnrichmentPricing internally handles old-schema detection + errors,
  // returning [] gracefully.  We still call it even when tableMissing/oldSchema
  // so static fallbacks render correctly in the editor below.
  const dbRows: EnrichmentPricingDbRow[] = (!tableMissing && !oldSchema)
    ? await getAllEnrichmentPricing(db)
    : [];

  const dbByKey = Object.fromEntries(dbRows.map((r) => [r.enrichment_type, r]));

  // ── Merge DB values over static defaults ────────────────────────────────────

  const displayRows: PricingDisplayRow[] = Object.keys(CREDIT_PRICING_DEFAULTS).map((key) => {
    const staticEntry: StaticPricingEntry = CREDIT_PRICING_DEFAULTS[key]!;
    const dbRow = dbByKey[key];

    if (dbRow) {
      return {
        enrichment_type: key,
        displayName:     featureDisplayName(key),
        category:        dbRow.category,
        unit_price:      Number(dbRow.unit_price),
        credit_cost:     Number(dbRow.credit_cost),
        internal_cost:   dbRow.internal_cost != null ? Number(dbRow.internal_cost) : null,
        billing_unit:    dbRow.billing_unit,
        description:     dbRow.description ?? staticEntry.description,
        fromDb:          true,
      };
    }

    return {
      enrichment_type: key,
      displayName:     featureDisplayName(key),
      category:        staticEntry.category,
      // Convert static cents-based defaults to fractional EUR
      unit_price:      parseFloat((staticEntry.customer_price_cents / 100).toFixed(6)),
      credit_cost:     parseFloat((staticEntry.customer_price_cents).toFixed(3)),
      internal_cost:   staticEntry.internal_cost_cents != null
        ? parseFloat((staticEntry.internal_cost_cents / 100).toFixed(6))
        : null,
      billing_unit:    staticEntry.billing_unit,
      description:     staticEntry.description,
      fromDb:          false,
    };
  });

  // Sort: recognition → adaptation → brainpower, then alphabetically within
  const categoryOrder: Record<string, number> = { recognition: 0, adaptation: 1, brainpower: 2 };
  displayRows.sort((a, b) => {
    const catDiff = (categoryOrder[a.category] ?? 9) - (categoryOrder[b.category] ?? 9);
    if (catDiff !== 0) return catDiff;
    return a.enrichment_type.localeCompare(b.enrichment_type);
  });

  return (
    <div className="max-w-5xl p-8">

      {/* ── Billing tab navigation ───────────────────────────────────────────── */}
      <div className="mb-2">
        <h1 className="text-xl font-semibold text-neutral-900">Platform Billing</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Manage plans, enrichment pricing, and billing configuration.
        </p>
      </div>

      <BillingNav />

      {/* ── Section header ───────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-neutral-800">Enrichment pricing</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Per-enrichment-type pricing persisted in the{" "}
          <code className="rounded bg-neutral-100 px-1 text-xs">enrichment_pricing</code> table.
          Prices in EUR: supports fractional values like €0.001 per call.
          Changes take effect immediately: no deploy needed.
        </p>
      </div>

      {/* ── Migration banner: table missing ─────────────────────────────────── */}
      {tableMissing && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-700">
            Migration not yet applied: enrichment_pricing table missing
          </p>
          <p className="mt-0.5 text-xs text-amber-600">
            Run <code className="rounded bg-amber-100 px-1">supabase db push</code> to apply
            migrations 065, 072, and 075. Static defaults are shown below, use the Seed button
            after the migration to persist them to the database.
          </p>
        </div>
      )}

      {/* ── Migration banner: column missing ─────────────────────────────────── */}
      {oldSchema && (
        <div className="mb-5 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
          <p className="text-sm font-medium text-orange-700">
            Schema mismatch: enrichment_pricing is missing the{" "}
            <code className="rounded bg-orange-100 px-1 font-mono">
              {missingColumn ?? "unit_price"}
            </code>{" "}
            column
          </p>
          <p className="mt-0.5 text-xs text-orange-600">
            {missingColumn === "category" ? (
              <>
                The <code className="rounded bg-orange-100 px-1">category</code> column
                (recognition / adaptation / brainpower) is absent.
                Run{" "}
                <code className="rounded bg-orange-100 px-1">supabase db push</code>{" "}
                to apply <strong>migration 075</strong> which adds the column and reloads
                the PostgREST schema cache, then use the Seed button to populate rows.
              </>
            ) : (
              <>
                The table exists but uses the old{" "}
                <code className="rounded bg-orange-100 px-1">unit_price_cents</code> column
                instead of <code className="rounded bg-orange-100 px-1">unit_price</code>{" "}
                (NUMERIC EUR).
                Run{" "}
                <code className="rounded bg-orange-100 px-1">supabase db push</code>{" "}
                to apply <strong>migration 072</strong> which replaces the old schema and
                re-seeds canonical data.
              </>
            )}
          </p>
        </div>
      )}

      {/* ── Row count ─────────────────────────────────────────────────────────── */}
      {!tableMissing && !oldSchema && (
        <div className="mb-3 flex items-center gap-3">
          <span className="text-xs text-neutral-400">
            {dbRows.length > 0
              ? `${dbRows.length} row${dbRows.length !== 1 ? "s" : ""} from enrichment_pricing`
              : "No DB rows: static defaults shown below. Use Seed to persist them."}
          </span>
        </div>
      )}

      {/* ── Enrichment pricing editor ─────────────────────────────────────────── */}
      <PricingEditor rows={displayRows} />

    </div>
  );
}
