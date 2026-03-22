/**
 * Search — type definitions
 *
 * Defines the platform's internal, CMS-agnostic model for full-text search.
 * Search is a reusable platform feature: the contract (query, result, provider
 * interface) is defined here.  Provider implementations — Algolia, Typesense,
 * Sanity GROQ, a local in-memory adapter, etc. — conform to SearchProvider and
 * live in separate adapter modules, keeping this module dependency-free.
 *
 * ─── Architecture position ────────────────────────────────────────────────────
 *
 *   Caller (page handler / server action / UI component)
 *        ↓  SearchQuery
 *   SearchProvider.search()            ← adapter boundary
 *        ↓  SearchResponse
 *   Caller renders SearchResult[]
 *
 * ─── Design constraints ───────────────────────────────────────────────────────
 *
 *   1. Provider-agnostic.
 *      SearchQuery, SearchResult, and SearchResponse form the complete contract.
 *      No provider SDK types may leak into this module.  Provider adapters are
 *      responsible for translating between their native shapes and these
 *      interfaces.  The platform binds a concrete SearchProvider at the edge
 *      (server action, API route, or app initialisation) — never inside pages
 *      or components.
 *
 *   2. Scope-based.
 *      Callers declare which content types to search via SearchQuery.scopes.
 *      Providers map scopes to their internal index or collection identifiers.
 *      Adding a new content type means extending SearchScope and SearchResultType
 *      — not changing the SearchProvider interface or callers.
 *
 *   3. Uniform result shape across content types.
 *      All results share a common set of fields (id, type, title, slug, excerpt).
 *      Type-specific display metadata is expressed as SearchResultMeta
 *      label/value pairs — the same pattern as ListingItem.meta in the
 *      page-config module — so result cards can render any content type
 *      without branching on `type`.
 *
 *   4. Search is not a UI component.
 *      This module contains no React imports, no Next.js dependencies, and no
 *      rendering logic.  It is safely importable in server actions, API routes,
 *      edge middleware, and CLI tooling without pulling in a React runtime.
 *
 *   5. Highlight snippets are HTML-safe fragments.
 *      Providers are responsible for escaping content and wrapping matched
 *      terms in <mark> tags.  Callers render snippets with
 *      dangerouslySetInnerHTML only inside a dedicated, style-isolated element.
 *
 * ─── Module structure ─────────────────────────────────────────────────────────
 *
 *   types.ts     ← YOU ARE HERE — all type definitions + provider interface
 *   index.ts     — barrel export
 *
 * ─── Extending ────────────────────────────────────────────────────────────────
 *
 *   To add a new searchable content type (e.g. "events"):
 *     1. Add "events" to SearchScope.
 *     2. Add "event" to SearchResultType.
 *     3. Implement a provider adapter that handles the new scope.
 *     No changes to SearchQuery, SearchResult, or SearchProvider are required.
 */

// ═════════════════════════════════════════════════════════════════════════════
// SCOPE + TYPE
// ═════════════════════════════════════════════════════════════════════════════

/**
 * The set of content collections that can be searched.
 *
 * Used in SearchQuery.scopes to tell the provider which collections to query.
 * When omitted, providers default to searching all supported scopes.
 *
 *   pages      — site pages (homepage, landing pages, about, etc.)
 *   posts      — blog posts, news articles, editorial content
 *   vacancies  — open job positions / career listings
 *
 * Provider adapters map each scope to their native index or collection
 * identifier.  Scopes have no inherent ordering; providers may execute them
 * in parallel.
 */
export type SearchScope = "pages" | "posts" | "vacancies";

/**
 * The content type tag on an individual SearchResult.
 *
 * Mirrors SearchScope at the result level: searching the "posts" scope yields
 * results with `type: "post"`.  Kept as a separate type so a future scope
 * could return mixed result types without a breaking change.
 *
 *   page     — a site page
 *   post     — a blog post or news article
 *   vacancy  — an open vacancy / job listing
 */
export type SearchResultType = "page" | "post" | "vacancy";

// ═════════════════════════════════════════════════════════════════════════════
// QUERY
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Narrowing criteria applied on top of the search query string.
 *
 * All fields are optional.  Providers apply only the filters they support;
 * unrecognised keys in the index signature are silently ignored.
 *
 *   category  — exact-match filter on a result's primary category slug.
 *               Example: "engineering", "frontend"
 *
 *   tags      — results must include at least one of the provided tag slugs
 *               (OR membership, not AND).
 *
 *   locale    — language / locale code to restrict results to.
 *               Falls back to SearchQuery.locale when absent.
 *               Example: "en", "nl", "en-US"
 *
 * Provider adapters may extend filtering behaviour by reading additional
 * keys from the index signature (e.g. `filters["department"]`).
 */
export interface SearchFilters {
  readonly category?: string;
  readonly tags?:     readonly string[];
  readonly locale?:   string;
  // Provider-specific extension point — adapters may read additional keys.
  readonly [key: string]: unknown;
}

