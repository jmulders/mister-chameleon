/**
 * Interest Profiles Repository
 *
 * Data access layer for the `interest_profiles` and
 * `tenant_interest_profiles` tables.
 * Returns typed result objects — never throws.
 */

import "server-only";

import { getDb }                      from "@/data/db";
import { logger }                     from "@/lib/logger";
import { INTEREST_PROFILE_CATALOG }   from "./catalog";
import type {
  InterestProfile,
  InterestProfileFamily,
  InterestProfileDefaultStatus,
  InterestProfileRow,
  InterestProfileInsert,
} from "./types";

// ── Tenant override row type (internal) ───────────────────────────────────────

interface TenantInterestProfileOverrideRow {
  id:          string;
  tenant_id:   string;
  profile_key: string;
  enabled:     boolean;
  created_at:  string;
  updated_at:  string;
}

// ── Type assertion helper ─────────────────────────────────────────────────────
// Supabase's auto-generated discriminant is absent in our hand-authored
// Database type, causing .select() to resolve to `never[]` when columns are
// named explicitly.  Casting through unknown is safe here — the shape is
// verified at write time via the Insert interfaces above.

type SelectResult<T> = { data: T[] | null; error: { message: string; code?: string } | null };
type SingleResult<T> = { data: T | null;   error: { message: string; code?: string } | null };

function asRows<T>(result: unknown): SelectResult<T> {
  return result as SelectResult<T>;
}

function asSingle<T>(result: unknown): SingleResult<T> {
  return result as SingleResult<T>;
}

type RepositoryResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: string };

// ── Known family values ───────────────────────────────────────────────────────

const VALID_FAMILIES = new Set<string>([
  "b2b_saas", "careers", "commerce", "real_estate",
]);

function toFamily(val: string | null): InterestProfileFamily | undefined {
  if (val && VALID_FAMILIES.has(val)) return val as InterestProfileFamily;
  return undefined;
}

function toDefaultStatus(val: string | null): InterestProfileDefaultStatus | undefined {
  if (val === "active" || val === "suggested") return val;
  return undefined;
}

// ── Row → domain type ─────────────────────────────────────────────────────────

function fromRow(row: InterestProfileRow): InterestProfile {
  return {
    id:                    row.id,
    key:                   row.key,
    name:                  row.name,
    description:           row.description ?? undefined,
    tags:                  row.tags ?? [],
    isActive:              row.is_active,
    family:                toFamily(row.family ?? null),
    recommendedSiteModels: row.recommended_site_models ?? [],
    defaultStatus:         toDefaultStatus(row.default_status ?? null),
    tenantId:              row.tenant_id ?? undefined,
  };
}

// ── listActiveInterestProfiles ────────────────────────────────────────────────

/**
 * Returns all active interest profiles visible to a given tenant, ordered by name.
 * Used by the scoring engine on each page request.
 *
 * When `tenantId` is provided, returns both:
 *   - tenant-specific profiles (tenant_id = tenantId)  — always included
 *   - platform-wide profiles   (tenant_id IS NULL)      — filtered by tenant overrides
 *
 * Platform-wide profiles are excluded when the tenant has an explicit
 * `tenant_interest_profiles` row with `enabled = false` for that profile_key.
 * Absence of a row means "enabled" (the default).
 *
 * When `tenantId` is omitted or null, returns only platform-wide profiles
 * (no per-tenant filtering applied).
 */
