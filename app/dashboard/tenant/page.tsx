/**
 * /dashboard/tenant — Runtime Tenant Overview
 *
 * Read-only runtime view of the active tenant: what is actually live and
 * resolved at request time.  All block, feature, and design values are derived
 * via the same runtime helper functions the application uses (getEnabledContextBlocks,
 * getTenantFeatures, getResolvedTenantTheme, etc.) so the values shown here
 * always match what the live site actually renders.
 *
 * This page is intentionally NOT an admin settings page.  It answers
 * "what is this tenant currently doing?" not "what can I configure?".
 * The editable control surface lives at /admin/tenants/[tenantId].
 *
 * ─── Sections ────────────────────────────────────────────────────────────────
 *
 *   1. Identity + package     — tenantId, name, package tier, CMS source
 *   2. Active blocks          — runtime-resolved context & content blocks
 *   3. Active features        — getTenantFeatures() (package-ANDed)
 *   4. AI configuration       — mode, provider, model, key status
 *   5. Capability readiness   — templates, forms, listing/detail, search
 *   6. Site builder readiness — pre-flight checklist: registry, CMS, theme, gates
 *   7. Resolved design        — theme preset, token overrides, key color tokens
 *   8. TenantConfig · Colors  — full per-deployment color swatch reference
 *   9. Injected CSS variables — :root block
 *
 * ─── API key security ────────────────────────────────────────────────────────
 *
 *   getTenantAiRuntimeConfig() returns only hasApiKey: boolean.
 *   No API key values are ever rendered on this page.
 */

import { getActiveTenantWithDevOverride, getTenantById } from "@/tenant/server";
import {
  getEnabledContextBlocks,
  getEnabledContentTypes,
  getTenantFeatures,
  getResolvedTenantTheme,
  getPackageDefinition,
} from "@/tenant";
import {
  tenantThemeToCSS,
  RADIUS_PRESETS,
} from "@/design-system/theme/tenant-theme";
import { getAllTemplateDefinitions } from "@/page-config";
import type {
  TenantConfig,
  TenantTheme,
  ContextBlockKey,
  ContentBlockKey,
  TenantFeatures,
  PackageKey,
} from "@/tenant";
import type { TenantSettings } from "@/tenant/server";
import type { RadiusPersonality } from "@/design-system/theme/tenant-theme";
import { getTenantAiRuntimeConfig } from "@/ai/config";
import type { AiRuntimeConfig, AiProviderConfig } from "@/ai/types";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Text } from "@/components/primitives/Text";
import { SiteBuilderReadiness } from "@/components/admin/SiteBuilderReadiness";

export const metadata = { title: "Runtime Overview · Dashboard" };

// ── CMS env-var detection ─────────────────────────────────────────────────────

interface CMSEnvInfo {
  envVar: string;
  isSet: boolean;
}

function detectCMSEnvInfo(): Record<string, CMSEnvInfo> {
  return {
    sanity:    { envVar: "SANITY_PROJECT_ID",      isSet: !!process.env.SANITY_PROJECT_ID },
    storyblok: { envVar: "STORYBLOK_ACCESS_TOKEN", isSet: !!process.env.STORYBLOK_ACCESS_TOKEN },
    statamic:  { envVar: "STATAMIC_API_URL",       isSet: !!process.env.STATAMIC_API_URL },
    mock:      { envVar: "(fallback — no CMS env var set)", isSet: true },
  };
}

// ── Content block groupings (for readiness checks) ────────────────────────────

const FORMS_BLOCKS:   ContentBlockKey[] = ["formSection"];
const LISTING_BLOCKS: ContentBlockKey[] = ["listing", "articleBody", "articleMeta", "relatedContent"];
const VACANCY_BLOCKS: ContentBlockKey[] = ["vacancyMeta", "applyPanel"];
const SEARCH_BLOCKS:  ContentBlockKey[] = ["search", "filterBar"];

const CONTENT_CATEGORY_GROUPS: { label: string; keys: ContentBlockKey[] }[] = [
  { label: "Text",          keys: ["textSection", "richText"] },
  { label: "Media",         keys: ["image", "video", "slider"] },
  { label: "Social proof",  keys: ["testimonialSection", "quote", "logoStrip", "stats"] },
  { label: "Features",      keys: ["featureGrid", "faqSection", "about", "newsList", "caseHighlight"] },
  { label: "Listing",       keys: ["listing", "articleBody", "articleMeta", "relatedContent"] },
  { label: "Vacancies",     keys: ["vacancyMeta", "applyPanel", "filterBar"] },
  { label: "Search",        keys: ["search"] },
  { label: "Conversion",    keys: ["ctaSection", "formSection"] },
];

const CONTEXT_BLOCK_DISPLAY: Record<ContextBlockKey, string> = {
  hero:         "Hero",
  proof:        "Proof",
  cta:          "CTA",
  feature:      "Feature",
  conversion:   "Conversion",
  notification: "Notification",
};

const CONTENT_BLOCK_DISPLAY: Partial<Record<ContentBlockKey, string>> = {
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
  search:             "Search",
  ctaSection:         "Call to action",
  formSection:        "Form",
};

