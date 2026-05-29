/**
 * Theme Family Comparison
 *
 * Shows the same section content rendered under five structurally distinct
 * theme families.  Use this story to verify that family changes produce
 * clearly different layouts, spacing, heading treatments, card styles, and
 * logo filters — NOT just colour swaps.
 *
 * Each "panel" injects its own :root overrides via an inline <style> block
 * so all five families are visible simultaneously without Storybook toolbar
 * interaction.
 */

import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { FeatureGridBlock }        from "@/components/blocks/sections/FeatureGridBlock";
import { TestimonialSectionBlock } from "@/components/blocks/sections/TestimonialSectionBlock";
import { LogoStripBlock }          from "@/components/blocks/sections/LogoStripBlock";
import { CtaSectionBlock }         from "@/components/blocks/sections/CtaSectionBlock";

import {
  THEME_FAMILIES,
  type ThemeFamilyKey,
} from "@/design-system/theme/theme-family";
import { resolveTheme }    from "@/design-system/theme/presets";
import { tenantThemeToCSS } from "@/design-system/theme/tenant-theme";

// ── Fixture data — shared across all panels ───────────────────────────────────

const features = [
  {
    icon:        "⚡",
    title:       "Instant performance",
    description: "Pages load in under 200 ms globally — no cold starts, no cache misses.",
  },
  {
    icon:        "🔒",
    title:       "Enterprise security",
    description: "SOC 2 Type II certified. End-to-end encryption at rest and in transit.",
  },
  {
    icon:        "🔌",
    title:       "Open integrations",
    description: "Connect any tool via our API and 50+ native integrations out of the box.",
  },
] as const;

const testimonials = [
  {
    quote:   "Reduced our time-to-publish by 60%. Our editors love the flexibility.",
    author:  "Sophie van der Berg",
    company: "Head of Digital — Nexus Media",
    avatar:  "https://i.pravatar.cc/150?img=47",
  },
  {
    quote:   "The only platform that handled our multi-brand setup without custom dev.",
    author:  "Mark Leuven",
    company: "CTO — BrandStack",
    avatar:  "https://i.pravatar.cc/150?img=12",
  },
  {
    quote:   "Design tokens made brand consistency trivial across 12 tenant sites.",
    author:  "Priya Nair",
    company: "Lead Designer — Vantage Group",
    avatar:  "https://i.pravatar.cc/150?img=29",
  },
] as const;

const logos = [
  { name: "Acme",    src: "https://placehold.co/160x48/e2e8f0/94a3b8?text=Acme"    },
  { name: "Globex",  src: "https://placehold.co/160x48/e2e8f0/94a3b8?text=Globex"  },
  { name: "Initech", src: "https://placehold.co/160x48/e2e8f0/94a3b8?text=Initech" },
  { name: "Umbrella",src: "https://placehold.co/160x48/e2e8f0/94a3b8?text=Umbrella"},
  { name: "Stark",   src: "https://placehold.co/160x48/e2e8f0/94a3b8?text=Stark"   },
  { name: "Wayne",   src: "https://placehold.co/160x48/e2e8f0/94a3b8?text=Wayne"   },
] as const;

// ── Families to compare (5 most structurally distinct) ───────────────────────

const COMPARE_FAMILIES: ThemeFamilyKey[] = [
  "editorial-publishing",
  "corporate-professional",
  "startup-growth",
  "luxury-dark",
  "wellness-care",
];

// ── Helper: build a scoped CSS string for a family's canonical preset ─────────

function familyCSS(familyKey: ThemeFamilyKey): string {
  const presetKey = THEME_FAMILIES[familyKey].canonicalPreset;
  return tenantThemeToCSS(resolveTheme(presetKey));
}

// ── Panel component — self-contained themed island ────────────────────────────

interface ThemePanelProps {
  familyKey: ThemeFamilyKey;
}

function ThemePanel({ familyKey }: ThemePanelProps) {
  const family    = THEME_FAMILIES[familyKey];
  const scopeId   = `mc-family-${familyKey}`;
  const cssVars   = familyCSS(familyKey);

  return (
    <div
      id={scopeId}
      data-theme-family={familyKey}
      data-theme-preset={family.canonicalPreset}
      style={{
        border:       "1px solid #e2e8f0",
        borderRadius: "8px",
        overflow:     "hidden",
        background:   "white",
      }}
    >
      {/* Per-panel :root override — scoped via CSS custom-property cascade */}
      <style
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: `#${scopeId}, #${scopeId} * { all: revert-layer; }\n#${scopeId} { ${cssVars} }`,
        }}
      />

      {/* Family label header */}
      <div
        style={{
          padding:         "12px 20px",
          background:      "var(--primary, #6366f1)",
          color:           "#fff",
          display:         "flex",
          justifyContent:  "space-between",
          alignItems:      "baseline",
          gap:             "12px",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: "14px" }}>{family.name}</span>
        <span style={{ fontSize: "11px", opacity: 0.8, fontFamily: "monospace" }}>
          {family.canonicalPreset}
        </span>
      </div>

      {/* Block stack */}
      <LogoStripBlock
        data={{ heading: "Trusted by", logos }}
        variant="muted"
      />
      <FeatureGridBlock
        data={{ heading: "Why teams choose us", features }}
        variant="feature_grid_3up"
      />
      <TestimonialSectionBlock
        data={{ heading: "What customers say", testimonials }}
        variant="testimonial_grid"
      />
      <CtaSectionBlock
        data={{
          title:       "Ready to get started?",
          description: "Join thousands of teams already building with us.",
          primaryCta:  { label: "Start free trial", href: "#" },
          secondaryCta:{ label: "Book a demo",      href: "#" },
          background:  "brand",
        }}
        variant="default"
      />
    </div>
  );
}

