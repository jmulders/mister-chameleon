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
  lastSeenAt:   string | null;
  visitCount:   number;
}

/** A single recorded visit (one /go arrival). */
export interface AbmLeadVisit {
  id:        string;
  leadId:    string;
  path:      string;
  visitedAt: string;
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
    lastSeenAt:  (row.last_seen_at as string | null) ?? null,
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

/**
 * Record a visit: bump visit_count, set first_seen_at if unset, refresh
 * last_seen_at, and append a row to the per-lead visit log. Fire-and-forget safe.
 */
export async function recordAbmVisit(id: string, path = "/"): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const now = new Date().toISOString();
    const { data } = await db
      .from("abm_leads")
      .select("tenant_id, visit_count, first_seen_at")
      .eq("id", id)
      .maybeSingle();
    if (!data) return;
    const nextCount = Number(data.visit_count ?? 0) + 1;
    await db
      .from("abm_leads")
      .update({
        visit_count:   nextCount,
        first_seen_at: data.first_seen_at ?? now,
        last_seen_at:  now,
        updated_at:    now,
      })
      .eq("id", id);
    // Append to the activity log (best-effort; never blocks the redirect).
    await db.from("abm_lead_visits").insert({
      lead_id:    id,
      tenant_id:  String(data.tenant_id),
      path:       path || "/",
      visited_at: now,
    });
  } catch (err) {
    logger.warn("[abm-store] recordAbmVisit failed", {
      id, err: err instanceof Error ? err.message : String(err),
    });
  }
}

/** List recent visits for a lead (admin), newest first. */
export async function listAbmLeadVisits(leadId: string, limit = 25): Promise<AbmLeadVisit[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const { data, error } = await db
      .from("abm_lead_visits")
      .select("id, lead_id, path, visited_at")
      .eq("lead_id", leadId)
      .order("visited_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map((r) => ({
      id:        String(r.id),
      leadId:    String(r.lead_id),
      path:      String(r.path ?? "/"),
      visitedAt: String(r.visited_at),
    }));
  } catch (err) {
    logger.warn("[abm-store] listAbmLeadVisits failed", {
      leadId, err: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

// ── ABM tenant settings (outbound webhook) ──────────────────────────────────────

/** Fetch the tenant's outbound webhook URL (or null when unset). */
export async function getAbmWebhookUrl(tenantId: string): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const { data, error } = await db
      .from("abm_settings")
      .select("webhook_url")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error || !data) return null;
    const url = (data.webhook_url as string | null) ?? null;
    return url && url.trim() ? url.trim() : null;
  } catch {
    return null;
  }
}

/** Fetch the tenant's HubSpot private-app token (or null when unset). */
export async function getAbmHubspotToken(tenantId: string): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const { data, error } = await db
      .from("abm_settings")
      .select("hubspot_token")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error || !data) return null;
    const token = (data.hubspot_token as string | null) ?? null;
    return token && token.trim() ? token.trim() : null;
  } catch {
    return null;
  }
}

/** Upsert the tenant's HubSpot private-app token (admin). Pass null/empty to clear. */
export async function setAbmHubspotToken(tenantId: string, token: string | null): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const { error } = await db
      .from("abm_settings")
      .upsert(
        { tenant_id: tenantId, hubspot_token: token?.trim() || null, updated_at: new Date().toISOString() },
        { onConflict: "tenant_id" },
      );
    return !error;
  } catch (err) {
    logger.warn("[abm-store] setAbmHubspotToken failed", {
      tenantId, err: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/** Upsert the tenant's outbound webhook URL (admin). Pass null/empty to clear. */
export async function setAbmWebhookUrl(tenantId: string, webhookUrl: string | null): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const { error } = await db
      .from("abm_settings")
      .upsert(
        { tenant_id: tenantId, webhook_url: webhookUrl?.trim() || null, updated_at: new Date().toISOString() },
        { onConflict: "tenant_id" },
      );
    return !error;
  } catch (err) {
    logger.warn("[abm-store] setAbmWebhookUrl failed", {
      tenantId, err: err instanceof Error ? err.message : String(err),
    });
    return false;
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
