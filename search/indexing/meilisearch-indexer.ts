/**
 * Meilisearch Indexer
 *
 * Fetches all publishable content from the active CMS for a given tenant and
 * pushes it into a single Meilisearch index.
 *
 * ─── Content source resolution ────────────────────────────────────────────────
 *
 *   1. Statamic flat files — when STATAMIC_CMS_PATH is set, entries are
 *      collected via collectStatamicSearchEntries() (the same corpus walker
 *      the StatamicSearchProvider uses).  This honours the CMS "Search
 *      Settings" global (searchable_collections), so editors control what
 *      gets indexed.
 *   2. Statamic REST API — when STATAMIC_API_URL is set but no local files
 *      are available (e.g. running on Vercel), entries are fetched from the
 *      remote Statamic Content API.  The "Search Settings" global is read
 *      via /api/globals/search_settings (enable the globals resource in
 *      config/statamic/api.php on the Statamic host).
 *   3. Sanity GROQ — otherwise, per-content-type GROQ queries.
 *
 * ─── Architecture ─────────────────────────────────────────────────────────────
 *
 *   reindexTenantSearchAction (admin server action)
 *        ↓  indexTenant(config, tenantId)
 *   collectStatamicSearchEntries() | GROQ queries   ← content source (see above)
 *        ↓  documents[]
 *   batchAddDocuments(host, key, index, docs)
 *        ↓  PUT /indexes/{index}/documents
 *   { docCount, errorCount }
 *
 * ─── Index structure ──────────────────────────────────────────────────────────
 *
 *   Every document in the Meilisearch index follows IndexedDocument:
 *     id           — stable Sanity _id
 *     contentType  — "page" | "post" | "vacancy" | "event" | "news"
 *     title        — searchable headline
 *     slug         — root-relative URL for the detail page
 *     excerpt      — short plain-text summary (no HTML)
 *     imageUrl     — optional cover image URL
 *     imageAlt     — optional cover image alt text
 *     tags         — optional array of tag strings for filtering
 *     publishedAt  — optional ISO timestamp for date-range filters
 *
 * ─── Batch writes ─────────────────────────────────────────────────────────────
 *
 *   Documents are sent in batches of 500 to stay well within Meilisearch's
 *   default payload limit.  Each batch triggers an async index task on the
 *   Meilisearch side; we wait for the response status code only (202 Accepted)
 *   and do not poll for task completion — this is intentional for speed.
 *
 * ─── Index settings ───────────────────────────────────────────────────────────
 *
 *   Before pushing documents we configure the index:
 *     searchableAttributes — ["title", "excerpt", "tags"]
 *     filterableAttributes — ["contentType", "tags"]
 *     sortableAttributes   — ["publishedAt"]
 *     displayedAttributes  — all (default)
 *
 * ─── Error handling ───────────────────────────────────────────────────────────
 *
 *   Individual content-type fetch failures are caught and counted in
 *   `errorCount` rather than aborting the whole reindex.  This way a
 *   missing Sanity document type (e.g. no events yet) doesn't fail the run.
 */

import "server-only";

import { logger }                        from "@/lib/logger";
import { createSanityClient }            from "@/cms/providers/sanity-client";
import { createStatamicClient, StatamicClient } from "@/cms/providers/statamic-client";
import { collectStatamicSearchEntries }  from "@/search/providers/statamic-search-provider";
import { serverEnv }                     from "@/lib/env";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface IndexerConfig {
  /** Meilisearch base URL, e.g. "https://search.acme.com" */
  host: string;
  /** Admin or write API key */
  apiKey: string;
  /** Full index name: {indexPrefix}{tenantId} */
  indexName: string;
}

export interface IndexResult {
  docCount:   number;
  errorCount: number;
  indexedAt:  string;
}

/** Normalised document shape stored in Meilisearch */
interface IndexedDocument {
  id:          string;
  contentType: "page" | "post" | "vacancy" | "event" | "news";
  title:       string;
  slug:        string;
  excerpt?:    string;
  imageUrl?:   string;
  imageAlt?:   string;
  tags?:       string[];
  publishedAt?: string;
  /** Source CMS collection handle (Statamic source only), e.g. "case_studies". */
  collection?:      string;
  /** Display label for `collection`, e.g. "Case Studies". */
  collectionLabel?: string;
}

