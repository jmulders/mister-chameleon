/**
 * Statamic → Internal Type Mappers
 *
 * Pure functions that translate raw Statamic entry content objects into the
 * internal app content types (HeroBlockData, ProofBlockData, CTABlockData).
 *
 * ─── Why a separate mapper layer? ────────────────────────────────────────
 *
 *   Statamic field names use snake_case (cta_label, cta_href, is_active)
 *   while internal app types use camelCase nested objects (cta: { label, href }).
 *   This layer is the single place where that translation lives — neither the
 *   provider nor the components know about Statamic's naming conventions.
 *
 *   Renaming a Statamic field only requires a mapper change, not a cascade
 *   through components or page code.
 *
 * ─── is_active handling ──────────────────────────────────────────────────
 *
 *   The `is_active` field is checked by StatamicProvider BEFORE the mapper
 *   is called — inactive entries return null at the provider level and never
 *   reach these functions. The field is included in the raw types for
 *   documentation completeness but is not used inside the mappers themselves.
 *
 * ─── Mapping tables ────────────────────────────────────────────────────────
 *
 *   StatamicHeroEntry       →  HeroBlockData
 *   ──────────────────          ──────────────────────────────
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
 *   StatamicProofEntry      →  ProofBlockData
 *   ───────────────────         ──────────────────────
 *   key                     →  id
 *   title                   →  title
 *   (items??[]).map(...)    →  items (see item mapping below)
 *
 *   StatamicProofItem       →  ProofBlockData.items[n]
 *   ────────────────────        ────────────────────────
 *   title                   →  title
 *   text                    →  text
 *
 *   StatamicCTAEntry        →  CTABlockData
 *   ──────────────────          ──────────────────────
 *   key                     →  id
 *   title                   →  title
 *   text                    →  text
 *   cta_label               →  cta.label
 *   cta_href                →  cta.href
 */

import type {
  HeroBlockData, HeroBannerMedia, ProofBlockData, CTABlockData,
  FeatureBlockData, ConversionBlockData, AdaptiveVariantContent, AdaptiveBlockData,
  PageSectionBase, PageSectionData, TextSectionData, RichTextSectionData, TextMediaSectionData,
  VideoSectionData,
  FeatureGridData, FeatureGridCtaData, TestimonialSectionData,
  QuoteSectionData, ContextSlotSectionData,
  LogoStripSectionData, CmsLogoItem,
  StatsSectionData, CmsStatItem,
  ProcessStepsSectionData,
  TeamSectionData, CmsTeamSectionMember,
  FaqSectionData,
  TimelineSectionData, CmsTimelineItem,
  ContactSectionSectionData,
  FloatingContactSectionData,
  CtaSectionData,
  CmsTextMediaCta,
  FormSectionData,
  PortableTextBlock,
  RelatedContentData, CmsRelatedItem, CmsCollectionKey, CmsCollectionSource,
  ListingSectionData, CmsSliderMediaItem,
} from "../../types";
import type {
  StatamicHeroEntry,
  StatamicHeroMedia,
  StatamicProofEntry,
  StatamicCTAEntry,
} from "../../queries/statamic";
import type {
  StatamicFeatureReplicatorSet,
  StatamicConversionReplicatorSet,
} from "../../queries/statamic/page-queries";
import type {
  StatamicAdaptiveVariantContent,
  StatamicAdaptiveBlockEntry,
} from "../../queries/statamic/adaptive-block-queries";
import { isContextSlotBlockType } from "./context-slot-block";

// ── Hero media helper ───────────────────────────────────────────────────────

/**
 * Translate the flat Statamic media object into the HeroBannerMedia union.
 * Returns undefined for absent / "none" / incomplete media (safe fallback).
 */
