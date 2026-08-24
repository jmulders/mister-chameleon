/**
 * TenantSettingsForm
 *
 * Full-page editable form for a single tenant's settings.
 * Client component — owns all form state and calls the save server action.
 *
 * ─── Sections ─────────────────────────────────────────────────────────────────
 *
 *   Basic     tenantId (read-only), package selector + summary + change diff
 *   AI        mode, provider, confidence threshold
 *   CMS       provider, project ID, dataset
 *   Design    theme preset (package-gated), primary colour, primary font
 *   Blocks    context + content block allow-lists (package-gated checkboxes)
 *   Features  experiments, AI, analytics toggles (package-gated)
 *
 * ─── Package awareness ────────────────────────────────────────────────────────
 *
 *   On every render, `pkgDef` is derived from the current `packageKey`.
 *   Inputs that are unavailable on the current package are disabled and
 *   show a hint badge ("Growth or Pro" / "Pro only").
 *
 *   Changing the package also immediately cleans up any selections that
 *   are no longer valid (blocks, themes, AI mode, features).
 *
 *   A PackageSummaryStrip beneath the selector always shows what the
 *   selected package includes.  When the package differs from the saved
 *   value a PackageChangeDiff panel lists what is gained and lost.
 *
 * ─── Save flow ────────────────────────────────────────────────────────────────
 *
 *   1. User edits fields.
 *   2. User clicks "Save changes".
 *   3. `useTransition` + `saveTenantAction` (server action) — async, non-blocking.
 *   4. Inline success / error message appears.
 *   5. Any subsequent form change clears the message.
 */

"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { getPackageDefinition, getPackageOption, isValidPackageKey } from "@/tenant";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Text } from "@/components/primitives/Text";
import { saveTenantAction, syncStatamicBlueprintAction } from "./actions";
import type {
  TenantSettings,
  PackageKey,
  PackageDefinition,
  ThemeKey,
  ContextBlockKey,
  ContentBlockKey,
  TenantAiSettings,
  TenantAiProviderName,
  TenantLanguageConfig,
} from "@/tenant";
import { THEME_CATALOG } from "@/design-system/theme/presets";
import { BlockCatalogue }  from "./_components/BlockCatalogue";
import { BlockTypeEffectsEditor } from "@/components/admin/effects/BlockTypeEffectsEditor";

// ── Local aliases ──────────────────────────────────────────────────────────────

type AiMode      = TenantAiSettings["mode"];
type CmsProvider = "sanity" | "storyblok" | "statamic" | "mock" | "platform";

// ── Language form item ────────────────────────────────────────────────────────
//
// Mutable mirror of TenantLanguageConfig — same fields, all strings so they
// map naturally to controlled <input> elements.

interface LanguageFormItem {
  code:      string;   // "nl", "en-gb", "de"
  locale:    string;   // "nl_NL", "en_GB", "de_DE"
  name:      string;   // "Nederlands", "English", "Deutsch"
  isDefault: boolean;
  enabled:   boolean;
}

// ── Provider slot state ────────────────────────────────────────────────────────
//
// apiKey is ALWAYS initialised to "" — the page strips the stored key before
// passing TenantSettings to this component.  A non-empty apiKey in form state
// means the user has typed a NEW key that should replace the stored one.

interface ProviderSlotState {
  name:   string;   // TenantAiProviderName | ""
  apiKey: string;   // "" = no new key → server preserves existing
  model:  string;
}

// ── Form state ────────────────────────────────────────────────────────────────
//
// String fields that map to optional numbers (confidenceThreshold) are kept
// as strings in state so native <input type="number"> is fully controlled.
// They're parsed back to numbers in formStateToSettings().
//
// `identity.additionalDomains` is stored as a newline-separated string so it
// fits naturally in a <textarea>.  Converted back to an array in
// formStateToSettings() by splitting on newlines and filtering empty lines.

