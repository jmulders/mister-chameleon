import React from "react";

/**
 * VariantPreview — Schematic layout thumbnails for the variant selector UI
 *
 * Each preview is a compact SVG diagram (viewBox 0 0 80 48) that communicates
 * the structural layout of a block variant at a glance.
 *
 * ─── Design rules ────────────────────────────────────────────────────────────
 *
 *   - Neutral grey palette only — never tenant design tokens.
 *   - No real content — shapes represent layout structure, not content.
 *   - SVGs scale to fill their container (width/height 100%).
 *   - Unknown previewType renders a safe fallback (no throw, no blank).
 *
 * ─── Palette ─────────────────────────────────────────────────────────────────
 *
 *   #f3f4f6  neutral-100  section / page bg
 *   #e5e7eb  neutral-200  subtle surfaces, borders
 *   #d1d5db  neutral-300  content blocks, image placeholders
 *   #9ca3af  neutral-400  muted elements, buttons, CTAs
 *   #6b7280  neutral-500  icons, secondary content
 *   #374151  neutral-700  dark headers, hero backgrounds, footers
 *   #1f2937  neutral-800  deepest dark
 *   #ffffff  white        card surfaces
 *
 * ─── Adding a new previewType ────────────────────────────────────────────────
 *
 *   1. Add the string to the PreviewType union below.
 *   2. Write a small SVG function (aim for ≤ 20 lines of JSX).
 *   3. Add it to PREVIEWS.
 *   4. Reference the key in BLOCK_VARIANT_REGISTER via `previewType`.
 */

// ── Palette ───────────────────────────────────────────────────────────────────

const C = {
  bg:    "#f3f4f6",
  light: "#e5e7eb",
  mid:   "#d1d5db",
  muted: "#9ca3af",
  text:  "#6b7280",
  dark:  "#374151",
  black: "#1f2937",
  white: "#ffffff",
} as const;

// ── SVG wrapper ───────────────────────────────────────────────────────────────

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 80 48"
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// ── Schematic components ──────────────────────────────────────────────────────

/** Full-width brand-coloured section — CTA banner, footer simple */
function Banner() {
  return (
    <Svg>
      <rect width="80" height="48" fill={C.bg} />
      <rect y="10" width="80" height="28" fill={C.muted} />
      <rect x="22" y="18" width="36" height="3" rx="1" fill={C.white} />
      <rect x="29" y="24" width="22" height="6" rx="2" fill={C.text} />
    </Svg>
  );
}

/** Elevated card centred on a neutral background — CTA card, form panel */
function Card() {
  return (
    <Svg>
      <rect width="80" height="48" fill={C.bg} />
      <rect x="10" y="6" width="60" height="36" rx="3" fill={C.white} stroke={C.light} strokeWidth="1" />
      <rect x="22" y="14" width="36" height="4" rx="1" fill={C.mid} />
      <rect x="26" y="21" width="28" height="3" rx="1" fill={C.light} />
      <rect x="28" y="27" width="24" height="3" rx="1" fill={C.light} />
      <rect x="27" y="33" width="26" height="5" rx="2" fill={C.muted} />
    </Svg>
  );
}

/** Dark hero background, centred text + CTA — hero default, text lead, quote single */
function Centered() {
  return (
    <Svg>
      <rect width="80" height="48" fill={C.dark} />
      <rect x="18" y="10" width="44" height="4" rx="1" fill={C.muted} />
      <rect x="24" y="17" width="32" height="3" rx="1" fill={C.text} />
      <rect x="28" y="24" width="24" height="7" rx="3" fill={C.muted} />
      <rect width="80" height="1" y="34" fill={C.black} />
      <rect x="24" y="38" width="32" height="2" rx="1" fill={C.text} />
      <rect x="28" y="43" width="24" height="2" rx="1" fill={C.text} />
    </Svg>
  );
}

