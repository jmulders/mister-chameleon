/**
 * POST /api/webhooks/sanity-search
 *
 * Sanity webhook handler for real-time search index updates.
 *
 * ─── Architecture position ────────────────────────────────────────────────────
 *
 *   Sanity (content update)
 *        ↓  POST webhook with SANITY_WEBHOOK_SECRET header
 *   this route               ← YOU ARE HERE
 *        ↓  resolve affected tenant + Meilisearch config
 *   indexSingleDocument()    → upsert or delete document in Meilisearch
 *
 * ─── What this handles ───────────────────────────────────────────────────────
 *
 *   Sanity emits a webhook on every document create, update, or delete.
 *   This route:
 *     1. Verifies the request is from Sanity (HMAC signature check).
 *     2. Extracts the document ID, type, tenant, and operation.
 *     3. Resolves the tenant's Meilisearch configuration from the DB.
 *     4. For create/update: fetches the latest document from Sanity and upserts it.
 *     5. For delete: removes the document from the Meilisearch index.
 *
 * ─── Configuration ───────────────────────────────────────────────────────────
 *
 *   Required environment variables:
 *     SANITY_WEBHOOK_SECRET  — HMAC secret from Sanity project webhook settings.
 *                              Verify at: sanity.io → project → API → Webhooks
 *
 *   The Sanity webhook must be configured at:
 *     URL:     https://<host>/api/webhooks/sanity-search
 *     Method:  POST
 *     Filter:  _type in ["page", "newsArticle", "blogPost", "jobPosting", "event"]
 *     Trigger: create, update, delete
 *     Headers: include SANITY_WEBHOOK_SECRET
 *
 * ─── Fail-safe ────────────────────────────────────────────────────────────────
 *
 *   This route ALWAYS returns 200 (or 204) to Sanity, even on internal errors.
 *   Returning non-2xx causes Sanity to retry — which could flood the endpoint
 *   during outages.  Internal errors are logged for alerting instead.
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   Requests without a valid HMAC signature are rejected with 401.
 *   The HMAC is computed over the raw request body using SHA-256.
 */

import "server-only";

import { NextResponse }           from "next/server";
import { logger }                 from "@/lib/logger";
import { getDb }                  from "@/data/db";
import { decryptSecret, hasStoredSecret } from "@/lib/email-crypto";

// ── Webhook body shape from Sanity ────────────────────────────────────────────

interface SanityWebhookBody {
  /** The Sanity document _id */
  _id:       string;
  /** The Sanity document _type */
  _type?:    string;
  /** The operation that triggered the webhook */
  operation: "create" | "update" | "delete";
  /** Optional tenant ID field on the document */
  tenantId?: string | null;
  /** Whether the document is published */
  isPublished?: boolean;
}

// ── Supported content types → Meilisearch contentType mapping ─────────────────

