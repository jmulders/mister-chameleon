/**
 * POST /api/forms/[formKey]
 *
 * Platform-owned form submission endpoint.
 *
 * Accepts a JSON body of { [fieldKey]: string } submitted by the
 * FormSectionBlock client component, validates it against the platform-side
 * FormDefinition, and (when valid) runs the configured post-submission actions:
 * optional storage, optional backoffice notification, optional submitter
 * confirmation.
 *
 * ─── Architecture position ───────────────────────────────────────────────────
 *
 *   FormSectionBlock (client) — collects FormData, POSTs JSON to this route
 *        ↓  POST /api/forms/[formKey]
 *   this route                — validates, dispatches actions
 *        ↓
 *   validateSubmission()      — checks rules from FormDefinition
 *   storeSubmission()         — writes to form_submissions table (when enabled)
 *   dispatchBackofficeNotification()   — email via Resend (when enabled)
 *   dispatchSubmitterConfirmation()    — email via Resend (when enabled)
 *
 * ─── Request / response contract ─────────────────────────────────────────────
 *
 *   Request
 *     Method:       POST
 *     Content-Type: application/json
 *     Body:         { [fieldKey: string]: string }
 *
 *   Success response  200
 *     { ok: true, message: string }
 *
 *   Validation error  422
 *     { ok: false, errors: Record<string, string> }
 *
 *   Unknown form key  404
 *     { ok: false, error: "Form not found" }
 *
 *   Malformed body    400
 *     { ok: false, error: "Invalid request body" }
 *
 * ─── Session linkage ──────────────────────────────────────────────────────────
 *
 *   The handler reads the mc_session_id cookie from the incoming request
 *   (set by middleware) and attaches it to the stored submission row.
 *   This links each submission to the visitor's analytics session.
 *   Submissions without a session (direct API calls, etc.) store session_id = null.
 *
 * ─── Failure safety ───────────────────────────────────────────────────────────
 *
 *   Storage, email dispatch, and webhook calls run inside Promise.allSettled()
 *   so one failing action cannot block the others.  Settled rejections are
 *   logged but do NOT change the HTTP response — the submitter always sees
 *   success once validation passes.
 *
 * ─── Spam protection ──────────────────────────────────────────────────────────
 *
 *   Not yet implemented.  Add a honeypot check, rate-limit guard, or Turnstile
 *   verification in the marked section below in a future step without changing
 *   any other part of this handler.
 */

