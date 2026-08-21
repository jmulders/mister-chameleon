/**
 * Design Token Sets Store
 *
 * CRUD operations for the `design_token_sets` Supabase table: a persistent
 * library of named design-token upload payloads that an operator can save,
 * reuse, and apply to a tenant's design.tokenOverrides.
 *
 * Pattern mirrors lib/adaptive-blocks/adaptive-blocks-store.ts: all reads return
 * null/[] (never throw) on missing rows or DB errors, and delete treats a
 * zero-rows-affected result as a failure (supabase-js reports no error when a
 * DELETE matches nothing).
 *
 * ─── Scope ────────────────────────────────────────────────────────────────────
 *
 *   tenant_id NULL -> platform-wide set, reusable by any tenant
 *   tenant_id set  -> tenant-specific set
 *
 * Uniqueness is (tenant_id, name) with NULLS NOT DISTINCT, so a name is unique
 * within its scope.
 */

import { getDb }  from "@/data/db";
import { logger } from "@/lib/logger";
import type { DesignTokenSetRow, DesignTokenSetInsert } from "@/data/types";

/**
 * Minimal shape of the Supabase client the store needs. Tests inject a fake via
 * the optional trailing `db` parameter; production passes nothing and the store
 * uses the real getDb() client.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbLike = { from: (table: string) => any };

function resolveDb(db?: DbLike): DbLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db ?? (getDb() as unknown as DbLike)) as any;
}

// ── Domain type ────────────────────────────────────────────────────────────────

export interface DesignTokenSet {
  id:                  string;
  tenantId:            string | null;
  name:                string;
  /** Validated token upload payload (DesignTokenUploadInput shape). */
  tokens:              Record<string, unknown>;
  baseTheme:           string | null;
  typographyOverride:  Record<string, unknown> | null;
  createdAt:           string;
  updatedAt:           string;
}

/** Fields accepted when creating or updating a set. */
export interface DesignTokenSetInput {
  id?:                 string;
  tenantId:            string | null;
  name:                string;
  tokens:              Record<string, unknown>;
  baseTheme?:          string | null;
  typographyOverride?: Record<string, unknown> | null;
}

// ── Row -> domain mapper ────────────────────────────────────────────────────────

function rowToSet(row: DesignTokenSetRow): DesignTokenSet {
  return {
    id:                 row.id,
    tenantId:           row.tenant_id,
    name:               row.name,
    tokens:             (row.tokens ?? {}) as Record<string, unknown>,
    baseTheme:          row.base_theme,
    typographyOverride: row.typography_override,
    createdAt:          row.created_at,
    updatedAt:          row.updated_at,
  };
}

// ── Typed DB cast helpers ───────────────────────────────────────────────────────

type SingleResult<T> = { data: T | null; error: { message: string } | null };
type ManyResult<T>   = { data: T[] | null; error: { message: string } | null };
function asSingle<T>(r: unknown): SingleResult<T> { return r as SingleResult<T>; }
function asMany<T>(r: unknown):   ManyResult<T>   { return r as ManyResult<T>;   }

// ── Read operations ─────────────────────────────────────────────────────────────

/**
 * List design token sets for a tenant.
 *
 * @param tenantId        Tenant scope. Pass null to list only platform-wide sets.
 * @param includePlatform When true (default), also returns platform-wide sets
 *                        (tenant_id IS NULL) alongside the tenant's own sets.
 */
export async function listDesignTokenSets(
  tenantId:        string | null,
  includePlatform: boolean = true,
  db?:             DbLike,
): Promise<DesignTokenSet[]> {
  try {
    let query = resolveDb(db).from("design_token_sets").select("*").order("name");

    if (tenantId && includePlatform) {
      query = query.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
    } else if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    } else {
      query = query.is("tenant_id", null);
    }

    const { data, error } = asMany<DesignTokenSetRow>(await query);
    if (error || !data) return [];
    return data.map(rowToSet);
  } catch (err) {
    logger.warn("[DesignTokenSetsStore] listDesignTokenSets error", {
      tenantId,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/** Fetch a single set by its database id, or null when not found. */
export async function getDesignTokenSetById(id: string, db?: DbLike): Promise<DesignTokenSet | null> {
  try {
    const { data, error } = asSingle<DesignTokenSetRow>(
      await resolveDb(db)
        .from("design_token_sets")
        .select("*")
        .eq("id", id)
        .maybeSingle(),
    );

    if (error || !data) return null;
    return rowToSet(data);
  } catch (err) {
    logger.warn("[DesignTokenSetsStore] getDesignTokenSetById error", {
      id,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ── Write operations ────────────────────────────────────────────────────────────

/**
 * Create or update a design token set.
 *
 * Upserts on (tenant_id, name), the unique constraint from the migration, so
 * saving under an existing name in the same scope overwrites it. A null tenantId
 * creates/updates a platform-wide set. Pass `id` to update a specific row (e.g.
 * a rename, which changes `name`).
 */
export async function upsertDesignTokenSet(
  set: DesignTokenSetInput,
  db?: DbLike,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const row: DesignTokenSetInsert = {
      tenant_id:           set.tenantId ?? null,
      name:                set.name,
      tokens:              set.tokens,
      base_theme:          set.baseTheme ?? null,
      typography_override: set.typographyOverride ?? null,
    };
    if (set.id) row.id = set.id;

    const client = resolveDb(db);
    // When an id is supplied this is a targeted update (rename / edit); upserting
    // on the (tenant_id, name) constraint would create a duplicate if the name
    // changed, so update by id instead. Without an id, upsert by scope+name.
    const query = set.id
      ? client.from("design_token_sets").update(row).eq("id", set.id).select("id").single()
      : client.from("design_token_sets").upsert(row, { onConflict: "tenant_id,name" }).select("id").single();

    const { data, error } = asSingle<{ id: string }>(await query);

    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Save returned no data." };
    return { ok: true, id: data.id };
  } catch (err) {
    logger.error("[DesignTokenSetsStore] upsertDesignTokenSet error", {
      name:  set.name,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Delete a set by its database id.
 *
 * A DELETE that matches nothing reports no error in supabase-js but affects 0
 * rows; treat that as a failure so the caller does not see a false success.
 */
export async function deleteDesignTokenSet(
  id: string,
  db?: DbLike,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { data, error } = await resolveDb(db)
      .from("design_token_sets")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) return { ok: false, error: error.message };

    const deleted = Array.isArray(data) ? data.length : 0;
    if (deleted === 0) {
      logger.warn("[DesignTokenSetsStore] deleteDesignTokenSet affected 0 rows", { id });
      return { ok: false, error: `No design token set was deleted for id "${id}".` };
    }

    logger.info("[DesignTokenSetsStore] Design token set deleted", { id, deleted });
    return { ok: true };
  } catch (err) {
    logger.error("[DesignTokenSetsStore] deleteDesignTokenSet error", {
      id,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
