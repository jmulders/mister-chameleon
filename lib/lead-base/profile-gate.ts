/**
 * Lead Base — GDPR/AVG write gate.
 *
 * A pure classifier that decides, per field-group, what may be persisted to
 * `visitor_profiles` given the visitor's consent. It reuses the platform's
 * existing consent model (mc_consent → ConsentState) rather than inventing one:
 *
 *   behavioural summary (intent / funnel / segments / interests / status)
 *                                              → requires `personalization`
 *   firmographic snapshot (company_* / geo_*)  → requires `enrichment`
 *   PII (name / email / …)                     → explicit basis only (Phase 1:
 *                                                 never duplicated here; it lives
 *                                                 in abm_leads, linked by id)
 *
 * Always allowed (essential, pseudonymous): visitor_key, last_seen, visit_count,
 * the abm_lead_id reference, and the identity level.
 *
 * The raw IP is never an input here — callers pass only derived geo. So nothing
 * identifying can leak through this gate.
 *
 * See docs/lead-base-design.md.
 */

import "server-only";

import type { ConsentState } from "@/tracking/consent-types";

export type IdentityLevel = "anonymous" | "recognised" | "known" | "customer";
export type ProfileStatus = "visitor" | "engaged" | "mql" | "sql" | "customer" | "churned";
export type ConsentLabel  = "none" | "essential" | "granted";

/** Everything the request COULD contribute to a profile (pre-gating). */
export interface ProfileCandidate {
  tenantId:   string;
  /** mc_session_id — the shared GA4 visitor key. */
  visitorKey: string;

  // ── Behavioural (gated on `personalization`) ──
  intentScore?: number | null;
  funnelStage?: string | null;
  segmentIds?:  string[] | null;
  interests?:   Record<string, number> | null;
  status?:      ProfileStatus;

  // ── Firmographic (gated on `enrichment`) ──
  companyName?:     string | null;
  companyDomain?:   string | null;
  companySize?:     string | null;
  companyIndustry?: string | null;
  geoCountry?:      string | null;  // coarse only
  geoRegion?:       string | null;  // coarse only

  // ── Identity (references — not PII) ──
  abmLeadId?:     string | null;
  identityLevel?: IdentityLevel;
  /** A/B holdout group: 'control' | 'personalized' (pseudonymous, always allowed). */
  personalizationGroup?: string | null;

  // ── First-touch attribution (gated on `analytics`/`personalization`) ──
  // How the visitor arrived. First-party marketing signals, not third-party
  // enrichment. First-touch semantics are enforced in the store (never
  // overwritten once set).
  utmSource?:      string | null;
  utmMedium?:      string | null;
  utmCampaign?:    string | null;
  utmContent?:     string | null;
  utmTerm?:        string | null;
  referrerDomain?: string | null;
  /** Derived coarse channel (see classifyChannel). */
  firstChannel?:   string | null;
}

/** The gated, ready-to-persist patch. Absent groups were denied by consent. */
export interface GatedProfilePatch {
  tenantId:      string;
  visitorKey:    string;
  identityLevel: IdentityLevel;
  status:        ProfileStatus;
  consentState:  ConsentLabel;
  expiresAt:     string;            // ISO — retention TTL
  // behavioural (only when personalization granted)
  intentScore?:  number | null;
  funnelStage?:  string | null;
  segmentIds?:   string[];
  interests?:    Record<string, number>;
  // firmographic (only when enrichment granted)
  companyName?:     string | null;
  companyDomain?:   string | null;
  companySize?:     string | null;
  companyIndustry?: string | null;
  geoCountry?:      string | null;
  geoRegion?:       string | null;
  abmLeadId?:    string | null;
  personalizationGroup?: string | null;
  // attribution (only when analytics/personalization granted)
  utmSource?:      string | null;
  utmMedium?:      string | null;
  utmCampaign?:    string | null;
  utmContent?:     string | null;
  utmTerm?:        string | null;
  referrerDomain?: string | null;
  firstChannel?:   string | null;
}

const DEFAULT_RETENTION_DAYS = 90;

