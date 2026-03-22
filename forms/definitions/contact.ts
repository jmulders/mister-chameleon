/**
 * Contact form definition
 *
 * Standard visitor inquiry form: name + email + message.
 *
 * ─── Purpose ──────────────────────────────────────────────────────────────────
 *
 *   Captures visitor enquiries from any page that includes a contact form
 *   block.  The submission is enriched server-side with session signals
 *   (UTMs, visit history, last served variant) before being forwarded to the
 *   backoffice notification channel and optionally to a downstream webhook.
 *
 * ─── Email routing ────────────────────────────────────────────────────────────
 *
 *   backoffice.to is intentionally absent here — it resolves at runtime from:
 *     1. TenantContactConfig.notificationEmail (if set)
 *     2. BACKOFFICE_EMAIL env var
 *     3. MAIL_TO_ADDRESS env var (platform fallback)
 *
 *   This keeps the definition tenant-agnostic: the same contact form
 *   definition can be deployed for any tenant without code changes.
 *
 * ─── Validation notes ─────────────────────────────────────────────────────────
 *
 *   Server-side validation in the handler (app/api/contact/route.ts) currently
 *   applies its own inline checks.  When that handler is migrated to use the
 *   forms layer (Fm2+), it will execute FormFieldValidation rules declared here
 *   instead of the inline logic.
 */

import type { FormDefinition } from "@/forms/types";

export const CONTACT_FORM: FormDefinition = {
  key:   "contact",
  title: "Contact Us",
  description:
    "Send us a message and we'll get back to you within one business day.",

  // ── Fields ─────────────────────────────────────────────────────────────────

  fields: [
    {
      key:         "name",
      type:        "text",
      label:       "Your name",
      placeholder: "Jane Smith",
      validation: {
        required:  true,
        maxLength: 200,
      },
    },
    {
      key:         "email",
      type:        "email",
      label:       "Email address",
      placeholder: "jane@example.com",
      validation: {
        required: true,
        email:    true,
      },
    },
    {
      key:         "message",
      type:        "textarea",
      label:       "Message",
      placeholder: "How can we help you?",
      validation: {
        required:  true,
        minLength: 10,
        maxLength: 5000,
      },
    },
  ],

  // ── Action ─────────────────────────────────────────────────────────────────
  //
  // storeSubmissions: true  — write to form_submissions table for audit + CRM
  // notifyBackoffice: true  — fire internal notification email on submission
  // sendConfirmation: true  — acknowledge the submitter immediately
  //
  // webhookUrl is absent — resolves from TenantContactConfig.webhookUrl or
  // the N8N_CONTACT_WEBHOOK_URL env var at runtime.

  action: {
    storeSubmissions: true,
    notifyBackoffice: true,
    sendConfirmation: true,
    successMessage:
      "Thank you for reaching out — we'll be in touch soon.",
  },

  // ── Email routing ──────────────────────────────────────────────────────────

  emailRouting: {
    backoffice: {
      // `to` absent — resolved from tenant config / env var at runtime.
      subject:      "New contact message from {{name}}",
      replyToField: "email",
    },
    confirmation: {
      emailField: "email",
      subject:    "We received your message",
      body:
        "Hi {{name}},\n\n" +
        "Thanks for getting in touch — we received your message and will " +
        "get back to you within one business day.\n\n" +
        "Best,\nThe team",
    },
  },
} as const;
