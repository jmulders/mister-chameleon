/**
 * Audience Segments Repository
 *
 * Data access layer for the `audience_segments` table.
 * All operations are tenant-scoped.
 * Returns typed result objects — never throws.
 */

import "server-only";

import { getDb }  from "@/data/db";
import type {
  AudienceSegment,
  AudienceSegmentInput,
  AudienceSegmentPatch,
  AudienceSegmentRow,
} from "./types";

// ── Type assertion helpers ────────────────────────────────────────────────────

type SelectResult<T> = { data: T[] | null; error: { message: string; code?: string } | null };
type SingleResult<T> = { data: T  | null; error: { message: string; code?: string } | null };
type VoidResult      = { error?: { message: string; code?: string } | null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbAny() { return getDb() as any; }
function asRows<T>(r: unknown):  SelectResult<T>  { return r as SelectResult<T>; }
function asSingle<T>(r: unknown): SingleResult<T> { return r as SingleResult<T>; }
function asVoid(r: unknown):      VoidResult       { return r as VoidResult; }

type RepositoryResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: string };

// ── Row → domain mapping ──────────────────────────────────────────────────────

function fromRow(row: AudienceSegmentRow): AudienceSegment {
  return {
    id:          row.id,
    tenantId:    row.tenant_id,
    key:         row.key,
    label:       row.label,
    description: row.description ?? null,
    criteria:    row.criteria ?? {},
    isActive:    row.is_active,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  };
}

// ── List ──────────────────────────────────────────────────────────────────────

/**
 * List all audience segments for a tenant (active + inactive), ordered by label.
 */
export async function listAudienceSegments(
  tenantId: string,
): Promise<RepositoryResult<AudienceSegment[]>> {
  const db = dbAny();
  const res = asRows<AudienceSegmentRow>(
    await db
      .from("audience_segments")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("label"),
  );
  if (res.error) return { ok: false, error: res.error.message };
  return { ok: true, data: (res.data ?? []).map(fromRow) };
}

/**
 * List only active audience segments for a tenant, ordered by label.
 * Used at runtime to evaluate which segments to check.
 */
export async function listActiveAudienceSegments(
  tenantId: string,
): Promise<RepositoryResult<AudienceSegment[]>> {
  const db = dbAny();
  const res = asRows<AudienceSegmentRow>(
    await db
      .from("audience_segments")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("label"),
  );
  if (res.error) return { ok: false, error: res.error.message };
  return { ok: true, data: (res.data ?? []).map(fromRow) };
}

// ── Get single ────────────────────────────────────────────────────────────────

/**
 * Fetch a single audience segment by ID with tenant scope check.
 */
export async function getAudienceSegmentById(
  tenantId: string,
  id:       string,
): Promise<RepositoryResult<AudienceSegment>> {
  const db = dbAny();
  const res = asSingle<AudienceSegmentRow>(
    await db
      .from("audience_segments")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .maybeSingle(),
  );
  if (res.error) return { ok: false, error: res.error.message };
  if (!res.data)  return { ok: false, error: "Segment not found." };
  return { ok: true, data: fromRow(res.data) };
}

// ── Create ────────────────────────────────────────────────────────────────────

/**
 * Insert a new audience segment.
 */
export async function createAudienceSegment(
  input: AudienceSegmentInput,
): Promise<RepositoryResult<AudienceSegment>> {
  const db = dbAny();
  const row = {
    tenant_id:   input.tenantId,
    key:         input.key,
    label:       input.label,
    description: input.description ?? null,
    criteria:    input.criteria,
    is_active:   input.isActive ?? true,
  };

  const res = asSingle<AudienceSegmentRow>(
    await db.from("audience_segments").insert(row).select("*").single(),
  );
  if (res.error) return { ok: false, error: res.error.message };
  if (!res.data)  return { ok: false, error: "Insert returned no data." };
  return { ok: true, data: fromRow(res.data) };
}

// ── Update ────────────────────────────────────────────────────────────────────

/**
 * Update an existing audience segment.
 * Only the fields present in `patch` are updated.
 */
export async function updateAudienceSegment(
  tenantId: string,
  id:       string,
  patch:    AudienceSegmentPatch,
): Promise<RepositoryResult<AudienceSegment>> {
  const db = dbAny();
  const row: Record<string, unknown> = {};

  if ("label"       in patch) row.label       = patch.label;
  if ("description" in patch) row.description = patch.description ?? null;
  if ("criteria"    in patch) row.criteria    = patch.criteria;
  if ("isActive"    in patch) row.is_active   = patch.isActive;

  const res = asSingle<AudienceSegmentRow>(
    await db
      .from("audience_segments")
      .update(row)
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select("*")
      .single(),
  );
  if (res.error) return { ok: false, error: res.error.message };
  if (!res.data)  return { ok: false, error: "Segment not found or update returned no data." };
  return { ok: true, data: fromRow(res.data) };
}

// ── Delete ────────────────────────────────────────────────────────────────────

/**
 * Delete an audience segment (scoped to tenant).
 */
export async function deleteAudienceSegment(
  tenantId: string,
  id:       string,
): Promise<RepositoryResult<null>> {
  const db = dbAny();
  const res = asVoid(
    await db
      .from("audience_segments")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantId),
  );
  if (res.error) return { ok: false, error: res.error.message };
  return { ok: true, data: null };
}

// ── Count active ──────────────────────────────────────────────────────────────

/**
 * Count the number of active audience segments for a tenant.
 * Used by the plan limit check in server actions.
 */
export async function countActiveAudienceSegments(
  tenantId: string,
): Promise<number> {
  const db = dbAny();
  const { count } = await db
    .from("audience_segments")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("is_active", true);
  return count ?? 0;
}
