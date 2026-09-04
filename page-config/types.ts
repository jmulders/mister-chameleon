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

import type { BlockSurface }                               from "@/lib/surface";
import type { CuratedBlockTokens, BlockTokenRef }          from "@/design-system/theme/block-token-set";
import type { BlockEffectRef }                             from "@/design-system/effects/effect-ref";
import type { ContextBlockKey, ContentBlockKey }          from "@/tenant";
import type { PortableTextBlock, HeroBlockData,
              ProofBlockData, CTABlockData,
              FeatureBlockData,
              NotificationBlockData,
              ConversionBlockData }                        from "@/cms/types";
import type { ContentSource }                              from "./collection-source";

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
  /**
   * HTML body — set when the Statamic textarea body contains HTML markup.
   * When present, takes precedence over `body` (rendered with dangerouslySetInnerHTML).
   */
  readonly htmlBody?:  string;
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

  // ── Spotlight fields (feature_spotlight only; grid variants ignore them) ──
  // All optional and backward-compatible. `description` doubles as the copy text
  // (no second text field). price and cta are independent: either may be absent
  // and the layout stays tidy in all four combinations.

  /** Media shown alongside the offer (image or YouTube/Vimeo/asset video). */
  readonly media?:    import("@/lib/media/block-media").BlockMedia;
  /** Optional price line (e.g. "vanaf €1.250"). Website copy, so free-form text. */
  readonly price?:    string;
  /** Optional CTA button label. Rendered only when both label and href are set. */
  readonly ctaLabel?: string;
  /** Optional CTA href. */
  readonly ctaHref?:  string;
  /**
   * Which side the media sits on: "left" or "right". Empty inherits from the
   * tenant token (--feature-spotlight-media-side). Mobile always stacks media on top.
   */
  readonly mediaSide?: "left" | "right";
}

/**
 * Data for a FeatureGridBlock.
 *
 * Renders a grid of feature cards (title + body + optional icon).
 * `columns` is a visual hint; defaults to 3 when absent.
 *
 * `cta` — optional call-to-action button rendered below the grid.
 *          When present the component renders a centred button row after the
 *          feature cards.  `cta.variant` controls the button style; defaults
 *          to "primary" when absent.
 */
export interface FeatureGridBlockData {
  readonly heading?:  string;
  readonly features:  readonly FeatureItem[];
  readonly columns?:  2 | 3 | 4;
  /** Optional CTA rendered below the feature grid */
  readonly cta?:      BlockCTA;
}

// ── TestimonialSection ────────────────────────────────────────────────────────

/**
 * A single testimonial entry within a TestimonialSectionBlock.
 */
