/**
 * GET /demo/[demoId]/live
 *
 * Serves the mirrored + instrumented homepage HTML for a Live Mirror Demo.
 *
 * ─── Behaviour ────────────────────────────────────────────────────────────────
 *
 *   • Loads the demo_instances row for the given ID.
 *   • If demo_mode = "mirror" and mirrored_html is present → serves it as
 *     text/html with X-Frame-Options: SAMEORIGIN and minimal caching.
 *   • If the demo is synthetic (no mirrored_html) → redirects to /demo/[demoId]
 *     so the React DemoViewer handles it.
 *   • Expired or missing demos → 404 page.
 *   • Increments view_count (best-effort, non-blocking).
 *
 * ─── Security headers ─────────────────────────────────────────────────────────
 *
 *   Content-Security-Policy is intentionally permissive for demo pages:
 *   the whole point is to load the prospect's CSS, images, and fonts
 *   while running our injected snippet.  We only block object-src.
 *
 *   X-Frame-Options: SAMEORIGIN — the live page can be embedded in our own
 *   admin preview iframes but not third-party sites.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@supabase/supabase-js";
import { getDemoById, bumpViewCount } from "@/demo/store";

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(
  _req:    NextRequest,
  { params }: { params: Promise<{ demoId: string }> },
): Promise<NextResponse> {
  const { demoId } = await params;

  if (!demoId || typeof demoId !== "string") {
    return new NextResponse("Not found", { status: 404 });
  }

  const client = createClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false } },
  );

  // ── Load demo ───────────────────────────────────────────────────────────────

  let demo;
  try {
    demo = await getDemoById(client, demoId);
  } catch (err) {
    console.error("[demo/live] getDemoById failed", {
      demoId, error: err instanceof Error ? err.message : String(err),
    });
    return new NextResponse(errorPage("Something went wrong loading this demo."), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // ── Not found or expired ────────────────────────────────────────────────────

  if (!demo) {
    return new NextResponse(
      errorPage("This demo link has expired or does not exist."),
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  // ── Redirect synthetic demos to the React viewer ────────────────────────────

  if (demo.demo_mode !== "mirror" || !demo.mirrored_html) {
    return NextResponse.redirect(
      new URL(`/demo/${demoId}`, _req.url),
      { status: 302 },
    );
  }

  // ── Increment view count (fire-and-forget) ──────────────────────────────────

  void bumpViewCount(client, demoId, demo.view_count).catch(() => {
    // Non-fatal
  });

  // ── Serve mirrored HTML ──────────────────────────────────────────────────────

  return new NextResponse(demo.mirrored_html, {
    status: 200,
    headers: {
      "Content-Type":    "text/html; charset=utf-8",
      // Allow loading cross-origin resources from the prospect's domain
      "Content-Security-Policy": [
        "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:",
        "object-src 'none'",
      ].join("; "),
      // Allow embedding in our own admin/preview pages
      "X-Frame-Options": "SAMEORIGIN",
      // Short cache — demo content shouldn't be stale
      "Cache-Control":   "no-store",
      // CORS not needed — served from our own domain
    },
  });
}

// ── Error page ─────────────────────────────────────────────────────────────────

function errorPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Demo not found — Mister Chameleon</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; margin: 0; background: #f8fafc; color: #334155;
    }
    .card {
      text-align: center; max-width: 440px; padding: 2.5rem 2rem;
      background: white; border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,.07);
    }
    .icon { font-size: 2.5rem; margin-bottom: 1rem; }
    h1 { font-size: 1.25rem; font-weight: 700; color: #0f172a; margin: 0 0 .5rem; }
    p  { font-size: .9rem; color: #64748b; margin: 0 0 1.5rem; line-height: 1.6; }
    a  {
      display: inline-block; background: #6366f1; color: white;
      padding: .6rem 1.4rem; border-radius: 8px; font-size: .875rem;
      font-weight: 600; text-decoration: none;
    }
    a:hover { background: #4f46e5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🦎</div>
    <h1>Demo not available</h1>
    <p>${message}</p>
    <a href="https://misterchameleon.com">Visit Mister Chameleon →</a>
  </div>
</body>
</html>`;
}
