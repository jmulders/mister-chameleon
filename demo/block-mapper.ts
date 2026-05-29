/**
 * demo/block-mapper.ts
 *
 * Mapping layer: DemoBlockSpec[] → Chameleon ContentBlock[] + context slot data.
 *
 * This module is the canonical bridge between the Demo generator's output contract
 * (DemoSiteSpec / DemoPageSpec / DemoBlockSpec) and the Chameleon block system's
 * internal types (ContentBlock, ResolvedContextSlot, HeroBlockData, CTABlockData).
 *
 * ─── Architecture ─────────────────────────────────────────────────────────────
 *
 *   DemoPageSpec
 *        ↓  mapDemoPage(page, language, scenarioId)
 *   DemoMappedPage {
 *     contextSlots:     ResolvedContextSlot[]    ← for the template renderer
 *     contentBlocks:    ContentBlock[]           ← for the content renderer
 *     contextBlockData: { hero?, cta? }          ← data that normally comes from CMS
 *   }
 *
 * The "careers" DemoBlockType expands to two content blocks: contentSection (intro)
 * + listing (role cards). All other types produce exactly one block.
 *
 * "cta" DemoBlockType is mapped to BOTH a ResolvedContextSlot (for the adaptive
 * renderer path) AND a ctaSection ContentBlock (for the demo viewer path that
 * bypasses the decision engine).
 *
 * ─── Safety guarantees ────────────────────────────────────────────────────────
 *
 *   - Never throws. All per-block errors are caught and logged; failing blocks
 *     are silently skipped so the rest of the page renders cleanly.
 *   - Variant strings are always validated via resolveBlockVariant() /
 *     resolveContextBlockVariant(). Invalid variants fall back to the type default.
 *   - Missing optional fields produce sensible defaults (empty arrays, "#" hrefs,
 *     etc.) rather than undefined where the Chameleon types require a value.
 *   - Bilingual: content.nl is used when language === "nl" and present; otherwise
 *     content.en is used as the universal fallback.
 *
 * Server only — imports @/page-config/types and @/cms/types.
 */

import type {
  ContentBlock,
  FeatureGridBlockData,
  StatsBlockData,
  TestimonialSectionBlockData,
  LogoStripBlockData,
  CaseHighlightBlockData,
  CtaSectionBlockData,
  PricingSectionBlockData,
  ContentSectionBlockData,
  ContactSectionBlockData,
  TextSectionBlockData,
  FaqSectionBlockData,
  ProcessStepsBlockData,
  ListingBlockData,
  ResolvedContextSlot,
} from "@/page-config/types";
import type { HeroBlockData, CTABlockData, PortableTextBlock } from "@/cms/types";
import {
  resolveBlockVariant,
  resolveContextBlockVariant,
} from "@/page-config/block-variants";

import type {
  DemoBlockSpec,
  DemoBlockContent,
  DemoHeroContent,
  DemoFeaturesContent,
  DemoStatsContent,
  DemoTestimonialsContent,
  DemoLogosContent,
  DemoCaseHighlightContent,
  DemoCtaContent,
  DemoPricingContent,
  DemoCareersContent,
  DemoContactContent,
  DemoTextContent,
  DemoFaqContent,
  DemoProcessContent,
  DemoPageSpec,
  DemoSiteSpec,
  DemoThemeSpec,
} from "./block-contract";
import { isContextBlock, DEMO_BLOCK_DEFAULT_VARIANTS } from "./block-contract";
import type { DemoLanguage, DemoScenarioId, BrandSignals } from "./types";

// ── Output types ──────────────────────────────────────────────────────────────

/** Pre-fetched content for the two demo context slots (hero, cta). */
export interface DemoMappedContextSlotData {
  hero?: HeroBlockData;
  cta?:  CTABlockData;
}