export interface TestimonialItem {
  readonly quote:    string;
  readonly author:   string;
  readonly role?:    string;
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
  /**
   * Plain text string.
   * The Sanity faqSection schema defines answer as type "text" (not Portable Text).
   * The frontend renders it as a plain paragraph — do not pass into PortableTextRenderer.
   */
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
  /**
   * HTML body from Bard (save_html: true) or converted from ProseMirror
   * (Live Preview).  When present, the component renders this via
   * dangerouslySetInnerHTML instead of the PortableText renderer.
   */
  readonly htmlBody?: string;
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
 *
 * `src` is optional so the component can render a text fallback when no image
 * URL has been provided, rather than displaying a broken <img>.  In practice
 * the Sanity schema requires `src`, but TypeScript models the graceful path.
 */
export interface LogoItem {
  readonly name: string;
  /** Resolved image URL from the CMS.  When absent the `name` is shown as text. */
  readonly src?: string;
  /** Optional link — wraps the logo in an anchor tag */
  readonly url?: string;
}

/**
 * Data for a LogoStripBlock.
 *
 * Renders a slow marquee carousel of client/partner/integration logos.
 * Typically used as a social-proof or "trusted by" section.
 *
 * ─── Display options ────────────────────────────────────────────────────────
 *
 *   animationEnabled  Whether the marquee scrolls (default: true).
 *   speed             "slow" | "medium" | "fast" — carousel duration (default: "slow").
 *   grayscale         Render logos in greyscale.  Defaults to true for the
 *                     "muted" variant and false otherwise.
 *   showLabels        Show company name beneath each logo image (default: false).
 */
export interface LogoStripBlockData {
  readonly heading?:          string;
  readonly logos:             readonly LogoItem[];
  readonly animationEnabled?: boolean;
  readonly speed?:            "slow" | "medium" | "fast";
  readonly grayscale?:        boolean;
  readonly showLabels?:       boolean;
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
  readonly heading?:     string;
  readonly body?:        string;
  readonly imageUrl?:    string;
  readonly imageAlt?:    string;
  readonly ctaLabel?:    string;
  readonly ctaHref?:     string;
  /**
   * Optional caption rendered below the image (or at the foot of the slide).
   * Short text only — typically a photographer credit or brief description.
   */
  readonly caption?:     string;
  /**
   * Content type hint for the slide renderer.
   *   "image" — render imageUrl as an image (default)
   *   "video" — render imageUrl as a video source (or embed URL)
   *   "text"  — text-only slide; no media
   */
  readonly contentType?: "image" | "video" | "text";
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

// ── Shared BlockCTA ───────────────────────────────────────────────────────────

/**
 * A reusable call-to-action button — platform-internal shape.
 *
 * Consumed by blocks that support 0–2 CTAs: About/split, ContentSection,
 * TeamSection.  `variant` controls the button style; when absent the
 * component infers it from position (first → primary, second → secondary).
 */
export interface BlockCTA {
  readonly label:    string;
  readonly href:     string;
  readonly variant?: "primary" | "secondary" | "outline" | "ghost" | "link";
  /**
   * Optional per-button visual style. When set it wins over `variant` and the
   * position-based default: solid -> primary, outline -> outline, ghost -> ghost.
   * Absent means the existing behavior (no regression for CTAs without a style).
   */
  readonly style?:   "solid" | "outline" | "ghost";
  /**
   * Optional decision-layer variant key (e.g. "cta_meeting"). When present the
   * button is rendered with click attribution (a `cta_click` tracking event via
   * TrackedCTAButton); when absent it renders as a plain link button. Set by the
   * adaptive CTA slot so its clicks are attributed like the old CTABlock did.
   */
  readonly ctaKey?:  string;
}

// ── About ─────────────────────────────────────────────────────────────────────

/**
 * A single team member entry within an AboutBlock.
 */
export interface TeamMember {
  readonly name:         string;
  readonly role:         string;
  readonly bio?:         string;
  readonly imageUrl?:    string;
  /** Link to the member's profile page or external profile */
  readonly profileHref?: string;
  readonly socials?: {
    readonly linkedin?: string;
    readonly twitter?:  string;
    readonly github?:   string;
  };
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
  /** 0–2 CTA buttons below the body text (media_right/left/full variants) */
  readonly ctas?:        readonly BlockCTA[];
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
 *
 * ─── Collection-driven mode ───────────────────────────────────────────────────
 *
 *   When `contentSource.source === "collection"`, the renderer fetches items at
 *   request time via CMSProvider.resolveCollection() rather than rendering the
 *   static `items` array.  When `contentSource` is absent or `{ source: "manual" }`,
 *   `items` is used directly (backward-compatible default).
 *
 *   `items` will be an empty array for collection-driven blocks as authored in
 *   the CMS; the resolver populates it at render time.
 */
export interface NewsListBlockData {
  readonly heading?:       string;
  readonly items:          readonly NewsItem[];
  readonly maxItems?:      number;
  /**
   * How items are sourced for this block.
   *
   *   Absent / { source: "manual" } → use the `items` array directly
   *   { source: "collection" }      → resolve from CMSProvider at render time
   *
   * @see ContentSource in @/page-config/collection-source
   */
  readonly contentSource?: ContentSource;
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
  /**
   * What happens after a successful submission, authored per block placement:
   *   "message"  — show `successMessage` in place of the form (default)
   *   "redirect" — navigate to `redirectUrl`
   * Absent = "message", so existing placements keep their behaviour.
   */
  readonly postSubmit?:     "message" | "redirect";
  /**
   * Redirect target for `postSubmit: "redirect"` — an already-normalised href:
   * either an internal path ("/bedankt") or an absolute http(s) URL. Validated
   * by safeRedirectTarget() at map time; anything else is dropped.
   */
  readonly redirectUrl?:    string;
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
  readonly id:             string;
  readonly title:          string;
  /** Absolute or root-relative URL for the item's detail page */
  readonly href:           string;
  readonly excerpt?:       string;
  /** ISO 8601 date string, e.g. "2024-09-01" */
  readonly date?:          string;
  /** Whether to display the date on the card. Defaults to `true` when absent. */
  readonly showDate?:      boolean;
  readonly imageUrl?:      string;
  /** Image shown on card hover — optional, falls back to imageUrl when absent */
  readonly hoverImageUrl?: string;
  readonly imageAlt?:      string;
  readonly category?:      string;
  readonly tags?:          readonly string[];
  /** Flexible key-value pairs for type-specific metadata */
  readonly meta?:          readonly { readonly label: string; readonly value: string }[];
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
 *
 * ─── Collection-driven mode ───────────────────────────────────────────────────
 *
 *   When `contentSource.source === "collection"`, the renderer fetches items at
 *   request time via CMSProvider.resolveCollection() rather than rendering the
 *   static `items` array.  Absent / { source: "manual" } = manual mode (default).
 */
/**
 * A single slide in the listing_slider variant.
 * Mirrors CmsSliderMediaItem from cms/types but uses page-config naming
 * conventions (readonly, no CMS-specific prefixes).
 */
export interface SliderMediaItem {
  readonly key:         string;
  readonly mediaType:   "image" | "video";
  // ── Image ───────────────────────────────────────────────────────────────
  readonly imageUrl?:   string;
  readonly alt?:        string;
  // ── Video ───────────────────────────────────────────────────────────────
  readonly videoSource?: "youtube" | "vimeo" | "upload";
  readonly videoId?:    string;
  readonly vimeoId?:    string;
  readonly videoUrl?:   string;
  readonly posterUrl?:  string;
  readonly autoplay?:   boolean;
  // ── Shared ──────────────────────────────────────────────────────────────
  readonly caption?:    string;
}

export interface ListingBlockData {
  readonly heading?:       string;
  /** Optional intro text shown below the heading. May contain HTML from Statamic textarea. */
  readonly intro?:         string;
  readonly items:          readonly ListingItem[];
  readonly maxItems?:      number;
  readonly viewAllHref?:   string;
  readonly viewAllLabel?:  string;
  /**
   * How items are sourced for this block.
   * @see ContentSource in @/page-config/collection-source
   */
  readonly contentSource?: ContentSource;
  /**
   * Media slides for the listing_slider variant.
   * Only populated when variant === "listing_slider".
   */
  readonly mediaItems?:    readonly SliderMediaItem[];
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
/** A single breadcrumb trail item. Structurally matches molecules/Breadcrumbs.BreadcrumbItem. */
export interface BreadcrumbItem {
  readonly label: string;
  readonly href?:  string;
}

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
  /** Optional breadcrumb trail rendered above the title. */
  readonly breadcrumbs?:    readonly BreadcrumbItem[];
}

// ── RelatedContent ────────────────────────────────────────────────────────────

/**
 * A single related content teaser.
 * Structurally similar to ListingItem but kept separate so related-content
 * and listing data can evolve independently.
 */
export interface RelatedItem {
  readonly id:             string;
  readonly title:          string;
  readonly href:           string;
  readonly excerpt?:       string;
  readonly imageUrl?:      string;
  /** Image shown on card hover — optional, falls back to imageUrl when absent */
  readonly hoverImageUrl?: string;
  readonly imageAlt?:      string;
  readonly category?:      string;
  /** ISO 8601 */
  readonly date?:          string;
}

/**
 * Data for a RelatedContentBlock.
 *
 * Shows a curated set of related articles, vacancies, or case studies at
 * the end of a detail page to encourage further reading.
 *
 * ─── Collection-driven mode ───────────────────────────────────────────────────
 *
 *   When `contentSource.source === "collection"`, the renderer fetches items at
 *   request time via CMSProvider.resolveCollection() rather than rendering the
 *   static `items` array.  Absent / { source: "manual" } = manual mode (default).
 *
 *   For relatedContent, "specific" mode is the most common collection pattern —
 *   editors hand-pick items and control their order via selectedIds.
 */
export interface RelatedContentBlockData {
  readonly heading?:       string;
  readonly items:          readonly RelatedItem[];
  readonly maxItems?:      number;
  /**
   * How items are sourced for this block.
   * @see ContentSource in @/page-config/collection-source
   */
  readonly contentSource?: ContentSource;
}

// ── MapBlock ──────────────────────────────────────────────────────────────────

export interface MapBlockData {
  readonly heading?:   string;
  readonly address?:   string;
  readonly city?:      string;
  readonly country?:   string;
  readonly email?:     string;
  readonly phone?:     string;
  readonly embedUrl?:  string;
}

export interface MapBlock extends ContentBlockBase {
  readonly blockType: "mapBlock";
  readonly data:      MapBlockData;
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
  /** Optional breadcrumb trail rendered above the vacancy title. */
  readonly breadcrumbs?:  readonly BreadcrumbItem[];
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
  readonly primaryCta?:   BlockCTA;
  readonly secondaryCta?: BlockCTA;
  /**
   * Optional media (image or video) shown by the media variants (cta_media_split
   * beside the text, cta_media_first as the background). Reuses the shared
   * BlockMedia / BlockMediaView stack from the spotlight work.
   */
  readonly media?:        import("@/lib/media/block-media").BlockMedia;
  /**
   * Which side the media sits on in cta_media_split: "left" or "right". Empty
   * inherits the tenant token (--cta-media-side). Mobile always stacks.
   */
  readonly mediaSide?:    "left" | "right";
  /**
   * Registered tenant form key for the cta_newsletter variant. When set, the
   * inline newsletter form (NewsletterForm) submits through /api/forms/[formKey],
   * reusing the full forms pipeline. Empty renders no form (graceful degradation).
   */
  readonly formKey?:      string;
  /**
   * Deprecated / inert. Formerly opted a CTA block into per-segment overlays
   * (settings.blockContext), a subsystem that has been retired. The field is
   * kept for backward compatibility with existing content but is now ignored —
   * CTA personalisation runs through the cta_* adaptive blocks + rules.
   */
  readonly contextKey?:   string;
  /**
   * Background style for this CTA section.
   * Resolved to a design token by the component; never a raw colour value.
   *
   *   "default" — inherits page background (neutral-50 / white)
   *   "brand"   — brand accent background (brand-600 area)
   *   "dark"    — dark neutral background (neutral-900 area)
   */
  readonly background?:   "default" | "brand" | "dark";
  /**
   * Optional background image URL — used by the `cta_media_first` variant.
   * Other variants ignore this field.
   */
  readonly imageUrl?:     string;
  readonly imageAlt?:     string;
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

// ── ContentSection ────────────────────────────────────────────────────────────

/**
 * Data for a ContentSectionBlock.
 *
 * A flexible editorial block: optional eyebrow + headline + intro paragraph +
 * Portable Text body + 0–2 CTA buttons.  The go-to block for standalone prose
 * sections that do not need a more specialised layout.
 *
 * `maxWidth` constrains the content column:
 *   narrow  — ~65ch reading column
 *   default — standard content column (default)
 *   wide    — full container width
 *
 * `align` controls text and CTA alignment:
 *   left    — default; works well in combination with images
 *   center  — centered; suits narrow columns and introductory sections
 *
 * Variants:
 *   content_default — single centred or left-aligned column (default)
 *   content_split   — eyebrow/heading left, body/CTAs right (two-column)
 */
export interface ContentSectionBlockData {
  readonly eyebrow?:  string;
  readonly heading?:  string;
  readonly intro?:    string;
  readonly body?:     readonly PortableTextBlock[];
  readonly ctas?:     readonly BlockCTA[];
  readonly maxWidth?: "narrow" | "default" | "wide";
  readonly align?:    "left" | "center";
}

// ── TeamSection ───────────────────────────────────────────────────────────────

/**
 * A single team member within a TeamSectionBlock.
 *
 * Extends the simpler `TeamMember` (from AboutBlock) with a dedicated profile
 * link and social-handle fields suited to standalone team-page contexts.
 */
export interface TeamMemberItem {
  readonly name:         string;
  readonly role:         string;
  readonly bio?:         string;
  readonly imageUrl?:    string;
  /** Optional link to a profile page or LinkedIn */
  readonly profileHref?: string;
  readonly socials?: {
    readonly linkedin?: string;
    readonly twitter?:  string;
    readonly github?:   string;
  };
}

/**
 * Data for a TeamSectionBlock.
 *
 * A dedicated team-member showcase with richer member data than the team-grid
 * variant of AboutBlock.  Suitable as a standalone block on team pages or as
 * a social-proof section on marketing pages.
 *
 * Variants:
 *   team_grid    — 3-col card grid (default)
 *   team_compact — tight single-column list: avatar + name + role
 */
export interface TeamSectionBlockData {
  readonly heading?: string;
  readonly intro?:   string;
  readonly members:  readonly TeamMemberItem[];
}

// ── Timeline ──────────────────────────────────────────────────────────────────

/**
 * A single milestone or event within a TimelineBlock.
 */
export interface TimelineItem {
  /** Stable, CMS-assigned identifier; used for React `key` props */
  readonly id:          string;
  readonly title:       string;
  /** ISO 8601 date string or display label, e.g. "2021" or "January 2024" */
  readonly date?:       string;
  readonly description?: string;
  /** Optional icon name or URL for the timeline marker */
  readonly icon?:       string;
  /** Optional link for items that expand to a detail page */
  readonly href?:       string;