// Batch size for Meilisearch bulk document adds
const BATCH_SIZE = 500;

// ─────────────────────────────────────────────────────────────────────────────
// GROQ queries
// ─────────────────────────────────────────────────────────────────────────────

const PAGES_QUERY = `
  *[
    _type == "page"
    && isPublished == true
    && ($tenantId == null || tenantId == $tenantId)
  ] {
    _id,
    "title":      coalesce(seoTitle, title, "Untitled"),
    "slug":       "/" + coalesce(slug.current, ""),
    "excerpt":    coalesce(seoDescription, ""),
    "imageUrl":   null,
    "imageAlt":   null,
    "tags":       null,
    "publishedAt": null,
  }
` as const;

const NEWS_QUERY = `
  *[
    _type == "newsArticle"
    && isPublished == true
    && ($tenantId == null || tenantId == $tenantId || !defined(tenantId))
  ] {
    _id,
    "title":      coalesce(title, "Untitled"),
    "slug":       "/news/" + slug.current,
    "excerpt":    coalesce(excerpt, ""),
    "imageUrl":   coverImage.asset->url,
    "imageAlt":   coverImage.alt,
    "tags":       tags[]->slug.current,
    "publishedAt": publishedAt,
  }
` as const;

const VACANCIES_QUERY = `
  *[
    _type == "vacancy"
    && isPublished == true
    && ($tenantId == null || tenantId == $tenantId || !defined(tenantId))
  ] {
    _id,
    "title":      coalesce(title, "Untitled"),
    "slug":       "/vacancies/" + slug.current,
    "excerpt":    coalesce(excerpt, location, ""),
    "imageUrl":   null,
    "imageAlt":   null,
    "tags":       select(
      defined(department) => [department],
      defined(contractType) => [contractType],
      null
    ),
    "publishedAt": null,
  }
` as const;

const EVENTS_QUERY = `
  *[
    _type == "eventEntry"
    && isPublished == true
    && ($tenantId == null || tenantId == $tenantId || !defined(tenantId))
  ] {
    _id,
    "title":      coalesce(title, "Untitled"),
    "slug":       "/events/" + slug.current,
    "excerpt":    coalesce(excerpt, location, ""),
    "imageUrl":   coverImage.asset->url,
    "imageAlt":   coverImage.alt,
    "tags":       tags[],
    "publishedAt": startDate,
  }
` as const;

