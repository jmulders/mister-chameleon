/**
 * Configurable rule-webhook payload — the selectable lead-base / context fields
 * an operator can add to a rule webhook's payload, and the consent that gates
 * each one.
 *
 * ─── Consent (GDPR/AVG) ───────────────────────────────────────────────────────
 *
 * The default payload (event/tenantId/rule/plan/context-slice) is anonymous and
 * always sent. Anything selected here is added ONLY when the visitor's consent
 * permits it, mirroring the lead-base write gate (profile-gate.ts) and the
 * ad-ID/CAPI split:
 *
 *   context      — anonymous request signals            → no consent required
 *   firmographic — company / coarse geo (IP-derived)    → `enrichment`
 *   scoring      — behavioural intent / funnel / journey → `personalization`
 *   person       — named-lead PII (from an ABM link)     → STRICTEST:
 *                                                          personalization AND enrichment
 *
 * A field whose gate is not satisfied is silently dropped (never an error), so a
 * webhook never leaks data the visitor did not consent to.
 * See docs/design/webhook-payload-consent.md.
 */

import type { ConsentState } from "@/tracking/consent-types";

export type PayloadFieldGroup = "context" | "firmographic" | "scoring" | "person";
/** null = always allowed; otherwise the consent basis required. */
export type PayloadConsentGate = null | "enrichment" | "personalization" | "person";

/** Minimal structural view of the decision context the extractors read. */
export interface PayloadSourceContext {
  source?:             string | null;
  visitType?:          string | null;
  pathname?:           string | null;
  referrerDomain?:     string | null;
  utmSource?:          string | null;
  utmCampaign?:        string | null;
  audienceSegmentIds?: string | null;
  clientContext?:      { deviceType?: string | null } | null;
  enrichment?: {
    companyName?:    string | null;
    companyDomain?:  string | null;
    companyIndustry?: string | null;
    companySize?:    string | null;
    countryCode?:    string | null;
    region?:         string | null;
    // Client-side Leadinfo (mc_li) writes these *separate* leadinfo* fields and
    // deliberately does NOT overwrite the generic ones (so rules can compare
    // leadinfoCompanyName vs companyName). The firmographic extractors below fall
    // back to them so a client-Leadinfo-only visit still yields a company in the
    // webhook payload.
    leadinfoCompanyName?:    string | null;
    leadinfoCompanyDomain?:  string | null;
    leadinfoCompanyCountry?: string | null;
    leadinfoEmployees?:      string | null;
    // Raw Leadinfo firmographic fields — exposed verbatim as selectable payload
    // fields so operators can forward them and translate downstream (e.g. Make).
    // Branch codes are numeric taxonomy codes (SBI / SIC-87), not text industries.
    leadinfoEmployeesTotal?:  number | null;
    leadinfoSalesVolume?:     string | null;
    leadinfoCocNumber?:       string | null;
    leadinfoBranchCode?:      string | null;
    leadinfoBranchCodeSic87?: string | null;
  } | null;
  derived?:  { funnelStage?: string | null } | null;
  history?:  { journey?: {
    intentScore?:       number;
    hasVisitedPricing?: boolean;
    hasVisitedCases?:   boolean;
    hasVisitedContact?: boolean;
  } | null } | null;
  knownLead?: { name?: string; firstName?: string; role?: string; company?: string } | null;
}

interface PayloadFieldDef {
  key:     string;
  label:   string;
  group:   PayloadFieldGroup;
  gate:    PayloadConsentGate;
  extract: (ctx: PayloadSourceContext) => unknown;
}

