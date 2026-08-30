/**
 * OnboardingForm
 *
 * Client component — the create-tenant form for /admin/onboarding.
 *
 * ─── Fields ───────────────────────────────────────────────────────────────────
 *
 *   Tenant name     Display name (e.g. "Acme Corp")
 *   Tenant ID       URL-safe slug, auto-generated from name, manually editable
 *   Website URL     Primary hostname (e.g. "acme.com" or "https://acme.com")
 *   Package         starter / growth / pro — drives feature and block defaults
 *   CMS provider    sanity / storyblok / statamic / mock
 *   Theme preset    Filtered to the chosen package's allowedThemes
 *
 * ─── Slug auto-generation ─────────────────────────────────────────────────────
 *
 *   While the user has not manually edited the tenant ID field, it is kept in
 *   sync with the tenant name: lowercase, hyphens, max 32 chars.  The moment
 *   the user edits the ID field directly the auto-sync stops.
 *
 * ─── Package awareness ────────────────────────────────────────────────────────
 *
 *   The package selector shows each option's short description and indicative
 *   price from the PackageOption model (getAllPackageOptions).  Selecting a
 *   package updates the theme selector to only show themes allowed on that tier.
 *   If the current theme is not permitted by the newly selected package, it is
 *   reset to "default" automatically.
 *
 * ─── Submit flow ──────────────────────────────────────────────────────────────
 *
 *   1. User submits the form.
 *   2. createTenantFromOnboardingAction() is called via useTransition.
 *   3a. On success → success panel with link to the new tenant detail page.
 *   3b. On failure → field errors under each affected field + error banner.
 *   3c. Warnings → amber notice above the submit button.
 *
 * ─── Success state ────────────────────────────────────────────────────────────
 *
 *   The form is replaced by a success panel showing the new tenant ID, a link
 *   to /admin/tenants/<id>, and a "Create another" button that resets the form.
 */

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getAllPackageOptions, getPackageDefinition } from "@/tenant";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/primitives/Text";
import { TenantReadinessChecklist } from "@/components/admin/TenantReadinessChecklist";
import { createTenantFromOnboardingAction } from "@/app/admin/tenants/actions";
import type { CreateTenantResult } from "@/app/admin/tenants/actions";
import type { PackageKey, CMSProviderName, ThemeKey, TenantSettings } from "@/tenant";
import { THEME_CATALOG, THEME_PRESETS } from "@/design-system/theme/presets";
import type { ThemePresetKey } from "@/design-system/theme/presets";
import { ThemeSwatchGrid } from "@/components/admin/ThemeSwatchGrid";
import { DESIGN_PRESET_GALLERY } from "@/tenant/design-presets-gallery";
import { getThemeLayoutProfile } from "@/design-system/theme/layout-profiles";
import { tenantThemeToVarsRecord } from "@/design-system/theme";
import type { OnboardingInput } from "@/onboarding";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const ALL_CMS_PROVIDERS: readonly CMSProviderName[] = [
  "platform", "sanity", "storyblok", "statamic", "mock",
];

const CMS_DISPLAY: Record<CMSProviderName, string> = {
  platform:  "Platform (built-in)",
  sanity:    "Sanity",
  storyblok: "Storyblok",
  statamic:  "Statamic",
  mock:      "Mock (local / dev)",
};

// Platform originals have ThemeKey values that differ from their ThemePresetKey
// equivalents, so they are kept explicit here.  All curated themes are looked
// up from THEME_CATALOG automatically via themeLabel().
const PLATFORM_THEME_LABELS: Partial<Record<ThemeKey, string>> = {
  default: "Default",
  minimal: "Minimal",
  bold:    "Bold",
  custom:  "Custom",
};

/** Returns a display label for any ThemeKey — platform or curated. */
function themeLabel(key: ThemeKey): string {
  if (PLATFORM_THEME_LABELS[key]) return PLATFORM_THEME_LABELS[key]!;
  return THEME_CATALOG.find((e) => e.presetKey === key)?.label ?? key;
}

/** Minimum package hint for themes not available on every tier. */
const THEME_TIER_HINT: Partial<Record<ThemeKey, string>> = {
  minimal: "Growth or Pro",
  bold:    "Pro only",
  custom:  "Pro only",
};

type BadgeVariant = "default" | "primary" | "success" | "warning" | "error" | "outline";

const PACKAGE_DISPLAY: Record<PackageKey, string> = {
  starter: "Starter",
  growth:  "Growth",
  pro:     "Pro",
};

const PACKAGE_BADGE_VARIANT: Record<PackageKey, BadgeVariant> = {
  starter: "default",
  growth:  "primary",
  pro:     "success",
};

// Pre-compute package options once — pure constants, stable across renders.
const PACKAGE_OPTIONS = getAllPackageOptions();

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts a display name into a kebab-case tenant ID slug.
 * Strips non-alphanumeric characters, collapses whitespace/hyphens,
 * and clamps to 32 characters.
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function limitDisplay(n: number): string {
  if (n === Infinity) return "Unlimited";
  if (n === 0)        return "None";
  return String(n);
}

// ─────────────────────────────────────────────────────────────────────────────
// FORM STATE
// ─────────────────────────────────────────────────────────────────────────────

interface FormState {
  tenantName:  string;
  tenantId:    string;
  websiteUrl:  string;
  packageKey:  PackageKey;
  cmsProvider: CMSProviderName;
  themePreset: ThemeKey;
  /** When set, a gallery preset is selected (applied as a complete look); themePreset is ignored. */
  galleryPresetId: string | null;
}

const DEFAULT_FORM: FormState = {
  tenantName:  "",
  tenantId:    "",
  websiteUrl:  "",
  packageKey:  "starter",
  cmsProvider: "mock",
  themePreset: "default",
  galleryPresetId: null,
};

// Gallery presets grouped by their card category (ungated — mirrors the design
// tab, where the gallery is available to every tenant regardless of package).
const GALLERY_GROUPS: { category: string; presets: (typeof DESIGN_PRESET_GALLERY)[number][] }[] = (() => {
  const byCat = new Map<string, (typeof DESIGN_PRESET_GALLERY)[number][]>();
  for (const p of DESIGN_PRESET_GALLERY) {
    const list = byCat.get(p.category) ?? [];
    list.push(p);
    byCat.set(p.category, list);
  }
  return [...byCat.entries()].map(([category, presets]) => ({ category, presets }));
})();

// ─────────────────────────────────────────────────────────────────────────────
// STYLE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const inputBase = [
  "w-full rounded-lg border bg-white px-3 py-2",
  "text-sm text-neutral-900 placeholder:text-neutral-400",
  "focus:outline-none focus:ring-2",
  "disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400",
  "transition-colors",
].join(" ");

const inputNormal = "border-neutral-300 focus:border-brand-500 focus:ring-brand-200";
const inputError  = "border-error-400 focus:border-error-500 focus:ring-error-100";

function inputCls(hasError: boolean) {
  return cn(inputBase, hasError ? inputError : inputNormal);
}

const selectBase = [
  "w-full rounded-lg border bg-white px-3 py-2",
  "text-sm text-neutral-900",
  "focus:outline-none focus:ring-2",
  "disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400",
  "transition-colors",
].join(" ");

function selectCls(hasError: boolean) {
  return cn(selectBase, hasError ? inputError : inputNormal);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/** Labelled form field with optional hint and error message. */
function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label:    string;
  hint?:    string;
  error?:   string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-neutral-700">
        {label}
        {required && <span className="ml-0.5 text-error-500" aria-hidden>*</span>}
      </label>
      {hint && (
        <p className="text-xs text-neutral-400">{hint}</p>
      )}
      {children}
      {error && (
        <p className="text-xs text-error-600" role="alert">{error}</p>
      )}
    </div>
  );
}

/**
 * Package summary strip — shows what the selected package includes.
 * Reuses the PackageOption model from getAllPackageOptions().
 */
function PackageSummaryStrip({ packageKey }: { packageKey: PackageKey }) {
  const opt = PACKAGE_OPTIONS.find((o) => o.key === packageKey);
  if (!opt) return null;

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5">
      <p className="text-xs italic text-neutral-500">{opt.shortDescription}</p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <Chip label="Sites" value={limitDisplay(opt.limits.maxSites)} />
        <Chip label="Experiments" value={limitDisplay(opt.limits.maxExperiments)} />
        <Chip label="Variants / slot" value={limitDisplay(opt.limits.maxVariantsPerSlot)} />
        <Chip label="Price" value={opt.monthlyPriceLabel} />
      </div>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-center gap-1 text-xs text-neutral-500">
      <span className="font-medium text-neutral-700">{value}</span>
      <span>{label.toLowerCase()}</span>
    </span>
  );
}

/** Section divider with a title. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
      {children}
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SETUP SUMMARY CARD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single labelled row in the setup summary card.
 * Shows a text label on the left and a value (plus optional badge) on the right.
 */
function SummaryRow({
  label,
  value,
  badge,
}: {
  label:   string;
  value:   string;
  badge?:  React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-neutral-100 py-2.5 last:border-0">
      <span className="text-xs text-neutral-500">{label}</span>
      <div className="flex items-center gap-2 text-right">
        <span className="text-xs font-medium text-neutral-800">{value}</span>
        {badge}
      </div>
    </div>
  );
}

