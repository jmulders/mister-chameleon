/**
 * PageConfig — core type definitions
 *
 * This module defines the platform's internal, CMS-agnostic page model.
 * It sits between the CMS layer and the rendering layer:
 *
 *   CMS (PageData / PageSectionData)
 *        ↓  CMS mapper (cms → page-config)
 *   PageConfig                           ← YOU ARE HERE
 *        ↓  renderer (app/[slug]/page.tsx etc.)
 *   React components
 *
 * ─── Architecture principles enforced here ────────────────────────────────────
 *
 *   1. Templates are slot-based ONLY.
 *      TemplateDefinition declares named ContextSlots and their positions.
 *      It does not carry content, variant assignments, or layout variants.
 *      New page layouts must NOT introduce new templates — extend blocks.
 *
 *   2. All page flexibility lives in ContentBlocks.
 *      The `contentBlocks` array is ordered and reorderable.
 *      Every layout variation is expressed as a different block type or variant
 *      within an existing block type — never as a new template.
 *
 *   3. Context blocks are decision-engine driven.
 *      `ResolvedContextSlot.variantKey` is assigned by the decision engine at
 *      request time. The content itself is fetched from the CMS via that key.
 *
 *   4. Content blocks are CMS-driven.
 *      `ContentBlock.data` contains the normalised CMS content.
 *      `ContentBlock.variant` controls visual appearance only — it is always
 *      orthogonal to block type and never triggers structural change.
 *
 *   5. Styling uses design tokens only.
 *      No hardcoded colours, spacing, or typography in block data shapes.
 *
 * ─── Naming conventions ───────────────────────────────────────────────────────
 *
 *   *BlockData   — platform-internal content data, CMS-agnostic (no _type/_key)
 *   *Block       — a ContentBlock instance: { id, blockType, variant?, data }
 *   *Slot        — a context slot instance (structural position on a page)
 *   *Definition  — a structural schema/spec (template, slot spec)
 *
 * ─── Module structure ─────────────────────────────────────────────────────────
 *
 *   types.ts        ← YOU ARE HERE — all type definitions
 *   templates.ts    — named TemplateDefinition constants
 *   registry.ts     — allowed block type set + type guard
 *   index.ts        — barrel export
 */

import type { ContextBlockKey, ContentBlockKey }          from "@/tenant";
import type { PortableTextBlock, HeroBlockData,
              ProofBlockData, CTABlockData }               from "@/cms/types";

// ═════════════════════════════════════════════════════════════════════════════
// TEMPLATE LAYER
// ═════════════════════════════════════════════════════════════════════════════

// ── Template keys ─────────────────────────────────────────────────────────────

/**
 * The set of named page templates available on the platform.
 *
 *   marketing-page — Hero + Proof + CTA context slots wrapping a content block
 *                    array.  The standard adaptive page format for homepages and
 *                    primary marketing pages.
 *
 *   landing-page   — Hero + CTA context slots, no proof block.
 *                    For focused conversion pages (campaign-specific, gated
 *                    content, product launches).
 *
 *   article-page   — No context slots.  Pure CMS-driven editorial layout.
 *                    Blog posts, documentation, guides, long-form content.
 *
 *   listing-page   — No context slots.  Aggregates and displays a collection
 *                    of entity records (news articles, vacancies, companies).
 *                    Renders listing + filterBar + search content blocks.
 *
 *   detail-page    — No context slots.  Renders a single entity document
 *                    (news article, vacancy, company) as an ordered block
 *                    sequence assembled by the entity-page mapper.
 *
 * IMPORTANT: Adding a new template is only justified when the slot structure
 * genuinely differs. Never add a template to achieve a visual layout variation —
 * that belongs in a ContentBlock variant.
 */
export type TemplateKey =
  | "marketing-page"
  | "landing-page"
  | "article-page"
  | "listing-page"
  | "detail-page";

// ── Context slot ID ───────────────────────────────────────────────────────────

/**
 * Alias of ContextBlockKey — the identity of an adaptive slot on a page.
 * Kept as a type alias (not a re-export) so the page-config layer has a
 * stable name that does not couple to the tenant module's naming choices.
 */
export type ContextSlotId = ContextBlockKey; // "hero" | "proof" | "cta"

// ── Context slot position ─────────────────────────────────────────────────────

/**
 * Where a context slot is rendered relative to the content blocks array.
 *
 *   "before-content" — rendered above all content blocks (e.g. hero, proof)
 *   "after-content"  — rendered below all content blocks (e.g. closing CTA)
 *
 * Future: "inline" could pin a slot at a specific index inside the blocks
 * array. This is intentionally not implemented yet to keep the model simple.
 */
export type ContextSlotPosition = "before-content" | "after-content";

// ── Context slot spec (template-level) ───────────────────────────────────────

/**
 * Declares a single adaptive slot as it is described inside a TemplateDefinition.
 *
 * This is the structural spec — it does NOT carry content or a variant key.
 * The variant key is resolved at request time by the decision engine and stored
 * on ResolvedContextSlot.
 *
 * ─── Fields ───────────────────────────────────────────────────────────────────
 *
 *   slotId
 *     Which adaptive block this slot renders.
 *
 *   position
 *     Where this slot appears relative to the content blocks array.
 *
 *   required
 *     When true the renderer must render this slot; when false the slot may be
 *     omitted if the decision engine returns no variant key (or the tenant's
 *     block entitlements exclude it).
 *
 *   allowMultiple
 *     When true the slot may resolve to more than one variant item (e.g. a
 *     proof section that shows multiple social-proof cards in sequence).
 *     When false (the default) the slot always renders at most one variant.
 *     Currently informational only — the runtime resolves a single variantKey
 *     per slot; this flag is a forward-compatibility signal for future renderers
 *     that support multi-item slots.
 *
 * @example
 * { slotId: "hero", position: "before-content", required: true, allowMultiple: false }
 */
export interface ContextSlotSpec {
  /** Which adaptive block this slot renders */
  readonly slotId:         ContextSlotId;
  /** Where this slot appears relative to the content blocks array */
  readonly position:       ContextSlotPosition;
  /**
   * When true the renderer must render this slot; when false the slot may be
   * omitted if the decision engine returns no variant key (or the tenant's
   * block entitlements exclude it).
   */
  readonly required:       boolean;
  /**
   * When true, the slot may resolve to multiple variant items rendered in
   * sequence at the same position.  Defaults to false (single item per slot).
   *
   * Currently informational — the renderer always resolves one variantKey
   * per slot.  Set true on slots where stacking multiple variants is a valid
   * future use case (e.g. a proof slot showing several testimonial cards).
   */
  readonly allowMultiple?: boolean;
}

