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
  const contextSlots: ResolvedContextSlot[] = MARKETING_PAGE_TEMPLATE.contextSlots.map(
    (spec): ResolvedContextSlot => ({
      slotId:     spec.slotId as ContextSlotId,
      position:   spec.position,
      variantKey: enabledContextBlocks.has(spec.slotId as ContextBlockKey)
        ? resolveVariantKey(experience, spec.slotId)
        : null,
    }),
  );

  // ── 2. Map CMS sections → ContentBlocks ────────────────────────────────────
  //
  // Delegated to the canonical CMS mapper so that all page assemblers share
  // a single mapping path.  Unknown _type values are silently skipped.
  const contentBlocks = mapSectionsToContentBlocks(filteredSections);

  // ── 3. Build PageConfig ────────────────────────────────────────────────────
  //
  // title and seo fields are sourced from the CMS page document when available,
  // falling back to static defaults so the page always renders cleanly even
  // before the "home" document is seeded in Sanity.
  const pageConfig: PageConfig = {
    pageId:        "homepage",
    slug:          "/",
    title:         pageMeta?.title ?? "Home",
    templateKey:   "marketing-page",
    contextSlots,
    contentBlocks,
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
    case "hero":  return experience.plan.heroKey;
    case "proof": return experience.plan.proofKey;
    case "cta":   return experience.plan.ctaKey;
    default:      return null;
  }
}
