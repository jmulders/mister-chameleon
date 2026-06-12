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

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Draft preview only available in development" },
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

  const token = storeDraft(entry);
  return NextResponse.json({ token }, { headers: CORS_HEADERS });
}
