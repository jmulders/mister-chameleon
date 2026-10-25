/**
 * GET /robots.txt — per host. Points crawlers at this host's /sitemap.xml and
 * keeps the app areas (admin, dashboard, API, previews, checkout) out of search.
 */

import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { requestOrigin } from "@/lib/seo/site-identity";
import { robotsFor } from "@/lib/seo/sitemap";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  return robotsFor(requestOrigin(await headers()));
}
