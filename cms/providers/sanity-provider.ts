/**
 * SanityProvider
 *
 * CMSProvider implementation backed by Sanity.io.
 * Replaces MockCMSProvider in production when SANITY_PROJECT_ID is set.
 *
 * ─── Architecture ─────────────────────────────────────────────────────────────
 *
 *   SanityProvider receives a SanityClient at construction time.
 *   This allows callers to inject a test client in unit tests without
 *   environment variable setup. The default constructor creates a live
 *   client via createSanityClient() from the environment.
 *
 *   Each public fetch method delegates to the private fetchVariant() helper,
 *   which handles the full lifecycle:
 *     1. Runs a parameterised GROQ query against Sanity's API/CDN
 *     2. Returns null if the document is not found (key not in Sanity,
 *        isActive=false, or key is invalid) — logged at debug level
 *     3. Maps the raw Sanity response to the internal block data type
 *        via the appropriate Sanity mapper
 *     4. Catches all errors — network failures return null and are logged
 *        at warn level so the experience composer's fallback plan fires
 *
 * ─── Caching ─────────────────────────────────────────────────────────────────
 *
 *   All fetches are tagged with SANITY_CACHE_TAG ("sanity") and participate
 *   in Next.js ISR. The cache is revalidated either:
 *     a. Automatically after SANITY_REVALIDATE_SECONDS (60s by default)
 *     b. On-demand by calling `revalidateTag("sanity")` from a webhook
 *        route handler — see app/api/revalidate/route.ts (future)
 *
 * ─── Null semantics ──────────────────────────────────────────────────────────
 *
 *   null is returned (never thrown) in two cases:
 *   1. The GROQ query returned no matching document (unknown key or inactive)
 *   2. A network or parse error occurred (logged as a warning)
 *
 *   The experience composer handles null returns via its fallback strategy.
 *
 * ─── Installation ────────────────────────────────────────────────────────────
 *
 *   npm install @sanity/client
 *
 * ─── Environment variables ───────────────────────────────────────────────────
 *
 *   SANITY_PROJECT_ID   required
 *   SANITY_DATASET      required
 *   SANITY_API_VERSION  required
 *   SANITY_READ_TOKEN   optional (needed only for draft/preview content)
 *
 * ─── Tenant scoping ──────────────────────────────────────────────────────────
 *
 *   Pass a `tenantId` string at construction time to scope all queries to that
 *   tenant.  Every query passes `{ …, tenantId: this.tenantId }` to Sanity.
 *
 *   null (the default) → no restriction; all documents returned (backward-compat)
 *   "workengine"       → only documents where `tenantId == "workengine"` OR
 *                        documents with no `tenantId` field (shared content)
 */

import type { SanityClient, QueryParams, FilteredResponseQueryOptions } from "@sanity/client";
import type { CMSProvider, ProvisionResult, TestConnectionResult } from "./cms-provider";
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
} from "../types";
import type { TenantSettings } from "@/tenant/types";
// The provisioner is a Sanity-specific implementation detail — imported here
// so that SanityProvider.provisionSite() can delegate to it without the
// call site (actions.ts) needing to know about the Sanity implementation.
import { provisionTenant } from "@/cms/seed/tenant-provisioner";
import type {
  SanityHeroRaw,
  SanityProofRaw,
  SanityCTARaw,
  SanityFeatureRaw,
  SanityConversionRaw,
  SanityNotificationRaw,
  SanityAdaptiveHeroRaw,
  SanitySiteSettingsRaw,
  SanityPageRaw,
} from "../queries/sanity";
import {
  HERO_BY_KEY_QUERY,
  PROOF_BY_KEY_QUERY,
  CTA_BY_KEY_QUERY,
  FEATURE_BY_KEY_QUERY,
  CONVERSION_BY_KEY_QUERY,
  NOTIFICATION_BY_KEY_QUERY,
  ADAPTIVE_HERO_BY_KEY_QUERY,
  SITE_SETTINGS_QUERY,
  PAGE_BY_SLUG_QUERY,
} from "../queries/sanity";
import {
  mapSanityHero,
  mapSanityProof,
  mapSanityCTA,
  mapSanityFeature,
  mapSanityConversion,
  mapSanityNotification,
  mapSanityAdaptiveHero,
  mapSanitySiteSettings,
  mapSanityPage,
} from "../mappers/sanity";
import {
  createSanityClient,
  createPreviewSanityClient,
  SANITY_REVALIDATE_SECONDS,
  SANITY_CACHE_TAG,
  type SanityClientOverrides,
} from "./sanity-client";
import { logger } from "@/lib/logger";
import { logSanityFetch } from "@/cms/sanity-bandwidth-logger";

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Fetch multiple documents by their Sanity _id in a single round-trip.
 * Returns every field on each document (_id included); the caller decides
 * which fields to use.
 *
 * Parameters:
 *   $keys  string[]  Array of Sanity document _id values to fetch.
 *
 * Returns: array of raw document objects (may be shorter than $keys if some
 *          _ids are not found — missing entries are handled in getContentByKeys).
 */
