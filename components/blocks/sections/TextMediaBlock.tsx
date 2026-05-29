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
  caption,
}: {
  mediaUrl?:  string;
  mediaAlt?:  string;
  mediaType?: "image" | "video";
  caption?:   string;
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

  const mediaWrapperStyle: React.CSSProperties = {
    borderRadius: "var(--block-media-radius)",
    boxShadow:    "var(--block-media-shadow)",
    border:       "var(--block-media-border)",
    background:   "var(--block-media-bg)",
    padding:      "var(--block-media-padding)",
    minHeight:    "var(--block-media-min-height, auto)",
    overflow:     "hidden",
  };

  return (
    <figure className="relative" style={{ flex: "var(--block-text-media-image-flex, 1)" }}>
      {mediaType === "video" ? (
        <div style={mediaWrapperStyle}>
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            <iframe
              src={mediaUrl}
              title={mediaAlt ?? "Video"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          </div>
        </div>
      ) : (
        <div style={mediaWrapperStyle}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl}
            alt={mediaAlt ?? ""}
            loading="lazy"
            className="block w-full object-cover"
          />
        </div>
      )}
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
  const { eyebrow, heading, body, ctas, mediaUrl, mediaAlt, caption, mediaType } = data;

  const media = (
    <MediaElement
      mediaUrl={mediaUrl}
      mediaAlt={mediaAlt}
      mediaType={mediaType}
      caption={caption}
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
