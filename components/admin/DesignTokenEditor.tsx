/**
 * DesignTokenEditor
 *
 * Visual design token editor for the admin tenant detail page.
 * Lets operators adjust CSS design tokens across all token groups without
 * uploading a JSON file — and also provides an integrated JSON import path
 * that loads tokens into the editor for review before saving.
 *
 * ─── Token groups covered ────────────────────────────────────────────────────
 *
 *   Theme preset    — controls the base personality all tokens derive from
 *   Colors          — full palette: primary, accent, surface, border, ring,
 *                     destructive, card, popover, muted
 *   Typography      — font stack (sans, mono, serif), size, line-height
 *   Radius          — interactive, card, popover, sm/md/lg/full scale
 *   Spacing         — base, xs, sm, md, lg, xl, 2xl scale
 *   Borders         — width (default, sm, lg), color
 *   Shadows         — sm, md, lg, xl, none
 *   Motion          — duration (fast, base, slow), easing (in/out/inOut/default)
 *   Components      — button (radius, padding), card padding, input (radius,
 *                     height), badge radius
 *
 * ─── Preset loading ──────────────────────────────────────────────────────────
 *
 *   Selecting a theme preset loads that preset's values into the form fields
 *   (colors, typography, radius).  The user can then adjust individual tokens
 *   and save.  Groups without a direct preset mapping (border, shadow, motion)
 *   are left unchanged on preset switch.
 *
 * ─── JSON import ─────────────────────────────────────────────────────────────
 *
 *   The "Import JSON" section accepts a design-token JSON file.  On success
 *   the validated values are loaded into the form fields — the user reviews
 *   them and clicks "Save tokens" to persist.  Nothing is saved automatically.
 *
 * ─── Clear / reset semantics ─────────────────────────────────────────────────
 *
 *   An empty input (or clicking ✕) sends an empty string "" to the action,
 *   which removes that key from the override group — the token reverts to the
 *   value provided by the active theme preset.  "Clear all overrides" empties
 *   every field managed by this editor at once.
 */

"use client";

import React, { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent }                        from "@/components/ui/Card";
import { saveVisualTokensAction }                   from "@/app/admin/tenants/[tenantId]/actions";
import type {
  SaveVisualTokensResult,
  VisualTokenFields,
} from "@/app/admin/tenants/[tenantId]/types";
import type { TenantDesignSettings, ThemeKey } from "@/tenant";
import { DESIGN_PRESETS, getSafeDesignPreset, normalizeThemeKey } from "@/tenant";
import { THEME_CATALOG }                            from "@/design-system/theme/presets";
import { validateDesignTokenUpload }               from "@/tenant/design-token-validator";
import type { DesignTokenUploadInput }             from "@/tenant/design-token-validator";
import {
  SANS_SERIF_FONTS,
  SERIF_FONTS,
  DISPLAY_FONTS,
  MONOSPACE_FONTS,
  CATEGORY_LABEL,
  matchFontStack,
} from "@/lib/supported-fonts";
import type { SupportedGoogleFont, FontCategory }     from "@/lib/supported-fonts";
import {
  uploadCustomFontAction,
  removeCustomFontWeightAction,
} from "@/app/admin/tenants/[tenantId]/font-actions";
import type { FontSource, FontRole, CustomFontWeight } from "@/app/admin/tenants/[tenantId]/types";
import type { TenantCustomFonts, CustomFontFace }      from "@/tenant/types";

// ── Types ──────────────────────────────────────────────────────────────────────

/** Section keys that can be selectively shown.  When `visibleSections` is
 *  omitted, all sections are rendered (backward-compatible). */
export type DesignTokenSection =
  | "preset"
  | "colors"
  | "typography"
  | "radius"
  | "spacing"
  | "borders"
  | "shadows"
  | "motion"
  | "components"
  | "json";

export interface DesignTokenEditorProps {
  tenantId:       string;
  currentDesign:  TenantDesignSettings;
  /** Current custom font configurations, if any. Read from design.customFonts. */
  customFonts?:   TenantCustomFonts;
  /**
   * Limit which sections are rendered.  Omit to render all (default behaviour).
   * Useful when embedding specific sections inside a tab layout without
   * duplicating form state across multiple component instances.
   */
  visibleSections?: readonly DesignTokenSection[];
  /**
   * When true the component omits its own panel header (title + override badge).
   * Use this when the parent tab provides its own section heading.
   */
  hideHeader?: boolean;
}

/** All editable token fields in the editor — one flat object per group. */
interface TokenFormState {
  // theme
  theme: ThemeKey;
  // color
  colorPrimary:           string;
  colorSecondary:         string;
  colorAccent:            string;
  colorBackground:        string;
  colorForeground:        string;
  colorMuted:             string;
  colorMutedForeground:   string;
  colorBorder:            string;
  colorRing:              string;
  colorDestructive:       string;
  colorCard:              string;
  colorCardForeground:    string;
  colorPopover:           string;
  colorPopoverForeground: string;
  // typography — base font stacks
  fontSans:       string;
  fontMono:       string;
  fontSerif:      string;
  baseFontSize:   string;
  lineHeightBase: string;
  // typography — font sources (editor hint, stored alongside stacks)
  fontSansSource:  FontSource;
  fontSerifSource: FontSource;
  fontMonoSource:  FontSource;
  // typography — usage-role mappings
  fontHeading:       string;
  fontBody:          string;
  fontUI:            string;
  fontCode:          string;
  fontHeadingSource: FontSource;
  // radius
  radiusInteractive: string;
  radiusCard:        string;
  radiusPopover:     string;
  radiusSm:          string;
  radiusMd:          string;
  radiusLg:          string;
  radiusFull:        string;
  // spacing
  spacingBase: string;
  spacingXs:   string;
  spacingSm:   string;
  spacingMd:   string;
  spacingLg:   string;
  spacingXl:   string;
  spacing2xl:  string;
  // border
  borderWidth:   string;
  borderWidthSm: string;
  borderWidthLg: string;
  borderColor:   string;
  // shadow
  shadowSm:   string;
  shadowMd:   string;
  shadowLg:   string;
  shadowXl:   string;
  shadowNone: string;
  // motion
  motionDurationFast:  string;
  motionDurationBase:  string;
  motionDurationSlow:  string;
  motionEasingDefault: string;
  motionEasingIn:      string;
  motionEasingOut:     string;
  motionEasingInOut:   string;
  // component
  buttonRadius:   string;
  buttonPaddingX: string;
  buttonPaddingY: string;
  cardPadding:    string;
  cardRadius:     string;
  inputRadius:    string;
  inputHeight:    string;
  badgeRadius:    string;
  // layout — header & footer shell
  headerBg:         string;
  headerBgScrolled: string;
  headerFg:         string;
  headerBorder:     string;
  footerBg:         string;
  footerFg:         string;
  footerBorder:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

// ── Theme options ──────────────────────────────────────────────────────────────
//
// Platform originals are hardcoded (their ThemeKey differs from ThemePresetKey).
// All curated commercial themes are derived directly from THEME_CATALOG so new
// presets added to the registry appear here automatically — no manual sync needed.

const CATALOG_CATEGORY_TO_GROUP: Record<string, string> = {
  corporate:  "Corporate",
  marketing:  "Marketing",
  specialist: "Specialist",
};

const THEME_OPTIONS: ReadonlyArray<{
  value:       ThemeKey;
  label:       string;
  description: string;
  group:       string;
}> = [
  // ── Platform originals (ThemeKey ≠ ThemePresetKey — kept explicit) ──────────
  { value: "default", label: "Platform Default", description: "Indigo-violet, balanced radius — platform standard",        group: "Platform" },
  { value: "minimal", label: "Enterprise Clean",  description: "Slate palette, sharp radius — restrained B2B",              group: "Platform" },
  { value: "bold",    label: "Bold Brand",         description: "Deep indigo, soft radius, heavy weight — expressive",      group: "Platform" },
  { value: "custom",  label: "Custom",             description: "Fully bespoke — configure all tokens via overrides below", group: "Platform" },

  // ── Curated commercial themes — auto-derived from THEME_CATALOG ──────────────
  ...THEME_CATALOG
    .filter((entry) => entry.category !== "platform") // skip platform presets above
    .map((entry) => ({
      value:       entry.presetKey as ThemeKey,
      label:       entry.label,
      description: entry.description,
      group:       CATALOG_CATEGORY_TO_GROUP[entry.category] ?? "Specialist",
    })),
];

// ── Shared class names ─────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-mono " +
  "text-neutral-900 placeholder:text-neutral-400 placeholder:font-sans " +
  "focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 " +
  "disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:opacity-60";

const labelCls = "block text-xs font-medium text-neutral-600 mb-1";
const hintCls  = "mt-0.5 text-[10px] leading-snug text-neutral-400";

// ── Sub-components ─────────────────────────────────────────────────────────────

/**
 * Inline colour swatch — rendered next to colour inputs so the operator
 * can immediately see the resolved hue.  Works with any CSS <color> value
 * the browser understands: hex, hsl(), oklch(), named colours, etc.
 * Hidden when the value is empty.
 */
function ColorSwatch({ value }: { value: string }) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return (
    <span
      className="inline-block h-6 w-6 flex-shrink-0 rounded border border-neutral-200 shadow-sm"
      style={{ backgroundColor: trimmed }}
      title={trimmed}
      aria-hidden="true"
    />
  );
}

/**
 * Labelled text input with an optional colour swatch and a ✕ clear button.
 *
 * The clear button is only rendered when the field has a value; clicking it
 * sets the field to "" which tells the action to remove that override.
 */
