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
import { buildSystemVars }              from "@/forms/validation";
import {
  dispatchBackofficeNotification,
  dispatchSubmitterConfirmation,
  dispatchCMSEmailActions,
}                                       from "@/forms/email";
import { storeSubmission }              from "@/forms/storage";
import {
  checkHoneypot,
  checkRateLimit,
  resolveClientIp,
}                                       from "@/forms/spam";
import { resolveSession }               from "@/data/session";
import { logger }                       from "@/lib/logger";
import { getActiveTenant }              from "@/tenant/server";
import { fetchCMSFormByName, toPlatformFields } from "@/forms/cms-form";
import { serverEnv }                    from "@/lib/env";
import {
  resolveEmailConfig,
  resolveFormsConfig,
}                                       from "@/lib/config";
import { loadTenantFormOverrides }      from "@/forms/load-tenant-form-overrides";

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
  //
  //   Resolution order:
  //     a) Platform-registered FormKey (code registry)
  //     b) CMS-managed formDefinition document (Sanity GROQ lookup)
  //
  //   Tenant context is loaded first so the CMS lookup is properly scoped.

  // ── 1a. Load tenant context ──────────────────────────────────────────────
  let tenantId: string | undefined;
  try {
    const tenant = await getActiveTenant();
    tenantId = tenant.tenantId;
  } catch {
    // Non-fatal: proceed without tenant scoping.
  }

  // ── 1b. Resolve tenant settings + email config via layered resolvers ──────
  //
  //   Both resolvers implement the standard four-layer model:
  //     tenant → platform → env → system
  //
  //   `resolveFormsConfig` surfaces `effectiveRecipients` and `recipientSource`
  //   so the dispatch layer doesn't need to re-implement the fallback chain.
  //
  //   `resolveEmailConfig` surfaces the merged transport config (type, credentials,
  //   fromName/fromEmail) and the primary `source` for diagnostics.
  //
  //   The email dispatch functions still accept the raw layer objects
  //   (TenantEmailTransport / PlatformEmailSettings) — extract them from
  //   `resolution.layers` so no dispatch-layer refactor is required.
  const [emailResolution, formsResolution] = await Promise.all([
    resolveEmailConfig(tenantId ?? ""),
    resolveFormsConfig(tenantId ?? ""),
  ]);

  const tenantFormSettings  = formsResolution.config;

  // ── 1b-ii. Load per-form override (highest-priority config layer) ─────────
  //
  //   Loaded AFTER the form key is known (we need formKey for the DB lookup).
  //   Applied BEFORE the action dispatch in step 6.  When overrideEnabled is
  //   false, this object has no effect and all tenant defaults apply unchanged.
  //
  //   This lookup runs in parallel with the form-def resolution below but is
  //   declared here so it is available throughout the rest of the handler.
  const formOverridePromise = loadTenantFormOverrides(tenantId ?? "", formKey);
  // Extract raw layers for existing dispatch functions that expect the old types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenantTransport     = emailResolution.layers.tenant   as any ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const platformEmailConfig = emailResolution.layers.platform as any ?? null;

  // ── 1c. Try platform registry first ─────────────────────────────────────
  const formDef = isFormKey(formKey) ? getFormDefinition(formKey) : null;

  // ── 1d. Fall back to CMS-managed form definition ─────────────────────────
  const cmsForm = !formDef
    ? await fetchCMSFormByName(formKey, tenantId)
    : null;

  if (!formDef && !cmsForm) {
    return NextResponse.json(
      { ok: false, error: "Form not found" },
      { status: 404 },
    );
  }

  // Await the per-form override now that we know the form exists.
  const formOverride = await formOverridePromise;

  // Derive fields for validation — FormField[] (platform) or converted CMS fields.
  const fieldsForValidation = formDef
    ? formDef.fields
    : toPlatformFields(cmsForm!.fields);

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
      formDef?.action.successMessage ??
      cmsForm?.successMessage ??
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
  const validation = validateSubmission(fieldsForValidation, body);

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

  // ── 6. Derive action flags and dispatch ──────────────────────────────────
  //
  //   All actions run inside Promise.allSettled() — one failure cannot block
  //   the others or change the HTTP response.

  // ── Apply per-form override (highest-priority config layer) ──────────────
  //
  //   Resolution order for each flag (highest → lowest):
  //     form-level override (when overrideEnabled)
  //       → tenant default (tenantFormSettings)
  //       → form definition default (formDef.action.*)
  //
  const isFormOverride = formOverride.overrideEnabled;

  // Effective flags depend on source (platform formDef vs CMS form), then override.
  const shouldStore  = cmsForm
    ? cmsForm.storeSubmissions
    : isFormOverride
      ? formOverride.storeEnabled
      : tenantFormSettings.storeSubmissions;

  const webhookUrl   = tenantFormSettings.webhookUrl ?? formDef?.action.webhookUrl;
  const effectiveKey = formDef?.key ?? cmsForm!.name.current;

  // Per-form recipient override: use form-level custom recipients when set,
  // otherwise fall through to the tenant-level resolved recipients.
  const effectiveOverrideRecipients =
    isFormOverride && formOverride.customRecipients.length > 0
      ? formOverride.customRecipients
      : formsResolution.config.effectiveRecipients.length > 0
        ? formsResolution.config.effectiveRecipients
        : undefined;

  // Per-form notify/confirm flag overrides.
  const effectiveNotify   = isFormOverride
    ? formOverride.notifyEnabled
    : (formDef?.action.notifyBackoffice ?? true);
  const effectiveConfirm  = isFormOverride
    ? formOverride.confirmEnabled
    : tenantFormSettings.sendConfirmationEmails;

  logger.debug("[forms] Resolved config", {
    formKey:        effectiveKey,
    configSource:   isFormOverride ? "form-override" : "tenant",
    notify:         effectiveNotify,
    confirm:        effectiveConfirm,
    store:          shouldStore,
    recipientCount: effectiveOverrideRecipients?.length ?? 0,
    transport:      emailResolution.source,
  });

  // System variables for CMS template interpolation.
  const sysVars = buildSystemVars({
    formName:   effectiveKey,
    tenantName: tenantId ?? "",
  });
  const allTemplateVars = { ...validation.values, ...sysVars };

  // From address for CMS email actions.
  // `emailResolution.config` already merges all layers (tenant → platform → env → system)
  // so we read from it directly instead of re-implementing the fallback chain.
  const { fromName, fromEmail } = emailResolution.config;
  const fromAddress = fromEmail
    ? (fromName?.trim() ? `${fromName} <${fromEmail}>` : fromEmail)
    : serverEnv.email.fromAddress ?? "noreply@example.com";

  await Promise.allSettled([

    // 6a. Storage ─────────────────────────────────────────────────────────
    shouldStore
      ? storeSubmission({
          formKey:   effectiveKey,
          values:    validation.values,
          sessionId,
          tenantId:  tenantId ?? null,
        }).then((result) => {
          if (!result.ok) {
            logger.warn("[forms] Submission storage failed", {
              formKey: effectiveKey,
              error:   result.error,
            });
          }
        })
      : Promise.resolve(),

    // 6b–c. Platform form: backoffice + confirmation ───────────────────────
    ...(formDef ? [
      effectiveNotify
        ? dispatchBackofficeNotification({
            formDef,
            values: validation.values,
            // Use per-form custom recipients when set (form override),
            // otherwise use the tenant → platform → env resolved recipients.
            overrideRecipients: effectiveOverrideRecipients,
            tenantTransport,
            platformEmailConfig,
          }).then((result) => {
            if (!result.ok) logger.warn("[forms] Backoffice notification failed", { formKey: effectiveKey, error: result.error });
          })
        : Promise.resolve(),

      (effectiveConfirm && formDef.action.sendConfirmation)
        ? dispatchSubmitterConfirmation({
            formDef,
            values: validation.values,
            tenantTransport,
            platformEmailConfig,
          }).then((result) => {
            if (!result.ok) logger.warn("[forms] Confirmation failed", { formKey: effectiveKey, error: result.error });
          })
        : Promise.resolve(),
    ] : []),

    // 6d. CMS form: dispatch all CMS-defined email actions ────────────────
    ...(cmsForm?.emailActions?.length
      ? [
          dispatchCMSEmailActions({
            actions:         cmsForm.emailActions,
            allVars:         allTemplateVars,
            fromAddress,
            tenantTransport,
            platformEmailConfig,
          }).then((results) => {
            results.forEach((r, i) => {
              if (!r.ok) {
                logger.warn("[forms] CMS email action failed", {
                  formKey: effectiveKey,
                  index:   i,
                  error:   (r as { ok: false; error: string }).error,
                });
              }
            });
          }),
        ]
      : []),

    // 6e. Webhook ─────────────────────────────────────────────────────────
    webhookUrl
      ? fetch(webhookUrl, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            formKey:  effectiveKey,
            values:   validation.values,
            tenantId: tenantId ?? null,
          }),
        })
          .then(async (res) => {
            if (!res.ok) {
              logger.warn("[forms] Webhook returned non-2xx", {
                formKey: effectiveKey,
                status:  res.status,
                url:     webhookUrl,
              });
            }
          })
          .catch((err: unknown) => {
            logger.error("[forms] Webhook dispatch failed", {
              formKey: effectiveKey,
              error:   String(err),
              url:     webhookUrl,
            });
          })
      : Promise.resolve(),

  ]);

  // ── 7. Return success ─────────────────────────────────────────────────────
  const message =
    tenantFormSettings.successMessage ??
    cmsForm?.successMessage ??
    formDef?.action.successMessage ??
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
