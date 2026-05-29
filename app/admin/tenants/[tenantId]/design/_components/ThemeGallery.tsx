/**
 * ThemeGallery
 *
 * Admin UI for browsing and activating theme presets.
 *
 * ─── Preview rendering strategy ──────────────────────────────────────────────
 *
 *   PRIMARY (Storybook available):
 *     A 1280×900 Storybook iframe scaled to a 256×180 thumbnail.  This is the
 *     exact same rendered output as production — each story injects
 *     tenantThemeToCSS(THEME_PRESETS[key]) wrapped in :root {} so every block
 *     renders with its actual preset tokens.
 *
 *   FALLBACK (Storybook not running, or while loading):
 *     A CSS-only mini-preview built entirely from the live preset token values
 *     (tenantThemeToVarsRecord).  It shows:
 *       • Hero strip — --hero-bg colour + white micro-text + primary CTA pill
 *       • Feature strip — --feature-grid-bg with three card stubs at card-radius
 *       • CTA strip — --section-cta-bg colour
 *     No React block components are rendered — zero duplication of block logic.
 *     This gives immediate visual differentiation even without Storybook running.
 *
 * ─── Why previews were all identical (now fixed) ─────────────────────────────
 *
 *   tenantThemeToCSS() returns only the inner body of a :root { } rule.
 *   The Storybook decorator was injecting that string into a <style> tag
 *   WITHOUT a :root {} wrapper — producing bare variable declarations with no
 *   selector, which browsers silently ignore.  Every story fell back to the
 *   theme.css defaults (indigo / slate), making all 20 stories look identical.
 *   Fix: wrap with :root { … } in the Storybook decorator (ThemePreviewScene.stories.tsx).
 *
 * ─── Activation ──────────────────────────────────────────────────────────────
 *
 *   Calls saveVisualTokensAction(tenantId, { theme }) — preserves all existing
 *   token overrides, only switches the active preset.
 *
 * ─── Environment variable ─────────────────────────────────────────────────────
 *
 *   NEXT_PUBLIC_STORYBOOK_URL  (optional; default: "http://localhost:6006")
 */

"use client";

import { useState, useTransition } from "react";
import { THEME_CATALOG, THEME_PRESETS } from "@/design-system/theme/presets";
import { THEME_FAMILIES, FEATURED_THEME_FAMILIES } from "@/design-system/theme/theme-family";
import type { FeaturedThemeFamily }       from "@/design-system/theme/theme-family";
import { tenantThemeToVarsRecord }       from "@/design-system/theme";
import { saveVisualTokensAction }        from "@/app/admin/tenants/[tenantId]/actions";
import type { ThemeKey }                 from "@/tenant/types";
import type { ThemePresetKey, ThemeCatalogCategory } from "@/design-system/theme/presets";
import type { ThemeFamilyKey }           from "@/design-system/theme/theme-family";
import { PresetPreviewViewer }           from "./PresetPreviewViewer";
import {
  FEATURED_FAMILY_CONFIGS,
  isFeaturedFamilyKey,
} from "@/design-system/theme/theme-families.config";
import {
  getFeaturedFamilyForPreset,
  shortFontName,
} from "@/design-system/theme/style-defaults";

// ── Constants ─────────────────────────────────────────────────────────────────

const STORYBOOK_URL =
  process.env.NEXT_PUBLIC_STORYBOOK_URL ?? "http://localhost:6006";

/** Natural iframe dimensions that the Storybook story renders at. */
const IFRAME_W = 1280;
const IFRAME_H = 900;

/** Card thumbnail target dimensions. */
const THUMB_W  = 256;
const THUMB_H  = 180;
const SCALE    = THUMB_W / IFRAME_W; // 0.2

// ── CSS-only mini-preview ─────────────────────────────────────────────────────
//
// Builds the key visual token values needed to render the fallback preview
// directly from the live preset — no block components, no logic duplication.
//
// Extended to also reflect BlockStyleProfile dimensions so themes that share
// similar colours but differ in layout character (dividers, card treatment,
// density) are visually distinguishable even without Storybook running.

interface MiniPreviewTokens {
  heroBg:        string;
  primary:       string;
  primaryText:   string;
  ctaBg:         string;
  featureBg:     string;
  cardBg:        string;
  cardBorder:    string;
  cardRadius:    string;
  titleColor:    string;
  subtitleColor: string;
  text:          string;
  border:        string;
  // ── BlockStyleProfile-derived values ────────────────────────────────────────
  /** Visible section divider width ("0px" = no divider). */
  dividerWidth:  string;
  /** Divider colour — falls back to --border when no explicit colour is set. */
  dividerColor:  string;
  /** featureGridStyle drives card background treatment in the feature strip. */
  featureGridStyle: "plain" | "cards" | "highlighted" | "premium";
  /** density drives section-strip heights. */
  density: "compact" | "comfortable" | "airy";
  /** Button corner radius — reflects --btn-radius family structural var. */
  btnRadius: string;
}

