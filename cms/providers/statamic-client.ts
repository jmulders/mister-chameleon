/**
 * Statamic Content REST API Client
 *
 * A thin wrapper around the Statamic Content REST API that participates in
 * Next.js ISR via native `fetch` — no additional npm package required.
 * This mirrors how @sanity/client works under the hood.
 *
 * ─── Statamic Content REST API ────────────────────────────────────────────
 *
 *   Base URL is user-configured, typically: https://cms.example.com
 *   Authentication is optional via a Bearer token in the Authorization header.
 *   Entries are fetched from collection endpoints with optional key filtering.
 *
 *   GET /api/collections/{collection}/entries?filter[key:is]={key}&limit=1
 *   Authorization: Bearer {apiKey}  (only if apiKey is set)
 *
 * ─── ISR / caching ────────────────────────────────────────────────────────
 *
 *   Next.js App Router intercepts native `fetch` calls and extends them with
 *   ISR options. StatamicClient passes `{ next: { revalidate, tags } }` to
 *   every entry fetch so cache invalidation works on-demand via:
 *     revalidateTag(STATAMIC_CACHE_TAG)
 *
 * ─── Error handling ───────────────────────────────────────────────────────
 *
 *   404 → returns null (entry not found)
 *   Other non-2xx → throws an Error (caught by StatamicProvider.fetchVariant)
 *
 * ─── Environment variables ────────────────────────────────────────────────
 *
 *   STATAMIC_API_URL   required  Base URL of Statamic site (no trailing slash)
 *   STATAMIC_API_KEY   optional  Bearer token for protected APIs
 */

import { serverEnv } from "@/lib/env";

// ── ISR / caching constants ───────────────────────────────────────────────

/**
 * ISR revalidation window for Statamic content (seconds).
 *
 * Matches STORYBLOK_REVALIDATE_SECONDS and SANITY_REVALIDATE_SECONDS for
 * a consistent caching policy across CMS providers.
 */
export const STATAMIC_REVALIDATE_SECONDS = 60;

/**
 * Default Next.js cache tag applied to all Statamic fetch calls.
 * Use with `revalidateTag(STATAMIC_CACHE_TAG)` for on-demand ISR invalidation
 * from a Statamic webhook route handler.
 */
export const STATAMIC_CACHE_TAG = "statamic" as const;

// ── Response types ────────────────────────────────────────────────────────

/**
 * A Statamic entry from the REST API collection endpoint.
 *
 * TEntry is the entry-specific shape — defined in the cms/queries/statamic/
 * query files (e.g. StatamicHeroEntry). Entries always have id and slug added
 * by the API.
 *
 * The API returns a list of entries, so we extract the first one when present.
 */
export type StatamicEntry<TEntry> = TEntry & {
  id: string;
  slug: string;
};

/** Wrapper object returned by the GET /api/collections/{collection}/entries endpoint */
interface StatamicListResponse<TEntry> {
  data: TEntry[];
  meta: {
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
  };
}

// ── Client ────────────────────────────────────────────────────────────────

/**
 * Thin Statamic Content REST API client.
 *
 * Uses native `fetch` so Next.js App Router can attach ISR cache options.
 * The API key is stored at construction time; never appears in logs.
 *
 * @example
 *   // Inject in tests:
 *   const client = new StatamicClient("https://cms.example.com", "api-key");
 *
 *   // Use in production via factory:
 *   const client = createStatamicClient();
 */
export class StatamicClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string | undefined,
  ) {}

  /**
   * Fetch a single entry from a collection by its key.
   *
   * @param collection  The collection handle, e.g. "hero_variants"
   * @param key         The entry's unique key, e.g. "hero_test"
   * @returns           The entry object, or null if not found (404)
   * @throws            Error for non-404 HTTP errors (network failure, auth error, etc.)
   */
  async fetchEntry<TEntry>(
    collection: string,
    key: string,
  ): Promise<StatamicEntry<TEntry> | null> {
    const url = `${this.baseUrl}/api/collections/${collection}/entries?filter[key:is]=${encodeURIComponent(key)}&limit=1`;

    const headers: Record<string, string> = {
      "Accept": "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url, {
      headers,
      // Next.js ISR options — same pattern as @sanity/client
      next: {
        revalidate: STATAMIC_REVALIDATE_SECONDS,
        tags: [STATAMIC_CACHE_TAG],
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(
        `Statamic API error fetching "${key}" from "${collection}": ` +
          `HTTP ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as StatamicListResponse<TEntry>;
    return (data.data[0] as StatamicEntry<TEntry>) ?? null;
  }
}

// ── Factory ───────────────────────────────────────────────────────────────

/**
 * Creates a configured StatamicClient from validated environment variables.
 *
 * Reads STATAMIC_API_URL and STATAMIC_API_KEY from serverEnv.statamic.
 * All validation and error reporting is handled by the env module — callers
 * check serverEnv.statamic.isConfigured first.
 *
 * @internal  Exposed for testing (inject a pre-configured StatamicClient
 *            into StatamicProvider rather than calling this in tests).
 */
export function createStatamicClient(): StatamicClient {
  const { apiUrl, apiKey } = serverEnv.statamic;
  return new StatamicClient(apiUrl, apiKey);
}
