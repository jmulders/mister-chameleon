import { cookies }        from "next/headers";
import { ResponsiveSidebar, SidebarMenuButton } from "@/components/admin/ResponsiveSidebar";
import Link               from "next/link";
import { DashboardNav }   from "@/components/dashboard/DashboardNav";
import { Badge }          from "@/components/ui/Badge";
import { DEV_TENANT_COOKIE } from "@/tenant/dev-tenant-cookie";
import { getActiveTenant } from "@/tenant/server";

/**
 * Dashboard Layout
 *
 * Internal-facing admin/debug area. Not protected in phase 2 — treated as
 * "obscurity-gated" until an auth layer is added.
 *
 * Structure:
 *   ┌─────────────┬──────────────────────────────┐
 *   │  sidebar    │  main content                │
 *   │  (w-60)     │  (flex-1, scrollable)        │
 *   └─────────────┴──────────────────────────────┘
 *
 * The sidebar is sticky/full-height; main content scrolls independently.
 *
 * ─── Dev tenant override ───────────────────────────────────────────────────
 *
 * In development, reads the mc_dev_tenant cookie and passes the active tenant
 * ID (if any) to DashboardNav as a prop.  DashboardNav renders an amber
 * indicator when an override is active.  The cookie is set from the admin
 * tenant detail page — no ?tenant= in URLs is required.
 *
 * Dead-code-eliminated in production (NODE_ENV is a compile-time constant).
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read the active dev tenant override from the cookie (dev only).
  const devTenantId: string | null =
    process.env.NODE_ENV === "development"
      ? ((await cookies()).get(DEV_TENANT_COOKIE)?.value ?? null)
      : null;

  // Resolve the active tenant so sidebar branding reflects the current tenant,
  // not a hardcoded platform name.
  const activeTenant = await getActiveTenant();

  const sidebar = (
      <aside className="flex w-60 shrink-0 flex-col border-r border-neutral-200 bg-white">
        {/* Sidebar header */}
        <div className="flex flex-col gap-3 border-b border-neutral-200 px-4 py-5">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-sm font-semibold text-neutral-900 hover:text-brand-700 transition-colors"
            >
              {activeTenant.name}
            </Link>
            <Badge variant="warning" size="sm">
              INTERNAL
            </Badge>
          </div>
          <p className="text-xs text-neutral-400">Admin &amp; Debug Dashboard</p>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <DashboardNav devTenantId={devTenantId} />
        </div>

        {/* Sidebar footer */}
        <div className="border-t border-neutral-200 px-4 py-3">
          <p className="text-xs text-neutral-400">
            <Link
              href="/"
              className="hover:text-neutral-600 transition-colors"
            >
              ← Back to site
            </Link>
          </p>
        </div>
      </aside>
  );

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <ResponsiveSidebar sidebar={sidebar}>
        {/* ── Main content ──────────────────────────────────────────────────── */}
        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          {/* Below lg the sidebar is a drawer: this bar holds its button. */}
          <div className="sticky top-0 z-10 flex h-11 shrink-0 items-center gap-2 border-b border-neutral-200 bg-white px-4 lg:hidden">
            <SidebarMenuButton />
            <span className="truncate text-sm font-semibold text-neutral-900">{activeTenant.name}</span>
          </div>
          {children}
        </main>
      </ResponsiveSidebar>
    </div>
  );
}