/**
 * A fully mapped demo page, ready for the Chameleon renderer or DemoViewer.
 *
 * `contextSlots` + `contextBlockData` feed the adaptive context-slot renderer.
 * `contentBlocks` is the ordered content block array rendered between slots.
 *
 * The demo viewer can use `contentBlocks` exclusively when it does not use the
 * full decision-engine pipeline — the "cta" block is always present in
 * `contentBlocks` as a ctaSection block in addition to the context slot record.
 */
export interface DemoMappedPage {
  slug:             string;
  title:            string;
  template:         "marketing-page" | "landing-page" | "article-page";
  contextSlots:     ResolvedContextSlot[];
  contentBlocks:    ContentBlock[];
  contextBlockData: DemoMappedContextSlotData;
}

/** A fully mapped demo site — all pages mapped to DemoMappedPage. */
export interface DemoMappedSite {
  meta:   DemoSiteSpec["meta"];
  theme:  DemoThemeSpec;
  pages:  DemoMappedPage[];
}

// ── Scenario override helper ──────────────────────────────────────────────────

/**
 * Resolve the effective content for a block given the active language and scenario.
 *
 * Resolution order:
 *   1. Pick base content: `content.nl` when language === "nl" and present;
 *      otherwise `content.en`.
 *   2. If `scenarioId` is set and the block has an override for that scenario,
 *      shallow-merge the override on top of the base content.
 *
 * The merge is intentionally shallow — block content interfaces are flat enough
 * that a shallow merge covers all override use cases without needing deep merging.
 */
export function applyScenarioOverride(
  spec:       DemoBlockSpec,
  scenarioId: DemoScenarioId | null,
  language:   DemoLanguage,
): DemoBlockContent {
  const base: DemoBlockContent =
    language === "nl" && spec.content.nl ? spec.content.nl : spec.content.en;

  if (!scenarioId) return base;
  const override = spec.scenarioOverrides?.[scenarioId];
  if (!override) return base;

  return { ...base, ...override } as DemoBlockContent;
}

// ── Stable ID generation ──────────────────────────────────────────────────────

let _seq = 0;

function nextId(prefix: string): string {
  return `${prefix}-${String(++_seq).padStart(3, "0")}`;
}

/** Reset the sequence counter. Called at the start of each mapDemoPage() call. */
function resetIdSeq(): void {
  _seq = 0;
}

// ── PortableText helper ───────────────────────────────────────────────────────

/**
 * Convert a plain text string to a minimal single-paragraph PortableText block.
 * Used by block mappers that receive plain-text body fields from the contract.
 */
function toPortableText(text: string): PortableTextBlock[] {
  return [
    {
      _type:    "block",
      _key:     "p0",
      style:    "normal",
      children: [{ _type: "span", _key: "s0", text, marks: [] }],
      markDefs: [],
    },
  ];
}

// ── Context slot mappers ──────────────────────────────────────────────────────

function mapHeroBlock(
  spec:    DemoBlockSpec,
  content: DemoBlockContent,
): { slot: ResolvedContextSlot; data: HeroBlockData } {
  const c = content as DemoHeroContent;
  const layoutVariant = resolveContextBlockVariant(
    "hero",
    spec.variant || DEMO_BLOCK_DEFAULT_VARIANTS.hero,
  );

  const data: HeroBlockData = {
    id:           spec.id,
    layoutVariant,
    title:        c.headline,
    subtitle:     c.subheadline,
    ctas: [
      { label: c.primaryCta.label, href: c.primaryCta.href },
      ...(c.secondaryCta
        ? [{ label: c.secondaryCta.label, href: c.secondaryCta.href, variant: "secondary" as const }]
        : []),
    ],
    tag: c.tag,
    ...(spec.media?.url
      ? { media: { kind: "image" as const, url: spec.media.url, alt: spec.media.alt ?? "" } }
      : {}),
  };

  const slot: ResolvedContextSlot = {
    slotId:        "hero",
    variantKey:    spec.id,
    position:      "before-content",
    layoutVariant,
  };

  return { slot, data };
}

