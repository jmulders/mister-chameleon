/**
 * Newsletter form definition
 *
 * Minimal email-capture form used by the cta_newsletter CTA variant. A single
 * required email field, submitted through the standard forms pipeline
 * (/api/forms/newsletter): encrypted storage, optional per-form Turnstile, and
 * an adaptive confirmation email. No backoffice notification.
 */

import type { FormDefinition } from "@/forms/types";

export const NEWSLETTER_FORM: FormDefinition = {
  key:   "newsletter",
  title: "Subscribe to our newsletter",
  description: "Get our latest updates in your inbox. No spam, unsubscribe anytime.",

  fields: [
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
  ],

  action: {
    storeSubmissions: true,
    notifyBackoffice: false,
    sendConfirmation: true,
    successMessage:   "Thanks for subscribing. Please check your inbox to confirm.",
  },

  emailRouting: {
    confirmation: {
      emailField: "email",
      subject:    "Welcome to our newsletter",
      body:
        "Hi,\n\n" +
        "Thanks for subscribing. You will start receiving our updates soon.\n\n" +
        "Best,\nThe team",
    },
  },
} as const;
