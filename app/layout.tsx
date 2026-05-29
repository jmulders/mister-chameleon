import type { Metadata } from "next";
import "./globals.css";

import { cookies, headers }      from "next/headers";
import { getActiveTenant, getTenantById } from "@/tenant/server";
import { tenantThemeToCSS }      from "@/design-system/theme/tenant-theme";
import { resolveThemeForTenant, resolvedThemeToCSS } from "@/tenant/resolve-theme";
import { ALL_FONT_VARIABLES, geistSans, geistMono, resolveGoogleFontCss } from "@/lib/fonts";
import { LeadinfoProvider }      from "@/components/tracking/LeadinfoProvider";
import { ConsentBanner }         from "@/components/tracking/ConsentBanner";
import { buildTimeContext }      from "@/context/time";
import { loadTenantRulesConfig } from "@/decision/rules/load-tenant-rules";
import { resolveThemeDecision }  from "@/decision/theme-decision";
import { readThemeSessionCookie, writeThemeSessionCookie } from "@/lib/theme-session";
import { emptyHistory }          from "@/context/visitor-history";
import type { RuleEvaluationContext } from "@/decision/rules/field-registry";
import { THEME_PRESETS, isThemePresetKey, type ThemePresetKey } from "@/design-system/theme/presets";
import {
  parseScenarioCookie,
  applyScenarioToDecisionContext,
} from "@/lib/scenario/server-scenario";

// ── Fonts ─────────────────────────────────────────────────────────────────────
//
// All next/font instances are centralised in lib/fonts.ts — nothing is imported
// directly from "next/font/google" here.
//
// lib/fonts.ts exports:
//   geistSans / geistMono  — shell UI fonts (CSS vars: --font-geist-sans/mono)
//   ALL_FONT_VARIABLES      — space-joined className string of ALL .variable
//                             classes (Geist + 28 variable-weight tenant fonts)
//
// ALL_FONT_VARIABLES is applied to <html> so every @font-face is registered on
// :root before any tenant CSS override runs.  Browsers only download font files
// for fonts actually referenced in computed styles — unused @font-face rules are
// free. Geist variables are included here, so globals.css :root defaults work:
//   --font-sans: var(--font-geist-sans)
//   --font-mono: var(--font-geist-mono)
//
// ── CDN-loaded fixed-weight fonts ─────────────────────────────────────────────
//
// 15 fixed-weight fonts (those requiring an explicit `weight:[]` array in
// next/font/google) are excluded from lib/fonts.ts to prevent a Next.js 16 +
// Turbopack build error:
//
//   Module not found: Can't resolve
//   '@vercel/turbopack-next/internal/font/google/font'
//
// These fonts are instead loaded via <link rel="stylesheet"> from the Google
// Fonts CDN (see <head> below). They remain available to tenants via their
// literal CSS name (e.g. font-family: 'Roboto') — CDN @font-face declarations
// satisfy browser lookups. resolveGoogleFontCss() returns null for them, which
// is correct: --font-* stays as the raw font-stack string and the browser
// resolves it via the CDN @font-face.
//
// ── Four-layer font injection ─────────────────────────────────────────────────
//
//   Layer A — tenantThemeToCSS()      : base TenantTheme vars (hardcoded theme)
//   Layer B — resolvedThemeToCSS()    : token override delta (visual editor)
//   Layer C — resolveGoogleFontCss()  : --font-sans → var(--font-inter) redirects
//   Layer D — generateCustomFontCss() : tenant-uploaded woff2/woff @font-face

