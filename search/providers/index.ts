/**
 * search/providers — factory
 *
 * Returns the active SearchProvider for the current environment.
 *
 * ─── Architecture position ────────────────────────────────────────────────────
 *
 *   API route / server action
 *        ↓  getSearchProvider()   ← YOU ARE HERE
 *   SearchProvider (concrete implementation)
 *        ↓  provider.search(query)
 *   SearchResponse → JSON to caller
 *
 * ─── Current state (Sear3) ────────────────────────────────────────────────────
 *
 *   The InMemorySearchProvider is used by default.  It ships with a built-in
 *   fixture corpus covering pages, posts, and vacancies and performs
 *   case-insensitive, term-scored in-process matching with <mark> highlights.
 *
 *   This gives full end-to-end search out of the box — no external service,
 *   no environment variables, no index setup required.
 *
 * ─── Adding a production provider ────────────────────────────────────────────
 *
 *   1. Create an adapter module that implements the SearchProvider interface:
 *        search/providers/algolia.ts       (Algolia)
 *        search/providers/typesense.ts     (Typesense)
 *        search/providers/sanity-search.ts (Sanity GROQ full-text)
 *
 *   2. Detect the runtime environment (environment variables, runtime config,
 *      or tenant settings) in getSearchProvider() and return the instance:
 *
 *   @example
 *   if (process.env.ALGOLIA_APP_ID && process.env.ALGOLIA_API_KEY) {
 *     const { AlgoliaSearchProvider } = await import("./algolia");
 *     return new AlgoliaSearchProvider({
 *       appId:  process.env.ALGOLIA_APP_ID,
 *       apiKey: process.env.ALGOLIA_API_KEY,
 *     });
 *   }
 *
 * ─── Design note ──────────────────────────────────────────────────────────────
 *
 *   Provider implementations are intentionally NOT re-exported from
 *   "@/search" — only the interface types are public.  API routes and server
 *   actions import from "@/search/providers" directly.  This keeps provider
 *   bindings at the edge and prevents provider SDK types from leaking into
 *   the component layer.
 *
 *   getSearchProvider() is not a singleton.  The returned provider is
 *   stateless and safe to instantiate per request.
 */

import type { SearchProvider } from "@/search";
import { InMemorySearchProvider } from "./in-memory-search-provider";

/**
 * Return the active SearchProvider for this request.
 *
 * Resolution order:
 *   1. Algolia       — when ALGOLIA_APP_ID is set            (TODO: Sear4)
 *   2. Typesense     — when TYPESENSE_HOST is set            (TODO: Sear4)
 *   3. Sanity search — when using a Sanity CMS provider      (TODO: Sear4)
 *   4. InMemory      — default fallback (always available)
 */
export function getSearchProvider(): SearchProvider {
  // ── TODO (Sear4): wire production search backends ──────────────────────────
  //
  // Example — Algolia:
  //   if (process.env.ALGOLIA_APP_ID && process.env.ALGOLIA_API_KEY) {
  //     const { AlgoliaSearchProvider } = await import("./algolia");
  //     return new AlgoliaSearchProvider({ ... });
  //   }
  //
  // Example — Typesense:
  //   if (process.env.TYPESENSE_HOST) {
  //     const { TypesenseSearchProvider } = await import("./typesense");
  //     return new TypesenseSearchProvider({ ... });
  //   }
  //
  // ── Default: in-memory provider ────────────────────────────────────────────
  //
  // Works without any external service.  Suitable for local development,
  // staging, and any environment without a dedicated search backend.

  return new InMemorySearchProvider();
}
