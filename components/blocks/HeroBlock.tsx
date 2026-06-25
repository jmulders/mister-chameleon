import type React from "react";
import Image from "next/image";
import { Container } from "@/components/primitives/Container";
import { Section } from "@/components/primitives/Section";
import { Stack } from "@/components/primitives/Stack";
import { Text } from "@/components/primitives/Text";
import { Badge } from "@/components/ui/Badge";
import { TrackedCTAButton } from "@/components/tracking/TrackedCTAButton";
import { resolveContextBlockVariant } from "@/page-config/block-variants";
import type { HeroLayoutVariant } from "@/page-config/block-variants";
import type { HeroBannerMedia } from "@/cms/types";

/**
 * HeroBlock
 *
 * The primary above-the-fold section. Sets the visitor's first impression
 * and drives the top-of-funnel CTA. Fully driven by CMS content — no
 * business logic or defaults live here.
 *
 * ─── Layout variants ─────────────────────────────────────────────────────────
 *
 *   hero_default      — centered headline and CTA on a dark brand background
 *   hero_split        — text left, media panel right (50/50); falls back to
 *                       decorative gradient when no media is provided
 *   hero_proof        — centered hero + compact social-proof row below the CTA
 *   hero_background   — full-viewport image/video background with a tint overlay;
 *                       title, subtitle, and CTA buttons are overlaid on top.
 *                       Content horizontal alignment is controlled by `contentAlign`
 *                       (left | center | right; default: center).
 *                       Tint colour and opacity are token-driven:
 *                         --hero-overlay-color   (default #000)
 *                         --hero-overlay-opacity  (default 0.45)
 *   hero_minimal_dark — near-black full-width hero; centered content; tight bold
 *                       heading; a narrow brand-glow line below the eyebrow badge.
 *                       No decorative panel. Dark AI family signature variant.
 *   hero_split_clean  — light-background split hero; dark text left; product
 *                       screenshot / illustration right in a framed panel with
 *                       subtle border and shadow. Clean Corporate family.
 *   hero_dark_split   — dark brand background + text left + radial-glow decorative
 *                       panel right. Structured SaaS / Dark AI split entry point.
 *   hero_editorial    — light neutral section; large typographic centered heading;
 *                       generous vertical padding; no panel. Content Blog family.
 *
 * ─── Media support ───────────────────────────────────────────────────────────
 *
 *   media.kind === "image"
 *     → <img> element; object-cover in split panel, contained block below
 *       text for default/proof
 *
 *   media.kind === "video", media.video.source === "upload"
 *     → <video> element with optional autoplay / muted / loop / controls
 *
 *   media.kind === "video", media.video.source === "youtube"
 *     → privacy-enhanced YouTube embed (youtube-nocookie.com/embed/{id})
 *
 *   media.kind === "video", media.video.source === "vimeo"
 *     → Vimeo player embed (player.vimeo.com/video/{id})
 *
 *   media absent → text-only behaviour; all existing variants unchanged
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   title          Required  Primary display headline
 *   subtitle       Required  Supporting paragraph beneath the headline
 *   ctas           Required  0–2 call-to-action buttons
 *                              0 items → no buttons rendered
 *                              1 item  → single primary button
 *                              2 items → primary + secondary button pair
 *   tag            Optional  Small eyebrow label / badge above the headline
 *   ctaKey         Optional  Variant key forwarded to TrackedCTAButton
 *   layoutVariant  Optional  Structural layout key (default: "hero_default")
 *   media          Optional  Image or video attachment; absent = text-only
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --hero-bg                 Section background (default: neutral-950)
 *   --hero-glow-color         Glow decoration colour (default: brand primary)
 *   --hero-glow-opacity       Glow decoration opacity (default: 0.2)
 *   --hero-title-color        Headline text colour (default: neutral-0 / white)
 *   --hero-subtitle-color     Subheadline and micro-copy text colour (default: neutral-400)
 *   --hero-overlay-color      Background-media variant tint colour (default: #000)
 *   --hero-overlay-opacity    Background-media variant tint opacity (default: 0.45)
 *   --font-heading          Heading font family (tenant-overrideable)
 *   --font-heading-weight   Heading font weight (tenant-overrideable; default: 700)
 */

export interface HeroCTAItem {
  label:    string;
  href:     string;
  /** Explicit button style. Defaults to "primary" for idx 0, "secondary" for idx 1. */
  variant?: "primary" | "secondary" | "outline" | "ghost";
}

/** A single trust metric item shown in the hero_proof compact bar. */
export interface HeroProofItem {
  /** Bold value, e.g. "10,000+" or "99.9%" */
  metric: string;
  /** Descriptive label, e.g. "customers" or "uptime SLA" */
  label: string;
}

export interface HeroBlockProps {
  /** Primary display headline */
  title: string;
  /** Supporting paragraph beneath the headline */
  subtitle: string;
  /**
   * Ordered list of call-to-action buttons.
   *   0 items → no buttons rendered
   *   1 item  → single primary button
   *   2 items → primary + secondary button pair
   * Items beyond index 1 are ignored.
   */
  ctas: readonly HeroCTAItem[];
  /** Optional eyebrow badge rendered above the headline */
  tag?: string;
  /**
   * Variant key from the decision layer (e.g. "cta_meeting").
   * Forwarded to TrackedCTAButton for attribution in click events.
   */
  ctaKey?: string;
  /**
   * Structural layout variant for this hero block.
   * Resolved via resolveContextBlockVariant("hero", …).
   * Defaults to "hero_default" when absent or unrecognised.
   */
  layoutVariant?: string;
  /**
   * Horizontal alignment of overlay content in the `hero_background` variant.
   * Has no effect on other variants.
   *
   *   "left"   — text-left, content pushed to the left third of the viewport
   *   "center" — text-center, content centred horizontally (default)
   *   "right"  — text-right, content pushed to the right third of the viewport
   */
  contentAlign?: "left" | "center" | "right";
  /**
   * Customisable trust metric items for the `hero_proof` compact bar.
   * When absent or empty the component falls back to the built-in default items.
   * Has no effect on other layout variants.
   *
   * Each item: { metric: string, label: string }
   *   e.g. { metric: "10,000+", label: "customers" }
   */
  proofItems?: readonly HeroProofItem[];
  /**
   * Optional media attachment — image or video.
   * When absent the block renders as text-only (all existing variants unchanged).
   * When present:
   *   hero_split       → media fills the right column panel
   *   hero_default / hero_proof → media appears below the text + CTA stack
   *   hero_background  → media fills the full section background with a tint overlay
   */
  media?: HeroBannerMedia;
}