interface FormState {
  identity: {
    name:              string;
    slug:              string;
    primaryDomain:     string;
    additionalDomains: string; // newline-separated; converted to array on save
  };
  packageKey: PackageKey;
  ai: {
    mode:                AiMode;
    confidenceThreshold: string;
    liveProvider:        ProviderSlotState;
    shadowProvider:      ProviderSlotState;
  };
  cms: {
    provider:        CmsProvider;
    projectId:       string;
    dataset:         string;
    apiVersion:      string;
    studioUrl:       string;
    statamicBaseUrl: string;
  };
  design: {
    theme:        ThemeKey;
    primaryColor: string;
    primaryFont:  string;
  };
  features: {
    experiments: boolean;
    ai:          boolean;
    analytics:   boolean;
  };
  blocks: {
    context: ContextBlockKey[];
    content: ContentBlockKey[];
  };
  languages: LanguageFormItem[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ALL_PACKAGES: readonly PackageKey[] = ["starter", "growth", "pro"];

const PACKAGE_DISPLAY: Record<PackageKey, string> = {
  starter: "Starter",
  growth:  "Growth",
  pro:     "Pro",
};

const ALL_AI_MODES: readonly AiMode[] = ["disabled", "shadow", "live"];

const AI_MODE_DISPLAY: Record<AiMode, string> = {
  disabled: "Disabled",
  shadow:   "Shadow (observe only)",
  live:     "Live (serve AI plans)",
};

const ALL_AI_PROVIDERS: readonly (TenantAiProviderName | "")[] = ["", "claude", "openai", "gemini"];

const AI_PROVIDER_DISPLAY: Record<TenantAiProviderName | "", string> = {
  "":       "— Select provider —",
  claude:   "Claude (Anthropic)",
  openai:   "OpenAI",
  gemini:   "Gemini (Google), mock only (adapter pending)",
};

const ALL_CMS_PROVIDERS: readonly CmsProvider[] = [
  "platform", "sanity", "storyblok", "statamic", "mock",
];

const CMS_PROVIDER_DISPLAY: Record<CmsProvider, string> = {
  platform:  "Platform (built-in), no external CMS needed",
  sanity:    "Sanity",
  storyblok: "Storyblok",
  statamic:  "Statamic",
  mock:      "Mock (local dev)",
};

/** Dynamic field labels per CMS provider. */
const CMS_FIELD_LABELS: Record<CmsProvider, { projectId: string; dataset: string }> = {
  platform:  { projectId: "Project ID",  dataset: "Dataset" },
  sanity:    { projectId: "Project ID",  dataset: "Dataset (e.g. production)" },
  storyblok: { projectId: "Space ID",    dataset: "Environment" },
  statamic:  { projectId: "Site ID",     dataset: "Collection" },
  mock:      { projectId: "Project ID",  dataset: "Dataset" },
};

// ── Theme helpers ──────────────────────────────────────────────────────────────
//
// Labels and hints are derived from THEME_CATALOG (single source of truth for
// curated themes). Platform originals (default/minimal/bold/custom) are kept
// explicit because their ThemeKey differs from their ThemePresetKey.

/** Hard-coded labels for the 4 platform-original themes. */
const PLATFORM_THEME_LABELS: Partial<Record<ThemeKey, string>> = {
  default: "Platform Default",
  minimal: "Enterprise Clean",
  bold:    "Bold Brand",
  custom:  "Custom",
};

/** Hard-coded package hints for the 4 platform-original themes. */
const PLATFORM_THEME_HINTS: Partial<Record<ThemeKey, string>> = {
  default: "",
  minimal: "Growth or Pro",
  bold:    "Pro only",
  custom:  "Pro only",
};

/** Returns a human-readable label for any ThemeKey. */
function themeLabel(key: ThemeKey): string {
  if (PLATFORM_THEME_LABELS[key]) return PLATFORM_THEME_LABELS[key]!;
  return THEME_CATALOG.find((e) => e.presetKey === key)?.label ?? key;
}

/** Returns a package-requirement hint for any ThemeKey in the context of pkgDef. */
function themeHint(key: ThemeKey, pkgAllowedThemes: readonly ThemeKey[]): string {
  if (pkgAllowedThemes.includes(key)) return PLATFORM_THEME_HINTS[key] ?? "";
  return "upgrade required";
}

const ALL_CONTEXT_BLOCKS: readonly ContextBlockKey[] = ["hero", "proof", "cta"];

const ALL_CONTENT_BLOCKS: readonly ContentBlockKey[] = [
  // text
  "textSection", "richText",
  // media
  "image", "video", "slider",
  // social proof
  "testimonialSection", "quote", "logoStrip", "stats",
  // features / content
  "featureGrid", "faqSection", "about", "newsList", "caseHighlight",
  // listing / detail
  "listing", "articleBody", "articleMeta", "relatedContent",
  "vacancyMeta", "applyPanel", "filterBar",
  // search
  "search",
  // conversion
  "ctaSection",
  // forms
  "formSection",
];

/** Minimum package hint per content block — shown next to disabled checkboxes. */
const CONTENT_BLOCK_HINTS: Record<ContentBlockKey, string> = {
  textSection:        "",
  richText:           "Growth or Pro",
  image:              "Growth or Pro",
  video:              "Pro only",
  slider:             "Pro only",
  testimonialSection: "Growth or Pro",
  quote:              "Growth or Pro",
  logoStrip:          "Growth or Pro",
  stats:              "Growth or Pro",
  featureGrid:        "Growth or Pro",
  faqSection:         "Growth or Pro",
  about:              "Pro only",
  newsList:           "Pro only",
  caseHighlight:      "Pro only",
  listing:            "Growth or Pro",
  articleBody:        "Growth or Pro",
  articleMeta:        "Growth or Pro",
  relatedContent:     "Growth or Pro",
  vacancyMeta:        "Pro only",
  applyPanel:         "Pro only",
  filterBar:          "Pro only",
  searchResults:      "",          // internal rendering concept — not user-selectable
  search:             "Growth or Pro",
  ctaSection:         "Growth or Pro",
  formSection:        "Growth or Pro",
  // careers / W6
  processSteps:       "Pro only",
  recruiterPanel:     "Pro only",
  // conversion / pricing
  pricingSection:     "Pro only",
  // content / editorial
  contentSection:     "Pro only",
  teamSection:        "Pro only",
  // new core blocks
  timeline:           "Pro only",
  quickLinks:         "Pro only",
  textMedia:          "Pro only",
  contactSection:     "Pro only",
  floatingContact:    "Pro only",
  // commerce / product
  productOverview:    "Pro only",
  productDetail:      "Pro only",
  cartSummary:        "Pro only",
  checkoutBlock:      "Pro only",
  mapBlock:           "All plans",
};

/** Human-readable display names for content blocks — used in the diff panel. */
const CONTENT_BLOCK_DISPLAY: Record<ContentBlockKey, string> = {
  textSection:        "Text section",
  richText:           "Rich text",
  image:              "Image",
  video:              "Video",
  slider:             "Slider",
  testimonialSection: "Testimonials",
  quote:              "Quote",
  logoStrip:          "Logo strip",
  stats:              "Stats",
  featureGrid:        "Feature grid",
  faqSection:         "FAQ",
  about:              "About",
  newsList:           "News list",
  caseHighlight:      "Case highlight",
  listing:            "Listing",
  articleBody:        "Article body",
  articleMeta:        "Article meta",
  relatedContent:     "Related content",
  vacancyMeta:        "Vacancy meta",
  applyPanel:         "Apply panel",
  filterBar:          "Filter bar",
  searchResults:      "Search results",  // internal — not shown in UI
  search:             "Search",
  ctaSection:         "Call to action",
  formSection:        "Form",
  // careers / W6
  processSteps:       "Process steps",
  recruiterPanel:     "Recruiter panel",
  // conversion / pricing
  pricingSection:     "Pricing section",
  // content / editorial
  contentSection:     "Content section",
  teamSection:        "Team",
  // new core blocks
  timeline:           "Timeline",
  quickLinks:         "Quick links",
  textMedia:          "Text + media",
  contactSection:     "Contact",
  floatingContact:    "Floating contact button",
  // commerce / product
  productOverview:    "Product overview",
  productDetail:      "Product detail",
  cartSummary:        "Cart summary",
  checkoutBlock:      "Checkout",
  mapBlock:           "Map",
};

// ── Language presets ──────────────────────────────────────────────────────────
//
// Common languages available via the "Add language" dropdown.
// Each preset provides sensible defaults for code, locale, and name.

interface LanguagePreset {
  code:   string;
  locale: string;
  name:   string;
}

const LANGUAGE_PRESETS: readonly LanguagePreset[] = [
  { code: "nl",    locale: "nl_NL", name: "Nederlands"  },
  { code: "en-gb", locale: "en_GB", name: "English"     },
  { code: "en-us", locale: "en_US", name: "English (US)" },
  { code: "de",    locale: "de_DE", name: "Deutsch"     },
  { code: "fr",    locale: "fr_FR", name: "Français"    },
  { code: "es",    locale: "es_ES", name: "Español"     },
  { code: "it",    locale: "it_IT", name: "Italiano"    },
  { code: "pt",    locale: "pt_PT", name: "Português"   },
  { code: "pl",    locale: "pl_PL", name: "Polski"      },
  { code: "da",    locale: "da_DK", name: "Dansk"       },
  { code: "sv",    locale: "sv_SE", name: "Svenska"     },
  { code: "nb",    locale: "nb_NO", name: "Norsk"       },
  { code: "fi",    locale: "fi_FI", name: "Suomi"       },
];

// ── Package diff helpers ──────────────────────────────────────────────────────
//
// Used by PackageSummaryStrip (always shown) and PackageChangeDiff (shown only
// when the form package differs from the saved package).

type DiffDirection = "gain" | "lose";

interface DiffLine {
  label:     string;
  direction: DiffDirection;
}

const FEATURE_DIFF_LABELS: Record<"experiments" | "ai" | "analytics", string> = {
  experiments: "A/B experiments",
  ai:          "AI decision layer",
  analytics:   "Analytics & logging",
};

/** Formats a numeric limit for display in the diff or summary. */
function limitLabel(n: number, zeroLabel = "None"): string {
  if (n === Infinity) return "Unlimited";
  if (n === 0)        return zeroLabel;
  return String(n);
}

/**
 * Computes a list of DiffLines describing what is gained and lost when moving
 * from one package to another.  Covers features, content blocks, themes, and
 * key numeric limits.  Returns an empty array when both packages are identical.
 */
function computePackageDiff(from: PackageDefinition, to: PackageDefinition): DiffLine[] {
  const lines: DiffLine[] = [];

  // Features ─────────────────────────────────────────────────────────────────
  (["experiments", "ai", "analytics"] as const).forEach((k) => {
    const label = FEATURE_DIFF_LABELS[k];
    if (!from.allowedFeatures[k] && to.allowedFeatures[k]) {
      lines.push({ label, direction: "gain" });
    } else if (from.allowedFeatures[k] && !to.allowedFeatures[k]) {
      lines.push({ label, direction: "lose" });
    }
  });

  // Content blocks ───────────────────────────────────────────────────────────
  const gainedBlocks = to.allowedBlocks.content.filter(
    (b) => !from.allowedBlocks.content.includes(b),
  );
  const lostBlocks = from.allowedBlocks.content.filter(
    (b) => !to.allowedBlocks.content.includes(b),
  );
  if (gainedBlocks.length > 0) {
    lines.push({
      label:     `Content blocks: ${gainedBlocks.map((b) => CONTENT_BLOCK_DISPLAY[b]).join(", ")}`,
      direction: "gain",
    });
  }
  if (lostBlocks.length > 0) {
    lines.push({
      label:     `Content blocks removed: ${lostBlocks.map((b) => CONTENT_BLOCK_DISPLAY[b]).join(", ")}`,
      direction: "lose",
    });
  }

  // Themes ───────────────────────────────────────────────────────────────────
  const gainedThemes = to.allowedThemes.filter((t) => !from.allowedThemes.includes(t));
  const lostThemes   = from.allowedThemes.filter((t) => !to.allowedThemes.includes(t));
  if (gainedThemes.length > 0) {
    lines.push({
      label:     `Themes: ${gainedThemes.map((t) => themeLabel(t)).join(", ")}`,
      direction: "gain",
    });
  }
  if (lostThemes.length > 0) {
    lines.push({
      label:     `Themes removed: ${lostThemes.map((t) => themeLabel(t)).join(", ")}`,
      direction: "lose",
    });
  }

  // Numeric limits ───────────────────────────────────────────────────────────
  if (from.limits.maxSites !== to.limits.maxSites) {
    lines.push({
      label:     `Sites: ${limitLabel(from.limits.maxSites)} → ${limitLabel(to.limits.maxSites)}`,
      direction: to.limits.maxSites > from.limits.maxSites ? "gain" : "lose",
    });
  }
  if (from.limits.maxExperiments !== to.limits.maxExperiments) {
    lines.push({
      label: `Concurrent experiments: ${limitLabel(from.limits.maxExperiments, "Not permitted")} → ${limitLabel(to.limits.maxExperiments, "Not permitted")}`,
      direction: to.limits.maxExperiments > from.limits.maxExperiments ? "gain" : "lose",
    });
  }
  if (from.limits.maxVariantsPerSlot !== to.limits.maxVariantsPerSlot) {
    lines.push({
      label:     `Variants per slot: ${limitLabel(from.limits.maxVariantsPerSlot)} → ${limitLabel(to.limits.maxVariantsPerSlot)}`,
      direction: to.limits.maxVariantsPerSlot > from.limits.maxVariantsPerSlot ? "gain" : "lose",
    });
  }

  return lines;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const inputCls = [
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2",
  "text-sm text-neutral-900 placeholder:text-neutral-400",
  "focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200",
  "disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400",
].join(" ");

const selectCls = [
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2",
  "text-sm text-neutral-900",
  "focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200",
  "disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400",
].join(" ");

// ── Helpers ───────────────────────────────────────────────────────────────────

function initFormState(tenant: TenantSettings): FormState {
  return {
    identity: {
      name:              tenant.name              ?? "",
      slug:              tenant.slug              ?? "",
      primaryDomain:     tenant.primaryDomain     ?? "",
      additionalDomains: tenant.additionalDomains ? tenant.additionalDomains.join("\n") : "",
    },
    packageKey: (isValidPackageKey(tenant.packageKey) ? tenant.packageKey : "starter") as PackageKey,
    ai: {
      mode:                tenant.ai?.mode ?? "disabled",
      confidenceThreshold: tenant.ai?.confidenceThreshold !== undefined
                             ? String(tenant.ai.confidenceThreshold)
                             : "",
      liveProvider: {
        name:   tenant.ai?.liveProvider?.name   ?? "",
        apiKey: "",  // page strips stored key; "" means "no new key"
        model:  tenant.ai?.liveProvider?.model  ?? "",
      },
      shadowProvider: {
        name:   tenant.ai?.shadowProvider?.name   ?? "",
        apiKey: "",
        model:  tenant.ai?.shadowProvider?.model  ?? "",
      },
    },
    cms: {
      provider:        (tenant.cms?.provider ?? "mock") as CmsProvider,
      projectId:       tenant.cms?.projectId       ?? "",
      dataset:         tenant.cms?.dataset         ?? "",
      apiVersion:      tenant.cms?.apiVersion      ?? "",
      studioUrl:       tenant.cms?.studioUrl       ?? "",
      statamicBaseUrl: tenant.cms?.statamicBaseUrl ?? "",
    },
    design: {
      theme:        tenant.design?.theme        ?? "default",
      primaryColor: tenant.design?.primaryColor ?? "",
      primaryFont:  tenant.design?.primaryFont  ?? "",
    },
    features: {
      experiments: tenant.features?.experiments ?? false,
      ai:          tenant.features?.ai          ?? false,
      analytics:   tenant.features?.analytics   ?? false,
    },
    blocks: {
      context: [...(tenant.blocks?.context ?? [])],
      content: [...(tenant.blocks?.content ?? [])],
    },
    languages: (tenant.languages ?? []).map((l) => ({
      code:      l.code,
      locale:    l.locale,
      name:      l.name,
      isDefault: l.isDefault,
      enabled:   l.enabled,
    })),
  };
}

/**
 * Converts a provider slot's form state to a TenantAiProviderConfig fragment,
 * or returns an empty object when no provider name is selected.
 *
 * apiKey is included only when the user typed a new value; an empty string
 * means "keep the existing key" and is intentionally omitted so the server
 * action can fill it back in from the stored record.
 */
function buildProviderSlotSettings(
  key:  "liveProvider" | "shadowProvider",
  slot: ProviderSlotState,
): Partial<Pick<TenantAiSettings, "liveProvider" | "shadowProvider">> {
  if (!slot.name) return {};
  return {
    [key]: {
      name:  slot.name as TenantAiProviderName,
      ...(slot.apiKey.trim() ? { apiKey: slot.apiKey.trim() } : {}),
      ...(slot.model.trim()  ? { model:  slot.model.trim() }  : {}),
    },
  };
}

/** Converts form state back to a valid TenantSettings shape for saving. */
function formStateToSettings(tenantId: string, form: FormState): TenantSettings {
  const rawThreshold = parseFloat(form.ai.confidenceThreshold);
  const validThreshold =
    Number.isFinite(rawThreshold) && rawThreshold >= 0 && rawThreshold <= 1;

  // Parse additionalDomains textarea — split on newlines, trim each line,
  // discard empty lines and duplicates.
  const parsedAdditionalDomains = [
    ...new Set(
      form.identity.additionalDomains
        .split("\n")
        .map((d) => d.trim())
        .filter(Boolean),
    ),
  ];

  return {
    tenantId,
    // Identity
    ...(form.identity.name.trim()         ? { name:              form.identity.name.trim()         } : {}),
    ...(form.identity.slug.trim()         ? { slug:              form.identity.slug.trim()         } : {}),
    ...(form.identity.primaryDomain.trim() ? { primaryDomain:    form.identity.primaryDomain.trim() } : {}),
    ...(parsedAdditionalDomains.length > 0 ? { additionalDomains: parsedAdditionalDomains }          : {}),
    packageKey: form.packageKey,
    features: {
      experiments: form.features.experiments,
      ai:          form.features.ai,
      analytics:   form.features.analytics,
    },
    blocks: {
      context: form.blocks.context,
      content: form.blocks.content,
    },
    ai: {
      mode: form.ai.mode,
      ...(validThreshold ? { confidenceThreshold: rawThreshold } : {}),
      // Include both provider slots regardless of current mode so that
      // switching modes doesn't discard the configuration for the other slot.
      ...buildProviderSlotSettings("liveProvider",   form.ai.liveProvider),
      ...buildProviderSlotSettings("shadowProvider", form.ai.shadowProvider),
    },
    cms: {
      provider: form.cms.provider,
      ...(form.cms.projectId.trim()       ? { projectId:       form.cms.projectId.trim() }       : {}),
      ...(form.cms.dataset.trim()         ? { dataset:         form.cms.dataset.trim() }         : {}),
      ...(form.cms.apiVersion.trim()      ? { apiVersion:      form.cms.apiVersion.trim() }      : {}),
      ...(form.cms.studioUrl.trim()       ? { studioUrl:       form.cms.studioUrl.trim() }       : {}),
      ...(form.cms.statamicBaseUrl.trim() ? { statamicBaseUrl: form.cms.statamicBaseUrl.trim() } : {}),
    },
    design: {
      theme: form.design.theme,
      ...(form.design.primaryColor.trim() ? { primaryColor: form.design.primaryColor.trim() } : {}),
      ...(form.design.primaryFont.trim()  ? { primaryFont:  form.design.primaryFont.trim() }  : {}),
    },
    ...(form.languages.length > 0
      ? {
          languages: form.languages.map((l): TenantLanguageConfig => ({
            code:      l.code.trim(),
            locale:    l.locale.trim(),
            name:      l.name.trim(),
            isDefault: l.isDefault,
            enabled:   l.enabled,
          })),
        }
      : {}),
  };
}

/** Toggles an item in an array — adds if absent, removes if present. */
function toggleItem<T>(arr: readonly T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
}

// ── Atoms ─────────────────────────────────────────────────────────────────────

function SectionCard({
  title,
  badge,
  hint,
  children,
}: {
  title:    string;
  badge?:   string;
  hint?:    string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Text variant="h4">{title}</Text>
          {badge && (
            <Badge variant="outline" size="sm">
              {badge}
            </Badge>
          )}
        </div>
        {hint && (
          <p className="text-xs text-neutral-500">{hint}</p>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-neutral-700">{label}</label>
      {hint && <p className="text-xs text-neutral-400">{hint}</p>}
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
        "transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2",
        checked ? "bg-brand-600" : "bg-neutral-200",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm",
          "transition duration-200 ease-in-out",
          checked ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  );
}

function ToggleRow({
  label,
  hint,
  blockedHint,
  checked,
  onChange,
  disabled,
}: {
  label:        string;
  hint?:        string;
  blockedHint?: string;
  checked:      boolean;
  onChange:     (v: boolean) => void;
  disabled?:    boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-neutral-100 py-3 last:border-0">
      <div className="space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-neutral-700">{label}</span>
          {blockedHint && (
            <Badge variant="outline" size="sm">
              {blockedHint}
            </Badge>
          )}
        </div>
        {hint && <p className="text-xs text-neutral-400">{hint}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

// ── PackageSummaryStrip ────────────────────────────────────────────────────────
//
// Always-visible summary beneath the package selector.  Shows the selected
// package's positioning statement and key limits at a glance so the admin
// knows exactly what they are configuring without opening a docs page.

function PackageSummaryStrip({ pkgDef }: { pkgDef: PackageDefinition }) {
  const opt = getPackageOption(pkgDef.key);

  const siteLabel = pkgDef.limits.maxSites === Infinity
    ? "Unlimited sites"
    : pkgDef.limits.maxSites === 1
      ? "1 site"
      : `Up to ${pkgDef.limits.maxSites} sites`;

  const expLabel = pkgDef.limits.maxExperiments === 0
    ? "No experiments"
    : pkgDef.limits.maxExperiments === Infinity
      ? "Unlimited experiments"
      : `Up to ${pkgDef.limits.maxExperiments} experiments`;

  const variantLabel = pkgDef.limits.maxVariantsPerSlot === Infinity
    ? "Unlimited variants/slot"
    : `Up to ${pkgDef.limits.maxVariantsPerSlot} variants/slot`;

  const chips = [siteLabel, expLabel, variantLabel];

  return (
    <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5">
      {/* Positioning statement */}
      <p className="text-xs italic text-neutral-500">{pkgDef.shortDescription}</p>

      {/* Key highlights — plain-language selling points from the package definition */}
      <ul className="space-y-0.5">
        {opt.highlights.slice(0, 4).map((h, i) => (
          <li key={i} className="flex items-start gap-1.5 text-xs text-neutral-600">
            <span className="mt-px shrink-0 text-success-500" aria-hidden>✓</span>
            {h}
          </li>
        ))}
      </ul>

      {/* Operational limits */}
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 border-t border-neutral-200 pt-1.5">
        {chips.map((chip, i) => (
          <span key={i} className="text-xs text-neutral-400">
            {i > 0 && <span className="mr-1.5 text-neutral-300">·</span>}
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── PackageChangeDiff ─────────────────────────────────────────────────────────
//
// Shown only when the in-form packageKey differs from the saved packageKey.
// Computes a list of gains and losses between the two definitions and presents
// them as a compact before→after panel with green/red indicators.
//
// A downgrade warning reminds the admin that settings outside the new package's
// limits will be normalised automatically when the save is submitted.

function PackageChangeDiff({
  from,
  to,
}: {
  from: PackageDefinition;
  to:   PackageDefinition;
}) {
  const diff    = computePackageDiff(from, to);
  const gains   = diff.filter((d) => d.direction === "gain");
  const losses  = diff.filter((d) => d.direction === "lose");
  const toOpt   = getPackageOption(to.key);

  if (diff.length === 0) return null;

  return (
    <div className="space-y-3 rounded-lg border border-neutral-200 bg-white px-3 py-3">
      <div>
        <p className="text-xs font-semibold text-neutral-500">
          Switching {from.displayName} → {to.displayName}
        </p>
        <p className="mt-0.5 text-xs text-neutral-400">{toOpt.recommendedFor}</p>
      </div>

      {gains.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-success-600">
            Gains
          </p>
          {gains.map((line, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="shrink-0 text-xs font-bold leading-4 text-success-600">+</span>
              <span className="text-xs text-neutral-700">{line.label}</span>
            </div>
          ))}
        </div>
      )}

      {losses.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-error-600">
            Loses
          </p>
          {losses.map((line, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="shrink-0 text-xs font-bold leading-4 text-error-600">−</span>
              <span className="text-xs text-neutral-700">{line.label}</span>
            </div>
          ))}
          <p className="pt-1 text-xs text-neutral-400">
            ⚠ Settings outside {to.displayName} limits will be adjusted automatically when you save.
          </p>
        </div>
      )}
    </div>
  );
}

// ── ProviderSlotFields ─────────────────────────────────────────────────────────
//
// Renders the three inputs for a single provider slot (name, api key, model).
// The API key input is always type="password".  When an existing key is stored
// and the user has not typed a new one, a hint explains that the key is
// preserved automatically — the blank field does NOT mean "delete the key".

function ProviderSlotFields({
  label,
  state,
  hasExistingKey,
  disabled,
  onChange,
}: {
  label:          string;
  state:          ProviderSlotState;
  hasExistingKey: boolean;
  disabled:       boolean;
  onChange:       (next: ProviderSlotState) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{label}</p>

      <Field label="Provider">
        <select
          value={state.name}
          disabled={disabled}
          onChange={(e) => onChange({ ...state, name: e.target.value })}
          className={selectCls}
        >
          {ALL_AI_PROVIDERS.map((p) => (
            <option key={p} value={p} disabled={p === "gemini"}>
              {AI_PROVIDER_DISPLAY[p]}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="API key"
        hint={
          !state.apiKey && hasExistingKey
            ? "Key is configured. Leave blank to keep it unchanged, or enter a new key to replace it."
            : "Stored server-side only and never returned to the browser."
        }
      >
        <input
          type="password"
          autoComplete="new-password"
          value={state.apiKey}
          disabled={disabled || !state.name}
          placeholder={hasExistingKey ? "••••••••  (configured)" : "Paste key here"}
          onChange={(e) => onChange({ ...state, apiKey: e.target.value })}
          className={inputCls}
        />
      </Field>

      <Field label="Model override" hint="Leave blank to use the platform default for the selected provider.">
        <input
          type="text"
          value={state.model}
          disabled={disabled || !state.name}
          placeholder={
            state.name === "claude"  ? "claude-3-5-haiku-20241022" :
            state.name === "openai"  ? "gpt-4o-mini" :
            "e.g. gemini-1.5-flash"
          }
          onChange={(e) => onChange({ ...state, model: e.target.value })}
          className={inputCls}
        />
      </Field>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TenantSettingsForm({
  tenant,
  existingKeys = { hasLiveKey: false, hasShadowKey: false },
  isSuperAdmin = false,
  planFeatures,
}: {
  tenant:        TenantSettings;
  existingKeys?: { hasLiveKey: boolean; hasShadowKey: boolean };
  /** When false the Package selector is read-only — tenant-admin users cannot
   *  override their plan directly.  They manage their subscription via the
   *  Billing page instead. */
  isSuperAdmin?: boolean;
  /** Effective plan feature flags — overrides package-level defaults when provided.
   *  Use to enforce DB-configured billing plan features (e.g. aiDecisioning, abExperiments). */
  planFeatures?: { aiDecisioning: boolean; abExperiments: boolean };
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => initFormState(tenant));
  const [isPending, startTransition] = useTransition();
  const [saveResult, setSaveResult] = useState<{ ok: boolean; message: string; warnings?: string[] } | null>(null);

  // Blueprint sync state (Statamic only)
  const [isSyncingBlueprint, startSyncTransition] = useTransition();
  const [syncBlueprintResult, setSyncBlueprintResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Derived — recomputed on every render from the current packageKey.
  const pkgDef = getPackageDefinition(form.packageKey);

  // ── Effective feature gates ─────────────────────────────────────────────────
  // planFeatures (from billing_plans DB table) takes precedence over package-level defaults.
  // This ensures admin-configured plan feature changes take effect without code deploys.
  const canUseAi          = planFeatures !== undefined ? planFeatures.aiDecisioning  : pkgDef.allowedFeatures.ai;
  const canUseExperiments = planFeatures !== undefined ? planFeatures.abExperiments  : pkgDef.allowedFeatures.experiments;

  // ── Section-level contextual hints ─────────────────────────────────────────
  // Computed from current form state so they stay in sync as the user edits.

  const aiSectionHint: string | undefined =
    !canUseAi
      ? "AI Decisioning is not enabled on this tenant's current plan. Update the plan in /admin/platform/billing/plans to unlock shadow or live mode."
      : form.ai.mode === "shadow"
        ? "Shadow mode logs AI decisions but never serves them to visitors. Good for evaluating model quality before going live."
        : form.ai.mode === "live"
          ? "Live mode may override the rules engine when the AI confidence score meets the threshold. Monitor results closely."
          : undefined;

  const cmsSectionHint: string | undefined =
    form.cms.provider === "platform"
      ? "Platform CMS stores variant content directly in your Mister Chameleon database. No external CMS needed. Edit variants on the Content tab."
      : form.cms.provider === "mock"
        ? "Mock provider is for local development only. Switch to a real CMS provider before going live."
        : !form.cms.projectId.trim()
          ? "Enter the project ID and dataset below to fully configure this CMS integration."
          : undefined;

  const blocksSectionHint: string | undefined =
    "Context blocks are rendered and personalised by the adaptive rules engine. Content blocks are CMS-authored page sections. Both lists are capped by your package.";

  const featuresSectionHint: string | undefined =
    "Features marked with a package badge cannot be enabled on the current plan. Upgrade the package to unlock them.";

  // Clear the save banner whenever the user changes anything.
  useEffect(() => {
    setSaveResult(null);
  }, [form]);

  // ── Package change ──────────────────────────────────────────────────────────
  //
  // When the package changes we clean up any selections that are no longer
  // valid: resets AI mode to "disabled" if AI isn't allowed, clamps the theme
  // to the first allowed value, and removes blocked blocks + features.

  function handlePackageChange(newKey: PackageKey) {
    const pkg = getPackageDefinition(newKey);
    setForm((prev) => ({
      ...prev,
      packageKey: newKey,
      features: {
        experiments: prev.features.experiments && pkg.allowedFeatures.experiments,
        ai:          prev.features.ai && pkg.allowedFeatures.ai,
        analytics:   prev.features.analytics, // always available
      },
      ai: {
        ...prev.ai,
        // If AI is no longer allowed, force mode back to disabled.
        mode: !pkg.allowedFeatures.ai && prev.ai.mode !== "disabled"
          ? "disabled"
          : prev.ai.mode,
        // Provider slot state is preserved across package changes.
      },
      design: {
        ...prev.design,
        theme: pkg.allowedThemes.includes(prev.design.theme)
          ? prev.design.theme
          : pkg.allowedThemes[0],
      },
      blocks: {
        context: prev.blocks.context.filter((b) => pkg.allowedBlocks.context.includes(b)),
        content: prev.blocks.content.filter((b) => pkg.allowedBlocks.content.includes(b)),
      },
    }));
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  function handleSave() {
    startTransition(async () => {
      try {
        const settings = formStateToSettings(tenant.tenantId, form);
        const result   = await saveTenantAction(settings);
        setSaveResult(
          result.ok
            ? { ok: true,  message: "Settings saved.", warnings: result.warnings }
            : { ok: false, message: result.error },
        );
        if (result.ok) {
          // Re-render the server shell so the page header badges (package
          // tier, active status) immediately reflect the saved values.
          // This does not reset form state — only server components refresh.
          router.refresh();
        }
      } catch (err) {
        setSaveResult({
          ok:      false,
          message: err instanceof Error ? err.message : "An unexpected error occurred.",
        });
      }
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl space-y-6">

      {/* ── Identity ──────────────────────────────────────────────────────── */}
      <SectionCard
        title="Identity"
        hint="Public-facing name, URL slug, and domain configuration. The tenant ID (below) stays fixed. These fields can all be changed after creation."
      >
        <div className="space-y-4">
          <Field
            label="Display name"
            hint="Human-readable name shown in admin UIs and CMS content labels."
          >
            <input
              type="text"
              value={form.identity.name}
              placeholder="e.g. Acme Corp"
              onChange={(e) =>
                setForm((f) => ({ ...f, identity: { ...f.identity, name: e.target.value } }))
              }
              className={inputCls}
            />
          </Field>

          <Field
            label="Slug"
            hint="URL-safe public identifier. Lowercase letters, digits, and hyphens only."
          >
            <input
              type="text"
              value={form.identity.slug}
              placeholder="e.g. acme-corp"
              pattern="^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$"
              onChange={(e) =>
                setForm((f) => ({ ...f, identity: { ...f.identity, slug: e.target.value.toLowerCase() } }))
              }
              className={inputCls}
            />
          </Field>

          <Field
            label="Primary domain"
            hint="Production hostname for domain-based routing. No protocol (e.g. acme.com, not https://acme.com)."
          >
            <input
              type="text"
              value={form.identity.primaryDomain}
              placeholder="e.g. acme.com"
              onChange={(e) =>
                setForm((f) => ({ ...f, identity: { ...f.identity, primaryDomain: e.target.value.toLowerCase().trim() } }))
              }
              className={inputCls}
            />
          </Field>

          <Field
            label="Additional domains"
            hint="Extra hostnames (www, staging, etc.), one per line. Same format as primary domain."
          >
            <textarea
              value={form.identity.additionalDomains}
              rows={3}
              placeholder={"www.acme.com\nstaging.acme.com"}
              onChange={(e) =>
                setForm((f) => ({ ...f, identity: { ...f.identity, additionalDomains: e.target.value } }))
              }
              className={cn(inputCls, "resize-y")}
            />
          </Field>
        </div>
      </SectionCard>

      {/* ── Package ───────────────────────────────────────────────────────── */}
      <SectionCard
        title="Package"
        badge={isSuperAdmin ? "Super-admin" : undefined}
        hint={
          isSuperAdmin
            ? "The commercial tier determines which blocks, themes, AI capabilities, and experiment limits are available to this tenant. Only super-admins can change this directly."
            : "Your current plan and entitlements. To upgrade, downgrade, or manage your payment method, go to the Billing page."
        }
      >
        <div className="space-y-4">
          <Field
            label="Tenant ID"
            hint="The stable slug used as a primary key. Cannot be changed after creation."
          >
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-mono text-neutral-500">
              {tenant.tenantId}
            </div>
          </Field>

          {isSuperAdmin ? (
            /* ── Super-admin: editable package selector ── */
            <>
              <Field label="Package">
                <select
                  value={form.packageKey}
                  onChange={(e) => handlePackageChange(e.target.value as PackageKey)}
                  className={selectCls}
                >
                  {ALL_PACKAGES.map((key) => (
                    <option key={key} value={key}>
                      {PACKAGE_DISPLAY[key]}
                    </option>
                  ))}
                </select>
              </Field>

              {/* Always-visible package summary — description + key limits */}
              <PackageSummaryStrip pkgDef={pkgDef} />

              {/* Change diff — only shown when the package selection has changed */}
              {form.packageKey !== tenant.packageKey && isValidPackageKey(tenant.packageKey) && (
                <PackageChangeDiff
                  from={getPackageDefinition(tenant.packageKey)}
                  to={pkgDef}
                />
              )}
            </>
          ) : (
            /* ── Tenant-admin: read-only plan display + billing link ── */
            <>
              <Field label="Current plan">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-700">
                    {PACKAGE_DISPLAY[tenant.packageKey]}
                  </div>
                  <a
                    href={`/admin/tenants/${tenant.tenantId}/billing`}
                    className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 transition-colors"
                  >
                    Manage subscription →
                  </a>
                </div>
              </Field>

              {/* Read-only summary of current entitlements */}
              <PackageSummaryStrip pkgDef={pkgDef} />

              <p className="text-xs text-neutral-400">
                To upgrade or downgrade your plan, add a payment method, or view your invoices,
                use the{" "}
                <a
                  href={`/admin/tenants/${tenant.tenantId}/billing`}
                  className="font-medium text-brand-600 underline hover:no-underline"
                >
                  Billing page
                </a>
                .
              </p>
            </>
          )}
        </div>
      </SectionCard>

      {/* ── AI ────────────────────────────────────────────────────────────── */}
      <SectionCard
        title="AI Settings"
        badge={!canUseAi ? "Pro plan required" : undefined}
        hint={aiSectionHint}
      >
        <div className="space-y-4">
          <Field label="Mode">
            <select
              value={form.ai.mode}
              disabled={!canUseAi}
              onChange={(e) =>
                setForm((f) => ({ ...f, ai: { ...f.ai, mode: e.target.value as AiMode } }))
              }
              className={selectCls}
            >
              {ALL_AI_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {AI_MODE_DISPLAY[mode]}
                </option>
              ))}
            </select>
          </Field>

          {/* Live provider — shown when mode is "live" */}
          {form.ai.mode === "live" && (
            <ProviderSlotFields
              label="Live provider"
              state={form.ai.liveProvider}
              hasExistingKey={existingKeys.hasLiveKey}
              disabled={!canUseAi}
              onChange={(next) =>
                setForm((f) => ({ ...f, ai: { ...f.ai, liveProvider: next } }))
              }
            />
          )}

          {/* Shadow provider — shown when mode is "shadow" */}
          {form.ai.mode === "shadow" && (
            <ProviderSlotFields
              label="Shadow provider"
              state={form.ai.shadowProvider}
              hasExistingKey={existingKeys.hasShadowKey}
              disabled={!canUseAi}
              onChange={(next) =>
                setForm((f) => ({ ...f, ai: { ...f.ai, shadowProvider: next } }))
              }
            />
          )}

          <Field
            label="Confidence threshold"
            hint={
              form.ai.mode !== "live"
                ? "Only applied in live mode. Edit when mode is Live."
                : "Minimum confidence score to serve an AI plan. Range: 0–1. Platform default: 0.70."
            }
          >
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={form.ai.confidenceThreshold}
              disabled={!canUseAi || form.ai.mode !== "live"}
              placeholder="0.70"
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  ai: { ...f.ai, confidenceThreshold: e.target.value },
                }))
              }
              className={inputCls}
            />
          </Field>
        </div>
      </SectionCard>

      {/* ── CMS ───────────────────────────────────────────────────────────── */}
      <SectionCard title="CMS Settings" hint={cmsSectionHint}>
        <div className="space-y-4">
          <Field label="Provider">
            <select
              value={form.cms.provider}
              onChange={(e) => {
                const next = e.target.value as CmsProvider;
                setForm((f) => ({
                  ...f,
                  cms: {
                    ...f.cms,
                    provider: next,
                    // Clear provider-specific credential fields on switch so stale
                    // values from the previous provider (e.g. a Sanity projectId)
                    // are not saved alongside the new provider and don't trigger
                    // SDK validation errors in the CMS factory.
                    projectId:  "",
                    dataset:    "",
                    apiVersion: "",
                    studioUrl:  "",
                  },
                }));
              }}
              className={selectCls}
            >
              {ALL_CMS_PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {CMS_PROVIDER_DISPLAY[p]}
                </option>
              ))}
            </select>
          </Field>

          {/* Platform CMS info panel — no credentials needed */}
          {form.cms.provider === "platform" && (
            <div className="rounded-md border border-brand-200 bg-brand-50 px-3 py-3 text-xs text-brand-700 space-y-1">
              <p className="font-semibold">✓ No external CMS required</p>
              <p>
                Variant content (hero, proof, CTA) is stored directly in the Mister Chameleon database.
                Edit content on the{" "}
                <a
                  href={`/admin/tenants/${tenant.tenantId}/content`}
                  className="underline font-medium hover:no-underline"
                >
                  Content tab →
                </a>
              </p>
              <p className="text-brand-500">
                Note: Page structure, navigation, and entity documents (news, vacancies) are not
                supported in Platform CMS. For full page management, connect an external CMS.
              </p>
            </div>
          )}

          {/* Validation warning: projectId + dataset are required for Sanity only.
              Storyblok and Statamic use platform-level credentials (env vars or
              Platform → CMS settings) so leaving these blank is valid for them. */}
          {form.cms.provider === "sanity" && !form.cms.projectId.trim() && (
            <div className="rounded-md border border-warning-300 bg-warning-50 px-3 py-2 text-xs text-warning-700">
              <strong>⚠ Project ID required</strong>. Sanity pages will not load until a Project ID is configured.
              {!form.cms.dataset.trim() && " Dataset is also required."}
            </div>
          )}
          {form.cms.provider === "sanity" && form.cms.projectId.trim() && !form.cms.dataset.trim() && (
            <div className="rounded-md border border-warning-300 bg-warning-50 px-3 py-2 text-xs text-warning-700">
              <strong>⚠ Dataset required</strong>. Enter the Sanity dataset name (e.g. <code>production</code>).
            </div>
          )}

          {/* Credential fields — hidden for platform and mock providers */}
          {form.cms.provider !== "platform" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={CMS_FIELD_LABELS[form.cms.provider].projectId}
                  hint={form.cms.provider === "sanity" ? "Required, overrides SANITY_PROJECT_ID" : undefined}
                >
                  <input
                    type="text"
                    value={form.cms.projectId}
                    disabled={form.cms.provider === "mock"}
                    placeholder={form.cms.provider === "mock" ? "Not required" : "e.g. in3s2m2m"}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, cms: { ...f.cms, projectId: e.target.value } }))
                    }
                    className={inputCls}
                  />
                </Field>

                <Field
                  label={CMS_FIELD_LABELS[form.cms.provider].dataset}
                  hint={form.cms.provider === "sanity" ? "Required, overrides SANITY_DATASET" : undefined}
                >
                  <input
                    type="text"
                    value={form.cms.dataset}
                    disabled={form.cms.provider === "mock"}
                    placeholder={form.cms.provider === "mock" ? "Not required" : "e.g. production"}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, cms: { ...f.cms, dataset: e.target.value } }))
                    }
                    className={inputCls}
                  />
                </Field>
              </div>

              {/* Sanity-specific optional fields */}
              {form.cms.provider === "sanity" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="API Version"
                    hint="Optional, overrides SANITY_API_VERSION (e.g. 2024-01-01)"
                  >
                    <input
                      type="text"
                      value={form.cms.apiVersion ?? ""}
                      placeholder="Leave blank to use platform default"
                      onChange={(e) =>
                        setForm((f) => ({ ...f, cms: { ...f.cms, apiVersion: e.target.value } }))
                      }
                      className={inputCls}
                    />
                  </Field>

                  <Field
                    label="Studio URL"
                    hint="Optional, URL of the Sanity Studio for this tenant"
                  >
                    <input
                      type="url"
                      value={form.cms.studioUrl ?? ""}
                      placeholder="https://my-studio.sanity.studio"
                      onChange={(e) =>
                        setForm((f) => ({ ...f, cms: { ...f.cms, studioUrl: e.target.value } }))
                      }
                      className={inputCls}
                    />
                  </Field>
                </div>
              )}

              {/* Statamic-specific optional fields */}
              {form.cms.provider === "statamic" && (
                <Field
                  label="Base URL"
                  hint="Optional, overrides the platform-level Statamic base URL for this tenant"
                >
                  <input
                    type="url"
                    value={form.cms.statamicBaseUrl ?? ""}
                    placeholder="Leave blank to use platform default"
                    onChange={(e) =>
                      setForm((f) => ({ ...f, cms: { ...f.cms, statamicBaseUrl: e.target.value } }))
                    }
                    className={inputCls}
                  />
                </Field>
              )}
            </>
          )}
        </div>
      </SectionCard>

      {/* ── Languages ─────────────────────────────────────────────────────── */}
      <SectionCard
        title="Languages"
        hint="Configure the languages for this tenant. Multi-lingual support requires Statamic. The language list is used to generate resources/sites.yaml on sync."
      >
        <div className="space-y-4">
          {/* Validation warning */}
          {form.languages.length > 0 &&
            form.languages.filter((l) => l.isDefault).length !== 1 && (
              <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {form.languages.filter((l) => l.isDefault).length === 0
                  ? "No default language set. Exactly one language must be marked as default."
                  : "Multiple default languages. Exactly one language must be marked as default."}
              </p>
            )}

          {/* Language rows */}
          {form.languages.length === 0 ? (
            <p className="text-sm text-neutral-500">
              No languages configured. Add a language below to enable multi-lingual support.
            </p>
          ) : (
            <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
              {form.languages.map((lang, idx) => (
                <div
                  key={idx}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  {/* Code */}
                  <div className="flex w-24 flex-col gap-0.5">
                    <label className="text-xs font-medium text-neutral-500">Code</label>
                    <input
                      type="text"
                      value={lang.code}
                      placeholder="nl"
                      onChange={(e) =>
                        setForm((f) => {
                          const langs = [...f.languages];
                          langs[idx] = { ...langs[idx], code: e.target.value };
                          return { ...f, languages: langs };
                        })
                      }
                      className={inputCls}
                    />
                  </div>

                  {/* Locale */}
                  <div className="flex w-28 flex-col gap-0.5">
                    <label className="text-xs font-medium text-neutral-500">Locale</label>
                    <input
                      type="text"
                      value={lang.locale}
                      placeholder="nl_NL"
                      onChange={(e) =>
                        setForm((f) => {
                          const langs = [...f.languages];
                          langs[idx] = { ...langs[idx], locale: e.target.value };
                          return { ...f, languages: langs };
                        })
                      }
                      className={inputCls}
                    />
                  </div>

                  {/* Name */}
                  <div className="flex min-w-32 flex-1 flex-col gap-0.5">
                    <label className="text-xs font-medium text-neutral-500">Name</label>
                    <input
                      type="text"
                      value={lang.name}
                      placeholder="Nederlands"
                      onChange={(e) =>
                        setForm((f) => {
                          const langs = [...f.languages];
                          langs[idx] = { ...langs[idx], name: e.target.value };
                          return { ...f, languages: langs };
                        })
                      }
                      className={inputCls}
                    />
                  </div>

                  {/* Default toggle */}
                  <div className="flex flex-col items-center gap-0.5">
                    <label className="text-xs font-medium text-neutral-500">Default</label>
                    <button
                      type="button"
                      title={lang.isDefault ? "Default language" : "Set as default"}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          languages: f.languages.map((l, i) => ({
                            ...l,
                            isDefault: i === idx,
                          })),
                        }))
                      }
                      className={cn(
                        "h-7 rounded-full px-2.5 text-xs font-medium transition-colors",
                        lang.isDefault
                          ? "bg-brand-100 text-brand-700 ring-1 ring-brand-300"
                          : "bg-neutral-100 text-neutral-400 hover:bg-neutral-200",
                      )}
                    >
                      {lang.isDefault ? "Default" : "Set default"}
                    </button>
                  </div>

                  {/* Enabled toggle */}
                  <div className="flex flex-col items-center gap-0.5">
                    <label className="text-xs font-medium text-neutral-500">Visible</label>
                    <button
                      type="button"
                      title={lang.enabled ? "Publicly visible (showSite: true)" : "Staged, not publicly visible (showSite: false)"}
                      onClick={() =>
                        setForm((f) => {
                          const langs = [...f.languages];
                          langs[idx] = { ...langs[idx], enabled: !langs[idx].enabled };
                          return { ...f, languages: langs };
                        })
                      }
                      className={cn(
                        "h-7 rounded-full px-2.5 text-xs font-medium transition-colors",
                        lang.enabled
                          ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300"
                          : "bg-neutral-100 text-neutral-400 hover:bg-neutral-200",
                      )}
                    >
                      {lang.enabled ? "Live" : "Staged"}
                    </button>
                  </div>

                  {/* Remove */}
                  <div className="flex flex-col items-center gap-0.5">
                    <label className="text-xs font-medium text-neutral-500 opacity-0">Remove</label>
                    <button
                      type="button"
                      title={lang.isDefault ? "Cannot remove the default language" : "Remove language"}
                      disabled={lang.isDefault}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          languages: f.languages.filter((_, i) => i !== idx),
                        }))
                      }
                      className="h-7 rounded px-2 text-xs text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add language */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-neutral-600">Add:</span>
            <select
              value=""
              onChange={(e) => {
                const preset = LANGUAGE_PRESETS.find((p) => p.code === e.target.value);
                if (!preset) return;
                const alreadyAdded = form.languages.some((l) => l.code === preset.code);
                if (alreadyAdded) return;
                const isFirstLanguage = form.languages.length === 0;
                setForm((f) => ({
                  ...f,
                  languages: [
                    ...f.languages,
                    {
                      code:      preset.code,
                      locale:    preset.locale,
                      name:      preset.name,
                      isDefault: isFirstLanguage,
                      enabled:   true,
                    },
                  ],
                }));
              }}
              className={cn(selectCls, "w-auto")}
            >
              <option value="">— Select language preset —</option>
              {LANGUAGE_PRESETS.filter(
                (p) => !form.languages.some((l) => l.code === p.code),
              ).map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  languages: [
                    ...f.languages,
                    {
                      code:      "",
                      locale:    "",
                      name:      "",
                      isDefault: f.languages.length === 0,
                      enabled:   true,
                    },
                  ],
                }))
              }
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-600 transition-colors hover:bg-neutral-50"
            >
              + Custom language
            </button>
          </div>
        </div>
      </SectionCard>

      {/* ── Design ────────────────────────────────────────────────────────── */}
      <SectionCard title="Design">
        <div className="space-y-4">
          <Field label="Theme preset">
            <select
              value={form.design.theme}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  design: { ...f.design, theme: e.target.value as ThemeKey },
                }))
              }
              className={selectCls}
            >
              {pkgDef.allowedThemes.map((t) => {
                const hint = themeHint(t, pkgDef.allowedThemes);
                return (
                  <option key={t} value={t}>
                    {themeLabel(t)}
                    {hint ? ` — ${hint}` : ""}
                  </option>
                );
              })}
            </select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Primary colour" hint="Any valid CSS colour value.">
              <input
                type="text"
                value={form.design.primaryColor}
                placeholder="#e63946 or hsl(354,73%,56%)"
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    design: { ...f.design, primaryColor: e.target.value },
                  }))
                }
                className={inputCls}
              />
            </Field>

            <Field label="Primary font" hint="CSS font-family stack.">
              <input
                type="text"
                value={form.design.primaryFont}
                placeholder="'Inter', sans-serif"
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    design: { ...f.design, primaryFont: e.target.value },
                  }))
                }
                className={inputCls}
              />
            </Field>
          </div>
        </div>
      </SectionCard>

      {/* ── Blocks ────────────────────────────────────────────────────────── */}
      <SectionCard title="Allowed Blocks" hint={blocksSectionHint}>
        <BlockCatalogue
          pkgAllowedContext={pkgDef.allowedBlocks.context}
          pkgAllowedContent={pkgDef.allowedBlocks.content}
          enabledContext={form.blocks.context}
          enabledContent={form.blocks.content}
          onContextToggle={(key, enabled) =>
            setForm((f) => ({
              ...f,
              blocks: {
                ...f.blocks,
                context: enabled
                  ? [...f.blocks.context, key]
                  : f.blocks.context.filter((k) => k !== key),
              },
            }))
          }
          onContentToggle={(key, enabled) =>
            setForm((f) => ({
              ...f,
              blocks: {
                ...f.blocks,
                content: enabled
                  ? [...f.blocks.content, key]
                  : f.blocks.content.filter((k) => k !== key),
              },
            }))
          }
          contentBlockHints={CONTENT_BLOCK_HINTS}
        />

        {/* Per-block-type default motion effects. Saves independently of this
            form (its own focused action), like the Design effects editor. */}
        <div className="mt-6 border-t border-neutral-200 pt-5">
          <p className="text-sm font-medium text-neutral-800">Default motion per block type</p>
          <p className="mt-0.5 mb-3 text-xs text-neutral-500 max-w-2xl">
            Give every block of a type the same entrance or emphasis effect by default. A block with
            its own effect overrides this; empty falls back to the tenant-wide default.
          </p>
          <BlockTypeEffectsEditor
            tenantId={tenant.tenantId}
            initial={tenant.design?.blockTypeEffects ?? {}}
          />
        </div>

        {/* Statamic Blueprint Sync — only visible when the tenant uses Statamic */}
        {form.cms.provider === "statamic" && (
          <div className="mt-5 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-800">Sync Statamic blueprint</p>
                <p className="mt-0.5 text-xs text-neutral-500 max-w-sm">
                  Regenerates <code className="font-mono text-[11px]">pages.yaml</code> from the
                  block settings above. The Statamic CP will immediately show only the enabled tabs
                  and content sets. Requires <code className="font-mono text-[11px]">STATAMIC_CMS_PATH</code> to be configured.
                </p>
              </div>
              <button
                type="button"
                disabled={isSyncingBlueprint || isPending}
                onClick={() => {
                  setSyncBlueprintResult(null);
                  startSyncTransition(async () => {
                    const result = await syncStatamicBlueprintAction(tenant.tenantId);
                    if (result.ok) {
                      setSyncBlueprintResult({
                        ok:      true,
                        message: `Blueprint + platform files synced. ${result.contextBlocks} context slot${result.contextBlocks !== 1 ? "s" : ""}, ${result.contentBlocks} content block${result.contentBlocks !== 1 ? "s" : ""}, ${result.fieldsetsCount} platform file${result.fieldsetsCount !== 1 ? "s" : ""}${result.sitesCount > 0 ? `, ${result.sitesCount} site${result.sitesCount !== 1 ? "s" : ""} in sites.yaml` : ""}.`,
                      });
                    } else {
                      setSyncBlueprintResult({ ok: false, message: result.error });
                    }
                  });
                }}
                className={cn(
                  "shrink-0 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700",
                  "hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                {isSyncingBlueprint ? "Syncing…" : "Sync blueprint + fieldsets"}
              </button>
            </div>

            {syncBlueprintResult && (
              <p className={cn(
                "mt-2 text-xs",
                syncBlueprintResult.ok ? "text-success-600" : "text-error-600",
              )}>
                {syncBlueprintResult.ok ? "✓ " : "⚠ "}{syncBlueprintResult.message}
              </p>
            )}
          </div>
        )}
      </SectionCard>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <SectionCard title="Features" hint={featuresSectionHint}>
        <div>
          <ToggleRow
            label="Experiments"
            hint="Enable A/B testing via the experiment decision provider."
            blockedHint={!canUseExperiments ? "Growth or Pro" : undefined}
            checked={form.features.experiments}
            disabled={!canUseExperiments}
            onChange={(v) =>
              setForm((f) => ({ ...f, features: { ...f.features, experiments: v } }))
            }
          />
          <ToggleRow
            label="AI"
            hint="Allow the AI decision layer to run in shadow or live mode."
            blockedHint={!canUseAi ? "Pro only" : undefined}
            checked={form.features.ai}
            disabled={!canUseAi}
            onChange={(v) =>
              setForm((f) => ({ ...f, features: { ...f.features, ai: v } }))
            }
          />
          <ToggleRow
            label="Analytics"
            hint="Enable event tracking and served-variant logging."
            checked={form.features.analytics}
            onChange={(v) =>
              setForm((f) => ({ ...f, features: { ...f.features, analytics: v } }))
            }
          />
        </div>
      </SectionCard>

      {/* ── Save ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start gap-4 pb-8 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className={cn(
            "rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white",
            "transition-colors hover:bg-brand-700",
            "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2",
            isPending && "cursor-not-allowed opacity-60",
          )}
        >
          {isPending ? "Saving…" : "Save changes"}
        </button>

        {saveResult && (
          <div className="space-y-1">
            <span
              className={cn(
                "text-sm",
                saveResult.ok ? "text-success-600" : "text-error-600",
              )}
            >
              {saveResult.ok ? "✓ " : "⚠ "}
              {saveResult.message}
            </span>
            {saveResult.ok && saveResult.warnings && saveResult.warnings.length > 0 && (
              <div className="space-y-0.5">
                {saveResult.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-warning-600">
                    ⚠ {w}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
