/**
 * Admin — Tenant List
 *
 * All tenants registered on the platform, displayed in a clean
 * table with avatar initials, package badges, and quick-access links.
 */

import Link from "next/link";
import { getAllTenants } from "@/tenant/server";
import { TenantsTable } from "./_components/TenantsTable";

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-neutral-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-neutral-400">{sub}</p>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminTenantsPage() {
  const tenants = await getAllTenants();

  const activeTenants = tenants.filter(t => !!(t.features?.analytics ?? t.features?.experiments ?? t.features?.ai));
  const proTenants    = tenants.filter(t => t.packageKey === "pro");
  const growthTenants = tenants.filter(t => t.packageKey === "growth");

  return (
    <div className="flex flex-col min-h-full">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="border-b border-neutral-200 bg-white px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">Tenants</h1>
            <p className="mt-0.5 text-sm text-neutral-500">
              All workspaces registered on the platform
            </p>
          </div>
          <Link
            href="/admin/onboarding"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-4">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Tenant
          </Link>
        </div>

        {/* Stats row */}
        <div className="mt-5 grid grid-cols-4 gap-4">
          <StatCard label="Total tenants"    value={tenants.length}         sub="all workspaces" />
          <StatCard label="Active"           value={activeTenants.length}   sub="with features enabled" />
          <StatCard label="Pro / Agency"     value={proTenants.length}      sub="highest tier" />
          <StatCard label="Growth"           value={growthTenants.length}   sub="mid-tier" />
        </div>
      </div>

      {/* ── Tenant table ─────────────────────────────────────────────────── */}
      <div className="flex-1 p-8">
        {tenants.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-white py-16">
            <div className="flex size-12 items-center justify-center rounded-full bg-neutral-100">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-6 text-neutral-400">
                <path d="M3 21h18M3 7l9-4 9 4v14M9 21V11h6v10"/>
              </svg>
            </div>
            <p className="mt-3 text-sm font-medium text-neutral-700">No tenants yet</p>
            <p className="mt-1 text-xs text-neutral-400">Create your first workspace to get started.</p>
            <Link
              href="/admin/onboarding"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
            >
              Create tenant
            </Link>
          </div>
        ) : (
          <TenantsTable tenants={tenants} />
        )}
      </div>
    </div>
  );
}
