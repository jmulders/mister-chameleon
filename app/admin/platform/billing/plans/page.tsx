/**
 * /admin/platform/billing/plans
 *
 * Plan catalog management — full CRUD for the billing_plans table.
 *
 * ─── What this shows ──────────────────────────────────────────────────────────
 *
 *   A table of all plans (ordered by sort_order) with inline edit forms.
 *   Supports: create, edit, activate/deactivate, reorder, delete (custom plans).
 *
 *   Data source: billing_plans Supabase table (migration 065).
 *   Static fallback: billing/plans.ts BILLING_PLANS (for runtime code paths).
 *
 * ─── Architecture note ────────────────────────────────────────────────────────
 *
 *   This table is the admin UI source of truth.  The runtime billing code
 *   (subscriptions.ts, wallet.ts) still reads billing/plans.ts BILLING_PLANS
 *   as the primary source — the DB table adds admin visibility without
 *   requiring a runtime migration.  See PART 7 note in the acceptance criteria.
 *
 * ─── Access control ───────────────────────────────────────────────────────────
 *
 *   Requires a platform-admin session (getRequiredAdminSession).
 */

import { createClient }            from "@supabase/supabase-js";
import { getRequiredAdminSession } from "@/lib/admin-auth/authorization";
import { BillingNav }              from "@/components/admin/BillingNav";
import { PlansEditor }             from "@/components/admin/PlansEditor";
import type { DbPlan }             from "@/components/admin/PlansEditor";

export const dynamic = "force-dynamic";

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function BillingPlansPage() {
  await getRequiredAdminSession();

  const db = createClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false } },
  );

  // Fetch all plans ordered by sort_order
  const { data, error } = await db
    .from("billing_plans")
    .select("*")
    .order("sort_order", { ascending: true });

  const plans: DbPlan[] = (data ?? []) as DbPlan[];

  const dbUnavailable =
    error &&
    (error.code === "42P01" || error.code === "PGRST205" ||
     String(error.message).includes("42P01"));

  return (
    <div className="max-w-6xl p-8">

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
        <h2 className="text-base font-semibold text-neutral-800">Plan catalog</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Manage subscription plans, pricing, credits, and feature flags. Changes to
          plan prices require matching updates in the Stripe dashboard.
        </p>
      </div>

      {/* ── Migration not applied banner ─────────────────────────────────────── */}
      {dbUnavailable && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-700 font-medium">Migration 065 not yet applied</p>
          <p className="mt-0.5 text-xs text-amber-600">
            The billing_plans table is missing. Run Supabase migration 065 to enable plan management.
            Until then, plans are defined solely in{" "}
            <code className="rounded bg-amber-100 px-1 text-[10px]">billing/plans.ts</code>.
          </p>
        </div>
      )}

      {/* ── Plans editor (client component) ─────────────────────────────────── */}
      {!dbUnavailable && <PlansEditor plans={plans} />}

      {/* ── Runtime note ─────────────────────────────────────────────────────── */}
      <div className="mt-8 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-4">
        <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-2">
          Runtime consistency
        </p>
        <p className="text-xs text-neutral-500 leading-relaxed">
          The runtime billing code (<code className="rounded bg-white border border-neutral-200 px-1">billing/plans.ts</code>,{" "}
          <code className="rounded bg-white border border-neutral-200 px-1">billing/subscriptions.ts</code>) reads from the
          static <code className="rounded bg-white border border-neutral-200 px-1">BILLING_PLANS</code> constants as the primary
          source. This DB table drives the admin UI and is the source of truth for display purposes.
          For full runtime consistency (e.g. dynamic included_credits during period reset), update{" "}
          <code className="rounded bg-white border border-neutral-200 px-1">billing/wallet.ts ensureWallet()</code> to read
          from this table via a{" "}
          <code className="rounded bg-white border border-neutral-200 px-1">getAllActivePlans()</code> helper.
        </p>
      </div>
    </div>
  );
}
