/**
 * CreateSitePanel — "Initialize site"
 *
 * Admin panel for running first-time tenant initialization.
 *
 * ─── Three-step setup flow ────────────────────────────────────────────────────
 *
 *   Step 1 — Quick starters
 *     Eight use-case-driven starter cards (AI Product, B2B Lead Gen, Product-Led
 *     SaaS, Enterprise SaaS, Careers Platform, Content & Blog, DTC Store,
 *     Performance Shop).  Selecting a starter pre-fills the siteType, theme,
 *     and blueprint.
 *
 *     An "Advanced — configure manually" escape hatch lets operators skip the
 *     starters grid and pick a raw site type directly (same grid as before).
 *
 *   Step 2 — Template selection
 *     A checklist of available catalog templates grouped by category.
 *     Recommended templates are pre-checked per the resolved siteType.
 *
 *   Step 3 — Starter content options
 *     Controls whether pages get placeholder copy, and how existing CMS
 *     content is handled on re-runs.
 *
 * ─── Model separation ────────────────────────────────────────────────────────
 *
 *   SiteStarter (step 1 card)       — presentational bundle
 *   SiteType    (from starter)      — structural archetype
 *   ThemePresetKey (from starter)   — visual identity
 *   blueprintKey   (from starter)   — page/content scaffold
 *
 *   All three values are passed separately to createSiteAction so each
 *   concern remains independently configurable and testable.
 *
 * ─── Backward compatibility ──────────────────────────────────────────────────
 *
 *   All five site types still exist.  Themes in Design → Style are unchanged.
 *   Starters are purely a UX shortcut layer — they don't introduce any new
 *   runtime concepts.
 */

"use client";

import { useTransition, useState, useEffect } from "react";
import Link                                    from "next/link";
import { Card, CardContent }                   from "@/components/ui/Card";
import { Badge }                               from "@/components/ui/Badge";
import { TemplatePreview }                     from "@/components/admin/TemplatePreview";
import {
  getAllSitePresets,
  getAllStarters,
  getRegistryByCategory,
  getDefaultSelectedTemplates,
  SLOT_CONTRACT_REGISTRY,
  FUNCTIONALITY_MODULES,
  getModulesForSiteType,
  getTemplateCatalogEntry,
  resolvePresetKey,
  getPreset,
  getBlockDisplayName,
} from "@/page-config";
import type { FunctionalityModuleKey } from "@/page-config";
import { createSiteAction }  from "@/app/admin/tenants/[tenantId]/actions";
import type {
  CreateSiteResult,
  CreateSitePageResult,
  SiteInitReport,
  SiteInitStatus,
  CmsInitSection,
  StarterContentMode,
} from "@/app/admin/tenants/[tenantId]/types";
import type {
  SitePreset,
  SiteStarter,
  SiteType,
  TemplateRegistryEntry,
} from "@/page-config";
import type { TemplateCatalogKey }  from "@/tenant";
import type { ThemePresetKey }      from "@/design-system/theme/presets";

// ── Props ─────────────────────────────────────────────────────────────────────

