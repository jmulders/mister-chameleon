/**
 * /admin/platform/billing/defaults
 *
 * Platform-wide billing defaults — currency, thresholds, auto-reload config.
 *
 * ─── What this shows ──────────────────────────────────────────────────────────
 *
 *   A single editable form backed by the billing_defaults table (migration 065).
 *   Fields:
 *     • Default currency          — ISO 4217 code; used for new wallet displays
 *     • Low balance threshold     — wallet balance below which notifications fire
 *     • Auto-reload trigger       — wallet balance that triggers auto top-up
 *     • Auto-reload amount        — amount loaded per auto-reload event
 *     • Monthly auto-reload cap   — max auto-reload spend per tenant per month
 *
 * ─── Inheritance model ────────────────────────────────────────────────────────
 *
 *   Defaults apply to NEW tenant wallets at creation time (ensureWallet in
 *   billing/wallet.ts).  Existing wallets are NOT retroactively updated.
 *
 * ─── Access control ───────────────────────────────────────────────────────────
 *
 *   Requires a platform-admin session (getRequiredAdminSession).
 */

import { createClient }                from "@supabase/supabase-js";
import { getRequiredAdminSession }     from "@/lib/admin-auth/authorization";
import { BillingNav }                  from "@/components/admin/BillingNav";
import { BillingDefaultsEditor }       from "@/components/admin/BillingDefaultsEditor";
import type { BillingDefaultsRow }     from "@/components/admin/BillingDefaultsEditor";

export const dynamic = "force-dynamic";

// ── Hard-coded fallback defaults ──────────────────────────────────────────────
//
// Shown when the billing_defaults table is missing or the row doesn't exist yet.
// All values in EUR (migration 065 fractional schema).

const STATIC_DEFAULTS: BillingDefaultsRow = {
  currency:                 "eur",
  low_balance_threshold:    3.000,
  auto_reload_trigger:      2.000,
  auto_reload_amount:       22.000,
  monthly_auto_reload_cap:  null,
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function BillingDefaultsPage() {
  await getRequiredAdminSession();

  const db = createClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false } },
  );

  // Fetch the single defaults row — keyed on `key`, not `id` (id is UUID)
  const { data, error } = await db
    .from("billing_defaults")
    .select("*")
    .eq("key", "default")
    .maybeSingle();

  const dbMissing =
    error &&
    (error.code === "42P01" || error.code === "PGRST205" ||
     String(error.message).includes("42P01"));

  const defaults: BillingDefaultsRow = data
    ? {
        currency:                 data.currency,
        low_balance_threshold:    Number(data.low_balance_threshold),
        auto_reload_trigger:      Number(data.auto_reload_trigger),
        auto_reload_amount:       Number(data.auto_reload_amount),
        monthly_auto_reload_cap:  data.monthly_auto_reload_cap != null ? Number(data.monthly_auto_reload_cap) : null,
      }
    : STATIC_DEFAULTS;

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

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-neutral-800">Billing defaults</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Platform-wide defaults applied to new tenant wallets at creation time.
          Existing wallets retain the values they were created with.
        </p>
      </div>

      {/* ── Migration not applied banner ─────────────────────────────────────── */}
      {dbMissing && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-700 font-medium">Migration 065 not yet applied</p>
          <p className="mt-0.5 text-xs text-amber-600">
            The billing_defaults table is missing. Static defaults are shown below.
            Run Supabase migration 065 to persist edits to the database.
          </p>
        </div>
      )}

      {/* ── Defaults editor ─────────────────────────────────────────────────── */}
      <BillingDefaultsEditor defaults={defaults} />

      {/* ── Explanatory notes ────────────────────────────────────────────────── */}
      <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-4 space-y-2">
        <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">
          How defaults are applied
        </p>
        <ul className="text-xs text-neutral-500 space-y-1.5">
          <li>
            <strong className="text-neutral-600">New wallets</strong> — inherit all defaults
            when a tenant wallet is created via{" "}
            <code className="rounded bg-white border border-neutral-200 px-1">ensureWallet()</code>.
          </li>
          <li>
            <strong className="text-neutral-600">Existing wallets</strong> — not updated. Tenants
            can override auto-reload settings via their wallet settings panel.
          </li>
          <li>
            <strong className="text-neutral-600">Low balance threshold</strong> — when a wallet
            balance drops below this value, a notification is queued via{" "}
            <code className="rounded bg-white border border-neutral-200 px-1">billing/notifications.ts</code>.
          </li>
          <li>
            <strong className="text-neutral-600">Auto-reload</strong> — fires when the wallet
            balance drops below the trigger level. Monthly cap prevents runaway charges.
          </li>
        </ul>
      </div>
    </div>
  );
}
