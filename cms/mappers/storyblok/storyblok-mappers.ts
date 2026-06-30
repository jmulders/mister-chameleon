/**
 * Storyblok → Internal Type Mappers
 *
 * Pure functions that translate raw Storyblok story content objects into the
 * internal app content types (HeroBlockData, ProofBlockData, CTABlockData,
 * PageData).
 *
 * ─── Why a separate mapper layer? ────────────────────────────────────────────
 *
 *   Storyblok field names use snake_case (cta_label, cta_href, is_active)
 *   while internal app types use camelCase nested objects (cta: { label, href }).
 *   This layer is the single place where that translation lives — neither the
 *   provider nor the components know about Storyblok's naming conventions.
 *
 *   Renaming a Storyblok field only requires a mapper change, not a cascade
 *   through components or page code.
 *
 * ─── is_active handling ──────────────────────────────────────────────────────
 *
 *   The `is_active` field is checked by StoryblokProvider BEFORE the mapper
 *   is called — inactive stories return null at the provider level and never
 *   reach these functions. The field is included in the raw types for
 *   documentation completeness but is not used inside the mappers themselves.
 *
 * ─── Mapping tables ──────────────────────────────────────────────────────────
 *
 *   StoryblokHeroContent     →  HeroBlockData
 *   ──────────────────────      ──────────────────────────────
 *   key                     →  id
 *   title                   →  title
 *   subtitle                →  subtitle
 *   ctas[].label            →  ctas[].label   (preferred)
 *   ctas[].href             →  ctas[].href
 *   ctas[].variant          →  ctas[].variant
 *   cta_label               →  cta.label      (legacy fallback)
 *   cta_href                →  cta.href       (legacy fallback)
 *   tag                     →  tag
 *
 *   StoryblokProofContent    →  ProofBlockData
 *   ──────────────────────      ──────────────────────────
 *   key                     →  id
 *   title                   →  title
 *   items[].title           →  items[].title
 *   items[].text            →  items[].text
 *   (items[]._uid skipped)
 *
 *   StoryblokCTAContent      →  CTABlockData
 *   ──────────────────────      ──────────────────────────
 *   key                     →  id
 *   title                   →  title
 *   text                    →  text
 *   cta_label               →  cta.label
 *   cta_href                →  cta.href
 */

import type { HeroBlockData, HeroBannerMedia, ProofBlockData, CTABlockData, FeatureBlockData, ConversionBlockData, NotificationBlockData, AdaptiveVariantContent, AdaptiveBlockData, PageData, PageSectionData, PortableTextBlock } from "../../types";
import type {
  StoryblokHeroContent,
  StoryblokHeroMedia,
  StoryblokProofContent,
  StoryblokCTAContent,
  StoryblokFeatureContent,
  StoryblokConversionContent,
  StoryblokNotificationContent,
} from "../../queries/storyblok";
import type {
  StoryblokAdaptiveVariantContent,
  StoryblokAdaptiveBlockContent,
} from "../../queries/storyblok/adaptive-block-queries";

// ── Hero media helper ─────────────────────────────────────────────────────────

/**
 * Translate the flat Storyblok media object into the HeroBannerMedia union.
 * Returns undefined for absent / "none" / incomplete media (safe fallback).
 */
function mapStoryblokHeroMedia(raw: StoryblokHeroMedia | null | undefined): HeroBannerMedia | undefined {
  if (!raw || !raw.media_type || raw.media_type === "none") return undefined;

  if (raw.media_type === "image") {
    const url = raw.media_image?.filename;
    if (!url) return undefined;
    return { kind: "image", url, alt: raw.media_image?.alt ?? "" };
  }

  if (raw.media_type === "video") {
    if (!raw.video_source) return undefined;

    if (raw.video_source === "upload") {
      const url = raw.video_file?.filename;
      if (!url) return undefined;
      return {
        kind:  "video",
        video: {
          source:   "upload",
          url,
          poster:   raw.video_poster?.filename ?? undefined,
          autoplay: raw.video_autoplay,
          muted:    raw.video_muted,
          loop:     raw.video_loop,
          controls: raw.video_controls,
        },
      };
    }

    if (raw.video_source === "youtube") {
      if (!raw.video_id) return undefined;
      return { kind: "video", video: { source: "youtube", videoId: raw.video_id } };
    }

    if (raw.video_source === "vimeo") {
      if (!raw.video_id) return undefined;
      return { kind: "video", video: { source: "vimeo", videoId: raw.video_id } };
    }
  }

  return undefined;
}