/** Compact dark hero + 3-cell proof bar — hero with proof */
function CenteredProof() {
  return (
    <Svg>
      <rect width="80" height="48" fill={C.dark} />
      <rect x="20" y="6" width="40" height="4" rx="1" fill={C.muted} />
      <rect x="26" y="13" width="28" height="3" rx="1" fill={C.text} />
      <rect x="29" y="19" width="22" height="6" rx="3" fill={C.muted} />
      {/* proof bar */}
      <rect y="28" width="80" height="1" fill={C.black} />
      <rect y="29" width="80" height="19" fill={C.black} />
      <rect x="2"  y="32" width="24" height="11" rx="2" fill={C.dark} />
      <rect x="28" y="32" width="24" height="11" rx="2" fill={C.dark} />
      <rect x="54" y="32" width="24" height="11" rx="2" fill={C.dark} />
      <rect x="7"  y="35" width="14" height="4" rx="1" fill={C.text} />
      <rect x="33" y="35" width="14" height="4" rx="1" fill={C.text} />
      <rect x="59" y="35" width="14" height="4" rx="1" fill={C.text} />
    </Svg>
  );
}

/** Text left / media image right — hero split, about media-right */
function SplitMediaRight() {
  return (
    <Svg>
      <rect width="80" height="48" fill={C.bg} />
      {/* text column */}
      <rect x="4"  y="8"  width="34" height="4" rx="1" fill={C.mid} />
      <rect x="4"  y="15" width="30" height="3" rx="1" fill={C.light} />
      <rect x="4"  y="21" width="32" height="3" rx="1" fill={C.light} />
      <rect x="4"  y="27" width="26" height="3" rx="1" fill={C.light} />
      <rect x="4"  y="35" width="20" height="7" rx="3" fill={C.muted} />
      {/* image block */}
      <rect x="42" y="4"  width="34" height="40" rx="3" fill={C.mid} />
    </Svg>
  );
}

/** Media image left / text right — about media-left */
function SplitMediaLeft() {
  return (
    <Svg>
      <rect width="80" height="48" fill={C.bg} />
      {/* image block */}
      <rect x="4"  y="4"  width="34" height="40" rx="3" fill={C.mid} />
      {/* text column */}
      <rect x="42" y="8"  width="34" height="4" rx="1" fill={C.mid} />
      <rect x="42" y="15" width="30" height="3" rx="1" fill={C.light} />
      <rect x="42" y="21" width="32" height="3" rx="1" fill={C.light} />
      <rect x="42" y="27" width="26" height="3" rx="1" fill={C.light} />
      <rect x="42" y="35" width="20" height="7" rx="3" fill={C.muted} />
    </Svg>
  );
}

/** Text left / CTA button right — CTA split section */
function SplitCta() {
  return (
    <Svg>
      <rect width="80" height="48" fill={C.muted} />
      <rect x="4"  y="14" width="36" height="4" rx="1" fill={C.white} />
      <rect x="4"  y="21" width="28" height="3" rx="1" fill={C.light} />
      <rect x="4"  y="27" width="32" height="3" rx="1" fill={C.light} />
      <rect x="52" y="16" width="24" height="14" rx="3" fill={C.text} />
      <rect x="56" y="21" width="16" height="3" rx="1" fill={C.muted} />
    </Svg>
  );
}

/** Narrow heading left / body copy right — text split */
function SplitText() {
  return (
    <Svg>
      <rect width="80" height="48" fill={C.bg} />
      {/* heading column (narrow) */}
      <rect x="4" y="8"  width="22" height="5" rx="1" fill={C.muted} />
      <rect x="4" y="17" width="18" height="3" rx="1" fill={C.mid} />
      <rect x="4" y="23" width="20" height="3" rx="1" fill={C.mid} />
      {/* body column (wide) */}
      <rect x="30" y="8"  width="46" height="3" rx="1" fill={C.mid} />
      <rect x="30" y="14" width="44" height="3" rx="1" fill={C.light} />
      <rect x="30" y="20" width="46" height="3" rx="1" fill={C.light} />
      <rect x="30" y="26" width="40" height="3" rx="1" fill={C.light} />
      <rect x="30" y="32" width="44" height="3" rx="1" fill={C.light} />
      <rect x="30" y="38" width="36" height="3" rx="1" fill={C.light} />
    </Svg>
  );
}

