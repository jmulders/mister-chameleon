/**
 * LogoStripBlock
 *
 * Renders a `logoStrip` page section — an optional heading followed by a
 * seamless, slow-scrolling marquee carousel of client / partner logos.
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      LogoStripBlockData  { heading?, logos[], animationEnabled?,
 *                                   speed?, grayscale?, showLabels? }
 *   variant   LogoStripVariant    see below
 *
 * ─── Variants ────────────────────────────────────────────────────────────────
 *
 *   default   — logos at full contrast in a slow marquee carousel
 *   muted     — logos at reduced opacity with grayscale; "trusted by" treatment
 *   logo_grid — static multi-row CSS grid for larger logo clouds (6–12+ logos)
 *
 * ─── Carousel mechanics ──────────────────────────────────────────────────────
 *
 *   The logo list is rendered as two identical, side-by-side sibling divs
 *   inside a clipped outer container.  The outer track translates from 0 →
 *   -50% — exactly one sibling's width — so when the animation loops back to
 *   0 the visual is indistinguishable from mid-scroll.  No JavaScript needed.
 *
 *   Speed is driven by --marquee-duration (set via inline style).
 *   The .logo-marquee-track class (globals.css) applies the keyframe.
 *   .logo-marquee-dup marks the second set so prefers-reduced-motion CSS can
 *   hide it and revert to a static wrapped layout.
 *
 * ─── Logo rendering ──────────────────────────────────────────────────────────
 *
 *   Each item renders an <img> when src is present; otherwise the company
 *   name is shown as text — no broken images, ever.
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --section-subtle-bg      Section background
 *   --section-subtle-border  Section border colour
 *   --text-subtle            Label / heading text colour
 */

import { Container } from "@/components/primitives/Container";
import { Section }   from "@/components/primitives/Section";
import { Text }      from "@/components/primitives/Text";
import { resolveBlockVariant } from "@/page-config/block-variants";
import type { LogoStripVariant } from "@/page-config/block-variants";
import type { LogoStripBlockData, LogoItem } from "@/page-config";
import { resolveSurface, type BlockSurface } from "@/lib/surface";

// ── Animation speed ────────────────────────────────────────────────────────────

const SPEED_DURATION: Record<string, string> = {
  slow:   "60s",
  medium: "30s",
  fast:   "15s",
};

// ── Props ──────────────────────────────────────────────────────────────────────

interface LogoStripBlockProps {
  data:     LogoStripBlockData;
  variant?: string;
  surface?: BlockSurface;
}

// ── Logo cell ──────────────────────────────────────────────────────────────────

/**
 * Renders a single logo item.
 *
 * Priority:
 *   1. <img> when `logo.src` is non-empty — company name used as alt text.
 *   2. Styled text when `src` is absent — name shown as readable fallback.
 *
 * `showLabel` appends the name below the image for additional context.
 * `grayscale` applies a CSS grayscale filter; `muted` reduces opacity.
 *
 * Pure server component — no hooks or event handlers.
 */
