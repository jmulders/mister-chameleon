/**
 * ABM lead store — CRUD + lookup for the `abm_leads` table.
 *
 * Backs Account-Based Marketing personalized URLs (PURLs): an opaque identifier
 * (or vanity path) maps to a known lead profile + a redirect target. The Node
 * side (admin + AbmLeadEnricher) uses this store; the edge middleware does its
 * own lightweight identifier→target lookup (see middleware.ts).
 *
 * Accessed via the service-role client. See docs/abm-personalized-urls.md.
 */

import "server-only";

import { getDb }  from "@/data/db";
import { logger } from "@/lib/logger";

// ── Types ────────────────────────────────────────────────────────────────────

export interface AbmLeadProfile {
  /** Used for a named greeting, e.g. "Hi John". */
  firstName?:   string;
  /** Full name. */
  name?:        string;
  company?:     string;
  role?:        string;
  industry?:    string;
  /** Free-form size bucket, e.g. "11-50", "1000+". */
  companySize?: string;
  linkedinUrl?: string;
  /** Any extra fields captured from the Sales Navigator import. */
  [key: string]: string | undefined;
}

export type AbmLeadStatus = "active" | "paused" | "expired";

export interface AbmLead {
  id:           string;
  tenantId:     string;
  identifier:   string;
  vanityPath:   string | null;
  targetPath:   string;
  profile:      AbmLeadProfile;
  segmentHint:  string | null;
  status:       AbmLeadStatus;
  expiresAt:    string | null;
  firstSeenAt:  string | null;
  visitCount:   number;
}

// ── Mapping ──────────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): AbmLead {
  return {
    id:          String(row.id),
    tenantId:    String(row.tenant_id),
    identifier:  String(row.identifier),
    vanityPath:  (row.vanity_path as string | null) ?? null,
    targetPath:  (row.target_path as string) ?? "/",
    profile:     (row.profile as AbmLeadProfile) ?? {},
    segmentHint: (row.segment_hint as string | null) ?? null,
    status:      ((row.status as AbmLeadStatus) ?? "active"),
    expiresAt:   (row.expires_at as string | null) ?? null,
    firstSeenAt: (row.first_seen_at as string | null) ?? null,
    visitCount:  Number(row.visit_count ?? 0),
  };
}

/** An active lead is status=active and not past its expiry. */
function isLive(lead: AbmLead): boolean {
  if (lead.status !== "active") return false;
  if (lead.expiresAt && new Date(lead.expiresAt).getTime() < Date.now()) return false;
  return true;
}

// ── Reads ────────────────────────────────────────────────────────────────────

/**
 * Resolve a lead by its opaque identifier OR vanity path, scoped to a tenant.
 * Returns null for unknown, paused, or expired leads (fail-open at the caller).
 */
export async function getAbmLeadByHandle(
  tenantId: string,
  handle:   string,
): Promise<AbmLead | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const { data, error } = await db
      .from("abm_leads")
      .select("*")
      .eq("tenant_id", tenantId)
      .or(`identifier.eq.${handle},vanity_path.eq.${handle}`)
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const lead = mapRow(data);
    return isLive(lead) ? lead : null;
  } catch (err) {
    logger.warn("[abm-store] getAbmLeadByHandle failed", {
      tenantId, handle, err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Fetch a single lead by its primary id (used by the Node enricher via cookie). */
export async function getAbmLeadById(id: string): Promise<AbmLead | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const { data, error } = await db.from("abm_leads").select("*").eq("id", id).maybeSingle();
    if (error || !data) return null;
    return mapRow(data);
  } catch (err) {
    logger.warn("[abm-store] getAbmLeadById failed", {
      id, err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** List all leads for a tenant (admin). Newest first. */
export async function listAbmLeads(tenantId: string): Promise<AbmLead[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const { data, error } = await db
      .from("abm_leads")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map(mapRow);
  } catch (err) {
    logger.warn("[abm-store] listAbmLeads failed", {
      tenantId, err: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

// ── Writes ───────────────────────────────────────────────────────────────────

export interface AbmLeadInput {
  id?:          string;
  tenantId:     string;
  identifier:   string;
  vanityPath?:  string | null;
  targetPath:   string;
  profile:      AbmLeadProfile;
  segmentHint?: string | null;
  status?:      AbmLeadStatus;
  expiresAt?:   string | null;
}

/** Insert or update a lead (admin). Returns the saved row or null on failure. */
export async function upsertAbmLead(input: AbmLeadInput): Promise<AbmLead | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const row = {
      ...(input.id ? { id: input.id } : {}),
      tenant_id:    input.tenantId,
      identifier:   input.identifier,
      vanity_path:  input.vanityPath ?? null,
      target_path:  input.targetPath || "/",
      profile:      input.profile ?? {},
      segment_hint: input.segmentHint ?? null,
      status:       input.status ?? "active",
      expires_at:   input.expiresAt ?? null,
      updated_at:   new Date().toISOString(),
    };
    const { data, error } = await db
      .from("abm_leads")
      .upsert(row, { onConflict: "tenant_id,identifier" })
      .select("*")
      .maybeSingle();
    if (error || !data) {
      logger.warn("[abm-store] upsertAbmLead failed", { error: error?.message });
      return null;
    }
    return mapRow(data);
  } catch (err) {
    logger.warn("[abm-store] upsertAbmLead threw", {
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Record a visit: bump visit_count and set first_seen_at if unset. Fire-and-forget safe. */
export async function recordAbmVisit(id: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const { data } = await db.from("abm_leads").select("visit_count, first_seen_at").eq("id", id).maybeSingle();
    const nextCount = Number(data?.visit_count ?? 0) + 1;
    await db
      .from("abm_leads")
      .update({
        visit_count:   nextCount,
        first_seen_at: data?.first_seen_at ?? new Date().toISOString(),
        updated_at:    new Date().toISOString(),
      })
      .eq("id", id);
  } catch (err) {
    logger.warn("[abm-store] recordAbmVisit failed", {
      id, err: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Delete a lead (admin). */
export async function deleteAbmLead(id: string): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const { error } = await db.from("abm_leads").delete().eq("id", id);
    return !error;
  } catch {
    return false;
  }
}
