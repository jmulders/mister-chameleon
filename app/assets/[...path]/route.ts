/**
 * Statamic asset proxy — /assets/[...path]
 *
 * Serves CMS-managed assets (images, documents, etc.) stored in the Statamic
 * installation.  Statamic internally references assets as
 *   `statamic://asset::{container}::{filename}`
 * which the mappers resolve to root-relative `/assets/{filename}` URLs.
 * Those URLs reach this route handler.
 *
 * ── Resolution order ──────────────────────────────────────────────────────────
 *
 *   1. Disk (STATAMIC_CMS_PATH is set)
 *      Read the file directly from `{STATAMIC_CMS_PATH}/public/assets/{path}`.
 *      Used when the Next.js app runs in file-based mode without a running PHP
 *      server — typical for local development with `STATAMIC_CMS_PATH`.
 *
 *   2. HTTP proxy (STATAMIC_API_URL is set)
 *      Forward the request to `{STATAMIC_API_URL}/assets/{path}`.
 *      Used when the Statamic PHP server is running (e.g. on a staging server or
 *      when only the HTTP API is configured without a local CMS path).
 *
 *   3. 404 — neither env variable is set.
 *
 * ── Why not a Next.js rewrite? ────────────────────────────────────────────────
 *
 *   The previous approach used a `rewrites()` rule in next.config.mjs to proxy
 *   `/assets/:path*` → `STATAMIC_API_URL/assets/:path*`.  That approach fails
 *   when `STATAMIC_CMS_PATH` is set and the PHP server is NOT running — the proxy
 *   returns 502 and images show as broken.  This route handler adds the disk
 *   fallback while keeping the HTTP proxy as a secondary option.
 *
 * Note: `next.config.mjs` still contains the rewrites() rule for situations
 * where this App Router route does NOT exist (e.g. edge deployments).  When this
 * file is present, Next.js App Router routes take precedence over rewrites for
 * the same path, so the rewrite is effectively skipped.
 */

import fs   from "fs";
import path from "path";
import type { NextRequest } from "next/server";
import { NextResponse }    from "next/server";

// ── MIME-type table ───────────────────────────────────────────────────────────

const MIME: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png":  "image/png",
  ".gif":  "image/gif",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".avif": "image/avif",
  ".mp4":  "video/mp4",
  ".webm": "video/webm",
  ".pdf":  "application/pdf",
};

function mimeFor(filePath: string): string {
  return MIME[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await context.params;
  const relativePath = segments.join("/");

  // ── 1. Disk serving ──────────────────────────────────────────────────────────
  //
  // When STATAMIC_CMS_PATH is set the Statamic installation lives on disk next
  // to this Next.js project.  We read the file directly — no PHP server needed.
  const cmsPath = process.env.STATAMIC_CMS_PATH;
  if (cmsPath) {
    const filePath = path.resolve(process.cwd(), cmsPath, "public", "assets", relativePath);

    // Path traversal guard: resolved path must stay inside the assets directory.
    const assetsDir = path.resolve(process.cwd(), cmsPath, "public", "assets");
    if (filePath.startsWith(assetsDir)) {
      try {
        const file = fs.readFileSync(filePath);
        return new NextResponse(file, {
          headers: {
            "Content-Type":  mimeFor(filePath),
            // Assets are content-addressed (URL encodes the file) — cache aggressively.
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      } catch {
        // File not on disk — fall through to HTTP proxy.
      }
    }
  }

  // ── 2. HTTP proxy ─────────────────────────────────────────────────────────────
  //
  // Forward the request to the running Statamic PHP server.
  const apiBase = (process.env.STATAMIC_API_URL ?? "").replace(/\/$/, "");
  if (apiBase) {
    const upstreamUrl = `${apiBase}/assets/${relativePath}`;
    try {
      const upstream = await fetch(upstreamUrl, { next: { revalidate: 3600 } });
      if (upstream.ok) {
        const body        = await upstream.arrayBuffer();
        const contentType = upstream.headers.get("content-type") ?? mimeFor(relativePath);
        return new NextResponse(body, {
          headers: {
            "Content-Type":  contentType,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }
    } catch {
      // Proxy failed (PHP server not running etc.) — fall through to 404.
    }
  }

  // ── 3. Not found ──────────────────────────────────────────────────────────────
  return new NextResponse("Asset not found", { status: 404 });
}