// ── Hero mapper ───────────────────────────────────────────────────────────────

/**
 * Translate a Storyblok heroVariant story content object into a HeroBlockData.
 *
 * @param content  The story's `content` field from StoryblokClient.fetchStory().
 * @returns        A HeroBlockData ready for the experience composer.
 */
export function mapStoryblokHero(content: StoryblokHeroContent): HeroBlockData {
  // Prefer the new ctas array; fall back to the legacy flat fields for
  // stories authored before the ctas array was added to the component.
  const ctas: HeroBlockData["ctas"] =
    content.ctas && content.ctas.length > 0
      ? content.ctas.map((c) => ({
          label:   c.label,
          href:    c.href,
          variant: c.variant,
        }))
      : content.cta_label
        ? [{ label: content.cta_label, href: content.cta_href ?? "" }]
        : [];

  return {
    id:            content.key,
    layoutVariant: content.layout_variant,
    contentAlign:  content.content_align,
    title:         content.title,
    subtitle:      content.subtitle,
    ctas,
    tag:           content.tag,
    media:         mapStoryblokHeroMedia(content.media),
  };
}

// ── Proof mapper ──────────────────────────────────────────────────────────────

/**
 * Translate a Storyblok proofVariant story content object into a ProofBlockData.
 *
 * The `items` field is normalised with a `?? []` fallback because Storyblok
 * may omit an empty Blocks array field from the CDN response.
 *
 * @param content  The story's `content` field from StoryblokClient.fetchStory().
 * @returns        A ProofBlockData ready for the experience composer.
 */
export function mapStoryblokProof(content: StoryblokProofContent): ProofBlockData {
  return {
    id:    content.key,
    title: content.title,
    items: (content.items ?? []).map((item) => ({
      title: item.title,
      text:  item.text,
    })),
  };
}

// ── CTA mapper ────────────────────────────────────────────────────────────────

/**
 * Translate a Storyblok ctaVariant story content object into a CTABlockData.
 *
 * @param content  The story's `content` field from StoryblokClient.fetchStory().
 * @returns        A CTABlockData ready for the experience composer.
 */
export function mapStoryblokCTA(content: StoryblokCTAContent): CTABlockData {
  return {
    id:    content.key,
    title: content.title,
    text:  content.text,
    cta: {
      label: content.cta_label,
      href:  content.cta_href,
    },
  };
}

// ── Feature mapper ────────────────────────────────────────────────────────────

/**
 * Translate a Storyblok feature_variant story content object into a FeatureBlockData.
 *
 * @param content  The story's `content` field from StoryblokClient.fetchStory().
 * @returns        A FeatureBlockData ready for the experience composer.
 */
export function mapStoryblokFeature(content: StoryblokFeatureContent): FeatureBlockData {
  return {
    id:            content.key,
    layoutVariant: content.layout_variant,
    title:         content.title,
    subtitle:      content.subtitle,
    items: (content.items ?? []).map((item) => ({
      title: item.title,
      body:  item.body,
      icon:  item.icon,
    })),
  };
}

// ── Conversion mapper ─────────────────────────────────────────────────────────

/**
 * Translate a Storyblok conversion_variant story content object into a ConversionBlockData.
 *
 * @param content  The story's `content` field from StoryblokClient.fetchStory().
 * @returns        A ConversionBlockData ready for the experience composer.
 */
export function mapStoryblokConversion(content: StoryblokConversionContent): ConversionBlockData {
  return {
    id:            content.key,
    layoutVariant: content.layout_variant,
    title:         content.title,
    text:          content.text,
    ctas: (content.ctas ?? []).map((c) => ({
      label:   c.label,
      href:    c.href,
      variant: c.variant,
    })),
    formKey:       content.form_key,
    urgencyLabel:  content.urgency_label,
  };
}

