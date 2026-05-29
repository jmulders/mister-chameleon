/**
 * POST /api/search
 *
 * Platform-owned search endpoint.
 *
 * Accepts a SearchQuery (+ optional effectiveContext) JSON body and returns a
 * SearchResponse.  The endpoint is the single integration point between search
 * UI components and the SearchProvider implementation — components never query
 * Meilisearch (or any other backend) directly.
 *
 * ─── Architecture position ────────────────────────────────────────────────────
 *
 *   SearchBlock (client component)
 *        ↓  POST /api/search  { query, effectiveContext? }
 *   this route               ← YOU ARE HERE
 *        ↓  SearchProvider.search()   ← Meilisearch / Sanity / InMemory
 *        ↓  rerankResults()           ← context-aware re-ranking (Phase 4)
 *   SearchResponse           → JSON to caller
 *
 * ─── Context-aware re-ranking ─────────────────────────────────────────────────
 *
 *   When `effectiveContext` is included in the request body, the results from
 *   the search provider are re-ranked using the visitor's context signals:
 *     - High-intent visitors: pricing/contact/demo results boosted
 *     - Returning visitors: product/features results boosted
 *     - CRM customers: support/docs results boosted
 *     - Candidate scenario: vacancy results boosted
 *
 *   Re-ranking is additive — it reorders results, never removes them.
 *   The original Meilisearch relevance score is used as a tie-breaker.
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   effectiveContext fields are sanitised — only structural signals are used
 *   (source, visitType, funnelStage, etc.).  No PII, no session tokens.
 *
 * ─── Request / response contract ─────────────────────────────────────────────
 *
 *   Request
 *     Method:       POST
 *     Content-Type: application/json
 *     Body: {
 *       query: string,                  — required
 *       scopes?: SearchScope[],         — optional content type filter
 *       page?: number,                  — optional pagination
 *       effectiveContext?: {            — optional context for re-ranking
 *         source?: string,
 *         visitType?: string,
 *         funnelStage?: string,
 *         intentScore?: number,
 *         crmLifecycle?: string,
 *         scenario?: string,
 *       }
 *     }
 *
 *   Success  200   SearchResponse
 *   Bad body 400   { error: "Invalid request body" }
 *   Error    500   { error: "Search failed" }
 */

import { NextResponse }          from "next/server";
import type { SearchQuery, SearchResult } from "@/search";
import { getSearchProvider }     from "@/search/providers";
import { getActiveTenant }       from "@/tenant/server";
import { rerankResults }         from "@/search/ranking/context-ranker";
import type { SearchContext }    from "@/search/ranking/context-ranker";

// ── Extended request body ─────────────────────────────────────────────────────

interface SearchRequestBody extends SearchQuery {
  /** Optional visitor context for result re-ranking. */
  effectiveContext?: SearchContext;
  /** @deprecated Use offset instead.  Accepted for backwards-compat with older callers. */
  page?: never;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  // ── Parse request body ──────────────────────────────────────────────────────
  let body: SearchRequestBody;
  try {
    body = (await request.json()) as SearchRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  // ── Basic validation ────────────────────────────────────────────────────────
  if (typeof body?.query !== "string") {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  // Extract context (sanitised — only structural signals, no PII)
  const effectiveContext: SearchContext | null = body.effectiveContext
    ? sanitiseContext(body.effectiveContext as unknown)
    : null;

  // Build the SearchQuery (without the effectiveContext field)
  const query: SearchQuery = {
    query:   body.query,
    scopes:  body.scopes,
    filters: body.filters,
    limit:   body.limit,
    offset:  body.offset,
    locale:  body.locale,
  };

  // ── Resolve active tenant ───────────────────────────────────────────────────
  let tenantId: string | undefined;
  try {
    const tenant = await getActiveTenant();
    tenantId = tenant.tenantId;
  } catch {
    // Non-fatal: proceed without tenant scoping.
  }

  // ── Search + context-aware re-ranking ──────────────────────────────────────
  try {
    const provider  = await getSearchProvider(tenantId);
    const response  = await provider.search(query);

    // Apply context-aware re-ranking when context signals are present.
    // SearchResponse.results is readonly, so we return a new response object.
    const finalResults =
      effectiveContext && response.results.length > 1
        ? rerankResults(response.results as SearchResult[], effectiveContext)
        : response.results;

    return NextResponse.json({ ...response, results: finalResults });
  } catch {
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 },
    );
  }
}

// ── Context sanitiser ─────────────────────────────────────────────────────────

/**
 * Sanitise the effectiveContext from the request body.
 *
 * Only structural signals are kept — no PII, no session tokens, no IPs.
 * This prevents clients from injecting unexpected values into the ranker.
 *
 * Accepts `unknown` so callers can pass an untyped body field without casting.
 */
function sanitiseContext(raw: unknown): SearchContext {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    source:       typeof r.source       === "string" ? r.source       : null,
    visitType:    typeof r.visitType    === "string" ? r.visitType    : null,
    funnelStage:  typeof r.funnelStage  === "string" ? r.funnelStage  : null,
    intentScore:  typeof r.intentScore  === "number" ? r.intentScore  : null,
    crmLifecycle: typeof r.crmLifecycle === "string" ? r.crmLifecycle : null,
    utmCampaign:  typeof r.utmCampaign  === "string" ? r.utmCampaign  : null,
    scenario:     typeof r.scenario     === "string" ? r.scenario     : null,
  };
}
