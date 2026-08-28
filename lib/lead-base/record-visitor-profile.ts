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
import { classifyChannel } from "./channel";
import {
  upsertVisitorProfile,
  getProfileCrmState,
  updateProfileCrmState,
} from "./visitor-profiles-store";
import { fireProfileWebhook, isNewlyQualified, isNewlyRecognised } from "./profile-webhook";
import { sendHotLeadAlert }   from "./hot-lead-notify";
import { syncCompanyToHubspot, syncContactToHubspot, logVisitNote } from "./hubspot-sync";
import { billLeadCredit }       from "./bill-lead-credit";
import { resolveCompanyFirmographics } from "./leadinfo-company-fallback";
import { getAbmHubspotToken }   from "@/lib/abm/abm-store";
import { logger }               from "@/lib/logger";

/** The named person behind a known ABM lead (first-party CRM data). */
export interface LeadPerson {
  firstName?:   string | null;
  lastName?:    string | null;
  email?:       string | null;
  jobTitle?:    string | null;
  linkedinUrl?: string | null;
}

/** Map an ABM lead profile to the named person, deriving last name from full name. */
export function abmLeadToPerson(
  profile: { firstName?: string | null; name?: string | null; email?: string | null; role?: string | null; linkedinUrl?: string | null } | null | undefined,
): LeadPerson | null {
  if (!profile) return null;
  const firstName = profile.firstName ?? null;
  const full      = profile.name ?? null;
  let lastName: string | null = null;
  if (full) {
    if (firstName && full.toLowerCase().startsWith(firstName.toLowerCase())) {
      lastName = full.slice(firstName.length).trim() || null;
    } else {
      const parts = full.trim().split(/\s+/);
      lastName = parts.length > 1 ? parts.slice(1).join(" ") : null;
    }
  }
  const person: LeadPerson = {
    ...(firstName ? { firstName } : {}),
    ...(lastName  ? { lastName }  : {}),
    ...(profile.email       ? { email:       profile.email }       : {}),
    ...(profile.role        ? { jobTitle:    profile.role }        : {}),
    ...(profile.linkedinUrl ? { linkedinUrl: profile.linkedinUrl } : {}),
  };
  return person.firstName || person.lastName || person.email ? person : null;
}

/** Parse a leading employee count out of a size label, e.g. "500-1000" → 500. */
function parseEmployees(size: string | null | undefined): number | null {
  if (!size) return null;
  const m = size.replace(/[.,]/g, "").match(/\d+/);
  return m ? Number(m[0]) : null;
}

