/**
 * Site Layout  —  app/(site)/layout.tsx
 *
 * Wraps all public-facing pages with the site Header (and, when added,
 * a site-wide Footer).  This layout is NOT inherited by admin or dashboard
 * routes — those live outside the (site) route group and use their own layouts.
 *
 * ─── Route group mechanics ────────────────────────────────────────────────────
 *
 *   The (site) folder is a Next.js App Router route group: the parenthesised
 *   name is stripped from the URL, so pages inside (site)/ resolve to the same
 *   paths they would at the top level:
 *
 *     (site)/page.tsx              → /
 *     (site)/[slug]/page.tsx       → /[slug]
 *     (site)/careers/[slug]/...    → /careers/[slug]
 *     (site)/cases/[slug]/...      → /cases/[slug]
 *     (site)/companies/[slug]/...  → /companies/[slug]
 *     (site)/news/[slug]/...       → /news/[slug]
 *     (site)/vacancies/[slug]/...  → /vacancies/[slug]
 *
 * ─── What this layout does NOT own ───────────────────────────────────────────
 *
 *   Theme injection, font variables, and LeadinfoProvider all live in the root
 *   layout (app/layout.tsx) — they apply to EVERY route, including admin.
 *   This layout adds only the site-specific chrome: Header and Footer.
 *
 * ─── Admin theme isolation — [data-site] scoping ─────────────────────────────
 *
 *   All tenant CSS custom-property blocks in the root layout target the
 *   `[data-site]` attribute selector rather than `:root`.  The `<div data-site>`
 *   wrapper below is the CSS inheritance anchor for those variables: only
 *   elements that are descendants of this div receive the tenant palette,
 *   typography, and spacing tokens.
 *
 *   The wrapper uses `display: contents` (via Tailwind `contents` class) so it
 *   generates no layout box — Header, children, and Footer lay out exactly as
 *   they would without the wrapper.  The element still exists in the DOM and
 *   serves as the CSS inheritance root for all custom properties.
 *
 *   Admin routes live outside (site)/ and therefore never have a [data-site]
 *   ancestor.  They fall back to the stable `:root` defaults in theme.css
 *   (Geist Sans, neutral palette) — a fixed admin design baseline that is
 *   completely immune to tenant theme changes.
 *
 * ─── Preview mode / live preview ─────────────────────────────────────────────
 *
 *   When Next.js draft mode is active (set by /api/preview), this layout
 *   renders a <PreviewBar> client component at the bottom of the viewport.
 *
 *   PreviewBar does two things:
 *     1. Connects to /api/sanity-live (SSE) and listens for Sanity mutations.
 *     2. Calls router.refresh() when a mutation fires so the RSC tree
 *        re-renders with fresh draft content — no manual page reload needed.
 *
 *   For all public (non-preview) visitors, draftMode().isEnabled is false,
 *   so PreviewBar is never included in the React tree.  There is therefore
 *   zero performance impact on public pages.
 */

