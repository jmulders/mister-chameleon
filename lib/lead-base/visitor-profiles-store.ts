/**
 * Lead Base — visitor_profiles store.
 *
 * CRUD + retention for the unified visitor/lead profile. Writes go through the
 * GDPR gate (profile-gate.ts) first — this store persists an already-gated patch
 * and never decides policy itself. Service-role client; see docs/lead-base-design.md.
 */

import "server-only";

import { getDb }  from "@/data/db";
import { logger } from "@/lib/logger";
import type { GatedProfilePatch, IdentityLevel, ProfileStatus, ConsentLabel } from "./profile-gate";

// ── Types ────────────────────────────────────────────────────────────────────

export interface VisitorProfile {
  id:              string;
  tenantId:        string;
  visitorKey:      string;
  identityLevel:   IdentityLevel;
  status:          ProfileStatus;
  firstSeenAt:     string;
  lastSeenAt:      string;
  visitCount:      number;
  intentScore:     number | null;
  funnelStage:     string | null;
  segmentIds:      string[];
  interests:       Record<string, number>;
  companyName:     string | null;
  companyDomain:   string | null;
  companySize:     string | null;
  companyIndustry: string | null;
  geoCountry:      string | null;
  geoRegion:       string | null;
  abmLeadId:       string | null;
  consentState:    ConsentLabel;
  expiresAt:       string | null;
}

function mapRow(row: Record<string, unknown>): VisitorProfile {
  return {
    id:              String(row.id),
    tenantId:        String(row.tenant_id),
    visitorKey:      String(row.visitor_key),
    identityLevel:   (row.identity_level as IdentityLevel) ?? "anonymous",
    status:          (row.status as ProfileStatus) ?? "visitor",
    firstSeenAt:     String(row.first_seen_at),
    lastSeenAt:      String(row.last_seen_at),
    visitCount:      Number(row.visit_count ?? 0),
    intentScore:     row.intent_score === null || row.intent_score === undefined ? null : Number(row.intent_score),
    funnelStage:     (row.funnel_stage as string | null) ?? null,
    segmentIds:      (row.segment_ids as string[] | null) ?? [],
    interests:       (row.interests as Record<string, number> | null) ?? {},
    companyName:     (row.company_name as string | null) ?? null,
    companyDomain:   (row.company_domain as string | null) ?? null,
    companySize:     (row.company_size as string | null) ?? null,
    companyIndustry: (row.company_industry as string | null) ?? null,
    geoCountry:      (row.geo_country as string | null) ?? null,
    geoRegion:       (row.geo_region as string | null) ?? null,
    abmLeadId:       (row.abm_lead_id as string | null) ?? null,
    consentState:    (row.consent_state as ConsentLabel) ?? "none",
    expiresAt:       (row.expires_at as string | null) ?? null,
  };
}

// ── Upsert (per request) ───────────────────────────────────────────────────────

/** What an upsert changed — lets callers detect upward qualification. */
export interface ProfileUpsertResult {
  prevLevel:  IdentityLevel | null;
  level:      IdentityLevel;
  prevStatus: ProfileStatus | null;
  status:     ProfileStatus;
}

/**
 * Upsert a gated profile patch. Bumps visit_count + last_seen_at, sets
 * first_seen_at on first sight, and refreshes the retention TTL. Only the columns
 * present in the patch are written — denied field-groups are never overwritten.
 * Returns the level/status transition (or null on failure). Fire-and-forget safe.
 */
