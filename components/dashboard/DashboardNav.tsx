"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * DashboardNav
 *
 * Client component — needs `usePathname` for active-link highlighting.
 *
 * ─── Dev tenant override indicator ───────────────────────────────────────────
 *
 * Accepts an optional `devTenantId` prop (from the async DashboardLayout which
 * reads the mc_dev_tenant cookie server-side).  When non-null, an amber pill is
 * shown above the nav so the developer always knows which tenant is active.
 *
 * Fallback: if `devTenantId` is null but a `?tenant=` query param is present
 * in the current URL (backward compat), that value is used for the indicator
 * and is also propagated into nav link hrefs so the ephemeral override survives
 * sidebar clicks.  This handles the case where a developer navigates directly
 * with `?tenant=` without having set the cookie first.
 *
 * When the cookie-based override is active (devTenantId prop is set), nav links
 * are plain hrefs — the cookie handles tenant resolution on every request.
 *
 * ─── NODE_ENV guard ───────────────────────────────────────────────────────────
 *
 * The `process.env.NODE_ENV === "development"` guard is a compile-time constant
 * in Next.js — the dev-indicator branch is dead-code-eliminated in production.
 * `useSearchParams` still runs in both environments (hooks cannot be
 * conditional) but its result is only used in development.
 */

// ── Nav items ──────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  /** Whether this item is a placeholder (future section). */
  placeholder?: boolean;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: <IconOverview />,
  },
  {
    label: "Sessions",
    href: "/dashboard/sessions",
    icon: <IconSessions />,
  },
  {
    label: "Variants",
    href: "/dashboard/variants",
    icon: <IconVariants />,
  },
  {
    label: "AI",
    href: "/dashboard/ai",
    icon: <IconAI />,
  },
  {
    label: "Tenant Settings",
    href: "/dashboard/tenant",
    icon: <IconSettings />,
  },
  {
    label: "Content Status",
    href: "/dashboard/content-status",
    icon: <IconContentStatus />,
  },
  {
    label: "Experiments",
    href: "/dashboard/experiments",
    icon: <IconExperiments />,
  },
  {
    label: "Rules Editor",
    href: "/dashboard/rules",
    icon: <IconRules />,
  },
  {
    label: "Report Preview",
    href: "/dashboard/reporting-preview",
    icon: <IconReport />,
  },
  {
    label: "New Tenant",
    href: "/dashboard/tenants/new",
    icon: <IconNewTenant />,
  },
];

// ── Component ──────────────────────────────────────────────────────────────

interface DashboardNavProps {
  /**
   * Active development tenant override read from the mc_dev_tenant cookie
   * by the async DashboardLayout.  When set, an amber indicator is displayed
   * and nav links are plain hrefs (the cookie handles resolution).
   *
   * When null, the component checks ?tenant= in the URL as a fallback so
   * that the ephemeral query-param override is still visible and propagated.
   */
  devTenantId?: string | null;
}

export function DashboardNav({ devTenantId = null }: DashboardNavProps) {
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  // ── Resolve effective override ─────────────────────────────────────────
  // Cookie (prop) takes priority; fall back to ?tenant= in the URL.
  // In production this is always null (compile-time constant eliminates the branch).
  const tenantOverride: string | null =
    process.env.NODE_ENV === "development"
      ? (devTenantId ?? searchParams.get("tenant") ?? null)
      : null;

  // Whether the override came from the cookie (vs. the URL query param).
  // When from cookie, nav links are plain hrefs — the cookie handles resolution.
  // When from URL param only, propagate ?tenant= so clicks don't lose it.
  const overrideFromCookie = devTenantId !== null;

  /**
   * Returns the nav href, appending ?tenant=<id> only when a URL-based dev
   * override is active (i.e. no cookie).  Cookie-based overrides need no
   * query param propagation.
   */
  function devHref(href: string): string {
    if (!tenantOverride || overrideFromCookie) return href;
    return `${href}?tenant=${encodeURIComponent(tenantOverride)}`;
  }

  return (
    <nav aria-label="Dashboard navigation">
      {tenantOverride && (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
          <div className="flex items-center justify-between gap-1">
            <span>
              <span className="font-semibold">Dev:</span>{" "}
              <span className="font-mono">{tenantOverride}</span>
            </span>
            {overrideFromCookie && (
              <a
                href={`/admin/tenants/${tenantOverride}`}
                className="shrink-0 text-amber-500 transition-colors hover:text-amber-700"
                title="Manage dev tenant override"
              >
                ✎
              </a>
            )}
          </div>
        </div>
      )}
      <ul className="space-y-0.5">
        {navItems.map((item) => {
          // Exact match for /dashboard; prefix match for sub-routes.
          // Use item.href (not devHref) so ?tenant= doesn't affect active detection.
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <li key={item.href}>
              <Link
                href={devHref(item.href)}
                className={cn(
                  "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand-50 text-brand-700"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <span
                  className={cn(
                    "size-4 shrink-0",
                    isActive ? "text-brand-600" : "text-neutral-400 group-hover:text-neutral-600",
                  )}
                >
                  {item.icon}
                </span>
                {item.label}
                {item.placeholder && (
                  <span className="ml-auto text-xs font-normal text-neutral-400">soon</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ── Inline SVG icons ───────────────────────────────────────────────────────
// Sized to fill their parent (size-4 / size-5 wrapper).

function IconOverview() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="1.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="9.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="1.5" y="9.5" width="5" height="5" rx="1" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
    </svg>
  );
}

function IconSessions() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="8" cy="5" r="2.5" />
      <path d="M2.5 13.5c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5" strokeLinecap="round" />
    </svg>
  );
}

function IconVariants() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M8 2v12M2 8h12" strokeLinecap="round" />
      <circle cx="8" cy="5" r="1.5" />
      <circle cx="8" cy="11" r="1.5" />
      <circle cx="5" cy="8" r="1.5" />
      <circle cx="11" cy="8" r="1.5" />
    </svg>
  );
}

function IconAI() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path
        d="M8 1.5l1.5 3.5 3.5 1.5-3.5 1.5L8 11.5 6.5 8 3 6.5l3.5-1.5z"
        strokeLinejoin="round"
      />
      <path d="M12.5 10.5l.75 1.75 1.75.75-1.75.75-.75 1.75-.75-1.75-1.75-.75 1.75-.75z" strokeLinejoin="round" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="8" cy="8" r="2" />
      <path
        d="M8 1.5v1M8 13.5v1M1.5 8h1M13.5 8h1M3.4 3.4l.7.7M11.9 11.9l.7.7M3.4 12.6l.7-.7M11.9 4.1l.7-.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconContentStatus() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" />
      <path d="M9.5 11.75h5M12 9.5v4.5" strokeLinecap="round" />
    </svg>
  );
}

function IconExperiments() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M5.5 1.5v5L2 13.5h12L10.5 6.5v-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 1.5h8" strokeLinecap="round" />
      <circle cx="6" cy="10" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="9.5" cy="11.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconRules() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M2 4h4M2 8h7M2 12h5" strokeLinecap="round" />
      <path d="M10 7l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconReport() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="2" y="1.5" width="10" height="13" rx="1.5" />
      <path d="M4.5 5h5M4.5 7.5h5M4.5 10h3" strokeLinecap="round" />
      <path d="M11 9.5l1.5 1.5-1.5 1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconNewTenant() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="1.5" y="1.5" width="9" height="11" rx="1.5" />
      <path d="M5 8h4M7 6v4" strokeLinecap="round" />
      <path d="M11.5 5.5h3M13 4v3" strokeLinecap="round" />
    </svg>
  );
}
