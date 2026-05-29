/**
 * Theme Preset Comparison
 *
 * Shows the same section content rendered under all presets that belong to
 * a given family.  Use this story to verify that:
 *
 *   1. Presets within the same family share structural character (spacing,
 *      card style, density) but differ in colour and typography.
 *   2. The toolbar Preset dropdown correctly overrides the active theme.
 *
 * The "Corporate Professional" family is used as the default comparison group
 * because it has the most structurally varied presets (4).
 */

import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { FeatureGridBlock }        from "@/components/blocks/sections/FeatureGridBlock";
import { TestimonialSectionBlock } from "@/components/blocks/sections/TestimonialSectionBlock";

import {
  THEME_FAMILIES,
  type ThemeFamilyKey,
} from "@/design-system/theme/theme-family";
import { resolveTheme, type ThemePresetKey } from "@/design-system/theme/presets";
import { tenantThemeToCSS }                  from "@/design-system/theme/tenant-theme";

// ── Fixture data ──────────────────────────────────────────────────────────────

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

// ── Preset panel component ────────────────────────────────────────────────────

interface PresetPanelProps {
  presetKey: ThemePresetKey;
  isCanonical: boolean;
}

function PresetPanel({ presetKey, isCanonical }: PresetPanelProps) {
  const cssVars = tenantThemeToCSS(resolveTheme(presetKey));
  const scopeId = `mc-preset-${presetKey}`;

  return (
    <div
      id={scopeId}
      data-theme-preset={presetKey}
      style={{
        border:       isCanonical ? "2px solid var(--primary, #6366f1)" : "1px solid #e2e8f0",
        borderRadius: "8px",
        overflow:     "hidden",
        background:   "white",
      }}
    >
      <style
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: `#${scopeId} { ${cssVars} }`,
        }}
      />

      {/* Preset header */}
      <div
        style={{
          padding:        "10px 16px",
          background:     isCanonical ? "var(--primary, #6366f1)" : "#f1f5f9",
          color:          isCanonical ? "#fff" : "#334155",
          display:        "flex",
          alignItems:     "center",
          gap:            "8px",
          fontSize:       "13px",
          fontFamily:     "system-ui, sans-serif",
        }}
      >
        <span style={{ fontWeight: 600, fontFamily: "monospace" }}>{presetKey}</span>
        {isCanonical && (
          <span
            style={{
              fontSize:     "10px",
              background:   "rgba(255,255,255,0.25)",
              padding:      "1px 6px",
              borderRadius: "999px",
            }}
          >
            canonical
          </span>
        )}
      </div>

      <FeatureGridBlock
        data={{ heading: "Why teams choose us", features }}
        variant="feature_grid_3up"
      />
      <TestimonialSectionBlock
        data={{ heading: "What customers say", testimonials }}
        variant="testimonial_grid"
      />
    </div>
  );
}

// ── Family preset comparison ──────────────────────────────────────────────────

interface FamilyPresetComparisonProps {
  familyKey: ThemeFamilyKey;
}

function FamilyPresetComparison({ familyKey }: FamilyPresetComparisonProps) {
  const family   = THEME_FAMILIES[familyKey];
  const presets  = family.presets as readonly ThemePresetKey[];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "40px", padding: "24px" }}>
      <div>
        <h1
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: "20px",
            fontWeight: 700,
            marginBottom: "4px",
          }}
        >
          {family.name} — Preset Comparison
        </h1>
        <p
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: "13px",
            color: "#64748b",
            margin: 0,
          }}
        >
          {family.tagline} · {presets.length} preset{presets.length !== 1 ? "s" : ""}.
          All share the same structural personality; colour and typography vary.
        </p>
      </div>

      {presets.map((presetKey) => (
        <PresetPanel
          key={presetKey}
          presetKey={presetKey}
          isCanonical={presetKey === family.canonicalPreset}
        />
      ))}
    </div>
  );
}

// ── Story metadata ─────────────────────────────────────────────────────────────

const meta: Meta = {
  title:  "Theme / Preset Comparison",
  tags:   ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Renders the same FeatureGrid + Testimonials stack under every preset that " +
          "belongs to a given theme family.  The canonical preset is highlighted with " +
          "a primary-coloured border.  Use this to confirm that structural character " +
          "(card style, spacing, heading font) is consistent within a family while " +
          "colour and typography differ between presets.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

// ── One story per family ───────────────────────────────────────────────────────

export const Corporate: Story = {
  name:    "Corporate Professional — 4 presets",
  globals: { themeFamily: "corporate-professional", themePreset: "" },
  render:  () => <FamilyPresetComparison familyKey="corporate-professional" />,
};

export const Editorial: Story = {
  name:    "Editorial Publishing — 3 presets",
  globals: { themeFamily: "editorial-publishing", themePreset: "" },
  render:  () => <FamilyPresetComparison familyKey="editorial-publishing" />,
};

export const Startup: Story = {
  name:    "Startup Growth — 7 presets",
  globals: { themeFamily: "startup-growth", themePreset: "" },
  render:  () => <FamilyPresetComparison familyKey="startup-growth" />,
};

export const SaaS: Story = {
  name:    "SaaS Product — 2 presets",
  globals: { themeFamily: "saas-product", themePreset: "" },
  render:  () => <FamilyPresetComparison familyKey="saas-product" />,
};

export const Luxury: Story = {
  name:    "Luxury Dark — 2 presets",
  globals: { themeFamily: "luxury-dark", themePreset: "" },
  parameters: { backgrounds: { default: "Dark" } },
  render:  () => <FamilyPresetComparison familyKey="luxury-dark" />,
};

export const DarkAI: Story = {
  name:    "Dark AI — 3 presets",
  globals: { themeFamily: "dark-ai", themePreset: "" },
  parameters: { backgrounds: { default: "Dark" } },
  render:  () => <FamilyPresetComparison familyKey="dark-ai" />,
};

export const CleanCorporate: Story = {
  name:    "Clean Corporate — 3 presets",
  globals: { themeFamily: "clean-corporate", themePreset: "" },
  render:  () => <FamilyPresetComparison familyKey="clean-corporate" />,
};
