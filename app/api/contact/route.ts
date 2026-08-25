/**
 * POST /api/contact
 *
 * Contact form submission endpoint.
 *
 * Receives the visitor's message, enriches it with all four signal layers
 * the platform has already collected for their session, and dispatches the
 * complete context-aware payload to n8n for downstream CRM routing,
 * follow-up email sequencing, and sales handoff.
 *
 * ─── Request format ──────────────────────────────────────────────────────────
 *
 *   POST /api/contact
 *   Content-Type: application/json
 *
 *   {
 *     "name":     "Jasper Mulders",
 *     "email":    "jasper@example.com",
 *     "message":  "I'd love to see a demo.",
 *     "pathname": "/"
 *   }
 *
 * ─── Response format ─────────────────────────────────────────────────────────
 *
 *   200  { "ok": true }
 *          Form was received and dispatched to n8n (or n8n is unconfigured).
 *
 *   400  { "error": "..." }
 *          Missing or malformed required field. Client should show validation error.
 *
 *   500  { "error": "..." }
 *          n8n webhook call failed after receiving a valid submission.
 *          The submission was still captured in server logs.
 *
 * ─── Enrichment pipeline ─────────────────────────────────────────────────────
 *
 *   1. Resolve session ID from the mc_session_id cookie (set by middleware).
 *   2. Detect visitor context from request headers (source, UTMs, device).
 *   3. In parallel: fetch visitor history + last served variant from DB.
 *   4. Build the enriched N8nContactPayload via buildContactContextPayload().
 *   5. POST to N8N_CONTACT_WEBHOOK_URL via sendToN8n().
 *
 * ─── Why visitor context is re-resolved here ─────────────────────────────────
 *
 *   The contact form submission is a separate HTTP request from the page render.
 *   The context (UTMs, referrer) must be re-resolved from the submitted request
 *   headers rather than being passed as form data, because:
 *     a) It avoids the client spoofing attribution data.
 *     b) History data (pageViewCount, lastServedVariant) is loaded from the DB
 *        using the session cookie — a more authoritative source than client state.
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   - Input validation: name, email, message are required non-empty strings.
 *     Email format is validated with a lightweight pattern (not a library)
 *     since the full RFC-5321 set is beyond scope for this endpoint.
 *   - The webhook URL is server-only (never exposed to the client).
 *   - The session cookie is httpOnly — the client cannot forge a sessionId.
 *   - No PII beyond what the visitor typed is written to the server logs.
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { detectVisitorContext } from "@/context";
import { fetchVisitorHistory } from "@/context/fetch-visitor-history";
import { resolveSession } from "@/data/session";
import { getServedVariantsBySession } from "@/data/repositories/variants-repository";
import { saveEvent } from "@/data/repositories/events-repository";
import {
  buildContactContextPayload,
  sendToN8n,
} from "@/contact/build-contact-context-payload";
import type { ContactFormFields } from "@/contact/types";
import { logger } from "@/lib/logger";
import { getActiveTenant } from "@/tenant/server";
import { getFormDefinition } from "@/forms";
import {
  dispatchBackofficeNotification,
  dispatchSubmitterConfirmation,
} from "@/forms/email";
import { resolveEmailConfig, resolveFormsConfig } from "@/lib/config";
import { loadTenantFormOverrides } from "@/forms/load-tenant-form-overrides";
import { storeSubmission }         from "@/forms/storage";
import { reportInboundConversion } from "@/lib/lead-base/report-inbound-conversion";

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Step 1: Parse and validate the request body ──────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const validation = validateContactBody(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { formFields, pathname } = validation;

  // ── Step 2: Resolve session from the cookie ───────────────────────────────
  const h = await headers();
  const cookieHeader = h.get("cookie");
  const { sessionId } = resolveSession(cookieHeader);

  // ── Step 3: Re-resolve visitor context from the submission request ────────
  // Build a synthetic Request so detectVisitorContext() can read headers.
  const syntheticRequest = new Request(
    `http://localhost${pathname}`,
    {
      headers: new Headers({
        "user-agent": request.headers.get("user-agent") ?? "",
        referer: request.headers.get("referer") ?? "",
        cookie: cookieHeader ?? "",
      }),
    },
  );
  const context = detectVisitorContext(syntheticRequest);

  // ── Step 4: Resolve tenant, then fetch history + last served variant ──────
  // getActiveTenant() is a fast registry + header lookup (no DB).
  // Once we have the tenantId, history, variants, and email/form config are
  // all fetched concurrently so the critical-path latency is minimised.
  const activeTenant = await getActiveTenant();
  const tenantId = activeTenant.tenantId;

  const [
    scopedHistory,
    variantsResult,
    emailResolution,
    formsResolution,
    formOverride,
  ] = await Promise.all([
    fetchVisitorHistory(sessionId, tenantId),
    getServedVariantsBySession(sessionId, 1),
    resolveEmailConfig(tenantId),
    resolveFormsConfig(tenantId),
    loadTenantFormOverrides(tenantId, "contact"),
  ]);

  const lastServedVariant =
    variantsResult.ok && variantsResult.data.length > 0
      ? variantsResult.data[0]!
      : null;

  // ── Step 5: Build the enriched payload ───────────────────────────────────
  const payload = buildContactContextPayload({
    formFields,
    pathname,
    context,
    history: scopedHistory,
    lastServedVariant,
    sessionId,
  });

  logger.info("[contact] Processing form submission", {
    sessionId,
    email: formFields.email,
    source: payload.campaign.source,
    pageViewCount: payload.session.pageViewCount,
    hasClickedCta: payload.session.hasClickedCta,
    servedCtaKey: payload.servedExperience?.ctaKey ?? null,
  });

  // ── Step 6: Dispatch to n8n ───────────────────────────────────────────────
  const dispatchResult = await sendToN8n(payload);

  // ── Step 6a: Dispatch emails via the registered forms pipeline ────────────
  //
  //   The contact form now uses the same email infrastructure as every other
  //   registered form: tenant / platform transport config, per-form overrides,
  //   and the four-layer recipient resolution chain.
  //
  //   Emails fire regardless of n8n dispatch success — the visitor's confirmation
  //   and the backoffice notification should always go out when validation passes.
  //   All failures are logged but never surfaced to the submitter.
  {
    const contactFormDef = getFormDefinition("contact");

    if (contactFormDef) {
      // Apply the same override resolution as /api/forms/[formKey]/route.ts.
      const isFormOverride     = formOverride.overrideEnabled;
      const tenantFormSettings = formsResolution.config;

      const effectiveNotify   = isFormOverride
        ? formOverride.notifyEnabled
        : contactFormDef.action.notifyBackoffice;

      const effectiveConfirm  = isFormOverride
        ? formOverride.confirmEnabled
        : tenantFormSettings.sendConfirmationEmails;

      const effectiveOverrideRecipients =
        isFormOverride && formOverride.customRecipients.length > 0
          ? formOverride.customRecipients
          : formsResolution.config.effectiveRecipients.length > 0
            ? formsResolution.config.effectiveRecipients
            : undefined;

      // Extract raw transport layers for the existing dispatch functions.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tenantTransport     = emailResolution.layers.tenant   as any ?? null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const platformEmailConfig = emailResolution.layers.platform as any ?? null;

      // The email values mirror the validated form fields.
      const emailValues: Record<string, string> = {
        name:    formFields.name,
        email:   formFields.email,
        message: formFields.message,
      };

      logger.debug("[contact] Email dispatch config", {
        configSource:   isFormOverride ? "form-override" : "tenant",
        notify:         effectiveNotify,
        confirm:        effectiveConfirm,
        recipientCount: effectiveOverrideRecipients?.length ?? 0,
        transport:      emailResolution.source,
      });

      void Promise.allSettled([
        effectiveNotify
          ? dispatchBackofficeNotification({
              formDef:            contactFormDef,
              values:             emailValues,
              overrideRecipients: effectiveOverrideRecipients,
              tenantTransport,
              platformEmailConfig,
            }).then((result) => {
              if (!result.ok) {
                logger.warn("[contact] Backoffice notification failed", { error: result.error });
              }
            })
          : Promise.resolve(),

        (effectiveConfirm && contactFormDef.action.sendConfirmation)
          ? dispatchSubmitterConfirmation({
              formDef:            contactFormDef,
              values:             emailValues,
              tenantTransport,
              platformEmailConfig,
            }).then((result) => {
              if (!result.ok) {
                logger.warn("[contact] Submitter confirmation failed", { error: result.error });
              }
            })
          : Promise.resolve(),
      ]);
    }
  }

  // ── Step 6a2: Persist the submission ──────────────────────────────────────
  //
  //   Without this the submission never reaches the form_submissions table, so
  //   Admin → Content → Forms → Submissions stays empty even though contact
  //   forms are coming in. The lead itself lands in abm_leads via Step 6b — two
  //   different stores with two different jobs (sales follow-up vs. an audit
  //   trail of what was literally submitted).
  //
  //   Precedence mirrors /api/forms/[formKey] exactly:
  //     per-form override (when enabled) → tenant default
  //   so switching storage off for this tenant also switches it off here.
  //
  //   Fail-open, like every other side effect in this route: a storage failure
  //   is logged but never changes the response the submitter sees.
  {
    const shouldStore = formOverride.overrideEnabled
      ? formOverride.storeEnabled
      : formsResolution.config.storeSubmissions;

    if (shouldStore) {
      const companyRaw = (body as Record<string, unknown>).company;
      const stored = await storeSubmission({
        formKey: "contact",
        values: {
          name:    formFields.name,
          email:   formFields.email,
          message: formFields.message,
          ...(typeof companyRaw === "string" && companyRaw.trim() ? { company: companyRaw.trim() } : {}),
        },
        sessionId,
        tenantId,
      });

      if (!stored.ok) {
        logger.warn("[contact] Submission storage failed", { error: stored.error });
      }
    }
  }

  // ── Step 6b: Lead Base capture + ad-platform conversion feedback ──────────
  //
  //   Turn the submission into a named lead (deduped by email) and report the
  //   conversion back to the configured ad platforms (Google/Meta/LinkedIn) so
  //   bidding optimises on real leads. Awaited so the serverless function does
  //   not terminate before the conversion is delivered. Fail-open: a failure
  //   here never changes the response the submitter sees.
  {
    const companyRaw = (body as Record<string, unknown>).company;
    await reportInboundConversion({
      tenantId,
      sessionId,
      targetPath: pathname,
      cookieHeader: request.headers.get("cookie"),
      values: {
        name:    formFields.name,
        email:   formFields.email,
        message: formFields.message,
        ...(typeof companyRaw === "string" && companyRaw.trim() ? { company: companyRaw.trim() } : {}),
      },
    });
  }

  // ── Step 7: Write first-party contact_form_submit event (fire-and-forget) ─
  // This captures the submission in the events table so it feeds back into
  // VisitorHistory.hasClickedCta equivalent data for future decision logic.
  // Written regardless of n8n dispatch success so the record is always present.
  void saveEvent({
    sessionId,
    eventType: "contact_form_submit",
    payload: {
      served_cta_key: payload.servedExperience?.ctaKey ?? null,
      source: payload.campaign.source,
      pathname,
      n8n_dispatched: dispatchResult.ok,
    },
  }).then((result) => {
    if (!result.ok) {
      logger.warn("[contact] Failed to write contact_form_submit event", {
        sessionId,
        error: result.error,
      });
    }
  });

  if (!dispatchResult.ok) {
    // Webhook failed — return 500 so the client can show a user-friendly error.
    // The submission details are already logged in sendToN8n().
    return NextResponse.json(
      { error: "Unable to process your submission right now. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

// ── Input validation ──────────────────────────────────────────────────────────

type ValidationSuccess = {
  ok: true;
  formFields: ContactFormFields;
  pathname: string;
};

type ValidationFailure = { ok: false; error: string };
type ValidationResult = ValidationSuccess | ValidationFailure;

/**
 * Validates and sanitises the raw JSON body from the contact form submission.
 *
 * Returns typed, trimmed fields on success or a human-readable error message
 * on failure. Keeps the validation rules simple and focused — this is not a
 * full-blown form validation library.
 */