const CONTENT_BY_KEYS_QUERY = `*[_id in $keys]`;

// ── Fetch options ─────────────────────────────────────────────────────────────

/**
 * Next.js fetch options applied to all Sanity requests.
 *
 * @sanity/client >= 6.4.0 passes these through to the underlying native fetch,
 * enabling both standard cache directives and ISR participation.
 *
 * Development (`NODE_ENV === "development"`):
 *   Uses `cache: "no-store"` which bypasses the Next.js data cache entirely.
 *   Every Sanity request hits the live API directly — CMS changes are visible
 *   on the very next page load without any ISR revalidation lag.
 *   Combined with the in-process CMS cache bypass (CMS_CACHE_ENABLED=false),
 *   this gives zero-delay CMS change visibility in local development.
 *
 * Production:
 *   Participates in Next.js ISR via `next: { revalidate, tags }`.  The cache
 *   is revalidated after SANITY_REVALIDATE_SECONDS (default 60 s in prod) or
 *   on-demand via `revalidateTag("sanity")` from a webhook route handler.
 *
 * Note: typed explicitly (not `as const`) so that `tags` is `string[]`, which
 * is what FilteredResponseQueryOptions expects. Using `as const` would produce
 * a `readonly ["sanity"]` tuple that is not assignable to `string[]`.
 */
const FETCH_OPTIONS: FilteredResponseQueryOptions =
  process.env.NODE_ENV === "development"
    // `cache: "no-store"` tells Next.js (and the underlying native fetch) to
    // skip the data cache entirely — the live Sanity API is hit on every request.
    // This is safe in development and eliminates all ISR-level delay.
    ? ({ cache: "no-store" } as FilteredResponseQueryOptions)
    : {
        next: {
          revalidate: SANITY_REVALIDATE_SECONDS,
          tags: [SANITY_CACHE_TAG],
        },
      };

// ── Provider ──────────────────────────────────────────────────────────────────

export class SanityProvider implements CMSProvider {
  private readonly client:       SanityClient;
  /**
   * Tenant scope injected into every GROQ query as `$tenantId`.
   * null → no filtering (backward-compatible; all documents returned).
   * "<slug>" → documents for that tenant + documents with no tenantId set.
   */
  private readonly tenantId:     string | null;
  /**
   * Locale scope injected into every variant GROQ query as `$locale`.
   * null → no locale filtering (all locale variants returned; EN is fallback).
   * "nl" / "de" → prefer locale-specific variant documents first.
   */
  private readonly locale:       string | null;
  /**
   * Per-instance fetch options.
   *
   * In preview mode (`preview: true`) this is always `{ cache: "no-store" }` so
   * draft content is never served from a stale Next.js data-cache entry.
   * In non-preview mode this follows the module-level FETCH_OPTIONS constant
   * (no-store in dev, ISR-tagged in production).
   */
  private readonly fetchOptions: FilteredResponseQueryOptions;

