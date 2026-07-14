/**
 * DesignPageClient
 *
 * Client-side tab shell for the tenant design page.  Splits the design system
 * into focused tabs:
 *
 *   Presets    — curated themes (contextual-rule compatible)
 *   Builder    — compose a custom look with a live preview
 *   Layout     — header / footer structural variants
 *   Typography — font stacks, role mapping, and sizing controls
 *   Advanced   — full token editor (colors, radius, spacing, …) + JSON import
 *
 * Theme switching by rule now lives at Personalisatie → Thema-switching
 * (/theme-switching), not as a Design tab.
 *
 * The server component (page.tsx) fetches all required data and passes it down
 * here; this component only renders the panels.
 *
 * The tab strip lives in the shared TenantSubNav secondary row so it matches the
 * sub-nav on Content/Personalization/Audience exactly (same component, same
 * position, same size). Selection travels through the `?tab=` search param.
 *
 * ─── Typography override state ────────────────────────────────────────────────
 *
 *   `overrideEnabled` is held in local state (not derived from the server prop
 *   at render time) so that:
 *
 *   a) The DesignTokenEditor shows/hides IMMEDIATELY when the user toggles —
 *      no page reload required.
 *   b) The toggle is ALWAYS visible regardless of whether a theme family is
 *      selected, because the panel no longer returns null on missing family.
 */

"use client";

import { useState, useTransition } from "react";
import { useSearchParams }         from "next/navigation";
import { ThemeGallery }         from "./ThemeGallery";
import { PresetBuilder }        from "./PresetBuilder";
import { LayoutVariantEditor }  from "./LayoutVariantEditor";
import { BlockTokenSetsEditor } from "./BlockTokenSetsEditor";
import { SiteDesignTokensEditor } from "./SiteDesignTokensEditor";
import { DesignTokenEditor }    from "@/components/admin/DesignTokenEditor";
import { saveVisualTokensAction } from "@/app/admin/tenants/[tenantId]/actions";
import type { TenantDesignSettings, ThemeKey } from "@/tenant/types";
import {
  getFeaturedFamilyForPreset,
  getFamilyTypographyDefaults,
  isHeadingFontOverridden,
  isBodyFontOverridden,
  shortFontName,
} from "@/design-system/theme/style-defaults";
import { isFeaturedFamilyKey } from "@/design-system/theme/theme-families.config";
import type { FeaturedFamilyKey } from "@/design-system/theme/theme-families.config";

// ── Types ─────────────────────────────────────────────────────────────────────

type DesignTab = "presets" | "builder" | "layout" | "typography" | "blocks" | "advanced";

interface TabDef {
  id:          DesignTab;
  label:       string;
  description: string;
}

const TABS: readonly TabDef[] = [
  {
    id:          "presets",
    label:       "Presets",
    description: "Pick a curated design preset (contextual-rule compatible)",
  },
  {
    id:          "builder",
    label:       "Builder",
    description: "Compose a custom preset with a live preview",
  },
  {
    id:          "layout",
    label:       "Layout",
    description: "Header and footer structural variants",
  },
  {
    id:          "typography",
    label:       "Typography",
    description: "Fonts, sizes, and line height",
  },
  {
    id:          "blocks",
    label:       "Blocks",
    description: "Reusable per-block token sets for content and adaptive blocks",
  },
  {
    id:          "advanced",
    label:       "Advanced",
    description: "Full token editor — colors, spacing, radius, and more",
  },
] as const;

export interface DesignPageClientProps {
  tenantId:     string;
  activeTheme?: ThemeKey | null;
  design:       TenantDesignSettings;
}

// ── Active tab resolution ─────────────────────────────────────────────────────
//
// The tab strip itself is NOT rendered here — it lives in the shared
// TenantSubNav secondary row (components/admin/TenantSubNav.tsx), so the Design
// tabs sit in exactly the same position and at the same size as the sub-nav on
// Content, Personalization, Audience, etc. Those links point at
// /design?tab=<id>; this component only reads that param back.

const TAB_IDS: readonly string[] = TABS.map((t) => t.id);

function isDesignTab(value: string | null): value is DesignTab {
  return value !== null && TAB_IDS.includes(value);
}

// ── Tab panel wrapper ─────────────────────────────────────────────────────────

interface TabPanelProps {
  id:       DesignTab;
  active:   DesignTab;
  children: React.ReactNode;
}

