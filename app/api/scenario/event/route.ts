import { NextRequest, NextResponse } from "next/server";
import { resolveSession }         from "@/data/session";
import { recordJourneyEvent }     from "@/lib/journey/record-event";
import { logger }                 from "@/lib/logger";
import { getActiveTenant }        from "@/tenant/server";
import type { JourneyEventType }  from "@/lib/journey/types";

/**
 * POST /api/scenario/event
 *
 * Scenario-mode event recorder — used exclusively by the ScenarioControlPanel
 * to fire demo flow events WITHOUT the client-side or server-side consent gate.
 *
 * ─── Why a separate endpoint? ─────────────────────────────────────────────────
 *
 *   The normal /api/events endpoint checks analytics + personalization consent
 *   before writing to visitor_journey_events.  This is correct for real visitor
 *   tracking, but it silently drops demo flow events when the admin hasn't
 *   accepted the cookie banner — meaning the demo scenario never produces any
 *   journey state and the Journey Intelligence page stays stuck on "Not enough
 *   signal yet".
 *
 *   Demo flows are an admin testing tool, not real visitor tracking.  They are
 *   intentional injections of test data into the pipeline for verification
 *   purposes.  Consent requirements don't apply.
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   This endpoint does NOT require admin authentication.  However:
 *
 *     • It writes events under the caller's own mc_session_id (read from the
 *       httpOnly cookie server-side) — it cannot inject events into any other
 *       session.
 *     • Event metadata is tagged with `scenario_event: true` so these events
 *       can be distinguished from organic events in the DB.
 *     • The payload is sanitised: only known fields are forwarded.
 *
 *   The worst-case abuse is a visitor spamming test events into their own
 *   session — the same data they could produce organically anyway.
 *
 * ─── Body ─────────────────────────────────────────────────────────────────────
 *
 *   {
 *     eventType:     "page_view" | "cta_click" | "form_start" | "form_submit" | "download"
 *     pagePath?:     string    — page path override
 *     pageCategory?: string    — page category
 *     eventValue?:   string    — e.g. CTA id
 *     demoFlow?:     string    — flow key (metadata only)
 *     demoStep?:     number    — step index (metadata only)
 *     occurredAt?:   string    — ISO-8601 client timestamp
 *   }
 */

const ALLOWED_EVENT_TYPES = new Set([
  "page_view", "cta_click", "form_start", "form_submit", "download",
]);

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Body must be a JSON object" }, { status: 400 });
    }

    const b = body as Record<string, unknown>;

    const eventType = typeof b["eventType"] === "string" ? b["eventType"] : null;
    if (!eventType || !ALLOWED_EVENT_TYPES.has(eventType)) {
      return NextResponse.json({ error: "Invalid or missing eventType" }, { status: 400 });
    }

    // Resolve the session from the httpOnly mc_session_id cookie.
    // cookiesToSet is non-empty only on the very first call (when no
    // mc_session_id cookie exists yet).  We must write it back to the browser
    // so subsequent requests — including further demo flow steps and the
    // /api/journey/state polls — all use the same session ID.
    // Without this, every scenario event call would generate a fresh UUID and
    // events would be scattered across ephemeral sessions, causing Live State
    // to always show zeroes.
    const cookieHeader = request.headers.get("cookie");
    const { sessionId, cookiesToSet } = resolveSession(cookieHeader);

    // Resolve the active tenant.
    let tenantId = "unknown";
    try {
      const tenant = await getActiveTenant();
      tenantId = tenant.tenantId;
    } catch {
      // Non-fatal — use "unknown" so events still land
    }

    const pagePath     = typeof b["pagePath"]     === "string" ? b["pagePath"]     : null;
    const pageCategory = typeof b["pageCategory"] === "string" ? b["pageCategory"] : null;
    const eventValue   = typeof b["eventValue"]   === "string" ? b["eventValue"]   : null;
    const demoFlow     = typeof b["demoFlow"]      === "string" ? b["demoFlow"]     : null;
    const demoStep     = typeof b["demoStep"]      === "number" ? b["demoStep"]     : null;
    const occurredAt   = typeof b["occurredAt"]   === "string" ? b["occurredAt"]   : null;
    const pageKeywords = Array.isArray(b["pageKeywords"])
      ? (b["pageKeywords"] as string[])
      : [];

    await recordJourneyEvent({
      eventId:      null,          // DB auto-generates; demo steps are not retried
      tenantId,
      sessionId,
      eventType:    eventType as JourneyEventType,
      eventValue:   eventValue ?? pagePath,
      pagePath,
      pageCategory,
      pageKeywords,
      source:       null,
      medium:       null,
      campaign:     null,
      occurredAt,
      visitorId:    null,
      metadata: {
        // Tag these events so they can be filtered in analytics if needed.
        scenario_event: true,
        demo_flow:      demoFlow,
        demo_step:      demoStep,
        page_path:      pagePath,
        page_category:  pageCategory,
        event_value:    eventValue,
      },
    });

    const response = NextResponse.json({ ok: true, sessionId }, { status: 201 });

    // Write the session cookie back so the browser reuses this session ID on
    // every subsequent request (further demo steps, /api/journey/state polls,
    // page renders).  No-op when the cookie already existed (cookiesToSet = []).
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
  } catch (err) {
    logger.error("[api/scenario/event] Unexpected error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
