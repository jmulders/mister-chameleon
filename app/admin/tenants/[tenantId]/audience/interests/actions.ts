/**
 * Tenant Interest Profiles — Server Actions
 *
 * Tenant-scoped mutations for the interest_profiles table.
 * All writes are locked to the given tenantId — operators cannot read or
 * modify profiles that belong to a different tenant.
 *
 * ─── Scoping rules ─────────────────────────────────────────────────────────────
 *
 *   - Create: always inserts with tenant_id = tenantId
 *   - Update/Delete: verifies the profile belongs to this tenant before writing
 *   - List: returns tenant-scoped + platform-wide profiles (tenant_id = tenantId OR NULL)
 *
 * ─── Action inventory ─────────────────────────────────────────────────────────
 *
 *   listTenantInterestProfilesAction(tenantId)
 *     Lists all profiles visible to the tenant (own + platform), active + inactive.
 *
 *   createTenantInterestProfileAction(tenantId, input)
 *     Creates a new profile scoped to this tenant.
 *
 *   updateTenantInterestProfileAction(tenantId, id, input)
 *     Updates a tenant-owned profile. Rejects platform-wide profiles.
 *
 *   deleteTenantInterestProfileAction(tenantId, id)
 *     Deletes a tenant-owned profile. Rejects platform-wide profiles.
 *
 *   getTenantInterestProfileAction(tenantId, id)
 *     Loads a single profile by ID, with tenant access verification.
 */

"use server";

import {
  listAllInterestProfilesForTenant,
  listInterestProfilesWithOverrides,
  getInterestProfileById,
  createInterestProfile,
  updateInterestProfile,
  deleteInterestProfile,
  setTenantProfileOverride,
} from "@/interest-profiles/repository";
import type { InterestProfile, InterestTag } from "@/interest-profiles/types";
import { parseAvatarConfig }                 from "@/components/admin/avatar-util";
import { getDb }                             from "@/data/db";
import {
  findDependentRules,
  interestProfileMatcher,
  type DependentRule,
} from "@/decision/rules/find-dependent-rules";

// ── Shared result type ────────────────────────────────────────────────────────

export type TenantProfileActionResult =
  | { ok: true;  profile: InterestProfile }
  | { ok: false; error: string; fieldErrors?: string[] };

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_KEY_LENGTH  = 60;
const MAX_NAME_LENGTH = 80;
const MAX_DESC_LENGTH = 500;
const KEY_PATTERN     = /^[a-z0-9_-]{1,60}$/;

const MIN_TAG_WEIGHT  = 0.1;
const MAX_TAG_WEIGHT  = 10;

// ── Plan limit helper ─────────────────────────────────────────────────────────

/**
 * Count the number of effectively active interest profiles for a tenant.
 * Includes:
 *   - Tenant-owned profiles with is_active = true
 *   - Platform-wide profiles with is_active = true that have NOT been disabled
 *     for this tenant via a tenant_interest_profiles override row
 */
async function countActiveProfilesForTenant(tenantId: string): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getDb() as unknown as { from: (t: string) => any };

  // Tenant-owned active count
  const { count: ownCount } = await db
    .from("interest_profiles")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  // Platform-wide active profiles that are not explicitly disabled for this tenant
  const { data: disabled } = await db
    .from("tenant_interest_profiles")
    .select("profile_key")
    .eq("tenant_id", tenantId)
    .eq("enabled", false);

  const disabledKeys = new Set<string>((disabled ?? []).map((r: { profile_key: string }) => r.profile_key));

  const { data: platformActive } = await db
    .from("interest_profiles")
    .select("key")
    .is("tenant_id", null)
    .eq("is_active", true);

  const platformCount = (platformActive ?? []).filter(
    (r: { key: string }) => !disabledKeys.has(r.key),
  ).length;

  return (ownCount ?? 0) + platformCount;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function validateTags(raw: unknown): { tags: InterestTag[]; errors: string[] } {
  const errors: string[] = [];

  if (!Array.isArray(raw)) {
    return { tags: [], errors: ["tags: must be an array"] };
  }

  const tags: InterestTag[] = [];

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i] as Record<string, unknown>;

    const keyword = typeof item.keyword === "string" ? item.keyword.trim().toLowerCase() : "";
    if (keyword.length === 0) {
      errors.push(`tags[${i}]: keyword is required`);
      continue;
    }

    const weight = Number(item.weight);
    if (isNaN(weight) || weight < MIN_TAG_WEIGHT || weight > MAX_TAG_WEIGHT) {
      errors.push(`tags[${i}]: weight must be between ${MIN_TAG_WEIGHT} and ${MAX_TAG_WEIGHT}`);
      continue;
    }

    tags.push({ keyword, weight: Math.round(weight * 100) / 100 });
  }

  // Check for duplicate keywords.
  const seen = new Set<string>();
  for (const tag of tags) {
    if (seen.has(tag.keyword)) {
      errors.push(`tags: duplicate keyword "${tag.keyword}"`);
    }
    seen.add(tag.keyword);
  }

  return { tags, errors };
}

