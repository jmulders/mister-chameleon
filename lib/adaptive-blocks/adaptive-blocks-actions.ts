/**
 * Adaptive Blocks — Server Actions
 *
 * Next.js server actions wrapping the adaptive-blocks-store for use by the
 * admin panel (AdaptiveBlocksPanel) and any server components that need to
 * manage Content Matrix blocks.
 *
 * Every action requires an authenticated admin session.
 *
 * ─── Available actions ────────────────────────────────────────────────────────
 *
 *   listAdaptiveBlocksAction    — list all blocks for a tenant + platform blocks
 *   upsertAdaptiveBlockAction   — create or update a block (upsert by key+tenantId)
 *   deleteAdaptiveBlockAction   — delete a block by DB id
 *   getAdaptiveBlockAction      — fetch one block by key + tenantId (read path)
 */

"use server";

import { revalidatePath }          from "next/cache";
import { getRequiredAdminSession } from "@/lib/admin-auth/authorization";
import { rethrowNextInternal }     from "@/lib/server-action-guard";
import {
  listAdaptiveBlocks,
  listPlatformBlocks,
  getAdaptiveBlockByKey,
  upsertAdaptiveBlock,
  deleteAdaptiveBlock,
} from "./adaptive-blocks-store";
import type { AdaptiveBlockData } from "@/cms/types";

// ── listAdaptiveBlocksAction ──────────────────────────────────────────────────

export async function listAdaptiveBlocksAction(
  tenantId:        string | null,
  includePlatform: boolean = true,
): Promise<{ ok: true; blocks: AdaptiveBlockData[] } | { ok: false; error: string }> {
  try {
    await getRequiredAdminSession();
    const blocks = await listAdaptiveBlocks(tenantId, includePlatform);
    return { ok: true, blocks };
  } catch (err) {
    rethrowNextInternal(err);
    return { ok: false, error: err instanceof Error ? err.message : "Unauthorized" };
  }
}

// ── getAdaptiveBlockAction ────────────────────────────────────────────────────

export async function getAdaptiveBlockAction(
  key:      string,
  tenantId: string | null,
): Promise<{ ok: true; block: AdaptiveBlockData } | { ok: false; error: string }> {
  try {
    await getRequiredAdminSession();
    const block = await getAdaptiveBlockByKey(key, tenantId);
    if (!block) return { ok: false, error: `No adaptive block found for key "${key}".` };
    return { ok: true, block };
  } catch (err) {
    rethrowNextInternal(err);
    return { ok: false, error: err instanceof Error ? err.message : "Unauthorized" };
  }
}

// ── upsertAdaptiveBlockAction ─────────────────────────────────────────────────

export async function upsertAdaptiveBlockAction(
  block: Omit<AdaptiveBlockData, "id"> & { id?: string },
  /** Pass the admin page path to revalidate after save. */
  revalidate?: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    await getRequiredAdminSession();

    if (!block.key?.trim()) {
      return { ok: false, error: "Block key is required." };
    }

    const result = await upsertAdaptiveBlock(block);
    if (!result.ok) return result;

    if (revalidate) revalidatePath(revalidate);
    return result;
  } catch (err) {
    rethrowNextInternal(err);
    return { ok: false, error: err instanceof Error ? err.message : "Unauthorized" };
  }
}

// ── listPlatformBlocksAction ──────────────────────────────────────────────────

/**
 * List all platform-wide adaptive blocks (tenant_id IS NULL).
 *
 * Used by the platform-level Adaptive Blocks Catalog page.
 */
export async function listPlatformBlocksAction(): Promise<
  { ok: true; blocks: AdaptiveBlockData[] } | { ok: false; error: string }
> {
  try {
    await getRequiredAdminSession();
    const blocks = await listPlatformBlocks();
    return { ok: true, blocks };
  } catch (err) {
    rethrowNextInternal(err);
    return { ok: false, error: err instanceof Error ? err.message : "Unauthorized" };
  }
}

// ── activateBlockForTenantAction ──────────────────────────────────────────────

/**
 * Activate or deactivate a platform block for a specific tenant.
 *
 * Resolution strategy:
 *   1. Load the existing tenant-specific row (if any) or the platform row as template.
 *   2. Upsert a tenant row with is_active = true/false.
 *   3. Use the platform block content as the starting point if no tenant row exists yet.
 *
 * This means:
 *   - Calling with isActive=true and no existing tenant override creates a tenant copy
 *     of the platform block (same content, tenant-scoped, active).
 *   - Calling with isActive=false disables the block for this tenant without deleting it.
 *   - The tenant row can later be edited independently of the platform block.
 */
export async function activateBlockForTenantAction(
  key:        string,
  tenantId:   string,
  isActive:   boolean,
  revalidate?: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    await getRequiredAdminSession();

    if (!key.trim())      return { ok: false, error: "Block key is required." };
    if (!tenantId.trim()) return { ok: false, error: "Tenant ID is required." };

    // Load existing tenant row (or platform row as template) for the content.
    const existing = await getAdaptiveBlockByKey(key, tenantId);

    const result = await upsertAdaptiveBlock({
      id:               existing?.tenantId === tenantId ? existing.id : undefined, // only reuse id if it's a tenant row
      key:              key.trim(),
      tenantId:         tenantId,
      isActive,
      defaultVariant:   existing?.defaultVariant   ?? { title: "", subtitle: "", tag: "", ctas: [] },
      adaptiveVariants: existing?.adaptiveVariants ?? [],
    });

    if (!result.ok) return result;
    if (revalidate) {
      const { revalidatePath } = await import("next/cache");
      revalidatePath(revalidate);
    }
    return result;
  } catch (err) {
    rethrowNextInternal(err);
    return { ok: false, error: err instanceof Error ? err.message : "Unauthorized" };
  }
}

// ── seedPlatformBlocksAction ──────────────────────────────────────────────────

/**
 * Seed the platform-wide adaptive_blocks table with default content for every
 * known variant key.  Upserts rows — safe to call multiple times.
 *
 * @param overwrite  When true, existing rows are overwritten.  Default: false.
 */
export async function seedPlatformBlocksAction(
  overwrite = false,
): Promise<{ ok: true; inserted: number; skipped: number } | { ok: false; error: string }> {
  try {
    await getRequiredAdminSession();
    const { seedPlatformBlocks } = await import("./adaptive-blocks-seed");
    const result = await seedPlatformBlocks(overwrite);
    if (!result.ok) return { ok: false, error: result.errors.join("; ") };
    revalidatePath("/admin/platform/blocks");
    return { ok: true, inserted: result.inserted, skipped: result.skipped };
  } catch (err) {
    rethrowNextInternal(err);
    return { ok: false, error: err instanceof Error ? err.message : "Unauthorized" };
  }
}

// ── deleteAdaptiveBlockAction ─────────────────────────────────────────────────

export async function deleteAdaptiveBlockAction(
  id:         string,
  revalidate?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await getRequiredAdminSession();

    const result = await deleteAdaptiveBlock(id);
    if (!result.ok) return result;

    if (revalidate) revalidatePath(revalidate);
    return { ok: true };
  } catch (err) {
    rethrowNextInternal(err);
    return { ok: false, error: err instanceof Error ? err.message : "Unauthorized" };
  }
}