  /**
   * @param client     Optional pre-configured SanityClient.
   *                   Omit in production — a client is created from env vars.
   *                   Inject in tests to avoid env var setup.
   * @param tenantId   Optional tenant scope, e.g. "workengine".
   *                   Omit (or pass null) to return all-tenant documents.
   * @param overrides  Optional per-tenant config overrides (projectId, dataset,
   *                   apiVersion).  Ignored when `client` is supplied directly.
   *                   When present, these values override the platform-level env
   *                   vars so that each tenant can target its own Sanity project.
   * @param preview    When true, the provider uses `perspective: "previewDrafts"`
   *                   and `cache: "no-store"` so draft documents are always
   *                   fetched fresh from the Sanity live API.
   * @param locale     Optional locale code, e.g. "nl" or "de".
   *                   When provided, variant queries prefer locale-specific
   *                   documents over the default (EN) documents for that tenant.
   */
  constructor(
    client?:    SanityClient,
    tenantId?:  string | null,
    overrides?: SanityClientOverrides,
    preview = false,
    locale?:    string | null,
  ) {
    this.client   = client ?? (preview ? createPreviewSanityClient(overrides) : createSanityClient(overrides));
    this.tenantId = tenantId ?? null;
    this.locale   = locale ?? null;
    // Preview mode must never serve stale data — bypass the Next.js data cache
    // so every draft request hits the Sanity live API directly.
    this.fetchOptions = preview
      ? ({ cache: "no-store" } as FilteredResponseQueryOptions)
      : FETCH_OPTIONS;
  }

  // ── CMSProvider interface ─────────────────────────────────────────────────

  async getHeroVariant(key: string): Promise<HeroBlockData | null> {
    return this.fetchVariant<SanityHeroRaw, HeroBlockData>(
      HERO_BY_KEY_QUERY,
      key,
      mapSanityHero,
      "hero variant",
    );
  }

  async getProofVariant(key: string): Promise<ProofBlockData | null> {
    return this.fetchVariant<SanityProofRaw, ProofBlockData>(
      PROOF_BY_KEY_QUERY,
      key,
      mapSanityProof,
      "proof variant",
    );
  }

  async getCTAVariant(key: string): Promise<CTABlockData | null> {
    return this.fetchVariant<SanityCTARaw, CTABlockData>(
      CTA_BY_KEY_QUERY,
      key,
      mapSanityCTA,
      "CTA variant",
    );
  }

  async getFeatureVariant(key: string): Promise<FeatureBlockData | null> {
    return this.fetchVariant<SanityFeatureRaw, FeatureBlockData>(
      FEATURE_BY_KEY_QUERY,
      key,
      mapSanityFeature,
      "feature variant",
    );
  }

  async getConversionVariant(key: string): Promise<ConversionBlockData | null> {
    return this.fetchVariant<SanityConversionRaw, ConversionBlockData>(
      CONVERSION_BY_KEY_QUERY,
      key,
      mapSanityConversion,
      "conversion variant",
    );
  }

  async getNotificationVariant(key: string): Promise<NotificationBlockData | null> {
    return this.fetchVariant<SanityNotificationRaw, NotificationBlockData>(
      NOTIFICATION_BY_KEY_QUERY,
      key,
      mapSanityNotification,
      "notification variant",
    );
  }

  async getAdaptiveBlock(key: string): Promise<AdaptiveBlockData | null> {
    return this.fetchVariant<SanityAdaptiveHeroRaw, AdaptiveBlockData>(
      ADAPTIVE_HERO_BY_KEY_QUERY,
      key,
      mapSanityAdaptiveHero,
      "adaptive block",
    );
  }

  // tenantId is threaded through fetchVariant (below) — the methods above
  // share the same helper which injects this.tenantId into each GROQ params object.

  async getSiteSettings(locale = "en"): Promise<SiteSettingsData | null> {
    logSanityFetch("SanityProvider/getSiteSettings", { tenantId: this.tenantId, locale });
    // Pass tenantId and locale so the query can prefer the locale-specific
    // siteSettings document and fall back to the default when unavailable.
    return this.fetchDocument<SanitySiteSettingsRaw, SiteSettingsData>(
      SITE_SETTINGS_QUERY,
      mapSanitySiteSettings,
      "site settings",
      { tenantId: this.tenantId ?? "", locale },
    );
  }

