"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * AdminNav
 *
 * Sidebar navigation for the /admin section.
 * Client component — needs `usePathname` for active-link highlighting.
 *
 * ─── Tenant-aware routing ─────────────────────────────────────────────────────
 *
 *   Tenant-scoped nav items (e.g. Pages) are resolved in this priority order:
 *
 *   1. The tenantId extracted from the current pathname, e.g.
 *      /admin/tenants/workengine/... → "workengine".
 *      This ensures that when the operator is already viewing a specific
 *      tenant's admin page the nav stays scoped to that same tenant,
 *      regardless of which dev cookie is active.
 *
 *   2. `activeTenantId` prop — the mc_dev_tenant cookie value, passed down
 *      from AdminLayout. Used as fallback when no tenantId is in the URL
 *      (e.g. on /admin/tenants or /admin/ai-logs).
 *
 *   3. Unscoped fallback (e.g. /admin/pages) when neither is available.
 */

interface AdminNavProps {
  /**
   * The currently active dev tenant override, read from the mc_dev_tenant cookie
   * by the AdminLayout server component.  When set, tenant-scoped nav items
   * resolve to this tenant's admin routes instead of the generic fallback.
   */
  activeTenantId?: string | null;
}

export function AdminNav({ activeTenantId }: AdminNavProps) {
  const pathname = usePathname();

  // ── Pathname-based tenant extraction ────────────────────────────────────────
  //
  // When the operator is already on a tenant-scoped admin page
  // (/admin/tenants/<id>[/...]), derive the tenantId from the URL itself.
  // This takes priority over the cookie-based activeTenantId so that clicking
  // "Pages" while viewing /admin/tenants/workengine routes to
  // /admin/tenants/workengine/pages — not the dev-override tenant.
  const pathTenantMatch = pathname.match(/^\/admin\/tenants\/([^/]+)/);
  const pathTenantId    = pathTenantMatch?.[1] ?? null;

  // Effective tenant: URL path first, then dev cookie, then none.
  const effectiveTenantId = pathTenantId ?? activeTenantId ?? null;

  // ── Tenant-scoped href resolver ─────────────────────────────────────────────
  //
  // Returns the correct href for a tenant-scoped admin section.
  // Falls back to the generic admin route when no tenant is determinable.
  function tenantHref(section: string, fallback: string): string {
    return effectiveTenantId
      ? `/admin/tenants/${effectiveTenantId}/${section}`
      : fallback;
  }

  // ── Nav items ───────────────────────────────────────────────────────────────
  //
  // The `activePrefix` controls which pathname prefix triggers the active state.

  const navItems = [
    {
      label:        "Tenants",
      href:         "/admin/tenants",
      activePrefix: "/admin/tenants",
    },
    {
      label:        "New tenant",
      href:         "/admin/onboarding",
      activePrefix: "/admin/onboarding",
    },
    {
      label:        "Pages",
      href:         tenantHref("pages", "/admin/pages"),
      // Active when on any tenant's pages section or the generic /admin/pages
      activePrefix: effectiveTenantId
        ? `/admin/tenants/${effectiveTenantId}/pages`
        : "/admin/pages",
    },
    {
      label:        "AI Logs",
      href:         "/admin/ai-logs",
      activePrefix: "/admin/ai-logs",
    },
  ];

  return (
    <nav aria-label="Admin navigation">
      <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
        Platform
      </p>
      <ul className="space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.activePrefix);

          return (
            <li key={item.label}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand-50 text-brand-700"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
                {/* Show a subtle indicator when the link is tenant-resolved */}
                {item.label === "Pages" && effectiveTenantId && (
                  <span className="ml-auto shrink-0 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium leading-none text-amber-700">
                    {effectiveTenantId}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Active tenant indicator */}
      {activeTenantId && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">
            Dev override active
          </p>
          <p className="mt-0.5 text-xs font-medium text-amber-800">
            {activeTenantId}
          </p>
        </div>
      )}
    </nav>
  );
}