// ── Page ──────────────────────────────────────────────────────────────────────

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TenantRuntimeOverviewPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // In development, ?tenant=<id> overrides host-based resolution so a developer
  // can inspect any registered tenant's runtime config from localhost.
  const { tenantConfig, devTenantOverride } =
    await getActiveTenantWithDevOverride(params, "dashboard/tenant");

  const [tenantSettings, cssVars] = await Promise.all([
    getTenantById(tenantConfig.tenantId),
    Promise.resolve(tenantThemeToCSS(tenantConfig.theme)),
  ]);

  // Runtime-resolved values — same functions used by the homepage.
  const aiConfig             = getTenantAiRuntimeConfig(tenantSettings);
  const enabledContextBlocks = getEnabledContextBlocks(tenantSettings);
  const enabledContentTypes  = getEnabledContentTypes(tenantSettings);
  const runtimeFeatures      = getTenantFeatures(tenantSettings);
  const resolvedTheme        = getResolvedTenantTheme(tenantSettings);
  const packageDef           = tenantSettings ? getPackageDefinition(tenantSettings.packageKey) : null;
  const cmsEnvInfo           = detectCMSEnvInfo();
  const templates            = getAllTemplateDefinitions();

  const packageVariant: BadgeVariant =
    tenantSettings?.packageKey === "pro"     ? "success" :
    tenantSettings?.packageKey === "growth"  ? "primary" : "default";

  return (
    <div className="flex flex-col gap-6 px-8 py-8">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <Text variant="h2" as="h1">Runtime Overview</Text>
            <Badge variant="outline" size="sm">Read-only</Badge>
            {devTenantOverride && (
              <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 font-mono text-xs font-medium text-amber-700">
                dev override
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Text variant="body-sm" color="muted">{tenantConfig.tenantId}</Text>
            {tenantSettings && (
              <>
                <span className="text-neutral-300">·</span>
                <Badge variant={packageVariant} size="sm">
                  {tenantSettings.packageKey.charAt(0).toUpperCase() + tenantSettings.packageKey.slice(1)}
                </Badge>
              </>
            )}
          </div>
        </div>
        <a
          href={`/admin/tenants/${tenantConfig.tenantId}`}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:border-neutral-300 hover:text-neutral-900"
        >
          Edit in admin →
        </a>
      </div>

      {/* ── Dev override banner (development only) ────────────────────────── */}
      {devTenantOverride && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Dev override active.</strong> Showing runtime config for tenant{" "}
          <code className="font-mono font-semibold">{devTenantOverride}</code> via{" "}
          <code className="font-mono">?tenant=</code> query param. This override is ignored in production.{" "}
          <span className="text-amber-600">
            Bookmark:{" "}
            <code className="font-mono text-xs">/dashboard/tenant?tenant={devTenantOverride}</code>
          </span>
        </div>
      )}

      {/* ── 1. Identity + package ─────────────────────────────────────────── */}
      <IdentityPackageSection
        tenantConfig={tenantConfig}
        tenantSettings={tenantSettings}
        packageDef={packageDef}
        cmsEnvInfo={cmsEnvInfo}
      />

      {/* ── 2. Active blocks ──────────────────────────────────────────────── */}
      <ActiveBlocksSection
        enabledContextBlocks={enabledContextBlocks}
        enabledContentTypes={enabledContentTypes}
        tenantSettings={tenantSettings}
      />

      {/* ── 3. Active features ───────────────────────────────────────────── */}
      <ActiveFeaturesSection
        runtimeFeatures={runtimeFeatures}
        tenantSettings={tenantSettings}
        packageDef={packageDef}
        diagnosticsBar={tenantConfig.features.diagnosticsBar}
      />

      {/* ── 4. AI Configuration ───────────────────────────────────────────── */}
      <AiConfigSection aiConfig={aiConfig} tenantSettings={tenantSettings} />

      {/* ── 5. Capability readiness ───────────────────────────────────────── */}
      <CapabilityReadinessSection
        enabledContentTypes={enabledContentTypes}
        enabledContextBlocks={enabledContextBlocks}
        templates={templates}
        packageDef={packageDef}
      />

      {/* ── 6. Site builder readiness ────────────────────────────────────── */}
      <SiteBuilderReadiness
        tenant={tenantSettings}
        title="System readiness"
      />

      {/* ── 7. Resolved design ───────────────────────────────────────────── */}
      <ResolvedDesignSection
        resolvedTheme={resolvedTheme}
        tenantSettings={tenantSettings}
      />

      {/* ── 8. TenantConfig · Deployment colors ─────────────────────────── */}
      <ConfigSection
        title="Deployment · Colors"
        subtitle="Per-deployment color tokens from TenantConfig.theme — injected as CSS variables on every request"
      >
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <ColorGroup label="Brand" pairs={[
            { cssVar: "--primary",        label: "primary",       hex: tenantConfig.theme.colors.brand.primary },
            { cssVar: "--primary-hover",  label: "primaryHover",  hex: tenantConfig.theme.colors.brand.primaryHover },
            { cssVar: "--primary-active", label: "primaryActive", hex: tenantConfig.theme.colors.brand.primaryActive },
            { cssVar: "--primary-subtle", label: "primarySubtle", hex: tenantConfig.theme.colors.brand.primarySubtle },
            { cssVar: "--primary-text",   label: "primaryText",   hex: tenantConfig.theme.colors.brand.primaryText },
            { cssVar: "--ring",           label: "ring",          hex: tenantConfig.theme.colors.brand.ring },
            { cssVar: "--text-brand",     label: "textBrand",     hex: tenantConfig.theme.colors.brand.textBrand },
          ]} />
          <ColorGroup label="Text" pairs={[
            { cssVar: "--text",         label: "text",        hex: tenantConfig.theme.colors.text.text },
            { cssVar: "--text-muted",   label: "textMuted",   hex: tenantConfig.theme.colors.text.textMuted },
            { cssVar: "--text-subtle",  label: "textSubtle",  hex: tenantConfig.theme.colors.text.textSubtle },
            { cssVar: "--text-inverse", label: "textInverse", hex: tenantConfig.theme.colors.text.textInverse },
          ]} />
          <ColorGroup label="Background" pairs={[
            { cssVar: "--bg",         label: "bg",        hex: tenantConfig.theme.colors.background.bg },
            { cssVar: "--bg-subtle",  label: "bgSubtle",  hex: tenantConfig.theme.colors.background.bgSubtle },
            { cssVar: "--bg-inverse", label: "bgInverse", hex: tenantConfig.theme.colors.background.bgInverse },
          ]} />
          <ColorGroup label="Border" pairs={[
            { cssVar: "--border",        label: "border",       hex: tenantConfig.theme.colors.border.border },
            { cssVar: "--border-strong", label: "borderStrong", hex: tenantConfig.theme.colors.border.borderStrong },
          ]} />
        </div>
      </ConfigSection>

      {/* ── 9. CSS variables ─────────────────────────────────────────────── */}
      <ConfigSection
        title="Injected CSS Variables"
        subtitle=":root block injected by the root layout on every request"
      >
        <pre className="overflow-x-auto rounded-lg bg-neutral-950 px-4 py-4 text-xs leading-relaxed text-neutral-200">
          <span className="text-neutral-500">{"/* :root { */"}</span>
          {"\n"}
          {cssVars}
          <span className="text-neutral-500">{"/* } */"}</span>
        </pre>
      </ConfigSection>

    </div>
  );
}

