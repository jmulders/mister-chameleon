/**
 * render-block-html
 *
 * Server-side rendering of an adaptive variant to a SELF-CONTAINED HTML string,
 * for the snippet's block mode (data-mc-block). Unlike the platform's own React
 * block components (Tailwind classes that only exist on our site), this output
 * is injected into an ARBITRARY external page (a WordPress site, etc.), so it
 * carries all its styling inline.
 *
 * Theming: colours/spacing reference CSS custom properties (`var(--primary)`,
 * `var(--hero-bg)`, …) with hard-coded fallbacks. The decide route sets those
 * variables on the `data-mc-block` container (via BlockSlot.tokens, sourced from
 * the tenant's active theme), so the block adopts the tenant's look while still
 * rendering acceptably if a variable is missing.
 *
 * All variant text is treated as untrusted. Titles, labels, and most fields are
 * HTML-escaped. The four descriptive copy fields (hero subtitle, proof text,
 * feature body, cta text) go through renderInlineMarkup, which is itself
 * escape-first and emits only an allowlist of inline tags — so raw markup is
 * never injected on either path.
 */

import type {
  HeroBlockData,
  ProofBlockData,
  ProofItem,
  CTABlockData,
  FeatureBlockData,
  FeatureItem,
  ConversionBlockData,
  NotificationBlockData,
} from "@/cms/types";
import type { ResolvedForm } from "@/forms/context/types";
import type { FormField } from "@/forms/types";
import { renderInlineMarkup } from "@/lib/blocks/inline-markup";
import {
  isRenderableMedia,
  youtubeEmbedSrc,
  vimeoEmbedSrc,
  youtubeThumbUrl,
  safeObjectPosition,
  MEDIA_IFRAME_ALLOW,
  type BlockMedia,
} from "@/lib/media/block-media";
import { heroBannerMediaToBlockMedia } from "@/lib/media/hero-banner-to-block-media";
import type { BlockCTA } from "@/page-config/types";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Escape a string for safe interpolation into HTML text / attribute context. */
export function escapeHtml(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Only allow http(s), root-relative, mailto and tel hrefs — never javascript:. */
function safeHref(href: unknown): string {
  const s = String(href ?? "").trim();
  if (!s) return "#";
  if (/^(https?:\/\/|\/|mailto:|tel:|#)/i.test(s)) return escapeHtml(s);
  return "#";
}

const WRAP =
  "box-sizing:border-box;max-width:1120px;margin:0 auto;padding:clamp(24px,5vw,56px) clamp(16px,4vw,32px);" +
  // Inherit the host page's typography so the block reads as native to the site.
  // Colours/radius still come from the tenant's design tokens (scoped vars).
  "font-family:inherit;";

/** A primary button. */
function button(label: string, href: unknown, variant: "primary" | "ghost" = "primary"): string {
  const base =
    "display:inline-block;padding:12px 22px;border-radius:var(--btn-radius,var(--radius-interactive,8px));" +
    "font-weight:600;font-size:15px;text-decoration:none;line-height:1;transition:opacity .15s;";
  const style = variant === "primary"
    ? base + "background:var(--primary,#4f46e5);color:var(--primary-text,#fff);border:1px solid transparent;"
    : base + "background:transparent;color:var(--text,#0f172a);border:1px solid var(--border,#e2e8f0);";
  return `<a href="${safeHref(href)}" style="${style}">${escapeHtml(label)}</a>`;
}

// ── Per-block renderers ───────────────────────────────────────────────────────

// ── Hero ────────────────────────────────────────────────────────────────────
//
// The snippet honours the hero layoutVariant for the media-bearing layouts (the
// split family, background, page banner) and renders the carousel as its first
// slide statically. Every text-only / no-media hero falls through to
// renderHeroBase, which is byte-identical to the previous single-layout output
// (no regression). Media reuses the shared stack: heroBannerMediaToBlockMedia
// converts the legacy HeroBannerMedia to BlockMedia, then ctaMediaInner renders
// it (image / asset video / YouTube-Vimeo click-to-load facade wired by
// mcWireVideoFacades). Background video is a muted autoplay embed (not a facade),
// matching the platform intent for full-bleed backgrounds.

/** Uppercase pill badge for the hero tag (matches renderHeroBase). */
function heroTagBadge(tag: string): string {
  return (
    `<span style="display:inline-block;background:var(--accent,rgba(255,255,255,.12));color:var(--primary,#c7d2fe);` +
    `border-radius:999px;padding:5px 14px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;margin-bottom:16px;">${escapeHtml(tag)}</span>`
  );
}

/** Primary + ghost hero CTA buttons (matches renderHeroBase). */
function heroButtonsHtml(d: HeroBlockData): string {
  return (d.ctas ?? [])
    .filter((c) => c && c.label)
    .map((c, i) => button(c.label!, c.href, i === 0 ? "primary" : "ghost"))
    .join("");
}

/** The original single centered hero layout. Kept byte-identical for no-media heroes. */
function renderHeroBase(d: HeroBlockData): string {
  const ctas = (d.ctas ?? []).filter((c) => c && c.label);
  const buttons = ctas
    .map((c, i) => button(c.label!, c.href, i === 0 ? "primary" : "ghost"))
    .join("");
  return (
    `<section style="background:var(--hero-bg,#0f172a);color:var(--hero-title-color,#fff);">` +
      `<div style="${WRAP}text-align:center;">` +
        (d.tag
          ? `<span style="display:inline-block;background:var(--accent,rgba(255,255,255,.12));color:var(--primary,#c7d2fe);` +
            `border-radius:999px;padding:5px 14px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;margin-bottom:16px;">${escapeHtml(d.tag)}</span>`
          : "") +
        (d.title
          ? `<h1 style="font-family:inherit;font-size:clamp(28px,5vw,46px);line-height:1.1;font-weight:800;margin:0 0 14px;">${escapeHtml(d.title)}</h1>`
          : "") +
        (d.subtitle
          ? `<p style="color:var(--hero-subtitle-color,#94a3b8);font-size:clamp(16px,2.2vw,19px);line-height:1.5;max-width:64ch;margin:0 auto 24px;">${renderInlineMarkup(d.subtitle)}</p>`
          : "") +
        (buttons ? `<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;">${buttons}</div>` : "") +
      `</div>` +
    `</section>`
  );
}

/** hero_split family: media beside the text + CTAs; wraps (stacks) on mobile. */
function renderHeroSplit(d: HeroBlockData, media: BlockMedia): string {
  const buttons = heroButtonsHtml(d);
  return (
    `<section style="background:var(--hero-bg,#0f172a);color:var(--hero-title-color,#fff);">` +
      `<div style="${WRAP}display:flex;flex-wrap:wrap;align-items:center;gap:clamp(24px,4vw,48px);">` +
        `<div style="flex:1 1 320px;min-width:0;">` +
          (d.tag ? heroTagBadge(d.tag) : "") +
          (d.title ? `<h1 style="font-family:inherit;font-size:clamp(28px,4.5vw,44px);line-height:1.1;font-weight:800;margin:0 0 14px;">${escapeHtml(d.title)}</h1>` : "") +
          (d.subtitle ? `<p style="color:var(--hero-subtitle-color,#94a3b8);font-size:clamp(16px,2.2vw,19px);line-height:1.5;max-width:48ch;margin:0 0 24px;">${renderInlineMarkup(d.subtitle)}</p>` : "") +
          (buttons ? `<div style="display:flex;flex-wrap:wrap;gap:12px;">${buttons}</div>` : "") +
        `</div>` +
        `<div style="flex:1 1 320px;position:relative;aspect-ratio:16/9;overflow:hidden;border-radius:var(--card-radius,14px);background:#000;">${ctaMediaInner(media)}</div>` +
      `</div>` +
    `</section>`
  );
}

/** Full-bleed hero background media (muted autoplay video, not a facade) + overlay. */
function heroBackgroundMediaInner(media: BlockMedia): string {
  const source = media.source ?? "asset";
  const fill   = `position:absolute;inset:0;width:100%;height:100%;`;
  if (media.kind === "image") {
    return `<img src="${safeHref(media.url)}" alt="${escapeHtml(media.alt ?? "")}" loading="lazy" style="${fill}object-fit:cover;">`;
  }
  if (source === "asset") {
    const poster = media.poster ? ` poster="${safeHref(media.poster)}"` : "";
    return `<video src="${safeHref(media.url)}"${poster} autoplay muted loop playsinline style="${fill}object-fit:cover;"></video>`;
  }
  // YouTube / Vimeo background: muted autoplay embed (no click facade for a
  // full-bleed background, per the platform intent).
  const src = source === "youtube"
    ? youtubeEmbedSrc(media.id ?? "", { autoplay: true })
    : vimeoEmbedSrc(media.id ?? "", { autoplay: true });
  return `<iframe src="${escapeHtml(src)}" allow="${escapeHtml(MEDIA_IFRAME_ALLOW)}" style="${fill}border:0;" title="Background video"></iframe>`;
}

function renderHeroBackground(d: HeroBlockData, media: BlockMedia): string {
  const buttons = heroButtonsHtml(d);
  return (
    `<section style="position:relative;overflow:hidden;background:var(--hero-bg,#0f172a);color:#fff;">` +
      `<div aria-hidden="true" style="position:absolute;inset:0;">${heroBackgroundMediaInner(media)}</div>` +
      `<div aria-hidden="true" style="position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,.4) 0%,rgba(0,0,0,.65) 100%);"></div>` +
      `<div style="${WRAP}position:relative;text-align:center;">` +
        (d.tag ? heroTagBadge(d.tag) : "") +
        (d.title ? `<h1 style="font-family:inherit;font-size:clamp(28px,5vw,46px);line-height:1.1;font-weight:800;margin:0 0 14px;">${escapeHtml(d.title)}</h1>` : "") +
        (d.subtitle ? `<p style="font-size:clamp(16px,2.2vw,19px);line-height:1.5;opacity:.92;max-width:60ch;margin:0 auto 24px;">${renderInlineMarkup(d.subtitle)}</p>` : "") +
        (buttons ? `<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;">${buttons}</div>` : "") +
      `</div>` +
    `</section>`
  );
}

/** hero_page_banner: compact page header with media on a side. */
function renderHeroPageBanner(d: HeroBlockData, media: BlockMedia): string {
  const buttons = heroButtonsHtml(d);
  return (
    `<section style="background:var(--hero-bg,#0f172a);color:#fff;">` +
      `<div style="box-sizing:border-box;max-width:1120px;margin:0 auto;padding:clamp(20px,4vw,36px) clamp(16px,4vw,32px);font-family:inherit;` +
      `display:flex;flex-wrap:wrap;align-items:center;gap:clamp(20px,4vw,40px);justify-content:space-between;">` +
        `<div style="flex:1 1 320px;min-width:0;">` +
          (d.tag ? heroTagBadge(d.tag) : "") +
          (d.title ? `<h1 style="font-family:inherit;font-size:clamp(22px,3.2vw,32px);line-height:1.15;font-weight:800;margin:0 0 8px;">${escapeHtml(d.title)}</h1>` : "") +
          (d.subtitle ? `<p style="color:var(--hero-subtitle-color,#94a3b8);font-size:clamp(15px,2vw,17px);line-height:1.5;margin:0 0 16px;">${renderInlineMarkup(d.subtitle)}</p>` : "") +
          (buttons ? `<div style="display:flex;flex-wrap:wrap;gap:10px;">${buttons}</div>` : "") +
        `</div>` +
        `<div style="flex:0 1 340px;min-width:240px;position:relative;aspect-ratio:16/9;overflow:hidden;border-radius:var(--card-radius,14px);background:#000;">${ctaMediaInner(media)}</div>` +
      `</div>` +
    `</section>`
  );
}

function renderHero(d: HeroBlockData): string {
  const layout = d.layoutVariant ?? "";

  // Carousel: render the first slide statically (no autoplay runtime on the
  // snippet). The slide becomes a hero_split when it has media, else the base.
  if (layout === "hero_carousel" && d.slides && d.slides.length > 0) {
    const s = d.slides[0];
    const slideHero: HeroBlockData = {
      id:            d.id,
      title:         s.heading ?? d.title,
      subtitle:      s.subheading ?? d.subtitle,
      tag:           d.tag,
      ctas:          s.ctaLabel && s.ctaUrl ? [{ label: s.ctaLabel, href: s.ctaUrl }] : d.ctas,
      ...(s.media ? { media: s.media } : {}),
      layoutVariant: s.media ? "hero_split" : "",
    };
    return renderHero(slideHero);
  }

  // Media-bearing layouts. No renderable media falls through to the base render,
  // so text-only heroes stay byte-identical.
  const media = heroBannerMediaToBlockMedia(d.media);
  if (isRenderableMedia(media)) {
    if (layout === "hero_split" || layout === "hero_split_clean" || layout === "hero_dark_split") return renderHeroSplit(d, media);
    if (layout === "hero_background") return renderHeroBackground(d, media);
    if (layout === "hero_page_banner") return renderHeroPageBanner(d, media);
  }
  return renderHeroBase(d);
}

// ── Spotlight variants (proof_spotlight / feature_spotlight) ────────────────────
//
// Mirror the platform ProofSpotlightCard / FeatureSpotlightCard: media beside the
// text, media side via CSS order, wraps (stacks) on mobile. Reuses ctaMediaInner
// (image / asset video / YouTube-Vimeo click-to-load facade wired by the snippet
// runtime), exactly like the CTA and notification media paths. Only taken when at
// least one item carries renderable media; without media renderProof/renderFeature
// keep their original card-grid output (byte-identical).

/** A spotlight media column sized 16/9, positioned by mediaSide via CSS order. */
function spotlightMediaCol(media: BlockMedia, mediaSide: "left" | "right" | undefined, sideVar: string): string {
  const order = mediaSide === "left" ? "-1" : mediaSide === "right" ? "1" : sideVar;
  return (
    `<div style="flex:1 1 300px;order:${order};position:relative;aspect-ratio:16/9;overflow:hidden;` +
    `border-radius:var(--card-radius,14px);background:#000;">${ctaMediaInner(media)}</div>`
  );
}

/** Vertical gap between stacked spotlight rows. */
const SPOTLIGHT_GAP = `<div style="height:clamp(32px,5vw,56px);"></div>`;

function renderProofSpotlightItem(i: ProofItem): string {
  const mediaCol = isRenderableMedia(i.media)
    ? spotlightMediaCol(i.media, i.mediaSide, "var(--proof-spotlight-media-side, 1)")
    : "";
  const attribution = (i.name || i.role || i.organisation)
    ? `<div style="margin-top:16px;">` +
        (i.name ? `<div style="font-weight:700;color:var(--text,#0f172a);">${escapeHtml(i.name)}</div>` : "") +
        ((i.role || i.organisation)
          ? `<div style="font-size:14px;color:var(--muted-foreground,#64748b);">${escapeHtml([i.role, i.organisation].filter(Boolean).join(" · "))}</div>`
          : "") +
      `</div>`
    : "";
  const textCol =
    `<div style="flex:1 1 300px;">` +
      `<div aria-hidden="true" style="font-size:40px;line-height:1;color:var(--proof-quote-color,var(--primary,#4f46e5));">&ldquo;</div>` +
      (i.text ? `<div style="font-size:clamp(18px,2.4vw,22px);line-height:1.5;font-style:italic;color:var(--text,#0f172a);margin-top:6px;">${renderInlineMarkup(i.text)}</div>` : "") +
      attribution +
    `</div>`;
  return `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:clamp(24px,4vw,48px);">${mediaCol}${textCol}</div>`;
}

function renderProofSpotlight(d: ProofBlockData): string {
  const items = (d.items ?? []).filter((i) => i && (i.text || i.title || isRenderableMedia(i.media)));
  const rows = items.map(renderProofSpotlightItem).join(SPOTLIGHT_GAP);
  return (
    `<section style="background:var(--bg,#fff);color:var(--text,#0f172a);">` +
      `<div style="${WRAP}">` +
        (d.title ? `<h2 style="font-family:inherit;font-size:clamp(22px,3.5vw,32px);font-weight:800;text-align:center;margin:0 0 28px;">${escapeHtml(d.title)}</h2>` : "") +
        rows +
      `</div>` +
    `</section>`
  );
}

function renderProof(d: ProofBlockData): string {
  // proof_spotlight with media: render the media/quote split (mirrors the
  // platform). Without media (or any other layout) keep the card grid below.
  if (d.layoutVariant === "proof_spotlight" && (d.items ?? []).some((i) => isRenderableMedia(i?.media))) {
    return renderProofSpotlight(d);
  }
  const items = (d.items ?? []).filter((i) => i && (i.title || i.text));
  const cards = items
    .map(
      (i) =>
        `<div style="flex:1 1 240px;background:var(--card-bg,#fff);border:1px solid var(--card-border,#e2e8f0);` +
        `border-radius:var(--card-radius,14px);padding:20px 22px;">` +
          (i.title ? `<div style="font-size:24px;font-weight:800;color:var(--primary,#4f46e5);margin-bottom:6px;">${escapeHtml(i.title)}</div>` : "") +
          (i.text ? `<div style="font-size:14px;line-height:1.55;color:var(--muted-foreground,#64748b);">${renderInlineMarkup(i.text)}</div>` : "") +
        `</div>`,
    )
    .join("");
  return (
    `<section style="background:var(--bg,#fff);color:var(--text,#0f172a);">` +
      `<div style="${WRAP}">` +
        (d.title ? `<h2 style="font-family:inherit;font-size:clamp(22px,3.5vw,32px);font-weight:800;text-align:center;margin:0 0 28px;">${escapeHtml(d.title)}</h2>` : "") +
        `<div style="display:flex;flex-wrap:wrap;gap:16px;">${cards}</div>` +
      `</div>` +
    `</section>`
  );
}

// ── CTA media variants ────────────────────────────────────────────────────────
//
// cta_media_split and cta_media_first mirror the React CtaSectionBlock variants
// (see components/blocks/sections/CtaSectionBlock.tsx). They reuse the same pure
// media helpers (youtubeEmbedSrc / vimeoEmbedSrc / youtubeThumbUrl /
// MEDIA_IFRAME_ALLOW) and renderInlineMarkup as the platform. YouTube/Vimeo use a
// privacy facade: the poster is shown and NO third-party iframe/request fires
// until the visitor clicks — the snippet runtime wires the click-to-load (see
// lib/snippet/snippet-source.ts, wireVideoFacades). Base CTA is byte-identical.

/** Map a CTA's style/variant to solid | outline | ghost, mirroring CTAGroup. */
function ctaButtonKind(cta: BlockCTA, isPrimary: boolean): "solid" | "outline" | "ghost" {
  if (cta.style) return cta.style;
  switch (cta.variant) {
    case "outline": return "outline";
    case "ghost":
    case "link":    return "ghost";
    case "primary":
    case "secondary": return "solid";
    default: return isPrimary ? "solid" : "outline";
  }
}

/** One styled CTA anchor, mirroring the CTAGroup button styles (inline for the snippet). */
function ctaButton(cta: BlockCTA, isPrimary: boolean, inverted: boolean): string {
  const kind = ctaButtonKind(cta, isPrimary);
  const base =
    "display:inline-block;padding:13px 26px;border-radius:var(--btn-radius,var(--radius-interactive,8px));" +
    "font-weight:700;font-size:15px;text-decoration:none;line-height:1;";
  let skin: string;
  if (kind === "solid") {
    skin = inverted
      ? "background:var(--card-bg,#fff);color:var(--primary,#4f46e5);border:1px solid transparent;"
      : "background:var(--primary,#4f46e5);color:var(--primary-text,#fff);border:1px solid transparent;";
  } else if (kind === "outline") {
    skin = inverted
      ? "background:transparent;color:#fff;border:1px solid rgba(255,255,255,.6);"
      : "background:transparent;color:var(--primary,#4f46e5);border:1px solid var(--primary,#4f46e5);";
  } else {
    skin = inverted
      ? "background:transparent;color:#fff;border:1px solid transparent;"
      : "background:transparent;color:var(--primary,#4f46e5);border:1px solid transparent;";
  }
  return `<a href="${safeHref(cta.href)}" style="${base}${skin}">${escapeHtml(cta.label)}</a>`;
}

/** The buttons row for a CTA: up to 2 from `ctas`, else the single base `cta`. */
function ctaButtonsHtml(d: CTABlockData, inverted: boolean, align: "start" | "center"): string {
  const list: BlockCTA[] = (d.ctas ?? []).filter((c) => c && c.label && c.href).slice(0, 2);
  if (list.length === 0 && d.cta?.label) list.push({ label: d.cta.label, href: d.cta.href });
  if (list.length === 0) return "";
  const buttons = list.map((c, i) => ctaButton(c, i === 0, inverted)).join("");
  const justify = align === "center" ? "center" : "flex-start";
  return `<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:${justify};">${buttons}</div>`;
}

/** Absolute-fill media markup (image / asset video / YouTube-Vimeo facade). */
function ctaMediaInner(media: BlockMedia): string {
  const source = media.source ?? "asset";
  const fit    = media.fit ?? "cover";
  const pos    = safeObjectPosition(media.objectPosition);
  const posCss = pos ? `object-position:${pos};` : "";
  const fill   = `position:absolute;inset:0;width:100%;height:100%;`;

  if (media.kind === "image") {
    return `<img src="${safeHref(media.url)}" alt="${escapeHtml(media.alt ?? "")}" loading="lazy" style="${fill}object-fit:${fit};${posCss}">`;
  }
  if (source === "asset") {
    const poster = media.poster ? ` poster="${safeHref(media.poster)}"` : "";
    return `<video src="${safeHref(media.url)}"${poster} controls playsinline style="${fill}object-fit:${fit};${posCss}background:#000;"></video>`;
  }

  // YouTube / Vimeo privacy facade: poster (authored poster first, else the
  // YouTube thumbnail) + play button, NO iframe until the snippet runtime swaps
  // it in on click (data-mc-video-facade).
  const embedSrc  = source === "youtube" ? youtubeEmbedSrc(media.id ?? "", { autoplay: true }) : vimeoEmbedSrc(media.id ?? "", { autoplay: true });
  const posterSrc = media.poster || (source === "youtube" && media.id ? youtubeThumbUrl(media.id) : "");
  const posterImg = posterSrc ? `<img src="${safeHref(posterSrc)}" alt="" loading="lazy" style="${fill}object-fit:cover;">` : "";
  const play =
    `<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.25);">` +
      `<span style="display:flex;width:64px;height:64px;align-items:center;justify-content:center;border-radius:9999px;background:rgba(255,255,255,.9);box-shadow:0 8px 24px rgba(0,0,0,.3);">` +
        `<svg width="24" height="24" viewBox="0 0 24 24" fill="#111827" aria-hidden="true" style="margin-left:3px;"><path d="M8 5v14l11-7z"/></svg>` +
      `</span>` +
    `</span>`;
  return (
    `<button type="button" data-mc-video-facade data-mc-embed-src="${escapeHtml(embedSrc)}" data-mc-allow="${escapeHtml(MEDIA_IFRAME_ALLOW)}" ` +
    `aria-label="Play video" style="${fill}padding:0;border:0;background:transparent;cursor:pointer;">${posterImg}${play}</button>`
  );
}

/** cta_media_split — media beside the text + buttons; mediaSide via order; wraps on mobile. */
function renderCtaMediaSplit(d: CTABlockData): string {
  const order = d.mediaSide === "left" ? -1 : d.mediaSide === "right" ? 1 : 0;
  const mediaCol = isRenderableMedia(d.media)
    ? `<div style="flex:1 1 300px;order:${order};position:relative;aspect-ratio:16/9;overflow:hidden;border-radius:var(--card-radius,14px);background:#000;">${ctaMediaInner(d.media)}</div>`
    : "";
  return (
    `<section style="background:var(--bg,#fff);color:var(--text,#0f172a);">` +
      `<div style="${WRAP}">` +
        `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:clamp(24px,4vw,48px);">` +
          mediaCol +
          `<div style="flex:1 1 300px;">` +
            (d.title ? `<h2 style="font-family:inherit;font-size:clamp(22px,3.5vw,32px);font-weight:800;margin:0 0 12px;">${escapeHtml(d.title)}</h2>` : "") +
            (d.text ? `<p style="font-size:clamp(15px,2.2vw,18px);line-height:1.55;color:var(--muted-foreground,#64748b);margin:0 0 20px;max-width:56ch;">${renderInlineMarkup(d.text)}</p>` : "") +
            ctaButtonsHtml(d, false, "start") +
          `</div>` +
        `</div>` +
      `</div>` +
    `</section>`
  );
}

/** cta_media_first — media as a dimmed background with overlaid text + buttons. */
function renderCtaMediaFirst(d: CTABlockData): string {
  const bg = isRenderableMedia(d.media)
    ? `<div aria-hidden="true" style="position:absolute;inset:0;opacity:.4;">${ctaMediaInner(d.media)}</div>`
    : "";
  return (
    `<section style="position:relative;overflow:hidden;background:var(--neutral-900,#111827);color:#fff;">` +
      bg +
      `<div aria-hidden="true" style="position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,.3) 0%,rgba(0,0,0,.6) 100%);"></div>` +
      `<div style="${WRAP}position:relative;text-align:center;">` +
        (d.title ? `<h2 style="font-family:inherit;font-size:clamp(24px,4.5vw,40px);font-weight:800;margin:0 0 14px;">${escapeHtml(d.title)}</h2>` : "") +
        (d.text ? `<p style="font-size:clamp(15px,2.2vw,19px);line-height:1.55;opacity:.92;max-width:56ch;margin:0 auto 22px;">${renderInlineMarkup(d.text)}</p>` : "") +
        `<div style="display:flex;justify-content:center;">${ctaButtonsHtml(d, true, "center")}</div>` +
      `</div>` +
    `</section>`
  );
}

function renderCta(d: CTABlockData): string {
  // Media variants mirror the React CtaSectionBlock; every other layout keeps the
  // exact base CTA output below (byte-identical).
  if (d.layoutVariant === "cta_media_split") return renderCtaMediaSplit(d);
  if (d.layoutVariant === "cta_media_first") return renderCtaMediaFirst(d);

  const cta = d.cta;
  return (
    `<section style="background:var(--section-cta-bg,var(--primary,#4f46e5));color:var(--primary-text,#fff);">` +
      `<div style="${WRAP}text-align:center;">` +
        (d.title ? `<h2 style="font-family:inherit;font-size:clamp(22px,4vw,34px);font-weight:800;margin:0 0 12px;">${escapeHtml(d.title)}</h2>` : "") +
        (d.text ? `<p style="font-size:clamp(15px,2.2vw,18px);line-height:1.5;opacity:.92;max-width:56ch;margin:0 auto 22px;">${renderInlineMarkup(d.text)}</p>` : "") +
        (cta && cta.label
          ? `<a href="${safeHref(cta.href)}" style="display:inline-block;background:var(--card-bg,#fff);color:var(--primary,#4f46e5);` +
            `padding:13px 26px;border-radius:var(--btn-radius,var(--radius-interactive,8px));font-weight:700;font-size:15px;text-decoration:none;">${escapeHtml(cta.label)}</a>`
          : "") +
      `</div>` +
    `</section>`
  );
}

function renderFeatureSpotlightItem(i: FeatureItem): string {
  const mediaCol = isRenderableMedia(i.media)
    ? spotlightMediaCol(i.media, i.mediaSide, "var(--feature-spotlight-media-side, 1)")
    : "";
  const hasCta = !!(i.ctaLabel && i.ctaHref);
  const textCol =
    `<div style="flex:1 1 300px;">` +
      (i.title ? `<h3 style="font-family:inherit;font-size:clamp(20px,2.6vw,26px);font-weight:700;margin:0 0 10px;color:var(--text,#0f172a);">${escapeHtml(i.title)}</h3>` : "") +
      (i.body ? `<div style="font-size:clamp(15px,2.2vw,17px);line-height:1.6;color:var(--muted-foreground,#64748b);">${renderInlineMarkup(i.body)}</div>` : "") +
      (i.price ? `<div style="font-size:20px;font-weight:700;margin-top:12px;color:var(--text,#0f172a);">${escapeHtml(i.price)}</div>` : "") +
      (hasCta ? `<div style="margin-top:16px;">${button(i.ctaLabel!, i.ctaHref, "primary")}</div>` : "") +
    `</div>`;
  return `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:clamp(24px,4vw,48px);">${mediaCol}${textCol}</div>`;
}

function renderFeatureSpotlight(d: FeatureBlockData): string {
  const items = (d.items ?? []).filter((i) => i && (i.title || i.body || isRenderableMedia(i.media)));
  const rows = items.map(renderFeatureSpotlightItem).join(SPOTLIGHT_GAP);
  return (
    `<section style="background:var(--feature-grid-bg,var(--bg-subtle,#f8fafc));color:var(--text,#0f172a);">` +
      `<div style="${WRAP}">` +
        (d.title ? `<h2 style="font-family:inherit;font-size:clamp(22px,3.5vw,32px);font-weight:800;text-align:center;margin:0 0 8px;">${escapeHtml(d.title)}</h2>` : "") +
        (d.subtitle ? `<p style="text-align:center;color:var(--muted-foreground,#64748b);font-size:16px;max-width:60ch;margin:0 auto 28px;">${escapeHtml(d.subtitle)}</p>` : "") +
        rows +
      `</div>` +
    `</section>`
  );
}

function renderFeature(d: FeatureBlockData): string {
  // feature_spotlight with media: render the media/offer split (mirrors the
  // platform). Without media (or any other layout) keep the card grid below.
  if (d.layoutVariant === "feature_spotlight" && (d.items ?? []).some((i) => isRenderableMedia(i?.media))) {
    return renderFeatureSpotlight(d);
  }
  const items = (d.items ?? []).filter((i) => i && (i.title || i.body));
  const cards = items
    .map(
      (i) =>
        `<div style="flex:1 1 260px;background:var(--card-bg,#fff);border:1px solid var(--card-border,#e2e8f0);` +
        `border-radius:var(--card-radius,14px);padding:22px 24px;">` +
          (i.title ? `<div style="font-size:17px;font-weight:700;color:var(--text,#0f172a);margin-bottom:8px;">${escapeHtml(i.title)}</div>` : "") +
          (i.body ? `<div style="font-size:14.5px;line-height:1.55;color:var(--muted-foreground,#64748b);">${renderInlineMarkup(i.body)}</div>` : "") +
        `</div>`,
    )
    .join("");
  return (
    `<section style="background:var(--feature-grid-bg,var(--bg-subtle,#f8fafc));color:var(--text,#0f172a);">` +
      `<div style="${WRAP}">` +
        (d.title ? `<h2 style="font-family:inherit;font-size:clamp(22px,3.5vw,32px);font-weight:800;text-align:center;margin:0 0 8px;">${escapeHtml(d.title)}</h2>` : "") +
        (d.subtitle ? `<p style="text-align:center;color:var(--muted-foreground,#64748b);font-size:16px;max-width:60ch;margin:0 auto 28px;">${escapeHtml(d.subtitle)}</p>` : "") +
        `<div style="display:flex;flex-wrap:wrap;gap:16px;">${cards}</div>` +
      `</div>` +
    `</section>`
  );
}

function renderConversion(d: ConversionBlockData): string {
  const ctas = (d.ctas ?? []).filter((c) => c && c.label);
  const buttons = ctas.map((c, i) => button(c.label!, c.href, i === 0 ? "primary" : "ghost")).join("");
  return (
    `<section style="background:var(--bg,#fff);color:var(--text,#0f172a);">` +
      `<div style="${WRAP}text-align:center;max-width:760px;">` +
        (d.urgencyLabel
          ? `<span style="display:inline-block;background:var(--accent,#eef2ff);color:var(--primary,#4f46e5);border-radius:999px;` +
            `padding:5px 14px;font-size:12px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;margin-bottom:14px;">${escapeHtml(d.urgencyLabel)}</span>`
          : "") +
        (d.title ? `<h2 style="font-family:inherit;font-size:clamp(22px,4vw,34px);font-weight:800;margin:0 0 12px;">${escapeHtml(d.title)}</h2>` : "") +
        (d.text ? `<p style="font-size:clamp(15px,2.2vw,18px);line-height:1.5;color:var(--muted-foreground,#64748b);margin:0 auto 22px;">${escapeHtml(d.text)}</p>` : "") +
        (buttons ? `<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;">${buttons}</div>` : "") +
      `</div>` +
    `</section>`
  );
}

function renderNotification(d: NotificationBlockData): string {
  const sev = String(d.severity ?? "info");
  const accent =
    sev === "success" ? "#16a34a" : sev === "warning" ? "#d97706" : sev === "error" ? "#dc2626" : "var(--primary,#4f46e5)";
  const cta = d.ctaLabel
    ? ` <a href="${safeHref(d.ctaHref)}" style="color:${accent};font-weight:700;text-decoration:underline;">${escapeHtml(d.ctaLabel)}</a>`
    : "";
  // Optional media beside the message. mediaSide places it left (default) or right
  // via flex order. YouTube/Vimeo reuse the click-to-load facade (data-mc-video-
  // facade) wired by the snippet runtime. Without media the output below is
  // byte-identical to before (mediaCol is "" and the span keeps its original form).
  const hasMedia   = isRenderableMedia(d.media);
  const mediaOrder = d.mediaSide === "right" ? 1 : -1;
  const mediaCol   = hasMedia && d.media
    ? `<div style="flex:0 0 auto;order:${mediaOrder};position:relative;width:72px;aspect-ratio:16/9;overflow:hidden;border-radius:8px;background:#000;">${ctaMediaInner(d.media)}</div>`
    : "";
  const messageSpan = hasMedia
    ? `<span style="flex:1 1 auto;min-width:0;">${escapeHtml(d.message)}${cta}</span>`
    : `<span>${escapeHtml(d.message)}${cta}</span>`;
  return (
    `<div style="box-sizing:border-box;background:var(--card-bg,#fff);border:1px solid var(--card-border,#e2e8f0);` +
    `border-left:4px solid ${accent};border-radius:10px;padding:14px 18px;display:flex;align-items:center;gap:10px;` +
    `font-family:inherit;color:var(--text,#0f172a);font-size:14.5px;line-height:1.5;">` +
      mediaCol + messageSpan +
    `</div>`
  );
}

// ── Form block ──────────────────────────────────────────────────────────────
//
// A real, working <form> for embedding on an external site. The snippet wires
// the submit (serialise → cross-origin POST to /api/forms/{key} with the siteKey
// → render success/field-errors/redirect). Fields come from a ResolvedForm, so
// the contextual overlay (segment copy + field set) is already applied. All
// dynamic text is HTML-escaped; the honeypot name matches the server's `_hp`.

const FIELD_INPUT =
  "box-sizing:border-box;width:100%;padding:10px 12px;border:1px solid var(--border,#d1d5db);" +
  "border-radius:var(--radius-interactive,8px);font-family:inherit;font-size:15px;" +
  "color:var(--text,#0f172a);background:var(--card-bg,#fff);";
const FIELD_LABEL = "display:block;font-size:13px;font-weight:600;color:var(--text,#0f172a);margin-bottom:5px;";

function renderFormField(f: FormField): string {
  const req     = f.validation?.required ? " required" : "";
  const reqMark = f.validation?.required ? ` <span style="color:var(--primary,#4f46e5)">*</span>` : "";
  const dv      = typeof f.defaultValue === "string" ? f.defaultValue : "";
  const err     = `<div data-mc-error="${escapeHtml(f.key)}" style="display:none;color:#dc2626;font-size:12.5px;margin-top:4px;"></div>`;

  if (f.type === "hidden") {
    return `<input type="hidden" name="${escapeHtml(f.key)}" value="${escapeHtml(dv)}">`;
  }
  if (f.type === "checkbox") {
    return (
      `<div style="margin-bottom:14px;">` +
        `<label style="display:flex;gap:9px;align-items:flex-start;font-size:14px;line-height:1.45;color:var(--text,#0f172a);cursor:pointer;">` +
          `<input type="checkbox" name="${escapeHtml(f.key)}"${f.defaultValue ? " checked" : ""}${req} style="margin-top:2px;flex:0 0 auto;">` +
          `<span>${escapeHtml(f.label)}${reqMark}</span>` +
        `</label>${err}` +
      `</div>`
    );
  }

  const help = f.helpText
    ? `<div style="font-size:12px;color:var(--muted-foreground,#64748b);margin-top:4px;">${escapeHtml(f.helpText)}</div>`
    : "";
  let control: string;
  if (f.type === "select") {
    const opts = (f.options ?? [])
      .map((o) => `<option value="${escapeHtml(o.value)}"${o.value === dv ? " selected" : ""}>${escapeHtml(o.label)}</option>`)
      .join("");
    control = `<select name="${escapeHtml(f.key)}"${req} style="${FIELD_INPUT}">${opts}</select>`;
  } else if (f.type === "textarea") {
    control =
      `<textarea name="${escapeHtml(f.key)}" rows="4"` +
      `${f.placeholder ? ` placeholder="${escapeHtml(f.placeholder)}"` : ""}${req} ` +
      `style="${FIELD_INPUT}resize:vertical;">${escapeHtml(dv)}</textarea>`;
  } else {
    // text | email | tel | url
    control =
      `<input type="${escapeHtml(f.type)}" name="${escapeHtml(f.key)}"` +
      `${f.placeholder ? ` placeholder="${escapeHtml(f.placeholder)}"` : ""}` +
      `${dv ? ` value="${escapeHtml(dv)}"` : ""}${req} style="${FIELD_INPUT}">`;
  }
  return (
    `<div style="margin-bottom:14px;">` +
      `<label style="${FIELD_LABEL}">${escapeHtml(f.label)}${reqMark}</label>` +
      control + help + err +
    `</div>`
  );
}

/** The working, token-styled <form> card (fields + honeypot + Turnstile + submit). */
function renderFormElement(form: ResolvedForm, formKey: string, opts?: { compact?: boolean }): string {
  const fields      = (form.fields ?? []).map(renderFormField).join("");
  const compact     = opts?.compact === true;
  const submitLabel = form.submitLabel || (compact ? "Subscribe" : "Submit");
  const submitStyle =
    "display:block;width:100%;padding:12px 22px;border:1px solid transparent;" +
    "border-radius:var(--btn-radius,var(--radius-interactive,8px));background:var(--primary,#4f46e5);" +
    "color:var(--primary-text,#fff);font-family:inherit;font-weight:700;font-size:15px;cursor:pointer;";
  // Compact (cta_newsletter): no card chrome, no title/intro. The surrounding CTA
  // section already carries the heading + description; here we only need the input,
  // optional Turnstile, and submit, wired identically (data-mc-form + .cf-turnstile).
  const formStyle = compact
    ? ""
    : `background:var(--card-bg,#fff);border:1px solid var(--card-border,var(--border,#e2e8f0));` +
      `border-radius:var(--card-radius,14px);padding:clamp(20px,4vw,32px);`;
  return (
    `<form data-mc-form="${escapeHtml(formKey)}"` +
      `${form.redirectPath ? ` data-mc-redirect="${escapeHtml(form.redirectPath)}"` : ""} novalidate ` +
      `style="${formStyle}">` +
      (!compact && form.title ? `<h2 style="font-family:inherit;font-size:clamp(20px,3vw,26px);font-weight:800;margin:0 0 8px;">${escapeHtml(form.title)}</h2>` : "") +
      (!compact && form.intro ? `<p style="font-size:15px;line-height:1.5;color:var(--muted-foreground,#64748b);margin:0 0 20px;">${escapeHtml(form.intro)}</p>` : "") +
      // Honeypot — must stay empty (server rejects when filled).
      `<input type="text" name="_hp" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0;">` +
      fields +
      // Cloudflare Turnstile widget (only when enabled + site key configured).
      // The snippet loads the Turnstile API and renders this after injection;
      // the widget adds a hidden `cf-turnstile-response` input the submit reads.
      (form.turnstile
        ? `<div class="cf-turnstile" data-sitekey="${escapeHtml(form.turnstile.siteKey)}" style="margin:0 0 16px;"></div>`
        : "") +
      `<button type="submit" style="${submitStyle}">${escapeHtml(submitLabel)}</button>` +
      `<div data-mc-form-status role="status" aria-live="polite" style="margin-top:14px;font-size:14px;line-height:1.5;"></div>` +
    `</form>`
  );
}

/** The contact panel shown alongside the form in a split layout. */
function renderContactPanel(p: NonNullable<NonNullable<ResolvedForm["layout"]>["contactPanel"]>): string {
  const row = (icon: string, inner: string) =>
    `<div style="display:flex;align-items:center;gap:10px;margin-top:10px;font-size:15px;">` +
      `<span aria-hidden="true" style="flex:0 0 auto;opacity:.8;">${icon}</span>${inner}</div>`;
  return (
    `<div style="align-self:center;">` +
      (isRenderableMedia(p.media)
        // New shared media: a bounded panel frame (image or video facade).
        ? `<div style="width:100%;max-width:320px;position:relative;aspect-ratio:16/9;overflow:hidden;border-radius:14px;background:#000;margin-bottom:18px;">${ctaMediaInner(p.media)}</div>`
        : p.photoUrl
          // Legacy photoUrl: keep the round avatar.
          ? `<img src="${safeHref(p.photoUrl)}" alt="" style="width:104px;height:104px;border-radius:9999px;object-fit:cover;margin-bottom:18px;">`
          : "") +
      (p.name ? `<div style="font-family:inherit;font-size:clamp(18px,2.4vw,22px);font-weight:800;">${escapeHtml(p.name)}</div>` : "") +
      (p.role ? `<div style="font-size:14px;color:var(--muted-foreground,#64748b);margin-top:2px;">${escapeHtml(p.role)}</div>` : "") +
      (p.phone ? row("&#9742;", `<a href="tel:${escapeHtml(p.phone)}" style="color:inherit;text-decoration:none;">${escapeHtml(p.phone)}</a>`) : "") +
      (p.email ? row("&#9993;", `<a href="mailto:${escapeHtml(p.email)}" style="color:inherit;text-decoration:none;">${escapeHtml(p.email)}</a>`) : "") +
    `</div>`
  );
}

/**
 * Render a working, token-styled form for the given resolved form + key, in the
 * layout its variant selected (phase 1: single column, or a split with a contact
 * panel on the left/right). The split grid is responsive without media queries.
 */
export function renderForm(form: ResolvedForm, formKey: string): string {
  const formEl  = renderFormElement(form, formKey);
  const layout  = form.layout;
  const panel   = layout?.contactPanel;
  const wrapOpen = `<section style="background:var(--bg,#fff);color:var(--text,#0f172a);">`;

  // Single column (default) — also the fallback when a split has no panel data.
  if (!layout || layout.template === "single" || !panel) {
    return `${wrapOpen}<div style="${WRAP}max-width:560px;">${formEl}</div></section>`;
  }

  const panelEl = renderContactPanel(panel);
  // split-left = panel first, split-right = form first. auto-fit keeps it side by
  // side on wide screens and stacks it on narrow ones without a media query.
  const cols = layout.template === "split-right" ? `${formEl}${panelEl}` : `${panelEl}${formEl}`;
  return (
    `${wrapOpen}<div style="${WRAP}">` +
      `<div style="display:grid;gap:clamp(24px,4vw,48px);grid-template-columns:repeat(auto-fit,minmax(300px,1fr));align-items:stretch;">` +
        cols +
      `</div>` +
    `</div></section>`
  );
}

/**
 * Render the cta_newsletter variant: heading + description on one side, an inline
 * email-capture form on the other. The form is a resolved tenant form, wired by
 * the snippet runtime exactly like a form block (data-mc-form + .cf-turnstile), so
 * it submits through /api/forms/[formKey] with the full pipeline.
 *
 * When `form` is null (no formKey chosen, or resolution failed) it renders the
 * heading only, mirroring the platform NewsletterForm's graceful degradation.
 */
export function renderCtaNewsletter(d: CTABlockData, form: ResolvedForm | null): string {
  const heading =
    (d.title ? `<h2 style="font-family:inherit;font-size:clamp(22px,3.4vw,30px);font-weight:800;margin:0 0 10px;color:var(--text,#0f172a);">${escapeHtml(d.title)}</h2>` : "") +
    (d.text ? `<p style="font-size:clamp(15px,2.2vw,17px);line-height:1.5;color:var(--muted-foreground,#64748b);margin:0;max-width:44ch;">${renderInlineMarkup(d.text)}</p>` : "");
  const formCol = form ? renderFormElement(form, d.formKey ?? "", { compact: true }) : "";

  return (
    `<section style="background:var(--section-subtle-bg,var(--bg,#fff));color:var(--text,#0f172a);` +
      `border-top:1px solid var(--section-subtle-border,var(--border,#e2e8f0));border-bottom:1px solid var(--section-subtle-border,var(--border,#e2e8f0));">` +
      `<div style="${WRAP}display:flex;flex-wrap:wrap;gap:clamp(20px,4vw,48px);align-items:center;justify-content:space-between;">` +
        `<div style="flex:1 1 320px;min-width:0;">${heading}</div>` +
        (formCol ? `<div style="flex:0 1 400px;min-width:280px;">${formCol}</div>` : "") +
      `</div>` +
    `</section>`
  );
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

/**
 * Render a variant to self-contained HTML for the given block slot key.
 * Returns `null` for an unknown key or when the data yields no content.
 */
export function renderBlockHtml(slotKey: string, data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  let html: string;
  switch (slotKey) {
    case "hero":         html = renderHero(data as HeroBlockData); break;
    case "proof":        html = renderProof(data as ProofBlockData); break;
    case "cta":          html = renderCta(data as CTABlockData); break;
    case "feature":      html = renderFeature(data as FeatureBlockData); break;
    case "conversion":   html = renderConversion(data as ConversionBlockData); break;
    case "notification": html = renderNotification(data as NotificationBlockData); break;
    default:             return null;
  }
  // A block with no fields renders to just the empty shell — treat as nothing.
  return /<(h1|h2|p|div|span|a)[ >]/.test(html) && html.replace(/<[^>]+>/g, "").trim() !== ""
    ? html
    : null;
}