function getMiniPreviewTokens(presetKey: ThemePresetKey): MiniPreviewTokens {
  // Defense-in-depth: if the stored preset key is stale (e.g. "workengine" removed
  // from the registry), fall back to a safe default rather than crashing on the
  // destructure inside tenantThemeToVarsRecord / buildThemeVarsArray.
  const preset  = THEME_PRESETS[presetKey] ?? THEME_PRESETS["modern-saas"];
  const v       = tenantThemeToVarsRecord(preset);
  const profile = preset.blockStyle;

  return {
    heroBg:       v["--hero-bg"]              ?? v["--bg-inverse"]           ?? "#0f172a",
    primary:      v["--primary"]              ?? "#6366f1",
    primaryText:  v["--primary-text"]         ?? "#ffffff",
    ctaBg:        v["--section-cta-bg"]       ?? v["--primary"]              ?? "#6366f1",
    featureBg:    v["--feature-grid-bg"]      ?? v["--bg-subtle"]            ?? "#f8fafc",
    cardBg:       v["--card-bg"]              ?? "#ffffff",
    cardBorder:   v["--card-border"]          ?? "#e2e8f0",
    cardRadius:   v["--card-radius"]          ?? "1rem",
    titleColor:   v["--hero-title-color"]     ?? "#ffffff",
    subtitleColor: v["--hero-subtitle-color"] ?? "#94a3b8",
    text:         v["--text"]                 ?? "#0f172a",
    border:       v["--border"]               ?? "#e2e8f0",
    // BlockStyleProfile
    dividerWidth: profile?.dividerWidth  ?? "0px",
    dividerColor: profile?.dividerColor  ?? "var(--border)",
    featureGridStyle: (profile?.featureGridStyle ?? "cards") as MiniPreviewTokens["featureGridStyle"],
    density: (profile?.density ?? "comfortable") as MiniPreviewTokens["density"],
    // Family structural var — pill (9999px) vs sharp (0px) vs rounded (0.375rem)
    btnRadius: v["--btn-radius"] ?? v["--radius-interactive"] ?? "0.375rem",
  };
}

/**
 * CSS-only mini-preview of a theme preset.
 *
 * Renders three horizontal strips representing the hero, feature-grid, and CTA
 * sections of a typical page — the same three blocks in ThemePreviewScene.
 * Pure inline styles from token values — no React block components needed.
 *
 * Extended to reflect BlockStyleProfile dimensions:
 *   dividerWidth / dividerColor → visible or invisible section separators
 *   featureGridStyle            → card treatment (plain / cards / highlighted)
 *   density                     → strip height proportions
 */
