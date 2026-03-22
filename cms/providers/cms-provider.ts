/**
 * CMSProvider interface
 *
 * The contract every CMS provider implementation must satisfy.
 * The rest of the codebase (route handlers, RSC layouts, tests) depends
 * only on this interface, never on a concrete implementation.
 *
 * Current implementations:
 *   MockCMSProvider    — in-memory hardcoded data, zero dependencies (MVP / testing)
 *
 * Planned implementations:
 *   SanityCMSProvider  — fetches from Sanity CDN using @sanity/client + GROQ
 *   CachedCMSProvider  — wraps any provider with ISR / edge-cache invalidation
 *
 * Key design decisions:
 *
 *  1. Methods return `null` when a key is not found rather than throwing.
 *     Callers should handle null gracefully (e.g. fall back to default content).
 *
 *  2. Methods accept a plain `string` key rather than a typed variant key.
 *     This keeps the CMS layer decoupled from the decision layer's type vocabulary.
 *     Callers cast or narrow as needed.
 *
 *  3. All methods are async even when the implementation is synchronous
 *     (as in MockCMSProvider). This ensures the interface is drop-in compatible
 *     with network-bound implementations without changing call sites.
 */

import type {
  HeroBlockData,
  ProofBlockData,
  CTABlockData,
  SiteSettingsData,
  PageData,
  CompanyData,
  NewsArticleData,
  VacancyData,
} from "../types";

export interface CMSProvider {
  /**
   * Fetch a hero block content variant by its variant key.
   *
   * @param key - A HeroVariantKey string, e.g. "hero_google_problem"
   * @returns The hero content, or null if the key is not found.
   */
  getHeroVariant(key: string): Promise<HeroBlockData | null>;

  /**
   * Fetch a proof block content variant by its variant key.
   *
   * @param key - A ProofVariantKey string, e.g. "proof_cases"
   * @returns The proof content, or null if the key is not found.
   */
  getProofVariant(key: string): Promise<ProofBlockData | null>;

  /**
   * Fetch a CTA block content variant by its variant key.
   *
   * @param key - A CTAVariantKey string, e.g. "cta_guide"
   * @returns The CTA content, or null if the key is not found.
   */
  getCTAVariant(key: string): Promise<CTABlockData | null>;

  /**
   * Fetch the singleton site settings document.
   *
   * Returns the fields needed by the site shell (header/footer):
   *   siteTitle, logo, mainNavigation, footerNavigation.
   *
   * Navigation references are resolved — each item carries a plain `href`
   * string derived from the linked page's slug (internal) or the stored URL
   * (external). The rendering layer can use the items directly without any
   * further CMS calls.
   *
   * @returns The site settings, or null if the document does not exist yet.
   */
  getSiteSettings(): Promise<SiteSettingsData | null>;

  /**
   * Fetch a published CMS page by its URL slug.
   *
   * Only published pages (isPublished == true) are returned. Drafts and
   * unpublished pages return null, which the route should translate to a 404.
   *
   * @param slug  The page slug without leading slash, e.g. "about-us"
   * @returns     The page data including ordered sections, or null if not found.
   */
  getPageBySlug(slug: string): Promise<PageData | null>;

  /**
   * Fetch multiple content documents by their variant key in a single round-trip.
   *
   * Returns a map whose keys are exactly the requested `keys` array entries.
   * Each value is either the raw content document (typed as `unknown`) or `null`
   * when no document with that key exists in the CMS.
   *
   * Behaviour contract:
   *   - Never throws. Network or CMS errors are captured and result in the
   *     affected keys mapping to `null`.
   *   - An empty `keys` array returns `{}` immediately with no network call.
   *   - Every requested key is present in the returned map (null for missing).
   *   - The caller is responsible for interpreting the raw document shape; use
   *     the extraction helpers in buildContentReadinessContext for typed access.
   *
   * @param keys  Array of variant key strings, e.g. ["hero_google_problem", "cta_guide"]
   * @returns     `Record<string, unknown>` — `{ [key]: document | null }`.
   */
  getContentByKeys(keys: string[]): Promise<Record<string, unknown>>;

  // ── Entity document methods ────────────────────────────────────────────────
  //
  // Fetch standalone content entity documents (Company, NewsArticle, Vacancy).
  // These are separate from page documents — they are assembled into PageData
  // by the entity-page mappers in cms/mappers/entity-page-assemblers.ts before
  // being passed to mapPageDataToPageConfig().

  /**
   * Fetch a single published news article by its URL slug.
   *
   * @param slug  Article slug without leading slash, e.g. "acme-acquires-rival"
   * @returns     The article document, or null if not found / unpublished.
   */
  getNewsArticleBySlug(slug: string): Promise<NewsArticleData | null>;

  /**
   * Fetch an ordered list of published news articles.
   *
   * @param options.limit  Maximum number of articles to return (default: all).
   * @param options.tags   Filter to articles that carry at least one of these tags.
   * @param options.company Filter to articles linked to this company slug.
   * @returns Ordered array (newest first), empty when none match.
   */
  getNewsArticles(options?: {
    limit?:   number;
    tags?:    string[];
    company?: string;
  }): Promise<NewsArticleData[]>;

  /**
   * Fetch a single published vacancy by its URL slug.
   *
   * @param slug  Vacancy slug, e.g. "senior-frontend-engineer"
   * @returns     The vacancy document, or null if not found / unpublished.
   */
  getVacancyBySlug(slug: string): Promise<VacancyData | null>;

  /**
   * Fetch an ordered list of published vacancies.
   *
   * @param options.limit    Maximum number of vacancies to return (default: all).
   * @param options.company  Filter to vacancies belonging to this company slug.
   * @returns Ordered array, empty when none match.
   */
  getVacancies(options?: {
    limit?:   number;
    company?: string;
  }): Promise<VacancyData[]>;

  /**
   * Fetch a single published company by its URL slug.
   *
   * @param slug  Company slug, e.g. "acme-corp"
   * @returns     The company document, or null if not found / unpublished.
   */
  getCompanyBySlug(slug: string): Promise<CompanyData | null>;

  /**
   * Fetch an ordered list of published companies.
   *
   * @param options.limit  Maximum number of companies to return (default: all).
   * @returns Ordered array, empty when none match.
   */
  getCompanies(options?: {
    limit?: number;
  }): Promise<CompanyData[]>;
}