// ── Notification mapper ───────────────────────────────────────────────────────

/**
 * Translate a Storyblok notification_variant story content object into a NotificationBlockData.
 *
 * @param content  The story's `content` field from StoryblokClient.fetchStory().
 * @returns        A NotificationBlockData ready for the experience composer.
 */
export function mapStoryblokNotification(content: StoryblokNotificationContent): NotificationBlockData {
  // auto_dismiss_ms is stored as text in Storyblok but typed as number internally.
  const autoDismissRaw = content.auto_dismiss_ms;
  const autoDismissMs  = autoDismissRaw
    ? (typeof autoDismissRaw === "number" ? autoDismissRaw : parseInt(String(autoDismissRaw), 10) || 0)
    : undefined;

  return {
    id:            content.key,
    message:       content.message,
    severity:      content.severity,
    ctaLabel:      content.cta_label,
    ctaHref:       content.cta_href,
    position:      content.position,
    dismissible:   content.dismissible,
    autoDismissMs: autoDismissMs && autoDismissMs > 0 ? autoDismissMs : undefined,
  };
}

// ── Adaptive block helpers ────────────────────────────────────────────────────

/**
 * Vertaalt een Storyblok AdaptiveVariantContent object naar het interne AdaptiveVariantContent type.
 *
 * Hergebruikt dezelfde media-mapping logica als mapStoryblokHeroMedia voor consistentie.
 *
 * @param raw  Het ruwe variant content object uit de Storyblok story.
 * @returns    Een AdaptiveVariantContent klaar voor de rendering-laag.
 */
export function mapStoryblokAdaptiveVariantContent(raw: StoryblokAdaptiveVariantContent): AdaptiveVariantContent {
  return {
    title:         raw.title,
    subtitle:      raw.subtitle,
    tag:           raw.tag,
    ctas:          (raw.ctas ?? []).map((c) => ({
      label:   c.label,
      href:    c.href,
      variant: c.variant,
    })),
    layoutVariant: raw.layout_variant,
    contentAlign:  raw.content_align,
    media:         mapStoryblokHeroMedia({
      media_type:     raw.media_type,
      media_image:    raw.media_image ?? undefined,
      video_source:   raw.video_source,
      video_file:     raw.video_file ?? undefined,
      video_poster:   raw.video_poster ?? undefined,
      video_autoplay: raw.video_autoplay,
      video_muted:    raw.video_muted,
      video_loop:     raw.video_loop,
      video_controls: raw.video_controls,
      video_id:       raw.video_id,
    }),
  };
}

// ── Adaptive block mapper ─────────────────────────────────────────────────────

/**
 * Vertaalt een Storyblok adaptive_block story content object naar een AdaptiveBlockData.
 *
 * Mapping:
 *   storyId      →  id
 *   block_key    →  key
 *   is_active    →  isActive
 *   content      →  defaultVariant (via mapStoryblokAdaptiveVariantContent)
 *
 * StoryblokAdaptiveBlockContent extends StoryblokAdaptiveVariantContent — alle
 * content-velden staan flat op de story zelf, dus content kan direct worden
 * doorgegeven aan mapStoryblokAdaptiveVariantContent.
 *
 * @param storyId  De Storyblok story ID — wordt gebruikt als interne id.
 * @param content  Het `content` veld van de Storyblok story.
 * @returns        Een AdaptiveBlockData klaar voor de experience composer.
 */
export function mapStoryblokAdaptiveBlock(storyId: string, content: StoryblokAdaptiveBlockContent): AdaptiveBlockData {
  return {
    id:               storyId,
    key:              content.block_key,
    tenantId:         undefined,
    isActive:         content.is_active,
    defaultVariant:   mapStoryblokAdaptiveVariantContent(content),
    adaptiveVariants: [],
  };
}

// ── Page mapper ───────────────────────────────────────────────────────────────

/**
 * Raw shape of a single section block inside a Storyblok page story.
 *
 * All fields beyond `_uid` and `component` are component-specific; we keep
 * them as `unknown` and cast safely inside `mapStoryblokSection`.
 */
export interface StoryblokSectionRaw {
  _uid:      string;
  component: string;
  [key: string]: unknown;
}

