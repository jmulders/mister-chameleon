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
  verifyTurnstile,
}                                       from "@/forms/spam";
import { getDb }                        from "@/data/db";
import { decryptSecret }                from "@/lib/email-crypto";
import { resolveSession }               from "@/data/session";
import { logger }                       from "@/lib/logger";
import { markProfileConverted }         from "@/lib/lead-base/visitor-profiles-store";
import { captureInboundLead, extractSubmittedEmail } from "@/lib/lead-base/inbound-capture";
import { sendConversion }                from "@/lib/ad-sync/conversion-engine";
import { sendAdaptiveEmail }             from "@/lib/email/send-adaptive-email";
import { EMAIL_TEMPLATE_KEYS, type EmailTemplateKey } from "@/lib/email/adaptive-email";
import { getAdaptiveBlockByKey }         from "@/lib/adaptive-blocks/adaptive-blocks-store";
import { getActiveTenant, getTenantBySiteKey } from "@/tenant/server";
import { isSnippetOriginAllowed }       from "@/lib/snippet/origin-allowlist";
import { fetchCMSFormByName, toPlatformFields } from "@/forms/cms-form";
import { serverEnv }                    from "@/lib/env";
import {
  resolveEmailConfig,
  resolveFormsConfig,
}                                       from "@/lib/config";
import { loadTenantFormOverrides }      from "@/forms/load-tenant-form-overrides";
import { resolveContextualForm }         from "@/forms/context/load";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RouteParams {
  params: Promise<{ formKey: string }>;
}

// ── CORS (cross-origin embeds submit from external customer sites) ─────────────

const FORM_CORS: Record<string, string> = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-mc-site-key",
  "Access-Control-Max-Age":       "86400",
};

export function OPTIONS(): NextResponse {
  return new NextResponse(null, { status: 204, headers: FORM_CORS });
}

// ── Handler ───────────────────────────────────────────────────────────────────

