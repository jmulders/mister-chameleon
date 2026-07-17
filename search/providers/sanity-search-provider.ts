/**
 * SanitySearchProvider
 *
 * SearchProvider implementation backed by Sanity GROQ queries.
 * Replaces the InMemorySearchProvider in production when SANITY_PROJECT_ID is
 * set — returns results from real published CMS pages rather than the static
 * fixture corpus.
 *
 * ─── Architecture ─────────────────────────────────────────────────────────────
 *
 *   getSearchProvider(tenantId)   ← resolves this class when Sanity is configured
 *        ↓
 *   SanitySearchProvider.search()
 *        ↓  GROQ query via @sanity/client
 *   *[_type == "page" && isPublished == true && tenantId == $tenantId]
 *        ↓  client-side term scoring (same algorithm as InMemorySearchProvider)
 *   SearchResponse  →  JSON to caller
 *
 * ─── Scopes ───────────────────────────────────────────────────────────────────
 *
 *   Currently only "pages" scope is indexed — the CMS currently stores content
 *   as `page` documents.  "posts" and "vacancies" scopes fall back gracefully
 *   (zero results, no error) so the SearchBlock still renders correctly.
 *
 *   When Sanity `post` and `vacancy` document types are introduced, add
 *   additional GROQ queries here following the same pattern.
 *
 * ─── Scoring ─────────────────────────────────────────────────────────────────
 *
 *   Full-text search is done client-side (after a single GROQ fetch) using the
 *   same term-scoring algorithm as InMemorySearchProvider:
 *     title match    → 0.6 per term
 *     excerpt match  → 0.3 per term
 *   This approach is suitable for sites with ≤ 200 pages per tenant.
 *   For larger corpora, replace with GROQ `match` operator or Algolia.
 *
 * ─── Caching ─────────────────────────────────────────────────────────────────
 *
 *   The underlying Sanity fetch uses Next.js ISR with the "sanity" cache tag.
 *   Stale content is served for up to SANITY_REVALIDATE_SECONDS, then
 *   revalidated in the background — no cold start on every search request.
 */

import "server-only";

import { createSanityClient }       from "@/cms/providers/sanity-client";
import {
  SANITY_SEARCH_REVALIDATE_SECONDS,
  SANITY_CACHE_TAG,
}                                   from "@/cms/providers/sanity-client";
import { logSanityFetch }           from "@/cms/sanity-bandwidth-logger";
import type {
  SearchProvider,
  SearchQuery,
  SearchResponse,
  SearchResult,
  SearchHighlight,
}                                   from "@/search";
import { logger }                   from "@/lib/logger";
import type { FilteredResponseQueryOptions } from "@sanity/client";

/**
 * Fetch options for the page-search query.
 *
 * SANITY_SEARCH_REVALIDATE_SECONDS (default 900 s) rather than the general 300 s
 * window: the page list changes infrequently, so a longer TTL cuts Sanity API
 * calls from search substantially. On-demand revalidateTag("sanity") still
 * flushes it immediately on publish.
 *
 * Typed explicitly (not `as const`) so `tags` is `string[]` — the same reason
 * cms/providers/sanity-provider.ts does it this way.
 */