function MiniPreview({ presetKey }: { presetKey: ThemePresetKey }) {
  const t = getMiniPreviewTokens(presetKey);

  // ── Section proportions from density ────────────────────────────────────────
  const heroPct    = t.density === "airy" ? "50%" : t.density === "compact" ? "40%" : "45%";
  const featurePct = t.density === "airy" ? "33%" : t.density === "compact" ? "38%" : "35%";
  // CTA is the remainder (flex: 1)

  // ── Divider style ────────────────────────────────────────────────────────────
  // When dividerWidth > 0px, replace the default `border` colour with the
  // explicit dividerColor so Dutch Orange (#AE1C28) and other branded dividers
  // appear correctly instead of falling back to the generic border token.
  const hasDivider      = t.dividerWidth !== "0px";
  const dividerBorderTop = hasDivider
    ? `${t.dividerWidth} solid ${t.dividerColor}`
    : `1px solid ${t.border}`;

  // ── Feature card treatment from featureGridStyle ─────────────────────────────
  type GridStyle = MiniPreviewTokens["featureGridStyle"];
  const cardBgFor: Record<GridStyle, string> = {
    plain:       "transparent",
    cards:       t.cardBg,
    highlighted: `${t.primary}18`,   // very light primary tint
    premium:     t.cardBg,
  };
  const cardBorderFor: Record<GridStyle, string> = {
    plain:       "none",
    cards:       `1px solid ${t.cardBorder}`,
    highlighted: "none",
    premium:     `1px solid ${t.primary}40`,
  };
  const cardShadowFor: Record<GridStyle, string> = {
    plain:       "none",
    cards:       "0 1px 4px rgba(0,0,0,0.08)",
    highlighted: "none",
    premium:     "0 2px 8px rgba(0,0,0,0.12)",
  };
  const effectiveCardBg     = cardBgFor[t.featureGridStyle];
  const effectiveCardBorder = cardBorderFor[t.featureGridStyle];
  const effectiveCardShadow = cardShadowFor[t.featureGridStyle];

  // ── Derived feature background ────────────────────────────────────────────────
  // For "highlighted" style, the section bg should also use a very light primary
  // tint rather than the token featureBg, so the tinted-card effect reads clearly.
  const effectiveFeatureBg = t.featureGridStyle === "highlighted"
    ? `${t.primary}0d`   // ~5% opacity of primary colour
    : t.featureBg;

  return (
    <div
      style={{
        width:    `${THUMB_W}px`,
        height:   `${THUMB_H}px`,
        overflow: "hidden",
        display:  "flex",
        flexDirection: "column",
        borderRadius: "0.5rem 0.5rem 0 0",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Hero strip */}
      <div
        style={{
          flex:          `0 0 ${heroPct}`,
          background:    t.heroBg,
          display:       "flex",
          flexDirection: "column",
          alignItems:    "center",
          justifyContent: "center",
          gap:           "5px",
          padding:       "8px 12px",
        }}
      >
        {/* Eyebrow badge stub */}
        <div style={{
          width:        "40px",
          height:       "5px",
          borderRadius: "3px",
          background:   t.primary,
          opacity:      0.8,
        }} />
        {/* Headline stub */}
        <div style={{
          width:        "90px",
          height:       "6px",
          borderRadius: "3px",
          background:   t.titleColor,
          opacity:      0.9,
        }} />
        <div style={{
          width:        "70px",
          height:       "4px",
          borderRadius: "3px",
          background:   t.titleColor,
          opacity:      0.55,
        }} />
        {/* Subtitle stub */}
        <div style={{
          width:        "80px",
          height:       "3px",
          borderRadius: "2px",
          background:   t.subtitleColor,
          opacity:      0.7,
        }} />
        {/* CTA button stub — borderRadius reflects --btn-radius family var */}
        <div style={{
          marginTop:    "3px",
          padding:      "3px 8px",
          borderRadius: t.btnRadius,
          background:   t.primary,
          color:        t.primaryText,
          fontSize:     "5px",
          fontWeight:   700,
          letterSpacing: "0.03em",
          whiteSpace:   "nowrap",
        }}>
          Get started →
        </div>
      </div>

      {/* Feature grid strip */}
      <div
        style={{
          flex:           `0 0 ${featurePct}`,
          background:     effectiveFeatureBg,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          gap:            "5px",
          padding:        "6px 10px",
          borderTop:      dividerBorderTop,
          borderBottom:   dividerBorderTop,
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              flex:            1,
              height:          "44px",
              background:      effectiveCardBg,
              border:          effectiveCardBorder,
              boxShadow:       effectiveCardShadow,
              borderRadius:    t.cardRadius,
              display:         "flex",
              flexDirection:   "column",
              alignItems:      "flex-start",
              justifyContent:  "center",
              gap:             "3px",
              padding:         "4px 5px",
            }}
          >
            {/* Icon stub */}
            <div style={{
              width:        "8px",
              height:       "8px",
              borderRadius: "2px",
              background:   t.primary,
              opacity:      0.7,
            }} />
            {/* Title stub */}
            <div style={{
              width:        "90%",
              height:       "3px",
              borderRadius: "2px",
              background:   t.text,
              opacity:      0.8,
            }} />
            {/* Body stub */}
            <div style={{
              width:        "75%",
              height:       "2px",
              borderRadius: "2px",
              background:   t.text,
              opacity:      0.35,
            }} />
          </div>
        ))}
      </div>

      {/* CTA strip */}
      <div
        style={{
          flex:           "1",
          background:     t.ctaBg,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          gap:            "6px",
          padding:        "4px 10px",
        }}
      >
        {/* Headline stub */}
        <div style={{
          width:        "60px",
          height:       "5px",
          borderRadius: "3px",
          background:   t.titleColor,
          opacity:      0.85,
        }} />
        {/* Button stub */}
        <div style={{
          padding:      "3px 7px",
          borderRadius: "3px",
          background:   t.cardBg,
          fontSize:     "5px",
          fontWeight:   700,
          color:        t.primary,
          whiteSpace:   "nowrap",
        }}>
          Start free
        </div>
      </div>
    </div>
  );
}

// ── Scaled Storybook iframe ───────────────────────────────────────────────────

interface ThemeThumbnailProps {
  presetKey:  ThemePresetKey;
  label:      string;
}

function ThemeThumbnail({ presetKey, label }: ThemeThumbnailProps) {
  const [iframeLoaded,  setIframeLoaded]  = useState(false);
  const [iframeErrored, setIframeErrored] = useState(false);

  const storyId = `themes-preview--${presetKey}`;
  const src     = `${STORYBOOK_URL}/iframe.html?id=${storyId}&viewMode=story`;

  return (
    <div
      style={{
        width:    `${THUMB_W}px`,
        height:   `${THUMB_H}px`,
        overflow: "hidden",
        position: "relative",
        borderRadius: "0.5rem 0.5rem 0 0",
      }}
    >
      {/* Always-visible CSS mini-preview — the iframe overlays this when loaded */}
      <MiniPreview presetKey={presetKey} />

      {/* Storybook iframe — layered on top, fades in when loaded */}
      {!iframeErrored && (
        <div
          style={{
            position:   "absolute",
            inset:      0,
            overflow:   "hidden",
            // Fade in once loaded; invisible while loading so the MiniPreview shows
            opacity:    iframeLoaded ? 1 : 0,
            transition: "opacity 0.4s ease",
            pointerEvents: "none",
          }}
        >
          <iframe
            src={src}
            title={`Theme preview: ${label}`}
            aria-hidden="true"
            tabIndex={-1}
            onLoad={() => setIframeLoaded(true)}
            onError={() => setIframeErrored(true)}
            style={{
              width:           `${IFRAME_W}px`,
              height:          `${IFRAME_H}px`,
              border:          "none",
              transformOrigin: "top left",
              transform:       `scale(${SCALE})`,
              pointerEvents:   "none",
            }}
          />
        </div>
      )}
    </div>
  );
}

