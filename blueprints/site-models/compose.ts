/**
 * Blueprint Composer
 *
 * `composeBlueprint()` assembles a full Blueprint object from one or more
 * SiteModels and a composition meta descriptor.
 *
 * ─── How composition works ────────────────────────────────────────────────────
 *
 *   1. Page assembly
 *      For each SiteModelPage in each model (in model order):
 *        a. Resolve the PageType from the library.
 *        b. For every block in the PageType, check if the SiteModelPage
 *           has a noteOverride for that block type; if so, use it.
 *        c. Append any extraBlocks from the SiteModelPage.
 *        d. Apply any pageOverrides from the composition meta.
 *      Result: a BlueprintPage with industry-specific copy notes.
 *
 *   2. Rule merging
 *      Rules from all models are concatenated and de-duplicated by label.
 *      extraRules from the meta are appended after all model rules.
 *
 *   3. Scoring rule merging
 *      Scoring rules from all models are merged; later models' rules with
 *      the same key overwrite earlier ones.  extraScoringRules are appended.
 *
 *   4. Sequence pattern merging
 *      Sequence patterns are merged by slug; later entries overwrite earlier.
 *
 *   5. Theme resolution
 *      If the meta provides `recommendedThemePreset` / `recommendedThemeFamily`,
 *      those are used.  Otherwise they fall back to the first model's first
 *      suggested theme family name and canonical preset (looked up at runtime
 *      via theme-family-registry, avoiding a hard dependency here).
 *
 * ─── Idempotency guarantee ────────────────────────────────────────────────────
 *
 *   `composeBlueprint()` is a pure function: same inputs → same output.
 *   It does not mutate any model or page-type definition.
 *   apply-blueprint.ts handles idempotency at the database level.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   import { SERVICE_MODEL }     from "./service";
 *   import { CAREERS_MODEL }     from "./careers";
 *   import { composeBlueprint }  from "./compose";
 *
 *   export const accountingFirmBlueprint = composeBlueprint({
 *     key:         "accounting_firm",
 *     name:        "Accountantskantoor",
 *     description: "Professioneel en vertrouwenwekkend startpunt voor accountantskantoren.",
 *     industry:    "professional_services",
 *     models:      [SERVICE_MODEL],
 *     recommendedThemePreset: "corporate-trust",
 *     recommendedThemeFamily: "Corporate Trust",
 *     pageOverrides: {
 *       "/diensten": { title: "Diensten & Tarieven" },
 *       "/contact":  { noteOverrides: { contactSection: "Fiscale vraag? Vul het formulier in." } },
 *     },
 *   });
 */

import type {
  Blueprint,
  BlueprintPage,
  BlueprintBlock,
  BlueprintCompositionMeta,
  SiteModelPage,
} from "./types";
import type {
  BlueprintScoringRule,
  BlueprintSequencePattern,
} from "../blueprint-types";
import { getPageType }         from "./page-template-library";

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Resolve a single SiteModelPage into a BlueprintPage by merging the
 * structural PageType with the model's industry-specific note overrides.
 */
function resolveModelPage(
  siteModelPage: SiteModelPage,
  metaPageOverride?: {
    title?:         string;
    noteOverrides?: Record<string, string>;
    extraBlocks?:   BlueprintBlock[];
  },
): BlueprintPage {
  const pageType = getPageType(siteModelPage.pageTypeKey);

  // Merge note overrides: meta-level > model-level > page-type default
  const combinedNoteOverrides: Record<string, string> = {
    ...siteModelPage.noteOverrides,
    ...metaPageOverride?.noteOverrides,
  };

  // Build block list from the PageType, applying note overrides
  const blocks: BlueprintBlock[] = pageType.blocks.map((ptBlock) => ({
    type: ptBlock.type,
    note: combinedNoteOverrides[ptBlock.type] ?? ptBlock.note,
  }));

  // Append model-level extra blocks
  if (siteModelPage.extraBlocks) {
    for (const extra of siteModelPage.extraBlocks) {
      blocks.push(extra);
    }
  }

  // Append meta-level extra blocks
  if (metaPageOverride?.extraBlocks) {
    for (const extra of metaPageOverride.extraBlocks) {
      blocks.push(extra);
    }
  }

  return {
    slug:   siteModelPage.slug,
    title:  metaPageOverride?.title ?? siteModelPage.title,
    blocks,
  };
}