function mapStatamicHeroMedia(raw: StatamicHeroMedia | null | undefined): HeroBannerMedia | undefined {
  if (!raw || !raw.media_type || raw.media_type === "none") return undefined;

  if (raw.media_type === "image") {
    if (!raw.media_image) return undefined;
    return { kind: "image", url: raw.media_image, alt: raw.media_alt ?? "" };
  }

  if (raw.media_type === "video") {
    if (!raw.video_source) return undefined;

    if (raw.video_source === "upload") {
      if (!raw.video_file) return undefined;
      return {
        kind:  "video",
        video: {
          source:   "upload",
          url:       raw.video_file,
          poster:    raw.video_poster   ?? undefined,
          autoplay:  raw.video_autoplay,
          muted:     raw.video_muted,
          loop:      raw.video_loop,
          controls:  raw.video_controls,
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

// ── Hero mapper ───────────────────────────────────────────────────────────

/**
 * Translate a Statamic hero_variants entry into a HeroBlockData.
 *
 * @param entry  The entry object from StatamicClient.fetchEntry().
 * @returns      A HeroBlockData ready for the experience composer.
 */
/** Map the optional `slides` grid (hero_carousel layout) → HeroSlideData[]. */
function mapStatamicHeroSlides(raw: unknown): HeroBlockData["slides"] {
  if (!Array.isArray(raw)) return undefined;
  const slides = raw
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => ({
      heading:    typeof s.heading     === "string" ? s.heading     : undefined,
      subheading: typeof s.subheading  === "string" ? s.subheading  : undefined,
      mediaUrl:   typeof s.media_image === "string" ? s.media_image : undefined,
      mediaAlt:   typeof s.media_alt   === "string" ? s.media_alt   : undefined,
      ctaLabel:   typeof s.cta_label   === "string" ? s.cta_label   : undefined,
      ctaUrl:     typeof s.cta_url      === "string" ? s.cta_url     : undefined,
    }));
  return slides.length > 0 ? slides : undefined;
}

export function mapStatamicHero(entry: StatamicHeroEntry): HeroBlockData {
  // Prefer the new ctas array; fall back to the legacy flat fields for
  // entries authored before the ctas field was added to the blueprint.
  const ctas: HeroBlockData["ctas"] =
    entry.ctas && entry.ctas.length > 0
      ? entry.ctas.map((c) => ({
          label:   c.label,
          href:    c.href,
          variant: c.variant,
        }))
      : entry.cta_label
        ? [{ label: entry.cta_label, href: entry.cta_href ?? "" }]
        : [];

  return {
    id:            entry.key,
    layoutVariant: entry.layout_variant,
    contentAlign:  entry.content_align,
    title:         entry.title,
    subtitle:      entry.subtitle,
    ctas,
    tag:           entry.tag,
    media:         mapStatamicHeroMedia(entry.media),
    slides:        mapStatamicHeroSlides((entry as { slides?: unknown }).slides),
  };
}

// ── Proof mapper ───────────────────────────────────────────────────────────

/**
 * Translate a Statamic proof_variants entry into a ProofBlockData.
 *
 * The `items` field is normalised with a `?? []` fallback because Statamic
 * may omit an empty Grid field from the API response.
 *
 * @param entry  The entry object from StatamicClient.fetchEntry().
 * @returns      A ProofBlockData ready for the experience composer.
 */
export function mapStatamicProof(entry: StatamicProofEntry): ProofBlockData {
  return {
    id:    entry.key,
    title: entry.title,
    items: (entry.items ?? []).map((item) => ({
      title: item.title,
      text:  item.text,
    })),
  };
}

// ── CTA mapper ────────────────────────────────────────────────────────────

/**
 * Translate a Statamic cta_variants entry into a CTABlockData.
 *
 * @param entry  The entry object from StatamicClient.fetchEntry().
 * @returns      A CTABlockData ready for the experience composer.
 */
export function mapStatamicCTA(entry: StatamicCTAEntry): CTABlockData {
  return {
    id:    entry.key,
    title: entry.title,
    text:  entry.text,
    cta: {
      label: entry.cta_label,
      href:  entry.cta_href,
    },
  };
}

// ── Feature mapper ────────────────────────────────────────────────────────

/**
 * Translate a Statamic feature_variant Replicator block into a FeatureBlockData.
 *
 * Mapping:
 *   key            →  id
 *   layout_variant →  layoutVariant
 *   title          →  title
 *   subtitle       →  subtitle
 *   items[].title  →  items[].title
 *   items[].body   →  items[].body
 *   items[].icon   →  items[].icon
 *
 * @param block  A feature_variant set from the page Replicator.
 * @returns      A FeatureBlockData ready for the experience composer.
 */
export function mapStatamicFeature(block: StatamicFeatureReplicatorSet): FeatureBlockData {
  return {
    id:            block.key,
    layoutVariant: block.layout_variant,
    title:         block.title ?? block.key,
    subtitle:      block.subtitle,
    items:         (block.items ?? []).map((item) => ({
      title: item.title,
      body:  item.body,
      icon:  item.icon,
    })),
  };
}

// ── Conversion mapper ─────────────────────────────────────────────────────

/**
 * Translate a Statamic conversion_variant Replicator block into a ConversionBlockData.
 *
 * Mapping:
 *   key            →  id
 *   layout_variant →  layoutVariant
 *   title          →  title
 *   text           →  text
 *   ctas[]         →  ctas[]
 *   form_key       →  formKey
 *   urgency_label  →  urgencyLabel
 *
 * @param block  A conversion_variant set from the page Replicator.
 * @returns      A ConversionBlockData ready for the experience composer.
 */
export function mapStatamicConversion(block: StatamicConversionReplicatorSet): ConversionBlockData {
  return {
    id:            block.key,
    layoutVariant: block.layout_variant,
    title:         block.title ?? block.key,
    text:          block.text ?? "",
    ctas:          (block.ctas ?? []).map((c) => ({
      label:   c.label,
      href:    c.href,
      variant: c.variant,
    })),
    formKey:       block.form_key,
    urgencyLabel:  block.urgency_label,
  };
}

// ── Adaptive block helpers ────────────────────────────────────────────────────

/**
 * Vertaalt een Statamic AdaptiveVariantContent object naar het interne AdaptiveVariantContent type.
 *
 * Hergebruikt dezelfde media-mapping als mapStatamicHeroMedia voor consistentie.
 *
 * @param raw  Het ruwe variant content object uit de Statamic entry.
 * @returns    Een AdaptiveVariantContent klaar voor de rendering-laag.
 */
export function mapStatamicAdaptiveVariantContent(raw: StatamicAdaptiveVariantContent): AdaptiveVariantContent {
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
    media:         mapStatamicHeroMedia({
      media_type:     raw.media_type,
      media_image:    raw.media_image,
      media_alt:      raw.media_alt,
      video_source:   raw.video_source,
      video_file:     raw.video_file,
      video_poster:   raw.video_poster,
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
 * Vertaalt een Statamic adaptive_blocks entry naar een AdaptiveBlockData.
 *
 * Mapping:
 *   id                    →  id
 *   block_key             →  key
 *   is_active             →  isActive
 *   default_variant       →  defaultVariant (via mapStatamicAdaptiveVariantContent)
 *   adaptive_variants[]   →  adaptiveVariants[] (variant_key → variantKey)
 *   tenantId              →  undefined (scoped door de collection zelf)
 *
 * @param raw  De entry van StatamicClient.fetchEntry().
 * @returns    Een AdaptiveBlockData klaar voor de experience composer.
 */
export function mapStatamicAdaptiveBlock(raw: StatamicAdaptiveBlockEntry): AdaptiveBlockData {
  return {
    id:               raw.id,
    key:              raw.block_key,
    tenantId:         undefined,
    isActive:         raw.is_active,
    defaultVariant:   mapStatamicAdaptiveVariantContent(raw.default_variant),
    adaptiveVariants: (raw.adaptive_variants ?? []).map((entry) => ({
      variantKey: entry.variant_key,
      label:      entry.label,
      content:    mapStatamicAdaptiveVariantContent(entry.content),
    })),
  };
}

// ── Page blocks → PageSectionData mapper ──────────────────────────────────────

/**
 * Wrap a plain-text string as a minimal PortableText block array.
 *
 * Statamic stores body/text fields as plain strings. The platform's
 * TextSectionData and RichTextSectionData expect PortableTextBlock[], so we
 * wrap the string in a single "normal" paragraph span — the same technique
 * used by the Sanity textMedia mapper.
 */
function wrapTextAsPortableText(text: string | undefined): PortableTextBlock[] | undefined {
  if (!text) return undefined;
  return [
    {
      _type:    "block",
      _key:     "b0",
      style:    "normal",
      markDefs: [],
      children: [{ _type: "span", _key: "s0", text, marks: [] }],
    } as unknown as PortableTextBlock,
  ];
}

// ── Bard / ProseMirror → HTML converter ───────────────────────────────────────
//
// Statamic's Bard field (TipTap-based, ProseMirror under the hood) sends its
// value in two different formats depending on the context:
//
//   ON-DISK (save_html: true)   → HTML string stored in YAML
//   LIVE PREVIEW (CP form)      → ProseMirror node array (reactive form value)
//
// This function normalises both into a safe HTML string that can be rendered
// with dangerouslySetInnerHTML in RichTextBlock.

type PmNode = {
  type:    string;
  attrs?:  Record<string, unknown>;
  content?: PmNode[];
  marks?:  Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?:   string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;");
}

function pmInlineToHtml(nodes: PmNode[]): string {
  return nodes.map((node) => {
    if (node.type === "hardBreak") return "<br>";
    // For non-text, non-hardBreak inline nodes (e.g. image inside a paragraph),
    // delegate to pmNodesToHtml with the full node so the switch-case handlers
    // (e.g. "image") run correctly.  Previously we passed `node.content ?? []`
    // which for images (which have no content) produced an empty array → empty string.
    if (node.type !== "text") return pmNodesToHtml([node]);

    let text = escapeHtml(node.text ?? "");
    // Apply marks right-to-left so inner marks wrap before outer
    const marks = [...(node.marks ?? [])].reverse();
    for (const mark of marks) {
      switch (mark.type) {
        case "bold":
        case "strong":
          text = `<strong>${text}</strong>`;
          break;
        case "italic":
        case "em":
          text = `<em>${text}</em>`;
          break;
        case "code":
          text = `<code>${text}</code>`;
          break;
        case "underline":
          text = `<u>${text}</u>`;
          break;
        case "strike":
        case "strikethrough":
          text = `<s>${text}</s>`;
          break;
        case "link": {
          const href   = escapeHtml(String(mark.attrs?.href   ?? ""));
          const target = mark.attrs?.target ? ` target="${escapeHtml(String(mark.attrs.target))}"` : "";
          const rel    = target ? ` rel="noopener noreferrer"` : "";
          text = `<a href="${href}"${target}${rel}>${text}</a>`;
          break;
        }
      }
    }
    return text;
  }).join("");
}

function pmNodesToHtml(nodes: PmNode[]): string {
  return nodes.map((node) => {
    switch (node.type) {
      case "doc":
        return pmNodesToHtml(node.content ?? []);
      case "paragraph": {
        const inner = pmInlineToHtml(node.content ?? []);
        return `<p>${inner || "<br>"}</p>`;
      }
      case "heading": {
        const lvl = Math.min(6, Math.max(1, (node.attrs?.level as number) ?? 2));
        return `<h${lvl}>${pmInlineToHtml(node.content ?? [])}</h${lvl}>`;
      }
      case "bulletList":
        return `<ul>${pmNodesToHtml(node.content ?? [])}</ul>`;
      case "orderedList":
        return `<ol>${pmNodesToHtml(node.content ?? [])}</ol>`;
      case "listItem": {
        // listItem wraps in a <p> by default in TipTap; strip it for clean <li>
        const inner = (node.content ?? [])
          .map((child) => child.type === "paragraph"
            ? pmInlineToHtml(child.content ?? [])
            : pmNodesToHtml([child]))
          .join("");
        return `<li>${inner}</li>`;
      }
      case "blockquote":
        return `<blockquote>${pmNodesToHtml(node.content ?? [])}</blockquote>`;
      case "codeBlock":
        return `<pre><code>${pmInlineToHtml(node.content ?? [])}</code></pre>`;
      case "horizontalRule":
        return "<hr />";
      case "hardBreak":
        return "<br>";
      case "text":
        return pmInlineToHtml([node]);
      case "image": {
        const rawSrc = String(node.attrs?.src ?? "");
        if (!rawSrc) return "";
        // Resolve all Statamic image URL formats to root-relative /assets/ paths.
        // Root-relative paths are proxied by Next.js rewrites → STATAMIC_API_URL
        // so the browser never needs direct access to the Statamic server.
        //
        //   statamic://asset::{container}::{path}  →  /assets/{path}
        //   /assets/img.jpg                        →  /assets/img.jpg  (unchanged)
        //   assets::img.jpg                        →  /assets/img.jpg
        //   http(s)://...                          →  unchanged (external CDN)
        let resolvedSrc: string;
        if (rawSrc.startsWith("statamic://asset::")) {
          const assetPath = rawSrc.replace(/^statamic:\/\/asset::[^:]+::/, "");
          resolvedSrc = `/assets/${assetPath}`;
        } else if (rawSrc.startsWith("http://") || rawSrc.startsWith("https://")) {
          resolvedSrc = rawSrc; // external URL — keep as-is
        } else if (rawSrc.startsWith("/")) {
          resolvedSrc = rawSrc; // already root-relative
        } else if (rawSrc.includes("::")) {
          // Statamic asset reference formats:
          //   "assets::file.webp"           → {container}::{path}
          //   "asset::assets::file.webp"    → {typePrefix}::{container}::{path}
          //     (Statamic preProcess strips "statamic://" leaving "asset::" prefix)
          // Always take the LAST segment as the actual file path.
          const parts    = rawSrc.split("::");
          const assetPath = parts[parts.length - 1];
          resolvedSrc = `/assets/${assetPath}`;
        } else {
          resolvedSrc = `/assets/${rawSrc}`;
        }
        const alt   = escapeHtml(String(node.attrs?.alt   ?? ""));
        const title = node.attrs?.title ? ` title="${escapeHtml(String(node.attrs.title))}"` : "";
        return `<img src="${escapeHtml(resolvedSrc)}" alt="${alt}"${title} loading="lazy" />`;
      }
      case "set": {
        // Statamic Bard image sets: { type: "set", attrs: { values: { type: "image", image: "assets::filename" } } }
        const values = (node.attrs?.values ?? {}) as Record<string, unknown>;
        if (values.type !== "image") return "";

        // `image` field can be: "assets::filename", "/assets/path", "http://...", an asset object, or an array thereof
        const rawImage = Array.isArray(values.image) ? values.image[0] : values.image;
        if (!rawImage) return "";

        // Resolve to root-relative /assets/ paths (proxied by Next.js rewrites).
        let resolvedImageSrc: string;

        if (typeof rawImage === "string") {
          if (rawImage.startsWith("http://") || rawImage.startsWith("https://")) {
            resolvedImageSrc = rawImage; // external CDN — keep as-is
          } else if (rawImage.startsWith("/")) {
            resolvedImageSrc = rawImage; // already root-relative
          } else {
            // Strip Statamic asset handle prefix.
            // Formats: "assets::img.jpg" or "asset::assets::img.jpg"
            // (preProcess strips "statamic://" leaving "asset::" prefix)
            // Always take the last "::" segment as the actual file path.
            const assetPath = rawImage.includes("::")
              ? rawImage.split("::").pop()!
              : rawImage;
            resolvedImageSrc = `/assets/${assetPath}`;
          }
        } else if (typeof rawImage === "object" && rawImage !== null) {
          const obj = rawImage as Record<string, unknown>;
          if (typeof obj.permalink === "string" && obj.permalink) {
            resolvedImageSrc = obj.permalink; // fully-qualified permalink from HTTP API
          } else if (typeof obj.url === "string" && obj.url) {
            resolvedImageSrc = obj.url.startsWith("/") ? obj.url : obj.url;
          } else {
            return "";
          }
        } else {
          return "";
        }

        const imgAlt     = escapeHtml(String(values.alt ?? ""));
        const captionStr = typeof values.caption === "string" && values.caption
          ? `<figcaption class="mt-2 text-sm" style="color:var(--text-muted)">${escapeHtml(values.caption)}</figcaption>`
          : "";

        const imgTag = `<img src="${escapeHtml(resolvedImageSrc)}" alt="${imgAlt}" loading="lazy" />`;
        return captionStr
          ? `<figure class="m-0">${imgTag}${captionStr}</figure>`
          : imgTag;
      }
      case "table":
        return `<table>${pmNodesToHtml(node.content ?? [])}</table>`;
      case "tableRow":
        return `<tr>${pmNodesToHtml(node.content ?? [])}</tr>`;
      case "tableHeader": {
        const colspan = node.attrs?.colspan ? ` colspan="${Number(node.attrs.colspan)}"` : "";
        const rowspan = node.attrs?.rowspan ? ` rowspan="${Number(node.attrs.rowspan)}"` : "";
        // tableHeader cells wrap content in a paragraph; strip it for cleaner <th>
        const inner = (node.content ?? [])
          .map((child) => child.type === "paragraph"
            ? pmInlineToHtml(child.content ?? [])
            : pmNodesToHtml([child]))
          .join("");
        return `<th${colspan}${rowspan}>${inner}</th>`;
      }
      case "tableCell": {
        const colspan = node.attrs?.colspan ? ` colspan="${Number(node.attrs.colspan)}"` : "";
        const rowspan = node.attrs?.rowspan ? ` rowspan="${Number(node.attrs.rowspan)}"` : "";
        const inner = (node.content ?? [])
          .map((child) => child.type === "paragraph"
            ? pmInlineToHtml(child.content ?? [])
            : pmNodesToHtml([child]))
          .join("");
        return `<td${colspan}${rowspan}>${inner}</td>`;
      }
      default:
        return pmNodesToHtml(node.content ?? []);
    }
  }).join("");
}

/**
 * Convert a Statamic Bard body value to an HTML string.
 *
 * Handles all formats Statamic may send:
 *   1. string  — HTML from `save_html: true` (on-disk) or plain legacy text.
 *                Plain text (no `<` or `>`) is wrapped in a `<p>` tag.
 *   2. array   — ProseMirror node array sent by the Statamic CP Live Preview.
 *                Converted to HTML via pmNodesToHtml.
 *   3. object  — ProseMirror doc node `{ type: "doc", content: [...] }` or
 *                any other ProseMirror node object. Also handles Statamic
 *                augmented-value objects with an `html` or `value` property.
 *
 * Returns undefined when the input is falsy or an empty array.
 */
function bardBodyToHtml(body: unknown): string | undefined {
  if (!body) return undefined;

  // Already an HTML / plain-text string (on-disk save_html: true)
  if (typeof body === "string") {
    const trimmed = body.trim();
    if (!trimmed) return undefined;
    // Plain text without any HTML tags → wrap in a single paragraph
    if (!/[<>]/.test(trimmed)) return `<p>${escapeHtml(trimmed)}</p>`;
    // Rewrite Statamic internal asset protocol URLs to root-relative paths.
    // These are proxied by the Next.js /assets rewrite → STATAMIC_API_URL,
    // so the browser never needs direct access to the Statamic server.
    //
    //   statamic://asset::{container}::{path}  →  /assets/{path}
    //   src="/assets/img.jpg"                  →  unchanged (already root-relative)
    const html = trimmed.replace(/statamic:\/\/asset::[^:]+::([^"'\s>]+)/g, "/assets/$1");
    return html;
  }

  // ProseMirror node array from the CP Live Preview
  if (Array.isArray(body) && body.length > 0) {
    const html = pmNodesToHtml(body as PmNode[]);
    return html || undefined;
  }

  // Object formats:
  //   • ProseMirror doc node: { type: "doc", content: [...] }
  //   • Any other ProseMirror node object: { type: "paragraph", ... }
  //   • Statamic augmented-value with "html" property (save_html augmentation)
  //   • Statamic augmented-value with "value" property
  if (typeof body === "object" && body !== null && !Array.isArray(body)) {
    const obj = body as Record<string, unknown>;

    // Statamic may return { html: "<p>...</p>", ... } for save_html:true Bard fields
    if (typeof obj.html === "string" && obj.html) {
      return bardBodyToHtml(obj.html);
    }

    // Statamic augmented-value wrapper: { value: <actual body>, ... }
    if (obj.value !== undefined) {
      return bardBodyToHtml(obj.value);
    }

    // ProseMirror node object (doc node or any other node type)
    // pmNodesToHtml already handles "doc" type by recursing into content
    if (typeof obj.type === "string") {
      const html = pmNodesToHtml([body as PmNode]);
      return html || undefined;
    }
  }

  return undefined;
}

/**
 * Map an array of raw Statamic page_blocks items to PageSectionData[].
 *
 * Context-slot items are skipped here — they are handled separately via
 * `contextConfig`.  Blocks toggled off in the CP (`enabled === false`) are
 * excluded so the preview faithfully reflects the editor's toggle state.
 *
 * Supported Statamic block types:
 *   text_section        → TextSectionData        (textSection)
 *   rich_text           → RichTextSectionData    (richText)
 *   image               → TextMediaSectionData   (textMedia)
 *   feature_grid        → FeatureGridData        (featureGrid)
 *   testimonial_section → TestimonialSectionData (testimonialSection)
 *   quote               → QuoteSectionData       (quote)
 *   logo_strip          → LogoStripSectionData   (logoStrip)
 *   stats               → StatsSectionData       (stats)
 *   process_steps       → ProcessStepsSectionData (processSteps)
 *   team_section        → TeamSectionData        (teamSection)
 *   cta_section         → CtaSectionData         (ctaSection)
 *
 * Unknown / unmapped block types are silently skipped so new types added in
 * the Statamic blueprint don't cause errors.
 *
 * Called by StatamicProvider.getPageBySlug() (saved page path) and by
 * buildDraftPageData() in app/(site)/[slug]/page.tsx (live preview path).
 */
export function mapStatamicPageBlocksToSections(
  blocks: Array<Record<string, unknown>>,
  /**
   * Absolute base URL of the tenant's Statamic CMS (e.g.
   * "https://cms.misterchameleon.nl"). Passed by the Live Preview path so
   * bare/relative draft asset references resolve to the CORRECT per-tenant CMS
   * host. Falls back to STATAMIC_API_URL when omitted (saved paths get absolute
   * permalinks from the REST API and don't need it).
   */
  statamicBaseUrl?: string,
): PageSectionData[] {
  const sections: PageSectionData[] = [];

  // ── Statamic asset URL resolver ───────────────────────────────────────────
  //
  // Resolves Statamic asset references to absolute URLs.
  //
  // Data shape depends on the context:
  //  REST API   → plain string URL (already absolute, returned by the API)
  //  Live Preview draft (page_blocks | to_json in Antlers)
  //    → Augmented Asset object:  { url: "/assets/foo.jpg", permalink: "http://…/assets/foo.jpg", … }
  //    → Raw array (un-augmented): ["img.jpg"]
  //    → Raw string:               "/assets/img.jpg"
  //
  // Strategy: prefer `permalink` (absolute), fall back to `url` (relative),
  // then handle plain strings / arrays.  Prefix any root-relative URL with
  // STATAMIC_API_URL so images load cross-port in the preview iframe.
  // Absolute base for resolving asset references — MUST be the CMS host.
  // Prefer the per-tenant base passed by the caller (the Live Preview path),
  // then the global env, then localhost for dev. Assets have to be absolute to
  // the CMS: the frontend host does NOT proxy /assets (www.misterchameleon.nl/
  // assets/x → 404), and the Live Preview can render on a *different* host than
  // the CMS — only an absolute CMS URL (https://cms.misterchameleon.nl/assets/x)
  // resolves in every context (live page, [slug] draft, and Live Preview).
  const statamicBase = (statamicBaseUrl ?? process.env.STATAMIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

  function resolveAssetUrl(raw: unknown): string | undefined {
    if (!raw) return undefined;

    // Augmented Asset object  {url, permalink, …}
    if (typeof raw === "object" && !Array.isArray(raw)) {
      const obj = raw as Record<string, unknown>;
      // `permalink` is the absolute URL with domain — prefer it
      if (typeof obj.permalink === "string" && obj.permalink) return obj.permalink;
      // `url` may be root-relative like "/assets/img.jpg"
      if (typeof obj.url === "string" && obj.url) {
        const u = obj.url;
        return u.startsWith("/") ? `${statamicBase}${u}` : u;
      }
      return undefined;
    }

    // Array — raw value or array of Asset objects
    if (Array.isArray(raw) && raw.length > 0) {
      return resolveAssetUrl(raw[0]);
    }

    // Plain string — three sub-cases:
    //   1. Already absolute (http/https)  → return as-is
    //   2. Root-relative (/assets/…)      → host-agnostic in prod, prefixed in dev
    //   3. Bare filename (file-reader path, e.g. "hero.webp" or "folder/img.jpg")
    //      The Statamic assets disk serves files from /assets/, so a bare name
    //      stored in YAML by StatamicFileReader maps to /assets/<name>.
    if (typeof raw === "string" && raw) {
      if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
      if (raw.startsWith("/")) return `${statamicBase}${raw}`;
      // Strip Statamic asset handle prefix if present ("assets::img.jpg" → "img.jpg").
      // Statamic stores asset references as "<container>::<path>" internally; the
      // REST API / to_json sometimes surfaces this raw handle instead of a URL.
      const assetPath = raw.includes("::") ? raw.split("::").slice(1).join("::") : raw;
      return `${statamicBase}/assets/${assetPath}`;
    }

    return undefined;
  }

  /**
   * Resolve a Statamic `type: link` field value to a plain href string.
   *
   * The field value can be:
   *   • A plain string — custom URL ("https://…"), root-relative path ("/slug"),
   *     or anchor ("#section").  Returned as-is.
   *   • An augmented entry object — when the editor picks a page from the tree.
   *     Shape: { id, title, url: "/slug", permalink: "https://domain/slug", … }
   *     We prefer `url` (root-relative, works across environments) and only fall
   *     back to `permalink` if `url` is absent.
   *
   * Returns undefined for absent / empty values.
   */
  function resolveLinkHref(raw: unknown): string | undefined {
    if (!raw) return undefined;
    if (typeof raw === "string") return raw || undefined;
    if (typeof raw === "object" && !Array.isArray(raw)) {
      const obj = raw as Record<string, unknown>;
      // Prefer root-relative url — works in every environment
      if (typeof obj.url === "string" && obj.url) return obj.url;
      // Fall back to permalink (absolute URL with domain)
      if (typeof obj.permalink === "string" && obj.permalink) return obj.permalink;
    }
    return undefined;
  }

  /**
   * Extract a plain string from a Statamic field that may be either a raw string
   * (from the REST API / | to_json) or an augmented select object (from the CP
   * live-preview postMessage: { value, label, key }).
   *
   * Returns undefined for empty / absent values.
   */
  function extractString(raw: unknown): string | undefined {
    if (typeof raw === "string") return raw || undefined;
    if (raw !== null && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      const val = obj.value ?? obj.key;
      if (typeof val === "string") return val || undefined;
    }
    return undefined;
  }

  for (const block of blocks) {
    // Use extractString so that augmented Replicator type objects from the
    // CP live-preview postMessage ({ value: "context_slot", label: "…" })
    // are handled identically to the plain strings read from YAML/REST API.
    const blockType = extractString(block.type) ?? null;
    if (!blockType) continue;

    // ── Context slot blocks → ContextSlotSectionData ──────────────────────
    // In the unified page_blocks model, context_slot blocks appear alongside
    // content blocks in authored order.  Map them to ContextSlotSectionData
    // so the ordering information is preserved in sections[].
    if (isContextSlotBlockType(blockType)) {
      // Respect the enabled toggle.
      if (block.enabled === false) continue;
      // PHP `false` or integer `0` mean "off"; treat absent as active.
      const isActive = block.is_active;
      if (isActive === false || isActive === 0) continue;

      const rawSlotType = block.slot_type;
      // Normalise: raw string ("hero"), augmented label ("Hero"),
      // or augmented object { value: "hero", label: "Hero" }.
      let slotId: string | undefined;
      if (typeof rawSlotType === "string") {
        slotId = rawSlotType.toLowerCase();
      } else if (typeof rawSlotType === "object" && rawSlotType !== null) {
        const obj = rawSlotType as Record<string, unknown>;
        const val = obj.value ?? obj.key;
        if (typeof val === "string") slotId = val.toLowerCase();
      }
      if (!slotId) continue;

      const key = typeof block.id === "string" && block.id
        ? block.id
        : `context_slot_${sections.length}`;

      const slotSection: ContextSlotSectionData = {
        _type:       "contextSlot",
        _key:        key,
        slotId,
        variantKey:  typeof block.variant_key === "string" && block.variant_key.trim()
          ? block.variant_key
          : `${slotId}_default`,
        enabled: true,
      };
      sections.push(slotSection);
      continue;
    }

    // Respect the Statamic CP toggle — excluded blocks are invisible.
    if (block.enabled === false) continue;

    // Stable key: use the Statamic block `id` field (UUID-like), fallback to index.
    const key = typeof block.id === "string" && block.id ? block.id : `${blockType}_${sections.length}`;

    switch (blockType) {
      case "text_section": {
        // `body` is a Statamic `textarea` field that may contain either plain
        // text or HTML markup (editors sometimes type HTML directly, or the
        // field was seeded with an HTML string).
        // bardBodyToHtml() handles both cases:
        //   • HTML string  → returned as-is (rewriting Statamic asset URLs)
        //   • Plain text   → wrapped in <p>...</p>
        //   • ProseMirror  → only in live-preview; wrapTextAsPortableText would
        //                    misfire on arrays, so we use bardBodyToHtml for all.
        const htmlBody = bardBodyToHtml(block.body);
        const section: TextSectionData = {
          _key:     key,
          _type:    "textSection",
          variant:  extractString(block.variant),
          heading:  typeof block.heading === "string" ? block.heading : undefined,
          htmlBody: htmlBody || undefined,
          // body (PortableText) is intentionally left undefined — htmlBody supersedes it.
        };
        sections.push(section);
        break;
      }

      case "rich_text": {
        // `max_width` (snake_case in Statamic fieldset) → `maxWidth` (camelCase in type).
        const maxWidthRaw = block.max_width;
        const maxWidth: RichTextSectionData["maxWidth"] =
          maxWidthRaw === "narrow" || maxWidthRaw === "wide" ? maxWidthRaw : undefined;

        // bardBodyToHtml handles both on-disk HTML strings (save_html: true)
        // and ProseMirror arrays sent by the Statamic CP Live Preview.
        const htmlBody = bardBodyToHtml(block.body);

        const section: RichTextSectionData = {
          _key:     key,
          _type:    "richText",
          variant:  extractString(block.variant),
          maxWidth,
          htmlBody,
          // body is intentionally left undefined — htmlBody supersedes it
          // for all Bard-sourced content.
        };
        sections.push(section);
        break;
      }

      case "image": {
        // ── Shared editorial text fields ────────────────────────────────────
        const rawCtas = Array.isArray(block.ctas)
          ? block.ctas as Array<Record<string, unknown>>
          : [];
        // `href` is now a `type: link` field — it can be a plain string (custom
        // URL / anchor) or an augmented entry object when the editor picks a page.
        // resolveLinkHref() normalises both shapes to a plain href string.
        const ctas: CmsTextMediaCta[] = rawCtas
          .map((c, i): CmsTextMediaCta | null => {
            if (typeof c.label !== "string" || !c.label) return null;
            const href = resolveLinkHref(c.href);
            if (!href) return null;
            return {
              _key:  typeof c.id === "string" && c.id ? c.id : `cta_${i}`,
              label: c.label,
              href,
            };
          })
          .filter((c): c is CmsTextMediaCta => c !== null);

        // ── Determine media type ─────────────────────────────────────────────
        // `media_type` defaults to "image" for backward compat with entries that
        // predate the field (they have no media_type stored in YAML).
        const rawMediaType = extractString(block.media_type) ?? "image";
        const isVideo = rawMediaType === "video";

        // ── Build media URL ─────────────────────────────────────────────────
        let mediaUrl: string | undefined;
        let videoSource: "youtube" | "vimeo" | "upload" | undefined;

        if (!isVideo) {
          // Image path: use `image` assets field
          mediaUrl = resolveAssetUrl(block.image);
        } else {
          const rawVideoSrc = extractString(block.video_source) ?? "youtube";
          videoSource = rawVideoSrc as "youtube" | "vimeo" | "upload";

          if (videoSource === "upload") {
            // Native video file from the asset library
            mediaUrl = resolveAssetUrl(block.video_file);
          } else if (videoSource === "youtube") {
            // `video_id` field — accepts bare ID (11 chars), watch URL, youtu.be, embed URL
            const rawId = typeof block.video_id === "string" ? block.video_id.trim() : "";
            if (rawId) {
              const ytWatch  = rawId.match(/[?&]v=([A-Za-z0-9_-]{11})/);
              const ytShort  = rawId.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
              const ytShorts = rawId.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/);
              const ytEmbed  = rawId.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/);
              const ytBareId = /^[A-Za-z0-9_-]{11}$/.test(rawId);
              const videoId  = ytWatch?.[1] ?? ytShort?.[1] ?? ytShorts?.[1] ?? ytEmbed?.[1] ?? (ytBareId ? rawId : null);
              if (videoId) mediaUrl = `https://www.youtube.com/embed/${videoId}`;
            }
          } else {
            // Vimeo — `vimeo_id` field — accepts numeric ID or vimeo.com URL
            const rawId = typeof block.vimeo_id === "string" ? block.vimeo_id.trim() : "";
            if (rawId) {
              const vimeoMatch = rawId.match(/(?:vimeo\.com\/)(\d+)/) ?? rawId.match(/^(\d+)$/);
              if (vimeoMatch) mediaUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
            }
          }
        }

        const section: TextMediaSectionData = {
          _key:        key,
          _type:       "textMedia",
          variant:     extractString(block.variant),
          eyebrow:     typeof block.eyebrow  === "string" ? block.eyebrow  : undefined,
          heading:     typeof block.heading  === "string" ? block.heading  : undefined,
          body:        typeof block.body     === "string" ? block.body     : undefined,
          ctas:        ctas.length > 0 ? ctas : undefined,
          mediaType:   isVideo ? "video" : "image",
          mediaUrl,
          mediaAlt:    typeof block.alt      === "string" ? block.alt      : undefined,
          caption:     typeof block.caption  === "string" ? block.caption  : undefined,
          videoSource,
          posterUrl:   resolveAssetUrl(block.video_poster),
          autoPlay:    block.video_autoplay === true,
          loop:        block.video_loop     === true,
          // ── Media background (image-only) ──────────────────────────────────
          ...(() => {
            const rawBgType = extractString(block.media_bg_type);
            if (rawBgType === "color") {
              return {
                mediaBgType:  "color" as const,
                mediaBgColor: typeof block.media_bg_color === "string" ? block.media_bg_color : undefined,
              };
            }
            if (rawBgType === "image") {
              return {
                mediaBgType:     "image" as const,
                mediaBgImageUrl: resolveAssetUrl(block.media_bg_image),
              };
            }
            return {};
          })(),
        };
        sections.push(section);
        break;
      }

      case "feature_grid": {
        // Items are authored via the Statamic Grid fieldtype.
        // Field names in the fieldset: icon, title, body (→ description).
        const rawItems = Array.isArray(block.items) ? block.items as Array<Record<string, unknown>> : [];

        // CTA is authored via the Statamic Group fieldtype.
        const ctaRaw = (typeof block.cta === "object" && block.cta !== null)
          ? block.cta as Record<string, unknown>
          : null;

        const cta: FeatureGridCtaData | undefined =
          ctaRaw && typeof ctaRaw.label === "string" && typeof ctaRaw.href === "string"
            ? {
                label:   ctaRaw.label,
                href:    ctaRaw.href,
                variant: ["primary", "secondary", "outline", "ghost", "link"].includes(ctaRaw.variant as string)
                  ? ctaRaw.variant as FeatureGridCtaData["variant"]
                  : undefined,
              }
            : undefined;

        const section: FeatureGridData = {
          _key:     key,
          _type:    "featureGrid",
          variant:  extractString(block.variant),
          heading:  typeof block.heading === "string" ? block.heading : undefined,
          features: rawItems.map((item) => ({
            title:       typeof item.title === "string" ? item.title : "",
            // `body` is the Statamic field name; maps to `description` in FeatureItemData.
            description: typeof item.body === "string" ? item.body : (typeof item.description === "string" ? item.description : ""),
            icon:        typeof item.icon === "string" ? item.icon : undefined,
          })),
          cta,
        };
        sections.push(section);
        break;
      }

      case "testimonial_section": {
        // Items are authored via the Statamic Grid fieldtype.
        // Field names: quote, author, role, company, avatar (→ avatarUrl).
        const rawItems = Array.isArray(block.items) ? block.items as Array<Record<string, unknown>> : [];

        const section: TestimonialSectionData = {
          _key:    key,
          _type:   "testimonialSection",
          variant: extractString(block.variant),
          heading: typeof block.heading === "string" ? block.heading : undefined,
          testimonials: rawItems.map((item) => ({
            quote:   typeof item.quote === "string" ? item.quote : "",
            author:  typeof item.author === "string" ? item.author : "",
            role:    typeof item.role === "string" ? item.role : undefined,
            company: typeof item.company === "string" ? item.company : undefined,
            // `avatar` is the Statamic assets field; resolve to an absolute URL.
            avatar:  resolveAssetUrl(item.avatar),
          })),
        };
        sections.push(section);
        break;
      }

      // "quote_block" is the Replicator set handle used in the pages blueprint.
      // "quote" kept as a legacy alias for any older content.
      case "quote_block":
      case "quote": {
        const section: QuoteSectionData = {
          _key:        key,
          _type:       "quote",
          variant:     extractString(block.variant),
          quote:       typeof block.quote === "string" ? block.quote : "",
          attribution: typeof block.author === "string" ? block.author : undefined,
          source:      typeof block.role   === "string" ? block.role   : undefined,
          // `avatar` is the Statamic assets field; resolve to an absolute URL.
          avatarUrl:   resolveAssetUrl(block.avatar),
        };
        sections.push(section);
        break;
      }

      case "logo_strip": {
        // `logos` grid — each row: name (text), image (assets), url (text, optional)
        const rawLogos = Array.isArray(block.logos)
          ? block.logos as Array<Record<string, unknown>>
          : [];
        const section: LogoStripSectionData = {
          _key:    key,
          _type:   "logoStrip",
          variant: extractString(block.variant),
          heading: typeof block.heading === "string" ? block.heading : undefined,
          logos:   rawLogos.map((logo, i): CmsLogoItem => ({
            _key: typeof logo.id === "string" && logo.id ? logo.id : `logo_${i}`,
            name: typeof logo.name === "string" ? logo.name : "",
            // `image` is an assets field — resolve to absolute URL.
            src:  resolveAssetUrl(logo.image) ?? "",
            url:  typeof logo.url === "string" && logo.url ? logo.url : undefined,
          })),
        };
        sections.push(section);
        break;
      }

      case "stats": {
        // `items` grid — each row: prefix, value, suffix, label
        const rawItems = Array.isArray(block.items)
          ? block.items as Array<Record<string, unknown>>
          : [];
        const section: StatsSectionData = {
          _key:    key,
          _type:   "stats",
          variant: extractString(block.variant),
          heading: typeof block.heading === "string" ? block.heading : undefined,
          items:   rawItems.map((item, i): CmsStatItem => ({
            _key:   typeof item.id === "string" && item.id ? item.id : `stat_${i}`,
            label:  typeof item.label  === "string" ? item.label  : "",
            value:  typeof item.value  === "string" ? item.value  : "",
            prefix: typeof item.prefix === "string" && item.prefix ? item.prefix : undefined,
            suffix: typeof item.suffix === "string" && item.suffix ? item.suffix : undefined,
          })),
        };
        sections.push(section);
        break;
      }

      case "process_steps": {
        // `steps` grid — each row: number (optional), title, body (→ description), duration
        const rawSteps = Array.isArray(block.steps)
          ? block.steps as Array<Record<string, unknown>>
          : [];
        const section: ProcessStepsSectionData = {
          _key:    key,
          _type:   "processSteps",
          variant: extractString(block.variant),
          heading: typeof block.heading === "string" ? block.heading : undefined,
          steps:   rawSteps.map((step, i) => ({
            _key:        typeof step.id    === "string" && step.id    ? step.id    : `step_${i}`,
            title:       typeof step.title === "string" ? step.title : "",
            // `body` is the Statamic field name; maps to `description` in CmsProcessStep.
            description: typeof step.body  === "string" ? step.body
              : (typeof step.description === "string" ? step.description : undefined),
            duration:    typeof step.duration === "string" && step.duration ? step.duration : undefined,
          })),
        };
        sections.push(section);
        break;
      }

      case "team_section": {
        // `members` grid — each row: name, role, bio, image (assets), profile_href, socials (group)
        const rawMembers = Array.isArray(block.members)
          ? block.members as Array<Record<string, unknown>>
          : [];
        const section: TeamSectionData = {
          _key:    key,
          _type:   "teamSection",
          variant: extractString(block.variant),
          heading: typeof block.heading === "string" ? block.heading : undefined,
          intro:   typeof block.intro   === "string" ? block.intro   : undefined,
          members: rawMembers.map((m, i): CmsTeamSectionMember => {
            const socialsRaw = (typeof m.socials === "object" && m.socials !== null)
              ? m.socials as Record<string, unknown>
              : null;
            return {
              _key:        typeof m.id   === "string" && m.id   ? m.id   : `member_${i}`,
              name:        typeof m.name === "string" ? m.name : "",
              role:        typeof m.role === "string" ? m.role : "",
              bio:         typeof m.bio  === "string" && m.bio  ? m.bio  : undefined,
              // `image` is an assets field; resolve to absolute URL.
              imageUrl:    resolveAssetUrl(m.image),
              // `profile_href` is snake_case in the Statamic fieldset.
              profileHref: typeof m.profile_href === "string" && m.profile_href
                ? m.profile_href : undefined,
              socials: socialsRaw ? {
                linkedin: typeof socialsRaw.linkedin === "string" && socialsRaw.linkedin
                  ? socialsRaw.linkedin : undefined,
                twitter:  typeof socialsRaw.twitter  === "string" && socialsRaw.twitter
                  ? socialsRaw.twitter  : undefined,
                github:   typeof socialsRaw.github   === "string" && socialsRaw.github
                  ? socialsRaw.github   : undefined,
              } : undefined,
            };
          }),
        };
        sections.push(section);
        break;
      }

      case "faq_section": {
        // `items` grid — each row: question (text), answer (textarea)
        const rawItems = Array.isArray(block.items)
          ? block.items as Array<Record<string, unknown>>
          : [];
        const section: FaqSectionData = {
          _key:    key,
          _type:   "faqSection",
          variant: extractString(block.variant),
          heading: typeof block.heading === "string" ? block.heading : undefined,
          items: rawItems.map((item) => ({
            question: typeof item.question === "string" ? item.question : "",
            answer:   typeof item.answer   === "string" ? item.answer   : "",
          })),
        };
        sections.push(section);
        break;
      }

      case "timeline": {
        // `items` replicator (single "item" set) — fields: date, title, description [+ optional slider media]
        // Each replicator entry has a `type` key equal to the set handle ("item"); we filter on it for safety.
        const rawItems = (Array.isArray(block.items)
          ? block.items as Array<Record<string, unknown>>
          : []
        ).filter((item) => !item.type || item.type === "item");
        const section: TimelineSectionData = {
          _key:        key,
          _type:       "timeline",
          variant:     extractString(block.variant),
          heading:     typeof block.heading     === "string" ? block.heading     : undefined,
          description: typeof block.description === "string" ? block.description : undefined,
          items: rawItems.map((item, i) => {
            const itemKey = typeof item.id === "string" && item.id ? item.id : `item_${i}`;

            // ── Slider-variant media resolution ─────────────────────────────
            const rawMt = extractString(item.media_type);
            let mediaType: CmsTimelineItem["mediaType"];
            let mediaUrl:  string | undefined;
            let posterUrl: string | undefined;

            if (rawMt === "image") {
              mediaType = "image";
              // media_image is the new dedicated image asset field (media_asset is for video_file)
              mediaUrl  = resolveAssetUrl(item.media_image) ?? resolveAssetUrl(item.media_asset);
            } else if (rawMt === "video_file") {
              mediaType = "video_file";
              mediaUrl  = resolveAssetUrl(item.media_asset);
              posterUrl = resolveAssetUrl(item.video_placeholder);
            } else if (rawMt === "youtube") {
              mediaType = "youtube";
              const rawId = typeof item.video_id === "string" ? item.video_id.trim() : "";
              if (rawId) {
                const ytWatch  = rawId.match(/[?&]v=([A-Za-z0-9_-]{11})/);
                const ytShort  = rawId.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
                const ytShorts = rawId.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/);
                const ytEmbed  = rawId.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/);
                const ytBare   = /^[A-Za-z0-9_-]{11}$/.test(rawId);
                const videoId  = ytWatch?.[1] ?? ytShort?.[1] ?? ytShorts?.[1] ?? ytEmbed?.[1] ?? (ytBare ? rawId : null);
                if (videoId) mediaUrl = `https://www.youtube.com/embed/${videoId}`;
              }
              posterUrl = resolveAssetUrl(item.video_placeholder);
            } else if (rawMt === "vimeo") {
              mediaType = "vimeo";
              const rawId = typeof item.vimeo_id === "string" ? item.vimeo_id.trim() : "";
              if (rawId) {
                const vimeoMatch = rawId.match(/(?:vimeo\.com\/)(\d+)/) ?? rawId.match(/^(\d+)$/);
                if (vimeoMatch) mediaUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
              }
              posterUrl = resolveAssetUrl(item.video_placeholder);
            }

            return {
              _key:        itemKey,
              date:        typeof item.date        === "string" ? item.date        : undefined,
              title:       typeof item.title       === "string" ? item.title       : "",
              description: typeof item.description === "string" && item.description ? item.description : undefined,
              ...(mediaType ? {
                mediaType,
                mediaUrl,
                posterUrl,
                autoPlay: item.video_autoplay === true,
                loop:     item.video_loop     === true,
              } : {}),
            };
          }),
        };
        sections.push(section);
        break;
      }

      case "cta_section": {
        // `primary_cta` / `secondary_cta` are Group fieldtype objects (snake_case in Statamic).
        const primaryCtaRaw = (typeof block.primary_cta === "object" && block.primary_cta !== null)
          ? block.primary_cta as Record<string, unknown>
          : null;
        const secondaryCtaRaw = (typeof block.secondary_cta === "object" && block.secondary_cta !== null)
          ? block.secondary_cta as Record<string, unknown>
          : null;

        const section: CtaSectionData = {
          _key:        key,
          _type:       "ctaSection",
          variant:     extractString(block.variant),
          // `heading` is the Statamic fieldset name; maps to `title` in CtaSectionData.
          title:       typeof block.heading === "string" ? block.heading : undefined,
          // `body` is the Statamic fieldset name; maps to `description` in CtaSectionData.
          description: typeof block.body    === "string" ? block.body    : undefined,
          cta: primaryCtaRaw
            && typeof primaryCtaRaw.label === "string"
            && typeof primaryCtaRaw.href  === "string"
            ? { label: primaryCtaRaw.label, href: primaryCtaRaw.href }
            : undefined,
          secondaryCta: secondaryCtaRaw
            && typeof secondaryCtaRaw.label === "string" && secondaryCtaRaw.label
            && typeof secondaryCtaRaw.href  === "string" && secondaryCtaRaw.href
            ? { label: secondaryCtaRaw.label, href: secondaryCtaRaw.href }
            : undefined,
        };
        sections.push(section);
        break;
      }

      case "contact_section": {
        // `ctas` grid — each row: label, href
        const rawCtas = Array.isArray(block.ctas)
          ? block.ctas as Array<Record<string, unknown>>
          : [];
        const section: ContactSectionSectionData = {
          _key:        key,
          _type:       "contactSection",
          variant:     extractString(block.variant),
          heading:     typeof block.heading     === "string" ? block.heading     : undefined,
          description: typeof block.description === "string" ? block.description : undefined,
          address:     typeof block.address     === "string" ? block.address     : undefined,
          phone:       typeof block.phone       === "string" ? block.phone       : undefined,
          email:       typeof block.email       === "string" ? block.email       : undefined,
          hours:       typeof block.hours       === "string" ? block.hours       : undefined,
          // Statamic fieldset uses `map_url` (snake_case).
          mapUrl:      typeof block.map_url     === "string" ? block.map_url     : undefined,
          ctas: rawCtas
            .filter((c) => typeof c.label === "string" && typeof c.href === "string")
            .map((c) => ({
              label: c.label as string,
              href:  c.href  as string,
            })),
        };
        sections.push(section);
        break;
      }

      case "floating_contact": {
        const side = extractString(block.side);
        const section: FloatingContactSectionData = {
          _key:     key,
          _type:    "floatingContact",
          variant:  extractString(block.variant),
          phone:    typeof block.phone    === "string" ? block.phone    : undefined,
          email:    typeof block.email    === "string" ? block.email    : undefined,
          whatsapp: typeof block.whatsapp === "string" ? block.whatsapp : undefined,
          side:     side === "left" || side === "right" ? side : undefined,
        };
        sections.push(section);
        break;
      }

      case "form_section": {
        // `form` (Statamic form fieldtype) stores the selected form, but its shape
        // varies: a plain handle string ("appointment"), an ARRAY of handles
        // (["appointment"] — how the CP actually saves it), or an augmented object
        // ({ handle, title, ... }), possibly wrapped in an array. We normalise all
        // of these to the handle. Backward-compat fallback: the old `form_key`.
        // `heading` → title, `subtitle` → intro (display copy above the form).
        const formRaw = block.form as unknown;
        const formCandidate = Array.isArray(formRaw) ? formRaw[0] : formRaw;
        const formKey =
          (typeof formCandidate === "string" ? formCandidate : null) ??
          (formCandidate && typeof formCandidate === "object" &&
           typeof (formCandidate as { handle?: unknown }).handle === "string"
            ? (formCandidate as { handle: string }).handle
            : null) ??
          (typeof block.form_key === "string" ? block.form_key : "");
        if (!formKey) break; // can't render a form without a key

        const section: FormSectionData = {
          _key:    key,
          _type:   "formSection",
          variant: extractString(block.variant),
          formKey,
          title:   typeof block.heading  === "string" ? block.heading  : undefined,
          intro:   typeof block.subtitle === "string" ? block.subtitle : undefined,
        };
        sections.push(section);
        break;
      }

      case "video": {
        // ── Normalise video URL ──────────────────────────────────────────────
        // Accepts:
        //   bare YouTube ID          "uER64JbBd7M"
        //   youtube.com/watch?v=ID   "https://www.youtube.com/watch?v=uER64JbBd7M"
        //   youtu.be/ID             "https://youtu.be/uER64JbBd7M"
        //   YouTube embed URL        "https://www.youtube.com/embed/uER64JbBd7M"
        //   vimeo.com/ID             "https://vimeo.com/76979871"
        //   Vimeo player URL         "https://player.vimeo.com/video/76979871"
        //   native video URL         "https://example.com/video.mp4"
        function normaliseYouTubeId(raw: string): string | null {
          if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
          const ytWatch  = raw.match(/[?&]v=([A-Za-z0-9_-]{11})/);
          if (ytWatch) return ytWatch[1];
          const ytShorts = raw.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/);
          if (ytShorts) return ytShorts[1];
          const ytShort  = raw.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
          if (ytShort) return ytShort[1];
          const ytEmbed  = raw.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/);
          if (ytEmbed) return ytEmbed[1];
          return null;
        }

        function normaliseVimeoId(raw: string): string | null {
          const vimeoMatch = raw.match(/(?:vimeo\.com\/)(\d+)/) ?? raw.match(/^(\d+)$/);
          return vimeoMatch ? vimeoMatch[1] : null;
        }

        let videoUrl:  string | undefined;
        let platform:  VideoSectionData["platform"];

        // ── New fieldset structure (video_source + source-specific field) ────
        const rawSource = extractString(block.video_source);

        if (rawSource === "youtube" || (!rawSource && typeof block.video_id === "string" && block.video_id)) {
          // New: video_source = "youtube" with video_id field
          const rawId = typeof block.video_id === "string" ? block.video_id.trim() : "";
          const ytId  = rawId ? normaliseYouTubeId(rawId) : null;
          if (ytId) { videoUrl = `https://www.youtube.com/embed/${ytId}`; platform = "youtube"; }

        } else if (rawSource === "vimeo") {
          // New: video_source = "vimeo" with vimeo_id field
          const rawId    = typeof block.vimeo_id === "string" ? block.vimeo_id.trim() : "";
          const vimeoId  = rawId ? normaliseVimeoId(rawId) : null;
          if (vimeoId) { videoUrl = `https://player.vimeo.com/video/${vimeoId}`; platform = "vimeo"; }

        } else if (rawSource === "upload") {
          // New: video_source = "upload" with video_file asset
          const assetUrl = resolveAssetUrl(block.video_file);
          if (assetUrl) { videoUrl = assetUrl; platform = "native"; }

        } else {
          // Legacy fallback: bare video_url text field (old fieldset)
          const rawUrl = typeof block.video_url === "string" ? block.video_url.trim() : "";
          if (rawUrl) {
            const ytId = normaliseYouTubeId(rawUrl);
            if (ytId) {
              videoUrl = `https://www.youtube.com/embed/${ytId}`;
              platform = "youtube";
            } else {
              const vimeoId = normaliseVimeoId(rawUrl);
              if (vimeoId && !rawUrl.includes("player.vimeo.com")) {
                videoUrl = `https://player.vimeo.com/video/${vimeoId}`;
                platform = "vimeo";
              } else if (rawUrl.includes("player.vimeo.com") || rawUrl.includes("vimeo.com")) {
                videoUrl = rawUrl;
                platform = "vimeo";
              } else {
                videoUrl = rawUrl;
                platform = "native";
              }
            }
          }
        }

        if (!videoUrl) break; // nothing to render without a URL

        // ── Poster image ─────────────────────────────────────────────────────
        // New fieldset: video_poster (assets). Legacy fieldset: thumbnail (text URL).
        const posterUrl =
          resolveAssetUrl(block.video_poster) ??
          (typeof block.thumbnail === "string" && block.thumbnail ? block.thumbnail : undefined);

        const section: VideoSectionData = {
          _key:     key,
          _type:    "video",
          variant:  extractString(block.variant),
          title:    typeof block.title === "string" && block.title ? block.title : undefined,
          videoUrl,
          platform,
          posterUrl,
          caption:  typeof block.caption === "string" && block.caption ? block.caption : undefined,
          autoPlay: block.video_autoplay === true,
          loop:     block.video_loop     === true,
        };
        sections.push(section);
        break;
      }

      case "related_content": {
        const sourceMode = typeof block.source_mode === "string" ? block.source_mode : "manual";

        if (sourceMode === "automatic") {
          // ── Collection-driven mode ─────────────────────────────────────────
          const collectionHandle = typeof block.collection === "string" && block.collection
            ? block.collection
            : undefined;
          if (!collectionHandle) break; // nothing to show without a collection

          const rawMax = block.max_items;
          const maxItems = typeof rawMax === "number"
            ? rawMax
            : (typeof rawMax === "string" ? parseInt(rawMax, 10) : 3);
          const limit = isNaN(maxItems) ? 3 : maxItems;

          const section: RelatedContentData = {
            _key:    key,
            _type:   "relatedContent",
            variant: extractString(block.variant),
            heading: typeof block.heading === "string" && block.heading ? block.heading : undefined,
            items:   [],  // resolved at render time via contentSource
            maxItems: limit,
            contentSource: {
              source:     "collection",
              collection: collectionHandle as CmsCollectionKey,
              mode:       "recent",
              limit,
              sortDir:    "desc",
            },
          };
          sections.push(section);
          break;
        }

        // ── Manual mode — `entries` is a Statamic `entries` field ─────────────
        // Each entry in the array contains at minimum: id, title, url / permalink.
        const rawEntries = Array.isArray(block.entries)
          ? block.entries as Array<Record<string, unknown>>
          : [];

        const section: RelatedContentData = {
          _key:    key,
          _type:   "relatedContent",
          variant: extractString(block.variant),
          heading: typeof block.heading === "string" && block.heading ? block.heading : undefined,
          items:   rawEntries.map((entry, i): CmsRelatedItem => ({
            _key:     typeof entry.id === "string" && entry.id ? entry.id : `related_${i}`,
            id:       typeof entry.id === "string" && entry.id ? entry.id : undefined,
            title:    typeof entry.title === "string" ? entry.title : "",
            href:     typeof entry.url === "string" && entry.url
                        ? entry.url
                        : (typeof entry.permalink === "string" && entry.permalink
                            ? entry.permalink
                            : "#"),
            // Prefer `excerpt`; fall back to `description` (used in some collection types).
            excerpt:  typeof entry.excerpt    === "string" && entry.excerpt
                        ? entry.excerpt
                        : (typeof entry.description === "string" && entry.description
                            ? entry.description
                            : undefined),
            // Image: prefer `overview_image` (the standard card-thumbnail field set via
            // the page/entry Media tab), then fall back to legacy field names.
            imageUrl: resolveAssetUrl(
              (  entry.overview_image
              ?? entry.featured_image
              ?? entry.image
              ?? entry.thumbnail
              ) as unknown
            ),
            hoverImageUrl: resolveAssetUrl(entry.overview_image_hover as unknown) ?? undefined,
            imageAlt: typeof entry.image_alt === "string" && entry.image_alt
                        ? entry.image_alt
                        : (typeof entry.alt === "string" ? entry.alt : undefined),
            category: typeof entry.category === "string" && entry.category ? entry.category : undefined,
            date:     typeof entry.date       === "string" && entry.date     ? entry.date     : undefined,
          })),
          contentSource: { source: "manual" },
        };
        sections.push(section);
        break;
      }

      case "listing": {
        // ── Media slider items ────────────────────────────────────────────────
        // `media_items` is a Replicator field with a single "slide" set.
        // Only present when variant === "listing_slider"; safely empty otherwise.
        const rawMediaItems = Array.isArray(block.media_items)
          ? block.media_items as Array<Record<string, unknown>>
          : [];

        const mediaItems: CmsSliderMediaItem[] = rawMediaItems.map((slide, i): CmsSliderMediaItem => {
          const slideKey = typeof slide.id === "string" && slide.id
            ? slide.id
            : `slide_${i}`;
          const rawMt = extractString(slide.media_type) ?? "image";
          const mediaType = rawMt === "video" ? "video" : "image";

          if (mediaType === "image") {
            return {
              _key:      slideKey,
              mediaType: "image",
              imageUrl:  resolveAssetUrl(slide.image),
              alt:       typeof slide.alt     === "string" ? slide.alt     : undefined,
              caption:   typeof slide.caption === "string" ? slide.caption : undefined,
            };
          }

          // ── Video slide ───────────────────────────────────────────────────
          const rawVs = extractString(slide.video_source) ?? "youtube";
          const videoSource = (rawVs === "vimeo" || rawVs === "upload")
            ? rawVs
            : "youtube" as const;

          return {
            _key:        slideKey,
            mediaType:   "video",
            videoSource,
            videoId:     videoSource === "youtube"
                           ? (typeof slide.video_id === "string" ? slide.video_id : undefined)
                           : undefined,
            vimeoId:     videoSource === "vimeo"
                           ? (typeof slide.vimeo_id === "string" ? slide.vimeo_id : undefined)
                           : undefined,
            videoUrl:    videoSource === "upload"
                           ? resolveAssetUrl(slide.video_file)
                           : undefined,
            posterUrl:   resolveAssetUrl(slide.poster),
            autoplay:    slide.autoplay === true,
            caption:     typeof slide.caption === "string" ? slide.caption : undefined,
          };
        });

        const section: ListingSectionData = {
          _key:        key,
          _type:       "listing",
          variant:     extractString(block.variant),
          heading:     typeof block.heading === "string" && block.heading ? block.heading : undefined,
          items:       [],   // populated at render time via collection resolver
          contentSource: { source: "manual" },
          mediaItems:  mediaItems.length > 0 ? mediaItems : undefined,
        };
        sections.push(section);
        break;
      }

      case "collection_listing": {
        // ── Map Statamic collection handle → platform CollectionKey ───────────
        // Statamic fieldset uses the collection's own handle (e.g. "blog"),
        // while the platform uses semantic keys (e.g. "articles").
        const cmsToPlatformCollection: Record<string, import("@/page-config/collection-source").CollectionKey> = {
          blog:         "articles",
          vacancies:    "vacancies",
          case_studies: "cases",
          team_members: "team_members",
          events:       "events",
        };
        const collectionKey =
          cmsToPlatformCollection[extractString(block.collection) ?? ""] ?? "articles";

        const sortDir: import("@/page-config/collection-source").CollectionSortDir =
          extractString(block.sort_direction) === "asc" ? "asc" : "desc";

        const limit =
          typeof block.limit === "number" && block.limit > 0 ? block.limit : undefined;

        // ── Pinned entries (shown first) ──────────────────────────────────────
        // The Statamic entries fieldtype returns an array of entry objects or IDs.
        // Extract the id/slug from each entry so the collection resolver can
        // filter and re-sort them.
        const rawPinned = Array.isArray(block.pinned_entries) ? block.pinned_entries : [];
        const pinnedIds = rawPinned
          .map((e: unknown) => {
            if (typeof e === "string") return e;
            if (e && typeof e === "object") {
              const obj = e as Record<string, unknown>;
              return (typeof obj.id === "string" && obj.id) ||
                     (typeof obj.slug === "string" && obj.slug) ||
                     "";
            }
            return "";
          })
          .filter(Boolean);

        const contentSource: CmsCollectionSource = pinnedIds.length > 0
          ? { source: "collection", collection: collectionKey as CmsCollectionKey, mode: "specific", selectedIds: pinnedIds, sortDir }
          : { source: "collection", collection: collectionKey as CmsCollectionKey, mode: "recent",   limit,                  sortDir };

        const introRaw = extractString(block.intro);

        const clSection: ListingSectionData = {
          _key:    key,
          _type:   "listing",
          variant: extractString(block.variant) ?? "listing_cards",
          heading: typeof block.heading === "string" && block.heading ? block.heading : undefined,
          intro:   introRaw || undefined,
          items:   [],  // populated at render time by resolveListingItems()
          contentSource,
        };
        sections.push(clSection);
        break;
      }

      // All other known Statamic block types are silently skipped for now.
      // Add additional cases here when the corresponding PageSectionData type
      // and renderer are wired up for the Statamic content block set.
      default:
        break;
    }

    // ── Post-process: anchor ID ───────────────────────────────────────────────
    // After any successful section push, forward anchor_id from the raw block
    // onto the newly added section.  This avoids repeating the same three lines
    // in every switch case above.
    const lastSection = sections[sections.length - 1];
    if (
      lastSection &&
      typeof block.anchor_id === "string" &&
      block.anchor_id.trim()
    ) {
      (lastSection as PageSectionBase).anchorId = block.anchor_id.trim();
    }

    // ── Post-process: block-level token set ───────────────────────────────────
    // Forward the authored `token_set` key (and optional inline `tokens`) onto
    // the section so ContentBlockRenderer can scope its design tokens.
    if (lastSection) {
      // Statamic's REST API augments a `select` field into an object
      // ({ value, label, key }) rather than a bare string. Accept both shapes:
      // read the string directly, or pull `.value`/`.key` from the object.
      const rawTs: unknown = block.token_set;
      let tsKey = "";
      if (typeof rawTs === "string") {
        tsKey = rawTs;
      } else if (rawTs && typeof rawTs === "object") {
        const o = rawTs as { value?: unknown; key?: unknown };
        if (typeof o.value === "string") tsKey = o.value;
        else if (typeof o.key === "string") tsKey = o.key;
      }
      if (tsKey.trim()) {
        (lastSection as PageSectionBase).tokenSet = tsKey.trim();
      }
      if (block.tokens && typeof block.tokens === "object" && !Array.isArray(block.tokens)) {
        (lastSection as PageSectionBase).tokens =
          block.tokens as PageSectionBase["tokens"];
      }
    }
  }

  return sections;
}
