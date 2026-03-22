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

import type { PageSectionData, PageData, CmsPageContextConfig } from "@/cms/types";
import type {
  ContentBlock,
  ResolvedContextSlot,
  PageConfig,
  PageSeoConfig,
  TemplateKey,
}                                          from "@/page-config";
import { isRegisteredBlockType }           from "@/page-config";
import type { PortableTextBlock }          from "@/cms/types";
import {
  getTemplateDefinition,
  isTemplateKey,
}                                          from "@/page-config/templates";

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
    if (!isRegisteredBlockType(section._type)) continue;
    const block = mapSectionToContentBlock(section);
    if (block) blocks.push(block);
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
 *   2. "marketing-page" if contextConfig or heroVariantKey is present
 *   3. "article-page" (no context slots)
 *
 * Backward compat: if contextConfig.hero is absent but heroVariantKey is set,
 * the hero slot is resolved using heroVariantKey as the variantKey.
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
    : hasAnyContextSignal(config, pageData.heroVariantKey)
      ? "marketing-page"
      : inferTemplateFromSections(pageData.sections ?? []);

  const template = getTemplateDefinition(templateKey);
  if (!template || template.contextSlots.length === 0) return [];

  // ── Map each template slot to a resolved slot ─────────────────────────────
  return template.contextSlots.map((spec) => {
    const slotCfg = config[spec.slotId as keyof CmsPageContextConfig];

    // Prefer contextConfig fallback; bridge legacy heroVariantKey for hero slot.
    const variantKey: string | null =
      slotCfg?.fallbackVariantKey ??
      (spec.slotId === "hero" ? (pageData.heroVariantKey ?? null) : null);

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

  // ── Context slots ─────────────────────────────────────────────────────────
  // Caller-provided slots take precedence (decision engine path).
  // When absent, derive from CMS contextConfig (no-engine / static page path).
  const contextSlots: readonly ResolvedContextSlot[] = resolvedContextSlots
    ?? (pageData ? mapContextConfigToResolvedSlots(pageData) : []);

  // ── Template key ──────────────────────────────────────────────────────────
  // Precedence:
  //   1. Explicit CMS templateKey (when valid TemplateKey string)
  //   2. Infer "marketing-page" from context slots (any slot present)
  //   3. Infer "listing-page" / "detail-page" / "article-page" from sections
  const rawTemplateKey = pageData?.templateKey;
  const templateKey: PageConfig["templateKey"] =
    (rawTemplateKey && isTemplateKey(rawTemplateKey))
      ? rawTemplateKey
      : inferTemplateKey(contextSlots, pageData?.sections);

  const seo: PageSeoConfig = {
    title:       pageData?.seoTitle       ?? undefined,
    description: pageData?.seoDescription ?? undefined,
  };

  const contentBlocks = mapSectionsToContentBlocks(pageData?.sections ?? []);

  return {
    pageId:        slug,
    slug:          slug.startsWith("/") ? slug : `/${slug}`,
    title,
    templateKey,
    contextSlots:  [...contextSlots],
    contentBlocks,
    seo,
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

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
        data: {
          heading: section.heading,
          // Cast: readonly PortableTextBlock[] is widened to the mutable array
          // shape that TextSectionBlockData expects.  Safe — data is only read.
          body:    section.body as PortableTextBlock[] | undefined,
        },
      };

    case "featureGrid":
      return {
        id:        section._key,
        blockType: "featureGrid",
        variant:   section.variant,
        data: {
          heading:  section.heading,
          features: (section.features ?? []).map((f) => ({
            title:       f.title,
            description: f.description,
            icon:        f.icon,
          })),
        },
      };

    case "testimonialSection":
      return {
        id:        section._key,
        blockType: "testimonialSection",
        variant:   section.variant,
        data: {
          heading:      section.heading,
          testimonials: (section.testimonials ?? []).map((t) => ({
            quote:   t.quote,
            author:  t.author,
            company: t.company,
          })),
        },
      };

    case "faqSection":
      return {
        id:        section._key,
        blockType: "faqSection",
        variant:   section.variant,
        data: {
          heading: section.heading,
          items:   (section.items ?? []).map((i) => ({
            question: i.question,
            answer:   i.answer,
          })),
        },
      };

    case "ctaSection":
      return {
        id:        section._key,
        blockType: "ctaSection",
        variant:   section.variant,
        data: {
          title:       section.title,
          description: section.description,
          // Normalise flat CMS fields into the typed primaryCta object.
          // ContentBlockRenderer reverses this when calling CtaSectionBlock.
          primaryCta:  section.buttonLabel && section.buttonHref
            ? { label: section.buttonLabel, href: section.buttonHref }
            : undefined,
        },
      };

    case "formSection":
      // The CMS carries only placement config + copy overrides.
      // Field definitions, validation, and routing come from the platform-side
      // FormDefinition resolved at render time via getFormDefinition(formKey).
      return {
        id:        section._key,
        blockType: "formSection",
        variant:   section.variant,
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
        data: {
          heading: section.heading,
          logos:   (section.logos ?? []).map((logo) => ({
            name: logo.name,
            src:  logo.src,
            url:  logo.url,
          })),
        },
      };

    case "stats":
      return {
        id:        section._key,
        blockType: "stats",
        variant:   section.variant,
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
        data: {
          heading:     section.heading,
          body:        section.body as PortableTextBlock[] | undefined,
          imageUrl:    section.imageUrl,
          imageAlt:    section.imageAlt,
          teamMembers: (section.teamMembers ?? []).map((m) => ({
            name:     m.name,
            role:     m.role,
            bio:      m.bio,
            imageUrl: m.imageUrl,
          })),
        },
      };

    case "newsList":
      return {
        id:        section._key,
        blockType: "newsList",
        variant:   section.variant,
        data: {
          heading:  section.heading,
          maxItems: section.maxItems,
          items:    (section.items ?? []).map((item) => ({
            title:    item.title,
            url:      item.url,
            excerpt:  item.excerpt,
            date:     item.date,
            imageUrl: item.imageUrl,
            category: item.category,
          })),
        },
      };

    // ── Listing / detail ─────────────────────────────────────────────────────

    case "listing":
      return {
        id:        section._key,
        blockType: "listing",
        variant:   section.variant,
        data: {
          heading:      section.heading,
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
          maxItems:     section.maxItems,
          viewAllHref:  section.viewAllHref,
          viewAllLabel: section.viewAllLabel,
        },
      };

    case "filterBar":
      return {
        id:        section._key,
        blockType: "filterBar",
        variant:   section.variant,
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
        data: {
          heading:  section.heading,
          items:    section.items.map((item) => ({
            id:       item.id ?? item._key,
            title:    item.title,
            href:     item.href,
            excerpt:  item.excerpt,
            imageUrl: item.imageUrl,
            imageAlt: item.imageAlt,
            category: item.category,
            date:     item.date,
          })),
          maxItems: section.maxItems,
        },
      };

    case "vacancyMeta":
      return {
        id:        section._key,
        blockType: "vacancyMeta",
        variant:   section.variant,
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

    default:
      // TypeScript exhaustiveness: this branch is unreachable when
      // isRegisteredBlockType() is called before this function.
      return null;
  }
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
  const types = new Set(sections.map((s) => s._type));
  if (types.has("listing") || types.has("filterBar") || types.has("searchResults")) {
    return "listing-page";
  }
  if (types.has("articleMeta") || types.has("vacancyMeta")) {
    return "detail-page";
  }
  return "article-page";
}

/**
 * Return true when the page has any context slot signal — either a
 * contextConfig entry or the legacy heroVariantKey — so that the template
 * key can be inferred as "marketing-page" rather than "article-page".
 */
function hasAnyContextSignal(
  config: CmsPageContextConfig,
  heroVariantKey: string | undefined,
): boolean {
  return !!(config.hero || config.proof || config.cta || heroVariantKey);
}
