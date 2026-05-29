/**
 * GET /api/snippet.js
 *
 * Serves the Mister Chameleon personalisation snippet as a JavaScript file.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   Operators add ONE script tag to their site's <head>:
 *
 *     <script
 *       src="https://app.misterchameleon.com/api/snippet.js"
 *       data-site-key="sk_live_abc123"
 *       async
 *     ></script>
 *
 *   The script hides the page (opacity: 0), calls /api/snippet/decide with the
 *   visitor context, swaps `data-mc-slot` element content, then reveals the page.
 *
 * ─── Caching ─────────────────────────────────────────────────────────────────
 *
 *   The script file itself changes only on platform deploys, so it is cached
 *   for 1 hour on the CDN (s-maxage=3600) and validated via stale-while-revalidate.
 *   The actual personalisation decision is always fresh — it happens at runtime
 *   via the POST to /api/snippet/decide.
 *
 * ─── CORS ────────────────────────────────────────────────────────────────────
 *
 *   The script is served with `Access-Control-Allow-Origin: *` so any third-party
 *   domain may load it.
 */

import { NextRequest, NextResponse } from "next/server";
import { buildSnippetSource } from "@/lib/snippet/snippet-source";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  // ── Decide endpoint URL ────────────────────────────────────────────────────
  //
  // Build the absolute URL for /api/snippet/decide so the snippet can call
  // it cross-origin from any third-party site.
  const origin = new URL(request.url).origin;
  const decideUrl = `${origin}/api/snippet/decide`;

  const source = buildSnippetSource(decideUrl);

  return new NextResponse(source, {
    status: 200,
    headers: {
      "Content-Type":                "application/javascript; charset=utf-8",
      "Cache-Control":               "public, s-maxage=3600, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options":      "nosniff",
    },
  });
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
