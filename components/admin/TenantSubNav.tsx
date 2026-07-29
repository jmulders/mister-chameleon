"use client";

import Link        from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn }      from "@/lib/utils";

/**
 * TenantSubNav
 *
 * Two-row navigation for the tenant workspace (/admin/tenants/[tenantId]).
 *
 * Primary row (7 grouped tabs, always visible):
 *   Overview, Design, Content, Personalization, Audience, Platform, Admin.
 *
 * Secondary row shows the sub-items of the active primary group, and only
 * appears when that group has more than one page.
 *
 * Tab ownership (actual):
 *   Content         CMS, Pages, Blueprints, Forms, Email, Assets, Status.
 *   Personalization Slots, Variants, Adaptive blocks, Contextual forms, Rules,
 *                   Experiments, AI.
 *   Audience        Interests, Segments, Target accounts, Leads, Retargeting,
 *                   Suppression, Attribution, Journey, Scoring.
 *
 * The /behavior/* URL tree is split across tabs by concept. behavior/journey
 * and behavior/ (Scoring) belong to Audience, behavior/slots to
 * Personalization, and behavior/ai-policy + behavior/field-fill highlight the
 * Personalization AI item. /forms/context is a Personalization surface even
 * though it lives under /forms (see isGroupActive).
 */

interface TenantSubNavProps {
  tenantId:   string;
  tenantName: string;
  /**
   * When the tenant is an ad account, the workspace shows only the pages that
   * apply to an advertiser (Overview · Ads · Billing · Admin) and hides the
   * personalisation surfaces (Design, Content, Personalization, Audience, most
   * of Platform).
   */
  isAdvertiser?: boolean;
}

interface SubItem {
  label:        string;
  href:         string;
  exact?:       boolean;
  activePrefix: string;
  /**
   * For tab-style sub-items that live on ONE route and switch via ?tab=…
   * (Design). When set, active detection compares the `tab` search param
   * instead of matching a pathname prefix.
   */
  tab?:         string;
  /** The `tab` value that applies when the param is absent (the default tab). */
  tabDefault?:  boolean;
}

interface PrimaryGroup {
  key:      string;
  label:    string;
  href:     string;           // landing page for the group
  prefix:   string;           // pathname prefix that activates this group
  icon:     React.ReactNode;
  items:    SubItem[];        // sub-items (empty = no secondary row)
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0"
    >
      {children}
    </svg>
  );
}

const ICONS = {
  overview: (
    <Svg>
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </Svg>
  ),
  configure: (
    <Svg>
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </Svg>
  ),
  content: (
    <Svg>
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </Svg>
  ),
  audience: (
    <Svg>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </Svg>
  ),
  platform: (
    <Svg>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </Svg>
  ),
  admin: (
    <Svg>
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
      <line x1="1" y1="10" x2="23" y2="10"/>
    </Svg>
  ),
  design: (
    <Svg>
      <path d="M12 2a7 7 0 0 0 0 14 3 3 0 0 1 0 6 10 10 0 1 1 0-20z"/>
      <circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="10.5" r="1"/>
    </Svg>
  ),
  personalization: (
    <Svg>
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
    </Svg>
  ),
};

