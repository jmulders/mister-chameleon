"use client";

/**
 * The site language, for client components.
 *
 * A server component asks getSiteLocale() (lib/site-texts/server.ts). A client
 * component cannot read cookies or the tenant during the server render, so the
 * root layout resolves the language once and hands it down through this
 * context. Outside the provider (a story, a test) the hook returns English,
 * which is what every component showed before.
 */

import { createContext, useContext } from "react";
import type { SiteLocale } from "@/lib/site-texts/locale";

const SiteLocaleContext = createContext<SiteLocale>("en");

export function SiteLocaleProvider({ locale, children }: { locale: SiteLocale; children: React.ReactNode }) {
  return <SiteLocaleContext.Provider value={locale}>{children}</SiteLocaleContext.Provider>;
}

export function useSiteLocale(): SiteLocale {
  return useContext(SiteLocaleContext);
}
