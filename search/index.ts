/**
 * Search module — barrel export
 *
 * Public surface of the platform's search contract.
 *
 * Consumers import types and interfaces from this path:
 *   import type { SearchQuery, SearchResult, SearchProvider } from "@/search";
 *
 * Provider adapter implementations live in search/providers/ and are NOT
 * re-exported from here — callers bind a concrete provider at the edge
 * (server action / API route), never via this barrel.
 *
 * @module search
 */

export type {
  // Scope + type discriminators
  SearchScope,
  SearchResultType,

  // Query
  SearchFilters,
  SearchQuery,

  // Result parts
  SearchResultImage,
  SearchResultMeta,
  SearchHighlight,
  SearchResult,

  // Response
  SearchResponse,

  // Suggestion (autocomplete)
  SearchSuggestion,

  // Provider interface
  SearchProvider,
} from "./types";
