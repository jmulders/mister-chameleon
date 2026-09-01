/**
 * Locatie-test form definition (enrichment QA).
 *
 * A minimal postcode + house-number form used to TEST the location-enrichment
 * chain end to end. On submit, /api/forms/[formKey] derives a FormLocation via
 * formLocationFromValues() and writes the `mc_loc` cookie; the next render then
 * triggers the CBS (buurt), BAG (per-address) and netbeheer (PC6) enrichers.
 *
 * ─── Field keys matter ────────────────────────────────────────────────────────
 *
 *   formLocationFromValues() matches on the field KEY: /post.?code/ → postcode,
 *   /huis.?nummer/ → huisnummer. So the keys MUST be exactly `postcode` and
 *   `huisnummer` (not the labels). The optional `email` field is captured for
 *   completeness but is not used by the location derivation.
 *
 * ─── No outbound side-effects ─────────────────────────────────────────────────
 *
 *   This is a QA form: storeSubmissions writes the row for audit, but there is
 *   no backoffice notification / confirmation / CRM / webhook. The whole point
 *   is the mc_loc cookie + the enrichment pass on the next render.
 */

import type { FormDefinition } from "@/forms/types";

export const LOCATIE_TEST_FORM: FormDefinition = {
  key:   "locatie-test",
  title: "Locatie-test",
  description:
    "Vul een postcode en huisnummer in om de locatie-verrijking (CBS, BAG, netbeheer) te testen.",

  // ── Fields ─────────────────────────────────────────────────────────────────
  // Keys are exactly `postcode` / `huisnummer` — formLocationFromValues matches
  // on the field key to build the mc_loc cookie.

  fields: [
    {
      key:         "postcode",
      type:        "text",
      label:       "Postcode",
      placeholder: "3011AD",
      validation: {
        required:  true,
        maxLength: 12,
      },
    },
    {
      key:         "huisnummer",
      type:        "text",
      label:       "Huisnummer",
      placeholder: "1",
      validation: {
        required:  true,
        maxLength: 10,
      },
    },
    {
      key:         "email",
      type:        "email",
      label:       "E-mailadres (optioneel)",
      placeholder: "jij@voorbeeld.nl",
      validation: {
        required: false,
        email:    true,
      },
    },
  ],

  // ── Action ─────────────────────────────────────────────────────────────────
  // Store for audit only; no backoffice/confirmation/CRM/webhook. The cookie +
  // enrichment pass is the deliverable, so emailRouting is intentionally absent.

  action: {
    storeSubmissions: true,
    notifyBackoffice: false,
    sendConfirmation: false,
    successMessage:
      "Bedankt — je locatie is opgeslagen. Herlaad de pagina om de verrijking te zien.",
  },
} as const;
