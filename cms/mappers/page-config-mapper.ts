/**
 * CMS → PageConfig mapper
 *
 * Pure mapping functions that convert CMS-typed page data into the
 * platform-internal PageConfig shape consumed by TemplateRenderer.
 *
 * ─── Architecture role ────────────────────────────────────────────────────────
 *
 *   CMS data (PageData, PageSectionData[])
 *        ↓  mapSectionsToContentBlocks()      ← content block mapping
 *        ↓  mapContextConfigToResolvedSlots() ← context slot mapping (no engine)
 *        ↓  mapPageDataToPageConfig()          ← full page config assembly
 *   PageConfig (platform-internal, CMS-agnostic)
 *
 * ─── Separation of concerns ───────────────────────────────────────────────────
 *
 *   This file owns the CMS ↔ platform-internal translation.
 *   It does NOT run the decision engine or select variants.
 *
 *   Context slot variant keys are ALWAYS provided by the caller (the decision
 *   engine) when using the adaptive / homepage path. The CMS may define
 *   advisory hints (allowedVariantKeys, fallbackVariantKey via
 *   CmsContextSlotConfig) but must never override the engine's decision.
 *
 *   For static CMS-driven pages (app/[slug]/page.tsx), where there is no
 *   decision engine, mapContextConfigToResolvedSlots() converts the CMS
 *   contextConfig into ResolvedContextSlot[] by using each slot's
 *   fallbackVariantKey directly. This is the "no-engine" path.
 *
 * ─── Safe adapter path ────────────────────────────────────────────────────────
 *
 *   mapPageDataToPageConfig() accepts `null` for pageData.  When null, it
 *   produces a valid PageConfig with sensible defaults so pages that have no
 *   CMS document yet (e.g. the homepage using the mock provider) continue to
 *   render correctly.  Default values:
 *     pageId:      slug (or "unknown")
 *     title:       "" (empty — caller may override via SEO layer)
 *     templateKey: derived from resolvedContextSlots or "article-page"
 *     contentBlocks: []
 *
 * ─── Adding a new block type ──────────────────────────────────────────────────
 *
 *   1. Add the new PageSectionData variant to cms/types.ts.
 *   2. Add the ContentBlock variant to page-config/types.ts.
 *   3. Register the type in page-config/registry.ts.
 *   4. Add a case to mapSectionToContentBlock() below.
 *   5. Add a case to ContentBlockRenderer.
 *   The compiler will flag any missing cases in this switch.
 */

import type { PageSectionData, PageData, CmsPageContextConfig,
              CmsContentSource }           from "@/cms/types";
import type {
  ContentBlock,
  ResolvedContextSlot,
  PageConfig,
  PageItem,
  PageSeoConfig,
  TemplateKey,
}                                          from "@/page-config";
import { isRegisteredBlockType }           from "@/page-config";
import type { PortableTextBlock }          from "@/cms/types";
import {
  getTemplateDefinition,
  isTemplateKey,
}                                          from "@/page-config/templates";
import type { ContentSource,
              CollectionKey,
              CollectionSourceMode,
              CollectionSortDir }          from "@/page-config/collection-source";

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Convert an ordered array of CMS page sections into platform-internal
 * ContentBlocks.
 *
 * Unknown `_type` values are silently skipped — forward-compatible with CMS
 * schema additions that the platform hasn't implemented yet.
 *
 * This is the canonical section → block mapping.  It is called both by
 * mapPageDataToPageConfig() and directly by the homepage assembler so that
 * all callers share a single mapping path.
 *
 * The `variant` field on each section (when present) is forwarded verbatim to
 * ContentBlock.variant.  The block component normalises unknown variant strings
 * to "default" via resolveBlockVariant().
 *
 * @param sections  Array of CMS PageSectionData (may be empty).
 * @returns         Ordered array of ContentBlocks (unknown types removed).
 */
export function mapSectionsToContentBlocks(sections: PageSectionData[]): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  for (const section of sections) {
    // Sanity returns null for unresolvable references (deleted blocks).
    // Guard here so callers never need to pre-filter the raw sections array.
    if (!section || !isRegisteredBlockType(section._type)) continue;
    const block = mapSectionToContentBlock(section);
    if (block) {
      // Forward optional anchor ID from CMS section to the content block so
      // ContentBlockRenderer can render it as an id="" attribute on the wrapper.
      // Cast to PageSectionBase: isRegisteredBlockType() above already filtered
      // out ContextSlotSectionData, which is the only union member that does not
      // extend PageSectionBase.
      // Forward optional anchor ID + block-level design tokens (named set +
      // inline tweaks) from the CMS section so ContentBlockRenderer can render
      // the anchor and scope the block's tokens.
      const base = section as import("../types").PageSectionBase;
      const hasTokens = Boolean(base.tokens && Object.keys(base.tokens).length > 0);
      if (base.anchorId || base.tokenSet || hasTokens) {
        blocks.push({
          ...block,
          ...(base.anchorId ? { anchorId: base.anchorId } : {}),
          ...(base.tokenSet ? { tokenSet: base.tokenSet } : {}),
          ...(hasTokens ? { tokens: base.tokens } : {}),
        } as ContentBlock);
      } else {
        blocks.push(block);
      }
    }
  }
  return blocks;
}