// ── CDN font URL ──────────────────────────────────────────────────────────────
//
// Single combined request for all 15 fixed-weight fonts (fewer HTTP round trips).
// Adding a new fixed-weight font: append &family=Name:wght@400;700 before &display=swap.
const CDN_FONTS_URL =
  "https://fonts.googleapis.com/css2" +
  "?family=Roboto:wght@400;500;700" +
  "&family=Poppins:wght@400;500;600;700" +
  "&family=Lato:wght@400;700" +
  "&family=Cormorant+Garamond:wght@400;500;600;700" +
  "&family=Merriweather:wght@400;700" +
  "&family=Libre+Baskerville:wght@400;700" +
  "&family=PT+Serif:wght@400;700" +
  "&family=Crimson+Text:wght@400;600;700" +
  "&family=Arvo:wght@400;700" +
  "&family=Barlow+Condensed:wght@400;500;600;700" +
  "&family=Bebas+Neue:wght@400" +
  "&family=Anton:wght@400" +
  "&family=Archivo+Black:wght@400" +
  "&family=Abril+Fatface:wght@400" +
  "&family=IBM+Plex+Mono:wght@400;500;700" +
  "&display=swap";

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getActiveTenant();
  return {
    title:       tenant.theme.meta.name,
    description: tenant.theme.meta.tagline,
    icons: tenant.theme.meta.faviconPath
      ? { icon: tenant.theme.meta.faviconPath }
      : undefined,
  };
}

// ── Root Layout ───────────────────────────────────────────────────────────────

