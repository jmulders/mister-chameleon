/**
 * lib/seo/site-facts.ts
 *
 * What structured data needs to know about the site on this request: its
 * address, its name and its logo. Read once per request.
 */

import { cache } from "react";
import { headers } from "next/headers";
import { getActiveTenant, getTenantForRender } from "@/tenant/server";
import { getTenantSiteSettings } from "@/cms/providers/tenant-site-settings";
import { getSiteLanguage } from "@/lib/site-texts/server";
import { requestOrigin } from "@/lib/seo/site-identity";

export interface SiteFacts {
  /** Null when the request carries no usable host. Structured data needs absolute addresses, so nothing is written then. */
  origin:   string | null;
  siteName: string;
  /** The logo as the header shows it, or null. May be root-relative. */
  logoUrl:  string | null;
}

export const getSiteFacts = cache(async (): Promise<SiteFacts> => {
  const [tenant, origin] = await Promise.all([getActiveTenant(), headers().then(requestOrigin)]);
  const siteName = tenant.name || tenant.theme.meta.name;
  // The logo is nice to have. A CMS that does not answer must not cost the page.
  const logoUrl = await (async () => {
    const settings = await getTenantForRender(tenant.tenantId);
    if (settings?.branding?.logo?.url) return settings.branding.logo.url;
    const site = await getTenantSiteSettings(tenant.tenantId, settings, await getSiteLanguage());
    return site?.logo?.url ?? null;
  })().catch(() => null);
  return { origin, siteName, logoUrl };
});