function mapCtaContextBlock(
  spec:    DemoBlockSpec,
  content: DemoBlockContent,
): { slot: ResolvedContextSlot; data: CTABlockData } {
  const c = content as DemoCtaContent;
  const layoutVariant = resolveContextBlockVariant(
    "cta",
    spec.variant || DEMO_BLOCK_DEFAULT_VARIANTS.cta,
  );

  const data: CTABlockData = {
    id:           spec.id,
    layoutVariant,
    title:        c.heading,
    text:         c.body,
    cta:          { label: c.primaryCta.label, href: c.primaryCta.href },
  };

  const slot: ResolvedContextSlot = {
    slotId:        "cta",
    variantKey:    spec.id,
    position:      "after-content",
    layoutVariant,
  };

  return { slot, data };
}

// ── Content block mappers ─────────────────────────────────────────────────────

function mapFeaturesBlock(spec: DemoBlockSpec, content: DemoBlockContent): ContentBlock {
  const c = content as DemoFeaturesContent;
  const variant = resolveBlockVariant("featureGrid", spec.variant || DEMO_BLOCK_DEFAULT_VARIANTS.features);
  const columns: 3 | 4 =
    variant === "feature_grid_4up" || variant === "feature_grid_cards" || variant === "cards"
      ? 4
      : 3;

  const data: FeatureGridBlockData = {
    heading:  c.heading,
    features: c.items.map((item) => ({
      title:       item.title,
      description: item.description,
      icon:        item.icon,
    })),
    columns,
    ...(c.cta ? { cta: { label: c.cta.label, href: c.cta.href } } : {}),
  };

  return { id: nextId("features"), blockType: "featureGrid", variant, data };
}

function mapStatsBlock(spec: DemoBlockSpec, content: DemoBlockContent): ContentBlock {
  const c = content as DemoStatsContent;
  const variant = resolveBlockVariant("stats", spec.variant || DEMO_BLOCK_DEFAULT_VARIANTS.stats);

  const data: StatsBlockData = {
    heading: c.heading,
    items:   c.items.map((item) => ({
      value:   item.value,
      label:   item.label,
      prefix:  item.prefix,
      suffix:  item.suffix,
    })),
  };

  return { id: nextId("stats"), blockType: "stats", variant, data };
}

function mapTestimonialsBlock(spec: DemoBlockSpec, content: DemoBlockContent): ContentBlock {
  const c = content as DemoTestimonialsContent;
  const variant = resolveBlockVariant(
    "testimonialSection",
    spec.variant || DEMO_BLOCK_DEFAULT_VARIANTS.testimonials,
  );

  const data: TestimonialSectionBlockData = {
    heading:      c.heading,
    testimonials: c.items.map((item) => ({
      quote:   item.quote,
      author:  item.author,
      company: item.company,
      avatar:  item.avatar,
    })),
  };

  return { id: nextId("testimonials"), blockType: "testimonialSection", variant, data };
}

function mapLogosBlock(spec: DemoBlockSpec, content: DemoBlockContent): ContentBlock {
  const c = content as DemoLogosContent;
  const variant = resolveBlockVariant("logoStrip", spec.variant || DEMO_BLOCK_DEFAULT_VARIANTS.logos);

  const data: LogoStripBlockData = {
    heading:          c.heading,
    logos:            c.logos.map((logo) => ({ name: logo.name, src: logo.src })),
    animationEnabled: true,
    grayscale:        variant === "muted",
  };

  return { id: nextId("logos"), blockType: "logoStrip", variant, data };
}

function mapCaseHighlightBlock(spec: DemoBlockSpec, content: DemoBlockContent): ContentBlock {
  const c = content as DemoCaseHighlightContent;

  const data: CaseHighlightBlockData = {
    heading:   c.heading,
    client:    c.client,
    challenge: c.challenge,
    outcome:   c.outcome,
    metrics:   c.metrics,
    imageUrl:  spec.media?.url,
    ctaLabel:  c.ctaLabel,
    ctaHref:   c.ctaHref,
  };

  return { id: nextId("case"), blockType: "caseHighlight", variant: "default", data };
}