function TabPanel({ id, active, children }: TabPanelProps) {
  // Plain section, not role="tabpanel": the strip that selects it is now a set
  // of navigation links in TenantSubNav, not an ARIA tablist, so a tabpanel
  // role here would reference a non-existent tab element.
  return (
    <div id={`tab-panel-${id}`} hidden={id !== active}>
      {children}
    </div>
  );
}

// ── Section heading used inside each tab ──────────────────────────────────────

function TabSectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <p style={{
        fontSize:   "0.6875rem",
        fontWeight: 600,
        color:      "#9ca3af",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        margin:     "0 0 0.25rem",
      }}>
        {title}
      </p>
      <p style={{ fontSize: "0.8125rem", color: "#6b7280", margin: 0 }}>
        {description}
      </p>
    </div>
  );
}

// ── FamilyTypographyPanel ─────────────────────────────────────────────────────
//
// Shown at the top of the Typography tab.  The toggle is ALWAYS rendered —
// it is not conditioned on whether a theme family is active.
//
// ── Override model ─────────────────────────────────────────────────────────────
//
//   OFF (default / overrideEnabled === false):
//     The active theme family's typography is used as-is.  tokenOverrides.typography
//     values are stored but NOT applied at runtime.  Fields below are locked.
//     Switching theme families always produces visually distinct typography.
//
//   ON (overrideEnabled === true):
//     tokenOverrides.typography values are merged on top of the family defaults
//     at the highest specificity layer.  Fields below are editable.
//     Override persists across theme switches until explicitly cleared.
//
// ── Actions ────────────────────────────────────────────────────────────────────
//
//   Toggle ON  → saves typographyOverrideEnabled: true   + updates local state
//   Toggle OFF → saves typographyOverrideEnabled: false  + updates local state
//   Reset      → clears ALL typography token overrides + sets flag to false

interface FamilyTypographyPanelProps {
  tenantId:        string;
  design:          TenantDesignSettings;
  /**
   * Current override state — controlled by DesignPageClient so the
   * DesignTokenEditor gate reacts immediately without a page reload.
   */
  overrideEnabled: boolean;
  /**
   * Callback to update parent state optimistically on toggle / reset.
   */
  onOverrideChange: (enabled: boolean) => void;
}

/** All typography token keys managed by VisualTokenFields — used in full reset. */
const ALL_TYPOGRAPHY_CLEAR = {
  fontSans:         "",
  fontMono:         "",
  fontSerif:        "",
  baseFontSize:     "",
  lineHeightBase:   "",
  fontHeading:      "",
  fontBody:         "",
  fontUI:           "",
  fontCode:         "",
} as const;

