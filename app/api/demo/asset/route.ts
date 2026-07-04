/**
 * GET /api/demo/asset?u=<absolute image URL>
 *
 * Image proxy for Live Mirror demos. Mirrored pages reference the prospect's
 * images by their absolute origin URL (e.g. https://www.brout.nl/img/x.jpg).
 * Many sites block cross-origin embedding (hotlink/Referer checks, or
 * Cross-Origin-Resource-Policy headers), so those images fail to load when the
 * mirrored page is served from our demo domain.
 *
 * This endpoint fetches the image SERVER-SIDE — sending the source site's own
 * origin as the Referer/Origin, which defeats Referer-based hotlink protection —
 * and re-serves it SAME-ORIGIN with a permissive CORP header, so it always
 * loads in the demo.
 *
 * Security: only public http/https hosts (basic SSRF guard), only image-ish
 * content types are streamed back, 10s timeout.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";

const PRIVATE_HOST = /^(localhost$|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$|0\.0\.0\.0$)/i;

const ALLOWED_TYPE = /^(image\/|font\/|application\/font|text\/css|application\/octet-stream)/i;

export async function GET(req: NextRequest): Promise<Response> {
  const raw = req.nextUrl.searchParams.get("u");
  if (!raw) return new NextResponse("Missing 'u'", { status: 400 });

  let target: URL;
  try { target = new URL(raw); } catch { return new NextResponse("Invalid URL", { status: 400 }); }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return new NextResponse("Unsupported scheme", { status: 400 });
  }
  if (PRIVATE_HOST.test(target.hostname)) return new NextResponse("Blocked host", { status: 400 });

  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const upstream = await fetch(target.toString(), {
      signal:   ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept":     "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        // Present the source site's own origin so hotlink/Referer checks pass.
        "Referer":    target.origin + "/",
        "Origin":     target.origin,
      },
    });

    if (!upstream.ok || !upstream.body) {
      return new NextResponse(null, { status: 404 });
    }

    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    if (!ALLOWED_TYPE.test(contentType)) {
      return new NextResponse(null, { status: 415 });
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type":                 contentType,
        "Cache-Control":                "public, max-age=86400, stale-while-revalidate=604800",
        "Cross-Origin-Resource-Policy": "cross-origin",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  } finally {
    clearTimeout(timer);
  }
}