const SANITY_TYPE_TO_CONTENT_TYPE: Record<string, string> = {
  page:        "page",
  newsArticle: "news",
  blogPost:    "post",
  jobPosting:  "vacancy",
  event:       "event",
};

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  // ── Signature verification ────────────────────────────────────────────────
  const webhookSecret = process.env.SANITY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.warn("[sanity-search-webhook] SANITY_WEBHOOK_SECRET not configured — rejecting.");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const signatureHeader = request.headers.get("sanity-webhook-signature") ?? "";

  if (!await verifySignature(rawBody, signatureHeader, webhookSecret)) {
    logger.warn("[sanity-search-webhook] Invalid signature — rejecting request.");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  let body: SanityWebhookBody;
  try {
    body = JSON.parse(rawBody) as SanityWebhookBody;
  } catch {
    logger.warn("[sanity-search-webhook] Could not parse webhook body.");
    return new NextResponse(null, { status: 204 }); // still 200-range to avoid Sanity retries
  }

  const { _id, _type, operation, tenantId } = body;

  if (!_id || !_type) {
    logger.warn("[sanity-search-webhook] Missing _id or _type in payload.", { body });
    return new NextResponse(null, { status: 204 });
  }

  const contentType = SANITY_TYPE_TO_CONTENT_TYPE[_type];
  if (!contentType) {
    // Content type not indexed for search — silently accept and ignore
    return new NextResponse(null, { status: 204 });
  }

  logger.info("[sanity-search-webhook] Received", { _id, _type, operation, tenantId });

  // ── Resolve Meilisearch config ────────────────────────────────────────────
  // When no tenantId on the document, attempt to find any tenant with Meilisearch.
  const meilisearchConfig = await resolveMeilisearchConfig(tenantId ?? null);

  if (!meilisearchConfig) {
    logger.info("[sanity-search-webhook] No Meilisearch config found — skipping index update.", {
      tenantId, _type,
    });
    return new NextResponse(null, { status: 204 });
  }

  const { host, apiKey, indexName } = meilisearchConfig;

  // ── Handle operation ──────────────────────────────────────────────────────
  try {
    if (operation === "delete") {
      await deleteDocument(host, apiKey, indexName, _id);
      logger.info("[sanity-search-webhook] Document deleted from index.", { _id, indexName });
    } else {
      // create or update — fetch latest from Sanity and upsert
      const doc = await fetchSanityDocument(_id, _type);
      if (doc && body.isPublished !== false) {
        await upsertDocument(host, apiKey, indexName, {
          id:          _id,
          contentType: contentType as "page" | "post" | "vacancy" | "event" | "news",
          title:       doc.title ?? "Untitled",
          slug:        doc.slug ?? `/${_id}`,
          excerpt:     doc.excerpt ?? undefined,
          tags:        doc.tags   ?? undefined,
          publishedAt: doc.publishedAt ?? undefined,
        });
        logger.info("[sanity-search-webhook] Document upserted in index.", { _id, indexName });
      } else if (!body.isPublished) {
        // Document was unpublished — remove it from the index
        await deleteDocument(host, apiKey, indexName, _id);
        logger.info("[sanity-search-webhook] Unpublished document removed from index.", { _id });
      }
    }
  } catch (err) {
    // Log but still return 204 to prevent Sanity from retrying
    logger.error("[sanity-search-webhook] Failed to update search index.", {
      _id, _type, operation, error: String(err),
    });
  }

  return new NextResponse(null, { status: 204 });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Verify the Sanity HMAC signature. */
async function verifySignature(
  rawBody:   string,
  signature: string,
  secret:    string,
): Promise<boolean> {
  try {
    // Signature header format: "t=<timestamp>,v1=<hmac>"
    const parts    = Object.fromEntries(signature.split(",").map((s) => s.split("=")));
    const timestamp = parts["t"];
    const hmac      = parts["v1"];

    if (!timestamp || !hmac) return false;

    const encoder    = new TextEncoder();
    const key        = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const message    = encoder.encode(`${timestamp}.${rawBody}`);
    const sigBytes   = hexToBytes(hmac);

    return await crypto.subtle.verify("HMAC", key, sigBytes.buffer as ArrayBuffer, message);
  } catch {
    return false;
  }
}

/** Convert a hex string to a Uint8Array. */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

/** Resolve the Meilisearch config for a tenant from the DB. */
async function resolveMeilisearchConfig(
  tenantId: string | null,
): Promise<{ host: string; apiKey: string; indexName: string } | null> {
  try {
    const db     = getDb() as unknown as { from: (t: string) => unknown };
    const query  = (db.from("tenant_search_settings") as {
      select:  (s: string) => unknown;
    }).select("config, tenant_id");

    const result = await (tenantId
      ? (query as { eq: (f: string, v: string) => unknown }).eq("tenant_id", tenantId)
      : query) as { data: Array<{ config: Record<string, unknown>; tenant_id: string }> | null; error: unknown };

    if (result.error || !result.data?.length) return null;

    // Use the first matching config (or the only one when tenantId is null)
    const row    = result.data[0]!;
    const config = row.config;

    if (config.provider !== "meilisearch") return null;

    const host   = typeof config.meilisearchHost   === "string" ? config.meilisearchHost.trim()   : "";
    const stored = typeof config.meilisearchApiKey === "string" ? config.meilisearchApiKey         : "";
    const prefix = typeof config.indexPrefix       === "string" ? config.indexPrefix.trim()        : "";

    if (!host || !stored || !hasStoredSecret(stored)) return null;

    const apiKey    = decryptSecret(stored);
    const indexName = `${prefix}${row.tenant_id}`;

    return { host, apiKey, indexName };
  } catch {
    return null;
  }
}

/** Delete a document from a Meilisearch index. */
async function deleteDocument(
  host:      string,
  apiKey:    string,
  indexName: string,
  docId:     string,
): Promise<void> {
  const url = `${host}/indexes/${encodeURIComponent(indexName)}/documents/${encodeURIComponent(docId)}`;
  const res = await fetch(url, {
    method:  "DELETE",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`Meilisearch DELETE failed: ${res.status} ${await res.text()}`);
  }
}

/** Upsert (add or replace) one document in a Meilisearch index. */
async function upsertDocument(
  host:      string,
  apiKey:    string,
  indexName: string,
  doc:       Record<string, unknown>,
): Promise<void> {
  const url = `${host}/indexes/${encodeURIComponent(indexName)}/documents`;
  const res = await fetch(url, {
    method:  "PUT",
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([doc]),
  });
  if (!res.ok) {
    throw new Error(`Meilisearch PUT failed: ${res.status} ${await res.text()}`);
  }
}

/** Fetch the latest version of a Sanity document by ID using GROQ. */
async function fetchSanityDocument(
  id:    string,
  _type: string,
): Promise<Record<string, unknown> | null> {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? process.env.SANITY_PROJECT_ID;
  const dataset   = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
  const token     = process.env.SANITY_API_TOKEN;

  if (!projectId) return null;

  const query   = encodeURIComponent(`*[_id == $id][0]{ _id, title, "slug": "/" + coalesce(slug.current, ""), "excerpt": coalesce(seoDescription, excerpt, ""), tags, publishedAt }`);
  const params  = encodeURIComponent(JSON.stringify({ id }));
  const url     = `https://${projectId}.api.sanity.io/v2024-01-01/data/query/${dataset}?query=${query}&$params=${params}`;

  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res  = await fetch(url, { headers });
    if (!res.ok) return null;
    const json = await res.json() as { result?: Record<string, unknown> };
    return json.result ?? null;
  } catch {
    return null;
  }
}