/**
 * A search request issued by the caller to a SearchProvider.
 *
 * ─── Field reference ──────────────────────────────────────────────────────────
 *
 *   query    — The user's free-text search string.  May be an empty string to
 *              perform a "browse all" query (providers return all results in
 *              default order).  Callers should trim whitespace before passing.
 *
 *   scopes   — Which content collections to search.  When absent or empty,
 *              providers search all scopes they support.  Order is not
 *              significant; providers may parallelise scope queries.
 *
 *   filters  — Optional narrowing criteria applied within each scope.
 *
 *   limit    — Maximum number of results to return.  Defaults to 10.
 *              Providers may enforce their own upper bound.
 *
 *   offset   — Zero-based result offset for pagination.  Defaults to 0.
 *              Use with SearchResponse.hasMore to build paged UIs.
 *
 *   locale   — Preferred language code for result ranking and locale-specific
 *              indexes.  Example: "en", "nl".  Optional — providers fall back
 *              to their default locale when absent.
 */
export interface SearchQuery {
  readonly query:    string;
  readonly scopes?:  readonly SearchScope[];
  readonly filters?: SearchFilters;
  readonly limit?:   number;
  readonly offset?:  number;
  readonly locale?:  string;
}

// ═════════════════════════════════════════════════════════════════════════════
// RESULT
// ═════════════════════════════════════════════════════════════════════════════

/**
 * An optional thumbnail or cover image attached to a search result.
 *
 *   src  — Absolute or root-relative URL.  Providers supply the smallest
 *          suitable size; callers may apply further sizing via CSS.
 *   alt  — Alternative text for accessibility.
 */
export interface SearchResultImage {
  readonly src: string;
  readonly alt?: string;
}

/**
 * A type-specific metadata label/value pair on a search result.
 *
 * Follows the same pattern as ListingItem.meta in page-config/types.ts so
 * result cards and listing cards can share rendering logic.
 *
 * Examples:
 *   Post result:    { label: "Reading time", value: "4 min" }
 *                   { label: "Category",     value: "Engineering" }
 *   Vacancy result: { label: "Location",     value: "Amsterdam" }
 *                   { label: "Contract",     value: "Full-time" }
 */
export interface SearchResultMeta {
  readonly label: string;
  readonly value: string;
}

/**
 * A matched text fragment returned by the search provider for highlighted display.
 *
 * Providers return snippets as HTML fragments where matched terms are wrapped
 * in <mark> tags.  Callers must render snippets with dangerouslySetInnerHTML
 * inside a style-isolated element; never concatenate snippets into a larger
 * HTML string.
 *
 *   field    — The result field that matched.  Common values: "title",
 *              "excerpt", "body".  Callers may use this to group or label
 *              multiple highlights on a single result.
 *
 *   snippet  — HTML fragment.  Providers are responsible for HTML-escaping
 *              content and wrapping matched terms in <mark>...</mark>.
 *              Example: "…hire a senior <mark>React</mark> developer…"
 */
export interface SearchHighlight {
  readonly field:   string;
  readonly snippet: string;
}

/**
 * A single normalised search result.
 *
 * The shape is uniform across all content types: all fields beyond `type` and
 * `slug` are optional so a provider can return a minimal result when full
 * content data is unavailable (e.g. an index-only provider without body text).
 *
 * ─── Field reference ──────────────────────────────────────────────────────────
 *
 *   id          — Stable, unique identifier for this result within its type.
 *                 Used as the React list key; must not change between queries.
 *
 *   type        — Discriminates the content type.  Use to apply type-specific
 *                 rendering or routing logic in result card components.
 *
 *   title       — Display title.  Always present — providers must supply at
 *                 least the document title for every result.
 *
 *   slug        — Root-relative URL path for the result's detail page.
 *                 Example: "/blog/my-post", "/vacancies/senior-react-developer"
 *                 Callers use this as the <a href> without further processing.
 *
 *   excerpt     — Short plain-text summary or first-paragraph extract.
 *                 Truncated at the provider or adapter layer; no HTML.
 *
 *   image       — Optional cover/thumbnail image for richer result cards.
 *
 *   meta        — Ordered label/value pairs for type-specific display metadata
 *                 (reading time, location, contract type, publication date…).
 *                 Rendering is generic — callers iterate the array.
 *
 *   highlights  — Provider-supplied matched-text fragments for inline highlight
 *                 display.  Empty or absent when the provider does not support
 *                 highlighting or when `query` was an empty string.
 *
 *   score       — Provider-supplied relevance score in the range [0, 1].
 *                 Absent when the provider does not expose scoring.
 *                 Do not use for sorting — providers return results pre-sorted.
 */
export interface SearchResult {
  readonly id:          string;
  readonly type:        SearchResultType;
  readonly title:       string;
  readonly slug:        string;
  readonly excerpt?:    string;
  readonly image?:      SearchResultImage;
  readonly meta?:       readonly SearchResultMeta[];
  readonly highlights?: readonly SearchHighlight[];
  readonly score?:      number;
}