function LogoCell({
  logo,
  grayscale,
  showLabel,
  muted,
}: {
  logo:      LogoItem;
  grayscale: boolean;
  showLabel: boolean;
  muted:     boolean;
}) {
  // ── Profile-driven logo filter ─────────────────────────────────────────────
  //
  // --block-logo-filter is set by the active theme's block style profile.
  // It controls default logo presentation (e.g. grayscale + reduced opacity
  // for editorial themes, or full-colour for playful themes).
  //
  // Priority: muted variant > grayscale prop > profile filter
  //   - muted: strong grayscale+opacity for "trusted by" subdued treatment
  //   - grayscale prop: explicit full grayscale requested by content author
  //   - profile default: the theme's logo filter (via CSS var)
  //
  // Note: opacity is driven via CSS filter(opacity()) — not the opacity
  // property — so it composes cleanly with the grayscale filter.

  const logoFilter: string = muted
    ? "grayscale(1) opacity(0.45)"
    : grayscale
      ? "grayscale(1)"
      : "var(--block-logo-filter, none)";

  // ── Visual: image or name fallback ────────────────────────────────────────
  const visual = logo.src ? (
    <div className="flex flex-col items-center gap-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo.src}
        alt={logo.name}
        width={130}
        height={32}
        className="h-8 w-auto max-w-[130px] object-contain"
        style={{ filter: logoFilter, transition: "filter 0.2s ease" }}
        loading="lazy"
        decoding="async"
      />
      {showLabel && (
        <span
          className="text-[10px] font-medium leading-none tracking-wide"
          style={{ color: "var(--text-subtle)", filter: logoFilter }}
        >
          {logo.name}
        </span>
      )}
    </div>
  ) : (
    <span
      className="whitespace-nowrap text-sm font-semibold tracking-tight"
      style={{ color: "var(--text-subtle)", filter: logoFilter }}
    >
      {logo.name}
    </span>
  );

  // ── Wrapper: link when url present, plain div otherwise ───────────────────
  if (logo.url) {
    return (
      <a
        href={logo.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={logo.name}
        /*
         * On hover: restore full opacity so the logo "activates".
         * This is done by overriding the img opacity via a sibling selector
         * approach — but since we can't write :hover > img in Tailwind JSX
         * without a custom class, we rely on the CSS filter transition on
         * the img itself.  The `group` + `group-hover` pattern handles this
         * without any JS.
         */
        className="group flex items-center rounded transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        {visual}
      </a>
    );
  }

  return <div className="flex items-center">{visual}</div>;
}

// ── Logo set (one copy) ────────────────────────────────────────────────────────

/**
 * Renders one complete copy of the logo list.
 * Used twice in the marquee track to create the seamless loop.
 */
function LogoSet({
  logos,
  grayscale,
  showLabel,
  muted,
  ariaHidden = false,
  keyPrefix  = "",
}: {
  logos:       readonly LogoItem[];
  grayscale:   boolean;
  showLabel:   boolean;
  muted:       boolean;
  ariaHidden?: boolean;
  keyPrefix?:  string;
}) {
  return (
    <div
      className="flex flex-shrink-0 items-center"
      aria-hidden={ariaHidden || undefined}
    >
      {logos.map((logo, i) => (
        <div
          key={`${keyPrefix}${i}-${logo.name}`}
          className="flex items-center px-7 py-2 sm:px-9 md:px-10"
        >
          <LogoCell
            logo={logo}
            grayscale={grayscale}
            showLabel={showLabel}
            muted={muted}
          />
        </div>
      ))}
    </div>
  );
}

// ── Block component ────────────────────────────────────────────────────────────

export function LogoStripBlock({ data, variant: rawVariant, surface }: LogoStripBlockProps) {
  const variant = resolveBlockVariant("logoStrip", rawVariant) as LogoStripVariant;

  const {
    heading,
    logos,
    animationEnabled = true,
    speed            = "slow",
    grayscale:       grayscaleProp,
    showLabels       = false,
  } = data;

  const rawItems  = logos ?? [];
  const muted     = variant === "muted";
  const grayscale = grayscaleProp ?? muted;   // muted variant defaults to grayscale
  const duration  = SPEED_DURATION[speed] ?? SPEED_DURATION.slow;

  // ── Marquee padding ────────────────────────────────────────────────────────
  //
  // The seamless marquee requires ONE set of logos to fill the viewport width.
  // Each logo cell is ~130px + ~80px padding ≈ 210px.  At 1440px viewport that
  // means ~7 logos per set.  When the content library has fewer items, we tile
  // the array so a single set always exceeds the typical viewport width.
  //
  // However, tiling looks wrong when the brand has very few logos — seeing
  // the same 2 logos repeated 4× is jarring.  We only enable the animated
  // marquee (and tiling) when there are at least MIN_LOGOS_TO_ANIMATE unique
  // logos.  Below that threshold we fall back to a static centred row, which
  // always looks clean regardless of logo count.
  //
  // logo_grid (static variant) renders logos without tiling — the full count is
  // always visible, so we leave rawItems untouched for that path.
  const MIN_LOGOS_TO_ANIMATE = 4;   // fewer than this → static centred row
  const MIN_LOGOS_PER_SET    = 8;   // tile up to this count for the marquee

  const isMarqueeVariant  = variant !== "logo_grid";
  const hasEnoughToScroll = rawItems.length >= MIN_LOGOS_TO_ANIMATE;
  // effectiveAnimation respects the content author's choice but disables the
  // marquee automatically when there are too few logos to look good scrolling.
  const effectiveAnimation = animationEnabled && isMarqueeVariant && hasEnoughToScroll;

  const items = (isMarqueeVariant && effectiveAnimation && rawItems.length > 0 && rawItems.length < MIN_LOGOS_PER_SET)
    ? Array.from(
        { length: Math.ceil(MIN_LOGOS_PER_SET / rawItems.length) },
        () => rawItems,
      ).flat()
    : rawItems;

  // ── Shared section style ───────────────────────────────────────────────────
  //
  // Divider presence is profile-driven via --block-divider-width.
  // 0px = no divider (playful-startup, dark-contrast); 1px = hairline.

  const sectionStyle = {
    background:       resolveSurface(surface) ?? "var(--section-subtle-bg)",
    borderTopWidth:    "var(--block-divider-width)",
    borderBottomWidth: "var(--block-divider-width)",
    borderTopColor:    "var(--block-divider-color)",
    borderBottomColor: "var(--block-divider-color)",
    borderTopStyle:    "solid" as const,
    borderBottomStyle: "solid" as const,
  };

  const headingEl = heading ? (
    <Text
      variant="body-sm"
      align="center"
      style={{
        color:         "var(--text-subtle)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
      }}
    >
      {heading}
    </Text>
  ) : null;

  // ── logo_grid — static CSS grid, no animation ──────────────────────────────
  //
  // This variant is intentionally static — all logos remain visible at once,
  // which is preferable for larger sets (6–12+) where the count matters.

  if (variant === "logo_grid") {
    return (
      <Section spacing="lg" style={sectionStyle}>
        <Container size="lg">
          <div className="flex flex-col items-center gap-8">
            {headingEl}
            {items.length > 0 && (
              <div
                className="grid w-full items-center justify-items-center gap-8"
                style={{ gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}
              >
                {items.map((logo) => (
                  <div key={logo.name} className="flex h-10 w-full items-center justify-center">
                    <LogoCell logo={logo} grayscale={grayscale} showLabel={showLabels} muted={false} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </Container>
      </Section>
    );
  }

  if (items.length === 0) return null;

  // ── default / muted — marquee carousel ────────────────────────────────────
  //
  // Outer clip container has an inset mask-image gradient so logos fade in/out
  // at the left and right edges rather than hard-cutting.
  //
  // Track structure:
  //   <div.logo-marquee-track>          ← animated, translateX 0 → -50%
  //     <LogoSet />                     ← first copy, accessible
  //     <LogoSet ariaHidden .logo-marquee-dup /> ← second copy, duplicated
  //   </div>
  //
  // The two <LogoSet> divs are identical flex children.  Total track width
  // is 2× one set.  Translating by -50% moves exactly one set's width →
  // seamless loop.  Spacing at the seam matches spacing between any pair:
  // px-7 on both sides of every item → 14+14 = 28px between any two logos.
  //
  // prefers-reduced-motion (in globals.css):
  //   .logo-marquee-track → animation: none; flex-wrap: wrap; justify-content: center
  //   .logo-marquee-dup   → display: none

  const trackStyle = effectiveAnimation
    ? ({ "--marquee-duration": duration } as React.CSSProperties)
    : undefined;

  return (
    <Section spacing="md" style={sectionStyle}>
      {/*
        Use `full` container so the strip reaches edge-to-edge before masking.
        The fade gradient handles the visual boundary; no hard container crop.
      */}
      <Container size="full">
        <div className="flex flex-col items-center gap-5">
          {headingEl && (
            /* Heading needs a constrained width so it centres nicely */
            <div className="px-4 text-center sm:px-6 lg:px-8">
              {headingEl}
            </div>
          )}

          {/* ── Outer clip + edge-fade ── */}
          <div
            className="relative w-full overflow-hidden"
            style={{
              WebkitMaskImage:
                "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
              maskImage:
                "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
            }}
          >
            {/* ── Marquee track ── */}
            <div
              className={
                effectiveAnimation
                  ? "logo-marquee-track flex items-center"
                  : "flex flex-wrap items-center justify-center"
              }
              style={trackStyle}
              role="list"
              aria-label={heading ?? "Partner logos"}
            >
              {/* Set 1 — accessible, full semantics */}
              <LogoSet
                logos={items}
                grayscale={grayscale}
                showLabel={showLabels}
                muted={muted}
                keyPrefix="set1-"
              />

              {/* Set 2 — purely visual duplicate for seamless loop */}
              {effectiveAnimation && (
                <div className="logo-marquee-dup">
                  <LogoSet
                    logos={items}
                    grayscale={grayscale}
                    showLabel={showLabels}
                    muted={muted}
                    ariaHidden
                    keyPrefix="dup-"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
