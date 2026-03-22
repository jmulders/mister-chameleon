/**
 * TemplateRenderer
 *
 * Generic slot-based page renderer. Accepts a PageConfig (structural) and an
 * optional ContextSlotData bundle (pre-fetched content), then renders the page by:
 *
 *   1. "before-content" context slots in template order
 *   2. Content blocks in their PageConfig array order (reorderable)
 *   3. "after-content" context slots in template order
 *
 * ─── Architecture role ────────────────────────────────────────────────────────
 *
 *   PageConfig + ContextSlotData?
 *        ↓  TemplateRenderer    ← YOU ARE HERE
 *   rendered JSX
 *     ├── context slots → HeroBlock / ProofBlock / CTABlock
 *     └── content blocks → ContentBlockRenderer → section components
 *
 * ─── Two rendering paths ─────────────────────────────────────────────────────
 *
 *   1. Engine path (homepage)
 *      Caller provides `contextData` pre-fetched by buildHomepagePageConfig().
 *      TemplateRenderer uses it directly — no extra CMS calls.
 *
 *   2. No-engine path (CMS pages)
 *      Caller provides only `pageConfig` (assembled via mapPageDataToPageConfig).
 *      Context slot variantKeys come from CmsPageContextConfig fallback keys.
 *      TemplateRenderer fetches slot content from the CMS itself, in parallel,
 *      using each active slot's variantKey.
 *
 * ─── Slot rendering ───────────────────────────────────────────────────────────
 *
 *   Context slots with variantKey === null are skipped.  This handles both
 *   "tenant entitlements exclude this block" and "decision engine returned no
 *   variant" cases transparently — no conditional logic at call sites.
 *
 * ─── Template vs content ──────────────────────────────────────────────────────
 *
 *   The TemplateRenderer does NOT look up the TemplateDefinition at runtime.
 *   The pageConfig.contextSlots array is already the resolved, ordered list of
 *   slots — it carries the `position` field set by the assembler.
 *   This keeps the renderer self-contained and template-agnostic.
 *
 * ─── Architecture contract ────────────────────────────────────────────────────
 *
 *   - This component controls NOTHING about what content is shown.
 *     It only controls which blocks render and in what order.
 *   - No layout-specific template branching. Order is driven by:
 *       a) the template slot order (before/after-content positions)
 *       b) the CMS contentBlocks array order (reorderable by editors)
 *   - Styling is entirely delegated to HeroBlock, ProofBlock, CTABlock,
 *     and ContentBlockRenderer. No styling tokens are used here.
 */

import type { PageConfig, ContextSlotData, ContextSlotId, ResolvedContextSlot } from "@/page-config";
import { createCMSProvider } from "@/cms";
import { HeroBlock }  from "@/components/blocks/HeroBlock";
import { ProofBlock } from "@/components/blocks/ProofBlock";
import { CTABlock }   from "@/components/blocks/CTABlock";
import { ContentBlockRenderer } from "./ContentBlockRenderer";

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT SLOT RENDERER
// ─────────────────────────────────────────────────────────────────────────────

interface ContextSlotRendererProps {
  slotId:      ContextSlotId;
  contextData: ContextSlotData;
}

/**
 * Renders a single context slot using the appropriate platform block component.
 *
 * Switches on slotId — exhaustive over the three defined context block types
 * (hero, proof, cta).  Returns null when the slot's data is absent (slot
 * disabled or CMS returned no content for the variant key).
 */
