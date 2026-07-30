/**
 * /admin/tenants/[tenantId]/billing/debug
 *
 * Admin billing debug page — per-request enrichment billing inspection.
 *
 * ─── What this shows ─────────────────────────────────────────────────────────
 *
 *   The 50 most recent usage_events rows for a tenant, grouped by
 *   session_id into per-request cards.  Expanding a card shows the full
 *   per-stage billing table with:
 *
 *     • stage label + enrichment_type
 *     • result: charged / cached / skipped / failed / simulated / free
 *     • cents charged
 *     • wallet balance before/after (when stored in metadata)
 *     • error_code when debit failed
 *
 * ─── Data source ─────────────────────────────────────────────────────────────
 *
 *   `usage_events` table (migration 068) — written by trackEnrichmentUsage()
 *   for every evaluated billable stage, including cache hits and failures.
 *   Grouped in JS by `session_id` (= sessionId passed to trackEnrichmentUsage).
 *
 * ─── Access control ───────────────────────────────────────────────────────────
 *
 *   Requires a platform-admin session (getRequiredAdminSession).
 */

import { createClient }              from "@supabase/supabase-js";
import { getRequiredAdminSession }   from "@/lib/admin-auth/authorization";
import { buildBillingDebugFromDbRows }
  from "@/billing/request-debug";
import type { EnrichmentUsageDbRow } from "@/billing/request-debug";
import { AdminBillingDebugClient }   from "./_components/AdminBillingDebugClient";

export const dynamic = "force-dynamic";

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function BillingDebugPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  await getRequiredAdminSession();

  const { tenantId } = await params;

  const db = createClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false } },
  );

  // Fetch the 200 most recent usage_events rows for this tenant.
  // 200 rows → typically ~25-50 "requests" of 4-8 stages each.
  let rows: EnrichmentUsageDbRow[] = [];
  let fetchError: string | null = null;
  let tableMissing = false;

  const { data, error } = await db
    .from("usage_events")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    const code = error.code ?? "";
    tableMissing = code === "42P01" || code === "PGRST205" ||
      String(error.message).includes("42P01");
    if (!tableMissing) {
      console.error("[billing/debug] usage_events fetch failed", {
        tenantId, code, message: error.message,
      });
      fetchError = `${error.message} (${code})`;
    }
  } else {
    rows = (data ?? []) as EnrichmentUsageDbRow[];
  }

  const requests = buildBillingDebugFromDbRows(rows, tenantId);

  return (
    <div className="max-w-5xl p-8 space-y-6">

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <a
            href={`/admin/tenants/${tenantId}/billing`}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Billing
          </a>
          <a
            href={`/admin/tenants/${tenantId}/billing/usage`}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Usage Dashboard
          </a>
        </div>
        <h1 className="text-xl font-semibold text-neutral-900">Billing Debug</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Per-request enrichment billing inspection for tenant{" "}
          <code className="rounded bg-neutral-100 border border-neutral-200 px-1 font-mono text-xs">
            {tenantId}
          </code>
          . Showing the {rows.length} most recent{" "}
          <code className="rounded bg-neutral-100 border border-neutral-200 px-1 font-mono text-xs">
            usage_events
          </code>{" "}
          records grouped into {requests.length} requests.
        </p>
      </div>

      {/* ── Table missing banner ─────────────────────────────────────────────── */}
      {tableMissing && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-700 font-medium">
            usage_events table not found
          </p>
          <p className="mt-0.5 text-xs text-amber-600">
            Migration 068 has not been applied. Run{" "}
            <code className="rounded bg-amber-100 px-1 font-mono">supabase db push</code>{" "}
            from your project root to apply all pending migrations.
          </p>
        </div>
      )}

      {/* ── Fetch error banner ───────────────────────────────────────────────── */}
      {fetchError && !tableMissing && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700 font-medium">Failed to load billing data</p>
          <p className="mt-0.5 text-xs text-red-600 font-mono">{fetchError}</p>
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────────── */}
      {!tableMissing && !fetchError && requests.length === 0 && (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-8 text-center">
          <p className="text-sm text-neutral-500">No enrichment usage recorded for this tenant yet.</p>
          <p className="mt-1 text-xs text-neutral-400">
            Billing records appear here after the first page load that triggers the enrichment pipeline.
          </p>
        </div>
      )}

      {/* ── Debug client (filterable request list) ───────────────────────────── */}
      {requests.length > 0 && (
        <AdminBillingDebugClient requests={requests} />
      )}

      {/* ── How to read this page ────────────────────────────────────────────── */}
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-4 space-y-2">
        <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">
          How to read this page
        </p>
        <div className="text-xs text-neutral-500 space-y-1.5">
          <p>
            <strong className="text-neutral-700">CHARGED</strong>, debit_wallet RPC ran and
            succeeded. Credits deducted from wallet.
          </p>
          <p>
            <strong className="text-neutral-700">CACHED</strong>, provider-cache hit.
            No real API call; cost = 0. This is correct behaviour.
          </p>
          <p>
            <strong className="text-neutral-700">FAILED</strong>. Stage ran but returned no data,
            or the wallet debit RPC was rejected (e.g. insufficient balance).
          </p>
          <p>
            <strong className="text-neutral-700">SIMULATED</strong>, demo or test_simulated mode.
            DB rows written but wallet balance unchanged.
          </p>
          <p>
            <strong className="text-neutral-700">FREE</strong>. Enrichment type is configured as
            non-billable (ENRICHMENT_TYPE_CONFIG[type].billable = false).
          </p>
          <p>
            <strong className="text-neutral-700">SKIPPED</strong>. Stage not in
            STAGE_LABEL_TO_EVENT_TYPE or pipeline stage was flagged as skipped.
          </p>
          <p className="pt-1 text-neutral-400">
            ⚠ anomaly count indicates why credits may not have been charged, e.g. billing
            disabled, debit RPC unavailable, or wallet insufficient.
          </p>
        </div>
      </div>
    </div>
  );
}
