/**
 * Storyblok Content Delivery Client
 *
 * A thin wrapper around the Storyblok Content Delivery API v2 (REST) that
 * participates in Next.js ISR via native `fetch` — no additional npm package
 * required. This mirrors how @sanity/client works under the hood.
 *
 * ─── Storyblok Content Delivery API v2 ───────────────────────────────────────
 *
 *   Base URL varies by region (see STORYBLOK_CDN_BASE_URLS).
 *   Authentication is via an `access_token` query parameter (read-only token).
 *   Stories are fetched by their full slug, e.g. "hero-variants/hero_google_problem".
 *
 *   GET /v2/cdn/stories/{full_slug}?token={access_token}&version=published
 *
 * ─── ISR / caching ───────────────────────────────────────────────────────────
 *
 *   Next.js App Router intercepts native `fetch` calls and extends them with
 *   ISR options. StoryblokClient passes `{ next: { revalidate, tags } }` to
 *   every story fetch so cache invalidation works on-demand via:
 *     revalidateTag(STORYBLOK_CACHE_TAG)
 *
 * ─── Region support ──────────────────────────────────────────────────────────
 *
 *   Storyblok hosts separate CDN endpoints per region. STORYBLOK_REGION
 *   selects the correct base URL. Default: "eu".
 *
 *   Supported regions and their CDN base URLs:
 *     eu  →  https://api.storyblok.com/v2/cdn         (default)
 *     us  →  https://api-us.storyblok.com/v2/cdn
 *     ap  →  https://api-ap.storyblok.com/v2/cdn
 *     ca  →  https://api-ca.storyblok.com/v2/cdn
 *     cn  →  https://app.storyblokchina.cn/v2/cdn
 *
 * ─── Error handling ──────────────────────────────────────────────────────────
 *
 *   404 → returns null (story not found or not published)
 *   Other non-2xx → throws an Error (caught by StoryblokProvider.fetchVariant)
 *
 * ─── Environment variables ───────────────────────────────────────────────────
 *
 *   STORYBLOK_ACCESS_TOKEN  required  Content Delivery API access token
 *   STORYBLOK_REGION        optional  "eu" | "us" | "ap" | "ca" | "cn" (default: "eu")
 *   STORYBLOK_VERSION       optional  "published" | "draft" (default: "published")
 */

import { serverEnv } from "@/lib/env";

// ── Region → CDN base URL map ─────────────────────────────────────────────────

export type StoryblokRegion = "eu" | "us" | "ap" | "ca" | "cn";

/**
 * Storyblok Content Delivery API v2 CDN base URLs, keyed by region.
 * Used by createStoryblokClient() to resolve the correct endpoint.
 */
export const STORYBLOK_CDN_BASE_URLS: Record<StoryblokRegion, string> = {
  eu: "https://api.storyblok.com/v2/cdn",
  us: "https://api-us.storyblok.com/v2/cdn",
  ap: "https://api-ap.storyblok.com/v2/cdn",
  ca: "https://api-ca.storyblok.com/v2/cdn",
  cn: "https://app.storyblokchina.cn/v2/cdn",
} as const;

// ── ISR / caching constants ───────────────────────────────────────────────────

/**
 * ISR revalidation window for Storyblok content (seconds).
 *
 * Matches SANITY_REVALIDATE_SECONDS for a consistent caching policy
 * across CMS providers. Raise to 300–900 in production as confidence grows.
 */
export const STORYBLOK_REVALIDATE_SECONDS = 60;

/**
 * Default Next.js cache tag applied to all Storyblok fetch calls.
 * Use with `revalidateTag(STORYBLOK_CACHE_TAG)` for on-demand ISR invalidation
 * from a Storyblok webhook route handler.
 */
export const STORYBLOK_CACHE_TAG = "storyblok" as const;

// ── Response types ────────────────────────────────────────────────────────────

/**
 * A Storyblok story envelope as returned by the Content Delivery API.
 *
 * TContent is the component-specific content shape — defined in the
 * cms/queries/storyblok/ query files (e.g. StoryblokHeroContent).
 */
export interface StoryblokStory<TContent> {
  /** Storyblok internal numeric ID */
  id: number;
  /** UUID — stable across environments */
  uuid: string;
  /** Full slug — folder + story slug, e.g. "hero-variants/hero_google_problem" */
  full_slug: string;
  /** The story's field values, typed by TContent */
  content: TContent;
}

/** Wrapper object returned by the GET /stories/{slug} endpoint */
interface StoryblokStoryResponse<TContent> {
  story: StoryblokStory<TContent>;
}

// ── Client ────────────────────────────────────────────────────────────────────

/**
 * Thin Storyblok Content Delivery API v2 client.
 *
 * Uses native `fetch` so Next.js App Router can attach ISR cache options.
 * The access token is stored at construction time; never appears in logs.
 *
 * @example
 *   // Inject in tests:
 *   const client = new StoryblokClient("my-token", "https://api.storyblok.com/v2/cdn");
 *
 *   // Use in production via factory:
 *   const client = createStoryblokClient();
 */
export class StoryblokClient {
  constructor(
    private readonly accessToken: string,
    private readonly cdnBaseUrl: string,
    private readonly contentVersion: "published" | "draft",
  ) {}

  /**
   * Fetch a single story by its full slug.
   *
   * @param slug  The story's full slug, e.g. "hero-variants/hero_google_problem".
   *              Constructed by the slug builder functions in cms/queries/storyblok/.
   * @returns     The story envelope, or null if 404 (story not found / not published).
   * @throws      Error for non-404 HTTP errors (network failure, auth error, etc.)
   */
  async fetchStory<TContent>(slug: string): Promise<StoryblokStory<TContent> | null> {
    const url = `${this.cdnBaseUrl}/stories/${slug}?version=${this.contentVersion}&token=${this.accessToken}`;

    const response = await fetch(url, {
      // Next.js ISR options — same pattern as @sanity/client
      next: {
        revalidate: STORYBLOK_REVALIDATE_SECONDS,
        tags: [STORYBLOK_CACHE_TAG],
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(
        `Storyblok API error fetching "${slug}": ` +
          `HTTP ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as StoryblokStoryResponse<TContent>;
    return data.story ?? null;
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Creates a configured StoryblokClient from validated environment variables.
 *
 * Reads STORYBLOK_ACCESS_TOKEN, STORYBLOK_REGION, and STORYBLOK_VERSION
 * from serverEnv.storyblok. All validation and error reporting is handled
 * by the env module — callers check serverEnv.storyblok.isConfigured first.
 *
 * @internal  Exposed for testing (inject a pre-configured StoryblokClient
 *            into StoryblokProvider rather than calling this in tests).
 */
export function createStoryblokClient(): StoryblokClient {
  const { accessToken, region, version } = serverEnv.storyblok;

  const cdnBaseUrl =
    STORYBLOK_CDN_BASE_URLS[region as StoryblokRegion] ??
    STORYBLOK_CDN_BASE_URLS.eu;

  return new StoryblokClient(accessToken, cdnBaseUrl, version);
}
