/**
 * Content Status Page
 *
 * Internal launch-readiness dashboard. Shows the complete adaptive content
 * inventory for the active tenant — what exists in the CMS, where there are
 * gaps, and whether the tenant is ready to go live.
 *
 * ─── Data pipeline ────────────────────────────────────────────────────────────
 *
 *   1. getActiveTenant()                      → TenantConfig
 *   2. createCMSProvider()                    → CMSProvider (env-selected)
 *   3. buildContentReadinessContext()         → async CMS snapshot + tenant
 *   4. evaluateReadiness()                    → ReadinessReport (19 checks)
 *   5. Render — all components are pure RSC, no client JS needed
 *
 * ─── Page sections ────────────────────────────────────────────────────────────
 *
 *   LaunchReadinessBanner  — isLaunchReady flag + error/warning/info/pass counts
 *   VariantCoverageSection — per-key grid: live / missing / quality issues
 *   ConfigSection          — enabled page types, blocks, feature flags, providers
 *   ReadinessChecksSection — all 19 checks grouped by category
 *   FetchErrorsSection     — CMS fetch errors (shown only when errors exist)
 */

import type { TenantConfig }      from "@/tenant/types";
import type {
  ReadinessReport,
  CheckResultEntry,
  CheckCategory,
  CheckSeverity,
  ContentSnapshot,
  CheckStatus,
}                                  from "@/content-readiness/types";
import { getActiveTenantWithDevOverride } from "@/tenant/server";
import { createCMSProvider }       from "@/cms";
import {
  buildContentReadinessContext,
  evaluateReadiness,
  getBlockingChecks,
  getFailedChecks,
  getChecksByCategory,
  getSkippedChecks,
  PLATFORM_VARIANT_KEYS,
}                                  from "@/content-readiness";

// ── Page metadata ──────────────────────────────────────────────────────────────

export const metadata = { title: "Content Status · Dashboard" };

// ── Page props ────────────────────────────────────────────────────────────────

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// ── Page entry point ───────────────────────────────────────────────────────────

export default async function ContentStatusPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // In development, ?tenant=<id> overrides host-based resolution so a developer
  // can inspect content-status for any registered tenant without switching hosts.
  const { tenantConfig, devTenantOverride } =
    await getActiveTenantWithDevOverride(params, "dashboard/content-status");

  // Alias to `tenant` to keep all downstream references unchanged.
  const tenant = tenantConfig;

  // Scope the CMS provider to the active tenant so readiness checks use the
  // exact same query context as the live homepage (tenant-specific variants
  // first, shared platform variants second).  Without this, a null tenantId
  // would make the check see all-tenant documents — content that another
  // tenant's visitors would never actually receive.
  const cms    = createCMSProvider(undefined, tenant.tenantId);

  let report: ReadinessReport;
  let snapshot: ContentSnapshot;

  try {
    const context = await buildContentReadinessContext(tenant, cms);
    report   = evaluateReadiness(context);
    snapshot = context.snapshot;
  } catch (err) {
    const buildError = err instanceof Error ? err.message : String(err);
    return (
      <div className="flex flex-col gap-6 px-8 py-8">
        <PageHeader tenant={tenant} devTenantOverride={devTenantOverride} />
        {devTenantOverride && <DevOverrideBanner tenantId={devTenantOverride} page="content-status" />}
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
          <strong>Failed to build content context:</strong> {buildError}
          <p className="mt-1 text-xs text-red-600">
            Check that the CMS provider is configured and the content keys are accessible.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 px-8 py-8">
      <PageHeader tenant={tenant} report={report} devTenantOverride={devTenantOverride} />
      {devTenantOverride && <DevOverrideBanner tenantId={devTenantOverride} page="content-status" />}
      <LaunchReadinessBanner report={report} />
      <VariantCoverageSection tenant={tenant} snapshot={snapshot} report={report} />
      <ConfigSection tenant={tenant} />
      <ReadinessChecksSection report={report} />
      {snapshot.errors.length > 0 && (
        <FetchErrorsSection errors={snapshot.errors} />
      )}
    </div>
  );
}

// ── Query helpers ──────────────────────────────────────────────────────────────