function TokenInput({
  label,
  value,
  onChange,
  placeholder,
  hint,
  showSwatch = false,
  disabled   = false,
}: {
  label:       string;
  value:       string;
  onChange:    (v: string) => void;
  placeholder?: string;
  hint?:        string;
  showSwatch?:  boolean;
  disabled?:    boolean;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "— using preset —"}
          disabled={disabled}
          className={inputCls}
          spellCheck={false}
          autoComplete="off"
        />
        {showSwatch && <ColorSwatch value={value} />}
        {value.trim() && !disabled && (
          <button
            type="button"
            onClick={() => onChange("")}
            title="Clear override — resets to theme preset"
            aria-label={`Clear ${label} override`}
            className="flex-shrink-0 rounded p-0.5 text-neutral-300 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
          >
            {/* ✕ icon — Heroicons XMarkIcon, 16×16 */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
            </svg>
          </button>
        )}
      </div>
      {hint && <p className={hintCls}>{hint}</p>}
    </div>
  );
}

/** Section divider with a title and optional subtitle. */
function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-3 border-b border-neutral-100 pb-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{title}</p>
      {description && (
        <p className="mt-0.5 text-[10px] text-neutral-400">{description}</p>
      )}
    </div>
  );
}

/**
 * FontPicker — curated-first font selection component.
 *
 * ─── Default view ─────────────────────────────────────────────────────────────
 *
 *   Shows only `curated: true` fonts for the active category — a hand-picked
 *   set of 18 fonts that cover every common use-case without overwhelming
 *   less technical users.
 *
 * ─── Advanced view ("More fonts") ────────────────────────────────────────────
 *
 *   A "More fonts" toggle at the bottom reveals all fonts in the list,
 *   including the 25 non-curated entries that are fully supported and
 *   pre-loaded but not surfaced by default.
 *
 * ─── Category tabs ────────────────────────────────────────────────────────────
 *
 *   When the supplied font list spans multiple categories (e.g. the heading
 *   role receives SERIF_FONTS + DISPLAY_FONTS), category tabs appear so the
 *   user can quickly focus on one type.  Single-category lists show no tabs.
 *
 * ─── Font cards ───────────────────────────────────────────────────────────────
 *
 *   Each font is presented as a card that renders the preview text
 *   "Aa Bb 123" using that font's CSS stack.  Since all fonts are pre-loaded
 *   by lib/fonts.ts (either via next/font or CDN <link>), no dynamic loading
 *   is required — `style={{ fontFamily: stack }}` resolves instantly.
 *
 * ─── Hover preview ────────────────────────────────────────────────────────────
 *
 *   Hovering a card shows a larger live preview below the grid via the
 *   shared `FontPreview` component.  The per-card inline sample handles
 *   quick visual scanning; the hover preview provides a larger reference
 *   before committing.
 *
 *   The active selection is shown by the `FontPreview` below the TokenInput
 *   in `FontRoleEditor` — that strip persists regardless of hover state.
 */
function FontPicker({
  fonts,
  activeValue,
  onSelect,
  disabled = false,
}: {
  fonts:       readonly SupportedGoogleFont[];
  activeValue: string;
  onSelect:    (stack: string) => void;
  disabled?:   boolean;
}) {
  const [showAll,        setShowAll]        = React.useState(false);
  const [activeCategory, setActiveCategory] = React.useState<FontCategory | "all">("all");
  const [hoveredStack,   setHoveredStack]   = React.useState<string | null>(null);

  // ── Derived data ─────────────────────────────────────────────────────────

  // Categories present in the provided list (preserves insertion order).
  const presentCategories = React.useMemo(
    () => [...new Set(fonts.map((f) => f.category))],
    [fonts],
  );
  const hasMultipleCategories = presentCategories.length > 1;

  // Apply category filter (only meaningful when multiple categories exist).
  const categoryFiltered = React.useMemo(() => {
    if (!hasMultipleCategories || activeCategory === "all") return fonts;
    return fonts.filter((f) => f.category === activeCategory);
  }, [fonts, activeCategory, hasMultipleCategories]);

  // Curated subset — what's shown by default.
  const curatedFonts    = React.useMemo(
    () => categoryFiltered.filter((f) => f.curated),
    [categoryFiltered],
  );
  const nonCuratedCount = categoryFiltered.length - curatedFonts.length;
  const displayedFonts  = showAll ? categoryFiltered : curatedFonts;

  // Extract active font primary name for comparison.
  const activePrimaryName = React.useMemo(() => {
    const t = activeValue.trim();
    if (!t) return null;
    return t.replace(/^['"]([^'"]+)['"].*/, "$1").trim().toLowerCase();
  }, [activeValue]);

  // ── Hover preview target ─────────────────────────────────────────────────
  // Only show on hover — the persistent active preview is handled by
  // FontRoleEditor's bottom FontPreview strip.
  const hoverPreviewLabel = hoveredStack
    ? hoveredStack.replace(/^['"]([^'"]+)['"].*/, "$1").trim()
    : null;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div>

      {/* ── Category tabs — only when list spans multiple categories ── */}
      {hasMultipleCategories && (
        <div className="mb-2.5 flex flex-wrap gap-1">
          {(["all", ...presentCategories] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              disabled={disabled}
              onClick={() => {
                setActiveCategory(cat as FontCategory | "all");
                setShowAll(false); // reset advanced mode on category switch
              }}
              className={[
                "rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors",
                "disabled:cursor-not-allowed disabled:opacity-40",
                activeCategory === cat
                  ? "border-brand-400 bg-brand-50 text-brand-700"
                  : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300 hover:text-neutral-700",
              ].join(" ")}
            >
              {cat === "all"
                ? "All"
                : CATEGORY_LABEL[cat as FontCategory] ?? cat}
            </button>
          ))}
        </div>
      )}

      {/* ── Font card grid ─────────────────────────────────────────────── */}
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(112px, 1fr))" }}
      >
        {displayedFonts.map((font) => {
          const isActive = font.name.toLowerCase() === activePrimaryName;

          return (
            <button
              key={font.name}
              type="button"
              title={font.description}
              disabled={disabled}
              onClick={() => onSelect(font.stack)}
              onMouseEnter={() => setHoveredStack(font.stack)}
              onMouseLeave={() => setHoveredStack(null)}
              onFocus={() => setHoveredStack(font.stack)}
              onBlur={() => setHoveredStack(null)}
              className={[
                "group flex flex-col items-start rounded-md border px-2.5 py-2 text-left",
                "transition-all duration-100",
                "disabled:cursor-not-allowed disabled:opacity-40",
                isActive
                  ? "border-brand-400 bg-brand-50 ring-1 ring-brand-300 ring-offset-0"
                  : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50",
              ].join(" ")}
            >
              {/* Preview text — rendered in the font itself */}
              <span
                aria-hidden="true"
                style={{
                  fontFamily:    font.stack,
                  fontSize:      "14px",
                  lineHeight:    1.25,
                  color:         "#111827",
                  display:       "block",
                  width:         "100%",
                  overflow:      "hidden",
                  whiteSpace:    "nowrap",
                  textOverflow:  "ellipsis",
                  marginBottom:  "4px",
                }}
              >
                Aa Bb 123
              </span>

              {/* Font name label */}
              <span
                style={{
                  display:       "block",
                  width:         "100%",
                  overflow:      "hidden",
                  whiteSpace:    "nowrap",
                  textOverflow:  "ellipsis",
                  fontSize:      "10px",
                  lineHeight:    1,
                  fontWeight:    500,
                  color:         isActive ? "var(--brand-700, #3730a3)" : "#6b7280",
                }}
              >
                {font.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── More / fewer fonts toggle ──────────────────────────────────── */}
      {nonCuratedCount > 0 && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setShowAll((v) => !v)}
          className={[
            "mt-2 text-[11px] transition-colors",
            "disabled:cursor-not-allowed disabled:opacity-40",
            showAll
              ? "text-neutral-400 hover:text-neutral-600"
              : "text-[var(--text-brand,#4f46e5)] hover:underline",
          ].join(" ")}
        >
          {showAll
            ? "↑ Show fewer fonts"
            : `+ ${nonCuratedCount} more font${nonCuratedCount !== 1 ? "s" : ""}`}
        </button>
      )}

      {/* ── Hover preview (larger) ─────────────────────────────────────── */}
      {hoveredStack && hoverPreviewLabel && (
        <div className="mt-2">
          <FontPreview
            fontFamily={hoveredStack}
            label={hoverPreviewLabel}
            size="lg"
          />
        </div>
      )}
    </div>
  );
}

// ── FontPreview ────────────────────────────────────────────────────────────────

/**
 * Renders a live typographic preview for a given CSS font-family stack.
 *
 * Since all supported Google fonts are pre-loaded by `lib/fonts.ts` (either via
 * next/font or a CDN <link>), applying `style={{ fontFamily }}` is sufficient —
 * no additional loading is needed.  Custom fonts are loaded via @font-face
 * injected by the tenant token layer.  System fonts are always available.
 *
 * The preview is intentionally compact so it can sit inline next to chip pickers
 * or below a role editor without taking up too much space.
 */
