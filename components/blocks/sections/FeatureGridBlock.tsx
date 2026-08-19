/**
 * FeatureGridBlock
 *
 * Renders a `featureGrid` page section — an optional heading followed by a
 * responsive grid of feature items. Supports four visual layouts via the
 * `variant` prop.
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      FeatureGridBlockData  { heading?, features[] }
 *   variant   FeatureGridVariant    see below
 *
 * ─── Variants ────────────────────────────────────────────────────────────────
 *
 *   default    — 3-col bordered card grid on a subtle-bg section
 *   cards      — elevated card grid on white; no section border
 *   compact    — 2-col dense grid; tighter padding for long feature lists
 *   icons-left — horizontal icon + text rows; scans like a checklist
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --feature-grid-bg           Section background (default / compact variants)
 *   --feature-grid-border       Section border colour (default / compact variants)
 *   --feature-grid-card-bg      Card background
 *   --feature-grid-card-border  Card border colour
 *   --feature-grid-card-radius  Card border-radius
 *   --feature-grid-card-shadow  Card box-shadow (cards variant only)
 *   --feature-grid-icon-bg      Icon container background (default / icons-left)
 *   --font-subheading-weight    Feature title font weight
 */

import type React from "react";
import { Container } from "@/components/primitives/Container";
import { InlineRichText } from "@/components/blocks/InlineRichText";
import { Section } from "@/components/primitives/Section";
import { Grid } from "@/components/primitives/Grid";
import { Stack } from "@/components/primitives/Stack";
import { Text } from "@/components/primitives/Text";
import { Button } from "@/components/ui/Button";
import { resolveBlockVariant } from "@/page-config/block-variants";
import type { FeatureGridVariant } from "@/page-config/block-variants";
import type { FeatureGridBlockData, BlockCTA } from "@/page-config";
import { resolveSurface, type BlockSurface } from "@/lib/surface";
import { isRenderableMedia } from "@/lib/media/block-media";
import { FeatureSpotlightCard } from "./feature/FeatureSpotlightCard";
import { FeatureSpotlightSlider } from "./feature/FeatureSpotlightSlider";

// ── Feature icon system ────────────────────────────────────────────────────────
//
// Maps CMS icon name strings (e.g. "cpu", "shield") to inline React SVG elements.
// All icons are stroke-based, 24×24 viewBox, Lucide-compatible.
// Falls back to a generic dot when the name is not found in the registry.

const ICON_MAP: Record<string, React.ReactNode> = {
  "activity":    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
  "alert":       <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
  "archive":     <><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></>,
  "award":       <><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></>,
  "bar-chart":   <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
  "bolt":        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>,
  "box":         <><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></>,
  "briefcase":   <><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></>,
  "building":    <><rect x="1" y="3" width="15" height="18"/><path d="M16 8h4l3 3v7h-7V8z"/><line x1="5" y1="7" x2="5" y2="7"/><line x1="9" y1="7" x2="9" y2="7"/><line x1="5" y1="11" x2="5" y2="11"/><line x1="9" y1="11" x2="9" y2="11"/><line x1="5" y1="15" x2="5" y2="15"/><line x1="9" y1="15" x2="9" y2="15"/></>,
  "chart":       <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
  "check":       <polyline points="20 6 9 17 4 12"/>,
  "check-circle": <><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>,
  "clock":       <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
  "cloud":       <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/>,
  "code":        <><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></>,
  "cpu":         <><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></>,
  "calendar":    <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
  "database":    <><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></>,
  "dollar-sign": <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></>,
  "edit-2":      <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>,
  "edit-3":      <><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></>,
  "eye":         <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
  "filter":      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>,
  "flag":        <><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></>,
  "globe":       <><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z"/></>,
  "grid":        <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>,
  "heart":        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>,
  "home":         <><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
  "layers":      <><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>,
  "life-buoy":   <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="4.93" y1="4.93" x2="9.17" y2="9.17"/><line x1="14.83" y1="14.83" x2="19.07" y2="19.07"/><line x1="14.83" y1="9.17" x2="19.07" y2="4.93"/><line x1="14.83" y1="9.17" x2="18.36" y2="5.64"/><line x1="4.93" y1="19.07" x2="9.17" y2="14.83"/></>,
  "layout":      <><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></>,
  "lightning":   <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>,
  "linkedin":    <><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></>,
  "lock":        <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></>,
  "mail":        <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></>,
  "map":         <><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></>,
  "map-pin":     <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></>,
  "maximize":    <><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></>,
  "message-circle": <><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></>,
  "monitor":     <><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></>,
  "mouse-pointer": <><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></>,
  "percent":     <><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></>,
  "pie-chart":   <><path d="M21.21 15.89A10 10 0 118 2.83"/><path d="M22 12A10 10 0 0012 2v10z"/></>,
  "repeat":      <><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></>,
  "search":      <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
  "server":      <><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></>,
  "shield":      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
  "sliders":     <><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></>,
  "sparkles":    <><path d="M12 3l1.45 3.38L17 7.5l-2.55 2.48.6 3.52L12 11.77l-3.05 1.73.6-3.52L7 7.5l3.55-.12L12 3z"/><path d="M5 15l.73 1.7L8 17.5l-1.27 1.24.3 1.76L5 19.5l-2.03.99.3-1.76L2 17.5l2.27-.06L5 15z"/></>,
  "star":        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>,
  "tag":         <><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></>,
  "target":      <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>,
  "trending-up": <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>,
  "users":       <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></>,
  "zap":         <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>,
};

