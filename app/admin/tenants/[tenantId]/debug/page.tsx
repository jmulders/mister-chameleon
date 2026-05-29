/**
 * Admin — Tenant Workspace › Debug
 *
 * Controls the on-site debug overlay visibility for this tenant, plus the
 * development-only tenant override cookie.
 *
 * ─── Sections ─────────────────────────────────────────────────────────────────
 *
 *   1. Debug overlay settings
 *      showDebugOverlay  (boolean)
 *        Master switch.  When false, no debug information is rendered on site.
 *        Default: off — safe default for production.
 *
 *      debugLevel  ("off" | "summary" | "full")
 *        Granularity of debug output when showDebugOverlay is true:
 *          "off"     → same as master switch off
 *          "summary" → compact hero/proof/cta + AI + source info
 *          "full"    → summary + all context variable tables + enrichment detail
 *
 *   2. Dev Controls  (development only — not rendered in production)
 *      Sets / clears the mc_dev_tenant cookie so all routes resolve to this
 *      tenant in the local dev environment without a ?tenant= query param.
 *
 * ─── Safety ───────────────────────────────────────────────────────────────────
 *
 *   Runtime context-building and decision logic is NEVER disabled here — only
 *   the rendered debug output is gated.  Personalisation always works.
 *
 *   No secrets are exposed: API keys, write tokens, and service account
 *   credentials are never included in the rendered output.
 *
 * ─── Persistence ──────────────────────────────────────────────────────────────
 *
 *   Debug overlay settings persist to the `debug` field of the tenant's
 *   TenantSettings JSONB row.  The server action re-reads the stored record
 *   before writing so no other tenant settings are affected.
 */

import { cookies }        from "next/headers";
import { notFound }       from "next/navigation";
import { getTenantById }  from "@/tenant/server";
import { normalizeTenant } from "@/tenant/normalize";
import { DEV_TENANT_COOKIE } from "@/tenant/dev-tenant-cookie";
import { setDevTenantAction, clearDevTenantAction } from "../actions";
import { TenantDebugClient } from "./_components/TenantDebugClient";

export default async function TenantDebugPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  const rawTenant = await getTenantById(tenantId);
  if (!rawTenant) notFound();

  const tenant = normalizeTenant(rawTenant);

  // ── Debug overlay settings ─────────────────────────────────────────────────
  const showDebugOverlay = tenant.debug?.showDebugOverlay ?? false;
  const debugLevel       = tenant.debug?.debugLevel       ?? "full";

  // ── Dev override state (development only) ──────────────────────────────────
  const devActiveTenantId: string | null =
    process.env.NODE_ENV === "development"
      ? ((await cookies()).get(DEV_TENANT_COOKIE)?.value ?? null)
      : null;
  const isActiveDevTenant = devActiveTenantId === tenantId;

  return (
    <div className="p-8 max-w-2xl space-y-10">

      {/* ── 1. Debug overlay ──────────────────────────────────────────────── */}
      <section>
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-neutral-900">Debug Settings</h1>
          <p className="mt-1 text-xs text-neutral-500 leading-relaxed">
            Control whether diagnostic information is rendered on the live site.
            This is a per-tenant setting — it only affects{" "}
            <strong>{tenant.name ?? tenantId}</strong>.
          </p>
        </div>

        <TenantDebugClient
          tenantId={tenantId}
          showDebugOverlay={showDebugOverlay}
          debugLevel={debugLevel}
        />
      </section>

      {/* ── 2. Dev Controls (development only) ───────────────────────────── */}
      {process.env.NODE_ENV === "development" && (
        <DevControlsSection
          tenantId={tenantId}
          isActive={isActiveDevTenant}
          currentOverrideTenantId={devActiveTenantId}
        />
      )}

    </div>
  );
}

// ── DevControlsSection ────────────────────────────────────────────────────────

interface DevControlsSectionProps {
  tenantId:                string;
  isActive:                boolean;
  currentOverrideTenantId: string | null;
}

function DevControlsSection({ tenantId, isActive, currentOverrideTenantId }: DevControlsSectionProps) {
  return (
    <section>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">

        {/* Header */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-amber-900">Dev Controls</span>
          <span className="rounded bg-amber-200 px-1.5 py-0.5 text-xs font-medium text-amber-700">
            Development only
          </span>
          {isActive && (
            <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
              ✓ Active dev tenant
            </span>
          )}
        </div>

        {/* Description */}
        <p className="mb-1 text-xs text-amber-800">
          Set this tenant as the active development override. The{" "}
          <code className="font-mono font-semibold">mc_dev_tenant</code> cookie will
          be set so all routes resolve this tenant without a{" "}
          <code className="font-mono">?tenant=</code> query param.
        </p>
        {!isActive && currentOverrideTenantId && (
          <p className="mb-3 text-xs text-amber-700">
            Currently overriding to:{" "}
            <code className="font-mono font-semibold">{currentOverrideTenantId}</code>
            {" "}— setting this tenant will replace that override.
          </p>
        )}
        {!currentOverrideTenantId && (
          <p className="mb-3 text-xs text-amber-700">
            No override active — tenant currently resolved from the Host header.
          </p>
        )}
        {isActive && (
          <p className="mb-3 text-xs text-amber-700">
            This tenant is the active override. All routes resolve to{" "}
            <code className="font-mono font-semibold">{tenantId}</code> without a{" "}
            <code className="font-mono">?tenant=</code> param.
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {!isActive && (
            <form action={setDevTenantAction.bind(null, tenantId)}>
              <button
                type="submit"
                className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600"
              >
                Use as active dev tenant
              </button>
            </form>
          )}

          {isActive && (
            <form action={clearDevTenantAction.bind(null, tenantId)}>
              <button
                type="submit"
                className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600"
              >
                Clear dev tenant override
              </button>
            </form>
          )}

          {isActive && (
            <a
              href="/dashboard"
              className="inline-flex items-center rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-50"
            >
              View in dashboard →
            </a>
          )}
        </div>

      </div>
    </section>
  );
}