// ── Main composer ─────────────────────────────────────────────────────────────

/**
 * Compose a complete Blueprint from one or more SiteModels.
 *
 * This is the primary entry-point for the composable blueprint system.
 * The returned Blueprint is compatible with `apply-blueprint.ts` —
 * no other part of the apply pipeline needs to know about site models.
 */
export function composeBlueprint(meta: BlueprintCompositionMeta): Blueprint {
  // ── 1. Pages ─────────────────────────────────────────────────────────────

  const resolvedPages: BlueprintPage[] = [];
  const seenSlugs = new Set<string>();

  for (const model of meta.models) {
    for (const siteModelPage of model.pages) {
      // Avoid duplicate slugs when multiple models share a page (e.g. two models
      // both contributing "/" — first model wins)
      if (seenSlugs.has(siteModelPage.slug)) continue;
      seenSlugs.add(siteModelPage.slug);

      const pageOverride = meta.pageOverrides?.[siteModelPage.slug];
      resolvedPages.push(resolveModelPage(siteModelPage, pageOverride));
    }
  }

  // Append extra pages defined directly in the composition meta
  if (meta.extraPages) {
    for (const page of meta.extraPages) {
      if (!seenSlugs.has(page.slug)) {
        seenSlugs.add(page.slug);
        resolvedPages.push(page);
      }
    }
  }

  // ── 2. Rules ─────────────────────────────────────────────────────────────

  const ruleMap = new Map<string, Blueprint["rules"][number]>();
  for (const model of meta.models) {
    for (const rule of model.rules) {
      // De-duplicate by label; later models override earlier
      ruleMap.set(rule.label, rule);
    }
  }
  if (meta.extraRules) {
    for (const rule of meta.extraRules) {
      ruleMap.set(rule.label, rule);
    }
  }
  const rules = Array.from(ruleMap.values());

  // ── 3. Scoring rules ──────────────────────────────────────────────────────

  const scoringMap = new Map<string, BlueprintScoringRule>();
  for (const model of meta.models) {
    for (const sr of model.scoringRules) {
      scoringMap.set(sr.key, sr);
    }
  }
  if (meta.extraScoringRules) {
    for (const sr of meta.extraScoringRules) {
      scoringMap.set(sr.key, sr);
    }
  }
  const scoringRules = Array.from(scoringMap.values());

  // ── 4. Sequence patterns ──────────────────────────────────────────────────

  const seqMap = new Map<string, BlueprintSequencePattern>();
  for (const model of meta.models) {
    for (const sp of model.sequencePatterns) {
      seqMap.set(sp.slug, sp);
    }
  }
  const sequencePatterns = Array.from(seqMap.values());

  // ── 5. Theme resolution ───────────────────────────────────────────────────

  // Use explicit overrides first; fall back to the first model's suggestion
  const recommendedThemeFamily =
    meta.recommendedThemeFamily ??
    (meta.models[0]?.suggestedThemeFamilies[0] as string | undefined);

  // Note: ThemePresetKey resolution from family name requires the registry,
  // which would create a circular dependency.  Callers that need a specific
  // preset should pass `recommendedThemePreset` explicitly.  Otherwise the
  // apply-blueprint flow resolves the family name via resolveThemeFamilyPreset().
  const recommendedThemePreset = meta.recommendedThemePreset;

  // ── 6. Assemble ───────────────────────────────────────────────────────────

  return {
    key:             meta.key,
    name:            meta.name,
    description:     meta.description,
    longDescription: meta.longDescription,
    industry:        meta.industry,
    tags:            meta.tags,

    recommendedThemePreset,
    recommendedThemeFamily,

    pages:            resolvedPages,
    rules,
    scoringRules,
    sequencePatterns,
  };
}
