/**
 * Form-prefill (Fase 2 of the back-office lead coupling).
 *
 * Builds the LOW-SENSITIVITY prefill payload for a known lead (resolved from the
 * mc_lead cookie / a linked visitor profile). Consent-gated and deliberately
 * narrow: only firstName / name / company / industry. NEVER email, phone, role,
 * or any contact PII — the 30-day mc_lead handle must not leak rich PII to whoever
 * holds a forwarded mail (see docs/design/backoffice-lead-coupling.md, PII-
 * forwarding risk).
 *
 * Pure (no I/O) so the consent + field-selection logic is unit-testable; the route
 * (app/api/forms/prefill/route.ts) supplies the resolved lead + consent.
 */

import type { AbmLead } from "@/lib/abm/abm-store";
import type { ConsentState } from "@/tracking/consent-types";

/** The only fields ever returned for prefill — all low-sensitivity. */
export interface PrefillFields {
  firstName?: string;
  name?:      string;
  company?:   string;
  industry?:  string;
}

/**
 * Prefill is allowed only under personalization OR enrichment consent — the same
 * ceiling under which we personalize from the known lead at all.
 */
export function prefillConsentGranted(consent: ConsentState | null | undefined): boolean {
  return Boolean(consent && (consent.personalization || consent.enrichment));
}

/**
 * Build the prefill payload from a known lead. Returns {} when there is no lead
 * or consent is not granted. Only the four low-sensitivity fields are ever copied;
 * sensitive fields on the profile (email, role, companySize, …) are never included.
 */
export function buildPrefillFromLead(
  lead:    AbmLead | null | undefined,
  consent: ConsentState | null | undefined,
): PrefillFields {
  if (!lead) return {};
  if (!prefillConsentGranted(consent)) return {};
  const p = lead.profile ?? {};
  const out: PrefillFields = {};
  if (p.firstName) out.firstName = p.firstName;
  if (p.name)      out.name      = p.name;
  if (p.company)   out.company   = p.company;
  if (p.industry)  out.industry  = p.industry;
  return out;
}

/**
 * Map the prefill payload onto a form's fields by field KEY. A form field whose
 * key matches a prefill key (or `email`→name/company aliases are intentionally NOT
 * mapped here — only the low-sensitivity keys) receives the value; everything else
 * is left for the visitor to fill. The visitor can always overwrite.
 */
export function prefillValuesForFieldKeys(
  fieldKeys: readonly string[],
  prefill:   PrefillFields,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of fieldKeys) {
    const v = (prefill as Record<string, string | undefined>)[key];
    if (v) out[key] = v;
  }
  return out;
}