export async function listActiveInterestProfiles(
  tenantId?: string | null,
): Promise<RepositoryResult<InterestProfile[]>> {
  try {
    const base = getDb()
      .from("interest_profiles")
      .select("*")
      .eq("is_active", true as never);

    const result = asRows<InterestProfileRow>(
      tenantId
        ? await base
            .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
            .order("name")
        : await base
            .is("tenant_id", null as never)
            .order("name"),
    );

    if (result.error) {
      logger.warn("[interest-profiles] Failed to load profiles", { error: result.error.message });
      return { ok: false, error: result.error.message };
    }

    let profiles = (result.data ?? []).map(fromRow);

    // ── Apply per-tenant enable/disable overrides ─────────────────────────────
    //
    // Only applies when tenantId is known.  Tenant-specific profiles (owned by
    // this tenant) are never filtered — overrides only apply to platform-wide ones.
    //
    // Gracefully ignores errors: if the overrides table doesn't exist (migration 088
    // not yet applied), all profiles pass through unchanged.
    if (tenantId) {
      const overrides = await getTenantProfileOverrides(tenantId);
      const disabledKeys = new Set(
        Object.entries(overrides)
          .filter(([, enabled]) => !enabled)
          .map(([key]) => key),
      );

      if (disabledKeys.size > 0) {
        profiles = profiles.filter((p) => {
          // Never filter out tenant-specific profiles — only platform-wide ones.
          if (p.tenantId) return true;
          return !disabledKeys.has(p.key);
        });
      }
    }

    return { ok: true, data: profiles };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn("[interest-profiles] Unexpected error loading profiles", { error: msg });
    return { ok: false, error: msg };
  }
}

// ── listAllInterestProfiles ───────────────────────────────────────────────────

/**
 * Returns all platform-wide interest profiles (tenant_id IS NULL), active + inactive.
 * Used by the global admin at /admin/interest-profiles.
 */
