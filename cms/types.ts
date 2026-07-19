/**
 * CMS Content Types
 *
 * These types define the raw data shapes returned by the CMS provider.
 * They are the canonical representation of content as it exists in the CMS
 * (currently mocked; later backed by Sanity documents).
 *
 * Naming conventions:
 *  - Field names mirror the Sanity schema field names we will define later,
 *    making the Sanity provider a near-zero-mapping implementation.
 *  - Block-level types use the suffix *BlockData to distinguish them from
 *    React component prop types (*BlockProps), which use presentation-layer
 *    field names (e.g. "headline", "eyebrow") that may differ from CMS names.
 *
 * Mapping:
 *   CMSProvider returns *BlockData
 *       ↓  mapHeroBlockData() / mapProofBlockData() / mapCTABlockData()
 *   Block components receive *BlockProps
 *
 * The mapper layer in /src/cms/mappers/ bridges the two shapes so that
 * CMS field names and component prop names can evolve independently.
 */

// ── Shared primitives ─────────────────────────────────────────────────────────

/**
 * A call-to-action button or link.
 * Used as a nested field in hero, CTA, and navigation content types.
 */
export interface CTAData {
  /** Button / link label text */
  label: string;
  /** Destination URL — may be relative ("/pricing") or absolute */
  href: string;
}

// ── Hero block ────────────────────────────────────────────────────────────────

/**
 * A single call-to-action item within the hero `ctas` array.
 *
 * `variant` controls the visual style of the button.  When omitted the
 * component infers it from position: first CTA → "primary", second → "secondary".
 */
export interface HeroCTAItem {
  /** Button label text */
  label: string;
  /** Destination URL — may be relative ("/pricing") or absolute */
  href: string;
  /**
   * Visual button style.
   * When absent, the component applies "primary" to position 0 and
   * "secondary" to position 1.
   */
  variant?: "primary" | "secondary" | "outline" | "ghost" | "link";
}

// ── Hero / page banner media ──────────────────────────────────────────────────

/**
 * A static image attached to a hero or page banner.
 *
 * kind: "image" discriminant lets renderers narrow the union without extra
 * type guards.
 */
export interface HeroBannerImage {
  kind: "image";
  /** CDN URL of the image asset */
  url: string;
  /** Alt text for accessibility */
  alt: string;
}

/**
 * An uploaded / self-hosted video file.
 * Rendered as a <video> element. `muted` is implicitly true when `autoplay`
 * is set because browsers require muted for autoplay.
 */
export interface HeroBannerVideoUpload {
  source: "upload";
  /** CDN or storage URL of the video file */
  url: string;
  /** URL of the poster image shown before the video loads */
  poster?: string;
  /** Start playing automatically (requires muted in most browsers) */
  autoplay?: boolean;
  /** Mute the audio track */
  muted?: boolean;
  /** Loop the video continuously */
  loop?: boolean;
  /** Show native browser video controls */
  controls?: boolean;
}

/**
 * A YouTube video referenced by its 11-character video ID only.
 * The embed URL is constructed by the renderer; no full URL is needed in the CMS.
 */
export interface HeroBannerVideoYouTube {
  source: "youtube";
  /** YouTube video ID — 11 chars, e.g. "dQw4w9WgXcQ" */
  videoId: string;
  /** Start playing automatically (muted is enforced by browsers for autoplay) */
  autoplay?: boolean;
  /** Loop the video continuously */
  loop?: boolean;
}

/**
 * A Vimeo video referenced by its numeric video ID only.
 * The embed URL is constructed by the renderer; no full URL is needed in the CMS.
 */
export interface HeroBannerVideoVimeo {
  source: "vimeo";
  /** Vimeo video ID — numeric string, e.g. "76979871" */
  videoId: string;
  /** Start playing automatically (muted is enforced by browsers for autoplay) */
  autoplay?: boolean;
  /** Loop the video continuously */
  loop?: boolean;
}

/** Discriminated union of all supported video source types. */
export type HeroBannerVideoSource =
  | HeroBannerVideoUpload
  | HeroBannerVideoYouTube
  | HeroBannerVideoVimeo;

/**
 * Video media attached to a hero or page banner.
 * Holds a nested `video` field so each source type can carry its own fields
 * without polluting the top-level HeroBannerMedia union.
 */
export interface HeroBannerVideo {
  kind: "video";
  video: HeroBannerVideoSource;
}

/**
 * Optional media attachment for a hero or page banner.
 *
 * Discriminated by `kind`:
 *   "image" → HeroBannerImage  (static image, rendered as <img>)
 *   "video" → HeroBannerVideo  (upload, YouTube, or Vimeo)
 *
 * Absent field (undefined) means text-only — all existing hero variants
 * without a media field continue to work without any changes.
 */
export type HeroBannerMedia = HeroBannerImage | HeroBannerVideo;

/**
 * Content data for a HeroBlock variant.
 *
 * CMS field  →  HeroBlockProps prop
 * ──────────    ──────────────────────
 * tag        →  tag      (eyebrow badge above headline)
 * title      →  title    (primary display headline)
 * subtitle   →  subtitle (supporting paragraph)
 * ctas       →  ctas     (0–2 call-to-action buttons)
 * media      →  media    (optional image or video attachment)
 *
 * Backward compatibility:
 *   The legacy `cta` field is kept as optional.  Mappers that still read
 *   flat `ctaLabel`/`ctaHref` fields produce `cta` and leave `ctas` empty;
 *   `mapHeroBlockData()` normalises this to a single-entry `ctas` array so
 *   the component never needs to know about the legacy shape.
 *   `media` is optional and absent on all existing documents — those continue
 *   to render as text-only heroes without any code changes.
 */
export interface HeroBlockData {
  /** Unique identifier — matches the HeroVariantKey used by the decision engine */
  id: string;
  /**
   * Snippet render mode for this variant on external (snippet) sites.
   *   "content" (default, absent) — swap the individual text/href slots below.
   *   "block"                     — serve `blockHtml` as one styled block via the
   *                                 snippet's data-mc-block path, with tokenRef
   *                                 forwarded as scoped CSS custom properties.
   * Only consumed by /api/snippet/decide; the platform's own React renderer
   * ignores it. See docs/design/snippet-render-modes.md.
   */
  renderMode?: "content" | "block";
  /**
   * Authored (or AI-generated) HTML for block render mode. Uses `var(--…)` for
   * colours/fonts so it adopts the tenant's tokens via tokenRef. Ignored unless
   * `renderMode === "block"`. The trust boundary matches data-mc-html: this is
   * tenant-authored content, never visitor input.
   */
  blockHtml?: string;
  /**
   * Optional block-level design tokens carried from a resolved adaptive
   * variant, so the homepage/engine renderer can scope this block's styling.
   * See design-system/theme/block-token-set.ts.
   */
  tokenRef?: import("@/design-system/theme/block-token-set").BlockTokenRef;
  /**
   * Layout variant for the hero block (e.g. "hero_split", "hero_background").
   * Resolved via resolveContextBlockVariant("hero", layoutVariant).
   * Absent means use the page-level or tenant-level default.
   */
  layoutVariant?: string;
  /** Primary display headline */
  title: string;
  /** Supporting paragraph beneath the headline */
  subtitle: string;
  /**
   * Flexible CTA array.
   *   0 items → no buttons rendered
   *   1 item  → single primary button
   *   2 items → primary + secondary button pair
   * Max 2 items; any extras are ignored by the component.
   */
  ctas: readonly HeroCTAItem[];
  /**
   * @deprecated Use `ctas`.
   * Retained for CMS documents that have not yet migrated to the ctas array.
   * `mapHeroBlockData()` normalises this to `ctas` automatically.
   */
  cta?: CTAData;
  /** Optional eyebrow label rendered above the headline as a badge */
  tag?: string;
  /**
   * Optional media attachment — image or video.
   * Absent (undefined) means no media; the block renders as text-only.
   * When present, the rendering depends on the layout variant:
   *   hero_split      — media fills the right column panel
   *   hero_default / hero_proof — media appears below the text + CTA
   *   hero_background — media covers the full viewport as a background
   */
  media?: HeroBannerMedia;
  /**
   * Horizontal alignment of the headline, subtitle, and CTA buttons.
   * Only meaningful for the `hero_background` layout variant; the component
   * ignores this field on all other layout variants.
   * When absent the component defaults to "center".
   */
  contentAlign?: "left" | "center" | "right";
  /**
   * Customisable trust metric items for the `hero_proof` compact bar.
   * Only meaningful when `layoutVariant === "hero_proof"`.
   * When absent or empty the component falls back to its built-in default items
   * so existing documents continue to work without any content migration.
   */
  proofItems?: readonly { metric: string; label: string }[];
  /**
   * Slides for the `hero_carousel` layout variant — each slide is an independent
   * hero (heading + subheading + optional media + CTA). Only meaningful when
   * `layoutVariant === "hero_carousel"`; ignored on every other variant.
   */
  slides?: readonly HeroSlideData[];
  /**
   * Carousel auto-advance toggle. When true (or absent — the default) the
   * `hero_carousel` rotates slides automatically; when false the visitor steps
   * through with the arrows/dots. Only meaningful for `hero_carousel`.
   */
  carouselAutoplay?: boolean;
}

/** A single slide within a `hero_carousel` hero. */
export interface HeroSlideData {
  heading?:    string;
  subheading?: string;
  /**
   * Optional media for the slide — image (asset library or URL) or video
   * (uploaded asset, YouTube, or Vimeo) with the usual autoplay/loop/muted/
   * poster options. Same union as the main hero media.
   */
  media?:      HeroBannerMedia;
  ctaLabel?:   string;
  ctaUrl?:     string;
  /** @deprecated Gebruik media: { kind: "image", url, alt } */
  mediaUrl?:   string;
  /** @deprecated Gebruik media: { kind: "image", url, alt } */
  mediaAlt?:   string;
}

// ── Proof block ───────────────────────────────────────────────────────────────

/**
 * A single proof point — stat, testimonial quote, or capability statement.
 * Used as items within a ProofBlockData.
 */
export interface ProofItem {
  /** Short bold label, e.g. "3.2× more leads" or "Edge-native" */
  title: string;
  /** One-to-two sentence supporting copy */
  text: string;
}

/**
 * Content data for a ProofBlock variant.
 *
 * CMS field  →  ProofBlockProps prop
 * ──────────    ──────────────────────
 * title      →  label  (section heading / eyebrow)
 * items      →  stats  (rendered as metric cards)
 */
