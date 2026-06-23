/**
 * StatamicHttpSearchProvider
 *
 * Production search for Statamic tenants. Unlike StatamicSearchProvider (which
 * reads flat .md files from disk and only works in local dev with
 * STATAMIC_CMS_PATH set), this provider queries the Statamic Content REST API
 * over HTTP — so it works on Vercel against a remote Statamic instance, per
 * tenant, with NO Meilisearch index required.
 *
 * ─── How it works ─────────────────────────────────────────────────────────────
 *
 *   On each search() call it:
 *     1. Resolves which collections to search from the CMS "Search Settings"
 *        global (`searchable_collections`), falling back to sensible defaults.
 *     2. Fetches each collection's entries via the API (cached by the client's
 *        `next.revalidate`, so repeated searches are cheap).
 *     3. Builds a searchable text per entry from its content fields and scores
 *        it against the query terms in-memory (same algorithm as the FS + in-
 *        memory providers).
 *
 *   No index, no external service. Suitable for sites up to a few hundred
 *   entries per collection. Swap in Meilisearch (configure per tenant in the
 *   admin) when the corpus grows large.
 *
 * ─── URLs ─────────────────────────────────────────────────────────────────────
 *
 *   Each API entry carries a root-relative `url` (e.g. "/team/team-lisa"), which
 *   is used directly as the result link — so collection routes (team, cases, …)
 *   resolve correctly without any prefix bookkeeping. We deliberately use `url`
 *   (relative) over `permalink` (absolute), which can carry a cross-wired host.
 */

import { StatamicClient } from "@/cms/providers/statamic-client";
import type {
  SearchProvider,
  SearchQuery,
  SearchResponse,
  SearchResult,
  SearchScope,
  SearchHighlight,
  SearchSuggestion,
} from "@/search";

interface CollectionRef {
  handle: string;
  label:  string;
}

interface Options {
  baseUrl:      string;
  apiKey?:      string;
  /** Site locale subdirectory the API should read. Default "nl". */
  locale?:      string;
  /** Explicit collections to search; when omitted they come from the CMS. */
  collections?: CollectionRef[];
}

const DEFAULT_COLLECTIONS: CollectionRef[] = [
  { handle: "pages",     label: "Pagina's"  },
  { handle: "blog",      label: "Artikelen" },
  { handle: "vacancies", label: "Vacatures" },
];

/** Per-collection scope + result type (mirrors the FS provider). */
function scopeForHandle(handle: string): { scope: SearchScope; type: SearchResult["type"] } {
  if (handle === "blog")                            return { scope: "posts",     type: "post"    };
  if (handle === "vacancies" || handle === "jobs")  return { scope: "vacancies", type: "vacancy" };
  return { scope: "pages", type: "page" };
}

// Entry keys that are never user-facing content (urls, ids, system fields).
const NON_CONTENT_KEYS = new Set([
  "id", "slug", "url", "uri", "permalink", "api_url", "edit_url", "canonical_url",
  "locale", "status", "origin_id", "mount", "date", "last_modified", "updated_at",
  "created_at", "blueprint", "collection", "site", "updated_by", "created_by",
  "sort_order", "order", "is_entry", "private", "published", "robots_nofollow",
  "robots_noindex", "page_blocks",
]);

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** Build the title + body searchable text from an entry's content fields. */
function entryText(entry: Record<string, unknown>): { title: string; body: string } {
  const title = (str(entry.title) || str(entry.full_name) || str(entry.slug)).trim();
  const parts: string[] = [];
  for (const [key, value] of Object.entries(entry)) {
    if (NON_CONTENT_KEYS.has(key)) continue;
    if (key === "title") continue; // scored separately
    if (typeof value === "string") {
      const v = value.trim();
      if (v && v.length < 2000) parts.push(v);
    }
  }
  return { title, body: parts.join(" ") };
}

function scoreEntry(title: string, body: string, terms: string[]): number {
  let score = 0;
  const t = title.toLowerCase();
  const b = body.toLowerCase();
  for (const term of terms) {
    const q = term.toLowerCase();
    if (t.includes(q)) score += 0.6;
    if (b.includes(q)) score += 0.3;
  }
  return score;
}