function mapCtaContentBlock(spec: DemoBlockSpec, content: DemoBlockContent): ContentBlock {
  const c = content as DemoCtaContent;
  const variant = resolveBlockVariant("ctaSection", spec.variant || DEMO_BLOCK_DEFAULT_VARIANTS.cta);

  const data: CtaSectionBlockData = {
    title:        c.heading,
    description:  c.body,
    primaryCta:   { label: c.primaryCta.label, href: c.primaryCta.href },
    secondaryCta: c.secondaryCta
      ? { label: c.secondaryCta.label, href: c.secondaryCta.href }
      : undefined,
    background:   c.background ?? "brand",
    imageUrl:     spec.media?.url,
    imageAlt:     spec.media?.alt,
  };

  return { id: nextId("cta"), blockType: "ctaSection", variant, data };
}

function mapPricingBlock(spec: DemoBlockSpec, content: DemoBlockContent): ContentBlock {
  const c = content as DemoPricingContent;
  const variant = resolveBlockVariant(
    "pricingSection",
    spec.variant || DEMO_BLOCK_DEFAULT_VARIANTS.pricing,
  );

  const data: PricingSectionBlockData = {
    heading:    c.heading,
    subheading: c.subheading,
    tiers:      c.tiers.map((tier) => ({
      name:        tier.name,
      price:       tier.price,
      period:      tier.period,
      description: tier.description,
      features:    tier.features,
      ctaLabel:    tier.ctaLabel,
      ctaHref:     tier.ctaHref ?? "#",
      highlighted: tier.highlighted,
      badge:       tier.badge,
    })),
    footnote: c.footnote,
  };

  return { id: nextId("pricing"), blockType: "pricingSection", variant, data };
}

/**
 * Expands a "careers" DemoBlockSpec into two content blocks:
 *   1. contentSection — intro heading + culture body copy + optional CTA
 *   2. listing        — role cards grid
 */
function mapCareersBlock(spec: DemoBlockSpec, content: DemoBlockContent): ContentBlock[] {
  const c = content as DemoCareersContent;
  const sectionVariant = resolveBlockVariant(
    "contentSection",
    spec.variant || DEMO_BLOCK_DEFAULT_VARIANTS.careers,
  );

  const sectionData: ContentSectionBlockData = {
    eyebrow: c.eyebrow,
    heading: c.heading,
    intro:   c.body,
    ctas:    c.ctaLabel
      ? [{ label: c.ctaLabel, href: c.ctaHref ?? "#" }]
      : undefined,
    align:   "center",
  };

  const listingData: ListingBlockData = {
    items: c.roles.map((role, i) => ({
      id:       `role-${i}`,
      title:    role.title,
      href:     role.href ?? "#",
      category: role.department,
      meta:     [{ label: "Location", value: role.location }],
    })),
  };

  return [
    { id: nextId("careers-intro"), blockType: "contentSection", variant: sectionVariant,  data: sectionData },
    { id: nextId("careers-roles"), blockType: "listing",         variant: "listing_cards", data: listingData },
  ];
}

function mapContactBlock(spec: DemoBlockSpec, content: DemoBlockContent): ContentBlock {
  const c = content as DemoContactContent;
  const variant = resolveBlockVariant(
    "contactSection",
    spec.variant || DEMO_BLOCK_DEFAULT_VARIANTS.contact,
  );

  const data: ContactSectionBlockData = {
    heading:     c.heading,
    description: c.description,
    address:     c.address,
    phone:       c.phone,
    email:       c.email,
    hours:       c.hours,
    mapUrl:      c.mapUrl,
    ctas:        c.ctas?.map((cta) => ({
      label:   cta.label,
      href:    cta.href,
      variant: cta.variant,
    })),
  };

  return { id: nextId("contact"), blockType: "contactSection", variant, data };
}

