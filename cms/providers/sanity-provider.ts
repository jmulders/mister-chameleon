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

import type { SanityClient, QueryParams } from "@sanity/client";
import type { CMSProvider } from "./cms-provider";
import type {
  HeroBlockData,
  ProofBlockData,
  CTABlockData,
  SiteSettingsData,
  PageData,
} from "../types";
import type {
  SanityHeroRaw,
  SanityProofRaw,
  SanityCTARaw,
  SanitySiteSettingsRaw,
  SanityPageRaw,
} from "../queries/sanity";
import {
  HERO_BY_KEY_QUERY,
  PROOF_BY_KEY_QUERY,
  CTA_BY_KEY_QUERY,
  SITE_SETTINGS_QUERY,
  PAGE_BY_SLUG_QUERY,
} from "../queries/sanity";
import {
  mapSanityHero,
  mapSanityProof,
  mapSanityCTA,
  mapSanitySiteSettings,
  mapSanityPage,
} from "../mappers/sanity";
import {
  createSanityClient,
  SANITY_REVALIDATE_SECONDS,
  SANITY_CACHE_TAG,
} from "./sanity-client";
import { logger } from "@/lib/logger";

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
 * enabling ISR participation without any extra configuration.
 *
 * Note: typed explicitly (not `as const`) so that `tags` is `string[]`, which
 * is what FilteredResponseQueryOptions expects. Using `as const` would produce
 * a `readonly ["sanity"]` tuple that is not assignable to `string[]`.
 */
const FETCH_OPTIONS: { next: { revalidate: number; tags: string[] } } = {
  next: {
    revalidate: SANITY_REVALIDATE_SECONDS,
    tags: [SANITY_CACHE_TAG],
  },
};

// ── Provider ──────────────────────────────────────────────────────────────────

export class SanityProvider implements CMSProvider {
  private readonly client:   SanityClient;
  /**
   * Tenant scope injected into every GROQ query as `$tenantId`.
   * null → no filtering (backward-compatible; all documents returned).
   * "<slug>" → documents for that tenant + documents with no tenantId set.
   */
  private readonly tenantId: string | null;

  /**
   * @param client    Optional pre-configured SanityClient.
   *                  Omit in production — a client is created from env vars.
   *                  Inject in tests to avoid env var setup.
   * @param tenantId  Optional tenant scope, e.g. "workengine".
   *                  Omit (or pass null) to return all-tenant documents.
   */
  constructor(client?: SanityClient, tenantId?: string | null) {
    this.client   = client ?? createSanityClient();
    this.tenantId = tenantId ?? null;
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

  // tenantId is threaded through fetchVariant (below) — the three methods above
  // share the same helper which injects this.tenantId into each GROQ params object.

  async getSiteSettings(): Promise<SiteSettingsData | null> {
    return this.fetchDocument<SanitySiteSettingsRaw, SiteSettingsData>(
      SITE_SETTINGS_QUERY,
      mapSanitySiteSettings,
      "site settings",
    );
  }

  async getPageBySlug(slug: string): Promise<PageData | null> {
    try {
      const raw = await this.client.fetch<SanityPageRaw | null>(
        PAGE_BY_SLUG_QUERY,
        { slug, tenantId: this.tenantId } satisfies QueryParams,
        FETCH_OPTIONS,
      );

      if (raw === null || raw === undefined) {
        logger.debug(`[SanityProvider] page not found.`, { slug });
        return null;
      }

      return mapSanityPage(raw);
    } catch (err) {
      logger.warn(`[SanityProvider] Failed to fetch page.`, {
        slug,
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

    // Pre-populate every key with null. Documents found in Sanity will
    // overwrite their entry; any key absent from the result set stays null.
    const result: Record<string, unknown> = Object.fromEntries(
      keys.map((k) => [k, null]),
    );

    try {
      const docs = await this.client.fetch<Record<string, unknown>[]>(
        CONTENT_BY_KEYS_QUERY,
        { keys } satisfies QueryParams,
        FETCH_OPTIONS,
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
    try {
      const raw = await this.client.fetch<TRaw | null>(
        query,
        { key, tenantId: this.tenantId } satisfies QueryParams,
        FETCH_OPTIONS,
      );

      if (raw === null || raw === undefined) {
        logger.debug(`[SanityProvider] ${label} not found.`, { key });
        return null;
      }

      return mapper(raw);
    } catch (err) {
      logger.warn(`[SanityProvider] Failed to fetch ${label}.`, {
        key,
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

  private async fetchDocument<TRaw, TResult>(
    query: string,
    mapper: (raw: TRaw) => TResult,
    label: string,
  ): Promise<TResult | null> {
    try {
      const raw = await this.client.fetch<TRaw | null>(
        query,
        {} satisfies QueryParams,
        FETCH_OPTIONS,
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
