/**
 * Meilisearch Indexer
 *
 * Fetches all publishable content from Sanity for a given tenant and
 * pushes it into a single Meilisearch index.
 *
 * ─── Architecture ─────────────────────────────────────────────────────────────
 *
 *   reindexTenantSearchAction (admin server action)
 *        ↓  indexTenant(config, sanityClient)
 *   fetchAllContent(client, tenantId)   ← GROQ queries per content type
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

import { logger }               from "@/lib/logger";
import { createSanityClient }   from "@/cms/providers/sanity-client";

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
): Promise<IndexResult> {
  const indexedAt = new Date().toISOString();
  let docCount    = 0;
  let errorCount  = 0;

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

  // ── 2. Fetch content from Sanity ─────────────────────────────────────────
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