/** Map the consent state to a coarse label stored on the row. */
function consentLabel(consent: ConsentState): ConsentLabel {
  if (!consent.hasResponded) return "none";
  if (consent.personalization || consent.enrichment || consent.analytics) return "granted";
  return "essential";
}

/**
 * Gate a candidate profile against consent. Returns the patch that is lawful to
 * write — denied field-groups are simply omitted.
 */
export function gateProfileWrite(
  candidate: ProfileCandidate,
  consent:   ConsentState,
  opts?:     { retentionDays?: number },
): GatedProfilePatch {
  const retentionDays = opts?.retentionDays ?? DEFAULT_RETENTION_DAYS;
  const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString();

  const patch: GatedProfilePatch = {
    tenantId:      candidate.tenantId,
    visitorKey:    candidate.visitorKey,
    identityLevel: candidate.identityLevel ?? "anonymous",
    status:        candidate.status ?? "visitor",
    consentState:  consentLabel(consent),
    expiresAt,
    // The abm_lead_id is a reference to your own outreach data (not PII here).
    ...(candidate.abmLeadId !== undefined ? { abmLeadId: candidate.abmLeadId } : {}),
    // A/B holdout group — pseudonymous operational flag, always written.
    ...(candidate.personalizationGroup !== undefined ? { personalizationGroup: candidate.personalizationGroup } : {}),
  };

  // Behavioural summary — only with personalization consent.
  if (consent.personalization) {
    if (candidate.intentScore !== undefined) patch.intentScore = candidate.intentScore;
    if (candidate.funnelStage !== undefined) patch.funnelStage = candidate.funnelStage;
    if (candidate.segmentIds)  patch.segmentIds = candidate.segmentIds;
    if (candidate.interests)   patch.interests  = candidate.interests;
  }

  // Company firmographics.
  //
  // Two sources, two lawful bases:
  //  • IP-derived (a "recognised" visitor) → respects `enrichment` consent.
  //  • First-party (a "known" ABM lead — `abmLeadId` set) → the tenant's own CRM
  //    record about their own named contact, who self-identified by clicking the
  //    personalized link they were sent. That's first-party processing under
  //    legitimate interest, not third-party enrichment, so the visitor's cookie
  //    consent does not gate it. (Coarse geo below stays enrichment-gated — it is
  //    always IP-derived.)
  const abmFirstParty = !!candidate.abmLeadId;
  if (consent.enrichment || abmFirstParty) {
    if (candidate.companyName     !== undefined) patch.companyName     = candidate.companyName;
    if (candidate.companyDomain   !== undefined) patch.companyDomain   = candidate.companyDomain;
    if (candidate.companySize     !== undefined) patch.companySize     = candidate.companySize;
    if (candidate.companyIndustry !== undefined) patch.companyIndustry = candidate.companyIndustry;
  }

  // Coarse geo snapshot — IP-derived, so always requires enrichment consent.
  if (consent.enrichment) {
    if (candidate.geoCountry      !== undefined) patch.geoCountry      = candidate.geoCountry;
    if (candidate.geoRegion       !== undefined) patch.geoRegion       = candidate.geoRegion;
  }

  // First-touch attribution — how the visitor arrived. First-party marketing
  // analytics, so analytics OR personalization consent permits it.
  if (consent.analytics || consent.personalization) {
    if (candidate.utmSource      !== undefined) patch.utmSource      = candidate.utmSource;
    if (candidate.utmMedium      !== undefined) patch.utmMedium      = candidate.utmMedium;
    if (candidate.utmCampaign    !== undefined) patch.utmCampaign    = candidate.utmCampaign;
    if (candidate.utmContent     !== undefined) patch.utmContent     = candidate.utmContent;
    if (candidate.utmTerm        !== undefined) patch.utmTerm        = candidate.utmTerm;
    if (candidate.referrerDomain !== undefined) patch.referrerDomain = candidate.referrerDomain;
    if (candidate.firstChannel   !== undefined) patch.firstChannel   = candidate.firstChannel;
  }

  return patch;
}