function buildHighlight(text: string, terms: string[]): SearchHighlight | null {
  const lower = text.toLowerCase();
  let best = -1;
  for (const term of terms) {
    const idx = lower.indexOf(term.toLowerCase());
    if (idx !== -1 && (best === -1 || idx < best)) best = idx;
  }
  if (best === -1) return null;
  const start = Math.max(0, best - 60);
  const end   = Math.min(text.length, best + 140);
  let snippet = (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
  for (const term of terms) {
    const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    snippet = snippet.replace(new RegExp(`(${esc})`, "gi"), "<mark>$1</mark>");
  }
  return { field: "excerpt", snippet };
}

export class StatamicHttpSearchProvider implements SearchProvider {
  private readonly client:       StatamicClient;
  private readonly locale:       string;
  private readonly collections?: CollectionRef[];

  constructor(opts: Options) {
    this.client      = new StatamicClient(opts.baseUrl.replace(/\/$/, ""), opts.apiKey);
    this.locale      = opts.locale ?? "nl";
    this.collections = opts.collections;
  }

  private async resolveCollections(): Promise<CollectionRef[]> {
    if (this.collections && this.collections.length) return this.collections;
    try {
      const global = await this.client.fetchGlobal<{
        searchable_collections?: Array<{ handle?: string; title?: string } | string>;
      }>("search_settings");
      const list = global?.searchable_collections;
      if (Array.isArray(list) && list.length) {
        const mapped = list
          .map((item): CollectionRef =>
            typeof item === "string"
              ? { handle: item, label: item }
              : { handle: item.handle ?? "", label: item.title ?? item.handle ?? "" },
          )
          .filter((c) => c.handle);
        if (mapped.length) return mapped;
      }
    } catch {
      // Non-fatal — fall back to defaults below.
    }
    return DEFAULT_COLLECTIONS;
  }

  async search(query: SearchQuery): Promise<SearchResponse> {
    const terms = query.query.split(/\s+/).map((t) => t.trim()).filter(Boolean);
    if (terms.length === 0) {
      return { query, results: [], total: 0, hasMore: false };
    }

    const requestedScopes: readonly SearchScope[] =
      query.scopes && query.scopes.length > 0
        ? query.scopes
        : (["pages", "posts", "vacancies"] as SearchScope[]);

    const collections = await this.resolveCollections();

    // Fetch all requested collections in parallel.
    const perCollection = await Promise.all(
      collections.map(async (col) => {
        const { scope, type } = scopeForHandle(col.handle);
        if (!requestedScopes.includes(scope)) return [];
        try {
          const entries = await this.client.fetchAll<Record<string, unknown>>(col.handle, 200);
          return entries.map((entry) => ({ entry: entry as Record<string, unknown>, col, scope, type }));
        } catch {
          return [];
        }
      }),
    );

    const scored: Array<{ result: SearchResult; score: number }> = [];

    for (const { entry, col, type } of perCollection.flat()) {
      if (entry.published === false) continue;
      const url = (str(entry.url) || str(entry.uri)).trim();
      if (!url || url === "/") continue; // need a link; skip the home page

      const { title, body } = entryText(entry);
      if (!title) continue;

      const score = scoreEntry(title, body, terms);
      if (score === 0) continue;

      const excerpt = (str(entry.excerpt) || str(entry.seo_description) || body).trim();
      const highlight = buildHighlight(excerpt || title, terms);

      scored.push({
        score,
        result: {
          id:              str(entry.id) || `${col.handle}/${url}`,
          type,
          title,
          slug:            url,
          excerpt:         excerpt ? excerpt.slice(0, 200) : undefined,
          highlights:      highlight ? [highlight] : undefined,
          collection:      col.handle,
          collectionLabel: col.label,
        },
      });
    }

    scored.sort((a, b) => b.score - a.score);

    const total   = scored.length;
    const offset  = query.offset ?? 0;
    const limit   = query.limit  ?? 20;
    const results = scored.slice(offset, offset + limit).map((s) => s.result);

    return { query, results, total, hasMore: offset + results.length < total };
  }

  async suggest(): Promise<SearchSuggestion[]> {
    return [];
  }
}