const SEARCH_FETCH_OPTIONS: FilteredResponseQueryOptions = {
  next: {
    revalidate: SANITY_SEARCH_REVALIDATE_SECONDS,
    tags:       [SANITY_CACHE_TAG],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// GROQ query
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches all published pages for a tenant with the minimal fields needed for
 * search scoring.  Projected fields:
 *
 *   _id          — used as SearchResult.id
 *   title        — SEO title if present, otherwise document title
 *   slug         — normalised to "/slug.current" (homepage = "/")
 *   excerpt      — seoDescription used as the search excerpt
 */
const PAGE_SEARCH_QUERY = `
  *[
    _type == "page"
    && isPublished == true
    && ($tenantId == null || tenantId == $tenantId)
  ] {
    _id,
    "title":   coalesce(seoTitle, title, "Untitled"),
    "slug":    "/" + coalesce(slug.current, ""),
    "excerpt": coalesce(seoDescription, ""),
  }
` as const;

// Shape returned by the GROQ query above
interface SanityPageSearchRaw {
  _id:     string;
  title:   string;
  slug:    string;
  excerpt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scoring helpers  (identical algorithm to InMemorySearchProvider)
// ─────────────────────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scoreEntry(title: string, excerpt: string, terms: readonly string[]): number {
  if (terms.length === 0) return 1;

  const titleLower   = title.toLowerCase();
  const excerptLower = excerpt.toLowerCase();

  let raw = 0;
  for (const term of terms) {
    const t = term.toLowerCase();
    if (titleLower.includes(t))   raw += 0.6;
    if (excerptLower.includes(t)) raw += 0.3;
  }

  return Math.min(raw / terms.length, 1);
}

function buildHighlight(
  field: string,
  text:  string,
  terms: readonly string[],
): SearchHighlight | null {
  if (!text || terms.length === 0) return null;

  const matchPattern = new RegExp(terms.map(escapeRegex).join("|"), "i");
  const matchIndex   = text.search(matchPattern);
  if (matchIndex === -1) return null;

  const start = Math.max(0, matchIndex - 60);
  const end   = Math.min(text.length, matchIndex + 140);
  let snippet = text.slice(start, end);
  if (start > 0)         snippet = "…" + snippet;
  if (end < text.length) snippet = snippet + "…";

  const highlighted = snippet.replace(
    new RegExp(`(${terms.map(escapeRegex).join("|")})`, "gi"),
    "<mark>$1</mark>",
  );

  return { field, snippet: highlighted };
}

// ─────────────────────────────────────────────────────────────────────────────
// SanitySearchProvider
// ─────────────────────────────────────────────────────────────────────────────

export class SanitySearchProvider implements SearchProvider {
  /**
   * @param tenantId  Scopes all GROQ queries to this tenant's documents.
   *                  Pass null / undefined to search across all tenants
   *                  (single-tenant deployments).
   */
  constructor(private readonly tenantId: string | null = null) {}

  async search(query: SearchQuery): Promise<SearchResponse> {
    const start = Date.now();
    const terms = query.query.trim().split(/\s+/).filter(Boolean);
    const limit = Math.max(1, Math.min(query.limit  ?? 10, 100));
    const offset = Math.max(0, query.offset ?? 0);

    // ── 1. Resolve requested scopes ─────────────────────────────────────────
    //
    // We currently only index "pages" from Sanity.  When the caller restricts
    // to scopes that don't include "pages" (e.g. only "vacancies"), return an
    // empty response rather than silently ignoring the scope filter.
    const requestedScopes = query.scopes;
    const includesPages   = !requestedScopes || requestedScopes.includes("pages");

    if (!includesPages) {
      return {
        query,
        results: [],
        total:   0,
        hasMore: false,
        took:    Date.now() - start,
      };
    }

    // ── 2. Fetch pages from Sanity ─────────────────────────────────────────
    let rawPages: SanityPageSearchRaw[] = [];
    try {
      const client = createSanityClient();
      logSanityFetch("SanitySearchProvider/search", { tenantId: this.tenantId, query: query.query });
      // FilteredResponseQueryOptions, not `as Parameters<typeof client.fetch>[2]`.
      //
      // Parameters<>[2] is the union of every options shape fetch accepts, so it
      // matched the RAW overload — the one returning RawQuerylessQueryResponse<T>
      // ({ result, ms, query }) rather than T. Type-level only: at runtime
      // filterResponse defaults to true and the client hands back the array, so
      // search works. But the compiler could not agree that it does, and this is
      // one of the errors that kept CI red.
      //
      // cms/providers/sanity-provider.ts already types its options this way.
      rawPages = await client.fetch<SanityPageSearchRaw[]>(
        PAGE_SEARCH_QUERY,
        { tenantId: this.tenantId },
        SEARCH_FETCH_OPTIONS,
      );
    } catch (err) {
      logger.warn("[SanitySearchProvider] GROQ fetch failed — returning empty results", {
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        query,
        results: [],
        total:   0,
        hasMore: false,
        took:    Date.now() - start,
      };
    }

    // ── 3. Score and filter ────────────────────────────────────────────────
    interface Scored { result: SearchResult; score: number }

    const scored: Scored[] = rawPages
      .map((page): Scored | null => {
        const score = scoreEntry(page.title, page.excerpt, terms);
        if (score === 0) return null;

        const highlights: SearchHighlight[] = [];
        if (terms.length > 0) {
          const th = buildHighlight("title",   page.title,   terms);
          const eh = buildHighlight("excerpt", page.excerpt, terms);
          if (th) highlights.push(th);
          if (eh) highlights.push(eh);
        }

        const result: SearchResult = {
          id:         page._id,
          type:       "page",
          title:      page.title,
          slug:       page.slug,
          excerpt:    page.excerpt || undefined,
          highlights: highlights.length > 0 ? highlights : undefined,
          score,
        };
        return { result, score };
      })
      .filter((x): x is Scored => x !== null);

    // ── 4. Sort, paginate, return ─────────────────────────────────────────
    scored.sort((a, b) => b.score - a.score);

    const total   = scored.length;
    const pageArr = scored.slice(offset, offset + limit);

    return {
      query,
      results: pageArr.map((x) => x.result),
      total,
      hasMore: offset + pageArr.length < total,
      took:    Date.now() - start,
    };
  }
}
