/**
 * search/providers — factory
 *
 * Returns the active SearchProvider for the current environment.
 *
 * ─── Architecture position ────────────────────────────────────────────────────
 *
 *   API route / server action
 *        ↓  getSearchProvider(tenantId)   ← YOU ARE HERE
 *   SearchProvider (concrete implementation)
 *        ↓  provider.search(query)
 *   SearchResponse → JSON to caller
 *
 * ─── Resolution order ─────────────────────────────────────────────────────────
 *
 *   1. Meilisearch  — when the tenant has provider:"meilisearch" configured in
 *                     `tenant_search_settings` with a valid host + API key.
 *                     Index name: {indexPrefix}{tenantId}.
 *
 *   2. Sanity GROQ  — when SANITY_PROJECT_ID is set in the environment and
 *                     Meilisearch is not configured for this tenant.
 *                     Returns real CMS content; client-side term scoring.
 *
 *   3. InMemory     — always-available fixture-corpus fallback.
 *                     Works without any external service or env vars.
 *                     Used in local dev and CI environments.
 *
 * ─── Design note ──────────────────────────────────────────────────────────────
 *
 *   Provider implementations are NOT re-exported from "@/search" — only the
 *   interface types are public.  API routes and server actions import from
 *   "@/search/providers" directly.  This keeps provider bindings at the edge
 *   and prevents provider SDK types from leaking into the component layer.
 *
 *   `getSearchProvider()` is async (to read the DB for Meilisearch config)
 *   and not a singleton — it is safe to call per-request.
 *
 * ─── Admin UI ─────────────────────────────────────────────────────────────────
 *
 *   Meilisearch is configured per-tenant at:
 *     /admin/tenants/[tenantId]/search
 *
 *   Content is indexed via `reindexTenantSearchAction()` in
 *   app/admin/tenants/[tenantId]/search/actions.ts.
 */

import "server-only";

import type { SearchProvider }         from "@/search";
import { InMemorySearchProvider }      from "./in-memory-search-provider";
import { SanitySearchProvider }        from "./sanity-search-provider";
import { MeilisearchSearchProvider }   from "./meilisearch-search-provider";
import { serverEnv }                   from "@/lib/env";
import { getDb }                       from "@/data/db";
import { decryptSecret, hasStoredSecret } from "@/lib/email-crypto";
import { logger }                      from "@/lib/logger";

/**
 * Return the active SearchProvider for this request.
 *
 * Async: step 1 reads the tenant's search settings from the DB.
 * Steps 2–3 are synchronous fallbacks.
 *
 * @param tenantId  When provided, scopes results to this tenant.
 *                  Pass the active tenant slug from getActiveTenant().tenantId.
 */
export async function getSearchProvider(tenantId?: string | null): Promise<SearchProvider> {
  // ── 1. Meilisearch (tenant DB config) ─────────────────────────────────────
  //
  // If this tenant has Meilisearch configured in tenant_search_settings,
  // prefer it over all other providers.

  if (tenantId) {
    const meilisearch = await tryLoadMeilisearchProvider(tenantId);
    if (meilisearch) return meilisearch;
  }

  // ── 2. Sanity GROQ search ─────────────────────────────────────────────────
  //
  // When SANITY_PROJECT_ID is set the platform is using Sanity as its CMS.
  // SanitySearchProvider fetches all published pages for the active tenant
  // via GROQ and scores them against the query terms client-side.

  if (serverEnv.sanity.projectId) {
    return new SanitySearchProvider(tenantId ?? null);
  }

  // ── 3. Default: in-memory provider ────────────────────────────────────────
  //
  // Works without any external service.  Suitable for local development and
  // any environment without a dedicated CMS or search backend.

  return new InMemorySearchProvider();
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: load Meilisearch provider from DB
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attempt to load a MeilisearchSearchProvider from the tenant's DB settings.
 * Returns null when Meilisearch is not configured or the config is incomplete.
 * Never throws — all errors are caught and logged.
 */
async function tryLoadMeilisearchProvider(
  tenantId: string,
): Promise<MeilisearchSearchProvider | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await (getDb() as any)
      .from("tenant_search_settings")
      .select("config")
      .eq("tenant_id", tenantId)
      .maybeSingle()) as {
        data: { config: Record<string, unknown> } | null;
        error: { message: string } | null;
      };

    if (result.error || !result.data) return null;

    const config = result.data.config;

    if (config.provider !== "meilisearch") return null;

    const host = typeof config.meilisearchHost === "string" ? config.meilisearchHost.trim() : "";
    if (!host) return null;

    const storedKey = typeof config.meilisearchApiKey === "string" ? config.meilisearchApiKey : "";
    if (!storedKey || !hasStoredSecret(storedKey)) return null;

    let apiKey: string;
    try {
      apiKey = decryptSecret(storedKey);
    } catch {
      logger.warn("[search-providers] Failed to decrypt Meilisearch API key", { tenantId });
      return null;
    }

    const indexPrefix = typeof config.indexPrefix === "string" ? config.indexPrefix.trim() : "";
    const indexName   = `${indexPrefix}${tenantId}`;

    return new MeilisearchSearchProvider({ host, apiKey, indexName });
  } catch (err) {
    // Non-fatal: DB may not have the table yet (pre-migration)
    const msg = String(err);
    if (!msg.toLowerCase().includes("does not exist") && !msg.toLowerCase().includes("schema cache")) {
      logger.warn("[search-providers] Failed to load Meilisearch config", {
        tenantId, error: msg,
      });
    }
    return null;
  }
}