// ── Template definition ───────────────────────────────────────────────────────

/**
 * A template is a structural specification ONLY.
 *
 * It declares:
 *   - which context slots exist on pages that use this template
 *   - where each slot is rendered relative to the content blocks array
 *
 * It does NOT carry:
 *   - content
 *   - variant key assignments
 *   - layout variants
 *   - CMS field names
 *
 * Every page that uses the same template has the same slot structure.
 * Visual variation is achieved by changing block variants, not templates.
 *
 * @example
 * const HOMEPAGE_TEMPLATE: TemplateDefinition = {
 *   key:         "homepage",
 *   displayName: "Homepage",
 *   contextSlots: [
 *     { slotId: "hero",  position: "before-content", required: true  },
 *     { slotId: "proof", position: "before-content", required: false },
 *     { slotId: "cta",   position: "after-content",  required: false },
 *   ],
 * };
 */
export interface TemplateDefinition {
  /** Machine-readable template identifier */
  readonly key:           TemplateKey;
  /** Human-readable label for admin UIs */
  readonly displayName:   string;
  /**
   * Ordered adaptive slots declared by this template.
   *
   * Slots with the same `position` value are rendered in the order they
   * appear in this array.  The renderer iterates this array — do not rely
   * on alphabetical or any other implicit ordering.
   */
  readonly contextSlots:  readonly ContextSlotSpec[];
}

// ═════════════════════════════════════════════════════════════════════════════
// CONTENT BLOCK LAYER
// ═════════════════════════════════════════════════════════════════════════════

// ── Block category ────────────────────────────────────────────────────────────

/**
 * Organisational grouping for content block types.
 *
 * Used by `getBlocksByCategory()` to filter the registry when building
 * block-picker UIs or generating per-category documentation.
 *
 *   "text"         — text-heavy blocks (textSection, richText)
 *   "media"        — image, video, slider
 *   "social-proof" — trust-building blocks (quote, testimonialSection,
 *                    logoStrip, stats)
 *   "features"     — product/service feature showcases (featureGrid)
 *   "content"      — editorial / informational (faqSection, about, newsList,
 *                    caseHighlight)
 *   "conversion"   — call-to-action blocks (ctaSection)
 */
export type BlockCategory =
  | "text"
  | "media"
  | "social-proof"
  | "features"
  | "content"
  | "conversion";

// ── Block definition ──────────────────────────────────────────────────────────

/**
 * Structural metadata for a single content block type.
 *
 * A `BlockDefinition` is purely configurational — it carries no runtime
 * logic, no React components, and no CMS field mappings.  It is the
 * platform's authoritative specification of what a block type is, what
 * visual variants it supports, and how it fits into the block taxonomy.
 *
 * ─── Fields ───────────────────────────────────────────────────────────────────
 *
 *   key
 *     The stable machine identifier — matches `ContentBlockType` and the
 *     CMS `_type` discriminator.
 *
 *   displayName
 *     Human-readable label for admin UIs and block-picker components.
 *
 *   category
 *     Organisational grouping — see `BlockCategory` above.
 *
 *   allowedVariants
 *     Ordered list of visual variant keys this block type supports.
 *     Each key is a pure presentational variation — it never changes the
 *     data shape.  Absent when the block has no meaningful visual variants.
 *     The component layer resolves these keys to concrete styles.
 *
 *   dataType
 *     TypeScript interface name for the block's `data` field.
 *     Informational/documentation — enables tooling and codegen.
 *
 *   status
 *     "live"    — full CMS mapper + renderer component exist.
 *     "defined" — data types and block struct exist; CMS mapper and/or
 *                 renderer component are pending implementation.
 *
 * @example
 * const def = getBlockDefinition("featureGrid");
 * def.category          // "features"
 * def.allowedVariants   // ["2-col", "3-col", "4-col", "icon-list"]
 * def.status            // "live"
 */
export interface BlockDefinition {
  readonly key:              ContentBlockType;
  readonly displayName:      string;
  readonly category:         BlockCategory;
  readonly allowedVariants?: readonly string[];
  readonly dataType:         string;
  readonly status:           "live" | "defined";
}

// ── Content block type alias ──────────────────────────────────────────────────

/**
 * Alias of ContentBlockKey — the type discriminator for a content block.
 *
 * The full set of platform content block types:
 *   text:        textSection | richText
 *   media:       image | video | slider
 *   social-proof: testimonialSection | quote | logoStrip | stats
 *   features:    featureGrid | faqSection | about | newsList | caseHighlight
 *   conversion:  ctaSection
 */
export type ContentBlockType = ContentBlockKey;

// ── Per-block data types (platform-internal, CMS-agnostic) ───────────────────
//
// Rules for data types:
//   - No `_type` or `_key` fields (those belong to the CMS layer).
//   - All fields are readonly (data is immutable once assembled).
//   - Use platform naming conventions, not CMS field names.
//   - Arrays of sub-items use descriptive wrapper types (e.g. FeatureItem).
//   - Optional fields use `?` — never `| null` — for cleaner consumer code.
//   - The CMS mapper is responsible for normalising null → undefined.

/**
 * Data for a TextSectionBlock.
 *
 * Renders a rich-text body with an optional heading.
 * The `body` field is Portable Text — render via PortableTextRenderer.
 *
 * `alignment` is a visual hint; defaults to "left" when absent.
 */
export interface TextSectionBlockData {
  readonly heading?:   string;
  readonly body?:      readonly PortableTextBlock[];
  readonly alignment?: "left" | "center" | "right";
}

// ── FeatureGrid ───────────────────────────────────────────────────────────────

/**
 * A single feature entry within a FeatureGridBlock.
 */
export interface FeatureItem {
  readonly title:       string;
  readonly description: string;
  /** Icon identifier — resolved by the icon registry in the component layer */
  readonly icon?:       string;
}

/**
 * Data for a FeatureGridBlock.
 *
 * Renders a grid of feature cards (title + body + optional icon).
 * `columns` is a visual hint; defaults to 3 when absent.
 */
export interface FeatureGridBlockData {
  readonly heading?:  string;
  readonly features:  readonly FeatureItem[];
  readonly columns?:  2 | 3 | 4;
}

// ── TestimonialSection ────────────────────────────────────────────────────────

/**
 * A single testimonial entry within a TestimonialSectionBlock.
 */
