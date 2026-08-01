/**
 * Admin — Create page from preset (server action)
 *
 * Accepts a preset key, page title, and slug from the new-page form.
 * Validates all inputs, instantiates the preset into an EditablePage,
 * and persists it to the page store.
 *
 * ─── Safety ───────────────────────────────────────────────────────────────────
 *
 *   All preset blocks are filtered against REGISTERED_CONTENT_BLOCK_TYPES before
 *   the page is saved.  Only live blocks are included — no "defined"-status or
 *   unknown block types can enter the store through this path.
 *
 *   The created page is immediately editable via the standard block/page editor.
 *   Context slot defaults are set to null (no explicit fallback variant) so
 *   that the decision engine has full control from day one.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   // Server component — bind tenantId into the action:
 *   const boundAction = createPageFromPresetAction.bind(null, tenantId);
 *   <NewPageForm onSubmit={boundAction} ... />
 */

"use server";

import { revalidatePath } from "next/cache";
import { savePage, getPagesByTenant } from "@/page-store";
import type { EditablePage, EditableContentBlock, EditableContextSlot } from "@/page-store";
import type { ContentBlockKey } from "@/tenant/types";
import { getPreset, REGISTERED_CONTENT_BLOCK_TYPES } from "@/page-config";

// ── Result type ───────────────────────────────────────────────────────────────

export interface CreatePageResult {
  ok:      boolean;
  pageId?: string;
  error?:  string;
}

// ── Action ────────────────────────────────────────────────────────────────────

/**
 * Create a new page from a preset.
 *
 * Bound usage (server component → client prop):
 *   const boundAction = createPageFromPresetAction.bind(null, tenantId);
 *   <NewPageForm onSubmit={boundAction} />
 *
 * FormData fields:
 *   presetKey — key from PAGE_PRESETS
 *   title     — page title (non-empty string)
 *   slug      — URL slug without leading slash
 */
export async function createPageFromPresetAction(
  tenantId: string,
  formData: FormData,
): Promise<CreatePageResult> {

  // ── Read + validate inputs ─────────────────────────────────────────────────

  const presetKey = (formData.get("presetKey") as string | null)?.trim() ?? "";
  const title     = (formData.get("title")     as string | null)?.trim() ?? "";
  const rawSlug   = (formData.get("slug")      as string | null)?.trim() ?? "";

  if (!presetKey) return { ok: false, error: "No preset selected."         };
  if (!title)     return { ok: false, error: "Page title is required."     };
  if (!rawSlug)   return { ok: false, error: "Page slug is required."      };

  // Normalise slug: lowercase, only a-z / 0-9 / hyphens, no leading/trailing hyphens.
  const slug = rawSlug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) {
    return { ok: false, error: "Slug must contain at least one alphanumeric character." };
  }

  const preset = getPreset(presetKey);
  if (!preset) return { ok: false, error: `Unknown preset key: "${presetKey}".` };

  // ── Instantiate preset → EditablePage ──────────────────────────────────────

  const now     = new Date().toISOString();
  const newId   = crypto.randomUUID();

  // Filter against live block set — ensures no "defined"-status or unknown
  // block types enter the store via a preset.
  const allowed = new Set<string>(REGISTERED_CONTENT_BLOCK_TYPES);

  const contentBlocks: EditableContentBlock[] = preset.blocks
    .filter((b) => allowed.has(b.blockType))
    .map((b) => ({
      id:        crypto.randomUUID(),
      blockType: b.blockType as ContentBlockKey,
      variant:   b.variant,
      // data is intentionally empty — operators fill in content via the
      // block editor after the page is created from the preset.
      data:      {},
    }));

  // Cast the preset's context slot seeds to the mutable EditableContextSlot
  // shape.  variantKey: null = no explicit fallback; the decision engine
  // picks the variant at request time.
  const contextSlots: EditableContextSlot[] = preset.contextSlots.map((s) => ({
    slotId:     s.slotId as EditableContextSlot["slotId"],
    variantKey: s.variantKey,
    position:   s.position as EditableContextSlot["position"],
  }));

  const page: EditablePage = {
    id:            newId,
    tenantId,
    slug,
    title,
    templateKey:   preset.templateKey,
    contextSlots,
    contentBlocks,
    seo:           {},
    createdAt:     now,
    updatedAt:     now,
  };

  // ── Persist + revalidate ──────────────────────────────────────────────────

  await savePage(page);

  revalidatePath(`/admin/tenants/${tenantId}/content/pages`);
  revalidatePath(`/admin/tenants/${tenantId}/content/pages/${newId}`);

  return { ok: true, pageId: newId };
}
