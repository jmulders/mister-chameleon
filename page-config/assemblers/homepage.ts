/**
 * Homepage PageConfig Assembler
 *
 * Converts the pre-fetched homepage data (decision-engine experience + CMS
 * sections + tenant entitlements) into the platform-internal PageConfig +
 * ContextSlotData bundle consumed by TemplateRenderer.
 *
 * ─── Position in the data flow ───────────────────────────────────────────────
 *
 *   composeHomepageExperience()   → HomepageExperience  (decision + CMS)
 *   cmsProvider.getPageBySlug()   → PageData            (CMS sections)
 *   filterSectionsByTenant()      → PageSectionData[]   (tenant-gated)
 *   getEnabledContextBlocks()     → ReadonlySet<…>      (tenant-gated)
 *          ↓
 *   buildHomepagePageConfig()     ← YOU ARE HERE
 *          ↓
 *   { pageConfig, contextData }   → TemplateRenderer
 *
 * ─── What this assembler does ─────────────────────────────────────────────────
 *
 *   1. Maps each ContextSlotSpec from HOMEPAGE_TEMPLATE into a
 *      ResolvedContextSlot — carrying the variant key from the decision plan
 *      when the slot is enabled, or variantKey: null when disabled.
 *
 *   2. Maps each PageSectionData (CMS-typed, with _type/_key) into a
 *      ContentBlock (platform-internal, with blockType/id).  Unknown block
 *      types are silently skipped (forward-compatible).
 *
 *   3. Populates ContextSlotData with the pre-fetched CMS content for each
 *      slot (including ctaKey for click-event attribution).
 *
 * ─── Migration note ───────────────────────────────────────────────────────────
 *
 *   This assembler is an incremental-migration bridge.  It exists because the
 *   current homepage pre-fetches all context slot content before the renderer
 *   runs (via composeHomepageExperience).  In a future step, TemplateRenderer
 *   will fetch slot content itself using the variant key + CMS provider, and
 *   this assembler will be simplified to structural assembly only.
 *
 * ─── Architecture contract ────────────────────────────────────────────────────
 *
 *   CMS data flows IN → platform-internal types flow OUT.
 *   No layout logic lives here.  No styling decisions are made.
 *   The assembler is a pure mapping function — testable, no side effects.
 */

import type { ContextBlockKey }         from "@/tenant";
import type { PageSectionData }         from "@/cms/types";
import type { HomepageExperience }      from "@/experience/types";
import type {
  PageConfig,
  PageItem,
  ResolvedContextSlot,
  ContextSlotData,
  ContextSlotId,
}                                       from "@/page-config";
import { MARKETING_PAGE_TEMPLATE }      from "@/page-config/templates";
import { mapSectionsToContentBlocks }   from "@/cms/mappers";

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Result type returned by buildHomepagePageConfig.
 *
 * `pageConfig`   — the structural page config (template + slots + blocks)
 * `contextData`  — the pre-fetched CMS content for each active context slot
 */
export interface HomepagePageBundle {
  readonly pageConfig:   PageConfig;
  readonly contextData:  ContextSlotData;
}

/**
 * CMS-sourced metadata for the homepage document.
 *
 * All fields are optional — the assembler falls back to safe static defaults
 * when the home-page document does not yet exist in the CMS.
 *
 *   title          — internal page title (e.g. "Home"); used as <title> fallback
 *   seoTitle       — SEO override for the <title> tag
 *   seoDescription — SEO meta description
 */
export interface HomepagePageMeta {
  readonly title?:          string;
  readonly seoTitle?:       string;
  readonly seoDescription?: string;
}

/**
 * Assemble a HomepagePageBundle from the resolved homepage data.
 *
 * Called after the decision engine and CMS fetches complete, before the
 * renderer runs.  Pure function — no I/O, no side effects.
 *
 * @param experience          Resolved HomepageExperience (hero, proof, cta data + plan).
 * @param filteredSections    Tenant-gated CMS page sections (from filterSectionsByTenant).
 * @param enabledContextBlocks Tenant-gated set of active context block keys.
 * @param pageMeta            Optional CMS page metadata (title, SEO).  When absent
 *                            the assembler falls back to static defaults ("Home", empty SEO).
 *
 * @returns HomepagePageBundle ready to pass to TemplateRenderer.
 *
 * @example
 * const { pageConfig, contextData } = buildHomepagePageConfig(
 *   experience,
 *   filteredSections,
 *   enabledContextBlocks,
 *   { title: homePage.title, seoTitle: homePage.seoTitle, seoDescription: homePage.seoDescription },
 * );
 * return <TemplateRenderer pageConfig={pageConfig} contextData={contextData} />;
 */
