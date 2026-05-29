import React from "react";
import type { Preview, Decorator } from "@storybook/nextjs-vite";

import "../app/globals.css";

import {
  ContextSimulatorProvider,
} from "../storybook/context-simulator/ContextSimulatorProvider";
import { PREDEFINED_SCENARIOS } from "../storybook/context-simulator/scenarios";

import {
  THEME_FAMILIES,
  THEME_FAMILY_KEYS,
  type ThemeFamilyKey,
} from "@/design-system/theme/theme-family";
import {
  THEME_CATALOG,
  resolveTheme,
  isThemePresetKey,
  type ThemePresetKey,
} from "@/design-system/theme/presets";
import { tenantThemeToCSS } from "@/design-system/theme/tenant-theme";
import {
  FEATURED_FAMILY_CONFIGS,
  FEATURED_FAMILY_KEYS,
  type FeaturedFamilyKey,
} from "@/design-system/theme/theme-families.config";

// ── Family toolbar items ──────────────────────────────────────────────────────
//
// Two groups:
//   1. Featured families (★) — have full typography + font-scale configs.
//      Selecting one sets the preset to its canonical preset key (which is
//      identical to the family key), so all family typography vars are applied.
//   2. Structural families — the 7 personality groups; use their canonical
//      preset as the colour/layout reference.

const FAMILY_ITEMS = [
  { value: "", title: "— Family (none)" },
  // ── Featured families — typography-complete ──────────────────────────────────
  ...FEATURED_FAMILY_KEYS.map((k) => ({
    value: k,
    title: `★ ${FEATURED_FAMILY_CONFIGS[k].label}`,
  })),
  // ── Structural families — colour/layout reference ────────────────────────────
  ...THEME_FAMILY_KEYS.map((k) => ({
    value: k,
    title: THEME_FAMILIES[k].name,
  })),
];

// ── Preset toolbar items (grouped by family, alphabetical within group) ───────

const PRESET_ITEMS = [
  { value: "", title: "— Preset (default)" },
  ...THEME_CATALOG.map((e) => ({
    value: e.presetKey,
    title: e.label,
  })),
];

// ── Theme injection decorator ─────────────────────────────────────────────────
//
// Resolution order:
//   1. If a preset is explicitly selected → use it directly.
//   2. Else if a family is selected → use that family's canonicalPreset.
//   3. Else → no override; globals.css defaults apply.
//
// The resolved CSS is injected as a <style> block scoped to :root so all CSS
// custom properties (colours, radii, typography, block-style profile vars) are
// overridden for the current story without touching other Storybook UI.

const withTheme: Decorator = (Story, context) => {
  const familyVal = (context.globals.themeFamily ?? "") as ThemeFamilyKey | "";
  const presetVal = (context.globals.themePreset ?? "") as ThemePresetKey | "";

  // Resolve effective preset
  // Priority order:
  //   1. An explicit preset selection from the Preset dropdown.
  //   2. A featured family key (which is also a valid preset key) — this
  //      directly activates the canonical preset for that family, including
  //      all family typography vars baked into the preset object.
  //   3. A structural family key — resolved to its canonical preset.
  let effectivePreset: ThemePresetKey | null = null;
  if (presetVal && isThemePresetKey(presetVal)) {
    effectivePreset = presetVal;
  } else if (familyVal && isThemePresetKey(familyVal)) {
    // Featured family keys happen to be identical to their canonical preset key
    effectivePreset = familyVal as ThemePresetKey;
  } else if (familyVal && THEME_FAMILIES[familyVal as ThemeFamilyKey]) {
    effectivePreset = THEME_FAMILIES[familyVal as ThemeFamilyKey].canonicalPreset;
  }

  const themeCSS = effectivePreset
    ? tenantThemeToCSS(resolveTheme(effectivePreset))
    : null;

  // Derive a display label for the active family/preset badge.
  const featuredFamilyLabel = familyVal
    ? (FEATURED_FAMILY_CONFIGS[familyVal as FeaturedFamilyKey]?.label ?? null)
    : null;
  const structuralFamilyLabel = familyVal
    ? (THEME_FAMILIES[familyVal as ThemeFamilyKey]?.name ?? null)
    : null;
  const activeFamilyLabel =
    featuredFamilyLabel ?? structuralFamilyLabel
      ?? (effectivePreset
          ? (THEME_CATALOG.find((e) => e.presetKey === effectivePreset)?.label ?? effectivePreset)
          : null);

  return (
    <>
      {/* Inject resolved theme CSS vars as an override layer on :root */}
      {themeCSS && (
        <style
          id="mc-storybook-theme"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `:root {\n${themeCSS}\n}`,
          }}
        />
      )}

      {/* Wrapper carries data-theme-family so any family-specific CSS rules
          (e.g. in theme-family.css) can target [data-theme-family="..."] */}
      <div
        data-theme-family={familyVal || undefined}
        data-theme-preset={effectivePreset || undefined}
        style={{ minHeight: "inherit" }}
      >
        {/* Floating badge — only visible when a family/preset is active */}
        {activeFamilyLabel && (
          <div
            style={{
              position: "fixed",
              bottom: "12px",
              right: "12px",
              zIndex: 9999,
              background: "var(--primary, #6366f1)",
              color: "#fff",
              padding: "4px 10px",
              borderRadius: "9999px",
              fontSize: "11px",
              fontFamily: "monospace",
              letterSpacing: "0.02em",
              opacity: 0.85,
              pointerEvents: "none",
            }}
          >
            {familyVal ? `${activeFamilyLabel} · ${effectivePreset}` : effectivePreset}
          </div>
        )}

        <Story />
      </div>
    </>
  );
};

