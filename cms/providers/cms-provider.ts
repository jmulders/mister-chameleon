/**
 * CMSProvider interface
 *
 * The contract every CMS provider implementation must satisfy.
 * The rest of the codebase (route handlers, RSC layouts, tests) depends
 * only on this interface, never on a concrete implementation.
 *
 * ─── Current implementations ──────────────────────────────────────────────────
 *
 *   SanityProvider   — fetches from Sanity CDN/API using @sanity/client + GROQ
 *   StoryblokProvider — fetches from Storyblok CDN using the Content Delivery API
 *   StatamicProvider — fetches from a Statamic REST API endpoint
 *   MockCMSProvider  — in-memory hardcoded data, zero dependencies (dev / tests)
 *
 * ─── Key design decisions ─────────────────────────────────────────────────────
 *
 *  1. Methods return `null` when a key is not found rather than throwing.
 *     Callers should handle null gracefully (e.g. fall back to default content).
 *
 *  2. Methods accept a plain `string` key rather than a typed variant key.
 *     This keeps the CMS layer decoupled from the decision layer's type vocabulary.
 *
 *  3. All methods are async even when the implementation is synchronous
 *     (as in MockCMSProvider). This ensures the interface is drop-in compatible
 *     with network-bound implementations without changing call sites.
 *
 *  4. `provisionSite` moves initial content seeding behind the provider
 *     abstraction so that provisioning flows are CMS-agnostic.  Providers that
 *     do not support managed provisioning return `{ ok: false, error: "…" }`.
 *
 *  5. `testConnection` lets the admin UI surface a quick connectivity check
 *     without knowledge of the underlying CMS credentials or API shape.
 */

import type {
  HeroBlockData,
  ProofBlockData,
  CTABlockData,
  FeatureBlockData,
  ConversionBlockData,
  NotificationBlockData,
  AdaptiveBlockData,
  SiteSettingsData,
  PageData,
  CompanyData,
  NewsArticleData,
  VacancyData,
} from "../types";
import type { TenantSettings }          from "@/tenant/types";
import type {
  CollectionContentSource,
  CollectionItem,
  CollectionKey,
  ListingFilters,
}                                        from "@/page-config/collection-source";

// ── Provisioning types ────────────────────────────────────────────────────────

/**
 * Controls how starter content is applied inside page sections during provisioning.
 *
 *   "none"      — pages are provisioned with block structure but empty fields.
 *                 A clean slate for editors; no risk of overwriting real content.
 *   "fill"      — pages get rich dummy copy; existing CMS documents are left
 *                 untouched (createIfNotExists — non-destructive on re-runs).
 *   "overwrite" — pages get rich dummy copy; always replaced even when they
 *                 already exist in the CMS (createOrReplace — use with care).
 */
export type StarterContentMode = "none" | "fill" | "overwrite";

// ── Shared result types ───────────────────────────────────────────────────────

/**
 * Result of a `provisionSite()` call.
 *
 *   ok: true  — all starter documents were written (or dry-run simulated).
 *     documentIds        — CMS document IDs created or replaced.
 *     pagesCreated       — page documents that did not exist before this run.
 *     pagesUpdated       — page documents that already existed and were replaced.
 *     variantsWritten    — total variant docs (hero/proof/cta) written.
 *     siteSettingsWritten — true when the siteSettings doc was successfully written.
 *     navItemsWritten    — number of navigationItem docs written (0 if skipped).
 *     warnings           — non-fatal notes (e.g. fallback config sources used).
 *
 *   ok: false — provisioning failed; `error` is a human-readable reason.
 *     partial  — document IDs written before the failure (best-effort).
 */
export type ProvisionResult =
  | {
      ok:                  true;
      documentIds:         string[];
      pagesCreated:        number;
      pagesUpdated:        number;
      variantsWritten:     number;
      siteSettingsWritten: boolean;
      navItemsWritten:     number;
      warnings:            string[];
    }
  | { ok: false; error: string; partial?: string[] };

/**
 * Result of a `testConnection()` call.
 *
 *   ok: true  — the provider can reach the CMS and read content.
 *     provider    — the provider name ("sanity", "storyblok", "statamic", "mock").
 *     readAccess  — true when at least one read was successful.
 *
 *   ok: false — connectivity or auth failed.
 *     provider — the provider name.
 *     error    — human-readable error message.
 */
export type TestConnectionResult =
  | { ok: true;  provider: string; readAccess: boolean }
  | { ok: false; provider: string; error: string };

