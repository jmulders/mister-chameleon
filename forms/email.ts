/**
 * Form email dispatch
 *
 * Sends transactional emails for form submissions via the Resend REST API
 * (https://resend.com/docs/api-reference/emails/send-email).  Uses plain
 * `fetch` — no npm package required.
 *
 * ─── Safety model ─────────────────────────────────────────────────────────────
 *
 *   Both dispatch functions NEVER throw and NEVER reject.
 *   Email failures are logged and returned as { ok: false } so the API route
 *   can log them without blocking the success response to the submitter.
 *
 *   When RESEND_API_KEY is absent, sending is silently skipped — this keeps
 *   local dev and unconfigured staging environments functional without any
 *   email configuration.
 *
 * ─── Address resolution priority ─────────────────────────────────────────────
 *
 *   Backoffice "to":
 *     1. FormEmailRouting.backoffice.to[]     (definition-level override)
 *     2. BACKOFFICE_EMAIL env var             (platform default)
 *     → no recipient → skip with warning
 *
 *   "from" (both directions):
 *     1. FormEmailRouting.[dir].from          (definition-level override)
 *     2. MAIL_FROM_ADDRESS env var            (platform default)
 *     3. "noreply@example.com"               (hard fallback for unconfigured envs)
 *
 *   Confirmation "to":
 *     — always derived from submission[emailField]; never static
 *
 * ─── Email format ─────────────────────────────────────────────────────────────
 *
 *   Both emails are sent as plain text in Fm4.
 *   An HTML template layer can be plugged in by replacing the `text` field
 *   with `html` in the Resend payload — the surrounding logic stays the same.
 *
 * ─── Switching providers ──────────────────────────────────────────────────────
 *
 *   Resend is the only provider in Fm4.  To swap to Postmark, SendGrid, etc:
 *   1. Replace `callResend()` with a provider-specific function.
 *   2. No other code changes — the dispatch functions above it don't change.
 *
 * ─── Module structure ─────────────────────────────────────────────────────────
 *
 *   EmailDispatchConfig                 — input shape for both dispatch functions
 *   EmailDispatchResult                 — typed result (ok | error)
 *   dispatchBackofficeNotification()    — internal team notification
 *   dispatchSubmitterConfirmation()     — submitter acknowledgement
 *   callResend() (internal)             — REST call to the Resend API
 */

import "server-only";

import type { FormDefinition } from "@/forms/types";
import { interpolateTemplate } from "@/forms/validation";
import { serverEnv }           from "@/lib/env";
import { logger }              from "@/lib/logger";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Input shape passed to both email dispatch functions.
 */
export interface EmailDispatchConfig {
  /** The resolved form definition — provides routing config and field structure. */
  readonly formDef: FormDefinition;
  /**
   * Validated, trimmed submission values keyed by field key.
   * Used for template placeholder interpolation (e.g. `{{name}}`, `{{email}}`).
   */
  readonly values:  Record<string, string>;
}

/**
 * Result of an email dispatch attempt.
 * Never throws — callers check ok rather than catching.
 */
