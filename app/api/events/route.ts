import { NextRequest, NextResponse } from "next/server";
import { saveEvent } from "@/data/repositories/events-repository";
import {
  getSessionById,
  upsertSession,
} from "@/data/repositories/sessions-repository";
import { validateEventRequest } from "@/tracking/validate-event";
import { resolveSession } from "@/data/session";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400 },
      );
    }

    const validation = validateEventRequest(body);

    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status },
      );
    }

    const cookieHeader = request.headers.get("cookie");
    const { sessionId, cookiesToSet, visitType } = resolveSession(cookieHeader);

    // Ensure the FK target exists before writing an event.
    const existingSession = await getSessionById(sessionId);

    if (!existingSession.ok) {
      logger.error("[api/events] Failed to load session before event insert", {
        sessionId,
        error: existingSession.error,
      });

      return NextResponse.json(
        { error: "Failed to resolve session." },
        { status: 500 },
      );
    }

    if (!existingSession.data) {
      const referer = request.headers.get("referer");
      const userAgent = request.headers.get("user-agent") ?? "";

      let pathname = "/";
      let utmSource: string | null = null;
      let utmMedium: string | null = null;
      let utmCampaign: string | null = null;

      try {
        const url = new URL(request.url);
        pathname = url.pathname;
        utmSource = url.searchParams.get("utm_source");
        utmMedium = url.searchParams.get("utm_medium");
        utmCampaign = url.searchParams.get("utm_campaign");
      } catch {
        // keep defaults
      }

      const upserted = await upsertSession({
        id: sessionId,
        source: "unknown",
        device: /mobile/i.test(userAgent) ? "mobile" : "desktop",
        visitType,
        pathname,
        referrer: referer,
        utmSource,
        utmMedium,
        utmCampaign,
      });

      if (!upserted.ok) {
        logger.error("[api/events] Failed to upsert session before event insert", {
          sessionId,
          error: upserted.error,
        });

        return NextResponse.json(
          { error: "Failed to create session." },
          { status: 500 },
        );
      }
    }

    const result = await saveEvent({
      sessionId,
      eventType: validation.value.eventType,
      payload: validation.value.payload,
      tenantId: validation.value.tenantId,
    });

    if (!result.ok) {
      logger.error("[api/events] Failed to save event", {
        sessionId,
        eventType: validation.value.eventType,
        error: result.error,
      });

      return NextResponse.json(
        { error: "Failed to store event." },
        { status: 500 },
      );
    }

    const response = NextResponse.json(
      { ok: true, eventId: result.data.id },
      { status: 201 },
    );

    for (const cookie of cookiesToSet) {
      response.cookies.set(cookie.name, cookie.value, {
        maxAge: cookie.maxAge,
        path: cookie.path,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
        secure: cookie.secure,
      });
    }

    return response;
  } catch (error) {
    logger.error("[api/events] Unexpected error", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 },
    );
  }
}