export function buildHomepagePageConfig(
  experience:            HomepageExperience,
  filteredSections:      PageSectionData[],
  enabledContextBlocks:  ReadonlySet<ContextBlockKey>,
  pageMeta?:             HomepagePageMeta,
): HomepagePageBundle {

  // ── 1. Resolve context slots from the template ─────────────────────────────
  //
  // Each slot in HOMEPAGE_TEMPLATE.contextSlots becomes a ResolvedContextSlot.
  // variantKey is set when the slot is enabled; null when the tenant has
  // disabled this block or the entitlement check fails.
  //
  // layoutVariant is sourced from the CMS block data so that both
  // TemplateRenderer and the debug panel have a consistent source of truth.
  // Without it, the slot carries no layoutVariant at all, and the renderer's
  // explicit `layoutVariant={slot.layoutVariant}` prop (which JSX evaluates as
  // `layoutVariant={undefined}`) silently overwrites the value in the
  // mapHeroBlockData/mapProofBlockData/mapCTABlockData spread — causing the
  // component to always resolve to its family default layout (hero_default).
  const contextSlots: ResolvedContextSlot[] = MARKETING_PAGE_TEMPLATE.contextSlots.map(
    (spec): ResolvedContextSlot => {
      const slotId = spec.slotId as ContextSlotId;

      // Extended slots (conversion, notification) are not gated by
      // enabledContextBlocks — they render whenever the experience resolved
      // content for them, regardless of the stored tenant block config.
      // This mirrors how notification is handled in contextData below:
      // the slot is active iff the experience returned content for it.
      //
      // Core slots (hero, proof, cta) ARE gated by enabledContextBlocks so
      // tenants can disable sections that don't fit their site structure.
      const isExtendedSlot = slotId === "conversion" || slotId === "notification";
      const variantKey = isExtendedSlot
        ? resolveVariantKey(experience, slotId)
        : enabledContextBlocks.has(spec.slotId as ContextBlockKey)
          ? resolveVariantKey(experience, spec.slotId)
          : null;

      return {
        slotId,
        position: spec.position,
        variantKey,
        // Propagate the CMS-authored layout variant from the fetched block data.
        // Stored here so downstream code (debug panel, tests) can inspect it
        // without traversing contextData.
        ...slotLayoutVariant(experience, slotId),
      };
    },
  );

  // ── 2. Map CMS sections → ContentBlocks ────────────────────────────────────
  //
  // Delegated to the canonical CMS mapper so that all page assemblers share
  // a single mapping path.  Unknown _type values are silently skipped.
  const contentBlocks = mapSectionsToContentBlocks(filteredSections);

  // ── 3. Build pageItems ────────────────────────────────────────────────────
  //
  // Unified Statamic mode (filteredSections contains contextSlot entries):
  //   Walk filteredSections in authored order so content blocks appear exactly
  //   where the CMS editor placed them relative to context slots.
  //   Example: hero → image block → proof → cta renders in that order on the page.
  //
  // Classic template mode (no embedded context slots):
  //   Sanity / Storyblok layout — before-content slots → content blocks →
  //   after-content slots.  Slots come from MARKETING_PAGE_TEMPLATE positions.
  const hasEmbeddedSlots = filteredSections.some((s) => s._type === "contextSlot");

  let pageItems: PageItem[];

  if (hasEmbeddedSlots) {
    // Fast lookups: slotId → resolved slot, block id → content block.
    // slotMap keys are typed as string (not ContextSlotId) so that section.slotId
    // (typed as string in ContextSlotSectionData) can be used directly as a lookup
    // key without a cast.
    const slotMap  = new Map<string, ResolvedContextSlot>(contextSlots.map((s) => [s.slotId, s]));
    const blockMap = new Map(contentBlocks.map((b) => [b.id, b]));

    pageItems = [];
    for (const section of filteredSections) {
      if (!section) continue;
      if (section._type === "contextSlot") {
        if (section.enabled === false) continue;
        const slot = slotMap.get(section.slotId);
        if (slot) pageItems.push({ kind: "slot", slot });
      } else {
        const block = blockMap.get(section._key);
        if (block) pageItems.push({ kind: "block", block });
      }
    }
  } else {
    // Classic template-mode layout.
    pageItems = [
      ...contextSlots
        .filter((s) => s.position === "before-content")
        .map((slot): PageItem => ({ kind: "slot", slot })),
      ...contentBlocks.map((block): PageItem => ({ kind: "block", block })),
      ...contextSlots
        .filter((s) => s.position === "after-content")
        .map((slot): PageItem => ({ kind: "slot", slot })),
    ];
  }

  const pageConfig: PageConfig = {
    pageId:        "homepage",
    slug:          "/",
    title:         pageMeta?.title ?? "Home",
    templateKey:   "marketing-page",
    contextSlots,
    contentBlocks,
    pageItems,
    seo: {
      title:       pageMeta?.seoTitle,
      description: pageMeta?.seoDescription,
    },
  };

  // ── 4. Build ContextSlotData ───────────────────────────────────────────────
  //
  // Only populate slots that are enabled — absent means inactive.
  // ctaKey is included on hero and cta slots so TrackedCTAButton can attribute
  // click events to the correct variant.
  const contextData: ContextSlotData = {
    hero: enabledContextBlocks.has("hero")
      ? { ...experience.hero,  ctaKey: experience.plan.heroKey }
      : undefined,
    proof: enabledContextBlocks.has("proof")
      ? experience.proof
      : undefined,
    cta: enabledContextBlocks.has("cta")
      ? { ...experience.cta,   ctaKey: experience.plan.ctaKey }
      : undefined,
    // Conversion block — not gated by enabledContextBlocks.
    // Renders whenever the experience resolved conversion content (i.e. the
    // decision plan had a conversionKey AND the CMS returned content for it).
    // All packages include conversion in their allowedBlocks.context, so
    // gating here by stored tenant config adds friction without value and
    // can cause the block to silently disappear when the DB config is stale.
    conversion: experience.conversion ?? undefined,
    // Feature block — extended slot, same pattern as conversion: not gated by
    // enabledContextBlocks; renders whenever the experience resolved feature
    // content (plan.featureKey + a CMS document). Previously omitted here, so a
    // feature context slot never rendered on the homepage engine path even when
    // the variant existed — the no-engine path (other pages) did handle it.
    feature: experience.feature ?? undefined,
    // Notification is an overlay — enabled when the experience resolved one.
    // It is not gated by enabledContextBlocks (which governs inline sections).
    notification: experience.notification ?? undefined,
  };

  return { pageConfig, contextData };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Look up the variant key for a context slot from the experience plan.
 * Returns null for unknown slot IDs (defensive; should not happen in practice).
 */
function resolveVariantKey(experience: HomepageExperience, slotId: string): string | null {
  switch (slotId) {
    case "hero":       return experience.plan.heroKey;
    case "proof":      return experience.plan.proofKey;
    case "cta":        return experience.plan.ctaKey;
    case "conversion": return experience.plan.conversionKey ?? null;
    default:           return null;
  }
}

/**
 * Extract the CMS-authored layoutVariant from the pre-fetched block data for a
 * given context slot.  Returns a partial object so it can be spread directly into
 * the ResolvedContextSlot constructor — absent when the slot has no layoutVariant.
 *
 * Storing this value on the slot means:
 *   a) TemplateRenderer can pass it as the authoritative layout source without
 *      reading contextData separately.
 *   b) Debug panels and tests can inspect it from the slot without traversing
 *      the contextData bundle.
 */
function slotLayoutVariant(
  experience: HomepageExperience,
  slotId: ContextSlotId,
): { layoutVariant?: string } {
  switch (slotId) {
    case "hero":
      return experience.hero.layoutVariant
        ? { layoutVariant: experience.hero.layoutVariant }
        : {};
    case "proof":
      return experience.proof.layoutVariant
        ? { layoutVariant: experience.proof.layoutVariant }
        : {};
    case "cta":
      return experience.cta.layoutVariant
        ? { layoutVariant: experience.cta.layoutVariant }
        : {};
    case "conversion":
      return experience.conversion?.layoutVariant
        ? { layoutVariant: experience.conversion.layoutVariant }
        : {};
    default:
      return {};
  }
}
