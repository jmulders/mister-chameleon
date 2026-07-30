/**
 * Form Variant Authoring Actions (forms-as-adaptive-blocks, phase 2.2)
 *
 * Create / list / delete the variants of a form. A form's variants live in the
 * tenant's `form:<type>` adaptive-block row (same store the Content Matrix uses),
 * so authoring reuses the adaptive-blocks store with NO schema change. The
 * variant payload is a `FormVariantContent` (copy + layout + optional field set),
 * stored in the block's flexible JSONB and cast at this boundary.
 *
 * Selection (which variant a visitor sees) is handled by the decision engine —
 * a rule sets `plan.formVariants[<type>] = variantKey`. See docs/forms-phase-2.
 *
 * Access control: reached from the per-form config page, guarded by the parent
 * layout (assertTenantAccess).
 */

"use server";

import { revalidatePath } from "next/cache";
import {
  getAdaptiveBlockByKey,
  upsertAdaptiveBlock,
} from "@/lib/adaptive-blocks/adaptive-blocks-store";
import type { AdaptiveVariantContent, AdaptiveVariantEntry } from "@/cms/types";
import type { FormVariantContent, FormVariantEntry } from "@/forms/context/variant";
import { logger } from "@/lib/logger";

type Result = { ok: true } | { ok: false; error: string };

/** List the variants authored for a form type (empty when none exist yet). */
export async function listFormVariantsAction(
  tenantId: string,
  formType: string,
): Promise<FormVariantEntry[]> {
  try {
    const block = await getAdaptiveBlockByKey(`form:${formType}`, tenantId);
    return (block?.adaptiveVariants ?? []).map((v) => ({
      variantKey: v.variantKey,
      label:      v.label,
      content:    v.content as unknown as FormVariantContent,
    }));
  } catch (err) {
    logger.error("[form-variants] list failed", { tenantId, formType, error: String(err) });
    return [];
  }
}

/** Create or replace a single form variant (keyed by variantKey). */
export async function saveFormVariantAction(
  tenantId: string,
  formType: string,
  entry:    FormVariantEntry,
): Promise<Result> {
  const variantKey = entry.variantKey.trim();
  if (!variantKey) return { ok: false, error: "Variant key is required." };
  try {
    const key   = `form:${formType}`;
    const block = await getAdaptiveBlockByKey(key, tenantId);
    const kept  = (block?.adaptiveVariants ?? []).filter((v) => v.variantKey !== variantKey);
    const next: AdaptiveVariantEntry[] = [
      ...kept,
      {
        variantKey,
        label:   entry.label?.trim() || undefined,
        content: entry.content as unknown as AdaptiveVariantContent,
      },
    ];
    const res = await upsertAdaptiveBlock({
      key,
      tenantId,
      isActive:         true,
      defaultVariant:   block?.defaultVariant ?? ({} as AdaptiveVariantContent),
      adaptiveVariants: next,
    });
    if (!res.ok) return { ok: false, error: res.error };
    revalidatePath(`/admin/tenants/${tenantId}/forms/${formType}`);
    return { ok: true };
  } catch (err) {
    logger.error("[form-variants] save failed", { tenantId, formType, error: String(err) });
    return { ok: false, error: "Failed to save variant" };
  }
}

/** Delete a single form variant by key. */
export async function deleteFormVariantAction(
  tenantId: string,
  formType: string,
  variantKey: string,
): Promise<Result> {
  try {
    const key   = `form:${formType}`;
    const block = await getAdaptiveBlockByKey(key, tenantId);
    if (!block) return { ok: true };
    const next = block.adaptiveVariants.filter((v) => v.variantKey !== variantKey);
    const res = await upsertAdaptiveBlock({
      key,
      tenantId,
      isActive:         true,
      defaultVariant:   block.defaultVariant,
      adaptiveVariants: next,
    });
    if (!res.ok) return { ok: false, error: res.error };
    revalidatePath(`/admin/tenants/${tenantId}/forms/${formType}`);
    return { ok: true };
  } catch (err) {
    logger.error("[form-variants] delete failed", { tenantId, formType, error: String(err) });
    return { ok: false, error: "Failed to delete variant" };
  }
}
