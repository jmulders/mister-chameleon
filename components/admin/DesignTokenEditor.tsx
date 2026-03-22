/**
 * DesignTokenEditor
 *
 * Visual design token editor for the admin tenant detail page.
 * Lets operators adjust the most important CSS design tokens without
 * uploading a JSON file — practical controls for colours, typography,
 * component geometry, and spacing.
 *
 * ─── What it manages ──────────────────────────────────────────────────────────
 *
 *   Theme preset    — controls the base personality that all tokens derive from
 *   Colors          — primary, secondary, background, foreground
 *   Typography      — fontSans, baseFontSize
 *   Components      — buttonRadius, cardRadius, cardPadding
 *   Spacing         — md, lg, xl
 *
 * ─── Relationship to JSON upload ──────────────────────────────────────────────
 *
 *   Both this editor and the JSON upload panel write into the same
 *   TenantDesignSettings.tokenOverrides model.  They are additive and
 *   compatible: the editor only touches the specific group keys it manages;
 *   all other overrides (border, shadow, motion, radius, etc.) set via JSON
 *   upload are left intact when this form is saved.
 *
 * ─── Clear / reset semantics ──────────────────────────────────────────────────
 *
 *   An empty input (or clicking ✕) sends an empty string "" to the action,
 *   which removes that key from the override group — the token reverts to the
 *   value provided by the active theme preset.  "Clear all overrides" empties
 *   every field managed by this editor at once.
 *
 * ─── Current value display ────────────────────────────────────────────────────
 *
 *   Inputs are initialised from tokenOverrides (grouped format).  When no
 *   grouped override is stored the input is empty and the placeholder
 *   communicates "using preset".  Legacy flat fields (primaryColor, primaryFont)
 *   set via the main settings form are intentionally NOT shown here — they live
 *   in a different part of the cascade and are managed by TenantSettingsForm.
 *   A tip at the bottom explains this split.
 */

"use client";

