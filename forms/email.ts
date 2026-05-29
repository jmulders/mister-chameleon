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

import type { FormDefinition }  from "@/forms/types";
import type { CMSEmailAction }  from "@/forms/cms-form";
import { interpolateTemplate }  from "@/forms/validation";
import { serverEnv }            from "@/lib/env";
import { logger }               from "@/lib/logger";
import { sendMail, resolveTransportConfig } from "@/forms/mail-transport";
import type { TenantEmailTransport }        from "@/tenant/types";
import type { PlatformEmailSettings }       from "@/platform/platform-store";

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
  /**
   * Optional tenant-level recipient override.
   * When provided, replaces BACKOFFICE_EMAIL and any definition-level `to` list.
   * Set by the form submission handler from TenantFormSettings.notificationRecipients.
   */
  readonly overrideRecipients?: string[];
  /**
   * Optional tenant-level email transport config (loaded from tenant_email_transport).
   * When present, overrides platform-level transport.
   * resolveTransportConfig() handles the full resolution chain.
   */
  readonly tenantTransport?: TenantEmailTransport | null;
  /**
   * Optional platform-level email settings (loaded from platform_settings.email).
   * Used when no per-tenant transport is configured.
   * Falls back to env vars (RESEND_API_KEY / SMTP_HOST) when absent.
   */
  readonly platformEmailConfig?: PlatformEmailSettings | null;
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

function resolveFromAddress(
  override?: string,
  tenantTransport?: TenantEmailTransport | null,
  platformEmailConfig?: PlatformEmailSettings | null,
): string {
  // 1. Definition-level explicit override (highest priority)
  if (override) return override;

  // 2. Tenant DB "from" config
  if (tenantTransport?.fromEmail) {
    const name = tenantTransport.fromName?.trim();
    return name
      ? `${name} <${tenantTransport.fromEmail}>`
      : tenantTransport.fromEmail;
  }

  // 3. Platform DB "from" config
  if (platformEmailConfig?.fromEmail) {
    const name = platformEmailConfig.fromName?.trim();
    return name
      ? `${name} <${platformEmailConfig.fromEmail}>`
      : platformEmailConfig.fromEmail;
  }

  // 4. Platform env var → hard fallback
  return serverEnv.email.fromAddress ?? "noreply@example.com";
}

