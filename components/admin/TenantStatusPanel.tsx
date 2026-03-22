/**
 * TenantStatusPanel
 *
 * At-a-glance summary of a tenant's current configuration and the full
 * platform capability model as it applies to this tenant.  Three sections:
 *
 *   1. "At a glance"            — key config values with configured/missing indicators
 *   2. "Package capabilities"   — features, themes, limits for the tenant's package
 *   3. "Platform capabilities"  — templates, block categories, and feature support
 *                                  (forms, listing/articles, vacancies, search)
 *
 * ─── T1 addition ──────────────────────────────────────────────────────────────
 *
 *   Section 3 is new.  It surfaces the full platform model — templates, block
 *   categories grouped by editorial purpose, and four high-level capability
 *   groups (forms, listing, vacancies, search) — so an operator can see at a
 *   glance what this tenant's configuration unlocks without cross-referencing
 *   the form and packages.ts source.
 *
 *   Templates and registry are imported from @/page-config (no circular dep):
 *     getAllTemplateDefinitions() — the 3 registered page templates
 *     CATEGORY_GROUPS            — local constant mapping categories → block keys
 *
 * ─── Server-safe ──────────────────────────────────────────────────────────────
 *
 *   No "use client" directive — pure presentational, no hooks, no handlers.
 *   Safe to render as a Next.js Server Component or inside a client tree.
 *   Accepts TenantSettings as a prop; never reads from disk or env directly.
 */

import { cn }                              from "@/lib/utils";
import { Badge }                           from "@/components/ui/Badge";
import { Card, CardContent }               from "@/components/ui/Card";
import { getPackageDefinition, getPackageOption } from "@/tenant";
import { getAllTemplateDefinitions }        from "@/page-config";
import type { TenantSettings, PackageKey, ContentBlockKey, ThemeKey, ContextBlockKey } from "@/tenant";

// ── Types ─────────────────────────────────────────────────────────────────────

type BadgeVariant = "default" | "primary" | "success" | "warning" | "error" | "outline";

// ── Internal atoms ────────────────────────────────────────────────────────────

function StatusRow({
  label,
  value,
  sub,
  badge,
  badgeVariant = "outline",
}: {
  label:         string;
  value:         string;
  sub?:          string;
  badge?:        string;
  badgeVariant?: BadgeVariant;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-neutral-100 py-2.5 last:border-0">
      <span className="w-28 shrink-0 pt-px text-xs font-medium text-neutral-500">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5 text-right">
        <span className="text-sm text-neutral-900">{value}</span>
        {sub && <span className="text-xs text-neutral-400">({sub})</span>}
        {badge && <Badge variant={badgeVariant} size="sm">{badge}</Badge>}
      </div>
    </div>
  );
}

function CapRow({
  label,
  enabled,
  note,
}: {
  label:   string;
  enabled: boolean;
  note?:   string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "shrink-0 text-sm font-bold leading-none",
          enabled ? "text-success-600" : "text-neutral-300",
        )}
        aria-hidden
      >
        {enabled ? "✓" : "✗"}
      </span>
      <span className={cn("text-sm", enabled ? "text-neutral-800" : "text-neutral-400")}>
        {label}
      </span>
      {note && <span className="text-xs text-neutral-400">— {note}</span>}
    </div>
  );
}

function LimitRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-neutral-500">{label}</span>
      <span className="text-sm font-medium text-neutral-800">{value}</span>
    </div>
  );
}

function CapSection({ children }: { children: React.ReactNode }) {
  return (
    <p className="pt-3 text-xs font-semibold uppercase tracking-wider text-neutral-400 first:pt-0">
      {children}
    </p>
  );
}

// ── Lookup tables ─────────────────────────────────────────────────────────────

function packageBadgeVariant(key: PackageKey): BadgeVariant {
  switch (key) {
    case "starter": return "default";
    case "growth":  return "primary";
    case "pro":     return "success";
  }
}

const PACKAGE_DISPLAY: Record<PackageKey, string> = {
  starter: "Starter",
  growth:  "Growth",
  pro:     "Pro",
};

const THEME_DISPLAY: Record<ThemeKey, string> = {
  default: "Default",
  minimal: "Minimal",
  bold:    "Bold",
  custom:  "Custom",
};

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
  searchResults:      "Search results",  // internal rendering concept — not user-selectable
  search:             "Search",
  ctaSection:         "Call to action",
  formSection:        "Form",
  // careers / W6
  processSteps:       "Process steps",
  recruiterPanel:     "Recruiter panel",
};