/** Raw shape of the `content` field in a Storyblok page story. */
export interface StoryblokPageContent {
  title?:            string;
  template?:         string;
  seo_title?:        string;
  seo_description?:  string;
  meta_keywords?:    string[] | string;
  sections?:         StoryblokSectionRaw[];
}

/**
 * Convert a plain-string body field (as stored in Storyblok) into a minimal
 * PortableText array that the PortableTextRenderer can render.
 *
 * Multi-paragraph strings (separated by "\n\n") are split into separate blocks.
 */
function bodyToPortableText(raw: unknown): PortableTextBlock[] {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(/\n\n+/)
    .map((text, i) => ({
      _type: "block" as const,
      _key:  `b${i}`,
      style: "normal" as const,
      markDefs: [] as [],
      children: [{ _type: "span" as const, _key: `s${i}`, text: text.trim(), marks: [] as [] }],
    }))
    .filter((b) => b.children[0].text.length > 0);
}

/** Coerce a raw array field to typed objects, dropping non-object entries. */
function rawArray<T extends object>(raw: unknown): T[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is T => typeof item === "object" && item !== null);
}

/**
 * Map a single Storyblok section block to a `PageSectionData` union member.
 *
 * Returns `undefined` for unknown `component` values — these are filtered out
 * in `mapStoryblokPage` so `PageData.sections` stays typed.
 *
 * ─── Mapping tables ──────────────────────────────────────────────────────────
 *
 *   Storyblok component    →  PageSectionData _type
 *   ──────────────────────    ─────────────────────────────
 *   textSection            →  textSection
 *   contentSection         →  contentSection
 *   featureGrid            →  featureGrid
 *   testimonialSection     →  testimonialSection
 *   processSteps           →  processSteps
 *   formSection            →  formSection
 *   faqSection             →  faqSection
 */
