import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { getActiveTenant } from "@/tenant/server";
import { tenantThemeToCSS } from "@/design-system/theme/tenant-theme";
import { Header } from "@/components/layout";

// ── Fonts ─────────────────────────────────────────────────────────────────────
//
// Loaded once at module level; next/font injects scoped CSS variable names.
// The variables are wired to --font-sans / --font-mono by globals.css via
// @theme inline — that's how Tailwind's font-sans utility picks up Geist.

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// ── Metadata ──────────────────────────────────────────────────────────────────
//
// Generated dynamically so the <title> and OG description reflect the active
// tenant's brand identity rather than the Next.js scaffold defaults.

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
 * tenantThemeToCSS(). These are injected as an inline <style> tag inside
 * <head> before any other styles load.
 *
 * The injected vars (--primary, --bg, --text, --radius-interactive, …) shadow
 * the :root defaults established by design-system/theme/theme.css, which is
 * imported via globals.css. Because they share the same variable names, the
 * entire site re-themes without any component code knowing about tenants.
 *
 * ─── Cascade order ───────────────────────────────────────────────────────────
 *
 *   1. theme.css @theme block       — Tailwind palette utilities (compile-time)
 *   2. theme.css :root block        — semantic var defaults (--primary, --bg, …)
 *   3. theme.css dark-mode block    — dark-mode overrides via media query
 *   4. Inline <style> tenant vars   — tenant-specific :root overrides (this file)
 *
 * The inline <style> tag is at the highest specificity layer so it wins over
 * the defaults without needing !important or extra selectors.
 *
 * ─── Server Component ────────────────────────────────────────────────────────
 *
 * This layout is an async Server Component. getActiveTenant() reads the Host
 * header via next/headers — no client-side JS is needed for theming.
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const tenant = await getActiveTenant();

  // Convert the tenant's TenantTheme to a :root { } CSS block.
  // For Mister Chameleon (the only tenant today) these values are identical to
  // the theme.css defaults, so the injection is a no-op in practice — it
  // establishes the pattern that future tenants will rely on.
  const cssVarBlock = `:root {\n${tenantThemeToCSS(tenant.theme)}}`;

  return (
    <html lang="en" data-tenant={tenant.tenantId}>
      <head>
        {/*
         * Tenant theme injection.
         *
         * Placed before any external stylesheets so it is available as soon
         * as the browser begins parsing — no flash of un-themed content.
         *
         * The injected vars override the :root defaults from theme.css.
         * Components never reference tenant IDs directly; they use the CSS
         * vars (--primary, --bg, etc.) which now carry the correct values.
         */}
        <style
          data-tenant-theme={tenant.tenantId}
          dangerouslySetInnerHTML={{ __html: cssVarBlock }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Header />
        {children}
      </body>
    </html>
  );
}
