/**
 * StatamicProvider
 *
 * CMSProvider implementation backed by the Statamic Content REST API.
 * Replaces MockCMSProvider when STATAMIC_API_URL is set and neither
 * Sanity nor Storyblok is configured.
 *
 * ─── Architecture ──────────────────────────────────────────────────────────
 *
 *   StatamicProvider receives a StatamicClient at construction time.
 *   This allows callers to inject a test client in unit tests without
 *   environment variable setup. The default constructor creates a live
 *   client via createStatamicClient().
 *
 *   Content is stored as Statamic collection entries:
 *     hero_variants   collection  →  heroVariant entries
 *     proof_variants  collection  →  proofVariant entries
 *     cta_variants    collection  →  ctaVariant entries
 *
 *   Each public method fetches the entry from its collection by key,
 *   then delegates to the private fetchVariant() helper which handles
 *   the full lifecycle.
 *
 * ─── fetchVariant() lifecycle ──────────────────────────────────────────────
 *
 *   1. Fetch entry from collection via StatamicClient.fetchEntry()
 *      — returns null for 404
 *   2. Check entry.is_active — inactive entries are treated as not found
 *   3. Map entry to internal block data type via the Statamic mapper
 *   4. Wrap in try/catch — errors return null (logged at warn), never throw
 *
 * ─── is_active vs. Statamic publication state ──────────────────────────────
 *
 *   Statamic's REST API returns published entries only (status filtering is
 *   typically set at the collection level). The `is_active` field is a
 *   soft-disable within published entries: it allows editors to deactivate
 *   an entry without hiding it from the collection.
 *
 * ─── Caching ───────────────────────────────────────────────────────────────
 *
 *   All fetches are tagged with STATAMIC_CACHE_TAG and participate in ISR.
 *   On-demand revalidation: call `revalidateTag("statamic")` from a webhook
 *   route handler triggered by Statamic's saved/published entry webhooks.
 *
 * ─── Null semantics ────────────────────────────────────────────────────────
 *
 *   null is returned (never thrown) in three cases:
 *   1. Entry not found (key not in Statamic, or entry not published)
 *   2. Entry found but is_active === false
 *   3. Network or parse error (logged as warning)
 *
 *   The experience composer handles null via its fallback strategy.
 *
 * ─── Environment variables ────────────────────────────────────────────────
 *
 *   STATAMIC_API_URL   required  Base URL of Statamic site
 *   STATAMIC_API_KEY   optional  Bearer token for protected APIs
 */

import type { CMSProvider } from "./cms-provider";
import type { HeroBlockData, ProofBlockData, CTABlockData, FeatureBlockData, ConversionBlockData, NotificationBlockData, SiteSettingsData, PageData } from "../types";
import type {
  StatamicHeroEntry,
  StatamicProofEntry,
  StatamicCTAEntry,
} from "../queries/statamic";
import {
  HERO_VARIANTS_COLLECTION,
  PROOF_VARIANTS_COLLECTION,
  CTA_VARIANTS_COLLECTION,
} from "../queries/statamic";
import {
  mapStatamicHero,
  mapStatamicProof,
  mapStatamicCTA,
} from "../mappers/statamic";
import { StatamicClient, createStatamicClient } from "./statamic-client";
import { logger } from "@/lib/logger";
import type { ProvisionResult, TestConnectionResult } from "./cms-provider";
import type { TenantSettings } from "@/tenant/types";

// ── Provider ───────────────────────────────────────────────────────────────

export class StatamicProvider implements CMSProvider {
  private readonly client: StatamicClient;

  /**
   * @param client  Optional pre-configured StatamicClient.
   *                Omit in production — a client is created from env vars.
   *                Inject in tests to avoid env var setup.
   */
  constructor(client?: StatamicClient) {
    this.client = client ?? createStatamicClient();
  }

  // ── CMSProvider interface ──────────────────────────────────────────────

  async getHeroVariant(key: string): Promise<HeroBlockData | null> {
    return this.fetchVariant<StatamicHeroEntry, HeroBlockData>(
      HERO_VARIANTS_COLLECTION,
      key,
      mapStatamicHero,
      "hero variant",
    );
  }

  async getProofVariant(key: string): Promise<ProofBlockData | null> {
    return this.fetchVariant<StatamicProofEntry, ProofBlockData>(
      PROOF_VARIANTS_COLLECTION,
      key,
      mapStatamicProof,
      "proof variant",
    );
  }

  async getCTAVariant(key: string): Promise<CTABlockData | null> {
    return this.fetchVariant<StatamicCTAEntry, CTABlockData>(
      CTA_VARIANTS_COLLECTION,
      key,
      mapStatamicCTA,
      "CTA variant",
    );
  }

  async getFeatureVariant(_key: string): Promise<FeatureBlockData | null> {
    // Extended slot — Statamic implementation not yet available.
    // Returns null so the slot is gracefully absent from the experience.
    return Promise.resolve(null);
  }

  async getConversionVariant(_key: string): Promise<ConversionBlockData | null> {
    // Extended slot — Statamic implementation not yet available.
    // Returns null so the slot is gracefully absent from the experience.
    return Promise.resolve(null);
  }

  async getNotificationVariant(_key: string): Promise<NotificationBlockData | null> {
    // Extended slot — Statamic implementation not yet available.
    // Returns null so the notification is gracefully absent from the experience.
    return Promise.resolve(null);
  }

