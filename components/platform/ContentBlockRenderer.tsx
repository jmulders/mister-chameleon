/**
 * ContentBlockRenderer
 *
 * Maps a platform-internal ContentBlock to the correct section component.
 * This is the block registry renderer — the single place where block types are
 * wired to their React components.
 *
 * ─── Architecture role ────────────────────────────────────────────────────────
 *
 *   ContentBlock (page-config type)
 *        ↓  ContentBlockRenderer   ← YOU ARE HERE
 *   React section component (components/blocks/sections/*)
 *
 *   Each component receives { data, variant } — the platform-internal data
 *   shape and the raw variant string from the block.  Components resolve the
 *   variant string internally via resolveBlockVariant(), falling back to
 *   "default" for absent or unrecognised values.
 *
 * ─── Adding a new block type ──────────────────────────────────────────────────
 *
 *   1. Add the new literal to ContentBlockKey in tenant/types.ts.
 *   2. Define the *BlockData interface in page-config/types.ts.
 *   3. Add the *Block struct to the ContentBlock union in page-config/types.ts.
 *   4. Register it in page-config/registry.ts.
 *   5. Implement the component in components/blocks/sections/.
 *   6. Export it from components/blocks/sections/index.ts.
 *   7. Add a case here (the compiler will flag the missing case).
 *
 * ─── Architecture contract ────────────────────────────────────────────────────
 *
 *   - Block types are never hard-coded in page components.
 *   - Layout is never driven by block type — only by block data and variants.
 *   - Styling uses design tokens only (delegated to section components).
 *   - A new layout must NOT require a new case here; use a variant instead.
 *   - The `default:` branch returns null — forward-compatible with registry
 *     growth.  New block types defined in the registry but not yet implemented
 *     here render nothing rather than crashing.
 */

import type { ContentBlock } from "@/page-config";
import {
  TextSectionBlock,
  FeatureGridBlock,
  TestimonialSectionBlock,
  FaqSectionBlock,
  CtaSectionBlock,
  StatsBlock,
  LogoStripBlock,
  FormSectionBlock,
  AboutBlock,
  NewsListBlock,
  ListingBlock,
  FilterBarBlock,
  SearchResultsBlock,
  ArticleMetaBlock,
  ArticleBodyBlock,
  RelatedContentBlock,
  VacancyMetaBlock,
  ApplyPanelBlock,
  SearchBlock,
  ProcessStepsBlock,
  RecruiterPanelBlock,
} from "@/components/blocks/sections";

// ─────────────────────────────────────────────────────────────────────────────

interface ContentBlockRendererProps {
  block: ContentBlock;
}

/**
 * Renders a single ContentBlock using the registered section component.
 *
 * Switches on `block.blockType` (the platform discriminator) to select the
 * component and pass `{ data: block.data, variant: block.variant }`.
 *
 * Unknown block types return null — forward-compatible with registry growth.
 */
export function ContentBlockRenderer({ block }: ContentBlockRendererProps) {
  switch (block.blockType) {

    // ── text ──────────────────────────────────────────────────────────────────

    case "textSection":
      return <TextSectionBlock data={block.data} variant={block.variant} />;

    // ── features ──────────────────────────────────────────────────────────────

    case "featureGrid":
      return <FeatureGridBlock data={block.data} variant={block.variant} />;

    case "faqSection":
      return <FaqSectionBlock data={block.data} variant={block.variant} />;

    // ── social proof ──────────────────────────────────────────────────────────

    case "testimonialSection":
      return <TestimonialSectionBlock data={block.data} variant={block.variant} />;

    case "stats":
      return <StatsBlock data={block.data} variant={block.variant} />;

    case "logoStrip":
      return <LogoStripBlock data={block.data} variant={block.variant} />;

    // ── conversion ────────────────────────────────────────────────────────────

    case "ctaSection":
      return <CtaSectionBlock data={block.data} variant={block.variant} />;

    case "formSection":
      return <FormSectionBlock data={block.data} variant={block.variant} />;

    // ── content ────────────────────────────────────────────────────────────────

    case "about":
      return <AboutBlock data={block.data} variant={block.variant} />;

    case "newsList":
      return <NewsListBlock data={block.data} variant={block.variant} />;

    // ── listing / detail ──────────────────────────────────────────────────────

    case "listing":
      return <ListingBlock data={block.data} variant={block.variant} />;

    case "filterBar":
      return <FilterBarBlock data={block.data} variant={block.variant} />;

    case "searchResults":
      return <SearchResultsBlock data={block.data} variant={block.variant} />;

    // ── article / vacancy detail ───────────────────────────────────────────────

    case "articleMeta":
      return <ArticleMetaBlock data={block.data} variant={block.variant} />;

    case "articleBody":
      return <ArticleBodyBlock data={block.data} variant={block.variant} />;

    case "relatedContent":
      return <RelatedContentBlock data={block.data} variant={block.variant} />;

    case "vacancyMeta":
      return <VacancyMetaBlock data={block.data} variant={block.variant} />;

    case "applyPanel":
      return <ApplyPanelBlock data={block.data} variant={block.variant} />;

    // ── search ────────────────────────────────────────────────────────────────

    case "search":
      return <SearchBlock data={block.data} variant={block.variant} />;

    // ── careers / W6 ──────────────────────────────────────────────────────────

    case "processSteps":
      return <ProcessStepsBlock data={block.data} variant={block.variant} />;

    case "recruiterPanel":
      return <RecruiterPanelBlock data={block.data} variant={block.variant} />;

    // ── defined (not yet implemented) ─────────────────────────────────────────
    //
    // These block types are registered in the registry (status: "defined") but
    // do not yet have rendered components.  They fall through to null so pages
    // with these blocks continue to render without crashing.

    default:
      return null;
  }
}