export interface TestimonialItem {
  readonly quote:    string;
  readonly author:   string;
  readonly company?: string;
  /** URL of the author's avatar image, resolved by the CMS asset pipeline */
  readonly avatar?:  string;
}

/**
 * Data for a TestimonialSectionBlock.
 *
 * Renders customer quotes with author attribution.
 */
export interface TestimonialSectionBlockData {
  readonly heading?:      string;
  readonly testimonials:  readonly TestimonialItem[];
}

// ── FaqSection ────────────────────────────────────────────────────────────────

/**
 * A single FAQ entry within a FaqSectionBlock.
 */
export interface FaqItem {
  readonly question: string;
  readonly answer:   string;
}

/**
 * Data for a FaqSectionBlock.
 *
 * Renders an accordion of question/answer pairs.
 */
export interface FaqSectionBlockData {
  readonly heading?: string;
  readonly items:    readonly FaqItem[];
}

// ── RichText ──────────────────────────────────────────────────────────────────

/**
 * Data for a RichTextBlock.
 *
 * Pure portable-text body with no heading wrapper.  Use when the content
 * itself provides all structural headings (e.g. long-form articles or docs).
 *
 * `maxWidth` is a layout hint resolved to a design token by the component:
 *   "narrow"  — ~65ch column (prose reading width)
 *   "default" — standard content column
 *   "wide"    — full-width content area
 */
export interface RichTextBlockData {
  readonly body:      readonly PortableTextBlock[];
  readonly maxWidth?: "narrow" | "default" | "wide";
}

// ── Image ─────────────────────────────────────────────────────────────────────

/**
 * Data for an ImageBlock.
 *
 * A single CMS-authored image with optional descriptive metadata.
 * `src` is a resolved URL (the CMS mapper handles asset pipeline resolution).
 *
 * `aspectRatio` is a visual hint; the component enforces it via CSS.
 * `fit` maps to CSS object-fit; defaults to "cover".
 */
export interface ImageBlockData {
  readonly src:         string;
  readonly alt:         string;
  readonly caption?:    string;
  readonly aspectRatio?: "1:1" | "4:3" | "16:9" | "3:2";
  readonly fit?:        "cover" | "contain";
}

// ── Video ─────────────────────────────────────────────────────────────────────

/**
 * Data for a VideoBlock.
 *
 * Supports embedded iframes (YouTube, Vimeo) and native `<video>` elements.
 * `platform` determines how the renderer constructs the embed or media element.
 *
 * `posterUrl` — fallback image shown before playback; especially important for
 *               autoPlay=false to avoid a black frame on load.
 */
export interface VideoBlockData {
  readonly url:        string;
  readonly platform:   "youtube" | "vimeo" | "native";
  readonly posterUrl?: string;
  readonly caption?:   string;
  readonly autoPlay?:  boolean;
  readonly loop?:      boolean;
  readonly muted?:     boolean;
}

// ── Quote ─────────────────────────────────────────────────────────────────────

/**
 * Data for a QuoteBlock.
 *
 * A pull-quote or block-quote with optional attribution.
 * Distinct from TestimonialSectionBlock: a Quote is a single highlighted
 * statement (e.g. analyst quote, founder statement) rather than a grid of
 * customer reviews.
 */
export interface QuoteBlockData {
  readonly quote:        string;
  readonly attribution?: string;
  /** Company, publication, or role of the attributed person */
  readonly source?:      string;
  /** URL of the attributed person's photo or company logo */
  readonly avatarUrl?:   string;
}

// ── LogoStrip ─────────────────────────────────────────────────────────────────

/**
 * A single logo entry within a LogoStripBlock.
 */
export interface LogoItem {
  readonly name:  string;
  /** Resolved image URL from the CMS asset pipeline */
  readonly src:   string;
  /** Optional link — wraps the logo in an anchor tag */
  readonly url?:  string;
}

/**
 * Data for a LogoStripBlock.
 *
 * Renders a horizontal strip of client/partner/integration logos.
 * Typically used as a social-proof or "trusted by" section.
 * `heading` is optional — often the logos speak for themselves.
 */
export interface LogoStripBlockData {
  readonly heading?: string;
  readonly logos:    readonly LogoItem[];
}

// ── Stats ─────────────────────────────────────────────────────────────────────

/**
 * A single metric/statistic within a StatsBlock.
 *
 * Rendered as a prominent number with a supporting label.
 * `prefix` / `suffix` are display decorators (e.g. "$", "%", "M+").
 * They are separate fields (not baked into `value`) so formatters and
 * screen readers can handle them appropriately.
 */
export interface StatItem {
  readonly value:   string;
  readonly label:   string;
  readonly prefix?: string;
  readonly suffix?: string;
}

/**
 * Data for a StatsBlock.
 *
 * Renders a row or grid of key metrics / headline numbers.
 * Typically used to reinforce social proof ("10M+ users served").
 */
export interface StatsBlockData {
  readonly heading?: string;
  readonly items:    readonly StatItem[];
}

// ── Slider ────────────────────────────────────────────────────────────────────

/**
 * A single slide within a SliderBlock.
 */
export interface SlideItem {
  readonly heading?:   string;
  readonly body?:      string;
  readonly imageUrl?:  string;
  readonly imageAlt?:  string;
  readonly ctaLabel?:  string;
  readonly ctaHref?:   string;
}

/**
 * Data for a SliderBlock.
 *
 * An image or content carousel.  Each slide is an independently-navigable
 * unit.  `autoPlay` enables automatic advance; `interval` sets the delay in
 * milliseconds (default 5000).
 */
export interface SliderBlockData {
  readonly heading?:   string;
  readonly slides:     readonly SlideItem[];
  readonly autoPlay?:  boolean;
  /** Milliseconds between auto-advance transitions; only used when autoPlay=true */
  readonly interval?:  number;
}

// ── About ─────────────────────────────────────────────────────────────────────

/**
 * A single team member entry within an AboutBlock.
 */
export interface TeamMember {
  readonly name:      string;
  readonly role:      string;
  readonly bio?:      string;
  readonly imageUrl?: string;
}

/**
 * Data for an AboutBlock.
 *
 * An about / team section with optional narrative copy, a feature image,
 * and an ordered list of team member cards.
 *
 * All fields are optional so the block can be used as a pure team grid,
 * a pure narrative section, or a combination.
 */
export interface AboutBlockData {
  readonly heading?:     string;
  readonly body?:        readonly PortableTextBlock[];
  readonly imageUrl?:    string;
  readonly imageAlt?:    string;
  readonly teamMembers?: readonly TeamMember[];
}

