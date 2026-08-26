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
import { getActiveTenant, getTenantByIdCached } from "@/tenant/server";
import { normalizeTenant } from "@/tenant/normalize";
import {
  FEATURED_FAMILY_CONFIGS,
  isFeaturedFamilyKey,
} from "@/design-system/theme/theme-families.config";
import { chromeIsDark }      from "./chrome-bg";
import { FooterCorporate }   from "./footer/FooterCorporate";
import { FooterBranding }    from "./footer/FooterBranding";
import { FooterMinimal }     from "./footer/FooterMinimal";
import { FooterBottomStrip } from "./footer/FooterBottomStrip";

export async function Footer() {
  const activeTenant = await getActiveTenant();
  // (cached resilient tenant lookup — see Header.tsx / tenant-store.ts)

  // Resolve tenant settings first so we can pass the CMS preference to the
  // provider factory — same pattern as Header.tsx.
  const tenantSettings = await getTenantByIdCached(activeTenant.tenantId);
  const tenantCms = tenantSettings ? normalizeTenant(tenantSettings).cms : undefined;
  const settings = await createCMSProvider(tenantCms, activeTenant.tenantId).getSiteSettings();

  const siteTitle    = settings?.siteTitle        ?? activeTenant.name;
  // Dark footer → use the dark-background logo variant when configured. "Dark"
  // is derived from the effective footerBg (token override or theme preset).
  // Tenant-owned branding logos (design → Branding) are the PRIMARY source, then
  // the CMS logos — so the switch works for null-cms_provider tenants (statamic)
  // that return no logoDark from getSiteSettings().
  const brandLogo     = tenantSettings?.branding?.logo     ?? settings?.logo     ?? null;
  const brandLogoDark = tenantSettings?.branding?.logoDark ?? settings?.logoDark ?? null;
  const useDarkLogo  = chromeIsDark(tenantSettings, "footer") && Boolean(brandLogoDark?.url);
  const logoUrl      = (useDarkLogo ? brandLogoDark?.url : brandLogo?.url) ?? null;
  const logoAlt      = (useDarkLogo ? brandLogoDark?.alt : brandLogo?.alt) ?? siteTitle;
  const footerNav    = settings?.footerNavigation ?? [];
  const footerCols   = settings?.footerColumns;
  const contactEmail = settings?.contactEmail     ?? null;
  const contactPhone = settings?.contactPhone     ?? null;
  const address      = settings?.address          ?? null;
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

  // Layer 1.5 — CMS-level fallback (applied before tenant DB so DB takes precedence).
  // Only applies when the CMS entry has an explicit value and the tenant DB has not.
  if (settings?.footerVariant && !tenantSettings?.design.footerVariant) {
    footerVariant = settings.footerVariant;
  }
  if (settings?.footerDensity && !tenantSettings?.design.footerDensity) {
    footerDensity = settings.footerDensity;
  }

  // Layer 2 — tenant-level override from DB-stored design settings.
  if (tenantSettings?.design.footerVariant) {
    footerVariant = tenantSettings.design.footerVariant;
  }
  if (tenantSettings?.design.footerDensity) {
    footerDensity = tenantSettings.design.footerDensity;
  }

  // ── Footer bottom strip ───────────────────────────────────────────────────
  const footerBottom = settings?.footerBottom ?? null;

  // ── Dispatch ──────────────────────────────────────────────────────────────
  //
  // When the corporate variant is active, social links already appear in the
  // brand row of FooterCorporate.  Pass them to FooterBottomStrip only for
  // variants that don't render social icons themselves (branding, minimal).
  const bottomStripSocial = footerVariant === "corporate" ? undefined : socialLinks;

  const bottomStrip = footerBottom ? (
    <FooterBottomStrip
      data={footerBottom}
      socialLinks={bottomStripSocial}
      year={year}
    />
  ) : null;

  if (footerVariant === "branding") {
    return (
      <>
        <FooterBranding
          siteTitle={siteTitle}
          logoUrl={logoUrl}
          logoAlt={logoAlt}
          footerNav={footerNav}
          socialLinks={socialLinks}
          year={year}
          density={footerDensity}
        />
        {bottomStrip}
      </>
    );
  }
  if (footerVariant === "minimal") {
    return (
      <>
        <FooterMinimal
          siteTitle={siteTitle}
          logoUrl={logoUrl}
          logoAlt={logoAlt}
          footerNav={footerNav}
          year={year}
          density={footerDensity}
        />
        {bottomStrip}
      </>
    );
  }
  // "corporate" is the default
  return (
    <>
      <FooterCorporate
        siteTitle={siteTitle}
        logoUrl={logoUrl}
        logoAlt={logoAlt}
        footerNav={footerNav}
        footerColumns={footerCols}
        contactEmail={contactEmail}
        contactPhone={contactPhone}
        address={address}
        socialLinks={socialLinks}
        year={year}
        density={footerDensity}
      />
      {bottomStrip}
    </>
  );
}
