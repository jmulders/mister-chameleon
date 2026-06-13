/**
 * Statamic Live Preview — shared draft store (Supabase-backed)
 *
 * When the Statamic CP Live Preview re-renders the Antlers template on every
 * keystroke, a small JavaScript snippet POSTs the current (unsaved) entry data
 * to /api/statamic-draft.  The response token is appended to the Next.js iframe
 * URL so the page renders with draft content in real time — without a Save.
 *
 * ─── Why Supabase and not an in-memory Map ────────────────────────────────────
 *
 *   On Vercel (and any serverless platform) the POST that stores the draft and
 *   the GET that renders the preview iframe run in SEPARATE function invocations
 *   — possibly in different regions.  A module-level in-memory Map is therefore
 *   not shared between them, so the token would never resolve.  We persist
 *   drafts in a small `statamic_drafts` table (token, entry JSONB, expires_at)
 *   read via the service-role client, which works across all invocations.
 *
 *   Drafts are short-lived (15 min TTL) and pruned opportunistically on write.
 */

import "server-only";
import { getDb }  from "@/data/db";
import { logger } from "@/lib/logger";

export interface StatamicDraftEntry {
  collection: string;
  slug: string;
  /**
   * Raw page_blocks Replicator — the unified array containing both
   * context_slot blocks and free content blocks in authored order.
   * Serialised by the Antlers template and POSTed on every keystroke.
   */
  blocks: unknown[];
  title?: string;
  seoDescription?: string;
}

const TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Persist a draft entry and return a short-lived token.
 * Best-effort prunes expired rows on each write.
 */
export async function storeDraft(entry: StatamicDraftEntry): Promise<string> {
  const token     = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const expiresAt = new Date(Date.now() + TTL_MS).toISOString();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (getDb() as any)
      .from("statamic_drafts")
      .insert({ token, entry, expires_at: expiresAt });

    // Opportunistic prune of expired drafts (fire-and-forget).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (getDb() as any)
      .from("statamic_drafts")
      .delete()
      .lt("expires_at", new Date().toISOString());
  } catch (err) {
    logger.error("[statamic-draft] storeDraft failed", { error: String(err) });
    throw err;
  }

  return token;
}

/**
 * Resolve a draft token to its entry, or null when missing/expired.
 */
export async function getDraft(token: string): Promise<StatamicDraftEntry | null> {
  if (!token) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = (await (getDb() as any)
      .from("statamic_drafts")
      .select("entry, expires_at")
      .eq("token", token)
      .maybeSingle()) as {
        data: { entry: StatamicDraftEntry; expires_at: string } | null;
        error: { message: string } | null;
      };

    if (error || !data) return null;
    if (new Date(data.expires_at).getTime() < Date.now()) return null;
    return data.entry;
  } catch (err) {
    logger.warn("[statamic-draft] getDraft failed", { error: String(err) });
    return null;
  }
}
