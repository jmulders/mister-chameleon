import type { Metadata } from "next";
import "./globals.css";

import { cookies, headers }      from "next/headers";
import { getActiveTenant, getTenantById } from "@/tenant/server";
import { tenantThemeToCSS }      from "@/design-system/theme/tenant-theme";
import { resolveThemeForTenant, resolvedThemeToCSS } from "@/tenant/resolve-theme";
import { ALL_FONT_VARIABLES, geistSans, geistMono, resolveGoogleFontCss } from "@/lib/fonts";
import { LeadinfoProvider }      from "@/components/tracking/LeadinfoProvider";
import { ConsentBanner }         from "@/components/tracking/ConsentBanner";
import { CookiePreferences }     from "@/components/tracking/CookiePreferences";
import { toConsentLocale }       from "@/tracking/consent-i18n";
import { getDesignPreset } from "@/tenant/design-presets-gallery";
import { buildCompleteLookDesign } from "@/lib/design/complete-look";
import { THEME_PRESETS, isThemePresetKey, type ThemePresetKey } from "@/design-system/theme/presets";
import { createCMSProvider }     from "@/cms/providers/create-cms-provider";
import { getRequestThemeDecision } from "@/lib/theme/request-theme";

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
// Single combined request for all CDN fonts (fewer HTTP round trips).
// Adding a new font: append &family=Name:wght@400;700 before &display=swap.
// Family → Google Fonts weight spec. We previously loaded a render-blocking
// stylesheet for ALL of these on every page; now we load ONLY the families the
// current tenant's resolved theme actually references (usually 1–3), and skip the
// request entirely for tenants that use only self-hosted (next/font) families.
// Missing a family degrades gracefully via font-display:swap (system fallback).
const CDN_FONT_REGISTRY: Readonly<Record<string, string>> = {
  "Roboto":             "wght@400;500;700",
  "Poppins":            "wght@400;500;600;700",
  "Lato":               "wght@400;700",
  "Cormorant Garamond": "wght@400;500;600;700",
  "EB Garamond":        "ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700",
  "Merriweather":       "wght@400;700",
  "Libre Baskerville":  "wght@400;700",
  "PT Serif":           "wght@400;700",
  "Crimson Text":       "wght@400;600;700",
  "Arvo":               "wght@400;700",
  "Barlow Condensed":   "wght@400;500;600;700",
  "Bebas Neue":         "wght@400",
  "Anton":              "wght@400",
  "Archivo Black":      "wght@400",
  "Abril Fatface":      "wght@400",
  "IBM Plex Mono":      "wght@400;500;700",
  "Fira Code":          "wght@300..700",
};

/** Extract the CDN font families referenced across the given resolved-CSS blocks. */
function neededCdnFamilies(...cssBlocks: string[]): string[] {
  const found = new Set<string>();
  for (const css of cssBlocks) {
    if (!css) continue;
    const re = /--font[a-z-]*\s*:\s*([^;}\n]+)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(css)) !== null) {
      const quoted = m[1].match(/['"]([^'"]+)['"]/);
      const family = (quoted ? quoted[1] : m[1].split(",")[0]).trim();
      if (CDN_FONT_REGISTRY[family]) found.add(family);
    }
  }
  return [...found];
}