  // ── Slider-variant media (optional — ignored by non-slider layouts) ─────────
  /** "image" | "video_file" | "youtube" | "vimeo" */
  readonly mediaType?:  "image" | "video_file" | "youtube" | "vimeo";
  /** Resolved image URL, video-file URL, or embed URL (YouTube/Vimeo player) */
  readonly mediaUrl?:   string;
  /** Poster/thumbnail URL for video items */
  readonly posterUrl?:  string;
  readonly autoPlay?:   boolean;
  readonly loop?:       boolean;
}

/**
 * Data for a TimelineBlock.
 *
 * Renders an ordered list of milestones, events, or process steps in
 * chronological or reverse-chronological order.
 *
 * Variants:
 *   timeline_vertical  — stacked vertical timeline with alternating content (default)
 *   timeline_compact   — tight single-column list; lower vertical footprint
 *   timeline_milestones — icon + date emphasis; suitable for company history
 */
export interface TimelineBlockData {
  readonly heading?:    string;
  readonly description?: string;
  readonly items:       readonly TimelineItem[];
}

// ── QuickLinks ────────────────────────────────────────────────────────────────

/**
 * A single quick-link card.
 */
export interface QuickLinkItem {
  /** Stable, CMS-assigned identifier; used for React `key` props */
  readonly id:          string;
  readonly label:       string;
  readonly href:        string;
  readonly description?: string;
  /** Icon name or URL; decorative when present */
  readonly icon?:       string;
}

/**
 * Data for a QuickLinksBlock.
 *
 * A compact grid of linkable cards — useful for navigation hubs, service
 * overviews, or resource directories.
 *
 * Variants:
 *   quicklinks_grid    — icon + label grid (default)
 *   quicklinks_list    — single-column list
 *   quicklinks_compact — dense tight grid, no descriptions
 */
export interface QuickLinksBlockData {
  readonly heading?:    string;
  readonly description?: string;
  readonly links:       readonly QuickLinkItem[];
}

// ── TextMedia ─────────────────────────────────────────────────────────────────

/**
 * Data for a TextMediaBlock.
 *
 * A flexible two-column block: editorial text (eyebrow + heading + body + CTAs)
 * on one side and a media element (image or video) on the other.
 *
 * Distinct from AboutBlock: TextMedia has no team-member list and is intended
 * as a lightweight marketing or editorial split — not a narrative bio section.
 *
 * `mediaUrl` is the primary media asset.  When `mediaType === "video"` the URL
 * can be a YouTube/Vimeo embed URL or a native video source.
 *
 * Variants:
 *   text_media_right  — text left, media right (default)
 *   text_media_left   — media left, text right
 *   text_media_stacked — media above, text below (full-width)
 */
export interface TextMediaBlockData {
  readonly eyebrow?:     string;
  readonly heading?:     string;
  readonly body?:        readonly PortableTextBlock[];
  readonly ctas?:        readonly BlockCTA[];
  /** Primary media URL — image CDN URL, YouTube/Vimeo embed URL, or uploaded video URL */
  readonly mediaUrl?:    string;
  readonly mediaAlt?:    string;
  /** Caption rendered below the media element */
  readonly caption?:     string;
  /**
   * Type of the media asset.
   *   "image" — render as an <img> (default)
   *   "video" — render as an embedded iframe (YouTube/Vimeo) or native <video> (upload)
   */
  readonly mediaType?:   "image" | "video";
  /**
   * For video: how the URL was authored.
   *   "youtube" | "vimeo" — mediaUrl is an embed URL; render as 16:9 iframe
   *   "upload"            — mediaUrl is a direct video file; render as <video>
   */
  readonly videoSource?: "youtube" | "vimeo" | "upload";
  /** Poster image shown before playback (used by <video> and as fallback image for embeds) */
  readonly posterUrl?:   string;
  /** Autoplay on page load (audio muted when true) */
  readonly autoPlay?:    boolean;
  /** Loop the video continuously */
  readonly loop?:        boolean;
  /**
   * Optional background layer rendered behind the main media asset.
   *   "color" — solid colour fill  (see mediaBgColor)
   *   "image" — decorative image / pattern  (see mediaBgImageUrl)
   * Omit for no background (default).  Primarily useful with transparent PNGs.
   */
  readonly mediaBgType?:     "color" | "image";
  /** CSS colour value (hex, rgb, hsl …) — used when mediaBgType = "color" */
  readonly mediaBgColor?:    string;
  /** Background image URL — used when mediaBgType = "image" */
  readonly mediaBgImageUrl?: string;
}

// ── ContactSection ────────────────────────────────────────────────────────────

/**
 * Data for a ContactSectionBlock.
 *
 * Renders contact details (address, phone, email, hours) alongside optional
 * CTAs and a map embed link.  Flexible enough to serve as a standalone
 * contact page block or as a footer contact strip.
 *
 * Variants:
 *   contact_default — stacked contact cards on a subtle-bg section (default)
 *   contact_split   — contact details left, map / image right
 *   contact_minimal — compact inline contact row; no section background
 */
export interface ContactSectionBlockData {
  readonly heading?:      string;
  readonly description?:  string;
  readonly address?:      string;
  readonly phone?:        string;
  readonly email?:        string;
  /** Business hours string, e.g. "Mon–Fri 09:00–17:00" */
  readonly hours?:        string;
  /**
   * URL for an embedded map or a link to Google Maps / Apple Maps.
   * Rendered as an iframe embed or a "View on map" link depending on context.
   */
  readonly mapUrl?:       string;
  readonly ctas?:         readonly BlockCTA[];
}

// ── FloatingContact ───────────────────────────────────────────────────────────

/** Data for the floating contact rail (phone / e-mail / WhatsApp). */
export interface FloatingContactBlockData {
  readonly phone?:    string;
  readonly email?:    string;
  readonly whatsapp?: string;
  /** Side of the viewport the rail is pinned to (default "right"). */
  readonly side?:     "right" | "left";
}

// ── PricingSection ────────────────────────────────────────────────────────────

/**
 * A single pricing tier within a PricingSectionBlock.
 *
 * `price` is a display string (e.g. "€49", "Free", "Custom") — not a number —
 * so editors control formatting and currency symbols without component logic.
 * `period` is the billing cadence shown alongside the price ("/month").
 * `features` is an ordered list of included feature strings.
 * `highlighted` marks the recommended / most-popular tier for visual emphasis.
 * `badge` is an optional label overlay, e.g. "Most popular".
 */
export interface PriceTier {
  readonly name:         string;
  /** Display price string, e.g. "€49", "Free", "Custom" */
  readonly price:        string;
  /** Billing period, e.g. "/month", "/year" — displayed next to price */
  readonly period?:      string;
  readonly description?: string;
  /** Ordered list of included features rendered as a checklist */
  readonly features:     readonly string[];
  readonly ctaLabel:     string;
  readonly ctaHref:      string;
  /** When true the tier renders with accent/brand styling to draw attention */
  readonly highlighted?: boolean;
  /** Short badge text overlaid on the card, e.g. "Most popular" */
  readonly badge?:       string;
}

/**
 * Data for a PricingSectionBlock.
 *
 * Renders a set of pricing tiers as a card grid.  Typically 2–4 tiers.
 * All fields except `tiers` are optional so the block can be used with or
 * without a section heading or legal footnote.
 *
 * Variants:
 *   pricing_tiers   — 3-col card grid, one card per tier (default)
 *   pricing_compact — simplified row list; lower vertical footprint
 */
export interface PricingSectionBlockData {
  readonly heading?:    string;
  readonly subheading?: string;
  readonly tiers:       readonly PriceTier[];
  /** Optional legal / billing footnote below the tier cards */
  readonly footnote?:   string;
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
  readonly id:        string;
  readonly variant?:  string;
  readonly surface?:  BlockSurface;
  /**
   * Optional anchor ID for in-page navigation.
   * Renders as the `id` attribute on the block's wrapper element,
   * enabling direct linking via `/page#anchor-id` in CTAs.
   */
  readonly anchorId?: string;
  /**
   * Optional block-level design tokens. References a named token set from
   * `design.blockTokenSets` (by key) and/or inline per-block overrides. When
   * present, the renderer wraps this block in a scope that emits the resolved
   * CSS custom properties, so everything inside restyles without changing the
   * site-wide theme. See design-system/theme/block-token-set.ts.
   */
  readonly tokenSet?: string;
  readonly tokens?:   CuratedBlockTokens;
  /**
   * Optional declarative block effects (entrance reveals, emphasis, later
   * parallax / sticky / Ken Burns). References a named effect set from
   * `design.effectSets` (by key) and/or inline per-block effects. The renderer
   * wraps the block in a scope that emits the effect classes + params; a
   * versioned client runtime plays the scroll/hover triggers. See
   * design-system/effects/effect-ref.ts.
   */
  readonly effects?:  BlockEffectRef;
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

export interface PricingSectionBlock extends ContentBlockBase {
  readonly blockType: "pricingSection";
  readonly data:      PricingSectionBlockData;
}

export interface ContentSectionBlock extends ContentBlockBase {
  readonly blockType: "contentSection";
  readonly data:      ContentSectionBlockData;
}

export interface TeamSectionBlock extends ContentBlockBase {
  readonly blockType: "teamSection";
  readonly data:      TeamSectionBlockData;
}

export interface TimelineBlock extends ContentBlockBase {
  readonly blockType: "timeline";
  readonly data:      TimelineBlockData;
}

export interface QuickLinksBlock extends ContentBlockBase {
  readonly blockType: "quickLinks";
  readonly data:      QuickLinksBlockData;
}

export interface TextMediaBlock extends ContentBlockBase {
  readonly blockType: "textMedia";
  readonly data:      TextMediaBlockData;
}

export interface ContactSectionBlock extends ContentBlockBase {
  readonly blockType: "contactSection";
  readonly data:      ContactSectionBlockData;
}

export interface FloatingContactBlock extends ContentBlockBase {
  readonly blockType: "floatingContact";
  readonly data:      FloatingContactBlockData;
}

// ── Commerce / product block interfaces ───────────────────────────────────────

export interface ProductOverviewBlock extends ContentBlockBase {
  readonly blockType: "productOverview";
  readonly data:      ProductOverviewBlockData;
}

export interface ProductDetailBlock extends ContentBlockBase {
  readonly blockType: "productDetail";
  readonly data:      ProductDetailBlockData;
}

export interface CartSummaryBlock extends ContentBlockBase {
  readonly blockType: "cartSummary";
  readonly data:      CartSummaryBlockData;
}

export interface CheckoutBlock extends ContentBlockBase {
  readonly blockType: "checkoutBlock";
  readonly data:      CheckoutBlockData;
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
  | RecruiterPanelBlock
  // conversion / pricing
  | PricingSectionBlock
  // content / editorial
  | ContentSectionBlock
  | TeamSectionBlock
  // new core blocks
  | TimelineBlock
  | QuickLinksBlock
  | TextMediaBlock
  | ContactSectionBlock
  | FloatingContactBlock
  // commerce / product
  | ProductOverviewBlock
  | ProductDetailBlock
  | CartSummaryBlock
  | CheckoutBlock
  // map
  | MapBlock;

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
  /**
   * Structural position relative to content blocks.
   *
   * Used by the template-based rendering path (Sanity, Storyblok) where slots
   * are placed before or after the content blocks array.  Optional because the
   * unified `pageItems` rendering path (Statamic) derives position from array
   * order instead — slots appear at their authored position in the blocks array.
   *
   * When absent the renderer uses the slot's position in `pageItems` directly.
   */
  readonly position?:  ContextSlotPosition;
  /**
   * Optional layout/structural variant for the context block component.
   *
   * Controls the block's structural layout (e.g. "hero_split", "proof_logos")
   * independently of the content variant key.  Resolved by
   * resolveContextBlockVariant() before being passed to the block component.
   * When absent the block falls back to its family default layout.
   *
   * Valid keys per slotId:
   *   hero:   hero_default | hero_split | hero_proof
   *   proof:  proof_stats  | proof_logos | proof_quotes
   *   cta:    cta_banner   | cta_split  | cta_card
   *   header: header_default | header_centered | header_cta
   */
  readonly layoutVariant?: string;
  /**
   * Optional block-level design tokens for this adaptive/context slot.
   * References a named token set from `design.blockTokenSets` (by key) and/or
   * inline overrides. The renderer wraps the slot in a scope emitting the
   * resolved CSS custom properties. See design-system/theme/block-token-set.ts.
   */
  readonly tokenSet?: string;
  readonly tokens?:   CuratedBlockTokens;
}

// ═════════════════════════════════════════════════════════════════════════════
// PAGE ITEM  (unified rendering unit)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * A single rendering unit in a page's unified item sequence.
 *
 * `PageItem` is the discriminated union of context slots and content blocks
 * as they appear in the ordered `pageItems` array on `PageConfig`.
 *
 * ─── Motivation ───────────────────────────────────────────────────────────────
 *
 *   The classic `before-content / after-content` model forces all context slots
 *   into two fixed positions (top and bottom of the content area).  `PageItem`
 *   replaces that model with a single ordered array where slots and blocks can
 *   appear at any position — enabling editors to place a CTA slot between two
 *   content blocks, or a proof slot after an introductory text section.
 *
 * ─── Rendering ────────────────────────────────────────────────────────────────
 *
 *   `TemplateRenderer` iterates `pageConfig.pageItems` in order.
 *   Each item is rendered as either a `ContextSlotRenderer` or a
 *   `ContentBlockRenderer` depending on its `kind` discriminant.
 *
 * ─── Notification overlay ─────────────────────────────────────────────────────
 *
 *   Notification slots are rendered outside the `pageItems` loop as a
 *   full-page overlay.  They are still included in `contextSlots` for the
 *   decision engine but do not appear as `PageItem` entries.
 */
export type PageItem =
  | { readonly kind: "slot";  readonly slot:  ResolvedContextSlot }
  | { readonly kind: "block"; readonly block: ContentBlock };

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
   * Unified ordered rendering sequence — the primary rendering source.
   *
   * An ordered array of `PageItem` entries (each either a context slot or a
   * content block) reflecting the exact sequence authored in the CMS.  Slots
   * and blocks can be freely interleaved: a proof slot may appear between two
   * text sections, a CTA slot may appear mid-page, etc.
   *
   * `TemplateRenderer` iterates this array in order.  Notification slots are
   * excluded (rendered as overlays) and must be retrieved from `contextSlots`.
   *
   * ─── When populated ───────────────────────────────────────────────────────
   *
   *   Statamic pages use the unified model: `pageItems` is built directly from
   *   the `page_blocks` Replicator array in authoring order.
   *
   *   For CMS providers that separate slots from content (Sanity, Storyblok),
   *   `pageItems` is built by placing before-content slots first, then content
   *   blocks, then after-content slots — preserving backward compatibility.
   */
  readonly pageItems:      readonly PageItem[];