const PAYLOAD_FIELDS: readonly PayloadFieldDef[] = [
  // ── Context (anonymous request signals) ──
  { key: "source",         label: "Traffic source",   group: "context", gate: null, extract: (c) => c.source ?? null },
  { key: "device",         label: "Device type",      group: "context", gate: null, extract: (c) => c.clientContext?.deviceType ?? null },
  { key: "visitType",      label: "Visit type",       group: "context", gate: null, extract: (c) => c.visitType ?? null },
  { key: "pathname",       label: "Path",             group: "context", gate: null, extract: (c) => c.pathname ?? null },
  { key: "referrerDomain", label: "Referrer domain",  group: "context", gate: null, extract: (c) => c.referrerDomain ?? null },
  { key: "utmSource",      label: "UTM source",       group: "context", gate: null, extract: (c) => c.utmSource ?? null },
  { key: "utmCampaign",    label: "UTM campaign",     group: "context", gate: null, extract: (c) => c.utmCampaign ?? null },
  { key: "audienceSegments", label: "Audience segments", group: "context", gate: null, extract: (c) => c.audienceSegmentIds ?? null },

  // ── Firmographic (enrichment consent) ──
  // Firmographic extractors prefer the generic (server-side firmographic) fields
  // and fall back to the client-side Leadinfo (mc_li) leadinfo* fields, so a
  // visit enriched only by client Leadinfo still delivers a company. companySize
  // falls back to the Leadinfo employees bucket. companyIndustry has no fallback:
  // client Leadinfo carries only a numeric branch code (no text industry), so it
  // stays empty rather than emitting a code.
  { key: "companyName",     label: "Company name",     group: "firmographic", gate: "enrichment", extract: (c) => c.enrichment?.companyName ?? c.enrichment?.leadinfoCompanyName ?? null },
  { key: "companyDomain",   label: "Company domain",   group: "firmographic", gate: "enrichment", extract: (c) => c.enrichment?.companyDomain ?? c.enrichment?.leadinfoCompanyDomain ?? null },
  { key: "companyIndustry", label: "Company industry", group: "firmographic", gate: "enrichment", extract: (c) => c.enrichment?.companyIndustry ?? null },
  { key: "companySize",     label: "Company size",     group: "firmographic", gate: "enrichment", extract: (c) => c.enrichment?.companySize ?? c.enrichment?.leadinfoEmployees ?? null },
  { key: "geoCountry",      label: "Country",          group: "firmographic", gate: "enrichment", extract: (c) => c.enrichment?.countryCode ?? c.enrichment?.leadinfoCompanyCountry ?? null },
  { key: "geoRegion",       label: "Region",           group: "firmographic", gate: "enrichment", extract: (c) => c.enrichment?.region ?? null },

  // ── Raw Leadinfo firmographics (enrichment consent) ──
  // Exposed verbatim from the client-side Leadinfo (mc_li) leadinfo* context so
  // operators can forward the raw values and translate them downstream (e.g. the
  // numeric SBI / SIC-87 branch codes into human industry labels in Make). Unlike
  // the generic firmographic fields above, these read leadinfo* directly with no
  // fallback — they ARE the raw Leadinfo values.
  { key: "leadinfoBranchCode",      label: "Leadinfo SBI code",         group: "firmographic", gate: "enrichment", extract: (c) => c.enrichment?.leadinfoBranchCode ?? null },
  { key: "leadinfoBranchCodeSic87", label: "Leadinfo SIC-87 code",      group: "firmographic", gate: "enrichment", extract: (c) => c.enrichment?.leadinfoBranchCodeSic87 ?? null },
  { key: "leadinfoCocNumber",       label: "Leadinfo KvK number",       group: "firmographic", gate: "enrichment", extract: (c) => c.enrichment?.leadinfoCocNumber ?? null },
  { key: "leadinfoEmployees",       label: "Leadinfo employees bucket", group: "firmographic", gate: "enrichment", extract: (c) => c.enrichment?.leadinfoEmployees ?? null },
  { key: "leadinfoEmployeesTotal",  label: "Leadinfo employees total",  group: "firmographic", gate: "enrichment", extract: (c) => c.enrichment?.leadinfoEmployeesTotal ?? null },
  { key: "leadinfoSalesVolume",     label: "Leadinfo sales volume",     group: "firmographic", gate: "enrichment", extract: (c) => c.enrichment?.leadinfoSalesVolume ?? null },

  // ── Scoring / behaviour (personalization consent) ──
  { key: "intentScore",    label: "Intent score",     group: "scoring", gate: "personalization", extract: (c) => c.history?.journey?.intentScore ?? null },
  { key: "funnelStage",    label: "Funnel stage",     group: "scoring", gate: "personalization", extract: (c) => c.derived?.funnelStage ?? null },
  { key: "visitedPricing", label: "Visited pricing",  group: "scoring", gate: "personalization", extract: (c) => c.history?.journey?.hasVisitedPricing ?? null },
  { key: "visitedCases",   label: "Visited cases",    group: "scoring", gate: "personalization", extract: (c) => c.history?.journey?.hasVisitedCases ?? null },
  { key: "visitedContact", label: "Visited contact",  group: "scoring", gate: "personalization", extract: (c) => c.history?.journey?.hasVisitedContact ?? null },

  // ── Person (named-lead PII — strictest) ──
  { key: "personName",      label: "Person name",      group: "person", gate: "person", extract: (c) => c.knownLead?.name ?? null },
  { key: "personFirstName", label: "Person first name", group: "person", gate: "person", extract: (c) => c.knownLead?.firstName ?? null },
  { key: "personRole",      label: "Person role",      group: "person", gate: "person", extract: (c) => c.knownLead?.role ?? null },
  { key: "personCompany",   label: "Person company",   group: "person", gate: "person", extract: (c) => c.knownLead?.company ?? null },
];