/** Text left / stacked form inputs right — form split */
function SplitForm() {
  return (
    <Svg>
      <rect width="80" height="48" fill={C.bg} />
      {/* intro text */}
      <rect x="4" y="6"  width="30" height="4" rx="1" fill={C.mid} />
      <rect x="4" y="14" width="26" height="3" rx="1" fill={C.light} />
      <rect x="4" y="20" width="28" height="3" rx="1" fill={C.light} />
      <rect x="4" y="26" width="22" height="3" rx="1" fill={C.light} />
      {/* form inputs */}
      <rect x="38" y="4"  width="38" height="9" rx="2" fill={C.white} stroke={C.light} strokeWidth="1" />
      <rect x="38" y="15" width="38" height="9" rx="2" fill={C.white} stroke={C.light} strokeWidth="1" />
      <rect x="38" y="26" width="38" height="9" rx="2" fill={C.white} stroke={C.light} strokeWidth="1" />
      <rect x="38" y="38" width="24" height="8" rx="3" fill={C.muted} />
    </Svg>
  );
}

/** Full-width image slab above centred text — about media-full */
function MediaFull() {
  return (
    <Svg>
      <rect width="80" height="48" fill={C.bg} />
      <rect width="80" height="24" fill={C.mid} />
      <rect x="20" y="28" width="40" height="4" rx="1" fill={C.mid} />
      <rect x="24" y="35" width="32" height="3" rx="1" fill={C.light} />
      <rect x="28" y="41" width="24" height="3" rx="1" fill={C.light} />
    </Svg>
  );
}

/** Three equal card columns — feature 3-up, listing cards */
function Grid3() {
  return (
    <Svg>
      <rect width="80" height="48" fill={C.bg} />
      {[2, 28, 54].map((x) => (
        <g key={x}>
          <rect x={x}    y="4"  width="24" height="40" rx="2" fill={C.white} stroke={C.light} strokeWidth="0.75" />
          <rect x={x+4}  y="9"  width="16" height="14" rx="1" fill={C.mid} />
          <rect x={x+3}  y="27" width="18" height="3"  rx="1" fill={C.mid} />
          <rect x={x+3}  y="33" width="15" height="2"  rx="1" fill={C.light} />
          <rect x={x+3}  y="38" width="12" height="2"  rx="1" fill={C.light} />
        </g>
      ))}
    </Svg>
  );
}

/** Four narrow card columns — feature 4-up */
function Grid4() {
  return (
    <Svg>
      <rect width="80" height="48" fill={C.bg} />
      {[1, 21, 41, 61].map((x) => (
        <g key={x}>
          <rect x={x}   y="6"  width="18" height="36" rx="2" fill={C.white} stroke={C.light} strokeWidth="0.75" />
          <rect x={x+3} y="10" width="12" height="10" rx="1" fill={C.mid} />
          <rect x={x+2} y="24" width="14" height="3"  rx="1" fill={C.mid} />
          <rect x={x+2} y="30" width="11" height="2"  rx="1" fill={C.light} />
          <rect x={x+2} y="35" width="13" height="2"  rx="1" fill={C.light} />
        </g>
      ))}
    </Svg>
  );
}