function ContextSlotRenderer({ slotId, contextData }: ContextSlotRendererProps) {
  switch (slotId) {
    case "hero":
      if (!contextData.hero) return null;
      return (
        <HeroBlock
          title={contextData.hero.title}
          subtitle={contextData.hero.subtitle}
          cta={contextData.hero.cta}
          tag={contextData.hero.tag}
          ctaKey={contextData.hero.ctaKey}
        />
      );

    case "proof":
      if (!contextData.proof) return null;
      return (
        <ProofBlock
          title={contextData.proof.title}
          items={contextData.proof.items}
        />
      );

    case "cta":
      if (!contextData.cta) return null;
      return (
        <CTABlock
          title={contextData.cta.title}
          text={contextData.cta.text}
          cta={contextData.cta.cta}
          ctaKey={contextData.cta.ctaKey}
        />
      );

    default:
      // Unknown slot type — forward-compatible; skip silently.
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE RENDERER
// ─────────────────────────────────────────────────────────────────────────────

interface TemplateRendererProps {
  /**
   * The structural page config — template key, resolved context slots, and
   * the ordered content blocks array.
   */
  pageConfig:   PageConfig;
  /**
   * Pre-fetched CMS content for the active context slots.
   *
   * ─── Engine path (homepage) ───────────────────────────────────────────────
   *
   *   Provide this when the decision engine has already fetched slot content —
   *   typically via buildHomepagePageConfig() in the homepage assembler.
   *   When present, TemplateRenderer uses it directly without extra CMS calls.
   *
   * ─── No-engine path (CMS pages) ──────────────────────────────────────────
   *
   *   Omit this when rendering a static CMS page (app/[slug]/page.tsx).
   *   TemplateRenderer will fetch slot content itself using each active
   *   slot's variantKey and createCMSProvider(), in parallel.
   */
  contextData?: ContextSlotData;
}

/**
 * Generic slot-based page renderer.
 *
 * Renders the page as three ordered sections:
 *   1. Context slots positioned "before-content" (e.g. hero, proof)
 *   2. Content blocks in their CMS-defined order (reorderable by editors)
 *   3. Context slots positioned "after-content" (e.g. closing cta)
 *
 * Inactive slots (variantKey === null or absent contextData) are skipped.
 * Empty content block arrays are silently skipped.
 *
 * This component is a React Server Component — no "use client" directive,
 * no hooks, no client-side state.
 */
export async function TemplateRenderer({ pageConfig, contextData }: TemplateRendererProps) {
  // ── Resolve context data ──────────────────────────────────────────────────
  //
  // Engine path:    contextData is pre-fetched by the caller; use it directly.
  // No-engine path: contextData is absent; fetch from CMS using variantKeys.
  const effectiveContextData: ContextSlotData = contextData
    ?? await fetchContextDataFromSlots(pageConfig.contextSlots);

  // Partition context slots by position once — both groups preserve array order.
  const beforeSlots = pageConfig.contextSlots.filter(
    (s) => s.position === "before-content" && s.variantKey !== null,
  );
  const afterSlots = pageConfig.contextSlots.filter(
    (s) => s.position === "after-content" && s.variantKey !== null,
  );

  return (
    <>
      {/* ── Before-content context slots (hero, proof, …) ─────────────────── */}
      {beforeSlots.map((slot) => (
        <ContextSlotRenderer
          key={slot.slotId}
          slotId={slot.slotId}
          contextData={effectiveContextData}
        />
      ))}

      {/* ── Content blocks (CMS-authored, reorderable) ────────────────────── */}
      {pageConfig.contentBlocks.map((block) => (
        <ContentBlockRenderer key={block.id} block={block} />
      ))}

      {/* ── After-content context slots (cta, …) ─────────────────────────── */}
      {afterSlots.map((slot) => (
        <ContextSlotRenderer
          key={slot.slotId}
          slotId={slot.slotId}
          contextData={effectiveContextData}
        />
      ))}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL — SLOT CONTENT FETCHER (no-engine path)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch CMS content for all active context slots in parallel.
 *
 * Called only on the no-engine path (i.e. when the caller did not provide
 * pre-fetched contextData).  Uses createCMSProvider() which returns the
 * environment-configured provider (mock → Sanity → Storyblok → Statamic).
 *
 * Slots with variantKey === null are skipped.
 * CMS misses (provider returned null) produce no entry in the result —
 * ContextSlotRenderer treats absent entries as inactive slots.
 *
 * ctaKey is set to the variantKey so click events on hero/cta buttons can be
 * attributed to the correct variant in analytics.
 */
async function fetchContextDataFromSlots(
  slots: readonly ResolvedContextSlot[],
): Promise<ContextSlotData> {
  const activeSlots = slots.filter((s) => s.variantKey !== null);
  if (activeSlots.length === 0) return {};

  const cms = createCMSProvider();

  // Fetch all active slots in parallel — no waterfall.
  const partials = await Promise.all(
    activeSlots.map(async (slot): Promise<Partial<ContextSlotData>> => {
      const key = slot.variantKey!;
      switch (slot.slotId) {
        case "hero": {
          const data = await cms.getHeroVariant(key);
          return data ? { hero: { ...data, ctaKey: key } } : {};
        }
        case "proof": {
          const data = await cms.getProofVariant(key);
          return data ? { proof: data } : {};
        }
        case "cta": {
          const data = await cms.getCTAVariant(key);
          return data ? { cta: { ...data, ctaKey: key } } : {};
        }
        default:
          // Unknown slot type — forward-compatible; no content to fetch.
          return {};
      }
    }),
  );

  // Merge all partial results into a single ContextSlotData object.
  // Later slots override earlier ones for the same slotId — should not
  // happen in practice since each slotId appears at most once per page.
  return Object.assign({} as ContextSlotData, ...partials);
}
