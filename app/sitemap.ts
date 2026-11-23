/**
 * GET /sitemap.xml — per host, so every tenant domain lists its own pages.
 *
 * The homepage is always listed. A CMS provider that implements
 * listIndexablePaths() (Statamic) adds every published, indexable page and
 * collection entry. A site without such a provider lists its homepage only.
 *
 * When the CMS cannot be read, the route fails with an error. It used to
 * answer with the homepage only and status 200. A search engine reads that as
 * "these are all the pages", while an error makes it come back later and keep
 * the list it had. Measured on 23 Nov 2026: the live sitemap listed 4
 * addresses instead of 34 on the first request after a quiet half minute.
 */

import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getActiveTenant, getTenantById } from "@/tenant/server";
import { createCMSProvider } from "@/cms";
import type { IndexablePath } from "@/cms/providers/cms-provider";
import { requestOrigin } from "@/lib/seo/site-identity";
import { sitemapPathsFor, toSitemapEntries } from "@/lib/seo/sitemap";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = requestOrigin(await headers());
  if (!origin) return [];

  let paths: IndexablePath[] = [];
  try {
    const { tenantId } = await getActiveTenant();
    const settings = await getTenantById(tenantId);
    // getTenantById gives null when the database cannot be read. Without the
    // settings the site's CMS is unknown, and the list would be the homepage only.
    if (!settings) throw new Error(`[sitemap] the settings of tenant "${tenantId}" cannot be read`);
    const provider = createCMSProvider(settings.cms, tenantId);
    paths = provider.listIndexablePaths ? await provider.listIndexablePaths() : [];
  } catch (err) {
    logger.error("[sitemap] CMS paths unavailable, answering with an error", { error: String(err) });
    throw err;
  }
  return toSitemapEntries(origin, sitemapPathsFor(origin, paths));
}
