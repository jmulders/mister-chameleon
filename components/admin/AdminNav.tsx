"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * AdminNav
 *
 * Dark sidebar navigation for the /admin section.
 * Client component — needs `usePathname` for active-link highlighting.
 *
 * Design: dark slate-950 background (set in layout), white/slate text,
 * indigo accent for active state, inline SVG icons for all items.
 */

interface AdminNavProps {
  activeTenantId?: string | null;
  role?: string | null;
}

// ── Inline icon primitives ────────────────────────────────────────────────────

function Svg({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-4 shrink-0", className)}
    >
      {children}
    </svg>
  );
}

const icons = {
  tenants: (
    <Svg>
      <path d="M3 21h18M3 7l9-4 9 4v14M9 21V11h6v10"/>
    </Svg>
  ),
  plus: (
    <Svg>
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 8v8M8 12h8"/>
    </Svg>
  ),
  signups: (
    <Svg>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </Svg>
  ),
  integrations: (
    <Svg>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </Svg>
  ),
  aiLogs: (
    <Svg>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </Svg>
  ),
  context: (
    <Svg>
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
    </Svg>
  ),
  demo: (
    <Svg>
      <polygon points="5 3 19 12 5 21 5 3"/>
    </Svg>
  ),
  import: (
    <Svg>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </Svg>
  ),
  billing: (
    <Svg>
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
      <line x1="1" y1="10" x2="23" y2="10"/>
    </Svg>
  ),
  cms: (
    <Svg>
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </Svg>
  ),
  deployment: (
    <Svg>
      <polyline points="16 16 12 12 8 16"/>
      <line x1="12" y1="12" x2="12" y2="21"/>
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
    </Svg>
  ),
  system: (
    <Svg>
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </Svg>
  ),
  layers: (
    <Svg>
      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
      <polyline points="2 17 12 22 22 17"/>
      <polyline points="2 12 12 17 22 12"/>
    </Svg>
  ),
  users: (
    <Svg>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </Svg>
  ),
  chevronRight: (
    <Svg className="size-3 shrink-0">
      <polyline points="9 18 15 12 9 6"/>
    </Svg>
  ),
};

