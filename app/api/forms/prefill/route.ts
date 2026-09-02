/**
 * GET /api/forms/prefill — form prefill for a known lead (Fase 2).
 *
 * Resolves the known lead from the `mc_lead` cookie (set by /go/{handle}), scoped
 * to the active tenant, and returns the LOW-SENSITIVITY fields to prefill a form:
 * firstName, name, company, industry. Consent-gated (personalization OR enrichment);
 * without consent the payload is empty. NEVER returns email or other contact PII —
 * the 30-day handle must not leak rich PII to whoever holds a forwarded mail.
 *
 * Cache-Control: no-store (per-visitor, cookie-scoped). Fail-open → empty prefill.
 * See docs/design/backoffice-lead-coupling.md and lib/forms/prefill.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies }                   from "next/headers";
import { getActiveTenant }           from "@/tenant/get-active-tenant";
import { resolveActiveKnownLead }    from "@/lib/abm/apply-known-lead";
import { resolveConsent }            from "@/lib/consent/server-consent";
import { buildPrefillFromLead }      from "@/lib/forms/prefill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const headers = { "Cache-Control": "no-store" };
  try {
    const cookieStore = await cookies();
    const mcLead = cookieStore.get("mc_lead")?.value;

    const [{ tenantId }, lead] = await Promise.all([
      getActiveTenant(),
      resolveActiveKnownLead(mcLead),
    ]);

    // Only prefill from a lead that belongs to the active tenant.
    const scoped = lead && lead.tenantId === tenantId ? lead : null;

    const consent = resolveConsent(req.headers.get("cookie"));
    const prefill = buildPrefillFromLead(scoped, consent);

    return NextResponse.json({ prefill }, { headers });
  } catch {
    return NextResponse.json({ prefill: {} }, { headers });
  }
}