/** Three elevated shadow cards — feature grid cards */
function GridShadow() {
  return (
    <Svg>
      <rect width="80" height="48" fill={C.white} />
      {[2, 28, 54].map((x) => (
        <g key={x}>
          {/* shadow hint */}
          <rect x={x+2} y="6"  width="24" height="40" rx="3" fill={C.light} />
          {/* card */}
          <rect x={x}   y="4"  width="24" height="40" rx="3" fill={C.white} stroke={C.light} strokeWidth="1" />
          <rect x={x+4} y="9"  width="16" height="12" rx="2" fill={C.light} />
          <rect x={x+3} y="25" width="18" height="3"  rx="1" fill={C.mid} />
          <rect x={x+3} y="31" width="14" height="2"  rx="1" fill={C.light} />
          <rect x={x+3} y="36" width="16" height="2"  rx="1" fill={C.light} />
        </g>
      ))}
    </Svg>
  );
}

/** Icon-left row checklist — feature grid checklist */
function Checklist() {
  return (
    <Svg>
      <rect width="80" height="48" fill={C.bg} />
      {[5, 17, 29, 41].map((y) => (
        <g key={y}>
          <circle cx="10" cy={y + 4} r="4" fill={C.mid} />
          <rect x="18" y={y + 1}  width="54" height="3" rx="1" fill={C.mid} />
          <rect x="18" y={y + 7}  width="44" height="2" rx="1" fill={C.light} />
        </g>
      ))}
    </Svg>
  );
}

/** Left-aligned single text column — text single */
function SingleCol() {
  return (
    <Svg>
      <rect width="80" height="48" fill={C.bg} />
      <rect x="8" y="5"  width="40" height="5" rx="1" fill={C.muted} />
      <rect x="8" y="14" width="64" height="3" rx="1" fill={C.mid} />
      <rect x="8" y="20" width="60" height="3" rx="1" fill={C.light} />
      <rect x="8" y="26" width="64" height="3" rx="1" fill={C.light} />
      <rect x="8" y="32" width="56" height="3" rx="1" fill={C.light} />
      <rect x="8" y="41" width="22" height="6" rx="2" fill={C.muted} />
    </Svg>
  );
}

/** Stacked full-width rows — listing rows, FAQ single col */
function ListRows() {
  return (
    <Svg>
      <rect width="80" height="48" fill={C.bg} />
      {[1, 13, 25, 37].map((y) => (
        <g key={y}>
          <rect x="2" y={y}  width="76" height="11" rx="2" fill={C.white} stroke={C.light} strokeWidth="0.5" />
          <rect x="6" y={y+3} width="32" height="3" rx="1" fill={C.mid} />
          <rect x="56" y={y+3} width="18" height="3" rx="1" fill={C.light} />
        </g>
      ))}
    </Svg>
  );
}

/** Dense compact rows — listing compact */
function ListCompact() {
  return (
    <Svg>
      <rect width="80" height="48" fill={C.bg} />
      {[2, 10, 18, 26, 34, 42].map((y) => (
        <g key={y}>
          <rect x="2" y={y}  width="76" height="7" rx="1" fill={C.white} stroke={C.light} strokeWidth="0.5" />
          <rect x="6" y={y+2} width="36" height="2.5" rx="1" fill={C.mid} />
          <rect x="60" y={y+2} width="14" height="2.5" rx="1" fill={C.light} />
        </g>
      ))}
    </Svg>
  );
}

/** Three metric stat blocks — proof stats */
function StatsRow() {
  return (
    <Svg>
      <rect width="80" height="48" fill={C.bg} />
      <rect y="8" width="80" height="32" fill={C.white} />
      {[4, 29, 54].map((x) => (
        <g key={x}>
          <rect x={x}   y="12" width="22" height="20" rx="2" fill={C.bg} />
          <rect x={x+4} y="15" width="14" height="8"  rx="1" fill={C.dark} />
          <rect x={x+3} y="26" width="16" height="2"  rx="1" fill={C.mid} />
        </g>
      ))}
    </Svg>
  );
}

