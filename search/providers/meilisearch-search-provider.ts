/**
 * MeilisearchSearchProvider
 *
 * SearchProvider implementation backed by a Meilisearch instance.
 * Uses the Meilisearch REST API directly via fetch — no SDK dependency.
 *
 * ─── Architecture position ────────────────────────────────────────────────────
 *
 *   getSearchProvider(tenantId)   ← resolves this class when Meilisearch is configured
 *        ↓
 *   MeilisearchSearchProvider.search()
 *        ↓  POST {host}/multi-search
 *   Meilisearch response → SearchResponse
 *
 * ─── Index naming ─────────────────────────────────────────────────────────────
 *
 *   One index per tenant:  {indexPrefix}{tenantId}
 *   All content types share the index with a `contentType` field.
 *   Scopes are filtered server-side using Meilisearch's `filter` parameter.
 *
 *   Content type → scope mapping:
 *     "pages"      ← contentType:"page"
 *     "posts"      ← contentType:"post"
 *     "vacancies"  ← contentType:"vacancy"
 *     (+ cases, news, events, products when indexed)
 *
 * ─── Highlights ───────────────────────────────────────────────────────────────
 *
 *   Meilisearch returns highlight positions via `_formatted` attributes.
 *   We configure `highlightPreTag`/"highlightPostTag" to emit <mark> tags
 *   directly, satisfying the SearchHighlight contract without post-processing.
 *
 * ─── Scope filter ─────────────────────────────────────────────────────────────
 *
 *   When SearchQuery.scopes is provided, a Meilisearch `filter` expression
 *   is added: `contentType IN ["page","post"]` (array mapped from scopes).
 *   When scopes is absent, all content types are returned.
 *
 * ─── Suggest (autocomplete) ───────────────────────────────────────────────────
 *
 *   Uses the Meilisearch search endpoint with `limit: 5` and `attributesToRetrieve`
 *   restricted to `title` for fast typeahead suggestions.
 *
 * ─── Pagination ───────────────────────────────────────────────────────────────
 *
 *   Uses `offset` + `limit` pagination (Meilisearch ≥ v1.0 supports this
 *   without the legacy `page`/`hitsPerPage` approach).
 *   `estimatedTotalHits` is used for the SearchResponse.total field.
 */

import "server-only";

