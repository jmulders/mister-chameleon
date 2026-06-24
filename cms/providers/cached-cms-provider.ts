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

import { unstable_cache } from "next/cache";
import { readPersistedSiteSettings, persistSiteSettings } from "./site-settings-cache-store";
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

// ── Last-known-good site settings ─────────────────────────────────────────────
//
// Site settings (header nav, top bar, section tabs, CTAs) drive the whole
// chrome of the page. If the CMS is briefly unreachable the inner provider
// returns null, and without a safety net the page falls back to the generic
// platform default — which is what caused the same URL to flip between the real
// site and a "Home / Services / Landing / Components" default depending on which
// serverless instance served the request.
//
// To prevent that we keep the last successful SiteSettings per tenant+locale for
// the lifetime of this server instance. On a CMS hiccup we serve that instead of
// null, and we never write the null into the normal cache (which would poison it
// for the whole TTL). The map only grows by tenant×locale, so it stays tiny.
const lastGoodSiteSettings = new Map<string, SiteSettingsData>();

/**
 * True when site settings carry the Statamic STARTER-template navigation
 * (Home / Services / Landing / About Us / Contact / Components). A freshly-cloned
 * or not-yet-synced Statamic instance serves this default instead of the tenant's
 * real nav. It passes a naive "non-empty" check but is NOT the configured
 * navigation, so serving it makes the header flip between the real nav and the
 * starter default on refresh. The "landing" + "components" label pair is unique
 * to the starter and won't occur in a real configured navigation, so we use it as
 * the rejection signature — applied both when accepting a fresh fetch AND when
 * reading any cached/persisted value (the old gate let it poison the DB cache).
 */
function isStarterNav(settings: SiteSettingsData | null | undefined): boolean {
  const labels = (settings?.mainNavigation ?? []).map(
    (n) => (n?.label ?? "").toLowerCase().trim(),
  );
  return labels.includes("landing") && labels.includes("components");
}

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
    const lgKey    = `${this.tenantId ?? "_"}:${cacheKey}`;
    const cached = getCmsSingleton<SiteSettingsData | null>(this.tenantId, cacheKey);
    if (cached !== null) return cached;

    // ── Cross-instance persistent cache (the real flip-flop fix) ──────────────
    //
    // getSiteSettings() fans out to MANY independent sub-fetches against the CMS
    // (main_nav, top_bar, footer, section_tabs, the layout_settings global that
    // carries the HEADER VARIANT, etc.).  On a cold serverless instance any one
    // of them can transiently fail, producing a DEGRADED result — e.g. the
    // main_nav is present (so the old "navOk" guard passed) but the header
    // variant / section tabs are missing because the layout_settings global
    // fetch failed.  That degraded result rendered a DIFFERENT header than the
    // complete one → the "different navigation on refresh" the user sees.
    //
    // An in-process Map can't fix this: each cold lambda starts empty.  We wrap
    // a COMPLETENESS-GATED fetch in Next's persistent, cross-instance data cache
    // so that once any instance produces a good result it is shared with all
    // others.  "Good" = a non-empty main navigation.
    //
    // NOTE: we deliberately do NOT also require a resolved headerVariant here.
    // Not every tenant sets a header variant (e.g. a tenant on the default
    // header), so requiring it made their settings ALWAYS look "incomplete" —
    // the persistent cache then never stored them, and on a cold serverless
    // instance the page fell through to the live (possibly sleeping) CMS
    // instance and rendered NO navigation at all. Gating on nav only keeps the
    // empty-nav protection without starving header-variant-less tenants.
    const fetchComplete = unstable_cache(
      async (): Promise<SiteSettingsData> => {
        const v = await this.inner.getSiteSettings(locale);
        const hasNav = Boolean(
          v && Array.isArray(v.mainNavigation) && v.mainNavigation.length > 0,
        );
        const starter = isStarterNav(v);
        if (!hasNav || starter) {
          throw new Error(
            starter
              ? "[cached-cms] site settings returned the Statamic starter nav (degraded)"
              : "[cached-cms] site settings have no navigation (transient)",
          );
        }
        return v as SiteSettingsData;
      },
      // NOTE: the key suffix (-v3) is a CACHE VERSION. Bump it whenever the
      // SHAPE or the completeness rule of the cached site-settings changes (e.g.
      // logo URLs switching to absolute, or the starter-nav rejection added in
      // v3), so a deploy bypasses the stale cross-deploy Data Cache entry
      // immediately instead of waiting out `revalidate`.
      ["site-settings-complete-v3", this.tenantId ?? "_", locale],
      { revalidate: 120, tags: ["site-settings"] },
    );

    try {
      const good = await fetchComplete();
      setCmsSingleton(this.tenantId, cacheKey, good);
      lastGoodSiteSettings.set(lgKey, good);
      // Durably persist the COMPLETE result so cold lambdas, cache-key bumps and
      // a slow/restarting CMS still have a real fallback. Fire-and-forget — it
      // must never block or fail the render.
      void persistSiteSettings(this.tenantId, locale, good);
      return good;
    } catch {
      // The live result was incomplete (or a sub-fetch failed).  Serve the
      // richest last-known-good we have so the chrome (header + nav) stays
      // stable instead of flipping to a degraded variant.

      // 1. In-memory last-known-good (warm lambda). Skip a starter-nav value —
      //    an older build may have cached it before the rejection existed.
      const prev = lastGoodSiteSettings.get(lgKey);
      if (prev && !isStarterNav(prev)) return prev;

      // 2. Durable DB last-known-good — survives cold lambdas, cache resets and a
      //    slow/restarting CMS. THIS is what stops the nav/logo from flipping to
      //    the Statamic starter defaults. Reject a poisoned (starter) row so a
      //    previously-persisted starter nav is never served.
      const persisted = await readPersistedSiteSettings(this.tenantId, locale);
      if (persisted && !isStarterNav(persisted)) {
        lastGoodSiteSettings.set(lgKey, persisted);
        return persisted;
      }

      // 3. Truly nothing good cached yet.  Fall back to a raw fetch so the page
      //    still renders SOME chrome rather than nothing — but do NOT cache it
      //    (it may be the degraded starter result).
      const raw = await this.inner.getSiteSettings(locale);
      if (raw && !isStarterNav(raw)) lastGoodSiteSettings.set(lgKey, raw);
      return raw ?? null;
    }
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

  getListingFilters(
    collection: import("@/page-config/collection-source").CollectionKey,
  ): Promise<import("@/page-config/collection-source").ListingFilters> {
    return this.inner.getListingFilters(collection);
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
