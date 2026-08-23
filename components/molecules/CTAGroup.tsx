/**
 * CTAGroup
 *
 * Renders a horizontal (flex-wrap) row of call-to-action buttons from a
 * BlockCTA array. A molecule that wraps the Button atom and applies the
 * standard CTA layout pattern used across all content blocks.
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   ctas      BlockCTA[]   Array of CTA items. Empty array renders nothing.
 *   size      "sm"|"md"|"lg"  Button size. Defaults to "md".
 *   inverted  boolean      Use inverted/contrasting colours for dark / brand
 *                          section backgrounds. Primary CTA gets card-bg
 *                          background + primary-active text; secondary gets
 *                          ghost treatment with section-cta-body colour.
 *   align     "start"|"center"|"end"  Flex justify alignment. Defaults to "start".
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   Standard (inverted = false):
 *     Delegated entirely to Button atom.
 *
 *   Inverted (inverted = true):
 *     --cta-button-bg     Primary CTA background   (falls back to --card-bg)
 *     --cta-button-text   Primary CTA text colour  (falls back to --primary-active)
 *     --section-cta-body  Secondary CTA text colour
 *     --radius-interactive Primary CTA border-radius (overrides atom default)
 */

import { Button }      from "@/components/ui/Button";
import { TrackedCTAButton } from "@/components/tracking/TrackedCTAButton";
import type { BlockCTA } from "@/page-config";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CTAGroupProps {
  ctas:       readonly BlockCTA[];
  size?:      "sm" | "md" | "lg";
  inverted?:  boolean;
  align?:     "start" | "center" | "end";
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CTAGroup({
  ctas,
  size      = "md",
  inverted  = false,
  align     = "start",
  className,
}: CTAGroupProps) {
  if (!ctas || ctas.length === 0) return null;

  const alignClass =
    align === "center" ? "justify-center" :
    align === "end"    ? "justify-end"    :
    "";

  return (
    <div className={`flex flex-wrap gap-3 ${alignClass} ${className ?? ""}`}>
      {ctas.map((cta, index) => {
        const isPrimary = index === 0;
        // Per-button style wins over variant / position default. Absent -> unchanged.
        const styleVariant = cta.style
          ? ({ solid: "primary", outline: "outline", ghost: "ghost" } as const)[cta.style]
          : undefined;

        // Inverted: first button is solid inverted (white bg on brand section),
        // subsequent buttons are ghost with muted text.
        if (inverted) {
          const invVariant = styleVariant ?? (isPrimary ? "primary" : "ghost");
          // The solid inverted treatment (white bg) only applies to a solid/primary
          // button; outline/ghost buttons keep their own variant appearance.
          const invertedStyle = invVariant === "primary"
            ? {
                // Default inverted treatment (white card-bg + brand text) suits a
                // dark section. --cta-button-bg / --cta-button-text let a light
                // gradient section swap in a solid brand button that still reads.
                backgroundColor: "var(--cta-button-bg, var(--card-bg))",
                color:           "var(--cta-button-text, var(--primary-active))",
                borderRadius:    "var(--radius-interactive)",
              }
            : {
                color: "var(--section-cta-body)",
              };
          // A ctaKey opts this button into click attribution (adaptive CTA slot).
          if (cta.ctaKey) {
            return (
              <TrackedCTAButton
                key={index}
                href={cta.href}
                label={cta.label}
                ctaKey={cta.ctaKey}
                position="cta_block"
                size={size}
                variant={invVariant}
                style={invertedStyle}
              />
            );
          }
          return (
            <Button key={index} as="a" href={cta.href} size={size} variant={invVariant} style={invertedStyle}>
              {cta.label}
            </Button>
          );
        }

        // Standard: resolve variant from cta data, falling back to
        // primary for index 0, outline for subsequent CTAs.
        const stdVariant = styleVariant ?? cta.variant ?? (isPrimary ? "primary" : "outline");
        if (cta.ctaKey) {
          // TrackedCTAButton has no "link" variant; fall back to ghost for it.
          const trackedVariant = stdVariant === "link" ? "ghost" : stdVariant;
          return (
            <TrackedCTAButton
              key={index}
              href={cta.href}
              label={cta.label}
              ctaKey={cta.ctaKey}
              position="cta_block"
              size={size}
              variant={trackedVariant}
            />
          );
        }
        return (
          <Button key={index} as="a" href={cta.href} size={size} variant={stdVariant}>
            {cta.label}
          </Button>
        );
      })}
    </div>
  );
}