// ── CTA row helper ────────────────────────────────────────────────────────────

/**
 * Renders up to 2 TrackedCTAButtons in a flex row.
 * Position-based variant defaults: idx 0 → primary, idx 1 → secondary.
 */
function HeroCTARow({
  ctas,
  ctaKey,
}: {
  ctas: readonly HeroCTAItem[];
  ctaKey?: string;
}) {
  const visible = ctas.slice(0, 2);
  if (visible.length === 0) return null;

  return (
    // Mobile-first: stack buttons vertically on xs; row from sm upward.
    // `w-full sm:w-auto` on each button ensures they're thumb-friendly on mobile.
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
      {visible.map((cta, i) => (
        <TrackedCTAButton
          key={`${cta.href}-${i}`}
          href={cta.href}
          label={cta.label}
          ctaKey={ctaKey}
          position="hero"
          variant={cta.variant ?? (i === 0 ? "primary" : "secondary")}
          className="w-full sm:w-auto"
        />
      ))}
    </div>
  );
}

// ── Media panel ───────────────────────────────────────────────────────────────

/**
 * Renders the appropriate media element for a given HeroBannerMedia value.
 *
 * Supports:
 *   image          → <img> with object-cover
 *   video/upload   → <video> with configurable attributes
 *   video/youtube  → privacy-enhanced iframe embed
 *   video/vimeo    → Vimeo player iframe embed
 *
 * The container sizing/aspect-ratio is handled by the parent layout; this
 * component fills whatever space it is given (h-full w-full).
 */
/**
 * Whether a hero image URL should pass through Next's image optimizer.
 *
 * Only our allowlisted CDNs (Sanity, Cloudflare R2) are optimized — Next serves
 * correctly-sized AVIF/WebP variants. Everything else — including root-relative
 * `/assets/…` paths that are proxied to the tenant's own Statamic CMS — is
 * served as-is (`unoptimized`). That keeps the Statamic path on the exact same
 * network route as the original <img> (a direct request through the /assets
 * proxy, no optimizer fetch), so this change can never break a Statamic tenant's
 * hero. Statamic-side optimization can follow later via a Glide image loader.
 */
function heroImageOptimizable(src: string): boolean {
  return /(?:cdn\.sanity\.io|\.r2\.dev)/.test(src);
}

/**
 * next/image wrapper for hero media. Uses `fill` (hero dimensions are
 * container-driven) inside a positioned wrapper, marks the image `priority`
 * (the hero is the LCP element, so it preloads with fetchpriority="high"), and
 * falls back to `unoptimized` for non-allowlisted hosts.
 */
function HeroImage({
  src,
  alt,
  sizes,
  wrapperClassName,
  imageClassName = "object-cover",
  ariaHidden = false,
}: {
  src: string;
  alt: string;
  sizes: string;
  wrapperClassName: string;
  imageClassName?: string;
  ariaHidden?: boolean;
}) {
  return (
    <div className={wrapperClassName}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority
        quality={80}
        unoptimized={!heroImageOptimizable(src)}
        aria-hidden={ariaHidden || undefined}
        className={imageClassName}
      />
    </div>
  );
}

function HeroMediaContent({ media }: { media: HeroBannerMedia }) {
  // ── Image ──────────────────────────────────────────────────────────────────
  if (media.kind === "image") {
    return (
      <HeroImage
        src={media.url}
        alt={media.alt}
        sizes="(min-width: 1024px) 50vw, 100vw"
        wrapperClassName="relative h-full w-full"
      />
    );
  }

  const { video } = media;

  // ── Uploaded / self-hosted video ───────────────────────────────────────────
  if (video.source === "upload") {
    return (
      <video
        src={video.url}
        poster={video.poster}
        // muted is implicitly required when autoplay is set; honour both flags
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore — React types don't accept undefined for muted
        muted={video.muted ?? video.autoplay ?? false}
        autoPlay={video.autoplay ?? false}
        loop={video.loop ?? false}
        controls={video.controls ?? false}
        playsInline
        className="h-full w-full object-cover"
      />
    );
  }

  // ── YouTube embed ──────────────────────────────────────────────────────────
  if (video.source === "youtube") {
    // Use the privacy-enhanced nocookie domain to avoid third-party cookies
    // until the user clicks play.
    const params = new URLSearchParams({
      rel:            "0",   // no related videos from other channels
      modestbranding: "1",   // minimal YouTube branding
    });
    if (video.autoplay) {
      params.set("autoplay", "1");
      params.set("mute",     "1"); // browsers require muted for autoplay
    }
    if (video.loop) {
      params.set("loop",     "1");
      params.set("playlist", video.videoId); // required by YouTube for loop to work
    }
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${video.videoId}?${params}`}
        title="YouTube video player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
        className="absolute inset-0 h-full w-full border-0"
      />
    );
  }

  // ── Vimeo embed ────────────────────────────────────────────────────────────
  if (video.source === "vimeo") {
    const params = new URLSearchParams({ dnt: "1" });
    if (video.autoplay) {
      params.set("autoplay", "1");
      params.set("muted",    "1"); // Vimeo uses "muted" (not "mute")
    }
    if (video.loop) {
      params.set("loop", "1");
    }
    return (
      <iframe
        src={`https://player.vimeo.com/video/${video.videoId}?${params}`}
        title="Vimeo video player"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        loading="lazy"
        className="absolute inset-0 h-full w-full border-0"
      />
    );
  }

  // Unreachable — all union branches are handled above.
  return null;
}

