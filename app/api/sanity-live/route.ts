/**
 * Sanity Live Preview — Server-Sent Events proxy
 *
 * Streams Sanity mutation events to the browser as SSE so that the
 * PreviewBar client component can trigger router.refresh() and show
 * updated draft content without a manual page reload.
 *
 * ─── Flow ─────────────────────────────────────────────────────────────────────
 *
 *   Browser (EventSource)
 *     → GET /api/sanity-live
 *       → draftMode guard (401 if not in preview)
 *       → client.listen(GROQ, {}, { visibility:"query" }) [server-side]
 *         → mutation fires in Sanity Studio
 *           → SSE "mutation" event → browser
 *             → router.refresh() [RSC re-render with no-store cache]
 *               → page shows updated draft content ✓
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   - Requires draftMode().isEnabled — the signed HTTP-only preview cookie.
 *     Without the cookie this route returns 401.  Public visitors never have
 *     this cookie so they can never access live draft events.
 *   - The Sanity token used here is the server-side SANITY_PREVIEW_TOKEN;
 *     it is never sent to the browser.
 *
 * ─── Cleanup ──────────────────────────────────────────────────────────────────
 *
 *   The Sanity subscription is torn down when:
 *     a. The browser closes the EventSource connection (request.signal abort).
 *     b. The ReadableStream is cancelled (e.g. on server shutdown).
 *     c. Sanity emits a subscription error.
 *
 *   Keepalive comments are sent every 25 s to prevent idle proxies from
 *   closing the connection (many CDNs / load-balancers close connections
 *   that appear idle for > 30 s).
 *
 * ─── Environment variables ────────────────────────────────────────────────────
 *
 *   SANITY_PREVIEW_TOKEN  — Token for previewDrafts perspective (server-side).
 *                           Falls back to SANITY_READ_TOKEN when absent.
 *                           This token is NEVER sent to the browser.
 */

import { draftMode } from "next/headers";
import { createPreviewSanityClient } from "@/cms/providers/sanity-client";

// Force dynamic: this route streams indefinitely and must never be cached or
// statically optimised by Next.js.
export const dynamic = "force-dynamic";

// ── GROQ listen scope ─────────────────────────────────────────────────────────
//
// Subscribes to mutations on all document types that can affect a rendered
// page.  We deliberately DO NOT filter by tenant here — any mutation in the
// connected Sanity project triggers a refresh, and the page itself handles
// tenant scoping on the subsequent RSC re-render.
//
// Keeping the query broad avoids the need to pass tenant context through the
// SSE URL (which would require coordinating server and client state).
const LIVE_LISTEN_QUERY = `*[_type in [
  "page",
  "heroVariant",
  "proofVariant",
  "ctaVariant",
  "featureVariant",
  "conversionVariant",
  "siteSettings"
]]`;

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  // ── Preview guard ───────────────────────────────────────────────────────────
  //
  // Reject requests that don't carry the signed draftMode cookie.
  // This keeps the Sanity listen subscription — and therefore draft document
  // access — completely invisible to public visitors.
  const { isEnabled } = await draftMode();
  if (!isEnabled) {
    return new Response(
      "Live preview requires an active preview session. " +
        "Visit /api/preview?secret=<SANITY_PREVIEW_SECRET>&slug=<slug> first.",
      { status: 401 },
    );
  }

  // ── Stream setup ────────────────────────────────────────────────────────────
  const encoder = new TextEncoder();
  let subscription: { unsubscribe(): void } | null = null;
  let keepaliveTimer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // ── Initial "connected" event ─────────────────────────────────────────
      //
      // Sent immediately so the browser EventSource transitions out of the
      // "connecting" state before any Sanity mutation occurs.
      controller.enqueue(encoder.encode("event: connected\ndata: {}\n\n"));

      // ── Keepalive ─────────────────────────────────────────────────────────
      //
      // SSE comment lines (": ...") are ignored by EventSource but reset the
      // idle timer on proxies that would otherwise close the connection.
      keepaliveTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          // Stream already closed — the interval will be cleared on cleanup.
        }
      }, 25_000);

      // ── Sanity mutation subscription ──────────────────────────────────────
      //
      // createPreviewSanityClient() produces a client with:
      //   - perspective: "previewDrafts"
      //   - useCdn: false
      //   - token: SANITY_PREVIEW_TOKEN ?? SANITY_READ_TOKEN
      //
      // includeResult: false — we only need to know something changed, not
      //   what it changed to.  The RSC re-render will fetch the full data.
      // visibility: "query" — events fire when the change is visible to
      //   queries, not at the raw write time.  This prevents partial updates.
      const client = createPreviewSanityClient();

      subscription = client
        .listen(LIVE_LISTEN_QUERY, {}, { includeResult: false, visibility: "query" })
        .subscribe({
          next: () => {
            // Forward as a "mutation" SSE event.  The payload is empty —
            // the client only needs to know "something changed".
            try {
              controller.enqueue(encoder.encode("event: mutation\ndata: {}\n\n"));
            } catch {
              // Stream already closed; nothing to do.
            }
          },
          error: () => {
            // Sanity subscription error — close the stream so the browser
            // EventSource triggers its onerror handler and reconnects.
            cleanup();
            try { controller.close(); } catch { /* already closed */ }
          },
        });

      // ── Client disconnect cleanup ─────────────────────────────────────────
      request.signal.addEventListener("abort", () => {
        cleanup();
        try { controller.close(); } catch { /* already closed */ }
      });
    },

    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection":    "keep-alive",
      // Tell Nginx/other reverse proxies not to buffer — events must be
      // forwarded to the browser immediately.
      "X-Accel-Buffering": "no",
    },
  });

  // ── Cleanup helper ──────────────────────────────────────────────────────────
  function cleanup() {
    if (keepaliveTimer !== null) {
      clearInterval(keepaliveTimer);
      keepaliveTimer = null;
    }
    subscription?.unsubscribe();
    subscription = null;
  }
}