/** Horizontal logo pill strip — proof logos */
function LogoStrip() {
  return (
    <Svg>
      <rect width="80" height="48" fill={C.white} />
      <rect x="20" y="5"  width="40" height="3" rx="1" fill={C.light} />
      {[4, 22, 40, 58].map((x) => (
        <rect key={x} x={x} y="16" width="16" height="9" rx="2" fill={C.light} />
      ))}
      <rect x="26" y="34" width="28" height="2" rx="1" fill={C.light} />
      <rect x="30" y="39" width="20" height="2" rx="1" fill={C.light} />
    </Svg>
  );
}

/** Three quote cards — proof quotes, testimonial grid */
function QuoteGrid() {
  return (
    <Svg>
      <rect width="80" height="48" fill={C.bg} />
      {[2, 28, 54].map((x) => (
        <g key={x}>
          <rect x={x}   y="3"  width="24" height="40" rx="2" fill={C.white} stroke={C.light} strokeWidth="0.75" />
          <rect x={x+3} y="8"  width="7"  height="5"  rx="1" fill={C.light} />
          <rect x={x+3} y="16" width="18" height="2"  rx="1" fill={C.mid} />
          <rect x={x+3} y="21" width="16" height="2"  rx="1" fill={C.light} />
          <rect x={x+3} y="26"   width="18" height="2"  rx="1" fill={C.light} />
          <circle cx={x+6}  cy="38" r="3" fill={C.light} />
          <rect x={x+11} y="36" width="10" height="2" rx="1" fill={C.light} />
        </g>
      ))}
    </Svg>
  );
}

/** Large featured quote + 3 small cards — testimonial highlight */
function QuoteHighlight() {
  return (
    <Svg>
      <rect width="80" height="48" fill={C.bg} />
      {/* featured */}
      <rect x="2" y="2"  width="76" height="20" rx="3" fill={C.dark} />
      <rect x="6" y="6"  width="8"  height="6"  rx="1" fill={C.text} />
      <rect x="6" y="14" width="56" height="2"  rx="1" fill={C.text} />
      <rect x="6" y="18" width="44" height="2"  rx="1" fill={C.text} />
      {/* supporting */}
      {[2, 28, 54].map((x) => (
        <g key={x}>
          <rect x={x}   y="24" width="24" height="22" rx="2" fill={C.white} stroke={C.light} strokeWidth="0.75" />
          <rect x={x+3} y="28" width="18" height="2"  rx="1" fill={C.mid} />
          <rect x={x+3} y="33" width="14" height="2"  rx="1" fill={C.light} />
          <rect x={x+3} y="38" width="16" height="2"  rx="1" fill={C.light} />
        </g>
      ))}
    </Svg>
  );
}

/** Two-column accordion grid — FAQ split */
function Accordion2Col() {
  return (
    <Svg>
      <rect width="80" height="48" fill={C.bg} />
      {[4, 14, 24, 34].map((y) => (
        <g key={y}>
          <rect x="1"  y={y} width="38" height="8" rx="1" fill={C.white} stroke={C.light} strokeWidth="0.5" />
          <rect x="5"  y={y+2.5} width="26" height="2.5" rx="1" fill={C.mid} />
          <rect x="41" y={y} width="38" height="8" rx="1" fill={C.white} stroke={C.light} strokeWidth="0.5" />
          <rect x="45" y={y+2.5} width="26" height="2.5" rx="1" fill={C.mid} />
        </g>
      ))}
    </Svg>
  );
}

/** Stacked form inputs centred — form inline */
function FormInline() {
  return (
    <Svg>
      <rect width="80" height="48" fill={C.bg} />
      <rect x="20" y="2"  width="40" height="4" rx="1" fill={C.mid} />
      <rect x="6"  y="9"  width="68" height="9" rx="2" fill={C.white} stroke={C.light} strokeWidth="1" />
      <rect x="6"  y="20" width="68" height="9" rx="2" fill={C.white} stroke={C.light} strokeWidth="1" />
      <rect x="6"  y="31" width="68" height="9" rx="2" fill={C.white} stroke={C.light} strokeWidth="1" />
      <rect x="22" y="43" width="36" height="5" rx="2" fill={C.muted} />
    </Svg>
  );
}

