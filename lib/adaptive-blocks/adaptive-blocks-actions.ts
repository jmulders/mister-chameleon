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
  getAdaptiveBlockById,
  upsertAdaptiveBlock,
  deleteAdaptiveBlock,
} from "./adaptive-blocks-store";
import { loadTenantRulesConfig } from "@/decision/rules/load-tenant-rules";
import { findRulesUsingBlock, type RuleUsageRef } from "./rules-usage";
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

export type DeleteAdaptiveBlockResult =
  | { ok: true; reverted?: boolean }
  | { ok: false; error: string; referencingRules?: RuleUsageRef[]; reason?: "orphan" | "revert" };

/**
 * Delete an adaptive block by DB id, guarding against orphaned rules.
 *
 * Before deleting, the block's variant keys are cross-referenced against the
 * tenant's stored rules:
 *   - No referencing rules -> delete.
 *   - Referenced, but a platform block with the same key remains (revert): the
 *     rules keep resolving (content reverts to the platform default). Refused
 *     with reason "revert" until the caller passes { confirmRevert: true }.
 *   - Referenced with no fallback (orphan): refused with reason "orphan" — the
 *     operator must edit those rules first. Always blocked, never forced.
 * Platform blocks (tenantId null) skip the guard — that is a platform concern.
 */
export async function deleteAdaptiveBlockAction(
  id:         string,
  revalidate?: string,
  opts?:      { confirmRevert?: boolean },
): Promise<DeleteAdaptiveBlockResult> {
  try {
    await getRequiredAdminSession();

    const block = await getAdaptiveBlockById(id);
    const tenantId = block?.tenantId ?? null;
    if (block && tenantId) {
      const config = await loadTenantRulesConfig(tenantId);
      const referencingRules = findRulesUsingBlock(block, config);
      if (referencingRules.length > 0) {
        const all = await listAdaptiveBlocks(tenantId, true);
        const hasFallback = all.some(
          (b) => b.id !== block.id && b.key === block.key && b.isActive,
        );
        if (!hasFallback) {
          return {
            ok: false,
            reason: "orphan",
            error: `This block is used by ${referencingRules.length} rule(s) and has no platform default to fall back to. Edit those rules before deleting.`,
            referencingRules,
          };
        }
        if (!opts?.confirmRevert) {
          return {
            ok: false,
            reason: "revert",
            error: `This block is used by ${referencingRules.length} rule(s). Deleting it reverts them to the platform default.`,
            referencingRules,
          };
        }
        const reverted = await deleteAdaptiveBlock(id);
        if (!reverted.ok) return reverted;
        if (revalidate) revalidatePath(revalidate);
        return { ok: true, reverted: true };
      }
    }

    const result = await deleteAdaptiveBlock(id);
    if (!result.ok) return result;

    if (revalidate) revalidatePath(revalidate);
    return { ok: true };
  } catch (err) {
    rethrowNextInternal(err);
    return { ok: false, error: err instanceof Error ? err.message : "Unauthorized" };
  }
}
