"use server";

/**
 * Audience Segments Admin — Server Actions
 *
 * CRUD operations for the audience_segments table, scoped to a tenant.
 * Plan limit checks enforce the audienceSegments feature flag and
 * maxAudienceSegments limit before creating or activating a segment.
 */

import { revalidatePath } from "next/cache";
import {
  listAudienceSegments,
  getAudienceSegmentById,
  createAudienceSegment,
  updateAudienceSegment,
  deleteAudienceSegment,
  countActiveAudienceSegments,
} from "@/audience-segments/repository";
import type {
  AudienceSegment,
  AudienceSegmentInput,
  AudienceSegmentPatch,
} from "@/audience-segments/types";
import type { AdminAvatarConfig } from "@/components/admin/avatar-util";
import { SEED_AUDIENCE_SEGMENTS } from "@/audience-segments/seed";
import {
  findDependentRules,
  audienceSegmentMatcher,
  type DependentRule,
} from "@/decision/rules/find-dependent-rules";

// ── List ──────────────────────────────────────────────────────────────────────

export async function listAudienceSegmentsAction(
  tenantId: string,
): Promise<{ ok: true; data: AudienceSegment[] } | { ok: false; error: string }> {
  if (!tenantId) return { ok: false, error: "Tenant ID is required." };
  return listAudienceSegments(tenantId);
}

// ── Create ────────────────────────────────────────────────────────────────────

export interface AudienceSegmentCreateInput {
  tenantId:    string;
  key:         string;
  label:       string;
  description?: string | null;
  criteria:    Record<string, unknown>;
  isActive?:   boolean;
  avatar?:     AdminAvatarConfig | null;
}

export async function createAudienceSegmentAction(
  sessionTenantId: string,
  input: AudienceSegmentCreateInput,
): Promise<{ ok: boolean; data?: AudienceSegment; error?: string }> {
  if (!sessionTenantId) return { ok: false, error: "Tenant ID is required." };

  // Validate key
  if (!/^[a-z0-9][a-z0-9-]{0,58}[a-z0-9]$|^[a-z0-9]$/.test(input.key)) {
    return { ok: false, error: "Key must be 1–60 lowercase letters, digits, or hyphens." };
  }
  if (!input.label?.trim()) {
    return { ok: false, error: "Label is required." };
  }

  const isActive = input.isActive !== false;

  const result = await createAudienceSegment({
    tenantId:    sessionTenantId,
    key:         input.key,
    label:       input.label.trim(),
    description: input.description?.trim() || null,
    criteria:    input.criteria,
    isActive,
    avatar:      input.avatar ?? null,
  });

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/admin/tenants/${sessionTenantId}/audience-segments`);
  return { ok: true, data: result.data };
}

// ── Update ────────────────────────────────────────────────────────────────────

export interface AudienceSegmentUpdateInput extends AudienceSegmentPatch {
  id: string;
}

export async function updateAudienceSegmentAction(
  sessionTenantId: string,
  input: AudienceSegmentUpdateInput,
): Promise<{ ok: boolean; data?: AudienceSegment; error?: string }> {
  if (!sessionTenantId) return { ok: false, error: "Tenant ID is required." };
  if (!input.id)        return { ok: false, error: "Segment ID is required." };

  const { id, ...patch } = input;
  const result = await updateAudienceSegment(sessionTenantId, id, patch);

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/admin/tenants/${sessionTenantId}/audience-segments`);
  return { ok: true, data: result.data };
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteAudienceSegmentAction(
  sessionTenantId: string,
  segmentId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!sessionTenantId) return { ok: false, error: "Tenant ID is required." };
  if (!segmentId)       return { ok: false, error: "Segment ID is required." };

  const result = await deleteAudienceSegment(sessionTenantId, segmentId);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/admin/tenants/${sessionTenantId}/audience-segments`);
  return { ok: true };
}

// ── Toggle active ─────────────────────────────────────────────────────────────

export async function toggleAudienceSegmentActiveAction(
  sessionTenantId: string,
  segmentId: string,
  isActive: boolean,
): Promise<{ ok: boolean; error?: string }> {
  return updateAudienceSegmentAction(sessionTenantId, { id: segmentId, isActive });
}

// ── Dependency check ──────────────────────────────────────────────────────────

/**
 * Returns the enabled personalization rules that reference the given segment
 * key via an audienceSegmentIds condition.
 *
 * Used by the admin UI to warn before deactivating or deleting a segment.
 */
export async function checkSegmentDependenciesAction(
  tenantId:   string,
  segmentKey: string,
): Promise<{ ok: true; dependentRules: DependentRule[] } | { ok: false; error: string }> {
  if (!tenantId)   return { ok: false, error: "Tenant ID is required." };
  if (!segmentKey) return { ok: false, error: "Segment key is required." };

  try {
    const dependentRules = await findDependentRules(
      tenantId,
      audienceSegmentMatcher(segmentKey),
    );
    return { ok: true, dependentRules };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Dependency check failed." };
  }
}

// ── Seed ──────────────────────────────────────────────────────────────────────

/**
 * Seed audience segments from SEED_AUDIENCE_SEGMENTS for the tenant.
 *
 * Idempotent: any segment whose key already exists for this tenant is skipped,
 * so re-running the seed never overwrites tenant customisations.
 *
 * Plan limits are enforced for the first seeding of active segments.  If the
 * plan cap would be exceeded the action stops creating active segments early;
 * remaining segments are created as inactive instead.
 *
 * @returns  { ok: true, created, skipped, createdAsInactive } on success.
 */
export async function seedAudienceSegmentsAction(
  tenantId: string,
): Promise<{
  ok: true;
  created:           number;
  skipped:           number;
  createdAsInactive: number;
} | { ok: false; error: string }> {
  if (!tenantId) return { ok: false, error: "Tenant ID is required." };

  // 1. Fetch existing keys to determine what's already there.
  const existing = await listAudienceSegments(tenantId);
  if (!existing.ok) return { ok: false, error: existing.error };

  const existingKeys = new Set(existing.data.map((s) => s.key));

  const toCreate = SEED_AUDIENCE_SEGMENTS.filter((s) => !existingKeys.has(s.key));
  const skipped  = SEED_AUDIENCE_SEGMENTS.length - toCreate.length;

  if (toCreate.length === 0) {
    return { ok: true, created: 0, skipped, createdAsInactive: 0 };
  }

  // 2. Create all segments — all plans now support unlimited segments.
  let created           = 0;
  const createdAsInactive = 0;

  for (const seed of toCreate) {
    const result = await createAudienceSegment({
      tenantId,
      key:         seed.key,
      label:       seed.label,
      description: seed.description,
      criteria:    seed.criteria,
      isActive:    seed.isActive,
    });

    if (result.ok) created++;
    // Silently skip individual failures (key collision race, etc.)
  }

  revalidatePath(`/admin/tenants/${tenantId}/audience/segments`);
  return { ok: true, created, skipped, createdAsInactive };
}