// ── ThemeCard ─────────────────────────────────────────────────────────────────

interface ThemeCardProps {
  presetKey:   ThemePresetKey;
  label:       string;
  description: string;
  isActive:    boolean;
  onActivate:  () => void;
  isPending:   boolean;
  /** Fires when the card receives mouse-enter — used to update the preview panel. */
  onHover?:    () => void;
}

function ThemeCard({
  presetKey,
  label,
  description,
  isActive,
  onActivate,
  isPending,
  onHover,
}: ThemeCardProps) {
  return (
    <div
      onMouseEnter={onHover}
      style={{
        display:       "flex",
        flexDirection: "column",
        borderRadius:  "0.625rem",
        border:        isActive
          ? "2px solid #3b82f6"
          : "1px solid #e5e7eb",
        overflow:      "hidden",
        background:    "#ffffff",
        boxShadow:     isActive
          ? "0 0 0 3px rgba(59,130,246,0.15)"
          : "0 1px 3px rgba(0,0,0,0.06)",
        transition:    "box-shadow 0.15s ease, border-color 0.15s ease",
        cursor:        "default",
      }}
    >
      {/* Multi-page preview — tabs shown when preset has > 1 preview page */}
      <PresetPreviewViewer presetKey={presetKey} label={label} showTabs />

      {/* Card body */}
      <div
        style={{
          display:       "flex",
          flexDirection: "column",
          gap:           "0.5rem",
          padding:       "0.875rem 1rem 1rem",
          flex:          1,
        }}
      >
        {/* Name + active badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            style={{
              fontSize:   "0.8125rem",
              fontWeight: 600,
              color:      "#111827",
              lineHeight: 1.3,
            }}
          >
            {label}
          </span>
          {isActive && (
            <span
              style={{
                display:      "inline-flex",
                alignItems:   "center",
                padding:      "1px 6px",
                borderRadius: "9999px",
                fontSize:     "0.6875rem",
                fontWeight:   600,
                background:   "#eff6ff",
                color:        "#2563eb",
                flexShrink:   0,
              }}
            >
              Active
            </span>
          )}
        </div>

        {/* Description */}
        <p
          style={{
            fontSize:   "0.75rem",
            color:      "#6b7280",
            lineHeight: 1.5,
            margin:     0,
            flex:       1,
          }}
        >
          {description}
        </p>

        {/* Activate button */}
        <button
          type="button"
          onClick={onActivate}
          disabled={isActive || isPending}
          style={{
            marginTop:     "0.25rem",
            padding:       "0.4375rem 0.875rem",
            borderRadius:  "0.375rem",
            border:        isActive ? "1px solid #e5e7eb" : "1px solid #3b82f6",
            background:    isActive ? "#f9fafb" : "#3b82f6",
            color:         isActive ? "#9ca3af" : "#ffffff",
            fontSize:      "0.75rem",
            fontWeight:    600,
            cursor:        isActive || isPending ? "default" : "pointer",
            opacity:       isPending ? 0.7 : 1,
            transition:    "background 0.15s ease, opacity 0.15s ease",
            width:         "100%",
            textAlign:     "center",
          }}
        >
          {isPending ? "Activating…" : isActive ? "Active" : "Activate"}
        </button>
      </div>
    </div>
  );
}

// ── ThemeGallery ──────────────────────────────────────────────────────────────

interface ThemeGalleryProps {
  tenantId:     string;
  activeTheme?: ThemeKey | null;
}

// ── Featured theme families ───────────────────────────────────────────────────
//
// Imported from the canonical source in design-system/theme/theme-family.ts.
// The ThemeGallery renders these as first-class selectable personality entities
// at the top of the design page — separate from and above the raw preset grid.
//
// Source of truth for family copy / descriptions: FEATURED_THEME_FAMILIES in
// design-system/theme/theme-family.ts.  Do NOT duplicate data here.

// ── FamilyCard ────────────────────────────────────────────────────────────────

interface FamilyCardProps {
  family:     FeaturedThemeFamily;
  isActive:   boolean;
  onActivate: () => void;
  isPending:  boolean;
}