// ── Stacked comparison layout ─────────────────────────────────────────────────
//
// Note: each panel uses its OWN CSS variable scope via its panel-level <style>
// injection.  All panels are visually independent — no global :root override
// from the toolbar affects individual panels (toolbar still works for the
// top-level view, showing one family at a time).

function FamilyComparisonView() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "48px", padding: "24px" }}>
      <div>
        <h1 style={{ fontFamily: "system-ui, sans-serif", fontSize: "20px", fontWeight: 700, marginBottom: "4px" }}>
          Theme Family Comparison
        </h1>
        <p style={{ fontFamily: "system-ui, sans-serif", fontSize: "13px", color: "#64748b", margin: 0 }}>
          Same content — five structurally distinct families. Differences in heading treatment,
          card style, logo filter, density, and motion should be clearly visible.
        </p>
      </div>

      {COMPARE_FAMILIES.map((familyKey) => (
        <ThemePanel key={familyKey} familyKey={familyKey} />
      ))}
    </div>
  );
}

// ── Story metadata ─────────────────────────────────────────────────────────────

const meta: Meta = {
  title:  "Theme / Family Comparison",
  tags:   ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Renders the same section stack (LogoStrip → FeatureGrid → Testimonials → CTA) " +
          "under five structurally distinct theme families simultaneously. " +
          "Each panel uses its own scoped CSS injection so all five are visible at once. " +
          "Use the **Family** and **Preset** toolbar dropdowns to preview any single family " +
          "across the entire Storybook canvas.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const AllFamilies: Story = {
  name:   "All families — side by side",
  render: () => <FamilyComparisonView />,
};

// ── Individual family stories ─────────────────────────────────────────────────
//
// Each story pre-sets the global themeFamily so the toolbar shows the correct
// active family and all other stories in the session inherit it.

export const EditorialPublishing: Story = {
  name:       "Editorial Publishing",
  globals:    { themeFamily: "editorial-publishing", themePreset: "" },
  render:     () => (
    <div>
      <FeatureGridBlock
        data={{ heading: "Why teams choose us", features }}
        variant="feature_grid_3up"
      />
      <TestimonialSectionBlock
        data={{ heading: "What customers say", testimonials }}
        variant="testimonial_grid"
      />
      <LogoStripBlock data={{ heading: "Trusted by", logos }} variant="muted" />
    </div>
  ),
};

export const CorporateProfessional: Story = {
  name:       "Corporate Professional",
  globals:    { themeFamily: "corporate-professional", themePreset: "" },
  render:     () => (
    <div>
      <FeatureGridBlock
        data={{ heading: "Why teams choose us", features }}
        variant="feature_grid_3up"
      />
      <TestimonialSectionBlock
        data={{ heading: "What customers say", testimonials }}
        variant="testimonial_grid"
      />
      <LogoStripBlock data={{ heading: "Trusted by", logos }} variant="muted" />
    </div>
  ),
};

export const StartupGrowth: Story = {
  name:       "Startup Growth",
  globals:    { themeFamily: "startup-growth", themePreset: "" },
  render:     () => (
    <div>
      <FeatureGridBlock
        data={{ heading: "Why teams choose us", features }}
        variant="feature_grid_3up"
      />
      <TestimonialSectionBlock
        data={{ heading: "What customers say", testimonials }}
        variant="testimonial_grid"
      />
      <LogoStripBlock data={{ heading: "Trusted by", logos }} variant="default" />
    </div>
  ),
};

export const LuxuryDark: Story = {
  name:       "Luxury Dark",
  globals:    { themeFamily: "luxury-dark", themePreset: "" },
  parameters: { backgrounds: { default: "Dark" } },
  render:     () => (
    <div>
      <FeatureGridBlock
        data={{ heading: "Why teams choose us", features }}
        variant="feature_grid_3up"
      />
      <TestimonialSectionBlock
        data={{ heading: "What customers say", testimonials }}
        variant="testimonial_grid"
      />
      <LogoStripBlock data={{ heading: "Trusted by", logos }} variant="muted" />
    </div>
  ),
};

export const WellnessCare: Story = {
  name:       "Wellness & Care",
  globals:    { themeFamily: "wellness-care", themePreset: "" },
  render:     () => (
    <div>
      <FeatureGridBlock
        data={{ heading: "Why teams choose us", features }}
        variant="feature_grid_3up"
      />
      <TestimonialSectionBlock
        data={{ heading: "What customers say", testimonials }}
        variant="testimonial_grid"
      />
      <LogoStripBlock data={{ heading: "Trusted by", logos }} variant="muted" />
    </div>
  ),
};