function validateContactBody(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const raw = body as Record<string, unknown>;

  // Required string fields — trim whitespace, reject empty after trimming
  const nameRaw = typeof raw.name === "string" ? raw.name.trim() : "";
  const emailRaw = typeof raw.email === "string" ? raw.email.trim() : "";
  const messageRaw = typeof raw.message === "string" ? raw.message.trim() : "";
  const pathnameRaw =
    typeof raw.pathname === "string" ? raw.pathname.trim() : "/";

  const missing: string[] = [];
  if (!nameRaw) missing.push("name");
  if (!emailRaw) missing.push("email");
  if (!messageRaw) missing.push("message");

  if (missing.length > 0) {
    return {
      ok: false,
      error: `Missing required field${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`,
    };
  }

  // Lightweight email format check — at minimum: something@something.something
  if (!isPlausibleEmail(emailRaw)) {
    return {
      ok: false,
      error: "Please provide a valid email address.",
    };
  }

  // Reasonable length limits to prevent abuse
  if (nameRaw.length > 200) {
    return { ok: false, error: "Name must be 200 characters or fewer." };
  }

  if (messageRaw.length > 5000) {
    return { ok: false, error: "Message must be 5000 characters or fewer." };
  }

  return {
    ok: true,
    formFields: { name: nameRaw, email: emailRaw, message: messageRaw },
    pathname: pathnameRaw || "/",
  };
}

/**
 * Minimal email plausibility check.
 *
 * Intentionally lenient — rejects obviously broken formats while accepting
 * any real email address a user might enter. Full RFC-5321 validation is
 * best done by attempting delivery, not a regex.
 */
function isPlausibleEmail(value: string): boolean {
  const atIndex = value.indexOf("@");
  if (atIndex <= 0) return false;
  const domain = value.slice(atIndex + 1);
  return domain.includes(".") && domain.length >= 3;
}