function aiModeLabel(mode: "disabled" | "shadow" | "live"): string {
  switch (mode) {
    case "disabled": return "Disabled";
    case "shadow":   return "Shadow";
    case "live":     return "Live";
  }
}

function limitDisplay(n: number, zeroLabel = "Not permitted"): string {
  if (n === Infinity) return "Unlimited";
  if (n === 0)        return zeroLabel;
  return `Up to ${n}`;
}

// ── Derived booleans ──────────────────────────────────────────────────────────

function isCmsConfigured(tenant: TenantSettings): boolean {
  return tenant.cms.provider !== "mock" && Boolean(tenant.cms.projectId?.trim());
}

function isAiConfigured(tenant: TenantSettings): boolean {
  const { ai } = tenant;
  if (ai.mode === "disabled") return false;
  if (ai.mode === "live")     return Boolean(ai.liveProvider?.name);
  if (ai.mode === "shadow")   return Boolean(ai.shadowProvider?.name);
  return false;
}

function activeProviderLabel(tenant: TenantSettings): string | undefined {
  const { ai } = tenant;
  if (ai.mode === "live")   return ai.liveProvider?.name;
  if (ai.mode === "shadow") return ai.shadowProvider?.name;
  return undefined;
}

// ── Capability group helpers ───────────────────────────────────────────────────

function hasContentCapability(tenant: TenantSettings, keys: ContentBlockKey[]): boolean {
  const allowed = new Set(tenant.blocks.content);
  return keys.some((k) => allowed.has(k));
}

function countEnabledBlocks(tenant: TenantSettings, keys: ContentBlockKey[]): number {
  const allowed = new Set(tenant.blocks.content);
  return keys.filter((k) => allowed.has(k)).length;
}

// ── Block category groups ─────────────────────────────────────────────────────
//
// Maps editorial purpose → block keys.  Used to build the block matrix in
// Section 3.  The labels are operator-friendly, not raw category names.

const CATEGORY_GROUPS: { label: string; keys: ContentBlockKey[]; note?: string }[] = [
  { label: "Text & typography",  keys: ["textSection", "richText"] },
  { label: "Media",              keys: ["image", "video", "slider"] },
  { label: "Social proof",       keys: ["testimonialSection", "quote", "logoStrip", "stats"] },
  { label: "Features & content", keys: ["featureGrid", "faqSection", "about", "newsList", "caseHighlight"] },
  { label: "Listing & articles", keys: ["listing", "articleBody", "articleMeta", "relatedContent"], note: "Blog + content overviews" },
  { label: "Vacancies",          keys: ["vacancyMeta", "applyPanel", "filterBar"], note: "Job board + vacancy detail" },
  { label: "Search",             keys: ["search"] },
  { label: "Conversion",         keys: ["ctaSection", "formSection"] },
];

// Feature-support check groups
const FORMS_BLOCKS:   ContentBlockKey[] = ["formSection"];
const LISTING_BLOCKS: ContentBlockKey[] = ["listing", "articleBody", "articleMeta", "relatedContent"];
const VACANCY_BLOCKS: ContentBlockKey[] = ["vacancyMeta", "applyPanel"];
const SEARCH_BLOCKS:  ContentBlockKey[] = ["search", "filterBar"];

// ── Section 3 sub-components ──────────────────────────────────────────────────