// ── NewsList ──────────────────────────────────────────────────────────────────

/**
 * A single news / blog item within a NewsListBlock.
 */
export interface NewsItem {
  readonly title:     string;
  readonly url:       string;
  readonly excerpt?:  string;
  /** ISO 8601 date string, e.g. "2024-03-15" */
  readonly date?:     string;
  readonly imageUrl?: string;
  readonly category?: string;
}

/**
 * Data for a NewsListBlock.
 *
 * A list of recent news articles or blog post teasers.
 * `maxItems` is a display cap — the renderer shows at most this many items
 * regardless of how many are in the `items` array.  Defaults to the full list.
 */
export interface NewsListBlockData {
  readonly heading?:  string;
  readonly items:     readonly NewsItem[];
  readonly maxItems?: number;
}

// ── CaseHighlight ─────────────────────────────────────────────────────────────

/**
 * A single outcome metric within a CaseHighlightBlock.
 */
export interface CaseMetric {
  readonly label: string;
  readonly value: string;
}

/**
 * Data for a CaseHighlightBlock.
 *
 * A focused client case-study highlight — problem, solution, and measurable
 * outcomes.  Intended as a conversion element (show results → earn trust).
 *
 * `metrics` should be 2–4 concise outcome numbers; more dilutes impact.
 */
export interface CaseHighlightBlockData {
  readonly heading?:    string;
  readonly client:      string;
  readonly challenge?:  string;
  readonly outcome?:    string;
  readonly metrics?:    readonly CaseMetric[];
  readonly imageUrl?:   string;
  readonly ctaLabel?:   string;
  readonly ctaHref?:    string;
}

// ── FormSection ───────────────────────────────────────────────────────────────

/**
 * Data for a FormSectionBlock.
 *
 * The CMS places a form on a page by setting `formKey` to a registered
 * FormKey string.  Everything about the form's behaviour (fields, validation,
 * email routing, storage) is owned by the platform-side FormDefinition
 * resolved via getFormDefinition(formKey).
 *
 * The CMS-authored fields here are purely content/copy overrides — they let
 * an editor customise the form's presentation without changing its behaviour.
 *
 * ─── Separation of concerns ───────────────────────────────────────────────────
 *
 *   FormBlockData (here)      — CMS-authored placement + copy overrides
 *   FormDefinition (@/forms)  — Platform-side field structure, validation,
 *                               routing, and submission behaviour
 *
 * ─── formKey resolution ───────────────────────────────────────────────────────
 *
 *   `formKey` is typed as `string` (not the `FormKey` union) because CMS data
 *   is unvalidated at the page-config layer.  The rendering component uses
 *   `isFormKey()` from `@/forms` to narrow and resolve the definition at
 *   render time.  Unknown keys render nothing rather than crashing.
 */
export interface FormBlockData {
  /**
   * Identifies which platform-side FormDefinition to render.
   * Must match a registered FormKey ("contact" | "application" | …).
   * Typed as `string` — narrowed to `FormKey` by the component via isFormKey().
   */
  readonly formKey:         string;
  /**
   * Optional title override rendered above the form.
   * Falls back to FormDefinition.title when absent.
   */
  readonly title?:          string;
  /**
   * Optional introductory copy rendered below the title, above the fields.
   * Falls back to FormDefinition.description when absent.
   */
  readonly intro?:          string;
  /**
   * Optional submit button label override.
   * Falls back to "Submit" when absent.
   */
  readonly submitLabel?:    string;
  /**
   * Optional success message override displayed after a successful submission.
   * Falls back to FormDefinition.action.successMessage when absent.
   */
  readonly successMessage?: string;
}

// ── Listing ───────────────────────────────────────────────────────────────────

/**
 * A single item in a ListingBlock.
 *
 * Intentionally generic — covers blog posts, vacancies, case studies, news
 * items, or any other content type that benefits from a card/row layout.
 *
 * `meta` is an escape hatch for type-specific metadata (e.g. "Location:
 * Amsterdam" for a vacancy, "Reading time: 4 min" for a blog post) that does
 * not warrant a dedicated field.  The renderer formats each pair as a label +
 * value inline badge.
 */
export interface ListingItem {
  /** Stable, CMS-assigned identifier; used for React `key` props */
  readonly id:        string;
  readonly title:     string;
  /** Absolute or root-relative URL for the item's detail page */
  readonly href:      string;
  readonly excerpt?:  string;
  /** ISO 8601 date string, e.g. "2024-09-01" */
  readonly date?:     string;
  readonly imageUrl?: string;
  readonly imageAlt?: string;
  readonly category?: string;
  readonly tags?:     readonly string[];
  /** Flexible key-value pairs for type-specific metadata */
  readonly meta?:     readonly { readonly label: string; readonly value: string }[];
}

/**
 * Data for a ListingBlock.
 *
 * A reusable overview / index block for any content type.  The same block
 * type renders a blog overview, vacancy listing, or news overview depending
 * on which items the CMS populates.
 *
 * `viewAllHref` / `viewAllLabel` support a "See all posts →" footer link
 * when the block is embedded on a marketing page rather than the full listing
 * page itself.
 */
export interface ListingBlockData {
  readonly heading?:      string;
  readonly items:         readonly ListingItem[];
  readonly maxItems?:     number;
  readonly viewAllHref?:  string;
  readonly viewAllLabel?: string;
}

// ── ArticleBody ───────────────────────────────────────────────────────────────

/**
 * Data for an ArticleBodyBlock.
 *
 * The primary editorial body for long-form content: blog posts, vacancy
 * descriptions, case studies, documentation.
 *
 * Semantically distinct from RichTextBlock:
 *   - `richText` is a general-purpose body drop-in (any page, any context).
 *   - `articleBody` is scoped to article/detail pages and carries the
 *     semantic weight of being the main reading body.  Components may style
 *     it with article-specific typography (drop caps, wider line height, etc.)
 *     and strip any extra section padding that richText carries.
 *
 * `footnotes` is an optional ordered list of plain-text footnotes rendered
 * at the foot of the article.  Portable Text mark decorators can reference
 * them by index.
 */
export interface ArticleBodyBlockData {
  readonly body:       readonly PortableTextBlock[];
  readonly footnotes?: readonly string[];
}

// ── ArticleMeta ───────────────────────────────────────────────────────────────

/**
 * A single article author entry.
 */
export interface ArticleAuthor {
  readonly name:       string;
  readonly role?:      string;
  readonly avatarUrl?: string;
  /** Link to the author's profile page */
  readonly href?:      string;
}

