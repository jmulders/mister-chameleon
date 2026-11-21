/**
 * Site settings (menu, footer, logo, theme preset) for a tenant, read from the
 * tenant's own CMS.
 *
 * Everything that needs the settings asks here: the root layout, the theme
 * decision, the header and the footer. They share one remembered answer per
 * tenant and language, so they must all ask the same CMS.
 *
 * They did not. Found on 22 Nov 2026: the layout and the theme decision made
 * their provider without the tenant's CMS setting, which gives the platform's
 * default CMS, while the header and footer used the tenant's. The layout runs
 * first. When the remembered answer went stale it was the layout's provider
 * that was sent to refresh it, and the header's own refresh was skipped as
 * double work. A CMS that is not the tenant's has no menu for the tenant, so
 * the refresh fails the completeness check and is thrown away. On the live
 * site a menu label edited in the tenant's CMS stayed old, across deploys,
 * while the CMS itself answered with the new label.
 */

import type { SiteSettingsData } from "@/cms/types";
import type { TenantSettings } from "@/tenant/types";
import { normalizeTenant } from "@/tenant/normalize";
import { createCMSProvider } from "./create-cms-provider";

export function getTenantSiteSettings(
  tenantId: string,
  tenant: TenantSettings | null | undefined,
  locale: string,
): Promise<SiteSettingsData | null> {
  const tenantCms = tenant ? normalizeTenant(tenant).cms : undefined;
  return createCMSProvider(tenantCms, tenantId).getSiteSettings(locale);
}
