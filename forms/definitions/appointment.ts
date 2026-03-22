/**
 * Appointment request form definition
 *
 * Intake / discovery appointment request form used on the join page.
 * Collects contact details plus a preferred date/time so the team can
 * schedule an onboarding call with a new candidate or employer.
 *
 * ─── Purpose ──────────────────────────────────────────────────────────────────
 *
 *   Used by the `/join` page's `formSection` block (formKey: "appointment").
 *   Captures the minimum information needed to book a discovery call without
 *   requiring a full calendar integration in V1.
 *
 * ─── Email routing ────────────────────────────────────────────────────────────
 *
 *   backoffice.to is intentionally absent — resolved from:
 *     1. TenantContactConfig.notificationEmail
 *     2. BACKOFFICE_EMAIL env var
 *     3. MAIL_TO_ADDRESS env var (platform fallback)
 *
 * ─── Fields ───────────────────────────────────────────────────────────────────
 *
 *   name           — Full name of the requester
 *   email          — Contact email (required; confirmation sent here)
 *   phone          — Optional phone number for follow-up
 *   company        — Optional company/organisation name
 *   preferredTime  — Select: time-of-day preference
 *   message        — Optional context / additional notes
 */

import type { FormDefinition } from "@/forms/types";

export const APPOINTMENT_FORM: FormDefinition = {
  key:   "appointment",
  title: "Book a Discovery Call",
  description:
    "Tell us a bit about yourself and we'll be in touch to schedule a call.",

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
      key:         "phone",
      type:        "tel",
      label:       "Phone number",
      placeholder: "+31 6 00 00 00 00",
      helpText:    "Optional — include country code for international numbers.",
      validation: {
        maxLength: 30,
      },
    },
    {
      key:         "company",
      type:        "text",
      label:       "Company / organisation",
      placeholder: "Acme Corp",
      validation: {
        maxLength: 200,
      },
    },
    {
      key:  "preferredTime",
      type: "select",
      label: "Preferred time of day",
      options: [
        { value: "",          label: "No preference" },
        { value: "morning",   label: "Morning (09:00 – 12:00)" },
        { value: "afternoon", label: "Afternoon (12:00 – 17:00)" },
        { value: "evening",   label: "Early evening (17:00 – 19:00)" },
      ],
    },
    {
      key:         "message",
      type:        "textarea",
      label:       "Anything you'd like us to know?",
      placeholder: "Tell us about your situation or what you're looking for…",
      validation: {
        maxLength: 2000,
      },
    },
  ],

  // ── Action ─────────────────────────────────────────────────────────────────

  action: {
    storeSubmissions: true,
    notifyBackoffice: true,
    sendConfirmation: true,
    successMessage:
      "Thanks! We'll be in touch within one business day to schedule your call.",
  },

  // ── Email routing ──────────────────────────────────────────────────────────

  emailRouting: {
    backoffice: {
      // `to` absent — resolved from tenant config / env var at runtime.
      subject:      "New appointment request from {{name}}",
      replyToField: "email",
    },
    confirmation: {
      emailField: "email",
      subject:    "We received your appointment request",
      body:
        "Hi {{name}},\n\n" +
        "Thanks for reaching out — we received your request for a discovery call " +
        "and will be in touch within one business day to find a suitable time.\n\n" +
        "Best,\nThe team",
    },
  },
} as const;
