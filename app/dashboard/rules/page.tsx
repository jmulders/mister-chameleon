/**
 * Dashboard — Homepage Rules Page
 *
 * Server component wrapper that loads the initial rules configuration
 * and passes it to the RulesEditor client component.
 *
 * If the rules file doesn't exist yet the server action returns the
 * SEED_RULES_CONFIG so the editor always has data to display.
 *
 * ─── Tenant resolution ───────────────────────────────────────────────────────
 *
 *   Resolves the active tenant using the same order as the frontend site so the
 *   displayed tenant always matches what's live. Rules data itself is not yet
 *   tenant-scoped (stored as a single config file), but the resolved tenant ID
 *   is shown in the page header for context and a dev override banner is
 *   rendered when a ?tenant= or mc_dev_tenant cookie override is active.
 */

import { getActiveTenantWithDevOverride } from "@/tenant/server";
import { getRulesAction }                  from "./actions";
import { RulesEditor }                     from "./_components/RulesEditor";
import { Text }                            from "@/components/primitives/Text";
import { fetchVariantCatalogue }           from "@/decision/rules/fetch-variant-catalogue";

export const metadata = { title: "Rules Editor · Dashboard" };

// ── Page props ─────────────────────────────────────────────────────────────────

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function RulesPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const { tenantConfig, devTenantOverride, devOverrideSource } =
    await getActiveTenantWithDevOverride(params, "dashboard/rules");

  // Fetch rules config and variant catalogue in parallel.
  const activeTenantId = devTenantOverride ?? tenantConfig.tenantId;
  const [result, variantCatalogue] = await Promise.all([
    getRulesAction(),
    fetchVariantCatalogue(activeTenantId),
  ]);

  if (!result.ok) {
    return (
      <div className="flex flex-col gap-6 px-8 py-8">
        <PageHeader tenantConfig={tenantConfig} devTenantOverride={devTenantOverride} />
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Error loading rules:</strong> {result.error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-8 py-8">
      <PageHeader tenantConfig={tenantConfig} devTenantOverride={devTenantOverride} />
      {devTenantOverride && (
        <DevOverrideBanner
          tenantId={devTenantOverride}
          source={devOverrideSource}
          page="rules"
        />
      )}
      <RulesEditor
        initialConfig={result.config}
        variantCatalogue={variantCatalogue}
      />
    </div>
  );
}

// ── Page header ────────────────────────────────────────────────────────────────

function PageHeader({
  tenantConfig,
  devTenantOverride,
}: {
  tenantConfig:      { tenantId: string; name: string };
  devTenantOverride: string | null;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Text variant="h2" as="h1">Decision Rules</Text>
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <span>
          Tenant:{" "}
          <span className="font-medium text-neutral-700">{tenantConfig.name}</span>
        </span>
        <span className="text-neutral-300">·</span>
        <span className="font-mono text-xs">{tenantConfig.tenantId}</span>
        {devTenantOverride && (
          <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 font-mono text-xs text-amber-700">
            dev override
          </span>
        )}
      </div>
    </div>
  );
}

// ── DevOverrideBanner ─────────────────────────────────────────────────────────

function DevOverrideBanner({
  tenantId,
  source,
  page,
}: {
  tenantId: string;
  source:   "query-param" | "cookie" | null;
  page:     string;
}) {
  const sourceLabel =
    source === "query-param"
      ? <><code className="font-mono">?tenant=</code> query param</>
      : source === "cookie"
        ? <><code className="font-mono">mc_dev_tenant</code> cookie</>
        : "dev override";

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <strong>Dev override active.</strong> Active tenant is{" "}
      <code className="font-mono font-semibold">{tenantId}</code> via{" "}
      {sourceLabel}.{" "}
      This override is ignored in production.{" "}
      <span className="text-amber-600">
        Bookmark:{" "}
        <code className="font-mono text-xs">
          /dashboard/{page}?tenant={tenantId}
        </code>
      </span>
    </div>
  );
}