/** Build one combined Google Fonts URL for the given families, or "" when none. */
function buildCdnFontUrl(families: string[]): string {
  if (families.length === 0) return "";
  const parts = families
    .map((f) => `family=${f.replace(/ /g, "+")}:${CDN_FONT_REGISTRY[f]}`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${parts}&display=swap`;
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getActiveTenant();
  // Default site title = the tenant's own display name (settable in admin),
  // NOT the active theme's name. Pages with their own generateMetadata (slug,
  // blog, etc.) override this with their CMS SEO title; the homepage inherits
  // this default. Falling back to the theme name only when a tenant has no name.
  return {
    title:       tenant.name || tenant.theme.meta.name,
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
  // Fetch platform DB settings and CMS site settings in parallel.
  // Priority order for base theme: platform DB (tenantSettings.design.theme) takes
  // precedence over CMS (siteSettings.themePreset) so the visual editor in the admin
  // is always the source of truth.  CMS themePreset is a fallback only.
  //
  // createCMSProvider(undefined, tenantId) uses env-var priority (Statamic/Storyblok/Sanity).
  // Tenant-specific CMS overrides are handled by the Header/Footer components which
  // normalize tenantSettings.cms first — layout.tsx runs before tenantSettings is available.
  const [tenantSettings, cmsSettings] = await Promise.all([
    getTenantById(tenantConfig.tenantId),
    createCMSProvider(undefined, tenantConfig.tenantId).getSiteSettings().catch(() => null),
  ]);

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
  const { contextualThemeKey, contextualPresetId, trace: themeDecisionTrace } =
    await getRequestThemeDecision();

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
  // Resolution order (matches defaultThemeKey in the try-block above):
  //   1. contextualThemeKey — set above when a rule fires a theme override
  //   2. tenantSettings.design.theme — platform DB (admin Design page) takes
  //      precedence so that the visual editor is always the source of truth.
  //   3. cmsSettings.themePreset — CMS fallback when no DB override is set
  //   4. "modern-saas" — platform default
  const cmsDefaultKey    = cmsSettings?.themePreset;
  const _defaultThemeKey: ThemePresetKey = (
    tenantSettings?.design?.theme ??
    (cmsDefaultKey && isThemePresetKey(cmsDefaultKey) ? cmsDefaultKey : null) ??
    "modern-saas"
  ) as ThemePresetKey;
  // Contextual gallery preset (item 6): when a rule / session lock selected a
  // gallery preset, inject its complete look so the page renders IDENTICALLY to
  // having applied that preset in admin. Layer A uses the card's baseTheme; Layer
  // B (below) resolves a virtual design built the same way applyDesignPresetAction
  // builds it.
  const galleryCard = contextualPresetId ? getDesignPreset(contextualPresetId) : undefined;
  const finalThemeKey: ThemePresetKey = galleryCard
    ? (galleryCard.baseTheme as ThemePresetKey)   // may be "custom" -> falls to tenantConfig.theme below
    : (contextualThemeKey ?? _defaultThemeKey);
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
  // For a contextual gallery preset, resolve a VIRTUAL design built identically
  // to applyDesignPresetAction (design.theme = baseTheme, tokenOverrides = the
  // card's overrides), so Layer B == the applied preset. Otherwise the normal path.
  const layerBSettings = galleryCard && tenantSettings
    ? { ...tenantSettings, design: buildCompleteLookDesign(tenantSettings.design, galleryCard.tokenOverrides, galleryCard.baseTheme) }
    : tenantSettings;
  const resolvedTheme = resolveThemeForTenant(layerBSettings, galleryCard ? null : contextualThemeKey);
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

  // Per-request font subset: only the CDN families this tenant's resolved theme
  // actually uses (extracted from the emitted base + override CSS). Empty string
  // means the tenant uses only self-hosted fonts → no Google Fonts request at all.
  const cdnFontUrl = buildCdnFontUrl(neededCdnFamilies(cssVarBlock, tokenOverrideCSS));

  // ── Layer D: CMS nav typography overrides ────────────────────────────────
  //
  // The layout_settings Global in Statamic lets content publishers control
  // the typographic scale of nav and footer links independently of the full
  // theme preset.  We emit these as CSS custom properties on [data-site] so
  // they are available to the Header and Footer components without a prop
  // chain.  Only emit the vars that have an actual value — leave the rest as
  // theme defaults.
  //
  //   --nav-link-size          header nav font-size    (layout_settings.nav_link_size)
  //   --nav-link-weight        header nav font-weight  (layout_settings.nav_link_weight)
  //   --nav-link-tracking      header nav letter-spacing (layout_settings.nav_link_tracking)
  //   --nav-dropdown-item-size dropdown item font-size (layout_settings.dropdown_item_size)
  //   --footer-nav-size        footer link font-size   (layout_settings.footer_nav_size)
  const navTypoEntries: [string, string][] = [
    ...(cmsSettings?.navLinkSize      ? [["--nav-link-size",          cmsSettings.navLinkSize]]      as [string, string][] : []),
    ...(cmsSettings?.navLinkWeight    ? [["--nav-link-weight",        cmsSettings.navLinkWeight]]    as [string, string][] : []),
    ...(cmsSettings?.navLinkTracking  ? [["--nav-link-tracking",      cmsSettings.navLinkTracking]]  as [string, string][] : []),
    ...(cmsSettings?.dropdownItemSize ? [["--nav-dropdown-item-size", cmsSettings.dropdownItemSize]] as [string, string][] : []),
    ...(cmsSettings?.footerNavSize    ? [["--footer-nav-size",        cmsSettings.footerNavSize]]    as [string, string][] : []),
  ];
  const navTypoCSS = navTypoEntries.length > 0
    ? `${SITE_SELECTOR}{${navTypoEntries.map(([k, v]) => `${k}:${v}`).join(";")}}`
    : "";

  // ── Leadinfo ──────────────────────────────────────────────────────────────
  const leadinfoSettings = tenantSettings?.leadinfo;
  const leadinfoEnabled  =
    leadinfoSettings?.enabled === true &&
    typeof leadinfoSettings.siteToken === "string" &&
    leadinfoSettings.siteToken.length > 0;

  // ── Google Tag Manager ─────────────────────────────────────────────────────
  // Per-tenant container. Validated against the GTM-XXXX format before rendering
  // (the value goes into an inline script), so a bad value is simply ignored.
  // Rendering GTM establishes window.dataLayer for tags + dataLayer integrations.
  const _gtmRaw = tenantSettings?.gtm?.containerId?.trim();
  const gtmContainerId = _gtmRaw && /^GTM-[A-Z0-9]+$/i.test(_gtmRaw) ? _gtmRaw : null;

  // ── Consent banner ────────────────────────────────────────────────────────
  const privacySettings  = tenantSettings?.privacy;
  // headers() is a cached store lookup — safe to call again outside the try block.
  const _consentHeaders  = await headers();
  const _consentPathname = _consentHeaders.get("x-pathname") ?? "";
  // Per-request CSP nonce (set by middleware.ts). Next auto-applies it to its own
  // hydration scripts; we apply it to the GTM inline snippet below so it survives
  // an enforcing script-src without a bare 'unsafe-inline'. undefined when the
  // route isn't matched by the middleware (then no nonce is needed).
  const cspNonce = _consentHeaders.get("x-nonce") ?? undefined;
  // Never show the consent banner on admin pages or the internal block-preview
  // surface (it renders inside the editor's iframe — the cookie chrome is noise).
  const showConsentBanner =
    privacySettings?.showConsentBanner !== false &&
    !_consentPathname.startsWith("/admin") &&
    !_consentPathname.startsWith("/tenant-block-preview");

  // Visitor locale for the cookie banner / preferences copy (nl / en).
  // The mc_locale cookie is leading; when it is absent (a fresh visitor /
  // incognito) fall back to the active tenant's default language so a NL tenant
  // shows the Dutch banner instead of defaulting to English. Clamped to the
  // ConsentLocale union with English as the last resort.
  const consentLocale = toConsentLocale(
    (await cookies()).get("mc_locale")?.value ?? tenantConfig.defaultLocale,
  );

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
        {/*
         * CDN fonts — emitted ONLY when this tenant's resolved theme actually
         * uses one or more fixed-weight families that can't load via next/font.
         * Tenants on self-hosted fonts get no Google Fonts request at all, and
         * others load only their 1–3 families instead of the full library.
         * display=swap renders text immediately in the fallback, then swaps.
         */}
        {cdnFontUrl && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            {/*
             * Preload the font CSS at high priority so it downloads in parallel
             * with the rest of the <head> instead of being discovered only when
             * the parser reaches the stylesheet below. This shortens the
             * render-blocking window — the stylesheet is already in cache when
             * the parser hits it — without any risk of invisible text, since
             * display=swap keeps text visible in the fallback meanwhile. A full
             * non-render-blocking media-swap would need an inline script, which
             * we avoid here pending CSP verification.
             */}
            <link rel="preload" as="style" href={cdnFontUrl} />
            <link rel="stylesheet" href={cdnFontUrl} />
          </>
        )}

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

        {/*
         * Layer D — CMS nav typography overrides (site-scoped).
         *
         * Emits --nav-link-size, --nav-link-weight, --nav-link-tracking,
         * --nav-dropdown-item-size, and --footer-nav-size when set via the
         * layout_settings Global in the Statamic CP.  Scoped to [data-site]
         * so these do not affect admin or dashboard routes.  Only present
         * when at least one value is configured (empty string → omitted).
         */}
        {navTypoCSS && (
          <style
            data-cms-nav-typo
            dangerouslySetInnerHTML={{ __html: navTypoCSS }}
          />
        )}

        {/* Google Tag Manager (per-tenant) — establishes window.dataLayer. */}
        {gtmContainerId && (
          <script
            id="gtm-base"
            nonce={cspNonce}
            // Next strips the nonce from the client payload (security), so the
            // client sees nonce="" while the server rendered the real value. The
            // server-side nonce is what the browser enforces at parse time; the
            // client difference is expected — suppress the benign hydration diff.
            suppressHydrationWarning
            dangerouslySetInnerHTML={{
              __html:
                `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':` +
                `new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],` +
                `j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;` +
                `j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;` +
                `f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmContainerId}');`,
            }}
          />
        )}
      </head>
      <body className="antialiased">
        {gtmContainerId && (
          <noscript
            dangerouslySetInnerHTML={{
              __html:
                `<iframe src="https://www.googletagmanager.com/ns.html?id=${gtmContainerId}" ` +
                `height="0" width="0" style="display:none;visibility:hidden"></iframe>`,
            }}
          />
        )}
        {children}
        {leadinfoEnabled && (
          <LeadinfoProvider
            siteToken={leadinfoSettings!.siteToken!}
            pushToDataLayer={leadinfoSettings!.pushToDataLayer ?? false}
            storeInContext={leadinfoSettings!.storeInContext ?? true}
          />
        )}
        {showConsentBanner && (
          <>
            <ConsentBanner
              title={privacySettings?.bannerTitle}
              description={privacySettings?.bannerDescription}
              locale={consentLocale}
            />
            <CookiePreferences locale={consentLocale} />
          </>
        )}
      </body>
    </html>
  );
}
