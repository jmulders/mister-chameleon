/**
 * Footer
 *
 * Async server component that fetches site settings from the CMS and dispatches
 * to the appropriate footer variant based on the active theme family.
 *
 * ─── Footer variants ──────────────────────────────────────────────────────────
 *
 *   corporate  → FooterCorporate  brand + links / multi-column (editorial, corporate)
 *   branding   → FooterBranding   centred brand-first (bold-marketing)
 *   minimal    → FooterMinimal    single-row brand + links (portfolio, luxury)
 *
 *   Defaults to "corporate" when no family is active, preserving the original
 *   layout for tenants without a featured family.
 *
 * ─── Visual tokens ────────────────────────────────────────────────────────────
 *
 *   --footer-bg      Background colour.  Defaults to --bg-subtle.
 *   --footer-fg      Text / icon foreground.  Defaults to --text-muted.
 *   --footer-border  Top border colour.  Defaults to --border.
 *
 * ─── Architecture ─────────────────────────────────────────────────────────────
 *
 *   Footer is a React Server Component — it fetches site settings server-side
 *   and renders a fully static footer with no client-side interactivity.
 */

import { createCMSProvider }  from "@/cms/providers/create-cms-provider";
import { getActiveTenant, getTenantById } from "@/tenant/server";
import {
  FEATURED_FAMILY_CONFIGS,
  isFeaturedFamilyKey,
} from "@/design-system/theme/theme-families.config";
import { FooterCorporate } from "./footer/FooterCorporate";
import { FooterBranding }  from "./footer/FooterBranding";
import { FooterMinimal }   from "./footer/FooterMinimal";

export async function Footer() {
  const activeTenant = await getActiveTenant();

  const settings = await createCMSProvider(undefined, activeTenant.tenantId).getSiteSettings();

  const siteTitle    = settings?.siteTitle        ?? activeTenant.name;
  const logoUrl      = settings?.logo?.url        ?? null;
  const logoAlt      = settings?.logo?.alt        ?? siteTitle;
  const footerNav    = settings?.footerNavigation ?? [];
  const footerCols   = settings?.footerColumns;
  const contactEmail = settings?.contactEmail     ?? null;
  const contactPhone = settings?.contactPhone     ?? null;
  const socialLinks  = settings?.socialLinks;
  const year         = new Date().getFullYear();

  // ── Family-driven footer variant ──────────────────────────────────────────
  //
  // Layer 1 (family default): reads the active family from the tenant's static
  // theme config.  When a featured family is active, use its structural footer
  // config.  Otherwise default to "corporate" / "compact".
  //
  // Layer 2 (tenant override): reads footerVariant / footerDensity from the
  // DB-stored TenantDesignSettings.  When present, these take precedence over
  // the family default and let operators choose a footer layout from the admin.
  let footerVariant: "corporate" | "branding" | "minimal" = "corporate";
  let footerDensity: "compact" | "comfortable" | "spacious" = "compact";

  // Layer 1 — family default
  const familyKey = activeTenant.theme?.featuredFamilyKey;
  if (familyKey && isFeaturedFamilyKey(familyKey)) {
    const { structural } = FEATURED_FAMILY_CONFIGS[familyKey];
    footerVariant = structural.footer.variant;
    footerDensity = structural.footer.density;
  }

  // Layer 2 — tenant-level override from DB-stored design settings.
  const tenantSettings = await getTenantById(activeTenant.tenantId);
  if (tenantSettings?.design.footerVariant) {
    footerVariant = tenantSettings.design.footerVariant;
  }
  if (tenantSettings?.design.footerDensity) {
    footerDensity = tenantSettings.design.footerDensity;
  }

  // ── Dispatch ──────────────────────────────────────────────────────────────
  if (footerVariant === "branding") {
    return (
      <FooterBranding
        siteTitle={siteTitle}
        logoUrl={logoUrl}
        logoAlt={logoAlt}
        footerNav={footerNav}
        socialLinks={socialLinks}
        year={year}
        density={footerDensity}
      />
    );
  }
  if (footerVariant === "minimal") {
    return (
      <FooterMinimal
        siteTitle={siteTitle}
        logoUrl={logoUrl}
        logoAlt={logoAlt}
        footerNav={footerNav}
        year={year}
        density={footerDensity}
      />
    );
  }
  // "corporate" is the default
  return (
    <FooterCorporate
      siteTitle={siteTitle}
      logoUrl={logoUrl}
      logoAlt={logoAlt}
      footerNav={footerNav}
      footerColumns={footerCols}
      contactEmail={contactEmail}
      contactPhone={contactPhone}
      socialLinks={socialLinks}
      year={year}
      density={footerDensity}
    />
  );
}