/** Template card: shows name, slot structure, and which slots are active on this package. */
function TemplateCard({
  displayName,
  slotIds,
  description,
  allowedContextBlocks,
}: {
  displayName:          string;
  slotIds:              ContextBlockKey[];
  description:          string;
  allowedContextBlocks: readonly ContextBlockKey[];
}) {
  const allowedSet     = new Set(allowedContextBlocks);
  const allSlotsActive = slotIds.length === 0 || slotIds.every((s) => allowedSet.has(s));

  return (
    <div className={cn(
      "rounded-lg border p-3",
      allSlotsActive ? "border-neutral-200 bg-white" : "border-neutral-100 bg-neutral-50",
    )}>
      <div className="mb-1 flex items-center gap-2">
        <span className="text-sm font-medium text-neutral-800">{displayName}</span>
        {allSlotsActive ? (
          <Badge variant="success" size="sm">Full</Badge>
        ) : slotIds.length === 0 ? (
          <Badge variant="outline" size="sm">Editorial</Badge>
        ) : (
          <Badge variant="warning" size="sm">Partial</Badge>
        )}
      </div>
      <p className="mb-2 text-xs leading-snug text-neutral-400">{description}</p>
      <div className="flex flex-wrap gap-1">
        {slotIds.length === 0 ? (
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-400">
            CMS-driven only
          </span>
        ) : (
          slotIds.map((id) => (
            <span
              key={id}
              className={cn(
                "rounded px-1.5 py-0.5 text-xs",
                allowedSet.has(id)
                  ? "bg-success-50 text-success-700"
                  : "bg-warning-50 text-warning-700",
              )}
            >
              {id}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

/** Block category row: enabled vs. package ceiling, with a thin fill bar. */
function BlockCategoryRow({
  label,
  enabledCount,
  totalInPackage,
  totalInPlatform,
  note,
}: {
  label:           string;
  enabledCount:    number;
  totalInPackage:  number;
  totalInPlatform: number;
  note?:           string;
}) {
  const fraction   = totalInPackage > 0 ? enabledCount / totalInPackage : 0;
  const barWidth   = Math.round(fraction * 100);
  const allEnabled = enabledCount > 0 && enabledCount === totalInPackage;
  const noneOnPkg  = totalInPackage === 0;

  return (
    <div className="border-b border-neutral-100 py-2 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={cn("text-sm", noneOnPkg ? "text-neutral-300" : "text-neutral-700")}>
            {label}
          </span>
          {note && (
            <span className="hidden text-xs text-neutral-400 xl:inline">— {note}</span>
          )}
        </div>
        <span className={cn(
          "shrink-0 text-xs tabular-nums",
          noneOnPkg    ? "text-neutral-300"
          : allEnabled ? "text-success-600"
          : "text-neutral-500",
        )}>
          {noneOnPkg
            ? `0 / ${totalInPlatform} (upgrade)`
            : `${enabledCount} / ${totalInPackage}`}
        </span>
      </div>
      {totalInPackage > 0 && (
        <div className="mt-1.5 h-1 w-full rounded-full bg-neutral-100">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              allEnabled ? "bg-success-400" : barWidth > 0 ? "bg-brand-400" : "bg-neutral-200",
            )}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      )}
    </div>
  );
}

/** Feature-support row: ✓/✗ with block count and a description note. */
function SupportRow({
  label,
  supported,
  enabledCount,
  totalCount,
  note,
}: {
  label:        string;
  supported:    boolean;
  enabledCount: number;
  totalCount:   number;
  note?:        string;
}) {
  return (
    <div className="flex items-start gap-2 border-b border-neutral-100 py-2 last:border-0">
      <span
        className={cn(
          "mt-0.5 shrink-0 text-sm font-bold leading-none",
          supported ? "text-success-600" : "text-neutral-300",
        )}
        aria-hidden
      >
        {supported ? "✓" : "✗"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("text-sm", supported ? "text-neutral-800" : "text-neutral-400")}>
            {label}
          </span>
          <span className={cn(
            "text-xs tabular-nums",
            supported ? "text-neutral-400" : "text-neutral-300",
          )}>
            {enabledCount}/{totalCount} blocks
          </span>
        </div>
        {note && <p className="text-xs text-neutral-400">{note}</p>}
      </div>
    </div>
  );
}

// Template descriptions — static, matches template intent from templates.ts
const TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  "marketing-page": "Adaptive hero, proof, and CTA slots around a content block array. Standard adaptive homepage.",
  "landing-page":   "Hero + CTA slots, no proof block. Focused conversion pages and campaign landings.",
  "article-page":   "No context slots — pure CMS-driven editorial. Blog posts, documentation, guides.",
};

/** Section 3: templates, block matrix, feature support, and token overrides. */
function PlatformCapabilitiesSection({ tenant }: { tenant: TenantSettings }) {
  const pkg        = getPackageDefinition(tenant.packageKey);
  const pkgAllowed = new Set(pkg.allowedBlocks.content);
  const templates  = getAllTemplateDefinitions();

  const formsSupported   = hasContentCapability(tenant, FORMS_BLOCKS);
  const listingSupported = hasContentCapability(tenant, LISTING_BLOCKS);
  const vacancySupported = hasContentCapability(tenant, VACANCY_BLOCKS);
  const searchSupported  = hasContentCapability(tenant, SEARCH_BLOCKS);

  const tenantAllowed = new Set(tenant.blocks.content);
  const categoryRows  = CATEGORY_GROUPS.map((g) => ({
    ...g,
    pkgTotal:     g.keys.filter((k) => pkgAllowed.has(k)).length,
    platformTotal: g.keys.length,
    enabled:       g.keys.filter((k) => pkgAllowed.has(k) && tenantAllowed.has(k)).length,
  }));

  return (
    <div>
      <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-neutral-400">
        Platform capabilities
      </p>

      <div className="grid gap-4 lg:grid-cols-3">

        {/* ── Templates ────────────────────────────────────────────────────── */}
        <div>
          <p className="mb-1 text-xs font-medium text-neutral-500">Page templates</p>
          <p className="mb-3 text-xs leading-snug text-neutral-400">
            All templates are available on every package.
            Context slot badges show which slots are active (green)
            or inactive (amber) on this package.
          </p>
          <div className="space-y-2">
            {templates.map((tpl) => {
              const slots = tpl.contextSlots.map((s) => s.slotId as ContextBlockKey);
              return (
                <TemplateCard
                  key={tpl.key}
                  displayName={tpl.displayName}
                  slotIds={slots}
                  description={TEMPLATE_DESCRIPTIONS[tpl.key] ?? ""}
                  allowedContextBlocks={pkg.allowedBlocks.context}
                />
              );
            })}
          </div>
        </div>

        {/* ── Block categories ─────────────────────────────────────────────── */}
        <div>
          <p className="mb-1 text-xs font-medium text-neutral-500">Block categories</p>
          <p className="mb-3 text-xs leading-snug text-neutral-400">
            Blocks enabled for this tenant vs. what this package allows.
            Categories not on the package show the upgrade ceiling.
          </p>
          <div>
            {categoryRows.map((row) => (
              <BlockCategoryRow
                key={row.label}
                label={row.label}
                enabledCount={row.enabled}
                totalInPackage={row.pkgTotal}
                totalInPlatform={row.platformTotal}
                note={row.note}
              />
            ))}
          </div>
        </div>

        {/* ── Feature support + token overrides ────────────────────────────── */}
        <div>
          <p className="mb-1 text-xs font-medium text-neutral-500">Feature support</p>
          <p className="mb-3 text-xs leading-snug text-neutral-400">
            High-level capability groups — whether at least one enabling
            block is active in this tenant&apos;s configuration.
          </p>
          <div>
            <SupportRow
              label="Forms & lead capture"
              supported={formsSupported}
              enabledCount={countEnabledBlocks(tenant, FORMS_BLOCKS)}
              totalCount={FORMS_BLOCKS.length}
              note="formSection"
            />
            <SupportRow
              label="Listing & articles"
              supported={listingSupported}
              enabledCount={countEnabledBlocks(tenant, LISTING_BLOCKS)}
              totalCount={LISTING_BLOCKS.length}
              note="listing, articleBody, articleMeta, relatedContent"
            />
            <SupportRow
              label="Vacancy & job boards"
              supported={vacancySupported}
              enabledCount={countEnabledBlocks(tenant, VACANCY_BLOCKS)}
              totalCount={VACANCY_BLOCKS.length}
              note="vacancyMeta + applyPanel"
            />
            <SupportRow
              label="Full-text search"
              supported={searchSupported}
              enabledCount={countEnabledBlocks(tenant, SEARCH_BLOCKS)}
              totalCount={SEARCH_BLOCKS.length}
              note="search, filterBar"
            />
          </div>

          {/* ── Token overrides summary ──────────────────────────────────── */}
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-neutral-500">Active token overrides</p>
            <div className="space-y-1.5 rounded-lg border border-neutral-100 bg-neutral-50 p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-neutral-500">Theme preset</span>
                <Badge variant="outline" size="sm">
                  {THEME_DISPLAY[tenant.design.theme]}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-neutral-500">Primary colour</span>
                <div className="flex items-center gap-1.5">
                  {tenant.design.primaryColor ? (
                    <>
                      <span
                        className="inline-block h-3 w-3 rounded-full border border-neutral-200"
                        style={{ background: tenant.design.primaryColor }}
                        aria-hidden
                      />
                      <span className="font-mono text-neutral-700">
                        {tenant.design.primaryColor}
                      </span>
                    </>
                  ) : (
                    <span className="text-neutral-400">preset default</span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-neutral-500">Font family</span>
                <span className={cn(
                  "max-w-[140px] truncate text-right",
                  tenant.design.primaryFont ? "text-neutral-700" : "text-neutral-400",
                )}>
                  {tenant.design.primaryFont ?? "preset default"}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TenantStatusPanel({ tenant }: { tenant: TenantSettings }) {
  const pkg = getPackageDefinition(tenant.packageKey);
  const opt = getPackageOption(tenant.packageKey);

  // ── CMS status ──────────────────────────────────────────────────────────────
  const cmsConfigured = isCmsConfigured(tenant);
  const cmsIsMock     = tenant.cms.provider === "mock";
  const cmsValueLabel = cmsIsMock
    ? "Mock (local dev)"
    : tenant.cms.provider.charAt(0).toUpperCase() + tenant.cms.provider.slice(1);

  const cmsBadge: { text: string; variant: BadgeVariant } = cmsIsMock
    ? { text: "Dev only",         variant: "warning" }
    : cmsConfigured
      ? { text: "✓ Configured",     variant: "success" }
      : { text: "⚠ Not configured", variant: "warning" };

  const cmsSub = !cmsIsMock && tenant.cms.projectId
    ? tenant.cms.projectId + (tenant.cms.dataset ? ` / ${tenant.cms.dataset}` : "")
    : undefined;

  // ── AI status ───────────────────────────────────────────────────────────────
  const aiConfigured    = isAiConfigured(tenant);
  const aiMode          = tenant.ai.mode;
  const aiProviderName  = activeProviderLabel(tenant);
  const aiProviderModel = aiMode === "live"
    ? tenant.ai.liveProvider?.model
    : aiMode === "shadow"
      ? tenant.ai.shadowProvider?.model
      : undefined;

  const aiBadge: { text: string; variant: BadgeVariant } | undefined =
    aiMode === "disabled"
      ? undefined
      : aiConfigured
        ? { text: `✓ ${aiProviderName}${aiProviderModel ? ` / ${aiProviderModel}` : ""}`, variant: "success" }
        : { text: "⚠ No provider set", variant: "warning" };

  const aiSub = aiMode !== "disabled" && tenant.ai.confidenceThreshold !== undefined
    ? `threshold: ${tenant.ai.confidenceThreshold}`
    : undefined;

  // ── Feature status ──────────────────────────────────────────────────────────
  const analyticsActive   = tenant.features.analytics   && pkg.allowedFeatures.analytics;
  const experimentsActive = tenant.features.experiments && pkg.allowedFeatures.experiments;
  const aiFeatureActive   = tenant.features.ai          && pkg.allowedFeatures.ai;

  return (
    <div className="mb-8">

      {/* ── Rows 1 + 2 : At a glance & Package capabilities ──────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* At a glance */}
        <Card padding="md" shadow="sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            At a glance
          </p>
          <CardContent>
            <div>
              <StatusRow
                label="Package"
                value={PACKAGE_DISPLAY[tenant.packageKey]}
                sub={pkg.shortDescription}
                badge={PACKAGE_DISPLAY[tenant.packageKey]}
                badgeVariant={packageBadgeVariant(tenant.packageKey)}
              />
              <StatusRow
                label="CMS"
                value={cmsValueLabel}
                sub={cmsSub}
                badge={cmsBadge.text}
                badgeVariant={cmsBadge.variant}
              />
              <StatusRow
                label="AI mode"
                value={aiModeLabel(aiMode)}
                sub={aiSub}
                badge={aiBadge?.text}
                badgeVariant={aiBadge?.variant}
              />
              <StatusRow
                label="Theme"
                value={THEME_DISPLAY[tenant.design.theme]}
                sub={
                  tenant.design.primaryColor
                    ? `custom colour: ${tenant.design.primaryColor}`
                    : undefined
                }
              />
              <StatusRow
                label="Analytics"
                value={analyticsActive ? "Enabled" : "Disabled"}
                badge={analyticsActive ? "✓ Active" : undefined}
                badgeVariant={analyticsActive ? "success" : "outline"}
              />
              <StatusRow
                label="Experiments"
                value={
                  !pkg.allowedFeatures.experiments
                    ? "Unavailable on this package"
                    : experimentsActive ? "Enabled" : "Disabled"
                }
                badge={
                  !pkg.allowedFeatures.experiments
                    ? "Upgrade required"
                    : experimentsActive ? "✓ Active" : undefined
                }
                badgeVariant={
                  !pkg.allowedFeatures.experiments ? "warning"
                  : experimentsActive ? "success" : "outline"
                }
              />
              <StatusRow
                label="AI feature"
                value={
                  !pkg.allowedFeatures.ai
                    ? "Unavailable on this package"
                    : aiFeatureActive ? "Enabled" : "Disabled"
                }
                badge={
                  !pkg.allowedFeatures.ai
                    ? "Pro only"
                    : aiFeatureActive ? "✓ Active" : undefined
                }
                badgeVariant={
                  !pkg.allowedFeatures.ai ? "warning"
                  : aiFeatureActive ? "success" : "outline"
                }
              />
              <StatusRow
                label="Context blocks"
                value={`${tenant.blocks.context.length} of 3 active`}
                sub={tenant.blocks.context.join(", ") || "none"}
              />
            </div>
          </CardContent>
        </Card>

        {/* Package capabilities */}
        <Card padding="md" shadow="sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            {PACKAGE_DISPLAY[tenant.packageKey]} package capabilities
          </p>
          <p className="mb-3 text-xs italic text-neutral-400">{pkg.shortDescription}</p>
          <CardContent>
            <div className="space-y-1.5">

              <CapSection>What&apos;s included</CapSection>
              {opt.highlights.map((h, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className="mt-0.5 shrink-0 text-xs text-success-500" aria-hidden>✓</span>
                  <span className="text-xs text-neutral-700">{h}</span>
                </div>
              ))}

              <CapSection>Platform features</CapSection>
              <CapRow label="A/B experiments"         enabled={pkg.allowedFeatures.experiments} />
              <CapRow label="AI decision layer"       enabled={pkg.allowedFeatures.ai} />
              <CapRow label="Analytics &amp; logging" enabled={pkg.allowedFeatures.analytics} />

              <CapSection>Adaptive (context) blocks</CapSection>
              {(["hero", "proof", "cta"] as const).map((block) => (
                <CapRow
                  key={block}
                  label={block}
                  enabled={pkg.allowedBlocks.context.includes(block)}
                />
              ))}

              <CapSection>Theme presets</CapSection>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {(["default", "minimal", "bold", "custom"] as ThemeKey[]).map((t) => {
                  const allowed = pkg.allowedThemes.includes(t);
                  return (
                    <Badge
                      key={t}
                      variant={allowed ? "primary" : "outline"}
                      size="sm"
                      className={allowed ? "" : "opacity-40"}
                    >
                      {THEME_DISPLAY[t]}
                    </Badge>
                  );
                })}
              </div>

              <CapSection>Limits</CapSection>
              <LimitRow label="Sites"                  value={limitDisplay(pkg.limits.maxSites, "1")} />
              <LimitRow label="Concurrent experiments" value={limitDisplay(pkg.limits.maxExperiments)} />
              {pkg.limits.maxVariantsPerExperiment !== undefined && (
                <LimitRow
                  label="Variants per experiment"
                  value={limitDisplay(pkg.limits.maxVariantsPerExperiment)}
                />
              )}
              <LimitRow label="Variants per slot" value={limitDisplay(pkg.limits.maxVariantsPerSlot)} />

              <CapSection>Content blocks (package ceiling)</CapSection>
              <p className="text-xs leading-snug text-neutral-400">
                {pkg.allowedBlocks.content.length} of{" "}
                {Object.keys(CONTENT_BLOCK_DISPLAY).length} block types on this package.
              </p>
              <div className="flex flex-wrap gap-1 pt-0.5">
                {pkg.allowedBlocks.content.map((key) => (
                  <span
                    key={key}
                    className="rounded bg-brand-50 px-1.5 py-0.5 text-xs text-brand-700"
                  >
                    {CONTENT_BLOCK_DISPLAY[key]}
                  </span>
                ))}
              </div>

            </div>
          </CardContent>
        </Card>

      </div>

      {/* ── Row 3: Platform capability summary ───────────────────────────── */}
      <Card padding="md" shadow="sm" className="mt-4">
        <CardContent>
          <PlatformCapabilitiesSection tenant={tenant} />
        </CardContent>
      </Card>

    </div>
  );
}