function FamilyTypographyPanel({
  tenantId,
  design,
  overrideEnabled,
  onOverrideChange,
}: FamilyTypographyPanelProps) {
  const [pending, startTransition] = useTransition();
  const [actionDone, setActionDone] = useState<"reset" | "toggled" | null>(null);

  // ── Derive active family (informational display only) ─────────────────────
  // Even when null the toggle is still rendered and functional.
  const activeFamilyKey: FeaturedFamilyKey | null = (() => {
    const stored = design.selectedStyleFamily;
    if (stored && isFeaturedFamilyKey(stored)) return stored as FeaturedFamilyKey;
    if (design.theme) return getFeaturedFamilyForPreset(String(design.theme));
    return null;
  })();

  const familyDefaults = activeFamilyKey ? getFamilyTypographyDefaults(activeFamilyKey) : null;
  const familyLabel    = activeFamilyKey
    ? activeFamilyKey.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")
    : null;

  // ── Override detection (for informational display when flag is ON) ────────
  const storedHeading = design.tokenOverrides?.typography?.fontHeading as string | undefined;
  const storedBody    = design.tokenOverrides?.typography?.fontBody    as string | undefined;
  const headingOverridden = overrideEnabled && activeFamilyKey
    ? isHeadingFontOverridden(storedHeading, activeFamilyKey)
    : false;
  const bodyOverridden    = overrideEnabled && activeFamilyKey
    ? isBodyFontOverridden(storedBody, activeFamilyKey)
    : false;

  // Are there any stored overrides (regardless of flag) — relevant for reset label.
  const hasStoredOverrides =
    Object.keys(design.tokenOverrides?.typography ?? {}).some(
      (k) => !k.endsWith("Source"),
    );

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleToggle() {
    const next = !overrideEnabled;
    setActionDone(null);
    // Optimistic update — parent gate flips immediately, server persists async
    onOverrideChange(next);
    startTransition(async () => {
      await saveVisualTokensAction(tenantId, {
        typographyOverrideEnabled: next,
      });
      setActionDone("toggled");
    });
  }

  function handleReset() {
    setActionDone(null);
    // Optimistic update — disable override immediately
    onOverrideChange(false);
    startTransition(async () => {
      await saveVisualTokensAction(tenantId, {
        ...ALL_TYPOGRAPHY_CLEAR,
        typographyOverrideEnabled: false,
      });
      setActionDone("reset");
    });
  }

  // ── Colour tokens ─────────────────────────────────────────────────────────
  const borderColor  = overrideEnabled ? "#fed7aa" : "#e5e7eb";
  const bgColor      = overrideEnabled ? "#fff7ed" : "#f9fafb";
  const badgeBg      = overrideEnabled ? "#fff7ed" : "#f3f4f6";
  const badgeBorder  = overrideEnabled ? "#fed7aa" : "#e5e7eb";
  const badgeColor   = overrideEnabled ? "#c2410c" : "#6b7280";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      marginBottom: "1.5rem",
      padding:      "0.875rem 1rem",
      borderRadius: "0.5rem",
      border:       `1px solid ${borderColor}`,
      background:   bgColor,
    }}>

      {/* ── Header row: toggle + family badge ─────────────────────────────── */}
      <div style={{
        display:     "flex",
        alignItems:  "center",
        gap:         "0.625rem",
        marginBottom: familyDefaults ? "0.75rem" : "0",
        flexWrap:    "wrap",
      }}>

        {/* ── Toggle — ALWAYS rendered, never gated ─────────────────────── */}
        <button
          type="button"
          role="switch"
          aria-checked={overrideEnabled}
          onClick={handleToggle}
          disabled={pending}
          title={overrideEnabled
            ? "Disable override — use family defaults"
            : "Enable override — customise font stacks"}
          style={{
            display:      "inline-flex",
            alignItems:   "center",
            gap:          "0.375rem",
            padding:      "0.25rem 0.5rem 0.25rem 0.375rem",
            borderRadius: "0.375rem",
            border:       overrideEnabled ? "1px solid #c2410c" : "1px solid #d1d5db",
            background:   overrideEnabled ? "#fff7ed" : "#fff",
            color:        overrideEnabled ? "#c2410c" : "#6b7280",
            fontSize:     "0.75rem",
            fontWeight:   600,
            cursor:       pending ? "default" : "pointer",
            opacity:      pending ? 0.6 : 1,
            transition:   "all 0.12s ease",
            flexShrink:   0,
          }}
        >
          {/* Pill toggle indicator */}
          <span style={{
            display:      "inline-block",
            width:        "28px",
            height:       "16px",
            borderRadius: "9999px",
            background:   overrideEnabled ? "#c2410c" : "#d1d5db",
            position:     "relative",
            flexShrink:   0,
            transition:   "background 0.12s ease",
          }}>
            <span style={{
              position:     "absolute",
              top:          "2px",
              left:         overrideEnabled ? "14px" : "2px",
              width:        "12px",
              height:       "12px",
              borderRadius: "9999px",
              background:   "#fff",
              transition:   "left 0.12s ease",
            }} />
          </span>
          Override typography
        </button>

        {/* Family badge — only shown when a family is active */}
        {familyLabel && (
          <span style={{
            display:      "inline-flex",
            alignItems:   "center",
            padding:      "1px 8px",
            borderRadius: "9999px",
            fontSize:     "0.6875rem",
            fontWeight:   600,
            background:   badgeBg,
            color:        badgeColor,
            border:       `1px solid ${badgeBorder}`,
          }}>
            {familyLabel}
            {familyDefaults && (
              <span style={{ fontWeight: 400, marginLeft: "4px", opacity: 0.75 }}>
                · {shortFontName(familyDefaults.headingFont)}
              </span>
            )}
          </span>
        )}

        {/* No family selected — informational note */}
        {!familyLabel && (
          <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
            No style family active — select one in the Style tab
          </span>
        )}

        {/* Status confirmation */}
        {actionDone && !pending && (
          <span style={{ fontSize: "0.6875rem", color: "#15803d", fontWeight: 500 }}>
            {actionDone === "reset"
              ? "✓ Reset to defaults"
              : overrideEnabled
                ? "✓ Override enabled"
                : "✓ Override disabled"}
          </span>
        )}
      </div>

      {/* ── Font defaults summary (only when family is known) ────────────── */}
      {familyDefaults && (
        <div style={{
          display:       "flex",
          flexDirection: "column",
          gap:           "4px",
          marginBottom:  overrideEnabled ? "0.75rem" : "0",
        }}>
          {(["heading", "body"] as const).map((role) => {
            const fontStack     = role === "heading" ? familyDefaults.headingFont : familyDefaults.bodyFont;
            const storedValue   = role === "heading" ? storedHeading : storedBody;
            const isOverridden  = role === "heading" ? headingOverridden : bodyOverridden;
            const label         = role === "heading" ? "Heading:" : "Body:";

            return (
              <div key={role} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem" }}>
                <span style={{ color: "#9ca3af", width: "58px", flexShrink: 0 }}>{label}</span>
                {overrideEnabled && isOverridden ? (
                  <>
                    <span style={{ fontWeight: 600, color: "#c2410c" }}>
                      {storedValue ? shortFontName(storedValue) : "—"}
                    </span>
                    <span style={{ color: "#9ca3af" }}>overrides</span>
                    <span style={{ color: "#6b7280" }}>{shortFontName(fontStack)}</span>
                  </>
                ) : (
                  <span style={{ fontWeight: 600, color: overrideEnabled ? "#374151" : "#15803d" }}>
                    {shortFontName(fontStack)}
                    <span style={{ fontWeight: 400, color: "#9ca3af", marginLeft: "4px" }}>
                      {overrideEnabled
                        ? "(family default, no override set)"
                        : "(active — override is off)"}
                    </span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Hint when override is OFF ─────────────────────────────────────── */}
      {!overrideEnabled && (
        <p style={{
          fontSize:   "0.75rem",
          color:      "#6b7280",
          margin:     familyDefaults ? "0.5rem 0 0" : "0.375rem 0 0",
          lineHeight: 1.5,
        }}>
          {familyLabel
            ? "The font editor below is locked. Enable override to customise font stacks for this tenant. Switching to a different style family always updates typography automatically."
            : "Enable override to manually set font stacks. You can also select a style family in the Style tab to get sensible typography defaults."}
        </p>
      )}

      {/* ── Reset button (shown when flag is ON or stored values exist) ───── */}
      {(overrideEnabled || hasStoredOverrides) && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.75rem" }}>
          <button
            type="button"
            onClick={handleReset}
            disabled={pending}
            style={{
              padding:      "0.25rem 0.625rem",
              borderRadius: "0.375rem",
              border:       "1px solid #d1d5db",
              background:   "#fff",
              color:        "#374151",
              fontSize:     "0.6875rem",
              fontWeight:   500,
              cursor:       pending ? "default" : "pointer",
              opacity:      pending ? 0.6 : 1,
              transition:   "opacity 0.12s ease",
            }}
          >
            {pending ? "Resetting…" : "Reset to theme defaults"}
          </button>
          <span style={{ fontSize: "0.6875rem", color: "#9ca3af" }}>
            Clears all font overrides and disables the toggle
          </span>
        </div>
      )}
    </div>
  );
}

// ── DesignPageClient ──────────────────────────────────────────────────────────

export function DesignPageClient({
  tenantId,
  activeTheme,
  design,
}: DesignPageClientProps) {
  // Driven by the shared sub-nav links (?tab=…); "presets" when absent/unknown.
  const tabParam  = useSearchParams().get("tab");
  const activeTab: DesignTab = isDesignTab(tabParam) ? tabParam : "presets";

  // ── Typography override state ─────────────────────────────────────────────
  //
  // Held here (not derived from `design` at render time) so that:
  //   a) The DesignTokenEditor gate flips immediately on toggle — no page reload.
  //   b) The panel can be shown even when there is no active theme family.
  //
  // Default: false (undefined → false, matching resolve-theme.ts runtime logic).
  const [overrideEnabled, setOverrideEnabled] = useState<boolean>(
    design.typographyOverrideEnabled === true,
  );

  return (
    <div>
      {/* ── Presets (curated themes — contextual-rule compatible) ───────────── */}
      <TabPanel id="presets" active={activeTab}>
        <TabSectionHeader
          title="Design presets"
          description="Pick a ready-made look. Each preset is a curated theme, so it also works with the Automatic-switching contextual rules. For a fully custom look, use the Builder tab."
        />
        <ThemeGallery tenantId={tenantId} activeTheme={activeTheme} />
      </TabPanel>

      {/* ── Builder ─────────────────────────────────────────────────────────── */}
      <TabPanel id="builder" active={activeTab}>
        <TabSectionHeader
          title="Preset builder"
          description="Compose a custom look with colour pickers and selectors. The preview updates live; Save writes the tokens to this tenant (theme = custom)."
        />
        <PresetBuilder tenantId={tenantId} design={design} />
      </TabPanel>

      {/* ── Layout ──────────────────────────────────────────────────────────── */}
      <TabPanel id="layout" active={activeTab}>
        <TabSectionHeader
          title="Layout variants"
          description="Choose the structural shape of the header and footer. Separate from color tokens — color overrides live in the Advanced tab."
        />
        <LayoutVariantEditor tenantId={tenantId} design={design} />
      </TabPanel>

      {/* ── Typography ──────────────────────────────────────────────────────── */}
      <TabPanel id="typography" active={activeTab}>
        <TabSectionHeader
          title="Typography"
          description="By default the active style family controls all fonts. Enable the override toggle to customise individual font stacks for this tenant."
        />

        {/*
          FamilyTypographyPanel always renders, including the toggle.
          overrideEnabled is local state so the editor gate below reacts
          immediately on toggle without waiting for a server re-fetch.
        */}
        <FamilyTypographyPanel
          tenantId={tenantId}
          design={design}
          overrideEnabled={overrideEnabled}
          onOverrideChange={setOverrideEnabled}
        />

        {/*
          Gate uses local `overrideEnabled` state — NOT `design.typographyOverrideEnabled`.
          This means toggling ON shows the editor immediately (optimistic update).
        */}
        {overrideEnabled ? (
          <DesignTokenEditor
            tenantId={tenantId}
            currentDesign={design}
            visibleSections={["typography"]}
            hideHeader
          />
        ) : (
          <div
            aria-live="polite"
            style={{
              padding:      "1.25rem",
              borderRadius: "0.5rem",
              border:       "1px dashed #e5e7eb",
              background:   "#fafafa",
              textAlign:    "center",
            }}
          >
            <p style={{ fontSize: "0.8125rem", color: "#9ca3af", margin: 0 }}>
              Font editor is locked — enable{" "}
              <strong style={{ color: "#374151" }}>Override typography</strong>{" "}
              above to customise font stacks.
            </p>
          </div>
        )}
      </TabPanel>

      {/* ── Blocks (site default + per-block token sets) ─────────────────────── */}
      <TabPanel id="blocks" active={activeTab}>
        <TabSectionHeader
          title="Site design tokens"
          description="Your central design system. Set colors, typography, cards, buttons and more once here — they apply automatically to every content block and adaptive slot. No per-component setup needed."
        />
        <SiteDesignTokensEditor
          tenantId={tenantId}
          initialTokens={design.defaultTokens}
          tokenSets={design.blockTokenSets}
        />

        <div style={{ marginTop: "2rem" }}>
          <TabSectionHeader
            title="Block token sets (overrides)"
            description="Optional. Define reusable, named token sets (dark section, highlight, soft cards…) and assign them to a specific content block or adaptive slot by key when you want it to differ from the site defaults above. Scoped to that block only."
          />
          <BlockTokenSetsEditor tenantId={tenantId} initialSets={design.blockTokenSets} />
        </div>
      </TabPanel>

      {/* ── Advanced ────────────────────────────────────────────────────────── */}
      <TabPanel id="advanced" active={activeTab}>
        <TabSectionHeader
          title="Advanced token editor"
          description="Fine-tune every design token — colors, border radius, spacing, shadows, motion, and components. Power-user territory: changes override the active preset."
        />
        <DesignTokenEditor
          tenantId={tenantId}
          currentDesign={design}
          visibleSections={["preset", "colors", "radius", "spacing", "borders", "shadows", "motion", "components", "json"]}
          hideHeader
        />
      </TabPanel>
    </div>
  );
}