// ── Provider interface ────────────────────────────────────────────────────────

export interface CMSProvider {
  // ── Variant fetches ────────────────────────────────────────────────────────

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
   * Fetch a feature block content variant by its variant key.
   *
   * Extended slot — returns null when the key is not found.
   * Callers must degrade gracefully (no fallback cascade).
   *
   * @param key - A FeatureVariantKey string, e.g. "feature_grid_primary"
   * @returns The feature content, or null if the key is not found.
   */
  getFeatureVariant(key: string): Promise<FeatureBlockData | null>;

  /**
   * Fetch a conversion block content variant by its variant key.
   *
   * Extended slot — returns null when the key is not found.
   * Callers must degrade gracefully (no fallback cascade).
   *
   * @param key - A ConversionVariantKey string, e.g. "conversion_signup"
   * @returns The conversion content, or null if the key is not found.
   */
  getConversionVariant(key: string): Promise<ConversionBlockData | null>;

  /**
   * Fetch a notification overlay variant by its variant key.
   *
   * Extended slot — returns null when the key is not found.
   * Callers must degrade gracefully (no notification shown when null).
   *
   * @param key - A NotificationVariantKey string, e.g. "notification_offer"
   * @returns The notification content, or null if the key is not found.
   */
  getNotificationVariant(key: string): Promise<NotificationBlockData | null>;

  /**
   * Fetch a complete adaptive hero block (Content Matrix document) by its key.
   *
   * Returns the full document including `defaultVariant` and all
   * `adaptiveVariants`.  The caller (e.g. `ChameleonHero`) picks the right
   * variant and applies token replacement server-side.
   *
   * For Sanity: fetches from the `adaptiveHero` document type via GROQ.
   * For Storyblok / Statamic / Mock: fetches from the platform-managed
   * Supabase `adaptive_blocks` table (CMS-agnostic, no external schema needed).
   *
   * @param key  The block routing key, e.g. "hero_matrix_homepage".
   * @returns    The full AdaptiveBlockData, or null if no document with that key exists.
   */
  getAdaptiveBlock(key: string): Promise<AdaptiveBlockData | null>;

  // ── Site-level fetches ─────────────────────────────────────────────────────

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
   * @param locale  ISO 639-1 locale code, e.g. "en" | "nl" | "de".
   *                When provided the provider first looks for a locale-specific
   *                siteSettings document.  If none exists it falls back to the
   *                default (unlocalized) document.
   *                Defaults to "en" when omitted.
   * @returns The site settings, or null if the document does not exist yet.
   */
  getSiteSettings(locale?: string): Promise<SiteSettingsData | null>;

  // ── Page fetches ───────────────────────────────────────────────────────────

  /**
   * Fetch a published CMS page by its URL slug.
   *
   * Only published pages (isPublished == true) are returned. Drafts and
   * unpublished pages return null, which the route should translate to a 404.
   *
   * @param slug    The page slug without leading slash, e.g. "about-us"
   * @param locale  ISO 639-1 locale code, e.g. "en" | "nl" | "de".
   *                When provided the provider first looks for a page document
   *                with that locale field.  Falls back to the unlocalized doc
   *                when no locale-specific version exists.
   *                Defaults to "en" when omitted.
   * @returns     The page data including ordered sections, or null if not found.
   */
  getPageBySlug(slug: string, locale?: string): Promise<PageData | null>;

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
   *
   * @param keys  Array of variant key strings
   * @returns     `Record<string, unknown>` — `{ [key]: document | null }`.
   */
  getContentByKeys(keys: string[]): Promise<Record<string, unknown>>;

  // ── Entity document fetches ────────────────────────────────────────────────

  getNewsArticleBySlug(slug: string): Promise<NewsArticleData | null>;

  getNewsArticles(options?: {
    limit?:   number;
    tags?:    string[];
    company?: string;
  }): Promise<NewsArticleData[]>;

  getVacancyBySlug(slug: string): Promise<VacancyData | null>;

  getVacancies(options?: {
    limit?:   number;
    company?: string;
  }): Promise<VacancyData[]>;

  getCompanyBySlug(slug: string): Promise<CompanyData | null>;

  getCompanies(options?: {
    limit?: number;
  }): Promise<CompanyData[]>;

  // ── Collection resolution ──────────────────────────────────────────────────