/** Sticky nav bar — logo left, links right */
function NavDefault() {
  return (
    <Svg>
      <rect width="80" height="48" fill={C.white} />
      <rect y="0" width="80" height="20" fill={C.white} stroke={C.light} strokeWidth="0.5" />
      <rect x="4"  y="6"  width="18" height="8" rx="2" fill={C.dark} />
      <rect x="36" y="8"  width="10" height="4" rx="1" fill={C.light} />
      <rect x="50" y="8"  width="10" height="4" rx="1" fill={C.light} />
      <rect x="64" y="8"  width="10" height="4" rx="1" fill={C.light} />
      {/* page hint below */}
      <rect x="12" y="28" width="56" height="4" rx="1" fill={C.light} />
      <rect x="20" y="36" width="40" height="3" rx="1" fill={C.bg} />
    </Svg>
  );
}

/** Centred logo top, nav centred below */
function NavCentered() {
  return (
    <Svg>
      <rect width="80" height="48" fill={C.white} />
      <rect y="0" width="80" height="28" fill={C.white} stroke={C.light} strokeWidth="0.5" />
      <rect x="30" y="4"  width="20" height="8" rx="2" fill={C.dark} />
      <rect x="10" y="18" width="10" height="4" rx="1" fill={C.light} />
      <rect x="24" y="18" width="10" height="4" rx="1" fill={C.light} />
      <rect x="38" y="18" width="10" height="4" rx="1" fill={C.light} />
      <rect x="52" y="18" width="10" height="4" rx="1" fill={C.light} />
      {/* page hint */}
      <rect x="16" y="36" width="48" height="3" rx="1" fill={C.light} />
    </Svg>
  );
}

/** Logo left, nav centre, CTA button right */
function NavCta() {
  return (
    <Svg>
      <rect width="80" height="48" fill={C.white} />
      <rect y="0" width="80" height="20" fill={C.white} stroke={C.light} strokeWidth="0.5" />
      <rect x="4"  y="6"  width="16" height="8" rx="2" fill={C.dark} />
      <rect x="27" y="8"  width="9"  height="4" rx="1" fill={C.light} />
      <rect x="39" y="8"  width="9"  height="4" rx="1" fill={C.light} />
      <rect x="57" y="4"  width="19" height="12" rx="3" fill={C.muted} />
      <rect x="61" y="8"  width="11" height="4" rx="1" fill={C.white} />
      {/* page hint */}
      <rect x="12" y="30" width="56" height="4" rx="1" fill={C.light} />
    </Svg>
  );
}

/** Multi-column grouped links — footer columns */
function FooterCols() {
  return (
    <Svg>
      <rect width="80" height="48" fill={C.dark} />
      {[4, 30, 56].map((x) => (
        <g key={x}>
          <rect x={x}   y="6"  width="20" height="3" rx="1" fill={C.muted} />
          <rect x={x}   y="13" width="16" height="2" rx="1" fill={C.text} />
          <rect x={x}   y="18" width="18" height="2" rx="1" fill={C.text} />
          <rect x={x}   y="23" width="14" height="2" rx="1" fill={C.text} />
          <rect x={x}   y="28" width="16" height="2" rx="1" fill={C.text} />
        </g>
      ))}
      <rect y="36" width="80" height="12" fill={C.black} />
      <rect x="4"  y="40" width="22" height="2" rx="1" fill={C.dark} />
      <rect x="54" y="40" width="22" height="2" rx="1" fill={C.dark} />
    </Svg>
  );
}

