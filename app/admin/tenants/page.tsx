/**
 * Admin — Tenant List
 *
 * Displays all tenants registered in the JSON store.
 * Each row links to the detail page at /admin/tenants/[tenantId].
 *
 * Columns:
 *   Tenant ID     — stable slug
 *   Package       — subscription tier (Badge)
 *   AI Mode       — disabled / shadow / live (Badge)
 *   CMS           — provider name
 *   Features      — experiments / AI / analytics (dot indicators)
 *   Status        — derived from analytics flag (Badge)
 */

import Link from "next/link";
import { getAllTenants } from "@/tenant/server";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Text } from "@/components/primitives/Text";
import type { TenantSettings } from "@/tenant/server";

// ── Badge variant helpers ─────────────────────────────────────────────────────

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
    case "live":     return "primary";
  }
}

// ── Feature dot ───────────────────────────────────────────────────────────────

function FeatureDot({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-neutral-500"
      title={`${label}: ${enabled ? "enabled" : "disabled"}`}
    >
      <span
        className={
          enabled
            ? "size-2 rounded-full bg-success-500"
            : "size-2 rounded-full bg-neutral-300"
        }
        aria-hidden
      />
      {label}
    </span>
  );
}

// ── Row component ─────────────────────────────────────────────────────────────

function TenantRow({ tenant }: { tenant: TenantSettings }) {
  const isActive = tenant.features.analytics;

  return (
    <tr className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors">
      {/* Tenant ID / Name */}
      <td className="px-4 py-3">
        <Link
          href={`/admin/tenants/${tenant.tenantId}`}
          className="text-sm font-medium text-brand-700 hover:text-brand-900 hover:underline"
        >
          {tenant.tenantId}
        </Link>
      </td>

      {/* Package */}
      <td className="px-4 py-3">
        <Badge variant={packageVariant(tenant.packageKey)} size="sm">
          {tenant.packageKey}
        </Badge>
      </td>

      {/* AI Mode */}
      <td className="px-4 py-3">
        <Badge variant={aiModeVariant(tenant.ai.mode)} size="sm">
          {tenant.ai.mode}
        </Badge>
      </td>

      {/* CMS */}
      <td className="px-4 py-3">
        <span className="text-sm text-neutral-600">{tenant.cms.provider}</span>
      </td>

      {/* Features */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          <FeatureDot enabled={tenant.features.experiments} label="A/B" />
          <FeatureDot enabled={tenant.features.ai}          label="AI"  />
          <FeatureDot enabled={tenant.features.analytics}   label="Analytics" />
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <Badge variant={isActive ? "success" : "outline"} size="sm" dot>
          {isActive ? "Active" : "Inactive"}
        </Badge>
      </td>

      {/* Detail link */}
      <td className="px-4 py-3 text-right">
        <Link
          href={`/admin/tenants/${tenant.tenantId}`}
          className="text-xs text-neutral-400 hover:text-brand-700 transition-colors"
          aria-label={`View ${tenant.tenantId} details`}
        >
          View →
        </Link>
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminTenantsPage() {
  const tenants = await getAllTenants();

  return (
    <div className="p-8">
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Text variant="h2">Tenants</Text>
          <Text variant="body-sm" color="muted" className="mt-1">
            {tenants.length} tenant{tenants.length !== 1 ? "s" : ""} registered
          </Text>
        </div>
      </div>

      {/* Tenant table */}
      {tenants.length === 0 ? (
        <Card>
          <CardContent>
            <p className="py-8 text-center text-sm text-neutral-400">
              No tenants found. The store may be empty or inaccessible.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Tenant ID
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Package
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    AI Mode
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    CMS
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Features
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Status
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <TenantRow key={tenant.tenantId} tenant={tenant} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
