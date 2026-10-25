/**
 * lib/seo/site-identity.ts
 *
 * How the site presents itself to search engines on the homepage.
 *
 * Google picks the site name shown above a search result mostly from WebSite
 * structured data on the homepage, then og:site_name, then the <title>. The
 * homepage used to fall back to the CMS entry title, which is the label "Home",
 * so that was all Google had to go on.
 */

/**
 * The homepage <title>: the editor's SEO title when set, else the tenant name.
 * The CMS entry title ("Home") is a label in the CMS, not a title for search.
 */
export function homeTitle(seoTitle: string | null | undefined, tenantName: string): string {
  const seo = typeof seoTitle === "string" ? seoTitle.trim() : "";
  return seo || tenantName;
}

/** Request origin from the proxy headers, or null when no host is known. */
export function requestOrigin(headers: { get(name: string): string | null }): string | null {
  const host = (headers.get("x-forwarded-host") ?? headers.get("host") ?? "").split(",")[0].trim();
  if (!host || !/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return null;
  const proto = (headers.get("x-forwarded-proto") ?? "").split(",")[0].trim();
  const scheme = proto === "http" || proto === "https"
    ? proto
    : /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host) ? "http" : "https";
  return `${scheme}://${host}`;
}

/**
 * WebSite structured data for the homepage, serialised for a
 * <script type="application/ld+json">. `<` is escaped so a tenant name can never
 * close the script element.
 */
export function websiteJsonLd(name: string, origin: string): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type":    "WebSite",
    name,
    url:        `${origin}/`,
  }).replace(/</g, "\\u003c");
}
