/**
 * Admin — Tenant Rules Editor
 *
 * Mounts the shared RulesEditor client component scoped to a specific tenant.
 * Rules are stored in the `rules_config` table under the key
 * "homepage_<tenantId>" — isolated from the global "homepage" key used by
 * the legacy /dashboard/rules page.
 *
 * ─── Data flow ─────────────────────────────────────────────────────────────────
 *
 *   1. Server loads initial config via getTenantRulesAction(tenantId).
 *   2. RulesEditor receives:
 *        - initialConfig — the loaded (or seed-fallback) StoredRulesConfig
 *        - saveAction    — saveTenantRulesAction.bind(null, tenantId)
 *        - resetAction   — resetTenantRulesAction.bind(null, tenantId)
 *      Both bound actions are server actions that scope their writes to this
 *      tenant's row.  The RulesEditor never sees nor passes tenantId itself.
 *
 * ─── No duplication ────────────────────────────────────────────────────────────
 *
 *   The RulesEditor component is re-used as-is from its original location at
 *   app/dashboard/rules/_components/RulesEditor.tsx.  No code is copied.
 */

import { notFound }      from "next/navigation";
import { getTenantById } from "@/tenant/server";
import { normalizeTenant } from "@/tenant/normalize";
import { getTenantRulesAction, saveTenantRulesAction, resetTenantRulesAction, setTenantRulesEnabledAction, seedPresetRulesAction, exportTenantDataAction } from "./actions";
import { RulesEditor }         from "@/app/dashboard/rules/_components/RulesEditor";
import { GlobalRulesToggle }   from "./_components/GlobalRulesToggle";
import { ExportTenantDataButton } from "./_components/ExportTenantDataButton";
import { VariantUsagePanel }   from "./_components/VariantUsagePanel";
import { SeedPresetRulesButton } from "./_components/SeedPresetRulesButton";
import { RulesMatrix }         from "./_components/RulesMatrix";
import { Text }                from "@/components/primitives/Text";
import { fetchVariantCatalogue }      from "@/decision/rules/fetch-variant-catalogue";
import { computeVariantUsage, resolveContentBudget } from "@/decision/rules/variant-usage";
import { getPlatformContentBudgetSettings }          from "@/platform/platform-store";

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TenantRulesPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  // Verify the tenant exists before rendering anything.
  const rawTenant = await getTenantById(tenantId);
  if (!rawTenant) notFound();

  const tenant = normalizeTenant(rawTenant);

  // Load this tenant's rules, variant catalogue, and content budget in parallel.
  const [result, variantCatalogue, budgetResult] = await Promise.all([
    getTenantRulesAction(tenantId),
    fetchVariantCatalogue(tenantId),
    getPlatformContentBudgetSettings(),
  ]);

  // Bind the tenant-scoped server actions so RulesEditor can call them without
  // knowing the tenantId.  The bound values are serialised into the client
  // bundle as opaque server-action references — tenantId is never exposed to
  // the client as a prop.
  const boundSave           = saveTenantRulesAction.bind(null, tenantId);
  const boundReset          = resetTenantRulesAction.bind(null, tenantId);
  const boundSetEnabled     = setTenantRulesEnabledAction.bind(null, tenantId);
  const boundSeedPresets    = seedPresetRulesAction.bind(null, tenantId);
  const boundExport         = exportTenantDataAction.bind(null, tenantId);

  if (!result.ok) {
    return (
      <div className="p-8">
        <PageHeader tenant={tenant} />
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Error loading rules:</strong> {result.error}
        </div>
      </div>
    );
  }

  // rulesEnabled defaults to true when absent (backward compatible).
  const rulesEnabled = result.config.rulesEnabled !== false;

  // Compute variant usage stats from the loaded config + catalogue.
  const usage  = computeVariantUsage(result.config, variantCatalogue);
  const budget = resolveContentBudget(
    budgetResult.ok ? (budgetResult.data ?? {}) : {},
  );

  return (
    <div className="p-8">
      {/* ── Toolbar — global toggle + preset seed ────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <GlobalRulesToggle
          initialEnabled={rulesEnabled}
          setEnabledAction={boundSetEnabled}
        />
        <div className="flex items-center gap-3">
          <ExportTenantDataButton exportAction={boundExport} />
          <SeedPresetRulesButton seedAction={boundSeedPresets} />
        </div>
      </div>

      <RulesEditor
        initialConfig={result.config}
        variantCatalogue={variantCatalogue}
        saveAction={boundSave}
        resetAction={boundReset}
      />

      {/* ── Variant usage panel — shown below the editor ──────────────────── */}
      <div className="mt-8">
        <VariantUsagePanel usage={usage} budget={budget} />
      </div>

      {/* ── Slot assignment matrix ────────────────────────────────────────── */}
      <div className="mt-8">
        <RulesMatrix config={result.config} />
      </div>
    </div>
  );
}

// ── Page header ────────────────────────────────────────────────────────────────

function PageHeader({
  tenant,
}: {
  tenant: { tenantId: string; name?: string };
}) {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <h1 className="text-xl font-semibold text-neutral-900">Decision Rules</h1>
      <p className="text-sm text-neutral-500">
        Rules that map visitor signals to content variants, adaptive slots, and
        theme overrides for{" "}
        <span className="font-medium text-neutral-700">
          {tenant.name ?? tenant.tenantId}
        </span>
        .{" "}
        Rules fire across all page templates, not just the homepage, and are
        evaluated in priority order; first match wins.
      </p>
    </div>
  );
}
