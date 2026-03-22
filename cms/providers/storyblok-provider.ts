/**
 * StoryblokProvider
 *
 * CMSProvider implementation backed by the Storyblok Content Delivery API v2.
 * Replaces MockCMSProvider when STORYBLOK_ACCESS_TOKEN is set and Sanity is
 * not configured.
 *
 * ─── Architecture ─────────────────────────────────────────────────────────────
 *
 *   StoryblokProvider receives a StoryblokClient at construction time.
 *   This allows callers to inject a test client in unit tests without
 *   environment variable setup. The default constructor creates a live
 *   client via createStoryblokClient().
 *
 *   Content is stored as Storyblok stories, organised in three folders:
 *     hero-variants/{key}   →  heroVariant stories
 *     proof-variants/{key}  →  proofVariant stories
 *     cta-variants/{key}    →  ctaVariant stories
 *
 *   Each public method builds the story slug from the variant key (via the
 *   slug builder functions in cms/queries/storyblok/), then delegates to the
 *   private fetchVariant() helper which handles the full lifecycle.
 *
 * ─── fetchVariant() lifecycle ────────────────────────────────────────────────
 *
 *   1. Build slug from key
 *   2. Fetch story via StoryblokClient.fetchStory() — returns null for 404
 *   3. Check content.is_active — inactive stories are treated as not found
 *   4. Map story content to internal block data type via the Storyblok mapper
 *   5. Wrap in try/catch — errors return null (logged at warn), never throw
 *
 * ─── is_active vs. Storyblok publication state ───────────────────────────────
 *
 *   Storyblok's `version=published` filter (set in StoryblokClient) means
 *   only published stories are returned — draft stories 404 automatically.
 *   The `is_active` content field is a soft-disable within published stories:
 *   it allows editors to deactivate a variant without unpublishing the story.
 *
 * ─── Caching ─────────────────────────────────────────────────────────────────
 *
 *   All fetches are tagged with STORYBLOK_CACHE_TAG and participate in ISR.
 *   On-demand revalidation: call `revalidateTag("storyblok")` from a webhook
 *   route handler triggered by Storyblok's Story Published webhook.
 *
 * ─── Null semantics ──────────────────────────────────────────────────────────
 *
 *   null is returned (never thrown) in three cases:
 *   1. Story not found (slug not in Storyblok, or story not published)
 *   2. Story found but content.is_active === false
 *   3. Network or parse error (logged as warning)
 *
 *   The experience composer handles null via its fallback strategy.
 *
 * ─── Environment variables ───────────────────────────────────────────────────
 *
 *   STORYBLOK_ACCESS_TOKEN  required  Content Delivery API token
 *   STORYBLOK_REGION        optional  "eu" | "us" | "ap" | "ca" | "cn" (default: "eu")
 *   STORYBLOK_VERSION       optional  "published" | "draft" (default: "published")
 */

import type { CMSProvider } from "./cms-provider";
import type { HeroBlockData, ProofBlockData, CTABlockData, SiteSettingsData, PageData } from "../types";
import type {
  StoryblokHeroContent,
  StoryblokProofContent,
  StoryblokCTAContent,
} from "../queries/storyblok";
import {
  heroVariantSlug,
  proofVariantSlug,
  ctaVariantSlug,
} from "../queries/storyblok";
import {
  mapStoryblokHero,
  mapStoryblokProof,
  mapStoryblokCTA,
} from "../mappers/storyblok";
import {
  StoryblokClient,
  createStoryblokClient,
} from "./storyblok-client";
import { logger } from "@/lib/logger";

// ── Provider ──────────────────────────────────────────────────────────────────

export class StoryblokProvider implements CMSProvider {
  private readonly client: StoryblokClient;

  /**
   * @param client  Optional pre-configured StoryblokClient.
   *                Omit in production — a client is created from env vars.
   *                Inject in tests to avoid env var setup.
   */
  constructor(client?: StoryblokClient) {
    this.client = client ?? createStoryblokClient();
  }

  // ── CMSProvider interface ─────────────────────────────────────────────────

  async getHeroVariant(key: string): Promise<HeroBlockData | null> {
    return this.fetchVariant<StoryblokHeroContent, HeroBlockData>(
      heroVariantSlug(key),
      mapStoryblokHero,
      "hero variant",
    );
  }

  async getProofVariant(key: string): Promise<ProofBlockData | null> {
    return this.fetchVariant<StoryblokProofContent, ProofBlockData>(
      proofVariantSlug(key),
      mapStoryblokProof,
      "proof variant",
    );
  }

  async getCTAVariant(key: string): Promise<CTABlockData | null> {
    return this.fetchVariant<StoryblokCTAContent, CTABlockData>(
      ctaVariantSlug(key),
      mapStoryblokCTA,
      "CTA variant",
    );
  }

  // TODO: implement Storyblok site settings fetch when a siteSettings story
  // has been created in the Storyblok space.
  async getSiteSettings(): Promise<SiteSettingsData | null> {
    return Promise.resolve(null);
  }

  // TODO: implement Storyblok page fetch when page stories have been created.
  async getPageBySlug(_slug: string): Promise<PageData | null> {
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

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Generic fetch-and-map helper shared by all three public methods.
   *
   * Mirrors SanityProvider.fetchVariant() in structure — any developer
   * familiar with the Sanity implementation will recognise this pattern.
   *
   * The extra `is_active` check is Storyblok-specific: Sanity handles this
   * at the GROQ query level (`isActive == true`), but Storyblok has no
   * server-side field filter on the CDN API, so the check happens here.
   *
   * @param slug    Full Storyblok story slug built by a slug builder function
   * @param mapper  Pure function translating TContent → TResult
   * @param label   Human-readable label for log messages
   */

  // ── Entity document stubs ───────────────────────────────────────────────────
  //
  // Full Storyblok implementations go here once Company / NewsArticle / Vacancy
  // content types exist in the Storyblok space.

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

  private async fetchVariant<TContent extends { is_active?: boolean }, TResult>(
    slug: string,
    mapper: (content: TContent) => TResult,
    label: string,
  ): Promise<TResult | null> {
    try {
      const story = await this.client.fetchStory<TContent>(slug);

      if (!story) {
        logger.debug(`[StoryblokProvider] ${label} not found.`, { slug });
        return null;
      }

      if (story.content.is_active === false) {
        logger.debug(`[StoryblokProvider] ${label} is inactive.`, { slug });
        return null;
      }

      return mapper(story.content);
    } catch (err) {
      logger.warn(`[StoryblokProvider] Failed to fetch ${label}.`, {
        slug,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }
}
