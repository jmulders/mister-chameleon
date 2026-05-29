/**
 * POST /api/client-context
 *
 * Receives browser-collected client signals from the ClientContextCollector
 * component and persists them in the mc_cc cookie so they are available to the
 * server on all subsequent requests within the same session.
 *
 * ─── Why a dedicated endpoint? ────────────────────────────────────────────────
 *
 *   Client signals (viewport, touch capability, colour scheme, etc.) require
 *   browser APIs that are unavailable on the server.  They are collected once
 *   per session by the ClientContextCollector component and sent here.
 *   Setting a httpOnly cookie (vs. document.cookie) keeps the value opaque to
 *   third-party scripts.
 *
 * ─── Cookie set ───────────────────────────────────────────────────────────────
 *
 *   mc_cc — compact URL-encoded JSON.  Max ~200 bytes.
 *           httpOnly so it is inaccessible to client-side JS.
 *           SameSite=Lax, Secure in production.
 *
 * ─── Request body ─────────────────────────────────────────────────────────────
 *
 *   {
 *     isTouchDevice:       boolean | null;
 *     viewportWidth:       number  | null;
 *     viewportHeight:      number  | null;
 *     pixelRatio:          number  | null;
 *     preferredColorScheme: "light" | "dark" | "no-preference" | null;
 *     preferredLanguage:   string  | null;
 *     timeZone:            string  | null;
 *   }
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   - All incoming values are type-checked and sanitised before serialisation.
 *   - No secret or PII data is accepted — only browser capability signals.
 *   - The endpoint accepts CORS from the same origin only (no CORS header set).
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveConsent, isConsentGranted } from "@/lib/consent/server-consent";
import {
  serializeClientSignals,
  parseClientContextCookie,
  CLIENT_CONTEXT_COOKIE,
  CLIENT_CONTEXT_MAX_AGE,
} from "@/context/client-context";
import type { ClientSignals } from "@/context/client-context";

// ── Validation ─────────────────────────────────────────────────────────────────

/**
 * Validate and sanitise the incoming request body into ClientSignals.
 * Returns null on invalid/missing body.
 */
function parseBody(raw: unknown): ClientSignals | null {
  if (typeof raw !== "object" || raw === null) return null;

  const body = raw as Record<string, unknown>;

  // isTouchDevice — boolean or null
  const isTouchDevice =
    typeof body.isTouchDevice === "boolean" ? body.isTouchDevice : null;

  // viewportWidth — positive integer or null (cap at 10 000 px)
  const rawVw = body.viewportWidth;
  const viewportWidth =
    typeof rawVw === "number" && rawVw > 0 && rawVw <= 10_000
      ? Math.round(rawVw)
      : null;

  // viewportHeight — positive integer or null (cap at 10 000 px)
  const rawVh = body.viewportHeight;
  const viewportHeight =
    typeof rawVh === "number" && rawVh > 0 && rawVh <= 10_000
      ? Math.round(rawVh)
      : null;

  // pixelRatio — positive number or null (cap at 6.0 — highest real device value)
  const rawPr = body.pixelRatio;
  const pixelRatio =
    typeof rawPr === "number" && rawPr > 0 && rawPr <= 6
      ? Math.round(rawPr * 100) / 100
      : null;

  // preferredColorScheme — closed enum or null
  const rawCs = body.preferredColorScheme;
  const preferredColorScheme: ClientSignals["preferredColorScheme"] =
    rawCs === "light" || rawCs === "dark" || rawCs === "no-preference"
      ? rawCs
      : null;

  // preferredLanguage — BCP-47 tag, max 32 chars
  const rawLang = body.preferredLanguage;
  const preferredLanguage =
    typeof rawLang === "string" && rawLang.length > 0
      ? rawLang.slice(0, 32)
      : null;

  // timeZone — IANA identifier, max 64 chars
  const rawTz = body.timeZone;
  const timeZone =
    typeof rawTz === "string" && rawTz.length > 0
      ? rawTz.slice(0, 64)
      : null;

  return {
    isTouchDevice,
    viewportWidth,
    viewportHeight,
    pixelRatio,
    preferredColorScheme,
    preferredLanguage,
    timeZone,
  };
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const signals = parseBody(body);

  if (!signals) {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  // ── Consent gate ────────────────────────────────────────────────────────────
  //
  // Client context signals (viewport, timezone, touch capability) are stored to
  // improve personalization — gated on analytics consent.  When consent is
  // absent or denied, acknowledge the request without persisting anything.
  const consent = resolveConsent(request.headers.get("cookie"));
  if (!isConsentGranted(consent, "analytics")) {
    return NextResponse.json({ ok: true, suppressed: true, reason: "consent_denied" }, { status: 204 });
  }

  // ── Merge with any previously persisted signals ────────────────────────────
  //
  // The client sends only the fields it can collect.  We merge with the
  // existing cookie value so that a partial update (e.g. only viewport
  // changed after a resize) doesn't erase other previously-set fields.
  // In practice the collector only fires once per session, but this makes
  // the endpoint idempotent and safe to call multiple times.
  const existingCookieVal = request.cookies.get(CLIENT_CONTEXT_COOKIE)?.value ?? null;
  const existingSignals   = parseClientContextCookie(existingCookieVal);

  const merged: ClientSignals = {
    isTouchDevice:       signals.isTouchDevice       ?? existingSignals.isTouchDevice,
    viewportWidth:       signals.viewportWidth        ?? existingSignals.viewportWidth,
    viewportHeight:      signals.viewportHeight       ?? existingSignals.viewportHeight,
    pixelRatio:          signals.pixelRatio           ?? existingSignals.pixelRatio,
    preferredColorScheme: signals.preferredColorScheme ?? existingSignals.preferredColorScheme,
    preferredLanguage:   signals.preferredLanguage    ?? existingSignals.preferredLanguage,
    timeZone:            signals.timeZone             ?? existingSignals.timeZone,
  };

  const cookieValue = serializeClientSignals(merged);
  const isSecure    = process.env.NODE_ENV === "production";

  const response = NextResponse.json({ ok: true }, { status: 200 });

  response.cookies.set(CLIENT_CONTEXT_COOKIE, cookieValue, {
    maxAge:   CLIENT_CONTEXT_MAX_AGE,
    path:     "/",
    httpOnly: true,
    sameSite: "lax",
    secure:   isSecure,
  });

  return response;
}
