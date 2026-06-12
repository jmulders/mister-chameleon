/**
 * Adaptive Blocks Store
 *
 * CMS-agnostic CRUD operations for the `adaptive_blocks` Supabase table.
 *
 * This module is the single source of truth for reading and writing adaptive
 * block documents from the platform database.  It is used by:
 *
 *   • PlatformCMSProvider.getAdaptiveBlock()   — render path
 *   • StoryblokProvider.getAdaptiveBlock()      — render path (non-Sanity CMSes)
 *   • StatamicProvider.getAdaptiveBlock()       — render path (non-Sanity CMSes)
 *   • AdaptiveBlocksPanel (admin UI)            — management path
 *
 * ─── Data shape ──────────────────────────────────────────────────────────────
 *
 *   Each row in `adaptive_blocks` maps to AdaptiveBlockData:
 *     key               — routing key, e.g. "hero_matrix_homepage"
 *     tenant_id         — null = platform-wide; set = tenant override
 *     is_active         — false = ChameleonHero renders nothing
 *     default_variant   — JSONB: AdaptiveVariantContent (SEO fallback)
 *     adaptive_variants — JSONB array: AdaptiveVariantEntry[]
 *
 * ─── Tenant resolution ───────────────────────────────────────────────────────
 *
 *   getAdaptiveBlockByKey() returns the tenant-specific row first (when
 *   tenantId is provided), falling back to the platform-wide row with the
 *   same key (tenant_id IS NULL).
 *
 * ─── Null semantics ──────────────────────────────────────────────────────────
 *
 *   All read functions return null (never throw) on missing rows or DB errors.
 *   Callers should degrade gracefully — ChameleonHero always has its own
 *   inline defaultVariant prop as a last-resort fallback.
 */

import { getDb }   from "@/data/db";
import { logger }  from "@/lib/logger";
import type {
  AdaptiveBlockData,
  AdaptiveVariantContent,
  AdaptiveVariantEntry,
} from "@/cms/types";
import type { AdaptiveBlockRow, AdaptiveBlockInsert } from "@/data/types";

// ── Row → domain mapper ───────────────────────────────────────────────────────

/**
 * Maps a raw Supabase row to the domain type used by all rendering code.
 * The JSONB columns are typed as `Record<string, unknown>` in the DB type;
 * we cast them here since we control the write path.
 */
function rowToAdaptiveBlock(row: AdaptiveBlockRow): AdaptiveBlockData {
  return {
    id:               row.id,
    key:              row.key,
    tenantId:         row.tenant_id,
    isActive:         row.is_active,
    defaultVariant:   row.default_variant  as unknown as AdaptiveVariantContent,
    adaptiveVariants: (row.adaptive_variants ?? []) as unknown as AdaptiveVariantEntry[],
  };
}

// ── Typed DB cast helpers ─────────────────────────────────────────────────────

type SingleResult<T> = { data: T | null; error: { message: string } | null };
type ManyResult<T>   = { data: T[] | null; error: { message: string } | null };
function asSingle<T>(r: unknown): SingleResult<T> { return r as SingleResult<T>; }
function asMany<T>(r: unknown):   ManyResult<T>   { return r as ManyResult<T>;   }

// ── Read operations ───────────────────────────────────────────────────────────

/**
 * Fetch a single adaptive block by its routing key.
 *
 * Resolution order:
 *   1. Tenant-specific row (key == $key AND tenant_id == $tenantId)
 *   2. Platform-wide row  (key == $key AND tenant_id IS NULL)
 *
 * @param key       The block routing key, e.g. "hero_matrix_homepage"
 * @param tenantId  Optional tenant scope.  Pass null to fetch platform-wide only.
 * @returns         The resolved AdaptiveBlockData, or null if not found.
 */