function FontPreview({
  fontFamily,
  label,
  size = "base",
}: {
  /** CSS font-family stack, e.g. `"'Playfair Display', Georgia, serif"`. */
  fontFamily: string;
  /** Short descriptor shown above the sample text, e.g. "Playfair Display". */
  label:      string;
  /** Preview text size: "sm" (12px), "base" (16px), "lg" (22px). */
  size?:      "sm" | "base" | "lg";
}) {
  const trimmed = fontFamily.trim();
  if (!trimmed) return null;

  const fontSize: Record<typeof size, string> = {
    sm:   "12px",
    base: "16px",
    lg:   "22px",
  };

  return (
    <div
      style={{
        display:      "flex",
        alignItems:   "baseline",
        gap:          "0.5rem",
        padding:      "0.375rem 0.625rem",
        background:   "#f9fafb",
        borderRadius: "0.375rem",
        border:       "1px solid #f3f4f6",
        overflow:     "hidden",
      }}
      title={trimmed}
    >
      <span
        style={{
          fontFamily:  trimmed,
          fontSize:    fontSize[size],
          lineHeight:  1.3,
          color:       "#111827",
          letterSpacing: size === "lg" ? "-0.01em" : "0",
          flexShrink:  0,
          whiteSpace:  "nowrap",
        }}
        aria-hidden="true"
      >
        Aa Bb Cc 123
      </span>
      <span
        style={{
          fontSize:   "10px",
          color:      "#9ca3af",
          flexShrink: 1,
          overflow:   "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ── FontRoleEditor ─────────────────────────────────────────────────────────────

/** Weight descriptors used in the custom font upload UI. */
const FONT_WEIGHTS: ReadonlyArray<{
  weight:  CustomFontWeight;
  label:   string;
  urlKey:  keyof CustomFontFace;
}> = [
  { weight: "regular", label: "Regular (400)", urlKey: "regularUrl" },
  { weight: "medium",  label: "Medium (500)",  urlKey: "mediumUrl"  },
  { weight: "bold",    label: "Bold (700)",    urlKey: "boldUrl"    },
  { weight: "italic",  label: "Italic",        urlKey: "italicUrl"  },
];

/** CSS fallback stack per font role — used when auto-building a custom font stack. */
const ROLE_FALLBACK: Record<FontRole, string> = {
  sans:  "system-ui, sans-serif",
  serif: "Georgia, serif",
  mono:  "monospace",
};

/**
 * Editor for a single font role (sans, serif, mono).
 *
 * Renders a source selector (System / Google / Custom) followed by the
 * appropriate sub-UI for the selected source:
 *
 *   system  — manual text input only (no chip picker, no upload)
 *   google  — clickable Google Font chips + editable text input
 *   custom  — CSS name field + per-weight woff2/woff upload rows + text input
 *
 * Custom font operations call server actions directly and invoke
 * `router.refresh()` after success so the parent server component re-fetches
 * the updated `customFonts` prop from the database.
 */
function FontRoleEditor({
  label,
  role,
  source,
  value,
  tenantId,
  customFontFace,
  fonts,
  placeholder,
  fontHint,
  onSourceChange,
  onChange,
  disabled,
}: {
  label:           string;
  role:            FontRole;
  source:          FontSource;
  value:           string;
  tenantId:        string;
  customFontFace?: CustomFontFace;
  fonts:           readonly SupportedGoogleFont[];
  placeholder?:    string;
  fontHint?:       string;
  onSourceChange:  (src: FontSource) => void;
  onChange:        (stack: string) => void;
  disabled:        boolean;
}) {
  const router = useRouter();

  // ── Custom font state ──────────────────────────────────────────────────────
  const [customName,      setCustomName]      = useState(customFontFace?.name ?? "");
  const [uploadingWeight, setUploadingWeight] = useState<CustomFontWeight | null>(null);
  const [removingWeight,  setRemovingWeight]  = useState<CustomFontWeight | null>(null);
  const [opResult,        setOpResult]        = useState<{ ok: boolean; message: string } | null>(null);

  // One file-input ref per weight — always created (hooks rules)
  const regularRef = useRef<HTMLInputElement>(null);
  const mediumRef  = useRef<HTMLInputElement>(null);
  const boldRef    = useRef<HTMLInputElement>(null);
  const italicRef  = useRef<HTMLInputElement>(null);

  const weightRefs: Record<CustomFontWeight, React.RefObject<HTMLInputElement | null>> = {
    regular: regularRef,
    medium:  mediumRef,
    bold:    boldRef,
    italic:  italicRef,
  };

  const isOpBusy = uploadingWeight !== null || removingWeight !== null;

  // ── Upload handler ─────────────────────────────────────────────────────────
  async function handleUpload(weight: CustomFontWeight) {
    const ref  = weightRefs[weight];
    const file = ref.current?.files?.[0];
    if (!file) {
      setOpResult({ ok: false, message: "Select a file before uploading." });
      return;
    }
    if (!customName.trim()) {
      setOpResult({ ok: false, message: "Enter a CSS font family name before uploading." });
      return;
    }

    setUploadingWeight(weight);
    setOpResult(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", customName.trim());

    const result = await uploadCustomFontAction(tenantId, role, weight, fd);
    if (ref.current) ref.current.value = "";
    setUploadingWeight(null);

    if (result.ok) {
      // Auto-populate the CSS stack with the custom font name + role fallback
      const stack = `'${customName.trim()}', ${ROLE_FALLBACK[role]}`;
      onChange(stack);
      setOpResult({ ok: true, message: `✓ ${weight} weight uploaded successfully.` });
      router.refresh();
    } else {
      setOpResult({ ok: false, message: result.error });
    }
  }

  // ── Remove handler ─────────────────────────────────────────────────────────
  async function handleRemove(weight: CustomFontWeight) {
    setRemovingWeight(weight);
    setOpResult(null);

    const result = await removeCustomFontWeightAction(tenantId, role, weight);
    setRemovingWeight(null);

    if (result.ok) {
      setOpResult({ ok: true, message: `✓ ${weight} weight removed.` });
      router.refresh();
    } else {
      setOpResult({ ok: false, message: result.error });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-md border border-neutral-100 bg-neutral-50 p-3">
      {/* Role heading */}
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </p>

      {/* Source selector tabs */}
      <div className="mb-3 flex gap-1">
        {(["system", "google", "custom"] as const).map((src) => (
          <button
            key={src}
            type="button"
            disabled={disabled || isOpBusy}
            onClick={() => onSourceChange(src)}
            className={[
              "rounded border px-2.5 py-1 text-[11px] font-medium transition-colors",
              "disabled:cursor-not-allowed disabled:opacity-40",
              source === src
                ? "border-brand-400 bg-brand-50 text-brand-700"
                : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300 hover:text-neutral-700",
            ].join(" ")}
          >
            {src === "system" ? "System" : src === "google" ? "Google Font" : "Custom"}
          </button>
        ))}
      </div>

      {/* Google — curated font picker */}
      {source === "google" && (
        <div className="mb-3">
          <p className="mb-2 text-[10px] text-neutral-400">
            Curated picks shown by default. All fonts are pre-loaded — select to apply instantly.
          </p>
          <FontPicker
            fonts={fonts}
            activeValue={value}
            onSelect={onChange}
            disabled={disabled}
          />
        </div>
      )}

      {/* Custom — upload UI */}
      {source === "custom" && (
        <div className="mb-3 space-y-3">
          {/* CSS font-family name */}
          <div>
            <label className={labelCls}>CSS font family name</label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Brandica"
              disabled={disabled || isOpBusy}
              className={inputCls}
              spellCheck={false}
            />
            <p className={hintCls}>
              The name used in CSS (e.g. <span className="font-mono">&#39;Brandica&#39;</span>).
              Must be the same across all uploaded weight files.
            </p>
          </div>

          {/* Weight upload rows */}
          <div className="space-y-1.5">
            {FONT_WEIGHTS.map(({ weight, label: wLabel, urlKey }) => {
              const existingUrl = customFontFace?.[urlKey] as string | undefined;
              const isUploading = uploadingWeight === weight;
              const isRemoving  = removingWeight  === weight;

              return (
                <div key={weight} className="flex items-center gap-2">
                  <span className="w-28 flex-shrink-0 text-[11px] text-neutral-500">{wLabel}</span>

                  {existingUrl ? (
                    /* ── Already uploaded: show status + remove ── */
                    <div className="flex flex-1 items-center gap-2">
                      <span className="flex-1 truncate text-[11px] text-green-700">✓ uploaded</span>
                      <button
                        type="button"
                        disabled={disabled || isOpBusy}
                        onClick={() => handleRemove(weight)}
                        className="flex-shrink-0 rounded border border-red-200 px-2 py-0.5 text-[10px] text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isRemoving ? "Removing…" : "Remove"}
                      </button>
                    </div>
                  ) : (
                    /* ── Not uploaded: file picker + upload button ── */
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        ref={weightRefs[weight]}
                        type="file"
                        accept=".woff2,.woff"
                        disabled={disabled || isOpBusy}
                        className="min-w-0 flex-1 cursor-pointer text-[11px] text-neutral-600 file:mr-1.5 file:rounded file:border-0 file:bg-neutral-100 file:px-1.5 file:py-0.5 file:text-[10px] file:font-medium file:text-neutral-700 hover:file:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <button
                        type="button"
                        disabled={disabled || isOpBusy || !customName.trim()}
                        onClick={() => handleUpload(weight)}
                        className="flex-shrink-0 rounded border border-brand-300 px-2 py-0.5 text-[10px] text-brand-700 transition-colors hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isUploading ? "Uploading…" : "Upload"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Operation result feedback */}
          {opResult && (
            <div
              className={`rounded border px-2.5 py-1.5 text-[11px] ${
                opResult.ok
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {opResult.message}
            </div>
          )}
        </div>
      )}

      {/* CSS stack text input — always visible */}
      <TokenInput
        label={
          source === "custom"
            ? "CSS font stack (auto-filled on first upload)"
            : "CSS font stack"
        }
        value={value}
        onChange={onChange}
        placeholder={placeholder ?? "— using preset —"}
        hint={fontHint}
        disabled={disabled || (source === "custom" && isOpBusy)}
      />

      {/* Live font preview — shown whenever there is an active font stack */}
      {value.trim() && (
        <div className="mt-2">
          <FontPreview
            fontFamily={value}
            label={value.replace(/^['"]([^'"]+)['"].*/, "$1").trim()}
            size="base"
          />
        </div>
      )}
    </div>
  );
}

// ── Init helpers ───────────────────────────────────────────────────────────────

/**
 * Build the initial TokenFormState from the tenant's current design settings.
 * Every field is initialised from tokenOverrides (grouped format) only.
 */
function buildInitialState(design: TenantDesignSettings): TokenFormState {
  const ov = design.tokenOverrides;
  // Normalize the stored theme key: apply legacy alias map + fallback to
  // "default" when the DB contains a stale / unrecognised value.  This
  // prevents DESIGN_PRESETS[form.theme] from returning undefined.
  const safeTheme = normalizeThemeKey(design.theme);
  return {
    theme: safeTheme,
    // color
    colorPrimary:           ov?.color?.primary           ?? "",
    colorSecondary:         ov?.color?.secondary         ?? "",
    colorAccent:            ov?.color?.accent            ?? "",
    colorBackground:        ov?.color?.background        ?? "",
    colorForeground:        ov?.color?.foreground        ?? "",
    colorMuted:             ov?.color?.muted             ?? "",
    colorMutedForeground:   ov?.color?.mutedForeground   ?? "",
    colorBorder:            ov?.color?.border            ?? "",
    colorRing:              ov?.color?.ring              ?? "",
    colorDestructive:       ov?.color?.destructive       ?? "",
    colorCard:              ov?.color?.card              ?? "",
    colorCardForeground:    ov?.color?.cardForeground    ?? "",
    colorPopover:           ov?.color?.popover           ?? "",
    colorPopoverForeground: ov?.color?.popoverForeground ?? "",
    // typography
    fontSans:       ov?.typography?.fontSans       ?? "",
    fontMono:       ov?.typography?.fontMono       ?? "",
    fontSerif:      ov?.typography?.fontSerif      ?? "",
    baseFontSize:   ov?.typography?.baseFontSize   ?? "",
    lineHeightBase: ov?.typography?.lineHeightBase ?? "",
    // typography — font sources (auto-detected from stack when not explicitly stored)
    fontSansSource:  (ov?.typography?.fontSansSource  as FontSource | undefined)
      ?? (matchFontStack(ov?.typography?.fontSans  ?? "") ? "google" : "system"),
    fontSerifSource: (ov?.typography?.fontSerifSource as FontSource | undefined)
      ?? (matchFontStack(ov?.typography?.fontSerif ?? "") ? "google" : "system"),
    fontMonoSource:  (ov?.typography?.fontMonoSource  as FontSource | undefined)
      ?? (matchFontStack(ov?.typography?.fontMono  ?? "") ? "google" : "system"),
    // typography — usage-role mappings
    fontHeading:       ov?.typography?.fontHeading ?? "",
    fontBody:          ov?.typography?.fontBody    ?? "",
    fontUI:            ov?.typography?.fontUI      ?? "",
    fontCode:          ov?.typography?.fontCode    ?? "",
    fontHeadingSource: (ov?.typography?.fontHeadingSource as FontSource | undefined)
      ?? (matchFontStack(ov?.typography?.fontHeading ?? "") ? "google" : "system"),
    // radius
    radiusInteractive: ov?.radius?.interactive ?? "",
    radiusCard:        ov?.radius?.card        ?? "",
    radiusPopover:     ov?.radius?.popover     ?? "",
    radiusSm:          ov?.radius?.sm          ?? "",
    radiusMd:          ov?.radius?.md          ?? "",
    radiusLg:          ov?.radius?.lg          ?? "",
    radiusFull:        ov?.radius?.full        ?? "",
    // spacing
    spacingBase: ov?.spacing?.base  ?? "",
    spacingXs:   ov?.spacing?.xs   ?? "",
    spacingSm:   ov?.spacing?.sm   ?? "",
    spacingMd:   ov?.spacing?.md   ?? "",
    spacingLg:   ov?.spacing?.lg   ?? "",
    spacingXl:   ov?.spacing?.xl   ?? "",
    spacing2xl:  ov?.spacing?.["2xl"] ?? "",
    // border
    borderWidth:   ov?.border?.width   ?? "",
    borderWidthSm: ov?.border?.widthSm ?? "",
    borderWidthLg: ov?.border?.widthLg ?? "",
    borderColor:   ov?.border?.color   ?? "",
    // shadow
    shadowSm:   ov?.shadow?.sm   ?? "",
    shadowMd:   ov?.shadow?.md   ?? "",
    shadowLg:   ov?.shadow?.lg   ?? "",
    shadowXl:   ov?.shadow?.xl   ?? "",
    shadowNone: ov?.shadow?.none ?? "",
    // motion
    motionDurationFast:  ov?.motion?.durationFast  ?? "",
    motionDurationBase:  ov?.motion?.durationBase  ?? "",
    motionDurationSlow:  ov?.motion?.durationSlow  ?? "",
    motionEasingDefault: ov?.motion?.easingDefault ?? "",
    motionEasingIn:      ov?.motion?.easingIn      ?? "",
    motionEasingOut:     ov?.motion?.easingOut     ?? "",
    motionEasingInOut:   ov?.motion?.easingInOut   ?? "",
    // component
    buttonRadius:   ov?.component?.buttonRadius   ?? "",
    buttonPaddingX: ov?.component?.buttonPaddingX ?? "",
    buttonPaddingY: ov?.component?.buttonPaddingY ?? "",
    cardPadding:    ov?.component?.cardPadding    ?? "",
    cardRadius:     ov?.component?.cardRadius     ?? ov?.radiusCard ?? "",
    inputRadius:    ov?.component?.inputRadius    ?? "",
    inputHeight:    ov?.component?.inputHeight    ?? "",
    badgeRadius:    ov?.component?.badgeRadius    ?? "",
    // layout — header & footer shell
    headerBg:         (ov?.layout as Record<string, string> | undefined)?.headerBg         ?? "",
    headerBgScrolled: (ov?.layout as Record<string, string> | undefined)?.headerBgScrolled ?? "",
    headerFg:         (ov?.layout as Record<string, string> | undefined)?.headerFg         ?? "",
    headerBorder:     (ov?.layout as Record<string, string> | undefined)?.headerBorder     ?? "",
    footerBg:         (ov?.layout as Record<string, string> | undefined)?.footerBg         ?? "",
    footerFg:         (ov?.layout as Record<string, string> | undefined)?.footerFg         ?? "",
    footerBorder:     (ov?.layout as Record<string, string> | undefined)?.footerBorder     ?? "",
  };
}

// ── Main component ─────────────────────────────────────────────────────────────

/**
 * Visual design token editor.
 *
 * Shows all override values currently stored in `tokenOverrides`, allows
 * editing them, and persists changes via `saveVisualTokensAction`.
 *
 * @example
 * <DesignTokenEditor tenantId={tenantId} currentDesign={tenant.design} />
 */
export function DesignTokenEditor({
  tenantId,
  currentDesign,
  customFonts,
  visibleSections,
  hideHeader = false,
}: DesignTokenEditorProps) {
  /** Returns true when a section should be rendered. */
  const show = (s: DesignTokenSection) =>
    !visibleSections || visibleSections.includes(s);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [form, setForm] = useState<TokenFormState>(() => buildInitialState(currentDesign));

  // ── Action state ───────────────────────────────────────────────────────────
  const [isPending, startTransition] = useTransition();
  const [result, setResult]          = useState<SaveVisualTokensResult | null>(null);

  // ── JSON import state ──────────────────────────────────────────────────────
  const [importError,   setImportError]   = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Preset defaults (reactive) ─────────────────────────────────────────────
  // Used as dynamic placeholders so empty fields show the active preset value.
  // getSafeDesignPreset() applies the legacy alias map and falls back to
  // "default" — it NEVER returns undefined, preventing the typography crash.
  const pd = getSafeDesignPreset(form.theme);

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Partial-update helper — updates one or more form fields and clears results. */
  function patch(updates: Partial<TokenFormState>) {
    setForm((prev) => ({ ...prev, ...updates }));
    setResult(null);
  }

  /** Single-field onChange factory for use in TokenInput. */
  function fieldOf(key: keyof TokenFormState): (v: string) => void {
    return (v) => patch({ [key]: v });
  }

  // ── Theme change handler ───────────────────────────────────────────────────

  /**
   * On preset change: load that preset's color, typography, and radius values
   * into the form fields so the user sees the full theme configuration and
   * can make targeted edits before saving.
   *
   * Groups without a direct preset mapping (border, shadow, motion, spacing
   * scale, component padding) are left unchanged.
   */
  function handleThemeChange(newTheme: ThemeKey) {
    // Use getSafeDesignPreset so a stale/invalid key never crashes the handler.
    const preset = getSafeDesignPreset(newTheme);
    patch({
      theme: newTheme,
      // Colors with a direct preset mapping
      colorPrimary:         preset.colors.primary,
      colorSecondary:       preset.colors.primaryHover,
      colorAccent:          preset.colors.primarySubtle,
      colorBackground:      preset.colors.bg,
      colorForeground:      preset.colors.text,
      colorMuted:           preset.colors.bgSubtle,
      colorMutedForeground: preset.colors.textMuted,
      colorBorder:          preset.colors.border,
      colorRing:            preset.colors.ring,
      // Radius
      radiusInteractive:    preset.radius.interactive,
      radiusCard:           preset.radius.card,
      radiusPopover:        preset.radius.popover,
      // Typography
      fontSans:             preset.typography.fontFamilySans,
      baseFontSize:         preset.typography.fontSizeBase,
    });
    setImportError(null);
    setImportSuccess(null);
  }

  // ── JSON import handler ────────────────────────────────────────────────────

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) return;
    fileInputRef.current.value = "";   // reset so the same file can be re-imported
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target?.result as string) as unknown;
        if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
          setImportError("Invalid JSON: expected a token object.");
          setImportSuccess(null);
          return;
        }
        const input = raw as DesignTokenUploadInput;
        const validation = validateDesignTokenUpload(input);
        if (!validation.ok) {
          setImportError(validation.errors.join(" · "));
          setImportSuccess(null);
          return;
        }

        // Merge validated token values into form state.
        const updates: Partial<TokenFormState> = {};

        if (input.theme)       updates.theme = input.theme;
        if (input.color) {
          const c = input.color as Record<string, string>;
          if (c.primary)           updates.colorPrimary           = c.primary;
          if (c.secondary)         updates.colorSecondary         = c.secondary;
          if (c.accent)            updates.colorAccent            = c.accent;
          if (c.background)        updates.colorBackground        = c.background;
          if (c.foreground)        updates.colorForeground        = c.foreground;
          if (c.muted)             updates.colorMuted             = c.muted;
          if (c.mutedForeground)   updates.colorMutedForeground   = c.mutedForeground;
          if (c.border)            updates.colorBorder            = c.border;
          if (c.ring)              updates.colorRing              = c.ring;
          if (c.destructive)       updates.colorDestructive       = c.destructive;
          if (c.card)              updates.colorCard              = c.card;
          if (c.cardForeground)    updates.colorCardForeground    = c.cardForeground;
          if (c.popover)           updates.colorPopover           = c.popover;
          if (c.popoverForeground) updates.colorPopoverForeground = c.popoverForeground;
        }
        if (input.typography) {
          const t = input.typography as Record<string, string>;
          if (t.fontSans)       updates.fontSans       = t.fontSans;
          if (t.fontMono)       updates.fontMono       = t.fontMono;
          if (t.fontSerif)      updates.fontSerif      = t.fontSerif;
          if (t.baseFontSize)   updates.baseFontSize   = t.baseFontSize;
          if (t.lineHeightBase) updates.lineHeightBase = t.lineHeightBase;
          // Font role mappings
          if (t.fontHeading) updates.fontHeading = t.fontHeading;
          if (t.fontBody)    updates.fontBody    = t.fontBody;
          if (t.fontUI)      updates.fontUI      = t.fontUI;
          if (t.fontCode)    updates.fontCode    = t.fontCode;
        }
        if (input.radius) {
          const r = input.radius as Record<string, string>;
          if (r.interactive) updates.radiusInteractive = r.interactive;
          if (r.card)        updates.radiusCard        = r.card;
          if (r.popover)     updates.radiusPopover     = r.popover;
          if (r.sm)          updates.radiusSm          = r.sm;
          if (r.md)          updates.radiusMd          = r.md;
          if (r.lg)          updates.radiusLg          = r.lg;
          if (r.full)        updates.radiusFull        = r.full;
        }
        if (input.spacing) {
          const s = input.spacing as Record<string, string>;
          if (s.base) updates.spacingBase = s.base;
          if (s.xs)   updates.spacingXs   = s.xs;
          if (s.sm)   updates.spacingSm   = s.sm;
          if (s.md)   updates.spacingMd   = s.md;
          if (s.lg)   updates.spacingLg   = s.lg;
          if (s.xl)   updates.spacingXl   = s.xl;
          if (s["2xl"]) updates.spacing2xl = s["2xl"];
        }
        if (input.border) {
          const b = input.border as Record<string, string>;
          if (b.width)   updates.borderWidth   = b.width;
          if (b.widthSm) updates.borderWidthSm = b.widthSm;
          if (b.widthLg) updates.borderWidthLg = b.widthLg;
          if (b.color)   updates.borderColor   = b.color;
        }
        if (input.shadow) {
          const s = input.shadow as Record<string, string>;
          if (s.sm)   updates.shadowSm   = s.sm;
          if (s.md)   updates.shadowMd   = s.md;
          if (s.lg)   updates.shadowLg   = s.lg;
          if (s.xl)   updates.shadowXl   = s.xl;
          if (s.none) updates.shadowNone = s.none;
        }
        if (input.motion) {
          const m = input.motion as Record<string, string>;
          if (m.durationFast)  updates.motionDurationFast  = m.durationFast;
          if (m.durationBase)  updates.motionDurationBase  = m.durationBase;
          if (m.durationSlow)  updates.motionDurationSlow  = m.durationSlow;
          if (m.easingDefault) updates.motionEasingDefault = m.easingDefault;
          if (m.easingIn)      updates.motionEasingIn      = m.easingIn;
          if (m.easingOut)     updates.motionEasingOut     = m.easingOut;
          if (m.easingInOut)   updates.motionEasingInOut   = m.easingInOut;
        }
        if (input.component) {
          const c = input.component as Record<string, string>;
          if (c.buttonRadius)   updates.buttonRadius   = c.buttonRadius;
          if (c.buttonPaddingX) updates.buttonPaddingX = c.buttonPaddingX;
          if (c.buttonPaddingY) updates.buttonPaddingY = c.buttonPaddingY;
          if (c.cardPadding)    updates.cardPadding    = c.cardPadding;
          if (c.cardRadius)     updates.cardRadius     = c.cardRadius;
          if (c.inputRadius)    updates.inputRadius    = c.inputRadius;
          if (c.inputHeight)    updates.inputHeight    = c.inputHeight;
          if (c.badgeRadius)    updates.badgeRadius    = c.badgeRadius;
        }

        patch(updates);
        const fieldCount = Object.keys(updates).length;
        setImportSuccess(`Loaded ${fieldCount} token${fieldCount !== 1 ? "s" : ""} from ${file.name}. Review the values below and click "Save tokens" to apply.`);
        setImportError(null);
      } catch {
        setImportError("Could not parse JSON file. Check that it is valid JSON.");
        setImportSuccess(null);
      }
    };
    reader.readAsText(file);
  }

  // ── Action handlers ────────────────────────────────────────────────────────

  function handleSave() {
    // ── Section-scoped save ──────────────────────────────────────────────────
    //
    // CRITICAL: Only include fields belonging to sections that are rendered in
    // this editor instance.  If every field is always sent, a save from the
    // Typography tab would write the stale `form.theme` captured at page-load,
    // potentially reverting a theme change made via the Style tab (ThemeGallery)
    // without a page reload.  The same applies to color overrides, radius, etc.
    //
    // Rule: a field group is included in the payload only when its corresponding
    // section is visible (show(…) is true).  When `visibleSections` is absent
    // all sections are visible, so all field groups are included (legacy/full-page
    // editor behaviour is preserved).
    setResult(null);
    startTransition(async () => {
      const fields: VisualTokenFields = {
        // ── theme preset — only when the preset section is rendered ───────────
        ...(show("preset") ? { theme: form.theme } : {}),

        // ── color overrides — only when the colors (or preset) section is rendered
        // "preset" includes color because switching a preset loads preset colors
        // into the form; if the user then saves from "preset" mode those become
        // explicit overrides.
        ...(show("colors") || show("preset") ? {
          colorPrimary:           form.colorPrimary,
          colorSecondary:         form.colorSecondary,
          colorAccent:            form.colorAccent,
          colorBackground:        form.colorBackground,
          colorForeground:        form.colorForeground,
          colorMuted:             form.colorMuted,
          colorMutedForeground:   form.colorMutedForeground,
          colorBorder:            form.colorBorder,
          colorRing:              form.colorRing,
          colorDestructive:       form.colorDestructive,
          colorCard:              form.colorCard,
          colorCardForeground:    form.colorCardForeground,
          colorPopover:           form.colorPopover,
          colorPopoverForeground: form.colorPopoverForeground,
        } : {}),

        // ── typography — only when the typography section is rendered ─────────
        ...(show("typography") ? {
          fontSans:        form.fontSans,
          fontMono:        form.fontMono,
          fontSerif:       form.fontSerif,
          baseFontSize:    form.baseFontSize,
          lineHeightBase:  form.lineHeightBase,
          fontSansSource:  form.fontSansSource,
          fontSerifSource: form.fontSerifSource,
          fontMonoSource:  form.fontMonoSource,
          fontHeading:       form.fontHeading,
          fontBody:          form.fontBody,
          fontUI:            form.fontUI,
          fontCode:          form.fontCode,
          fontHeadingSource: form.fontHeadingSource,
        } : {}),

        // ── radius — only when the radius section is rendered ─────────────────
        ...(show("radius") || show("preset") ? {
          radiusInteractive: form.radiusInteractive,
          radiusCard:        form.radiusCard,
          radiusPopover:     form.radiusPopover,
          radiusSm:          form.radiusSm,
          radiusMd:          form.radiusMd,
          radiusLg:          form.radiusLg,
          radiusFull:        form.radiusFull,
        } : {}),

        // ── spacing ────────────────────────────────────────────────────────────
        ...(show("spacing") ? {
          spacingBase: form.spacingBase,
          spacingXs:   form.spacingXs,
          spacingSm:   form.spacingSm,
          spacingMd:   form.spacingMd,
          spacingLg:   form.spacingLg,
          spacingXl:   form.spacingXl,
          spacing2xl:  form.spacing2xl,
        } : {}),

        // ── borders ────────────────────────────────────────────────────────────
        ...(show("borders") ? {
          borderWidth:   form.borderWidth,
          borderWidthSm: form.borderWidthSm,
          borderWidthLg: form.borderWidthLg,
          borderColor:   form.borderColor,
        } : {}),

        // ── shadows ────────────────────────────────────────────────────────────
        ...(show("shadows") ? {
          shadowSm:   form.shadowSm,
          shadowMd:   form.shadowMd,
          shadowLg:   form.shadowLg,
          shadowXl:   form.shadowXl,
          shadowNone: form.shadowNone,
        } : {}),

        // ── motion ─────────────────────────────────────────────────────────────
        ...(show("motion") ? {
          motionDurationFast:  form.motionDurationFast,
          motionDurationBase:  form.motionDurationBase,
          motionDurationSlow:  form.motionDurationSlow,
          motionEasingDefault: form.motionEasingDefault,
          motionEasingIn:      form.motionEasingIn,
          motionEasingOut:     form.motionEasingOut,
          motionEasingInOut:   form.motionEasingInOut,
        } : {}),

        // ── components ─────────────────────────────────────────────────────────
        ...(show("components") ? {
          buttonRadius:   form.buttonRadius,
          buttonPaddingX: form.buttonPaddingX,
          buttonPaddingY: form.buttonPaddingY,
          cardPadding:    form.cardPadding,
          cardRadius:     form.cardRadius,
          inputRadius:    form.inputRadius,
          inputHeight:    form.inputHeight,
          badgeRadius:    form.badgeRadius,
        } : {}),

        // ── layout (header / footer color tokens) ──────────────────────────────
        // Layout color fields live alongside the colors section in the UI.
        ...(show("colors") ? {
          headerBg:         form.headerBg,
          headerBgScrolled: form.headerBgScrolled,
          headerFg:         form.headerFg,
          headerBorder:     form.headerBorder,
          footerBg:         form.footerBg,
          footerFg:         form.footerFg,
          footerBorder:     form.footerBorder,
        } : {}),
      };
      const r = await saveVisualTokensAction(tenantId, fields);
      setResult(r);
    });
  }

  /** Clears all override fields (keeps current theme). */
  function handleClearAll() {
    setForm((prev) => ({
      ...buildInitialState({ theme: prev.theme }),
      theme: prev.theme,
    }));
    setResult(null);
    setImportError(null);
    setImportSuccess(null);
  }

  // ── Computed indicators ────────────────────────────────────────────────────

  const allOverrideFields: string[] = [
    form.colorPrimary, form.colorSecondary, form.colorAccent,
    form.colorBackground, form.colorForeground, form.colorMuted,
    form.colorMutedForeground, form.colorBorder, form.colorRing,
    form.colorDestructive, form.colorCard, form.colorCardForeground,
    form.colorPopover, form.colorPopoverForeground,
    form.fontSans, form.fontMono, form.fontSerif, form.baseFontSize, form.lineHeightBase,
    form.fontHeading, form.fontBody, form.fontUI, form.fontCode,
    form.radiusInteractive, form.radiusCard, form.radiusPopover,
    form.radiusSm, form.radiusMd, form.radiusLg, form.radiusFull,
    form.spacingBase, form.spacingXs, form.spacingSm,
    form.spacingMd, form.spacingLg, form.spacingXl, form.spacing2xl,
    form.borderWidth, form.borderWidthSm, form.borderWidthLg, form.borderColor,
    form.shadowSm, form.shadowMd, form.shadowLg, form.shadowXl, form.shadowNone,
    form.motionDurationFast, form.motionDurationBase, form.motionDurationSlow,
    form.motionEasingDefault, form.motionEasingIn, form.motionEasingOut, form.motionEasingInOut,
    form.buttonRadius, form.buttonPaddingX, form.buttonPaddingY,
    form.cardPadding, form.cardRadius, form.inputRadius, form.inputHeight, form.badgeRadius,
    form.headerBg, form.headerBgScrolled, form.headerFg, form.headerBorder,
    form.footerBg, form.footerFg, form.footerBorder,
  ];
  const activeOverrideCount = allOverrideFields.filter((v) => v.trim() !== "").length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Card padding="md" shadow="sm" className="mb-6">

      {/* ── Panel header ──────────────────────────────────────────────────── */}
      {!hideHeader && <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Visual token editor
            </p>
            {activeOverrideCount > 0 && (
              <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-medium leading-none text-brand-700">
                {activeOverrideCount} override{activeOverrideCount !== 1 ? "s" : ""} active
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-neutral-500">
            Override individual design tokens. Leave a field empty to use the theme preset default.
            Clear a field with ✕ to remove an existing override.
          </p>
        </div>

        {activeOverrideCount > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            disabled={isPending}
            className="flex-shrink-0 rounded border border-neutral-200 px-2.5 py-1 text-xs text-neutral-500 transition-colors hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-700 disabled:opacity-50"
          >
            Clear all overrides
          </button>
        )}
      </div>}

      <CardContent>
        <div className="space-y-8">

          {/* ── Theme preset ──────────────────────────────────────────────── */}
          {show("preset") && <div>
            <SectionHeader
              title="Theme preset"
              description="Base visual personality. Selecting a preset loads its color, radius, and typography values into the fields below for you to review and adjust."
            />
            <div>
              <label className={labelCls}>Preset</label>
              <select
                value={form.theme}
                disabled={isPending}
                onChange={(e) => handleThemeChange(e.target.value as ThemeKey)}
                className={inputCls}
              >
                {(["Platform", "Corporate", "Marketing", "Specialist"] as const).map((group) => {
                  const opts = THEME_OPTIONS.filter((o) => o.group === group);
                  if (opts.length === 0) return null;
                  return (
                    <optgroup key={group} label={`── ${group} ──`}>
                      {opts.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label} — {opt.description}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
              <p className={hintCls}>
                Changing the preset loads that preset&apos;s values into the fields below.
                Adjust any token and click &quot;Save tokens&quot; to persist.
              </p>
            </div>
          </div>}

          {/* ── Colors ────────────────────────────────────────────────────── */}
          {show("colors") && <div>
            <SectionHeader
              title="Colors"
              description="Any valid CSS color: hex (#e63946), hsl(354 73% 56%), oklch(0.55 0.2 27), named colors."
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TokenInput
                label="Primary"
                value={form.colorPrimary}
                onChange={fieldOf("colorPrimary")}
                placeholder={`${pd.colors.primary}  — preset`}
                hint="Main brand color — buttons, links, focus rings, active states."
                showSwatch
                disabled={isPending}
              />
              <TokenInput
                label="Secondary"
                value={form.colorSecondary}
                onChange={fieldOf("colorSecondary")}
                placeholder={`${pd.colors.primaryHover}  — preset`}
                hint="Supporting accent — secondary actions and hover states."
                showSwatch
                disabled={isPending}
              />
              <TokenInput
                label="Accent"
                value={form.colorAccent}
                onChange={fieldOf("colorAccent")}
                placeholder={`${pd.colors.primarySubtle}  — preset`}
                hint="Subtle tinted background behind primary elements."
                showSwatch
                disabled={isPending}
              />
              <TokenInput
                label="Background"
                value={form.colorBackground}
                onChange={fieldOf("colorBackground")}
                placeholder={`${pd.colors.bg}  — preset`}
                hint="Page / root background color."
                showSwatch
                disabled={isPending}
              />
              <TokenInput
                label="Foreground"
                value={form.colorForeground}
                onChange={fieldOf("colorForeground")}
                placeholder={`${pd.colors.text}  — preset`}
                hint="Default body text color on the background."
                showSwatch
                disabled={isPending}
              />
              <TokenInput
                label="Muted"
                value={form.colorMuted}
                onChange={fieldOf("colorMuted")}
                placeholder={`${pd.colors.bgSubtle}  — preset`}
                hint="Recessed surfaces — sidebars, alternate rows, subtle cards."
                showSwatch
                disabled={isPending}
              />
              <TokenInput
                label="Muted foreground"
                value={form.colorMutedForeground}
                onChange={fieldOf("colorMutedForeground")}
                placeholder={`${pd.colors.textMuted}  — preset`}
                hint="Secondary / descriptive text on muted backgrounds."
                showSwatch
                disabled={isPending}
              />
              <TokenInput
                label="Border"
                value={form.colorBorder}
                onChange={fieldOf("colorBorder")}
                placeholder={`${pd.colors.border}  — preset`}
                hint="Default dividers and input borders."
                showSwatch
                disabled={isPending}
              />
              <TokenInput
                label="Ring"
                value={form.colorRing}
                onChange={fieldOf("colorRing")}
                placeholder={`${pd.colors.ring}  — preset`}
                hint="Keyboard focus ring — must meet contrast requirements."
                showSwatch
                disabled={isPending}
              />
              <TokenInput
                label="Destructive"
                value={form.colorDestructive}
                onChange={fieldOf("colorDestructive")}
                placeholder="hsl(0 72% 51%)  — preset"
                hint="Error and destructive action color."
                showSwatch
                disabled={isPending}
              />
              <TokenInput
                label="Card"
                value={form.colorCard}
                onChange={fieldOf("colorCard")}
                placeholder="— using preset —"
                hint="Card / panel surface background."
                showSwatch
                disabled={isPending}
              />
              <TokenInput
                label="Card foreground"
                value={form.colorCardForeground}
                onChange={fieldOf("colorCardForeground")}
                placeholder="— using preset —"
                hint="Text color on card backgrounds."
                showSwatch
                disabled={isPending}
              />
              <TokenInput
                label="Popover"
                value={form.colorPopover}
                onChange={fieldOf("colorPopover")}
                placeholder="— using preset —"
                hint="Dropdown, tooltip, and popover surface background."
                showSwatch
                disabled={isPending}
              />
              <TokenInput
                label="Popover foreground"
                value={form.colorPopoverForeground}
                onChange={fieldOf("colorPopoverForeground")}
                placeholder="— using preset —"
                hint="Text color inside popovers and tooltips."
                showSwatch
                disabled={isPending}
              />
            </div>
          </div>}

          {/* ── Typography ────────────────────────────────────────────────── */}
          {show("typography") && <div>
            <SectionHeader
              title="Typography"
              description="Font source and stack per semantic role. Choose System, Google Font (pre-loaded), or Custom (uploaded woff2/woff)."
            />

            {/* ── Per-role font editors ──────────────────────────────────── */}
            <div className="space-y-4">
              <FontRoleEditor
                label="Font sans — body & UI text"
                role="sans"
                source={form.fontSansSource}
                value={form.fontSans}
                tenantId={tenantId}
                customFontFace={customFonts?.sans}
                fonts={SANS_SERIF_FONTS}
                placeholder={`${pd.typography.fontFamilySans}  — preset`}
                fontHint="CSS stack for body text, labels, navigation, and UI elements."
                onSourceChange={(src) => patch({ fontSansSource: src })}
                onChange={(stack) => patch({ fontSans: stack })}
                disabled={isPending}
              />

              <FontRoleEditor
                label="Font serif — editorial & display"
                role="serif"
                source={form.fontSerifSource}
                value={form.fontSerif}
                tenantId={tenantId}
                customFontFace={customFonts?.serif}
                fonts={SERIF_FONTS}
                placeholder="'Merriweather', 'Georgia', serif  — preset"
                fontHint="CSS stack for editorial content, pull quotes, and display headings."
                onSourceChange={(src) => patch({ fontSerifSource: src })}
                onChange={(stack) => patch({ fontSerif: stack })}
                disabled={isPending}
              />

              <FontRoleEditor
                label="Font mono — code & pre"
                role="mono"
                source={form.fontMonoSource}
                value={form.fontMono}
                tenantId={tenantId}
                customFontFace={customFonts?.mono}
                fonts={MONOSPACE_FONTS}
                placeholder="'JetBrains Mono', 'Fira Code', monospace  — preset"
                fontHint="CSS stack for code blocks, technical content, and monospaced text."
                onSourceChange={(src) => patch({ fontMonoSource: src })}
                onChange={(stack) => patch({ fontMono: stack })}
                disabled={isPending}
              />
            </div>

            {/* ── Font role mapping ───────────────────────────────────── */}
            <div className="mt-6">
              <div className="mb-3 border-b border-neutral-100 pb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Font role mapping</p>
                <p className="mt-0.5 text-[10px] text-neutral-400">
                  Map each usage role to a font stack. Quick-set buttons copy from a base family above;
                  or type a custom stack. Leave empty to inherit the default (heading → sans, body → sans, UI → sans, code → mono).
                </p>
              </div>

              {/* Heading role — full FontRoleEditor since it's the most commonly customised */}
              <div className="mb-4">
                <FontRoleEditor
                  label="Heading font — h1, h2, h3"
                  role="serif"
                  source={form.fontHeadingSource}
                  value={form.fontHeading}
                  tenantId={tenantId}
                  customFontFace={undefined}
                  fonts={[...SERIF_FONTS, ...DISPLAY_FONTS]}
                  placeholder={form.fontSans || `${pd.typography.fontFamilySans}  — inherits sans`}
                  fontHint="Font used for h1–h3. Default: inherits the sans-serif stack."
                  onSourceChange={(src) => patch({ fontHeadingSource: src })}
                  onChange={(stack) => patch({ fontHeading: stack })}
                  disabled={isPending}
                />
                {/* Quick-set shortcuts */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] text-neutral-400">Quick set:</span>
                  {[
                    { label: "← Same as sans",  value: form.fontSans  || "" },
                    { label: "← Same as serif", value: form.fontSerif || "" },
                    { label: "← Same as mono",  value: form.fontMono  || "" },
                  ].map(({ label, value }) => (
                    <button
                      key={label}
                      type="button"
                      disabled={isPending || !value}
                      onClick={() => patch({ fontHeading: value })}
                      title={value || "Set the base font above first"}
                      className="rounded border border-neutral-200 px-2 py-0.5 text-[11px] text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {label}
                    </button>
                  ))}
                  {form.fontHeading && (
                    <button
                      type="button"
                      onClick={() => patch({ fontHeading: "" })}
                      disabled={isPending}
                      className="rounded border border-neutral-200 px-2 py-0.5 text-[11px] text-neutral-400 transition-colors hover:border-neutral-300 hover:text-neutral-600"
                    >
                      ✕ clear
                    </button>
                  )}
                </div>
              </div>

              {/* Body / UI / Code — simpler rows with quick-set buttons */}
              <div className="space-y-3">
                {(
                  [
                    {
                      key:         "fontBody" as const,
                      label:       "Body font",
                      description: "p, li, blockquote — default: inherits sans.",
                    },
                    {
                      key:         "fontUI" as const,
                      label:       "UI font",
                      description: "button, label, nav, input — default: inherits sans.",
                    },
                    {
                      key:         "fontCode" as const,
                      label:       "Code font",
                      description: "code, pre, kbd — default: inherits mono.",
                    },
                  ] as const
                ).map(({ key, label, description }) => (
                  <div key={key} className="rounded-md border border-neutral-100 bg-neutral-50 p-3">
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                      {label}
                    </p>
                    <p className="mb-2 text-[10px] text-neutral-400">{description}</p>
                    {/* Quick-set shortcuts */}
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-neutral-400">Quick set:</span>
                      {[
                        { label: "Sans",  value: form.fontSans  || "" },
                        { label: "Serif", value: form.fontSerif || "" },
                        { label: "Mono",  value: form.fontMono  || "" },
                      ].map(({ label: btnLabel, value }) => {
                        const isActive = !!value && form[key] === value;
                        return (
                          <button
                            key={btnLabel}
                            type="button"
                            disabled={isPending || !value}
                            onClick={() => patch({ [key]: value })}
                            title={value || "Set the base font above first"}
                            className={[
                              "rounded border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                              "disabled:cursor-not-allowed disabled:opacity-40",
                              isActive
                                ? "border-brand-400 bg-brand-50 text-brand-700"
                                : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50",
                            ].join(" ")}
                          >
                            {btnLabel}
                          </button>
                        );
                      })}
                    </div>
                    <TokenInput
                      label="CSS font stack (optional override)"
                      value={form[key]}
                      onChange={fieldOf(key)}
                      placeholder="— inheriting default —"
                      hint="Leave empty to use the default. Enter a custom stack or click a button above."
                      disabled={isPending}
                    />
                    {/* Live preview for this role — shows when a stack is set */}
                    {form[key].trim() && (
                      <div className="mt-2">
                        <FontPreview
                          fontFamily={form[key]}
                          label={form[key].replace(/^['"]([^'"]+)['"].*/, "$1").trim()}
                          size="base"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Base sizing ────────────────────────────────────────────── */}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TokenInput
                label="Base font size"
                value={form.baseFontSize}
                onChange={fieldOf("baseFontSize")}
                placeholder={`${pd.typography.fontSizeBase}  — preset`}
                hint="Root font size. Affects all relative sizes. Accepts px, rem, em."
                disabled={isPending}
              />
              <TokenInput
                label="Line height base"
                value={form.lineHeightBase}
                onChange={fieldOf("lineHeightBase")}
                placeholder="1.5  — preset"
                hint="Default body line height. Unitless recommended (e.g. 1.5)."
                disabled={isPending}
              />
            </div>
          </div>}

          {/* ── Radius ────────────────────────────────────────────────────── */}
          {show("radius") && <div>
            <SectionHeader
              title="Border radius"
              description="Roundness scale. Accepts px, rem, em, or %. Sharp: 0 / 2px. Balanced: 6px. Soft: 12px. Pill: 9999px."
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TokenInput
                label="Interactive (buttons, inputs)"
                value={form.radiusInteractive}
                onChange={fieldOf("radiusInteractive")}
                placeholder={`${pd.radius.interactive}  — preset`}
                hint="Radius for buttons, inputs, badges, and chips."
                disabled={isPending}
              />
              <TokenInput
                label="Card (panels, dialogs)"
                value={form.radiusCard}
                onChange={fieldOf("radiusCard")}
                placeholder={`${pd.radius.card}  — preset`}
                hint="Radius for cards, panels, modals, and sheets."
                disabled={isPending}
              />
              <TokenInput
                label="Popover (menus, tooltips)"
                value={form.radiusPopover}
                onChange={fieldOf("radiusPopover")}
                placeholder={`${pd.radius.popover}  — preset`}
                hint="Radius for dropdowns, tooltips, and context menus."
                disabled={isPending}
              />
              <TokenInput
                label="Radius sm"
                value={form.radiusSm}
                onChange={fieldOf("radiusSm")}
                placeholder="2px  — preset"
                hint="Smallest radius step — tight UI elements."
                disabled={isPending}
              />
              <TokenInput
                label="Radius md"
                value={form.radiusMd}
                onChange={fieldOf("radiusMd")}
                placeholder="6px  — preset"
                hint="Medium radius step."
                disabled={isPending}
              />
              <TokenInput
                label="Radius lg"
                value={form.radiusLg}
                onChange={fieldOf("radiusLg")}
                placeholder="12px  — preset"
                hint="Large radius step."
                disabled={isPending}
              />
              <TokenInput
                label="Radius full (pill)"
                value={form.radiusFull}
                onChange={fieldOf("radiusFull")}
                placeholder="9999px  — preset"
                hint="Full / pill radius — toggles, tags, pill buttons."
                disabled={isPending}
              />
            </div>
          </div>}

          {/* ── Spacing ───────────────────────────────────────────────────── */}
          {show("spacing") && <div>
            <SectionHeader
              title="Spacing scale"
              description="Named spacing steps used across margins, gaps, and padding. Accepts px, rem, em."
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <TokenInput label="Base"  value={form.spacingBase} onChange={fieldOf("spacingBase")} placeholder="4px  — preset"  hint="1× spacing unit." disabled={isPending} />
              <TokenInput label="XS"    value={form.spacingXs}   onChange={fieldOf("spacingXs")}   placeholder="8px  — preset"  hint="Extra-small step." disabled={isPending} />
              <TokenInput label="SM"    value={form.spacingSm}   onChange={fieldOf("spacingSm")}   placeholder="12px  — preset" hint="Small step." disabled={isPending} />
              <TokenInput label="MD"    value={form.spacingMd}   onChange={fieldOf("spacingMd")}   placeholder="16px  — preset" hint="Medium — most common gap." disabled={isPending} />
              <TokenInput label="LG"    value={form.spacingLg}   onChange={fieldOf("spacingLg")}   placeholder="24px  — preset" hint="Large — section gaps." disabled={isPending} />
              <TokenInput label="XL"    value={form.spacingXl}   onChange={fieldOf("spacingXl")}   placeholder="32px  — preset" hint="Extra-large — hero spacing." disabled={isPending} />
              <TokenInput label="2XL"   value={form.spacing2xl}  onChange={fieldOf("spacing2xl")}  placeholder="48px  — preset" hint="Double extra-large." disabled={isPending} />
            </div>
          </div>}

          {/* ── Borders ───────────────────────────────────────────────────── */}
          {show("borders") && <div>
            <SectionHeader
              title="Borders"
              description="Border widths and color. Width accepts px or em."
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TokenInput
                label="Border width (default)"
                value={form.borderWidth}
                onChange={fieldOf("borderWidth")}
                placeholder="1px  — preset"
                hint="Default border width for inputs, dividers."
                disabled={isPending}
              />
              <TokenInput
                label="Border width sm"
                value={form.borderWidthSm}
                onChange={fieldOf("borderWidthSm")}
                placeholder="0.5px  — preset"
                hint="Thin border variant."
                disabled={isPending}
              />
              <TokenInput
                label="Border width lg"
                value={form.borderWidthLg}
                onChange={fieldOf("borderWidthLg")}
                placeholder="2px  — preset"
                hint="Thick border for emphasis elements."
                disabled={isPending}
              />
              <TokenInput
                label="Border color"
                value={form.borderColor}
                onChange={fieldOf("borderColor")}
                placeholder="— using preset —"
                hint="Default border color (overrides the color.border token)."
                showSwatch
                disabled={isPending}
              />
            </div>
          </div>}

          {/* ── Shadows ───────────────────────────────────────────────────── */}
          {show("shadows") && <div>
            <SectionHeader
              title="Shadows"
              description="Box-shadow values. Use standard CSS box-shadow syntax."
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TokenInput label="Shadow sm"   value={form.shadowSm}   onChange={fieldOf("shadowSm")}   placeholder="0 1px 2px rgb(0 0 0 / .05)  — preset"             hint="Subtle lift — buttons, input focus." disabled={isPending} />
              <TokenInput label="Shadow md"   value={form.shadowMd}   onChange={fieldOf("shadowMd")}   placeholder="0 4px 6px -1px rgb(0 0 0 / .1)  — preset"        hint="Card and panel elevation." disabled={isPending} />
              <TokenInput label="Shadow lg"   value={form.shadowLg}   onChange={fieldOf("shadowLg")}   placeholder="0 10px 15px -3px rgb(0 0 0 / .1)  — preset"       hint="Modals and floating elements." disabled={isPending} />
              <TokenInput label="Shadow xl"   value={form.shadowXl}   onChange={fieldOf("shadowXl")}   placeholder="0 20px 25px -5px rgb(0 0 0 / .1)  — preset"       hint="Large dialogs and drawers." disabled={isPending} />
              <TokenInput label="Shadow none" value={form.shadowNone} onChange={fieldOf("shadowNone")} placeholder="none  — preset"                                    hint="Explicit no-shadow override." disabled={isPending} />
            </div>
          </div>}

          {/* ── Motion ────────────────────────────────────────────────────── */}
          {show("motion") && <div>
            <SectionHeader
              title="Motion"
              description="Animation durations (ms or s) and easing curves (CSS cubic-bezier or keyword)."
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TokenInput label="Duration fast"     value={form.motionDurationFast}  onChange={fieldOf("motionDurationFast")}  placeholder="100ms  — preset"                        hint="Micro-interactions — tooltips, indicators." disabled={isPending} />
              <TokenInput label="Duration base"     value={form.motionDurationBase}  onChange={fieldOf("motionDurationBase")}  placeholder="200ms  — preset"                        hint="Standard transitions — buttons, tabs." disabled={isPending} />
              <TokenInput label="Duration slow"     value={form.motionDurationSlow}  onChange={fieldOf("motionDurationSlow")}  placeholder="400ms  — preset"                        hint="Panel and modal transitions." disabled={isPending} />
              <TokenInput label="Easing default"    value={form.motionEasingDefault} onChange={fieldOf("motionEasingDefault")} placeholder="cubic-bezier(0.4, 0, 0.2, 1)  — preset" hint="General purpose easing." disabled={isPending} />
              <TokenInput label="Easing in"         value={form.motionEasingIn}      onChange={fieldOf("motionEasingIn")}      placeholder="cubic-bezier(0.4, 0, 1, 1)  — preset"   hint="Elements entering the screen." disabled={isPending} />
              <TokenInput label="Easing out"        value={form.motionEasingOut}     onChange={fieldOf("motionEasingOut")}     placeholder="cubic-bezier(0, 0, 0.2, 1)  — preset"   hint="Elements leaving the screen." disabled={isPending} />
              <TokenInput label="Easing in-out"     value={form.motionEasingInOut}   onChange={fieldOf("motionEasingInOut")}   placeholder="cubic-bezier(0.4, 0, 0.2, 1)  — preset" hint="Symmetric enter/exit transitions." disabled={isPending} />
            </div>
          </div>}

          {/* ── Components ────────────────────────────────────────────────── */}
          {show("components") && <div>
            <SectionHeader
              title="Components"
              description="Component-level geometry overrides. Accepts px, rem, em, %."
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TokenInput label="Button radius"    value={form.buttonRadius}   onChange={fieldOf("buttonRadius")}   placeholder={`${pd.radius.interactive}  — preset`} hint="Radius for all button variants."               disabled={isPending} />
              <TokenInput label="Button padding X" value={form.buttonPaddingX} onChange={fieldOf("buttonPaddingX")} placeholder="1rem  — preset"                       hint="Horizontal padding inside buttons."             disabled={isPending} />
              <TokenInput label="Button padding Y" value={form.buttonPaddingY} onChange={fieldOf("buttonPaddingY")} placeholder="0.5rem  — preset"                     hint="Vertical padding inside buttons."               disabled={isPending} />
              <TokenInput label="Card padding"     value={form.cardPadding}    onChange={fieldOf("cardPadding")}    placeholder="1.5rem  — preset"                     hint="Default inner padding for card components."     disabled={isPending} />
              <TokenInput label="Card radius"      value={form.cardRadius}     onChange={fieldOf("cardRadius")}     placeholder={`${pd.radius.card}  — preset`}        hint="Radius for cards, panels, modals."             disabled={isPending} />
              <TokenInput label="Input radius"     value={form.inputRadius}    onChange={fieldOf("inputRadius")}    placeholder={`${pd.radius.interactive}  — preset`} hint="Radius for form inputs and text areas."         disabled={isPending} />
              <TokenInput label="Input height"     value={form.inputHeight}    onChange={fieldOf("inputHeight")}    placeholder="2.5rem  — preset"                     hint="Fixed height for single-line text inputs."      disabled={isPending} />
              <TokenInput label="Badge radius"     value={form.badgeRadius}    onChange={fieldOf("badgeRadius")}    placeholder="9999px  — preset"                     hint="Radius for badge and chip components."          disabled={isPending} />
            </div>
          </div>}

          {/* ── Header & Footer ───────────────────────────────────────────── */}
          {show("components") && <div>
            <SectionHeader
              title="Header & Footer"
              description="Background and foreground colours for the site header and footer. Accepts any CSS color value including rgba() for transparency."
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TokenInput
                label="Header background (default)"
                value={form.headerBg}
                onChange={fieldOf("headerBg")}
                placeholder="rgba(255,255,255,0.95)  — preset"
                hint="Header background at the top of the page. Set to 'transparent' for an overlay header over a hero image."
                showSwatch
                disabled={isPending}
              />
              <TokenInput
                label="Header background (scrolled)"
                value={form.headerBgScrolled}
                onChange={fieldOf("headerBgScrolled")}
                placeholder="rgba(255,255,255,0.95)  — preset"
                hint="Header background after the user scrolls past 24 px. Usually semi-opaque white for readability."
                showSwatch
                disabled={isPending}
              />
              <TokenInput
                label="Header foreground"
                value={form.headerFg}
                onChange={fieldOf("headerFg")}
                placeholder="— uses --text —"
                hint="Text and icon colour inside the header."
                showSwatch
                disabled={isPending}
              />
              <TokenInput
                label="Header border"
                value={form.headerBorder}
                onChange={fieldOf("headerBorder")}
                placeholder="— uses --border —"
                hint="Bottom border colour of the header."
                showSwatch
                disabled={isPending}
              />
              <TokenInput
                label="Footer background"
                value={form.footerBg}
                onChange={fieldOf("footerBg")}
                placeholder="— uses --bg-subtle —"
                hint="Footer section background colour."
                showSwatch
                disabled={isPending}
              />
              <TokenInput
                label="Footer foreground"
                value={form.footerFg}
                onChange={fieldOf("footerFg")}
                placeholder="— uses --text-muted —"
                hint="Text and icon colour inside the footer."
                showSwatch
                disabled={isPending}
              />
              <TokenInput
                label="Footer border"
                value={form.footerBorder}
                onChange={fieldOf("footerBorder")}
                placeholder="— uses --border —"
                hint="Top border colour of the footer."
                showSwatch
                disabled={isPending}
              />
            </div>
          </div>}

          {/* ── JSON import ───────────────────────────────────────────────── */}
          {show("json") && <div>
            <SectionHeader
              title="Import from JSON"
              description="Load token values from a design-token JSON file. Values are loaded into the fields above for review — nothing is saved until you click 'Save tokens'."
            />
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportFile}
                  disabled={isPending}
                  className="block w-full cursor-pointer rounded border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-600 file:mr-2 file:rounded file:border-0 file:bg-neutral-100 file:px-2 file:py-0.5 file:text-xs file:font-medium file:text-neutral-700 hover:file:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <p className={hintCls}>
                  Accepts both legacy flat format and the grouped JSON format.
                  All groups are optional — only present keys are loaded.
                </p>
              </div>
            </div>

            {importSuccess && (
              <div className="mt-2 rounded border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
                ✓ {importSuccess}
              </div>
            )}
            {importError && (
              <div className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                ✗ {importError}
              </div>
            )}
          </div>}

        </div>

        {/* ── Save result feedback ─────────────────────────────────────────── */}
        {result && (
          <div
            className={`mt-5 rounded-md border px-3 py-2.5 text-xs ${
              result.ok
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {result.ok ? (
              <>
                <p className="font-semibold">✓ Design tokens saved</p>
                {result.warnings.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-amber-700">
                    {result.warnings.map((w, i) => (
                      <li key={i}>⚠ {w}</li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <>
                <p className="font-semibold">✗ Could not save tokens</p>
                <ul className="mt-1 space-y-0.5">
                  {result.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[10px] text-neutral-400">
            These overrides layer on top of the active preset.
            Empty fields use the preset default — clear a field to remove a manual override.
          </p>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="flex-shrink-0 rounded-md bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            {isPending ? "Saving…" : "Save tokens"}
          </button>
        </div>

      </CardContent>
    </Card>
  );
}
