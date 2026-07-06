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
import type { BlockTokenSet, CuratedBlockTokens } from "@/design-system/theme/block-token-set";
import { BlockThemeScope } from "./BlockThemeScope";
import {
  TextSectionBlock,
  RichTextBlock,
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
  PricingSectionBlock,
  ContentSectionBlock,
  TeamSectionBlock,
  ProductOverviewBlock,
  ProductDetailBlock,
  CartSummaryBlock,
  CheckoutBlock,
  TextMediaBlock,
  QuoteBlock,
  MapBlock,
  TimelineBlock,
  QuickLinksBlock,
  ContactSectionBlock,
  VideoBlock,
} from "@/components/blocks/sections";
import { FloatingContactBlock } from "@/components/blocks/FloatingContactBlock";

// ─────────────────────────────────────────────────────────────────────────────

interface ContentBlockRendererProps {
  block: ContentBlock;
  /** Tenant's named block-token sets, used to resolve block-level token refs. */
  blockTokenSets?: readonly BlockTokenSet[] | null;
}

/**
 * Renders a single ContentBlock using the registered section component.
 *
 * Switches on `block.blockType` (the platform discriminator) to select the
 * component and pass `{ data: block.data, variant: block.variant }`.
 *
 * When `block.anchorId` is set, wraps the output in a `<div id="…">` so that
 * CTAs can deep-link to any block via `/page#anchor-id`.  `scrollMarginTop`
 * is set to the CSS custom property `--header-height` (with a 4 rem fallback)
 * so the anchor target clears a sticky header.
 *
 * Unknown block types return null — forward-compatible with registry growth.
 */
export function ContentBlockRenderer({ block, blockTokenSets }: ContentBlockRendererProps) {
  const rendered = renderContentBlock(block);
  if (!rendered) return null;

  // Anchor wrapper (in-page linking) is applied first, then the block-token
  // scope wraps the whole thing so scoped CSS vars cover anchor + content.
  const withAnchor = block.anchorId ? (
    <div id={block.anchorId} style={{ scrollMarginTop: "var(--header-height, 4rem)" }}>
      {rendered}
    </div>
  ) : (
    rendered
  );

  // Resolve the block's token ref. DB-authored blocks carry tokenSet/tokens as
  // first-class fields. CMS-authored (Statamic) blocks carry them inside `data`
  // as `mc_token_set` / `mc_tokens` — support both, so per-block design tokens
  // work on Statamic sites without changes to the CMS provider.
  const data = block.data as Record<string, unknown> | undefined;
  const dataTokenSet = typeof data?.["mc_token_set"] === "string" ? (data["mc_token_set"] as string).trim() : "";
  const dataTokens   = data?.["mc_tokens"];
  const tokenSet = block.tokenSet ?? (dataTokenSet || undefined);
  const tokens =
    block.tokens ??
    (dataTokens && typeof dataTokens === "object" && !Array.isArray(dataTokens)
      ? (dataTokens as CuratedBlockTokens)
      : undefined);

  return (
    <BlockThemeScope
      tokenRef={{ tokenSet, tokens }}
      sets={blockTokenSets}
      scopeId={block.id}
    >
      {withAnchor}
    </BlockThemeScope>
  );
}

function renderContentBlock(block: ContentBlock) {
  switch (block.blockType) {

    // ── text ──────────────────────────────────────────────────────────────────

    case "textSection":
      return <TextSectionBlock data={block.data} variant={block.variant} surface={block.surface} />;

    case "richText":
      return <RichTextBlock data={block.data} variant={block.variant} />;

    // ── features ──────────────────────────────────────────────────────────────

    case "featureGrid":
      return <FeatureGridBlock data={block.data} variant={block.variant} surface={block.surface} />;

    case "faqSection":
      return <FaqSectionBlock data={block.data} variant={block.variant} surface={block.surface} />;

    // ── social proof ──────────────────────────────────────────────────────────

    case "testimonialSection":
      return <TestimonialSectionBlock data={block.data} variant={block.variant} surface={block.surface} />;

    case "stats":
      return <StatsBlock data={block.data} variant={block.variant} surface={block.surface} />;

    case "logoStrip":
      return <LogoStripBlock data={block.data} variant={block.variant} surface={block.surface} />;

    case "textMedia":
      return <TextMediaBlock data={block.data} variant={block.variant} surface={block.surface} />;

    // ── conversion ────────────────────────────────────────────────────────────

    case "ctaSection":
      return <CtaSectionBlock data={block.data} variant={block.variant} />;

    case "formSection":
      return <FormSectionBlock data={block.data} variant={block.variant} />;

    // ── content ────────────────────────────────────────────────────────────────

    case "about":
      return <AboutBlock data={block.data} variant={block.variant} surface={block.surface} />;

    case "newsList":
      return <NewsListBlock data={block.data} variant={block.variant} surface={block.surface} />;

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
      return <ProcessStepsBlock data={block.data} variant={block.variant} surface={block.surface} />;

    case "recruiterPanel":
      return <RecruiterPanelBlock data={block.data} variant={block.variant} surface={block.surface} />;

    // ── conversion / pricing ──────────────────────────────────────────────────

    case "pricingSection":
      return <PricingSectionBlock data={block.data} variant={block.variant} />;

    // ── content / editorial ───────────────────────────────────────────────────

    case "contentSection":
      return <ContentSectionBlock data={block.data} variant={block.variant} />;

    case "teamSection":
      return <TeamSectionBlock data={block.data} variant={block.variant} surface={block.surface} />;

    // ── commerce / product ────────────────────────────────────────────────────

    case "productOverview":
      return <ProductOverviewBlock data={block.data} variant={block.variant} />;

    case "productDetail":
      return <ProductDetailBlock data={block.data} variant={block.variant} />;

    case "cartSummary":
      return <CartSummaryBlock data={block.data} variant={block.variant} />;

    case "checkoutBlock":
      return <CheckoutBlock data={block.data} variant={block.variant} />;

    // ── quote ─────────────────────────────────────────────────────────────────

    case "quote":
      return <QuoteBlock data={block.data} variant={block.variant} />;

    // ── map ───────────────────────────────────────────────────────────────────

    case "mapBlock":
      return <MapBlock data={block.data} variant={block.variant} />;

    // ── timeline ──────────────────────────────────────────────────────────────

    case "timeline":
      return <TimelineBlock data={block.data} variant={block.variant} surface={block.surface} />;

    // ── quick links ───────────────────────────────────────────────────────────

    case "quickLinks":
      return <QuickLinksBlock data={block.data} variant={block.variant} surface={block.surface} />;

    // ── contact section ───────────────────────────────────────────────────────

    case "contactSection":
      return <ContactSectionBlock data={block.data} variant={block.variant} surface={block.surface} />;

    case "floatingContact":
      return <FloatingContactBlock data={block.data} />;

    // ── media ─────────────────────────────────────────────────────────────────

    case "video":
      return <VideoBlock data={block.data} variant={block.variant} />;

    // ── defined (not yet implemented) ─────────────────────────────────────────
    //
    // These block types are registered in the registry (status: "defined") but
    // do not yet have rendered components.  They fall through to null so pages
    // with these blocks continue to render without crashing.

    default:
      return null;
  }
}
