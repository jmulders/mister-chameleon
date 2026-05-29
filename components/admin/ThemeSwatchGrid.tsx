/**
 * ThemeSwatchGrid
 *
 * A reusable controlled swatch grid for selecting a theme preset.
 * Purely a UI component — no server actions.  Callers supply `value` and
 * `onChange`; saving to the server is the caller's responsibility.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   // In a form (e.g. OnboardingForm):
 *   <ThemeSwatchGrid
 *     value={form.themePreset}
 *     onChange={(key) => handleField("themePreset", key)}
 *     allowedThemes={pkgDef.allowedThemes}
 *   />
 *
 *   // In a save-on-click panel (e.g. ThemePickerPanel):
 *   <ThemeSwatchGrid
 *     value={activeTheme}
 *     onChange={handleSelect}
 *     activating={activating}
 *   />
 *
 * ─── Theme sources ────────────────────────────────────────────────────────────
 *
 *   Curated themes  — sourced from THEME_CATALOG (all ThemePresetKey values).
 *                     Grouped by category and rendered in category order.
 *
 *   Platform themes — "default", "minimal", "bold", "custom" are original
 *                     platform presets that predate the THEME_CATALOG.  They
 *                     are not in THEME_CATALOG, so they use a static fallback
 *                     swatch map and appear in a "Platform defaults" section.
 *
 * ─── allowedThemes filtering ─────────────────────────────────────────────────
 *
 *   When `allowedThemes` is supplied, only themes in that list are rendered.
 *   Themes from THEME_CATALOG not in the list are hidden entirely.
 *   Platform themes not in the list are also hidden.
 *
 *   This matches the package-level entitlement model — starter tenants only
 *   see "default"; pro tenants see everything.
 */

"use client";

import type { ThemeKey }               from "@/tenant/types";
import { THEME_CATALOG }               from "@/design-system/theme/presets";
import type { ThemePresetKey, ThemeCatalogCategory } from "@/design-system/theme/presets";

// ── Platform theme metadata ────────────────────────────────────────────────────

interface PlatformThemeMeta {
  key:         ThemeKey;
  label:       string;
  description: string;
  swatchColor: string;
}

const PLATFORM_THEMES: readonly PlatformThemeMeta[] = [
  {
    key:         "default",
    label:       "Default",
    description: "The standard Mister Chameleon platform theme — indigo primary, slate neutrals",
    swatchColor: "#6366f1",
  },
  {
    key:         "minimal",
    label:       "Minimal",
    description: "Clean zinc monochrome — no colour distraction, maximum content focus",
    swatchColor: "#71717a",
  },
  {
    key:         "bold",
    label:       "Bold",
    description: "Amber on near-black — high-energy, conversions-first",
    swatchColor: "#f59e0b",
  },
  {
    key:         "custom",
    label:       "Custom",
    description: "Fully customised token set — configure all values in the Design tab",
    swatchColor: "#8b5cf6",
  },
];

const PLATFORM_THEME_KEYS = new Set<string>(PLATFORM_THEMES.map((t) => t.key));

// ── Category ordering ──────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<ThemeCatalogCategory, string> = {
  platform:   "Platform",
  corporate:  "Corporate",
  marketing:  "Marketing",
  specialist: "Specialist",
  seasonal:   "Seasonal",
};

const CATEGORY_ORDER: ThemeCatalogCategory[] = [
  "platform",
  "marketing",
  "corporate",
  "specialist",
  "seasonal",
];

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ThemeSwatchGridProps {
  /** Currently selected theme key. */
  value: ThemeKey;

  /** Called when the user selects a theme. */
  onChange: (key: ThemeKey) => void;

  /**
   * When supplied, only themes in this list are rendered.
   * Pass `pkgDef.allowedThemes` to honour package-level entitlements.
   * When omitted, all themes are shown.
   */
  allowedThemes?: readonly ThemeKey[];

  /**
   * When provided, the matching swatch shows a spinner instead of the check
   * mark.  Pass the key that is currently being saved server-side.
   */
  activating?: string | null;

  /** When true, all swatches are disabled (no click interaction). */
  disabled?: boolean;
}

// ── SwatchCard ────────────────────────────────────────────────────────────────

interface SwatchCardProps {
  themeKey:    ThemeKey;
  label:       string;
  swatchColor: string;
  isActive:    boolean;
  isActivating: boolean;
  disabled:    boolean;
  onClick:     () => void;
}