export function AdminNav({ activeTenantId, role }: AdminNavProps) {
  const isSuperAdmin = role === "superadmin" || role === "admin";
  const pathname = usePathname();

  const INTEGRATIONS_PREFIX = "/admin/platform/integrations";
  const isInIntegrations    = pathname.startsWith(INTEGRATIONS_PREFIX);

  // ── Nav item definitions ────────────────────────────────────────────────────

  const platformItems = [
    { label: "Tenants",       href: "/admin/tenants",           activePrefix: "/admin/tenants",          icon: icons.tenants,      exact: true },
    { label: "New Tenant",    href: "/admin/onboarding",        activePrefix: "/admin/onboarding",       icon: icons.plus },
    { label: "Signups",       href: "/admin/platform/signups",  activePrefix: "/admin/platform/signups", icon: icons.signups,      note: "Trial queue" },
    { label: "Ad pricing",    href: "/admin/platform/ad-pricing", activePrefix: "/admin/platform/ad-pricing", icon: icons.signups, note: "Advertiser CPM/CPC" },
    { label: "Publishers",    href: "/admin/platform/publishers", activePrefix: "/admin/platform/publishers", icon: icons.tenants, note: "Ad revenue share" },
    { label: "Integrations",  href: INTEGRATIONS_PREFIX,        activePrefix: INTEGRATIONS_PREFIX,       icon: icons.integrations },
  ];

  const integrationSubItems = [
    { label: "CMS",        href: `${INTEGRATIONS_PREFIX}/cms`,        activePrefix: `${INTEGRATIONS_PREFIX}/cms`,        note: "Sanity · SB" },
    { label: "CRM",        href: `${INTEGRATIONS_PREFIX}/crm`,        activePrefix: `${INTEGRATIONS_PREFIX}/crm`,        note: "HubSpot" },
    { label: "AI",         href: `${INTEGRATIONS_PREFIX}/ai`,         activePrefix: `${INTEGRATIONS_PREFIX}/ai`,         note: "Anthropic" },
    { label: "Enrichment", href: `${INTEGRATIONS_PREFIX}/enrichment`, activePrefix: `${INTEGRATIONS_PREFIX}/enrichment`, note: "MaxMind" },
    { label: "Domains",    href: `${INTEGRATIONS_PREFIX}/domains`,    activePrefix: `${INTEGRATIONS_PREFIX}/domains`,    note: "Vercel" },
    { label: "Email",      href: `${INTEGRATIONS_PREFIX}/email`,      activePrefix: `${INTEGRATIONS_PREFIX}/email`,      note: "Resend" },
    { label: "Stripe",     href: `${INTEGRATIONS_PREFIX}/stripe`,     activePrefix: `${INTEGRATIONS_PREFIX}/stripe`,     note: "Payments" },
    { label: "Storage",    href: `${INTEGRATIONS_PREFIX}/storage`,    activePrefix: `${INTEGRATIONS_PREFIX}/storage`,    note: "Assets" },
    { label: "Forge",      href: `${INTEGRATIONS_PREFIX}/forge`,      activePrefix: `${INTEGRATIONS_PREFIX}/forge`,      note: "Deploy" },
  ];

  const monitoringItems = [
    { label: "AI Logs",  href: "/admin/ai-logs",  activePrefix: "/admin/ai-logs",  icon: icons.aiLogs,  note: "All tenants" },
    { label: "Context",  href: "/admin/context",  activePrefix: "/admin/context",  icon: icons.context, note: "Platform-wide" },
  ];

  const salesItems = [
    { label: "Prospect Demos",  href: "/admin/demo",                    activePrefix: "/admin/demo",                    icon: icons.demo,   note: "Sales tool" },
    { label: "Demo Importer",   href: "/admin/platform/demo-importer",  activePrefix: "/admin/platform/demo-importer",  icon: icons.import },
  ];

  const systemItems = [
    { label: "Billing",     href: "/admin/platform/billing",     activePrefix: "/admin/platform/billing",     icon: icons.billing,    note: "Plans" },
    { label: "CMS",         href: "/admin/platform/cms",         activePrefix: "/admin/platform/cms",         icon: icons.cms,        note: "Seed" },
    { label: "Deployment",  href: "/admin/platform/deployment",  activePrefix: "/admin/platform/deployment",  icon: icons.deployment },
    { label: "Docs",        href: "/admin/platform/docs",        activePrefix: "/admin/platform/docs",        icon: icons.cms,        note: "Runbooks" },
    { label: "System",      href: "/admin/platform/system",      activePrefix: "/admin/platform/system",      icon: icons.system,     note: "Backup" },
  ];

  const platformDefaultItems = [
    { label: "Adaptive blocks",    href: "/admin/platform/blocks",    activePrefix: "/admin/platform/blocks",    icon: icons.layers,  note: "Catalog" },
    { label: "Variant defaults",   href: "/admin/platform/variants",  activePrefix: "/admin/platform/variants",  icon: icons.layers },
    { label: "Interest defaults",  href: "/admin/interest-profiles",  activePrefix: "/admin/interest-profiles",  icon: icons.layers },
    { label: "Token extractor",    href: "/admin/platform/token-extractor", activePrefix: "/admin/platform/token-extractor", icon: icons.layers, note: "URL → tokens" },
  ];

  // ── NavLink component ───────────────────────────────────────────────────────

  function NavLink({
    href,
    activePrefix,
    label,
    note,
    icon,
    exact,
    indent,
  }: {
    href:         string;
    activePrefix: string;
    label:        string;
    note?:        string;
    icon?:        React.ReactNode;
    exact?:       boolean;
    indent?:      boolean;
  }) {
    const isActive =
      exact || href === "/admin/tenants"
        ? pathname === href
        : pathname.startsWith(activePrefix);

    return (
      <Link
        href={href}
        className={cn(
          "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-all",
          indent && "pl-8",
          isActive
            ? "bg-white/10 text-white font-medium"
            : "text-slate-200 hover:bg-white/[0.06] hover:text-white",
        )}
        aria-current={isActive ? "page" : undefined}
      >
        {/* Left accent bar for active */}
        {isActive && (
          <span className="absolute left-0 w-0.5 h-5 bg-indigo-400 rounded-r-full" />
        )}

        {icon && (
          <span className={cn("shrink-0", isActive ? "text-indigo-400" : "text-slate-300 group-hover:text-white")}>
            {icon}
          </span>
        )}
        <span className="flex-1 truncate text-[13px]">{label}</span>
        {note && (
          <span className={cn("shrink-0 text-[10px]", isActive ? "text-slate-300" : "text-slate-400")}>
            {note}
          </span>
        )}
      </Link>
    );
  }

  function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
      <p className="mb-1 mt-0.5 px-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
        {children}
      </p>
    );
  }

  function Divider() {
    return <div className="my-3 border-t border-slate-800/80" />;
  }

  return (
    <nav aria-label="Admin navigation" className="relative space-y-0.5">

      {/* Platform */}
      <SectionLabel>Platform</SectionLabel>
      {platformItems.map((item) => (
        <div key={item.label} className="relative">
          <NavLink {...item} />
          {item.label === "Integrations" && isInIntegrations && (
            <div className="mt-0.5 mb-1">
              {integrationSubItems.map((sub) => (
                <div key={sub.label} className="relative">
                  <NavLink {...sub} indent />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <Divider />

      {/* Monitoring */}
      <SectionLabel>Monitoring</SectionLabel>
      {monitoringItems.map((item) => (
        <div key={item.label} className="relative">
          <NavLink {...item} />
        </div>
      ))}

      <Divider />

      {/* Sales */}
      <SectionLabel>Sales</SectionLabel>
      {salesItems.map((item) => (
        <div key={item.label} className="relative">
          <NavLink {...item} />
        </div>
      ))}

      <Divider />

      {/* System */}
      <SectionLabel>System</SectionLabel>
      {systemItems.map((item) => (
        <div key={item.label} className="relative">
          <NavLink {...item} />
        </div>
      ))}

      {/* Platform defaults — de-emphasised */}
      <Divider />
      <SectionLabel>Defaults</SectionLabel>
      {platformDefaultItems.map((item) => (
        <div key={item.label} className="relative">
          <NavLink {...item} />
        </div>
      ))}

      {/* Superadmin: Users */}
      {isSuperAdmin && (
        <>
          <Divider />
          <SectionLabel>Administration</SectionLabel>
          <div className="relative">
            <NavLink
              href="/admin/users"
              activePrefix="/admin/users"
              label="Users"
              icon={icons.users}
              note="Superadmin"
            />
          </div>
        </>
      )}

      {/* Dev tenant indicator */}
      {activeTenantId && (
        <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
              Dev override
            </p>
          </div>
          <p className="text-xs font-medium text-amber-200 font-mono truncate">{activeTenantId}</p>
          <Link
            href={`/admin/tenants/${activeTenantId}`}
            className="mt-1.5 block text-[11px] text-amber-400/80 hover:text-amber-300 hover:underline transition-colors"
          >
            Open workspace →
          </Link>
        </div>
      )}
    </nav>
  );
}
