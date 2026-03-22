/**
 * Header
 *
 * Async server component that fetches site settings from the CMS and renders
 * the site-wide sticky header.
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

import { createCMSProvider } from "@/cms/providers/create-cms-provider";
import { getActiveTenant }   from "@/tenant/server";
import { Container } from "@/components/primitives";
import { NavBar } from "./NavBar";

export async function Header() {
  // Resolve the active tenant so the CMS query is scoped to the right project
  // and the siteTitle falls back to the tenant's own name when CMS settings
  // are not yet published.
  const activeTenant = await getActiveTenant();

  // Fetch settings — null if the CMS document doesn't exist yet or the
  // provider returns an error. Fallbacks are applied field-by-field below.
  const settings = await createCMSProvider(undefined, activeTenant.tenantId).getSiteSettings();

  const siteTitle      = settings?.siteTitle        ?? activeTenant.name;
  const logoUrl        = settings?.logo?.url        ?? null;
  const logoAlt        = settings?.logo?.alt        ?? siteTitle;
  const mainNavigation = settings?.mainNavigation   ?? [];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-white/95 backdrop-blur-sm">
      <Container>
        <div className="flex h-16 items-center justify-between gap-8">

          {/* ── Brand ─────────────────────────────────────────────────────── */}
          <a
            href="/"
            aria-label={`${siteTitle} — go to homepage`}
            className="shrink-0 focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-4 rounded-sm"
          >
            {logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={logoUrl}
                alt={logoAlt}
                className="h-8 w-auto object-contain"
              />
            ) : (
              <span className="text-base font-semibold text-neutral-900 hover:text-brand-600 transition-colors duration-150">
                {siteTitle}
              </span>
            )}
          </a>

          {/* ── Navigation ────────────────────────────────────────────────── */}
          {/*
           * NavBar receives the resolved items array.
           * If mainNavigation is empty it renders null (no nav element),
           * so the header degrades to brand-only without layout breakage.
           */}
          <NavBar items={mainNavigation} />

        </div>
      </Container>
    </header>
  );
}