/**
 * Derive ResolvedContextSlot[] from a CMS PageData document using the
 * advisory contextConfig fallback keys.
 *
 * This is the "no-engine" path for static CMS-driven pages (app/[slug]/page.tsx).
 * The decision engine is not involved — fallbackVariantKey from the CMS becomes
 * the active variantKey for each slot.
 *
 * Template inference order:
 *   1. pageData.templateKey if it is a valid TemplateKey
 *   2. "marketing-page" if contextConfig is present
 *   3. "article-page" (no context slots)
 *
 * @param pageData  A non-null CMS page document.
 * @returns         ResolvedContextSlot[] matching the page's template slots.
 */
export function mapContextConfigToResolvedSlots(
  pageData: PageData,
): ResolvedContextSlot[] {
  const config = pageData.contextConfig ?? {};

  // ── Infer template key ────────────────────────────────────────────────────
  const rawKey = pageData.templateKey;
  const templateKey: TemplateKey = (rawKey && isTemplateKey(rawKey))
    ? rawKey
    : hasAnyContextSignal(config)
      ? "marketing-page"
      : inferTemplateFromSections(pageData.sections ?? []);

  const template = getTemplateDefinition(templateKey);
  if (!template || template.contextSlots.length === 0) return [];

  // ── Map each template slot to a resolved slot ─────────────────────────────
  return template.contextSlots.map((spec) => {
    const slotCfg = config[spec.slotId as keyof CmsPageContextConfig];

    const variantKey: string | null =
      slotCfg?.fallbackVariantKey ?? null;

    return {
      slotId:     spec.slotId,
      variantKey,
      position:   spec.position,
    };
  });
}

/**
 * Convert a CMS PageData document (or null) into a platform-internal PageConfig.
 *
 * Context slots are provided by the caller as `resolvedContextSlots` when the
 * decision engine has already run (homepage / adaptive path).  When omitted,
 * slots are derived from pageData.contextConfig via mapContextConfigToResolvedSlots()
 * — the "no-engine" path for static CMS pages.
 *
 * When `pageData` is null (e.g. mock provider, page not yet in CMS), sensible
 * defaults keep the page functional:
 *   - slug defaults to the `fallbackSlug` argument
 *   - contentBlocks is empty
 *   - templateKey is inferred from resolved slots or defaults to "article-page"
 *
 * @param pageData              CMS page document, or null when absent.
 * @param resolvedContextSlots  Engine-resolved slots (variantKey set or null).
 *                              When omitted, derived from pageData.contextConfig.
 * @param fallbackSlug          Used as pageId/slug when pageData is null.
 * @returns                     Platform-internal PageConfig ready for rendering.
 */