import React, { useState, useTransition }         from "react";
import { Card, CardContent }                       from "@/components/ui/Card";
import { saveVisualTokensAction }                  from "@/app/admin/tenants/[tenantId]/actions";
import type {
  SaveVisualTokensResult,
  VisualTokenFields,
} from "@/app/admin/tenants/[tenantId]/actions";
import type { TenantDesignSettings, ThemeKey } from "@/tenant";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DesignTokenEditorProps {
  tenantId:      string;
  currentDesign: TenantDesignSettings;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const THEME_OPTIONS: ReadonlyArray<{
  value:       ThemeKey;
  label:       string;
  description: string;
}> = [
  { value: "default", label: "Default", description: "Indigo-violet palette, balanced radius — platform standard" },
  { value: "minimal", label: "Minimal", description: "Neutral palette, sharp radius — reduced visual weight"     },
  { value: "bold",    label: "Bold",    description: "High-contrast, expressive brand colour, soft radius"       },
  { value: "custom",  label: "Custom",  description: "Fully bespoke — configure all tokens via overrides below"  },
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
}: DesignTokenEditorProps) {
  const ov = currentDesign.tokenOverrides;

  // ── Form state ─────────────────────────────────────────────────────────────
  // Each field is initialised from the current grouped tokenOverrides only.
  // Legacy flat fields (primaryColor, primaryFont) live in TenantSettingsForm
  // and are intentionally excluded here to avoid confusing the two pathways.

  const [theme,           setTheme]           = useState<ThemeKey>(currentDesign.theme);
  // color group
  const [colorPrimary,    setColorPrimary]    = useState(ov?.color?.primary    ?? "");
  const [colorSecondary,  setColorSecondary]  = useState(ov?.color?.secondary  ?? "");
  const [colorBackground, setColorBackground] = useState(ov?.color?.background ?? "");
  const [colorForeground, setColorForeground] = useState(ov?.color?.foreground ?? "");
  // typography group
  const [fontSans,        setFontSans]        = useState(ov?.typography?.fontSans     ?? "");
  const [baseFontSize,    setBaseFontSize]    = useState(ov?.typography?.baseFontSize ?? "");
  // component group
  const [buttonRadius,    setButtonRadius]    = useState(ov?.component?.buttonRadius ?? "");
  const [cardRadius,      setCardRadius]      = useState(ov?.component?.cardRadius   ?? ov?.radiusCard ?? "");
  const [cardPadding,     setCardPadding]     = useState(ov?.component?.cardPadding  ?? "");
  // spacing group
  const [spacingMd,       setSpacingMd]       = useState(ov?.spacing?.md ?? "");
  const [spacingLg,       setSpacingLg]       = useState(ov?.spacing?.lg ?? "");
  const [spacingXl,       setSpacingXl]       = useState(ov?.spacing?.xl ?? "");

  // ── Action state ───────────────────────────────────────────────────────────
  const [isPending, startTransition] = useTransition();
  const [result, setResult]          = useState<SaveVisualTokensResult | null>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Wraps a state setter to clear the result banner on any change. */
  function field<T>(setter: React.Dispatch<React.SetStateAction<T>>) {
    return (v: T) => { setter(v); setResult(null); };
  }

  // ── Action handlers ────────────────────────────────────────────────────────

  function handleSave() {
    setResult(null);
    startTransition(async () => {
      const fields: VisualTokenFields = {
        theme,
        colorPrimary,    colorSecondary,
        colorBackground, colorForeground,
        fontSans,        baseFontSize,
        buttonRadius,    cardRadius,    cardPadding,
        spacingMd,       spacingLg,     spacingXl,
      };
      const r = await saveVisualTokensAction(tenantId, fields);
      setResult(r);
    });
  }

  /** Clears all fields managed by this editor (resets to preset defaults). */
  function handleClearAll() {
    // Reset color group
    setColorPrimary("");    setColorSecondary("");
    setColorBackground(""); setColorForeground("");
    // Reset typography group
    setFontSans(""); setBaseFontSize("");
    // Reset component group
    setButtonRadius(""); setCardRadius(""); setCardPadding("");
    // Reset spacing group
    setSpacingMd(""); setSpacingLg(""); setSpacingXl("");
    // Keep theme — resetting it to "default" would be too destructive
    setResult(null);
  }

  // ── Computed indicators ────────────────────────────────────────────────────

  // Count how many grouped overrides this editor manages are currently set.
  const activeOverrideCount = [
    colorPrimary, colorSecondary, colorBackground, colorForeground,
    fontSans, baseFontSize,
    buttonRadius, cardRadius, cardPadding,
    spacingMd, spacingLg, spacingXl,
  ].filter((v) => v.trim() !== "").length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Card padding="md" shadow="sm" className="mb-6">

      {/* ── Panel header ──────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
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
      </div>

      <CardContent>
        <div className="space-y-6">

          {/* ── Theme preset ────────────────────────────────────────────────── */}
          <div>
            <SectionHeader
              title="Theme preset"
              description="Base visual personality. All unset tokens derive their defaults from this preset."
            />
            <div>
              <label className={labelCls}>Preset</label>
              <select
                value={theme}
                disabled={isPending}
                onChange={(e) => { setTheme(e.target.value as ThemeKey); setResult(null); }}
                className={inputCls}
              >
                {THEME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} — {opt.description}
                  </option>
                ))}
              </select>
              <p className={hintCls}>
                Changing the preset shifts all unstyled tokens simultaneously.
                Your overrides below always take priority over preset values.
              </p>
            </div>
          </div>

          {/* ── Colors ──────────────────────────────────────────────────────── */}
          <div>
            <SectionHeader
              title="Colors"
              description="Any valid CSS color: hex (#e63946), hsl(354 73% 56%), oklch(0.55 0.2 27), named colors."
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TokenInput
                label="Primary"
                value={colorPrimary}
                onChange={field(setColorPrimary)}
                placeholder="#3b82f6  — using preset"
                hint="Main brand color — buttons, links, focus rings, active states."
                showSwatch
                disabled={isPending}
              />
              <TokenInput
                label="Secondary"
                value={colorSecondary}
                onChange={field(setColorSecondary)}
                placeholder="— using preset —"
                hint="Supporting accent color — secondary actions and highlights."
                showSwatch
                disabled={isPending}
              />
              <TokenInput
                label="Background"
                value={colorBackground}
                onChange={field(setColorBackground)}
                placeholder="— using preset —"
                hint="Page / root background color."
                showSwatch
                disabled={isPending}
              />
              <TokenInput
                label="Foreground"
                value={colorForeground}
                onChange={field(setColorForeground)}
                placeholder="— using preset —"
                hint="Default body text color rendered on the background."
                showSwatch
                disabled={isPending}
              />
            </div>
          </div>

          {/* ── Typography ──────────────────────────────────────────────────── */}
          <div>
            <SectionHeader
              title="Typography"
              description="Font stack and base size — values cascade to all type-scale steps."
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TokenInput
                label="Font sans"
                value={fontSans}
                onChange={field(setFontSans)}
                placeholder="'Inter', system-ui, sans-serif"
                hint="Primary sans-serif font stack. Include at least one fallback family."
                disabled={isPending}
              />
              <TokenInput
                label="Base font size"
                value={baseFontSize}
                onChange={field(setBaseFontSize)}
                placeholder="16px  — using preset"
                hint="Root font size. Accepts px, rem, or em. Affects all relative sizes."
                disabled={isPending}
              />
            </div>
          </div>

          {/* ── Component geometry ──────────────────────────────────────────── */}
          <div>
            <SectionHeader
              title="Component geometry"
              description="Border radius and padding for common UI components. Accepts px, rem, em, %."
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TokenInput
                label="Button radius"
                value={buttonRadius}
                onChange={field(setButtonRadius)}
                placeholder="6px  — using preset"
                hint="Border-radius for all button variants (primary, ghost, outline)."
                disabled={isPending}
              />
              <TokenInput
                label="Card radius"
                value={cardRadius}
                onChange={field(setCardRadius)}
                placeholder="8px  — using preset"
                hint="Border-radius for cards, panels, dialogs, and modals."
                disabled={isPending}
              />
              <TokenInput
                label="Card padding"
                value={cardPadding}
                onChange={field(setCardPadding)}
                placeholder="1.5rem  — using preset"
                hint="Default inner padding for card and panel components."
                disabled={isPending}
              />
            </div>
          </div>

          {/* ── Spacing ─────────────────────────────────────────────────────── */}
          <div>
            <SectionHeader
              title="Spacing scale"
              description="Named spacing steps used across margins, gaps, and padding. Accepts px, rem, em, %."
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TokenInput
                label="Spacing md"
                value={spacingMd}
                onChange={field(setSpacingMd)}
                placeholder="16px  — using preset"
                hint="Medium — the most common gap and margin size."
                disabled={isPending}
              />
              <TokenInput
                label="Spacing lg"
                value={spacingLg}
                onChange={field(setSpacingLg)}
                placeholder="24px  — using preset"
                hint="Large — section gaps and generous padding."
                disabled={isPending}
              />
              <TokenInput
                label="Spacing xl"
                value={spacingXl}
                onChange={field(setSpacingXl)}
                placeholder="32px  — using preset"
                hint="Extra-large — hero sections and page-level spacing."
                disabled={isPending}
              />
            </div>
          </div>

        </div>

        {/* ── Result feedback ──────────────────────────────────────────────── */}
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

        {/* ── Footer — save button + explainer ────────────────────────────── */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[10px] text-neutral-400">
            These overrides layer on top of the active preset.{" "}
            <span className="text-neutral-500">Primary colour and font</span> can
            also be set in the main settings form — values here take priority.
            Fine-grained tokens (border, shadow, motion) are available via the
            JSON upload panel below.
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