  async getAdaptiveBlock(key: string): Promise<import("../types").AdaptiveBlockData | null> {
    // Adaptive blocks are platform-managed (Supabase-backed), not stored in Statamic.
    // Delegate to the shared adaptive-blocks store.
    const { getAdaptiveBlockByKey } = await import("@/lib/adaptive-blocks/adaptive-blocks-store");
    return getAdaptiveBlockByKey(key, null);
  }

  // TODO: implement Statamic site settings fetch when a siteSettings entry
  // has been created in the Statamic collection.
  async getSiteSettings(_locale = "en"): Promise<SiteSettingsData | null> {
    return Promise.resolve(null);
  }

  // TODO: implement Statamic page fetch when page entries have been created.
  async getPageBySlug(_slug: string, _locale = "en"): Promise<PageData | null> {
    return Promise.resolve(null);
  }

  async getContentByKeys(keys: string[]): Promise<Record<string, unknown>> {
    if (keys.length === 0) return {};
    const result: Record<string, unknown> = Object.fromEntries(keys.map((k) => [k, null]));
    await Promise.all(
      keys.map(async (key) => {
        const hero = await this.getHeroVariant(key);
        if (hero != null) { result[key] = hero; return; }
        const proof = await this.getProofVariant(key);
        if (proof != null) { result[key] = proof; return; }
        const cta = await this.getCTAVariant(key);
        if (cta != null) { result[key] = cta; }
      }),
    );
    return result;
  }

  // ── Private helpers ────────────────────────────────────────────────────

  /**
   * Generic fetch-and-map helper shared by all three public methods.
   *
   * Mirrors StoryblokProvider.fetchVariant() in structure — any developer
   * familiar with the Storyblok implementation will recognise this pattern.
   *
   * The `is_active` check at the provider level mirrors Storyblok's approach:
   * Statamic's API can't filter on content fields server-side (unlike Sanity's
   * GROQ), so we check in code instead.
   *
   * @param collection  The Statamic collection handle, e.g. "hero_variants"
   * @param key         The entry's unique key, e.g. "hero_test"
   * @param mapper      Pure function translating entry content → TResult
   * @param label       Human-readable label for log messages
   */

  // ── Entity document stubs ───────────────────────────────────────────────────
  //
  // Full Statamic implementations go here once Company / NewsArticle / Vacancy
  // collections exist in the Statamic site.

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

  /**
   * Resolves collection-driven block items via the Statamic REST API.
   *
   * Each CollectionKey maps to a Statamic collection endpoint:
   *   articles / news → /api/collections/articles/entries
   *   vacancies       → /api/collections/vacancies/entries
   *   companies       → /api/collections/companies/entries
   *   cases           → /api/collections/cases/entries
   *
   * Full implementation is deferred until Statamic collection endpoints are
   * configured for the tenant. Returns [] in the interim so blocks degrade
   * gracefully to empty rather than erroring.
   */
  async resolveCollection(
    _source: import("@/page-config/collection-source").CollectionContentSource,
  ): Promise<import("@/page-config/collection-source").CollectionItem[]> {
    // TODO: Implement full Statamic collection resolution via REST API
    // Delegate to getNewsArticles() / getVacancies() / getCompanies() once those
    // methods are wired to live Statamic endpoints.
    return [];
  }

  // ── Provider management ───────────────────────────────────────────────────

  /**
   * Provisioning is not yet supported for the Statamic provider.
   * Use the Statamic Control Panel or CLI to seed starter content for a tenant.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async provisionSite(_tenant: TenantSettings, _options?: { dryRun?: boolean; siteType?: string; pages?: ReadonlyArray<{ presetKey: string; title: string; slug: string }>; includeDefaultBlocks?: boolean; starterContentMode?: import("./cms-provider").StarterContentMode; includeShowcasePage?: boolean }): Promise<ProvisionResult> {
    return {
      ok:    false,
      error: "Provisioning is not yet implemented for the Statamic provider. " +
             "Create starter content via the Statamic Control Panel or CLI.",
    };
  }

  /** Tests connectivity by attempting a low-cost API read. */
  async testConnection(): Promise<TestConnectionResult> {
    try {
      // Fetching a non-existent entry returns null (not a throw) on 404 —
      // a thrown error signals a real connectivity or auth failure.
      await this.client.fetchEntry("__connection_test__", "__platform_test__");
      return { ok: true, provider: "statamic", readAccess: true };
    } catch (err) {
      return {
        ok:       false,
        provider: "statamic",
        error:    err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async fetchVariant<TEntry extends { is_active?: boolean }, TResult>(
    collection: string,
    key: string,
    mapper: (entry: TEntry & { id: string; slug: string }) => TResult,
    label: string,
  ): Promise<TResult | null> {
    try {
      const entry = await this.client.fetchEntry<TEntry>(collection, key);

      if (!entry) {
        logger.debug(`[StatamicProvider] ${label} not found.`, { collection, key });
        return null;
      }

      if (entry.is_active === false) {
        logger.debug(`[StatamicProvider] ${label} is inactive.`, { collection, key });
        return null;
      }

      return mapper(entry as TEntry & { id: string; slug: string });
    } catch (err) {
      logger.warn(`[StatamicProvider] Failed to fetch ${label}.`, {
        collection,
        key,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }
}
