/**
 * The language of the texts the platform itself puts on a tenant's site.
 *
 * A site's content comes from the CMS, in the tenant's language. Around it the
 * platform adds texts of its own: form labels, "read more", the cart, the 404
 * page. Those were hard-coded in English, so a Dutch site was Dutch with
 * English buttons. Each such text now lives in a dictionary under
 * lib/site-texts, in Dutch and English.
 *
 * Two languages for now. German falls back to English, as it did before.
 */

export type SiteLocale = "nl" | "en";

/** Clamp any locale string ("nl", "nl-NL", "de", undefined) to a SiteLocale. */
export function toSiteLocale(locale?: string | null): SiteLocale {
  return (locale ?? "").slice(0, 2).toLowerCase() === "nl" ? "nl" : "en";
}

/** A dictionary with the same keys in every language. */
export type SiteTexts<T> = Record<SiteLocale, T>;