/**
 * Data for an ArticleMetaBlock.
 *
 * Renders the editorial metadata for an article detail page — publication
 * date, author attribution, content classification, cover image, and summary.
 *
 * Designed to sit at the top of a detail page (before the articleBody) in
 * the "hero" or "compact" variant, or in the sidebar in a future "sidebar"
 * layout.
 *
 * `readingTime` is an estimate in minutes; the CMS or a pre-processing step
 * should populate this from the article word count.
 */
export interface ArticleMetaBlockData {
  readonly title?:          string;
  /** ISO 8601, e.g. "2024-09-01" */
  readonly publishedAt?:    string;
  /** ISO 8601 — present when the article was meaningfully updated */
  readonly updatedAt?:      string;
  readonly author?:         ArticleAuthor;
  readonly category?:       string;
  readonly tags?:           readonly string[];
  /** Estimated reading time in minutes */
  readonly readingTime?:    number;
  readonly coverImageUrl?:  string;
  readonly coverImageAlt?:  string;
  /** Short summary / deck rendered below the title */
  readonly summary?:        string;
}

// ── RelatedContent ────────────────────────────────────────────────────────────

/**
 * A single related content teaser.
 * Structurally similar to ListingItem but kept separate so related-content
 * and listing data can evolve independently.
 */
export interface RelatedItem {
  readonly id:        string;
  readonly title:     string;
  readonly href:      string;
  readonly excerpt?:  string;
  readonly imageUrl?: string;
  readonly imageAlt?: string;
  readonly category?: string;
  /** ISO 8601 */
  readonly date?:     string;
}

/**
 * Data for a RelatedContentBlock.
 *
 * Shows a curated set of related articles, vacancies, or case studies at
 * the end of a detail page to encourage further reading.
 */
export interface RelatedContentBlockData {
  readonly heading?:  string;
  readonly items:     readonly RelatedItem[];
  readonly maxItems?: number;
}

// ── VacancyMeta ───────────────────────────────────────────────────────────────

/**
 * Data for a VacancyMetaBlock.
 *
 * Structured metadata for a job vacancy detail page.  Renders as a summary
 * card that surfaces the key decision factors a candidate needs at a glance:
 * location, contract type, hours, salary, and deadline.
 *
 * All fields are optional so the block can be used for vacancies that do not
 * disclose salary, or that have open-ended applications without a closing date.
 *
 * String fields use human-readable values (e.g. "€60,000 – €80,000",
 * "32–40 hrs/week") rather than structured numbers so editors control
 * presentation without needing the component to format them.
 */
export interface VacancyMetaBlockData {
  /** Optional heading; defaults to the vacancy title when absent */
  readonly title?:        string;
  readonly department?:   string;
  /** Office location or city; combine with `remote` for hybrid setups */
  readonly location?:     string;
  readonly remote?:       "on-site" | "hybrid" | "remote";
  readonly contractType?: "full-time" | "part-time" | "contract" | "internship" | "freelance";
  /** Display string, e.g. "32–40 hrs/week" */
  readonly hoursPerWeek?: string;
  /** Display string, e.g. "€60,000 – €80,000 per year" */
  readonly salaryRange?:  string;
  /** ISO 8601 or human-readable, e.g. "As soon as possible" */
  readonly startDate?:    string;
  /** ISO 8601 application deadline */
  readonly closingDate?:  string;
  /** Seniority level, e.g. "Senior", "Medior", "Lead" */
  readonly level?:        string;
}

// ── ApplyPanel ────────────────────────────────────────────────────────────────

/**
 * Data for an ApplyPanelBlock.
 *
 * The primary application call-to-action for a vacancy detail page.
 *
 * Two integration patterns are supported:
 *
 *   External ATS — `primaryCta.href` points to an external applicant-tracking
 *     system (Greenhouse, Lever, Workday, etc.).  The component renders a
 *     standard CTA button.
 *
 *   Platform form — `formKey` references a registered FormKey.  The component
 *     can either link to a page containing the form or render it inline.
 *     Resolving the FormDefinition at render time keeps the CMS layer thin.
 *
 * `closingDate` is an optional urgency signal ("Applications close in 3 days")
 * rendered as a callout inside the panel.
 */
export interface ApplyPanelBlockData {
  readonly heading?:      string;
  readonly body?:         string;
  readonly primaryCta?:   { readonly label: string; readonly href: string };
  readonly secondaryCta?: { readonly label: string; readonly href: string };
  /**
   * Optional reference to a registered FormKey (e.g. "application").
   * When set, the component can render the form inline or link to it
   * rather than directing the candidate to an external ATS.
   * Typed as `string` — narrowed to `FormKey` by the component via isFormKey().
   */
  readonly formKey?:      string;
  /** ISO 8601 application deadline — used to show urgency messaging */
  readonly closingDate?:  string;
}

// ── FilterBar ─────────────────────────────────────────────────────────────────

/**
 * A single option in a filter / sort control.
 *
 * `count` is the number of results matching this option; used to render
 * "(42)" badges next to filter labels so visitors can make informed choices.
 * Omit when counts are unavailable or too expensive to compute.
 */
export interface FilterOption {
  readonly label:  string;
  readonly value:  string;
  readonly count?: number;
}

/**
 * Data for a FilterBarBlock.
 *
 * An interactive search and filter bar for listing pages.  The CMS populates
 * the available filter options; filtering itself runs client-side (or via
 * API fetch) inside the component.
 *
 * All option arrays and feature flags are optional — omit what a given
 * listing page does not need.  A blog overview typically needs categories +
 * optional tags; a vacancy listing needs categories (departments) + remote
 * options.
 */
export interface FilterBarBlockData {
  /** Placeholder text for the search input */
  readonly placeholder?:        string;
  readonly categories?:         readonly FilterOption[];
  readonly tags?:                readonly FilterOption[];
  readonly sortOptions?:         readonly FilterOption[];
  /** Show / hide the free-text search input; defaults to true when omitted */
  readonly showSearch?:          boolean;
  /** Show / hide the category filter; defaults to true when categories is set */
  readonly showCategoryFilter?:  boolean;
  /** Show / hide the tag filter; defaults to true when tags is set */
  readonly showTagFilter?:       boolean;
}

// ── SearchResults ─────────────────────────────────────────────────────────────