export interface ProofBlockData {
  /** Unique identifier — matches the ProofVariantKey */
  id: string;
  /** Optional block-level design tokens carried from a resolved adaptive variant. */
  tokenRef?: import("@/design-system/theme/block-token-set").BlockTokenRef;
  /** Snippet block render mode — see HeroBlockData.renderMode. */
  renderMode?: "content" | "block";
  /** Authored HTML for block render mode — see HeroBlockData.blockHtml. */
  blockHtml?: string;
  /**
   * Layout variant for the proof block (e.g. "proof_logos", "proof_quotes").
   * Resolved via resolveContextBlockVariant("proof", layoutVariant).
   */
  layoutVariant?: string;
  /** Section heading displayed above the proof items */
  title: string;
  /** Ordered array of proof points (typically 3) */
  items: ProofItem[];
}

// ── CTA block ─────────────────────────────────────────────────────────────────

/**
 * Content data for a CTABlock variant.
 *
 * CMS field  →  CTABlockProps prop
 * ──────────    ──────────────────────
 * title      →  headline
 * text       →  subheadline
 * cta        →  primaryCta
 */
export interface CTABlockData {
  /** Unique identifier — matches the CTAVariantKey */
  id: string;
  /** Optional block-level design tokens carried from a resolved adaptive variant. */
  tokenRef?: import("@/design-system/theme/block-token-set").BlockTokenRef;
  /** Snippet block render mode — see HeroBlockData.renderMode. */
  renderMode?: "content" | "block";
  /** Authored HTML for block render mode — see HeroBlockData.blockHtml. */
  blockHtml?: string;
  /**
   * Layout variant for the CTA block (e.g. "cta_split", "cta_card").
   * Resolved via resolveContextBlockVariant("cta", layoutVariant).
   */
  layoutVariant?: string;
  /** Large display headline */
  title: string;
  /** Supporting paragraph beneath the headline */
  text: string;
  /** Primary call-to-action */
  cta: CTAData;
}

// ── Feature block ─────────────────────────────────────────────────────────────

/**
 * A single feature item within a FeatureBlockData.
 *
 * Represents one capability, benefit, or product highlight.
 */
export interface FeatureItem {
  /** Short bold label, e.g. "Edge-native decision engine" */
  title: string;
  /** One-to-three sentence supporting copy */
  body: string;
  /**
   * Optional icon identifier — a string key mapped to an icon component by
   * the renderer.  If absent, the block renders a decorative placeholder.
   * Convention: use a slug-style string, e.g. "lightning", "shield", "chart".
   */
  icon?: string;
}

/**
 * Content data for a FeatureBlock variant.
 *
 * Adaptive feature highlights / benefit grid section.
 * The layout is controlled by `layoutVariant`:
 *
 *   feature_grid       — compact icon + title grid (default)
 *   feature_highlights — larger alternating left/right feature rows
 *   feature_comparison — side-by-side comparison table
 *
 * CMS field  →  FeatureBlockData field
 * ──────────    ─────────────────────
 * key        →  id
 * title      →  title
 * subtitle   →  subtitle  (optional section subheading)
 * items[]    →  items
 */
export interface FeatureBlockData {
  /** Unique identifier — matches the FeatureVariantKey */
  id: string;
  /** Optional block-level design tokens carried from a resolved adaptive variant. */
  tokenRef?: import("@/design-system/theme/block-token-set").BlockTokenRef;
  /** Snippet block render mode — see HeroBlockData.renderMode. */
  renderMode?: "content" | "block";
  /** Authored HTML for block render mode — see HeroBlockData.blockHtml. */
  blockHtml?: string;
  /**
   * Layout variant for the feature block.
   * Resolved via resolveContextBlockVariant("feature", layoutVariant).
   */
  layoutVariant?: string;
  /** Section heading above the feature items */
  title: string;
  /** Optional section subheading / intro sentence */
  subtitle?: string;
  /** Ordered array of feature / benefit items (typically 3–6) */
  items: FeatureItem[];
}

// ── Conversion block ──────────────────────────────────────────────────────────

/**
 * Content data for a ConversionBlock variant.
 *
 * A richer, more intent-specific conversion section than a simple CTA block.
 * Supports a headline, supporting copy, 1–2 CTAs, and an optional form key
 * that the renderer maps to a registered platform form embed.
 *
 * Typical uses:
 *   conversion_signup   — email / account signup with form embed
 *   conversion_demo     — demo request with booking widget key
 *   conversion_contact  — contact / enquiry form
 *
 * CMS field    →  ConversionBlockData field
 * ──────────      ─────────────────────────
 * key          →  id
 * title        →  title
 * text         →  text
 * ctas[]       →  ctas
 * formKey      →  formKey  (optional — maps to a registered form embed)
 * urgencyLabel →  urgencyLabel  (optional — e.g. "Free for 14 days")
 */
export interface ConversionBlockData {
  /** Unique identifier — matches the ConversionVariantKey */
  id: string;
  /**
   * Layout variant for the conversion block.
   * Resolved via resolveContextBlockVariant("conversion", layoutVariant).
   */
  layoutVariant?: string;
  /** Large display headline */
  title: string;
  /** Supporting paragraph beneath the headline */
  text: string;
  /**
   * 1–2 CTA buttons.  Reuses HeroCTAItem so the component layer is consistent.
   * First item renders as primary, second as secondary unless variant is overridden.
   */
  ctas: readonly HeroCTAItem[];
  /**
   * Optional key of a platform-registered form embed (e.g. "hubspot-demo",
   * "typeform-contact").  Rendered by the block as an embedded form widget.
   * When absent, the block renders as a standard headline + CTA section.
   */
  formKey?: string;
  /**
   * Optional short urgency label shown near the CTA (e.g. "Free for 14 days",
   * "No credit card required").  Absent = no urgency label rendered.
   */
  urgencyLabel?: string;
}

// ── Notification block ────────────────────────────────────────────────────────

/**
 * Content data for a NotificationBlock variant.
 *
 * Rendered as an overlay (toast or top/bottom banner) on top of — not inside —
 * the page layout.  The block is dismissed by the visitor or auto-dismissed
 * after `autoDismissMs` milliseconds.
 *
 * Severity controls visual style:
 *   info     — blue / neutral informational notice
 *   success  — green success or confirmation message
 *   warning  — amber alert or important notice
 *   promo    — brand-coloured promotional offer
 *
 * CMS field         →  NotificationBlockData field
 * ──────────            ─────────────────────────
 * key               →  id
 * message           →  message
 * severity          →  severity
 * ctaLabel          →  ctaLabel  (optional)
 * ctaHref           →  ctaHref   (optional)
 * position          →  position  (optional, defaults to "top")
 * dismissible       →  dismissible (optional, defaults to true)
 * autoDismissMs     →  autoDismissMs (optional — 0 = never)
 */
export interface NotificationBlockData {
  /** Unique identifier — matches the NotificationVariantKey */
  id: string;
  /** Main notification message text */
  message: string;
  /** Visual severity / colour scheme */
  severity: "info" | "success" | "warning" | "promo";
  /** Optional CTA button label (e.g. "Bekijk aanbieding") */
  ctaLabel?: string;
  /** Optional CTA href — when set, the notification renders a clickable button */
  ctaHref?: string;
  /**
   * Where the notification is anchored on screen.
   *   top          — fixed banner across the full viewport top
   *   bottom-right — floating toast in the bottom-right corner (default for toasts)
   */
  position?: "top" | "bottom-right";
  /** Whether the visitor can dismiss the notification.  Defaults to true. */
  dismissible?: boolean;
  /** Auto-dismiss delay in milliseconds.  0 or absent = never auto-dismiss. */
  autoDismissMs?: number;
}

// ── Union for generic handling ────────────────────────────────────────────────

/** Any adaptive CMS block data type — useful for type-narrowing utilities */
export type AnyBlockData =
  | HeroBlockData
  | ProofBlockData
  | CTABlockData
  | FeatureBlockData
  | ConversionBlockData
  | NotificationBlockData;

// ── Adaptive block (Content Matrix) ──────────────────────────────────────────

/**
 * Content payload voor één variant van een adaptive block.
 * Shared across defaultVariant en elke AdaptiveVariantEntry.
 *
 * Velden komen overeen met HeroBlockData / ProofBlockData / etc. zodat het
 * admin-panel dezelfde preview-component kan gebruiken voor alle slot-typen.
 */
/**
 * Één kaart/item binnen een multi-item adaptive variant
 * (proof-kolom, feature-kaart, enz.).
 *
 * Alle velden zijn optioneel zodat hetzelfde type bruikbaar is voor zowel
 * proof-statistieken (title + text) als feature-kaarten (title + body + imageUrl + cta).
 */
export interface AdaptiveVariantItem {
  /** Koptekst van de kaart of stat-waarde, bijv. "40% hogere conversie" */
  title?:    string;
  /** Beschrijvende tekst onder de koptekst */
  text?:     string;
  /**
   * Langere body-tekst (alias voor `text`; wordt gebruikt bij feature-kaarten).
   * Eén van `text` of `body` mag aanwezig zijn.
   */
  body?:     string;
  /** Optionele afbeelding (URL) bovenaan de kaart */
  imageUrl?: string;
  /** CTA-label voor de kaart (bijv. "Meer lezen") */
  cta?:      string;
  /** CTA-link voor de kaart */
  ctaHref?:  string;
}

