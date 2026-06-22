/**
 * Header
 *
 * Async server component that fetches site settings from the CMS and renders
 * the site-wide sticky header.
 *
 * ─── Layout variants ─────────────────────────────────────────────────────────
 *
 *   header_default   — logo left, nav links right (sticky) — default
 *   header_centered  — logo centred above nav; nav links below the logo
 *   header_cta       — logo left, nav centre, primary CTA button pinned right
 *   header_triband   — three stacked bands: section tabs / logo+search / main nav
 *
 * ─── Architecture ─────────────────────────────────────────────────────────────
 *
 *   Header is a React Server Component — it fetches data at render time and
 *   passes resolved nav items down as props to the NavBar client component.
 *   This keeps the data-fetching on the server while giving NavBar full access
 *   to browser APIs (useState, event handlers) for dropdown + mobile behaviour.
 *
 *   Header (RSC)
 *     └─ NavBar (client component)
 *          ├─ DesktopNav   — horizontal nav with hover dropdowns
 *          └─ MobileNav    — hamburger toggle + expandable stacked menu
 *
 * ─── Data source ──────────────────────────────────────────────────────────────
 *
 *   createCMSProvider().getSiteSettings() returns a SiteSettingsData object
 *   with mainNavigation pre-resolved (href is a plain string — no further
 *   CMS calls needed at render time).
 *
 *   Fallback behaviour when settings are unavailable:
 *     - siteTitle falls back to activeTenant.name (always defined)
 *     - logo: omitted (title text renders in its place)
 *     - mainNavigation: empty array → NavBar renders null (no nav element)
 *
 * ─── Placement ────────────────────────────────────────────────────────────────
 *
 *   Rendered in app/layout.tsx above {children}. This ensures it is present on
 *   every marketing/public page without repeating it in each page component.
 *   The dashboard subtree has its own layout (app/dashboard/layout.tsx) that
 *   does not include this Header.
 *
 * ─── Caching ─────────────────────────────────────────────────────────────────
 *
 *   getSiteSettings() calls through to the Sanity provider, which tags the
 *   underlying fetch with the "sanity" ISR cache tag. The header re-renders
 *   whenever the site settings document is updated and the webhook triggers
 *   revalidateTag("sanity").
 */

import Link from "next/link";
import { cookies, headers } from "next/headers";
import { createCMSProvider }  from "@/cms/providers/create-cms-provider";
import { getActiveTenant, getTenantByIdCached } from "@/tenant/server";
import { normalizeTenant } from "@/tenant/normalize";
import { getSiteNavigation }  from "@/site/navigation-store";
import { Container } from "@/components/primitives";
import { NavBar, UtilityBar } from "./NavBar";
import { HeaderShell } from "./HeaderShell";
import { CartIconButton } from "./CartIconButton";
import { SearchBar } from "./SearchBar";
import { SectionTabs } from "./SectionTabs";
import { TriBandNav } from "./TriBandNav";
import { resolveContextBlockVariant } from "@/page-config/block-variants";
import type { HeaderLayoutVariant } from "@/page-config/block-variants";
import {
  FEATURED_FAMILY_CONFIGS,
  isFeaturedFamilyKey,
} from "@/design-system/theme/theme-families.config";
import type { NavVariant, NavDensity } from "./NavBar";
import type { HeaderStyle } from "./HeaderShell";
import type { HeaderCtaData, LocaleEntry, NavigationItemData } from "@/cms/types";
import { parseScenarioCookie } from "@/lib/scenario/server-scenario";

// ── Locale fallback ────────────────────────────────────────────────────────────

export interface HeaderProps {
  /**
   * Structural layout variant for the header.
   * Resolved via resolveContextBlockVariant("header", …).
   * Defaults to "header_default" when absent or unrecognised.
   */
  variant?: string;
}