function mapStoryblokSection(raw: StoryblokSectionRaw): PageSectionData | undefined {
  const key = raw._uid;

  switch (raw.component) {

    case "textSection":
      return {
        _type:   "textSection",
        _key:    key,
        variant: typeof raw.variant === "string" ? raw.variant : undefined,
        heading: typeof raw.heading === "string" ? raw.heading : undefined,
        body:    bodyToPortableText(raw.body),
      };

    case "contentSection":
      return {
        _type:   "contentSection",
        _key:    key,
        eyebrow: typeof raw.eyebrow   === "string" ? raw.eyebrow   : undefined,
        heading: typeof raw.heading   === "string" ? raw.heading   : undefined,
        intro:   typeof raw.intro     === "string" ? raw.intro     : undefined,
        body:    bodyToPortableText(raw.body),
        ctas:    rawArray<{ label?: string; href?: string }>(raw.ctas)
          .filter((c): c is { label: string; href: string } =>
            typeof c.label === "string" && typeof c.href === "string",
          )
          .map((c) => ({ label: c.label, href: c.href, variant: undefined as undefined })),
        align:    undefined,
        maxWidth: undefined,
      };

    case "featureGrid":
      return {
        _type:    "featureGrid",
        _key:     key,
        variant:  typeof raw.variant === "string" ? raw.variant : undefined,
        heading:  typeof raw.heading === "string" ? raw.heading : undefined,
        features: rawArray<{ title?: string; description?: string; icon?: string }>(raw.features).map((f) => ({
          title:       f.title       ?? "",
          description: f.description ?? "",
          icon:        f.icon        ?? undefined,
        })),
        cta: (typeof raw.cta_label === "string" && typeof raw.cta_href === "string")
          ? { label: raw.cta_label, href: raw.cta_href }
          : undefined,
      };

    case "testimonialSection":
      return {
        _type:        "testimonialSection",
        _key:         key,
        variant:      typeof raw.variant === "string" ? raw.variant : undefined,
        heading:      typeof raw.heading === "string" ? raw.heading : undefined,
        testimonials: rawArray<{
          quote?: string; author?: string; role?: string; company?: string; avatarUrl?: string;
        }>(raw.testimonials).map((t) => ({
          quote:     t.quote     ?? "",
          author:    t.author    ?? "",
          role:      t.role      ?? undefined,
          company:   t.company   ?? undefined,
          avatarUrl: t.avatarUrl ?? undefined,
        })),
      };

    case "processSteps": {
      type RawStep = { title?: string; description?: string; duration?: string };
      return {
        _type:   "processSteps",
        _key:    key,
        variant: typeof raw.variant === "string" ? raw.variant : undefined,
        heading: typeof raw.heading === "string" ? raw.heading : undefined,
        steps:   rawArray<RawStep>(raw.steps).map((s) => ({
          _key:        s.title ?? "",
          title:       s.title       ?? "",
          description: s.description ?? "",
          duration:    s.duration    ?? undefined,
        })),
      };
    }

    case "formSection":
      return {
        _type:       "formSection",
        _key:        key,
        formKey:     typeof raw.form_key === "string" ? raw.form_key : "contact",
        title:       typeof raw.title   === "string" ? raw.title   : undefined,
        intro:       typeof raw.intro   === "string" ? raw.intro   : undefined,
        submitLabel: undefined,
      };

    case "faqSection":
      return {
        _type:   "faqSection",
        _key:    key,
        variant: typeof raw.variant === "string" ? raw.variant : undefined,
        heading: typeof raw.heading === "string" ? raw.heading : undefined,
        items:   rawArray<{ question?: string; answer?: string }>(raw.items).map((q) => ({
          question: q.question ?? "",
          answer:   q.answer   ?? "",
        })),
      };

    // ── Richer section types ───────────────────────────────────────────────────

    case "richText":
      return {
        _type:    "richText",
        _key:     key,
        body:     bodyToPortableText(raw.body),
        maxWidth: typeof raw.max_width === "string" ? (raw.max_width as "narrow" | "default" | "wide") : undefined,
      };

    case "logoStrip":
      return {
        _type:             "logoStrip",
        _key:              key,
        heading:           typeof raw.heading === "string" ? raw.heading : undefined,
        logos:             rawArray<{ name?: string; image_url?: string; url?: string }>(raw.logos).map((l, i) => ({
          _key: String(i),
          name: l.name     ?? "",
          src:  l.image_url ?? "",
          url:  l.url       ?? undefined,
        })),
        animationEnabled:  typeof raw.animation_enabled === "boolean" ? raw.animation_enabled : true,
        grayscale:         typeof raw.grayscale === "boolean" ? raw.grayscale : false,
        showLabels:        typeof raw.show_labels === "boolean" ? raw.show_labels : false,
      };

    case "textMedia":
      return {
        _type:     "textMedia",
        _key:      key,
        eyebrow:   typeof raw.eyebrow    === "string" ? raw.eyebrow    : undefined,
        heading:   typeof raw.heading    === "string" ? raw.heading    : undefined,
        body:      typeof raw.body       === "string" ? raw.body       : undefined,
        mediaType: (raw.media_type === "video" ? "video" : "image") as "image" | "video",
        mediaUrl:  typeof raw.media_url  === "string" ? raw.media_url  : undefined,
        mediaAlt:  typeof raw.media_alt  === "string" ? raw.media_alt  : undefined,
        caption:   typeof raw.caption    === "string" ? raw.caption    : undefined,
        ctas:      rawArray<{ _uid?: string; label?: string; href?: string }>(raw.ctas)
          .filter((c): c is { label: string; href: string } =>
            typeof c.label === "string" && typeof c.href === "string",
          )
          .map((c, i) => ({ _key: String(i), label: c.label, href: c.href })),
      };

    case "stats":
      return {
        _type:   "stats",
        _key:    key,
        heading: typeof raw.heading === "string" ? raw.heading : undefined,
        items:   rawArray<{ _uid?: string; label?: string; value?: string; prefix?: string; suffix?: string; description?: string }>(raw.items)
          .map((s, i) => ({
            _key:        s._uid ?? String(i),
            label:       s.label       ?? "",
            value:       s.value       ?? "",
            prefix:      s.prefix      ?? undefined,
            suffix:      s.suffix      ?? undefined,
            description: s.description ?? undefined,
          })),
      };

    case "about":
      return {
        _type:    "about",
        _key:     key,
        heading:  typeof raw.heading   === "string" ? raw.heading   : undefined,
        body:     bodyToPortableText(raw.body),
        imageUrl: typeof raw.image_url === "string" ? raw.image_url : undefined,
        imageAlt: typeof raw.image_alt === "string" ? raw.image_alt : undefined,
        ctas:     rawArray<{ _uid?: string; label?: string; href?: string; variant?: string }>(raw.ctas)
          .filter((c): c is { label: string; href: string; variant?: string } =>
            typeof c.label === "string" && typeof c.href === "string",
          )
          .map((c, i) => ({ _key: String(i), label: c.label, href: c.href, variant: c.variant as "primary" | "secondary" | "outline" | "ghost" | undefined })),
      };

    case "teamSection":
      return {
        _type:   "teamSection",
        _key:    key,
        heading: typeof raw.heading === "string" ? raw.heading : undefined,
        intro:   typeof raw.intro   === "string" ? raw.intro   : undefined,
        members: rawArray<{ _uid?: string; name?: string; role?: string; bio?: string; image_url?: string; profile_href?: string }>(raw.members)
          .map((m, i) => ({
            _key:        m._uid ?? String(i),
            name:        m.name        ?? "",
            role:        m.role        ?? "",
            bio:         m.bio         ?? undefined,
            imageUrl:    m.image_url   ?? undefined,
            profileHref: m.profile_href ?? undefined,
          })),
      };

    case "newsList":
      return {
        _type:    "newsList",
        _key:     key,
        heading:  typeof raw.heading === "string" ? raw.heading : undefined,
        maxItems: typeof raw.max_items === "number" ? raw.max_items : undefined,
        items:    rawArray<{ _uid?: string; title?: string; url?: string; excerpt?: string; date?: string; image_url?: string; category?: string }>(raw.items)
          .map((n, i) => ({
            _key:     n._uid ?? String(i),
            title:    n.title    ?? "",
            url:      n.url      ?? "#",
            excerpt:  n.excerpt  ?? undefined,
            date:     n.date     ?? undefined,
            imageUrl: n.image_url ?? undefined,
            category: n.category  ?? undefined,
          })),
      };

    case "ctaSection":
      return {
        _type:       "ctaSection",
        _key:        key,
        title:       typeof raw.title       === "string" ? raw.title       : undefined,
        description: typeof raw.description === "string" ? raw.description : undefined,
        cta: (typeof raw.cta_label === "string" && typeof raw.cta_href === "string")
          ? { label: raw.cta_label, href: raw.cta_href }
          : undefined,
      };

    case "pricingSection": {
      type RawTier = { _uid?: string; name?: string; price?: string; period?: string; description?: string; features?: string[]; cta_label?: string; cta_href?: string; highlighted?: boolean; badge?: string };
      return {
        _type:      "pricingSection",
        _key:       key,
        heading:    typeof raw.heading    === "string" ? raw.heading    : undefined,
        subheading: typeof raw.subheading === "string" ? raw.subheading : undefined,
        footnote:   typeof raw.footnote   === "string" ? raw.footnote   : undefined,
        tiers:      rawArray<RawTier>(raw.tiers).map((t, i) => ({
          _key:         t._uid ?? String(i),
          name:         t.name        ?? "",
          price:        t.price       ?? "",
          period:       t.period      ?? undefined,
          description:  t.description ?? undefined,
          features:     Array.isArray(t.features)
            ? (t.features as unknown[]).filter((f): f is string => typeof f === "string")
            : typeof t.features === "string" ? (t.features as string).split("\n").map((s: string) => s.trim()).filter(Boolean) : [],
          ctaLabel:     t.cta_label   ?? "Get started",
          ctaHref:      t.cta_href    ?? "#",
          highlighted:  t.highlighted ?? false,
          badge:        t.badge       ?? undefined,
        })),
      };
    }

    case "mapBlock":
      return {
        _type:    "mapBlock",
        _key:     key,
        heading:  typeof raw.heading  === "string" ? raw.heading  : undefined,
        address:  typeof raw.address  === "string" ? raw.address  : undefined,
        city:     typeof raw.city     === "string" ? raw.city     : undefined,
        country:  typeof raw.country  === "string" ? raw.country  : undefined,
        email:    typeof raw.email    === "string" ? raw.email    : undefined,
        phone:    typeof raw.phone    === "string" ? raw.phone    : undefined,
        embedUrl: typeof raw.embed_url === "string" ? raw.embed_url : undefined,
      };

    // ── Entity / article detail sections ──────────────────────────────────────

    case "articleMeta":
      return {
        _type:        "articleMeta",
        _key:         key,
        title:        typeof raw.title       === "string" ? raw.title       : undefined,
        publishedAt:  typeof raw.published_at === "string" ? raw.published_at : undefined,
        category:     typeof raw.category    === "string" ? raw.category    : undefined,
        readingTime:  typeof raw.reading_time === "number" ? raw.reading_time : undefined,
        coverImageUrl: typeof raw.cover_image_url === "string" ? raw.cover_image_url : undefined,
        coverImageAlt: typeof raw.cover_image_alt === "string" ? raw.cover_image_alt : undefined,
        author: (typeof raw.author_name === "string" && raw.author_name)
          ? { name: raw.author_name as string, role: typeof raw.author_role === "string" ? raw.author_role : undefined }
          : undefined,
      };

    case "articleBody":
      return {
        _type:     "articleBody",
        _key:      key,
        body:      bodyToPortableText(raw.body),
        footnotes: Array.isArray(raw.footnotes)
          ? (raw.footnotes as unknown[]).filter((f): f is string => typeof f === "string")
          : undefined,
      };

    case "relatedContent":
      return {
        _type:   "relatedContent",
        _key:    key,
        heading: typeof raw.heading === "string" ? raw.heading : undefined,
        items:   rawArray<{ _uid?: string; title?: string; href?: string; excerpt?: string; imageUrl?: string; category?: string }>(raw.items)
          .map((item, i) => ({
            _key:     item._uid ?? String(i),
            title:    item.title    ?? "",
            href:     item.href     ?? "#",
            excerpt:  item.excerpt  ?? undefined,
            imageUrl: item.imageUrl ?? undefined,
            category: item.category ?? undefined,
          })),
      };

    case "listing":
      return {
        _type:         "listing",
        _key:          key,
        heading:       typeof raw.heading === "string" ? raw.heading : undefined,
        contentSource: { source: "manual" } as const,
        items:         [],
      };

    case "filterBar": {
      type RawOption = { _uid?: string; value?: string; label?: string };
      const mapOptions = (raw2: unknown) =>
        rawArray<RawOption>(raw2)
          .filter((o): o is { value: string; label: string } => typeof o.value === "string" && typeof o.label === "string")
          .map((o, i) => ({ _key: (o as RawOption)._uid ?? String(i), value: o.value, label: o.label }));
      return {
        _type:      "filterBar",
        _key:       key,
        categories: mapOptions(raw.categories),
        tags:       mapOptions(raw.tags),
      };
    }

    default:
      return undefined;
  }
}

/**
 * Map a Storyblok page story's `content` field to a `PageData` object.
 *
 * The `slug` parameter is used as a fallback for `PageData.id` when the
 * content object does not carry an explicit id.
 *
 * Unknown section `component` values are silently filtered out — the page
 * still renders with all recognised sections intact.
 *
 * @param content  The `content` field from a Storyblok story fetched via
 *                 StoryblokClient.fetchStory().
 * @param slug     The story's slug — used as `PageData.id`.
 */
export function mapStoryblokPage(content: StoryblokPageContent, slug: string): PageData {
  return {
    id:              slug,
    title:           content.title         ?? slug,
    slug,
    templateKey:     content.template      ?? "detail-page",
    seoTitle:        content.seo_title        ?? undefined,
    seoDescription:  content.seo_description  ?? undefined,
    metaKeywords:    Array.isArray(content.meta_keywords) && content.meta_keywords.length
                       ? (content.meta_keywords as string[])
                       : undefined,
    sections: (content.sections ?? [])
      .map(mapStoryblokSection)
      .filter((s): s is PageSectionData => s !== undefined),
  };
}
