/**
 * The site language, for server components and route handlers.
 *
 * Order: the visitor's own choice (the `locale` cookie), then the language the
 * active tenant's site is written in, then English.
 *
 * The tenant comes from getActiveTenant(), not from the host name alone. That
 * way a development or preview host that shows a Dutch tenant is Dutch too,
 * instead of falling back to English because its host is not in the tenant
 * table.
 */
import "server-only";

import { cookies } from "next/headers";
import { getLocale } from "@/lib/locale";
import { isSupportedLocale, LOCALE_COOKIE, type SupportedLocale } from "@/lib/locale-shared";
import { getActiveTenant } from "@/tenant/server";
import { toSiteLocale, type SiteLocale } from "./locale";

/** The full language code (en, nl or de), for <html lang>. */
export async function getSiteLanguage(): Promise<SupportedLocale> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value ?? "";
  if (isSupportedLocale(chosen)) return chosen;

  try {
    const tenantDefault = (await getActiveTenant()).defaultLocale ?? "";
    if (isSupportedLocale(tenantDefault)) return tenantDefault;
  } catch {
    // No tenant for this request: fall through to the host-based default.
  }
  return getLocale();
}

/** The language of the platform's own texts: Dutch or English. */
export async function getSiteLocale(): Promise<SiteLocale> {
  return toSiteLocale(await getSiteLanguage());
}