/**
 * Root layout — tenant-aware, theme-injecting.
 *
 * ─── Theme injection ─────────────────────────────────────────────────────────
 *
 * The active tenant's theme is resolved from the incoming request's Host
 * header and converted to a block of CSS custom property declarations via
 * tenantThemeToCSS(). These are injected as inline <style> tags in <head>.
 *
 * IMPORTANT — scoping: vars target [data-site] NOT :root.
 *
 * app/(site)/layout.tsx wraps every public page in:
 *   <div data-site="" className="contents">
 *
 * This makes tenant CSS vars available to all public-site descendants while
 * leaving admin and dashboard routes untouched — they inherit only the stable
 * :root defaults from design-system/theme/theme.css (Geist Sans, neutral palette).
 * CSS variables are inherited by all descendants of [data-site]; display:contents
 * means no box is generated so the wrapper has zero layout impact.
 *
 * ─── Cascade order (public site) ─────────────────────────────────────────────
 *
 *   1. theme.css @theme block           — Tailwind palette utilities (compile-time)
 *   2. theme.css :root block            — stable :root defaults (admin baseline)
 *   3. theme.css dark-mode block        — dark-mode overrides via media query
 *   4. Inline <style> [data-site] vars  — tenant-specific overrides (this file)
 *
 * ─── Contextual theme rules ──────────────────────────────────────────────────
 *
 * The tenant's StoredRulesConfig (rules_config table) may include rules with
 * plan.themeKey set.  resolveThemeDecision() evaluates these against a minimal
 * visitor context (time of day, seasonal event, device) built from request
 * headers.  The resolved theme overrides design.theme for this request so
 * seasonal/time-of-day/device themes work without any DB writes.
 *
 * Session stability is maintained via the mc_theme httpOnly cookie (4-hour TTL).
 *
 * ─── Leadinfo ────────────────────────────────────────────────────────────────
 *
 * When the active tenant has Leadinfo enabled (leadinfo.enabled === true in
 * TenantSettings), the LeadinfoProvider client component is injected into the
 * body.  It runs the Leadinfo Identify API once per browser session — using
 * the real visitor IP — and optionally persists the result in the mc_li
 * httpOnly cookie for server-side enrichment on subsequent page loads.
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const tenantConfig   = await getActiveTenant();
  const tenantSettings = await getTenantById(tenantConfig.tenantId);

  // ── Contextual theme decision ─────────────────────────────────────────────────
  //
  // Evaluate the tenant's StoredRules to see if any rule with plan.themeKey
  // matches the current visitor context.  When a rule fires its themeKey
  // overrides the tenant's default design.theme for this request.
  //
  // Context is built from request headers — User-Agent, time, and UTM params.
  // UTM params are forwarded by middleware.ts as x-mc-utm-* request headers
  // (App Router layouts cannot read searchParams directly; middleware is the
  // standard solution for surfacing query params in the Server Component tree).
  let contextualThemeKey: ThemePresetKey | null = null;
  // Debug trace object — populated inside the try block, consumed after it.
  let themeDecisionTrace: import("@/decision/theme-decision").ThemeDecisionTrace | null = null;

  try {
    const [cookieStore, headersList] = await Promise.all([cookies(), headers()]);
    const ua       = headersList.get("user-agent") ?? "";
    const timezone = tenantSettings?.timezone ?? "UTC";

    // Build minimal evaluation context — time, device, UTM params, and visit type.
    // UTM params are not available via searchParams in layout.tsx (App Router
    // restriction), but middleware.ts forwards them as x-mc-utm-* request
    // headers so we can read them here.
    const timeCtx     = buildTimeContext(new Date(), timezone);
    const device      = /mobile|android|iphone|ipad/i.test(ua) ? "mobile" as const : "desktop" as const;
    const utmSource   = headersList.get("x-mc-utm-source")   || null;
    const utmMedium   = headersList.get("x-mc-utm-medium")   || null;
    const utmCampaign = headersList.get("x-mc-utm-campaign") || null;
    const utmContent  = headersList.get("x-mc-utm-content")  || null;
    const utmTerm     = headersList.get("x-mc-utm-term")     || null;
    // Resolve visitType from the mc_seen cookie (absent → new, "1" → returning).
    // Without this, ctx_returning_visitor and any visitType-based theme rules
    // never fire because the context always reads as "new".
    const visitType   = cookieStore.get("mc_seen")?.value === "1" ? "returning" as const : "new" as const;

    const themeCtx: RuleEvaluationContext = {
      // ── VisitorContext required fields ─────────────────────────────────────
      source:         "direct",
      device,
      visitType,
      rawReferrer:    null,
      referrerDomain: null,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      userAgent:      ua,
      resolvedAt:     Date.now(),
      // ── Time context (seasonal + time-of-day rules) ────────────────────────
      ...timeCtx,
      // ── Behaviour history (empty — not relevant for theme decisions) ───────
      history:  emptyHistory(),
      tenantId: tenantConfig.tenantId,
    };

    // ── Scenario Control integration ───────────────────────────────────────
    //
    // Read the mc_scenario cookie and apply any active overrides to the minimal
    // themeCtx before calling resolveThemeDecision.  Without this, the theme
    // decision pipeline is blind to Scenario Control — it always evaluates the
    // real request context, so setting "Time of Day = Afternoon" in the panel
    // has no effect on the contextual theme.
    //
    // When a scenario is active we also bypass the mc_theme session lock by
    // passing `null` as `sessionTheme`.  The lock exists to keep the theme
    // stable across a real user session, but in a debug/demo scenario the
    // developer expects the theme to re-evaluate on every Scenario Control change.
    const rawCookieHeader = headersList.get("cookie");
    const scenarioOverrides = parseScenarioCookie(rawCookieHeader);

    const effectiveThemeCtx = scenarioOverrides
      ? applyScenarioToDecisionContext(themeCtx, scenarioOverrides)
      : themeCtx;

    // Read the session-locked theme only when no scenario is active.
    // When a scenario IS active, pass null to force fresh rule evaluation.
    const sessionTheme = scenarioOverrides
      ? null
      : readThemeSessionCookie(cookieStore);

    const storedConfig = await loadTenantRulesConfig(tenantConfig.tenantId);

    const defaultThemeKey = (tenantSettings?.design?.theme ?? "modern-saas") as ThemePresetKey;
    // Pass utmCampaign separately — resolveThemeDecision uses it to decide
    // whether a campaign-priority rule should bypass an existing session lock.
    const themeTrace = resolveThemeDecision(storedConfig, effectiveThemeCtx, defaultThemeKey, sessionTheme, utmCampaign);
    themeDecisionTrace = themeTrace;

    if (!themeTrace.sessionLocked && !scenarioOverrides) {
      // Freshly evaluated (and no scenario active) — lock the theme for this session.
      // When a scenario IS active we deliberately skip writing mc_theme so the
      // session lock doesn't "bake in" the scenario-driven theme choice.  The real
      // theme re-evaluates correctly once the scenario is cleared.
      try {
        writeThemeSessionCookie(cookieStore as Parameters<typeof writeThemeSessionCookie>[0], themeTrace.resolvedTheme);
      } catch {
        // Non-critical: if writing the cookie fails, next request re-evaluates
      }
    }

    // Only override when the decision engine picked a different theme
    if (themeTrace.resolvedTheme !== (tenantSettings?.design?.theme ?? "modern-saas")) {
      contextualThemeKey = themeTrace.resolvedTheme;
    }

    // ── Scenario direct theme override ───────────────────────────────────────
    //
    // Scenario presets can declare a themeKey in their overrides to demonstrate
    // a specific visual theme regardless of whether a matching rule exists in
    // the tenant's rules_config.  This takes precedence over rule evaluation
    // and only applies when a scenario is active (never for real visitors).
    //
    // Example: the "Returning Visitor" preset declares themeKey: "valentine-pink"
    // so activating that scenario always shows the Valentine Pink theme — no
    // admin theme-rule setup required.
    if (scenarioOverrides?.themeKey && isThemePresetKey(scenarioOverrides.themeKey)) {
      contextualThemeKey = scenarioOverrides.themeKey;
    }

    // ── Debug trace (development only) ──────────────────────────────────────
    //
    // Includes the current pathname (forwarded by proxy.ts as x-pathname) so
    // you can verify that "/" and "/home" (before redirect) produce the same
    // theme decision output — confirming route unification is working.
    if (process.env.NODE_ENV === "development") {
      const pathname = headersList.get("x-pathname") ?? "(unknown)";
      console.debug(
        "[mc:theme]",
        `route=${pathname}`,
        `default=${themeTrace.tenantDefault}`,
        `rule=${themeTrace.matchedRuleId ?? "none"}(priority=${themeTrace.matchedPriority ?? "-"})`,
        `resolved=${themeTrace.resolvedTheme}`,
        `locked=${themeTrace.sessionLocked}(${themeTrace.lockSource})`,
        ...(utmSource   ? [`utm_source=${utmSource}`]   : []),
        ...(utmCampaign ? [`utm_campaign=${utmCampaign}`] : []),
      );
    }
  } catch {
    // Non-critical: if theme decision fails, fall back to design.theme
  }

  // ── Theme trace attribute (for browser DevTools inspection) ─────────────────
  //
  // Surfaced as data-theme-trace on <html> in development so engineers can
  // quickly verify the full theme decision by inspecting the root element.
  // Omitted in production to avoid leaking internal decision metadata.
  const themeTraceAttr =
    process.env.NODE_ENV === "development" && themeDecisionTrace
      ? JSON.stringify({
          default:  themeDecisionTrace.tenantDefault,
          rule:     themeDecisionTrace.matchedRuleId,
          label:    themeDecisionTrace.matchedRuleLabel,
          resolved: themeDecisionTrace.resolvedTheme,
          lock:     themeDecisionTrace.lockSource,
        })
      : undefined;

  // ── Final theme resolution ────────────────────────────────────────────────────
  //
  // Merges the tenant's stored default with any contextual rule override so that
  // BOTH Layer A (base preset) and Layer B (token delta) derive from the same
  // theme.  Previously Layer A always used tenantConfig.theme (the hardcoded MC
  // object), which meant any CSS var present in the MC preset but absent in the
  // contextual theme's preset would bleed through — most visibly the conditional
  // font vars (--font-sans/serif/mono are only emitted when a preset specifies
  // them, so a theme swap could leave the old font in place).
  //
  // Resolution order:
  //   1. contextualThemeKey — set above when a rule fires a theme override
  //   2. tenantSettings.design.theme — the tenant's persisted preset choice
  //   3. "modern-saas" — platform default
  const _defaultThemeKey: ThemePresetKey =
    (tenantSettings?.design?.theme ?? "modern-saas") as ThemePresetKey;
  const finalThemeKey: ThemePresetKey = contextualThemeKey ?? _defaultThemeKey;
  const finalThemePreset = isThemePresetKey(finalThemeKey)
    ? THEME_PRESETS[finalThemeKey]
    : tenantConfig.theme;

  // ── Dev logging: final theme decision ────────────────────────────────────────
  if (process.env.NODE_ENV === "development") {
    // headersList is available from the try block above; re-read safely.
    let _devPathname = "(unknown)";
    try { _devPathname = (await headers()).get("x-pathname") ?? "(unknown)"; } catch { /* ok */ }
    console.debug(
      "[mc:theme:final]",
      `route=${_devPathname}`,
      `default=${_defaultThemeKey}`,
      `rule=${contextualThemeKey ?? "none"}`,
      `final=${finalThemeKey}`,
      `preset=${isThemePresetKey(finalThemeKey) ? "curated" : "hardcoded-fallback"}`,
    );
  }

  // ── Theme isolation: [data-site] scoping ────────────────────────────────────
  //
  // Tenant theme vars are scoped to elements that carry the [data-site] attribute
  // rather than :root.  app/(site)/layout.tsx wraps the entire public site in a
  // `<div data-site="" className="contents">` which anchors this selector.
  //
  // Admin and dashboard routes have no [data-site] ancestor, so they never
  // inherit tenant colours, fonts, or radii — they fall back to the stable
  // :root defaults established by design-system/theme/theme.css (the platform's
  // own design system, using Geist Sans / neutral palette).
  //
  // CSS custom properties are inherited, so [data-site] vars cascade normally to
  // all descendant elements of the site wrapper (Header, blocks, Footer, etc.).
  // display:contents on the wrapper means no layout box is generated — the
  // isolation is invisible to the site's flexbox / grid layouts.
  const SITE_SELECTOR = "[data-site]";

  // ── Layer A: Base tenant theme vars ──────────────────────────────────────────
  //
  // Derived from finalThemePreset (not tenantConfig.theme) so the theme vars
  // always match the active theme — including contextual overrides.  This
  // prevents bleed-through of vars from the MC brand theme when a rule fires.
  const cssVarBlock = `${SITE_SELECTOR} {\n${tenantThemeToCSS(finalThemePreset)}}`;

  // ── Layer B: Token override delta ────────────────────────────────────────────
  //
  // resolveThemeForTenant re-applies the curated preset vars plus any admin
  // token-editor overrides on top.  Passing contextualThemeKey (not
  // finalThemeKey) is intentional: the function falls back to
  // settings.design.theme internally, which produces the same final key.
  //
  // We build the CSS block directly from resolvedTheme.vars (rather than via
  // resolvedThemeToCSS) so we can use SITE_SELECTOR instead of :root.
  const resolvedTheme = resolveThemeForTenant(tenantSettings, contextualThemeKey);
  const resolvedVarEntries = Object.entries(resolvedTheme.vars);
  const tokenOverrideCSS = resolvedVarEntries.length > 0
    ? `${SITE_SELECTOR}{${resolvedVarEntries.map(([k, v]) => `${k}:${v}`).join(";")}}`
    : "";

  // ── Layer C: Google Font var redirects ────────────────────────────────────────
  //
  // For each font role that maps to a supported variable-weight Google Font,
  // emit a [data-site] {} override that redirects the semantic var to next/font's
  // loaded CSS variable.  Example: [data-site]{--font-sans:var(--font-inter)}
  //
  // Scoping font redirects to [data-site] is critical: without it, the tenant's
  // custom font would override --font-sans globally, changing the admin UI font
  // alongside the public site.  CDN-loaded fixed-weight fonts are not in
  // GOOGLE_FONT_MAP, so resolveGoogleFontCss() returns null for them — correct.
  const fontRedirectParts: string[] = [];
  const FONT_ROLE_VARS = ["--font-sans", "--font-serif", "--font-mono", "--font-heading"] as const;
  for (const cssVar of FONT_ROLE_VARS) {
    const stack = resolvedTheme.vars[cssVar];
    if (stack) {
      // resolveGoogleFontCss() returns ":root{--font-sans:var(--font-inter)}".
      // Replace :root with SITE_SELECTOR so the redirect is site-scoped.
      const rootScoped = resolveGoogleFontCss(stack, cssVar);
      if (rootScoped) {
        fontRedirectParts.push(rootScoped.replace(":root{", `${SITE_SELECTOR}{`));
      }
    }
  }
  const fontRedirectCSS = fontRedirectParts.join("\n");

  // ── Leadinfo ──────────────────────────────────────────────────────────────
  const leadinfoSettings = tenantSettings?.leadinfo;
  const leadinfoEnabled  =
    leadinfoSettings?.enabled === true &&
    typeof leadinfoSettings.siteToken === "string" &&
    leadinfoSettings.siteToken.length > 0;

  // ── Consent banner ────────────────────────────────────────────────────────
  const privacySettings  = tenantSettings?.privacy;
  // headers() is a cached store lookup — safe to call again outside the try block.
  const _consentHeaders  = await headers();
  const _consentPathname = _consentHeaders.get("x-pathname") ?? "";
  // Never show the consent banner on admin pages — admin users don't need it.
  const showConsentBanner =
    privacySettings?.showConsentBanner !== false &&
    !_consentPathname.startsWith("/admin");

  return (
    /*
     * suppressHydrationWarning on <html>
     *
     * Browser extensions (Google's official GA Opt-out Add-on, uBlock Origin,
     * Privacy Badger, and others) inject `data-google-analytics-opt-out=""`
     * directly onto `document.documentElement` client-side, after the server-
     * rendered HTML has already been sent. This is an unavoidable external DOM
     * mutation. suppressHydrationWarning is React's documented escape hatch for
     * exactly this situation.
     */
    <html
      lang="en"
      data-tenant={tenantConfig.tenantId}
      data-theme={finalThemeKey}
      {...(themeTraceAttr ? { "data-theme-trace": themeTraceAttr } : {})}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${ALL_FONT_VARIABLES}`}
    >
      <head>
        {/*
         * Google Fonts CDN — fixed-weight fonts.
         *
         * Preconnect hints tell the browser to open TCP+TLS connections to
         * Google Fonts servers before the stylesheet is requested, reducing
         * font display latency by ~100–200 ms on first load.
         */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/*
         * The CDN stylesheet defines @font-face for 15 fixed-weight fonts that
         * cannot be loaded via next/font/google in Next.js 16 + Turbopack.
         * display=swap ensures text renders immediately in the fallback font
         * and swaps once the font file is downloaded.
         */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href={CDN_FONTS_URL} />

        {/*
         * Layer A — Tenant base theme (site-scoped).
         *
         * Variables are set on [data-site] — the wrapper element rendered in
         * app/(site)/layout.tsx — NOT on :root.  This ensures tenant colours,
         * radii, and typography are only inherited by the public site tree and
         * never bleed into admin or dashboard routes.
         *
         * Placed before any external stylesheets so it is available as soon
         * as the browser begins parsing — no flash of un-themed content.
         */}
        <style
          data-tenant-theme={tenantConfig.tenantId}
          dangerouslySetInnerHTML={{ __html: cssVarBlock }}
        />

        {/*
         * Layer B — Visual editor token overrides (site-scoped).
         *
         * Emits the operator's typographic, colour, and spacing choices from
         * the admin token editor on [data-site], same isolation as Layer A.
         * Must come AFTER Layer A so operator choices win over defaults.
         */}
        {tokenOverrideCSS && (
          <style
            data-token-overrides
            dangerouslySetInnerHTML={{ __html: tokenOverrideCSS }}
          />
        )}

        {/*
         * Layer C — Google Font CSS var redirects (site-scoped).
         *
         * For each font role that matches a variable-weight next/font font,
         * overrides the var on [data-site] to reference the CSS variable.
         * Example: [data-site]{--font-sans:var(--font-inter)}
         *
         * Scoping is essential: without it the tenant's chosen font would
         * replace --font-sans globally, overriding the admin UI font (Geist).
         * Must come AFTER Layer B so the redirect targets the correct var.
         * CDN-loaded fonts produce no redirect here — the raw font-stack in
         * Layer B is sufficient for browser resolution via @font-face.
         */}
        {fontRedirectCSS && (
          <style
            data-font-redirects
            dangerouslySetInnerHTML={{ __html: fontRedirectCSS }}
          />
        )}
      </head>
      <body className="antialiased">
        {children}
        {leadinfoEnabled && (
          <LeadinfoProvider
            siteToken={leadinfoSettings!.siteToken!}
            pushToDataLayer={leadinfoSettings!.pushToDataLayer ?? false}
            storeInContext={leadinfoSettings!.storeInContext ?? true}
          />
        )}
        {showConsentBanner && (
          <ConsentBanner
            title={privacySettings?.bannerTitle}
            description={privacySettings?.bannerDescription}
          />
        )}
      </body>
    </html>
  );
}
