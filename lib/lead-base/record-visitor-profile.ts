/**
 * Lead Base — per-request profile recorder.
 *
 * Builds a profile candidate from the already-assembled DecisionContext (the
 * persisted OUTPUT of the scoring/segment/enrichment engines — not a recompute),
 * runs it through the GDPR gate, and upserts. Keyed on `mc_session_id`, the same
 * id GA4 uses, so the two stay in sync. Fail-open; intended to run post-response.
 *
 * See docs/lead-base-design.md.
 */

import "server-only";

import type { DecisionContext } from "@/decision/decision-context";
import { resolveConsent }       from "@/lib/consent/server-consent";
import { gateProfileWrite, type ProfileCandidate, type IdentityLevel, type ProfileStatus } from "./profile-gate";
import { upsertVisitorProfile } from "./visitor-profiles-store";
import { fireProfileWebhook, isNewlyQualified } from "./profile-webhook";
import { syncCompanyToHubspot } from "./hubspot-sync";
import { getAbmHubspotToken }   from "@/lib/abm/abm-store";
import { logger }               from "@/lib/logger";

function mapStatus(funnel: string | null, known: boolean, customer: boolean): ProfileStatus {
  if (customer) return "customer";
  switch (funnel) {
    case "decision":      return "sql";
    case "intent":        return "mql";
    case "consideration": return "engaged";
    default:              return known ? "engaged" : "visitor";
  }
}

export async function recordVisitorProfile(args: {
  tenantId:     string;
  visitorKey:   string;        // mc_session_id
  cookieHeader: string | null;
  ctx:          DecisionContext;
  abmLeadId?:   string | null;
}): Promise<void> {
  try {
    const { ctx } = args;
    const consent = resolveConsent(args.cookieHeader);

    const company    = ctx.enrichment?.companyName ?? null;
    const known      = !!ctx.knownLead;
    const isCustomer = ctx.enrichment?.crmIsCustomer === true;
    const identityLevel: IdentityLevel =
      isCustomer ? "customer" : known ? "known" : company ? "recognised" : "anonymous";

    const intentScore = ctx.history?.journey?.intentScore;
    const funnelStage = ctx.derived?.funnelStage ?? null;
    const segmentIds  = (ctx.audienceSegmentIds ?? "")
      .split(",").map((s) => s.trim()).filter(Boolean);

    const candidate: ProfileCandidate = {
      tenantId:        args.tenantId,
      visitorKey:      args.visitorKey,
      identityLevel,
      status:          mapStatus(funnelStage, known, isCustomer),
      intentScore:     typeof intentScore === "number" ? intentScore : null,
      funnelStage,
      segmentIds,
      companyName:     company,
      companyDomain:   ctx.enrichment?.companyDomain   ?? null,
      companySize:     ctx.enrichment?.companySize     ?? null,
      companyIndustry: ctx.enrichment?.companyIndustry ?? null,
      geoCountry:      ctx.enrichment?.countryCode      ?? null,
      geoRegion:       ctx.enrichment?.region           ?? null,
      abmLeadId:       args.abmLeadId ?? null,
    };

    const patch = gateProfileWrite(candidate, consent);
    const result = await upsertVisitorProfile(patch);

    // CRM sync — only on an upward qualification (became known / MQL / SQL /
    // customer), so normal page views never spam the CRM.
    if (result && isNewlyQualified(result)) {
      await fireProfileWebhook(patch, result);

      // Native HubSpot Company upsert (by domain) when a token is configured.
      if (patch.companyDomain) {
        const token = await getAbmHubspotToken(args.tenantId);
        if (token) {
          await syncCompanyToHubspot(token, {
            name:     patch.companyName ?? null,
            domain:   patch.companyDomain,
            industry: patch.companyIndustry ?? null,
          });
        }
      }
    }
  } catch (err) {
    logger.warn("[lead-base] recordVisitorProfile failed", {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