interface CreateSitePanelProps {
  tenantId: string;
  /**
   * ISO 8601 timestamp of the last successful initialization, if any.
   * When set, the panel shows an "already initialized" state and changes the
   * button to "Re-initialize site" with a warning.
   */
  siteInitializedAt?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SITE_PRESETS: readonly SitePreset[]  = getAllSitePresets();
const STARTERS:     readonly SiteStarter[] = getAllStarters();

/** Emoji icon for each site type — used in the "manual" override selector. */
const SITE_TYPE_ICON: Record<SiteType, string> = {
  corporate:   "🏢",
  recruitment: "🎯",
  content:     "📰",
  shop:        "🛍️",
  saas:        "🚀",
  startup:     "⚡",
};

/** Human-readable labels for each report section key. */
const SECTION_LABELS: Partial<Record<keyof SiteInitReport, string>> = {
  tenantBase:   "Tenant base",
  designSystem: "Design system",
  cmsContent:   "CMS content",
  integrations: "Integrations",
  domains:      "Domains",
  blueprint:    "Blueprint init",
};

/**
 * Accent palette per starter — colour-codes the card ring and badge to give
 * each starter a distinct visual identity in the grid.
 */
const STARTER_ACCENT: Record<string, { border: string; bg: string; tag: string; tagText: string; check: string }> = {
  ai_product_landing:    { border: "border-indigo-500", bg: "bg-indigo-950", tag: "bg-indigo-900",  tagText: "text-indigo-300", check: "text-indigo-400" },
  b2b_lead_generation:   { border: "border-sky-400",    bg: "bg-sky-50",     tag: "bg-sky-100",     tagText: "text-sky-700",    check: "text-sky-500"   },
  product_led_saas:      { border: "border-amber-400",  bg: "bg-amber-50",   tag: "bg-amber-100",   tagText: "text-amber-700",  check: "text-amber-500" },
  enterprise_saas:       { border: "border-slate-500",  bg: "bg-slate-50",   tag: "bg-slate-100",   tagText: "text-slate-700",  check: "text-slate-500" },
  careers_platform:      { border: "border-emerald-400",bg: "bg-emerald-50", tag: "bg-emerald-100", tagText: "text-emerald-700",check: "text-emerald-500"},
  content_blog:          { border: "border-rose-400",   bg: "bg-rose-50",    tag: "bg-rose-100",    tagText: "text-rose-700",   check: "text-rose-500"  },
  ecommerce_dtc:         { border: "border-pink-400",   bg: "bg-pink-50",    tag: "bg-pink-100",    tagText: "text-pink-700",   check: "text-pink-500"  },
  ecommerce_performance: { border: "border-neutral-400",bg: "bg-neutral-50", tag: "bg-neutral-100", tagText: "text-neutral-600",check: "text-neutral-500"},
};

const DEFAULT_ACCENT = { border: "border-brand-400", bg: "bg-brand-50", tag: "bg-brand-100", tagText: "text-brand-700", check: "text-brand-500" };

function starterAccent(key: string) {
  return STARTER_ACCENT[key] ?? DEFAULT_ACCENT;
}

function sectionIcon(status: SiteInitStatus): string {
  switch (status) {
    case "ok":      return "✅";
    case "warn":    return "⚠️";
    case "skipped": return "—";
    case "error":   return "❌";
  }
}

function statusBadgeVariant(
  status: CreateSitePageResult["status"],
): "success" | "warning" | "outline" {
  switch (status) {
    case "created":  return "success";
    case "degraded": return "warning";
    case "skipped":  return "outline";
  }
}

function statusBadgeLabel(status: CreateSitePageResult["status"]): string {
  switch (status) {
    case "created":  return "Created";
    case "degraded": return "Degraded";
    case "skipped":  return "Skipped";
  }
}

function slugDisplay(slug: string): string {
  return slug === "" ? "/" : `/${slug}`;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function getRecommendedKeys(siteType: SiteType): TemplateCatalogKey[] {
  const preset = SITE_PRESETS.find((p) => p.type === siteType);
  if (preset?.recommendedTemplates && preset.recommendedTemplates.length > 0) {
    return [...preset.recommendedTemplates] as TemplateCatalogKey[];
  }
  return getDefaultSelectedTemplates(siteType);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CreateSitePanel({ tenantId, siteInitializedAt }: CreateSitePanelProps) {

  // ── Starter selection ─────────────────────────────────────────────────────
  // null = no starter chosen; operator may switch to manual mode instead.
  const [selectedStarter, setSelectedStarter] = useState<SiteStarter | null>(null);

  // ── Manual override ───────────────────────────────────────────────────────
  // When true, the raw site-type selector is shown instead of starters.
  const [manualMode, setManualMode] = useState<boolean>(false);

  // ── "Everything" mode ─────────────────────────────────────────────────────
  // When true, the page + module lists ignore the site-type filter and show the
  // FULL catalog — every page and every functionality across all starters — so
  // an operator can build a starterless "kitchen sink" site in one go.
  const [showAllOptions, setShowAllOptions] = useState<boolean>(false);

  // ── Resolved site type ────────────────────────────────────────────────────
  // Derived from the selected starter, or chosen directly in manual mode.
  const [selectedType, setSelectedType] = useState<SiteType>("saas");

  // ── Template selection ────────────────────────────────────────────────────
  const [selectedTemplates, setSelectedTemplates] = useState<TemplateCatalogKey[]>(
    () => getRecommendedKeys("saas"),
  );

  const [selectedModules, setSelectedModules] = useState<Set<FunctionalityModuleKey>>(
    () => new Set(),
  );

  const [includeDefaultBlocks, setIncludeDefaultBlocks] = useState<boolean>(true);
  const [starterContentMode, setStarterContentMode]     = useState<StarterContentMode>("fill");
  const [includeShowcasePage, setIncludeShowcasePage]   = useState<boolean>(false);
  const [result, setResult]   = useState<CreateSiteResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const [initializedAt, setInitializedAt] = useState<string | null>(
    siteInitializedAt ?? null,
  );

  const isReinit = initializedAt !== null && result === null;

  // When the resolved site type changes, reset template selection and clear modules.
  useEffect(() => {
    setSelectedTemplates(getRecommendedKeys(selectedType));
    setSelectedModules(new Set());
    setResult(null);
  }, [selectedType]);

  function handleStarterSelect(starter: SiteStarter) {
    // Toggle deselect
    if (selectedStarter?.key === starter.key) {
      setSelectedStarter(null);
      return;
    }
    setSelectedStarter(starter);
    setSelectedType(starter.siteTypeKey);
  }

  function handleManualTypeChange(type: SiteType) {
    setSelectedType(type);
    setSelectedStarter(null);
  }

  function handleTemplateToggle(key: TemplateCatalogKey, entry: TemplateRegistryEntry) {
    if (entry.locked) return;
    setSelectedTemplates((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  function handleCreate() {
    setResult(null);
    startTransition(async () => {
      // Resolved values
      const resolvedSiteType  = selectedType;
      const themeKey: ThemePresetKey | undefined = selectedStarter?.themeKey;
      const blueprintKey: string | undefined     = selectedStarter?.blueprintKey;

      const res = await createSiteAction(
        tenantId,
        resolvedSiteType,
        selectedTemplates,
        includeDefaultBlocks,
        starterContentMode,
        includeShowcasePage,
        themeKey,
        blueprintKey,
        undefined,          // intake
        undefined,          // referenceUrl
        [...selectedModules],
      );
      setResult(res);
      if (res.ok) {
        setInitializedAt(new Date().toISOString());
      }
    });
  }

  // ── Derived display values ────────────────────────────────────────────────

  const coreEntries     = getRegistryByCategory("core");
  // Extended pages: filtered to the site type by default, or the FULL extended
  // catalog when "everything" mode is on (starterless — all starters combined).
  const extendedEntries = showAllOptions
    ? getRegistryByCategory("extended")
    : getRegistryByCategory("extended").filter(
        (e) =>
          e.recommendedFor.length === 0 ||
          (e.recommendedFor as readonly string[]).includes(selectedType),
      );

  // Functionality modules: for the site type by default, or ALL modules across
  // every site type when "everything" mode is on.
  const modulesToShow = showAllOptions
    ? FUNCTIONALITY_MODULES
    : getModulesForSiteType(selectedType);

  // ── "Select all" helpers ────────────────────────────────────────────────────
  // Derived from whatever is currently shown (type-scoped, or the full catalog
  // in "everything" mode). The Select-all toggles pick every visible page /
  // module in one click.
  const allTemplateKeys: TemplateCatalogKey[] = [...coreEntries, ...extendedEntries].map(
    (e) => e.catalogKey,
  );
  const allTemplatesSelected =
    allTemplateKeys.length > 0 &&
    allTemplateKeys.every((k) => selectedTemplates.includes(k));

  const allModuleKeys: FunctionalityModuleKey[] = modulesToShow.map((m) => m.key);
  const allModulesSelected =
    allModuleKeys.length > 0 && allModuleKeys.every((k) => selectedModules.has(k));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Card className="mt-6">
      <CardContent>

        {/* ── Panel header ─────────────────────────────────────────────── */}
        <div className="mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-neutral-900">Initialize site</h3>
            {initializedAt && result === null && (
              <Badge variant="success" size="sm" dot>Initialized</Badge>
            )}
          </div>
          {isReinit ? (
            <p className="mt-0.5 text-xs text-neutral-500">
              This tenant was last initialized on{" "}
              <span className="font-medium text-neutral-700">{formatDate(initializedAt!)}</span>.
              Re-initializing will re-apply design system baseline, integration defaults, and
              re-provision CMS starter pages.
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-neutral-500">
              Choose a starter below to set up your site in one step. After initialization, use{" "}
              <a href="#cms-sync" className="text-brand-600 hover:underline">Sync CMS</a>{" "}
              on the Content tab to repair missing documents without resetting tenant settings.
            </p>
          )}
        </div>

        {/* ── Re-initialize warning ─────────────────────────────────────── */}
        {isReinit && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
            <p className="text-xs font-semibold text-amber-800">Re-initialize?</p>
            <p className="mt-0.5 text-xs text-amber-700">
              Re-running re-applies design system and integration defaults.  By default,{" "}
              <strong className="font-semibold text-amber-800">existing CMS content is preserved</strong>{" "}
              — only missing pages will be created.  To reset content already in the CMS,
              choose <em>Overwrite existing</em> in Step 4 below.  API keys, token overrides,
              and primary domain are never affected.
            </p>
          </div>
        )}

        {/* ── Step 1: Quick starters ────────────────────────────────────── */}
        <div className="mb-5">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="text-xs font-medium text-neutral-600">
              1 — Choose a starter
            </p>
            {/* Manual mode toggle */}
            <button
              type="button"
              onClick={() => {
                setManualMode((v) => !v);
                // When switching to manual, seed selectedType from starter (if any)
                // or keep current selectedType.
              }}
              className="text-[11px] text-neutral-400 underline underline-offset-2 hover:text-neutral-600 transition-colors shrink-0"
            >
              {manualMode ? "← Back to starters" : "Configure manually →"}
            </button>
          </div>

          {manualMode ? (
            /* ── Manual: raw site type grid ─────────────────────────── */
            <div>
              <p className="mb-2 text-[11px] text-neutral-400">
                Select a structural archetype. Theme and blueprint will use defaults.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {SITE_PRESETS.map((preset) => {
                  const isSelected = preset.type === selectedType && !selectedStarter;
                  return (
                    <button
                      key={preset.type}
                      type="button"
                      onClick={() => handleManualTypeChange(preset.type)}
                      disabled={isPending}
                      className={[
                        "flex flex-col rounded-lg border-2 p-3 text-left transition-colors",
                        isSelected
                          ? "border-brand-500 bg-brand-50"
                          : "border-neutral-200 bg-white hover:border-neutral-300",
                        isPending ? "pointer-events-none opacity-60" : "",
                      ].join(" ")}
                    >
                      <span className="mb-1 text-base leading-none">
                        {SITE_TYPE_ICON[preset.type]}
                      </span>
                      <span className={[
                        "text-xs font-semibold",
                        isSelected ? "text-brand-700" : "text-neutral-800",
                      ].join(" ")}>
                        {preset.label}
                      </span>
                      <span className="mt-1 text-[11px] leading-snug text-neutral-500">
                        {preset.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ── Starters: 8-card use-case grid ─────────────────────── */
            <div>
              <p className="mb-2 text-[11px] text-neutral-400">
                Each starter pre-selects a site type, theme, and content blueprint matched to your use case.
                You can adjust any of these after initialization.
              </p>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {STARTERS.map((starter) => {
                  const isChosen  = selectedStarter?.key === starter.key;
                  const accent    = starterAccent(starter.key);
                  const isDarkCard = starter.key === "ai_product_landing";
                  return (
                    <button
                      key={starter.key}
                      type="button"
                      onClick={() => handleStarterSelect(starter)}
                      disabled={isPending}
                      className={[
                        "group relative flex flex-col rounded-xl border-2 p-3.5 text-left transition-all",
                        isChosen
                          ? `${accent.border} ${accent.bg} shadow-md`
                          : "border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-sm",
                        isPending ? "pointer-events-none opacity-60" : "",
                      ].join(" ")}
                    >
                      {/* Selected check */}
                      {isChosen && (
                        <span className={`absolute top-2.5 right-2.5 text-xs font-bold ${accent.check}`}>
                          ✓
                        </span>
                      )}

                      {/* Label + tagline */}
                      <span className={[
                        "text-xs font-bold leading-tight",
                        isChosen
                          ? isDarkCard ? "text-white" : "text-neutral-900"
                          : "text-neutral-800",
                      ].join(" ")}>
                        {starter.label}
                      </span>
                      <span className={[
                        "mt-0.5 text-[10px] font-medium leading-snug",
                        isChosen
                          ? isDarkCard ? "text-indigo-300" : accent.tagText
                          : "text-neutral-500",
                      ].join(" ")}>
                        {starter.tagline}
                      </span>

                      {/* Description */}
                      <p className={[
                        "mt-1.5 text-[10px] leading-snug",
                        isChosen
                          ? isDarkCard ? "text-neutral-300" : "text-neutral-600"
                          : "text-neutral-500",
                      ].join(" ")}>
                        {starter.description}
                      </p>

                      {/* Use-case chips */}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {starter.recommendedUseCases.map((uc) => (
                          <span
                            key={uc}
                            className={[
                              "inline-flex items-center rounded-full px-1.5 py-px text-[9px] font-medium leading-none",
                              isChosen ? `${accent.tag} ${accent.tagText}` : "bg-neutral-100 text-neutral-500",
                            ].join(" ")}
                          >
                            {uc}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selection summary — shown when a starter is chosen */}
              {selectedStarter && (
                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
                  <span className="text-[11px] font-semibold text-neutral-700">
                    Selected: {selectedStarter.label}
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    Site type: <span className="font-medium text-neutral-700">{selectedStarter.siteTypeKey}</span>
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    Theme: <span className="font-medium text-neutral-700">{selectedStarter.themeKey}</span>
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    Blueprint: <span className="font-medium text-neutral-700">{selectedStarter.blueprintKey}</span>
                  </span>
                </div>
              )}

              {/* No starter — explain what happens */}
              {!selectedStarter && (
                <p className="mt-1.5 text-[10px] text-neutral-400">
                  No starter selected — pick one above, or switch to <button type="button" onClick={() => setManualMode(true)} className="underline hover:text-neutral-600">manual configuration</button>.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── "Everything" mode toggle ──────────────────────────────────── */}
        <label className="mb-4 flex cursor-pointer items-start gap-2.5 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
          <input
            type="checkbox"
            checked={showAllOptions}
            disabled={isPending}
            onChange={(e) => setShowAllOptions(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="block text-xs font-semibold text-neutral-800">
              Show everything (starterless)
            </span>
            <span className="mt-0.5 block text-[11px] leading-snug text-neutral-500">
              Ignore the starter/site-type filter and list <strong>every</strong> page
              and functionality across all starters — then use “Select all” to load the
              full set in one go.
            </span>
          </span>
        </label>

        {/* ── Step 2: Template selection ─────────────────────────────────── */}
        <div className="mb-5">
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-xs font-medium text-neutral-600">
              2 — Select pages to include
            </p>
            <div className="flex items-baseline gap-3">
              <button
                type="button"
                disabled={isPending || allTemplateKeys.length === 0}
                onClick={() =>
                  setSelectedTemplates(allTemplatesSelected ? [] : allTemplateKeys)
                }
                className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-40"
              >
                {allTemplatesSelected ? "Clear all" : "Select all pages"}
              </button>
              <span className="text-[11px] text-neutral-400">
                {selectedTemplates.length} selected
              </span>
            </div>
          </div>

          <div className="space-y-5">
            {/* Core templates */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                  Core pages
                </p>
                <span className="text-[10px] text-neutral-300">
                  — foundation pages every site should have
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {coreEntries.map((entry) => (
                  <TemplateCard
                    key={entry.key}
                    entry={entry}
                    isChecked={selectedTemplates.includes(entry.catalogKey)}
                    isPending={isPending}
                    onToggle={() => handleTemplateToggle(entry.catalogKey, entry)}
                    selectedType={selectedType}
                  />
                ))}
              </div>
            </div>

            {/* Extended templates — filtered by resolved site type */}
            {extendedEntries.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                    Extended pages
                  </p>
                  <span className="text-[10px] text-neutral-300">
                    — optional additions for this site type
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {extendedEntries.map((entry) => (
                    <TemplateCard
                      key={entry.key}
                      entry={entry}
                      isChecked={selectedTemplates.includes(entry.catalogKey)}
                      isPending={isPending}
                      onToggle={() => handleTemplateToggle(entry.catalogKey, entry)}
                      selectedType={selectedType}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Step 3: Functionality modules ──────────────────────────────── */}
        <div className="mb-5">
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-xs font-medium text-neutral-600">
              3 — Functionality modules
            </p>
            <button
              type="button"
              disabled={isPending || allModuleKeys.length === 0}
              onClick={() =>
                setSelectedModules(allModulesSelected ? new Set() : new Set(allModuleKeys))
              }
              className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-40"
            >
              {allModulesSelected ? "Clear all" : "Select all functionalities"}
            </button>
          </div>
          <p className="mb-2 text-[11px] text-neutral-400">
            Enable optional feature areas. Each module adds specific content blocks and may
            require an external integration (shown as a chip on the card).
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {modulesToShow.map((mod) => {
              const isOn = selectedModules.has(mod.key);
              return (
                <button
                  key={mod.key}
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    setSelectedModules((prev) => {
                      const next = new Set(prev);
                      if (next.has(mod.key)) next.delete(mod.key);
                      else next.add(mod.key);
                      return next;
                    });
                  }}
                  className={[
                    "relative flex flex-col rounded-lg border-2 p-3 text-left transition-colors",
                    isOn
                      ? "border-brand-400 bg-brand-50 shadow-sm"
                      : "border-neutral-200 bg-white hover:border-neutral-300",
                    isPending ? "pointer-events-none opacity-60" : "",
                  ].join(" ")}
                >
                  {isOn && (
                    <span className="absolute top-2 right-2 text-[10px] font-bold text-brand-500">
                      ✓
                    </span>
                  )}
                  <span className={[
                    "text-xs font-semibold leading-tight",
                    isOn ? "text-brand-700" : "text-neutral-800",
                  ].join(" ")}>
                    {mod.label}
                  </span>
                  <p className="mt-1 text-[10px] leading-snug text-neutral-500">
                    {mod.description}
                  </p>
                  {mod.requiredIntegrations && mod.requiredIntegrations.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {mod.requiredIntegrations.map((int) => (
                        <span
                          key={int}
                          className="inline-flex items-center rounded-full bg-neutral-100 px-1.5 py-px text-[9px] font-medium text-neutral-500 leading-none"
                        >
                          {int.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          {selectedModules.size > 0 && (
            <p className="mt-1.5 text-[10px] text-neutral-400">
              {selectedModules.size} module{selectedModules.size !== 1 ? "s" : ""} selected —{" "}
              {[...selectedModules].join(", ")}
            </p>
          )}
        </div>

        {/* ── Step 4: Starter content options ────────────────────────────── */}
        <div className="mb-5">
          <p className="mb-2 text-xs font-medium text-neutral-600">
            4 — Starter content
          </p>
          <p className="mb-2 text-[11px] text-neutral-400">
            By default, pages are set up with layouts and placeholder copy ready to edit in the CMS.
            You can change how existing content is handled below.
          </p>

          <div className="rounded-lg border border-neutral-200 bg-white divide-y divide-neutral-100">

            {/* Include default blocks toggle */}
            <label className={[
              "flex items-start gap-3 px-3 py-2.5",
              isPending ? "pointer-events-none opacity-60" : "cursor-pointer hover:bg-neutral-50",
            ].join(" ")}>
              <input
                type="checkbox"
                checked={includeDefaultBlocks}
                disabled={isPending}
                onChange={(e) => setIncludeDefaultBlocks(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded accent-brand-500"
              />
              <div className="min-w-0">
                <span className="text-xs font-medium text-neutral-800">
                  Add page layouts and starter content
                </span>
                <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
                  Each page is set up with a recommended layout and placeholder copy editors can update in the CMS.
                  Uncheck only if you want completely blank pages with no pre-built structure.
                </p>
              </div>
            </label>

            {/* Component showcase page toggle */}
            <label className={[
              "flex items-start gap-3 px-3 py-2.5",
              isPending ? "pointer-events-none opacity-60" : "cursor-pointer hover:bg-neutral-50",
            ].join(" ")}>
              <input
                type="checkbox"
                checked={includeShowcasePage}
                disabled={isPending}
                onChange={(e) => setIncludeShowcasePage(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded accent-brand-500"
              />
              <div className="min-w-0">
                <span className="text-xs font-medium text-neutral-800">
                  Include component showcase page
                </span>
                <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
                  Adds a private{" "}
                  <code className="text-[10px] bg-neutral-100 px-1 rounded">/components</code>{" "}
                  page to the CMS that shows every available block type with example content.
                  Handy for editors to explore what's available — never published to the live site.
                </p>
              </div>
            </label>

            {/* Starter content depth */}
            {includeDefaultBlocks && (
              <div className="px-3 py-2.5">
                <p className="mb-2 text-[11px] font-medium text-neutral-600">
                  How should we handle existing CMS content?
                </p>
                <div className="space-y-1.5">
                  {(
                    [
                      {
                        value:       "fill"      as StarterContentMode,
                        label:       "Add missing content only (recommended)",
                        description: "Create pages and fill in starter text where nothing exists yet. Any content your editors have already written in the CMS will not be touched.",
                        warning:     false,
                      },
                      {
                        value:       "none"      as StarterContentMode,
                        label:       "Add layouts only, leave content blank",
                        description: "Set up the page structure with empty blocks — no placeholder text. Choose this if your editors prefer to write everything from scratch.",
                        warning:     false,
                      },
                      {
                        value:       "overwrite" as StarterContentMode,
                        label:       "Replace all content",
                        description: "Rebuild every page from scratch using fresh starter copy — even pages editors have already worked on. Use with care: this permanently replaces any content currently in the CMS.",
                        warning:     true,
                      },
                    ] satisfies Array<{ value: StarterContentMode; label: string; description: string; warning: boolean }>
                  ).map(({ value, label, description, warning }) => (
                    <label
                      key={value}
                      className={[
                        "flex items-start gap-2.5 rounded-md border px-2.5 py-2 cursor-pointer transition-colors",
                        starterContentMode === value
                          ? warning
                            ? "border-amber-300 bg-amber-50"
                            : "border-brand-300 bg-brand-50"
                          : "border-neutral-200 hover:border-neutral-300",
                        isPending ? "pointer-events-none opacity-60" : "",
                      ].join(" ")}
                    >
                      <input
                        type="radio"
                        name="starterContentMode"
                        value={value}
                        checked={starterContentMode === value}
                        disabled={isPending}
                        onChange={() => setStarterContentMode(value)}
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-brand-500"
                      />
                      <div>
                        <span className={[
                          "text-xs font-medium",
                          starterContentMode === value
                            ? warning ? "text-amber-800" : "text-brand-700"
                            : "text-neutral-800",
                        ].join(" ")}>
                          {label}
                        </span>
                        <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
                          {description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Action button ─────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={handleCreate}
          disabled={isPending || (!selectedStarter && !manualMode)}
          className={[
            "inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium text-white shadow-xs transition-colors",
            isPending
              ? "cursor-not-allowed bg-brand-300"
              : !selectedStarter && !manualMode
                ? "cursor-not-allowed bg-neutral-300"
                : isReinit
                  ? "bg-amber-500 hover:bg-amber-600 active:bg-amber-700"
                  : "bg-brand-500 hover:bg-brand-600 active:bg-brand-700",
          ].join(" ")}
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Initializing…
            </span>
          ) : isReinit ? (
            "Re-initialize site"
          ) : !selectedStarter && !manualMode ? (
            "Select a starter to continue"
          ) : (
            `Initialize site — ${selectedTemplates.length} page${selectedTemplates.length !== 1 ? "s" : ""}${includeDefaultBlocks ? "" : ", empty"}`
          )}
        </button>

        {/* ── Result ─────────────────────────────────────────────────────── */}
        {result && (
          <div className="mt-5">
            {result.ok ? (
              <SiteInitReportPanel
                tenantId={tenantId}
                report={result.report}
                warnings={result.warnings}
              />
            ) : (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5">
                <p className="text-xs font-semibold text-red-800">Failed to initialize site</p>
                <p className="mt-0.5 text-xs text-red-700">{result.error}</p>
              </div>
            )}
          </div>
        )}

      </CardContent>
    </Card>
  );
}

// ── TemplateCard ──────────────────────────────────────────────────────────────

// ── Anatomy helpers ───────────────────────────────────────────────────────────

type AnatomyItem =
  | { kind: "slot-before"; label: string }
  | { kind: "slot-after";  label: string }
  | { kind: "block";       label: string; variant?: string };

function buildAnatomy(entry: TemplateRegistryEntry, siteType: SiteType): AnatomyItem[] {
  const catalogEntry = getTemplateCatalogEntry(entry.catalogKey);
  if (!catalogEntry) return [];
  const presetKey = resolvePresetKey(catalogEntry, siteType);
  const preset    = getPreset(presetKey);
  if (!preset)    return [];

  const slotRegistry = SLOT_CONTRACT_REGISTRY as Record<string, { label: string }>;

  return [
    ...preset.contextSlots
      .filter((s) => s.position === "before-content")
      .map((s) => ({
        kind:  "slot-before" as const,
        label: slotRegistry[s.slotId]?.label ?? s.slotId,
      })),
    ...preset.blocks.map((b) => ({
      kind:    "block" as const,
      label:   getBlockDisplayName(b.blockType),
      variant: b.variant,
    })),
    ...preset.contextSlots
      .filter((s) => s.position === "after-content")
      .map((s) => ({
        kind:  "slot-after" as const,
        label: slotRegistry[s.slotId]?.label ?? s.slotId,
      })),
  ];
}

// ── TemplateCard ──────────────────────────────────────────────────────────────

interface TemplateCardProps {
  entry:        TemplateRegistryEntry;
  isChecked:    boolean;
  isPending:    boolean;
  onToggle:     () => void;
  selectedType: SiteType;
}

function TemplateCard({ entry, isChecked, isPending, onToggle, selectedType }: TemplateCardProps) {
  const [anatomyOpen, setAnatomyOpen] = useState(false);

  const anatomy       = buildAnatomy(entry, selectedType);
  const PREVIEW_COUNT = 5;
  const overflow      = anatomy.length > PREVIEW_COUNT;
  const visible       = overflow && !anatomyOpen ? anatomy.slice(0, PREVIEW_COUNT) : anatomy;
  const hiddenCount   = anatomy.length - PREVIEW_COUNT;

  return (
    <label
      className={[
        "relative flex gap-0 overflow-hidden rounded-lg border-2 bg-white transition-colors",
        isChecked
          ? "border-brand-400 shadow-sm"
          : "border-neutral-200 hover:border-neutral-300",
        entry.locked ? "cursor-default"     : "cursor-pointer",
        isPending    ? "pointer-events-none" : "",
      ].join(" ")}
    >
      <div className="relative shrink-0 w-[68px] aspect-[4/5] bg-neutral-50 border-r border-neutral-100">
        <TemplatePreview previewType={entry.previewType} />
        <div className="absolute top-1.5 right-1.5">
          <input
            type="checkbox"
            checked={isChecked}
            disabled={entry.locked || isPending}
            onChange={onToggle}
            className="h-3.5 w-3.5 rounded accent-brand-500 shadow"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1 p-2.5">
        <div className="flex flex-wrap items-center gap-1">
          <span className={[
            "text-xs font-semibold leading-tight",
            isChecked ? "text-brand-700" : "text-neutral-800",
          ].join(" ")}>
            {entry.label}
          </span>
          {entry.locked && (
            <Badge variant="outline" size="sm">Required</Badge>
          )}
        </div>

        <code className="text-[10px] font-mono text-neutral-400 bg-neutral-50 border border-neutral-100 px-1 py-px rounded self-start">
          {slugDisplay(entry.defaultSlug)}
        </code>

        <p className="text-[10px] leading-snug text-neutral-500">
          {entry.description}
        </p>

        {/* ── Page anatomy ──────────────────────────────────────────── */}
        {anatomy.length > 0 && (
          <div className="mt-1.5 border-t border-neutral-100 pt-1.5">
            <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-neutral-300">
              Structure
            </p>
            <div className="space-y-0.5">
              {visible.map((item, idx) => {
                if (item.kind === "slot-before") {
                  return (
                    <div key={idx} className="flex items-center gap-1">
                      <span className="shrink-0 text-[8px] text-violet-400">⬡</span>
                      <span className="inline-flex items-center rounded-sm bg-violet-50 border border-violet-100 px-1 py-px text-[9px] font-medium text-violet-600 leading-none">
                        {item.label}
                      </span>
                      <span className="text-[8px] text-neutral-300">adaptive</span>
                    </div>
                  );
                }
                if (item.kind === "slot-after") {
                  return (
                    <div key={idx} className="flex items-center gap-1">
                      <span className="shrink-0 text-[8px] text-amber-400">⬡</span>
                      <span className="inline-flex items-center rounded-sm bg-amber-50 border border-amber-100 px-1 py-px text-[9px] font-medium text-amber-600 leading-none">
                        {item.label}
                      </span>
                      <span className="text-[8px] text-neutral-300">adaptive</span>
                    </div>
                  );
                }
                // block
                return (
                  <div key={idx} className="flex items-center gap-1">
                    <span className="shrink-0 text-[8px] text-neutral-300">—</span>
                    <span className="text-[9px] text-neutral-600 leading-none">{item.label}</span>
                    {item.variant && (
                      <span className="text-[8px] text-neutral-300 leading-none">
                        · {item.variant.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {overflow && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAnatomyOpen((v) => !v); }}
                className="mt-1 text-[9px] text-neutral-400 hover:text-neutral-600 underline underline-offset-2 transition-colors"
              >
                {anatomyOpen ? "Show less ↑" : `+${hiddenCount} more ↓`}
              </button>
            )}
          </div>
        )}
      </div>
    </label>
  );
}

// ── SiteInitReportPanel ───────────────────────────────────────────────────────

interface SiteInitReportPanelProps {
  tenantId: string;
  report:   SiteInitReport;
  warnings: string[];
}

function SiteInitReportPanel({ tenantId, report, warnings }: SiteInitReportPanelProps) {

  const sectionEntries = (
    Object.entries(report) as [keyof SiteInitReport, (typeof report)[keyof SiteInitReport]][]
  ).filter((entry): entry is [keyof SiteInitReport, NonNullable<(typeof report)[keyof SiteInitReport]>] =>
    entry[1] != null,
  );

  const hasError = sectionEntries.some(([, s]) => s.status === "error");
  const hasWarn  = sectionEntries.some(([, s]) => s.status === "warn");

  const borderColor  = hasError ? "border-red-200"   : hasWarn ? "border-amber-200" : "border-green-200";
  const bgColor      = hasError ? "bg-red-50"         : hasWarn ? "bg-amber-50"      : "bg-green-50";
  const headingColor = hasError ? "text-red-800"      : hasWarn ? "text-amber-800"   : "text-green-800";
  const headingText  = hasError
    ? "Initialization completed with errors"
    : hasWarn
    ? "Initialization completed with warnings"
    : "Site initialized";

  const cmsSection   = report.cmsContent as CmsInitSection;
  const hasCmsDocIds = (cmsSection.cmsDocumentIds?.length ?? 0) > 0;
  const cmsPages     = cmsSection.pages ?? [];

  return (
    <div className={`rounded-md border ${borderColor} ${bgColor} px-3 py-3 space-y-3`}>

      <p className={`text-xs font-semibold ${headingColor}`}>{headingText}</p>

      <div className="rounded border border-neutral-200 bg-white divide-y divide-neutral-100">
        {sectionEntries.map(([key, section]) => (
          <div key={key} className="px-3 py-2.5">
            <div className="flex items-start gap-2">
              <span className="mt-px text-sm leading-none shrink-0">
                {sectionIcon(section.status)}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-xs font-semibold text-neutral-800">
                    {SECTION_LABELS[key]}
                  </span>
                  {section.message && (
                    <span className="text-[11px] text-neutral-500 truncate">
                      {section.message}
                    </span>
                  )}
                </div>
                {section.details && section.details.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {section.details.map((d, i) => (
                      <p key={i} className="text-[10px] text-neutral-400">{d}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {cmsPages.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-medium text-neutral-500 uppercase tracking-wide">
            Pages
          </p>
          <div className="rounded border border-neutral-200 bg-white divide-y divide-neutral-100">
            {cmsPages.map((page) => (
              <div key={page.pageId ?? page.slug} className="flex items-center gap-2 px-3 py-2">
                <Badge variant={statusBadgeVariant(page.status)} size="sm">
                  {statusBadgeLabel(page.status)}
                </Badge>
                <span className="flex-1 text-xs font-medium text-neutral-800">{page.title}</span>
                <code className="text-[10px] font-mono text-neutral-400">
                  {slugDisplay(page.slug)}
                </code>
                {page.pageId && page.status !== "skipped" && (
                  <Link
                    href={`/admin/tenants/${tenantId}/pages/${page.pageId}`}
                    className="text-[10px] text-neutral-400 transition-colors hover:text-brand-700"
                  >
                    Edit →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasError && (
        <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2.5">
          <p className="text-xs font-semibold text-blue-800">
            Next step: open the CMS to add content
          </p>
          <p className="mt-0.5 text-xs text-blue-700">
            Your site structure is ready. Head to the Content tab to launch
            the CMS editor and start writing copy, adding pages, and publishing.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href={`/admin/tenants/${tenantId}/content`}
              className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Open Content →
            </Link>
            <Link
              href={`/admin/tenants/${tenantId}`}
              className="inline-flex items-center rounded-md border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 transition-colors"
            >
              Back to overview
            </Link>
          </div>
        </div>
      )}

      {hasError && (
        <div className="flex flex-wrap gap-3">
          {hasCmsDocIds ? (
            <Link
              href={`/admin/tenants/${tenantId}/content`}
              className="text-xs font-medium text-brand-600 transition-colors hover:text-brand-800"
            >
              View content status →
            </Link>
          ) : (
            <Link
              href={`/admin/tenants/${tenantId}/pages`}
              className="text-xs font-medium text-brand-600 transition-colors hover:text-brand-800"
            >
              View all pages →
            </Link>
          )}
          <Link
            href={`/admin/tenants/${tenantId}`}
            className="text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-700"
          >
            Back to overview →
          </Link>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="space-y-1 border-t border-neutral-200 pt-2.5">
          {warnings.map((w, i) => (
            <p key={i} className="text-[11px] text-amber-700">⚠ {w}</p>
          ))}
        </div>
      )}

    </div>
  );
}