// ── 1. Identity + package section ────────────────────────────────────────────

function IdentityPackageSection({
  tenantConfig,
  tenantSettings,
  packageDef,
  cmsEnvInfo,
}: {
  tenantConfig:   TenantConfig;
  tenantSettings: TenantSettings | null;
  packageDef:     ReturnType<typeof getPackageDefinition> | null;
  cmsEnvInfo:     Record<string, CMSEnvInfo>;
}) {
  const cmsProvider = tenantSettings?.cms.provider ?? tenantConfig.cmsProvider;
  const cmsInfo     = cmsEnvInfo[cmsProvider] ?? cmsEnvInfo.mock;
  const cmsBadge: BadgeVariant = cmsProvider === "mock" ? "default" : cmsInfo.isSet ? "primary" : "warning";

  const cmsSub = tenantSettings?.cms.projectId
    ? tenantSettings.cms.projectId + (tenantSettings.cms.dataset ? ` / ${tenantSettings.cms.dataset}` : "")
    : undefined;

  return (
    <ConfigSection title="Identity &amp; Plan">
      <div className="grid gap-6 sm:grid-cols-2">
        <PropGrid
          rows={[
            { label: "tenantId",          value: <Mono>{tenantConfig.tenantId}</Mono> },
            { label: "name",              value: tenantConfig.name },
            { label: "canonicalHostname", value: <Mono>{tenantConfig.canonicalHostname}</Mono> },
            {
              label: "cmsProvider",
              value: (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={cmsBadge} size="sm">{cmsProvider}</Badge>
                  {cmsSub && <Mono>{cmsSub}</Mono>}
                  {!cmsInfo.isSet && cmsProvider !== "mock" && (
                    <span className="text-xs text-warning-600">⚠ env var not set</span>
                  )}
                </div>
              ),
            },
            {
              label: "decisionProvider",
              value: (
                <div className="flex items-center gap-2">
                  <Badge variant="default" size="sm">{tenantConfig.decisionProvider}</Badge>
                  <span className="text-xs text-neutral-400">rules evaluated in order</span>
                </div>
              ),
            },
          ]}
        />
        {packageDef && tenantSettings ? (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Package
              </span>
              <PackageBadge packageKey={tenantSettings.packageKey} />
            </div>
            <p className="mb-3 text-xs leading-snug text-neutral-500">
              {packageDef.shortDescription}
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <span className="text-neutral-400">Sites</span>
              <span className="font-medium text-neutral-700">
                {packageDef.limits.maxSites === Infinity ? "Unlimited" : `Up to ${packageDef.limits.maxSites}`}
              </span>
              <span className="text-neutral-400">Experiments</span>
              <span className="font-medium text-neutral-700">
                {packageDef.limits.maxExperiments === Infinity ? "Unlimited" : packageDef.limits.maxExperiments === 0 ? "Not available" : `Up to ${packageDef.limits.maxExperiments}`}
              </span>
              <span className="text-neutral-400">Variants / slot</span>
              <span className="font-medium text-neutral-700">
                {packageDef.limits.maxVariantsPerSlot === Infinity ? "Unlimited" : `Up to ${packageDef.limits.maxVariantsPerSlot}`}
              </span>
              <span className="text-neutral-400">AI layer</span>
              <span className={packageDef.allowedFeatures.ai ? "font-medium text-success-700" : "text-neutral-400"}>
                {packageDef.allowedFeatures.ai ? "Available" : "Not available"}
              </span>
            </div>
            <div className="mt-3 border-t border-neutral-200 pt-3">
              <a
                href={`/admin/tenants/${tenantConfig.tenantId}`}
                className="text-xs text-brand-600 hover:text-brand-700 hover:underline"
              >
                Edit package &amp; settings →
              </a>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-4 py-3">
            <Text variant="body-sm" color="muted">
              No TenantSettings record for this tenant. Package info, block entitlements,
              and design settings are using defaults. Configure in the{" "}
              <a href="/admin/tenants" className="text-brand-600 hover:underline">tenant admin</a>.
            </Text>
          </div>
        )}
      </div>
    </ConfigSection>
  );
}