function mapTextBlock(spec: DemoBlockSpec, content: DemoBlockContent): ContentBlock {
  const c = content as DemoTextContent;
  const variant = resolveBlockVariant(
    "textSection",
    spec.variant || DEMO_BLOCK_DEFAULT_VARIANTS.text,
  );

  const data: TextSectionBlockData = {
    heading:   c.heading,
    body:      toPortableText(c.body),
    alignment: c.alignment ?? "left",
  };

  return { id: nextId("text"), blockType: "textSection", variant, data };
}

function mapFaqBlock(spec: DemoBlockSpec, content: DemoBlockContent): ContentBlock {
  const c = content as DemoFaqContent;
  const variant = resolveBlockVariant(
    "faqSection",
    spec.variant || DEMO_BLOCK_DEFAULT_VARIANTS.faq,
  );

  const data: FaqSectionBlockData = {
    heading: c.heading,
    items:   c.items.map((item) => ({
      question: item.question,
      answer:   item.answer,
    })),
  };

  return { id: nextId("faq"), blockType: "faqSection", variant, data };
}

function mapProcessBlock(spec: DemoBlockSpec, content: DemoBlockContent): ContentBlock {
  const c = content as DemoProcessContent;
  const variant = resolveBlockVariant(
    "processSteps",
    spec.variant || DEMO_BLOCK_DEFAULT_VARIANTS.process,
  );

  const data: ProcessStepsBlockData = {
    heading: c.heading,
    steps:   c.steps.map((step) => ({
      title:       step.title,
      description: step.description,
      duration:    step.duration,
    })),
  };

  return { id: nextId("process"), blockType: "processSteps", variant, data };
}

// ── Main block mapper ─────────────────────────────────────────────────────────

/**
 * Convert a single DemoBlockSpec to zero or more Chameleon ContentBlocks.
 *
 * Returns `null` for context-slot block types ("hero", "cta") — those are
 * handled separately by the context slot mappers in mapDemoPage().
 * The "cta" type is an exception: the mapper also emits a ctaSection content
 * block so the demo viewer can render it without the decision engine.
 *
 * Returns `null` (not an error) for context slots called directly.
 * Returns an empty array when the block fails to map (error is logged).
 *
 * @param spec       The block spec to map
 * @param language   Active display language (picks content.nl or content.en)
 * @param scenarioId Active scenario (applies overrides before mapping)
 */
export function mapDemoBlockToContentBlocks(
  spec:       DemoBlockSpec,
  language:   DemoLanguage        = "en",
  scenarioId: DemoScenarioId | null = null,
): ContentBlock[] | null {
  if (spec.type === "hero") return null; // context slot only — no content block

  const content = applyScenarioOverride(spec, scenarioId, language);

  try {
    switch (spec.type) {
      case "features":       return [mapFeaturesBlock(spec, content)];
      case "stats":          return [mapStatsBlock(spec, content)];
      case "testimonials":   return [mapTestimonialsBlock(spec, content)];
      case "logos":          return [mapLogosBlock(spec, content)];
      case "case_highlight": return [mapCaseHighlightBlock(spec, content)];
      case "cta":            return [mapCtaContentBlock(spec, content)];
      case "pricing":        return [mapPricingBlock(spec, content)];
      case "careers":        return mapCareersBlock(spec, content);
      case "contact":        return [mapContactBlock(spec, content)];
      case "text":           return [mapTextBlock(spec, content)];
      case "faq":            return [mapFaqBlock(spec, content)];
      case "process":        return [mapProcessBlock(spec, content)];
      default: {
        const exhaustive: never = spec.type;
        console.warn(`[demo/block-mapper] unknown block type: ${String(exhaustive)}`);
        return [];
      }
    }
  } catch (err) {
    console.error(
      `[demo/block-mapper] failed to map block id=${spec.id} type=${spec.type}`,
      err instanceof Error ? err.message : String(err),
    );
    return [];
  }
}

// ── Page mapper ───────────────────────────────────────────────────────────────

