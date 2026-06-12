/**
 * TextMediaBlock
 *
 * Renders a `textMedia` page section — editorial text (eyebrow + heading +
 * body + CTAs) paired with an image or video media element.
 *
 * Distinct from AboutBlock: no team-member list; intended for lightweight
 * marketing or editorial splits without the narrative bio context.
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      TextMediaBlockData  { eyebrow?, heading?, body?, ctas?,
 *                                   mediaUrl?, mediaAlt?, caption?, mediaType? }
 *   variant   TextMediaVariant    see below
 *
 * ─── Variants ────────────────────────────────────────────────────────────────
 *
 *   text_media_right   — text left, media right (default)
 *   text_media_left    — media left, text right
 *   text_media_stacked — media above, text below (full-width single-column)
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --section-bg            Section background
 *   --card-radius           Media border-radius
 *   --font-heading          Heading font family
 *   --font-heading-weight   Heading font weight
 *   --text-muted            Caption text colour
 */

import { Container }            from "@/components/primitives/Container";
import { Section }              from "@/components/primitives/Section";
import { Stack }                from "@/components/primitives/Stack";
import { Text }                 from "@/components/primitives/Text";
import { CTAGroup }             from "@/components/molecules";
import { PortableTextRenderer } from "@/components/blocks/sections/PortableTextRenderer";
import { resolveBlockVariant }  from "@/page-config/block-variants";
import type { TextMediaVariant } from "@/page-config/block-variants";
import type { TextMediaBlockData } from "@/page-config";
import type { PortableTextBlock } from "@/cms/types";
import { resolveSurface, type BlockSurface } from "@/lib/surface";

interface TextMediaBlockProps {
  data:     TextMediaBlockData;
  variant?: string;
  surface?: BlockSurface;
}

// ── Media element ─────────────────────────────────────────────────────────────