export type EmailDispatchResult =
  | { ok: true }
  | { ok: false; error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Internal: address resolution helpers
// ─────────────────────────────────────────────────────────────────────────────

function resolveFromAddress(override?: string): string {
  return (
    override ??
    serverEnv.email.fromAddress ??
    "noreply@example.com"
  );
}

function resolveBackofficeRecipients(to?: readonly string[]): string[] {
  if (to && to.length > 0) return [...to];
  if (serverEnv.email.backofficeEmail) return [serverEnv.email.backofficeEmail];
  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: plain-text body builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a minimal plain-text notification body listing all field values.
 * Used for backoffice notifications when the routing config provides no
 * explicit body template.
 */
function buildSubmissionBody(
  formDef: FormDefinition,
  values:  Record<string, string>,
): string {
  const lines: string[] = [
    `New ${formDef.title} submission`,
    `Submitted at: ${new Date().toUTCString()}`,
    "",
  ];
  for (const field of formDef.fields) {
    if (field.type === "hidden") continue;
    const value = values[field.key] ?? "(empty)";
    lines.push(`${field.label}: ${value}`);
  }
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: Resend REST API caller
// ─────────────────────────────────────────────────────────────────────────────

interface ResendPayload {
  from:      string;
  to:        string[];
  reply_to?: string;
  subject:   string;
  text:      string;
}

/**
 * Posts an email payload to the Resend REST API.
 *
 * Returns { ok: true } on HTTP 200/201, or { ok: false, error } for any
 * non-2xx response or network failure.  Never throws.
 *
 * When RESEND_API_KEY is absent, returns { ok: true } immediately (skip, not fail).
 */
async function callResend(payload: ResendPayload): Promise<EmailDispatchResult> {
  const apiKey = serverEnv.email.resendApiKey;

  if (!apiKey) {
    // No API key — skip silently.  Log in dev so the developer knows what
    // would have been sent; suppress in production to avoid log noise.
    if (process.env.NODE_ENV === "development") {
      logger.info("[forms/email] RESEND_API_KEY not set — email skipped (dev)", {
        to:      payload.to,
        subject: payload.subject,
        preview: payload.text.slice(0, 120),
      });
    }
    return { ok: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      return { ok: true };
    }

    // Non-2xx — parse the error body for a useful message.
    let errorMessage = `HTTP ${res.status}`;
    try {
      const body = await res.json() as { message?: string; name?: string };
      if (body.message) {
        errorMessage = `${body.name ?? "Resend error"}: ${body.message}`;
      }
    } catch {
      // Response body not JSON — fall through to the HTTP status message.
    }

    logger.error("[forms/email] Resend API error", {
      status:  res.status,
      error:   errorMessage,
      to:      payload.to,
      subject: payload.subject,
    });
    return { ok: false, error: errorMessage };

  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    logger.error("[forms/email] Resend fetch failed", { error: message });
    return { ok: false, error: message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: backoffice notification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends the internal backoffice notification email for a form submission.
 *
 * Called by the /api/forms/[formKey] handler when
 * formDef.action.notifyBackoffice is true.
 *
 * Resolves recipient addresses, interpolates the subject template, builds a
 * plain-text body from submission values, and sends via Resend.
 *
 * No-op (with a logged warning) when:
 *   - emailRouting.backoffice is not configured on the form definition
 *   - No recipient address can be resolved
 *   - RESEND_API_KEY is absent (silently skipped — not an error)
 *
 * @returns { ok: true } on success or unconfigured skip;
 *          { ok: false, error } when a send attempt fails.
 */
export async function dispatchBackofficeNotification(
  config: EmailDispatchConfig,
): Promise<EmailDispatchResult> {
  const { formDef, values } = config;
  const routing = formDef.emailRouting?.backoffice;

  if (!routing) {
    if (process.env.NODE_ENV !== "production") {
      logger.warn(
        `[forms/email] notifyBackoffice=true on "${formDef.key}" ` +
        `but no emailRouting.backoffice configured — skipping notification.`,
      );
    }
    return { ok: true };
  }

  const to = resolveBackofficeRecipients(routing.to);
  if (to.length === 0) {
    logger.warn(
      "[forms/email] No backoffice recipient resolved — notification skipped. " +
      "Set BACKOFFICE_EMAIL env var or add `to` to FormEmailRouting.backoffice.",
      { formKey: formDef.key },
    );
    return { ok: true };
  }

  const from    = resolveFromAddress(routing.from);
  const subject = interpolateTemplate(routing.subject, values);
  const replyTo = routing.replyToField ? values[routing.replyToField] : undefined;
  const text    = buildSubmissionBody(formDef, values);

  return callResend({
    from,
    to,
    ...(replyTo ? { reply_to: replyTo } : {}),
    subject,
    text,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: submitter confirmation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends the submitter acknowledgement email after a successful form submission.
 *
 * Called by the /api/forms/[formKey] handler when
 * formDef.action.sendConfirmation is true.
 *
 * Resolves the recipient from the submission field named by
 * emailRouting.confirmation.emailField, interpolates the subject and body
 * templates, and sends via Resend.
 *
 * No-op (with a logged warning) when:
 *   - emailRouting.confirmation is not configured
 *   - The emailField value is absent or empty in the submission
 *   - RESEND_API_KEY is absent (silently skipped — not an error)
 *
 * @returns { ok: true } on success or unconfigured skip;
 *          { ok: false, error } when a send attempt fails.
 */
export async function dispatchSubmitterConfirmation(
  config: EmailDispatchConfig,
): Promise<EmailDispatchResult> {
  const { formDef, values } = config;
  const routing = formDef.emailRouting?.confirmation;

  if (!routing) {
    if (process.env.NODE_ENV !== "production") {
      logger.warn(
        `[forms/email] sendConfirmation=true on "${formDef.key}" ` +
        `but no emailRouting.confirmation configured — skipping confirmation.`,
      );
    }
    return { ok: true };
  }

  const to = values[routing.emailField];
  if (!to) {
    logger.warn("[forms/email] dispatchSubmitterConfirmation: emailField not in values", {
      formKey:    formDef.key,
      emailField: routing.emailField,
    });
    return { ok: true };
  }

  const from    = resolveFromAddress(routing.from);
  const subject = interpolateTemplate(routing.subject, values);
  const text    = routing.body
    ? interpolateTemplate(routing.body, values)
    : `Thank you for your submission.\n\nWe will be in touch shortly.`;

  return callResend({ from, to: [to], subject, text });
}
