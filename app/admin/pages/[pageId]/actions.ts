/**
 * Admin — Page editor server actions (PB3 + PB4 + PB5)
 *
 * Thin server-side wrappers around the page store.
 * Imported by PageMetaForm, ContentFlowEditor, and ContextSlotsEditor so that
 * client components can mutate the store without shipping server-only Node.js
 * code to the browser.
 */

"use server";

import { revalidatePath } from "next/cache";
import { getPageById, savePage } from "@/page-store";
import type { EditableContentBlock, EditableContextSlot } from "@/page-store";
import { SLOT_VOCABULARY } from "@/decision/types";

// ── Result shape ───────────────────────────────────────────────────────────────

export interface ActionResult {
  ok:     boolean;
  error?: string;
}

// ── savePageMetaAction ─────────────────────────────────────────────────────────

/**
 * Update the title and slug of an existing page.
 *
 * Guards:
 *   - Validates that the page exists before writing.
 *   - Trims both values.
 *   - Rejects empty title or slug.
 *   - Strips the leading slash from slug (the store normalises to no-slash form).
 *   - Revalidates /admin/pages and /admin/pages/[pageId] so lists and the
 *     editor itself reflect the change on next navigation.
 */
export async function savePageMetaAction(
  pageId: string,
  title:  string,
  slug:   string,
): Promise<ActionResult> {
  const cleanTitle = title.trim();
  const cleanSlug  = slug.trim().replace(/^\/+/, "");

  if (!cleanTitle) return { ok: false, error: "Title cannot be empty." };
  if (!cleanSlug)  return { ok: false, error: "Slug cannot be empty." };

  const existing = await getPageById(pageId);
  if (!existing)  return { ok: false, error: "Page not found." };

  await savePage({ ...existing, title: cleanTitle, slug: cleanSlug });

  revalidatePath("/admin/pages");
  revalidatePath(`/admin/pages/${pageId}`);

  return { ok: true };
}

// ── saveContentBlocksAction ───────────────────────────────────────────────────

/**
 * Replace the ordered content blocks array for an existing page.
 *
 * Called by ContentFlowEditor after the client has validated all block JSON.
 * The blocks array is the full replacement — partial updates are not supported.
 *
 * The saved structure stays aligned with EditableContentBlock → ContentBlock:
 *   id        stable string identifier
 *   blockType ContentBlockKey (validated client-side against the registry)
 *   variant   optional string (validated client-side against allowedVariants)
 *   data      Record<string, unknown> from JSON.parse — renderer narrows via blockType
 */
export async function saveContentBlocksAction(
  pageId: string,
  blocks: EditableContentBlock[],
): Promise<ActionResult> {
  if (!Array.isArray(blocks)) {
    return { ok: false, error: "Invalid blocks payload." };
  }

  const existing = await getPageById(pageId);
  if (!existing) return { ok: false, error: "Page not found." };

  await savePage({ ...existing, contentBlocks: blocks });

  revalidatePath("/admin/pages");
  revalidatePath(`/admin/pages/${pageId}`);

  return { ok: true };
}

// ── saveContextSlotsAction ────────────────────────────────────────────────────

/**
 * Replace the context slot configuration for an existing page.
 *
 * Called by ContextSlotsEditor after client-side validation.
 *
 * Server-side guards:
 *   - Page must exist.
 *   - Each slot's slotId must be "hero", "proof", or "cta".
 *   - allowedVariantKeys must only contain keys from the slot's platform vocabulary.
 *   - variantKey (fallback), if set, must belong to the slot's platform vocabulary.
 *
 * The decision engine is NOT changed — it continues to resolve variants at
 * request time. This action only persists the operator's configuration envelope.
 */
export async function saveContextSlotsAction(
  pageId: string,
  slots:  EditableContextSlot[],
): Promise<ActionResult> {
  if (!Array.isArray(slots)) {
    return { ok: false, error: "Invalid slots payload." };
  }

  const existing = await getPageById(pageId);
  if (!existing) return { ok: false, error: "Page not found." };

  // Validate each slot against the platform vocabulary.
  for (const slot of slots) {
    const vocab = SLOT_VOCABULARY[slot.slotId as keyof typeof SLOT_VOCABULARY];
    if (!vocab) {
      return { ok: false, error: `Unknown slot ID: "${slot.slotId}".` };
    }

    // Validate allowedVariantKeys if present.
    if (slot.allowedVariantKeys) {
      const invalid = slot.allowedVariantKeys.filter(
        (k) => !(vocab as readonly string[]).includes(k),
      );
      if (invalid.length > 0) {
        return {
          ok:    false,
          error: `Invalid variant key(s) for "${slot.slotId}" slot: ${invalid.join(", ")}.`,
        };
      }
    }

    // Validate fallback variantKey if set.
    if (slot.variantKey && !(vocab as readonly string[]).includes(slot.variantKey)) {
      return {
        ok:    false,
        error: `Fallback key "${slot.variantKey}" is not in the "${slot.slotId}" vocabulary.`,
      };
    }
  }

  await savePage({ ...existing, contextSlots: slots });

  revalidatePath("/admin/pages");
  revalidatePath(`/admin/pages/${pageId}`);

  return { ok: true };
}