/**
 * Renders a named SVG icon from the built-in registry.
 * Falls back to a generic circle dot for unknown icon names.
 *
 * @param name  Icon name string as stored in CMS (e.g. "cpu", "shield", "trending-up")
 * @param size  Pixel size (width = height). Defaults to 20.
 */
function FeatureIcon({ name, size = 20 }: { name: string; size?: number }) {
  const content = ICON_MAP[name.toLowerCase()] ?? <circle cx="12" cy="12" r="4" />;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {content}
    </svg>
  );
}

// ── CTA helper ────────────────────────────────────────────────────────────────
//
// Renders a single centred CTA button below the grid.
// The "link" variant falls through to a styled anchor without the Button shell.

function FeatureGridCTA({ cta }: { cta: BlockCTA }) {
  if (cta.variant === "link") {
    return (
      <div className="flex justify-center pt-2">
        <a
          href={cta.href}
          className="text-sm font-medium underline underline-offset-4 transition-opacity hover:opacity-70"
          style={{ color: "var(--text-brand)" }}
        >
          {cta.label}
        </a>
      </div>
    );
  }

  return (
    <div className="flex justify-center pt-2">
      <Button
        as="a"
        href={cta.href}
        variant={cta.variant ?? "primary"}
        size="lg"
      >
        {cta.label}
      </Button>
    </div>
  );
}

interface FeatureGridBlockProps {
  data:     FeatureGridBlockData;
  variant?: string;
  surface?: BlockSurface;
}

// ── Profile-driven section divider style ──────────────────────────────────────
//
// Replaces the hardcoded Tailwind border-y class so divider presence is
// controlled by --block-divider-width (0px = no divider, 1px = visible hairline).
// borderStyle must be set explicitly when using borderWidth without a class.

// Profile-driven heading style — applies tracking, transform, and the
// semantic heading font/weight derived from headingTreatment.
// Used across ALL variants so heading character is consistent.
const HEADING_STYLE: React.CSSProperties = {
  letterSpacing: "var(--block-heading-tracking)",
  textTransform: "var(--block-heading-transform)" as React.CSSProperties["textTransform"],
  fontFamily:    "var(--block-heading-font-family)",
  fontWeight:    "var(--block-heading-font-weight)",
};

const DIVIDER_SECTION_STYLE = {
  borderTopWidth:    "var(--block-divider-width)",
  borderBottomWidth: "var(--block-divider-width)",
  borderTopColor:    "var(--block-divider-color)",
  borderBottomColor: "var(--block-divider-color)",
  borderTopStyle:    "solid" as const,
  borderBottomStyle: "solid" as const,
};