/**
 * Returns the worst failure severity for a given variant key across all failed checks.
 * Used to colour the variant card appropriately.
 * Returns null if no failed check mentions this key.
 */
function getKeyWorstSeverity(
  key:    string,
  report: ReadinessReport,
): CheckSeverity | null {
  const failed = getFailedChecks(report);
  const SEV_ORDER: CheckSeverity[] = ["error", "warning", "info"];

  for (const sev of SEV_ORDER) {
    const hit = failed.some(
      (e) => e.check.severity === sev && (e.result.affectedKeys ?? []).includes(key),
    );
    if (hit) return sev;
  }
  return null;
}

/**
 * Derive hero/proof/cta key lists for display.
 * Uses the same resolution logic as the checklist — tenant-scoped when
 * tenant.variants is set, otherwise falls back to PLATFORM_VARIANT_KEYS.
 */
function getDisplayKeys(tenant: TenantConfig) {
  return {
    heroKeys:  tenant.variants?.hero  ?? [...PLATFORM_VARIANT_KEYS.hero],
    proofKeys: tenant.variants?.proof ?? [...PLATFORM_VARIANT_KEYS.proof],
    ctaKeys:   tenant.variants?.cta   ?? [...PLATFORM_VARIANT_KEYS.cta],
  };
}

/** Count checks with a given status across a subset of entries. */
function countByStatus(entries: CheckResultEntry[], status: CheckStatus): number {
  return entries.filter((e) => e.result.status === status).length;
}

/** Count failed checks with a given severity. */
function countFailsBySeverity(report: ReadinessReport, severity: CheckSeverity): number {
  return getFailedChecks(report).filter((e) => e.check.severity === severity).length;
}

// ── Page header ────────────────────────────────────────────────────────────────

function PageHeader({
  tenant,
  report,
  devTenantOverride,
}: {
  tenant:             TenantConfig;
  report?:            ReadinessReport;
  devTenantOverride?: string | null;
}) {
  const fetchedAt = report
    ? new Date(report.evaluatedAt).toLocaleTimeString(undefined, {
        hour:   "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  // Preserve ?tenant= override in the refresh link so re-loading the page
  // keeps the same dev tenant context active.
  const refreshHref = devTenantOverride
    ? `/dashboard/content-status?tenant=${encodeURIComponent(devTenantOverride)}`
    : "/dashboard/content-status";

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-neutral-900">Content Status</h1>
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <span>
            Tenant:{" "}
            <span className="font-medium text-neutral-700">{tenant.name}</span>
          </span>
          <span className="text-neutral-300">·</span>
          <span className="font-mono text-xs">{tenant.tenantId}</span>
          {devTenantOverride && (
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 font-mono text-xs text-amber-700">
              dev override
            </span>
          )}
          {fetchedAt && (
            <>
              <span className="text-neutral-300">·</span>
              <span className="text-xs">Checked at {fetchedAt}</span>
            </>
          )}
        </div>
      </div>

      {/* Refresh link — triggers a full server re-render, preserves dev override */}
      <a
        href={refreshHref}
        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-600 shadow-sm hover:bg-neutral-50 transition-colors"
      >
        <RefreshIcon />
        Refresh
      </a>
    </div>
  );
}

// ── Dev override banner ────────────────────────────────────────────────────────

function DevOverrideBanner({ tenantId, page }: { tenantId: string; page: string }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <strong>Dev override active.</strong> Showing data for tenant{" "}
      <code className="font-mono font-semibold">{tenantId}</code> via{" "}
      <code className="font-mono">?tenant=</code> query param.{" "}
      This override is ignored in production.
      {" "}
      <span className="text-amber-600">
        Bookmark:{" "}
        <code className="font-mono text-xs">/dashboard/{page}?tenant={tenantId}</code>
      </span>
    </div>
  );
}

// ── Launch readiness banner ────────────────────────────────────────────────────

