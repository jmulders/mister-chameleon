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

import Image from "next/image";
import { cookies } from "next/headers";
import { createCMSProvider }  from "@/cms/providers/create-cms-provider";
import { getActiveTenant, getTenantById } from "@/tenant/server";
import { normalizeTenant } from "@/tenant/normalize";
import { getSiteNavigation }  from "@/site/navigation-store";
import { Container } from "@/components/primitives";
import { NavBar, UtilityBar } from "./NavBar";
import { HeaderShell } from "./HeaderShell";
import { CartIconButton } from "./CartIconButton";
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
// Always show all three supported locales in the language switcher.
// The CMS locales array takes precedence when it has 2+ entries; otherwise we
// fall back to this hard-coded set so the switcher works even before the seed
// has been re-run with the latest locale data.
const FALLBACK_LOCALES: LocaleEntry[] = [
  { code: "en", label: "English" },
  { code: "nl", label: "Nederlands" },
  { code: "de", label: "Deutsch" },
];

export interface HeaderProps {
  /**
   * Structural layout variant for the header.
   * Resolved via resolveContextBlockVariant("header", …).
   * Defaults to "header_default" when absent or unrecognised.
   */
  variant?: string;
}

export async function Header({ variant: rawVariant }: HeaderProps = {}) {
  const layout = resolveContextBlockVariant("header", rawVariant) as HeaderLayoutVariant;

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

  // Layer 1 — family default
  const familyKey = activeTenant.theme?.featuredFamilyKey;
  if (familyKey && isFeaturedFamilyKey(familyKey)) {
    const { structural } = FEATURED_FAMILY_CONFIGS[familyKey];
    navVariant  = structural.navigation.variant;
    navDensity  = structural.navigation.density;
    headerStyle = structural.header.style;
  }

  // Layer 2 — tenant-level structural override from the DB-stored design settings.
  // getTenantById() is Next.js-request-memoised so this adds no extra I/O cost.
  const tenantSettings = await getTenantById(activeTenant.tenantId);
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
    }
  }

  // ── Locale ────────────────────────────────────────────────────────────────
  // Read the active locale from the request cookie set by middleware.
  // Defaults to "en" when no cookie is present (first visit, or unsupported locale).
  const cookieStore = await cookies();
  const locale = cookieStore.get("locale")?.value ?? "en";

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

  // Fetch settings — null if the CMS document doesn't exist yet or the
  // provider returns an error. Fallbacks are applied field-by-field below.
  // Use the tenant's configured CMS provider (not env-priority fallback) so
  // tenants on Storyblok get their Storyblok site-settings, not Sanity's.
  const tenantCms = tenantSettings ? normalizeTenant(tenantSettings).cms : undefined;
  const settings = await createCMSProvider(tenantCms, activeTenant.tenantId).getSiteSettings(locale);

  const siteTitle       = settings?.siteTitle ?? activeTenant.name;
  // Fallback chain: CMS logo → public/logo.svg → text title.
  // public/logo.svg is a copy of cms/seed/assets/logo-default.svg so the header
  // always shows the brand mark even before Sanity has been seeded.
  const logoUrl         = settings?.logo?.url ?? "/logo.svg";
  const logoAlt         = settings?.logo?.alt ?? siteTitle;
  // Scenario CTA takes precedence over the CMS default when a demo scenario is active.
  const headerCta       = scenarioCta ?? ((settings?.headerCta ?? null) as HeaderCtaData | null);
  const utilityItems    = (settings?.utilityLinks ?? []) as NavigationItemData[];
  // Use CMS locales when the document already has 2+ entries; otherwise fall
  // back to the hard-coded set so the switcher is always functional.
  const cmsLocales      = (settings?.locales ?? []) as LocaleEntry[];
  const locales         = cmsLocales.length >= 2 ? cmsLocales : FALLBACK_LOCALES;

  // Navigation fallback chain:
  //   1. CMS mainNavigation (Sanity) — non-empty when CMS has been provisioned.
  //   2. DB nav (site_navigation table) — populated by initializeSite() from
  //      the blueprint's page list.  Shown before CMS content is published.
  //   3. Empty array — no nav links rendered.
  const cmsNav = settings?.mainNavigation ?? [];
  const mainNavigation = cmsNav.length > 0
    ? cmsNav
    : await getSiteNavigation(activeTenant.tenantId);

  // ── Utility bar — top row ────────────────────────────────────────────────
  // Rendered in HeaderShell's collapsible top strip (collapses on scroll).
  // Placed in a right-aligned strip with a subtle separator from the main nav.
  const utilityBarNode = (
    <div className="flex justify-end border-b border-[var(--header-border,var(--border))] py-1">
      <Container>
        <div className="flex justify-end">
          <UtilityBar
            utilityItems={utilityItems}
            headerCta={headerCta}
            locales={locales}
            currentLocale={locale}
          />
        </div>
      </Container>
    </div>
  );

  // ── Shared brand element ──────────────────────────────────────────────────

  const BrandLink = (
    <a
      href="/"
      aria-label={`${siteTitle} — go to homepage`}
      className="shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-4 rounded-sm"
    >
      {/*
       * next/image — automatic WebP conversion, intrinsic size enforcement,
       * and lazy loading (eager here since the logo is above the fold).
       * width/height set to the 2× retina budget for a 32 px display height;
       * actual render size is controlled by the className h-11 (44 px).
       * The Sanity CDN URL already has ?w=160&auto=format baked in by GROQ.
       * Fallback: /logo.svg served from public/ when CMS is not yet seeded.
       */}
      <Image
        src={logoUrl}
        alt={logoAlt}
        width={280}
        height={90}
        priority
        className="h-14 w-auto object-contain"
        style={{ width: "auto", height: "3.5rem" }}
      />
    </a>
  );

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
          {/*
           * NavBar receives the resolved items array and the family-driven
           * nav variant.  If mainNavigation is empty it renders null so the
           * header degrades to brand-only without layout breakage.
           * Utility bar (search, login, language, CTA) is now rendered in the
           * collapsible top strip via HeaderShell's utilityBar prop.
           */}
          <div className="flex items-center gap-2">
            <NavBar items={mainNavigation} navVariant={navVariant} navDensity={navDensity} navFamily={familyKey ?? null} />
            <CartIconButton />
          </div>

        </div>
      </Container>
    </HeaderShell>
  );
}
