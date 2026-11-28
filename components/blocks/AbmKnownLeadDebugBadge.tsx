/**
 * AbmKnownLeadDebugBadge — standalone known-lead badge for non-homepage pages.
 *
 * The homepage / demo surfaces show the ABM identity inside the full
 * ContextDebugPanel. CMS slug pages run the lightweight decision route (and skip
 * it entirely when the page has no adaptive slots), so they have no context
 * snapshot to hang the badge on. This async server component reads the `mc_lead`
 * cookie directly, resolves the active lead, and renders the same badge — gated
 * on the tenant's debug overlay being enabled. Renders nothing otherwise.
 *
 * Like every reader of `mc_lead`, it only reads the cookie with personalization
 * consent (lib/abm/lead-cookie.ts), so the badge shows what the page used.
 */

import "server-only";

import { cookies, headers } from "next/headers";
import type { TenantSettings } from "@/tenant/types";
import { resolveActiveKnownLead } from "@/lib/abm/apply-known-lead";
import { KnownLeadBadge } from "@/components/blocks/KnownLeadBadge";
import { resolveConsent } from "@/lib/consent/server-consent";
import { LEAD_COOKIE, readLeadCookie } from "@/lib/abm/lead-cookie";

export async function AbmKnownLeadDebugBadge({
  tenant,
  hasSlots,
}: {
  tenant:   TenantSettings | null;
  /** Whether this page has adaptive slots (i.e. the decision pipeline ran). */
  hasSlots: boolean;
}) {
  // Same gate as the homepage debug overlay.
  const debugOn = tenant?.debug?.showDebugOverlay === true && tenant.debug.debugLevel !== "off";
  if (!debugOn) return null;

  const cookieStore = await cookies();
  const consent     = resolveConsent((await headers()).get("cookie"), tenant?.privacy ?? null);
  const lead = await resolveActiveKnownLead(
    readLeadCookie(cookieStore.get(LEAD_COOKIE)?.value, consent),
  );
  if (!lead) return null;

  return (
    <KnownLeadBadge
      lead={{
        ...(lead.profile.firstName   ? { firstName:   lead.profile.firstName }   : {}),
        ...(lead.profile.name        ? { name:        lead.profile.name }        : {}),
        ...(lead.profile.company     ? { company:     lead.profile.company }     : {}),
        ...(lead.profile.role        ? { role:        lead.profile.role }        : {}),
        ...(lead.profile.industry    ? { industry:    lead.profile.industry }    : {}),
        ...(lead.profile.companySize ? { companySize: lead.profile.companySize } : {}),
        confidence: "exact",
      }}
      forcedSegment={lead.segmentHint}
      injected={hasSlots}
    />
  );
}