function LaunchReadinessBanner({ report }: { report: ReadinessReport }) {
  const { summary, isLaunchReady } = report;
  const errors   = countFailsBySeverity(report, "error");
  const warnings = countFailsBySeverity(report, "warning");
  const infos    = countFailsBySeverity(report, "info");

  const bannerCls = isLaunchReady
    ? errors === 0 && warnings === 0
      ? "border-green-200 bg-green-50"
      : "border-amber-200 bg-amber-50"
    : "border-red-200 bg-red-50";

  const dotCls = isLaunchReady
    ? errors === 0 && warnings === 0
      ? "bg-green-500"
      : "bg-amber-500"
    : "bg-red-500";

  const labelCls = isLaunchReady
    ? errors === 0 && warnings === 0
      ? "text-green-800"
      : "text-amber-800"
    : "text-red-800";

  const statusLabel = isLaunchReady
    ? warnings > 0
      ? "Launch ready — warnings present"
      : "Launch ready"
    : "Not launch ready";

  return (
    <div className={`rounded-xl border px-5 py-4 ${bannerCls}`}>
      <div className="flex items-start justify-between gap-6 flex-wrap">
        {/* Status */}
        <div className="flex items-center gap-2.5">
          <span className={`size-2.5 shrink-0 rounded-full ${dotCls}`} />
          <span className={`text-base font-semibold ${labelCls}`}>
            {statusLabel}
          </span>
        </div>

        {/* Counter row */}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {errors > 0 && (
            <Counter value={errors} label={errors === 1 ? "blocking error" : "blocking errors"} color="text-red-700" />
          )}
          {warnings > 0 && (
            <Counter value={warnings} label={warnings === 1 ? "warning" : "warnings"} color="text-amber-700" />
          )}
          {infos > 0 && (
            <Counter value={infos} label={infos === 1 ? "info note" : "info notes"} color="text-sky-700" />
          )}
          <Counter value={summary.passed} label={summary.passed === 1 ? "check passed" : "checks passed"} color="text-green-700" />
          {summary.skipped > 0 && (
            <Counter value={summary.skipped} label={summary.skipped === 1 ? "skipped" : "skipped"} color="text-neutral-500" />
          )}
        </div>
      </div>

      {/* Blocker list */}
      {!isLaunchReady && (
        <div className="mt-3 border-t border-red-200 pt-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-red-700">
            Blocking issues
          </p>
          <ul className="flex flex-col gap-1">
            {getBlockingChecks(report).map((entry) => (
              <li key={entry.check.id} className="text-sm text-red-800">
                <span className="font-medium">{entry.check.label}:</span>{" "}
                {entry.result.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Counter({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  return (
    <span className={`flex items-baseline gap-1 ${color}`}>
      <strong className="text-base font-bold tabular-nums">{value}</strong>
      <span className="text-xs">{label}</span>
    </span>
  );
}

// ── Variant coverage section ───────────────────────────────────────────────────

function VariantCoverageSection({
  tenant,
  snapshot,
  report,
}: {
  tenant:   TenantConfig;
  snapshot: ContentSnapshot;
  report:   ReadinessReport;
}) {
  const { heroKeys, proofKeys, ctaKeys } = getDisplayKeys(tenant);

  return (
    <section aria-label="Variant coverage">
      <SectionHeader
        title="Variant Coverage"
        description="CMS content status for every platform variant key. Green = live content. Red = missing or has blocking issues."
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <VariantBlock
          title="Hero"
          blockType="hero"
          keys={heroKeys}
          contentMap={snapshot.hero}
          report={report}
        />
        <VariantBlock
          title="Proof"
          blockType="proof"
          keys={proofKeys}
          contentMap={snapshot.proof}
          report={report}
        />
        <VariantBlock
          title="CTA"
          blockType="cta"
          keys={ctaKeys}
          contentMap={snapshot.cta}
          report={report}
        />
      </div>
    </section>
  );
}

function VariantBlock({
  title,
  blockType,
  keys,
  contentMap,
  report,
}: {
  title:      string;
  blockType:  "hero" | "proof" | "cta";
  keys:       readonly string[];
  contentMap: Record<string, unknown | null>;
  report:     ReadinessReport;
}) {
  const liveCount = keys.filter((k) => contentMap[k] != null).length;

  const BLOCK_COLOR: Record<string, string> = {
    hero:  "text-violet-700 bg-violet-50 border-violet-200",
    proof: "text-sky-700    bg-sky-50    border-sky-200",
    cta:   "text-amber-700  bg-amber-50  border-amber-200",
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      {/* Block header */}
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${BLOCK_COLOR[blockType]}`}>
          {title}
        </span>
        <span className="text-xs text-neutral-500">
          <strong className="text-neutral-800 tabular-nums">{liveCount}</strong>
          /{keys.length} live
        </span>
      </div>

      {/* Variant cards */}
      <div className="divide-y divide-neutral-50">
        {keys.length === 0 ? (
          <p className="px-4 py-4 text-sm text-neutral-400 italic">No keys configured.</p>
        ) : (
          keys.map((key) => (
            <VariantCard
              key={key}
              variantKey={key}
              hasContent={contentMap[key] != null}
              worstSeverity={getKeyWorstSeverity(key, report)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function VariantCard({
  variantKey,
  hasContent,
  worstSeverity,
}: {
  variantKey:    string;
  hasContent:    boolean;
  worstSeverity: CheckSeverity | null;
}) {
  // Determine display state
  type CardState = "live" | "warning" | "info" | "error" | "missing";

  const state: CardState = !hasContent
    ? "missing"
    : worstSeverity === "error"
      ? "error"
      : worstSeverity === "warning"
        ? "warning"
        : worstSeverity === "info"
          ? "info"
          : "live";

  const STATE_CONFIG: Record<CardState, { icon: string; dotCls: string; labelCls: string; label: string }> = {
    live:    { icon: "✓", dotCls: "text-green-500",  labelCls: "text-green-700",  label: "live" },
    warning: { icon: "⚠", dotCls: "text-amber-500",  labelCls: "text-amber-700",  label: "warnings" },
    info:    { icon: "○", dotCls: "text-sky-500",    labelCls: "text-sky-700",    label: "info" },
    error:   { icon: "✗", dotCls: "text-red-500",    labelCls: "text-red-700",    label: "issues" },
    missing: { icon: "✗", dotCls: "text-red-400",    labelCls: "text-red-600",    label: "missing" },
  };

  const cfg = STATE_CONFIG[state];

  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className={`shrink-0 text-sm font-bold ${cfg.dotCls}`} aria-hidden>
        {cfg.icon}
      </span>
      <span className="flex-1 truncate font-mono text-xs text-neutral-800" title={variantKey}>
        {variantKey}
      </span>
      <span className={`shrink-0 text-xs font-medium ${cfg.labelCls}`}>
        {cfg.label}
      </span>
    </div>
  );
}

// ── Config section ─────────────────────────────────────────────────────────────

function ConfigSection({ tenant }: { tenant: TenantConfig }) {
  const pages    = tenant.pages;
  const blocks   = tenant.blocks;
  const features = tenant.features;
  const contact  = tenant.contact;

  return (
    <section aria-label="Tenant configuration">
      <SectionHeader
        title="Tenant Configuration"
        description="Enabled pages, blocks, and feature flags for this tenant."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Pages */}
        <ConfigCard title="Page Types">
          <ConfigRow label="Homepage" enabled={pages?.homepage ?? true} />
        </ConfigCard>

        {/* Blocks */}
        <ConfigCard title="Adaptive Blocks">
          <ConfigRow label="Hero block"  enabled={blocks?.hero  ?? true} />
          <ConfigRow label="Proof block" enabled={blocks?.proof ?? true} />
          <ConfigRow label="CTA block"   enabled={blocks?.cta   ?? true} />
        </ConfigCard>

        {/* Features */}
        <ConfigCard title="Features">
          <ConfigRow label="Diagnostics bar"    enabled={features.diagnosticsBar} />
          <ConfigRow label="Contact form"        enabled={features.contactForm ?? true} />
          <ConfigRow label="A/B testing"         enabled={features.abTesting ?? false} />
          <ConfigRow label="AI decisions"        enabled={features.aiDecisionProvider ?? false} />
        </ConfigCard>

        {/* Providers */}
        <ConfigCard title="Providers">
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-neutral-500">CMS</span>
            <span className="font-mono text-xs font-medium text-neutral-800">{tenant.cmsProvider}</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-neutral-500">Decision</span>
            <span className="font-mono text-xs font-medium text-neutral-800">{tenant.decisionProvider}</span>
          </div>
          {contact && (
            <div className="flex items-center justify-between py-1">
              <span className="text-xs text-neutral-500">Contact</span>
              <span className={`text-xs font-medium ${contact.enabled ? "text-green-700" : "text-neutral-400"}`}>
                {contact.enabled ? "enabled" : "disabled"}
              </span>
            </div>
          )}
        </ConfigCard>
      </div>
    </section>
  );
}

function ConfigCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</p>
      <div className="flex flex-col divide-y divide-neutral-50">{children}</div>
    </div>
  );
}

function ConfigRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-neutral-600">{label}</span>
      {enabled ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
          <span className="size-1.5 rounded-full bg-green-500" />
          on
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-neutral-400">
          <span className="size-1.5 rounded-full bg-neutral-300" />
          off
        </span>
      )}
    </div>
  );
}

// ── Readiness checks section ───────────────────────────────────────────────────

const CATEGORIES: { id: CheckCategory; label: string; description: string }[] = [
  { id: "coverage",     label: "Coverage",     description: "Are enough variant keys configured and populated?" },
  { id: "completeness", label: "Completeness",  description: "Does every configured key have real CMS content?" },
  { id: "quality",      label: "Quality",       description: "Are content fields well-formed and non-placeholder?" },
  { id: "metadata",     label: "Metadata",      description: "Are CMS IDs and structural metadata consistent?" },
  { id: "features",     label: "Features",      description: "Do enabled features have sufficient content support?" },
];

function ReadinessChecksSection({ report }: { report: ReadinessReport }) {
  const skipped = getSkippedChecks(report);

  return (
    <section aria-label="Readiness checks">
      <SectionHeader
        title="Readiness Checks"
        description={`${report.summary.total} checks evaluated across 5 categories · ${skipped.length} skipped (not applicable)`}
      />

      <div className="flex flex-col gap-5">
        {CATEGORIES.map(({ id, label, description }) => {
          const entries = getChecksByCategory(report, id);
          // Filter out skipped only if there are also non-skipped in this category
          const nonSkipped = entries.filter((e) => e.result.status !== "skipped");
          const skippedInCat = entries.filter((e) => e.result.status === "skipped");

          return (
            <CategoryGroup
              key={id}
              label={label}
              description={description}
              entries={nonSkipped}
              skippedCount={skippedInCat.length}
            />
          );
        })}
      </div>
    </section>
  );
}

function CategoryGroup({
  label,
  description,
  entries,
  skippedCount,
}: {
  label:        string;
  description:  string;
  entries:      CheckResultEntry[];
  skippedCount: number;
}) {
  if (entries.length === 0 && skippedCount === 0) return null;

  const passed   = countByStatus(entries, "pass");
  const failed   = countByStatus(entries, "fail");

  const headerCls =
    failed > 0
      ? "border-neutral-200"
      : "border-neutral-200";

  return (
    <div className={`overflow-hidden rounded-xl border bg-white shadow-sm ${headerCls}`}>
      {/* Category header */}
      <div className="flex items-center justify-between gap-3 border-b border-neutral-100 bg-neutral-50 px-4 py-3">
        <div>
          <span className="text-sm font-semibold text-neutral-800">{label}</span>
          <span className="ml-2 text-xs text-neutral-500">{description}</span>
        </div>
        <div className="flex items-center gap-2 text-xs shrink-0">
          {failed > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700">
              {failed} failed
            </span>
          )}
          <span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700">
            {passed} passed
          </span>
          {skippedCount > 0 && (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium text-neutral-500">
              {skippedCount} skipped
            </span>
          )}
        </div>
      </div>

      {/* Check rows */}
      <div className="divide-y divide-neutral-50">
        {entries.map((entry) => (
          <CheckRow key={entry.check.id} entry={entry} />
        ))}
        {entries.length === 0 && skippedCount > 0 && (
          <p className="px-4 py-3 text-sm text-neutral-400 italic">
            All {skippedCount} check{skippedCount === 1 ? "" : "s"} in this category skipped — not applicable for this tenant.
          </p>
        )}
      </div>
    </div>
  );
}

function CheckRow({ entry }: { entry: CheckResultEntry }) {
  const { check, result } = entry;
  const isFail = result.status === "fail";

  const SEV_CONFIG: Record<CheckSeverity, { badge: string; dot: string }> = {
    error:   { badge: "bg-red-100   text-red-700",   dot: "bg-red-500" },
    warning: { badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
    info:    { badge: "bg-sky-100   text-sky-700",   dot: "bg-sky-500" },
  };

  const STATUS_ICON: Record<CheckStatus, { icon: string; cls: string }> = {
    pass:    { icon: "✓", cls: "text-green-500 font-bold" },
    fail:    { icon: "✗", cls: "text-red-500 font-bold" },
    skipped: { icon: "—", cls: "text-neutral-300" },
  };

  const statusCfg = STATUS_ICON[result.status];
  const sevCfg    = SEV_CONFIG[check.severity];

  return (
    <div className={`px-4 py-3 ${isFail ? "bg-neutral-50/60" : ""}`}>
      <div className="flex items-start gap-3">
        {/* Status icon */}
        <span className={`mt-0.5 shrink-0 text-sm ${statusCfg.cls}`} aria-hidden>
          {statusCfg.icon}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-neutral-800">{check.label}</span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium ${sevCfg.badge}`}
              title={`${check.severity} severity`}
            >
              <span className={`size-1.5 rounded-full ${sevCfg.dot}`} />
              {check.severity}
            </span>
          </div>

          <p className="mt-0.5 text-xs text-neutral-500">{result.message}</p>

          {/* Affected keys */}
          {isFail && result.affectedKeys && result.affectedKeys.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {result.affectedKeys.map((k) => (
                <span
                  key={k}
                  className="rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 font-mono text-xs text-neutral-700"
                >
                  {k}
                </span>
              ))}
            </div>
          )}

          {/* Details */}
          {isFail && result.details && (
            <p className="mt-1.5 text-xs text-neutral-500 italic">{result.details}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Fetch errors section ───────────────────────────────────────────────────────

function FetchErrorsSection({
  errors,
}: {
  errors: ContentSnapshot["errors"];
}) {
  const notFound   = errors.filter((e) => e.errorType === "not-found");
  const fetchError = errors.filter((e) => e.errorType === "fetch-error");

  return (
    <section aria-label="CMS fetch errors">
      <SectionHeader
        title="CMS Fetch Errors"
        description="Errors encountered while fetching content from the CMS during this check run."
      />

      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        {fetchError.length > 0 && (
          <div className="border-b border-neutral-100 bg-red-50 px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-700">
              Network / Auth Errors ({fetchError.length})
            </p>
            <div className="flex flex-col gap-1">
              {fetchError.map((e) => (
                <div key={e.key} className="text-xs text-red-800">
                  <span className="font-mono font-medium">{e.key}</span>{" "}
                  <span className="text-neutral-500">({e.blockType})</span> — {e.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {notFound.length > 0 && (
          <div className="px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
              Not Found in CMS ({notFound.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {notFound.map((e) => (
                <span
                  key={e.key}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-mono text-xs text-amber-800"
                >
                  <span className="text-neutral-400 text-xs">{e.blockType}</span>
                  {e.key}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              These keys are configured in the tenant but have no matching CMS entry. Create the
              entries in{" "}
              <span className="font-mono text-neutral-700">
                {/* Provider shown inline */}
              </span>
              your CMS to resolve the completeness failures above.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Shared primitives ──────────────────────────────────────────────────────────

function SectionHeader({
  title,
  description,
}: {
  title:       string;
  description: string;
}) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold text-neutral-800">{title}</h2>
      <p className="text-xs text-neutral-500 mt-0.5">{description}</p>
    </div>
  );
}

// ── SVG icons ──────────────────────────────────────────────────────────────────

function RefreshIcon() {
  return (
    <svg
      className="size-3.5 text-neutral-500"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path
        d="M13.5 8a5.5 5.5 0 1 1-1.1-3.3"
        strokeLinecap="round"
      />
      <path d="M10.5 4.5 13.5 4.7 13.3 1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
