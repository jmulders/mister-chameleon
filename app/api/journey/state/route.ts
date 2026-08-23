/**
 * GET /api/journey/state
 *
 * Returns the current behavioral journey state and recent events for the
 * active visitor session.  Consumed by the client-side JourneyDebugPanel
 * to display live behavioral data after client-side route changes — without
 * requiring a full page reload.
 *
 * ─── Response shape ───────────────────────────────────────────────────────────
 *
 *   {
 *     journey:   JourneyState | null,    // null = no DB state yet
 *     events:    JourneyEventRow[],      // most recent 20, chronological
 *     sessionId: string,                 // session cookie value (for debug)
 *     tenantId:  string,
 *   }
 *
 * ─── Session resolution ───────────────────────────────────────────────────────
 *
 *   Reads the httpOnly `mc_session_id` cookie via `resolveSession()` —
 *   the same mechanism used by the events API route and the server-side
 *   page render.  The client cannot read this cookie directly, which is why
 *   this endpoint exists.
 *
 * ─── Performance ──────────────────────────────────────────────────────────────
 *
 *   Two parallel DB lookups:
 *     1. visitor_behavior_state  — single PK lookup (lightweight)
 *     2. visitor_journey_events  — indexed query, limit 20
 *
 *   Total latency is dominated by round-trip to Supabase (<50 ms on the same
 *   region).  This endpoint is only called from the debug panel in dev mode,
 *   never on the hot production render path.
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   Only raw behavioral signals (event types, scores, funnel stage) are
 *   returned — no PII.  The session ID in the response is the same UUID
 *   already set as an httpOnly cookie; returning it here does not change
 *   its effective exposure.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveSession }            from "@/data/session";
import { resolveConsent }            from "@/lib/consent/server-consent";
import { getActiveTenant }           from "@/tenant/server";
import {
  fetchJourneyState,
  fetchRecentJourneyEvents,
} from "@/lib/journey/fetch-journey-state";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get("cookie");
    // cookiesToSet is populated only on the very first request (no existing
    // mc_session_id cookie).  We write it back so the browser has a stable
    // session ID for all subsequent polls and page renders.
    const { sessionId, cookiesToSet } = resolveSession(cookieHeader);

    // Resolve active tenant for this request.
    const tenant = await getActiveTenant();

    // Anonymity boundary: journey state is persistent, cross-session behaviour.
    // Without personalization consent, return nothing and — crucially — do NOT
    // persist the mc_session_id cookie (no persistent id for anonymous visitors).
    // The serving paths enforce the tenant privacy ceiling; this client poll gates
    // on the user's mc_consent choice.
    const consent = resolveConsent(cookieHeader);
    if (!consent.personalization) {
      return NextResponse.json(
        { journey: null, events: [], sessionId: null, tenantId: tenant.tenantId },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    // Parallel DB lookups — neither can throw (both have internal try/catch).
    const [journey, events] = await Promise.all([
      fetchJourneyState(sessionId, tenant.tenantId),
      fetchRecentJourneyEvents(sessionId, tenant.tenantId, 20),
    ]);

    const response = NextResponse.json(
      {
        journey:   journey.fromDatabase ? journey : null,
        events,
        sessionId,
        tenantId:  tenant.tenantId,
      },
      {
        status: 200,
        headers: {
          // Instruct the browser not to cache this response — journey state
          // changes on every event write.
          "Cache-Control": "no-store",
        },
      },
    );

    // Defensive: set the session cookie if it wasn't already present.
    for (const cookie of cookiesToSet) {
      response.cookies.set(cookie.name, cookie.value, {
        maxAge:   cookie.maxAge,
        path:     cookie.path,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
        secure:   cookie.secure,
      });
    }

    return response;
  } catch (error) {
    logger.warn("[api/journey/state] Failed to resolve journey state", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to fetch journey state." },
      { status: 500 },
    );
  }
}
