"use server";

/**
 * AI Variant Generator — server actions.
 *
 * Generates a draft variant from a brief (no save), and saves an approved draft
 * as an adaptive block. A per-slot cap keeps the candidate set — and the rule
 * surface — from sprawling: generation warns near the cap, saving is blocked at
 * it. See docs/ai-variant-generator.md.
 */

import { randomBytes }             from "node:crypto";
import { getRequiredAdminSession } from "@/lib/admin-auth/authorization";
import { isSelfServiceEnabled }    from "@/lib/self-service/self-service-store";
import { listAdaptiveBlocks }      from "@/lib/adaptive-blocks/adaptive-blocks-store";
import { upsertAdaptiveBlockAction } from "@/lib/adaptive-blocks/adaptive-blocks-actions";
import {
  generateVariant,
  MAX_VARIANTS_PER_SLOT,
  type VariantBrief,
  type GeneratedVariant,
  type GeneratorSlot,
}                                  from "@/ai/variant-generator";
import type { AdaptiveVariantContent } from "@/cms/types";

async function countForSlot(tenantId: string, slot: GeneratorSlot): Promise<number> {
  const blocks = await listAdaptiveBlocks(tenantId, false); // tenant-only, exclude platform
  return blocks.filter((b) => b.key.split("_")[0]?.toLowerCase() === slot).length;
}

export async function generateVariantAction(
  tenantId: string,
  brief:    VariantBrief,
): Promise<
  | { ok: true; variant: GeneratedVariant; count: number; cap: number }
  | { ok: false; error: string }
> {
  await getRequiredAdminSession();
  // Self-service gate: AI variant generation is a self-service authoring feature.
  // Agency-led tenants (default) can't reach it; the switch in Settings turns it on.
  if (!(await isSelfServiceEnabled(tenantId))) {
    return { ok: false, error: "Self-service staat uit voor deze tenant (agency-led). Zet 'Self-service mode' aan bij Settings om zelf varianten te genereren." };
  }
  const count = await countForSlot(tenantId, brief.slot);
  const res   = await generateVariant(brief);
  if (!res.ok) return res;
  return { ok: true, variant: res.variant, count, cap: MAX_VARIANTS_PER_SLOT };
}

export async function saveGeneratedVariantAction(
  tenantId:  string,
  slot:      GeneratorSlot,
  keySuffix: string,
  content:   AdaptiveVariantContent,
  decision:  GeneratedVariant["decision"],
): Promise<{ ok: true; id: string; key: string } | { ok: false; error: string }> {
  await getRequiredAdminSession();

  // Self-service gate (defense in depth — mirrors generateVariantAction).
  if (!(await isSelfServiceEnabled(tenantId))) {
    return { ok: false, error: "Self-service staat uit voor deze tenant (agency-led)." };
  }

  // Hard cap — keep the candidate set lean (and the rules overview manageable).
  const count = await countForSlot(tenantId, slot);
  if (count >= MAX_VARIANTS_PER_SLOT) {
    return {
      ok: false,
      error: `Variant cap reached (${MAX_VARIANTS_PER_SLOT} for "${slot}"). Archive or replace an existing variant before adding a new one.`,
    };
  }

  // Build a unique, readable key — never silently overwrite an existing block.
  const suffix = (keySuffix.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "ai");
  const key    = `${slot}_${suffix}_${randomBytes(2).toString("hex")}`;

  const res = await upsertAdaptiveBlockAction(
    {
      key,
      tenantId,
      isActive:         true,
      defaultVariant:   { ...content, decisionMeta: decision },
      adaptiveVariants: [],
    },
    `/admin/tenants/${tenantId}/personalization/blocks`,
  );
  if (!res.ok) return res;
  return { ok: true, id: res.id, key };
}