export async function Header({ variant: rawVariant }: HeaderProps = {}) {
  // `layout` starts from the explicit `variant` prop (if any) but may be
  // overridden by the CMS layout_settings global (Layer 1.5) or the tenant DB
  // design setting (Layer 2) further below.  Declared as `let` so those layers
  // can promote it to e.g. "header_triband" when the CMS selects that variant.
  let layout = resolveContextBlockVariant("header", rawVariant) as HeaderLayoutVariant;

  // Resolve the active tenant so the CMS query is scoped to the right project
  // and the siteTitle falls back to the tenant's own name when CMS settings
  // are not yet published.
  const activeTenant = await getActiveTenant();

  // ── Family-driven nav + header personality ────────────────────────────────
  //
  // Layer 1 (family default): read the featuredFamilyKey from the tenant's
  // static theme config.  When a known family is active, its structural
  // navigation variant and header style set the baseline.
  //
  // Layer 2 (tenant override): read headerVariant from TenantDesignSettings
  // (the dynamic DB-stored config).  When present, it takes precedence over
  // the family default.  This lets operators choose a header style in the
  // admin without modifying static config files.
  //
  // Mapping: HeaderVariant → { navVariant, navDensity, headerStyle }
  //   minimal     → flyout / compact  / light
  //   flyout      → flyout / comfortable / light
  //   mega        → mega  / compact  / light
  //   transparent → flyout / comfortable / transparent
  let navVariant: NavVariant    = "flyout";
  let navDensity: NavDensity    = "comfortable";
  let headerStyle: HeaderStyle  = "light";

  // ── Locale (read early so it's available for the settings fetch below) ──────
  const cookieStore = await cookies();
  const locale      = cookieStore.get("locale")?.value ?? "en";

  // Layer 1 — family default
  const familyKey = activeTenant.theme?.featuredFamilyKey;
  if (familyKey && isFeaturedFamilyKey(familyKey)) {
    const { structural } = FEATURED_FAMILY_CONFIGS[familyKey];
    navVariant  = structural.navigation.variant;
    navDensity  = structural.navigation.density;
    headerStyle = structural.header.style;
  }

  // Fetch site settings (CMS) — needed for Layer 1.5 layout override and all
  // site identity / navigation data further below.  We fetch early so the
  // headerVariant fallback is available before Layer 2 overrides it.
  const tenantSettings = await getTenantByIdCached(activeTenant.tenantId);
  const tenantCms = tenantSettings ? normalizeTenant(tenantSettings).cms : undefined;
  const settings = await createCMSProvider(tenantCms, activeTenant.tenantId).getSiteSettings(locale);

  // Layer 1.5 — CMS-level layout override (fallback between family default and
  // tenant DB).  Applied only when the CMS entry has an explicit value and the
  // tenant DB has NOT set one.  The tenant DB (Layer 2) will override this below.
  if (settings?.headerVariant && !tenantSettings?.design.headerVariant) {
    const hv = settings.headerVariant;
    if (hv === "minimal") {
      navVariant  = "flyout";
      navDensity  = "compact";
      headerStyle = "light";
    } else if (hv === "flyout") {
      navVariant  = "flyout";
      navDensity  = "comfortable";
      headerStyle = "light";
    } else if (hv === "mega") {
      navVariant  = "mega";
      navDensity  = "compact";
      headerStyle = "light";
    } else if (hv === "transparent") {
      navVariant  = "flyout";
      navDensity  = "comfortable";
      headerStyle = "transparent";
    } else if (hv === "triband") {
      // Triband is a structural layout change — switch the layout variant.
      // navVariant / navDensity / headerStyle remain at the family default
      // (they are used for band 3 / mobile nav inside the triband layout).
      layout = "header_triband";
    }
  }

  // Layer 2 — tenant-level structural override from the DB-stored design settings.
  // getTenantById() is Next.js-request-memoised so this adds no extra I/O cost.
  if (tenantSettings?.design.headerVariant) {
    const hv = tenantSettings.design.headerVariant;
    if (hv === "minimal") {
      navVariant  = "flyout";
      navDensity  = "compact";
      headerStyle = "light";
    } else if (hv === "flyout") {
      navVariant  = "flyout";
      navDensity  = "comfortable";
      headerStyle = "light";
    } else if (hv === "mega") {
      navVariant  = "mega";
      navDensity  = "compact";
      headerStyle = "light";
    } else if (hv === "transparent") {
      navVariant  = "flyout";
      navDensity  = "comfortable";
      headerStyle = "transparent";
    } else if (hv === "triband") {
      layout = "header_triband";
    }
  }

  // ── Final: CMS triband always wins (structural layout override) ──────────────
  //
  // The triband variant is a full structural change (3 bands).  It should
  // activate whenever the CMS Globals → Layout Settings selects it, even if
  // the tenant DB already has a nav-style variant set (flyout / mega / etc.).
  // Layer 1.5 is skipped when tenantSettings.design.headerVariant is set, so
  // we check unconditionally here as a safety net.
  if (settings?.headerVariant === "triband") {
    layout = "header_triband";
  }

  // ── Scenario-aware header CTA override ───────────────────────────────────────
  //
  // When the ScenarioControlPanel has activated a demo scenario, the mc_scenario
  // cookie carries a _scenarioKey that tells us which persona is being previewed.
  // We use that key to swap the header CTA so the header visually responds to
  // scenario changes on ALL pages — not just the homepage where the pipeline runs.
  //
  // Mapping is intentionally simple and human-readable:
  //   customer / post_conversion / customer_onboarding  → "My account" (login)
  //   customer_expansion / churn_risk / expansion        → "Upgrade plan"
  //   high_intent / trial_ready                          → "Book a meeting"
  //   form_dropoff / form_dropout                        → "Complete request"
  //   All other scenarios                                → keep CMS default
  // Read the mc_scenario cookie value directly, then reconstruct a minimal
  // cookie header string so parseScenarioCookie() can handle URI-decoding + JSON.
  const scenarioRaw = cookieStore.get("mc_scenario")?.value ?? null;
  const scenarioOverrides = scenarioRaw
    ? parseScenarioCookie(`mc_scenario=${scenarioRaw}`)
    : null;
  const scenarioKey = (scenarioOverrides as Record<string, unknown> | null)?.["_scenarioKey"] as string | undefined;

  /** Returns a HeaderCtaData override for demo scenarios, or null for CMS default. */
  function resolveScenarioHeaderCta(key: string | undefined): HeaderCtaData | null {
    if (!key) return null;
    // Customer / post-conversion scenarios → show a "My account" login CTA.
    if (["customer", "post_conversion", "customer_onboarding"].includes(key)) {
      return { label: "My account", href: "/dashboard", openInNewTab: false };
    }
    // Expansion / churn scenarios → nudge toward an upgrade.
    if (["expansion", "customer_expansion", "churn_risk"].includes(key)) {
      return { label: "Upgrade plan", href: "/pricing", openInNewTab: false };
    }
    // High-intent visitors → direct to meeting booking.
    if (["high_intent", "trial_ready"].includes(key)) {
      return { label: "Book a meeting", href: "/contact", openInNewTab: false };
    }
    // Form drop-off → nudge back into the funnel.
    if (["form_dropoff", "form_dropout"].includes(key)) {
      return { label: "Complete request", href: "/contact", openInNewTab: false };
    }
    return null;
  }

  const scenarioCta = resolveScenarioHeaderCta(scenarioKey);

  // `settings` was already fetched above (Layer 1.5 layout) — reuse it here.
  // The `createCMSProvider` call is request-memoised via the platform cache so
  // this is effectively a no-op: we just dereference the already-resolved value.

  const siteTitle       = settings?.siteTitle ?? activeTenant.name;
  // Fallback chain: CMS logo → public/logo.svg → text title.
  // public/logo.svg is a copy of cms/seed/assets/logo-default.svg so the header
  // always shows the brand mark even before Sanity has been seeded.
  const logoUrl         = settings?.logo?.url ?? "/logo.svg";
  const logoAlt         = settings?.logo?.alt ?? siteTitle;
  // Scenario CTA takes precedence over the CMS default when a demo scenario is active.
  const headerCta       = scenarioCta ?? ((settings?.headerCta ?? null) as HeaderCtaData | null);

  const topBar          = settings?.topBar ?? null;
  const sectionTabs     = settings?.sectionTabs ?? null;
  // Pre-fetched per-section nav trees.  Empty object when none are configured.
  const sectionTabNavs  = settings?.sectionTabNavs ?? {};

  // Build top bar utility items in display order: top-bar nav links → legacy
  // utilityLinks → search icon → cart icon.  The label conventions "Search" and
  // "Cart" are detected by UtilityBar to swap the text for the matching SVG icon.
  let utilityItems: NavigationItemData[] = [
    ...(topBar?.links      ?? []),
    ...(settings?.utilityLinks ?? []),
  ] as NavigationItemData[];

  if (topBar?.showSearch) {
    const searchItem: NavigationItemData = {
      id:    "search",
      label: "Search",
      href:  topBar.searchHref ?? "/search",
    };
    utilityItems = [...utilityItems, searchItem];
  }

  if (topBar?.showCart) {
    const cartItem: NavigationItemData = {
      id:    "cart",
      label: "Cart",
      href:  topBar.cartHref ?? "/cart",
    };
    utilityItems = [...utilityItems, cartItem];
  }

  // Top-bar CTA — separate from the main nav CTA (headerCta).
  // topBar.cta is the slim top-strip button; headerCta drives the nav-row layout.
  const topBarCta = (topBar?.cta as HeaderCtaData | null | undefined) ?? null;

  // Only show locales that have showInSwitcher !== false (driven by Statamic
  // Sites "showSite" Custom Attribute). If fewer than 2 such locales exist,
  // hide the switcher entirely — there is nothing to switch to.
  const cmsLocales      = (settings?.locales ?? []) as LocaleEntry[];
  const switcherLocales = cmsLocales.filter((l) => l.showInSwitcher !== false);
  const allLocales      = switcherLocales.length >= 2 ? switcherLocales : [];
  // If the CMS top bar explicitly disables the language switcher, pass no locales.
  const locales         = topBar?.showLanguageSwitcher === false ? [] : allLocales;

  // Navigation fallback chain:
  //   1. CMS mainNavigation (Sanity) — non-empty when CMS has been provisioned.
  //   2. DB nav (site_navigation table) — populated by initializeSite() from
  //      the blueprint's page list.  Shown before CMS content is published.
  //   3. Empty array — no nav links rendered.
  const cmsNav = settings?.mainNavigation ?? [];
  const mainNavigation = cmsNav.length > 0
    ? cmsNav
    : await getSiteNavigation(activeTenant.tenantId);

  // Layer 3 — per-page nav-item header variant override.
  //
  // When the CMS content publisher sets a header_variant on a specific nav item,
  // that value takes highest precedence over all other layers.  This lets the
  // homepage use a transparent header while inner pages use the site default.
  //
  // ─── Two-tier implementation ──────────────────────────────────────────────
  //
  //   Server (here):  handles `headerStyle = "transparent"` which requires a
  //     CSS class on HeaderShell — a server component.  Also sets navVariant /
  //     navDensity for the INITIAL page load (hard refresh / direct URL).
  //
  //   Client (NavBar): handles navVariant / navDensity changes on CLIENT-SIDE
  //     navigation.  The Header lives in a Next.js layout and layouts are NOT
  //     re-rendered on SPA navigation, so the server-side read of `x-pathname`
  //     only fires once.  NavBar uses usePathname() to re-evaluate on every
  //     route change.  See NavBar.tsx — "Per-page nav variant override".
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-pathname") ?? "/";
  const pageNavItem = mainNavigation.find((item) => item.href === pathname);
  if (pageNavItem?.headerVariant) {
    const hv = pageNavItem.headerVariant;
    if (hv === "minimal") {
      navVariant  = "flyout";
      navDensity  = "compact";
      headerStyle = "light";
    } else if (hv === "flyout") {
      navVariant  = "flyout";
      navDensity  = "comfortable";
      headerStyle = "light";
    } else if (hv === "mega") {
      navVariant  = "mega";
      navDensity  = "compact";
      headerStyle = "light";
    } else if (hv === "transparent") {
      navVariant  = "flyout";
      navDensity  = "comfortable";
      headerStyle = "transparent";
    }
  }

  // ── Utility bar — top row ────────────────────────────────────────────────
  // Rendered in HeaderShell's collapsible top strip (collapses on scroll).
  // Placed in a right-aligned strip with a subtle separator from the main nav.
  //
  // Only rendered when topBar is non-null (i.e. at least one top-bar feature
  // is enabled in the CMS globals).  HeaderShell gates on `utilityBar` being
  // defined — passing undefined suppresses the bar and its border entirely.
  // NOTE: The outer div must NOT be a flex container (no "flex justify-end").
  // The Container inside uses "mx-auto w-full max-w-6xl" to centre itself as a
  // block element — exactly the same centering the main nav row uses.  Adding
  // "flex justify-end" on the parent creates a flex formatting context where the
  // Container behaves as a flex item; its auto-margin centering can drift and the
  // two rows no longer share the same horizontal alignment.  Right-aligning the
  // utility items is handled by the inner "flex justify-end" div inside Container.
  const utilityBarNode = topBar != null ? (
    <div className="border-b border-[var(--header-border,var(--border))] py-1">
      <Container>
        <div className="flex justify-end">
          <UtilityBar
            utilityItems={utilityItems}
            headerCta={topBarCta}
            locales={locales}
            currentLocale={locale}
          />
        </div>
      </Container>
    </div>
  ) : undefined;

  // ── Shared brand element ──────────────────────────────────────────────────
  //
  // The logo is rendered with a plain <img>, NOT next/image, for two reasons:
  //   1. SVG — next/image's optimizer REFUSES to serve SVG unless the global
  //      `dangerouslyAllowSVG` flag is on, so an SVG logo uploaded in the CMS
  //      globals would break (400). SVGs are vector — nothing to optimize.
  //   2. Multi-tenant — logo URLs are now ABSOLUTE to the tenant's own CMS host
  //      (e.g. https://cms.steunles.nl/assets/…), because the frontend's
  //      `/assets` proxy only targets a single build-time host. next/image would
  //      reject those cross-origin hosts unless each is added to remotePatterns;
  //      a plain <img> has no such restriction. The footer logo already does this.
  // The /logo.svg public fallback (same-origin) also renders fine as a plain img.
  const BrandLink = (
    <Link
      href="/"
      aria-label={`${siteTitle} — go to homepage`}
      className="shrink-0 flex items-center focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-4 rounded-sm"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl}
        alt={logoAlt}
        width={280}
        height={90}
        className="h-14 w-auto object-contain"
        style={{ width: "auto", height: "3.5rem" }}
      />
    </Link>
  );

  // ── header_triband ─────────────────────────────────────────────────────────
  //
  // Three horizontal bands stacked inside a single sticky header shell:
  //
  //   Band 1 — slim top strip (hidden on mobile):
  //     Left:  section tabs  (e.g. "Website" / "Werken bij")
  //     Right: quick links   (from topBar.links)
  //
  //   Band 2 — identity row:
  //     Left:   logo
  //     Center: search bar  (full text input; submits to searchHref?q=)
  //     Right:  language switcher + CTA button
  //
  //   Band 3 — main navigation:
  //     Full-width horizontal NavBar (same navVariant / navDensity as other layouts)
  //
  //   Mobile: bands 1+2 collapse to logo-left / hamburger-right; band 3 opens
  //   via the existing MobileNav (part of NavBar).
  //
  // Data sources:
  //   sectionTabs   — from settings.sectionTabs  (section_tabs grid in layout_settings global)
  //   quickLinks    — from topBar.links           (top_bar nav tree)
  //   searchHref    — from topBar.searchHref      (defaults to "/search")

  if (layout === "header_triband") {
    const quickLinks  = topBar?.links ?? [];
    const searchHref  = topBar?.searchHref ?? "/search";

    // Language switch + CTA — reuse UtilityBar but without the quicklinks
    // (those live in band 1 instead).  Pass an empty utilityItems array.
    const tribandUtility = (
      <UtilityBar
        utilityItems={[]}
        headerCta={headerCta}
        locales={locales}
        currentLocale={locale}
      />
    );

    return (
      <HeaderShell headerStyle={headerStyle} noBandPadding={true}>
        {/* ── Band 1: section tabs + quick links ───────────────────── */}
        {sectionTabs && sectionTabs.length > 0 && (
          <div
            className="hidden md:block border-b border-[var(--header-border,var(--border))] px-4"
            style={{ backgroundColor: "var(--header-topband-bg, var(--bg-subtle, var(--bg)))" }}
          >
            <Container>
              <SectionTabs tabs={sectionTabs} quickLinks={quickLinks} />
            </Container>
          </div>
        )}

        {/* ── Band 2: logo + search + lang + CTA ───────────────────── */}
        <div className="border-b border-[var(--header-border,var(--border))]">
          <Container>
            <div className="flex items-center gap-4 py-3">

              {/* Logo — left */}
              {BrandLink}

              {/* Search bar — grows to fill center space (hidden on mobile) */}
              <div className="hidden md:flex flex-1 justify-center px-4">
                <SearchBar
                  searchHref={searchHref}
                  placeholder="Zoek op de site…"
                  className="w-full max-w-md"
                />
              </div>

              {/* Lang switch + CTA — right */}
              <div className="hidden md:flex items-center gap-2 shrink-0 ml-auto">
                {tribandUtility}
              </div>

              {/* Mobile: hamburger only — the desktop nav lives in band 3 */}
              <div className="flex md:hidden items-center gap-2 ml-auto">
                <TriBandNav
                  tabs={sectionTabs ?? []}
                  navsByHandle={sectionTabNavs}
                  defaultNav={mainNavigation}
                  navVariant={navVariant}
                  navDensity={navDensity}
                  navFamily={familyKey ?? null}
                  mode="mobile-only"
                />
              </div>

            </div>
          </Container>
        </div>

        {/* ── Band 3: main navigation — desktop only ───────────────── */}
        <div className="hidden md:block">
          <Container>
            <div className="flex items-center pt-4 pb-3">
              <TriBandNav
                tabs={sectionTabs ?? []}
                navsByHandle={sectionTabNavs}
                defaultNav={mainNavigation}
                navVariant={navVariant}
                navDensity={navDensity}
                navFamily={familyKey ?? null}
                mode="desktop-only"
              />
            </div>
          </Container>
        </div>
      </HeaderShell>
    );
  }

  // ── header_centered ────────────────────────────────────────────────────────
  //
  // Logo centred in its own row, nav links arranged symmetrically below.
  // Increases the header height slightly — best for brand-forward sites.

  if (layout === "header_centered") {
    return (
      <HeaderShell headerStyle={headerStyle} utilityBar={utilityBarNode}>
        <Container>
          {/* Two-row: brand centred, nav below. No extra vertical padding —
              HeaderShell's scroll-aware py controls the outer height. */}
          <div className="flex flex-col items-center gap-2">
            {/* Brand centred, cart icon pinned right */}
            <div className="relative w-full flex items-center justify-center">
              {BrandLink}
              <div className="absolute right-0">
                <CartIconButton />
              </div>
            </div>
            {/* Nav — centred below brand */}
            <NavBar items={mainNavigation} navVariant={navVariant} navDensity={navDensity} navFamily={familyKey ?? null} />
          </div>
        </Container>
      </HeaderShell>
    );
  }

  // ── header_cta ─────────────────────────────────────────────────────────────
  //
  // Logo left, nav items centred (using flex-1 spacers), CTA button pinned
  // to the right edge. The CTA label + href comes from the first nav item
  // that has `isPrimary: true`, or the last nav item as a fallback.
  // This pattern is common on SaaS and product marketing sites.

  if (layout === "header_cta") {
    // Separate CTA item from regular nav items.
    // Convention: last navigation item serves as the header CTA in header_cta.
    const ctaItem  = mainNavigation.length > 0 ? mainNavigation[mainNavigation.length - 1] : null;
    const navItems = mainNavigation.length > 1 ? mainNavigation.slice(0, -1) : mainNavigation;

    return (
      <HeaderShell headerStyle={headerStyle} utilityBar={utilityBarNode}>
        <Container>
          <div className="flex items-center gap-6">

            {/* Brand — left */}
            {BrandLink}

            {/* Nav — centre (flex-1 on both sides creates centering) */}
            <div className="flex flex-1 justify-center">
              <NavBar items={navItems} navVariant={navVariant} navDensity={navDensity} navFamily={familyKey ?? null} />
            </div>

            {/* CTA button + cart icon — right */}
            <div className="flex items-center gap-2 shrink-0">
              <CartIconButton />
              {ctaItem && (
                <a
                  href={ctaItem.href}
                  className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
                  style={{ backgroundColor: "var(--btn-bg)" }}
                >
                  {ctaItem.label}
                </a>
              )}
            </div>

          </div>
        </Container>
      </HeaderShell>
    );
  }

  // ── header_default (fallback) ──────────────────────────────────────────────
  //
  // Logo left, nav links right.
  // HeaderShell provides the outer <header> element, sticky positioning,
  // border, background, and the scroll-aware padding transition.

  return (
    <HeaderShell headerStyle={headerStyle} utilityBar={utilityBarNode}>
      <Container>
        <div className="flex items-center justify-between gap-8">

          {/* ── Brand ─────────────────────────────────────────────────────── */}
          {BrandLink}

          {/* ── Navigation ────────────────────────────────────────────────── */}
          <div className="flex items-center gap-2">
            <NavBar items={mainNavigation} navVariant={navVariant} navDensity={navDensity} navFamily={familyKey ?? null} />
            <CartIconButton />
          </div>

        </div>
      </Container>
    </HeaderShell>
  );
}