/**
 * Data for a SearchResultsBlock.
 *
 * Renders a filterable / searchable result set.  Typically paired with a
 * FilterBarBlock that drives the active query state.
 *
 * `items` contains the full server-rendered initial result set.  The
 * component progressively enhances this with client-side filtering when
 * `enableSearch` or `enableFilter` is true.  When JavaScript is unavailable,
 * the server-rendered items render as a plain listing.
 *
 * `emptyMessage` is displayed when the active query returns zero results.
 */
export interface SearchResultsBlockData {
  readonly heading?:       string;
  readonly emptyMessage?:  string;
  /** Number of items per page for pagination; omit to show all */
  readonly itemsPerPage?:  number;
  /** Initial server-rendered result set — reuses ListingItem for consistency */
  readonly items?:         readonly ListingItem[];
  /** Enable client-side text search over item titles and excerpts */
  readonly enableSearch?:  boolean;
  /** Enable client-side filter synchronisation with a FilterBarBlock */
  readonly enableFilter?:  boolean;
}

// ── Search ────────────────────────────────────────────────────────────────────

/**
 * Data for a SearchBlock.
 *
 * A full-text search input + inline results block.  The block calls the
 * platform's /api/search endpoint with a SearchQuery and renders the
 * returned SearchResult[] using SearchResultCard.
 *
 * Search behaviour is provider-agnostic: the API route resolves a
 * SearchProvider at the edge; the CMS and this data shape never reference
 * a specific search backend.
 *
 * ─── Scope control ────────────────────────────────────────────────────────────
 *
 *   `scopes` is a string[] that maps to SearchScope values ("pages", "posts",
 *   "vacancies").  Typed as string[] (not SearchScope[]) because CMS data is
 *   unvalidated — the API route narrows and validates before forwarding to the
 *   provider.  When absent or empty, the provider searches all supported scopes.
 *
 * ─── Variants ─────────────────────────────────────────────────────────────────
 *
 *   "default"  — section heading + description + search input + results grid
 *   "minimal"  — search input only; no heading/description wrapper
 *   "full"     — default + inline filter controls (category / scope toggles)
 */
export interface SearchBlockData {
  /** Optional section heading, e.g. "Search" or "Find a vacancy" */
  readonly title?:             string;
  /** Placeholder text for the search input */
  readonly placeholder?:       string;
  /** Optional short intro copy rendered below the title */
  readonly description?:       string;
  /**
   * Which content types to include in the search.
   * Maps to SearchScope[] ("pages" | "posts" | "vacancies").
   * When absent the provider searches all supported scopes.
   */
  readonly scopes?:            readonly string[];
  /** Show inline category / scope filter controls; default false */
  readonly showFilters?:       boolean;
  /**
   * Trigger a search on each keypress rather than on submit.
   * Debounced at 300 ms inside the component.  Default false.
   */
  readonly enableInstant?:     boolean;
  /** Maximum results to display per search; defaults to 10 */
  readonly maxResults?:        number;
  /** Message shown before any query is entered ("Start typing to search…") */
  readonly emptyMessage?:      string;
  /** Message shown when a query returns zero results */
  readonly noResultsMessage?:  string;
}

// ── CtaSection ────────────────────────────────────────────────────────────────

/**
 * Data for a CtaSectionBlock.
 *
 * Renders a full-width call-to-action banner with up to two buttons.
 *
 * Note: The CMS schema stores `buttonLabel` + `buttonHref` as flat fields.
 * The mapper normalises them into the typed `primaryCta` object here.
 * This allows the platform to add a `secondaryCta` later without touching
 * the render component interface.
 *
 * `background` is a design-token alias, not a raw CSS value.
 */
export interface CtaSectionBlockData {
  readonly title?:        string;
  readonly description?:  string;
  readonly primaryCta?:   { readonly label: string; readonly href: string };
  readonly secondaryCta?: { readonly label: string; readonly href: string };
  /**
   * Background style for this CTA section.
   * Resolved to a design token by the component; never a raw colour value.
   *
   *   "default" — inherits page background (neutral-50 / white)
   *   "brand"   — brand accent background (brand-600 area)
   *   "dark"    — dark neutral background (neutral-900 area)
   */
  readonly background?:   "default" | "brand" | "dark";
}

// ── ProcessSteps ──────────────────────────────────────────────────────────────

/**
 * A single step in a numbered hiring or onboarding process.
 */
export interface ProcessStep {
  readonly title:        string;
  readonly description?: string;
  /** Optional duration indicator, e.g. "1–2 weeks" */
  readonly duration?:    string;
}

/**
 * Data for a ProcessStepsBlock.
 *
 * Renders a numbered or accordion-style sequence of process steps.
 * Used on vacancy detail pages (hiring process) and join/careers pages
 * (application process overview).
 *
 * Variants:
 *   default   — vertical numbered list with step dividers
 *   accordion — each step is a collapsible <details>/<summary> element
 *   compact   — tight inline numbered list; lower vertical footprint
 */
export interface ProcessStepsBlockData {
  readonly heading?: string;
  readonly steps:    readonly ProcessStep[];
}

// ── RecruiterPanel ────────────────────────────────────────────────────────────

/**
 * Data for a RecruiterPanelBlock.
 *
 * A dedicated contact-card for the recruiter responsible for a vacancy
 * or the primary contact on a careers page.
 *
 * The block renders the recruiter's name, role, avatar, and contact methods
 * so candidates can reach out directly.  `ctaLabel`/`ctaHref` add a
 * "Book a call" link alongside raw contact details.
 *
 * Variants:
 *   default — full card: avatar + name/role/bio + contact row
 *   compact — minimal inline bar: avatar + name + contact badges
 *   card    — elevated card style for standalone placement
 */
export interface RecruiterPanelBlockData {
  readonly heading?:   string;
  readonly name:       string;
  readonly role?:      string;
  readonly bio?:       string;
  readonly avatarUrl?: string;
  readonly email?:     string;
  readonly phone?:     string;
  readonly ctaLabel?:  string;
  readonly ctaHref?:   string;
}

// ── ContentBlock discriminated union ─────────────────────────────────────────

/**
 * Base fields shared by every content block.
 *
 *   id       — CMS-assigned stable key for this block instance.
 *              Sourced from the CMS `_key` field; used for React `key` props.
 *   variant  — Optional visual variation string, resolved by the block
 *              component to a specific appearance. A variant NEVER changes the
 *              block type or its data shape — it is purely presentational.
 */
interface ContentBlockBase {
  readonly id:       string;
  readonly variant?: string;
}

// ── Existing live blocks ──────────────────────────────────────────────────────

export interface TextSectionBlock extends ContentBlockBase {
  readonly blockType: "textSection";
  readonly data:      TextSectionBlockData;
}