function MediaElement({
  mediaUrl,
  mediaAlt,
  mediaType,
  videoSource,
  posterUrl,
  autoPlay,
  loop,
  caption,
  mediaBgType,
  mediaBgColor,
  mediaBgImageUrl,
}: {
  mediaUrl?:       string;
  mediaAlt?:       string;
  mediaType?:      "image" | "video";
  videoSource?:    "youtube" | "vimeo" | "upload";
  posterUrl?:      string;
  autoPlay?:       boolean;
  loop?:           boolean;
  caption?:        string;
  mediaBgType?:    "color" | "image";
  mediaBgColor?:   string;
  mediaBgImageUrl?: string;
}) {
  if (!mediaUrl) return null;

  // ── Profile-driven media wrapper styles ────────────────────────────────────
  //
  // --block-media-radius   : border-radius (0px for sharp / 1.5rem for playful)
  // --block-media-shadow   : box-shadow (none / prominent lift)
  // --block-media-border   : border shorthand (none / 1px solid var(--card-border))
  // --block-media-bg       : wrapper background (transparent / var(--card-bg) for framing)
  // --block-media-padding  : inner padding (0px / 0.75rem for polaroid inset)
  //
  // overflow: hidden ensures the media clips to the wrapper's border-radius
  // when padding is 0, and sits cleanly inside the frame when padding is set.
  //
  // ── Media background strategy ──────────────────────────────────────────────
  //
  // When the editor sets a mediaBgType, we set the background directly on the
  // wrapper div rather than using an absolutely-positioned child layer.
  //
  // The simpler approach is more reliable: an <img> element's transparent pixels
  // naturally show through to the parent element's own CSS background — no
  // z-index stacking context juggling required. The absolutely-positioned bgLayer
  // approach was fragile because `position: relative` without an explicit z-index
  // on the wrapper does not create a stacking context, leaving the bgLayer and
  // img competing in an ancestor stacking context where overflow clipping may
  // not apply as expected.

  // Determine whether a custom background is requested
  const hasBg = mediaBgType === "color"
    ? Boolean(mediaBgColor)
    : mediaBgType === "image"
    ? Boolean(mediaBgImageUrl)
    : false;

  // Build the background style for the wrapper.
  // Custom bg overrides the profile token (--block-media-bg).
  const wrapperBgStyle: React.CSSProperties = hasBg && mediaBgType === "color"
    ? { background: mediaBgColor }
    : hasBg && mediaBgType === "image"
    ? {
        backgroundImage:    `url(${mediaBgImageUrl})`,
        backgroundSize:     "cover",
        backgroundPosition: "center",
      }
    : { background: "var(--block-media-bg)" };

  // When a custom background is active, expose it as a visible inset frame so
  // the colour / image is guaranteed to show regardless of whether the foreground
  // image has transparent areas.  We switch to object-contain so the image sits
  // completely inside the padded area, with the background filling the gaps.
  //
  // Without background: keep the existing behaviour — object-cover, no extra
  // padding, media fills its cell edge-to-edge.
  const mediaWrapperStyle: React.CSSProperties = {
    borderRadius: "var(--block-media-radius)",
    boxShadow:    "var(--block-media-shadow)",
    border:       "var(--block-media-border)",
    padding:      hasBg
      ? "var(--block-media-bg-padding, 1.5rem)"
      : "var(--block-media-padding)",
    minHeight:    "var(--block-media-min-height, auto)",
    overflow:     "hidden",
    ...wrapperBgStyle,
  };

  // ── Native uploaded video (<video> element) ────────────────────────────────
  if (mediaType === "video" && videoSource === "upload") {
    return (
      <figure className="relative" style={{ flex: "var(--block-text-media-image-flex, 1)" }}>
        <div style={mediaWrapperStyle}>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={mediaUrl}
            poster={posterUrl}
            autoPlay={autoPlay}
            loop={loop}
            muted={autoPlay}          // browsers require muted for autoplay to work
            controls={!autoPlay}      // show controls when not in autoplay/ambient mode
            playsInline
            className="block w-full"
          />
        </div>
        {caption && (
          <figcaption className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
            {caption}
          </figcaption>
        )}
      </figure>
    );
  }

  // ── YouTube / Vimeo embed (16:9 iframe) ────────────────────────────────────
  if (mediaType === "video") {
    // Append autoplay / loop query params to the embed URL when requested.
    // YouTube: autoplay=1&mute=1 (mute required), loop=1&playlist=<id>
    // Vimeo:   autoplay=1&muted=1, loop=1
    let embedUrl = mediaUrl;
    if (autoPlay || loop) {
      try {
        const u = new URL(mediaUrl);
        if (autoPlay) {
          u.searchParams.set("autoplay", "1");
          u.searchParams.set(videoSource === "vimeo" ? "muted" : "mute", "1");
        }
        if (loop) {
          u.searchParams.set("loop", "1");
          // YouTube requires the playlist param to equal the video id for loop to work
          if (videoSource !== "vimeo") {
            const ytId = u.pathname.replace("/embed/", "");
            if (ytId) u.searchParams.set("playlist", ytId);
          }
        }
        embedUrl = u.toString();
      } catch {
        // malformed URL — use as-is
      }
    }

    return (
      <figure className="relative" style={{ flex: "var(--block-text-media-image-flex, 1)" }}>
        <div style={mediaWrapperStyle}>
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            <iframe
              src={embedUrl}
              title={mediaAlt ?? "Video"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          </div>
        </div>
        {caption && (
          <figcaption className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
            {caption}
          </figcaption>
        )}
      </figure>
    );
  }

  // ── Image ─────────────────────────────────────────────────────────────────
  return (
    <figure className="relative" style={{ flex: "var(--block-text-media-image-flex, 1)" }}>
      <div style={mediaWrapperStyle}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mediaUrl}
          alt={mediaAlt ?? ""}
          loading="lazy"
          className={hasBg ? "block w-full object-contain" : "block w-full object-cover"}
        />
      </div>
      {caption && (
        <figcaption className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

// ── Text column ───────────────────────────────────────────────────────────────

function TextColumn({
  eyebrow,
  heading,
  body,
  ctas,
}: Pick<TextMediaBlockData, "eyebrow" | "heading" | "body" | "ctas">) {
  return (
    <Stack gap={5} className="flex-1">
      {eyebrow && (
        <Text variant="caption" color="brand" className="uppercase tracking-wider font-semibold">
          {eyebrow}
        </Text>
      )}
      {heading && (
        <Text
          variant="h2"
          balance
          style={{
            fontFamily:    "var(--block-heading-font-family, var(--font-heading))",
            fontWeight:    "var(--block-heading-font-weight, var(--font-heading-weight))",
            letterSpacing: "var(--block-heading-tracking)",
          }}
        >
          {heading}
        </Text>
      )}
      {body && body.length > 0 && (
        // Cast: readonly PortableTextBlock[] → PortableTextBlock[]
        // Safe — PortableTextRenderer only reads the array.
        <PortableTextRenderer blocks={body as PortableTextBlock[]} />
      )}
      {ctas && ctas.length > 0 && (
        <CTAGroup ctas={ctas} size="md" />
      )}
    </Stack>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TextMediaBlock({ data, variant: rawVariant, surface }: TextMediaBlockProps) {
  const variant = resolveBlockVariant("textMedia", rawVariant) as TextMediaVariant;
  const { eyebrow, heading, body, ctas, mediaUrl, mediaAlt, caption, mediaType,
          videoSource, posterUrl, autoPlay, loop,
          mediaBgType, mediaBgColor, mediaBgImageUrl } = data;

  const media = (
    <MediaElement
      mediaUrl={mediaUrl}
      mediaAlt={mediaAlt}
      mediaType={mediaType}
      videoSource={videoSource}
      posterUrl={posterUrl}
      autoPlay={autoPlay}
      loop={loop}
      caption={caption}
      mediaBgType={mediaBgType}
      mediaBgColor={mediaBgColor}
      mediaBgImageUrl={mediaBgImageUrl}
    />
  );

  const text = (
    <TextColumn
      eyebrow={eyebrow}
      heading={heading}
      body={body}
      ctas={ctas}
    />
  );

  // ── text_media_stacked ───────────────────────────────────────────────────────
  if (variant === "text_media_stacked") {
    return (
      <Section spacing="xl" style={{ background: resolveSurface(surface) ?? "var(--bg)" }}>
        <Container size="lg">
          <Stack gap={8}>
            {media}
            {text}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── text_media_left ──────────────────────────────────────────────────────────
  if (variant === "text_media_left") {
    return (
      <Section spacing="xl" style={{ background: resolveSurface(surface) ?? "var(--bg)" }}>
        <Container size="lg">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-center" style={{ gap: "var(--block-text-media-gap, 3rem)" }}>
            {media}
            {text}
          </div>
        </Container>
      </Section>
    );
  }

  // ── text_media_right (default) ───────────────────────────────────────────────
  return (
    <Section spacing="xl" style={{ background: resolveSurface(surface) ?? "var(--bg)" }}>
      <Container size="lg">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:gap-16">
          {text}
          {media}
        </div>
      </Container>
    </Section>
  );
}