// ── Context Simulator decorator ───────────────────────────────────────────────
//
// Wraps every story with the ContextSimulatorProvider.  When a scenario is
// selected in the toolbar, the provider re-renders with the new scenarioKey
// so all components that call useContextSimulator() update immediately.

const withContextSimulator: Decorator = (Story, context) => {
  const scenarioKey = (context.globals.scenario ?? null) as string | null;
  return (
    <ContextSimulatorProvider scenarioKey={scenarioKey} showDebug={true}>
      <Story />
    </ContextSimulatorProvider>
  );
};

// ── Context Simulator toolbar items ──────────────────────────────────────────

const SCENARIO_ITEMS = [
  { value: "", title: "— No scenario (default)" },
  ...PREDEFINED_SCENARIOS.map((s) => ({
    value: s.key,
    title: s.label,
  })),
];

// ── Preview config ─────────────────────────────────────────────────────────────

const preview: Preview = {
  // ── Global type declarations for the Storybook toolbar ──────────────────────
  globalTypes: {
    themeFamily: {
      description: "Theme family — structural personality (hero character, card style, density)",
      toolbar: {
        title:        "Family",
        icon:         "paintbrush",
        items:        FAMILY_ITEMS,
        dynamicTitle: true,
      },
    },
    themePreset: {
      description: "Theme preset — exact visual token set (colours, radius, typography)",
      toolbar: {
        title:        "Preset",
        icon:         "photo",
        items:        PRESET_ITEMS,
        dynamicTitle: true,
      },
    },
    scenario: {
      description: "Context Simulator — behavioral visitor scenario for personalization previews",
      toolbar: {
        title:        "Scenario",
        icon:         "user",
        items:        SCENARIO_ITEMS,
        dynamicTitle: true,
      },
    },
  },

  // ── Default values for the globals ──────────────────────────────────────────
  initialGlobals: {
    themeFamily: "",
    themePreset: "",
    scenario:    "",
  },

  // ── Decorators — applied in order, outermost first ──────────────────────────
  // withContextSimulator wraps stories with the scenario provider.
  // withTheme injects CSS vars — applied last so theme changes are innermost.
  decorators: [withContextSimulator, withTheme],

  parameters: {
    layout: "padded",

    controls: {
      matchers: {
        color: /(background|color)$/i,
        date:  /Date$/i,
      },
    },

    a11y: {
      test: "todo",
    },

    docs: {
      autodocs: "tag",
    },

    backgrounds: {
      default: "White",
      values: [
        { name: "White",  value: "#ffffff" },
        { name: "Subtle", value: "#f8fafc" },
        { name: "Dark",   value: "#0f172a" },
      ],
    },
  },
};

export default preview;