  /**
   * Flat list of all active context slots on this page.
   *
   * Derived from `pageItems` + any notification slots.  Used by:
   *   - The decision engine to update each slot's `variantKey`.
   *   - `TemplateRenderer` to fetch slot content in parallel before rendering.
   *
   * Do not use this array for rendering order — use `pageItems` instead.
   */
  readonly contextSlots:   readonly ResolvedContextSlot[];

  /**
   * Ordered array of CMS-driven content blocks.
   *
   * @deprecated Prefer `pageItems` for rendering.  Kept for backward compat
   * with callers that read `contentBlocks` directly (e.g. entity page assemblers).
   * Derived from `pageItems` — same data, content-only view.
   */
  readonly contentBlocks:  readonly ContentBlock[];

  /** SEO metadata for this page */
  readonly seo:            PageSeoConfig;
}

// ═════════════════════════════════════════════════════════════════════════════
// COMMERCE / PRODUCT BLOCKS
// ═════════════════════════════════════════════════════════════════════════════

// ── ProductOverview ───────────────────────────────────────────────────────────

/**
 * A single product card within a ProductOverviewBlock.
 *
 * `price` is a pre-formatted display string (e.g. "€49 / mo" or "From $99").
 * The platform does not perform currency formatting — the CMS author owns the
 * display string so localisation is handled in the CMS.
 *
 * `badge` is an optional short label rendered as a pill on the card
 * (e.g. "Popular", "New", "Best value").
 *
 * `cta` is an optional call-to-action for this individual product card.
 */
export interface ProductCardItem {
  readonly title:       string;
  readonly description: string;
  readonly price?:      string;
  readonly imageUrl?:   string;
  readonly imageAlt?:   string;
  readonly badge?:      string;
  readonly cta?:        BlockCTA;
}

/**
 * Data for a ProductOverviewBlock.
 *
 * Renders a grid of product cards with optional heading, intro text, prices,
 * badges, and per-card CTAs.  A section-level CTA below the grid is also
 * supported for "View all products"-style links.
 *
 * `showPrices` is a display toggle; when false all per-card `price` values
 * are hidden regardless of what the CMS returns.  Defaults to true.
 */
export interface ProductOverviewBlockData {
  readonly heading?:    string;
  readonly intro?:      string;
  readonly products:    readonly ProductCardItem[];
  readonly showPrices?: boolean;
  /** Optional section-level CTA rendered below the product grid */
  readonly cta?:        BlockCTA;
}

// ── ProductDetail ─────────────────────────────────────────────────────────────

/**
 * A single specification row in a ProductDetailBlock.
 */
export interface ProductSpecItem {
  readonly label: string;
  readonly value: string;
}

/**
 * Data for a ProductDetailBlock.
 *
 * Renders a full product detail view: gallery/media on one side, title +
 * description + specs + price + CTA on the other.  Optional related products
 * section below.
 *
 * `gallery` is an ordered list of image URLs; the first entry is the hero
 * image.  The component renders thumbnails for subsequent images.
 *
 * `specs` is a table of label/value pairs rendered as a definition list.
 *
 * `price` is a pre-formatted display string (same as ProductCardItem.price).
 */
export interface ProductDetailBlockData {
  readonly title:        string;
  readonly description?: string;
  readonly gallery?:     readonly { readonly url: string; readonly alt: string }[];
  readonly specs?:       readonly ProductSpecItem[];
  readonly price?:       string;
  readonly badge?:       string;
  /** Primary CTA (e.g. "Add to cart", "Request quote") */
  readonly cta?:         BlockCTA;
  /** Secondary CTA (e.g. "Learn more", "Download spec sheet") */
  readonly secondaryCta?: BlockCTA;
  /** Optional related product cards shown below the detail view */
  readonly relatedProducts?: readonly ProductCardItem[];
}

// ── CartSummary ───────────────────────────────────────────────────────────────

/**
 * Data for a CartSummaryBlock.
 *
 * Foundation commerce block — renders a cart summary placeholder.
 * In a full implementation this would be a client-side cart component;
 * the platform ships a static foundation that integrators replace with
 * their own cart logic.
 *
 * `emptyMessage` is shown when the cart is empty.
 * `checkoutHref` is the URL of the checkout page.
 * `continueShoppingHref` is the URL of the product listing page.
 */
export interface CartSummaryBlockData {
  readonly heading?:               string;
  readonly emptyMessage?:          string;
  readonly checkoutHref?:          string;
  readonly continueShoppingHref?:  string;
  readonly checkoutLabel?:         string;
  readonly continueShoppingLabel?: string;
  /** Plan identifier — "starter" | "growth" | "pro". Used to render plan-specific pricing and features. */
  readonly planId?:                string;
}

// ── CheckoutBlock ─────────────────────────────────────────────────────────────

/**
 * Data for a CheckoutBlock.
 *
 * Foundation commerce block — renders a checkout placeholder with configurable
 * copy.  Integrators replace this with a real payment processor embed.
 *
 * `paymentProvider` is informational text shown in the placeholder UI.
 * `returnHref` is the URL to redirect to after a successful purchase.
 */
export interface CheckoutBlockData {
  readonly heading?:          string;
  readonly intro?:            string;
  readonly paymentProvider?:  string;
  readonly returnHref?:       string;
  readonly returnLabel?:      string;
  /** Plan id — "starter" | "growth" | "pro" — drives the signup form's plan selection */
  readonly planId?:           string;
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
  readonly hero?:         HeroBlockData  & { readonly ctaKey?: string; readonly tokenRef?: BlockTokenRef; readonly effectRef?: BlockEffectRef };
  /** Proof slot content */
  readonly proof?:        ProofBlockData & { readonly tokenRef?: BlockTokenRef; readonly effectRef?: BlockEffectRef };
  /** CTA slot content + decision-engine variant key for analytics attribution */
  readonly cta?:          CTABlockData   & { readonly ctaKey?: string; readonly tokenRef?: BlockTokenRef; readonly effectRef?: BlockEffectRef };
  /** Feature grid slot content */
  readonly feature?:      FeatureBlockData & { readonly tokenRef?: BlockTokenRef; readonly effectRef?: BlockEffectRef };
  /**
   * Conversion section content (headline + CTAs, optional booking embed).
   * When present, a ConversionBlock is rendered at the after-content position.
   */
  readonly conversion?: ConversionBlockData;
  /**
   * Notification overlay content.
   * When present, the page renders an adaptive overlay (toast or banner)
   * above all other content.  When absent, no notification is shown.
   */
  readonly notification?: NotificationBlockData;
}
