/**
 * lib/seo/structured-data.ts
 *
 * Structured data (schema.org, as JSON-LD) for the pages of a site: the
 * organisation behind it, an article, and a person on the team.
 *
 * The owner asked for these on 26 Nov 2026. Until then a site only said what
 * it was called (WebSite on the homepage, lib/seo/site-identity.ts). Search
 * engines and AI assistants read this to know who publishes a page, when an
 * article appeared and who a team page is about.
 *
 * Every builder says only what the page itself shows. Nothing is invented: no
 * rating, no author when the CMS names none, no portrait for a person.
 */

/** Serialise for a <script type="application/ld+json">. `<` is escaped so no value can close the script element. */
function serialise(data: Record<string, unknown>): string {
  return JSON.stringify({ "@context": "https://schema.org", ...data }).replace(/</g, "\\u003c");
}

const filled = (value: string | null | undefined): value is string => typeof value === "string" && value.trim() !== "";

/** The organisation as a node other data can point at. */
function organisationNode(name: string, origin: string, logoUrl?: string | null): Record<string, unknown> {
  return {
    "@type": "Organization",
    name,
    url:     `${origin}/`,
    ...(filled(logoUrl) ? { logo: absoluteUrl(logoUrl, origin) } : {}),
  };
}

/** A root-relative address made absolute. An address that already has a scheme is left alone. */
export function absoluteUrl(url: string, origin: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

/** Organization, for the homepage: the name, the address and the logo of the site. */
export function organizationJsonLd(name: string, origin: string, logoUrl?: string | null): string {
  return serialise(organisationNode(name, origin, logoUrl));
}

export interface ArticleFacts {
  /** "BlogPosting" for a blog article, "NewsArticle" for a news item. */
  type:         "BlogPosting" | "NewsArticle";
  headline:     string;
  description?: string | null;
  /** Path of the article on the site, e.g. "/blog/my-post". */
  path:         string;
  /** "YYYY-MM-DD". Left out when the CMS gives no date. */
  publishedAt?: string | null;
  modifiedAt?:  string | null;
  /** The site's name: the publisher, and the author when the article names no person. */
  siteName:     string;
  logoUrl?:     string | null;
}

/**
 * An article. The author is the organisation: the articles carry no byline, and
 * a made-up person would be a false claim.
 */
export function articleJsonLd(facts: ArticleFacts, origin: string): string {
  const publisher = organisationNode(facts.siteName, origin, facts.logoUrl);
  const url       = absoluteUrl(facts.path, origin);
  return serialise({
    "@type":          facts.type,
    headline:         facts.headline,
    ...(filled(facts.description) ? { description: facts.description } : {}),
    ...(filled(facts.publishedAt) ? { datePublished: facts.publishedAt } : {}),
    ...(filled(facts.modifiedAt) ? { dateModified: facts.modifiedAt } : filled(facts.publishedAt) ? { dateModified: facts.publishedAt } : {}),
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author:           publisher,
    publisher,
  });
}

export interface PersonFacts {
  name:     string;
  /** Job title as the page shows it. */
  role?:    string | null;
  /** Path of the person's page on the site, e.g. "/team/anna". */
  path:     string;
  /** A public profile the CMS names, e.g. LinkedIn. */
  sameAs?:  string | null;
  siteName: string;
}

/**
 * A person on the team: name, job title and employer. No image: a portrait on
 * a team page can be a stand-in, and structured data would present it as the
 * person.
 */
export function personJsonLd(facts: PersonFacts, origin: string): string {
  return serialise({
    "@type":  "Person",
    name:     facts.name,
    ...(filled(facts.role) ? { jobTitle: facts.role } : {}),
    url:      absoluteUrl(facts.path, origin),
    ...(filled(facts.sameAs) && /^https?:\/\//i.test(facts.sameAs) ? { sameAs: [facts.sameAs] } : {}),
    worksFor: organisationNode(facts.siteName, origin),
  });
}