// Raw shape returned by GROQ queries (common structure across types)
interface SanityRawDoc {
  _id:         string;
  title:       string;
  slug:        string;
  excerpt:     string | null;
  imageUrl:    string | null;
  imageAlt:    string | null;
  tags:        string[] | null;
  publishedAt: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public entrypoint
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full reindex of a tenant's content into Meilisearch.
 *
 * Steps:
 *   1. Configure index settings (searchable + filterable attributes)
 *   2. Fetch pages, news articles, vacancies, events from Sanity
 *   3. Bulk-add all documents to the index (batched)
 *
 * @param config    Meilisearch host, key, and target index name
 * @param tenantId  Sanity tenant slug for content scoping
 */
export async function indexTenant(
  config:   IndexerConfig,
  tenantId: string | null,
  options?: {
    /**
     * Explicit Statamic base URL for this tenant (tenant.cms.statamicBaseUrl).
     * When set, content is ALWAYS fetched from this remote API — local files
     * (STATAMIC_CMS_PATH) are ignored so a customer's own CMS is indexed,
     * never the platform's local content.
     */
    statamicBaseUrl?: string;
  },
): Promise<IndexResult> {
  const indexedAt = new Date().toISOString();
  let docCount    = 0;
  let errorCount  = 0;
  const tenantStatamicUrl = options?.statamicBaseUrl?.trim() || undefined;

  // ── 1. Configure index settings ─────────────────────────────────────────
  try {
    await configureIndex(config);
  } catch (err) {
    logger.warn("[meilisearch-indexer] Failed to configure index settings", {
      index: config.indexName,
      error: String(err),
    });
    // Non-fatal — proceed with indexing even if settings update fails
    errorCount++;
  }

  // ── 2a. Statamic flat-file source ────────────────────────────────────────
  //
  // When STATAMIC_CMS_PATH is set the platform runs on Statamic — collect
  // entries from the content files via the shared corpus walker.  This
  // honours the CMS "Search Settings" global, so the set of indexed
  // collections matches what the FS provider would search.
  //
  // Skipped when the tenant has an explicit statamicBaseUrl — their remote
  // CMS must be indexed, not the local platform files.
  const statamicCmsPath = tenantStatamicUrl
    ? undefined
    : (serverEnv.statamic.cmsFsPath ?? process.env.STATAMIC_CMS_PATH);

  if (statamicCmsPath) {
    const documents: IndexedDocument[] = [];

    try {
      for (const entry of collectStatamicSearchEntries(statamicCmsPath)) {
        documents.push({
          id:              entry.id,
          contentType:     entry.type,
          title:           entry.title,
          slug:            entry.url,
          excerpt:         entry.excerpt || undefined,
          collection:      entry.collection,
          collectionLabel: entry.collectionLabel,
        });
      }
    } catch (err) {
      logger.error("[meilisearch-indexer] Failed to collect Statamic entries", {
        cmsPath: statamicCmsPath,
        error:   String(err),
      });
      errorCount++;
    }

    if (documents.length > 0) {
      try {
        await batchAddDocuments(config, documents);
        docCount = documents.length;
      } catch (err) {
        logger.error("[meilisearch-indexer] Failed to push documents", {
          index:    config.indexName,
          docCount: documents.length,
          error:    String(err),
        });
        errorCount++;
      }
    }

    logger.info("[meilisearch-indexer] Reindex complete (Statamic source)", {
      index: config.indexName,
      docCount,
      errorCount,
      indexedAt,
    });

    return { docCount, errorCount, indexedAt };
  }

  // ── 2b. Statamic REST API source ─────────────────────────────────────────
  //
  // No local files (e.g. running on Vercel) but a remote Statamic instance is
  // configured — fetch entries via the Content API.  Honours the CMS "Search
  // Settings" global when the globals API resource is enabled.
  // A tenant-specific base URL (customer CMS) takes precedence over the
  // platform-level STATAMIC_API_URL.
  if (tenantStatamicUrl || serverEnv.statamic.isConfigured) {
    const { documents, fetchErrors } = await collectStatamicApiDocuments(tenantStatamicUrl);
    errorCount += fetchErrors;

    if (documents.length > 0) {
      try {
        await batchAddDocuments(config, documents);
        docCount = documents.length;
      } catch (err) {
        logger.error("[meilisearch-indexer] Failed to push documents", {
          index:    config.indexName,
          docCount: documents.length,
          error:    String(err),
        });
        errorCount++;
      }
    }

    logger.info("[meilisearch-indexer] Reindex complete (Statamic API source)", {
      index: config.indexName,
      docCount,
      errorCount,
      indexedAt,
    });

    return { docCount, errorCount, indexedAt };
  }

  // ── 2c. Fetch content from Sanity ────────────────────────────────────────
  const client = createSanityClient();
  const params = { tenantId: tenantId ?? null };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fetchResults = await Promise.allSettled([
    // Cast through unknown to resolve the @sanity/client v6 RawQuerylessQueryResponse
    // wrapper type, which TypeScript cannot narrow to a plain array.  The underlying
    // value IS a plain array at runtime — this cast is safe.
    client.fetch(PAGES_QUERY,     params, fetchOpts()) as Promise<unknown>,
    client.fetch(NEWS_QUERY,      params, fetchOpts()) as Promise<unknown>,
    client.fetch(VACANCIES_QUERY, params, fetchOpts()) as Promise<unknown>,
    client.fetch(EVENTS_QUERY,    params, fetchOpts()) as Promise<unknown>,
  ]);

  const [pagesDocs, newsDocs, vacanciesDocs, eventsDocs] = fetchResults;

  const documents: IndexedDocument[] = [];

  if (pagesDocs.status === "fulfilled") {
    const rows = (pagesDocs.value as SanityRawDoc[] | null) ?? [];
    for (const d of rows) {
      documents.push(toIndexedDoc(d, "page"));
    }
  } else {
    logger.warn("[meilisearch-indexer] Failed to fetch pages", { error: String(pagesDocs.reason) });
    errorCount++;
  }

  if (newsDocs.status === "fulfilled") {
    const rows = (newsDocs.value as SanityRawDoc[] | null) ?? [];
    for (const d of rows) {
      documents.push(toIndexedDoc(d, "news"));
    }
  } else {
    logger.warn("[meilisearch-indexer] Failed to fetch news", { error: String(newsDocs.reason) });
    errorCount++;
  }

  if (vacanciesDocs.status === "fulfilled") {
    const rows = (vacanciesDocs.value as SanityRawDoc[] | null) ?? [];
    for (const d of rows) {
      documents.push(toIndexedDoc(d, "vacancy"));
    }
  } else {
    logger.warn("[meilisearch-indexer] Failed to fetch vacancies", { error: String(vacanciesDocs.reason) });
    errorCount++;
  }

  if (eventsDocs.status === "fulfilled") {
    const rows = (eventsDocs.value as SanityRawDoc[] | null) ?? [];
    for (const d of rows) {
      documents.push(toIndexedDoc(d, "event"));
    }
  } else {
    logger.warn("[meilisearch-indexer] Failed to fetch events", { error: String(eventsDocs.reason) });
    errorCount++;
  }

  // ── 3. Push to Meilisearch ───────────────────────────────────────────────
  if (documents.length > 0) {
    try {
      await batchAddDocuments(config, documents);
      docCount = documents.length;
    } catch (err) {
      logger.error("[meilisearch-indexer] Failed to push documents", {
        index:    config.indexName,
        docCount: documents.length,
        error:    String(err),
      });
      errorCount++;
    }
  }

  logger.info("[meilisearch-indexer] Reindex complete", {
    index:      config.indexName,
    docCount,
    errorCount,
    indexedAt,
  });

  return { docCount, errorCount, indexedAt };
}

// ─────────────────────────────────────────────────────────────────────────────
// Statamic REST API source
// ─────────────────────────────────────────────────────────────────────────────

/** Mirror of the FS walker's defaults — used when the global is unreadable. */
const DEFAULT_SEARCHABLE_HANDLES = ["pages", "blog", "vacancies"];

function apiTypeForHandle(handle: string): IndexedDocument["contentType"] {
  if (handle === "blog")      return "post";
  if (handle === "vacancies") return "vacancy";
  return "page";
}

/** "case_studies" → "Case Studies" — display label for the filter sidebar. */
function prettifyHandle(handle: string): string {
  return handle
    .split(/[_-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Collect indexable documents from the remote Statamic Content API.
 *
 * Searchable collections come from the "Search Settings" global
 * (/api/globals/search_settings → searchable_collections); when that
 * resource is not exposed the built-in defaults are used.  Per-collection
 * fetch failures are counted but never abort the run.
 */
async function collectStatamicApiDocuments(baseUrlOverride?: string): Promise<{
  documents:   IndexedDocument[];
  fetchErrors: number;
}> {
  // Tenant-specific URL → dedicated client WITHOUT the local file reader
  // (a customer's remote CMS must never be shadowed by local files).
  const client = baseUrlOverride
    ? new StatamicClient(baseUrlOverride, undefined)
    : createStatamicClient();
  let fetchErrors = 0;

  // ── Searchable collections from the CMS global ───────────────────────────
  let handles = DEFAULT_SEARCHABLE_HANDLES;
  try {
    const global = await client.fetchGlobal<{ searchable_collections?: unknown }>(
      "search_settings",
    );
    const list = global?.searchable_collections;
    if (Array.isArray(list)) {
      const clean = list.filter(
        (h): h is string => typeof h === "string" && h.trim() !== "",
      );
      if (clean.length > 0) handles = clean;
    }
  } catch (err) {
    logger.warn(
      "[meilisearch-indexer] Could not read search_settings global via API — using default collections",
      { error: String(err) },
    );
  }

  // ── Fetch entries per collection ─────────────────────────────────────────
  interface ApiEntry {
    id?:              string;
    slug?:            string;
    title?:           string;
    url?:             string;
    permalink?:       string;
    excerpt?:         string;
    seo_description?: string;
  }

  const documents: IndexedDocument[] = [];

  for (const handle of handles) {
    let entries: ApiEntry[];
    try {
      entries = (await client.fetchAll<ApiEntry>(handle, 500)) as ApiEntry[];
    } catch (err) {
      logger.warn("[meilisearch-indexer] Failed to fetch collection via API", {
        collection: handle,
        error:      String(err),
      });
      fetchErrors++;
      continue;
    }

    for (const e of entries) {
      const slugUrl =
        (typeof e.url === "string" && e.url) ||
        (typeof e.slug === "string" && e.slug ? `/${e.slug}` : "/");

      // Skip the special "home" page (same rule as the FS walker)
      if (handle === "pages" && (e.slug === "home" || slugUrl === "/")) continue;

      documents.push({
        id:              String(e.id ?? `${handle}/${e.slug ?? slugUrl}`),
        contentType:     apiTypeForHandle(handle),
        title:           e.title?.trim() || (e.slug ?? "Untitled"),
        slug:            slugUrl,
        excerpt:         (e.excerpt ?? e.seo_description ?? "").trim() || undefined,
        collection:      handle,
        collectionLabel: prettifyHandle(handle),
      });
    }
  }

  return { documents, fetchErrors };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function fetchOpts() {
  // Bypass ISR cache during reindex — we always want fresh CMS content
  return { next: { revalidate: 0 } } as Parameters<ReturnType<typeof createSanityClient>["fetch"]>[2];
}

function toIndexedDoc(
  raw:  SanityRawDoc,
  type: IndexedDocument["contentType"],
): IndexedDocument {
  return {
    id:          raw._id,
    contentType: type,
    title:       raw.title || "Untitled",
    slug:        raw.slug  || "/",
    excerpt:     raw.excerpt  || undefined,
    imageUrl:    raw.imageUrl || undefined,
    imageAlt:    raw.imageAlt || undefined,
    tags:        Array.isArray(raw.tags) && raw.tags.length > 0
      ? raw.tags.filter((t): t is string => typeof t === "string" && t !== "")
      : undefined,
    publishedAt: raw.publishedAt || undefined,
  };
}

/** Configure index settings before pushing documents */
async function configureIndex(config: IndexerConfig): Promise<void> {
  const base = `${config.host.replace(/\/$/, "")}/indexes/${encodeURIComponent(config.indexName)}/settings`;
  const headers = {
    "Content-Type":  "application/json",
    "Authorization": `Bearer ${config.apiKey}`,
  };

  await fetch(base, {
    method:  "PATCH",
    headers,
    body: JSON.stringify({
      searchableAttributes: ["title", "excerpt", "tags"],
      filterableAttributes: ["contentType", "tags"],
      sortableAttributes:   ["publishedAt"],
    }),
    cache: "no-store",
  }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  });
}

/** Push all documents to the index in batches of BATCH_SIZE */
async function batchAddDocuments(
  config: IndexerConfig,
  docs:   IndexedDocument[],
): Promise<void> {
  const url     = `${config.host.replace(/\/$/, "")}/indexes/${encodeURIComponent(config.indexName)}/documents`;
  const headers = {
    "Content-Type":  "application/json",
    "Authorization": `Bearer ${config.apiKey}`,
  };

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);
    const resp  = await fetch(url, {
      method:  "POST",
      headers,
      body:    JSON.stringify(batch),
      cache:   "no-store",
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "(unreadable)");
      throw new Error(`Meilisearch ${resp.status} on batch ${i / BATCH_SIZE + 1}: ${text}`);
    }
  }
}
