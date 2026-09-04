import { NextRequest, NextResponse } from "next/server";
import { storeDraft, type StatamicDraftEntry } from "@/lib/statamic-draft-store";
import { getAllTenants } from "@/tenant/server";
import { logger } from "@/lib/logger";

/**
 * POST /api/statamic-draft
 *
 * Receives the current (unsaved) Statamic entry data from the Antlers Live
 * Preview template, stores it in the in-memory draft store, and returns a
 * short-lived token.  The Antlers template appends the token to the Next.js
 * iframe URL so the page renders with draft content before the user saves.
 *
 * CORS is open for localhost so the script running inside the Statamic CP
 * preview iframe (localhost:8000) can POST to this endpoint (localhost:3000).
 * The endpoint is disabled in production.
 *
 * ─── Payload shape ────────────────────────────────────────────────────────────
 *
 *   The Antlers template serialises `page_blocks` as a unified array containing
 *   both context_slot blocks and free content blocks in authored order.
 *   The POST body must contain one of:
 *     { pageBlocks: [...] }   — current architecture (preferred)
 *     { blocks: [...] }       — oldest legacy format
 *
 *   Typed variant arrays ({ heroVariants, proofVariants, … }) are merged for
 *   backward compatibility with the multi-tab blueprint era.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Light origin gate for the (otherwise unauthenticated) draft write endpoint.
 *
 * Allowed origins, in order of preference:
 *   1. localhost / 127.0.0.1            — local dev
 *   2. any *.ploi.it host               — the managed CP preview hosts
 *   3. any registered tenant's CMS host — DERIVED from the tenant store's
 *      cms.statamicBaseUrl, so adding a tenant in the admin AUTOMATICALLY
 *      trusts its CP origin. No Vercel env edit needed per new tenant — this
 *      is what keeps Live Preview working across future deploys without manual
 *      upkeep (the previous failure mode).
 *   4. any origin listed in STATAMIC_CP_ORIGIN — explicit override / escape
 *      hatch. May hold MULTIPLE origins, space- or comma-separated (mirrors how
 *      next.config.mjs parses it for frame-ancestors). Tested by MEMBERSHIP,
 *      never equality with the whole string.
 * Requests with no Origin header (server-to-server) are allowed.
 */
function staticAllowedOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).host;
    if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) return true;
    if (host.endsWith(".ploi.it")) return true;
    const configured = (process.env.STATAMIC_CP_ORIGIN ?? "")
      .split(/[\s,]+/)
      .filter(Boolean);
    if (configured.includes(origin)) return true;
  } catch {
    return false;
  }
  return false;
}

/** Scheme+host origin of a tenant's Statamic base URL, e.g. https://cms.x.nl. */
function originOf(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

async function isAllowedOrigin(origin: string | null): Promise<boolean> {
  if (!origin) return true;
  if (staticAllowedOrigin(origin)) return true;

  // Self-maintaining check: trust any origin that matches a registered tenant's
  // configured Statamic CMS host. Best-effort — a store hiccup must not break a
  // request that the static rules already would have allowed (handled above).
  try {
    const tenants = await getAllTenants();
    for (const t of tenants) {
      if (originOf(t.cms?.statamicBaseUrl) === origin) return true;
    }
  } catch (err) {
    logger.warn("[statamic-draft] tenant origin check failed", { error: String(err) });
  }
  return false;
}

export async function POST(req: NextRequest) {
  if (!(await isAllowedOrigin(req.headers.get("origin")))) {
    return NextResponse.json(
      { error: "Origin not allowed" },
      { status: 403, headers: CORS_HEADERS },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // Merge all block arrays in priority order, newest format first.
  // pageBlocks carries the unified page_blocks Replicator (context_slot blocks
  // + content blocks as siblings) — this is the current format.
  // The typed variant arrays and the flat `blocks` key are backward-compat shims.
  const blocks: unknown[] = [
    ...(Array.isArray(body.pageBlocks)         ? body.pageBlocks         : []),
    ...(Array.isArray(body.heroVariants)       ? body.heroVariants       : []),
    ...(Array.isArray(body.proofVariants)      ? body.proofVariants      : []),
    ...(Array.isArray(body.ctaVariants)        ? body.ctaVariants        : []),
    ...(Array.isArray(body.featureVariants)    ? body.featureVariants    : []),
    ...(Array.isArray(body.conversionVariants) ? body.conversionVariants : []),
    ...(Array.isArray(body.content)            ? body.content            : []),
    ...(Array.isArray(body.blocks)             ? body.blocks             : []),
  ];

  const entry: StatamicDraftEntry = {
    collection: typeof body.collection === "string" ? body.collection : "pages",
    // Do NOT default to "home": Statamic's Live Preview can send a null slug for
    // the reconstructed (unsaved) item, and stamping "home" makes a non-home
    // entry's preview adopt the homepage's identity (metadata, URL, and
    // context-slot resolution) — the "preview shows the homepage" bug. An empty
    // slug is rendered straight from the draft blocks by /mc-preview instead.
    slug: typeof body.slug === "string" ? body.slug : "",
    blocks,
    title: typeof body.title === "string" ? body.title : undefined,
    seoDescription: typeof body.seoDescription === "string" ? body.seoDescription : undefined,
  };

  const token = await storeDraft(entry);
  return NextResponse.json({ token }, { headers: CORS_HEADERS });
}