/**
 * Wrapper that applies the correct aspect-ratio container for each source type.
 *
 * Images and upload videos fill the parent directly (no aspect-ratio wrapper
 * needed when the parent already has a fixed height).  Iframe embeds require
 * a positioned wrapper so `absolute inset-0` sizing works correctly.
 */
function HeroMediaPanel({
  media,
  className = "",
}: {
  media: HeroBannerMedia;
  className?: string;
}) {
  const needsIframeWrapper =
    media.kind === "video" &&
    (media.video.source === "youtube" || media.video.source === "vimeo");

  if (needsIframeWrapper) {
    return (
      // 16:9 aspect ratio container via CSS `aspect-ratio` (modern) with a
      // minimum height fallback so it's never invisible on mobile.
      // `aspect-video` = aspect-ratio: 16/9; supported in all modern browsers.
      <div
        className={`relative aspect-video overflow-hidden ${className}`}
        style={{ minHeight: "180px" }}
      >
        <HeroMediaContent media={media} />
      </div>
    );
  }

  return (
    <div className={`overflow-hidden ${className}`}>
      <HeroMediaContent media={media} />
    </div>
  );
}

// ── Background media ──────────────────────────────────────────────────────────

/**
 * Renders a full-coverage background media element for the `hero_background`
 * variant.  The parent section must be `position: relative`.
 *
 * ── Coverage strategy ─────────────────────────────────────────────────────────
 *
 *   Images and upload videos use `object-fit: cover` — they fill the
 *   container while preserving aspect ratio, cropping as needed.
 *
 *   Iframe embeds (YouTube / Vimeo) do not support `object-fit`.  We scale
 *   the iframe to cover the container using the "wider-of-two-dimensions"
 *   trick: the element is sized to at least 100% of both width and height,
 *   then centred with a negative-translate.  At 16:9 aspect ratio this
 *   guarantees full coverage at any viewport size.
 *
 * ── Pointer events ────────────────────────────────────────────────────────────
 *
 *   The background layer uses `pointer-events: none` to ensure all user
 *   interactions (clicks, scrolls) reach the content overlay above it.
 *   Iframe embeds in particular would otherwise capture pointer events.
 *
 * @param media  The image or video to render as a background.
 */
function HeroBackgroundMedia({ media }: { media: HeroBannerMedia }) {
  // ── Image ──────────────────────────────────────────────────────────────────
  if (media.kind === "image") {
    return (
      <HeroImage
        src={media.url}
        alt=""            // decorative background — hidden from assistive tech
        ariaHidden
        sizes="100vw"
        wrapperClassName="absolute inset-0 pointer-events-none"
        imageClassName="object-cover"
      />
    );
  }

  const { video } = media;

  // ── Uploaded / self-hosted video ───────────────────────────────────────────
  if (video.source === "upload") {
    return (
      <video
        src={video.url}
        poster={video.poster}
        // Background videos are always muted, autoplaying, and looping.
        // Honour any explicit overrides but default to the background-safe values.
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore — React types don't accept undefined for muted
        muted={video.muted ?? true}
        autoPlay={video.autoplay ?? true}
        loop={video.loop ?? true}
        controls={video.controls ?? false}
        playsInline
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover pointer-events-none"
      />
    );
  }

  // ── YouTube / Vimeo iframe — full-coverage approach ────────────────────────
  //
  // Iframes can't use object-fit; instead we use the "viewport cover" trick:
  //   • Size: at least 100vw wide AND 56.25vw tall (= 100vw × 9/16).
  //           When the viewport is taller than 56.25vw we flip and use
  //           177.78vh wide (= 100vh × 16/9).
  //   • Position: absolute, centred via translate(-50%, -50%).
  // This guarantees the 16:9 iframe covers the container at any aspect ratio.
  const iframeWrapperStyle: React.CSSProperties = {
    position:  "absolute",
    top:       "50%",
    left:      "50%",
    transform: "translate(-50%, -50%)",
    // Cover the container at 16:9 without letterboxing.
    //
    // The trick requires cross-axis scaling:
    //   • width  must be ≥ container width  AND ≥ container height × (16/9)
    //   • height must be ≥ container height AND ≥ container width  × (9/16)
    //
    // Using 100%/100% for both terms is wrong — % in a width calc resolves
    // against the container WIDTH and in a height calc against the container
    // HEIGHT, so both terms end up on the same axis and the wrapper grows
    // only in one direction (producing black bars on the other).
    //
    // Using vh/vw gives the correct cross-axis reference:
    //   • width:  be at least container-wide, or wide enough to fill the
    //             viewport height at 16:9 (prevents bars when the hero is
    //             taller or narrower than 16:9).
    //   • height: be at least container-tall, or tall enough to fill the
    //             viewport width at 9:16 (prevents bars on ultrawide).
    width:     "max(100%, calc(100vh * (16 / 9)))",
    height:    "max(100%, calc(100vw * (9 / 16)))",
    pointerEvents: "none",
    zIndex:    0,
  };

  if (video.source === "youtube") {
    const params = new URLSearchParams({
      rel:             "0",
      modestbranding:  "1",
      autoplay:        "1",
      mute:            "1",
      loop:            "1",
      playlist:        video.videoId, // required for loop
      controls:        "0",
    });
    return (
      <div style={iframeWrapperStyle} aria-hidden>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${video.videoId}?${params}`}
          title=""
          allow="autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          className="h-full w-full border-0"
          loading="eager"
        />
      </div>
    );
  }

  if (video.source === "vimeo") {
    const params = new URLSearchParams({
      background: "1",   // Vimeo background mode: autoplays, muted, looped, no controls
      dnt:        "1",   // do-not-track
    });
    return (
      <div style={iframeWrapperStyle} aria-hidden>
        <iframe
          src={`https://player.vimeo.com/video/${video.videoId}?${params}`}
          title=""
          allow="autoplay; fullscreen; picture-in-picture"
          className="h-full w-full border-0"
          loading="eager"
        />
      </div>
    );
  }

  // Unreachable — all union branches handled above.
  return null;
}

// ── Block component ───────────────────────────────────────────────────────────

