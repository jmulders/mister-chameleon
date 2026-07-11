/**
 * Ad-platform audience sync — segment resolver.
 *
 * Turns a tenant's segment definition into a list of matchable AudienceMembers.
 * Lead *level* comes from `visitor_profiles` (identity level, status, intent,
 * computed hot score); the matchable *identifier* (email, name, phone) comes
 * from the linked first-party ABM lead (`abm_leads.profile`) — the only place
 * the Lead Base holds PII (the GDPR gate deliberately keeps PII out of
 * visitor_profiles).
 *
 * Consent: with `requireConsent` (default), a profile is only included when its
 * consent_state is "granted" OR it is linked to a first-party ABM lead (the
 * person self-identified via their PURL — legitimate interest). Members without
 * a usable identifier are dropped. See docs/lead-base-design.md.
 */

import "server-only";

import { getDb }  from "@/data/db";
import { logger } from "@/lib/logger";
import { leadScore } from "@/lib/lead-base/lead-scoring";
import type { IdentityLevel } from "@/lib/lead-base/profile-gate";
import type { AbmLeadProfile } from "@/lib/abm/abm-store";
import type { AdSyncSegment, AudienceMember } from "./types";

/**
 * Resolve the ABM emails linked to a set of visitor-profile ids. Used by the
 * GDPR erasure path to know which people to purge from the ad audiences before
 * their profiles are deleted.
 */
