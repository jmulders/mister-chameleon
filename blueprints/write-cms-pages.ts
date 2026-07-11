/**
 * Blueprint → Statamic page writer.
 *
 * Creates real page entries in a tenant's external Statamic CMS from a
 * blueprint's page list, so activation scaffolds pages that render on the live
 * site (not just platform page-store records).
 *
 * Mechanism: POST to the tenant CMS app's custom write route via
 * StatamicClient.upsertEntry("pages", slug, data) — the same primitive
 * StatamicProvider.provisionSite() uses. Each page entry carries a `page_blocks`
 * Replicator built from the canonical context-slot anchors (hero/proof/cta, so
 * the blueprint's personalization rules have targets) plus the blueprint's
 * content blocks with Dutch starter copy.
 *
 * Non-destructive: a page whose slug already exists in the CMS is skipped unless
 * `force` is set (upsertEntry overwrites in place on force). Fail-open per page —
 * one failed write is collected as a warning and never aborts the rest.
 *
 * Server-only. See docs/lead-base-design.md / blueprints/apply-blueprint.ts.
 */

import "server-only";

import { StatamicClient }                 from "@/cms/providers/statamic-client";
import { createCMSProviderAsync }         from "@/cms/providers/create-cms-provider";
import { getPlatformStatamicSettings }    from "@/platform/platform-store";
import { blockKeyToStatamicType, getBlockStarterContent } from "@/cms/seed/statamic-block-starter";
import { logger }                         from "@/lib/logger";
import type { TenantSettings }            from "@/tenant/types";
import type { Blueprint, BlueprintPage }  from "./blueprint-types";

const PAGES_COLLECTION = "pages";

/** Core adaptive slots given to every scaffolded page, in canonical order. */
const CONTEXT_SLOTS = ["hero", "proof", "cta"] as const;

export interface WriteCmsPagesResult {
  created:  number;
  skipped:  number;
  warnings: string[];
}

/** Blueprint slug ("/" → homepage) → Statamic entry slug ("home" / "pricing"). */
function toCmsSlug(blueprintSlug: string): string {
  const s = blueprintSlug.replace(/^\//, "").trim();
  return s === "" ? "home" : s;
}

/** Build the page_blocks Replicator array: context-slot anchors + content blocks. */
function buildPageBlocks(page: BlueprintPage): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = CONTEXT_SLOTS.map((slotId) => ({
    id:          `ctx_${slotId}`,
    type:        "context_slot",
    slot_type:   slotId,
    variant_key: `${slotId}_default`,
    is_active:   true,
  }));

  for (const b of page.blocks) {
    const statamicType = blockKeyToStatamicType(b.type);
    blocks.push({
      type:    statamicType,
      enabled: true,
      ...getBlockStarterContent(statamicType),
    });
  }
  return blocks;
}

/**
 * Write a blueprint's pages into the tenant's Statamic CMS.
 * Returns per-page counts; never throws.
 */
export async function writeBlueprintPagesToStatamic(
  tenant:    TenantSettings,
  blueprint: Blueprint,
  force:     boolean,
): Promise<WriteCmsPagesResult> {
  const result: WriteCmsPagesResult = { created: 0, skipped: 0, warnings: [] };

  try {
    // Resolve base URL + write credential (tenant override → platform settings).
    const platform = await getPlatformStatamicSettings();
    const platformData = platform.ok ? platform.data : undefined;
    const baseUrl =
      (tenant.cms as { statamicBaseUrl?: string }).statamicBaseUrl?.trim() ||
      platformData?.baseUrl?.trim() ||
      "";
    const apiKey = platformData?.apiKey?.trim() || undefined;

    if (!baseUrl) {
      result.warnings.push("Statamic base URL not configured — pages not written to CMS.");
      return result;
    }

    const client = new StatamicClient(baseUrl, apiKey);

    // Provider (read side) for a non-destructive existence check.
    const provider = await createCMSProviderAsync(tenant.cms, tenant.id);

    for (const page of blueprint.pages) {
      // Skip dynamic route templates (e.g. "/vacatures/[slug]") — not real pages.
      if (page.slug.includes("[")) continue;
      const slug   = toCmsSlug(page.slug);
      const isHome = slug === "home";

      // Non-destructive: keep an existing page unless force.
      if (!force) {
        try {
          const existing = await provider.getPageBySlug(slug);
          if (existing) { result.skipped++; continue; }
        } catch {
          // Existence check failed — fall through and attempt the write anyway.
        }
      }

      try {
        await client.upsertEntry(PAGES_COLLECTION, slug, {
          title:           page.title,
          blueprint:       "pages",
          template:        isHome ? "home" : "default",
          seo_description: "",
          page_blocks:     buildPageBlocks(page),
        });
        result.created++;
      } catch (err) {
        result.warnings.push(
          `Page "${slug}" not written: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  } catch (err) {
    logger.warn("[apply-blueprint] Statamic page write failed", {
      tenantId: tenant.id, err: err instanceof Error ? err.message : String(err),
    });
    result.warnings.push(err instanceof Error ? err.message : String(err));
  }

  return result;
}