// Default proof bar items used when the CMS document does not supply any.
// These are the built-in fallback values — editors can override them via the
// `proofItems` field on any heroVariant document that uses the hero_proof layout.
const DEFAULT_PROOF_ITEMS: readonly HeroProofItem[] = [
  { metric: "10,000+", label: "customers"    },
  { metric: "99.9%",   label: "uptime SLA"   },
  { metric: "< 5 min", label: "setup time"   },
];

export function HeroBlock({
  title,
  subtitle,
  ctas,
  tag,
  ctaKey,
  layoutVariant: rawLayout,
  contentAlign = "center",
  proofItems,
  media,
}: HeroBlockProps) {
  const layout = resolveContextBlockVariant("hero", rawLayout) as HeroLayoutVariant;

  // ── hero_background ──────────────────────────────────────────────────────────
  //
  // Full-viewport image/video background with a semi-transparent tint overlay.
  // Content (tag, title, subtitle, CTAs) is absolutely centred inside the section
  // and may be aligned left, centre, or right via the `contentAlign` prop.
  //
  // When no media is provided a dark brand-coloured fallback fills the section.

  if (layout === "hero_background") {
    // Derive Tailwind alignment classes from contentAlign
    const alignClass =
      contentAlign === "left"   ? "text-left  items-start ml-0" :
      contentAlign === "right"  ? "text-right items-end  mr-0"  :
      /* center */                "text-center items-center mx-auto";

    // Max-width for the content block — constrained to stay readable
    const contentMaxWidth =
      contentAlign === "center" ? "max-w-3xl" : "max-w-xl";

    return (
      /*
       * Section is a flex column so the content block can vertically center
       * itself via `flex-grow` + `justify-center` without needing a fixed height.
       * `min-height` ensures the section is never shorter than 420px even when
       * the content is minimal; it grows freely beyond 70vh for taller content.
       */
      <section
        className="relative flex flex-col justify-center overflow-hidden"
        style={{
          minHeight: "clamp(420px, 70vh, 820px)",
          background: media ? undefined : "var(--hero-bg)",
        }}
        aria-label="Hero banner"
      >
        {/* ── Background media — z-index 0 ────────────────────────────── */}
        {media && (
          <HeroBackgroundMedia media={media} />
        )}

        {/* ── Tint overlay — sits above the media, below the content ───── */}
        {media && (
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background: "var(--hero-overlay-color, #000)",
              opacity:    "var(--hero-overlay-opacity, 0.45)" as string,
              zIndex:     1,
            }}
          />
        )}

        {/* ── Radial glow — shown only when no media is provided ──────── */}
        {!media && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <div
              className="h-[600px] w-[600px] rounded-full blur-3xl"
              style={{
                background: "var(--hero-glow-color)",
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                opacity: "var(--hero-glow-opacity)",
              }}
            />
          </div>
        )}

        {/* ── Content overlay — mobile-first padding scales up at breakpoints ── */}
        <div
          className="relative py-10 sm:py-16 lg:py-24"
          style={{ zIndex: 2 }}
        >
          <Container size="lg">
            <div className={`flex flex-col gap-7 ${alignClass} ${contentMaxWidth}`}>
              {/* Eyebrow badge */}
              {tag && (
                <Badge variant="primary" size="md">
                  {tag}
                </Badge>
              )}

              {/* Headline */}
              <Text
                variant="display"
                align={contentAlign}
                balance
                className="whitespace-pre-line"
                style={{
                  color:      "var(--hero-title-color)",
                  fontFamily: "var(--block-heading-font-family, var(--font-heading))",
                  fontWeight: "var(--block-heading-font-weight, var(--font-heading-weight))",
                }}
              >
                {title}
              </Text>

              {/* Subtitle */}
              <Text
                variant="body"
                align={contentAlign}
                className="text-lg"
                style={{ color: "var(--hero-subtitle-color)" }}
              >
                {subtitle}
              </Text>

              {/* CTA buttons */}
              <HeroCTARow ctas={ctas} ctaKey={ctaKey} />
            </div>
          </Container>
        </div>
      </section>
    );
  }

  // ── hero_split ──────────────────────────────────────────────────────────────
  //
  // 50/50 two-column layout.  Text content on the left.
  // Right panel: media when provided, decorative gradient otherwise.

  if (layout === "hero_split") {
    return (
      <Section
        spacing="xl"
        style={{ background: "var(--hero-bg)" }}
        className="relative overflow-hidden"
      >
        <Container size="lg" className="relative z-10">
          {/*
           * Split container — stacks vertically on mobile, switches to a true
           * side-by-side row from md (768px) upward.  Previously this used
           * lg:flex-row (1024px) which meant the split was invisible at tablet
           * widths where users would already expect a desktop-style layout.
           */}
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:gap-12 lg:gap-16">

            {/* ── Text column ──────────────────────────────────────────────── */}
            {/*
             * min-w-0 prevents the text column from overflowing its flex share
             * when long words / titles are present (flex children default to
             * min-width: auto which ignores the flex-1 constraint).
             * align="start" ensures the Stack's children are left-aligned on
             * the cross-axis — without it they could inherit centering from a
             * parent and look like the centered hero_default layout.
             */}
            <div className="flex-1 min-w-0">
              <Stack gap={7} align="start">
                {tag && (
                  <Badge variant="primary" size="md">
                    {tag}
                  </Badge>
                )}
                <Text
                  variant="display"
                  balance
                  className="max-w-xl whitespace-pre-line text-left"
                  style={{
                    color:         "var(--hero-title-color)",
                    fontFamily:    "var(--font-heading)",
                    fontWeight:    "var(--font-heading-weight)",
                    letterSpacing: "var(--block-heading-tracking)",
                    textTransform: "var(--block-heading-transform)" as React.CSSProperties["textTransform"],
                  }}
                >
                  {title}
                </Text>
                <Text
                  variant="body"
                  className="max-w-lg text-lg text-left"
                  style={{ color: "var(--hero-subtitle-color)" }}
                >
                  {subtitle}
                </Text>
                <HeroCTARow ctas={ctas} ctaKey={ctaKey} />
                {ctas.length > 0 && (
                  <Text
                    variant="caption"
                    className="text-left"
                    style={{ color: "var(--hero-subtitle-color)" }}
                  >
                    No credit card required · Setup in &lt; 5 minutes
                  </Text>
                )}
              </Stack>
            </div>

            {/* ── Right panel — media or decorative gradient ────────────────── */}
            {media ? (
              /*
               * Media panel.
               * – Mobile: full-width below the text column (flex-col order).
               * – md+:    right column, 40% of the row width.
               * – lg+:    widens to 50% (xl: same).
               *
               * The inner panel uses absolute inset-0 so HeroMediaPanel fills
               * the full bounding box regardless of content aspect ratio.
               * Without an explicit `height` on the parent, `h-full` on the
               * child has no reference to fill — the absolute approach solves
               * this by letting the padding-bottom trick or the clamp height
               * drive the box size while the child fills it absolutely.
               */
              <div
                className="relative w-full md:w-2/5 lg:w-1/2 shrink-0 overflow-hidden"
                style={{
                  height:       "clamp(240px, 45vw, 480px)",
                  borderRadius: "var(--block-media-radius, 1rem)",
                  boxShadow:    "var(--block-media-shadow, none)",
                  border:       "var(--block-media-border, none)",
                  background:   "var(--block-media-bg, transparent)",
                  padding:      "var(--block-media-padding, 0px)",
                }}
              >
                <div className="absolute inset-0">
                  <HeroMediaPanel media={media} className="h-full w-full" />
                </div>
              </div>
            ) : (
              /*
               * Decorative gradient panel — shown only when no media is provided.
               * Hidden on mobile (purely decorative; stacking it below text wastes
               * vertical space and looks odd at narrow widths).
               * From md upward it appears as the right column of the split, with
               * the same width logic as the media panel above.
               */
              <div
                className="relative hidden md:flex md:w-2/5 lg:w-1/2 shrink-0 items-center justify-center rounded-2xl overflow-hidden"
                style={{
                  height:     "clamp(300px, 45vw, 480px)",
                  background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-active) 100%)",
                  opacity:    0.9,
                }}
                aria-hidden="true"
              >
                {/* Inner glow */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className="h-72 w-72 rounded-full blur-3xl"
                    style={{
                      background: "var(--hero-glow-color)",
                      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                      // @ts-ignore — CSS custom property value; valid at runtime
                      opacity: "var(--hero-glow-opacity, 0.4)",
                    }}
                  />
                </div>
                {/* Decorative pattern — subtle grid dots */}
                <div className="relative z-10 opacity-20">
                  <svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {Array.from({ length: 5 }, (_, row) =>
                      Array.from({ length: 5 }, (_, col) => (
                        <circle
                          key={`${row}-${col}`}
                          cx={20 + col * 40}
                          cy={20 + row * 40}
                          r="3"
                          fill="white"
                        />
                      ))
                    )}
                  </svg>
                </div>
              </div>
            )}

          </div>
        </Container>
      </Section>
    );
  }

  // ── hero_proof ───────────────────────────────────────────────────────────────
  //
  // Centered hero identical to hero_default, plus a compact inline trust bar
  // below the CTA (logos, metric snippets, or short proof points from the tag).
  // When media is provided it appears below the proof bar, contained.

  if (layout === "hero_proof") {
    return (
      <Section
        spacing="xl"
        style={{ background: "var(--hero-bg)" }}
        className="relative overflow-hidden"
      >
        {/* Radial glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div
            className="h-[600px] w-[600px] rounded-full blur-3xl"
            style={{
              background: "var(--hero-glow-color)",
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              opacity: "var(--hero-glow-opacity)",
            }}
          />
        </div>

        <Container size="lg" className="relative z-10">
          <Stack gap={10} align="center">
            {/* Hero headline + CTA */}
            <Stack gap={8} align="center" className="text-center">
              {tag && (
                <Badge variant="primary" size="md">
                  {tag}
                </Badge>
              )}
              <Text
                variant="display"
                align="center"
                balance
                className="max-w-4xl whitespace-pre-line"
                style={{
                  color:      "var(--hero-title-color)",
                  fontFamily: "var(--block-heading-font-family, var(--font-heading))",
                  fontWeight: "var(--block-heading-font-weight, var(--font-heading-weight))",
                }}
              >
                {title}
              </Text>
              <Text
                variant="body"
                align="center"
                className="max-w-2xl text-lg"
                style={{ color: "var(--hero-subtitle-color)" }}
              >
                {subtitle}
              </Text>
              <HeroCTARow ctas={ctas} ctaKey={ctaKey} />
            </Stack>

            {/* Compact proof bar — use CMS items when provided, else fall back to defaults */}
            <div
              className="flex flex-wrap items-center justify-center gap-6 border-t pt-6"
              style={{ borderColor: "color-mix(in srgb, var(--hero-subtitle-color) 25%, transparent)" }}
            >
              {(proofItems && proofItems.length > 0 ? proofItems : DEFAULT_PROOF_ITEMS).map(({ metric, label }) => (
                <div key={label} className="flex flex-col items-center gap-0.5">
                  <span
                    className="text-xl font-bold tabular-nums"
                    style={{ color: "var(--hero-title-color)" }}
                  >
                    {metric}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: "var(--hero-subtitle-color)" }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* Media block — below proof bar, full container width */}
            {media && (
              <HeroMediaPanel
                media={media}
                className="w-full max-w-4xl rounded-xl shadow-2xl"
              />
            )}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── hero_minimal_dark ────────────────────────────────────────────────────────
  //
  // Near-black full-width hero with centered content. Distinct from hero_default:
  //   • Uses var(--hero-dark-bg, #0a0a0f) — an ultra-dark near-black surface
  //   • Heading is tighter (no extra glow blob behind it; instead a narrow
  //     horizontal glow bar sits *below* the eyebrow badge and above the title)
  //   • No "Setup in < 5 min" micro-copy
  //   • The glow is a very narrow horizontal line — brand accent, not a blob
  //
  // Designed for the Dark AI family where --hero-dark-bg and --primary are
  // already calibrated for near-black surfaces.

  if (layout === "hero_minimal_dark") {
    return (
      <Section
        spacing="xl"
        style={{ background: "var(--hero-dark-bg, #0a0a0f)" }}
        className="relative overflow-hidden"
      >
        {/* Very subtle wide glow behind heading area */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div
            className="h-64 w-96 rounded-full blur-3xl"
            style={{
              background: "var(--hero-glow-color, var(--primary))",
              opacity:    0.08,
            }}
          />
        </div>

        <Container size="lg" className="relative z-10">
          <Stack gap={6} align="center" className="text-center">
            {tag && (
              <Badge variant="primary" size="md">
                {tag}
              </Badge>
            )}

            {/* Tight heading — slightly smaller than display for the minimal feel */}
            <Text
              variant="display"
              align="center"
              balance
              className="max-w-3xl whitespace-pre-line"
              style={{
                color:         "var(--hero-title-color, #f8fafc)",
                fontFamily:    "var(--font-heading)",
                fontWeight:    "var(--font-heading-weight, 800)",
                letterSpacing: "-0.02em",
                lineHeight:    "1.05",
              }}
            >
              {title}
            </Text>

            <Text
              variant="body"
              align="center"
              className="max-w-xl text-lg"
              style={{ color: "var(--hero-subtitle-color, #94a3b8)" }}
            >
              {subtitle}
            </Text>

            <HeroCTARow ctas={ctas} ctaKey={ctaKey} />

            {media && (
              <div
                className="w-full max-w-4xl mt-6 overflow-hidden"
                style={{
                  borderRadius: "var(--block-media-radius, 0.75rem)",
                  boxShadow:    "0 25px 60px rgba(0,0,0,0.5)",
                  border:       "1px solid color-mix(in srgb, var(--primary) 20%, transparent)",
                }}
              >
                <HeroMediaPanel media={media} className="w-full" />
              </div>
            )}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── hero_split_clean ─────────────────────────────────────────────────────────
  //
  // Light-background split hero. Dark text on white/near-white surface.
  // The right panel renders the media in a "framed product screenshot" treatment:
  //   • Subtle border + shadow — mimics a browser or device chrome
  //   • White/card background behind the screenshot
  //
  // When no media is provided a neutral placeholder panel is shown.
  // Designed for Clean Corporate family.

  if (layout === "hero_split_clean") {
    return (
      <Section
        spacing="xl"
        style={{ background: "var(--hero-light-bg, #ffffff)" }}
        className="relative overflow-hidden"
      >
        <Container size="lg" className="relative z-10">
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:gap-12 lg:gap-16">

            {/* ── Text column ──────────────────────────────────────────────── */}
            <div className="flex-1 min-w-0">
              <Stack gap={7} align="start">
                {tag && (
                  <Badge variant="primary" size="md">
                    {tag}
                  </Badge>
                )}
                <Text
                  variant="display"
                  balance
                  className="max-w-xl whitespace-pre-line text-left"
                  style={{
                    color:         "var(--text, #0f172a)",
                    fontFamily:    "var(--font-heading)",
                    fontWeight:    "var(--font-heading-weight)",
                    letterSpacing: "var(--block-heading-tracking)",
                  }}
                >
                  {title}
                </Text>
                <Text
                  variant="body"
                  className="max-w-lg text-lg text-left"
                  style={{ color: "var(--text-muted, #64748b)" }}
                >
                  {subtitle}
                </Text>
                <HeroCTARow ctas={ctas} ctaKey={ctaKey} />
                {ctas.length > 0 && (
                  <Text
                    variant="caption"
                    className="text-left"
                    style={{ color: "var(--text-subtle, #94a3b8)" }}
                  >
                    No credit card required · Setup in &lt; 5 minutes
                  </Text>
                )}
              </Stack>
            </div>

            {/* ── Right panel — framed product screenshot or placeholder ───── */}
            {media ? (
              <div
                className="relative w-full md:w-2/5 lg:w-1/2 shrink-0 overflow-hidden"
                style={{
                  height:          "clamp(240px, 45vw, 480px)",
                  borderRadius:    "var(--block-media-radius, 0.75rem)",
                  boxShadow:       "var(--block-media-shadow, 0 20px 60px rgba(0,0,0,0.12))",
                  border:          "1px solid var(--border, #e2e8f0)",
                  background:      "var(--card-bg, #ffffff)",
                }}
              >
                <div className="absolute inset-0">
                  <HeroMediaPanel media={media} className="h-full w-full" />
                </div>
              </div>
            ) : (
              <div
                className="relative hidden md:flex md:w-2/5 lg:w-1/2 shrink-0 items-center justify-center overflow-hidden"
                style={{
                  height:       "clamp(300px, 45vw, 480px)",
                  borderRadius: "var(--block-media-radius, 0.75rem)",
                  boxShadow:    "0 20px 60px rgba(0,0,0,0.08)",
                  border:       "1px solid var(--border, #e2e8f0)",
                  background:   "var(--section-subtle-bg, #f8fafc)",
                }}
                aria-hidden="true"
              >
                {/* Subtle grid placeholder */}
                <div className="opacity-20">
                  <svg width="200" height="160" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {Array.from({ length: 4 }, (_, row) =>
                      Array.from({ length: 5 }, (_, col) => (
                        <rect
                          key={`${row}-${col}`}
                          x={10 + col * 38}
                          y={10 + row * 36}
                          width="30"
                          height="28"
                          rx="4"
                          fill="var(--border, #e2e8f0)"
                        />
                      ))
                    )}
                  </svg>
                </div>
              </div>
            )}
          </div>
        </Container>
      </Section>
    );
  }

  // ── hero_dark_split ───────────────────────────────────────────────────────────
  //
  // Dark brand background + split layout.
  // Left: text content with dark-hero token styling (same as hero_default/split).
  // Right: radial-glow decorative panel — more vivid than hero_split's panel,
  //        with a glowing orb and brand-coloured outer ring.
  //
  // Designed for Structured SaaS / Dark AI families where the split layout
  // is needed but the clean light surface of hero_split_clean is wrong.

  if (layout === "hero_dark_split") {
    return (
      <Section
        spacing="xl"
        style={{ background: "var(--hero-bg)" }}
        className="relative overflow-hidden"
      >
        <Container size="lg" className="relative z-10">
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:gap-12 lg:gap-16">

            {/* ── Text column ──────────────────────────────────────────────── */}
            <div className="flex-1 min-w-0">
              <Stack gap={7} align="start">
                {tag && (
                  <Badge variant="primary" size="md">
                    {tag}
                  </Badge>
                )}
                <Text
                  variant="display"
                  balance
                  className="max-w-xl whitespace-pre-line text-left"
                  style={{
                    color:         "var(--hero-title-color)",
                    fontFamily:    "var(--font-heading)",
                    fontWeight:    "var(--font-heading-weight)",
                    letterSpacing: "var(--block-heading-tracking)",
                  }}
                >
                  {title}
                </Text>
                <Text
                  variant="body"
                  className="max-w-lg text-lg text-left"
                  style={{ color: "var(--hero-subtitle-color)" }}
                >
                  {subtitle}
                </Text>
                <HeroCTARow ctas={ctas} ctaKey={ctaKey} />
              </Stack>
            </div>

            {/* ── Right panel — media or vivid glow orb ────────────────────── */}
            {media ? (
              <div
                className="relative w-full md:w-2/5 lg:w-1/2 shrink-0 overflow-hidden"
                style={{
                  height:       "clamp(240px, 45vw, 480px)",
                  borderRadius: "var(--block-media-radius, 1rem)",
                  boxShadow:    "var(--block-media-shadow, none)",
                  border:       "1px solid color-mix(in srgb, var(--primary) 25%, transparent)",
                  background:   "var(--block-media-bg, transparent)",
                }}
              >
                <div className="absolute inset-0">
                  <HeroMediaPanel media={media} className="h-full w-full" />
                </div>
              </div>
            ) : (
              <div
                className="relative hidden md:flex md:w-2/5 lg:w-1/2 shrink-0 items-center justify-center rounded-2xl overflow-hidden"
                style={{
                  height:     "clamp(300px, 45vw, 480px)",
                  background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 15%, transparent) 0%, color-mix(in srgb, var(--primary) 5%, transparent) 100%)",
                  border:     "1px solid color-mix(in srgb, var(--primary) 30%, transparent)",
                }}
                aria-hidden="true"
              >
                {/* Large vivid glow orb */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className="h-80 w-80 rounded-full blur-3xl"
                    style={{
                      background: "var(--hero-glow-color, var(--primary))",
                      opacity:    0.5,
                    }}
                  />
                </div>
                {/* Inner bright core */}
                <div className="relative z-10 flex items-center justify-center">
                  <div
                    className="h-20 w-20 rounded-full blur-xl"
                    style={{
                      background: "var(--primary)",
                      opacity:    0.9,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </Container>
      </Section>
    );
  }

  // ── hero_editorial ────────────────────────────────────────────────────────────
  //
  // Light neutral section with a large typographic centered heading.
  // Editorial / content-blog / magazine family variant.
  //
  // Design principles:
  //   • Light surface: var(--bg, #ffffff) or var(--section-subtle-bg)
  //   • Dark text: var(--text) for heading, var(--text-muted) for subtitle
  //   • Large generous padding — the whitespace IS the design
  //   • Optional thin decorative separator between eyebrow and headline
  //   • Heading uses display variant but with the font-display token for
  //     editorial typefaces (falls back to font-heading)
  //   • Media below the CTA row, full-width, rounded with editorial shadow

  if (layout === "hero_editorial") {
    return (
      <Section
        spacing="xl"
        style={{ background: "var(--bg, #ffffff)" }}
        className="relative overflow-hidden"
      >
        <Container size="md" className="relative z-10">
          <Stack gap={8} align="center" className="text-center">
            {tag && (
              <div className="flex flex-col items-center gap-3">
                <Badge variant="primary" size="md">
                  {tag}
                </Badge>
                {/* Thin decorative rule between badge and headline */}
                <div
                  className="h-px w-12"
                  style={{ background: "var(--border, #e2e8f0)" }}
                  aria-hidden="true"
                />
              </div>
            )}

            {/* Editorial large heading — uses font-display if available */}
            <Text
              variant="display"
              align="center"
              balance
              className="max-w-3xl whitespace-pre-line"
              style={{
                color:         "var(--text, #0f172a)",
                fontFamily:    "var(--font-display, var(--font-heading))",
                fontWeight:    "var(--font-heading-weight, 700)",
                letterSpacing: "-0.015em",
                lineHeight:    "1.1",
              }}
            >
              {title}
            </Text>

            <Text
              variant="body"
              align="center"
              className="max-w-2xl text-lg"
              style={{ color: "var(--text-muted, #64748b)" }}
            >
              {subtitle}
            </Text>

            <HeroCTARow ctas={ctas} ctaKey={ctaKey} />

            {/* Media — full container width with editorial border treatment */}
            {media && (
              <div
                className="w-full mt-6"
                style={{
                  borderRadius: "var(--block-media-radius, 0.5rem)",
                  overflow:     "hidden",
                  boxShadow:    "0 4px 32px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.06)",
                  border:       "1px solid var(--border, #e2e8f0)",
                }}
              >
                <HeroMediaPanel media={media} className="w-full max-w-4xl" />
              </div>
            )}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── hero_page_banner ─────────────────────────────────────────────────────────
  //
  // Compact dark page-header banner. Sits directly under the site nav and
  // identifies the current page with a title, optional subtitle, tag, and
  // optional right-side media panel.
  //
  // Layout modes (both stay compact — height is content-driven, ~160–280 px):
  //   • With media:    Two-column split — text left (55%), media panel right (45%).
  //                    On mobile the media panel collapses below the text.
  //   • Without media: Single centered column — tag, title, subtitle, optional CTAs.
  //
  // Design principles:
  //   • Same dark brand surface (--hero-bg) as other dark variants.
  //   • Subtle wide glow at very low opacity — brand presence without bloat.
  //   • Title at h2 scale (not display-scale — this is a label/pitch hybrid).
  //   • CTAs rendered when present (adaptive variants include conversion CTAs).

  if (layout === "hero_page_banner") {
    const hasBannerMedia = !!media;

    return (
      <section
        className="relative overflow-hidden"
        style={{
          background:    "var(--hero-bg)",
          paddingTop:    "clamp(2rem, 5vw, 3.5rem)",
          paddingBottom: "clamp(2rem, 5vw, 3.5rem)",
        }}
        aria-label="Page header"
      >
        {/* Very subtle wide glow — brand presence, low opacity */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div
            className="h-[350px] w-[700px] rounded-full blur-3xl"
            style={{
              background: "var(--hero-glow-color)",
              opacity:    0.06,
            }}
          />
        </div>

        <Container size="lg" className="relative z-10">
          {hasBannerMedia ? (
            /* ── Split layout: text left, media right ── */
            <div className="flex flex-col gap-8 md:flex-row md:items-center md:gap-12">
              {/* Text column */}
              <div className="flex-1 min-w-0">
                <Stack gap={3} align="start">
                  {tag && (
                    <Badge variant="primary" size="sm">
                      {tag}
                    </Badge>
                  )}
                  <Text
                    variant="h2"
                    balance
                    className="whitespace-pre-line"
                    style={{
                      color:      "var(--hero-title-color)",
                      fontFamily: "var(--block-heading-font-family, var(--font-heading))",
                      fontWeight: "var(--block-heading-font-weight, var(--font-heading-weight))",
                    }}
                  >
                    {title}
                  </Text>
                  {subtitle && (
                    <Text
                      variant="body"
                      className="max-w-lg"
                      style={{ color: "var(--hero-subtitle-color)" }}
                    >
                      {subtitle}
                    </Text>
                  )}
                  {ctas.length > 0 && (
                    <div className="mt-1">
                      <HeroCTARow ctas={ctas} ctaKey={ctaKey} />
                    </div>
                  )}
                </Stack>
              </div>

              {/* Media column — rounded, clipped, ~45% width on desktop */}
              <div className="w-full md:w-[42%] shrink-0">
                <div className="overflow-hidden rounded-xl shadow-lg">
                  <HeroMediaPanel media={media} />
                </div>
              </div>
            </div>
          ) : (
            /* ── Centered layout: no media ── */
            <Stack gap={3} align="center" className="text-center">
              {tag && (
                <Badge variant="primary" size="sm">
                  {tag}
                </Badge>
              )}
              <Text
                variant="h2"
                align="center"
                balance
                className="max-w-3xl whitespace-pre-line"
                style={{
                  color:      "var(--hero-title-color)",
                  fontFamily: "var(--block-heading-font-family, var(--font-heading))",
                  fontWeight: "var(--block-heading-font-weight, var(--font-heading-weight))",
                }}
              >
                {title}
              </Text>
              {subtitle && (
                <Text
                  variant="body"
                  align="center"
                  className="max-w-2xl"
                  style={{ color: "var(--hero-subtitle-color)" }}
                >
                  {subtitle}
                </Text>
              )}
              {ctas.length > 0 && (
                <div className="mt-2">
                  <HeroCTARow ctas={ctas} ctaKey={ctaKey} />
                </div>
              )}
            </Stack>
          )}
        </Container>
      </section>
    );
  }

  // ── hero_default (fallback) ──────────────────────────────────────────────────
  //
  // Centered headline, subtitle, and CTA on a dark brand background.
  // When media is provided it appears as a contained block below the CTA
  // (common SaaS pattern: headline → CTA → product screenshot / promo video).

  return (
    /*
     * --hero-bg drives the section background.
     * Defaults to neutral-950 in theme.css; overridden per tenant/preset via
     * layout.tsx inline <style> — zero className changes needed here.
     */
    <Section
      spacing="xl"
      style={{ background: "var(--hero-bg)" }}
      className="relative overflow-hidden"
    >
      {/* Radial glow — colour and opacity independently token-driven */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div
          className="h-[600px] w-[600px] rounded-full blur-3xl"
          style={{
            background: "var(--hero-glow-color)",
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore — CSS custom property value; valid at runtime
            opacity: "var(--hero-glow-opacity)",
          }}
        />
      </div>

      <Container size="lg" className="relative z-10">
        <Stack gap={8} align="center" className="text-center">
          {/* Eyebrow badge */}
          {tag && (
            <Badge variant="primary" size="md">
              {tag}
            </Badge>
          )}

          {/* Headline — font family/weight driven by --font-heading / --font-heading-weight */}
          <Text
            variant="display"
            align="center"
            balance
            className="max-w-4xl whitespace-pre-line"
            style={{
              color:      "var(--hero-title-color)",
              fontFamily: "var(--font-heading)",
              fontWeight: "var(--font-heading-weight)",
            }}
          >
            {title}
          </Text>

          {/* Subheadline — --hero-subtitle-color is intentionally muted against dark backgrounds */}
          <Text
            variant="body"
            align="center"
            className="max-w-2xl text-lg"
            style={{ color: "var(--hero-subtitle-color)" }}
          >
            {subtitle}
          </Text>

          {/* CTA buttons — 0, 1, or 2 rendered */}
          <HeroCTARow ctas={ctas} ctaKey={ctaKey} />

          {/* Social proof micro-copy — only shown when at least one CTA is present */}
          {ctas.length > 0 && (
            <Text
              variant="caption"
              style={{ color: "var(--hero-subtitle-color)" }}
            >
              No credit card required · Setup in &lt; 5 minutes
            </Text>
          )}

          {/* Media — product screenshot, promo video, or embed below the CTA */}
          {media && (
            <HeroMediaPanel
              media={media}
              className="w-full max-w-5xl rounded-xl shadow-2xl mt-4"
            />
          )}
        </Stack>
      </Container>
    </Section>
  );
}
