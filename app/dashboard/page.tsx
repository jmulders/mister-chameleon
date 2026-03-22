import { fetchDashboardMetrics } from "@/data/repositories/analytics-repository";
import type { RankedRow } from "@/data/repositories/analytics-repository";
import { getActiveTenantWithDevOverride } from "@/tenant/server";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Text } from "@/components/primitives/Text";

/**
 * Dashboard Overview — Analytics
 *
 * Server Component. Resolves the active tenant first (same resolution order as
 * the homepage), then fetches all metrics in a single parallel query batch.
 * Renders stat cards + ranked tables. Degrades gracefully when the database is
 * unavailable (partial data shown, error banner displayed).
 *
 * ─── Tenant resolution ───────────────────────────────────────────────────────
 *
 *   Uses getActiveTenantWithDevOverride() so the active tenant here always
 *   matches the tenant that the frontend site resolves. In development a
 *   ?tenant=<id> query param or mc_dev_tenant cookie overrides host resolution.
 *
 *   pageViews and ctaClicks are filtered to the active tenant via payload._tid.
 *   topSources, topHeroVariants, topCtaVariants remain cross-tenant until the
 *   served_variants / sessions tables gain a dedicated tenant_id column.
 */
export const metadata = { title: "Overview · Dashboard" };

// ── Page props ─────────────────────────────────────────────────────────────────

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardOverviewPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const { tenantConfig, devTenantOverride, devOverrideSource } =
    await getActiveTenantWithDevOverride(params, "dashboard");

  const result = await fetchDashboardMetrics(5, tenantConfig.tenantId);

  // Even on partial failure, fetchDashboardMetrics always returns ok: true with
  // zeroed-out values for the failing metrics. A hard DB misconfiguration would
  // throw before reaching here — show a clear error state in that case.
  if (!result.ok) {
    return (
      <div className="flex flex-col gap-6 px-8 py-8">
        <PageHeader tenantConfig={tenantConfig} devTenantOverride={devTenantOverride} />
        <Card padding="md" shadow="none" className="border-red-200 bg-red-50">
          <CardContent>
            <Text variant="body-sm" className="text-red-700">
              <strong>Database unavailable.</strong> Could not load metrics:{" "}
              {result.error}
            </Text>
          </CardContent>
        </Card>
      </div>
    );
  }

  const m = result.data;

  return (
    <div className="flex flex-col gap-8 px-8 py-8">
      <PageHeader tenantConfig={tenantConfig} devTenantOverride={devTenantOverride} />

      {devTenantOverride && (
        <DevOverrideBanner
          tenantId={devTenantOverride}
          source={devOverrideSource}
          page="overview"
        />
      )}

      {/* ── Stat cards ─────────────────────────────────────────────────── */}
      <section aria-label="Summary metrics">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Page Views"
            value={m.pageViews}
            description={`page_view events · ${tenantConfig.tenantId}`}
          />
          <StatCard
            label="CTA Clicks"
            value={m.ctaClicks}
            description={`cta_click events · ${tenantConfig.tenantId}`}
          />
          <StatCard
            label="Served Variants"
            value={m.servedVariantsTotal}
            description="Total variant sets resolved (all tenants)"
          />
        </div>
      </section>

      {/* ── Ranked tables ──────────────────────────────────────────────── */}
      <section aria-label="Ranked breakdowns">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <RankTable
            title="Top Traffic Sources"
            label="Source"
            rows={m.topSources}
            emptyNote="No sessions recorded yet."
            crossTenant
          />
          <RankTable
            title="Top Hero Variants"
            label="Hero key"
            rows={m.topHeroVariants}
            emptyNote="No variants served yet."
            crossTenant
          />
          <RankTable
            title="Top CTA Variants"
            label="CTA key"
            rows={m.topCtaVariants}
            emptyNote="No variants served yet."
            crossTenant
          />
        </div>
      </section>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface PageHeaderProps {
  tenantConfig: { tenantId: string; name: string };
  devTenantOverride: string | null;
}

function PageHeader({ tenantConfig, devTenantOverride }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <Text variant="h2" as="h1">
          Overview
        </Text>
        <Badge variant="warning" size="sm" dot>
          Internal
        </Badge>
      </div>
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
        <span className="text-neutral-300">·</span>
        <span className="text-xs text-neutral-400">
          Live metrics from Supabase — refreshes on each page load.
        </span>
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
      <strong>Dev override active.</strong> Showing data for tenant{" "}
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

// ── StatCard ──────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  description: string;
}

function StatCard({ label, value, description }: StatCardProps) {
  return (
    <Card padding="md" shadow="none">
      <CardContent className="flex flex-col gap-1">
        <Text variant="caption" color="muted" as="span">
          {label}
        </Text>
        <p className="text-3xl font-bold tracking-tight text-neutral-900">
          {value.toLocaleString()}
        </p>
        <Text variant="caption" color="subtle" as="span">
          {description}
        </Text>
      </CardContent>
    </Card>
  );
}

// ── RankTable ─────────────────────────────────────────────────────────────────

interface RankTableProps {
  title: string;
  /** Column header for the value column. */
  label: string;
  rows: RankedRow[];
  emptyNote: string;
  /** True when this table shows cross-tenant data (pending migration). */
  crossTenant?: boolean;
}

function RankTable({ title, label, rows, emptyNote, crossTenant }: RankTableProps) {
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <Card padding="none" shadow="none">
      <CardHeader className="border-b border-neutral-100 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between gap-2">
          <Text variant="label" as="h2">
            {title}
          </Text>
          {crossTenant && (
            <span className="text-xs text-neutral-400 italic">all tenants</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-0 py-0">
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-neutral-400">{emptyNote}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left">
                <th className="px-4 py-2 font-medium text-neutral-500 w-6">
                  #
                </th>
                <th className="px-4 py-2 font-medium text-neutral-500">
                  {label}
                </th>
                <th className="px-4 py-2 font-medium text-neutral-500 text-right">
                  Count
                </th>
                <th className="px-4 py-2 font-medium text-neutral-500 text-right">
                  Share
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const pct =
                  total > 0 ? Math.round((row.count / total) * 100) : 0;
                return (
                  <tr
                    key={row.value}
                    className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50 transition-colors"
                  >
                    <td className="px-4 py-2.5 text-neutral-400 tabular-nums">
                      {i + 1}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-neutral-800 max-w-[180px]">
                      <span
                        className="block truncate"
                        title={row.value}
                      >
                        {row.value}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-neutral-900">
                      {row.count.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-neutral-400">
                      {pct}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