function FamilyCard({ family, isActive, onActivate, isPending }: FamilyCardProps) {
  return (
    <div
      style={{
        display:       "flex",
        flexDirection: "column",
        borderRadius:  "0.75rem",
        border:        isActive ? "2px solid #3b82f6" : "1px solid #e5e7eb",
        overflow:      "hidden",
        background:    "#ffffff",
        boxShadow:     isActive
          ? "0 0 0 3px rgba(59,130,246,0.12)"
          : "0 1px 4px rgba(0,0,0,0.06)",
        transition:    "box-shadow 0.15s ease, border-color 0.15s ease",
      }}
    >
      {/* Preview — slightly taller than preset cards for prominence */}
      <div style={{ height: "180px", overflow: "hidden" }}>
        <PresetPreviewViewer presetKey={family.presetKey} label={family.name} showTabs={false} />
      </div>

      {/* Body */}
      <div style={{ padding: "1rem 1.125rem 1.125rem", display: "flex", flexDirection: "column", gap: "0.375rem", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#111827" }}>
            {family.name}
          </span>
          {isActive && (
            <span style={{
              display:      "inline-flex",
              alignItems:   "center",
              padding:      "1px 7px",
              borderRadius: "9999px",
              fontSize:     "0.6875rem",
              fontWeight:   600,
              background:   "#eff6ff",
              color:        "#2563eb",
              flexShrink:   0,
            }}>
              Active
            </span>
          )}
        </div>
        <p style={{ fontSize: "0.6875rem", fontWeight: 500, color: "#9ca3af", margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {family.tagline}
        </p>

        {/* Family typography + layout chips — shown for featured families */}
        {isFeaturedFamilyKey(family.presetKey) && (() => {
          const cfg = FEATURED_FAMILY_CONFIGS[family.presetKey];
          const t   = cfg.typography;
          const s   = cfg.structural;
          // Extract short font name (first quoted or unquoted token before comma)
          const shortFont = (stack: string) =>
            stack.replace(/^'([^']+)'.*$/, "$1").replace(/^([^,]+).*$/, "$1").trim();
          return (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", margin: "4px 0 0" }}>
              {/* Typography chips */}
              <span style={{
                display: "inline-flex", alignItems: "center", gap: "3px",
                padding: "2px 7px", borderRadius: "9999px", fontSize: "0.6875rem",
                background: "#f0fdf4", color: "#16a34a", fontWeight: 500,
              }}>
                <span style={{ opacity: 0.7 }}>H:</span> {shortFont(t.headingFont)}
              </span>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: "3px",
                padding: "2px 7px", borderRadius: "9999px", fontSize: "0.6875rem",
                background: "#f0f9ff", color: "#0369a1", fontWeight: 500,
              }}>
                <span style={{ opacity: 0.7 }}>B:</span> {shortFont(t.bodyFont)}
              </span>
              {t.accentFont && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: "3px",
                  padding: "2px 7px", borderRadius: "9999px", fontSize: "0.6875rem",
                  background: "#fdf4ff", color: "#9333ea", fontWeight: 500,
                }}>
                  <span style={{ opacity: 0.7 }}>A:</span> {shortFont(t.accentFont)}
                </span>
              )}
              {/* Navigation variant chip */}
              <span style={{
                display: "inline-flex", alignItems: "center", gap: "3px",
                padding: "2px 7px", borderRadius: "9999px", fontSize: "0.6875rem",
                background: "#fff7ed", color: "#c2410c", fontWeight: 500,
              }}>
                <span style={{ opacity: 0.7 }}>Nav:</span> {s.navigation.variant}
              </span>
              {/* Header style chip */}
              <span style={{
                display: "inline-flex", alignItems: "center", gap: "3px",
                padding: "2px 7px", borderRadius: "9999px", fontSize: "0.6875rem",
                background: s.header.style === "transparent"
                  ? "#f0f9ff"
                  : s.header.style === "dark"
                    ? "#1e1b4b"
                    : "#f8fafc",
                color: s.header.style === "transparent"
                  ? "#0369a1"
                  : s.header.style === "dark"
                    ? "#a5b4fc"
                    : "#475569",
                fontWeight: 500,
              }}>
                <span style={{ opacity: 0.7 }}>Header:</span> {s.header.style}
              </span>
              {/* Footer variant chip */}
              <span style={{
                display: "inline-flex", alignItems: "center", gap: "3px",
                padding: "2px 7px", borderRadius: "9999px", fontSize: "0.6875rem",
                background: "#f5f3ff", color: "#7c3aed", fontWeight: 500,
              }}>
                <span style={{ opacity: 0.7 }}>Footer:</span> {s.footer.variant}
              </span>
            </div>
          );
        })()}

        <p style={{ fontSize: "0.75rem", color: "#6b7280", lineHeight: 1.55, margin: "0.25rem 0 0", flex: 1 }}>
          {family.description}
        </p>
        <button
          type="button"
          onClick={onActivate}
          disabled={isActive || isPending}
          style={{
            marginTop:    "0.5rem",
            padding:      "0.5rem 0.875rem",
            borderRadius: "0.375rem",
            border:       isActive ? "1px solid #e5e7eb" : "1px solid #3b82f6",
            background:   isActive ? "#f9fafb" : "#3b82f6",
            color:        isActive ? "#9ca3af" : "#ffffff",
            fontSize:     "0.75rem",
            fontWeight:   600,
            cursor:       isActive || isPending ? "default" : "pointer",
            opacity:      isPending ? 0.7 : 1,
            transition:   "background 0.15s ease, opacity 0.15s ease",
            width:        "100%",
            textAlign:    "center",
          }}
        >
          {isPending ? "Activating…" : isActive ? "Selected" : "Select family"}
        </button>
      </div>
    </div>
  );
}

// ── DefaultChip ───────────────────────────────────────────────────────────────

/**
 * Small label : value chip used in the preview panel to show family defaults
 * that will be loaded when the preset is activated.
 */