export interface FeatureGridBlock extends ContentBlockBase {
  readonly blockType: "featureGrid";
  readonly data:      FeatureGridBlockData;
}

export interface TestimonialSectionBlock extends ContentBlockBase {
  readonly blockType: "testimonialSection";
  readonly data:      TestimonialSectionBlockData;
}

export interface FaqSectionBlock extends ContentBlockBase {
  readonly blockType: "faqSection";
  readonly data:      FaqSectionBlockData;
}

export interface CtaSectionBlock extends ContentBlockBase {
  readonly blockType: "ctaSection";
  readonly data:      CtaSectionBlockData;
}

// ── New blocks (CMS mapper support to be added incrementally) ─────────────────

export interface RichTextBlock extends ContentBlockBase {
  readonly blockType: "richText";
  readonly data:      RichTextBlockData;
}

export interface ImageBlock extends ContentBlockBase {
  readonly blockType: "image";
  readonly data:      ImageBlockData;
}

export interface VideoBlock extends ContentBlockBase {
  readonly blockType: "video";
  readonly data:      VideoBlockData;
}

export interface QuoteBlock extends ContentBlockBase {
  readonly blockType: "quote";
  readonly data:      QuoteBlockData;
}

export interface LogoStripBlock extends ContentBlockBase {
  readonly blockType: "logoStrip";
  readonly data:      LogoStripBlockData;
}

export interface StatsBlock extends ContentBlockBase {
  readonly blockType: "stats";
  readonly data:      StatsBlockData;
}

export interface SliderBlock extends ContentBlockBase {
  readonly blockType: "slider";
  readonly data:      SliderBlockData;
}

export interface AboutBlock extends ContentBlockBase {
  readonly blockType: "about";
  readonly data:      AboutBlockData;
}

export interface NewsListBlock extends ContentBlockBase {
  readonly blockType: "newsList";
  readonly data:      NewsListBlockData;
}

export interface CaseHighlightBlock extends ContentBlockBase {
  readonly blockType: "caseHighlight";
  readonly data:      CaseHighlightBlockData;
}

export interface FormSectionBlock extends ContentBlockBase {
  readonly blockType: "formSection";
  readonly data:      FormBlockData;
}

// ── Listing / detail blocks ───────────────────────────────────────────────────

export interface ListingBlock extends ContentBlockBase {
  readonly blockType: "listing";
  readonly data:      ListingBlockData;
}

export interface ArticleBodyBlock extends ContentBlockBase {
  readonly blockType: "articleBody";
  readonly data:      ArticleBodyBlockData;
}

export interface ArticleMetaBlock extends ContentBlockBase {
  readonly blockType: "articleMeta";
  readonly data:      ArticleMetaBlockData;
}

export interface RelatedContentBlock extends ContentBlockBase {
  readonly blockType: "relatedContent";
  readonly data:      RelatedContentBlockData;
}

export interface VacancyMetaBlock extends ContentBlockBase {
  readonly blockType: "vacancyMeta";
  readonly data:      VacancyMetaBlockData;
}

export interface ApplyPanelBlock extends ContentBlockBase {
  readonly blockType: "applyPanel";
  readonly data:      ApplyPanelBlockData;
}

export interface FilterBarBlock extends ContentBlockBase {
  readonly blockType: "filterBar";
  readonly data:      FilterBarBlockData;
}

export interface SearchResultsBlock extends ContentBlockBase {
  readonly blockType: "searchResults";
  readonly data:      SearchResultsBlockData;
}

export interface SearchBlock extends ContentBlockBase {
  readonly blockType: "search";
  readonly data:      SearchBlockData;
}

// ── Careers / W6 blocks ───────────────────────────────────────────────────────

export interface ProcessStepsBlock extends ContentBlockBase {
  readonly blockType: "processSteps";
  readonly data:      ProcessStepsBlockData;
}

export interface RecruiterPanelBlock extends ContentBlockBase {
  readonly blockType: "recruiterPanel";
  readonly data:      RecruiterPanelBlockData;
}

/**
 * The discriminated union of all supported content block types.
 *
 * Switch on `blockType` to narrow to the specific block and access its
 * strongly-typed `data` field.  New blocks added here are forward-compatible:
 * the CMS mapper's `default: return null` catch means unknown blocks are
 * silently skipped until a mapper case is added for them.
 *
 * @example
 * function renderBlock(block: ContentBlock) {
 *   switch (block.blockType) {
 *     case "textSection":        return <TextSectionBlock    data={block.data} />;
 *     case "featureGrid":        return <FeatureGridBlock    data={block.data} />;
 *     case "testimonialSection": return <TestimonialSection  data={block.data} />;
 *     case "faqSection":         return <FaqSectionBlock     data={block.data} />;
 *     case "ctaSection":         return <CtaSectionBlock     data={block.data} />;
 *     case "richText":           return <RichTextBlock       data={block.data} />;
 *     case "image":              return <ImageBlock          data={block.data} />;
 *     case "video":              return <VideoBlock          data={block.data} />;
 *     case "quote":              return <QuoteBlock          data={block.data} />;
 *     case "logoStrip":          return <LogoStripBlock      data={block.data} />;
 *     case "stats":              return <StatsBlock          data={block.data} />;
 *     case "slider":             return <SliderBlock         data={block.data} />;
 *     case "about":              return <AboutBlock          data={block.data} />;
 *     case "newsList":           return <NewsListBlock       data={block.data} />;
 *     case "caseHighlight":      return <CaseHighlightBlock  data={block.data} />;
 *   }
 * }
 */
export type ContentBlock =
  // live — full CMS mapper + renderer support
  | TextSectionBlock
  | FeatureGridBlock
  | TestimonialSectionBlock
  | FaqSectionBlock
  | CtaSectionBlock
  | FormSectionBlock
  // defined — types and data shapes complete; CMS mapper + renderer pending
  | RichTextBlock
  | ImageBlock
  | VideoBlock
  | QuoteBlock
  | LogoStripBlock
  | StatsBlock
  | SliderBlock
  | AboutBlock
  | NewsListBlock
  | CaseHighlightBlock
  // listing / detail — blog and vacancy overview + detail page blocks
  | ListingBlock
  | ArticleBodyBlock
  | ArticleMetaBlock
  | RelatedContentBlock
  | VacancyMetaBlock
  | ApplyPanelBlock
  | FilterBarBlock
  | SearchResultsBlock
  // search
  | SearchBlock
  // careers / W6
  | ProcessStepsBlock
  | RecruiterPanelBlock;