  async getPageBySlug(slug: string, locale = "en"): Promise<PageData | null> {
    logSanityFetch("SanityProvider/getPageBySlug", { slug, tenantId: this.tenantId, locale });
    try {
      const raw = await this.client.fetch<SanityPageRaw | null>(
        PAGE_BY_SLUG_QUERY,
        { slug, tenantId: this.tenantId, locale } satisfies QueryParams,
        this.fetchOptions,
      );

      if (raw === null || raw === undefined) {
        logger.debug(`[SanityProvider] page not found.`, { slug, locale });
        return null;
      }

      return mapSanityPage(raw);
    } catch (err) {
      logger.warn(`[SanityProvider] Failed to fetch page.`, {
        slug,
        locale,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  // ── Sanity-specific extensions ────────────────────────────────────────────

  /**
   * Fetch multiple Sanity documents by their `_id` in a single GROQ query.
   *
   * Returns a map whose keys are exactly the requested `keys` array entries.
   * Each value is either the raw Sanity document object (typed as `unknown`)
   * or `null` when no document with that `_id` exists in the dataset.
   *
   * Behaviour guarantees:
   *   - Never throws. Network or parse errors are caught, logged at warn level,
   *     and result in every requested key mapping to `null`.
   *   - Missing `_id`s are individually logged at debug level so the content
   *     team can see which keys need to be published in Sanity.
   *   - An empty `keys` array returns `{}` immediately with no network call.
   *   - The GROQ `in` operator resolves all requested documents in one round-
   *     trip, regardless of how many keys are requested.
   *
   * @param keys  Array of Sanity document `_id` values to fetch.
   * @returns     `Record<string, unknown>` — `{ [_id]: document | null }`.
   *
   * @example
   *   const map = await provider.getContentByKeys([
   *     "hero_google_problem",
   *     "hero_linkedin_vision",
   *   ]);
   *   // map["hero_google_problem"] → { _id: "hero_google_problem", title: "…", … }
   *   // map["hero_linkedin_vision"] → null  (document not in Sanity)
   */
  async getContentByKeys(
    keys: string[],
  ): Promise<Record<string, unknown>> {
    // Fast-path: nothing to fetch.
    if (keys.length === 0) return {};
    logSanityFetch("SanityProvider/getContentByKeys", { count: keys.length, tenantId: this.tenantId });

    // Pre-populate every key with null. Documents found in Sanity will
    // overwrite their entry; any key absent from the result set stays null.
    const result: Record<string, unknown> = Object.fromEntries(
      keys.map((k) => [k, null]),
    );

    try {
      const docs = await this.client.fetch<Record<string, unknown>[]>(
        CONTENT_BY_KEYS_QUERY,
        { keys } satisfies QueryParams,
        this.fetchOptions,
      );

      // Index found documents by _id.
      for (const doc of docs ?? []) {
        const id = doc._id;
        if (typeof id === "string" && id in result) {
          result[id] = doc;
        }
      }

      // Log each key that Sanity returned no document for.
      const missing = keys.filter((k) => result[k] === null);
      if (missing.length > 0) {
        logger.debug("[SanityProvider] getContentByKeys: documents not found", {
          missing,
          requested: keys.length,
          found:     keys.length - missing.length,
        });
      }

      return result;
    } catch (err) {
      logger.warn("[SanityProvider] getContentByKeys: fetch failed", {
        keys,
        error: err instanceof Error ? err.message : String(err),
      });

      // Return null for every requested key so callers get a consistent shape.
      return result; // already initialised to null for every key
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Generic fetch-and-map helper shared by all three public methods.
   *
   * Eliminates the try/catch/null-check/map boilerplate that would otherwise
   * be duplicated across getHeroVariant, getProofVariant, and getCTAVariant.
   *
   * @param query   GROQ query string (one of the *_BY_KEY_QUERY constants)
   * @param key     Variant key passed as the $key GROQ parameter
   * @param mapper  Pure function translating the raw Sanity type to the
   *                internal block data type
   * @param label   Human-readable label for log messages,
   *                e.g. "hero variant", "proof variant", "CTA variant"
   */
  private async fetchVariant<TRaw, TResult>(
    query: string,
    key: string,
    mapper: (raw: TRaw) => TResult,
    label: string,
  ): Promise<TResult | null> {
    logSanityFetch(`SanityProvider/${label}`, { key, tenantId: this.tenantId, locale: this.locale });
    try {
      const raw = await this.client.fetch<TRaw | null>(
        query,
        { key, tenantId: this.tenantId, locale: this.locale } satisfies QueryParams,
        this.fetchOptions,
      );

      if (raw === null || raw === undefined) {
        logger.debug(`[SanityProvider] ${label} not found.`, {
          key,
          queryTenantId: this.tenantId,
        });
        return null;
      }

      // ── Variant resolution debug ─────────────────────────────────────────
      //
      //   Log which document won the resolution race.  This is the primary
      //   diagnostic for "shared platform variant beats tenant variant" bugs.
      //
      //   Expected: docTenantId == queryTenantId  → tenant document won ✓
      //   Unexpected: docTenantId == null/undefined → shared document won  ✗
      //
      //   If you see "shared" in logs when expecting "tenant", check:
      //     a) The Sanity doc's tenantId field matches queryTenantId exactly.
      //     b) The Sanity doc's isActive field is true.
      //     c) The Sanity doc's key field is a plain string (not a slug object).
      const docRecord = raw as Record<string, unknown>;
      const docTenantId = docRecord.tenantId as string | undefined | null;
      const docKey      = (docRecord.key as string | { current?: string } | undefined);
      const resolvedKey = typeof docKey === "string" ? docKey : docKey?.current ?? "(unknown)";
      const scope       = docTenantId ? "tenant" : "shared";

      logger.debug(`[SanityProvider] ${label} resolved.`, {
        requestedKey:    key,
        resolvedKey,
        queryTenantId:   this.tenantId,
        docTenantId:     docTenantId ?? null,
        scope,
        docId:           docRecord._id ?? "(no _id)",
      });

      if (scope === "shared" && this.tenantId !== null) {
        logger.warn(`[SanityProvider] ${label} resolved to SHARED document — no tenant-specific variant found.`, {
          requestedKey:  key,
          queryTenantId: this.tenantId,
          docId:         docRecord._id ?? "(no _id)",
          hint: "Check that a Sanity document exists with this key AND tenantId set to the expected tenant slug, and that isActive is true.",
        });
      }

      return mapper(raw);
    } catch (err) {
      logger.warn(`[SanityProvider] Failed to fetch ${label}.`, {
        key,
        queryTenantId: this.tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Generic fetch-and-map helper for singleton documents (no $key parameter).
   *
   * Used by getSiteSettings() and any future singleton fetches (e.g. global
   * footer content, announcement banners). Shares the same error-handling and
   * ISR tagging behaviour as fetchVariant.
   *
   * @param query   GROQ query string — must return a single object or null
   * @param mapper  Pure function translating the raw Sanity type to the
   *                internal app type
   * @param label   Human-readable label for log messages
   */

  // ── Entity document stubs ───────────────────────────────────────────────────
  //
  // Full GROQ implementations go here once the Company / NewsArticle / Vacancy
  // schemas are published in Sanity Studio. Return null / [] until then so the
  // CMSProvider interface contract is satisfied.

  async getNewsArticleBySlug(_slug: string): Promise<import("../types").NewsArticleData | null> {
    return null;
  }

  async getNewsArticles(_options?: { limit?: number; tags?: string[]; company?: string }): Promise<import("../types").NewsArticleData[]> {
    return [];
  }

  async getVacancyBySlug(_slug: string): Promise<import("../types").VacancyData | null> {
    return null;
  }

  async getVacancies(_options?: { limit?: number; company?: string }): Promise<import("../types").VacancyData[]> {
    return [];
  }

  async getCompanyBySlug(_slug: string): Promise<import("../types").CompanyData | null> {
    return null;
  }

  async getCompanies(_options?: { limit?: number }): Promise<import("../types").CompanyData[]> {
    return [];
  }

  // ── Collection resolution ─────────────────────────────────────────────────

  async resolveCollection(
    source: import("@/page-config/collection-source").CollectionContentSource,
  ): Promise<import("@/page-config/collection-source").CollectionItem[]> {
    const { collection, mode, limit, sortDir = "desc", selectedIds } = source;

    try {
      if (collection === "articles" || collection === "news") {
        const articles = await this.getNewsArticles({ limit: mode === "recent" ? (limit ?? 50) : undefined });
        let items = articles.map((a) => ({
          id:       a.slug,
          title:    a.title,
          href:     `/news/${a.slug}`,
          excerpt:  a.excerpt        ?? undefined,
          date:     a.publishedAt    ?? undefined,
          imageUrl: a.coverImage?.url ?? undefined,
          imageAlt: a.coverImage?.alt ?? undefined,
          tags:     a.tags           ?? undefined,
        }));
        if (mode === "specific" && selectedIds?.length) {
          const idSet = new Set(selectedIds);
          return items.filter((i) => idSet.has(i.id));
        }
        if (sortDir === "asc") items = [...items].reverse();
        return limit ? items.slice(0, limit) : items;
      }

      if (collection === "vacancies") {
        const vacancies = await this.getVacancies({ limit: mode === "recent" ? (limit ?? 50) : undefined });
        let items = vacancies.map((v) => ({
          id:       v.slug,
          title:    v.title,
          href:     `/careers/${v.slug}`,
          date:     v.closingDate ?? undefined,
          category: v.department  ?? undefined,
        }));
        if (mode === "specific" && selectedIds?.length) {
          const idSet = new Set(selectedIds);
          return items.filter((i) => idSet.has(i.id));
        }
        if (sortDir === "asc") items = [...items].reverse();
        return limit ? items.slice(0, limit) : items;
      }

      if (collection === "companies") {
        const companies = await this.getCompanies({ limit: mode === "recent" ? (limit ?? 50) : undefined });
        let items = companies.map((c) => ({
          id:       c.slug,
          title:    c.name,
          href:     `/companies/${c.slug}`,
          excerpt:  c.description ?? undefined,
        }));
        if (mode === "specific" && selectedIds?.length) {
          const idSet = new Set(selectedIds);
          return items.filter((i) => idSet.has(i.id));
        }
        return limit ? items.slice(0, limit) : items;
      }

      // cases + future keys — implement once Sanity schemas are published
      return [];
    } catch {
      return [];
    }
  }

  // ── Provider management ───────────────────────────────────────────────────

  /**
   * Provisions starter CMS content for a tenant into this Sanity dataset.
   *
   * Delegates to `provisionTenant()` from `cms/seed/tenant-provisioner` which
   * handles credential resolution (per-tenant writeToken → platform settings →
   * env vars), document building, and idempotent Sanity `createOrReplace` writes.
   *
   * This keeps all Sanity-specific provisioning logic in tenant-provisioner.ts
   * while making the call site (actions.ts) CMS-agnostic.
   */
  async provisionSite(
    tenant:   TenantSettings,
    options?: {
      dryRun?:               boolean;
      siteType?:             string;
      pages?:                ReadonlyArray<{ presetKey: string; title: string; slug: string }>;
      includeDefaultBlocks?: boolean;
      starterContentMode?:   import("./cms-provider").StarterContentMode;
      includeShowcasePage?:  boolean;
    },
  ): Promise<ProvisionResult> {
    return provisionTenant(
      tenant,
      options?.dryRun ?? false,
      options?.siteType,
      options?.pages,
      options?.includeDefaultBlocks,
      options?.starterContentMode,
      options?.includeShowcasePage,
    );
  }

  /**
   * Tests connectivity to this Sanity project/dataset using the configured
   * read client.
   *
   * Runs a zero-cost GROQ query (`count(*[false])`) which confirms:
   *   - Network reach to the Sanity API/CDN
   *   - Project ID and dataset name are valid
   *   - The read token (if any) is accepted
   *
   * The check is read-only and writes nothing.
   */
  async testConnection(): Promise<TestConnectionResult> {
    try {
      await this.client.fetch<number>(`count(*[false])`);
      return { ok: true, provider: "sanity", readAccess: true };
    } catch (err) {
      return {
        ok:       false,
        provider: "sanity",
        error:    err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async fetchDocument<TRaw, TResult>(
    query: string,
    mapper: (raw: TRaw) => TResult,
    label: string,
    params?: Record<string, unknown>,
  ): Promise<TResult | null> {
    try {
      const raw = await this.client.fetch<TRaw | null>(
        query,
        (params ?? {}) as QueryParams,
        this.fetchOptions,
      );

      if (raw === null || raw === undefined) {
        logger.debug(`[SanityProvider] ${label} not found.`);
        return null;
      }

      return mapper(raw);
    } catch (err) {
      logger.warn(`[SanityProvider] Failed to fetch ${label}.`, {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }
}