function DefaultChip({ label, value, colour }: { label: string; value: string; colour: string }) {
  return (
    <div style={{
      display:       "inline-flex",
      alignItems:    "center",
      gap:           "4px",
      padding:       "2px 7px",
      borderRadius:  "9999px",
      fontSize:      "0.6875rem",
      fontWeight:    500,
      background:    `${colour}14`,   // ~8% opacity tint
      color:         colour,
      border:        `1px solid ${colour}30`,
      whiteSpace:    "nowrap",
    }}>
      <span style={{ opacity: 0.65, fontWeight: 400 }}>{label}:</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

// ── Family grouping helpers ───────────────────────────────────────────────────

/**
 * Ordered list of theme family keys as they appear in the gallery.
 * Each family gets a heading and description drawn from THEME_FAMILIES.
 *
 * Premium style families (dark-ai, clean-corporate, structured-saas) are
 * listed first so they appear at the top of Step 1 for immediate discovery.
 */
const GALLERY_FAMILY_ORDER: readonly ThemeFamilyKey[] = [
  // ── Premium style families ─────────────────────────────────────────────────
  "dark-ai",
  "clean-corporate",
  "structured-saas",
  // ── Standard families ──────────────────────────────────────────────────────
  "saas-product",
  "corporate-professional",
  "editorial-publishing",
  "startup-growth",
  "luxury-dark",
  "industrial-utility",
  "wellness-care",
] as const;

/**
 * Returns THEME_CATALOG entries grouped by familyKey, in GALLERY_FAMILY_ORDER.
 * Entries without a recognised familyKey are collected in a final "other" group.
 */
function groupByFamily() {
  const byFamily = new Map<ThemeFamilyKey, typeof THEME_CATALOG[number][]>();
  const seasonal: typeof THEME_CATALOG[number][] = [];

  for (const entry of THEME_CATALOG) {
    if (entry.category === "seasonal") {
      seasonal.push(entry);
      continue;
    }
    const key = entry.familyKey as ThemeFamilyKey;
    if (!byFamily.has(key)) byFamily.set(key, []);
    byFamily.get(key)!.push(entry);
  }

  const groups: Array<{
    familyKey: ThemeFamilyKey | "seasonal";
    name:      string;
    tagline:   string;
    entries:   typeof THEME_CATALOG[number][];
  }> = [];

  for (const fk of GALLERY_FAMILY_ORDER) {
    const entries = byFamily.get(fk);
    if (!entries || entries.length === 0) continue;
    const family = THEME_FAMILIES[fk];
    groups.push({
      familyKey: fk,
      name:      family.name,
      tagline:   family.tagline,
      entries,
    });
  }

  if (seasonal.length > 0) {
    groups.push({
      familyKey: "seasonal",
      name:      "Seasonal",
      tagline:   "Time-limited campaign themes for holidays and national events",
      entries:   seasonal,
    });
  }

  return groups;
}

const THEME_GROUPS = groupByFamily();

// ── ThemeGallery ──────────────────────────────────────────────────────────────

/** Infer the structural family key for a preset from THEME_CATALOG. */
function getFamilyForPreset(presetKey: string): ThemeFamilyKey | "seasonal" | null {
  const entry = THEME_CATALOG.find((e) => e.presetKey === presetKey);
  return (entry?.familyKey as ThemeFamilyKey | undefined) ?? null;
}

export function ThemeGallery({ tenantId, activeTheme }: ThemeGalleryProps) {
  const [pending, startTransition] = useTransition();
  const [activating, setActivating]   = useState<string | null>(null);
  const [localActive, setLocalActive] = useState<ThemeKey | null | undefined>(activeTheme);
  const [error, setError]             = useState<string | null>(null);
  /** Family key of the last successfully activated preset — shown in confirmation. */
  const [lastLoadedFamily, setLastLoadedFamily] = useState<string | null>(null);

  // ── Stepped UX state ────────────────────────────────────────────────────────

  /** The structural family whose presets are visible in Step 2. */
  const [selectedFamily, setSelectedFamily] = useState<ThemeFamilyKey | "seasonal">(() => {
    if (activeTheme) {
      const fk = getFamilyForPreset(String(activeTheme));
      if (fk) return fk;
    }
    return GALLERY_FAMILY_ORDER[0];
  });

  /** The preset shown in the right-hand preview panel.
   *  Only initialise with the stored activeTheme when it is actually a valid
   *  preset key — stale stored values (e.g. "workengine") are ignored so the
   *  gallery opens on the first preset in the selected family instead. */
  const [previewKey, setPreviewKey] = useState<ThemePresetKey | null>(() => {
    if (!activeTheme) return null;
    const key = String(activeTheme);
    return key in THEME_PRESETS ? (key as ThemePresetKey) : null;
  });

  // ── Derived ─────────────────────────────────────────────────────────────────

  /** Presets for the currently-selected family. */
  const selectedGroup = THEME_GROUPS.find((g) => g.familyKey === selectedFamily);

  /** Key actually shown in the preview panel — falls back to first preset. */
  const effectivePreviewKey: ThemePresetKey | null =
    previewKey ??
    (selectedGroup?.entries[0]?.presetKey as ThemePresetKey | undefined) ??
    null;

  /** Catalog entry for the preview panel label / description. */
  const previewEntry = effectivePreviewKey
    ? THEME_CATALOG.find((e) => e.presetKey === effectivePreviewKey)
    : null;

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleActivate(presetKey: string) {
    if (presetKey === localActive) return;
    setActivating(presetKey);
    setPreviewKey(presetKey as ThemePresetKey);
    setError(null);
    setLastLoadedFamily(null);

    startTransition(async () => {
      // Detect whether this preset belongs to a featured family.
      // If so, include the family key so TenantSettings tracks the choice.
      const featuredFamily = getFeaturedFamilyForPreset(presetKey);

      const result = await saveVisualTokensAction(tenantId, {
        theme: presetKey as ThemeKey,
        // Reset the typography override flag so the new family's typography is
        // applied cleanly without being masked by stale font overrides from the
        // previous family.  The operator can re-enable it in Design → Typography.
        typographyOverrideEnabled: false,
        ...(featuredFamily ? { selectedStyleFamily: featuredFamily } : { selectedStyleFamily: "" }),
      });
      if (result.ok) {
        setLocalActive(presetKey as ThemeKey);
        setLastLoadedFamily(featuredFamily);
      } else {
        setError(result.errors?.join(", ") ?? "Failed to activate theme.");
      }
      setActivating(null);
    });
  }

  function handleFamilySelect(familyKey: ThemeFamilyKey | "seasonal") {
    setSelectedFamily(familyKey);
    // Move preview to the active preset if it lives in this family, else to the first preset.
    const group = THEME_GROUPS.find((g) => g.familyKey === familyKey);
    if (!group) return;
    const activeInFamily = group.entries.some((e) => e.presetKey === localActive);
    if (!activeInFamily) {
      setPreviewKey((group.entries[0]?.presetKey as ThemePresetKey) ?? null);
    }
  }

  // ── Swatch helper ────────────────────────────────────────────────────────────

  function familySwatch(group: typeof THEME_GROUPS[number]): string {
    const pk = group.entries[0]?.presetKey as ThemePresetKey | undefined;
    return pk ? (getMiniPreviewTokens(pk).primary) : "#6366f1";
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <section aria-label="Theme gallery">
      <div style={{ display: "flex", gap: "2rem", alignItems: "flex-start" }}>

        {/* ── Left: Steps 1 + 2 ───────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Step 1 — Family selector */}
          <div style={{ marginBottom: "1.75rem" }}>
            <p style={{
              fontSize: "0.6875rem", fontWeight: 600, color: "#9ca3af",
              textTransform: "uppercase", letterSpacing: "0.06em",
              margin: "0 0 0.625rem",
            }}>
              Step 1 — Choose a style family
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {THEME_GROUPS.map((group) => {
                const isSel = group.familyKey === selectedFamily;
                return (
                  <button
                    key={group.familyKey}
                    type="button"
                    onClick={() => handleFamilySelect(group.familyKey as ThemeFamilyKey | "seasonal")}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "0.375rem",
                      padding: "0.375rem 0.75rem",
                      borderRadius: "9999px",
                      border: isSel ? "1.5px solid #3b82f6" : "1px solid #e5e7eb",
                      background: isSel ? "#eff6ff" : "#ffffff",
                      color: isSel ? "#1d4ed8" : "#374151",
                      fontSize: "0.8125rem",
                      fontWeight: isSel ? 600 : 500,
                      cursor: "pointer",
                      transition: "all 0.12s ease",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span style={{
                      width: "8px", height: "8px", borderRadius: "50%",
                      background: familySwatch(group), flexShrink: 0,
                    }} />
                    {group.name}
                    <span style={{
                      fontSize: "0.6875rem",
                      color: isSel ? "#3b82f6" : "#9ca3af",
                      fontWeight: 400,
                    }}>
                      {group.entries.length}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedGroup && (
              <p style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#6b7280", margin: "0.5rem 0 0" }}>
                {selectedFamily !== "seasonal"
                  ? (THEME_FAMILIES[selectedFamily]?.tagline ?? "")
                  : "Time-limited campaign themes for holidays and national events"}
              </p>
            )}
          </div>

          {/* Step 2 — Preset grid (filtered by family) */}
          <div>
            <p style={{
              fontSize: "0.6875rem", fontWeight: 600, color: "#9ca3af",
              textTransform: "uppercase", letterSpacing: "0.06em",
              margin: "0 0 0.75rem",
            }}>
              Step 2 — Choose a preset
            </p>

            {error && (
              <div role="alert" style={{
                marginBottom: "0.875rem", padding: "0.625rem 0.875rem",
                borderRadius: "0.375rem", background: "#fef2f2",
                border: "1px solid #fecaca", color: "#b91c1c", fontSize: "0.8125rem",
              }}>
                {error}
              </div>
            )}

            {selectedGroup ? (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
                gap: "0.875rem",
              }}>
                {selectedGroup.entries.map((entry) => (
                  <ThemeCard
                    key={entry.presetKey}
                    presetKey={entry.presetKey as ThemePresetKey}
                    label={entry.label}
                    description={entry.description}
                    isActive={localActive === entry.presetKey}
                    isPending={pending && activating === entry.presetKey}
                    onActivate={() => handleActivate(entry.presetKey)}
                    onHover={() => setPreviewKey(entry.presetKey as ThemePresetKey)}
                  />
                ))}
              </div>
            ) : (
              <p style={{ fontSize: "0.875rem", color: "#9ca3af" }}>No presets for this family yet.</p>
            )}
          </div>

        </div>

        {/* ── Right: sticky live preview panel ────────────────────────────── */}
        <div style={{ width: "272px", flexShrink: 0, position: "sticky", top: "1.5rem" }}>
          <p style={{
            fontSize: "0.6875rem", fontWeight: 600, color: "#9ca3af",
            textTransform: "uppercase", letterSpacing: "0.06em",
            margin: "0 0 0.625rem",
          }}>
            Live preview
          </p>

          {effectivePreviewKey ? (
            <div style={{
              borderRadius: "0.625rem", overflow: "hidden",
              border: "1px solid #e5e7eb", background: "#fff",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}>
              {/* Multi-page preview — tabs shown when preset has > 1 preview page */}
              <PresetPreviewViewer presetKey={effectivePreviewKey} label={previewEntry?.label ?? effectivePreviewKey} showTabs />

              {/* Info + activate */}
              <div style={{ padding: "0.75rem 1rem 1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#111827", margin: 0, flex: 1 }}>
                    {previewEntry?.label ?? effectivePreviewKey}
                  </p>
                  {localActive === effectivePreviewKey && (
                    <span style={{
                      padding: "1px 6px", borderRadius: "9999px",
                      fontSize: "0.6875rem", fontWeight: 600,
                      background: "#f0fdf4", color: "#15803d",
                      border: "1px solid #bbf7d0", flexShrink: 0,
                    }}>
                      Active
                    </span>
                  )}
                </div>
                {previewEntry?.description && (
                  <p style={{ fontSize: "0.75rem", color: "#6b7280", margin: "0.25rem 0 0", lineHeight: 1.5 }}>
                    {previewEntry.description}
                  </p>
                )}

                {/* ── Preset defaults preview (shown for ALL presets from catalog metadata) */}
                {(() => {
                  const hoverEntry = effectivePreviewKey
                    ? THEME_CATALOG.find((e) => e.presetKey === effectivePreviewKey)
                    : null;
                  const defs = hoverEntry?.defaults;
                  if (!defs) return null;
                  return (
                    <div style={{
                      marginTop: "0.625rem", padding: "0.5rem 0.625rem",
                      background: "#f8fafc", borderRadius: "0.375rem",
                      border: "1px solid #e5e7eb",
                    }}>
                      <p style={{ fontSize: "0.625rem", fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.375rem" }}>
                        Defaults loaded with this preset
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        <DefaultChip label="H font" value={shortFontName(defs.headingFont)} colour="#16a34a" />
                        <DefaultChip label="B font" value={shortFontName(defs.bodyFont)} colour="#0369a1" />
                        <DefaultChip label="Header" value={defs.headerVariant} colour="#c2410c" />
                        <DefaultChip label="Footer" value={`${defs.footerVariant} · ${defs.footerDensity}`} colour="#7c3aed" />
                      </div>
                    </div>
                  );
                })()}

                {/* ── "Family defaults applied" confirmation after activation */}
                {lastLoadedFamily && localActive === effectivePreviewKey && (() => {
                  const cfg = isFeaturedFamilyKey(lastLoadedFamily)
                    ? FEATURED_FAMILY_CONFIGS[lastLoadedFamily]
                    : null;
                  if (!cfg) return null;
                  return (
                    <div style={{
                      marginTop: "0.5rem", padding: "0.5rem 0.625rem",
                      background: "#f0fdf4", borderRadius: "0.375rem",
                      border: "1px solid #bbf7d0",
                    }}>
                      <p style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#15803d", margin: "0 0 2px" }}>
                        ✓ {cfg.label} defaults applied
                      </p>
                      <p style={{ fontSize: "0.625rem", color: "#16a34a", margin: 0, lineHeight: 1.5 }}>
                        Typography, header &amp; footer defaults loaded. Override them in the Typography and Layout tabs.
                      </p>
                    </div>
                  );
                })()}

                {localActive !== effectivePreviewKey && (
                  <button
                    type="button"
                    onClick={() => handleActivate(effectivePreviewKey)}
                    disabled={pending}
                    style={{
                      marginTop: "0.75rem", width: "100%",
                      padding: "0.4375rem", borderRadius: "0.375rem",
                      background: "#3b82f6", color: "#fff",
                      fontSize: "0.75rem", fontWeight: 600,
                      border: "none", cursor: pending ? "default" : "pointer",
                      opacity: pending ? 0.7 : 1, transition: "opacity 0.15s ease",
                    }}
                  >
                    {pending && activating === effectivePreviewKey ? "Activating…" : "Activate preset"}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div style={{
              height: "180px", borderRadius: "0.625rem",
              border: "1px dashed #e5e7eb",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <p style={{ fontSize: "0.75rem", color: "#9ca3af" }}>Hover a preset to preview</p>
            </div>
          )}
        </div>

      </div>
    </section>
  );
}