/**
 * Public entry point. Runs the handler, then stamps CORS headers on whatever it
 * returns so cross-origin form submits (snippet/WP/Statamic) can read the
 * response (success message, 422 field errors, redirect). Same-origin callers
 * ignore the headers.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteParams,
): Promise<NextResponse> {
  let res: NextResponse;
  try {
    res = await handlePost(request, ctx);
  } catch (err) {
    logger.error("[forms] Unhandled error", { err: err instanceof Error ? err.message : String(err) });
    res = NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
  for (const [k, v] of Object.entries(FORM_CORS)) res.headers.set(k, v);
  return res;
}

async function handlePost(
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
  //
  //   Cross-origin embeds (snippet / WP plugin / Statamic add-on) identify the
  //   tenant by a `x-mc-site-key` header, since the request hits the platform
  //   host and cannot be scoped by domain. When a siteKey resolves a tenant, we
  //   enforce that tenant's snippet origin allowlist (opt-in). Same-origin,
  //   platform-rendered forms send no siteKey and fall back to host resolution.
  let tenantId: string | undefined;
  const siteKey = request.headers.get("x-mc-site-key")?.trim();
  if (siteKey) {
    const skTenant = await getTenantBySiteKey(siteKey).catch(() => null);
    if (skTenant) {
      if (!isSnippetOriginAllowed(
            request.headers.get("origin"),
            request.headers.get("referer"),
            skTenant.snippet?.allowedSnippetOrigins,
          )) {
        return NextResponse.json({ ok: false, error: "Origin not allowed" }, { status: 403 });
      }
      tenantId = skTenant.tenantId;
    }
  } else {
    try {
      const tenant = await getActiveTenant();
      tenantId = tenant.tenantId;
    } catch {
      // Non-fatal: proceed without tenant scoping.
    }
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

  // 3b-bis. Cloudflare Turnstile (CAPTCHA) — enforced when the per-form
  //   `turnstileEnabled` flag is on (honoured independently of the master
  //   override). Fails OPEN when the tenant has no secret configured (the toggle
  //   is a no-op without keys); rejects when the token is missing or invalid.
  if (formOverride.turnstileEnabled) {
    const secret = await loadTurnstileSecret(tenantId);
    if (secret) {
      const passed = await verifyTurnstile(body["cf-turnstile-response"] ?? "", secret, clientIp);
      if (!passed) {
        return NextResponse.json(
          { ok: false, error: "Captcha verification failed. Please try again." },
          { status: 403 },
        );
      }
    }
  }

  // ── 3c. Contextual overlay (rules → segment → field set / thank-you) ──────
  //
  //   Re-resolve the same segment the render used, from the referer URL
  //   (path + query) and the geo header, so validation runs against the
  //   segment's field set (contextual forms can add/drop fields) and the
  //   success message matches. Platform forms only; falls back to the base
  //   definition fields on any error.
  let effectiveFields = fieldsForValidation;
  let contextualSuccess: string | undefined;
  if (formDef) {
    try {
      const ref = reqHeaders.get("referer");
      const refUrl = ref ? new URL(ref) : null;
      const ctxQuery: Record<string, string> = {};
      refUrl?.searchParams.forEach((v, k) => { ctxQuery[k.toLowerCase()] = v; });
      const country =
        reqHeaders.get("x-vercel-ip-country") || reqHeaders.get("cf-ipcountry") || null;
      const resolved = await resolveContextualForm(tenantId, formKey, {
        path:  refUrl?.pathname,
        query: ctxQuery,
        country,
      });
      if (resolved) {
        effectiveFields  = resolved.fields;
        contextualSuccess = resolved.successMessage;
      }
    } catch {
      /* keep base fields */
    }
  }

  // ── 4. Validate against the (possibly segment-specific) field set ─────────
  const validation = validateSubmission(effectiveFields, body);

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

  // The page the form was submitted from — stored as the lead's target path.
  let submissionPath = "/";
  try {
    const ref = reqHeaders.get("referer");
    if (ref) submissionPath = new URL(ref).pathname || "/";
  } catch {
    // Ignore — fall back to "/".
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
          pathname:  submissionPath,
        }).then((result) => {
          if (!result.ok) {
            logger.warn("[forms] Submission storage failed", {
              formKey: effectiveKey,
              error:   result.error,
            });
          }
        })
      : Promise.resolve(),

    // 6a-bis. Personalization performance — mark the visitor's profile as
    // converted (form submission = conversion), linked by mc_session_id. Fail-open.
    (tenantId && sessionId)
      ? markProfileConverted(tenantId, sessionId)
      : Promise.resolve(),

    // 6a-ter. Inbound lead capture — a submitted email becomes a named lead in the
    // Lead Base (deduped by email) and the visitor profile is upgraded to "known".
    // Voluntary first-party contact, so not consent-gated. Fail-open.
    tenantId
      ? captureInboundLead({
          tenantId,
          visitorKey: sessionId,
          values:     validation.values,
          targetPath: submissionPath,
        })
      : Promise.resolve(),

    // 6a-quater. Conversion feedback — report the form-submit conversion back to
    // the configured ad platforms (Google/Meta/LinkedIn) so bidding optimizes on
    // real leads. No-op unless conversion feedback is configured + enabled.
    (tenantId && (() => {
      const email = extractSubmittedEmail(validation.values);
      return email ? sendConversion(tenantId, { email, eventName: "Lead" }, "conversion") : null;
    })()) || Promise.resolve(),

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
        ? (async () => {
            const staticSend = () => dispatchSubmitterConfirmation({
              formDef, values: validation.values, tenantTransport, platformEmailConfig,
            });
            // Adaptive confirmation: when the form type maps to an adaptive email
            // template (contact -> contact_followup, etc.) AND the tenant has
            // authored variants for it, send the confirmation through the adaptive
            // pipeline so a rule can pick a subject/variant per recipient. This is
            // opt-in by authoring variants; otherwise the static template is used.
            const templateKey = `${formDef.key}_followup`;
            let result: { ok: boolean; error?: string } = { ok: true };
            if (tenantId && (EMAIL_TEMPLATE_KEYS as readonly string[]).includes(templateKey)) {
              const [block, submitterEmail] = [
                await getAdaptiveBlockByKey(`email:${templateKey}`, tenantId).catch(() => null),
                extractSubmittedEmail(validation.values),
              ];
              if (block?.adaptiveVariants?.length && submitterEmail) {
                const res = await sendAdaptiveEmail({
                  tenantId, recipient: { email: submitterEmail }, templateKey: templateKey as EmailTemplateKey,
                });
                result = res.ok ? { ok: true } : await staticSend();
              } else {
                result = await staticSend();
              }
            } else {
              result = await staticSend();
            }
            if (!result.ok) logger.warn("[forms] Confirmation failed", { formKey: effectiveKey, error: result.error });
          })()
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
    contextualSuccess ??
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

/**
 * Read + decrypt the tenant's Turnstile secret key from tenant_form_settings.
 * Returns null when the tenant is unknown, no secret is configured, or on error
 * (callers then fail-open for the Turnstile step). SERVER ONLY.
 */
async function loadTurnstileSecret(tenantId: string | undefined): Promise<string | null> {
  if (!tenantId) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = (await (getDb() as any)
      .from("tenant_form_settings")
      .select("settings")
      .eq("tenant_id", tenantId)
      .maybeSingle()) as { data: { settings: Record<string, unknown> } | null };
    const stored = res.data?.settings?.turnstileSecretKey;
    if (typeof stored !== "string" || stored === "") return null;
    return decryptSecret(stored);
  } catch {
    return null;
  }
}
