/**
 * GET /api/abm/known-lead
 *
 * Returns the deterministic ABM identity for the current visitor when the
 * `mc_lead` cookie (set by /go/{token}) resolves to an active lead scoped to the
 * active tenant. Used by the Scenario Control panel to show a read-only
 * "known lead active" indicator — so operators see what the lead-link injects
 * live, alongside their manual overrides. Returns `{ knownLead: null }` for
 * anonymous traffic. Fail-open.
 *
 * The cookie is only read with personalization consent, the same rule the page
 * pipelines follow (lib/abm/lead-cookie.ts). So the indicator shows what the
 * pages actually use.
 */

import { NextResponse } from "next/server";
import { cookies }      from "next/headers";
import { getActiveTenant }        from "@/tenant/get-active-tenant";
import { resolveActiveKnownLead } from "@/lib/abm/apply-known-lead";
import { resolveConsent }         from "@/lib/consent/server-consent";
import { LEAD_COOKIE, readLeadCookie } from "@/lib/abm/lead-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const consent = resolveConsent(req.headers.get("cookie"));
    const value   = readLeadCookie(cookieStore.get(LEAD_COOKIE)?.value, consent);
    if (!value) return NextResponse.json({ knownLead: null });

    const [{ tenantId }, lead] = await Promise.all([
      getActiveTenant(),
      resolveActiveKnownLead(value),
    ]);

    // Only surface a lead that belongs to the active tenant.
    if (!lead || lead.tenantId !== tenantId) return NextResponse.json({ knownLead: null });

    return NextResponse.json({
      knownLead: {
        firstName:   lead.profile.firstName   ?? null,
        name:        lead.profile.name        ?? null,
        company:     lead.profile.company     ?? null,
        role:        lead.profile.role        ?? null,
        industry:    lead.profile.industry    ?? null,
        companySize: lead.profile.companySize ?? null,
      },
      forcedSegment: lead.segmentHint ?? null,
    });
  } catch {
    return NextResponse.json({ knownLead: null });
  }
}
