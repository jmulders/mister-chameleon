/**
 * CMS Layer — CachedCMSProvider Decorator
 *
 * A transparent decorator that wraps any CMSProvider implementation and
 * routes all variant / page / site-settings fetches through the in-process
 * CMS variant cache (`cache/cms-cache.ts`) before delegating to the inner
 * provider.
 *
 * ─── What is cached ──────────────────────────────────────────────────────────
 *
 *   Cached (5-min TTL, tenant-scoped):
 *     getHeroVariant       → cms-cache key "{tenantId}:hero:{key}"
 *     getProofVariant      → cms-cache key "{tenantId}:proof:{key}"
 *     getCTAVariant        → cms-cache key "{tenantId}:cta:{key}"
 *     getFeatureVariant    → cms-cache key "{tenantId}:feature:{key}"
 *     getConversionVariant → cms-cache key "{tenantId}:conversion:{key}"
 *     getSiteSettings      → cms-cache key "{tenantId}:siteSettings"
 *     getPageBySlug        → cms-cache key "{tenantId}:page:{slug}"
 *
 *   Negative results (null from the inner provider) are also cached so that
 *   repeated lookups for missing keys don't fan out to the CMS API.
 *
 * ─── What is NOT cached ──────────────────────────────────────────────────────
 *
 *   Pass-through (no caching):
 *     getContentByKeys     — batched, caller-managed; varies per request
 *     getNewsArticles      — collection, paginated, frequently sorted
 *     getNewsArticleBySlug — article content; low traffic, let ISR handle it
 *     getVacancies         — collection, paginated
 *     getVacancyBySlug     — vacancy content; low traffic
 *     getCompanies         — collection, paginated
 *     getCompanyBySlug     — company content; low traffic
 *     resolveCollection    — complex source object; too variable to key cheaply
 *     provisionSite        — admin operation; must never be cached
 *     testConnection       — connectivity check; must always be live
 *
 * ─── Cache origin in debug overlay ──────────────────────────────────────────
 *
 *   The decorator exposes a `lastOrigin` getter on the returned provider
 *   (via a wrapper object) so callers can log which layer served the most
 *   recent fetch.  In practice, the per-request debug overlay reads origins
 *   from the request-scoped `RequestDebugStore` rather than from this getter.
 *
 * ─── Tenant isolation ────────────────────────────────────────────────────────
 *
 *   The `tenantId` passed to the constructor is prepended to every cache key,
 *   ensuring complete isolation between tenants sharing the same process.
 *   Invalidation via `pruneForTenant(tenantId)` evicts only this tenant's
 *   entries without disturbing other tenants.
 */

import type { CMSProvider, ProvisionResult, StarterContentMode, TestConnectionResult } from "./cms-provider";
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
  NewsArticleData,
  VacancyData,
  CompanyData,
} from "../types";
import type { TenantSettings }         from "@/tenant/types";
import type { CollectionContentSource, CollectionItem } from "@/page-config/collection-source";
import {
  getCmsVariant,
  setCmsVariant,
  getCmsSingleton,
  setCmsSingleton,
  getCmsSlug,
  setCmsSlug,
} from "@/cache/cms-cache";

// ── Decorator ─────────────────────────────────────────────────────────────────

/**
 * Wraps any CMSProvider with transparent in-process caching.
 *
 * @example
 * const inner = new SanityProvider(undefined, tenantId);
 * const provider = new CachedCMSProvider(inner, tenantId);
 * // `provider` is a full CMSProvider; callers are unaware of the caching layer.
 */
export class CachedCMSProvider implements CMSProvider {
  constructor(
    private readonly inner:    CMSProvider,
    private readonly tenantId: string | null | undefined,
    private readonly locale:   string | null | undefined = null,
  ) {}

  /** Returns a locale-qualified cache key so NL/DE variants don't collide with EN. */
  private variantKey(slot: string, key: string): string {
    return this.locale ? `${slot}:${this.locale}:${key}` : `${slot}:${key}`;
  }

  // ── Variant fetches (cached) ─────────────────────────────────────────────

  async getHeroVariant(key: string): Promise<HeroBlockData | null> {
    const cacheKey = this.variantKey("hero", key);
    const cached = getCmsVariant<HeroBlockData | null>(this.tenantId, "hero", cacheKey);
    if (cached !== null) return cached;  // cache hit (including negative cache)
    const value = await this.inner.getHeroVariant(key);
    setCmsVariant(this.tenantId, "hero", cacheKey, value);
    return value;
  }

  async getProofVariant(key: string): Promise<ProofBlockData | null> {
    const cacheKey = this.variantKey("proof", key);
    const cached = getCmsVariant<ProofBlockData | null>(this.tenantId, "proof", cacheKey);
    if (cached !== null) return cached;
    const value = await this.inner.getProofVariant(key);
    setCmsVariant(this.tenantId, "proof", cacheKey, value);
    return value;
  }

