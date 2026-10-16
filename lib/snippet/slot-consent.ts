/**
 * Consent input for POST /api/v1/slot.
 *
 * consentFromSnippet() reads an OMITTED field (undefined) as the legacy-snippet
 * full grant, and an explicit null as "no signal, apply the tenant default".
 * The snippet always sends the field, so only very old snippet builds omit it.
 * The CMS adapters have never sent it, so for v1/slot an absent field is the
 * normal case and must mean "no signal", the same as snippet decide.
 */

import type { SnippetConsentInput } from "@/lib/consent/server-consent";

export function slotConsentInput(body: unknown): SnippetConsentInput {
  if (!body || typeof body !== "object") return null;
  const consent = (body as { consent?: SnippetConsentInput }).consent;
  return consent === undefined ? null : consent;
}