export async function getAdaptiveBlockByKey(
  key:       string,
  tenantId?: string | null,
): Promise<AdaptiveBlockData | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;

    // Fetch all candidates matching this key (may include tenant + platform rows).
    const { data, error } = asSingle<AdaptiveBlockRow[]>(
      await db
        .from("adaptive_blocks")
        .select("*")
        .eq("key", key)
        .eq("is_active", true)
        .or(
          tenantId
            ? `tenant_id.eq.${tenantId},tenant_id.is.null`
            : `tenant_id.is.null`,
        )
        .order("tenant_id", { ascending: false, nullsFirst: false })
        // Tenant-specific rows (non-null tenant_id) sort before platform rows (null).
        .limit(2),
    );

    if (error || !data || data.length === 0) return null;

    // Prefer tenant-specific row over platform-wide row.
    const row = data.find((r) => r.tenant_id === tenantId) ?? data[0];
    return rowToAdaptiveBlock(row);
  } catch (err) {
    logger.warn("[AdaptiveBlocksStore] getAdaptiveBlockByKey error", {
      key,
      tenantId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * List all platform-wide adaptive blocks (tenant_id IS NULL).
 *
 * Used by the platform-level Adaptive Blocks Catalog page
 * (/admin/platform/blocks) to show the full set of default blocks
 * available to every tenant.
 */
export async function listPlatformBlocks(): Promise<AdaptiveBlockData[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;

    const { data, error } = asMany<AdaptiveBlockRow>(
      await db
        .from("adaptive_blocks")
        .select("*")
        .is("tenant_id", null)
        .order("key"),
    );

    if (error || !data) return [];
    return data.map(rowToAdaptiveBlock);
  } catch (err) {
    logger.warn("[AdaptiveBlocksStore] listPlatformBlocks error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * List all adaptive blocks for a given tenant (and optionally platform-wide).
 *
 * Used by the AdaptiveBlocksPanel admin component.
 *
 * @param tenantId     Tenant scope.  Pass null to list only platform-wide blocks.
 * @param includePlatform  When true, also returns platform-wide blocks (tenant_id IS NULL).
 */
export async function listAdaptiveBlocks(
  tenantId:        string | null,
  includePlatform: boolean = true,
): Promise<AdaptiveBlockData[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;

    let query = db
      .from("adaptive_blocks")
      .select("*")
      .order("key");

    if (tenantId && includePlatform) {
      query = query.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
    } else if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    } else {
      query = query.is("tenant_id", null);
    }

    const { data, error } = asMany<AdaptiveBlockRow>(await query);
    if (error || !data) return [];
    return data.map(rowToAdaptiveBlock);
  } catch (err) {
    logger.warn("[AdaptiveBlocksStore] listAdaptiveBlocks error", {
      tenantId,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

// ── Write operations ──────────────────────────────────────────────────────────

/**
 * Create or update an adaptive block.
 *
 * Upserts on (key, tenant_id) — the unique constraint defined in the migration.
 * A null tenantId creates/updates the platform-wide block.
 */
export async function upsertAdaptiveBlock(
  block: Omit<AdaptiveBlockData, "id"> & { id?: string },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const row: AdaptiveBlockInsert = {
      key:               block.key,
      tenant_id:         block.tenantId ?? null,
      label:             null,
      is_active:         block.isActive,
      default_variant:   block.defaultVariant as unknown as Record<string, unknown>,
      adaptive_variants: block.adaptiveVariants as unknown as Record<string, unknown>[],
    };

    if (block.id) row.id = block.id;

    const { data, error } = asSingle<AdaptiveBlockRow>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (getDb() as any)
        .from("adaptive_blocks")
        .upsert(row, { onConflict: "key,tenant_id" })
        .select("id")
        .single(),
    );

    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Upsert returned no data." };

    return { ok: true, id: data.id };
  } catch (err) {
    logger.error("[AdaptiveBlocksStore] upsertAdaptiveBlock error", {
      key: block.key,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      ok:    false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Delete an adaptive block by its database ID.
 *
 * Admin use only — never called from the render path.
 */
export async function deleteAdaptiveBlock(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (getDb() as any)
      .from("adaptive_blocks")
      .delete()
      .eq("id", id);

    if (error) return { ok: false, error: error.message };

    logger.info("[AdaptiveBlocksStore] Adaptive block deleted", { id });
    return { ok: true };
  } catch (err) {
    logger.error("[AdaptiveBlocksStore] deleteAdaptiveBlock error", {
      id,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      ok:    false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
