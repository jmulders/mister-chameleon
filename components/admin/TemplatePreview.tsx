import React from "react";
import type { TemplatePreviewType } from "@/page-config";

/**
 * TemplatePreview — Schematic page-layout thumbnails for the template selector UI
 *
 * Each preview is a compact SVG diagram (viewBox 0 0 80 100) that communicates
 * the structural layout of a full page template at a glance.
 *
 * ─── Design rules ────────────────────────────────────────────────────────────
 *
 *   - Same neutral grey palette as VariantPreview — no tenant design tokens.
 *   - No real content — shapes represent layout structure, not content.
 *   - Portrait orientation (4:5) to suggest a full page, not a block.
 *   - SVGs scale to fill their container (width/height 100%).
 *   - Unknown previewType renders a safe fallback (no throw, no blank).
 *
 * ─── Palette ─────────────────────────────────────────────────────────────────
 *
 *   #f3f4f6  neutral-100  page / section background
 *   #e5e7eb  neutral-200  subtle surfaces, card fills
 *   #d1d5db  neutral-300  content lines, image placeholders
 *   #9ca3af  neutral-400  muted elements, CTA banners, proof strips
 *   #6b7280  neutral-500  secondary content, buttons
 *   #374151  neutral-700  dark headers, nav bar, hero backgrounds
 *   #ffffff  white        card surfaces, text on dark
 *
 * ─── Adding a new previewType ────────────────────────────────────────────────
 *
 *   1. Add the string to TemplatePreviewType in page-config/template-catalog.ts.
 *   2. Write a small SVG function using the Svg wrapper.
 *   3. Add it to PREVIEWS.
 *   4. Reference the key in TEMPLATE_CATALOG via `previewType`.
 */

// ── Palette ───────────────────────────────────────────────────────────────────

const C = {
  bg:    "#f3f4f6",
  light: "#e5e7eb",
  mid:   "#d1d5db",
  muted: "#9ca3af",
  text:  "#6b7280",
  dark:  "#374151",
  white: "#ffffff",
} as const;

// ── SVG wrapper ───────────────────────────────────────────────────────────────

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 80 100"
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// ── Shared structural elements ────────────────────────────────────────────────

/** Nav bar — rendered at the very top of every template schematic. */
function NavBar() {
  return (
    <>
      <rect width="80" height="6" fill={C.dark} />
      {/* Logo placeholder */}
      <rect x="4" y="2" width="10" height="2" rx="0.5" fill={C.muted} />
      {/* Nav items */}
      <rect x="44" y="2" width="6" height="2" rx="0.5" fill={C.text} />
      <rect x="52" y="2" width="6" height="2" rx="0.5" fill={C.text} />
      <rect x="60" y="2" width="6" height="2" rx="0.5" fill={C.text} />
      {/* CTA button */}
      <rect x="68" y="1.5" width="8" height="3" rx="1" fill={C.muted} />
    </>
  );
}

/** Hero block — dark full-width banner with heading + subtext + button. */
function HeroBlock({ y, h = 24 }: { y: number; h?: number }) {
  return (
    <>
      <rect x="0" y={y} width="80" height={h} fill={C.dark} />
      {/* Heading */}
      <rect x="16" y={y + 5} width="48" height="3" rx="1" fill={C.white} />
      {/* Sub-heading */}
      <rect x="22" y={y + 10} width="36" height="2" rx="0.5" fill={C.muted} />
      {/* CTA button */}
      <rect x="28" y={y + 14} width="24" height="5" rx="2" fill={C.text} />
    </>
  );
}

/** Proof / logo strip — light-bg row of icon/logo placeholders. */
function ProofStrip({ y }: { y: number }) {
  return (
    <>
      <rect x="0" y={y} width="80" height="10" fill={C.light} />
      {/* 5 logo placeholders evenly spaced */}
      <rect x="4"  y={y + 3} width="10" height="4" rx="1" fill={C.mid} />
      <rect x="18" y={y + 3} width="10" height="4" rx="1" fill={C.mid} />
      <rect x="32" y={y + 3} width="10" height="4" rx="1" fill={C.mid} />
      <rect x="46" y={y + 3} width="10" height="4" rx="1" fill={C.mid} />
      <rect x="60" y={y + 3} width="10" height="4" rx="1" fill={C.mid} />
    </>
  );
}

