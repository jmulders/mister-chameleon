import Link            from "next/link";
import { cookies }     from "next/headers";
import { AdminNav }    from "@/components/admin/AdminNav";
import { AdminShell }  from "@/components/admin/AdminShell";
import { DEV_TENANT_COOKIE } from "@/tenant/dev-tenant-cookie";
import {
  getRequiredAdminSession,
} from "@/lib/admin-auth/authorization";

/**
 * Admin Layout
 *
 * Wraps all /admin routes with a dark sidebar navigation.
 *
 * ─── Theme isolation ─────────────────────────────────────────────────────────
 *
 *   Admin routes never have a [data-site] ancestor so tenant CSS variables do
 *   NOT cascade here. The admin UI always uses stable :root defaults.
 *   `data-admin` is a semantic marker for targeting admin-specific overrides.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const activeTenantId: string | null =
    process.env.NODE_ENV === "development"
      ? ((await cookies()).get(DEV_TENANT_COOKIE)?.value?.trim() ?? null)
      : null;

  // Best-effort session read — layout never throws, pages handle auth
  let userRole: string | null = null;
  let userEmail: string | null = null;
  try {
    const session = await getRequiredAdminSession();
    userRole  = session.role  ?? null;
    userEmail = session.email ?? null;
  } catch {
    // Not yet authenticated — pages will redirect
  }

  const sidebar = (
      <aside className="flex w-64 shrink-0 flex-col bg-slate-950 border-r border-slate-800/60">

        {/* Logo / wordmark */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800/60">
          <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
              <path d="M8 12a4 4 0 0 1 8 0"/>
              <path d="M12 8v1"/>
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white leading-tight truncate">
              Mister Chameleon
            </p>
            <p className="text-[10px] font-medium uppercase tracking-widest text-indigo-400 leading-tight mt-0.5">
              Admin Panel
            </p>
          </div>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700">
          <AdminNav activeTenantId={activeTenantId} role={userRole} />
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800/60 px-4 py-4 space-y-1">
          {userEmail && (
            <div className="flex items-center gap-2.5 mb-3 px-1">
              <div className="flex size-7 items-center justify-center rounded-full bg-slate-700 shrink-0">
                <span className="text-[10px] font-semibold text-slate-200 uppercase">
                  {userEmail[0]}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-300 truncate">{userEmail}</p>
                <p className="text-[10px] text-slate-400 capitalize">{userRole ?? "admin"}</p>
              </div>
            </div>
          )}
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5 shrink-0">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            Dashboard
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5 shrink-0">
              <circle cx="12" cy="12" r="10"/>
              <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            View site
          </Link>
        </div>
      </aside>
  );

  return (
    <div data-admin="" className="flex min-h-screen bg-neutral-50">
      <AdminShell sidebar={sidebar}>
        {children}
      </AdminShell>
    </div>
  );
}
