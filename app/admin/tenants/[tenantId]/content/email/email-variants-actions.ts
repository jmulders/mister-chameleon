"use server";

/**
 * Email Variant Authoring Actions (adaptive emails, rule-selected variants).
 *
 * Create, list, and delete the variants of an email template. A template's
 * variants live in the tenant's `email:<templateKey>` adaptive-block row (the
 * same store forms and the Content Matrix use), so authoring reuses the
 * adaptive-blocks store with no schema change. The payload is an
 * EmailVariantContent (subject, preheader, block set), stored in the block's
 * flexible JSONB and cast at this boundary.
 *
 * Selection (which variant a recipient sees) is handled by the decision engine.
 * A rule sets plan.emailVariants[templateKey] and renderAdaptiveEmail layers the
 * chosen variant over the resolved template.
 *
 * Access control is enforced by the tenant workspace layout (assertTenantAccess).
 */

import { revalidatePath } from "next/cache";
import {
  getAdaptiveBlockByKey,
  upsertAdaptiveBlock,
} from "@/lib/adaptive-blocks/adaptive-blocks-store";
import type { AdaptiveVariantContent, AdaptiveVariantEntry } from "@/cms/types";
import type { EmailVariantContent, EmailVariantEntry } from "@/lib/email/email-variant";
import { generateEmailCopy, type EmailCopy } from "@/ai/copy-generator";
import type { VariantTone } from "@/ai/variant-meta";
import { logger } from "@/lib/logger";

type Result = { ok: true } | { ok: false; error: string };

/** AI-draft the subject and preview text for an email variant from a brief. */
export async function draftEmailVariantAction(
  tenantId:      string,
  templateLabel: string,
  audience:      string,
  tone?:         VariantTone,
): Promise<{ ok: true; copy: EmailCopy } | { ok: false; error: string }> {
  void tenantId;
  if (!audience.trim()) return { ok: false, error: "Describe the audience first." };
  try {
    return await generateEmailCopy({ templateLabel, audience: audience.trim(), tone });
  } catch (err) {
    logger.error("[email-variants] draft failed", { templateLabel, error: String(err) });
    return { ok: false, error: "Draft failed" };
  }
}

/** List the variants authored for an email template (empty when none exist). */
export async function listEmailVariantsAction(
  tenantId:    string,
  templateKey: string,
): Promise<EmailVariantEntry[]> {
  try {
    const block = await getAdaptiveBlockByKey(`email:${templateKey}`, tenantId);
    return (block?.adaptiveVariants ?? []).map((v) => ({
      variantKey: v.variantKey,
      label:      v.label,
      content:    v.content as unknown as EmailVariantContent,
    }));
  } catch (err) {
    logger.error("[email-variants] list failed", { tenantId, templateKey, error: String(err) });
    return [];
  }
}

/** Create or replace a single email variant (keyed by variantKey). */
export async function saveEmailVariantAction(
  tenantId:    string,
  templateKey: string,
  entry:       EmailVariantEntry,
): Promise<Result> {
  const variantKey = entry.variantKey.trim();
  if (!variantKey) return { ok: false, error: "Variant key is required." };
  try {
    const key   = `email:${templateKey}`;
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
    revalidatePath(`/admin/tenants/${tenantId}/content/email`);
    return { ok: true };
  } catch (err) {
    logger.error("[email-variants] save failed", { tenantId, templateKey, error: String(err) });
    return { ok: false, error: "Failed to save variant" };
  }
}

/** Delete a single email variant by key. */
export async function deleteEmailVariantAction(
  tenantId:    string,
  templateKey: string,
  variantKey:  string,
): Promise<Result> {
  try {
    const key   = `email:${templateKey}`;
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
    revalidatePath(`/admin/tenants/${tenantId}/content/email`);
    return { ok: true };
  } catch (err) {
    logger.error("[email-variants] delete failed", { tenantId, templateKey, error: String(err) });
    return { ok: false, error: "Failed to delete variant" };
  }
}
