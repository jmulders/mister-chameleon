import { NextRequest, NextResponse } from "next/server";
import { storeDraft, type StatamicDraftEntry } from "@/lib/statamic-draft-store";

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
 * Allowed: localhost (dev), any *.ploi.it host (the managed CP), and any origin
 * listed in STATAMIC_CP_ORIGIN. That var may hold MULTIPLE custom CP origins
 * (one per tenant CMS domain), space- or comma-separated — mirroring how
 * next.config.mjs parses it for frame-ancestors, e.g.
 *   "https://cms.misterchameleon.nl https://cms.steunles.nl"
 * We must therefore test MEMBERSHIP, not equality with the whole string (an
 * exact `origin === configured` match never succeeds once the var lists >1
 * origin, which silently 403s the draft POST and breaks Live Preview).
 * Requests with no Origin header (server-to-server) are allowed.
 */
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true;
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

export async function POST(req: NextRequest) {
  if (!isAllowedOrigin(req.headers.get("origin"))) {
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
    slug: typeof body.slug === "string" ? body.slug : "home",
    blocks,
    title: typeof body.title === "string" ? body.title : undefined,
    seoDescription: typeof body.seoDescription === "string" ? body.seoDescription : undefined,
  };

  const token = await storeDraft(entry);
  return NextResponse.json({ token }, { headers: CORS_HEADERS });
}