export async function upsertVisitorProfile(patch: GatedProfilePatch): Promise<ProfileUpsertResult | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const now = new Date().toISOString();

    const { data: existing } = await db
      .from("visitor_profiles")
      .select("visit_count, first_seen_at, identity_level, status")
      .eq("tenant_id", patch.tenantId)
      .eq("visitor_key", patch.visitorKey)
      .maybeSingle();

    const row: Record<string, unknown> = {
      tenant_id:      patch.tenantId,
      visitor_key:    patch.visitorKey,
      identity_level: patch.identityLevel,
      status:         patch.status,
      consent_state:  patch.consentState,
      expires_at:     patch.expiresAt,
      last_seen_at:   now,
      first_seen_at:  existing?.first_seen_at ?? now,
      visit_count:    Number(existing?.visit_count ?? 0) + 1,
      updated_at:     now,
      // Only include gated optional columns that are present in the patch.
      ...(patch.intentScore     !== undefined ? { intent_score:     patch.intentScore }     : {}),
      ...(patch.funnelStage     !== undefined ? { funnel_stage:     patch.funnelStage }     : {}),
      ...(patch.segmentIds      !== undefined ? { segment_ids:      patch.segmentIds }      : {}),
      ...(patch.interests       !== undefined ? { interests:        patch.interests }       : {}),
      ...(patch.companyName     !== undefined ? { company_name:     patch.companyName }     : {}),
      ...(patch.companyDomain   !== undefined ? { company_domain:   patch.companyDomain }   : {}),
      ...(patch.companySize     !== undefined ? { company_size:     patch.companySize }     : {}),
      ...(patch.companyIndustry !== undefined ? { company_industry: patch.companyIndustry } : {}),
      ...(patch.geoCountry      !== undefined ? { geo_country:      patch.geoCountry }      : {}),
      ...(patch.geoRegion       !== undefined ? { geo_region:       patch.geoRegion }       : {}),
      ...(patch.abmLeadId       !== undefined ? { abm_lead_id:      patch.abmLeadId }       : {}),
      ...(patch.personalizationGroup !== undefined ? { personalization_group: patch.personalizationGroup } : {}),
      // Stamp the firmographics' freshness whenever a company field is (re)written.
      ...((patch.companyName !== undefined || patch.companyDomain !== undefined ||
           patch.companyIndustry !== undefined || patch.companySize !== undefined)
            ? { firmographics_at: now } : {}),
    };

    await db.from("visitor_profiles").upsert(row, { onConflict: "tenant_id,visitor_key" });

    return {
      prevLevel:  (existing?.identity_level as IdentityLevel | undefined) ?? null,
      level:      patch.identityLevel,
      prevStatus: (existing?.status as ProfileStatus | undefined) ?? null,
      status:     patch.status,
    };
  } catch (err) {
    logger.warn("[lead-base] upsertVisitorProfile failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ── Firmographics reuse (skip stable enrichment for known visitors) ─────────────

/** The stable company fields, as EnrichmentOutput keys (ready to seed the chain). */
export interface KnownFirmographics {
  companyName?:     string;
  companyDomain?:   string;
  companyIndustry?: string;
  companySize?:     string;
}

/**
 * Return the cached firmographics for a visitor IF they are still fresh (written
 * within `freshnessDays`). Returns null when there's no profile, no company data,
 * or the data is stale (so the company-identification stages re-run to refresh).
 * Cheap single indexed lookup; used to seed the enrichment + skip company stages.
 */
export async function getKnownFirmographics(
  tenantId:     string,
  visitorKey:   string,
  freshnessDays: number,
): Promise<KnownFirmographics | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const { data, error } = await db
      .from("visitor_profiles")
      .select("company_name, company_domain, company_industry, company_size, firmographics_at")
      .eq("tenant_id", tenantId)
      .eq("visitor_key", visitorKey)
      .maybeSingle();
    if (error || !data) return null;

    const at = data.firmographics_at ? new Date(String(data.firmographics_at)).getTime() : 0;
    if (!at) return null;
    const ageMs = Date.now() - at;
    if (ageMs > freshnessDays * 24 * 60 * 60 * 1000) return null; // stale → refresh

    const out: KnownFirmographics = {
      ...(data.company_name     ? { companyName:     String(data.company_name) }     : {}),
      ...(data.company_domain   ? { companyDomain:   String(data.company_domain) }   : {}),
      ...(data.company_industry ? { companyIndustry: String(data.company_industry) } : {}),
      ...(data.company_size     ? { companySize:     String(data.company_size) }     : {}),
    };
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

// ── Conversion tracking + personalization performance (close the loop) ──────────

/** Mark a visitor's profile as converted (first conversion wins). Fail-open. */
export async function markProfileConverted(tenantId: string, visitorKey: string): Promise<void> {
  if (!visitorKey) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    await db
      .from("visitor_profiles")
      .update({ converted_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("visitor_key", visitorKey)
      .is("converted_at", null);
  } catch (err) {
    logger.warn("[lead-base] markProfileConverted failed", {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

export interface SegmentPerformance { segmentId: string; total: number; converted: number }
export interface GroupStat { total: number; converted: number }
export interface PersonalizationPerformance {
  total:        number;
  converted:    number;
  personalized: GroupStat;  // matched ≥1 segment (proxy)
  baseline:     GroupStat;  // matched no segment (proxy)
  /** Randomized A/B holdout buckets — only populated when a holdout is configured. */
  holdout:      { control: GroupStat; personalized: GroupStat };
  bySegment:    SegmentPerformance[];
  sampleCapped: boolean;
}

/**
 * Aggregate conversion performance for the personalization report: overall,
 * personalized (matched ≥1 audience segment) vs baseline (none), and per segment.
 * Reads up to `limit` recent profiles and tallies in memory.
 */
export async function getPersonalizationPerformance(tenantId: string, limit = 10_000): Promise<PersonalizationPerformance> {
  const empty: PersonalizationPerformance = {
    total: 0, converted: 0,
    personalized: { total: 0, converted: 0 },
    baseline:     { total: 0, converted: 0 },
    holdout:      { control: { total: 0, converted: 0 }, personalized: { total: 0, converted: 0 } },
    bySegment: [], sampleCapped: false,
  };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const { data, error } = await db
      .from("visitor_profiles")
      .select("segment_ids, converted_at, personalization_group")
      .eq("tenant_id", tenantId)
      .order("last_seen_at", { ascending: false })
      .limit(limit);
    if (error || !data) return empty;

    const rows = data as { segment_ids: string[] | null; converted_at: string | null; personalization_group: string | null }[];
    const seg = new Map<string, { total: number; converted: number }>();
    const acc: PersonalizationPerformance = {
      ...empty, bySegment: [],
      personalized: { total: 0, converted: 0 },
      baseline:     { total: 0, converted: 0 },
      holdout:      { control: { total: 0, converted: 0 }, personalized: { total: 0, converted: 0 } },
    };

    for (const r of rows) {
      const converted = !!r.converted_at;
      const segments  = Array.isArray(r.segment_ids) ? r.segment_ids : [];
      acc.total += 1;
      if (converted) acc.converted += 1;
      const bucket = segments.length > 0 ? acc.personalized : acc.baseline;
      bucket.total += 1;
      if (converted) bucket.converted += 1;
      // Randomized holdout buckets (only when assigned).
      if (r.personalization_group === "control" || r.personalization_group === "personalized") {
        const g = acc.holdout[r.personalization_group];
        g.total += 1; if (converted) g.converted += 1;
      }
      for (const s of segments) {
        const e = seg.get(s) ?? { total: 0, converted: 0 };
        e.total += 1; if (converted) e.converted += 1;
        seg.set(s, e);
      }
    }
    acc.bySegment = Array.from(seg.entries())
      .map(([segmentId, v]) => ({ segmentId, ...v }))
      .sort((a, b) => b.total - a.total);
    acc.sampleCapped = rows.length >= limit;
    return acc;
  } catch {
    return empty;
  }
}

// ── Returning-visitor signals (close the personalization loop) ──────────────────

export interface ReturningProfileSignals {
  identityLevel: IdentityLevel;
  status:        ProfileStatus;
  intentScore:   number | null;
  visitCount:    number;
  lastSeenAt:    string | null;
}

/**
 * The prior stored profile for a visitor (read BEFORE this request's upsert), so
 * the pipeline can adapt content for someone we already know. Null on a first
 * visit. Cheap single indexed lookup.
 */
export async function getReturningProfileSignals(
  tenantId:   string,
  visitorKey: string,
): Promise<ReturningProfileSignals | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const { data, error } = await db
      .from("visitor_profiles")
      .select("identity_level, status, intent_score, visit_count, last_seen_at")
      .eq("tenant_id", tenantId)
      .eq("visitor_key", visitorKey)
      .maybeSingle();
    if (error || !data) return null;
    return {
      identityLevel: (data.identity_level as IdentityLevel) ?? "anonymous",
      status:        (data.status as ProfileStatus) ?? "visitor",
      intentScore:   typeof data.intent_score === "number" ? data.intent_score : null,
      visitCount:    typeof data.visit_count === "number" ? data.visit_count : 0,
      lastSeenAt:    (data.last_seen_at as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

// ── HubSpot sync state (reuse records + throttle visit notes) ───────────────────

export interface ProfileCrmState {
  hubspotCompanyId:  string | null;
  hubspotContactId:  string | null;
  crmVisitLoggedAt:  string | null;   // ISO
}

/** Read the HubSpot record ids + last visit-note time for a visitor. */
export async function getProfileCrmState(
  tenantId:   string,
  visitorKey: string,
): Promise<ProfileCrmState> {
  const empty: ProfileCrmState = { hubspotCompanyId: null, hubspotContactId: null, crmVisitLoggedAt: null };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const { data, error } = await db
      .from("visitor_profiles")
      .select("hubspot_company_id, hubspot_contact_id, crm_visit_logged_at")
      .eq("tenant_id", tenantId)
      .eq("visitor_key", visitorKey)
      .maybeSingle();
    if (error || !data) return empty;
    return {
      hubspotCompanyId: data.hubspot_company_id  ?? null,
      hubspotContactId: data.hubspot_contact_id  ?? null,
      crmVisitLoggedAt: data.crm_visit_logged_at ?? null,
    };
  } catch {
    return empty;
  }
}

/** Linked HubSpot contact ids for a set of profile ids (for GDPR erasure). */
export async function getHubspotContactIdsForProfiles(tenantId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const { data, error } = await db
      .from("visitor_profiles")
      .select("hubspot_contact_id")
      .eq("tenant_id", tenantId)
      .in("id", ids);
    if (error || !data) return [];
    return (data as { hubspot_contact_id: string | null }[])
      .map((r) => r.hubspot_contact_id)
      .filter((v): v is string => !!v);
  } catch {
    return [];
  }
}

/** Persist HubSpot record ids and/or the visit-note timestamp. Fail-open. */
export async function updateProfileCrmState(
  tenantId:   string,
  visitorKey: string,
  patch:      Partial<{ hubspotCompanyId: string; hubspotContactId: string; crmVisitLoggedAt: string }>,
): Promise<void> {
  try {
    const row: Record<string, unknown> = {};
    if (patch.hubspotCompanyId !== undefined) row.hubspot_company_id  = patch.hubspotCompanyId;
    if (patch.hubspotContactId !== undefined) row.hubspot_contact_id  = patch.hubspotContactId;
    if (patch.crmVisitLoggedAt !== undefined) row.crm_visit_logged_at = patch.crmVisitLoggedAt;
    if (Object.keys(row).length === 0) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    await db.from("visitor_profiles").update(row).eq("tenant_id", tenantId).eq("visitor_key", visitorKey);
  } catch (err) {
    logger.warn("[lead-base] updateProfileCrmState failed", {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── Reads (admin — Phase 2) ────────────────────────────────────────────────────

export interface VisitorProfileFilter {
  identityLevel?: IdentityLevel;
  status?:        ProfileStatus;
  segmentId?:     string;
  companyQuery?:  string;   // ilike on company_name / company_domain
  minIntent?:     number;
  limit?:         number;
}

/** List profiles for a tenant with optional filters, newest activity first. */
export async function listVisitorProfiles(
  tenantId: string,
  filter:   VisitorProfileFilter = {},
): Promise<VisitorProfile[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    let q = db.from("visitor_profiles").select("*").eq("tenant_id", tenantId);

    if (filter.identityLevel) q = q.eq("identity_level", filter.identityLevel);
    if (filter.status)        q = q.eq("status", filter.status);
    if (filter.segmentId)     q = q.contains("segment_ids", [filter.segmentId]);
    if (typeof filter.minIntent === "number") q = q.gte("intent_score", filter.minIntent);
    if (filter.companyQuery)  q = q.or(`company_name.ilike.%${filter.companyQuery}%,company_domain.ilike.%${filter.companyQuery}%`);

    q = q.order("last_seen_at", { ascending: false }).limit(filter.limit ?? 200);

    const { data, error } = await q;
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map(mapRow);
  } catch (err) {
    logger.warn("[lead-base] listVisitorProfiles failed", {
      tenantId, err: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

// ── Erasure (right to be forgotten) ────────────────────────────────────────────

/** Delete one or more profiles by id (tenant-scoped). Returns rows removed. */
export async function deleteVisitorProfiles(tenantId: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const { data, error } = await db
      .from("visitor_profiles")
      .delete()
      .eq("tenant_id", tenantId)
      .in("id", ids)
      .select("id");
    if (error || !data) return 0;
    return (data as unknown[]).length;
  } catch (err) {
    logger.warn("[lead-base] deleteVisitorProfiles failed", {
      tenantId, err: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}

// ── Retention purge ────────────────────────────────────────────────────────────

/** Delete profiles whose retention TTL has passed. Returns rows removed. */
export async function purgeExpiredVisitorProfiles(tenantId?: string): Promise<number> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    let q = db.from("visitor_profiles").delete().lt("expires_at", new Date().toISOString());
    if (tenantId) q = q.eq("tenant_id", tenantId);
    const { data, error } = await q.select("id");
    if (error || !data) return 0;
    return (data as unknown[]).length;
  } catch (err) {
    logger.warn("[lead-base] purgeExpiredVisitorProfiles failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}
