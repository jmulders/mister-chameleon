/**
 * Design Effect Sets Store
 *
 * CRUD for the `design_effect_sets` table: a persistent library of named
 * declarative-effect payloads an operator can save, reuse, and assign to blocks.
 * Mirrors lib/design-token-sets/design-token-sets-store.ts (never throws; delete
 * treats zero-rows-affected as a failure).
 *
 *   tenant_id NULL -> platform-wide set, reusable by any tenant
 *   tenant_id set  -> tenant-specific set
 */

import { getDb }  from "@/data/db";
import { logger } from "@/lib/logger";
import type { DesignEffectSetRow, DesignEffectSetInsert } from "@/data/types";
import type { BlockEffectConfig, EffectSet } from "@/design-system/effects/effect-ref";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbLike = { from: (table: string) => any };
function resolveDb(db?: DbLike): DbLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db ?? (getDb() as unknown as DbLike)) as any;
}

export interface DesignEffectSetInput {
  id?:       string;
  tenantId:  string | null;
  name:      string;
  effects:   readonly BlockEffectConfig[];
  slots?:    readonly string[] | null;
}

/** Row -> the EffectSet shape the resolver consumes (key = name). */
function rowToSet(row: DesignEffectSetRow): EffectSet {
  return {
    id:      row.id,
    key:     row.name,
    name:    row.name,
    effects: (Array.isArray(row.effects) ? row.effects : []) as BlockEffectConfig[],
    ...(Array.isArray(row.slots) ? { slots: row.slots } : {}),
  };
}

type SingleResult<T> = { data: T | null; error: { message: string } | null };
type ManyResult<T>   = { data: T[] | null; error: { message: string } | null };
function asSingle<T>(r: unknown): SingleResult<T> { return r as SingleResult<T>; }
function asMany<T>(r: unknown):   ManyResult<T>   { return r as ManyResult<T>;   }

/** List effect sets for a tenant (plus platform-wide sets by default). */
export async function listDesignEffectSets(
  tenantId:        string | null,
  includePlatform: boolean = true,
  db?:             DbLike,
): Promise<EffectSet[]> {
  try {
    let query = resolveDb(db).from("design_effect_sets").select("*").order("name");
    if (tenantId && includePlatform) query = query.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
    else if (tenantId)               query = query.eq("tenant_id", tenantId);
    else                             query = query.is("tenant_id", null);

    const { data, error } = asMany<DesignEffectSetRow>(await query);
    if (error || !data) return [];
    return data.map(rowToSet);
  } catch (err) {
    logger.warn("[DesignEffectSetsStore] list error", { tenantId, error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

/** Create or update an effect set (upsert on (tenant_id, name), or update by id). */
export async function upsertDesignEffectSet(
  set: DesignEffectSetInput,
  db?: DbLike,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const row: DesignEffectSetInsert = {
      tenant_id: set.tenantId ?? null,
      name:      set.name,
      effects:   set.effects as unknown[],
      slots:     set.slots ? [...set.slots] : null,
    };
    if (set.id) row.id = set.id;

    const client = resolveDb(db);
    const query = set.id
      ? client.from("design_effect_sets").update(row).eq("id", set.id).select("id").single()
      : client.from("design_effect_sets").upsert(row, { onConflict: "tenant_id,name" }).select("id").single();

    const { data, error } = asSingle<{ id: string }>(await query);
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Save returned no data." };
    return { ok: true, id: data.id };
  } catch (err) {
    logger.error("[DesignEffectSetsStore] upsert error", { name: set.name, error: err instanceof Error ? err.message : String(err) });
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/** Delete an effect set by id (zero rows affected = failure). */
export async function deleteDesignEffectSet(
  id: string,
  db?: DbLike,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { data, error } = await resolveDb(db).from("design_effect_sets").delete().eq("id", id).select("id");
    if (error) return { ok: false, error: error.message };
    const deleted = Array.isArray(data) ? data.length : 0;
    if (deleted === 0) return { ok: false, error: `No effect set was deleted for id "${id}".` };
    return { ok: true };
  } catch (err) {
    logger.error("[DesignEffectSetsStore] delete error", { id, error: err instanceof Error ? err.message : String(err) });
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
