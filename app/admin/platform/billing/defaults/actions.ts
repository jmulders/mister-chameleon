"use server";

/**
 * app/admin/platform/billing/defaults/actions.ts
 *
 * Server action for the Billing Defaults editor.
 *
 * ─── Canonical schema (migration 065) ────────────────────────────────────────
 *
 *   All values in EUR (not cents):
 *     low_balance_threshold   — e.g. 3.000 = €3.00
 *     auto_reload_trigger     — e.g. 2.000 = €2.00
 *     auto_reload_amount      — e.g. 22.000 = €22.00
 *     monthly_auto_reload_cap — nullable; null = unlimited
 *
 * ─── Access control ───────────────────────────────────────────────────────────
 *
 *   Requires a platform-admin session (getRequiredAdminSession).
 */

import { createClient }            from "@supabase/supabase-js";
import { revalidatePath }          from "next/cache";
import { getRequiredAdminSession } from "@/lib/admin-auth/authorization";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BillingDefaultsPayload {
  currency:                 string;
  /** EUR (e.g. 3.000 = €3.00). */
  low_balance_threshold:    number;
  /** EUR (e.g. 2.000 = €2.00). */
  auto_reload_trigger:      number;
  /** EUR (e.g. 22.000 = €22.00). */
  auto_reload_amount:       number;
  /** EUR, nullable = unlimited. */
  monthly_auto_reload_cap:  number | null;
}

export interface ActionResult {
  ok:     boolean;
  error?: string;
}

// ── updateBillingDefaults ─────────────────────────────────────────────────────

/**
 * Upsert the platform-wide billing defaults row (key = 'default').
 * All values in EUR.
 */
export async function updateBillingDefaults(
  payload: BillingDefaultsPayload,
): Promise<ActionResult> {
  await getRequiredAdminSession();

  const currency = payload.currency.trim().toLowerCase();
  if (!/^[a-z]{3}$/.test(currency)) {
    return { ok: false, error: "Currency must be a 3-letter ISO 4217 code (e.g. eur, usd)." };
  }
  if (payload.low_balance_threshold < 0) {
    return { ok: false, error: "Low balance threshold cannot be negative." };
  }
  if (payload.auto_reload_trigger < 0) {
    return { ok: false, error: "Auto-reload trigger cannot be negative." };
  }
  if (payload.auto_reload_amount < 0) {
    return { ok: false, error: "Auto-reload amount cannot be negative." };
  }
  if (payload.monthly_auto_reload_cap !== null && payload.monthly_auto_reload_cap < 0) {
    return { ok: false, error: "Monthly cap cannot be negative." };
  }

  const db = createClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false } },
  );

  const { error } = await db
    .from("billing_defaults")
    .upsert(
      {
        key:                      "default",
        currency,
        low_balance_threshold:    payload.low_balance_threshold,
        auto_reload_trigger:      payload.auto_reload_trigger,
        auto_reload_amount:       payload.auto_reload_amount,
        monthly_auto_reload_cap:  payload.monthly_auto_reload_cap,
        updated_at:               new Date().toISOString(),
      },
      { onConflict: "key" },
    );

  if (error) {
    console.error("[defaults/actions] updateBillingDefaults failed:", {
      table: "billing_defaults",
      code: error.code,
      message: error.message,
    });
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/platform/billing/defaults");
  return { ok: true };
}