/** CTA band above footer links — footer CTA */
function FooterCta() {
  return (
    <Svg>
      <rect width="80" height="48" fill={C.bg} />
      {/* CTA band */}
      <rect y="0"  width="80" height="22" fill={C.muted} />
      <rect x="18" y="5"  width="44" height="4" rx="1" fill={C.white} />
      <rect x="27" y="12" width="26" height="7" rx="3" fill={C.text} />
      {/* footer */}
      <rect y="22" width="80" height="26" fill={C.dark} />
      <rect x="4"  y="27" width="18" height="3" rx="1" fill={C.muted} />
      <rect x="4"  y="33" width="14" height="2" rx="1" fill={C.text} />
      <rect x="4"  y="38" width="16" height="2" rx="1" fill={C.text} />
      <rect x="32" y="27" width="44" height="2" rx="1" fill={C.text} />
      <rect x="32" y="32" width="40" height="2" rx="1" fill={C.text} />
    </Svg>
  );
}

/** Generic fallback — no previewType defined */
function Fallback() {
  return (
    <Svg>
      <rect width="80" height="48" fill={C.bg} />
      <rect x="10" y="10" width="60" height="28" rx="3" fill={C.light} stroke={C.mid} strokeWidth="1" strokeDasharray="3 2" />
      <rect x="28" y="21" width="24" height="3" rx="1" fill={C.mid} />
      <rect x="32" y="27" width="16" height="3" rx="1" fill={C.light} />
    </Svg>
  );
}

// ── Type union ─────────────────────────────────────────────────────────────────

export type PreviewType =
  | "banner"
  | "card"
  | "centered"
  | "centered-proof"
  | "split-media-right"
  | "split-media-left"
  | "split-cta"
  | "split-text"
  | "split-form"
  | "media-full"
  | "grid-3"
  | "grid-4"
  | "grid-shadow"
  | "checklist"
  | "single-col"
  | "list-rows"
  | "list-compact"
  | "stats-row"
  | "logo-strip"
  | "quote-grid"
  | "quote-highlight"
  | "accordion-2col"
  | "form-inline"
  | "nav-default"
  | "nav-centered"
  | "nav-cta"
  | "footer-cols"
  | "footer-cta";

// ── Lookup map ────────────────────────────────────────────────────────────────

const PREVIEWS: Record<PreviewType, () => React.ReactElement> = {
  "banner":           Banner,
  "card":             Card,
  "centered":         Centered,
  "centered-proof":   CenteredProof,
  "split-media-right": SplitMediaRight,
  "split-media-left": SplitMediaLeft,
  "split-cta":        SplitCta,
  "split-text":       SplitText,
  "split-form":       SplitForm,
  "media-full":       MediaFull,
  "grid-3":           Grid3,
  "grid-4":           Grid4,
  "grid-shadow":      GridShadow,
  "checklist":        Checklist,
  "single-col":       SingleCol,
  "list-rows":        ListRows,
  "list-compact":     ListCompact,
  "stats-row":        StatsRow,
  "logo-strip":       LogoStrip,
  "quote-grid":       QuoteGrid,
  "quote-highlight":  QuoteHighlight,
  "accordion-2col":   Accordion2Col,
  "form-inline":      FormInline,
  "nav-default":      NavDefault,
  "nav-centered":     NavCentered,
  "nav-cta":          NavCta,
  "footer-cols":      FooterCols,
  "footer-cta":       FooterCta,
};

// ── Public component ──────────────────────────────────────────────────────────

/**
 * Renders a schematic layout preview for a variant selector option.
 *
 * @param previewType  One of the registered PreviewType strings.
 *                     Unknown or empty values render a neutral fallback.
 *
 * @example
 * <div className="w-24 h-14">
 *   <VariantPreview previewType="grid-3" />
 * </div>
 */
export function VariantPreview({ previewType }: { previewType: string }) {
  const Render = PREVIEWS[previewType as PreviewType];
  if (!Render) return <Fallback />;
  return <Render />;
}
