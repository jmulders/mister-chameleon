/**
 * GET /share-image — the card a link to this site shows when it is shared.
 *
 * One card per site, drawn per host from what the tenant already has: its logo,
 * the title and description of its homepage and the ground of its hero. Every
 * page names it as og:image unless its editor filled in an image of its own
 * (see lib/seo/share-image.ts and the root layout).
 *
 * The logo is shown as the file the tenant uploaded, never redrawn. A logo made
 * for a dark ground stands on the card directly. Any other logo stands on a
 * white plate, because the card's ground is the hero's and that is dark for
 * most themes. When the logo cannot be drawn the card goes without it.
 */

import { ImageResponse } from "next/og";
import { headers } from "next/headers";
import { getActiveTenant, getTenantForRender } from "@/tenant/server";
import { createCMSProvider } from "@/cms";
import { getTenantSiteSettings } from "@/cms/providers/tenant-site-settings";
import { tenantThemeToCSS } from "@/design-system/theme/tenant-theme";
import { THEME_PRESETS, isThemePresetKey } from "@/design-system/theme/presets";
import { resolveThemeForTenant, cssDeclarationsToRecord } from "@/tenant/resolve-theme";
import { getSiteLanguage } from "@/lib/site-texts/server";
import { requestOrigin } from "@/lib/seo/site-identity";
import { absoluteUrl } from "@/lib/seo/structured-data";
import { SHARE_IMAGE, SHARE_TEXT_STRENGTH, shareCardColours, shareHeadline, clampText, type ShareCardColours } from "@/lib/seo/share-image";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

interface CardContent {
  /** The large line: what the site is, or its name. */
  headline: string;
  line:     string;
  host:     string;
  colours:  ShareCardColours;
  /** Absolute address of the logo, or null for a card without one. */
  logoUrl:  string | null;
  /** True when the logo was made for a dark ground and needs no plate. */
  logoBare: boolean;
}

function card({ headline, line, host, colours, logoUrl, logoBare }: CardContent) {
  const isGradient = colours.ground.startsWith("linear-gradient");
  return (
    <div
      style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
        padding: "72px 80px",
        ...(isGradient ? { backgroundImage: colours.ground } : { backgroundColor: colours.ground }),
      }}
    >
      <div style={{ display: "flex", height: 120, alignItems: "center" }}>
        {logoUrl && (
          <div
            style={{
              display: "flex", alignItems: "center",
              ...(logoBare ? {} : { backgroundColor: "#ffffff", borderRadius: 20, padding: "16px 24px" }),
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="" height={88} style={{ height: 88 }} />
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", maxWidth: 1000, fontSize: 68, lineHeight: 1.12, letterSpacing: "-0.02em", color: colours.text }}>
          {headline}
        </div>
        {line && (
          <div style={{ display: "flex", marginTop: 24, maxWidth: 940, fontSize: 34, lineHeight: 1.35, color: colours.text, opacity: SHARE_TEXT_STRENGTH.line }}>
            {line}
          </div>
        )}
      </div>

      <div style={{ display: "flex", fontSize: 26, color: colours.text, opacity: SHARE_TEXT_STRENGTH.host }}>{host}</div>
    </div>
  );
}

export async function GET(): Promise<Response> {
  const tenantConfig   = await getActiveTenant();
  const tenantSettings = await getTenantForRender(tenantConfig.tenantId);
  const language       = await getSiteLanguage().catch(() => null);
  const site           = language
    ? await getTenantSiteSettings(tenantConfig.tenantId, tenantSettings, language).catch(() => null)
    : null;

  // The tenant's own theme, without a theme a rule may pick for one visitor:
  // a shared link is seen by everyone.
  const cmsKey   = site?.themePreset;
  const themeKey = tenantSettings?.design?.theme ?? (cmsKey && isThemePresetKey(cmsKey) ? cmsKey : null) ?? "modern-saas";
  const preset   = isThemePresetKey(themeKey) ? THEME_PRESETS[themeKey] : tenantConfig.theme;
  const vars     = { ...cssDeclarationsToRecord(tenantThemeToCSS(preset)), ...resolveThemeForTenant(tenantSettings, null).vars };

  const origin = requestOrigin(await headers());
  const name   = tenantConfig.name || tenantConfig.theme.meta.name;

  // What the homepage says about itself to a search engine: its title as the
  // large line, its description under it. The logo carries the name, so the
  // title is shown without it. A site without these gets its name and the
  // theme's tagline.
  const home = language
    ? await createCMSProvider(tenantSettings?.cms, tenantConfig.tenantId, language).getPageBySlug("home", language).catch(() => null)
    : null;
  const line = clampText(home?.seoDescription ?? tenantConfig.theme.meta.tagline ?? "", 150);

  const darkLogo  = tenantSettings?.branding?.logoDark ?? site?.logoDark ?? null;
  const plainLogo = tenantSettings?.branding?.logo ?? site?.logo ?? null;
  const logo      = darkLogo?.url ? darkLogo : plainLogo;
  const logoUrl   = logo?.url && origin ? absoluteUrl(logo.url, origin) : null;

  const content: CardContent = {
    headline: logoUrl ? shareHeadline(home?.seoTitle, name) : name,
    line,
    host:     origin ? new URL(origin).host : "",
    colours:  shareCardColours(vars),
    logoUrl,
    logoBare: Boolean(darkLogo?.url),
  };
  const size = { width: SHARE_IMAGE.width, height: SHARE_IMAGE.height };
  // A day in a shared cache: the card changes only when the tenant's name,
  // description, logo or theme does.
  const init = { ...size, headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } };

  // The drawing happens when the body is read, so a logo that cannot be drawn
  // shows up there. Read it here to be able to fall back to a card without.
  try {
    const body = await new ImageResponse(card(content), init).arrayBuffer();
    return new Response(body, { headers: { "Content-Type": "image/png", "Cache-Control": init.headers["Cache-Control"] } });
  } catch (error) {
    logger.warn("[share-image] the logo could not be drawn, the card goes without", {
      logoUrl: content.logoUrl,
      error:   error instanceof Error ? error.message : String(error),
    });
    return new ImageResponse(card({ ...content, headline: name, logoUrl: null }), init);
  }
}
