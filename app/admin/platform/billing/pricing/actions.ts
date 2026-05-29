"use server";

/**
 * app/admin/platform/billing/pricing/actions.ts
 *
 * Server actions for the admin enrichment pricing editor.
 *
 * ─── Canonical table ──────────────────────────────────────────────────────────
 *
 *   All actions read/write the `enrichment_pricing` table (migration 065).
 *   The legacy `credit_pricing` table is no longer used here.
 *
 * ─── Fractional pricing ───────────────────────────────────────────────────────
 *
 *   unit_price     — EUR per call, e.g. 0.030000 = €0.03 or 0.001000 = €0.001
 *   credit_cost    — credits per call, e.g. 3.000 or fractional 0.250
 *   internal_cost  — actual provider cost in EUR (optional)
 *
 * ─── Access control ───────────────────────────────────────────────────────────
 *
 *   Requires a platform-admin session.
 */

import { createClient }            from "@supabase/supabase-js";
import { revalidatePath }          from "next/cache";
import { getRequiredAdminSession } from "@/lib/admin-auth/authorization";
import { CREDIT_PRICING_DEFAULTS } from "@/billing/pricing";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PricingUpdatePayload {
  /** Canonical enrichment type key (e.g. "ip_enrich"). */
  enrichment_type: string;
  label:           string;
  category:        "recognition" | "adaptation" | "brainpower";
  /** EUR per call (e.g. 0.030000). Supports sub-cent fractions. */
  unit_price:      number;
  /** Credits per call (e.g. 3.000 or fractional 0.250). */
  credit_cost:     number;
  /** Actual provider cost in EUR (null if unknown). */
  internal_cost:   number | null;
  billing_unit:    "per_call" | "per_token" | "per_kb" | "per_request";
  description:     string;
}

export interface ActionResult {
  ok:    boolean;
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeClient() {
  return createClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false } },
  );
}

// ── upsertEnrichmentPricing ───────────────────────────────────────────────────

/**
 * Upsert a single enrichment pricing row in enrichment_pricing.
 * ON CONFLICT (enrichment_type) DO UPDATE handles both insert and edit.
 */
