/**
 * Admin — Tenant List
 *
 * All tenants registered on the platform, displayed in a clean
 * table with avatar initials, package badges, and quick-access links.
 */

import Link from "next/link";
import { getAllTenants } from "@/tenant/server";
import { Badge } from "@/components/ui/Badge";
import type { TenantSettings } from "@/tenant/server";
import { TenantDeleteButton } from "./_components/TenantDeleteButton";

// ── Helpers ───────────────────────────────────────────────────────────────────

type BadgeVariant = "default" | "primary" | "success" | "warning" | "error" | "outline";

function packageVariant(key: TenantSettings["packageKey"]): BadgeVariant {
  switch (key) {
    case "starter": return "default";
    case "growth":  return "primary";
    case "pro":     return "success";
  }
}

function aiModeVariant(mode: TenantSettings["ai"]["mode"]): BadgeVariant {
  switch (mode) {
    case "disabled": return "outline";
    case "shadow":   return "warning";
    case "live":     return "success";
  }
}

/** Deterministic pastel colour from tenant ID initial */
function avatarColor(id: string): string {
  const colours = [
    "bg-indigo-100 text-indigo-700",
    "bg-violet-100 text-violet-700",
    "bg-cyan-100 text-cyan-700",
    "bg-emerald-100 text-emerald-700",
    "bg-rose-100 text-rose-700",
    "bg-amber-100 text-amber-700",
    "bg-sky-100 text-sky-700",
    "bg-pink-100 text-pink-700",
  ];
  const idx = (id.charCodeAt(0) ?? 0) % colours.length;
  return colours[idx];
}

// ── Feature pill ──────────────────────────────────────────────────────────────

function FeaturePill({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
        enabled
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
          : "bg-neutral-100 text-neutral-400 border border-neutral-200"
      }`}
    >
      <span className={`size-1.5 rounded-full ${enabled ? "bg-emerald-500" : "bg-neutral-300"}`} />
      {label}
    </span>
  );
}

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
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/80">
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">Tenant</th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">Package</th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">AI Mode</th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">CMS</th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">Features</th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">Status</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {tenants.map((tenant) => {
                  const features    = tenant.features   ?? {};
                  const aiMode      = tenant.ai?.mode   ?? "disabled";
                  const cmsProvider = tenant.cms?.provider ?? "—";
                  const isActive    = !!(features.analytics ?? features.experiments ?? features.ai);
                  const initials    = (tenant.name ?? tenant.tenantId).slice(0, 2).toUpperCase();
                  const color       = avatarColor(tenant.tenantId);

                  return (
                    <tr key={tenant.tenantId} className="group hover:bg-neutral-50/70 transition-colors">

                      {/* Avatar + name */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${color}`}>
                            {initials}
                          </div>
                          <div>
                            <Link
                              href={`/admin/tenants/${tenant.tenantId}`}
                              className="text-sm font-semibold text-neutral-900 hover:text-indigo-600 transition-colors"
                            >
                              {tenant.name ?? tenant.tenantId}
                            </Link>
                            <p className="text-xs font-mono text-neutral-400 mt-0.5">{tenant.tenantId}</p>
                          </div>
                        </div>
                      </td>

                      {/* Package */}
                      <td className="px-5 py-3.5">
                        <Badge variant={packageVariant(tenant.packageKey)} size="sm">
                          {tenant.packageKey}
                        </Badge>
                      </td>

                      {/* AI Mode */}
                      <td className="px-5 py-3.5">
                        <Badge variant={aiModeVariant(aiMode)} size="sm">
                          {aiMode}
                        </Badge>
                      </td>

                      {/* CMS */}
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-neutral-600 capitalize">{cmsProvider}</span>
                      </td>

                      {/* Features */}
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          <FeaturePill enabled={!!features.experiments} label="A/B" />
                          <FeaturePill enabled={!!features.ai}          label="AI"  />
                          <FeaturePill enabled={!!features.analytics}   label="Analytics" />
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <Badge variant={isActive ? "success" : "outline"} size="sm" dot>
                          {isActive ? "Active" : "Trial"}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {tenant.primaryDomain && (
                            <a
                              href={`https://${tenant.primaryDomain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-600 hover:border-neutral-300 hover:text-neutral-900 transition-colors"
                              title="Open site"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                <polyline points="15 3 21 3 21 9"/>
                                <line x1="10" y1="14" x2="21" y2="3"/>
                              </svg>
                              Site
                            </a>
                          )}
                          <Link
                            href={`/admin/tenants/${tenant.tenantId}`}
                            className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
                          >
                            Open
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-3">
                              <polyline points="9 18 15 12 9 6"/>
                            </svg>
                          </Link>
                          <TenantDeleteButton
                            tenantId={tenant.tenantId}
                            tenantName={tenant.name ?? tenant.tenantId}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
