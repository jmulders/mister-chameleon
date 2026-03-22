import Link            from "next/link";
import { cookies }     from "next/headers";
import { AdminNav }    from "@/components/admin/AdminNav";
import { Badge }       from "@/components/ui/Badge";
import { DEV_TENANT_COOKIE } from "@/tenant/dev-tenant-cookie";
import { getActiveTenant }   from "@/tenant/server";

/**
 * Admin Layout
 *
 * Wraps all routes under /admin with a sidebar navigation.
 * Mirrors the structure of the dashboard layout.
 *
 * Not auth-protected in this phase — treated as obscurity-gated
 * until an auth layer is introduced.
 *
 * ─── Tenant-aware nav ─────────────────────────────────────────────────────────
 *
 *   Reads the mc_dev_tenant cookie (development only) and passes the active
 *   tenant ID to AdminNav so tenant-scoped links (Pages, etc.) resolve to the
 *   correct tenant's admin routes rather than a hardcoded default.
 *
 * Structure:
 *   ┌─────────────┬──────────────────────────────┐
 *   │  sidebar    │  main content                │
 *   │  (w-60)     │  (flex-1, scrollable)        │
 *   └─────────────┴──────────────────────────────┘
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read the active dev tenant override from the cookie.
  // Dead-code-eliminated in production (NODE_ENV !== "development").
  const activeTenantId: string | null =
    process.env.NODE_ENV === "development"
      ? ((await cookies()).get(DEV_TENANT_COOKIE)?.value?.trim() ?? null)
      : null;

  // Resolve the active tenant so sidebar branding reflects the current tenant
  // rather than a hardcoded platform name.
  const activeTenant = await getActiveTenant();

  return (
    <div className="flex min-h-screen bg-neutral-50">
      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-neutral-200 bg-white">
        {/* Header */}
        <div className="flex flex-col gap-3 border-b border-neutral-200 px-4 py-5">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-sm font-semibold text-neutral-900 hover:text-brand-700 transition-colors"
            >
              {activeTenant.name}
            </Link>
            <Badge variant="error" size="sm">
              ADMIN
            </Badge>
          </div>
          <p className="text-xs text-neutral-400">Platform Administration</p>
        </div>

        {/* Nav — receives the active dev tenant so it can build tenant-scoped links */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <AdminNav activeTenantId={activeTenantId} />
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2 border-t border-neutral-200 px-4 py-3">
          <p className="text-xs text-neutral-400">
            <Link
              href="/dashboard"
              className="hover:text-neutral-600 transition-colors"
            >
              ← Dashboard
            </Link>
          </p>
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

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