// ── listTenantInterestProfilesAction ─────────────────────────────────────────

export async function listTenantInterestProfilesAction(
  tenantId: string,
): Promise<{ ok: true; data: InterestProfile[] } | { ok: false; error: string }> {
  if (!tenantId) return { ok: false, error: "Tenant ID is required." };
  return listAllInterestProfilesForTenant(tenantId);
}

// ── listProfilesWithOverridesAction ──────────────────────────────────────────

export type { AnnotatedInterestProfile } from "@/interest-profiles/repository";
import type { AnnotatedInterestProfile } from "@/interest-profiles/repository";

export async function listProfilesWithOverridesAction(
  tenantId: string,
): Promise<{ ok: true; data: AnnotatedInterestProfile[] } | { ok: false; error: string }> {
  if (!tenantId) return { ok: false, error: "Tenant ID is required." };
  return listInterestProfilesWithOverrides(tenantId);
}

// ── setProfileEnabledAction ───────────────────────────────────────────────────

/**
 * Enable or disable a platform-wide interest profile for a specific tenant.
 * Only platform-wide profiles (tenantId = null) can be toggled this way.
 * Tenant-specific profiles should be activated/deactivated via updateTenantInterestProfileAction.
 */
export async function setProfileEnabledAction(
  tenantId:   string,
  profileKey: string,
  enabled:    boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!tenantId)   return { ok: false, error: "Tenant ID is required." };
  if (!profileKey) return { ok: false, error: "Profile key is required." };

  const result = await setTenantProfileOverride(tenantId, profileKey, enabled);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

// ── getTenantInterestProfileAction ────────────────────────────────────────────

/**
 * Returns a single profile by ID, with scope verification.
 * Platform profiles (tenantId = null) are readable by all tenants.
 */
export async function getTenantInterestProfileAction(
  tenantId: string,
  id:       string,
): Promise<{ ok: true; profile: InterestProfile } | { ok: false; error: string }> {
  if (!tenantId) return { ok: false, error: "Tenant ID is required." };
  if (!id)       return { ok: false, error: "Profile ID is required." };

  const result = await getInterestProfileById(id);
  if (!result.ok) return { ok: false, error: result.error };

  const profile = result.data;

  // Allow if: profile belongs to this tenant, or it's a platform-wide profile.
  if (profile.tenantId && profile.tenantId !== tenantId) {
    return { ok: false, error: "Profile not found." };
  }

  return { ok: true, profile };
}

// ── createTenantInterestProfileAction ─────────────────────────────────────────

