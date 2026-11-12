/**
 * The site language, for server components.
 *
 * Same order as everywhere else: the visitor's own choice (the `locale`
 * cookie), then the language the tenant's site is written in, then English.
 */
import "server-only";

import { getLocale } from "@/lib/locale";
import { toSiteLocale, type SiteLocale } from "./locale";

export async function getSiteLocale(): Promise<SiteLocale> {
  return toSiteLocale(await getLocale());
}