// ═════════════════════════════════════════════════════════════════════════════
// CONTEXT SLOT (resolved)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * A context slot as it appears inside a resolved PageConfig.
 *
 * The structural spec (ContextSlotSpec) lives in the TemplateDefinition.
 * This runtime type adds the variant key assigned by the decision engine.
 *
 * `variantKey` is null when:
 *   - The decision engine has not run yet (e.g. during static generation).
 *   - The tenant's block entitlements exclude this slot.
 *   - The slot is optional (required: false) and no variant was selected.
 * Renderers must treat null as "do not render this slot".
 */
export interface ResolvedContextSlot {
  /** Which adaptive block this slot renders */
  readonly slotId:     ContextSlotId;
  /**
   * The variant key selected by the decision engine.
   * Null means this slot is inactive for the current request.
   */
  readonly variantKey: string | null;
  /** Structural position inherited from the template's ContextSlotSpec */
  readonly position:   ContextSlotPosition;
}

// ═════════════════════════════════════════════════════════════════════════════
// PAGE SEO
// ═════════════════════════════════════════════════════════════════════════════

/**
 * SEO metadata fields for a PageConfig.
 *
 * These override the site-level defaults from SiteSettings.
 * Absent fields fall back to the site-level values in the rendering layer —
 * never use empty strings as fallbacks here; use undefined.
 */
export interface PageSeoConfig {
  readonly title?:        string;
  readonly description?:  string;
  /** Fully-qualified canonical URL, e.g. "https://acme.com/about-us" */
  readonly canonicalUrl?: string;
  /** When true, adds <meta name="robots" content="noindex"> */
  readonly noIndex?:      boolean;
}

// ═════════════════════════════════════════════════════════════════════════════
// PAGE CONFIG
// ═════════════════════════════════════════════════════════════════════════════

/**
 * The platform's internal, CMS-agnostic representation of a rendered page.
 *
 * PageConfig is the single value assembled before the renderer runs. It is
 * produced by the CMS mapper (which converts CMS-specific types to this shape)
 * and consumed by the page renderer (which renders the blocks in order).
 *
 * ─── Slot rendering order ─────────────────────────────────────────────────────
 *
 *   The renderer resolves rendering order as follows:
 *
 *   1. contextSlots where position === "before-content", in array order
 *   2. contentBlocks, in array order
 *   3. contextSlots where position === "after-content", in array order
 *
 *   Slots with variantKey === null are skipped.
 *
 * ─── Immutability ─────────────────────────────────────────────────────────────
 *
 *   All fields are deeply readonly. PageConfig is assembled once per request
 *   and never mutated — renderers receive it as a prop and read it.
 *
 * ─── Template vs content ──────────────────────────────────────────────────────
 *
 *   `templateKey` identifies the structural spec but is NOT imported here —
 *   the renderer looks up the definition from TEMPLATE_REGISTRY if it needs
 *   to validate slot positions.  PageConfig itself is self-contained: the
 *   `contextSlots` array already carries the resolved position for each slot.
 *
 * @example
 * const page: PageConfig = {
 *   pageId:      "abc123",
 *   slug:        "about-us",
 *   title:       "About Us",
 *   templateKey: "article",
 *   contextSlots: [],
 *   contentBlocks: [
 *     { id: "k1", blockType: "textSection", data: { heading: "Our story", body: [...] } },
 *     { id: "k2", blockType: "featureGrid", data: { features: [...] } },
 *   ],
 *   seo: { title: "About Us — Acme Corp", description: "..." },
 * };
 */
export interface PageConfig {
  /** CMS-assigned document identifier (e.g. Sanity _id) */
  readonly pageId:         string;

  /** URL slug — no leading slash (e.g. "about-us") */
  readonly slug:           string;

  /**
   * Internal page title.
   * Used as a fallback for seo.title when no SEO override is set.
   * Not necessarily rendered on the page.
   */
  readonly title:          string;

  /**
   * The template that governs the slot structure for this page.
   *
   * IMPORTANT: This field identifies structure, NOT layout variant.
   * Two pages with different content but the same slot structure use the
   * same templateKey.  Do not create a new template for visual variation.
   */
  readonly templateKey:    TemplateKey;

  /**
   * Adaptive context slots for this page, with variant keys resolved.
   *
   * Each slot corresponds to a ContextSlotSpec in the matching
   * TemplateDefinition.  Slots with variantKey === null are inactive and
   * must not be rendered.
   *
   * Render order within a position group follows array order.
   */
  readonly contextSlots:   readonly ResolvedContextSlot[];

  /**
   * Ordered array of CMS-driven content blocks.
   *
   * Rendered between the "before-content" and "after-content" context slots.
   * The array order is the render order — do not sort or reorder at render time.
   * Blocks are reorderable in the CMS; the order is part of the page content.
   */
  readonly contentBlocks:  readonly ContentBlock[];

  /** SEO metadata for this page */
  readonly seo:            PageSeoConfig;
}

// ═════════════════════════════════════════════════════════════════════════════
// CONTEXT SLOT DATA  (pre-fetched, incremental-migration bridge)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Pre-fetched CMS content for the three adaptive context slots.
 *
 * ─── Migration boundary ───────────────────────────────────────────────────────
 *
 *   This type exists to support the incremental migration toward full
 *   slot-based rendering. In the current step, context slot content is
 *   pre-fetched by the homepage pipeline (composeHomepageExperience) before
 *   the renderer runs. The assembler populates this struct and passes it to
 *   TemplateRenderer alongside PageConfig.
 *
 *   Future: TemplateRenderer will fetch slot content itself using each
 *   ResolvedContextSlot.variantKey and the CMS provider. When that step is
 *   complete, this type can be removed and the renderer becomes self-contained.
 *
 * ─── Fields ───────────────────────────────────────────────────────────────────
 *
 *   hero   — HeroBlockData from the CMS + the variant key (for click tracking)
 *   proof  — ProofBlockData from the CMS
 *   cta    — CTABlockData from the CMS + the variant key (for click tracking)
 *
 *   All fields are optional: absent means the slot is inactive for this request
 *   (either disabled by tenant entitlements or the CMS returned null).
 */
export interface ContextSlotData {
  /** Hero slot content + decision-engine variant key for analytics attribution */
  readonly hero?:  HeroBlockData  & { readonly ctaKey?: string };
  /** Proof slot content */
  readonly proof?: ProofBlockData;
  /** CTA slot content + decision-engine variant key for analytics attribution */
  readonly cta?:   CTABlockData   & { readonly ctaKey?: string };
}
