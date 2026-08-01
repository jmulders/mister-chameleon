/**
 * Admin — Tenant-scoped page editor server actions
 *
 * Mirror of /admin/pages/[pageId]/actions.ts but with tenant ownership
 * verification.  Every write action:
 *
 *   1. Verifies the page exists.
 *   2. Verifies the page's tenantId matches the route's tenantId — prevents
 *      cross-tenant mutations.
 *   3. Persists the change.
 *   4. Revalidates both the tenant-scoped and legacy paths so any cached
 *      route segments refresh correctly.
 *
 * These actions are bound with `.bind(null, tenantId, pageId)` in the server
 * component and passed as `onSave` props to the client editor components.
 * This means the tenantId and pageId are already embedded in the function
 * reference and are never passed from the browser.
 */

"use server";

import { revalidatePath } from "next/cache";
import { getPageById, savePage } from "@/page-store";
import type { EditableContentBlock, EditableContextSlot } from "@/page-store";
import { SLOT_VOCABULARY } from "@/decision/types";

// ── Result shape ────────────────────────────────────────────────────────────────

export interface ActionResult {
  ok:     boolean;
  error?: string;
}

// ── Shared guard ────────────────────────────────────────────────────────────────

async function loadAndVerify(
  tenantId: string,
  pageId:   string,
) {
  const page = await getPageById(pageId);
  if (!page)                        return { page: null, error: "Page not found." };
  if (page.tenantId !== tenantId)   return { page: null, error: "Page does not belong to this tenant." };
  return { page, error: null };
}

function revalidateTenantPaths(tenantId: string, pageId: string): void {
  revalidatePath(`/admin/tenants/${tenantId}/content/pages`);
  revalidatePath(`/admin/tenants/${tenantId}/content/pages/${pageId}`);
  // Also revalidate legacy paths so stale cache entries are cleared.
  revalidatePath("/admin/pages");
  revalidatePath(`/admin/pages/${pageId}`);
}

// ── savePageMetaAction ──────────────────────────────────────────────────────────

/**
 * Update the title and slug of a tenant-owned page.
 *
 * Bound usage (server component → client prop):
 *   const boundAction = savePageMetaAction.bind(null, tenantId, pageId);
 *   <PageMetaForm onSave={boundAction} ... />
 */
export async function savePageMetaAction(
  tenantId: string,
  pageId:   string,
  title:    string,
  slug:     string,
): Promise<ActionResult> {
  const cleanTitle = title.trim();
  const cleanSlug  = slug.trim().replace(/^\/+/, "");

  if (!cleanTitle) return { ok: false, error: "Title cannot be empty." };
  if (!cleanSlug)  return { ok: false, error: "Slug cannot be empty." };

  const { page, error } = await loadAndVerify(tenantId, pageId);
  if (!page) return { ok: false, error: error! };

  await savePage({ ...page, title: cleanTitle, slug: cleanSlug });

  revalidateTenantPaths(tenantId, pageId);
  return { ok: true };
}

// ── saveContentBlocksAction ─────────────────────────────────────────────────────

/**
 * Replace the ordered content blocks array for a tenant-owned page.
 *
 * Bound usage (server component → client prop):
 *   const boundAction = saveContentBlocksAction.bind(null, tenantId, pageId);
 *   <ContentFlowEditor onSave={boundAction} ... />
 */
export async function saveContentBlocksAction(
  tenantId: string,
  pageId:   string,
  blocks:   EditableContentBlock[],
): Promise<ActionResult> {
  if (!Array.isArray(blocks)) return { ok: false, error: "Invalid blocks payload." };

  const { page, error } = await loadAndVerify(tenantId, pageId);
  if (!page) return { ok: false, error: error! };

  await savePage({ ...page, contentBlocks: blocks });

  revalidateTenantPaths(tenantId, pageId);
  return { ok: true };
}

// ── saveContextSlotsAction ──────────────────────────────────────────────────────

/**
 * Replace the context slot configuration for a tenant-owned page.
 *
 * Bound usage (server component → client prop):
 *   const boundAction = saveContextSlotsAction.bind(null, tenantId, pageId);
 *   <ContextSlotsEditor onSave={boundAction} ... />
 */
export async function saveContextSlotsAction(
  tenantId: string,
  pageId:   string,
  slots:    EditableContextSlot[],
): Promise<ActionResult> {
  if (!Array.isArray(slots)) return { ok: false, error: "Invalid slots payload." };

  const { page, error } = await loadAndVerify(tenantId, pageId);
  if (!page) return { ok: false, error: error! };

  // Validate each slot against the platform vocabulary.
  for (const slot of slots) {
    const vocab = SLOT_VOCABULARY[slot.slotId as keyof typeof SLOT_VOCABULARY];
    if (!vocab) {
      return { ok: false, error: `Unknown slot ID: "${slot.slotId}".` };
    }

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

    if (slot.variantKey && !(vocab as readonly string[]).includes(slot.variantKey)) {
      return {
        ok:    false,
        error: `Fallback key "${slot.variantKey}" is not in the "${slot.slotId}" vocabulary.`,
      };
    }
  }

  await savePage({ ...page, contextSlots: slots });

  revalidateTenantPaths(tenantId, pageId);
  return { ok: true };
}