/** Plain, serialisable catalog for the UI (no extractor closures). */
export const PAYLOAD_FIELD_CATALOG: readonly { key: string; label: string; group: PayloadFieldGroup; gate: PayloadConsentGate }[] =
  PAYLOAD_FIELDS.map(({ key, label, group, gate }) => ({ key, label, group, gate }));

/** Set of valid payload-field keys (for validation). */
export const PAYLOAD_FIELD_KEYS: ReadonlySet<string> = new Set(PAYLOAD_FIELDS.map((f) => f.key));

/** Whether the visitor's consent permits a field with the given gate. */
export function isPayloadFieldConsented(gate: PayloadConsentGate, consent: ConsentState | null | undefined): boolean {
  if (gate === null) return true;
  if (!consent) return false;
  switch (gate) {
    case "enrichment":      return consent.enrichment === true;
    case "personalization": return consent.personalization === true;
    // Person PII is the strictest: requires BOTH personalization and enrichment.
    case "person":          return consent.personalization === true && consent.enrichment === true;
  }
}

/**
 * Assemble the selected, consent-permitted payload fields from the decision
 * context. Fields not selected, not consented, or absent from the context are
 * omitted. Never throws.
 */
export function extractSelectedPayload(
  ctx:     PayloadSourceContext,
  keys:    readonly string[] | undefined,
  consent: ConsentState | null | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!keys || keys.length === 0) return out;
  const selected = new Set(keys);
  for (const def of PAYLOAD_FIELDS) {
    if (!selected.has(def.key)) continue;
    if (!isPayloadFieldConsented(def.gate, consent)) continue;
    let value: unknown;
    try { value = def.extract(ctx); } catch { continue; }
    if (value === undefined || value === null || value === "") continue;
    out[def.key] = value;
  }
  return out;
}

/** The always-allowed (gate=null) context field keys — the webhook's default slice. */
export const BASE_CONTEXT_KEYS: readonly string[] =
  PAYLOAD_FIELDS.filter((f) => f.gate === null).map((f) => f.key);

/**
 * The webhook's default, always-sent non-PII `context` slice: every gate=null
 * catalog field that is present in the context (source, device, visitType,
 * pathname, referrerDomain, utmSource, utmCampaign, audienceSegments). No consent
 * needed. Uses the SAME keys as the selectable fields, so nothing is mapped twice
 * or under a different name.
 */
export function extractBaseContext(ctx: PayloadSourceContext): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const def of PAYLOAD_FIELDS) {
    if (def.gate !== null) continue;
    let value: unknown;
    try { value = def.extract(ctx); } catch { continue; }
    if (value === undefined || value === null || value === "") continue;
    out[def.key] = value;
  }
  return out;
}
