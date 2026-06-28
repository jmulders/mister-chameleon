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
  };

  // Behavioural summary — only with personalization consent.
  if (consent.personalization) {
    if (candidate.intentScore !== undefined) patch.intentScore = candidate.intentScore;
    if (candidate.funnelStage !== undefined) patch.funnelStage = candidate.funnelStage;
    if (candidate.segmentIds)  patch.segmentIds = candidate.segmentIds;
    if (candidate.interests)   patch.interests  = candidate.interests;
  }

  // Firmographic snapshot — only with enrichment consent. Company-by-IP is
  // firmographic (not personal data), but we still respect the category.
  if (consent.enrichment) {
    if (candidate.companyName     !== undefined) patch.companyName     = candidate.companyName;
    if (candidate.companyDomain   !== undefined) patch.companyDomain   = candidate.companyDomain;
    if (candidate.companySize     !== undefined) patch.companySize     = candidate.companySize;
    if (candidate.companyIndustry !== undefined) patch.companyIndustry = candidate.companyIndustry;
    if (candidate.geoCountry      !== undefined) patch.geoCountry      = candidate.geoCountry;
    if (candidate.geoRegion       !== undefined) patch.geoRegion       = candidate.geoRegion;
  }

  return patch;
}