export async function getLeadEmailsForProfiles(tenantId: string, profileIds: string[]): Promise<string[]> {
  if (profileIds.length === 0) return [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const { data, error } = await db
      .from("visitor_profiles")
      .select("abm_lead_id")
      .eq("tenant_id", tenantId)
      .in("id", profileIds)
      .not("abm_lead_id", "is", null);
    if (error || !data) return [];
    const leadIds = Array.from(new Set((data as Array<{ abm_lead_id: string | null }>).map((r) => r.abm_lead_id).filter((v): v is string => Boolean(v))));
    if (leadIds.length === 0) return [];

    const { data: leads, error: lerr } = await db
      .from("abm_leads")
      .select("profile")
      .eq("tenant_id", tenantId)
      .in("id", leadIds);
    if (lerr || !leads) return [];
    const emails: string[] = [];
    for (const l of leads as Array<{ profile: AbmLeadProfile }>) {
      const e = l.profile?.email?.trim().toLowerCase();
      if (e) emails.push(e);
    }
    return Array.from(new Set(emails));
  } catch (err) {
    logger.warn("[ad-sync] getLeadEmailsForProfiles failed", {
      tenantId, err: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/** Identity levels in ascending "known-ness" order. */
const LEVEL_ORDER: readonly IdentityLevel[] = ["anonymous", "recognised", "known", "customer"];

function levelAtLeast(level: IdentityLevel, min: IdentityLevel): boolean {
  return LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf(min);
}

/** Split a full name into first / last when only `name` is present. */
function splitName(profile: AbmLeadProfile): { firstName?: string; lastName?: string } {
  if (profile.firstName) {
    const rest = (profile.name ?? "").replace(profile.firstName, "").trim();
    return { firstName: profile.firstName, ...(rest ? { lastName: rest } : {}) };
  }
  if (profile.name) {
    const parts = profile.name.trim().split(/\s+/);
    if (parts.length === 1) return { firstName: parts[0] };
    return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
  }
  return {};
}

interface ProfileRow {
  identity_level: IdentityLevel;
  status:         string;
  intent_score:   number | null;
  last_seen_at:   string;
  visit_count:    number;
  consent_state:  string | null;
  abm_lead_id:    string | null;
}

/**
 * Resolve the tenant's segment to a de-duplicated list of AudienceMembers.
 * Returns at most `hardCap` members (safety bound; ad platforms cap uploads).
 */
export async function resolveAudienceMembers(
  tenantId: string,
  segment:  AdSyncSegment,
  hardCap = 50_000,
): Promise<AudienceMember[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;

    let q = db
      .from("visitor_profiles")
      .select("identity_level, status, intent_score, last_seen_at, visit_count, consent_state, abm_lead_id")
      .eq("tenant_id", tenantId)
      .not("abm_lead_id", "is", null);

    if (segment.status)                        q = q.eq("status", segment.status);
    if (typeof segment.minIntent === "number") q = q.gte("intent_score", segment.minIntent);
    if (segment.segmentKey)                    q = q.contains("segment_ids", [segment.segmentKey]);

    q = q.order("last_seen_at", { ascending: false }).limit(Math.min(hardCap * 2, 100_000));

    const { data, error } = await q;
    if (error || !data) {
      if (error) logger.warn("[ad-sync] segment query failed", { tenantId, error: String(error.message ?? error) });
      return [];
    }

    const rows = data as ProfileRow[];
    const requireConsent = segment.requireConsent !== false;
    const now = Date.now();

    // Filter by level + score, and collect the ABM lead ids we need PII for.
    const wantedLeadIds: string[] = [];
    const keptRows: ProfileRow[] = [];
    for (const row of rows) {
      if (!row.abm_lead_id) continue;
      if (segment.minIdentityLevel && !levelAtLeast(row.identity_level, segment.minIdentityLevel)) continue;
      if (typeof segment.minScore === "number") {
        const score = leadScore(
          {
            identityLevel: row.identity_level,
            intentScore:   row.intent_score,
            lastSeenAt:    row.last_seen_at,
            visitCount:    row.visit_count,
          },
          now,
        );
        if (score < segment.minScore) continue;
      }
      // Consent: granted, or linked ABM lead (first-party legitimate interest).
      if (requireConsent && row.consent_state !== "granted" && !row.abm_lead_id) continue;
      keptRows.push(row);
      wantedLeadIds.push(row.abm_lead_id);
    }

    const seen = new Set<string>();
    const members: AudienceMember[] = [];

    // Helper: push one ABM profile as an audience member (deduped by identifier).
    const pushProfile = (profile: AbmLeadProfile): boolean => {
      const email = profile.email?.trim().toLowerCase();
      const phone = (profile.phone ?? profile["phoneNumber"])?.toString().trim();
      if (!email && !phone) return false;           // no matchable identifier
      const dedupeKey = email ?? phone!;
      if (seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);
      const { firstName, lastName } = splitName(profile);
      members.push({
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
        ...(profile["country"] ? { country: profile["country"] } : {}),
      });
      return true;
    };

    // 1) Behaviourally-qualified visitors: profiles linked to an ABM lead's PII.
    if (wantedLeadIds.length > 0) {
      const uniqueIds = Array.from(new Set(wantedLeadIds));
      const { data: leadData } = await db
        .from("abm_leads")
        .select("id, profile")
        .eq("tenant_id", tenantId)
        .in("id", uniqueIds);
      const profileById = new Map<string, AbmLeadProfile>();
      for (const l of (leadData ?? []) as Array<{ id: string; profile: AbmLeadProfile }>) {
        profileById.set(String(l.id), l.profile ?? {});
      }
      for (const row of keptRows) {
        const profile = profileById.get(String(row.abm_lead_id));
        if (!profile) continue;
        pushProfile(profile);
        if (members.length >= hardCap) break;
      }
    }

    // 2) First-party ABM target accounts: known leads you explicitly target, even
    //    if they haven't visited yet. They are "known" identity level and count as
    //    first-party (legitimate interest), so they pass the consent gate. Only
    //    excluded when a stricter minIdentityLevel ("customer") is required.
    const minBlocksKnown = segment.minIdentityLevel === "customer";
    if (!minBlocksKnown && members.length < hardCap) {
      const { data: abmData } = await db
        .from("abm_leads")
        .select("profile, segment_hint")
        .eq("tenant_id", tenantId)
        .eq("status", "active");
      for (const l of (abmData ?? []) as Array<{ profile: AbmLeadProfile; segment_hint: string | null }>) {
        if (segment.segmentKey && l.segment_hint !== segment.segmentKey) continue;
        pushProfile(l.profile ?? {});
        if (members.length >= hardCap) break;
      }
    }

    return members;
  } catch (err) {
    logger.warn("[ad-sync] resolveAudienceMembers failed", {
      tenantId, err: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