export interface AdaptiveVariantContent {
  /** Primaire headline */
  title:     string;
  /** Ondersteunende alinea onder de headline */
  subtitle:  string;
  /** Eyebrow-label boven de headline */
  tag?:      string;
  /** 0–2 CTA-knoppen */
  ctas?:     HeroCTAItem[];
  /**
   * Layout-variant sleutel, bijv. "hero_split", "hero_background", "hero_default".
   * Bepaalt de positie van media t.o.v. tekst.
   */
  layoutVariant?: string;
  /**
   * Horizontale uitlijning van tekst + CTA's.
   * Alleen van toepassing op de hero_background layout.
   */
  contentAlign?: "left" | "center" | "right";
  /**
   * Optionele media-bijlage — afbeelding of video.
   * Afwezig = tekst-only block.
   */
  media?: HeroBannerMedia;
  /**
   * Inhoud-items voor multi-kolom slots (proof, feature).
   * Typisch 3 items; elk item beschrijft één kaart/kolom.
   */
  items?: AdaptiveVariantItem[];
  /**
   * Slides voor de `hero_carousel` layout-variant — elke slide is een losse hero
   * (kop + subkop + optionele media + CTA). Alleen relevant wanneer
   * `layoutVariant === "hero_carousel"`; genegeerd op elke andere variant.
   */
  slides?: HeroSlideData[];
  /**
   * Carousel auto-advance toggle (default true). Only relevant when
   * `layoutVariant === "hero_carousel"`.
   */
  carouselAutoplay?: boolean;
  /**
   * AI / Decision metadata — structured signals the AI uses to decide whether
   * to show this variant to a visitor. Authored in the admin (EditBlockDrawer)
   * instead of the CMS. Readiness (aiReady) is derived from completeness of the
   * required fields; an incomplete block is still usable as a manual/rule-based
   * fallback. Absent = not yet described.
   */
  decisionMeta?: Partial<import("@/ai/variant-meta").VariantDecisionMeta>;
  /**
   * Block-level design tokens for this variant. References a named token set
   * (by key, from design.blockTokenSets) applied when this variant renders, so
   * different personalised variants can carry different styling. Optional inline
   * `tokens` layer on top of the named set. See design-system/theme/block-token-set.ts.
   */
  tokenSet?:  string;
  tokens?:    import("@/design-system/theme/block-token-set").CuratedBlockTokens;
  /** @deprecated Gebruik media: { kind: "image", url, alt } */
  imageUrl?:  string;
  /** @deprecated Gebruik media: { kind: "image", url, alt } */
  imageAlt?:  string;
}

/**
 * Één entry in de adaptiveVariants-array.
 * Koppelt een variantKey (uit de rule engine) aan variant-content.
 */
export interface AdaptiveVariantEntry {
  variantKey: string;
  label?:     string;
  content:    AdaptiveVariantContent;
}

/**
 * Genormaliseerd adaptive block-object — CMS-agnostisch.
 * Sanity-documenten en Supabase-rijen worden beide naar dit type gemapped
 * voordat ze de rendering-laag bereiken.
 */
export interface AdaptiveBlockData {
  /** Unieke id (Sanity _id of Supabase uuid) */
  id:               string;
  /** Routing-sleutel, bijv. "hero_matrix_homepage" */
  key:              string;
  /** Optionele tenant-scope; null/leeg = platform-breed */
  tenantId?:        string | null;
  /** Wanneer false: component rendert niets. */
  isActive:         boolean;
  /** SEO-fallback — altijd gerenderd voor bots en bij geen match. */
  defaultVariant:   AdaptiveVariantContent;
  /** Lijst met gepersonaliseerde varianten, gesorteerd op prioriteit. */
  adaptiveVariants: AdaptiveVariantEntry[];
}

// ── Site settings ─────────────────────────────────────────────────────────────

// ── Mega menu types ───────────────────────────────────────────────────────────

/**
 * A navigation link item inside a mega menu column.
 * Produced by the GROQ projection for megaMenuLinkItem objects.
 */
export interface MegaMenuLinkItemData {
  /** Sanity _key for stable list keying */
  _key:          string;
  /** Discriminant — always "megaMenuLinkItem" */
  type:          "megaMenuLinkItem";
  /** Display label */
  label:         string;
  /** Pre-resolved href (root-relative for internal, full URL for external) */
  href:          string;
  /** Optional supporting sentence shown beneath the label */
  description?:  string | null;
  /** When true the link opens in a new browser tab */
  openInNewTab?: boolean;
}

/**
 * A rich media item inside a mega menu column.
 * Produced by the GROQ projection for megaMenuMediaItem objects.
 */
export interface MegaMenuMediaItemData {
  /** Sanity _key for stable list keying */
  _key:             string;
  /** Discriminant — always "megaMenuMediaItem" */
  type:             "megaMenuMediaItem";
  /** Controls which HTML element / tag is rendered */
  mediaType:        "image" | "gif" | "video";
  /** CDN URL of the primary asset (image / GIF / video) */
  assetUrl?:        string | null;
  /** Alt text for images and GIFs */
  alt?:             string | null;
  /** CDN URL of the alternative asset shown on hover (image / GIF only) */
  hoverAssetUrl?:   string | null;
  /** Optional caption rendered below the media */
  caption?:         string | null;
  /** When set, wraps the media in a clickable link */
  linkUrl?:         string | null;
  /** Open the link in a new browser tab */
  linkOpenInNewTab?: boolean;
  /** Direct URL to a hosted video file (video type only) */
  videoUrl?:        string | null;
}

/** Discriminated union of all mega menu column item types. */
export type MegaMenuColumnItemData = MegaMenuLinkItemData | MegaMenuMediaItemData;

/**
 * A single column in a mega menu panel.
 *
 * Column title rule: when `title` is null or empty the heading is not rendered.
 * This allows columns to be mixed — some with titles, some without.
 */
export interface MegaMenuColumnData {
  /** Sanity _key for stable list keying */
  _key:        string;
  /** Optional column heading. When absent or empty, no title is rendered. */
  title?:      string | null;
  /** Controls the column's visual layout: vertical links or media cards. */
  columnType:  "links" | "media";
  /** The column's content items — links or media blocks. */
  items:       MegaMenuColumnItemData[];
}

/**
 * The full mega menu configuration for a top-level navigation item.
 * When `columns` is non-empty this takes precedence over the legacy
 * `children` array in the renderer.
 */
export interface MegaMenuData {
  /** Ordered array of column definitions. Displayed left-to-right. */
  columns: MegaMenuColumnData[];
  /**
   * Optional promotional CTA block shown alongside or below the columns.
   * Renders as an image + heading + supporting text + link (arrow or label).
   * Absent/null → no CTA.
   */
  cta?: MegaMenuCtaData | null;
}

/**
 * A promotional call-to-action block inside a mega menu.
 *
 * Placement:
 *   "left"  / "right"  — a card beside the columns (image on top, brand-coloured
 *                        text block beneath, arrow/label at the bottom).
 *   "bottom"           — a full-width bar under the columns (image left, text,
 *                        arrow/label right).
 */