export async function createTenantInterestProfileAction(
  tenantId: string,
  input:    unknown,
): Promise<TenantProfileActionResult> {
  if (!tenantId) return { ok: false, error: "Tenant ID is required." };
  if (typeof input !== "object" || input === null) {
    return { ok: false, error: "Invalid input: expected an object." };
  }

  const raw    = input as Record<string, unknown>;
  const errors: string[] = [];

  // ── key ─────────────────────────────────────────────────────────────────────
  const rawKey = typeof raw.key === "string" ? raw.key.trim().toLowerCase() : "";
  if (rawKey.length === 0) {
    errors.push("key: required");
  } else if (!KEY_PATTERN.test(rawKey)) {
    errors.push(
      `key: 1: ${MAX_KEY_LENGTH} chars; lowercase letters, digits, hyphens, and underscores only`,
    );
  }

  // ── name ─────────────────────────────────────────────────────────────────────
  const rawName = typeof raw.name === "string" ? raw.name.trim() : "";
  if (rawName.length === 0) {
    errors.push("name: required");
  } else if (rawName.length > MAX_NAME_LENGTH) {
    errors.push(`name: must be ≤ ${MAX_NAME_LENGTH} characters`);
  }

  // ── description (optional) ────────────────────────────────────────────────────
  const rawDesc = typeof raw.description === "string" ? raw.description.trim() : "";
  if (rawDesc.length > MAX_DESC_LENGTH) {
    errors.push(`description: must be ≤ ${MAX_DESC_LENGTH} characters`);
  }

  // ── tags ─────────────────────────────────────────────────────────────────────
  const { tags, errors: tagErrors } = validateTags(raw.tags ?? []);
  errors.push(...tagErrors);

  // ── is_active (optional, defaults to true) ────────────────────────────────────
  const isActive = raw.is_active !== false;

  if (errors.length > 0) {
    return {
      ok: false,
      error: `Validation failed (${errors.length} issue${errors.length === 1 ? "" : "s"}).`,
      fieldErrors: errors,
    };
  }

  const result = await createInterestProfile({
    tenant_id:   tenantId,
    key:         rawKey,
    name:        rawName,
    description: rawDesc || null,
    tags,
    is_active:   isActive,
    avatar:      parseAvatarConfig(raw.avatar),
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return { ok: true, profile: result.data };
}

// ── updateTenantInterestProfileAction ─────────────────────────────────────────

export async function updateTenantInterestProfileAction(
  tenantId: string,
  id:       string,
  input:    unknown,
): Promise<TenantProfileActionResult> {
  if (!tenantId) return { ok: false, error: "Tenant ID is required." };
  if (!id)       return { ok: false, error: "Profile ID is required." };

  // Verify this profile belongs to this tenant (not platform-wide).
  const existing = await getInterestProfileById(id);
  if (!existing.ok) return { ok: false, error: existing.error };
  if (!existing.data.tenantId || existing.data.tenantId !== tenantId) {
    return { ok: false, error: "Platform-wide profiles cannot be edited here. Use the global Interests admin." };
  }

  if (typeof input !== "object" || input === null) {
    return { ok: false, error: "Invalid input: expected an object." };
  }

  const raw    = input as Record<string, unknown>;
  const errors: string[] = [];
  const patch: Record<string, unknown> = {};

  // ── name ─────────────────────────────────────────────────────────────────────
  if ("name" in raw) {
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (name.length === 0) {
      errors.push("name: required");
    } else if (name.length > MAX_NAME_LENGTH) {
      errors.push(`name: must be ≤ ${MAX_NAME_LENGTH} characters`);
    } else {
      patch.name = name;
    }
  }

  // ── description ──────────────────────────────────────────────────────────────
  if ("description" in raw) {
    const desc = typeof raw.description === "string" ? raw.description.trim() : "";
    if (desc.length > MAX_DESC_LENGTH) {
      errors.push(`description: must be ≤ ${MAX_DESC_LENGTH} characters`);
    } else {
      patch.description = desc || null;
    }
  }

  // ── tags ─────────────────────────────────────────────────────────────────────
  if ("tags" in raw) {
    const { tags, errors: tagErrors } = validateTags(raw.tags);
    if (tagErrors.length > 0) {
      errors.push(...tagErrors);
    } else {
      patch.tags = tags;
    }
  }

  // ── is_active ────────────────────────────────────────────────────────────────
  if ("is_active" in raw) {
    const newActive = raw.is_active !== false;
    patch.is_active = newActive;

  }

  // ── avatar (optional; null/invalid → clears to the deterministic badge) ───────
  if ("avatar" in raw) {
    patch.avatar = parseAvatarConfig(raw.avatar);
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: `Validation failed (${errors.length} issue${errors.length === 1 ? "" : "s"}).`,
      fieldErrors: errors,
    };
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "No fields provided to update." };
  }

  const result = await updateInterestProfile(id, patch as Parameters<typeof updateInterestProfile>[1]);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return { ok: true, profile: result.data };
}

// ── checkInterestProfileDependenciesAction ────────────────────────────────────

/**
 * Returns the enabled personalization rules that reference the given interest
 * profile via a field condition (per-profile score, interestPrimary, or
 * interestSecondary).
 *
 * Used by the admin UI to show a confirmation dialog before disabling a
 * profile so admins know which rules will silently stop matching.
 */
export async function checkInterestProfileDependenciesAction(
  tenantId:   string,
  profileKey: string,
): Promise<{ ok: true; dependentRules: DependentRule[] } | { ok: false; error: string }> {
  if (!tenantId)   return { ok: false, error: "Tenant ID is required." };
  if (!profileKey) return { ok: false, error: "Profile key is required." };

  try {
    const dependentRules = await findDependentRules(
      tenantId,
      interestProfileMatcher(profileKey),
    );
    return { ok: true, dependentRules };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Dependency check failed." };
  }
}

// ── deleteTenantInterestProfileAction ─────────────────────────────────────────

export async function deleteTenantInterestProfileAction(
  tenantId: string,
  id:       string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!tenantId) return { ok: false, error: "Tenant ID is required." };
  if (!id)       return { ok: false, error: "Profile ID is required." };

  // Verify this profile belongs to this tenant (not platform-wide).
  const existing = await getInterestProfileById(id);
  if (!existing.ok) return { ok: false, error: existing.error };
  if (!existing.data.tenantId || existing.data.tenantId !== tenantId) {
    return { ok: false, error: "Platform-wide profiles cannot be deleted here. Use the global Interests admin." };
  }

  const result = await deleteInterestProfile(id);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return { ok: true };
}
