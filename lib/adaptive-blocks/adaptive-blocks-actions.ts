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
import {
  listAdaptiveBlocks,
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
    return { ok: false, error: err instanceof Error ? err.message : "Unauthorized" };
  }
}