import { NextRequest, NextResponse }   from "next/server";
import { headers }                      from "next/headers";
import { getFormDefinition, isFormKey } from "@/forms";
import { validateSubmission }           from "@/forms/validation";
import {
  dispatchBackofficeNotification,
  dispatchSubmitterConfirmation,
}                                       from "@/forms/email";
import { storeSubmission }              from "@/forms/storage";
import {
  checkHoneypot,
  checkRateLimit,
  resolveClientIp,
}                                       from "@/forms/spam";
import { resolveSession }               from "@/data/session";
import { logger }                       from "@/lib/logger";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RouteParams {
  params: Promise<{ formKey: string }>;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const { formKey } = await params;

  // ── 1. Resolve form definition ────────────────────────────────────────────
  if (!isFormKey(formKey)) {
    return NextResponse.json(
      { ok: false, error: "Form not found" },
      { status: 404 },
    );
  }

  const formDef = getFormDefinition(formKey);
  if (!formDef) {
    // Registered as a FormKey but missing from the registry — defensive guard.
    return NextResponse.json(
      { ok: false, error: "Form not found" },
      { status: 404 },
    );
  }

  // ── 2. Parse request body ─────────────────────────────────────────────────
  let body: Record<string, string>;
  try {
    const raw = await request.json() as unknown;
    if (!isStringRecord(raw)) {
      return NextResponse.json(
        { ok: false, error: "Invalid request body" },
        { status: 400 },
      );
    }
    body = raw;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body" },
      { status: 400 },
    );
  }

  // ── 3. Spam protection ───────────────────────────────────────────────────

  // Resolve headers once here; reused for rate limiting and session (step 5).
  const reqHeaders = await headers();

  // 3a. Honeypot check — detect bots that blindly fill every input.
  //     Return a fake success so the bot cannot detect it was blocked.
  if (checkHoneypot(body)) {
    const fakeMessage =
      formDef.action.successMessage ??
      "Thank you — your submission has been received.";
    return NextResponse.json({ ok: true, message: fakeMessage }, { status: 200 });
  }

  // 3b. Rate limit — at most RATE_LIMIT_MAX submissions per (IP × formKey)
  //     per RATE_LIMIT_WINDOW_MS.  Returns 429 with a Retry-After header.
  const clientIp   = resolveClientIp(reqHeaders);
  const rateResult = checkRateLimit(clientIp, formKey);
  if (!rateResult.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many submissions. Please try again later." },
      {
        status:  429,
        headers: { "Retry-After": String(rateResult.retryAfterSeconds) },
      },
    );
  }

  // ── 4. Validate against form definition ──────────────────────────────────
  const validation = validateSubmission(formDef.fields, body);

  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, errors: validation.errors },
      { status: 422 },
    );
  }

  // ── 5. Resolve session from cookie ────────────────────────────────────────
  //
  //   Reads the httpOnly mc_session_id cookie set by middleware.  Used to link
  //   the stored submission to the visitor's analytics session.
  //   Non-fatal: proceeds with sessionId = null when the cookie is absent.
  let sessionId: string | null = null;
  try {
    const resolved = resolveSession(reqHeaders.get("cookie"));
    sessionId = resolved.sessionId;
  } catch {
    // Ignore — submission proceeds without a session link.
  }

  const emailConfig = { formDef, values: validation.values };

  // ── 6. Post-submission actions ────────────────────────────────────────────
  //
  //   All actions run inside Promise.allSettled() — one failure cannot block
  //   the others or change the HTTP response.  Each result is individually
  //   logged when not ok.

  await Promise.allSettled([

    // 6a. Storage ──────────────────────────────────────────────────────────
    formDef.action.storeSubmissions
      ? storeSubmission({
          formKey:   formDef.key,
          values:    validation.values,
          sessionId,
        }).then((result) => {
          if (!result.ok) {
            logger.warn("[forms] Submission storage failed", {
              formKey: formDef.key,
              error:   result.error,
            });
          }
        })
      : Promise.resolve(),

    // 6b. Backoffice notification ───────────────────────────────────────────
    formDef.action.notifyBackoffice
      ? dispatchBackofficeNotification(emailConfig).then((result) => {
          if (!result.ok) {
            logger.warn("[forms] Backoffice notification failed", {
              formKey: formDef.key,
              error:   result.error,
            });
          }
        })
      : Promise.resolve(),

    // 6c. Submitter confirmation ────────────────────────────────────────────
    formDef.action.sendConfirmation
      ? dispatchSubmitterConfirmation(emailConfig).then((result) => {
          if (!result.ok) {
            logger.warn("[forms] Submitter confirmation failed", {
              formKey: formDef.key,
              error:   result.error,
            });
          }
        })
      : Promise.resolve(),

    // 6d. Webhook (Fm5+ TODO) ───────────────────────────────────────────────
    //
    //   const webhookUrl = formDef.action.webhookUrl
    //     ?? process.env.N8N_CONTACT_WEBHOOK_URL;
    //   if (webhookUrl) {
    //     fetch(webhookUrl, {
    //       method: "POST",
    //       headers: { "Content-Type": "application/json" },
    //       body: JSON.stringify({ formKey: formDef.key, values: validation.values }),
    //     }).catch((err) =>
    //       logger.error("[forms] Webhook dispatch failed", { error: String(err) })
    //     );
    //   }

  ]);

  // ── 7. Return success ─────────────────────────────────────────────────────
  const message =
    formDef.action.successMessage ??
    "Thank you — your submission has been received.";

  return NextResponse.json({ ok: true, message }, { status: 200 });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Type guard: returns true when the value is a non-null object whose values
 * are all strings.  Used to validate the parsed JSON body before trusting it
 * as the field-value map.
 */
function isStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every((v) => typeof v === "string");
}
