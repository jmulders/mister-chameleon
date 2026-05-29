import { NextRequest, NextResponse } from "next/server";
import { saveEvent } from "@/data/repositories/events-repository";
import {
  getSessionById,
  upsertSession,
} from "@/data/repositories/sessions-repository";
import { validateEventRequest } from "@/tracking/validate-event";
import { resolveSession } from "@/data/session";
import { logger } from "@/lib/logger";
import { getActiveTenant } from "@/tenant/server";
import { getTenantById } from "@/tenant/server";
import { sendGa4MpEvent } from "@/lib/ga4-measurement-protocol";
import { recordJourneyEvent } from "@/lib/journey/record-event";
import type { JourneyEventType } from "@/lib/journey/types";
import { resolveConsent, isConsentGranted } from "@/lib/consent/server-consent";

/** Event types that are tracked by the journey system. */
const JOURNEY_EVENT_TYPES = new Set<string>([
  "page_view", "cta_click", "form_start", "form_submit", "download",
]);

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

    // ── Consent gate (server-side double-check) ──────────────────────────────
    //
    // Client-side trackEvent() already checks consent before sending.
    // We re-check here to prevent any bypass (direct API calls, server-side
    // tracking, legacy integrations).
    //
    // Resolution order: parse cookie → apply tenant privacy settings ceiling.
    // When either analytics or personalization consent is absent, skip the
    // event entirely.
    //
    // HTTP 200 (not 204) is used intentionally:
    //   • HTTP spec forbids a body on 204 — some clients strip it silently.
    //   • The client reads `body.suppressed === true` to distinguish this
    //     response from a genuine write confirmation (which carries eventId).
    //   • Using 200 keeps the client's `res.ok` branch simple and reliable.
    //
    // Tenant settings are loaded lazily below — use a lightweight cookie-only
    // read here, tenant ceiling is applied again around journey recording.
    const consent = resolveConsent(cookieHeader);
    if (!isConsentGranted(consent, "analytics") || !isConsentGranted(consent, "personalization")) {
      return NextResponse.json(
        { ok: true, suppressed: true, reason: "consent_denied" },
        { status: 200 },
      );
    }

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

    // ── Journey event recording (awaited) ────────────────────────────────────
    //
    // Mirror the event into visitor_journey_events for behavioral scoring.
    // Awaited so the event row exists in the DB before the 201 response is
    // returned — this eliminates the race condition where the debug panel
    // reads the journey table before the write has landed.
    //
    // Gated on personalization consent: journey tracking requires the visitor
    // to have consented to behavioral profiling.  We already know analytics
    // consent is granted (checked above), so only check personalization here.
    //
    // Note: updateBehaviorState() (called inside recordJourneyEvent) is still
    // fire-and-forget, so the pre-computed state table lags by one event cycle.
    // The debug panel compensates by merging window.__journey local events for
    // immediate display.
    if (JOURNEY_EVENT_TYPES.has(validation.value.eventType) && isConsentGranted(consent, "personalization")) {
      const payload = (validation.value.payload ?? {}) as Record<string, unknown>;
      await recordJourneyEvent({
        // Client-generated dedup UUID (null = DB auto-generates via DEFAULT).
        // When provided, the insert uses ON CONFLICT DO NOTHING so retried
        // events that already landed are silently ignored.
        eventId:      validation.value.eventId ?? null,
        tenantId:     validation.value.tenantId ?? "unknown",
        sessionId:    sessionId,
        eventType:    validation.value.eventType as JourneyEventType,
        eventValue:   typeof payload["page_path"] === "string" ? payload["page_path"]
                    : typeof payload["element_id"] === "string" ? payload["element_id"]
                    : null,
        pagePath:     typeof payload["page_path"] === "string" ? payload["page_path"] : null,
        pageCategory: typeof payload["page_category"] === "string" ? payload["page_category"] : null,
        pageKeywords: Array.isArray(payload["page_keywords"])
          ? (payload["page_keywords"] as string[])
          : [],
        source:   typeof payload["utm_source"] === "string" ? payload["utm_source"] : null,
        medium:   typeof payload["utm_medium"] === "string" ? payload["utm_medium"] : null,
        campaign: typeof payload["utm_campaign"] === "string" ? payload["utm_campaign"] : null,
        metadata: payload,
        // Client-provided occurrence timestamp (actual event time, not server
        // receive time).  Null = fall back to server now() in recordJourneyEvent.
        occurredAt:  validation.value.occurredAt ?? null,
        // Stable visitor UUID from localStorage for cross-session identity linking.
        visitorId:   validation.value.visitorId ?? null,
      }).catch(() => { /* swallow — journey tracking must never break API */ });
    }

    // ── GA4 server-side event forwarding (fire-and-forget) ────────────────────
    //
    // When the active tenant has GA4 tracking configured with sendMode "server",
    // forward the saved event to GA4 via the Measurement Protocol.
    //
    // Gated on analytics consent: we already verified analytics consent above,
    // but check again explicitly to make the gating intent clear.
    //
    // This is intentionally non-blocking — we do not await the result before
    // returning the API response, and failures are only logged (never surfaced
    // to the client).
    if (!isConsentGranted(consent, "analytics")) {
      // Analytics consent was lost between the top check and here (race).
      // Skip GA4 silently.
    } else
    try {
      const tenantConfig   = await getActiveTenant();
      const tenantSettings = await getTenantById(tenantConfig.tenantId);
      const ga4Tracking    = tenantSettings?.ga4?.tracking;

      if (
        ga4Tracking?.enabled === true &&
        ga4Tracking.sendMode === "server" &&
        ga4Tracking.measurementId &&
        ga4Tracking.apiSecret
      ) {
        // Determine the visitor ID property name used for this tenant.
        const visitorIdParamName = ga4Tracking.visitorIdParamName ?? "visitor_id";

        // Strip visitor_id (and the configured visitorIdParamName) from event
        // params before forwarding to GA4.  visitor_id must ONLY appear in
        // user_properties so GA4 records it as User-scoped.  If it also appears
        // in event params, GA4 would record it as an event-scoped dimension value
        // and the customUser:{visitorIdParamName} filter in the Data API (used by
        // the GA4 History enricher) would return no rows.
        const rawParams = (validation.value.payload as Record<string, string | number | boolean> | null) ?? {};
        const filteredParams: Record<string, string | number | boolean> = {};
        for (const [k, v] of Object.entries(rawParams)) {
          if (k === "visitor_id" || k === visitorIdParamName) continue;
          filteredParams[k] = v;
        }

        // Debug: log what visitor_id is being sent to GA4 so operators can
        // confirm the value matches what the GA4 History enricher queries.
        logger.debug("[api/events] GA4 MP send", {
          eventType:         validation.value.eventType,
          visitorId:         sessionId,
          visitorIdParamName,
          strippedParamKeys: Object.keys(rawParams).filter(
            (k) => k === "visitor_id" || k === visitorIdParamName,
          ),
        });

        // Fire-and-forget — do not await.
        // Include userId + userIdPropertyName so the MP hit carries the same
        // customUser:{visitorIdParamName} dimension as client-side gtag events.
        // This ensures GA4 History lookups can find server-sent events too.
        void sendGa4MpEvent(
          {
            measurementId:      ga4Tracking.measurementId,
            apiSecret:          ga4Tracking.apiSecret,
            userId:             sessionId,
            userIdPropertyName: visitorIdParamName,
          },
          sessionId,
          {
            name:   validation.value.eventType,
            params: filteredParams,
          },
        ).catch((err: unknown) => {
          logger.warn("[api/events] GA4 MP fire-and-forget failed", {
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }
    } catch (ga4Err) {
      // Non-fatal — log and continue.
      logger.warn("[api/events] Failed to resolve tenant GA4 config for server send", {
        error: ga4Err instanceof Error ? ga4Err.message : String(ga4Err),
      });
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
        sameSite: cookie.sameSite?.toLowerCase() as "lax" | "strict" | "none" | undefined,
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
