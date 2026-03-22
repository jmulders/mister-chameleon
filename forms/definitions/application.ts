/**
 * Application form definition
 *
 * Job / service application form: name + email + phone + position +
 * cover letter + optional LinkedIn and portfolio URLs.
 *
 * ─── Purpose ──────────────────────────────────────────────────────────────────
 *
 *   Captures candidate or service-request applications from any page that
 *   includes an application form block.  Typically placed on /careers, /apply,
 *   or service-specific landing pages.  Routed to the careers / intake inbox
 *   rather than the general contact inbox.
 *
 * ─── Email routing ────────────────────────────────────────────────────────────
 *
 *   Like the contact form, backoffice.to is absent and resolves at runtime
 *   from tenant config or env vars.  The `subject` template references both
 *   {{name}} and {{position}} so the team can triage applications from the
 *   inbox preview without opening each message.
 *
 * ─── Field design notes ───────────────────────────────────────────────────────
 *
 *   phone      — optional; many applicants prefer email-only contact.
 *
 *   position   — free text (not a select) so this definition stays generic
 *                across tenants with different open roles.  A tenant-specific
 *                override (Fm2+) could substitute a select with allowed values.
 *
 *   linkedinUrl / portfolioUrl
 *              — optional; `url` type with url validation enabled.
 *                The validation rule only fires when the field is non-empty,
 *                so optional + url: true is safe (no error on blank submission).
 */

import type { FormDefinition } from "@/forms/types";

export const APPLICATION_FORM: FormDefinition = {
  key:   "application",
  title: "Apply Now",
  description:
    "Fill in the form below and we'll review your application as soon as possible.",

  // ── Fields ─────────────────────────────────────────────────────────────────

  fields: [
    {
      key:         "name",
      type:        "text",
      label:       "Full name",
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
      key:         "phone",
      type:        "tel",
      label:       "Phone number",
      placeholder: "+1 (555) 000-0000",
      helpText:    "Optional — include country code if outside the US.",
      validation: {
        required: false,
      },
    },
    {
      key:         "position",
      type:        "text",
      label:       "Position you're applying for",
      placeholder: "e.g. Senior Frontend Engineer",
      validation: {
        required:  true,
        maxLength: 200,
      },
    },
    {
      key:         "coverLetter",
      type:        "textarea",
      label:       "Cover letter / message",
      placeholder: "Tell us about yourself, your experience, and why you'd be a great fit…",
      validation: {
        required:  true,
        minLength: 50,
        maxLength: 10000,
      },
    },
    {
      key:         "linkedinUrl",
      type:        "url",
      label:       "LinkedIn profile",
      placeholder: "https://linkedin.com/in/your-handle",
      helpText:    "Optional — share your LinkedIn if you'd like us to take a look.",
      validation: {
        required: false,
        url:      true,
      },
    },
    {
      key:         "portfolioUrl",
      type:        "url",
      label:       "Portfolio or personal website",
      placeholder: "https://yoursite.com",
      helpText:    "Optional — link to work samples, a GitHub profile, or your site.",
      validation: {
        required: false,
        url:      true,
      },
    },
  ],

  // ── Action ─────────────────────────────────────────────────────────────────
  //
  // storeSubmissions: true  — persist for candidate tracking / pipeline review
  // notifyBackoffice: true  — alert the hiring / intake team immediately
  // sendConfirmation: true  — let the applicant know the submission landed
  //
  // webhookUrl absent — resolves from TenantContactConfig.webhookUrl or
  // N8N_CONTACT_WEBHOOK_URL at runtime (same resolution chain as contact form).

  action: {
    storeSubmissions: true,
    notifyBackoffice: true,
    sendConfirmation: true,
    successMessage:
      "Thank you for your application — we'll be in touch if there's a good fit.",
  },

  // ── Email routing ──────────────────────────────────────────────────────────

  emailRouting: {
    backoffice: {
      // `to` absent — resolved from tenant config / env var at runtime.
      // Subject references both name and position for inbox-level triage.
      subject:      "New application from {{name}} — {{position}}",
      replyToField: "email",
    },
    confirmation: {
      emailField: "email",
      subject:    "We received your application",
      body:
        "Hi {{name}},\n\n" +
        "Thanks for applying for the {{position}} role — we've received your " +
        "application and will be in touch if there's a good fit.\n\n" +
        "Best,\nThe team",
    },
  },
} as const;