export function FeatureGridBlock({ data, variant: rawVariant, surface }: FeatureGridBlockProps) {
  const resolved = resolveBlockVariant("featureGrid", rawVariant) as FeatureGridVariant;
  const { heading, features, cta } = data;
  const items = features ?? [];

  // Normalise canonical spec names → implementation keys.
  // feature_grid_3up        → default (3-col bordered card grid)
  // feature_grid_4up        → feature_grid_4up (new — 4-col grid)
  // feature_grid_cards      → cards (elevated shadow cards)
  // feature_grid_checklist  → icons-left (horizontal icon+text rows)
  // feature_grid_dark       → feature_grid_dark (explicit dark surface branch)
  // feature_grid_spacious   → feature_grid_spacious (clean-corporate wide-padding branch)
  const variant: FeatureGridVariant = (
    resolved === "feature_grid_3up"       ? "default"              :
    resolved === "feature_grid_cards"     ? "cards"                :
    resolved === "feature_grid_checklist" ? "icons-left"           :
    resolved === "feature_grid_dark"      ? "feature_grid_dark"    :
    resolved === "feature_grid_spacious"  ? "feature_grid_spacious":
    resolved
  ) as FeatureGridVariant;

  // ── feature_spotlight variant ───────────────────────────────────────────────
  //
  // One highlighted offer: media alongside title + copy + optional price + CTA.
  // Slider when there are several. Uses the shared media core. `description`
  // doubles as the copy; price and CTA are independent (any combination is tidy).

  if (resolved === "feature_spotlight") {
    const offers = items.filter((it) => (it.title && it.title.trim() !== "") || isRenderableMedia(it.media));
    return (
      <Section spacing="lg" style={{ background: resolveSurface(surface) ?? "var(--feature-grid-bg)", ...DIVIDER_SECTION_STYLE }}>
        <Container size="lg">
          <Stack gap={12} style={{ gap: "var(--block-content-gap)" }}>
            {heading && (
              <Text variant="h2" align="center" style={HEADING_STYLE}>
                {heading}
              </Text>
            )}

            {offers.length === 1 && <FeatureSpotlightCard item={offers[0]} />}
            {offers.length > 1 && <FeatureSpotlightSlider items={[...offers]} />}

            {cta && <FeatureGridCTA cta={cta} />}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── feature_grid_4up variant ────────────────────────────────────────────────
  //
  // 4-column card grid; good for larger feature sets (8–12 items).
  // Same card styling as "default" but in four columns on large viewports.

  if (variant === "feature_grid_4up") {
    return (
      <Section
        spacing="lg"
        style={{
          background: resolveSurface(surface) ?? "var(--feature-grid-bg)",
          ...DIVIDER_SECTION_STYLE,
        }}
      >
        <Container size="lg">
          <Stack gap={12} style={{ gap: "var(--block-content-gap)" }}>
            {heading && (
              <Text
                variant="h2"
                align="center"
                style={HEADING_STYLE}
              >
                {heading}
              </Text>
            )}

            {items.length > 0 && (
              <Grid cols={4} gap="md">
                {items.map((feature) => (
                  <Stack
                    key={feature.title}
                    gap={3}
                    style={{
                      padding:    "var(--block-card-padding)",
                      background: "var(--block-feature-card-bg)",
                      border:     "var(--block-feature-card-border)",
                      borderRadius: "var(--card-radius)",
                      boxShadow:  "var(--block-feature-card-shadow)",
                    }}
                  >
                    {feature.icon && (
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-lg"
                        style={{ backgroundColor: "var(--feature-grid-icon-bg)" }}
                      >
                        <FeatureIcon name={feature.icon} size={20} />
                      </span>
                    )}
                    <Text
                      variant="h4"
                      style={{ fontWeight: "var(--font-subheading-weight)" }}
                    >
                      {feature.title}
                    </Text>
                    <Text variant="body-sm" color="muted">
                      <InlineRichText source={feature.description} />
                    </Text>
                  </Stack>
                ))}
              </Grid>
            )}

            {cta && <FeatureGridCTA cta={cta} />}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── icons-left variant ──────────────────────────────────────────────────────
  //
  // Horizontal rows: icon on the left, title + description on the right.
  // No card backgrounds — a clean checklist-style layout.

  if (variant === "icons-left") {
    return (
      <Section spacing="lg" style={{ background: resolveSurface(surface) ?? "var(--bg)" }}>
        <Container size="lg">
          <Stack gap={12}>
            {heading && (
              <Text
                variant="h2"
                align="center"
                style={HEADING_STYLE}
              >
                {heading}
              </Text>
            )}

            {items.length > 0 && (
              <Stack gap={4}>
                {items.map((feature) => (
                  <div
                    key={feature.title}
                    className="flex items-start gap-4 py-3"
                  >
                    <span
                      className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: "var(--feature-grid-icon-bg)",
                        borderRadius: "var(--feature-grid-card-radius)",
                      }}
                    >
                      <FeatureIcon name={feature.icon ?? ""} size={18} />
                    </span>

                    <Stack gap={1} className="min-w-0">
                      <Text
                        variant="h4"
                        style={{ fontWeight: "var(--font-subheading-weight)" }}
                      >
                        {feature.title}
                      </Text>
                      <Text variant="body-sm" color="muted">
                        <InlineRichText source={feature.description} />
                      </Text>
                    </Stack>
                  </div>
                ))}
              </Stack>
            )}

            {cta && <FeatureGridCTA cta={cta} />}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── compact variant ─────────────────────────────────────────────────────────
  //
  // 2-col dense card grid; tighter padding. Efficient for long feature lists.

  if (variant === "compact") {
    return (
      <Section
        spacing="lg"
        style={{
          background: resolveSurface(surface) ?? "var(--section-subtle-bg)",
          ...DIVIDER_SECTION_STYLE,
        }}
      >
        <Container size="lg">
          <Stack gap={10} style={{ gap: "var(--block-content-gap)" }}>
            {heading && (
              <Text
                variant="h2"
                align="center"
                style={HEADING_STYLE}
              >
                {heading}
              </Text>
            )}

            {items.length > 0 && (
              <Grid cols={2} gap="md">
                {items.map((feature) => (
                  <Stack
                    key={feature.title}
                    gap={2}
                    style={{
                      padding:      "var(--block-card-padding)",
                      background:   "var(--block-feature-card-bg)",
                      border:       "var(--block-feature-card-border)",
                      borderRadius: "var(--card-radius)",
                    }}
                  >
                    {feature.icon && (
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-lg"
                        style={{ backgroundColor: "var(--feature-grid-icon-bg)" }}
                      >
                        <FeatureIcon name={feature.icon} size={20} />
                      </span>
                    )}
                    <Text
                      variant="h4"
                      style={{ fontWeight: "var(--font-subheading-weight)" }}
                    >
                      {feature.title}
                    </Text>
                    <Text variant="body-sm" color="muted">
                      <InlineRichText source={feature.description} />
                    </Text>
                  </Stack>
                ))}
              </Grid>
            )}

            {cta && <FeatureGridCTA cta={cta} />}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── cards variant ───────────────────────────────────────────────────────────
  //
  // Elevated card grid on white; no section background or border.
  // Cards carry a box-shadow to lift them off the page.

  if (variant === "cards") {
    return (
      <Section spacing="lg" style={{ background: resolveSurface(surface) ?? "var(--bg)" }}>
        <Container size="lg">
          <Stack gap={12} style={{ gap: "var(--block-content-gap)" }}>
            {heading && (
              <Text
                variant="h2"
                align="center"
                style={HEADING_STYLE}
              >
                {heading}
              </Text>
            )}

            {items.length > 0 && (
              <Grid cols={3} gap="lg">
                {items.map((feature) => (
                  <Stack
                    key={feature.title}
                    gap={3}
                    style={{
                      padding:      "var(--block-card-padding)",
                      background:   "var(--block-feature-card-bg)",
                      border:       "var(--block-feature-card-border)",
                      borderRadius: "var(--card-radius)",
                      boxShadow:    "var(--block-feature-card-shadow)",
                    }}
                  >
                    {feature.icon && (
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-lg"
                        style={{ backgroundColor: "var(--feature-grid-icon-bg)" }}
                      >
                        <FeatureIcon name={feature.icon} size={20} />
                      </span>
                    )}
                    <Text
                      variant="h4"
                      style={{ fontWeight: "var(--font-subheading-weight)" }}
                    >
                      {feature.title}
                    </Text>
                    <Text variant="body-sm" color="muted">
                      <InlineRichText source={feature.description} />
                    </Text>
                  </Stack>
                ))}
              </Grid>
            )}

            {cta && <FeatureGridCTA cta={cta} />}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── feature_grid_dark variant ───────────────────────────────────────────────
  //
  // Designed for Dark AI and bold-dark family themes.
  // The section sits on the base dark surface (--feature-grid-bg = #06060c).
  // Cards use --feature-grid-card-bg (#13112a for Dark AI) so they lift off the
  // section with the correct dark hierarchy — NOT the block-style-profile
  // transparent override which targets --block-feature-card-bg.

  if (variant === "feature_grid_dark") {
    return (
      <Section
        spacing="lg"
        style={{
          background: resolveSurface(surface) ?? "var(--feature-grid-bg)",
          ...DIVIDER_SECTION_STYLE,
        }}
      >
        <Container size="lg">
          <Stack gap={12} style={{ gap: "var(--block-content-gap)" }}>
            {heading && (
              <Text variant="h2" align="center" style={HEADING_STYLE}>
                {heading}
              </Text>
            )}

            {items.length > 0 && (
              <Grid cols={3} gap="lg">
                {items.map((feature) => (
                  <Stack
                    key={feature.title}
                    gap={3}
                    style={{
                      padding:      "var(--block-card-padding)",
                      background:   "var(--feature-grid-card-bg)",
                      border:       "1px solid var(--border)",
                      borderRadius: "var(--card-radius)",
                    }}
                  >
                    {feature.icon && (
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-lg"
                        style={{ backgroundColor: "var(--feature-grid-icon-bg)" }}
                      >
                        <FeatureIcon name={feature.icon} size={20} />
                      </span>
                    )}
                    <Text
                      variant="h4"
                      style={{ fontWeight: "var(--font-subheading-weight)" }}
                    >
                      {feature.title}
                    </Text>
                    <Text variant="body-sm" color="muted">
                      <InlineRichText source={feature.description} />
                    </Text>
                  </Stack>
                ))}
              </Grid>
            )}

            {cta && <FeatureGridCTA cta={cta} />}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── feature_grid_spacious variant ───────────────────────────────────────────
  //
  // Designed for Clean Corporate and corporate-trust family themes.
  // Clean white section background (--bg), larger card padding and softer
  // shadow — conveys spaciousness and trustworthiness for B2B audiences.
  // Cards use --card-bg (white by default) with a light border and shadow.

  if (variant === "feature_grid_spacious") {
    return (
      <Section
        spacing="lg"
        style={{ background: resolveSurface(surface) ?? "var(--bg)" }}
      >
        <Container size="lg">
          <Stack gap={14} style={{ gap: "var(--block-content-gap)" }}>
            {heading && (
              <Text variant="h2" align="center" style={HEADING_STYLE}>
                {heading}
              </Text>
            )}

            {items.length > 0 && (
              <Grid cols={3} gap="lg">
                {items.map((feature) => (
                  <Stack
                    key={feature.title}
                    gap={4}
                    style={{
                      padding:      "2rem",
                      background:   "var(--card-bg, #ffffff)",
                      border:       "1px solid var(--border)",
                      borderRadius: "var(--card-radius)",
                      boxShadow:    "0 1px 4px rgba(15,23,42,0.06)",
                    }}
                  >
                    {feature.icon && (
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-lg"
                        style={{ backgroundColor: "var(--feature-grid-icon-bg)" }}
                      >
                        <FeatureIcon name={feature.icon} size={20} />
                      </span>
                    )}
                    <Text
                      variant="h4"
                      style={{ fontWeight: "var(--font-subheading-weight)" }}
                    >
                      {feature.title}
                    </Text>
                    <Text variant="body-sm" color="muted">
                      <InlineRichText source={feature.description} />
                    </Text>
                  </Stack>
                ))}
              </Grid>
            )}

            {cta && <FeatureGridCTA cta={cta} />}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── default variant ─────────────────────────────────────────────────────────
  //
  // 3-col bordered card grid on a subtle-bg section with top/bottom border.

  return (
    <Section
      spacing="lg"
      style={{
        background: resolveSurface(surface) ?? "var(--feature-grid-bg)",
        ...DIVIDER_SECTION_STYLE,
      }}
    >
      <Container size="lg">
        <Stack gap={12} style={{ gap: "var(--block-content-gap)" }}>
          {heading && (
            <Text variant="h2" align="center" style={HEADING_STYLE}>
              {heading}
            </Text>
          )}

          {items.length > 0 && (
            <Grid cols={3} gap="lg">
              {items.map((feature) => (
                <Stack
                  key={feature.title}
                  gap={3}
                  style={{
                    padding:      "var(--block-card-padding)",
                    background:   "var(--block-feature-card-bg)",
                    border:       "var(--block-feature-card-border)",
                    borderRadius: "var(--card-radius)",
                    boxShadow:    "var(--block-feature-card-shadow)",
                  }}
                >
                  {feature.icon && (
                    <span
                      className="text-2xl"
                      role="img"
                      aria-hidden="true"
                    >
                      {feature.icon}
                    </span>
                  )}
                  <Text
                    variant="h4"
                    style={{ fontWeight: "var(--font-subheading-weight)" }}
                  >
                    {feature.title}
                  </Text>
                  <Text variant="body-sm" color="muted">
                    <InlineRichText source={feature.description} />
                  </Text>
                </Stack>
              ))}
            </Grid>
          )}

          {cta && <FeatureGridCTA cta={cta} />}
        </Stack>
      </Container>
    </Section>
  );
}