import { draftMode } from "next/headers";
import { Header, Footer } from "@/components/layout";
import { PreviewBar } from "@/components/preview/PreviewBar";
import { StatamicPreviewWatcher } from "@/components/preview/StatamicPreviewWatcher";
import { ScenarioControlMount } from "@/components/scenario/ScenarioControlMount";
import type { TenantScenarioPanelSettings, TenantScenarioPreset } from "@/tenant/types";
import { CartProvider } from "@/lib/cart/cart-context";
import { PageTracker } from "@/components/tracking/PageTracker";
import { BlockEffectRuntime } from "@/components/platform/BlockEffectRuntime";
import { getActiveTenant, getTenantById } from "@/tenant/server";
import { getRequestThemeDecision } from "@/lib/theme/request-theme";
import type { ResolvedChrome } from "@/components/layout/chrome-bg";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // draftMode() is available in all Server Components (layouts, pages, etc.).
  // isEnabled is true only when the signed preview cookie is present — set
  // by /api/preview and cleared by /api/exit-preview.
  const { isEnabled: isPreview } = await draftMode();

  // Resolve the active tenant so PageTracker can include the correct tenantId
  // in every journey event.  Without this, events on non-homepage pages were
  // stored with tenant_id = "unknown" (getTenantId() read from a script element
  // that was only injected on the homepage), breaking viewed_keywords accumulation
  // and interest profile scoring.
  //
  // getActiveTenant() is lightweight (reads host + cookies, no DB queries).
  // Falls back to a safe default on error — never throws.
  let tenantId = "unknown";
  try {
    const tenant = await getActiveTenant();
    tenantId = tenant.tenantId;
  } catch {
    // Non-fatal — layout must never crash due to tenant resolution failure.
  }

  // Scenario console gate: the operator/demo console is mounted site-wide only
  // when the tenant has turned it on (debug.showScenarioControl). getActiveTenant
  // is DB-free and does not carry debug settings, so read them here; default off
  // so it never appears unintentionally on a live tenant.
  let showScenarioControl = false;
  let scenarioPanel: TenantScenarioPanelSettings | null = null;
  let scenarioPresets: readonly TenantScenarioPreset[] | null = null;
  if (tenantId !== "unknown") {
    try {
      const settings = await getTenantById(tenantId);
      showScenarioControl = settings?.debug?.showScenarioControl === true;
      // Per-tenant curation of what the console offers (presets/roles/time).
      // Absent → null → the panel shows the full built-in lists (current default).
      scenarioPanel = settings?.scenarioPanel ?? null;
      // Per-tenant custom presets (personas), merged into Quick presets. Fail-open
      // normalisation happens client-side in the panel.
      scenarioPresets = settings?.scenarioPresets ?? null;
    } catch {
      // Non-fatal — leave the console off when settings can't be read.
    }
  }

  // Resolved per-request theme — shared (memoised) with the root layout that
  // paints the chrome, so the header/footer LOGO follows the RESOLVED theme
  // (personalisation), not the static base. Null when no contextual theme fired
  // → the chrome is painted from the base default and the logo falls back to it.
  const td = await getRequestThemeDecision();
  const resolvedChrome: ResolvedChrome | null =
    td.contextualThemeKey || td.contextualPresetId
      ? { themeKey: td.contextualThemeKey, presetId: td.contextualPresetId }
      : null;

  return (
    /*
      data-site=""  — CSS inheritance anchor for all [data-site]{…} tenant theme
                      blocks injected by the root layout.  Tenant CSS variables
                      cascade only to descendants of this element; admin routes
                      (which have no [data-site] ancestor) are completely unaffected.

      Renders as a standard block element (not display:contents).
      globals.css applies `background-color: var(--bg)` to [data-site], which
      resolves to the tenant's dark background (e.g. #06060c for Dark AI) because
      --bg is defined on this element by the tenant theme CSS block.  Without a
      rendered box, transparent sections (testimonials, icons-left feature grids,
      etc.) would fall through to the body's white :root default, causing the
      "white sections between dark sections" issue on dark-theme sites.
    */
    <div data-site="">
      {/*
        __mc_tenant__ — inline JSON script element read by getTenantId() in
        client-side tracking helpers (PageTracker, TrackedCTAButton, etc.).
        Injected here so it is available on EVERY (site) page, not just the
        homepage.  Previously this was only in app/(site)/page.tsx, causing all
        non-homepage page_view journey events to store tenant_id = "unknown".
      */}
      <script
        id="__mc_tenant__"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({ tenantId }) }}
      />
      {/*
        Block-effects readiness flag + never-blank failsafe. Added synchronously
        here (before the block content below paints) so entrance effects can start
        hidden without a flash. When JS is disabled this never runs, so content
        stays visible.

        Failsafe: the mc-fx-ready CSS hides every entrance block until the runtime
        reveals it. If the runtime never runs (hydration failure), that would
        leave the whole page blank — so this schedules removal of mc-fx-ready
        after a timeout, which BlockEffectRuntime cancels (__mcFxClearFailsafe)
        once it is alive. Plain inline JS, so it survives even a total React
        hydration failure.
      */}
      <script
        dangerouslySetInnerHTML={{ __html:
          "(function(){var d=document.documentElement;d.classList.add('mc-fx-ready');" +
          "var t=setTimeout(function(){d.classList.remove('mc-fx-ready');},2500);" +
          "window.__mcFxClearFailsafe=function(){clearTimeout(t);};})();"
        }}
      />
      <CartProvider>
      <Header resolvedChrome={resolvedChrome} />
      {children}
      <Footer resolvedChrome={resolvedChrome} />
      {/*
        PreviewBar is a Client Component that establishes an SSE connection and
        triggers live page refreshes on Sanity mutations.  It is intentionally
        rendered AFTER {children} so it sits above the page content in the DOM
        stacking order without affecting the layout flow.
        Only mounted when preview mode is active — invisible to public visitors.
      */}
      {isPreview && <PreviewBar />}
      {/*
        StatamicPreviewWatcher — polls /api/cms-version every 1.5 s and calls
        router.refresh() when CMS content changes.  Only active in development
        AND when the page is inside an iframe (Statamic CP Live Preview).
        Zero-cost for regular visitors.
      */}
      <StatamicPreviewWatcher />
      {/*
        ScenarioControlPanel — floating operator/demo console.
        Mounted only when the tenant enabled it (debug.showScenarioControl). Once
        mounted it still self-guards client-side (dev / NEXT_PUBLIC_SHOW_SCENARIO_PANEL=1
        / ?scenario=true, plus auto-open on an active scenario).
      */}
      {showScenarioControl && <ScenarioControlMount scenarioPanel={scenarioPanel} scenarioPresets={scenarioPresets} />}
      {/*
        PageTracker fires a `page_view` event on every client-side route change.
        Placed in the shared layout so it runs on ALL (site) pages — homepage,
        CMS slug pages, careers, cases, etc.  The component deduplicates by
        pathname so navigating to a page already counted does not double-fire.
      */}
      <PageTracker />
      {/*
        BlockEffectRuntime — the versioned client player for declarative block
        effects. Observes [data-mc-fx] wrappers and reveals them on scroll.
      */}
      <BlockEffectRuntime />
      </CartProvider>
    </div>
  );
}
