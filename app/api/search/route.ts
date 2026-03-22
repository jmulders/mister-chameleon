/**
 * POST /api/search
 *
 * Platform-owned search endpoint.
 *
 * Accepts a SearchQuery JSON body and returns a SearchResponse.
 * The endpoint is the single integration point between search UI components
 * and the SearchProvider implementation — components never call providers
 * directly.
 *
 * ─── Architecture position ────────────────────────────────────────────────────
 *
 *   SearchBlock (client component)
 *        ↓  POST /api/search  { SearchQuery }
 *   this route               ← YOU ARE HERE
 *        ↓  SearchProvider.search()
 *   SearchResponse           → JSON to caller
 *
 * ─── Current state (Sear3) ────────────────────────────────────────────────────
 *
 *   The route delegates to getSearchProvider() from "@/search/providers".
 *   The default provider is InMemorySearchProvider — a fixture-corpus adapter
 *   with case-insensitive term scoring and <mark> highlights that works without
 *   any external service or environment variables.
 *
 *   To swap in a production backend (Algolia, Typesense, Sanity GROQ), implement
 *   the SearchProvider interface and update getSearchProvider() in
 *   search/providers/index.ts.  No changes to this route are required.
 *
 * ─── Request / response contract ─────────────────────────────────────────────
 *
 *   Request
 *     Method:       POST
 *     Content-Type: application/json
 *     Body:         SearchQuery
 *
 *   Success  200
 *     SearchResponse
 *
 *   Malformed body  400
 *     { error: "Invalid request body" }
 *
 *   Server error  500
 *     { error: "Search failed" }
 */

import { NextResponse }          from "next/server";
import type { SearchQuery }      from "@/search";
import { getSearchProvider }     from "@/search/providers";

export async function POST(request: Request): Promise<NextResponse> {
  // ── Parse request body ──────────────────────────────────────────────────────
  let query: SearchQuery;
  try {
    query = (await request.json()) as SearchQuery;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  // ── Basic validation ────────────────────────────────────────────────────────
  if (typeof query?.query !== "string") {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  // ── Search ──────────────────────────────────────────────────────────────────

  try {
    const provider = getSearchProvider();
    const response = await provider.search(query);
    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 },
    );
  }
}