function SwatchCard({
  themeKey,
  label,
  swatchColor,
  isActive,
  isActivating,
  disabled,
  onClick,
}: SwatchCardProps) {
  const isDisabled = disabled || (isActivating && !isActive);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      aria-pressed={isActive}
      className={[
        "group relative flex flex-col items-center gap-1.5 rounded-xl border p-2 text-center",
        "transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1",
        isActive
          ? "border-indigo-500 bg-indigo-50 shadow-sm"
          : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50 hover:shadow-sm",
        isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      ].join(" ")}
    >
      {/* Colour swatch circle */}
      <div className="relative mt-0.5">
        <div
          className="h-8 w-8 rounded-full ring-2 ring-white shadow-sm"
          style={{ backgroundColor: swatchColor }}
        />

        {/* Active check mark */}
        {isActive && !isActivating && (
          <div className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500">
            <svg
              className="h-2.5 w-2.5 text-white"
              fill="none"
              viewBox="0 0 12 12"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
            </svg>
          </div>
        )}

        {/* Saving spinner */}
        {isActivating && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-white/70">
            <svg className="h-4 w-4 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
        )}
      </div>

      {/* Label */}
      <span
        className={[
          "w-full truncate text-[11px] leading-tight",
          isActive ? "font-semibold text-indigo-700" : "font-medium text-neutral-700",
        ].join(" ")}
      >
        {label}
      </span>
    </button>
  );
}

// ── ThemeSwatchGrid ───────────────────────────────────────────────────────────

/**
 * Controlled swatch grid for selecting a theme key.
 *
 * Shows platform defaults and THEME_CATALOG entries grouped by category.
 * Filters to `allowedThemes` when supplied.
 *
 * @example
 *   <ThemeSwatchGrid
 *     value={form.themePreset}
 *     onChange={(k) => handleField("themePreset", k)}
 *     allowedThemes={pkgDef.allowedThemes}
 *   />
 */
export function ThemeSwatchGrid({
  value,
  onChange,
  allowedThemes,
  activating = null,
  disabled   = false,
}: ThemeSwatchGridProps) {
  const allowed = allowedThemes ? new Set(allowedThemes as string[]) : null;

  // ── Platform themes section ────────────────────────────────────────────────
  const platformEntries = PLATFORM_THEMES.filter(
    (t) => !allowed || allowed.has(t.key),
  );

  // ── Curated themes grouped by category ────────────────────────────────────
  const catalogByCategory = new Map<ThemeCatalogCategory, (typeof THEME_CATALOG)[number][]>();
  for (const entry of THEME_CATALOG) {
    if (PLATFORM_THEME_KEYS.has(entry.presetKey)) continue; // skip if also in platform list
    if (allowed && !allowed.has(entry.presetKey)) continue;
    const cat = entry.category ?? "corporate";
    if (!catalogByCategory.has(cat)) catalogByCategory.set(cat, []);
    catalogByCategory.get(cat)!.push(entry);
  }

  const catalogGroups = CATEGORY_ORDER
    .filter((c) => catalogByCategory.has(c))
    .map((c) => ({ category: c, entries: catalogByCategory.get(c)! }));

  const hasCuratedThemes = catalogGroups.length > 0;
  const hasPlatformThemes = platformEntries.length > 0;

  return (
    <div className="space-y-4">

      {/* Platform defaults */}
      {hasPlatformThemes && (
        <div>
          {hasCuratedThemes && (
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Platform defaults
            </p>
          )}
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6 xl:grid-cols-8">
            {platformEntries.map((t) => (
              <SwatchCard
                key={t.key}
                themeKey={t.key}
                label={t.label}
                swatchColor={t.swatchColor}
                isActive={t.key === value}
                isActivating={activating === t.key}
                disabled={disabled}
                onClick={() => onChange(t.key)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Curated themes by category */}
      {catalogGroups.map(({ category, entries }) => (
        <div key={category}>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            {CATEGORY_LABEL[category]}
          </p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6 xl:grid-cols-8">
            {entries.map((entry) => (
              <SwatchCard
                key={entry.presetKey}
                themeKey={entry.presetKey as ThemeKey}
                label={entry.label}
                swatchColor={entry.swatchColor ?? "#6366f1"}
                isActive={entry.presetKey === value}
                isActivating={activating === entry.presetKey}
                disabled={disabled}
                onClick={() => onChange(entry.presetKey as ThemeKey)}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Fallback: no themes available for this package */}
      {!hasPlatformThemes && !hasCuratedThemes && (
        <p className="text-xs text-neutral-400 italic">
          No themes available for the selected package.
        </p>
      )}
    </div>
  );
}
