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
 *   1. Explicit tenant DB config — when the tenant has an explicit provider
 *      configured in `tenant_search_settings`, that choice takes precedence over
 *      all environment-based auto-detection.  Supported options:
 *        "meilisearch" — full-text index (requires host + API key in DB)
 *        "statamic"    — flat-file reader (requires STATAMIC_CMS_PATH)
 *        "sanity"      — Sanity GROQ    (requires SANITY_PROJECT_ID)
 *        "inmemory"    — fixture corpus  (always available)
 *
 *   2. Sanity GROQ  — auto-activated when SANITY_PROJECT_ID is set and no
 *                     explicit tenant config overrides it.
 *
 *   3. Statamic FS  — auto-activated when STATAMIC_CMS_PATH is set and Sanity
 *                     is not active.  Reads .md files from the CMS content
 *                     directory, parses YAML frontmatter, scores in-process.
 *
 *   4. InMemory     — always-available fixture-corpus fallback.
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
import { StatamicSearchProvider }      from "./statamic-search-provider";
import { StatamicHttpSearchProvider }  from "./statamic-http-search-provider";
import { serverEnv }                   from "@/lib/env";
import { getDb }                       from "@/data/db";
import { getTenantById }               from "@/tenant/server";
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
  // ── 1. Explicit tenant DB config ─────────────────────────────────────────
  //
  // Load the tenant's search settings once. When an explicit provider is stored,
  // use it directly instead of falling through the auto-detection chain.
  // This lets operators pin a tenant to a specific backend regardless of which
  // environment variables happen to be set.

  if (tenantId) {
    const explicit = await tryLoadExplicitProvider(tenantId);
    if (explicit) return explicit;
  }

  // ── 1.5 Statamic tenant over HTTP (production default for Statamic) ────────
  //
  // A Statamic tenant must search its OWN remote CMS — not the platform Sanity
  // (step 2) and not the in-memory fixtures (step 4). This provider queries the
  // tenant's Statamic Content API directly, so production search returns REAL
  // content (e.g. /team/team-lisa) without a Meilisearch index. Gated on the
  // tenant being Statamic so Sanity tenants still fall through to step 2.
  try {
    const tenant = tenantId ? await getTenantById(tenantId) : null;
    const isStatamic =
      tenant?.cms?.provider === "statamic" ||
      (!tenant && serverEnv.statamic.isConfigured);
    const base =
      tenant?.cms?.statamicBaseUrl?.trim() ||
      (serverEnv.statamic.isConfigured ? serverEnv.statamic.apiUrl : "");
    if (isStatamic && base) {
      return new StatamicHttpSearchProvider({
        baseUrl: base,
        apiKey:  serverEnv.statamic.apiKey,
      });
    }
  } catch (err) {
    logger.warn("[search-providers] Statamic HTTP provider init failed — falling through", {
      tenantId: tenantId ?? null,
      error:    String(err),
    });
  }

  // ── 2. Sanity GROQ (auto-detect) ──────────────────────────────────────────
  //
  // When SANITY_PROJECT_ID is set the platform is using Sanity as its CMS.
  // SanitySearchProvider fetches all published pages for the active tenant
  // via GROQ and scores them against the query terms client-side.

  if (serverEnv.sanity.projectId) {
    return new SanitySearchProvider(tenantId ?? null);
  }

  // ── 3. Statamic filesystem provider (auto-detect) ─────────────────────────
  //
  // When STATAMIC_CMS_PATH is set, read content directly from the local CMS
  // directory (the same path StatamicClient uses for flat-file fallback).
  // Scans collection .md files, parses YAML frontmatter, builds correct
  // Next.js route URLs, and scores results in-process.

  const statamicCmsPath =
    serverEnv.statamic.cmsFsPath ?? process.env.STATAMIC_CMS_PATH;

  if (statamicCmsPath) {
    return new StatamicSearchProvider(statamicCmsPath);
  }

  // ── 4. Default: in-memory provider ────────────────────────────────────────
  //
  // Works without any external service.  Suitable for local development and
  // any environment without a dedicated CMS or search backend.
  //
  // LOUD WARNING when a real CMS is configured: in that case this fallback
  // means site search serves FIXTURE data instead of real content — typically
  // a production deploy (e.g. Vercel) where STATAMIC_CMS_PATH is unavailable
  // and Meilisearch has not been configured yet.

  if (serverEnv.statamic.isConfigured) {
    logger.warn(
      "[search-providers] No search backend available — falling back to the in-memory FIXTURE corpus. " +
      "Site search will NOT return real content. Configure Meilisearch for this tenant in the admin " +
      "(/admin/tenants/{id}/search) and run a reindex, or set STATAMIC_CMS_PATH for flat-file search.",
      { tenantId: tenantId ?? null },
    );
  }

  return new InMemorySearchProvider();
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: load explicit provider from DB
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attempt to load an explicitly-configured SearchProvider from the tenant's
 * DB settings.  Returns null when:
 *   - The DB has no row for this tenant (fall through to auto-detect)
 *   - `provider` is "none" (explicit "use auto-detect")
 *   - The provider is "meilisearch" but credentials are incomplete/invalid
 *   - The provider is "statamic" but STATAMIC_CMS_PATH is not available
 *   - The provider is "sanity" but SANITY_PROJECT_ID is not set
 *
 * Never throws — all errors are caught and logged.
 */
async function tryLoadExplicitProvider(
  tenantId: string,
): Promise<SearchProvider | null> {
  let config: Record<string, unknown>;

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
    config = result.data.config;
  } catch (err) {
    // Non-fatal: DB may not have the table yet (pre-migration)
    const msg = String(err);
    if (
      !msg.toLowerCase().includes("does not exist") &&
      !msg.toLowerCase().includes("schema cache")
    ) {
      logger.warn("[search-providers] Failed to load tenant search config", {
        tenantId, error: msg,
      });
    }
    return null;
  }

  const provider = config.provider as string | undefined;

  // ── Meilisearch ───────────────────────────────────────────────────────────
  if (provider === "meilisearch") {
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
  }

  // ── Statamic FS ───────────────────────────────────────────────────────────
  if (provider === "statamic") {
    const cmsPath =
      serverEnv.statamic.cmsFsPath ?? process.env.STATAMIC_CMS_PATH;
    if (!cmsPath) {
      logger.warn(
        "[search-providers] provider='statamic' configured but STATAMIC_CMS_PATH is not set",
        { tenantId },
      );
      return null;
    }
    return new StatamicSearchProvider(cmsPath);
  }

  // ── Sanity GROQ ───────────────────────────────────────────────────────────
  if (provider === "sanity") {
    if (!serverEnv.sanity.projectId) {
      logger.warn(
        "[search-providers] provider='sanity' configured but SANITY_PROJECT_ID is not set",
        { tenantId },
      );
      return null;
    }
    return new SanitySearchProvider(tenantId ?? null);
  }

  // ── InMemory (explicit) ───────────────────────────────────────────────────
  if (provider === "inmemory") {
    return new InMemorySearchProvider();
  }

  // provider === "none" or anything else → return null to trigger auto-detect
  return null;
}