/**
 * Compact summary of the configuration choices made during onboarding.
 * Shows: package (with tier badge), CMS provider (with dev-only warning if mock),
 * theme preset, and primary URL (with missing warning if blank).
 */
function SetupSummaryCard({
  tenant,
  websiteUrl,
}: {
  tenant:     TenantSettings;
  websiteUrl: string;
}) {
  const pkgLabel   = PACKAGE_DISPLAY[tenant.packageKey] ?? tenant.packageKey;
  const pkgVariant = PACKAGE_BADGE_VARIANT[tenant.packageKey] ?? "default";
  const cmsLabel   = CMS_DISPLAY[(tenant.cms?.provider ?? "mock") as CMSProviderName] ?? (tenant.cms?.provider ?? "mock");
  const themeLabelText = themeLabel((tenant.design?.theme ?? "default") as ThemeKey);
  const urlTrimmed = websiteUrl.trim();

  return (
    <Card padding="md" shadow="sm">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Setup summary
        </p>
      </div>
      <CardContent>
        <SummaryRow
          label="Package"
          value={pkgLabel}
          badge={
            <Badge variant={pkgVariant} size="sm">
              {pkgLabel}
            </Badge>
          }
        />
        <SummaryRow
          label="CMS provider"
          value={cmsLabel}
          badge={
            (tenant.cms?.provider ?? "mock") === "mock" ? (
              <Badge variant="warning" size="sm">Dev only</Badge>
            ) : undefined
          }
        />
        <SummaryRow
          label="Theme preset"
          value={themeLabelText}
        />
        <SummaryRow
          label="Primary URL"
          value={urlTrimmed || ": "}
          badge={
            !urlTrimmed ? (
              <Badge variant="warning" size="sm">Missing</Badge>
            ) : undefined
          }
        />
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUCCESS PANEL
// ─────────────────────────────────────────────────────────────────────────────

function SuccessPanel({
  tenant,
  websiteUrl,
  warnings,
  onCreateAnother,
}: {
  tenant:          TenantSettings;
  websiteUrl:      string;
  warnings?:       string[];
  onCreateAnother: () => void;
}) {
  const tenantId = tenant.tenantId;

  return (
    <div className="max-w-2xl space-y-4">
      {/* Success card */}
      <Card className="border-success-200 bg-success-50">
        <CardContent>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success-500 text-white text-xs font-bold">
              ✓
            </span>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-success-800">
                Tenant created successfully
              </p>
              <p className="text-sm text-success-700">
                <span className="font-mono font-medium">{tenantId}</span>{" "}
                has been added to the tenant store.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warnings from enforcement/substitutions */}
      {warnings && warnings.length > 0 && (
        <Card className="border-warning-200 bg-warning-50">
          <CardContent>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-warning-700">
              Settings adjusted
            </p>
            <ul className="space-y-1">
              {warnings.map((w, i) => (
                <li key={i} className="text-xs text-warning-700">
                  {w}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Setup summary — package, CMS, theme, URL */}
      <SetupSummaryCard tenant={tenant} websiteUrl={websiteUrl} />

      {/* Before-launch checklist — what still needs attention */}
      <TenantReadinessChecklist
        tenant={tenant}
        websiteUrl={websiteUrl}
        title="Before launch"
      />

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Link href={`/admin/tenants/${tenantId}`}>
          <Button variant="primary" size="md">
            Go to tenant admin →
          </Button>
        </Link>
        <Button variant="outline" size="md" onClick={onCreateAnother}>
          Create another tenant
        </Button>
        <Link
          href="/admin/tenants"
          className="text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
        >
          ← All tenants
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// THEME PREVIEW CARD
// ─────────────────────────────────────────────────────────────────────────────

const ONBOARDING_CATEGORY_LABEL: Record<string, string> = {
  all:        "All themes",
  corporate:  "Corporate",
  marketing:  "Marketing",
  specialist: "Specialist",
  seasonal:   "Seasonal",
  platform:   "Platform defaults",
};

// Legacy — kept for reference, no longer used by ThemeFullPreview.
// const STORYBOOK_BASE =
//   typeof process !== "undefined"
//     ? (process.env.NEXT_PUBLIC_STORYBOOK_URL ?? "http://localhost:6006")
//     : "http://localhost:6006";

// Iframe thumbnail scaling — same constants as PresetPreviewViewer
const IFRAME_NATURAL_W = 1280;
const IFRAME_NATURAL_H = 900;
const THUMB_TARGET_W   = 256; // px — what we scale down to
const IFRAME_SCALE     = THUMB_TARGET_W / IFRAME_NATURAL_W; // ≈ 0.2

// ── Token extraction ──────────────────────────────────────────────────────────

interface PreviewTokens {
  heroBg:      string;
  primary:     string;
  primaryText: string;
  ctaBg:       string;
  featureBg:   string;
  cardBg:      string;
  cardBorder:  string;
  cardRadius:  string;
  titleColor:  string;
  btnRadius:   string;
}

const PLATFORM_THEME_TOKENS: Record<string, PreviewTokens> = {
  default: { heroBg: "#1e1b4b", primary: "#6366f1", primaryText: "#fff", ctaBg: "#4f46e5", featureBg: "#f8fafc", cardBg: "#fff", cardBorder: "#e2e8f0", cardRadius: "0.5rem", titleColor: "#fff", btnRadius: "0.375rem" },
  minimal: { heroBg: "#18181b", primary: "#52525b", primaryText: "#fff", ctaBg: "#27272a", featureBg: "#fafafa", cardBg: "#fff", cardBorder: "#e4e4e7", cardRadius: "0rem",    titleColor: "#fff", btnRadius: "0rem"    },
  bold:    { heroBg: "#1a1200", primary: "#f59e0b", primaryText: "#000", ctaBg: "#d97706", featureBg: "#111",    cardBg: "#1c1c1c", cardBorder: "#333",    cardRadius: "0.375rem", titleColor: "#fff", btnRadius: "0.375rem" },
  custom:  { heroBg: "#2e1065", primary: "#8b5cf6", primaryText: "#fff", ctaBg: "#7c3aed", featureBg: "#f5f3ff", cardBg: "#fff", cardBorder: "#ddd6fe", cardRadius: "0.5rem",   titleColor: "#fff", btnRadius: "0.5rem"   },
};

function getPreviewTokens(themeKey: ThemeKey): PreviewTokens {
  if (PLATFORM_THEME_TOKENS[themeKey]) return PLATFORM_THEME_TOKENS[themeKey];
  const preset = THEME_PRESETS[themeKey as ThemePresetKey];
  if (!preset) return PLATFORM_THEME_TOKENS.default;
  const v = tenantThemeToVarsRecord(preset);
  const tokens: PreviewTokens = {
    heroBg:      v["--hero-bg"]           ?? v["--bg-inverse"]  ?? "#0f172a",
    primary:     v["--primary"]           ?? "#6366f1",
    primaryText: v["--primary-text"]      ?? "#ffffff",
    ctaBg:       v["--section-cta-bg"]    ?? v["--primary"]     ?? "#6366f1",
    featureBg:   v["--feature-grid-bg"]   ?? v["--bg-subtle"]   ?? "#f8fafc",
    cardBg:      v["--card-bg"]           ?? "#ffffff",
    cardBorder:  v["--card-border"]       ?? "#e2e8f0",
    cardRadius:  v["--card-radius"]       ?? "0.5rem",
    titleColor:  v["--hero-title-color"]  ?? "#ffffff",
    btnRadius:   v["--btn-radius"]        ?? "0.375rem",
  };

  // ── Per-preset preview overrides ────────────────────────────────────────────
  //
  // Most themes use a near-black hero for dramatic effect.  At thumbnail scale
  // this makes every card look like "dark background + tiny coloured button".
  // These overrides substitute the brand's VIVID PRIMARY as the dominant hero
  // colour/overlay so each card is instantly recognisable by its brand colour.
  //
  // The deployed theme is entirely unchanged — only the onboarding preview is
  // affected.  Think of it as a "brand passport photo": it should communicate
  // the brand colour immediately, not replicate the exact dark-hero layout.

  // ── corporate-standard themes — four clearly distinct identities ───────────────
  //
  // Goal: keep each card consistent with its full /preview/theme/[presetKey] page
  // so the user sees the same colour family in both.  All four use a dark hero
  // (matching the actual deployed theme).  Differentiation comes from:
  //   · hero HUE  — navy / teal-navy / slate-gray / sky
  //   · PRIMARY   — blue / cyan / achromatic / sky
  //   · featureBg — blue-50 / cyan-50 / near-white / sky-50
  //
  //   corporate-blue   → deep navy  + blue accent          (reference)
  //   corporate-trust  → deep teal-navy + cyan accent
  //   corporate-clean  → dark slate-gray + achromatic + 0rem radius
  //   clean-corporate  → sky-700 + bright sky accent

  // corporate-blue: deep navy — reference; auto-derived tokens are correct, no override needed.

  // corporate-trust: dark teal-navy + cyan — clearly more teal/transparent than pure navy
  if (themeKey === "corporate-trust") {
    return { ...tokens,
      heroBg:     "#0f4c75",    // dark teal-navy — warmer/greener hue vs #0f2a5c pure navy
      titleColor: "#ffffff",
      primary:    "#0891b2",    // cyan-600 — distinct from blue, conveys trust/transparency
      primaryText:"#ffffff",
      featureBg:  "#ecfeff",    // cyan-50 — clearly teal-tinted feature section
      cardRadius: "0.75rem",    // softer radius — approachable, trustworthy
    };
  }

  // corporate-clean: dark slate-gray + achromatic — gray ≠ blue, sharp corners = precision
  if (themeKey === "corporate-clean") {
    return { ...tokens,
      heroBg:     "#1e293b",    // slate-800 — clearly gray (no blue tint), not navy
      titleColor: "#ffffff",
      primary:    "#e2e8f0",    // slate-200 — achromatic light button on dark hero
      primaryText:"#1e293b",    // dark text on light button
      featureBg:  "#f8fafc",    // barely-off-white section
      cardBg:     "#ffffff",
      cardBorder: "#e2e8f0",
      cardRadius: "0rem",       // sharp 0-radius — "clean/precise" identity marker
    };
  }

  // clean-corporate: sky-700 hero + bright sky accent — medium-dark, clearly "sky" not navy
  if (themeKey === "clean-corporate") {
    return { ...tokens,
      heroBg:     "#0369a1",    // sky-700 — medium-dark, clearly sky-blue not dark navy
      titleColor: "#ffffff",
      primary:    "#38bdf8",    // sky-300 — bright vivid button on sky hero
      primaryText:"#0c4a6e",    // sky-900 text on bright button
      featureBg:  "#f0f9ff",    // sky-50 — airy sky section
    };
  }

  // minimal-neutral: zinc-900 hero — flip to white (achromatic "no colour" identity)
  if (themeKey === "minimal-neutral") {
    return { ...tokens,
      heroBg:     "#ffffff",    // pure white — no colour, maximum content
      titleColor: "#18181b",    // zinc-900 dark heading
      primary:    "#52525b",    // zinc-600 achromatic button
      featureBg:  "#fafafa",    // barely-off-white
      cardBorder: "#e4e4e7",    // zinc-200
    };
  }

  // industrial-strong: stone-900 hero — show vivid red brand colour as hero
  if (themeKey === "industrial-strong") {
    return { ...tokens,
      heroBg:     "#991b1b",    // red-800 — bold industrial red hero
      titleColor: "#ffffff",
      primary:    "#ef4444",    // red-500 — vivid red button against dark hero
      featureBg:  "#fafaf9",    // stone-50 — off-white section
    };
  }

  // ── full-marketing themes (photo + colour overlay) — use vivid primary as overlay ─

  // bold-dark: near-black → amber-400 overlay (golden, unmistakable)
  if (themeKey === "bold-dark") {
    return { ...tokens,
      heroBg:     "#f59e0b",    // amber-400 vivid golden overlay
      titleColor: "#ffffff",
      primary:    "#fbbf24",    // amber-300 — bright button on golden bg
      featureBg:  "#111827",    // near-black feature section (bold contrast)
      btnRadius:  "1rem",       // large radius — bold/rounded feel
    };
  }

  // warm-professional: amber-950 (near-black brown) → amber-700 (clearly orange)
  if (themeKey === "warm-professional") {
    return { ...tokens,
      heroBg:     "#b45309",    // amber-700 — vivid warm orange-brown
      titleColor: "#ffffff",
      primary:    "#d97706",    // amber-600 — golden CTA
      featureBg:  "#fffbeb",    // amber-50 — warm light section
    };
  }

  // playful-startup: deep purple-black → vivid violet overlay
  if (themeKey === "playful-startup") {
    return { ...tokens,
      heroBg:     "#7c3aed",    // violet-600 — unmistakably purple
      titleColor: "#ffffff",
      primary:    "#a78bfa",    // violet-400 — bright button on purple bg
      featureBg:  "#f5f3ff",    // violet-50 section
      btnRadius:  "1.5rem",     // pill buttons — playful startup feel
    };
  }

  // startup-energy: deep rose-black → vivid rose-red overlay
  if (themeKey === "startup-energy") {
    return { ...tokens,
      heroBg:     "#e11d48",    // rose-600 — high-energy pink-red
      titleColor: "#ffffff",
      primary:    "#fb7185",    // rose-400 — bright button on rose bg
      featureBg:  "#fff1f2",    // rose-50 section
      btnRadius:  "1rem",
    };
  }

  // bold-marketing: deep indigo-black → vivid pink/fuchsia overlay
  if (themeKey === "bold-marketing") {
    return { ...tokens,
      heroBg:     "#db2777",    // pink-600 — vivid fuchsia pink
      titleColor: "#ffffff",
      primary:    "#f472b6",    // pink-400 — bright button on pink bg
      featureBg:  "#fdf2f8",    // pink-50 section
      btnRadius:  "1.25rem",
    };
  }

  // recruitment-energy: orange-950 (near-black) → vivid orange overlay
  if (themeKey === "recruitment-energy") {
    return { ...tokens,
      heroBg:     "#ea580c",    // orange-600 — vivid energetic orange
      titleColor: "#ffffff",
      primary:    "#fb923c",    // orange-400 — bright button on orange bg
      featureBg:  "#fff7ed",    // orange-50 section
      btnRadius:  "0.75rem",
    };
  }

  // ── editorial/content themes ───────────────────────────────────────────────

  // editorial-classic: charcoal hero, near-black buttons → show high-contrast B&W identity
  if (themeKey === "editorial-classic") {
    return { ...tokens,
      heroBg:     "#1c1917",    // charcoal hero — keep the editorial dark
      titleColor: "#f8f6f3",    // warm paper white headline
      primary:    "#f8f6f3",    // white/paper button — editorial inversion
      primaryText: "#1a1a1a",   // dark text on paper-white button
      featureBg:  "#f8f6f3",    // warm paper section — distinct from premium-editorial's espresso
      cardBorder: "#e8e4de",
    };
  }

  // premium-editorial: espresso hero #1a0f08 — make warm brown primary more vivid
  if (themeKey === "premium-editorial") {
    return { ...tokens,
      heroBg:     "#78350f",    // amber-900 — warm espresso that reads as BROWN, not black
      titleColor: "#faf6ef",    // cream headline
      primary:    "#d97706",    // amber-600 — richer warm accent (more visible at small scale)
      featureBg:  "#faf6ef",    // warm cream section — distinct from paper-white editorial-classic
    };
  }

  // ── specialist / signature / seasonal themes ────────────────────────────────

  // modern-green: emerald-900 hero — use vivid emerald-600 so green identity is instant
  if (themeKey === "modern-green") {
    return { ...tokens,
      heroBg:     "#059669",    // emerald-600 — vivid growth green
      titleColor: "#ffffff",
      primary:    "#10b981",    // emerald-500 — brighter button accent
      featureBg:  "#ecfdf5",    // emerald-50 — fresh light section
    };
  }

  // tech-indigo: deep violet-950 — use vivid indigo-700 so purple identity is clear
  if (themeKey === "tech-indigo") {
    return { ...tokens,
      heroBg:     "#4338ca",    // indigo-700 — deep vivid purple (clearly indigo, not navy)
      titleColor: "#ffffff",
      primary:    "#6366f1",    // indigo-500 — bright button on purple hero
      featureBg:  "#eef2ff",    // indigo-50 — light technical section
      cardRadius: "0.25rem",    // sharp radius — developer/SaaS precision
    };
  }

  // modern-saas: deep navy-violet — airy blue-violet hero, rounded cards, product feel
  if (themeKey === "modern-saas") {
    return { ...tokens,
      heroBg:     "#5b6af9",    // blue-violet — vivid, product-forward
      titleColor: "#ffffff",
      primary:    "#818cf8",    // indigo-400 — lighter button on violet hero
      featureBg:  "#f9fafb",    // gray-50 — clean airy section
      cardRadius: "0.875rem",   // more rounded than tech-indigo's sharp 0.25rem
    };
  }

  // healthcare-calm: cyan-900 dark hero — flip to light mint (calming medical feel)
  if (themeKey === "healthcare-calm") {
    return { ...tokens,
      heroBg:     "#cffafe",    // cyan-100 — light mint, calming, clearly medical
      titleColor: "#164e63",    // cyan-900 dark text on light hero
      primary:    "#0891b2",    // cyan-600 — confident healthcare blue-teal
      featureBg:  "#ecfeff",    // cyan-50 — softest mint section
      cardRadius: "1.5rem",     // very soft radius — friendly/accessible healthcare
    };
  }

  // dark-ai: near-black hero — show vivid violet glow (purple tint makes it AI/tech distinct)
  if (themeKey === "dark-ai") {
    return { ...tokens,
      heroBg:     "#1a0a4e",    // deep purple-black — clearly purple-tinted, not neutral black
      titleColor: "#c4b5fd",    // violet-300 — glowing headline on dark
      primary:    "#7b6eff",    // vivid indigo-violet CTA — the "AI glow" accent
      featureBg:  "#06060c",    // near-black section — keeps dark identity
      cardBorder: "#1e1c30",    // dark violet border
    };
  }

  // structured-saas: amber-950 near-black — structured stone hero with amber accent
  if (themeKey === "structured-saas") {
    return { ...tokens,
      heroBg:     "#292524",    // stone-800 — warm structured dark, distinct from amber-400 bold-dark
      titleColor: "#ffffff",
      primary:    "#d97706",    // amber-600 — warm amber accent on structured dark
      featureBg:  "#fafaf9",    // stone-50 — clean structured light section
      cardRadius: "0.25rem",    // sharp radius — structured/grid precision
    };
  }

  // portfolio-showcase: near-black — vivid cyan-600 hero (agency punch)
  if (themeKey === "portfolio-showcase") {
    return { ...tokens,
      heroBg:     "#0891b2",    // cyan-600 — punchy teal-cyan, distinct from sky-500 clean-corporate
      titleColor: "#ffffff",
      primary:    "#06b6d4",    // cyan-500 — vivid button accent
      featureBg:  "#f0f9ff",    // sky-50 — light airy section
      cardRadius: "1rem",       // balanced floating-card feel
    };
  }

  // premium-luxury: stone-950 near-black — warm cream hero (light luxury, distinct from dark-contrast)
  if (themeKey === "premium-luxury") {
    return { ...tokens,
      heroBg:     "#f5ede0",    // warm cream — prestige light hero
      titleColor: "#1c1412",    // warm near-black heading on cream
      primary:    "#a16207",    // gold-700 — restrained luxury button
      primaryText: "#ffffff",
      featureBg:  "#f5f0e8",    // warm off-white section
      cardRadius: "0.75rem",    // refined, not sharp
    };
  }

  // dark-contrast: pure black — high-contrast B&W identity (most distinct possible)
  if (themeKey === "dark-contrast") {
    return { ...tokens,
      heroBg:     "#000000",    // pure black — instantly distinct from all other dark heroes
      titleColor: "#ffffff",
      primary:    "#ffffff",    // white button — the defining inversion
      primaryText: "#000000",   // black text on white button
      featureBg:  "#0d0d0d",    // near-black section
      cardBorder: "#2a2a2a",
      cardRadius: "0.25rem",    // sharp, precise
    };
  }

  // valentine-pink: rose-800 dark — flip to pastel pink hero (romantic, seasonal)
  if (themeKey === "valentine-pink") {
    return { ...tokens,
      heroBg:     "#fce7f3",    // pink-100 — soft pastel pink, clearly romantic
      titleColor: "#831843",    // rose-900 — deep romantic text on pink
      primary:    "#be185d",    // rose-700 — vivid rose button
      featureBg:  "#fff1f2",    // rose-50 — lightest blush section
      cardRadius: "1rem",
    };
  }

  // dutch-orange: orange-800 dark — vivid Dutch orange hero (bold national identity)
  if (themeKey === "dutch-orange") {
    return { ...tokens,
      heroBg:     "#ea6c00",    // vivid Dutch orange — instantly recognisable
      titleColor: "#ffffff",
      primary:    "#ff7a1a",    // brighter orange button on orange hero
      featureBg:  "#fff1e6",    // orange-50 — warm light section
      cardRadius: "0rem",       // square radius — bold/structural Dutch graphic style
    };
  }

  // careers-human: light warmGray hero — flip to vivid teal (warm employer-brand identity)
  if (themeKey === "careers-human") {
    return { ...tokens,
      heroBg:     "#0d9488",    // teal-600 — vivid warm teal, distinct from cyan and sky
      titleColor: "#ffffff",
      primary:    "#14b8a6",    // teal-500 — slightly lighter button
      featureBg:  "#f0fdfa",    // teal-50 — fresh light section
      cardRadius: "0.75rem",
    };
  }

  // ── Client-type blueprints ─────────────────────────────────────────────────────
  //
  // Each blueprint has a strongly opinionated thumbnail so it reads instantly
  // at small scale and looks nothing like the other two.
  //
  // werkenbij   — warm amber-orange, pill buttons, soft radius. content-first layout.
  //               Hero = dark stone with vivid orange overlays + people photos.
  //               Feature section = warm off-white tint. Immediately "people-first".
  //
  // corporate   — deep navy hero, sharp corners, ghost-border CTA button.
  //               corporate-standard layout: split text+photo hero + numbered services.
  //               Conveys authority and precision — nothing soft or warm.
  //
  // saas        — near-black violet-tinted hero, tight sharp radius, vivid violet CTAs.
  //               full-marketing layout: badge pill + stats row + photo feature cards.
  //               Product-led energy. Immediately reads as a modern SaaS tool.

  if (themeKey === "werkenbij-blueprint") {
    return { ...tokens,
      heroBg:      "#1c1007",    // very dark warm brown-black — people photos pop on it
      titleColor:  "#ffffff",
      primary:     "#f97316",    // vivid amber-orange — unmistakable brand colour
      primaryText: "#ffffff",
      ctaBg:       "#f97316",
      featureBg:   "#fff7ed",    // warm orange-50 tint — instantly distinct from cold grays
      cardBg:      "#ffffff",
      cardBorder:  "#fed7aa",    // orange-200 — warm border tint
      cardRadius:  "0.875rem",   // soft but not extreme — approachable
      btnRadius:   "999px",      // full pill buttons — friendly, human, warm
    };
  }

  if (themeKey === "corporate-b2b-blueprint") {
    return { ...tokens,
      heroBg:      "#0a1628",    // very dark navy — maximum authority signal
      titleColor:  "#ffffff",
      primary:     "#1d4ed8",    // vivid corporate blue
      primaryText: "#ffffff",
      ctaBg:       "#1d4ed8",
      featureBg:   "#f1f5f9",    // cool slate-100 — cold, structured, no warmth
      cardBg:      "#ffffff",
      cardBorder:  "#cbd5e1",    // slate-300 — crisp visible border
      cardRadius:  "0.125rem",   // near-square — razor-sharp precision
      btnRadius:   "0.125rem",   // same sharp radius on buttons
    };
  }

  if (themeKey === "saas-blueprint") {
    return { ...tokens,
      heroBg:      "#0d0a1a",    // near-black with deep violet undertone
      titleColor:  "#ffffff",
      primary:     "#7c3aed",    // vivid violet — product-led, modern, punchy
      primaryText: "#ffffff",
      ctaBg:       "#7c3aed",
      featureBg:   "#f5f3ff",    // violet-50 — very light violet tint on feature cards
      cardBg:      "#ffffff",
      cardBorder:  "#ddd6fe",    // violet-200 — brand-tinted card borders
      cardRadius:  "0.375rem",   // tight but not razor — SaaS precision
      btnRadius:   "0.375rem",
    };
  }

  return tokens;
}

function getStoryId(themeKey: ThemeKey): string | null {
  // Platform-internal themes (default/minimal/bold/custom) have no Storybook story.
  if (["default", "minimal", "bold", "custom"].includes(themeKey)) return null;
  const entry = THEME_CATALOG.find((e) => e.presetKey === themeKey);
  return entry?.preview?.[0]?.storyId ?? `themes-preview--${themeKey}`;
}

/**
 * Maps platform-internal theme keys to the closest curated preset for preview.
 * These keys (default/minimal/bold/custom) are not in THEME_PRESETS so they
 * can't be previewed directly — we show a visually similar curated preset instead.
 */
const PLATFORM_PREVIEW_FALLBACK: Record<string, string> = {
  default: "tech-indigo",
  minimal: "minimal-neutral",
  bold:    "bold-dark",
  custom:  "corporate-blue",
};

/**
 * Returns the URL for the full-website theme preview.
 * All themes use the rich multi-page /preview/theme/[presetKey] route.
 * Platform-internal keys are mapped to the closest curated preset.
 */
function getPreviewUrl(themeKey: ThemeKey): string {
  const key = PLATFORM_PREVIEW_FALLBACK[themeKey] ?? themeKey;
  return `/preview/theme/${key}`;
}

// ── ThemeFullPreview overlay ──────────────────────────────────────────────────

function ThemeFullPreview({
  themeKey,
  label,
  description,
  onClose,
  onSelect,
}: {
  themeKey:    ThemeKey;
  label:       string;
  description: string;
  onClose:     () => void;
  onSelect:    () => void;
}) {
  const src     = getPreviewUrl(themeKey);
  const profile = getThemeLayoutProfile(themeKey);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70" onClick={onClose}>
      {/* Header bar */}
      <div
        className="flex shrink-0 items-center justify-between gap-4 border-b border-neutral-200 bg-white px-6 py-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="text-base font-semibold text-neutral-900">{label}</p>
          <p className="text-xs text-neutral-500">{description}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600">
            {profile.label}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
          >
            Close
          </button>
          <Button type="button" variant="primary" size="md" onClick={() => { onSelect(); onClose(); }}>
            Select this theme →
          </Button>
        </div>
      </div>
      {/* Iframe */}
      <div className="flex-1 overflow-hidden bg-white" onClick={(e) => e.stopPropagation()}>
        <iframe src={src} title={`Preview: ${label}`} className="h-full w-full border-none" />
      </div>
    </div>
  );
}

// ── LayoutPreview ─────────────────────────────────────────────────────────────
//
// Renders a realistic CSS screenshot mockup of a different website type per
// layout profile.  Each profile looks structurally distinct so theme cards
// are immediately recognisable as different kinds of site, not just recolours.
//
//  full-marketing   → SaaS hero with email capture + metrics + feature cards
//  corporate-standard → split-hero with UI mockup + numbered services + logos
//  content-first    → portfolio mosaic grid + article list
//  clean-landing    → minimal centred hero + product window + pricing cards

// picsum.photos: free, deterministic per seed, no API key required.
// Each theme gets unique photos — seed = themeKey + variant suffix.
function picsumUrl(seed: string, w: number, h: number) {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
}

// Absolutely-positioned photo layer — covers its parent, object-fit cover.
function PhotoBg({ src, overlay }: { src: string; overlay: string }) {
  return (
    <>
      <img src={src} alt="" loading="lazy" aria-hidden="true"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      {/* Theme-colour overlay so the photo reads as "this theme's colour palette" */}
      <div style={{ position: "absolute", inset: 0, background: overlay }} />
    </>
  );
}

function LayoutPreview({ t, profileKey, themeKey }: { t: PreviewTokens; profileKey: string; themeKey: string }) {
  const f = "system-ui, -apple-system, sans-serif";

  // ── full-marketing: bold SaaS page with photo hero + photo feature cards ───────
  if (profileKey === "full-marketing") {
    return (
      <div style={{ fontFamily: f, display: "flex", flexDirection: "column", height: "100%" }}>

        {/* Hero — full photo background with colour overlay */}
        <div style={{ flex: "0 0 50%", position: "relative", overflow: "hidden" }}>
          <PhotoBg src={picsumUrl(themeKey, 400, 220)} overlay={`${t.heroBg}bb`} />
          {/* Nav */}
          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", padding: "5px 10px", gap: 6 }}>
            <div style={{ width: 22, height: 4, borderRadius: 2, background: t.primary }} />
            <div style={{ flex: 1, display: "flex", gap: 5, justifyContent: "flex-end" }}>
              {[16, 13, 14].map((w, i) => <div key={i} style={{ width: w, height: 2, borderRadius: 1, background: t.titleColor, opacity: 0.4 }} />)}
              <div style={{ padding: "2px 6px", borderRadius: t.btnRadius, background: t.primary, fontSize: 4.5, color: t.primaryText, fontWeight: 700 }}>Sign up</div>
            </div>
          </div>
          {/* Headline + CTA */}
          <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "4px 14px 8px" }}>
            <div style={{ padding: "1.5px 7px", borderRadius: 99, background: `${t.primary}40`, border: `1px solid ${t.primary}70`, fontSize: 4, color: t.primary, fontWeight: 600 }}>New · v2.0 is live</div>
            <div style={{ width: "76%", height: 8, borderRadius: 3, background: t.titleColor, opacity: 0.96 }} />
            <div style={{ width: "56%", height: 8, borderRadius: 3, background: t.titleColor, opacity: 0.92 }} />
            <div style={{ width: "52%", height: 3, borderRadius: 2, background: t.titleColor, opacity: 0.42 }} />
            <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
              <div style={{ padding: "3px 10px", borderRadius: t.btnRadius, background: t.primary, fontSize: 5, fontWeight: 700, color: t.primaryText }}>Start free</div>
              <div style={{ padding: "3px 10px", borderRadius: t.btnRadius, border: `1px solid ${t.titleColor}55`, fontSize: 5, color: t.titleColor, opacity: 0.8 }}>Demo</div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", justifyContent: "center", gap: 14, padding: "4px 10px", background: t.heroBg, borderTop: `1px solid ${t.titleColor}15` }}>
          {["10k+", "99%", "4.9★"].map((label, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
              <span style={{ fontSize: 7, fontWeight: 700, color: t.primary }}>{label}</span>
              <div style={{ width: 18, height: 2, borderRadius: 1, background: t.titleColor, opacity: 0.28 }} />
            </div>
          ))}
        </div>

        {/* Feature cards with small photo thumbnails */}
        <div style={{ flex: 1, background: t.featureBg, display: "flex", gap: 4, padding: "5px 8px" }}>
          {["-fa", "-fb", "-fc"].map((v, i) => (
            <div key={v} style={{ flex: 1, background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: t.cardRadius, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {/* Card photo */}
              <div style={{ height: 22, position: "relative", overflow: "hidden" }}>
                <img src={picsumUrl(themeKey + v, 120, 60)} alt="" loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                <div style={{ position: "absolute", inset: 0, background: `${t.primary}22` }} />
              </div>
              <div style={{ padding: "3px 4px", display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ height: 3, width: "80%", borderRadius: 1, background: "#0f172a", opacity: 0.65 }} />
                <div style={{ height: 2, width: "65%", borderRadius: 1, background: "#0f172a", opacity: 0.28 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── corporate-standard: split hero (text + office photo) + services ───────────
  if (profileKey === "corporate-standard") {
    return (
      <div style={{ fontFamily: f, display: "flex", flexDirection: "column", height: "100%", background: t.cardBg }}>

        {/* Nav */}
        <div style={{ display: "flex", alignItems: "center", padding: "5px 10px", gap: 5, borderBottom: `1px solid ${t.cardBorder}` }}>
          <div style={{ width: 26, height: 4, borderRadius: 2, background: t.primary, opacity: 0.9 }} />
          <div style={{ flex: 1, display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
            {[16, 18, 14].map((w, i) => <div key={i} style={{ width: w, height: 2, borderRadius: 1, background: "#0f172a", opacity: 0.28 }} />)}
            <div style={{ padding: "2px 7px", borderRadius: t.btnRadius, border: `1px solid ${t.primary}`, fontSize: 4.5, color: t.primary, fontWeight: 600 }}>Book Demo</div>
          </div>
        </div>

        {/* Split hero: text left + real photo right */}
        <div style={{ display: "flex", flex: "0 0 44%", background: t.heroBg, overflow: "hidden" }}>
          {/* Left: headline + CTAs */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "6px 10px", gap: 4 }}>
            <div style={{ width: "88%", height: 7, borderRadius: 3, background: t.titleColor, opacity: 0.95 }} />
            <div style={{ width: "70%", height: 7, borderRadius: 3, background: t.titleColor, opacity: 0.9 }} />
            <div style={{ width: "62%", height: 2.5, borderRadius: 2, background: t.titleColor, opacity: 0.38, marginTop: 1 }} />
            <div style={{ width: "52%", height: 2.5, borderRadius: 2, background: t.titleColor, opacity: 0.32 }} />
            <div style={{ display: "flex", gap: 4, marginTop: 3 }}>
              <div style={{ padding: "3px 9px", borderRadius: t.btnRadius, background: t.primary, fontSize: 5, fontWeight: 700, color: t.primaryText }}>Get started</div>
              <div style={{ padding: "3px 9px", borderRadius: t.btnRadius, border: `1px solid ${t.titleColor}40`, fontSize: 5, color: t.titleColor, opacity: 0.7 }}>Learn more</div>
            </div>
          </div>
          {/* Right: real office/team photo in a lifted card */}
          <div style={{ width: "42%", margin: "8px 8px 0", borderRadius: `${t.cardRadius} ${t.cardRadius} 0 0`, overflow: "hidden", boxShadow: "0 6px 20px rgba(0,0,0,0.22)", flexShrink: 0, position: "relative" }}>
            <img src={picsumUrl(themeKey + "-corp", 160, 120)} alt="" loading="lazy"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            <div style={{ position: "absolute", inset: 0, background: `${t.primary}15` }} />
          </div>
        </div>

        {/* Numbered services */}
        <div style={{ flex: "0 0 32%", background: t.featureBg, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, padding: "6px 8px" }}>
          {["01", "02", "03", "04"].map((n) => (
            <div key={n} style={{ display: "flex", gap: 4, alignItems: "flex-start" }}>
              <div style={{ fontSize: 7, fontWeight: 800, color: t.primary, opacity: 0.45, lineHeight: 1, flexShrink: 0, letterSpacing: "-0.5px" }}>{n}</div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ height: 3, width: "80%", borderRadius: 1, background: "#0f172a", opacity: 0.65 }} />
                <div style={{ height: 2, width: "100%", borderRadius: 1, background: "#0f172a", opacity: 0.25 }} />
                <div style={{ height: 2, width: "75%", borderRadius: 1, background: "#0f172a", opacity: 0.18 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Client logos */}
        <div style={{ flex: 1, borderTop: `1px solid ${t.cardBorder}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "0 10px" }}>
          {[28, 24, 32, 22, 26].map((w, i) => (
            <div key={i} style={{ width: w, height: 5, borderRadius: 2, background: t.primary, opacity: 0.12 + i * 0.03 }} />
          ))}
        </div>
      </div>
    );
  }

  // ── content-first: photo mosaic hero + portfolio grid + article strip ─────────
  if (profileKey === "content-first") {
    return (
      <div style={{ fontFamily: f, display: "flex", flexDirection: "column", height: "100%", background: "#111" }}>

        {/* Mosaic hero: 3 real photos at different heights */}
        <div style={{ flex: "0 0 48%", position: "relative", overflow: "hidden" }}>
          {/* Nav overlay */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 2, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 10px" }}>
            <div style={{ width: 22, height: 4, borderRadius: 2, background: "#fff", opacity: 0.9 }} />
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {[14, 14].map((w, i) => <div key={i} style={{ width: w, height: 2, borderRadius: 1, background: "#fff", opacity: 0.5 }} />)}
              <div style={{ padding: "2px 6px", borderRadius: t.btnRadius, border: "1px solid rgba(255,255,255,0.45)", fontSize: 4.5, color: "#fff" }}>Contact</div>
            </div>
          </div>
          {/* Photo tiles */}
          <div style={{ position: "absolute", inset: 0, display: "flex", gap: 2, padding: "0 6px", alignItems: "flex-end" }}>
            {[
              { seed: themeKey + "-m1", flex: 3, height: "80%" },
              { seed: themeKey + "-m2", flex: 2, height: "58%" },
              { seed: themeKey + "-m3", flex: 2, height: "68%" },
            ].map(({ seed, flex, height }) => (
              <div key={seed} style={{ flex, height, borderRadius: `${t.cardRadius} ${t.cardRadius} 0 0`, overflow: "hidden", position: "relative" }}>
                <img src={picsumUrl(seed, 160, 140)} alt="" loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.55))` }} />
              </div>
            ))}
          </div>
          {/* Text overlay */}
          <div style={{ position: "absolute", bottom: 8, left: 10, right: 10, zIndex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ display: "flex", gap: 3 }}>
              {["Design", "Motion"].map((tag) => (
                <div key={tag} style={{ padding: "1.5px 5px", borderRadius: 3, background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.25)", fontSize: 4, color: "#fff" }}>{tag}</div>
              ))}
            </div>
            <div style={{ width: "68%", height: 7, borderRadius: 3, background: "#fff", opacity: 0.93 }} />
            <div style={{ width: "48%", height: 7, borderRadius: 3, background: "#fff", opacity: 0.85 }} />
          </div>
        </div>

        {/* Portfolio grid: big photo left + 2 stacked right */}
        <div style={{ flex: "0 0 36%", display: "flex", gap: 2, padding: "3px 6px", background: "#111" }}>
          <div style={{ flex: 3, borderRadius: t.cardRadius, overflow: "hidden", position: "relative" }}>
            <img src={picsumUrl(themeKey + "-p1", 200, 100)} alt="" loading="lazy"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            <div style={{ position: "absolute", inset: 0, background: `${t.primary}30` }} />
            <div style={{ position: "absolute", bottom: 5, left: 6 }}>
              <div style={{ width: 40, height: 3, borderRadius: 1, background: "#fff", opacity: 0.85, marginBottom: 2 }} />
              <div style={{ width: 28, height: 2, borderRadius: 1, background: "#fff", opacity: 0.45 }} />
            </div>
          </div>
          <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: 2 }}>
            {["-p2", "-p3"].map((v) => (
              <div key={v} style={{ flex: 1, borderRadius: t.cardRadius, overflow: "hidden", position: "relative" }}>
                <img src={picsumUrl(themeKey + v, 120, 60)} alt="" loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                <div style={{ position: "absolute", inset: 0, background: `${t.heroBg}40` }} />
                <div style={{ position: "absolute", bottom: 4, left: 4, width: 22, height: 2.5, borderRadius: 1, background: "#fff", opacity: 0.75 }} />
              </div>
            ))}
          </div>
        </div>

        {/* Article list */}
        <div style={{ flex: 1, background: "#1a1a1a", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 5, alignItems: "center", padding: "3px 8px" }}>
          {["-a1", "-a2", "-a3"].map((v, i) => (
            <div key={v} style={{ flex: 1, display: "flex", alignItems: "center", gap: 3 }}>
              <div style={{ width: 14, height: 14, borderRadius: 2, overflow: "hidden", flexShrink: 0 }}>
                <img src={picsumUrl(themeKey + v, 28, 28)} alt="" loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ height: 2.5, width: "85%", borderRadius: 1, background: "#fff", opacity: 0.6, marginBottom: 2 }} />
                <div style={{ height: 2, width: "55%", borderRadius: 1, background: t.primary, opacity: 0.55 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── clean-landing: minimal centred hero with photo + pricing ──────────────────
  return (
    <div style={{ fontFamily: f, display: "flex", flexDirection: "column", height: "100%", background: t.cardBg }}>

      {/* Slim nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 10px", borderBottom: `1px solid ${t.cardBorder}` }}>
        <div style={{ width: 20, height: 3.5, borderRadius: 1, background: t.primary, opacity: 0.9 }} />
        <div style={{ padding: "2px 7px", borderRadius: t.btnRadius, background: t.primary, fontSize: 4.5, color: t.primaryText, fontWeight: 700 }}>Get started</div>
      </div>

      {/* Hero: photo background, strong overlay, centred text */}
      <div style={{ flex: "0 0 42%", position: "relative", overflow: "hidden" }}>
        <PhotoBg src={picsumUrl(themeKey + "-h", 300, 160)} overlay={`${t.heroBg}cc`} />
        <div style={{ position: "relative", zIndex: 1, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, padding: "6px 18px" }}>
          <div style={{ padding: "1.5px 8px", borderRadius: 99, background: `${t.primary}30`, border: `1px solid ${t.primary}55`, fontSize: 4.5, color: t.primary, fontWeight: 600 }}>New · v2.0 live</div>
          <div style={{ width: "82%", height: 8, borderRadius: 3, background: t.titleColor, opacity: 0.96 }} />
          <div style={{ width: "62%", height: 8, borderRadius: 3, background: t.titleColor, opacity: 0.9 }} />
          <div style={{ width: "54%", height: 2.5, borderRadius: 1, background: t.titleColor, opacity: 0.38 }} />
          <div style={{ padding: "4px 18px", borderRadius: t.btnRadius, background: t.primary, fontSize: 5.5, fontWeight: 700, color: t.primaryText, marginTop: 2 }}>Start for free →</div>
        </div>
      </div>

      {/* Product screenshot: browser window with photo inside */}
      <div style={{ flex: "0 0 30%", padding: "4px 10px" }}>
        <div style={{ height: "100%", borderRadius: t.cardRadius, border: `1px solid ${t.cardBorder}`, overflow: "hidden", boxShadow: `0 4px 20px ${t.primary}20` }}>
          <div style={{ height: 7, background: t.featureBg, borderBottom: `1px solid ${t.cardBorder}`, display: "flex", alignItems: "center", gap: 2, padding: "0 5px" }}>
            {["#ff5f56","#ffbd2e","#27c93f"].map((c, i) => <div key={i} style={{ width: 3.5, height: 3.5, borderRadius: "50%", background: c, opacity: 0.75 }} />)}
            <div style={{ flex: 1, height: 3, borderRadius: 2, background: t.cardBorder, margin: "0 4px" }} />
          </div>
          <div style={{ position: "relative", height: "calc(100% - 7px)", overflow: "hidden" }}>
            <img src={picsumUrl(themeKey + "-app", 240, 80)} alt="" loading="lazy"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            <div style={{ position: "absolute", inset: 0, background: `${t.cardBg}88` }} />
          </div>
        </div>
      </div>

      {/* Pricing cards */}
      <div style={{ flex: 1, background: t.featureBg, display: "flex", gap: 4, padding: "4px 10px" }}>
        {[
          { highlight: false, accent: t.cardBorder },
          { highlight: true,  accent: t.primary    },
        ].map(({ highlight, accent }, idx) => (
          <div key={idx} style={{ flex: 1, background: highlight ? t.primary : t.cardBg, border: `1.5px solid ${accent}`, borderRadius: t.cardRadius, padding: "4px 5px", display: "flex", flexDirection: "column", gap: 2.5, boxShadow: highlight ? `0 4px 14px ${t.primary}45` : "none" }}>
            <div style={{ width: "48%", height: 2.5, borderRadius: 1, background: highlight ? t.primaryText : "#0f172a", opacity: highlight ? 0.75 : 0.45 }} />
            <div style={{ width: "68%", height: 5, borderRadius: 2, background: highlight ? t.primaryText : t.primary, opacity: highlight ? 0.95 : 0.7 }} />
            {[0,1,2].map(i => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                <div style={{ width: 3, height: 3, borderRadius: "50%", background: highlight ? t.primaryText : t.primary, opacity: 0.55 }} />
                <div style={{ width: `${60 + i * 10}%`, height: 2, borderRadius: 1, background: highlight ? t.primaryText : "#0f172a", opacity: highlight ? 0.42 : 0.2 }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ThemePreviewCard ──────────────────────────────────────────────────────────

function ThemePreviewCard({
  themeKey,
  label,
  description,
  isSelected,
  disabled,
  onClick,
  onPreview,
}: {
  themeKey:    ThemeKey;
  label:       string;
  description: string;
  isSelected:  boolean;
  disabled:    boolean;
  onClick:     () => void;
  onPreview:   () => void;
}) {
  const t        = getPreviewTokens(themeKey);
  const profile  = getThemeLayoutProfile(themeKey);

  const entry   = THEME_CATALOG.find((e) => e.presetKey === themeKey);
  const fontName = entry
    ? (() => {
        const first = entry.defaults.headingFont.split(",")[0].trim().replace(/['"]/g, "");
        return (first === "system-ui" || first === "-apple-system") ? null : first;
      })()
    : null;

  return (
    <div className={cn(
      "group relative flex flex-col overflow-hidden rounded-xl border-2 transition-all duration-150",
      isSelected
        ? "border-indigo-500 shadow-lg shadow-indigo-100/60"
        : "border-neutral-200 hover:border-neutral-300 hover:shadow-lg",
      disabled && "pointer-events-none opacity-50",
    )}>
      {/* ── Preview area ── */}
      {/* div not button — avoids nested-button hydration error */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
        className="relative block w-full cursor-pointer overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
        style={{ aspectRatio: "16/10" }}
        aria-pressed={isSelected}
      >
        {/* Layer 1: CSS structural preview — always visible, acts as loading skeleton */}
        <div className="absolute inset-0">
          <LayoutPreview t={t} profileKey={profile.key} themeKey={themeKey} />
        </div>

        {/* Thumbnail cards use the CSS LayoutPreview mockup (not iframes) so they
            render instantly without a Storybook dependency.  The full-screen
            "Bekijk voorbeeld" overlay loads /preview/theme/[presetKey], a
            multi-page simulation with NavBar, 8 page types, and FooterCorporate. */}

        {/* Selected ring */}
        {isSelected && <div className="absolute inset-0 ring-4 ring-inset ring-indigo-500 pointer-events-none" />}

        {/* Selected checkmark badge */}
        {isSelected && (
          <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500 shadow-lg">
            <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
            </svg>
          </div>
        )}

        {/* Hover: "Bekijk voorbeeld" */}
        <div className="absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-center bg-black/50 py-2 transition-transform duration-150 group-hover:translate-y-0">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onPreview(); }}
            className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-900 shadow hover:bg-neutral-100"
          >
            View preview ↗
          </button>
        </div>
      </div>

      {/* ── Card footer ── */}
      <div className="flex items-center justify-between gap-2 border-t border-neutral-100 bg-white px-3 py-2.5">
        <div className="min-w-0">
          <p className={cn("truncate text-sm font-semibold leading-tight", isSelected ? "text-indigo-700" : "text-neutral-900")}>
            {label}
          </p>
          <p className="truncate text-[11px] text-neutral-400">
            {profile.label}{fontName ? ` · ${fontName}` : ""}
          </p>
        </div>
        {isSelected ? (
          <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">Selected</span>
        ) : (
          <button type="button" onClick={onClick} className="shrink-0 rounded-full border border-neutral-200 px-2.5 py-0.5 text-[11px] font-medium text-neutral-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
            Select
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP INDICATOR
// ─────────────────────────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: 1 | 2; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => {
        const n = (i + 1) as 1 | 2;
        const done   = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                done   && "bg-indigo-500 text-white",
                active && "bg-indigo-100 text-indigo-700 ring-2 ring-indigo-300",
                !done && !active && "bg-neutral-100 text-neutral-400",
              )}
            >
              {done ? (
                <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                </svg>
              ) : n}
            </div>
            {n < total && (
              <div className={cn("h-px w-6 transition-colors", done ? "bg-indigo-300" : "bg-neutral-200")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SELECTED THEME PILL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compact summary pill shown at the top of step 2 so the user
 * can see which theme they picked and jump back to change it.
 */
function SelectedThemePill({
  themeKey,
  onChangeClick,
}: {
  themeKey:      ThemeKey;
  onChangeClick: () => void;
}) {
  const label = themeLabel(themeKey);
  return (
    <div className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z" clipRule="evenodd" />
          </svg>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-indigo-500">
            Selected theme
          </p>
          <p className="text-sm font-semibold text-neutral-900">{label}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onChangeClick}
        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors underline underline-offset-2"
      >
        Change
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN FORM
// ─────────────────────────────────────────────────────────────────────────────

export function OnboardingForm() {
  const [form, setForm]               = useState<FormState>(DEFAULT_FORM);
  const [slugEdited, setSlugEdited]   = useState(false);
  const [result, setResult]           = useState<CreateTenantResult | null>(null);
  const [isPending, startTransition]  = useTransition();
  const [step, setStep]               = useState<1 | 2>(1);
  const [previewingTheme, setPreviewingTheme] = useState<ThemeKey | null>(null);

  // Show success panel when creation succeeded.
  if (result?.ok === true) {
    return (
      <SuccessPanel
        tenant={result.tenant}
        websiteUrl={form.websiteUrl}
        warnings={result.warnings}
        onCreateAnother={() => {
          setForm(DEFAULT_FORM);
          setSlugEdited(false);
          setResult(null);
          setStep(1);
        }}
      />
    );
  }

  // Field-level errors from the last failed submission.
  const fieldErrors = result?.ok === false ? (result.fieldErrors ?? {}) : {};
  const generalError = result?.ok === false ? result.error : null;

  // The package definition for the currently selected package key.
  const pkgDef        = getPackageDefinition(form.packageKey);
  const allowedThemes = pkgDef.allowedThemes as readonly ThemeKey[];

  // ── Field change handlers ───────────────────────────────────────────────────

  function handleNameChange(name: string) {
    setForm((prev) => ({
      ...prev,
      tenantName: name,
      // Keep slug in sync as long as the user hasn't manually edited it.
      tenantId: slugEdited ? prev.tenantId : slugify(name),
    }));
    setResult(null);
  }

  function handleSlugChange(slug: string) {
    setSlugEdited(true);
    setForm((prev) => ({ ...prev, tenantId: slug.toLowerCase() }));
    setResult(null);
  }

  function handlePackageChange(key: PackageKey) {
    const newPkg  = getPackageDefinition(key);
    const allowed = newPkg.allowedThemes as readonly ThemeKey[];
    // If the chosen theme isn't available on the new package, fall back to
    // "default" and offer the user a note (no hard reset — they picked it).
    const theme = allowed.includes(form.themePreset) ? form.themePreset : "default";
    setForm((prev) => ({ ...prev, packageKey: key, themePreset: theme }));
    setResult(null);
  }

  function handleField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setResult(null);
  }

  // Theme selection (ThemeSelection pattern): a curated theme clears any gallery
  // preset; a gallery preset is applied as a complete look on creation.
  function selectCuratedTheme(themeKey: ThemeKey) {
    setForm((prev) => ({ ...prev, themePreset: themeKey, galleryPresetId: null }));
    setResult(null);
  }
  function selectGalleryPreset(presetId: string) {
    setForm((prev) => ({ ...prev, galleryPresetId: presetId }));
    setResult(null);
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const input: OnboardingInput = {
      tenantId:    form.tenantId.trim(),
      tenantName:  form.tenantName.trim(),
      websiteUrl:  form.websiteUrl.trim(),
      packageKey:  form.packageKey,
      cmsProvider: form.cmsProvider,
      themePreset: form.themePreset,
      ...(form.galleryPresetId ? { galleryPresetId: form.galleryPresetId } : {}),
    };

    startTransition(async () => {
      const res = await createTenantFromOnboardingAction(input);
      setResult(res);
    });
  }

  // ── Step 1: Theme picker ────────────────────────────────────────────────────

  if (step === 1) {
    // Group THEME_CATALOG by category, preserving catalog order within each group
    const catalogByCategory = new Map<string, typeof THEME_CATALOG[number][]>();
    for (const entry of THEME_CATALOG) {
      const cat = entry.category ?? "corporate";
      if (!catalogByCategory.has(cat)) catalogByCategory.set(cat, []);
      catalogByCategory.get(cat)!.push(entry);
    }

    // Render in this order
    const categoryOrder = ["corporate", "marketing", "specialist", "seasonal"];
    const catalogGroups = categoryOrder
      .filter((c) => catalogByCategory.has(c))
      .map((c) => ({ category: c, entries: catalogByCategory.get(c)! }));

    return (
      <div className="max-w-4xl space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Step 1 of 2
            </p>
            <h2 className="mt-0.5 text-xl font-semibold text-neutral-900">
              Choose a theme
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              The theme determines the visual style and which adaptive blocks are active by default.
              You can change this later from the tenant admin.
            </p>
          </div>
          <div className="shrink-0 pt-1">
            <StepIndicator current={1} total={2} />
          </div>
        </div>

        {/* ── Curated themes, grouped by category ── */}
        {catalogGroups.map(({ category, entries }) => (
          <section key={category}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
              {ONBOARDING_CATEGORY_LABEL[category] ?? category}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {entries.map((entry) => (
                <ThemePreviewCard
                  key={entry.presetKey}
                  themeKey={entry.presetKey as ThemeKey}
                  label={entry.label}
                  description={entry.description}
                  isSelected={!form.galleryPresetId && form.themePreset === entry.presetKey}
                  disabled={isPending}
                  onClick={() => selectCuratedTheme(entry.presetKey as ThemeKey)}
                  onPreview={() => setPreviewingTheme(entry.presetKey as ThemeKey)}
                />
              ))}
            </div>
          </section>
        ))}

        {/* ── Platform defaults (simpler row at the bottom) ── */}
        <section>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Platform defaults
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                { key: "default", label: "Default",  description: "Standard Mister Chameleon, indigo primary, slate neutrals"         },
                { key: "minimal", label: "Minimal",  description: "Monochrome zinc: no colour, maximum content focus"                  },
                { key: "bold",    label: "Bold",      description: "Amber on near-black: high energy, conversion-focused"              },
                { key: "custom",  label: "Custom",    description: "Fully customisable tokens, configure everything in Design"         },
              ] as { key: ThemeKey; label: string; description: string }[]
            ).map((t) => (
              <ThemePreviewCard
                key={t.key}
                themeKey={t.key}
                label={t.label}
                description={t.description}
                isSelected={!form.galleryPresetId && form.themePreset === t.key}
                disabled={isPending}
                onClick={() => selectCuratedTheme(t.key)}
                onPreview={() => setPreviewingTheme(t.key)}
              />
            ))}
          </div>
        </section>

        {/* ── Gallery presets, grouped by category (applied as a complete look) ── */}
        {GALLERY_GROUPS.map(({ category, presets }) => (
          <section key={category}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
              {category}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={isPending}
                  onClick={() => selectGalleryPreset(p.id)}
                  className={cn(
                    "flex flex-col rounded-xl border bg-white p-3 text-left transition-colors",
                    form.galleryPresetId === p.id
                      ? "border-brand-500 ring-2 ring-brand-100"
                      : "border-neutral-200 hover:border-neutral-300",
                    isPending && "opacity-60",
                  )}
                >
                  <div className="mb-2 flex gap-1">
                    {[p.swatch.background, p.swatch.primary, p.swatch.accent, p.swatch.foreground].map((c, i) => (
                      <span key={i} className="h-6 flex-1 rounded" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <span className="text-sm font-semibold text-neutral-800">{p.name}</span>
                  <span className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{p.description}</span>
                </button>
              ))}
            </div>
          </section>
        ))}

        {/* ── Selected-theme blueprint ── updates live as you click cards ── */}
        {form.galleryPresetId ? (
          <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
            Gallery preset selected. It will be applied as a complete look, colours, cards,
            buttons and typography: when the tenant is created.
          </div>
        ) : (
          <ThemeBlueprintCard themeKey={form.themePreset} />
        )}

        {/* Navigation */}
        <div className="flex items-center gap-4 pt-2">
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => setStep(2)}
          >
            Next: tenant details →
          </Button>
          <Link
            href="/admin/tenants"
            className="text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
          >
            Cancel
          </Link>
        </div>

        {/* Full-screen theme preview overlay */}
        {previewingTheme && (() => {
          const entry = THEME_CATALOG.find((e) => e.presetKey === previewingTheme);
          return (
            <ThemeFullPreview
              themeKey={previewingTheme}
              label={entry?.label ?? previewingTheme}
              description={entry?.description ?? ""}
              onClose={() => setPreviewingTheme(null)}
              onSelect={() => {
                handleField("themePreset", previewingTheme);
                setPreviewingTheme(null);
              }}
            />
          );
        })()}
      </div>
    );
  }

  // ── Step 2: Details + submit ────────────────────────────────────────────────

  // Warn when the chosen theme is not available on the selected package.
  const themeNotInPackage =
    form.themePreset !== "default" &&
    !allowedThemes.includes(form.themePreset);

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-2xl space-y-6">

      {/* ── Step header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Step 2 of 2
          </p>
          <h2 className="mt-0.5 text-xl font-semibold text-neutral-900">
            Tenant details
          </h2>
        </div>
        <StepIndicator current={2} total={2} />
      </div>

      {/* ── Selected theme pill ──────────────────────────────────────────── */}
      <SelectedThemePill
        themeKey={form.themePreset}
        onChangeClick={() => setStep(1)}
      />

      {/* Theme / package mismatch notice */}
      {themeNotInPackage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The selected theme <strong>{themeLabel(form.themePreset)}</strong> is not
          available in the selected package. After creation the default theme will be used instead, 
          or choose a higher-tier package.
        </div>
      )}

      {/* ── Card 1: Identity ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <SectionTitle>Identity</SectionTitle>
          <Text variant="h4">Tenant details</Text>
          <p className="text-xs text-neutral-400">
            The name and slug uniquely identify this client across the platform.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Tenant name */}
          <Field
            label="Tenant name"
            hint="Human-readable display name, e.g. 'Acme Corp'"
            error={fieldErrors.tenantName}
            required
          >
            <input
              type="text"
              value={form.tenantName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Acme Corp"
              autoComplete="off"
              className={inputCls(!!fieldErrors.tenantName)}
            />
          </Field>

          {/* Tenant ID / slug */}
          <Field
            label="Tenant ID (slug)"
            hint="Lowercase, hyphens only, max 32 chars, auto-generated from name"
            error={fieldErrors.tenantId}
            required
          >
            <div className="relative">
              <input
                type="text"
                value={form.tenantId}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="acme-corp"
                autoComplete="off"
                spellCheck={false}
                className={cn(inputCls(!!fieldErrors.tenantId), "pr-20 font-mono")}
              />
              {!slugEdited && form.tenantId && (
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                  <Badge variant="default" size="sm">auto</Badge>
                </span>
              )}
            </div>
          </Field>

          {/* Website URL */}
          <Field
            label="Primary website URL"
            hint="The client's production domain, e.g. 'acme.com' or 'https://acme.com'"
            error={fieldErrors.websiteUrl}
            required
          >
            <input
              type="text"
              value={form.websiteUrl}
              onChange={(e) => handleField("websiteUrl", e.target.value)}
              placeholder="acme.com"
              autoComplete="off"
              className={inputCls(!!fieldErrors.websiteUrl)}
            />
          </Field>
        </CardContent>
      </Card>

      {/* ── Card 2: Package & Configuration ─────────────────────────────── */}
      <Card>
        <CardHeader>
          <SectionTitle>Package &amp; configuration</SectionTitle>
          <Text variant="h4">Platform settings</Text>
          <p className="text-xs text-neutral-400">
            The package sets feature entitlements and block access. CMS can be
            refined on the tenant detail page after creation.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Package */}
          <Field
            label="Package"
            error={fieldErrors.packageKey}
            required
          >
            <select
              value={form.packageKey}
              onChange={(e) => handlePackageChange(e.target.value as PackageKey)}
              className={selectCls(!!fieldErrors.packageKey)}
            >
              {PACKAGE_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                  {opt.monthlyPriceLabel ? `: ${opt.monthlyPriceLabel}` : ""}
                </option>
              ))}
            </select>
          </Field>

          {/* Package summary */}
          <PackageSummaryStrip packageKey={form.packageKey} />

          {/* CMS provider */}
          <Field
            label="CMS provider"
            hint="Credentials are configured after creation. Use 'Mock' for dev / staging tenants."
            error={fieldErrors.cmsProvider}
            required
          >
            <select
              value={form.cmsProvider}
              onChange={(e) => handleField("cmsProvider", e.target.value as CMSProviderName)}
              className={selectCls(!!fieldErrors.cmsProvider)}
            >
              {ALL_CMS_PROVIDERS.map((p) => (
                <option key={p} value={p}>{CMS_DISPLAY[p]}</option>
              ))}
            </select>
          </Field>

        </CardContent>
      </Card>

      {/* ── General error banner ─────────────────────────────────────────── */}
      {generalError && (
        <div
          className="rounded-lg border border-error-200 bg-error-50 px-4 py-3"
          role="alert"
        >
          <p className="text-sm font-medium text-error-700">{generalError}</p>
        </div>
      )}

      {/* ── Submit row ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4 pt-2">
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={() => setStep(1)}
          disabled={isPending}
        >
          ← Terug
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={isPending}
          disabled={isPending}
        >
          {isPending ? "Creating…" : "Create tenant"}
        </Button>
        <Link
          href="/admin/tenants"
          className="text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
        >
          Annuleren
        </Link>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ThemeBlueprintCard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shows the structural blueprint of the selected theme — which adaptive
 * context blocks are enabled by default and what the layout profile is called.
 *
 * Updates live as the user selects a different theme swatch.
 */
function ThemeBlueprintCard({ themeKey }: { themeKey: ThemeKey }) {
  const profile = getThemeLayoutProfile(themeKey);

  const BLOCK_ICONS: Record<string, string> = {
    hero:         "🎯",
    proof:        "⭐",
    cta:          "📣",
    conversion:   "📋",
    notification: "🔔",
  };

  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-4">
      <div className="flex items-start gap-3">
        {/* Left: layout icon */}
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M3 4a1 1 0 000 2h14a1 1 0 100-2H3zm0 4a1 1 0 000 2h14a1 1 0 100-2H3zm0 4a1 1 0 000 2h8a1 1 0 100-2H3z" clipRule="evenodd" />
          </svg>
        </div>

        {/* Right: content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap mb-1">
            <span className="text-sm font-semibold text-neutral-900">{profile.label}</span>
            <span className="text-xs text-neutral-500 italic">{profile.description}</span>
          </div>

          {/* Block inventory */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5 mt-2">
            {profile.highlights.map((highlight, i) => {
              const blockKey = profile.contextBlocks[i] ?? "";
              const icon = BLOCK_ICONS[blockKey] ?? "✓";
              return (
                <div key={i} className="flex items-center gap-2 text-xs text-neutral-700 py-0.5">
                  <span className="text-sm leading-none">{icon}</span>
                  <span>{highlight}</span>
                </div>
              );
            })}
          </div>

          <p className="mt-2 text-[11px] text-neutral-400">
            You can enable or disable additional blocks after creation via the admin.
          </p>
        </div>
      </div>
    </div>
  );
}