export interface MegaMenuCtaData {
  /** Sanity _key / stable key for list rendering. */
  _key?:        string;
  /** Where the CTA sits relative to the columns. "bottom" = full-width bar. */
  position:     "left" | "right" | "bottom";
  /** Bold heading line (e.g. "Keuzehulp"). */
  heading:      string;
  /** Optional supporting text under the heading. */
  text?:        string | null;
  /** Optional image / illustration URL. */
  imageUrl?:    string | null;
  /** Alt text for the image. */
  imageAlt?:    string | null;
  /** Destination URL (internal path or external URL). */
  href:         string;
  /** Optional button label. When absent, only an arrow is shown. */
  ctaLabel?:    string | null;
  /** Open the link in a new browser tab. */
  openInNewTab?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * A resolved navigation link, ready for the rendering layer.
 *
 * References are resolved at query time (GROQ dereference) so that callers
 * receive a plain `href` string rather than a Sanity reference object.
 * Internal pages produce a root-relative path (e.g. "/about-us");
 * external URLs are returned as-is.
 */
export interface NavigationItemData {
  /** Sanity document _id for stable keying in lists */
  id: string;
  /** Display label for the link */
  label: string;
  /** Resolved destination — "/" + slug for internal pages, full URL for external */
  href: string;
  /** Optional short description for mega-menu / flyout rich entries */
  description?: string;
  /** Optional card thumbnail URL — shown in mega-menu feature columns when set */
  imageUrl?: string;
  /** Optional hover thumbnail URL — cross-faded in when the card is hovered */
  imageUrlHover?: string;
  /**
   * When explicitly set to `false`, the card thumbnail is hidden in the mega menu
   * feature column even when `imageUrl` is present on child items.
   * Absent (undefined) is treated as `true` — images are shown by default.
   * Configured via the `mega_show_image` field on the Statamic nav tree item.
   */
  megaShowImage?: boolean;
  /**
   * When explicitly set to `false`, the excerpt / description text is hidden in
   * the mega menu feature column even when child items carry a `description`.
   * Absent (undefined) is treated as `true` — descriptions are shown by default.
   * Configured via the `mega_show_description` field on the Statamic nav tree item.
   */
  megaShowDescription?: boolean;
  /** When true the link should open in a new browser tab */
  openInNewTab?: boolean;
  /**
   * Per-page header variant override.
   * When set, the header renders with this structural variant when the visitor
   * is on the page this nav item links to.  If absent, the site-wide default
   * from SiteSettingsData.headerVariant (or the theme family default) is used.
   */
  headerVariant?: string | null;
  /** Optional nested child links — supports two levels (dropdown + mega-menu) */
  children?: NavigationItemData[];
  /**
   * Rich column-based mega menu configuration.
   * When `megaMenu.columns` is non-empty this takes precedence over `children`
   * in the mega menu renderer, enabling column titles, mixed content types,
   * and rich media blocks.
   */
  megaMenu?: MegaMenuData | null;
  /**
   * Optional promotional CTA shown inside this item's mega menu — works for
   * BOTH the rich column mega menu and the legacy `children` mega menu. Renders
   * as a card on the left/right of the panel, or a full-width bar below it.
   * (For rich column menus the equivalent `megaMenu.cta` is also honoured.)
   */
  megaCta?: MegaMenuCtaData | null;
  /**
   * How this item's dropdown renders when it has sub-items:
   *   "mega"   — wide feature columns + optional CTA (the rich mega menu).
   *   "simple" — a compact vertical dropdown list of the child links.
   * Absent → defaults to "mega" (the rich panel). Set per nav item in the CMS.
   */
  dropdownStyle?: "mega" | "simple" | null;
}

/**
 * Site logo — asset URL resolved at query time from the Sanity image asset.
 */
export interface SiteLogoData {
  /** CDN URL of the logo image */
  url: string;
  /** Alt text for accessibility */
  alt: string;
}

/**
 * A single footer column — heading + ordered link list.
 * Populated from siteSettings.footerColumns.
 */
export interface FooterLinkData {
  /** Display text for the link */
  label: string;
  /** Resolved destination URL */
  href: string;
  /** When true the link opens in a new browser tab */
  openInNewTab?: boolean;
}

export interface FooterColumnData {
  /** Optional column heading text */
  title?: string | null;
  /** Ordered list of links in the column */
  links: FooterLinkData[];
}

/**
 * A social media profile link in the footer.
 */
export interface SocialLinkData {
  /** Platform display name, e.g. "LinkedIn" */
  label: string;
  /** Full absolute URL of the social profile */
  url: string;
  /**
   * Platform identifier used to pick a built-in SVG icon.
   * Supported values: facebook | instagram | linkedin | twitter | youtube |
   * tiktok | pinterest | github | mastodon | threads | bluesky
   * When absent the label text is rendered instead of an icon.
   */
  platform?: string;
  /**
   * When false, this link is hidden in the UI.
   * Defaults to true (visible) when absent.
   */
  enabled?: boolean;
}

/**
 * Header CTA button data from siteSettings.headerCta.
 */
export interface HeaderCtaData {
  /** Button label text */
  label: string;
  /** Destination URL — relative or absolute */
  href: string;
  /** Visual button style */
  style?: "primary" | "secondary" | "outline" | "ghost";
  /** When true opens in a new browser tab */
  openInNewTab?: boolean;
}

/**
 * A single entry in the header section-tabs strip.
 *
 * Used exclusively by the header_triband layout variant.
 * The top band renders one tab per entry — clicking navigates to the target site section.
 * Active state is determined client-side by matching href against the current pathname.
 */
export interface SectionTabData {
  /** Display label for the tab, e.g. "Website" or "Werken bij" */
  label:        string;
  /** Target URL, e.g. "/" or "/werken-bij" */
  href:         string;
  /** When true the tab opens in a new browser tab */
  openInNewTab?: boolean;
  /**
   * Statamic navigation handle for the main nav shown in band 3 while this
   * section is active.  When absent, the default "main_nav" tree is used.
   * E.g. "main_nav", "jobs_nav", "news_nav".
   */
  navHandle?: string;
}

/**
 * Configuration for the header utility bar / top bar shown above or alongside
 * the main navigation (search, cart, language selector, utility links, CTA).
 *
 * All fields are optional and default to hidden/disabled when absent.
 * The top bar is hidden entirely when no items are active.
 */
export interface TopBarData {
  /** Show a search icon that links to the search page */
  showSearch?: boolean;
  /** Destination for the search icon (default: /search) */
  searchHref?: string;
  /** Show a shopping cart icon */
  showCart?: boolean;
  /** Destination for the cart icon (default: /cart) */
  cartHref?: string;
  /** Show the locale/language selector dropdown */
  showLanguageSwitcher?: boolean;
  /**
   * Extra navigation links shown in the top bar (utility links).
   * Rendered right-to-left, before any icons.
   */
  links?: NavigationItemData[];
  /**
   * Optional standalone CTA button in the top bar.
   * Separate from the main header CTA (which appears in the nav row).
   */
  cta?: {
    label: string;
    href: string;
    openInNewTab?: boolean;
    style?: "primary" | "secondary" | "outline" | "ghost";
  } | null;
}

/**
 * Data for the slim strip shown at the very bottom of the footer.
 * Typically contains copyright text, social icon links, legal links,
 * and an optional partner/powered-by logo on the right.
 */
export interface FooterBottomData {
  /** Copyright or attribution text, e.g. "© 2025 Mister Chameleon BV" */
  copyright?: string;
  /** Show social media icon buttons in the bottom strip */
  showSocial?: boolean;
  /** Legal / utility links (Privacy policy, Terms, Cookie settings, …) */
  links?: NavigationItemData[];
  /** Optional partner or "Powered by" logo URL */
  partnerLogoUrl?: string;
  /** Accessible alt text for the partner logo */
  partnerLogoAlt?: string;
  /** Makes the partner logo a clickable link */
  partnerHref?: string;
}

/**
 * A single supported locale/language entry.
 */
export interface LocaleEntry {
  /** IETF locale code, e.g. "en", "nl" */
  code: string;
  /** Human-readable display label, e.g. "English" */
  label: string;
  /**
   * When false, this locale is not shown in the language switcher.
   * Corresponds to Statamic's "Custom Attribute" showSite on the site config.
   * Defaults to true (visible) when absent.
   */
  showInSwitcher?: boolean;
}

/**
 * Physical address data displayed in the footer (contact block).
 */
export interface AddressData {
  /** Street name and number, e.g. "Molenweg 10" */
  street?: string;
  /** City name, e.g. "Voorthuizen" */
  city?: string;
  /** Postal/ZIP code, e.g. "3781 VD" */
  zipCode?: string;
  /** Country name or code, e.g. "Netherlands" */
  country?: string;
  /** General contact phone number */
  phone?: string;
  /** General contact email (may differ from contactEmail on SiteSettingsData) */
  email?: string;
}

/**
 * Data returned by CMSProvider.getSiteSettings().
 *
 * Contains the fields needed for the site shell (header / footer):
 *   siteTitle            — used in <title> tag fallbacks and aria-labels
 *   logo                 — resolved asset URL + alt text; null when not set
 *   logoDark             — optional dark-background logo variant
 *   logoLight            — optional light-background logo variant
 *   headerCta            — optional CTA button in the header
 *   utilityLinks         — optional secondary utility nav links in the header
 *   locales              — ordered list of supported locales (drives language selector)
 *   mainNavigation       — ordered header nav links (with optional dropdowns)
 *   footerColumns        — structured multi-column footer layout
 *   footerNavigation     — flat bottom-bar links (Privacy, Terms, etc.)
 *   contactEmail         — public contact email shown in footer
 *   contactPhone         — public contact phone shown in footer
 *   socialLinks          — social media profiles shown in footer
 */
export interface SiteSettingsData {
  siteTitle:       string;
  logo:            SiteLogoData | null;
  logoDark?:       SiteLogoData | null;
  logoLight?:      SiteLogoData | null;
  headerCta?:      HeaderCtaData | null;
  utilityLinks?:   NavigationItemData[];
  locales?:        LocaleEntry[];
  mainNavigation:  NavigationItemData[];
  footerColumns?:  FooterColumnData[];
  footerNavigation:NavigationItemData[];
  contactEmail?:   string | null;
  contactPhone?:   string | null;
  /**
   * Physical address for display in the footer contact section.
   * When absent the address block is not rendered.
   */
  address?:        AddressData | null;
  /** Social media profile links; disabled entries (enabled: false) are filtered out by components. */
  socialLinks?:    SocialLinkData[];
  /**
   * CMS-specified base theme preset key.
   * When set, this becomes the tenant's default theme — overriding the
   * platform DB value (tenantSettings.design.theme).  The platform adaptive
   * rules (resolveThemeDecision) can still override it per visitor segment.
   *
   * Matches a ThemePresetKey from design-system/theme/presets.ts.
   * Example: "dark-ai", "corporate-blue", "modern-saas".
   */
  themePreset?:    string | null;
  // ── Header utility bar ─────────────────────────────────────────────────────
  /**
   * Optional configuration for the header utility bar (search, language
   * selector).  The CTA button is always controlled via `headerCta`.
   * When absent, utility bar items default to hidden.
   */
  topBar?:         TopBarData | null;
  /**
   * Section tabs for the header_triband layout variant.
   *
   * Each entry renders as a tab in the slim top band of the triband header.
   * Populated from the inline `section_tabs` grid in the Statamic
   * "Layout Settings" global (Globals → Layout Settings in the CP).
   * When absent or empty, the top band is not rendered.
   */
  sectionTabs?:    SectionTabData[] | null;
  /**
   * Pre-fetched navigation trees for each unique nav handle referenced by the
   * section tabs.  Keyed by nav handle (e.g. "main_nav", "jobs_nav").
   *
   * The Header passes this map to the TriBandNav client component so it can
   * switch the band-3 navigation instantly on tab change, without a server round-trip.
   * Absent when no section tabs are configured, or all tabs use the default nav.
   */
  sectionTabNavs?: Record<string, NavigationItemData[]> | null;
  // ── Footer bottom strip ───────────────────────────────────────────────────
  /**
   * Optional slim strip at the very bottom of the footer.
   * When absent the footer bottom strip is not rendered.
   */
  footerBottom?:   FooterBottomData | null;
  // ── Layout overrides ──────────────────────────────────────────────────────
  /**
   * CMS-level header layout variant.
   * Acts as a fallback: the platform admin value takes precedence when set.
   * When neither is set, the active theme family's default applies.
   * Configurable via the Statamic "Layout Settings" global.
   */
  headerVariant?:  "minimal" | "flyout" | "mega" | "transparent" | "triband" | null;
  /**
   * CMS-level footer layout variant fallback.
   * Configurable via the Statamic "Layout Settings" global.
   */
  footerVariant?:  "minimal" | "corporate" | "branding" | null;
  /**
   * CMS-level footer density fallback.
   * Configurable via the Statamic "Layout Settings" global.
   */
  footerDensity?:  "compact" | "comfortable" | "spacious" | null;

  // ── Navigation typography (CMS-level fallbacks) ──────────────────────────
  // These map to CSS custom properties via resolve-theme.ts and are applied as
  // a lower-priority layer in app/layout.tsx, below any platform-admin token
  // overrides.  All configurable via the Statamic "Layout Settings" global.

