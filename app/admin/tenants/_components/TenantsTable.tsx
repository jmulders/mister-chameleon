"use client";

/**
 * TenantsTable — client-side presentation of the tenant overview table.
 *
 * Receives the already-fetched tenants from the server page and renders the
 * same table markup, sliced through usePagination so long tenant lists
 * paginate without a server round-trip.
 *
 * On a phone the seven columns do not fit: the table ran off the screen and
 * its buttons only showed on hover, which a touch screen does not have (seen
 * on 28 Nov 2026). Below md every tenant is a card instead, with its buttons
 * always visible. The delete button is a super admin's only: the action
 * refuses anyone else, so others no longer see a button that cannot work.
 */

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { usePagination, PaginationControls } from "@/components/admin/Pagination";
import { TenantDeleteButton } from "./TenantDeleteButton";
import { parseAvatarConfig, avatarEmojiBgClass } from "@/components/admin/avatar-util";
import type { TenantSettings } from "@/tenant/server";

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

// ── Table ─────────────────────────────────────────────────────────────────────

function TenantAvatar({ tenant }: { tenant: TenantSettings }) {
  const av       = parseAvatarConfig(tenant.avatar ?? null);
  const initials = (tenant.name ?? tenant.tenantId).slice(0, 2).toUpperCase();
  if (av?.kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={av.url} alt="" aria-hidden="true" className="size-8 shrink-0 rounded-lg object-cover" />;
  }
  return (
    <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${av?.kind === "emoji" ? avatarEmojiBgClass(av.color, tenant.tenantId) : avatarColor(tenant.tenantId)}`}>
      {av?.kind === "emoji" ? av.value : initials}
    </div>
  );
}

function SiteLink({ domain }: { domain: string }) {
  return (
    <a
      href={`https://${domain}`}
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
  );
}

function OpenLink({ tenantId }: { tenantId: string }) {
  return (
    <Link
      href={`/admin/tenants/${tenantId}`}
      className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
    >
      Open
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-3">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </Link>
  );
}

export function TenantsTable({ tenants, superAdmin = false }: { tenants: TenantSettings[]; superAdmin?: boolean }) {
  const pager = usePagination(tenants, 25);

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      {/* Phone: one card per tenant. */}
      <ul className="divide-y divide-neutral-100 md:hidden" data-part="tenant-cards">
        {pager.pageItems.map((tenant) => {
          const features = tenant.features ?? {};
          const aiMode   = tenant.ai?.mode ?? "disabled";
          const isActive = !!(features.analytics ?? features.experiments ?? features.ai);
          return (
            <li key={tenant.tenantId} className="px-4 py-4">
              <div className="flex items-center gap-3">
                <TenantAvatar tenant={tenant} />
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/tenants/${tenant.tenantId}`} className="block truncate text-sm font-semibold text-neutral-900 hover:text-indigo-600">
                    {tenant.name ?? tenant.tenantId}
                  </Link>
                  <p className="truncate text-xs font-mono text-neutral-400 mt-0.5">{tenant.tenantId}</p>
                </div>
                <Badge variant={isActive ? "success" : "outline"} size="sm" dot>
                  {isActive ? "Active" : "Trial"}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Badge variant={packageVariant(tenant.packageKey)} size="sm">{tenant.packageKey}</Badge>
                <Badge variant={aiModeVariant(aiMode)} size="sm">AI {aiMode}</Badge>
                {tenant.cms?.provider && <span className="text-xs text-neutral-500 capitalize">{tenant.cms.provider}</span>}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <OpenLink tenantId={tenant.tenantId} />
                {tenant.primaryDomain && <SiteLink domain={tenant.primaryDomain} />}
                {superAdmin && (
                  <TenantDeleteButton tenantId={tenant.tenantId} tenantName={tenant.name ?? tenant.tenantId} />
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* From a tablet up: the table. */}
      <table className="hidden w-full text-left md:table">
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
          {pager.pageItems.map((tenant) => {
            const features    = tenant.features   ?? {};
            const aiMode      = tenant.ai?.mode   ?? "disabled";
            const cmsProvider = tenant.cms?.provider ?? "—";
            const isActive    = !!(features.analytics ?? features.experiments ?? features.ai);
           
            return (
              <tr key={tenant.tenantId} className="group hover:bg-neutral-50/70 transition-colors">

                {/* Avatar + name */}
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <TenantAvatar tenant={tenant} />
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
                  {/* Shown on hover, and on keyboard focus within the row. */}
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                    {tenant.primaryDomain && <SiteLink domain={tenant.primaryDomain} />}
                    <OpenLink tenantId={tenant.tenantId} />
                    {superAdmin && (
                      <TenantDeleteButton
                        tenantId={tenant.tenantId}
                        tenantName={tenant.name ?? tenant.tenantId}
                      />
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="px-5">
        <PaginationControls {...pager} label="tenants" />
      </div>
    </div>
  );
}