/** Coerce a possibly-stringified revenue figure to a number. */
function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

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
  person?:      LeadPerson | null;   // named person behind a known ABM lead
  personalizationGroup?: string | null;  // A/B holdout group
  scoreConfig?: import("./lead-scoring").LeadScoreConfig;  // tenant score tuning
}): Promise<void> {
  try {
    const { ctx } = args;
    const consent = resolveConsent(args.cookieHeader);

    // Resolve firmographics with a client-side Leadinfo (mc_li) fallback: the
    // client Leadinfo path fills leadinfo* fields but NOT the generic firmographic
    // ones, so without this a Leadinfo-identified visitor was recorded as
    // anonymous. Mirrors the webhook-payload fallback (#290/#296). Driving
    // `company` here also fixes the identityLevel "recognised" logic below.
    const firmographics = resolveCompanyFirmographics(ctx.enrichment);
    const company    = firmographics.companyName;
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
      companyDomain:   firmographics.companyDomain,
      companySize:     firmographics.companySize,
      companyIndustry: firmographics.companyIndustry,
      geoCountry:      ctx.enrichment?.countryCode      ?? null,
      geoRegion:       ctx.enrichment?.region           ?? null,
      abmLeadId:       args.abmLeadId ?? null,
      // Exclude bots (UA-bot OR cloud IP) from the A/B holdout distribution so
      // the control/personalized lift baseline stays a random human sample
      // (spec §6). A bot's group is simply not recorded.
      personalizationGroup: ctx.isBot ? null : (args.personalizationGroup ?? null),
      // First-touch attribution (how they arrived). Stored first-touch by the store.
      utmSource:       ctx.utmSource      ?? null,
      utmMedium:       ctx.utmMedium      ?? null,
      utmCampaign:     ctx.utmCampaign    ?? null,
      utmContent:      ctx.utmContent     ?? null,
      utmTerm:         ctx.utmTerm        ?? null,
      referrerDomain:  ctx.referrerDomain ?? null,
      gclid:           ctx.gclid          ?? null,
      fbclid:          ctx.fbclid         ?? null,
      msclkid:         ctx.msclkid        ?? null,
      ttclid:          ctx.ttclid         ?? null,
      firstChannel:    classifyChannel({
        utmSource:      ctx.utmSource,
        utmMedium:      ctx.utmMedium,
        utmCampaign:    ctx.utmCampaign,
        referrerDomain: ctx.referrerDomain,
        gclid:          ctx.gclid,
        fbclid:         ctx.fbclid,
        msclkid:        ctx.msclkid,
        ttclid:         ctx.ttclid,
      }),
    };

    const patch = gateProfileWrite(candidate, consent);
    const result = await upsertVisitorProfile(patch);

    if (!result) return;

    // Billing — 1 credit when the platform first identifies the company behind a
    // visitor (recognition). This is the enrichment value moment; ABM named leads
    // (your own data) jump straight to "known" and are not charged here.
    if (isNewlyRecognised(result)) {
      await billLeadCredit(args.tenantId, args.visitorKey);
    }

    // Generic outbound webhook — only on an upward qualification, so normal page
    // views never spam the endpoint.
    if (isNewlyQualified(result)) {
      await fireProfileWebhook(patch, result, args.person ?? null);
      await sendHotLeadAlert({
        tenantId:    args.tenantId,
        patch,
        person:      args.person ?? null,
        intentScore: typeof intentScore === "number" ? intentScore : null,
        visitCount:  1,
        scoreConfig: args.scoreConfig,
      });
    }

    // Native HubSpot sync — Company + Contact + a per-session "website visit" note.
    // Runs for any visit where a company is known (named ABM lead or recognised),
    // reusing the stored HubSpot ids so repeat visits don't create duplicates.
    if (patch.companyDomain || patch.companyName) {
      const token = await getAbmHubspotToken(args.tenantId);
      if (token) {
        await syncToHubspot({
          tenantId:   args.tenantId,
          visitorKey: args.visitorKey,
          token,
          patch,
          ctx,
          person:     args.person ?? null,
          newlyQualified: isNewlyQualified(result),
        });
      }
    }
  } catch (err) {
    logger.warn("[lead-base] recordVisitorProfile failed", {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

const SESSION_GAP_MS = 30 * 60 * 1000;

/** A short HTML "website visit" note body for the HubSpot timeline. */
function buildNoteBody(
  patch:  ReturnType<typeof gateProfileWrite>,
  person: LeadPerson | null,
): string {
  const when = new Date().toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam" });
  const who  = person && (person.firstName || person.lastName)
    ? `${[person.firstName, person.lastName].filter(Boolean).join(" ")}${person.jobTitle ? `, ${person.jobTitle}` : ""}`
    : "Known visitor";
  const lines = [
    `<strong>Website visit via personalized link</strong> — ${when}`,
    `Contact: ${who}`,
    patch.companyName ? `Account: ${patch.companyName}` : null,
    patch.funnelStage ? `Funnel stage: ${patch.funnelStage}` : null,
    typeof patch.intentScore === "number" ? `Intent score: ${patch.intentScore}` : null,
    person?.linkedinUrl ? `LinkedIn: ${person.linkedinUrl}` : null,
  ].filter(Boolean);
  return lines.join("<br>");
}

/**
 * Mirror a known lead into HubSpot: upsert the Company (firmographics) and the
 * Contact (named person, associated to the company) once — reusing stored ids on
 * repeat visits — then log a "website visit" note at most once per session.
 * Entirely fail-open.
 */
async function syncToHubspot(a: {
  tenantId:       string;
  visitorKey:     string;
  token:          string;
  patch:          ReturnType<typeof gateProfileWrite>;
  ctx:            DecisionContext;
  person:         LeadPerson | null;
  newlyQualified: boolean;
}): Promise<void> {
  try {
    const crm = await getProfileCrmState(a.tenantId, a.visitorKey);
    let companyId = crm.hubspotCompanyId;
    let contactId = crm.hubspotContactId;

    const industry  = a.patch.companyIndustry ?? null;
    const size      = a.patch.companySize ?? null;
    const employees = parseEmployees(size);
    const revenue   = toNumber((a.ctx.enrichment as Record<string, unknown> | undefined)?.["leadinfoSalesVolume"]);

    // Readable summary so context survives even if structured fields get rejected.
    const description = [
      "Source: Mister Chameleon — personalized ABM link.",
      industry ? `Industry: ${industry}` : null,
      size     ? `Size: ${size}`         : null,
      a.person && (a.person.firstName || a.person.lastName)
        ? `Contact: ${[a.person.firstName, a.person.lastName].filter(Boolean).join(" ")}${a.person.jobTitle ? ` (${a.person.jobTitle})` : ""}`
        : null,
      a.person?.linkedinUrl ? `LinkedIn: ${a.person.linkedinUrl}` : null,
    ].filter(Boolean).join(" · ");

    // (1) Company — create once; refresh on qualification.
    if (!companyId || a.newlyQualified) {
      const r = await syncCompanyToHubspot(a.token, {
        name:              a.patch.companyName   ?? null,
        domain:            a.patch.companyDomain ?? null,
        industry,
        numberOfEmployees: employees,
        annualRevenue:     revenue,
        description,
      });
      if (r.ok && r.companyId) companyId = r.companyId;
    }

    // (2) Contact — the named person, associated to the company.
    const hasPerson = !!(a.person && (a.person.firstName || a.person.lastName || a.person.email));
    if (hasPerson && (!contactId || a.newlyQualified)) {
      const r = await syncContactToHubspot(a.token, {
        firstName: a.person!.firstName ?? null,
        lastName:  a.person!.lastName  ?? null,
        email:     a.person!.email     ?? null,
        jobTitle:  a.person!.jobTitle  ?? null,
      }, companyId);
      if (r.ok && r.contactId) contactId = r.contactId;
    }

    // (3) Website-visit note — at most once per ~30-min session.
    const lastLogged = crm.crmVisitLoggedAt ? Date.parse(crm.crmVisitLoggedAt) : 0;
    const sessionElapsed = Date.now() - (Number.isFinite(lastLogged) ? lastLogged : 0) > SESSION_GAP_MS;
    if (companyId && sessionElapsed) {
      await logVisitNote(a.token, {
        body:        buildNoteBody(a.patch, a.person),
        companyId,
        contactId,
        timestampMs: Date.now(),
      });
      await updateProfileCrmState(a.tenantId, a.visitorKey, {
        ...(companyId ? { hubspotCompanyId: companyId } : {}),
        ...(contactId ? { hubspotContactId: contactId } : {}),
        crmVisitLoggedAt: new Date().toISOString(),
      });
    } else if (companyId !== crm.hubspotCompanyId || contactId !== crm.hubspotContactId) {
      await updateProfileCrmState(a.tenantId, a.visitorKey, {
        ...(companyId ? { hubspotCompanyId: companyId } : {}),
        ...(contactId ? { hubspotContactId: contactId } : {}),
      });
    }
  } catch (err) {
    logger.warn("[lead-base] syncToHubspot failed", {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