  /** CSS font-size for header nav links, e.g. "0.875rem". Maps to --nav-link-size. */
  navLinkSize?:         string | null;
  /** CSS font-weight for header nav links, e.g. "500". Maps to --nav-link-weight. */
  navLinkWeight?:       string | null;
  /** CSS letter-spacing for header nav links, e.g. "0.02em". Maps to --nav-link-tracking. */
  navLinkTracking?:     string | null;
  /** CSS font-size for dropdown/mega-menu items. Maps to --nav-dropdown-item-size. */
  dropdownItemSize?:    string | null;
  /** CSS font-size for footer navigation links. Maps to --footer-nav-size. */
  footerNavSize?:       string | null;
}

// ── Portable Text ─────────────────────────────────────────────────────────────

/**
 * A single span inside a Portable Text block.
 * `marks` references decorator keys (e.g. "strong", "em") or annotation _keys.
 */
export interface PortableTextSpan {
  _type: "span";
  _key?: string;
  text: string;
  marks?: string[];
}

/**
 * An annotation mark definition (e.g. a link) referenced by span marks.
 */
export interface PortableTextMarkDef {
  _key: string;
  _type: string;
  [key: string]: unknown;
}

/**
 * A single Portable Text block node.
 * Covers paragraph, headings, and blockquote styles produced by the
 * textSection body field.
 */
export interface PortableTextBlock {
  _type: "block";
  _key?: string;
  style?: "normal" | "h2" | "h3" | "h4" | "blockquote";
  children?: PortableTextSpan[];
  markDefs?: PortableTextMarkDef[];
}

// ── Surface ───────────────────────────────────────────────────────────────────

import type { BlockSurface } from "@/lib/surface";
export type { BlockSurface };

// ── Page section base ─────────────────────────────────────────────────────────

/**
 * Fields common to every CMS page section (content block).
 *
 * `_key` is a CMS-assigned stable identifier for this block instance —
 * used as the platform-internal ContentBlock.id and as a React key prop.
 *
 * `variant` is an optional visual variation key authored in the CMS.
 * It maps directly to ContentBlock.variant in the platform layer, allowing
 * CMS authors to choose a block's visual appearance without changing its
 * content structure.
 *
 * Must be one of the values in BlockDefinition.allowedVariants for this block
 * type; unknown values are normalised to "default" by resolveBlockVariant().
 */
export interface PageSectionBase {
  /** CMS-assigned stable key — used as React key and ContentBlock.id */
  _key: string;
  /**
   * Optional visual variant key for this block.
   * Authored in the CMS; forwarded verbatim to ContentBlock.variant.
   * The block component normalises unknown values to "default".
   */
  variant?: string;
  /** Optional per-block background surface override. */
  surface?: BlockSurface;
  /**
   * Optional anchor ID for in-page navigation.
   * Renders as the `id` attribute on the block's wrapper element,
   * allowing direct linking via `/page#anchor-id` in CTAs.
   */
  anchorId?: string;
  /**
   * Optional block-level design tokens. `tokenSet` references a named set from
   * design.blockTokenSets (by key); `tokens` are inline curated overrides. Both
   * are forwarded verbatim to ContentBlock and scoped to this block at render.
   */
  tokenSet?: string;
  tokens?:   import("@/design-system/theme/block-token-set").CuratedBlockTokens;
}

// ── Page section data types ───────────────────────────────────────────────────

export interface TextSectionData extends PageSectionBase {
  _type: "textSection";
  heading?: string;
  /** Portable Text body — render with PortableTextRenderer */
  body?: PortableTextBlock[];
  /**
   * HTML body — set when the Statamic `body` textarea contains HTML markup.
   * When present, takes precedence over `body` (rendered with dangerouslySetInnerHTML).
   */
  htmlBody?: string;
}

export interface FeatureItemData {
  title: string;
  description: string;
  icon?: string;
}

export interface FeatureGridCtaData {
  label:    string;
  href:     string;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "link";
}

export interface FeatureGridData extends PageSectionBase {
  _type: "featureGrid";
  heading?: string;
  features?: FeatureItemData[];
  cta?: FeatureGridCtaData;
}

export interface TestimonialItemData {
  quote:    string;
  author:   string;
  role?:    string;
  company?: string;
  /** Resolved absolute URL of the author's avatar image (from the CMS asset pipeline). */
  avatar?:  string;
}

export interface TestimonialSectionData extends PageSectionBase {
  _type: "testimonialSection";
  heading?: string;
  testimonials?: TestimonialItemData[];
}

export interface FaqItemData {
  question: string;
  /**
   * Plain text string.
   * The Sanity faqSection schema defines answer as type "text" (not Portable Text).
   */
  answer:   string;
}

export interface FaqSectionData extends PageSectionBase {
  _type: "faqSection";
  heading?: string;
  items?: FaqItemData[];
}

export interface CtaSectionData extends PageSectionBase {
  _type: "ctaSection";
  title?: string;
  description?: string;
  /**
   * Structured CTA button — preferred.
   * Populated from the new `cta` inline object field in the Sanity schema.
   */
  cta?: { label?: string; href?: string };
  /** @deprecated Use `cta.label`. Present on documents not yet re-saved in Studio. */
  buttonLabel?: string;
  /** @deprecated Use `cta.href`. Present on documents not yet re-saved in Studio. */
  buttonHref?: string;
  /** Optional second CTA button (e.g. "Learn more" next to a primary "Get started"). */
  secondaryCta?: { label: string; href: string };
}

/**
 * CMS data for a form section block.
 *
 * The CMS places a form on a page by setting `formKey` to one of the
 * registered platform FormKey values ("contact" | "application" | …).
 * All other fields are optional copy/content overrides — the CMS must NOT
 * carry field definitions, validation rules, or submission routing here.
 *
 * Submit behaviour is entirely resolved from the platform-side FormDefinition
 * retrieved by getFormDefinition(formKey) at render time.
 */
export interface FormSectionData extends PageSectionBase {
  _type: "formSection";
  /**
   * Identifies the platform-side FormDefinition to render.
   * Must match a registered FormKey string; unknown keys render nothing.
   */
  formKey: string;
  /** Optional title override — rendered above the form fields */
  title?: string;
  /** Optional intro copy — rendered below the title, above the fields */
  intro?: string;
  /** Optional submit button label override */
  submitLabel?: string;
  /** Optional success message override shown after submission */
  successMessage?: string;
}

// ── Collection content source (CMS-layer mirror of platform model) ────────────
//
// These types are the CMS-side representation of the editorial content source
// setting.  They are structurally identical to the platform model in
// page-config/collection-source.ts but defined independently so that the CMS
// layer stays decoupled from page-config.
//
// The page-config mapper converts CmsContentSource → ContentSource (trivially,
// since the shapes are the same).

/**
 * Platform collection key — mirrors CollectionKey in page-config/collection-source.
 * Keep these two union types in sync.
 */
export type CmsCollectionKey =
  | "articles"
  | "vacancies"
  | "cases"
  | "news"
  | "companies"
  | "team_members";

/** Collection selection mode authored in the CMS. */
export type CmsCollectionMode = "recent" | "specific";

/** Sort direction for recent mode. */
export type CmsCollectionSortDir = "desc" | "asc";

/**
 * Collection-driven content source authored in the CMS.
 *
 * The CMS mapper converts this to a CollectionContentSource (page-config layer).
 * Field semantics match CollectionContentSource — see page-config/collection-source.ts.
 */
export interface CmsCollectionSource {
  source:        "collection";
  collection:    CmsCollectionKey;
  mode:          CmsCollectionMode;
  limit?:        number;
  sortDir?:      CmsCollectionSortDir;
  /** Ordered list of stable CMS document IDs; only used in specific mode */
  selectedIds?:  string[];
}

/**
 * Union of all CMS-authored content sources for list-like blocks.
 *
 *   { source: "manual" }     → use inline items (default/backward-compat)
 *   CmsCollectionSource      → resolve items from the CMS collection at render time
 */
export type CmsContentSource =
  | { source: "manual" }
  | CmsCollectionSource;

// ── Listing ───────────────────────────────────────────────────────────────────

/** A single item within a CMS listing or search-results section */
export interface CmsListingItem {
  /** CMS portable identifier (_key from Sanity, or any stable id) */
  _key:           string;
  /** Stable platform id; falls back to _key when absent */
  id?:            string;
  title:          string;
  href:           string;
  excerpt?:       string;
  date?:          string;
  imageUrl?:      string;
  /** Image shown on card hover — optional, falls back to imageUrl when absent */
  hoverImageUrl?: string;
  imageAlt?:      string;
  category?:      string;
  tags?:          string[];
  meta?:          { label: string; value: string }[];
}

/**
 * A single slide in a listing_slider block.
 * Either an image (media_type = "image") or a hosted/uploaded video
 * (media_type = "video").
 */
export interface CmsSliderMediaItem {
  /** Stable key from the Statamic replicator row. */
  _key:        string;
  mediaType:   "image" | "video";
  // ── Image ─────────────────────────────────────────────────────────────────
  imageUrl?:   string;
  alt?:        string;
  // ── Video ─────────────────────────────────────────────────────────────────
  videoSource?: "youtube" | "vimeo" | "upload";
  videoId?:    string;   // YouTube video ID or full watch URL
  vimeoId?:    string;   // Vimeo video ID or full vimeo.com URL
  videoUrl?:   string;   // Asset library URL for uploaded videos
  posterUrl?:  string;   // Poster/placeholder image
  autoplay?:   boolean;
  // ── Shared ─────────────────────────────────────────────────────────────────
  caption?:    string;
}

export interface ListingSectionData extends PageSectionBase {
  _type:          "listing";
  heading?:       string;
  /** Optional intro text shown below the heading. May contain HTML. */
  intro?:         string;
  items?:         CmsListingItem[];
  maxItems?:      number;
  viewAllHref?:   string;
  viewAllLabel?:  string;
  /**
   * Optional collection source config.
   * When set to a CmsCollectionSource, the block fetches items at render time.
   */
  contentSource?: CmsContentSource;
  /**
   * Media slides for the listing_slider variant.
   * Only populated when variant === "listing_slider".
   */
  mediaItems?:    CmsSliderMediaItem[];
}

/** A single option in a CMS filter control */
export interface CmsFilterOption {
  _key:   string;
  label:  string;
  value:  string;
  count?: number;
}

export interface FilterBarSectionData extends PageSectionBase {
  _type:                "filterBar";
  placeholder?:         string;
  categories?:          CmsFilterOption[];
  tags?:                CmsFilterOption[];
  sortOptions?:         CmsFilterOption[];
  showSearch?:          boolean;
  showCategoryFilter?:  boolean;
  showTagFilter?:       boolean;
}

export interface SearchResultsSectionData extends PageSectionBase {
  _type:          "searchResults";
  heading?:       string;
  emptyMessage?:  string;
  itemsPerPage?:  number;
  items?:         CmsListingItem[];
  enableSearch?:  boolean;
  enableFilter?:  boolean;
}

// ── Article / detail ──────────────────────────────────────────────────────────

export interface ArticleMetaData extends PageSectionBase {
  _type:           "articleMeta";
  title?:          string;
  publishedAt?:    string;
  updatedAt?:      string;
  author?: {
    name:       string;
    role?:      string;
    avatarUrl?: string;
    href?:      string;
  };
  category?:       string;
  tags?:           string[];
  readingTime?:    number;
  coverImageUrl?:  string;
  coverImageAlt?:  string;
  summary?:        string;
}

export interface ArticleBodyData extends PageSectionBase {
  _type:       "articleBody";
  body:        PortableTextBlock[];
  footnotes?:  string[];
}

/** A single related content teaser within a CMS relatedContent section */
export interface CmsRelatedItem {
  _key:           string;
  id?:            string;
  title:          string;
  href:           string;
  excerpt?:       string;
  imageUrl?:      string;
  /** Image shown on card hover — optional, falls back to imageUrl when absent */
  hoverImageUrl?: string;
  imageAlt?:      string;
  category?:      string;
  date?:          string;
}

export interface RelatedContentData extends PageSectionBase {
  _type:          "relatedContent";
  heading?:       string;
  items:          CmsRelatedItem[];
  maxItems?:      number;
  /**
   * Optional collection source config.
   * When set to a CmsCollectionSource, the block fetches items at render time.
   */
  contentSource?: CmsContentSource;
}

// ── Vacancy ───────────────────────────────────────────────────────────────────

export interface VacancyMetaData extends PageSectionBase {
  _type:          "vacancyMeta";
  title?:         string;
  department?:    string;
  location?:      string;
  remote?:        "on-site" | "hybrid" | "remote";
  contractType?:  "full-time" | "part-time" | "contract" | "internship" | "freelance";
  hoursPerWeek?:  string;
  salaryRange?:   string;
  startDate?:     string;
  closingDate?:   string;
  level?:         string;
}

export interface ApplyPanelData extends PageSectionBase {
  _type:          "applyPanel";
  heading?:       string;
  body?:          string;
  primaryCta?:    { label: string; href: string };
  secondaryCta?:  { label: string; href: string };
  formKey?:       string;
  closingDate?:   string;
}

// ── Search ────────────────────────────────────────────────────────────────────

/**
 * CMS data for a search block.
 *
 * The CMS places this block on any page; all search behaviour (provider
 * selection, result fetching) is platform-driven via /api/search.
 * The CMS carries only configuration/copy — never a provider reference.
 */
export interface SearchSectionData extends PageSectionBase {
  _type:              "search";
  title?:             string;
  placeholder?:       string;
  description?:       string;
  /** SearchScope[] — "pages" | "posts" | "vacancies" */
  scopes?:            string[];
  showFilters?:       boolean;
  enableInstant?:     boolean;
  maxResults?:        number;
  emptyMessage?:      string;
  noResultsMessage?:  string;
}

// ── LogoStrip ─────────────────────────────────────────────────────────────────

/** A single logo entry in a logo-strip section */
export interface CmsLogoItem {
  _key:  string;
  name:  string;
  /** URL of the logo image */
  src:   string;
  /** Optional link target for the logo */
  url?:  string;
}

export interface LogoStripSectionData extends PageSectionBase {
  _type:    "logoStrip";
  /** Optional label above the logo row, e.g. "Trusted by" */
  heading?: string;
  logos?:   CmsLogoItem[];
  // ── Display options ──────────────────────────────────────────────────────
  /** Enable the slow marquee carousel (default: true) */
  animationEnabled?: boolean;
  /** Animation speed (default: "slow") */
  speed?:            string;
  /** Render logos in greyscale */
  grayscale?:        boolean;
  /** Show company name below each logo */
  showLabels?:       boolean;
}

// ── Video ─────────────────────────────────────────────────────────────────────

/**
 * Standalone video section — a full-width or contained video embed.
 *
 * `videoUrl` is the normalised embed URL:
 *   YouTube  → https://www.youtube.com/embed/<id>
 *   Vimeo    → https://player.vimeo.com/video/<id>
 *   native   → direct URL to an mp4/webm file
 *
 * The Statamic `video_url` field accepts bare YouTube IDs (e.g. "uER64JbBd7M"),
 * full watch URLs, embed URLs, or Vimeo URLs; normalisation happens in the
 * Statamic mapper so downstream consumers always receive an embed URL.
 */
export interface VideoSectionData extends PageSectionBase {
  _type:      "video";
  videoUrl:   string;
  /** Resolved platform — set by the mapper; "native" for uploaded video files. */
  platform?:  "youtube" | "vimeo" | "native";
  title?:     string;
  posterUrl?: string;
  caption?:   string;
  autoPlay?:  boolean;
  loop?:      boolean;
}

// ── TextMedia ─────────────────────────────────────────────────────────────────

/** A CTA button inside a textMedia section */
export interface CmsTextMediaCta {
  _key:   string;
  label:  string;
  href:   string;
}

/**
 * Editorial text + media (image or video) split block.
 * Layout variants: text_media_right (default) | text_media_left | text_media_stacked
 *
 * Video source handling:
 *   "youtube" / "vimeo" — mediaUrl is the normalised embed URL; rendered as iframe
 *   "upload"            — mediaUrl is the asset CDN/storage URL; rendered as <video>
 *   undefined / "image" — mediaUrl is an image CDN URL; rendered as <img>
 */
export interface TextMediaSectionData extends PageSectionBase {
  _type:       "textMedia";
  eyebrow?:    string;
  heading?:    string;
  /** Plain-text body copy (stored as `type:"text"` in Sanity schema) */
  body?:       string;
  ctas?:       CmsTextMediaCta[];
  /** "image" or "video" — determines how mediaUrl is rendered */
  mediaType?:  "image" | "video";
  /** Primary media URL: image CDN URL, YouTube/Vimeo embed URL, or uploaded video URL */
  mediaUrl?:   string;
  mediaAlt?:   string;
  caption?:    string;
  /** For video: how the source was specified ("youtube" | "vimeo" | "upload") */
  videoSource?: "youtube" | "vimeo" | "upload";
  /** Poster/placeholder image shown before video playback starts */
  posterUrl?:  string;
  /** Start playing automatically on page load (audio muted when true) */
  autoPlay?:   boolean;
  /** Loop the video continuously */
  loop?:       boolean;
  /**
   * Optional background layer rendered behind the main media asset.
   *   "color" — solid colour fill (see mediaBgColor)
   *   "image" — decorative image / pattern (see mediaBgImageUrl)
   * Omit (or "none") for no background (default).
   * Primarily intended for use with transparent PNGs.
   */
  mediaBgType?:     "color" | "image";
  /** CSS colour value (hex, rgb, hsl, …) — used when mediaBgType = "color" */
  mediaBgColor?:    string;
  /** Background image URL — used when mediaBgType = "image" */
  mediaBgImageUrl?: string;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

/** A single stat/metric entry in a stats section */
export interface CmsStatItem {
  _key:         string;
  label:        string;
  value:        string;
  /** Optional prefix before the value, e.g. "€" or "~" */
  prefix?:      string;
  /** Optional suffix after the value, e.g. "%" or "+" */
  suffix?:      string;
  /** Optional short description below label */
  description?: string;
}

export interface StatsSectionData extends PageSectionBase {
  _type:    "stats";
  heading?: string;
  items?:   CmsStatItem[];
}

// ── Shared CTA primitive ──────────────────────────────────────────────────────

/**
 * A reusable call-to-action button authored in the CMS.
 *
 * Used wherever blocks support an array of 0–2 CTAs (about/split, contentSection,
 * teamSection, ctaSection).  `variant` controls the button style; when absent the
 * component infers it from position (first → primary, second → secondary).
 */
export interface CmsBlockCTA {
  _key?:    string;
  label:    string;
  href:     string;
  variant?: "primary" | "secondary" | "outline" | "ghost";
}

// ── About / split-media ───────────────────────────────────────────────────────

/** A single team member entry within an about section */
export interface CmsTeamMember {
  _key:       string;
  name:       string;
  role:       string;
  bio?:       string;
  imageUrl?:  string;
  /** Link to the member's profile page or LinkedIn */
  profileHref?: string;
  socials?: {
    linkedin?: string;
    twitter?:  string;
    github?:   string;
  };
}

export interface AboutSectionData extends PageSectionBase {
  _type:        "about";
  heading?:     string;
  body?:        PortableTextBlock[];
  imageUrl?:    string;
  imageAlt?:    string;
  teamMembers?: CmsTeamMember[];
  /** 0–2 CTA buttons below the body text (supported in media_right/left/full variants) */
  ctas?:        CmsBlockCTA[];
}

// ── NewsList ──────────────────────────────────────────────────────────────────

/** A single news/blog item entry in a newsList section */
export interface CmsNewsItem {
  _key:      string;
  title:     string;
  /** Absolute or root-relative URL to the article detail page */
  url:       string;
  excerpt?:  string;
  /** ISO 8601 date string */
  date?:     string;
  imageUrl?: string;
  category?: string;
}

export interface NewsListSectionData extends PageSectionBase {
  _type:          "newsList";
  heading?:       string;
  items?:         CmsNewsItem[];
  maxItems?:      number;
  /**
   * Optional collection source config.
   * When set to a CmsCollectionSource, the block fetches items at render time
   * instead of using the inline `items` array.
   */
  contentSource?: CmsContentSource;
}

// ── Careers / W6 ─────────────────────────────────────────────────────────────

/**
 * A single step authored in the CMS for a processSteps page section.
 * Mirrors ProcessStepData (document-level) but lives at section scope.
 */
export interface CmsProcessStep {
  /** Sanity array item key for stable React keying */
  _key:          string;
  /** Short step title */
  title:         string;
  /** One-sentence description of this step */
  description?:  string;
  /** Optional duration/timeframe display string, e.g. "1–2 weeks" */
  duration?:     string;
}

export interface ProcessStepsSectionData extends PageSectionBase {
  _type:    "processSteps";
  heading?: string;
  steps?:   CmsProcessStep[];
}

// ── Timeline ──────────────────────────────────────────────────────────────────

export interface CmsTimelineItem {
  /** Stable CMS-assigned key; used for React `key` props */
  _key:         string;
  /** Year or date label, e.g. "2023", "March 2025" */
  date?:        string;
  /** Milestone title */
  title:        string;
  /** Optional supporting copy */
  description?: string;

