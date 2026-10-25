/**
 * GET /sitemap.xml — per host, so every tenant domain lists its own pages.
 *
 * The homepage is always listed. A CMS provider that implements
 * listIndexablePaths() (Statamic) adds every published, indexable page and
 * collection entry. A CMS failure degrades to the homepage only, never a 500.
 */

import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getActiveTenant, getTenantById } from "@/tenant/server";
import { createCMSProvider } from "@/cms";
import type { IndexablePath } from "@/cms/providers/cms-provider";
import { requestOrigin } from "@/lib/seo/site-identity";
import { toSitemapEntries } from "@/lib/seo/sitemap";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = requestOrigin(await headers());
  if (!origin) return [];

  let paths: IndexablePath[] = [];
  try {
    const { tenantId } = await getActiveTenant();
    const settings = await getTenantById(tenantId);
    const provider = createCMSProvider(settings?.cms, tenantId);
    paths = provider.listIndexablePaths ? await provider.listIndexablePaths() : [];
  } catch (err) {
    logger.warn("[sitemap] CMS paths unavailable — homepage only", { error: String(err) });
  }
  return toSitemapEntries(origin, paths);
}