import { logger }               from "@/lib/logger";
import type {
  SearchProvider,
  SearchQuery,
  SearchResponse,
  SearchResult,
  SearchHighlight,
  SearchSuggestion,
  SearchScope,
  SearchResultType,
}                               from "@/search";

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface MeilisearchProviderConfig {
  /** Meilisearch base URL, e.g. "https://search.acme.com" */
  host: string;
  /** Search-only or admin API key */
  apiKey: string;
  /** Full index name: {indexPrefix}{tenantId} */
  indexName: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scope → content type mapping
// ─────────────────────────────────────────────────────────────────────────────

/** Maps a SearchScope to the `contentType` value stored in the index. */
const SCOPE_TO_CONTENT_TYPE: Record<SearchScope, string> = {
  pages:     "page",
  posts:     "post",
  vacancies: "vacancy",
};

/** Maps a stored `contentType` string back to a SearchResultType. */
function toResultType(contentType: string): SearchResultType {
  switch (contentType) {
    case "post":     return "post";
    case "vacancy":  return "vacancy";
    default:         return "page";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Raw Meilisearch response shapes
// ─────────────────────────────────────────────────────────────────────────────

interface MeilisearchHit {
  id:           string;
  contentType?: string;
  title?:       string;
  slug?:        string;
  excerpt?:     string;
  imageUrl?:    string;
  imageAlt?:    string;
  collection?:      string;
  collectionLabel?: string;
  /** Present when attributesToHighlight is set */
  _formatted?: {
    title?:   string;
    excerpt?: string;
    [key: string]: string | undefined;
  };
}

interface MeilisearchSearchResult {
  hits:                  MeilisearchHit[];
  estimatedTotalHits:    number;
  offset:                number;
  limit:                 number;
  processingTimeMs:      number;
}

// ─────────────────────────────────────────────────────────────────────────────
// MeilisearchSearchProvider
// ─────────────────────────────────────────────────────────────────────────────

export class MeilisearchSearchProvider implements SearchProvider {
  private readonly host:      string;
  private readonly apiKey:    string;
  private readonly indexName: string;

  constructor(config: MeilisearchProviderConfig) {
    // Strip trailing slash so all URLs are constructed uniformly
    this.host      = config.host.replace(/\/$/, "");
    this.apiKey    = config.apiKey;
    this.indexName = config.indexName;
  }

  async search(query: SearchQuery): Promise<SearchResponse> {
    const start  = Date.now();
    const limit  = Math.max(1, Math.min(query.limit  ?? 10, 100));
    const offset = Math.max(0, query.offset ?? 0);
    const q      = query.query.trim();

    // ── Build Meilisearch search params ─────────────────────────────────────
    const params: Record<string, unknown> = {
      q,
      limit,
      offset,
      attributesToHighlight: ["title", "excerpt"],
      highlightPreTag:        "<mark>",
      highlightPostTag:       "</mark>",
      attributesToRetrieve: [
        "id", "contentType", "title", "slug", "excerpt",
        "imageUrl", "imageAlt", "collection", "collectionLabel",
      ],
    };

    // Scope filter: if caller restricts to specific scopes, translate to
    // Meilisearch filter expression `contentType IN ["page","post"]`
    if (query.scopes && query.scopes.length > 0) {
      const types = query.scopes
        .map((s) => SCOPE_TO_CONTENT_TYPE[s])
        .filter(Boolean);

      if (types.length > 0) {
        params.filter = `contentType IN [${types.map((t) => `"${t}"`).join(", ")}]`;
      }
    }

    // ── Call Meilisearch ─────────────────────────────────────────────────────
    let raw: MeilisearchSearchResult;
    try {
      raw = await this._post<MeilisearchSearchResult>(
        `/indexes/${encodeURIComponent(this.indexName)}/search`,
        params,
      );
    } catch (err) {
      logger.warn("[MeilisearchSearchProvider] Search request failed", {
        index: this.indexName,
        error: String(err),
      });
      return {
        query,
        results: [],
        total:   0,
        hasMore: false,
        took:    Date.now() - start,
      };
    }

    // ── Map hits to SearchResult[] ───────────────────────────────────────────
    const results: SearchResult[] = raw.hits.map((hit) => {
      const highlights: SearchHighlight[] = [];

      if (hit._formatted?.title && hit._formatted.title !== hit.title) {
        highlights.push({ field: "title", snippet: hit._formatted.title });
      }
      if (hit._formatted?.excerpt && hit._formatted.excerpt !== hit.excerpt) {
        highlights.push({ field: "excerpt", snippet: hit._formatted.excerpt });
      }

      return {
        id:      hit.id,
        type:    toResultType(hit.contentType ?? "page"),
        title:   hit.title   ?? "Untitled",
        slug:    hit.slug    ?? "/",
        excerpt: hit.excerpt ?? undefined,
        image:   hit.imageUrl
          ? { src: hit.imageUrl, alt: hit.imageAlt ?? "" }
          : undefined,
        highlights:      highlights.length > 0 ? highlights : undefined,
        collection:      hit.collection      ?? undefined,
        collectionLabel: hit.collectionLabel ?? undefined,
      };
    });

    const total = raw.estimatedTotalHits;

    return {
      query,
      results,
      total,
      hasMore: offset + results.length < total,
      took:    Date.now() - start,
    };
  }

  async suggest(
    query:   string,
    scopes?: readonly SearchScope[],
  ): Promise<readonly SearchSuggestion[]> {
    if (!query || query.length < 2) return [];

    const params: Record<string, unknown> = {
      q:     query.trim(),
      limit: 5,
      attributesToRetrieve: ["title", "contentType"],
    };

    if (scopes && scopes.length > 0) {
      const types = scopes.map((s) => SCOPE_TO_CONTENT_TYPE[s]).filter(Boolean);
      if (types.length > 0) {
        params.filter = `contentType IN [${types.map((t) => `"${t}"`).join(", ")}]`;
      }
    }

    try {
      const raw = await this._post<MeilisearchSearchResult>(
        `/indexes/${encodeURIComponent(this.indexName)}/search`,
        params,
      );

      return raw.hits
        .filter((h) => typeof h.title === "string" && h.title)
        .map((h) => ({
          text:  h.title!,
          scope: toResultType(h.contentType ?? "page"),
        }));
    } catch {
      return [];
    }
  }

  // ── Internal: HTTP helper ────────────────────────────────────────────────────

  private async _post<T>(path: string, body: unknown): Promise<T> {
    const url  = `${this.host}${path}`;
    const resp = await fetch(url, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body:    JSON.stringify(body),
      // Opt out of Next.js fetch cache for live search queries
      cache:   "no-store",
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "(unreadable)");
      throw new Error(`Meilisearch ${resp.status}: ${text}`);
    }

    return resp.json() as Promise<T>;
  }
}