export async function listAllInterestProfiles(): Promise<RepositoryResult<InterestProfile[]>> {
  try {
    const result = asRows<InterestProfileRow>(
      await getDb()
        .from("interest_profiles")
        .select("*")
        .is("tenant_id", null as never)
        .order("name"),
    );

    if (result.error) {
      logger.warn("[interest-profiles] Failed to list all profiles", { error: result.error.message });
      return { ok: false, error: result.error.message };
    }

    return { ok: true, data: (result.data ?? []).map(fromRow) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

// ── listAllInterestProfilesForTenant ─────────────────────────────────────────

/**
 * Returns all profiles visible to a tenant (tenant-specific + platform-wide),
 * active + inactive. Used by the tenant admin UI at
 * /admin/tenants/[tenantId]/interest-profiles.
 */
export async function listAllInterestProfilesForTenant(
  tenantId: string,
): Promise<RepositoryResult<InterestProfile[]>> {
  try {
    const result = asRows<InterestProfileRow>(
      await getDb()
        .from("interest_profiles")
        .select("*")
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
        .order("name"),
    );

    if (result.error) {
      logger.warn("[interest-profiles] Failed to list tenant profiles", { error: result.error.message });
      return { ok: false, error: result.error.message };
    }

    return { ok: true, data: (result.data ?? []).map(fromRow) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

// ── getInterestProfileById ────────────────────────────────────────────────────

/**
 * Fetches a single interest profile by ID.
 * Used by the edit page to avoid listing all profiles to find one.
 */
export async function getInterestProfileById(
  id: string,
): Promise<RepositoryResult<InterestProfile>> {
  try {
    const result = asSingle<InterestProfileRow>(
      await getDb()
        .from("interest_profiles")
        .select("*")
        .eq("id", id as never)
        .maybeSingle(),
    );

    if (result.error) return { ok: false, error: result.error.message };
    if (!result.data)  return { ok: false, error: `Profile "${id}" not found.` };
    return { ok: true, data: fromRow(result.data) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

// ── createInterestProfile ─────────────────────────────────────────────────────

export async function createInterestProfile(
  input: Omit<InterestProfileInsert, "id" | "created_at" | "updated_at">,
): Promise<RepositoryResult<InterestProfile>> {
  try {
    const row = {
      ...input,
      is_active:               input.is_active ?? true,
      tenant_id:               input.tenant_id ?? null,
      recommended_site_models: input.recommended_site_models ?? [],
      default_status:          input.default_status ?? "active",
    };
    const result = asSingle<InterestProfileRow>(
      await getDb()
        .from("interest_profiles")
        .insert(row as never)
        .select()
        .maybeSingle(),
    );

    if (result.error) {
      if (result.error.code === "23505") {
        return { ok: false, error: `A profile with key "${input.key}" already exists.` };
      }
      return { ok: false, error: result.error.message };
    }

    if (!result.data) return { ok: false, error: "Insert returned no data." };
    return { ok: true, data: fromRow(result.data) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

// ── updateInterestProfile ─────────────────────────────────────────────────────

export async function updateInterestProfile(
  id:    string,
  patch: Partial<Pick<InterestProfileInsert,
    "name" | "description" | "tags" | "is_active" |
    "family" | "recommended_site_models" | "default_status"
  >>,
): Promise<RepositoryResult<InterestProfile>> {
  try {
    const result = asSingle<InterestProfileRow>(
      await getDb()
        .from("interest_profiles")
        .update({ ...patch, updated_at: new Date().toISOString() } as never)
        .eq("id", id as never)
        .select()
        .maybeSingle(),
    );

    if (result.error) return { ok: false, error: result.error.message };
    if (!result.data) return { ok: false, error: `Profile "${id}" not found.` };
    return { ok: true, data: fromRow(result.data) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

// ── upsertPlatformCatalog ─────────────────────────────────────────────────────

/**
 * Replaces all platform-wide interest profiles (tenant_id IS NULL) with the
 * canonical 20-profile catalog defined in catalog.ts.
 *
 * Safe to call at any time — idempotent.  Tenant-scoped profiles
 * (tenant_id IS NOT NULL) are never touched.
 *
 * Used by `seedPlatformCatalogAction()` and invokable from the admin UI.
 */
export async function upsertPlatformCatalog(): Promise<RepositoryResult<{ inserted: number }>> {
  try {
    // 1. Remove all existing platform-wide profiles.
    const deleteResult = await getDb()
      .from("interest_profiles")
      .delete()
      .is("tenant_id", null as never);

    if (deleteResult.error) {
      return { ok: false, error: deleteResult.error.message };
    }

    // 2. Insert the full canonical catalog.
    const rows = INTEREST_PROFILE_CATALOG.map((p) => ({
      key:                     p.key,
      name:                    p.name,
      description:             p.description,
      tags:                    p.tags,
      is_active:               p.isActive,
      tenant_id:               null,
      family:                  p.family,
      recommended_site_models: p.recommendedSiteModels,
      default_status:          p.defaultStatus,
    }));

    const insertResult = asRows<InterestProfileRow>(
      await getDb()
        .from("interest_profiles")
        .insert(rows as never[])
        .select(),
    );

    if (insertResult.error) {
      return { ok: false, error: insertResult.error.message };
    }

    const inserted = insertResult.data?.length ?? rows.length;
    logger.info("[interest-profiles] Platform catalog seeded", { inserted });
    return { ok: true, data: { inserted } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn("[interest-profiles] Failed to upsert platform catalog", { error: msg });
    return { ok: false, error: msg };
  }
}

// ── deleteInterestProfile ─────────────────────────────────────────────────────

export async function deleteInterestProfile(id: string): Promise<RepositoryResult<void>> {
  try {
    const result = asRows<never>(
      await getDb()
        .from("interest_profiles")
        .delete()
        .eq("id", id as never),
    );

    if (result.error) return { ok: false, error: result.error.message };
    return { ok: true, data: undefined };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

// ── Tenant interest profile overrides ────────────────────────────────────────
//
// `tenant_interest_profiles` (migration 088) is a sparse table that stores
// per-tenant enable/disable overrides for platform-wide profiles.
// Absence of a row means the default (enabled = true) applies.

/**
 * Returns a map of profile_key → enabled for a given tenant.
 * Only rows that differ from the default (enabled = false) or have been
 * explicitly set are included.
 *
 * Gracefully returns {} when the table does not exist (migration 088 not yet
 * applied) so pre-migration deployments are not broken.
 */
export async function getTenantProfileOverrides(
  tenantId: string,
): Promise<Record<string, boolean>> {
  try {
    const result = asRows<TenantInterestProfileOverrideRow>(
      await getDb()
        .from("tenant_interest_profiles")
        .select("profile_key, enabled")
        .eq("tenant_id", tenantId as never),
    );

    if (result.error) {
      // 42P01 = table missing (migration 088 not applied) — silently return empty.
      if (
        result.error.code === "42P01" ||
        String(result.error.message).includes("does not exist") ||
        String(result.error.message).includes("PGRST200")
      ) {
        return {};
      }
      logger.warn("[interest-profiles] getTenantProfileOverrides error", {
        tenantId,
        code: result.error.code,
        message: result.error.message,
      });
      return {};
    }

    return Object.fromEntries(
      (result.data ?? []).map((r) => [r.profile_key, r.enabled]),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn("[interest-profiles] getTenantProfileOverrides unexpected error", {
      tenantId, error: msg,
    });
    return {};
  }
}

/**
 * Set a per-tenant enable/disable override for a platform-wide interest profile.
 *
 * Upserts a row in tenant_interest_profiles.  When `enabled = true` and the
 * row was previously inserted, the row is updated (not deleted) so audit trail
 * is preserved.
 *
 * @param tenantId   Tenant to configure.
 * @param profileKey The `key` field of the interest_profile to override.
 * @param enabled    true = enabled for this tenant; false = disabled.
 */
export async function setTenantProfileOverride(
  tenantId:   string,
  profileKey: string,
  enabled:    boolean,
): Promise<RepositoryResult<void>> {
  try {
    const now = new Date().toISOString();

    const result = asRows<never>(
      await getDb()
        .from("tenant_interest_profiles")
        .upsert(
          {
            tenant_id:   tenantId,
            profile_key: profileKey,
            enabled,
            updated_at:  now,
          } as never,
          { onConflict: "tenant_id,profile_key" },
        ),
    );

    if (result.error) {
      logger.warn("[interest-profiles] setTenantProfileOverride failed", {
        tenantId, profileKey, enabled,
        code: result.error.code,
        message: result.error.message,
      });
      return { ok: false, error: result.error.message };
    }

    return { ok: true, data: undefined };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn("[interest-profiles] setTenantProfileOverride unexpected error", {
      tenantId, profileKey, error: msg,
    });
    return { ok: false, error: msg };
  }
}

/**
 * Returns all active profiles for a tenant annotated with the tenant's
 * enabled/disabled override state.  Used by the admin UI toggle page.
 *
 * Returns one entry per platform-wide profile (active + suggested + inactive)
 * merged with the tenant's override state.  Tenant-specific profiles are
 * returned separately with `isOverrideable = false`.
 */
export interface AnnotatedInterestProfile extends InterestProfile {
  /** True for platform-wide profiles that can be toggled by the tenant. */
  isOverrideable: boolean;
  /**
   * The tenant-level enabled state for this profile.
   * - true  = enabled for this tenant (default when no override row exists)
   * - false = disabled for this tenant via an explicit override
   */
  tenantEnabled: boolean;
}

export async function listInterestProfilesWithOverrides(
  tenantId: string,
): Promise<RepositoryResult<AnnotatedInterestProfile[]>> {
  const [profilesResult, overrides] = await Promise.all([
    listAllInterestProfilesForTenant(tenantId),
    getTenantProfileOverrides(tenantId),
  ]);

  if (!profilesResult.ok) return profilesResult;

  const annotated: AnnotatedInterestProfile[] = profilesResult.data.map((p) => ({
    ...p,
    isOverrideable: !p.tenantId,           // only platform-wide profiles are toggleable
    tenantEnabled:  p.tenantId             // tenant-specific profiles are always "enabled"
      ? true
      : (overrides[p.key] ?? true),        // default = enabled
  }));

  return { ok: true, data: annotated };
}