// ═════════════════════════════════════════════════════════════════════════════
// RESPONSE
// ═════════════════════════════════════════════════════════════════════════════

/**
 * The envelope returned by SearchProvider.search().
 *
 *   query    — Echo of the original SearchQuery.  Allows callers to correlate
 *              a response with its originating query in async / cached flows.
 *
 *   results  — Ordered result array, sorted by relevance (or provider default).
 *              May be shorter than `query.limit` when fewer matches exist.
 *              Empty array (never null) when there are no matches.
 *
 *   total    — Total number of matching results across all searched scopes,
 *              before limit/offset pagination.  Used to render "N results" UI
 *              and to calculate page counts.
 *
 *   hasMore  — True when additional results exist beyond the current page
 *              (offset + results.length < total).  Convenience flag — callers
 *              may compute this themselves from total, offset, and limit.
 *
 *   took     — Provider-supplied query execution time in milliseconds.
 *              Absent when the provider does not expose timing information.
 *              For informational display and performance monitoring only.
 */
export interface SearchResponse {
  readonly query:   SearchQuery;
  readonly results: readonly SearchResult[];
  readonly total:   number;
  readonly hasMore: boolean;
  readonly took?:   number;
}

// ═════════════════════════════════════════════════════════════════════════════
// SUGGESTION
// ═════════════════════════════════════════════════════════════════════════════

/**
 * A single autocomplete suggestion for a partial query string.
 *
 * Returned by SearchProvider.suggest() for typeahead / autocomplete UIs.
 *
 *   text   — The suggested completion string.  Callers may display this
 *            directly as the visible suggestion label.
 *
 *   scope  — Optional hint about the content type this suggestion is most
 *            relevant to.  Callers may use this to show a type badge next to
 *            the suggestion (e.g. "vacancy" → show a briefcase icon).
 */
export interface SearchSuggestion {
  readonly text:   string;
  readonly scope?: SearchResultType;
}

// ═════════════════════════════════════════════════════════════════════════════
// PROVIDER INTERFACE
// ═════════════════════════════════════════════════════════════════════════════

/**
 * The adapter interface that all search provider implementations must satisfy.
 *
 * The platform binds a concrete SearchProvider at the edge (server action,
 * API route, or app boot) and passes it to callers via dependency injection
 * or a platform-level accessor — never imported directly from a provider
 * implementation inside pages or components.
 *
 * ─── Implementing a provider ──────────────────────────────────────────────────
 *
 *   Create an adapter module (e.g. search/providers/algolia.ts) that exports
 *   a class or factory function conforming to this interface:
 *
 *   @example
 *   // search/providers/algolia.ts
 *   import type { SearchProvider, SearchQuery, SearchResponse } from "@/search";
 *
 *   export class AlgoliaSearchProvider implements SearchProvider {
 *     constructor(private client: SearchClient) {}
 *
 *     async search(query: SearchQuery): Promise<SearchResponse> {
 *       // map SearchQuery → Algolia search params
 *       // map Algolia hits → SearchResult[]
 *       // return SearchResponse envelope
 *     }
 *
 *     async suggest(query: string): Promise<SearchSuggestion[]> {
 *       // map query → Algolia suggest params → SearchSuggestion[]
 *     }
 *   }
 *
 * ─── Contract guarantees ──────────────────────────────────────────────────────
 *
 *   - search() must never return null — return a SearchResponse with
 *     results: [] and total: 0 for zero-result queries.
 *   - search() must never throw for empty results or zero-match queries.
 *   - search() should throw only for unrecoverable provider errors
 *     (network failure, auth error, malformed query).
 *   - suggest() is optional.  Providers that do not support autocomplete
 *     simply omit the method.  Callers check
 *     `typeof provider.suggest === "function"` before calling.
 *   - suggest() must never throw; return [] on no suggestions or errors.
 */
export interface SearchProvider {
  /**
   * Execute a full-text search against one or more content scopes.
   *
   * @param query  The structured query including the search string, optional
   *               scope filter, optional narrowing filters, and pagination.
   * @returns      A SearchResponse envelope with results, total count, and
   *               an echo of the originating query.
   * @throws       On unrecoverable provider errors (network, auth, config).
   *               Callers should catch and surface a user-friendly error state.
   */
  search(query: SearchQuery): Promise<SearchResponse>;

  /**
   * Return autocomplete suggestions for a partial query string.
   *
   * Optional capability — not all providers support autocomplete.
   * Callers must check `typeof provider.suggest === "function"` before calling.
   *
   * @param query   Partial search string (typically 2+ characters).
   * @param scopes  Optional scope restriction for contextually relevant
   *                suggestions.  Omit to return suggestions across all scopes.
   * @returns       Ordered array of suggestions, most relevant first.
   *                Returns [] on no matches; never throws.
   */
  suggest?(
    query:   string,
    scopes?: readonly SearchScope[],
  ): Promise<readonly SearchSuggestion[]>;
}