export function TenantSubNav({ tenantId, tenantName, isAdvertiser = false }: TenantSubNavProps) {
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const base         = `/admin/tenants/${tenantId}`;

  // ── Group definitions ───────────────────────────────────────────────────────

  const fullGroups: PrimaryGroup[] = [
    {
      key:    "overview",
      label:  "Overview",
      href:   base,
      prefix: base,
      icon:   ICONS.overview,
      items:  [],   // no secondary row — single page
    },
    {
      key:    "design",
      label:  "Design",
      href:   `${base}/design`,
      prefix: `${base}/design|${base}/theme-switching`,
      icon:   ICONS.design,
      // Design switches panels via ?tab=… rather than separate routes, but the
      // items render in the shared secondary row so they sit and size exactly
      // like the sub-nav on Content, Personalization, etc.
      items: [
        { label: "Presets",    href: `${base}/design`,                  activePrefix: `${base}/design`, tab: "presets", tabDefault: true },
        { label: "Builder",    href: `${base}/design?tab=builder`,      activePrefix: `${base}/design`, tab: "builder" },
        { label: "Layout",     href: `${base}/design?tab=layout`,       activePrefix: `${base}/design`, tab: "layout" },
        { label: "Typography", href: `${base}/design?tab=typography`,   activePrefix: `${base}/design`, tab: "typography" },
        { label: "Blocks",     href: `${base}/design?tab=blocks`,       activePrefix: `${base}/design`, tab: "blocks" },
        { label: "Advanced",   href: `${base}/design?tab=advanced`,     activePrefix: `${base}/design`, tab: "advanced" },
        { label: "Theme switching", href: `${base}/theme-switching`,    activePrefix: `${base}/theme-switching` },
      ],
    },
    {
      key:    "content",
      label:  "Content",
      href:   `${base}/content`,
      prefix: `${base}/content|${base}/pages|${base}/blueprints|${base}/forms|${base}/assets|${base}/email|${base}/content-status`,
      icon:   ICONS.content,
      items: [
        { label: "CMS",        href: `${base}/content`,    activePrefix: `${base}/content`, exact: true },
        { label: "Pages",      href: `${base}/pages`,      activePrefix: `${base}/pages` },
        { label: "Blueprints", href: `${base}/blueprints`, activePrefix: `${base}/blueprints` },
        { label: "Forms",      href: `${base}/forms`,      activePrefix: `${base}/forms` },
        { label: "Email",      href: `${base}/email`,      activePrefix: `${base}/email` },
        { label: "Assets",     href: `${base}/assets`,     activePrefix: `${base}/assets` },
        { label: "Status",     href: `${base}/content-status`, activePrefix: `${base}/content-status` },
      ],
    },
    {
      key:    "personalization",
      label:  "Personalization",
      href:   `${base}/behavior/slots`,
      prefix: `${base}/behavior/slots|${base}/variants|${base}/blocks|${base}/rules|${base}/experiments|${base}/ai|${base}/context|${base}/behavior/ai-policy|${base}/behavior/field-fill|${base}/forms/context`,
      icon:   ICONS.personalization,
      items: [
        { label: "Slots",           href: `${base}/behavior/slots`, activePrefix: `${base}/behavior/slots` },
        { label: "Variants",        href: `${base}/variants`,       activePrefix: `${base}/variants` },
        { label: "Adaptive blocks", href: `${base}/blocks`,         activePrefix: `${base}/blocks` },
        { label: "Contextual forms", href: `${base}/forms/context`, activePrefix: `${base}/forms/context` },
        { label: "Rules",           href: `${base}/rules`,          activePrefix: `${base}/rules` },
        { label: "Experiments",     href: `${base}/experiments`,    activePrefix: `${base}/experiments` },
        { label: "AI",              href: `${base}/ai`,             activePrefix: `${base}/ai`, exact: true },
      ],
    },
    {
      key:    "audience",
      label:  "Audience",
      href:   `${base}/interest-profiles`,
      prefix: `${base}/interest-profiles|${base}/audience-segments|${base}/behavior/journey|${base}/behavior|${base}/abm|${base}/leads|${base}/ad-sync`,
      icon:   ICONS.audience,
      items: [
        { label: "Interests", href: `${base}/interest-profiles`,    activePrefix: `${base}/interest-profiles` },
        { label: "Segments",  href: `${base}/audience-segments`,    activePrefix: `${base}/audience-segments` },
        { label: "Target accounts", href: `${base}/abm`,            activePrefix: `${base}/abm` },
        { label: "Leads",           href: `${base}/leads`,          activePrefix: `${base}/leads`, exact: true },
        { label: "Retargeting",     href: `${base}/ad-sync`,        activePrefix: `${base}/ad-sync` },
        { label: "Suppression",     href: `${base}/leads/suppression`, activePrefix: `${base}/leads/suppression` },
        { label: "Attribution",     href: `${base}/leads/performance`, activePrefix: `${base}/leads/performance` },
        { label: "Journey",   href: `${base}/behavior/journey`,     activePrefix: `${base}/behavior/journey` },
        { label: "Scoring",   href: `${base}/behavior`,             activePrefix: `${base}/behavior`,         exact: true },
      ],
    },
    {
      key:    "platform",
      label:  "Platform",
      href:   `${base}/integrations`,
      prefix: `${base}/integrations|${base}/snippet|${base}/search|${base}/storage|${base}/debug`,
      icon:   ICONS.platform,
      items: [
        { label: "Integrations", href: `${base}/integrations`,          activePrefix: `${base}/integrations`, exact: true },
        { label: "Pipeline",     href: `${base}/integrations/pipeline`, activePrefix: `${base}/integrations/pipeline` },
        { label: "Calendar",     href: `${base}/integrations/calendar`, activePrefix: `${base}/integrations/calendar` },
        { label: "Snippet",      href: `${base}/snippet`,               activePrefix: `${base}/snippet`, exact: true },
        { label: "Search",       href: `${base}/search`,                activePrefix: `${base}/search` },
        { label: "Storage",      href: `${base}/storage`,               activePrefix: `${base}/storage` },
        { label: "Debug",        href: `${base}/debug`,                 activePrefix: `${base}/debug` },
      ],
    },
    {
      key:    "admin",
      label:  "Admin",
      href:   `${base}/setup`,
      prefix: `${base}/setup|${base}/settings|${base}/billing|${base}/users`,
      icon:   ICONS.admin,
      items: [
        { label: "Setup",    href: `${base}/setup`,    activePrefix: `${base}/setup` },
        { label: "Settings", href: `${base}/settings`, activePrefix: `${base}/settings` },
        { label: "Billing",  href: `${base}/billing`,  activePrefix: `${base}/billing` },
        { label: "Users",    href: `${base}/users`,    activePrefix: `${base}/users` },
      ],
    },
  ];

  // ── Advertiser workspace: only the ad-relevant pages ───────────────────────
  const advertiserGroups: PrimaryGroup[] = [
    { key: "overview", label: "Overview", href: base, prefix: base, icon: ICONS.overview, items: [] },
    {
      key: "ads", label: "Ads", href: `${base}/ads`,
      prefix: `${base}/ads|${base}/publishers`, icon: ICONS.platform,
      items: [
        { label: "Ads",        href: `${base}/ads`,        activePrefix: `${base}/ads`, exact: true },
        { label: "Publishers", href: `${base}/publishers`, activePrefix: `${base}/publishers` },
      ],
    },
    {
      key: "billing", label: "Billing", href: `${base}/billing`,
      prefix: `${base}/billing|${base}/snippet`, icon: ICONS.admin,
      items: [
        { label: "Billing", href: `${base}/billing`, activePrefix: `${base}/billing` },
        { label: "SiteKey",  href: `${base}/snippet`, activePrefix: `${base}/snippet` },
      ],
    },
    {
      key: "admin", label: "Admin", href: `${base}/settings`,
      prefix: `${base}/settings|${base}/users|${base}/integrations`, icon: ICONS.admin,
      items: [
        { label: "Settings",     href: `${base}/settings`,     activePrefix: `${base}/settings` },
        { label: "Integrations", href: `${base}/integrations`, activePrefix: `${base}/integrations` },
        { label: "Users",        href: `${base}/users`,        activePrefix: `${base}/users` },
      ],
    },
  ];

  const groups = isAdvertiser ? advertiserGroups : fullGroups;

  // ── Active group detection ─────────────────────────────────────────────────

  function isGroupActive(group: PrimaryGroup): boolean {
    if (group.key === "overview") {
      // Overview is active only at the exact base path or when NO other group matches
      const anyOtherActive = groups
        .filter((g) => g.key !== "overview")
        .some((g) => isGroupActive(g));
      return !anyOtherActive;
    }
    // /forms/context is a personalisation surface (Contextual forms), even
    // though it lives under the /forms/* path that the Content tab owns. Keep it
    // out of Content so Personalization claims it (and its tab highlights).
    if (group.key === "content" && pathname.startsWith(`${base}/forms/context`)) {
      return false;
    }
    // Multi-prefix groups: check if pathname matches any segment
    return group.prefix.split("|").some((prefix) => pathname.startsWith(prefix));
  }

  function isSubItemActive(item: SubItem): boolean {
    // Tab-style items (Design): one route, panel chosen by ?tab=…
    if (item.tab) {
      if (pathname !== item.activePrefix) return false;
      const current = searchParams.get("tab");
      return current ? current === item.tab : item.tabDefault === true;
    }
    if (item.label === "AI") {
      return (
        pathname === `${base}/ai` ||
        pathname.startsWith(`${base}/ai-`) ||
        pathname.startsWith(`${base}/context`) ||
        pathname.startsWith(`${base}/behavior/ai-policy`) ||
        pathname.startsWith(`${base}/behavior/field-fill`)
      );
    }
    return item.exact ? pathname === item.activePrefix : pathname.startsWith(item.activePrefix);
  }

  const activeGroup = groups.find((g) => isGroupActive(g)) ?? groups[0];

  return (
    <div className="border-b border-neutral-200 bg-white shadow-sm">

      {/* Breadcrumb strip */}
      <div className="flex items-center gap-2 px-6 pt-3.5 pb-0">
        <Link
          href="/admin/tenants"
          className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-indigo-600 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Tenants
        </Link>
        <span className="text-neutral-300 text-xs">/</span>
        <span className="text-sm font-semibold text-neutral-900 truncate max-w-[220px]">
          {tenantName || tenantId}
        </span>
        <code className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[11px] font-mono text-neutral-500 border border-neutral-200">
          {tenantId}
        </code>
      </div>

      {/* Primary tab row */}
      <nav
        className="flex items-center gap-0.5 px-6 pt-2"
        aria-label={`${tenantId} workspace navigation`}
      >
        {groups.map((group) => {
          const active = group.key === activeGroup.key;
          return (
            <Link
              key={group.key}
              href={group.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative -mb-px inline-flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-medium transition-all",
                active
                  ? "border-indigo-600 bg-indigo-50/60 text-indigo-700"
                  : "border-transparent text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800",
              )}
            >
              <span className={active ? "text-indigo-500" : "text-neutral-400"}>
                {group.icon}
              </span>
              {group.label}
            </Link>
          );
        })}
      </nav>

      {/* Secondary sub-nav row — shown only when the active group has items */}
      {activeGroup.items.length > 0 && (
        <div className="flex items-center gap-0 border-t border-neutral-100 bg-neutral-50/50 px-6">
          {activeGroup.items.map((item) => {
            const active = isSubItemActive(item);
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center px-3.5 py-2 text-xs font-medium transition-all border-b-2 -mb-px",
                  active
                    ? "border-indigo-500 text-indigo-700"
                    : "border-transparent text-neutral-500 hover:text-neutral-800",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