/**
 * Convert a DemoPageSpec to a DemoMappedPage ready for the Chameleon renderer
 * or the DemoViewer component.
 *
 * Iteration order within `page.blocks` is preserved. Context slot blocks (hero,
 * cta) are extracted into `contextSlots` + `contextBlockData`; all others go into
 * `contentBlocks` in their original order.
 *
 * @param page       Page spec from the demo generator
 * @param language   Active display language
 * @param scenarioId Active scenario for content override resolution
 */
export function mapDemoPage(
  page:       DemoPageSpec,
  language:   DemoLanguage        = "en",
  scenarioId: DemoScenarioId | null = null,
): DemoMappedPage {
  resetIdSeq();

  const contextSlots:     ResolvedContextSlot[]     = [];
  const contentBlocks:    ContentBlock[]             = [];
  const contextBlockData: DemoMappedContextSlotData  = {};

  for (const spec of page.blocks) {
    if (!isContextBlock(spec.type)) {
      const blocks = mapDemoBlockToContentBlocks(spec, language, scenarioId);
      if (blocks && blocks.length > 0) contentBlocks.push(...blocks);
      continue;
    }

    const content = applyScenarioOverride(spec, scenarioId, language);

    if (spec.type === "hero") {
      try {
        const { slot, data } = mapHeroBlock(spec, content);
        contextSlots.push(slot);
        contextBlockData.hero = data;
      } catch (err) {
        console.error(
          `[demo/block-mapper] hero block mapping failed id=${spec.id}`,
          err instanceof Error ? err.message : String(err),
        );
      }
    } else if (spec.type === "cta") {
      try {
        // Map to context slot (for adaptive renderer)
        const { slot, data } = mapCtaContextBlock(spec, content);
        contextSlots.push(slot);
        contextBlockData.cta = data;
        // Also emit as ctaSection content block (for demo viewer without decision engine)
        const ctaContentBlock = mapCtaContentBlock(spec, content);
        contentBlocks.push(ctaContentBlock);
      } catch (err) {
        console.error(
          `[demo/block-mapper] cta block mapping failed id=${spec.id}`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }

  return {
    slug:             page.slug,
    title:            page.title,
    template:         page.template,
    contextSlots,
    contentBlocks,
    contextBlockData,
  };
}

// ── Site mapper ───────────────────────────────────────────────────────────────

/**
 * Convert a full DemoSiteSpec to a DemoMappedSite.
 * Maps all pages in order; each page is mapped independently with its own ID counter.
 */
export function mapDemoSite(
  site:       DemoSiteSpec,
  language:   DemoLanguage        = "en",
  scenarioId: DemoScenarioId | null = null,
): DemoMappedSite {
  return {
    meta:  site.meta,
    theme: site.theme,
    pages: site.pages.map((page) => mapDemoPage(page, language, scenarioId)),
  };
}

// ── BrandSignals → DemoThemeSpec ──────────────────────────────────────────────

/**
 * Convert extracted BrandSignals to a DemoThemeSpec.
 *
 * Used by the generate pipeline when building the `theme` field of a DemoSiteSpec
 * from the site analysis results.  The header variant is chosen based on the site
 * name length: long names work better with header_default (nav right), short names
 * with header_cta (nav centre + CTA pinned right).
 */
export function brandSignalsToTheme(
  signals:  BrandSignals,
  siteName: string,
): import("./block-contract").DemoThemeSpec {
  return {
    primaryColor:    signals.primaryColor,
    secondaryColor:  signals.secondaryColor,
    textColor:       signals.textColor,
    surfaceColor:    signals.surfaceColor,
    headingFont:     signals.headingFont ?? undefined,
    bodyFont:        signals.bodyFont    ?? undefined,
    googleFontsUrl:  signals.googleFontsUrl ?? undefined,
    borderRadius:    signals.borderRadius,
    headerVariant:   siteName.length > 14 ? "header_default" : "header_cta",
  };
}
