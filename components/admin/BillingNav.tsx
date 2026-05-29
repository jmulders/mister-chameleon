"use client";

/**
 * components/admin/BillingNav.tsx
 *
 * Tab navigation rendered at the top of every page in the billing admin section.
 * Client component — uses `usePathname` for active-tab highlighting.
 *
 * ─── Tabs ─────────────────────────────────────────────────────────────────────
 *
 *   Overview   → /admin/platform/billing          (tenant subscriptions + MRR)
 *   Plans      → /admin/platform/billing/plans    (plan catalog CRUD)
 *   Enrichment → /admin/platform/billing/pricing  (credit_pricing table editor)
 *   Defaults   → /admin/platform/billing/defaults (platform-wide billing config)
 */

import Link        from "next/link";
import { usePathname } from "next/navigation";
import { cn }      from "@/lib/utils";

const TABS = [
  {
    label:    "Overview",
    href:     "/admin/platform/billing",
    /** Exact-match so it doesn't stay active when deeper routes are visited. */
    exact:    true,
  },
  {
    label:    "Plans",
    href:     "/admin/platform/billing/plans",
    exact:    false,
  },
  {
    label:    "Enrichment",
    href:     "/admin/platform/billing/pricing",
    exact:    false,
  },
  {
    label:    "Defaults",
    href:     "/admin/platform/billing/defaults",
    exact:    false,
  },
  {
    label:    "Usage",
    href:     "/admin/platform/billing/usage",
    exact:    false,
  },
] as const;

export function BillingNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Billing sections"
      className="mb-7 flex gap-0.5 border-b border-neutral-200"
    >
      {TABS.map(({ label, href, exact }) => {
        const isActive = exact
          ? pathname === href
          : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative -mb-px px-4 py-2.5 text-sm font-medium transition-colors",
              "border-b-2",
              isActive
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