/** Content section — heading line + a few paragraph lines. */
function ContentSection({ y, short = false }: { y: number; short?: boolean }) {
  return (
    <>
      {/* Section heading */}
      <rect x="8" y={y}     width="24" height="2" rx="0.5" fill={C.mid} />
      {/* Paragraph lines */}
      <rect x="8" y={y + 4} width="64" height="1.5" rx="0.5" fill={C.light} />
      <rect x="8" y={y + 7} width="60" height="1.5" rx="0.5" fill={C.light} />
      {!short && (
        <rect x="8" y={y + 10} width="52" height="1.5" rx="0.5" fill={C.light} />
      )}
    </>
  );
}

/** CTA banner — muted full-width strip with centred heading + button. */
function CtaBanner({ y, h = 16 }: { y: number; h?: number }) {
  return (
    <>
      <rect x="0" y={y} width="80" height={h} fill={C.muted} />
      {/* Heading */}
      <rect x="20" y={y + 3} width="40" height="2.5" rx="0.5" fill={C.white} />
      {/* Button */}
      <rect x="28" y={y + 8} width="24" height="5" rx="2" fill={C.text} />
    </>
  );
}

/** Card row — 3 equal-width cards side by side. */
function CardRow({ y, h = 14 }: { y: number; h?: number }) {
  const cardW = 22;
  const gap   = 3;
  const startX = 4;
  return (
    <>
      {[0, 1, 2].map((i) => {
        const x = startX + i * (cardW + gap);
        return (
          <g key={i}>
            <rect x={x} y={y} width={cardW} height={h} rx="1.5" fill={C.white} stroke={C.light} strokeWidth="0.5" />
            {/* Image placeholder */}
            <rect x={x} y={y} width={cardW} height={h * 0.45} rx="1.5" fill={C.mid} />
            {/* Title line */}
            <rect x={x + 2} y={y + h * 0.55} width={cardW - 8} height="1.5" rx="0.5" fill={C.mid} />
            {/* Sub line */}
            <rect x={x + 2} y={y + h * 0.7} width={cardW - 12} height="1.5" rx="0.5" fill={C.light} />
          </g>
        );
      })}
    </>
  );
}

/** Article / entity meta header — image left, title/meta right. */
function MetaHeader({ y, h = 20 }: { y: number; h?: number }) {
  return (
    <>
      <rect x="0" y={y} width="80" height={h} fill={C.bg} />
      {/* Image */}
      <rect x="4" y={y + 2} width={h - 4} height={h - 4} rx="1.5" fill={C.mid} />
      {/* Title */}
      <rect x={h + 4} y={y + 4}  width="38" height="3" rx="0.5" fill={C.dark} />
      {/* Meta line 1 */}
      <rect x={h + 4} y={y + 9}  width="28" height="1.5" rx="0.5" fill={C.mid} />
      {/* Meta line 2 */}
      <rect x={h + 4} y={y + 12} width="22" height="1.5" rx="0.5" fill={C.light} />
    </>
  );
}

/** Listing page intro — centred heading + short intro. */
function ListingIntro({ y }: { y: number }) {
  return (
    <>
      <rect x="0" y={y} width="80" height="14" fill={C.bg} />
      {/* Heading */}
      <rect x="20" y={y + 3} width="40" height="3" rx="0.5" fill={C.dark} />
      {/* Sub line */}
      <rect x="25" y={y + 8} width="30" height="1.5" rx="0.5" fill={C.mid} />
    </>
  );
}

/** Article body — many short text lines suggesting long-form content. */
function ArticleBody({ y, h }: { y: number; h: number }) {
  const lineH = 2.5;
  const gap   = 1.5;
  const lines = Math.floor(h / (lineH + gap));
  return (
    <>
      <rect x="0" y={y} width="80" height={h} fill={C.bg} />
      {Array.from({ length: lines }, (_, i) => {
        const lineY = y + 2 + i * (lineH + gap);
        // Vary line widths to simulate text
        const widths = [60, 64, 56, 62, 52, 58, 60, 48, 64, 54, 60, 56];
        const w = widths[i % widths.length];
        return (
          <rect
            key={i}
            x="8"
            y={lineY}
            width={w}
            height={lineH}
            rx="0.5"
            fill={C.light}
          />
        );
      })}
    </>
  );
}

// ── Template schematics ───────────────────────────────────────────────────────

/**
 * marketing — Hero + Proof strip + two content sections + CTA banner
 *
 * Structural pattern:
 *   nav (6) | hero (26) | proof (10) | content x2 (28) | cta (18) | pad (12)
 */