// ── 2. Active blocks section ──────────────────────────────────────────────────

function ActiveBlocksSection({
  enabledContextBlocks,
  enabledContentTypes,
  tenantSettings,
}: {
  enabledContextBlocks: ReadonlySet<ContextBlockKey>;
  enabledContentTypes:  ReadonlySet<ContentBlockKey> | null;
  tenantSettings:       TenantSettings | null;
}) {
  const allContextKeys: ContextBlockKey[] = ["hero", "proof", "cta"];

  // Content blocks grouped by category, showing enabled state
  const categoryItems = CONTENT_CATEGORY_GROUPS.map((group) => {
    const enabledKeys = group.keys.filter((k) =>
      enabledContentTypes === null || enabledContentTypes.has(k),
    );
    return { ...group, enabledKeys, allEnabled: enabledKeys.length === group.keys.length };
  });

  const totalContentEnabled = enabledContentTypes
    ? enabledContentTypes.size
    : Object.keys(CONTENT_BLOCK_DISPLAY).length;

  return (
    <ConfigSection
      title="Active Blocks"
      subtitle={
        tenantSettings
          ? "Runtime-resolved — intersection of tenant config and package entitlements"
          : "Using defaults — no TenantSettings record found"
      }
    >
      <div className="grid gap-6 sm:grid-cols-2">

        {/* Context (adaptive) blocks */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Context blocks (adaptive)
          </p>
          <div className="space-y-2">
            {allContextKeys.map((key) => {
              const active = enabledContextBlocks.has(key);
              return (
                <div
                  key={key}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                    active
                      ? "border-success-200 bg-success-50"
                      : "border-neutral-100 bg-neutral-50"
                  }`}
                >
                  <span
                    className={`text-sm font-bold ${active ? "text-success-600" : "text-neutral-300"}`}
                    aria-hidden
                  >
                    {active ? "✓" : "✗"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium ${active ? "text-neutral-800" : "text-neutral-400"}`}>
                      {CONTEXT_BLOCK_DISPLAY[key]}
                    </span>
                    <p className="text-xs text-neutral-400">
                      {key === "hero"  && "Adaptive headline + primary CTA — decision engine selects variant"}
                      {key === "proof" && "Social proof block — shown when a matching variant exists"}
                      {key === "cta"   && "Closing call-to-action — can repeat; allows multiple per page"}
                    </p>
                  </div>
                  <Badge variant={active ? "success" : "outline"} size="sm">
                    {active ? "active" : "inactive"}
                  </Badge>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-neutral-400">
            Decision engine selects a variant key for each active context block.
            Inactive blocks are skipped at render time.
          </p>
        </div>

        {/* Content blocks grouped by category */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Content blocks ({totalContentEnabled} active)
          </p>
          {enabledContentTypes === null ? (
            <div className="rounded-lg border border-brand-100 bg-brand-50 px-3 py-2">
              <p className="text-xs text-brand-700">
                Unrestricted — no TenantSettings record. All CMS content block types may render.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {categoryItems.map((group) => (
                <div key={group.label} className="flex items-center justify-between gap-2 py-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`text-xs font-bold leading-none ${
                        group.enabledKeys.length > 0 ? "text-success-500" : "text-neutral-200"
                      }`}
                      aria-hidden
                    >
                      {group.enabledKeys.length > 0 ? "●" : "○"}
                    </span>
                    <span className={`text-sm ${group.enabledKeys.length > 0 ? "text-neutral-700" : "text-neutral-300"}`}>
                      {group.label}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {group.enabledKeys.slice(0, 3).map((k) => (
                      <span
                        key={k}
                        className="rounded bg-success-50 px-1 py-0.5 text-xs text-success-700"
                      >
                        {CONTENT_BLOCK_DISPLAY[k] ?? k}
                      </span>
                    ))}
                    {group.enabledKeys.length > 3 && (
                      <span className="text-xs text-neutral-400">
                        +{group.enabledKeys.length - 3}
                      </span>
                    )}
                    {group.enabledKeys.length === 0 && (
                      <span className="text-xs text-neutral-300">none</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </ConfigSection>
  );
}

// ── 3. Active features section ────────────────────────────────────────────────

function ActiveFeaturesSection({
  runtimeFeatures,
  tenantSettings,
  packageDef,
  diagnosticsBar,
}: {
  runtimeFeatures: TenantFeatures;
  tenantSettings:  TenantSettings | null;
  packageDef:      ReturnType<typeof getPackageDefinition> | null;
  diagnosticsBar:  boolean;
}) {
  type FeatureRow = {
    key:     keyof TenantFeatures;
    label:   string;
    active:  boolean;
    pkgGate: boolean;   // true = blocked by package, not by tenant flag
    note:    string;
  };

  const features: FeatureRow[] = [
    {
      key:     "analytics",
      label:   "Analytics & variant logging",
      active:  runtimeFeatures.analytics,
      pkgGate: !!(tenantSettings && !packageDef?.allowedFeatures.analytics),
      note:    "Events, session tracking, served-variant logging",
    },
    {
      key:     "experiments",
      label:   "A/B experiments",
      active:  runtimeFeatures.experiments,
      pkgGate: !!(tenantSettings && !packageDef?.allowedFeatures.experiments),
      note:    "ExperimentDecisionProvider; Growth or Pro required",
    },
    {
      key:     "ai",
      label:   "AI decision layer",
      active:  runtimeFeatures.ai,
      pkgGate: !!(tenantSettings && !packageDef?.allowedFeatures.ai),
      note:    "Shadow or live mode; Pro required; requires API key",
    },
  ];

  return (
    <ConfigSection
      title="Active Features"
      subtitle="Resolved values — tenant flag AND package entitlement both required"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          {features.map((f) => (
            <div
              key={f.key}
              className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${
                f.active
                  ? "border-success-200 bg-success-50"
                  : f.pkgGate
                    ? "border-warning-100 bg-warning-50"
                    : "border-neutral-100 bg-neutral-50"
              }`}
            >
              <span
                className={`mt-0.5 shrink-0 text-sm font-bold leading-none ${
                  f.active ? "text-success-600" : f.pkgGate ? "text-warning-400" : "text-neutral-300"
                }`}
                aria-hidden
              >
                {f.active ? "✓" : f.pkgGate ? "⬆" : "✗"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${f.active ? "text-neutral-800" : "text-neutral-400"}`}>
                    {f.label}
                  </span>
                  {f.pkgGate && (
                    <Badge variant="warning" size="sm">Upgrade</Badge>
                  )}
                </div>
                <p className="text-xs text-neutral-400">{f.note}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Diagnostics + raw stored flags */}
        <div className="space-y-3">
          <div className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
            diagnosticsBar
              ? "border-brand-200 bg-brand-50"
              : "border-neutral-100 bg-neutral-50"
          }`}>
            <span className={`text-sm font-bold ${diagnosticsBar ? "text-brand-600" : "text-neutral-300"}`} aria-hidden>
              {diagnosticsBar ? "✓" : "✗"}
            </span>
            <div>
              <span className={`text-sm font-medium ${diagnosticsBar ? "text-neutral-800" : "text-neutral-400"}`}>
                Diagnostics bar
              </span>
              <p className="text-xs text-neutral-400">
                NODE_ENV=development or NEXT_PUBLIC_DEBUG_DIAGNOSTICS=true
              </p>
            </div>
          </div>

          {tenantSettings && (
            <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2.5">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Stored flags (pre-package AND)
              </p>
              <PropGrid
                rows={[
                  {
                    label: "analytics",
                    value: <FlagChip active={tenantSettings.features.analytics} />,
                  },
                  {
                    label: "experiments",
                    value: <FlagChip active={tenantSettings.features.experiments} />,
                  },
                  {
                    label: "ai",
                    value: <FlagChip active={tenantSettings.features.ai} />,
                  },
                ]}
              />
              <p className="mt-2 text-xs leading-snug text-neutral-400">
                Raw stored values. Package entitlement applied on top —{" "}
                see the resolved column on the left.
              </p>
            </div>
          )}
        </div>
      </div>
    </ConfigSection>
  );
}

// ── 4. AI Configuration section ───────────────────────────────────────────────

type BadgeVariant = "default" | "primary" | "success" | "warning" | "error" | "outline";

function aiModeBadgeVariant(mode: string): BadgeVariant {
  if (mode === "live")   return "primary";
  if (mode === "shadow") return "warning";
  return "outline";
}

function AiProviderSlot({
  slotLabel,
  provider,
}: {
  slotLabel: string;
  provider:  AiProviderConfig;
}) {
  const keyEnvVar =
    provider.name === "claude"  ? "ANTHROPIC_API_KEY" :
    provider.name === "openai"  ? "OPENAI_API_KEY"    :
    provider.name === "gemini"  ? "GEMINI_API_KEY"    : null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {slotLabel}
        </span>
        <Badge variant="primary" size="sm">{provider.name}</Badge>
      </div>
      <PropGrid
        rows={[
          { label: "model",   value: <Mono>{provider.modelId}</Mono> },
          {
            label: "apiKey",
            value: provider.hasApiKey ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-success-700">
                <span aria-hidden>✓</span> configured
                {keyEnvVar && (
                  <span className="text-neutral-400">(tenant key or <Mono>{keyEnvVar}</Mono>)</span>
                )}
              </span>
            ) : (
              <span className="flex flex-col gap-1">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-error-700">
                  <span aria-hidden>⚠</span> missing
                </span>
                <span className="text-xs text-neutral-500">
                  {keyEnvVar && <>Set <Mono>{keyEnvVar}</Mono> or configure in the{" "}</>}
                  <a href="/admin/tenants" className="text-brand-600 hover:underline">
                    tenant admin
                  </a>
                  . AI returns <Mono>DisabledAiProvider</Mono> at runtime.
                </span>
              </span>
            ),
          },
          { label: "timeout", value: <Mono>{provider.timeoutMs} ms</Mono> },
        ]}
      />
    </div>
  );
}

function AiConfigSection({
  aiConfig,
  tenantSettings,
}: {
  aiConfig:       AiRuntimeConfig;
  tenantSettings: TenantSettings | null;
}) {
  const resolutionSource = tenantSettings
    ? "TenantSettings (admin-UI config) with env vars as fallback"
    : "env vars only — no TenantSettings record found";

  return (
    <ConfigSection title="AI Configuration" subtitle={`Resolved from: ${resolutionSource}`}>
      <div className="flex flex-col gap-4">
        <PropGrid
          rows={[
            {
              label: "mode",
              value: (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={aiModeBadgeVariant(aiConfig.mode)} size="sm" dot>
                    {aiConfig.mode}
                  </Badge>
                  <span className="text-xs text-neutral-400">
                    {aiConfig.mode === "disabled" && "AI off — rules engine decides all variants"}
                    {aiConfig.mode === "shadow"   && "AI runs in parallel; rules plan always served; both plans logged"}
                    {aiConfig.mode === "live"     && "AI plan served when confidence ≥ threshold; rules plan is fallback"}
                  </span>
                </div>
              ),
            },
            {
              label: "confidenceThreshold",
              value: (
                <div className="flex items-center gap-2">
                  <Mono>{(aiConfig.confidenceThreshold * 100).toFixed(0)}%</Mono>
                  <span className="text-xs text-neutral-400">
                    ({aiConfig.confidenceThreshold.toFixed(2)}) — minimum confidence to serve AI plan in live mode
                  </span>
                </div>
              ),
            },
          ]}
        />

        {aiConfig.mode === "live"   && aiConfig.liveProvider   && (
          <AiProviderSlot slotLabel="Live provider"   provider={aiConfig.liveProvider} />
        )}
        {aiConfig.mode === "shadow" && aiConfig.shadowProvider && (
          <AiProviderSlot slotLabel="Shadow provider" provider={aiConfig.shadowProvider} />
        )}

        {aiConfig.mode === "disabled" && (
          <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-4 py-3">
            <Text variant="body-sm" color="muted">
              AI is disabled. Enable in the{" "}
              <a href="/admin/tenants" className="text-brand-600 hover:underline">tenant admin</a>
              {" "}by setting AI mode to <strong>shadow</strong> or <strong>live</strong>.
            </Text>
          </div>
        )}

        {aiConfig.mode !== "disabled" && (
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span>→</span>
            <a href="/dashboard/ai" className="text-brand-600 hover:text-brand-700 hover:underline">
              View AI decision logs
            </a>
            <span>·</span>
            <a href="/admin/ai-logs" className="text-brand-600 hover:text-brand-700 hover:underline">
              All-tenant AI logs
            </a>
          </div>
        )}
      </div>
    </ConfigSection>
  );
}

// ── 5. Capability readiness section ───────────────────────────────────────────

function CapabilityReadinessSection({
  enabledContentTypes,
  enabledContextBlocks,
  templates,
  packageDef,
}: {
  enabledContentTypes:  ReadonlySet<ContentBlockKey> | null;
  enabledContextBlocks: ReadonlySet<ContextBlockKey>;
  templates:            ReturnType<typeof getAllTemplateDefinitions>;
  packageDef:           ReturnType<typeof getPackageDefinition> | null;
}) {
  // A block is "active" when either no content restriction (null) or it's in the set
  const isContentActive = (key: ContentBlockKey) =>
    enabledContentTypes === null || enabledContentTypes.has(key);

  const formsActive   = FORMS_BLOCKS.some(isContentActive);
  const listingActive = LISTING_BLOCKS.some(isContentActive);
  const vacancyActive = VACANCY_BLOCKS.some(isContentActive);
  const searchActive  = SEARCH_BLOCKS.some(isContentActive);

  // Template readiness: are all required context slots active?
  const templateReadiness = templates.map((tpl) => {
    const slots = tpl.contextSlots.map((s) => s.slotId as ContextBlockKey);
    const activeSlots = slots.filter((s) => enabledContextBlocks.has(s));
    const allActive   = slots.length === 0 || activeSlots.length === slots.length;
    return { tpl, slots, activeSlots, allActive };
  });

  type CapItem = { label: string; active: boolean; blocksActive: number; totalBlocks: number; note: string };
  const capabilities: CapItem[] = [
    {
      label:        "Forms & lead capture",
      active:       formsActive,
      blocksActive: FORMS_BLOCKS.filter(isContentActive).length,
      totalBlocks:  FORMS_BLOCKS.length,
      note:         "formSection block",
    },
    {
      label:        "Listing & articles",
      active:       listingActive,
      blocksActive: LISTING_BLOCKS.filter(isContentActive).length,
      totalBlocks:  LISTING_BLOCKS.length,
      note:         "listing · articleBody · articleMeta · relatedContent",
    },
    {
      label:        "Vacancy & job boards",
      active:       vacancyActive,
      blocksActive: VACANCY_BLOCKS.filter(isContentActive).length,
      totalBlocks:  VACANCY_BLOCKS.length,
      note:         "vacancyMeta · applyPanel",
    },
    {
      label:        "Full-text search",
      active:       searchActive,
      blocksActive: SEARCH_BLOCKS.filter(isContentActive).length,
      totalBlocks:  SEARCH_BLOCKS.length,
      note:         "search · filterBar",
    },
  ];

  return (
    <ConfigSection title="Capability Readiness">
      <div className="grid gap-6 sm:grid-cols-2">

        {/* Page templates */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Page templates
          </p>
          <p className="mb-3 text-xs leading-snug text-neutral-400">
            All templates are structurally available. Slot badges show which context
            slots are active (green) or absent (amber) on this tenant.
          </p>
          <div className="space-y-2">
            {templateReadiness.map(({ tpl, slots, activeSlots, allActive }) => (
              <div
                key={tpl.key}
                className={`rounded-lg border p-3 ${
                  allActive ? "border-success-200 bg-success-50" : "border-neutral-200 bg-white"
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm font-medium text-neutral-800">{tpl.displayName}</span>
                  {allActive ? (
                    <Badge variant="success" size="sm">Ready</Badge>
                  ) : slots.length === 0 ? (
                    <Badge variant="outline" size="sm">Editorial</Badge>
                  ) : (
                    <Badge variant="warning" size="sm">
                      {activeSlots.length}/{slots.length} slots active
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {slots.length === 0 ? (
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-400">
                      CMS-driven — no context slots
                    </span>
                  ) : (
                    slots.map((id) => (
                      <span
                        key={id}
                        className={`rounded px-1.5 py-0.5 text-xs ${
                          enabledContextBlocks.has(id)
                            ? "bg-success-100 text-success-700"
                            : "bg-warning-50 text-warning-600"
                        }`}
                      >
                        {id}
                      </span>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Feature support capabilities */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Feature support
          </p>
          <p className="mb-3 text-xs leading-snug text-neutral-400">
            Derived from enabled content blocks. At least one enabling block must be
            active for the group to be considered supported.
          </p>
          <div className="space-y-2">
            {capabilities.map((cap) => (
              <div
                key={cap.label}
                className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${
                  cap.active
                    ? "border-success-200 bg-success-50"
                    : "border-neutral-100 bg-neutral-50"
                }`}
              >
                <span
                  className={`mt-0.5 shrink-0 text-sm font-bold leading-none ${
                    cap.active ? "text-success-600" : "text-neutral-300"
                  }`}
                  aria-hidden
                >
                  {cap.active ? "✓" : "✗"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${cap.active ? "text-neutral-800" : "text-neutral-400"}`}>
                      {cap.label}
                    </span>
                    <span className={`text-xs tabular-nums ${cap.active ? "text-neutral-400" : "text-neutral-300"}`}>
                      {cap.blocksActive}/{cap.totalBlocks}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400">{cap.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </ConfigSection>
  );
}

// ── 6. Resolved design section ────────────────────────────────────────────────

function ResolvedDesignSection({
  resolvedTheme,
  tenantSettings,
}: {
  resolvedTheme:  ReturnType<typeof getResolvedTenantTheme>;
  tenantSettings: TenantSettings | null;
}) {
  const THEME_DISPLAY: Record<string, string> = {
    default: "Marketing Default",
    minimal: "Enterprise Clean",
    bold:    "Bold Brand",
    custom:  "Custom",
  };

  const presetLabel = THEME_DISPLAY[resolvedTheme.presetKey] ?? resolvedTheme.presetKey;
  const hasColorOverride = Boolean(tenantSettings?.design.primaryColor);
  const hasFontOverride  = Boolean(tenantSettings?.design.primaryFont);

  // Key resolved token subset — enough for a useful summary without being a full dump
  const colorTokens: { label: string; hex: string; cssVar: string }[] = [
    { label: "primary",    hex: resolvedTheme.colors.primary,      cssVar: "--primary" },
    { label: "primaryHover", hex: resolvedTheme.colors.primaryHover, cssVar: "--primary-hover" },
    { label: "textBrand",  hex: resolvedTheme.colors.textBrand,    cssVar: "--text-brand" },
    { label: "bg",         hex: resolvedTheme.colors.bg,           cssVar: "--bg" },
    { label: "bgSubtle",   hex: resolvedTheme.colors.bgSubtle,     cssVar: "--bg-subtle" },
    { label: "text",       hex: resolvedTheme.colors.text,         cssVar: "--text" },
    { label: "border",     hex: resolvedTheme.colors.border,       cssVar: "--border" },
  ];

  return (
    <ConfigSection
      title="Resolved Design"
      subtitle={`Preset: ${presetLabel} · resolved from TenantSettings.design`}
    >
      <div className="grid gap-6 sm:grid-cols-2">

        {/* Preset + overrides summary */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Theme &amp; overrides
          </p>
          <PropGrid
            rows={[
              {
                label: "preset",
                value: (
                  <div className="flex items-center gap-2">
                    <Badge variant="default" size="sm">{resolvedTheme.presetKey}</Badge>
                    <span className="text-xs text-neutral-400">{presetLabel}</span>
                  </div>
                ),
              },
              {
                label: "primaryColor",
                value: hasColorOverride ? (
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3.5 w-3.5 rounded-sm border border-black/10"
                      style={{ backgroundColor: resolvedTheme.colors.primary }}
                      aria-hidden
                    />
                    <Mono>{resolvedTheme.colors.primary}</Mono>
                    <Badge variant="primary" size="sm">overridden</Badge>
                  </div>
                ) : (
                  <span className="text-xs text-neutral-400">preset default · {resolvedTheme.colors.primary}</span>
                ),
              },
              {
                label: "fontFamily",
                value: hasFontOverride ? (
                  <div className="flex items-center gap-2">
                    <Mono>{resolvedTheme.typography.fontFamilySans}</Mono>
                    <Badge variant="primary" size="sm">overridden</Badge>
                  </div>
                ) : (
                  <span className="text-xs text-neutral-400 truncate max-w-[200px]" title={resolvedTheme.typography.fontFamilySans}>
                    preset default · {resolvedTheme.typography.fontFamilySans}
                  </span>
                ),
              },
              {
                label: "radius",
                value: (
                  <div className="flex items-center gap-2">
                    <Mono>{resolvedTheme.radius.interactive}</Mono>
                    <span className="text-xs text-neutral-400">interactive</span>
                  </div>
                ),
              },
              {
                label: "button",
                value: (
                  <div className="flex items-center gap-2">
                    <Mono>fw:{resolvedTheme.button.fontWeight}</Mono>
                    {resolvedTheme.button.textTransform !== "none" && (
                      <Mono>{resolvedTheme.button.textTransform}</Mono>
                    )}
                  </div>
                ),
              },
              {
                label: "headingWeight",
                value: <Mono>{resolvedTheme.typography.fontWeightHeading}</Mono>,
              },
            ]}
          />
          {tenantSettings && (
            <p className="text-xs leading-snug text-neutral-400">
              Configure in the{" "}
              <a href={`/admin/tenants/${tenantSettings.tenantId}`} className="text-brand-600 hover:underline">
                tenant admin → Design section
              </a>
              .
            </p>
          )}
        </div>

        {/* Resolved color token summary */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">
            Resolved key tokens
          </p>
          <dl className="flex flex-col gap-1.5">
            {colorTokens.map(({ label, hex, cssVar }) => (
              <div key={cssVar} className="flex items-center gap-2">
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-sm border border-black/10"
                  style={{ backgroundColor: hex }}
                  aria-hidden
                />
                <dt className="w-28 shrink-0 font-mono text-xs text-neutral-400 truncate" title={cssVar}>
                  {cssVar}
                </dt>
                <dd className="font-mono text-xs text-neutral-700">{hex}</dd>
              </div>
            ))}
          </dl>
        </div>

      </div>
    </ConfigSection>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function ConfigSection({
  title,
  subtitle,
  children,
}: {
  title:    string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card padding="none" shadow="none">
      <CardHeader className="border-b border-neutral-100 px-5 pt-4 pb-3">
        <Text variant="label" as="h2">{title}</Text>
        {subtitle && <Text variant="caption" color="muted">{subtitle}</Text>}
      </CardHeader>
      <CardContent className="px-5 py-4">{children}</CardContent>
    </Card>
  );
}

function PropGrid({ rows }: { rows: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-3">
      {rows.map(({ label, value }) => (
        <div key={label} className="contents">
          <dt className="self-center whitespace-nowrap font-mono text-xs text-neutral-400">{label}</dt>
          <dd className="min-w-0 self-center">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ColorGroup({
  label,
  pairs,
}: {
  label: string;
  pairs: { cssVar: string; label: string; hex: string }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <Text variant="caption" color="muted" as="p" weight="semibold">{label}</Text>
      <dl className="flex flex-col gap-1.5">
        {pairs.map(({ cssVar, label: propLabel, hex }) => (
          <div key={cssVar} className="flex items-center gap-2">
            <span
              className="size-3.5 shrink-0 rounded-sm border border-black/10"
              style={{ backgroundColor: hex }}
              aria-hidden
            />
            <dt className="w-32 shrink-0 truncate font-mono text-xs text-neutral-400" title={propLabel}>
              {cssVar}
            </dt>
            <dd className="font-mono text-xs text-neutral-700">{hex}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function PackageBadge({ packageKey }: { packageKey: PackageKey }) {
  const variant: BadgeVariant =
    packageKey === "pro"    ? "success" :
    packageKey === "growth" ? "primary" : "default";
  const label =
    packageKey === "pro"    ? "Pro" :
    packageKey === "growth" ? "Growth" : "Starter";
  return <Badge variant={variant} size="sm">{label}</Badge>;
}

function FlagChip({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? "success" : "outline"} size="sm" dot>
      {active ? "on" : "off"}
    </Badge>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs text-neutral-800">{children}</span>;
}