export async function upsertEnrichmentPricing(
  payload: PricingUpdatePayload,
): Promise<ActionResult> {
  await getRequiredAdminSession();

  if (payload.unit_price < 0) {
    return { ok: false, error: "Unit price cannot be negative." };
  }
  if (payload.credit_cost < 0) {
    return { ok: false, error: "Credit cost cannot be negative." };
  }
  if (payload.internal_cost !== null && payload.internal_cost < 0) {
    return { ok: false, error: "Internal cost cannot be negative." };
  }
  if (!payload.label.trim()) {
    return { ok: false, error: "Label is required." };
  }

  const db  = makeClient();
  const now = new Date().toISOString();

  const { error } = await db
    .from("enrichment_pricing")
    .upsert(
      {
        enrichment_type: payload.enrichment_type,
        label:           payload.label.trim(),
        category:        payload.category,
        unit_price:      payload.unit_price,
        credit_cost:     payload.credit_cost,
        internal_cost:   payload.internal_cost,
        billing_unit:    payload.billing_unit,
        description:     payload.description,
        billable:        true,
        active:          true,
        updated_at:      now,
      },
      { onConflict: "enrichment_type" },
    );

  if (error) {
    console.error("[pricing/actions] upsertEnrichmentPricing failed:", {
      table: "enrichment_pricing",
      code: error.code,
      message: error.message,
      enrichment_type: payload.enrichment_type,
    });
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/platform/billing/pricing");
  return { ok: true };
}

// ── deleteEnrichmentPricing ───────────────────────────────────────────────────

/**
 * Hard-delete a custom enrichment pricing row.
 * Built-in types (keys in CREDIT_PRICING_DEFAULTS) cannot be deleted — deactivate instead.
 */
export async function deleteEnrichmentPricing(
  enrichmentType: string,
): Promise<ActionResult> {
  await getRequiredAdminSession();

  if (Object.keys(CREDIT_PRICING_DEFAULTS).includes(enrichmentType)) {
    return {
      ok:    false,
      error: `"${enrichmentType}" is a built-in enrichment type. Deactivate it instead of deleting.`,
    };
  }

  const db = makeClient();

  const { error } = await db
    .from("enrichment_pricing")
    .delete()
    .eq("enrichment_type", enrichmentType);

  if (error) {
    console.error("[pricing/actions] deleteEnrichmentPricing failed:", {
      table: "enrichment_pricing",
      code: error.code,
      message: error.message,
      enrichment_type: enrichmentType,
    });
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/platform/billing/pricing");
  return { ok: true };
}

// ── seedDefaultPricing ────────────────────────────────────────────────────────

/**
 * Seed all static defaults into enrichment_pricing without overwriting existing rows.
 * Idempotent — safe to call multiple times.
 *
 * NOTE: uses ignoreDuplicates=true so existing rows (even those with credit_cost=0)
 * are not touched.  Use resetToDefaultPricing() to forcefully overwrite all rows.
 */
export async function seedDefaultPricing(): Promise<ActionResult> {
  await getRequiredAdminSession();

  const db  = makeClient();
  const now = new Date().toISOString();

  const rows = Object.values(CREDIT_PRICING_DEFAULTS).map((entry) => ({
    enrichment_type: entry.feature_key,
    label:           entry.feature_key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    category:        entry.category,
    // Convert from static cents-based defaults to fractional EUR
    unit_price:      parseFloat((entry.customer_price_cents / 100).toFixed(6)),
    credit_cost:     parseFloat((entry.customer_price_cents / 100 * 100).toFixed(3)), // same as credits
    internal_cost:   entry.internal_cost_cents != null
      ? parseFloat((entry.internal_cost_cents / 100).toFixed(6))
      : null,
    billing_unit:    entry.billing_unit,
    description:     entry.description,
    billable:        true,
    active:          true,
    updated_at:      now,
  }));

  const { error } = await db
    .from("enrichment_pricing")
    .upsert(rows, { onConflict: "enrichment_type", ignoreDuplicates: true });

  if (error) {
    console.error("[pricing/actions] seedDefaultPricing failed:", {
      table: "enrichment_pricing",
      code: error.code,
      message: error.message,
    });
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/platform/billing/pricing");
  return { ok: true };
}

// ── resetToDefaultPricing ─────────────────────────────────────────────────────

/**
 * Forcefully overwrite ALL enrichment_pricing rows with the static defaults.
 *
 * Unlike seedDefaultPricing(), this DOES update existing rows — including those
 * whose credit_cost was set to 0 by the schema default (never correctly seeded)
 * or those that were accidentally zeroed by an admin edit.
 *
 * Use this when:
 *   - Transaction History shows "0 cr" for all enrichments (credit_cost was 0).
 *   - Billing is silent even though enrichments are running.
 *   - You want a clean slate from the canonical static defaults.
 *
 * Admin-only.  Existing custom rows with non-default enrichment_types are not touched.
 */
export async function resetToDefaultPricing(): Promise<ActionResult> {
  await getRequiredAdminSession();

  const db  = makeClient();
  const now = new Date().toISOString();

  const rows = Object.values(CREDIT_PRICING_DEFAULTS).map((entry) => ({
    enrichment_type: entry.feature_key,
    label:           entry.feature_key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    category:        entry.category,
    unit_price:      parseFloat((entry.customer_price_cents / 100).toFixed(6)),
    credit_cost:     parseFloat((entry.customer_price_cents / 100 * 100).toFixed(3)),
    internal_cost:   entry.internal_cost_cents != null
      ? parseFloat((entry.internal_cost_cents / 100).toFixed(6))
      : null,
    billing_unit:    entry.billing_unit,
    description:     entry.description,
    billable:        true,
    active:          true,
    updated_at:      now,
  }));

  // ignoreDuplicates: false (default) → ON CONFLICT DO UPDATE — overwrites existing rows.
  const { error } = await db
    .from("enrichment_pricing")
    .upsert(rows, { onConflict: "enrichment_type" });

  if (error) {
    console.error("[pricing/actions] resetToDefaultPricing failed:", {
      table: "enrichment_pricing",
      code: error.code,
      message: error.message,
    });
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/platform/billing/pricing");
  return { ok: true };
}
