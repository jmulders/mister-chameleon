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
 * Security: only public http/https hosts (checked by resolved address, on every
 * redirect hop), only image content types are streamed back, and the response
 * carries a sandbox CSP so it is inert when opened directly. 10s timeout.
 */

import { NextRequest, NextResponse } from "next/server";
import { BlockedUrlError, fetchPublicUrl } from "@/lib/security/public-fetch";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";

/**
 * Sent with every proxied file. Embedded in an <img> none of this matters, but
 * the URL can also be opened directly, and then the file is a document on the
 * platform's own origin: an SVG with a script in it would run next to /admin.
 * The sandbox policy takes away scripts and the origin, nosniff stops the
 * browser from deciding it is HTML after all.
 */
const SAFE_HEADERS = {
  "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:",
  "X-Content-Type-Options":  "nosniff",
} as const;

export async function GET(req: NextRequest): Promise<Response> {
  const raw = req.nextUrl.searchParams.get("u");
  if (!raw) return new NextResponse("Missing 'u'", { status: 400 });

  let target: URL;
  try { target = new URL(raw); } catch { return new NextResponse("Invalid URL", { status: 400 }); }

  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    // Public hosts only, checked by resolved address and again on every redirect.
    const upstream = await fetchPublicUrl(target, {
      signal:   ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept":     "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        // Present the source site's own origin as Referer so hotlink/Referer
        // checks pass (looks like the site loading its own image). No Origin
        // header — some origins reject cross-origin-looking image GETs.
        "Referer":    target.origin + "/",
      },
    });

    if (!upstream.ok || !upstream.body) {
      return new NextResponse(null, { status: 404 });
    }

    // Images only. The type used to be passed through as the origin sent it,
    // which made this an open proxy for HTML on the platform's own origin.
    const contentType = (upstream.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!contentType.startsWith("image/")) {
      await upstream.body.cancel().catch(() => undefined);
      return new NextResponse(null, { status: 415, headers: SAFE_HEADERS });
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        ...SAFE_HEADERS,
        "Content-Type":                 contentType,
        "Cache-Control":                "public, max-age=86400, stale-while-revalidate=604800",
        "Cross-Origin-Resource-Policy": "cross-origin",
      },
    });
  } catch (err) {
    if (err instanceof BlockedUrlError) return new NextResponse("Blocked host", { status: 400 });
    return new NextResponse(null, { status: 404 });
  } finally {
    clearTimeout(timer);
  }
}