function Marketing() {
  return (
    <Svg>
      <rect width="80" height="100" fill={C.bg} />
      <NavBar />
      <HeroBlock y={8} h={24} />
      <ProofStrip y={34} />
      {/* Content area */}
      <ContentSection y={46} />
      <ContentSection y={62} short />
      {/* CTA */}
      <CtaBanner y={78} h={16} />
      {/* Bottom pad */}
      <rect x="0" y="94" width="80" height="6" fill={C.bg} />
    </Svg>
  );
}

/**
 * landing — Hero + content sections + CTA banner (no proof strip)
 *
 * Structural pattern:
 *   nav (6) | hero (28) | content x2 (34) | cta (20) | pad (12)
 */
function Landing() {
  return (
    <Svg>
      <rect width="80" height="100" fill={C.bg} />
      <NavBar />
      <HeroBlock y={8} h={28} />
      {/* Content area — slightly taller since no proof strip */}
      <ContentSection y={40} />
      <ContentSection y={58} short />
      {/* CTA */}
      <CtaBanner y={76} h={16} />
      <rect x="0" y="92" width="80" height="8" fill={C.bg} />
    </Svg>
  );
}

/**
 * article — Article meta header + long-form body content
 *
 * Structural pattern:
 *   nav (6) | meta header (22) | article body (fills rest)
 */
function Article() {
  return (
    <Svg>
      <rect width="80" height="100" fill={C.bg} />
      <NavBar />
      {/* Article title area */}
      <rect x="0" y={8} width="80" height="14" fill={C.bg} />
      <rect x="8" y={11} width="56" height="3" rx="0.5" fill={C.dark} />
      <rect x="8" y={16} width="36" height="1.5" rx="0.5" fill={C.mid} />
      {/* Separator */}
      <rect x="8" y={24} width="64" height="0.5" fill={C.light} />
      {/* Body text */}
      <ArticleBody y={27} h={68} />
    </Svg>
  );
}

/**
 * listing — Intro header + two rows of 3-column card grid
 *
 * Structural pattern:
 *   nav (6) | intro (14) | card row 1 (14) | gap | card row 2 (14) | pad
 */
function Listing() {
  return (
    <Svg>
      <rect width="80" height="100" fill={C.bg} />
      <NavBar />
      <ListingIntro y={8} />
      {/* Card grid — two rows */}
      <CardRow y={25} h={18} />
      <CardRow y={46} h={18} />
      <CardRow y={67} h={18} />
      <rect x="0" y="85" width="80" height="15" fill={C.bg} />
    </Svg>
  );
}

/**
 * detail — Entity meta header (image + title/meta) + body content
 *
 * Structural pattern:
 *   nav (6) | meta header (22) | body content | related items (card row)
 */
function Detail() {
  return (
    <Svg>
      <rect width="80" height="100" fill={C.bg} />
      <NavBar />
      <MetaHeader y={8} h={22} />
      {/* Body content */}
      <ContentSection y={33} />
      <ContentSection y={49} short />
      <ContentSection y={63} short />
      {/* Related items — single card row */}
      <rect x="0" y="78" width="80" height="2" fill={C.light} />
      <rect x="8" y="82" width="18" height="1.5" rx="0.5" fill={C.mid} />
      <CardRow y={86} h={12} />
    </Svg>
  );
}

// ── Fallback ───────────────────────────────────────────────────────────────────

function Unknown() {
  return (
    <Svg>
      <rect width="80" height="100" fill={C.bg} />
      <NavBar />
      <ContentSection y={16} />
      <ContentSection y={34} short />
      <CtaBanner y={76} />
    </Svg>
  );
}

// ── Preview registry ──────────────────────────────────────────────────────────

const PREVIEWS: Record<TemplatePreviewType, () => React.ReactElement> = {
  marketing: Marketing,
  landing:   Landing,
  article:   Article,
  listing:   Listing,
  detail:    Detail,
};

// ── Public component ──────────────────────────────────────────────────────────

export interface TemplatePreviewProps {
  previewType: TemplatePreviewType;
  className?:  string;
}

/**
 * Renders a schematic SVG thumbnail for the given template layout type.
 *
 * The SVG fills 100% of its container — wrap in a sized element to control
 * the rendered dimensions.
 *
 * @example
 * <div className="w-20 h-24">
 *   <TemplatePreview previewType="marketing" />
 * </div>
 */
export function TemplatePreview({ previewType, className }: TemplatePreviewProps) {
  const Preview = PREVIEWS[previewType] ?? Unknown;
  if (className) {
    return <span className={className}><Preview /></span>;
  }
  return <Preview />;
}