  /**
   * Resolve a set of collection items for a collection-driven content block.
   *
   * This method is the single CMS-agnostic entry point for collection fetches.
   * It maps the platform's abstract CollectionContentSource to the appropriate
   * provider-specific entity queries and returns normalized CollectionItem[].
   *
   * ─── Behaviour contract ───────────────────────────────────────────────────
   *
   *   - Never throws.  Errors are caught and return [] so blocks degrade
   *     gracefully to an empty state rather than crashing the page.
   *
   *   - "recent" mode: returns up to source.limit items ordered by publication
   *     date according to source.sortDir ("desc" by default = newest first).
   *
   *   - "specific" mode: fetches items whose CMS document ID matches one of
   *     source.selectedIds.  The provider SHOULD return items in any order;
   *     the caller (collection-resolver) re-sorts to match selectedIds order
   *     via sortBySelectedIds().
   *
   *   - Providers that do not support a given collection key return [] rather
   *     than throwing (forward-compatible with new collection types).
   *
   * @param source  The resolved CollectionContentSource from a block's data.
   * @returns       Normalized CollectionItem[] ready for rendering.
   */
  resolveCollection(source: CollectionContentSource): Promise<CollectionItem[]>;

  /**
   * Fetch the available filter groups for a collection listing page.
   *
   * Returns one FilterGroup per relevant taxonomy, each containing the
   * published terms as FilterOption[] — ready to be passed to a FilterBar block.
   *
   * Providers that do not support taxonomy-driven filters return [] rather
   * than throwing (graceful degradation — FilterBar shows no filter dropdowns).
   *
   * @param collection  Platform collection key, e.g. "vacancies" or "articles"
   * @returns           Array of FilterGroup (may be empty)
   */
  getListingFilters(collection: CollectionKey): Promise<ListingFilters>;

  // ── Provider management ────────────────────────────────────────────────────

  /**
   * Provision starter CMS content for a tenant.
   *
   * Writes initial variant documents (hero/proof/cta) and page documents
   * (home, about, contact, and any additional pages from the page store)
   * using a create-or-replace strategy so that re-running is safe.
   *
   * Providers that do not support managed provisioning (e.g. Storyblok,
   * Statamic) return `{ ok: false, error: "…" }` immediately without throwing.
   *
   * @param tenant   The tenant's stored settings — used to scope document IDs,
   *                 resolve credentials, and apply package-gated block lists.
   * @param options  Optional runtime flags.
   *   dryRun              — when true, builds all documents and returns their IDs without
   *                         writing anything to the CMS.  Useful for validating config.
   *   siteType            — when provided, enables the site-preset path (corporate |
   *                         recruitment | content) and writes navigation + site settings.
   *   pages               — explicit list of pages to provision, produced by
   *                         templateKeysToPageEntries() from the operator's selection in
   *                         the "Initialize site" / "Re-initialize site" panel.
   *                         When provided, these pages take precedence over the full site
   *                         preset page list so only selected pages are written.
   *                         When absent, the full preset page list is used (backward compat).
   *   includeDefaultBlocks — when false, pages are created with empty sections (clean slate).
   *                         When true (default), pages include the block structure defined by
   *                         their preset.  Only used on the Sanity provider path.
   *   starterContentMode  — controls how starter content is applied to page sections.
   *                         "none"      — blocks are added as empty stubs (no dummy text).
   *                         "fill"      — blocks get rich starter content; existing pages are
   *                                       preserved (createIfNotExists — non-destructive).
   *                         "overwrite" — blocks get rich starter content; pages are always
   *                                       replaced even if they already exist (createOrReplace).
   *                         Defaults to "fill".  Only relevant when includeDefaultBlocks=true.
   */
  provisionSite(
    tenant:   TenantSettings,
    options?: {
      dryRun?:               boolean;
      siteType?:             string;
      pages?:                ReadonlyArray<{ presetKey: string; title: string; slug: string }>;
      includeDefaultBlocks?: boolean;
      starterContentMode?:   StarterContentMode;
      /** When true, provision a `/components` page containing every registered
       *  block type so editors can browse all available components in the CMS. */
      includeShowcasePage?:  boolean;
    },
  ): Promise<ProvisionResult>;

  /**
   * Test whether this provider can reach the CMS and read content.
   *
   * Performs a low-cost read operation against the configured CMS endpoint
   * to confirm credentials, project/space/site ID, and network access are
   * all working.  The check is read-only and never writes any data.
   *
   * @returns TestConnectionResult — ok: true with readAccess flag on success;
   *          ok: false with a human-readable error on any failure.
   */
  testConnection(): Promise<TestConnectionResult>;
}
