"use client";

import { usePathname } from "next/navigation";
import Link            from "next/link";
import { Fragment }    from "react";

/**
 * AdminShell
 *
 * Wraps the admin layout so the sidebar is suppressed on auth-only pages
 * (login, 2FA) where there is no authenticated session to act in.
 *
 * A sticky top bar with auto-generated breadcrumbs provides consistent
 * vertical rhythm so page titles never feel flush with the viewport top.
 * The breadcrumb is derived from the current pathname — no manual wiring
 * needed in individual pages.
 */

const AUTH_PREFIXES = ["/admin/login", "/admin/account/security", "/admin/forgot-password", "/admin/reset-password"];

/** Convert a URL segment to a human-readable label. */
function humanize(s: string) {
  return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Sticky breadcrumb bar rendered at the top of every admin page. */
function AdminTopBar() {
  const pathname = usePathname();

  // Derive breadcrumb segments: ["admin", "platform", "demo-importer"] → crumbs
  const parts   = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href: string }[] = parts.map((seg, i) => ({
    label: humanize(seg),
    href:  "/" + parts.slice(0, i + 1).join("/"),
  }));

  return (
    <div className="sticky top-0 z-10 flex-shrink-0 h-11 bg-white border-b border-neutral-100 shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex items-center px-8">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1 text-[11px]">
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <Fragment key={crumb.href}>
                {i > 0 && (
                  <li aria-hidden className="text-neutral-300 select-none mx-0.5">›</li>
                )}
                <li>
                  {isLast ? (
                    <span className="font-medium text-neutral-700">{crumb.label}</span>
                  ) : (
                    <Link
                      href={crumb.href}
                      className="text-neutral-400 hover:text-neutral-600 transition-colors"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </li>
              </Fragment>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}

interface AdminShellProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

export function AdminShell({ sidebar, children }: AdminShellProps) {
  const pathname = usePathname();
  const isAuthPage = AUTH_PREFIXES.some((p) => pathname.startsWith(p));

  if (isAuthPage) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center min-h-screen bg-slate-950">
        {children}
      </main>
    );
  }

  return (
    <>
      {sidebar}
      <main className="flex flex-1 flex-col overflow-y-auto min-w-0">
        <AdminTopBar />
        {children}
      </main>
    </>
  );
}