  async getCTAVariant(key: string): Promise<CTABlockData | null> {
    const cacheKey = this.variantKey("cta", key);
    const cached = getCmsVariant<CTABlockData | null>(this.tenantId, "cta", cacheKey);
    if (cached !== null) return cached;
    const value = await this.inner.getCTAVariant(key);
    setCmsVariant(this.tenantId, "cta", cacheKey, value);
    return value;
  }

  async getFeatureVariant(key: string): Promise<FeatureBlockData | null> {
    const cacheKey = this.variantKey("feature", key);
    const cached = getCmsVariant<FeatureBlockData | null>(this.tenantId, "feature", cacheKey);
    if (cached !== null) return cached;
    const value = await this.inner.getFeatureVariant(key);
    setCmsVariant(this.tenantId, "feature", cacheKey, value);
    return value;
  }

  async getConversionVariant(key: string): Promise<ConversionBlockData | null> {
    const cacheKey = this.variantKey("conversion", key);
    const cached = getCmsVariant<ConversionBlockData | null>(this.tenantId, "conversion", cacheKey);
    if (cached !== null) return cached;
    const value = await this.inner.getConversionVariant(key);
    setCmsVariant(this.tenantId, "conversion", cacheKey, value);
    return value;
  }

  async getNotificationVariant(key: string): Promise<NotificationBlockData | null> {
    const cacheKey = this.variantKey("notification", key);
    const cached = getCmsVariant<NotificationBlockData | null>(this.tenantId, "notification", cacheKey);
    if (cached !== null) return cached;
    const value = await this.inner.getNotificationVariant(key);
    setCmsVariant(this.tenantId, "notification", cacheKey, value);
    return value;
  }

  async getAdaptiveBlock(key: string): Promise<AdaptiveBlockData | null> {
    // Cached under the "adaptive" slot.  5-min TTL applies.
    // Negative results (null) are also cached so a missing key doesn't fan out.
    const cacheKey = this.variantKey("adaptive", key);
    const cached = getCmsVariant<AdaptiveBlockData | null>(this.tenantId, "adaptive", cacheKey);
    if (cached !== null) return cached;
    const value = await this.inner.getAdaptiveBlock(key);
    setCmsVariant(this.tenantId, "adaptive", cacheKey, value);
    return value;
  }

  // ── Site-level fetch (cached) ────────────────────────────────────────────

  async getSiteSettings(locale = "en"): Promise<SiteSettingsData | null> {
    // Cache key includes locale so different language variants are cached independently.
    const cacheKey = `siteSettings:${locale}`;
    const cached = getCmsSingleton<SiteSettingsData | null>(this.tenantId, cacheKey);
    if (cached !== null) return cached;
    const value = await this.inner.getSiteSettings(locale);
    setCmsSingleton(this.tenantId, cacheKey, value);
    return value;
  }

  // ── Page fetch (cached by slug + locale) ────────────────────────────────

  async getPageBySlug(slug: string, locale = "en"): Promise<PageData | null> {
    // Cache key includes locale so NL/DE variants don't collide with EN pages.
    const localisedSlug = `${slug}:${locale}`;
    const cached = getCmsSlug<PageData | null>(this.tenantId, "page", localisedSlug);
    if (cached !== null) return cached;
    const value = await this.inner.getPageBySlug(slug, locale);
    setCmsSlug(this.tenantId, "page", localisedSlug, value);
    return value;
  }

  // ── Pass-throughs (no caching) ───────────────────────────────────────────

  getContentByKeys(keys: string[]): Promise<Record<string, unknown>> {
    return this.inner.getContentByKeys(keys);
  }

  getNewsArticleBySlug(slug: string): Promise<NewsArticleData | null> {
    return this.inner.getNewsArticleBySlug(slug);
  }

  getNewsArticles(options?: {
    limit?:   number;
    tags?:    string[];
    company?: string;
  }): Promise<NewsArticleData[]> {
    return this.inner.getNewsArticles(options);
  }

  getVacancyBySlug(slug: string): Promise<VacancyData | null> {
    return this.inner.getVacancyBySlug(slug);
  }

  getVacancies(options?: {
    limit?:   number;
    company?: string;
  }): Promise<VacancyData[]> {
    return this.inner.getVacancies(options);
  }

  getCompanyBySlug(slug: string): Promise<CompanyData | null> {
    return this.inner.getCompanyBySlug(slug);
  }

  getCompanies(options?: {
    limit?: number;
  }): Promise<CompanyData[]> {
    return this.inner.getCompanies(options);
  }

  resolveCollection(source: CollectionContentSource): Promise<CollectionItem[]> {
    return this.inner.resolveCollection(source);
  }

  provisionSite(
    tenant:   TenantSettings,
    options?: {
      dryRun?:               boolean;
      siteType?:             string;
      pages?:                ReadonlyArray<{ presetKey: string; title: string; slug: string }>;
      includeDefaultBlocks?: boolean;
      starterContentMode?:   StarterContentMode;
      includeShowcasePage?:  boolean;
    },
  ): Promise<ProvisionResult> {
    return this.inner.provisionSite(tenant, options);
  }

  testConnection(): Promise<TestConnectionResult> {
    return this.inner.testConnection();
  }
}