export function mapPageDataToPageConfig(
  pageData:              PageData | null,
  resolvedContextSlots?: readonly ResolvedContextSlot[],
  fallbackSlug           = "unknown",
): PageConfig {
  const slug  = pageData?.slug  ?? fallbackSlug;
  const title = pageData?.title ?? "";

  const sections = pageData?.sections ?? [];

  // ── Determine rendering mode ──────────────────────────────────────────────
  // Unified mode:   sections[] contains contextSlot entries (Statamic model).
  //                 Slots and content blocks are interleaved in authored order.
  // Template mode:  sections[] is pure content + contextConfig has slot config
  //                 (Sanity/Storyblok model).  Slots go before/after content.
  const hasEmbeddedSlots = sections.some((s) => s._type === "contextSlot");

  let pageItems: PageItem[];
  let contextSlots: ResolvedContextSlot[];
  let contentBlocks: ContentBlock[];

  if (resolvedContextSlots) {
    // ── Caller-provided slots (decision engine / Live Preview path) ────────
    // Sections may or may not contain contextSlot entries.
    // In either case, use the caller-provided slots (keyed by slotId).
    const slotMap = new Map(resolvedContextSlots.map((s) => [s.slotId, s]));
    pageItems = buildPageItemsFromSections(sections, slotMap);
    contextSlots = resolvedContextSlots.slice();
    contentBlocks = resolvedContextSlots.length > 0
      ? pageItems.filter((i): i is { kind: "block"; block: ContentBlock } => i.kind === "block").map((i) => i.block)
      : mapSectionsToContentBlocks(sections);
  } else if (hasEmbeddedSlots) {
    // ── Unified Statamic mode: contextSlot entries in sections[] ──────────
    // Build pageItems in sections order.  contextSlots is derived from pageItems.
    pageItems = buildPageItemsFromSections(sections, undefined);
    contextSlots = pageItems
      .filter((i): i is { kind: "slot"; slot: ResolvedContextSlot } => i.kind === "slot")
      .map((i) => i.slot);
    contentBlocks = pageItems
      .filter((i): i is { kind: "block"; block: ContentBlock } => i.kind === "block")
      .map((i) => i.block);
  } else {
    // ── Template mode: contextConfig-driven (Sanity / Storyblok) ─────────
    // Derive slots from contextConfig using the template definition.
    // Build pageItems: before-content slots → content blocks → after-content slots.
    const derivedSlots = pageData ? mapContextConfigToResolvedSlots(pageData) : [];
    contentBlocks = mapSectionsToContentBlocks(sections);
    const beforeSlots = derivedSlots.filter((s) => s.position !== "after-content");
    const afterSlots  = derivedSlots.filter((s) => s.position === "after-content");
    pageItems = [
      ...beforeSlots.map<PageItem>((slot) => ({ kind: "slot", slot })),
      ...contentBlocks.map<PageItem>((block) => ({ kind: "block", block })),
      ...afterSlots.map<PageItem>((slot)  => ({ kind: "slot", slot })),
    ];
    contextSlots = derivedSlots;
  }

  // ── Template key ──────────────────────────────────────────────────────────
  const rawTemplateKey = pageData?.templateKey;
  const templateKey: PageConfig["templateKey"] =
    (rawTemplateKey && isTemplateKey(rawTemplateKey))
      ? rawTemplateKey
      : inferTemplateKey(contextSlots, sections);

  const seo: PageSeoConfig = {
    title:       pageData?.seoTitle       ?? undefined,
    description: pageData?.seoDescription ?? undefined,
  };

  return {
    pageId:       slug,
    slug:         slug.startsWith("/") ? slug : `/${slug}`,
    title,
    templateKey,
    pageItems,
    contextSlots,
    contentBlocks,
    seo,
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Convert a CmsContentSource to the platform-internal ContentSource.
 *
 * The two types are structurally identical (the CMS layer defines its own
 * version to stay decoupled from page-config).  This function performs the
 * cross-layer translation and provides a single conversion point.
 *
 * Returns `undefined` when the CMS value is absent so that block data types
 * correctly represent the absent-source (manual) case without an explicit
 * { source: "manual" } value.
 */
function mapCmsContentSource(src: CmsContentSource | undefined): ContentSource | undefined {
  if (!src) return undefined;
  if (src.source === "manual") return { source: "manual" };
  return {
    source:      "collection",
    collection:  src.collection  as CollectionKey,
    mode:        src.mode        as CollectionSourceMode,
    limit:       src.limit,
    sortDir:     src.sortDir     as CollectionSortDir | undefined,
    selectedIds: src.selectedIds ? [...src.selectedIds] as readonly string[] : undefined,
  };
}

/**
 * Convert a single CMS PageSectionData into a platform-internal ContentBlock.
 *
 * Returns null for unknown _type values (callers should filter these out).
 *
 * Mapping conventions:
 *   _key     → id          (stable CMS identifier)
 *   _type    → blockType   (CMS discriminator → platform block type)
 *   variant  → variant     (forwarded verbatim; component normalises to "default")
 *   null     → undefined   (CMS may return null; platform types use optional fields)
 *   ctaSection: buttonLabel/buttonHref → primaryCta (typed platform shape)
 */
function mapSectionToContentBlock(section: PageSectionData): ContentBlock | null {
  switch (section._type) {

    case "textSection":
      return {
        id:        section._key,
        blockType: "textSection",
        variant:   section.variant,
        surface:   section.surface,
        data: {
          heading:  section.heading,
          htmlBody: section.htmlBody,
          // Cast: readonly PortableTextBlock[] is widened to the mutable array
          // shape that TextSectionBlockData expects.  Safe — data is only read.
          body:     section.body as PortableTextBlock[] | undefined,
        },
      };

    case "richText":
      return {
        id:        section._key,
        blockType: "richText",
        variant:   section.variant,
        surface:   section.surface,
        data: {
          // Cast: optional mutable array → required readonly array.
          // Empty array fallback mirrors the CMS contract (body is always
          // present in practice; component handles empty body gracefully).
          body:     (section.body ?? []) as readonly PortableTextBlock[],
          // htmlBody is set for Bard-sourced content (save_html:true or Live Preview).
          // RichTextBlock renders this with dangerouslySetInnerHTML when present.
          htmlBody: section.htmlBody,
          maxWidth: section.maxWidth,
        },
      };

    case "featureGrid":
      return {
        id:        section._key,
        blockType: "featureGrid",
        variant:   section.variant,
        surface:   section.surface,
        data: {
          heading:  section.heading,
          features: (section.features ?? []).map((f) => ({
            title:       f.title,
            description: f.description,
            icon:        f.icon,
          })),
          // Pass the optional CTA button through to the component.
          cta: section.cta
            ? { label: section.cta.label, href: section.cta.href, variant: section.cta.variant }
            : undefined,
        },
      };

    case "testimonialSection":
      return {
        id:        section._key,
        blockType: "testimonialSection",
        variant:   section.variant,
        surface:   section.surface,
        data: {
          heading:      section.heading,
          testimonials: (section.testimonials ?? []).map((t) => ({
            quote:   t.quote,
            author:  t.author,
            role:    t.role,
            company: t.company,
            // Pass avatar through so all variants (default, featured-image, slider) can render photos.
            avatar:  t.avatar,
          })),
        },
      };

    case "faqSection":
      return {
        id:        section._key,
        blockType: "faqSection",
        variant:   section.variant,
        surface:   section.surface,
        data: {
          heading: section.heading,
          items:   (section.items ?? []).map((i) => ({
            question: i.question,
            answer:   i.answer,
          })),
        },
      };

    case "ctaSection": {
      // Prefer the structured `cta` object; fall back to the legacy flat fields
      // for documents that pre-date the schema migration.
      const ctaLabel = section.cta?.label ?? section.buttonLabel;
      const ctaHref  = section.cta?.href  ?? section.buttonHref;
      return {
        id:        section._key,
        blockType: "ctaSection",
        variant:   section.variant,
        surface:   section.surface,
        data: {
          title:        section.title,
          description:  section.description,
          primaryCta:   ctaLabel && ctaHref
            ? { label: ctaLabel, href: ctaHref }
            : undefined,
          secondaryCta: section.secondaryCta
            ? { label: section.secondaryCta.label, href: section.secondaryCta.href }
            : undefined,
        },
      };
    }

    case "formSection":
      // The CMS carries only placement config + copy overrides.
      // Field definitions, validation, and routing come from the platform-side
      // FormDefinition resolved at render time via getFormDefinition(formKey).
      return {
        id:        section._key,
        blockType: "formSection",
        variant:   section.variant,
        surface:   section.surface,
        data: {
          formKey:        section.formKey,
          title:          section.title,
          intro:          section.intro,
          submitLabel:    section.submitLabel,
          successMessage: section.successMessage,
        },
      };

    // ── Social proof / media ──────────────────────────────────────────────────

    case "logoStrip":
      return {
        id:        section._key,
        blockType: "logoStrip",
        variant:   section.variant,
        surface:   section.surface,
        data: {
          heading:          section.heading,
          logos:            (section.logos ?? []).map((logo) => ({
            name: logo.name,
            src:  logo.src,
            url:  logo.url,
          })),
          animationEnabled: section.animationEnabled,
          speed:            section.speed as "slow" | "medium" | "fast" | undefined,
          grayscale:        section.grayscale,
          showLabels:       section.showLabels,
        },
      };

    case "textMedia": {
      // body is stored as plain text (type:"text") in Sanity.
      // Wrap it in a minimal PortableText block so PortableTextRenderer can consume it.
      const tmBody: PortableTextBlock[] | undefined = section.body
        ? [{ _type: "block", _key: "b0", style: "normal", markDefs: [], children: [{ _type: "span", _key: "s0", text: section.body, marks: [] }] } as unknown as PortableTextBlock]
        : undefined;
      return {
        id:        section._key,
        blockType: "textMedia",
        variant:   section.variant,
        surface:   section.surface,
        data: {
          eyebrow:     section.eyebrow,
          heading:     section.heading,
          body:        tmBody,
          mediaType:   section.mediaType,
          mediaUrl:    section.mediaUrl,
          mediaAlt:    section.mediaAlt,
          caption:     section.caption,
          videoSource:    section.videoSource,
          posterUrl:      section.posterUrl,
          autoPlay:       section.autoPlay,
          loop:           section.loop,
          mediaBgType:    section.mediaBgType,
          mediaBgColor:   section.mediaBgColor,
          mediaBgImageUrl: section.mediaBgImageUrl,
          ctas: (section.ctas ?? []).map((c) => ({
            label: c.label,
            href:  c.href,
          })),
        },
      };
    }

    case "stats":
      return {
        id:        section._key,
        blockType: "stats",
        variant:   section.variant,
        surface:   section.surface,
        data: {
          heading: section.heading,
          items:   (section.items ?? []).map((item) => ({
            label:       item.label,
            value:       item.value,
            prefix:      item.prefix,
            suffix:      item.suffix,
            description: item.description,
          })),
        },
      };

    // ── Content ───────────────────────────────────────────────────────────────

    case "about":
      return {
        id:        section._key,
        blockType: "about",
        variant:   section.variant,
        surface:   section.surface,
        data: {
          heading:     section.heading,
          body:        section.body as PortableTextBlock[] | undefined,
          imageUrl:    section.imageUrl,
          imageAlt:    section.imageAlt,
          teamMembers: (section.teamMembers ?? []).map((m) => ({
            name:        m.name,
            role:        m.role,
            bio:         m.bio,
            imageUrl:    m.imageUrl,
            profileHref: m.profileHref,
            socials:     m.socials,
          })),
          ctas: (section.ctas ?? []).map((c) => ({
            label:   c.label,
            href:    c.href,
            variant: c.variant,
          })),
        },
      };

    case "newsList":
      return {
        id:        section._key,
        blockType: "newsList",
        variant:   section.variant,
        surface:   section.surface,
        data: {
          heading:       section.heading,
          maxItems:      section.maxItems,
          // Inline items — populated for manual-source blocks; empty for collection-driven
          items:         (section.items ?? []).map((item) => ({
            title:    item.title,
            url:      item.url,
            excerpt:  item.excerpt,
            date:     item.date,
            imageUrl: item.imageUrl,
            category: item.category,
          })),
          contentSource: mapCmsContentSource(section.contentSource),
        },
      };

    // ── Listing / detail ─────────────────────────────────────────────────────

    case "listing":
      return {
        id:        section._key,
        blockType: "listing",
        variant:   section.variant,
        surface:   section.surface,
        data: {
          heading:       section.heading,
          intro:         section.intro,
          // Inline items — populated for manual-source blocks; empty for collection-driven
          items:         (section.items ?? []).map((item) => ({
            id:             item.id ?? item._key,
            title:          item.title,
            href:           item.href,
            excerpt:        item.excerpt,
            date:           item.date,
            imageUrl:       item.imageUrl,
            hoverImageUrl:  item.hoverImageUrl,
            imageAlt:       item.imageAlt,
            category:       item.category,
            tags:           item.tags,
            meta:           item.meta,
          })),
          maxItems:      section.maxItems,
          viewAllHref:   section.viewAllHref,
          viewAllLabel:  section.viewAllLabel,
          contentSource: mapCmsContentSource(section.contentSource),
          // Media slides for the listing_slider variant — forwarded verbatim.
          mediaItems: section.mediaItems?.map((slide) => ({
            key:         slide._key,
            mediaType:   slide.mediaType,
            imageUrl:    slide.imageUrl,
            alt:         slide.alt,
            videoSource: slide.videoSource,
            videoId:     slide.videoId,
            vimeoId:     slide.vimeoId,
            videoUrl:    slide.videoUrl,
            posterUrl:   slide.posterUrl,
            autoplay:    slide.autoplay,
            caption:     slide.caption,
          })),
        },
      };

    case "filterBar":
      return {
        id:        section._key,
        blockType: "filterBar",
        variant:   section.variant,
        surface:   section.surface,
        data: {
          placeholder:        section.placeholder,
          categories:         section.categories?.map((c) => ({ label: c.label, value: c.value, count: c.count })),
          tags:               section.tags?.map((t) => ({ label: t.label, value: t.value, count: t.count })),
          sortOptions:        section.sortOptions?.map((s) => ({ label: s.label, value: s.value, count: s.count })),
          showSearch:         section.showSearch,
          showCategoryFilter: section.showCategoryFilter,
          showTagFilter:      section.showTagFilter,
        },
      };

    case "searchResults":
      return {
        id:        section._key,
        blockType: "searchResults",
        variant:   section.variant,
        surface:   section.surface,
        data: {
          heading:      section.heading,
          emptyMessage: section.emptyMessage,
          itemsPerPage: section.itemsPerPage,
          items:        (section.items ?? []).map((item) => ({
            id:       item.id ?? item._key,
            title:    item.title,
            href:     item.href,
            excerpt:  item.excerpt,
            date:     item.date,
            imageUrl: item.imageUrl,
            imageAlt: item.imageAlt,
            category: item.category,
            tags:     item.tags,
            meta:     item.meta,
          })),
          enableSearch: section.enableSearch,
          enableFilter: section.enableFilter,
        },
      };

    case "articleMeta":
      return {
        id:        section._key,
        blockType: "articleMeta",
        variant:   section.variant,
        surface:   section.surface,
        data: {
          title:         section.title,
          publishedAt:   section.publishedAt,
          updatedAt:     section.updatedAt,
          author:        section.author,
          category:      section.category,
          tags:          section.tags,
          readingTime:   section.readingTime,
          coverImageUrl: section.coverImageUrl,
          coverImageAlt: section.coverImageAlt,
          summary:       section.summary,
        },
      };

    case "articleBody":
      return {
        id:        section._key,
        blockType: "articleBody",
        variant:   section.variant,
        surface:   section.surface,
        data: {
          body:       section.body,
          footnotes:  section.footnotes,
        },
      };

    case "relatedContent":
      return {
        id:        section._key,
        blockType: "relatedContent",
        variant:   section.variant,
        surface:   section.surface,
        data: {
          heading:       section.heading,
          // Inline items — populated for manual-source blocks; empty for collection-driven
          items:         section.items.map((item) => ({
            id:             item.id ?? item._key,
            title:          item.title,
            href:           item.href,
            excerpt:        item.excerpt,
            imageUrl:       item.imageUrl,
            hoverImageUrl:  item.hoverImageUrl,
            imageAlt:       item.imageAlt,
            category:       item.category,
            date:           item.date,
          })),
          maxItems:      section.maxItems,
          contentSource: mapCmsContentSource(section.contentSource),
        },
      };

    case "vacancyMeta":
      return {
        id:        section._key,
        blockType: "vacancyMeta",
        variant:   section.variant,
        surface:   section.surface,
        data: {
          title:        section.title,
          department:   section.department,
          location:     section.location,
          remote:       section.remote,
          contractType: section.contractType,
          hoursPerWeek: section.hoursPerWeek,
          salaryRange:  section.salaryRange,
          startDate:    section.startDate,
          closingDate:  section.closingDate,
          level:        section.level,
        },
      };

    case "applyPanel":
      return {
        id:        section._key,
        blockType: "applyPanel",
        variant:   section.variant,
        surface:   section.surface,
        data: {
          heading:      section.heading,
          body:         section.body,
          primaryCta:   section.primaryCta,
          secondaryCta: section.secondaryCta,
          formKey:      section.formKey,
          closingDate:  section.closingDate,
        },
      };

    // ── Search ────────────────────────────────────────────────────────────────

    case "search":
      return {
        id:        section._key,
        blockType: "search",
        variant:   section.variant,
        surface:   section.surface,
        data: {
          title:            section.title,
          placeholder:      section.placeholder,
          description:      section.description,
          scopes:           section.scopes,
          showFilters:      section.showFilters,
          enableInstant:    section.enableInstant,
          maxResults:       section.maxResults,
          emptyMessage:     section.emptyMessage,
          noResultsMessage: section.noResultsMessage,
        },
      };

    // ── Careers / W6 ─────────────────────────────────────────────────────────

    case "processSteps":
      return {
        id:        section._key,
        blockType: "processSteps",
        variant:   section.variant,
        surface:   section.surface,
        data: {
          heading: section.heading,
          steps:   (section.steps ?? []).map((s) => ({
            title:       s.title,
            description: s.description,
            duration:    s.duration,
          })),
        },
      };

    case "recruiterPanel":
      return {
        id:        section._key,
        blockType: "recruiterPanel",
        variant:   section.variant,
        surface:   section.surface,
        data: {
          heading:   section.heading,
          name:      section.name,
          role:      section.role,
          bio:       section.bio,
          avatarUrl: section.avatarUrl,
          email:     section.email,
          phone:     section.phone,
          ctaLabel:  section.ctaLabel,
          ctaHref:   section.ctaHref,
        },
      };

    // ── Content / editorial ───────────────────────────────────────────────────

    case "contentSection":
      return {
        id:        section._key,
        blockType: "contentSection",
        variant:   section.variant,
        surface:   section.surface,
        data: {
          eyebrow:  section.eyebrow,
          heading:  section.heading,
          intro:    section.intro,
          body:     section.body as PortableTextBlock[] | undefined,
          ctas:     (section.ctas ?? []).map((c) => ({
            label:   c.label,
            href:    c.href,
            variant: c.variant,
          })),
          maxWidth: section.maxWidth,
          align:    section.align,
        },
      };

    case "teamSection":
      return {
        id:        section._key,
        blockType: "teamSection",
        variant:   section.variant,
        surface:   section.surface,
        data: {
          heading: section.heading,
          intro:   section.intro,
          members: (section.members ?? []).map((m) => ({
            name:        m.name,
            role:        m.role,
            bio:         m.bio,
            imageUrl:    m.imageUrl,
            profileHref: m.profileHref,
            socials:     m.socials,
          })),
        },
      };

    case "timeline":
      return {
        id:        section._key,
        blockType: "timeline",
        variant:   section.variant,
        surface:   section.surface,
        data: {
          heading:     section.heading,
          description: section.description,
          items: (section.items ?? []).map((item) => ({
            id:          item._key,
            date:        item.date,
            title:       item.title,
            description: item.description,
            // Slider-variant media fields (undefined when not set — safe to spread)
            ...(item.mediaType ? {
              mediaType: item.mediaType,
              mediaUrl:  item.mediaUrl,
              posterUrl: item.posterUrl,
              autoPlay:  item.autoPlay,
              loop:      item.loop,
            } : {}),
          })),
        },
      };

    case "contactSection":
      return {
        id:        section._key,
        blockType: "contactSection",
        variant:   section.variant,
        surface:   section.surface,
        data: {
          heading:     section.heading,
          description: section.description,
          address:     section.address,
          phone:       section.phone,
          email:       section.email,
          hours:       section.hours,
          mapUrl:      section.mapUrl,
          ctas: section.ctas?.map((c) => ({ label: c.label, href: c.href })),
        },
      };

    case "floatingContact":
      return {
        id:        section._key,
        blockType: "floatingContact",
        variant:   section.variant,
        surface:   section.surface,
        data: {
          phone:    section.phone,
          email:    section.email,
          whatsapp: section.whatsapp,
          side:     section.side,
        },
      };

    // ── Conversion / pricing ──────────────────────────────────────────────────

    case "pricingSection":
      return {
        id:        section._key,
        blockType: "pricingSection",
        variant:   section.variant,
        surface:   section.surface,
        data: {
          heading:    section.heading,
          subheading: section.subheading,
          footnote:   section.footnote,
          tiers: (section.tiers ?? []).map((t) => ({
            name:        t.name,
            price:       t.price,
            period:      t.period,
            description: t.description,
            features:    t.features ?? [],
            ctaLabel:    t.ctaLabel,
            ctaHref:     t.ctaHref,
            highlighted: t.highlighted,
            badge:       t.badge,
          })),
        },
      };

    case "mapBlock":
      return {
        id:        section._key,
        blockType: "mapBlock",
        variant:   section.variant,
        surface:   section.surface,
        data: {
          heading:  section.heading,
          address:  section.address,
          city:     section.city,
          country:  section.country,
          email:    section.email,
          phone:    section.phone,
          embedUrl: section.embedUrl,
        },
      };

    case "cartSummary":
      return {
        id:        section._key,
        blockType: "cartSummary",
        variant:   section.variant,
        surface:   section.surface,
        data: {
          heading:              section.heading,
          emptyMessage:         section.emptyMessage,
          checkoutHref:         section.checkoutHref,
          continueShoppingHref: section.continueShoppingHref,
          checkoutLabel:        section.checkoutLabel,
          continueShoppingLabel: section.continueShoppingLabel,
          planId:               section.planId,
        },
      };

    case "checkoutBlock":
      return {
        id:        section._key,
        blockType: "checkoutBlock",
        variant:   section.variant,
        surface:   section.surface,
        data: {
          heading:         section.heading,
          intro:           section.intro,
          paymentProvider: section.paymentProvider,
          returnHref:      section.returnHref,
          returnLabel:     section.returnLabel,
          planId:          section.planId,
        },
      };

    case "quote":
      return {
        id:        section._key,
        blockType: "quote",
        variant:   section.variant,
        data: {
          quote:       section.quote,
          attribution: section.attribution,
          source:      section.source,
          avatarUrl:   section.avatarUrl,
        },
      };

    case "video": {
      // Detect platform: prefer the mapper-resolved value, fall back to URL heuristic.
      const vUrl = section.videoUrl;
      const platform: "youtube" | "vimeo" | "native" =
        section.platform ??
        (vUrl.includes("youtube.com") || vUrl.includes("youtu.be") ? "youtube"
         : vUrl.includes("vimeo.com") ? "vimeo"
         : "native");
      return {
        id:        section._key,
        blockType: "video",
        variant:   section.variant,
        data: {
          url:       vUrl,
          platform,
          posterUrl: section.posterUrl,
          caption:   section.caption,
          autoPlay:  section.autoPlay,
          loop:      section.loop,
        },
      };
    }

    default:
      // TypeScript exhaustiveness: this branch is unreachable when
      // isRegisteredBlockType() is called before this function.
      return null;
  }
}

/** All valid context slot IDs. */
const VALID_SLOT_IDS = new Set(["hero", "proof", "cta", "feature", "conversion", "notification"]);

/**
 * Build an ordered `PageItem[]` from a CMS sections array.
 *
 * Iterates sections in order.  For each section:
 *   - `contextSlot` → resolve to a `ResolvedContextSlot` (from `slotMap` when
 *     provided, or build from the section's own variantKey otherwise).
 *     Disabled entries (enabled === false) are skipped.
 *   - all other types → map to `ContentBlock` via `mapSectionToContentBlock()`.
 *     Unknown block types are silently skipped.
 *
 * `slotMap` is provided on the caller-supplied slots path (decision engine).
 * It is absent on the embedded-slots path (raw sections read from YAML/API).
 */
function buildPageItemsFromSections(
  sections: PageSectionData[],
  slotMap:  Map<string, ResolvedContextSlot> | undefined,
): PageItem[] {
  const items: PageItem[] = [];
  for (const section of sections) {
    if (!section) continue;
    if (section._type === "contextSlot") {
      if (section.enabled === false) continue;
      if (!VALID_SLOT_IDS.has(section.slotId)) continue;
      const slot: ResolvedContextSlot = slotMap?.get(section.slotId) ?? {
        slotId:     section.slotId as ResolvedContextSlot["slotId"],
        variantKey: section.variantKey ?? null,
      };
      items.push({ kind: "slot", slot });
    } else {
      if (!isRegisteredBlockType(section._type)) continue;
      const block = mapSectionToContentBlock(section);
      if (block) {
        // Carry anchor + block-level design tokens (named set + inline) from the
        // section, exactly like mapSectionsToContentBlocks() does — otherwise
        // per-block tokens would only work on the homepage path, not [slug] pages.
        const base = section as import("../types").PageSectionBase;
        const hasTokens = Boolean(base.tokens && Object.keys(base.tokens).length > 0);
        const withTokens: ContentBlock =
          (base.anchorId || base.tokenSet || hasTokens)
            ? ({
                ...block,
                ...(base.anchorId ? { anchorId: base.anchorId } : {}),
                ...(base.tokenSet ? { tokenSet: base.tokenSet } : {}),
                ...(hasTokens ? { tokens: base.tokens } : {}),
              } as ContentBlock)
            : block;
        items.push({ kind: "block", block: withTokens });
      }
    }
  }
  return items;
}

/**
 * Infer a TemplateKey when the CMS document does not carry an explicit one.
 *
 * Precedence:
 *   1. Any resolved context slot present → "marketing-page"
 *      (context slots only exist on marketing / landing pages)
 *   2. Sections present → delegate to inferTemplateFromSections()
 *      listing-page:  page contains listing / filterBar / searchResults blocks
 *      detail-page:   page contains articleMeta / vacancyMeta blocks
 *      article-page:  everything else (no sections, or editorial sections only)
 *
 * Assemblers that build PageData programmatically (entity-page-assemblers.ts)
 * should always set an explicit templateKey — inference is a convenience for
 * CMS authors who forget to set the field.
 */
function inferTemplateKey(
  slots:    readonly ResolvedContextSlot[],
  sections?: readonly PageSectionData[],
): PageConfig["templateKey"] {
  if (slots.length > 0) return "marketing-page";
  return inferTemplateFromSections(sections ?? []);
}

/**
 * Infer a slot-less template key ("listing-page" | "detail-page" |
 * "article-page") from the section types present in the CMS page document.
 *
 * Heuristics (first match wins):
 *   listing-page  — page has at least one listing, filterBar, or searchResults
 *                   block → it is an overview / collection page
 *   detail-page   — page has at least one articleMeta or vacancyMeta block
 *                   → it is an entity detail page
 *   article-page  — everything else (editorial content, no structural signals)
 *
 * This is only called when no explicit templateKey is authored in the CMS.
 * CMS authors should prefer setting templateKey directly for reliability.
 */
function inferTemplateFromSections(
  sections: readonly PageSectionData[],
): "listing-page" | "detail-page" | "article-page" {
  const types = new Set(sections.filter(Boolean).map((s) => s._type));
  if (types.has("listing") || types.has("filterBar") || types.has("searchResults")) {
    return "listing-page";
  }
  if (types.has("articleMeta") || types.has("vacancyMeta")) {
    return "detail-page";
  }
  return "article-page";
}

/**
 * Return true when the page has any context slot signal (contextConfig entry)
 * so that the template key can be inferred as "marketing-page" rather than
 * "article-page".
 */
function hasAnyContextSignal(config: CmsPageContextConfig): boolean {
  return !!(config.hero || config.proof || config.cta ||
            config.feature || config.conversion || config.notification);
}