function resolveBackofficeRecipients(
  to?: readonly string[],
  platformEmailConfig?: PlatformEmailSettings | null,
): string[] {
  // 1. Definition-level explicit "to" list
  if (to && to.length > 0) return [...to];
  // 2. Platform DB backoffice email
  if (platformEmailConfig?.backofficeEmail) return [platformEmailConfig.backofficeEmail];
  // 3. Env var fallback
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
  const { formDef, values, overrideRecipients } = config;
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

  // Tenant-level override takes precedence over the definition-level `to` list
  // and all platform-level fallbacks.
  const to = overrideRecipients && overrideRecipients.length > 0
    ? overrideRecipients
    : resolveBackofficeRecipients(routing.to, config.platformEmailConfig);

  if (to.length === 0) {
    logger.warn(
      "[forms/email] No backoffice recipient resolved — notification skipped. " +
      "Configure BACKOFFICE_EMAIL env var, set a platform backoffice email at " +
      "/admin/platform/integrations/email, add `to` to FormEmailRouting.backoffice, " +
      "or configure notificationRecipients in the tenant form settings.",
      { formKey: formDef.key },
    );
    return { ok: true };
  }

  const from    = resolveFromAddress(routing.from, config.tenantTransport, config.platformEmailConfig);
  const subject = interpolateTemplate(routing.subject, values);
  const replyTo = routing.replyToField ? values[routing.replyToField] : undefined;
  const text    = buildSubmissionBody(formDef, values);

  return sendMail(
    { from, to, ...(replyTo ? { replyTo } : {}), subject, text },
    resolveTransportConfig(config.tenantTransport, config.platformEmailConfig),
  );
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

  const from    = resolveFromAddress(routing.from, config.tenantTransport, config.platformEmailConfig);
  const subject = interpolateTemplate(routing.subject, values);
  const text    = routing.body
    ? interpolateTemplate(routing.body, values)
    : `Thank you for your submission.\n\nWe will be in touch shortly.`;

  return sendMail(
    { from, to: [to], subject, text },
    resolveTransportConfig(config.tenantTransport, config.platformEmailConfig),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: CMS email actions dispatcher
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dispatches all enabled email actions defined in a CMS formDefinition document.
 *
 * Processes `emailAction[]` from the CMS formDefinition and sends each enabled
 * action using `sendMail()` from mail-transport.ts.  Supports the full
 * resolution chain (tenant DB config → SMTP env → Resend env → none).
 *
 * ─── Template variables ────────────────────────────────────────────────────────
 *
 *   `allVars` should be the merged submission values + system vars:
 *
 *   ```ts
 *   const sysVars = buildSystemVars({ formName, tenantName });
 *   const allVars = { ...validationResult.values, ...sysVars };
 *   await dispatchCMSEmailActions({ actions, allVars, fromAddress });
 *   ```
 *
 * ─── Recipient resolution ──────────────────────────────────────────────────────
 *
 *   actionType === "confirmation":
 *     recipientType === "field"  → recipient is a {{fieldKey}} template resolved
 *                                  from allVars (e.g. "{{email}}" → "jan@example.com")
 *     recipientType === "fixed"  → recipient is a static address or CSV list
 *
 *   actionType === "backoffice":
 *     recipientType === "fixed"  → static address / CSV list
 *     recipientType === "field"  → field-based address (unusual but supported)
 *
 * @param actions          The `emailActions[]` from a CMSFormDefinition.
 * @param allVars          Merged submission values + system variables.
 * @param fromAddress      The resolved "from" address for all outbound emails.
 * @param tenantTransport  Optional tenant DB transport config; falls back to env.
 *
 * @returns Array of dispatch results (one per enabled action, in order).
 */
export async function dispatchCMSEmailActions({
  actions,
  allVars,
  fromAddress,
  tenantTransport,
  platformEmailConfig,
}: {
  actions:              readonly CMSEmailAction[];
  allVars:              Record<string, string>;
  fromAddress:          string;
  tenantTransport?:     TenantEmailTransport | null;
  platformEmailConfig?: PlatformEmailSettings | null;
}): Promise<EmailDispatchResult[]> {
  if (!actions || actions.length === 0) return [];

  const transport = resolveTransportConfig(tenantTransport, platformEmailConfig);
  const results: EmailDispatchResult[] = [];

  for (const action of actions) {
    if (!action.enabled) {
      results.push({ ok: true }); // disabled — treat as success
      continue;
    }

    // ── Resolve recipient ────────────────────────────────────────────────────
    const rawRecipient = interpolateTemplate(action.recipient, allVars);
    const toAddresses  = rawRecipient
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);

    if (toAddresses.length === 0) {
      logger.warn("[forms/email] CMS email action has no resolvable recipient", {
        actionType: action.actionType,
        recipient:  action.recipient,
      });
      results.push({ ok: true });
      continue;
    }

    // ── Interpolate subject / body ───────────────────────────────────────────
    const subject = interpolateTemplate(action.subject, allVars);
    const rawBody  = action.body?.trim()
      ? interpolateTemplate(action.body, allVars)
      : buildAutoBody(allVars);

    // ── Reply-To ─────────────────────────────────────────────────────────────
    const replyTo = action.replyTo?.trim()
      ? interpolateTemplate(action.replyTo, allVars) || undefined
      : undefined;

    // ── Content format ───────────────────────────────────────────────────────
    const format = action.contentFormat ?? "text";
    const text   = format !== "html" ? rawBody : stripHtmlTags(rawBody);
    const html   = format !== "text" ? rawBody : undefined;

    const result = await sendMail(
      { from: fromAddress, to: toAddresses, replyTo, subject, text, html },
      transport,
    );

    if (!result.ok) {
      logger.warn("[forms/email] CMS email action dispatch failed", {
        actionType: action.actionType,
        error:      result.error,
      });
    }

    results.push(result);
  }

  return results;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Builds a minimal auto-generated plain-text body from all submission values. */
function buildAutoBody(allVars: Record<string, string>): string {
  // System vars to exclude from the auto-generated submission summary
  const SYSTEM_KEYS = new Set(["formName", "submittedAt", "tenantName"]);
  const lines: string[] = [];
  for (const [key, value] of Object.entries(allVars)) {
    if (SYSTEM_KEYS.has(key) || !value) continue;
    lines.push(`${key}: ${value}`);
  }
  return lines.join("\n") || "(no fields)";
}

/** Strips HTML tags to produce a plain-text fallback from an HTML body. */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}