  // ── Slider-variant media (optional — ignored by non-slider layouts) ─────────
  /** "image" | "video_file" | "youtube" | "vimeo" */
  mediaType?:   "image" | "video_file" | "youtube" | "vimeo";
  /** Resolved image URL, video-file URL, or embed URL (YouTube/Vimeo player) */
  mediaUrl?:    string;
  /** Poster/thumbnail URL for video items */
  posterUrl?:   string;
  autoPlay?:    boolean;
  loop?:        boolean;
}

export interface TimelineSectionData extends PageSectionBase {
  _type:        "timeline";
  heading?:     string;
  description?: string;
  items:        CmsTimelineItem[];
}

// ── ContactSection ────────────────────────────────────────────────────────────

/** A CTA button row inside a contact section */
export interface CmsContactSectionCta {
  label: string;
  href:  string;
}

export interface ContactSectionSectionData extends PageSectionBase {
  _type:        "contactSection";
  heading?:     string;
  description?: string;
  address?:     string;
  phone?:       string;
  email?:       string;
  /** Business hours string, e.g. "Mon–Fri 09:00–17:00" */
  hours?:       string;
  /** Google Maps or similar embed URL */
  mapUrl?:      string;
  ctas?:        CmsContactSectionCta[];
}

export interface RecruiterPanelSectionData extends PageSectionBase {
  _type:      "recruiterPanel";
  heading?:   string;
  /** Recruiter full name */
  name:       string;
  role?:      string;
  bio?:       string;
  avatarUrl?: string;
  email?:     string;
  phone?:     string;
  /** Optional CTA label, e.g. "Book a call" */
  ctaLabel?:  string;
  /** Optional CTA href */
  ctaHref?:   string;
}

// ── RichText ──────────────────────────────────────────────────────────────────

export interface RichTextSectionData extends PageSectionBase {
  _type:   "richText";
  /** Portable Text body — render with PortableTextRenderer */
  body?:   PortableTextBlock[];
  /**
   * HTML body — set when the CMS Bard field is configured with `save_html: true`
   * (on-disk HTML string) or when Live Preview sends ProseMirror nodes (which the
   * mapper converts to HTML before storing here).
   *
   * Takes precedence over `body` in the rendering component: when present, the
   * component renders via `dangerouslySetInnerHTML` instead of PortableText.
   */
  htmlBody?: string;
  /**
   * Max-width constraint for the content column.
   *   narrow  — ~65ch reading-width column
   *   default — standard content-column width
   *   wide    — full container width
   */
  maxWidth?: "narrow" | "default" | "wide";
}

// ── ContentSection ────────────────────────────────────────────────────────────

/**
 * CMS data for a generic content section block.
 *
 * A simple, flexible editorial block: eyebrow + title + intro + body + optional
 * CTAs.  Use it for "About us in 3 sentences", "Our mission", or any standalone
 * prose section that does not warrant a more specialised block type.
 *
 * `maxWidth` constrains the content column width (same tokens as richText):
 *   narrow  — ~65ch reading-width column
 *   default — standard content-column width
 *   wide    — full container width
 */
export interface ContentSectionData extends PageSectionBase {
  _type:       "contentSection";
  eyebrow?:    string;
  heading?:    string;
  intro?:      string;
  body?:       PortableTextBlock[];
  ctas?:       CmsBlockCTA[];
  maxWidth?:   "narrow" | "default" | "wide";
  align?:      "left" | "center";
}

// ── TeamSection ───────────────────────────────────────────────────────────────

/** A single team member within a TeamSection */
export interface CmsTeamSectionMember {
  _key:         string;
  name:         string;
  role:         string;
  bio?:         string;
  imageUrl?:    string;
  profileHref?: string;
  socials?: {
    linkedin?: string;
    twitter?:  string;
    github?:   string;
  };
}

/**
 * CMS data for a dedicated team section block.
 *
 * Distinct from AboutSection's `team-grid` variant: TeamSection is a first-class
 * block type that can appear standalone on any page and supports richer member
 * data (profile links, social handles).
 *
 * Variants:
 *   team_grid    — 3-col card grid (default)
 *   team_compact — tight row list; avatar + name + role inline
 */
export interface TeamSectionData extends PageSectionBase {
  _type:    "teamSection";
  heading?: string;
  intro?:   string;
  members?: CmsTeamSectionMember[];
}

// ── PricingSection ────────────────────────────────────────────────────────────

/** A single pricing tier authored in the CMS */
export interface CmsPriceTier {
  _key:         string;
  name:         string;
  /** Display price string, e.g. "€49", "Free", "Custom" */
  price:        string;
  /** Billing period label, e.g. "/month", "/year" */
  period?:      string;
  description?: string;
  /** Ordered list of included features */
  features?:    string[];
  ctaLabel:     string;
  ctaHref:      string;
  highlighted?: boolean;
  /** Short badge text, e.g. "Most popular" */
  badge?:       string;
}

export interface PricingSectionData extends PageSectionBase {
  _type:       "pricingSection";
  heading?:    string;
  subheading?: string;
  tiers?:      CmsPriceTier[];
  footnote?:   string;
}

// ── Commerce / product ────────────────────────────────────────────────────────

export interface ProductItemData {
  title:        string;
  description?: string;
  price?:       string;
  badge?:       string;
  imageUrl?:    string;
  imageAlt?:    string;
  cta?: { label: string; href: string; variant?: "primary" | "secondary" | "outline" | "ghost" };
}

export interface ProductOverviewSectionData extends PageSectionBase {
  _type:       "productOverview";
  heading?:    string;
  intro?:      string;
  showPrices?: boolean;
  products?:   ProductItemData[];
  cta?: { label: string; href: string; variant?: "primary" | "secondary" | "outline" | "ghost" };
}

export interface ProductGalleryItem {
  url: string;
  alt: string;
}

export interface ProductSpecItem {
  label: string;
  value: string;
}

export interface ProductDetailSectionData extends PageSectionBase {
  _type:        "productDetail";
  title:        string;
  description?: string;
  price?:       string;
  badge?:       string;
  gallery?:     ProductGalleryItem[];
  specs?:       ProductSpecItem[];
  cta?:         { label: string; href: string; variant?: "primary" | "secondary" | "outline" | "ghost" };
  secondaryCta?: { label: string; href: string; variant?: "primary" | "secondary" | "outline" | "ghost" };
  relatedProducts?: ProductItemData[];
}

// ── CartSummary ───────────────────────────────────────────────────────────────

export interface CartSummaryCmsData extends PageSectionBase {
  _type:                "cartSummary";
  heading?:             string;
  emptyMessage?:        string;
  checkoutHref?:        string;
  continueShoppingHref?: string;
  checkoutLabel?:       string;
  continueShoppingLabel?: string;
  /** Plan id — "starter" | "growth" | "pro" */
  planId?:              string;
}

// ── CheckoutBlock ─────────────────────────────────────────────────────────────

export interface CheckoutBlockCmsData extends PageSectionBase {
  _type:           "checkoutBlock";
  heading?:        string;
  intro?:          string;
  paymentProvider?: string;
  returnHref?:     string;
  returnLabel?:    string;
  /** Plan id — "starter" | "growth" | "pro" — passed through to the signup form */
  planId?:         string;
}

// ── Quote ─────────────────────────────────────────────────────────────────────

export interface QuoteSectionData extends PageSectionBase {
  _type:        "quote";
  quote:        string;
  attribution?: string;
  /** Company, publication, or role of the attributed person */
  source?:      string;
  /** URL of the attributed person's photo — resolved by the CMS asset pipeline */
  avatarUrl?:   string;
}

// ── Floating Contact ──────────────────────────────────────────────────────────

/**
 * CMS data for a floating contact rail — sticky phone / e-mail / WhatsApp
 * buttons pinned to the side of the viewport. Placed as a content block but
 * rendered as a `position: fixed` overlay (see components/blocks/
 * FloatingContactBlock.tsx). Renders nothing when no channel is set.
 */
export interface FloatingContactSectionData extends PageSectionBase {
  _type:     "floatingContact";
  phone?:    string;
  email?:    string;
  whatsapp?: string;
  /** Which side of the viewport the rail is pinned to (default "right"). */
  side?:     "right" | "left";
}

// ── MapBlock ──────────────────────────────────────────────────────────────────

export interface MapBlockCmsData extends PageSectionBase {
  _type:     "mapBlock";
  heading?:  string;
  address?:  string;
  city?:     string;
  country?:  string;
  email?:    string;
  phone?:    string;
  embedUrl?: string;
}

// ── Context slot section ──────────────────────────────────────────────────────

/**
 * A context slot entry embedded in a page's `sections[]` array.
 *
 * Used by the Statamic CMS provider when context_slot blocks appear inside
 * the `page_blocks` Replicator alongside regular content blocks.  The mapper
 * converts each `context_slot` Replicator block into a `ContextSlotSectionData`
 * entry so that the ordering information (which slot appears where relative to
 * content blocks) is preserved in `PageData.sections[]`.
 *
 * `mapPageDataToPageConfig()` converts these entries back to
 * `ResolvedContextSlot` items when building `pageConfig.pageItems`.
 *
 * Providers that do not embed context slots in content (Sanity, Storyblok) do
 * not produce this section type — they use `PageData.contextConfig` instead and
 * the mapper places slots at their template-defined before/after positions.
 */
export interface ContextSlotSectionData {
  /** Discriminator — always "contextSlot" */
  _type:        "contextSlot";
  /** CMS-assigned stable key for this block instance (used for React key props) */
  _key:         string;
  /**
   * Which adaptive slot this entry represents.
   * Matches ContextSlotId: "hero" | "proof" | "cta" | "feature" | "conversion" | "notification"
   */
  slotId:       string;
  /** Fallback variant key to use when no decision-engine key is selected */
  variantKey?:  string;
  /** When false the slot is disabled; defaults to true (active) when absent */
  enabled?:     boolean;
}

// ── Discriminated union ───────────────────────────────────────────────────────

/** Discriminated union of all supported page section types */
export type PageSectionData =
  | TextSectionData
  | RichTextSectionData
  | FeatureGridData
  | TestimonialSectionData
  | FaqSectionData
  | CtaSectionData
  | FormSectionData
  // quote
  | QuoteSectionData
  // social proof / media
  | LogoStripSectionData
  | VideoSectionData
  | TextMediaSectionData
  | StatsSectionData
  // content
  | AboutSectionData
  | NewsListSectionData
  | ContentSectionData
  | TeamSectionData
  | ContactSectionSectionData
  | FloatingContactSectionData
  // listing / detail
  | ListingSectionData
  | FilterBarSectionData
  | SearchResultsSectionData
  | ArticleMetaData
  | ArticleBodyData
  | RelatedContentData
  | VacancyMetaData
  | ApplyPanelData
  // search
  | SearchSectionData
  | TimelineSectionData
  // careers / W6
  | ProcessStepsSectionData
  | RecruiterPanelSectionData
  // conversion / pricing
  | PricingSectionData
  // commerce / product
  | ProductOverviewSectionData
  | ProductDetailSectionData
  // cart / checkout
  | CartSummaryCmsData
  | CheckoutBlockCmsData
  | MapBlockCmsData
  // context slot placeholder (Statamic unified page_blocks model)
  | ContextSlotSectionData;

// ── Company (standalone document) ────────────────────────────────────────────

/**
 * A branch / office location belonging to a Company.
 */
export interface BranchData {
  /** Sanity array item key for stable React keying */
  _key:      string;
  /** Display name of this branch/office */
  name:      string;
  /** City name */
  city?:     string;
  /** Street address */
  address?:  string;
  /** Contact phone number for this branch */
  phone?:    string;
}

/**
 * A single key/value statistic for a Company
 * (e.g. { label: "Founded", value: "2010" }).
 */
export interface StatData {
  /** Sanity array item key for stable React keying */
  _key:   string;
  /** Short descriptive label */
  label:  string;
  /** The metric value (string to allow "500+" or "€12 M") */
  value:  string;
}

/**
 * A resolved image asset (URL + alt text).
 * Used in Company.logo, Company.images, NewsArticle.coverImage, etc.
 */
export interface CmsImageData {
  /** CDN URL of the image */
  url: string;
  /** Alt text for accessibility */
  alt: string;
}

/**
 * Minimal reference projection for Company — used inside NewsArticleData and
 * VacancyData where only display-level company info is needed.
 */
export interface CompanyRef {
  /** Sanity document _id */
  id:    string;
  /** Company display name */
  name:  string;
  /** URL slug — used to build links to the company page */
  slug:  string;
}

/**
 * Data returned by CMSProvider.getCompany() / getCompanies().
 *
 * A Company is a standalone CMS document — it is NOT a page section.
 * Page sections that display company data (e.g. an about block) receive
 * a CompanyData (or CompanyRef) via a mapper, never raw page-section fields.
 */
export interface CompanyData {
  /** Sanity document _id */
  id:            string;
  /** Company display name */
  name:          string;
  /** URL slug — e.g. "acme-corp" (no leading slash) */
  slug:          string;
  /** Logotype — resolved CDN URL + alt text */
  logo?:         CmsImageData;
  /** Short introductory paragraph shown in listings and overviews */
  description?:  string;
  /**
   * List of service/product area names, e.g. ["Staffing", "RPO", "Consulting"].
   * Ordered by importance; first item may be featured in cards.
   */
  services?:     string[];
  /** Branch / office locations */
  branches?:     BranchData[];
  /** Key metrics shown in a stats strip (e.g. founded year, headcount, revenue) */
  stats?:        StatData[];
  /** Gallery images — company office, team, etc. */
  images?:       CmsImageData[];
  /** Only published documents are returned by default queries */
  isPublished:   boolean;
}

// ── NewsArticle (standalone document) ────────────────────────────────────────

/**
 * Data returned by CMSProvider.getNewsArticle() / getNewsArticles().
 *
 * A NewsArticle is a standalone CMS document — it is NOT a page section.
 * The article detail page renders it via ArticleMetaData + ArticleBodyData
 * page-section blocks populated by a mapper.
 */
export interface NewsArticleData {
  /** Sanity document _id */
  id:               string;
  /** Article headline */
  title:            string;
  /** URL slug — e.g. "acme-acquires-rival" (no leading slash) */
  slug:             string;
  /** ISO 8601 publication date string */
  publishedAt?:     string;
  /** Hero / cover image */
  coverImage?:      CmsImageData;
  /** Portable Text article body */
  body?:            PortableTextBlock[];
  /**
   * Optional link to the Company this article is about.
   * Resolved projection — only id / name / slug are included.
   */
  relatedCompany?:  CompanyRef;
  /**
   * Editorial taxonomy tags (e.g. ["acquisition", "funding"]).
   * Used for filtering in listing sections.
   */
  tags?:            string[];
  /** Short teaser text used in listing cards; falls back to first body paragraph */
  excerpt?:         string;
  /**
   * Interest keywords (first-party behavioural signals) for interest-profile
   * scoring. Emitted as <meta name="keywords"> by the detail route so the
   * PageTracker can read them on visit. NOT SEO meta keywords.
   */
  metaKeywords?:    string[];
  /** Only published documents are returned by default queries */
  isPublished:      boolean;
}

// ── Vacancy (standalone document) ─────────────────────────────────────────────

/**
 * A step in the application / hiring process (e.g. "Interview", "Assessment").
 */
export interface ProcessStepData {
  /** Sanity array item key for stable React keying */
  _key:          string;
  /** Short step title */
  title:         string;
  /** One-sentence description of what happens in this step */
  description?:  string;
}

/**
 * Contact details for the recruiter handling a vacancy.
 */
export interface RecruiterData {
  /** Full name */
  name:       string;
  /** Job title / role */
  role?:      string;
  /** Email address for applications and queries */
  email?:     string;
  /** Direct phone number */
  phone?:     string;
  /** Profile photo */
  avatar?:    CmsImageData;
}

/**
 * Data returned by CMSProvider.getVacancy() / getVacancies().
 *
 * A Vacancy is a standalone CMS document — it is NOT a page section.
 * The vacancy detail page renders VacancyMetaData + ApplyPanelData page-section
 * blocks, populated by a mapper from this VacancyData shape.
 *
 * This type carries the full structured data.  VacancyMetaData (above) carries
 * only the fields needed by the VacancyMeta page-section component.
 */
export interface VacancyData {
  /** Sanity document _id */
  id:             string;
  /** Job title */
  title:          string;
  /** URL slug — e.g. "senior-frontend-engineer" */
  slug:           string;
  /**
   * The hiring company.
   * Resolved projection — only id / name / slug are included.
   */
  company?:       CompanyRef;
  /** City, region, or country string (e.g. "Amsterdam", "Remote — EU") */
  location?:      string;
  /** Remote work arrangement */
  remote?:        "on-site" | "hybrid" | "remote";
  /** Employment type */
  contractType?:  "full-time" | "part-time" | "contract" | "internship" | "freelance";
  /** Department or team name */
  department?:    string;
  /** Hours per week as a display string (e.g. "32–40 uur") */
  hoursPerWeek?:  string;
  /** Salary range as a display string (e.g. "€4 000 – €5 500 / maand") */
  salaryRange?:   string;
  /** Desired or latest start date as ISO 8601 string */
  startDate?:     string;
  /** Application closing date as ISO 8601 string */
  closingDate?:   string;
  /**
   * Rich-text job description / role summary.
   * Rendered with PortableTextRenderer on the vacancy detail page.
   */
  description?:   PortableTextBlock[];
  /**
   * List of required / preferred skills and qualifications.
   * Plain strings rather than Portable Text — kept simple for easy scanning.
   */
  requirements?:  string[];
  /** Ordered list of application / hiring process steps */
  processSteps?:  ProcessStepData[];
  /** Recruiter responsible for this vacancy */
  recruiter?:     RecruiterData;
  /**
   * Interest keywords (first-party behavioural signals) for interest-profile
   * scoring. Emitted as <meta name="keywords"> by the detail route. NOT SEO.
   */
  metaKeywords?:  string[];
  /** Only published documents are returned by default queries */
  isPublished:    boolean;
}

// ── Page ──────────────────────────────────────────────────────────────────────

/**
 * CMS-level configuration for a single context slot.
 *
 * The CMS may declare which variant keys are valid for a slot and/or provide
 * a fallback variant key to use when the decision engine returns null.
 *
 * IMPORTANT: This is advisory metadata only.  The decision engine always
 * owns the final variant selection.  The CMS must NOT dictate which variant
 * is shown to a specific visitor.
 */
export interface CmsContextSlotConfig {
  /**
   * Variant keys the CMS author considers valid for this slot.
   * The decision engine may serve any subset (or ignore this list entirely).
   * Useful for CMS-side validation: warn when the engine selects an unknown key.
   */
  readonly allowedVariantKeys?: readonly string[];
  /**
   * Fallback variant key to use if the decision engine returns null for this
   * slot and the slot is required.  Applied by the assembler — never by the
   * decision engine itself.
   *
   * Also used directly by static CMS pages (app/[slug]/page.tsx) where no
   * decision engine is involved — the fallback becomes the active variant key.
   */
  readonly fallbackVariantKey?: string;
}

/**
 * CMS-level context configuration keyed by context slot ID.
 *
 * Maps each named context slot to its advisory config.
 * Slots absent from this map carry no CMS-level constraints.
 *
 * Statamic pages typically do NOT populate this field — they embed
 * `ContextSlotSectionData` entries directly in `sections[]` instead,
 * preserving the editor-authored position of each slot relative to content.
 * This field is primarily used by Sanity and Storyblok providers.
 */
export interface CmsPageContextConfig {
  readonly hero?:         CmsContextSlotConfig;
  readonly proof?:        CmsContextSlotConfig;
  readonly cta?:          CmsContextSlotConfig;
  readonly feature?:      CmsContextSlotConfig;
  readonly conversion?:   CmsContextSlotConfig;
  readonly notification?: CmsContextSlotConfig;
}

/**
 * Data returned by CMSProvider.getPageBySlug().
 *
 * Sections carry a `_type` discriminator so the rendering layer can switch
 * on type and render the appropriate section component.
 */
export interface PageData {
  /** Sanity _id */
  id: string;
  /** Internal page title (used in <title> fallback) */
  title: string;
  /** URL slug — e.g. "about-us" (no leading slash) */
  slug: string;
  /** Per-page SEO title override */
  seoTitle?: string;
  /** Per-page SEO meta description override */
  seoDescription?: string;
  /** SEO robots directives — no-index and/or no-follow flags */
  robots?: { noindex?: boolean; nofollow?: boolean };
  /** Canonical URL override (absolute or root-relative) */
  canonicalUrl?: string;
  /** Open Graph / social title */
  ogTitle?: string;
  /** Open Graph / social description */
  ogDescription?: string;
  /** Open Graph / social image absolute URL */
  ogImage?: string;
  /**
   * Interest-profile keywords for this page.
   *
   * Authored in the CMS and included in the HTML `<meta name="keywords">` tag.
   * PageTracker reads these at runtime and merges them with the static
   * `page-meta-map` keywords so the scoring engine can build interest profiles
   * from CMS-level content signals in addition to URL-pattern signals.
   */
  metaKeywords?: string[];
  /** Ordered array of page section blocks */
  sections: PageSectionData[];
  /**
   * Template key that identifies the slot layout for this page.
   *
   * Must be one of the keys in the platform TEMPLATE_REGISTRY:
   *   "marketing-page"  — Hero + Proof + CTA context slots
   *   "landing-page"    — Hero + CTA context slots (no proof)
   *   "article-page"    — No context slots; pure content
   *
   * When absent the mapper infers the template from contextConfig:
   *   any hero/proof/cta config present → "marketing-page"
   *   no context config                 → "article-page"
   */
  templateKey?: string;
  /**
   * Advisory context-slot configuration authored in the CMS.
   *
   * Declares allowedVariantKeys and fallbackVariantKey per slot (hero/proof/cta).
   * On CMS-driven static pages (app/[slug]/page.tsx), fallbackVariantKey is used
   * directly as the active variant key — no decision engine is involved.
   * On adaptive pages (homepage), the decision engine overrides these hints.
   *
   * The CMS must NOT use this field to dictate which variant a specific visitor
   * sees — that is always the decision engine's responsibility.
   */
  contextConfig?: CmsPageContextConfig;
}
