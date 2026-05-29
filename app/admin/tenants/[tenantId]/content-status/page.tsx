/**
 * Tenant Workspace — Content Status
 *
 * At-a-glance view of the content health for a single tenant:
 *
 *   • Page inventory — total pages, template breakdown, most recently updated
 *   • CMS connection — configured provider and provisioning state
 *   • Block summary   — most-used content block types across all pages
 *
 * Read-only server component — no interactivity needed.
 * For full page editing go to the Pages tab.
 * For CMS provisioning go to the Overview tab.
 */

import Link        from "next/link";
import { notFound } from "next/navigation";
import { getTenantById }   from "@/tenant/server";
import { normalizeTenant } from "@/tenant/normalize";
import { getPagesByTenant } from "@/page-store";
import { Badge }   from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Text }    from "@/components/primitives/Text";
import type { EditablePage } from "@/page-store";

// ── Template display helpers ──────────────────────────────────────────────────

type BadgeVariant = "default" | "primary" | "success" | "warning" | "error" | "outline";

const TEMPLATE_VARIANT: Record<string, BadgeVariant> = {
  "marketing-page": "primary",
  "landing-page":   "success",
  "article-page":   "default",
  "listing-page":   "warning",
  "detail-page":    "outline",
};

const TEMPLATE_LABEL: Record<string, string> = {
  "marketing-page": "Marketing",
  "landing-page":   "Landing",
  "article-page":   "Article",
  "listing-page":   "Listing",
  "detail-page":    "Detail",
};

function templateLabel(key: string): string {
  return TEMPLATE_LABEL[key] ?? key;
}
function templateVariant(key: string): BadgeVariant {
  return TEMPLATE_VARIANT[key] ?? "default";
}

// ── Date formatter ────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function relativeAge(iso: string): string {
  const diffMs  = Date.now() - new Date(iso).getTime();
  const diffDay = Math.floor(diffMs / 86_400_000);
  if (diffDay < 1)  return "today";
  if (diffDay === 1) return "yesterday";
  if (diffDay < 30)  return `${diffDay}d ago`;
  const diffWk = Math.floor(diffDay / 7);
  if (diffWk < 8)    return `${diffWk}w ago`;
  const diffMo = Math.floor(diffDay / 30);
  return `${diffMo}mo ago`;
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent>
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{label}</p>
        <p className="mt-1 text-2xl font-bold text-neutral-900">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-neutral-400">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TenantContentStatusPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  const [rawTenant, pages] = await Promise.all([
    getTenantById(tenantId),
    getPagesByTenant(tenantId),
  ]);

  if (!rawTenant) notFound();

  const tenant = normalizeTenant(rawTenant);

  // ── Derived stats ─────────────────────────────────────────────────────────

  const totalPages = pages.length;

  // Template distribution
  const byTemplate = pages.reduce<Record<string, number>>((acc, p) => {
    acc[p.templateKey] = (acc[p.templateKey] ?? 0) + 1;
    return acc;
  }, {});

  // Block type distribution
  const blockCounts = pages.reduce<Record<string, number>>((acc, p) => {
    for (const block of p.contentBlocks) {
      const type = (block as { type?: string }).type ?? "unknown";
      acc[type] = (acc[type] ?? 0) + 1;
    }
    return acc;
  }, {});
  const topBlocks = Object.entries(blockCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // Recently updated pages (top 5)
  const recentPages = [...pages]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  // Total blocks
  const totalBlocks = pages.reduce((sum, p) => sum + p.contentBlocks.length, 0);

  // CMS state
  const cmsProvider     = tenant.cms?.provider ?? "mock";
  const cmsProvisioned  = tenant.cmsProvisionedAt
    ? formatDate(tenant.cmsProvisionedAt)
    : null;

  return (
    <div className="p-8">
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Content Status</h1>
          <Text variant="body-sm" color="muted" className="mt-1">
            Page inventory and content health for{" "}
            <code className="font-mono text-xs">{tenantId}</code>
          </Text>
        </div>
        <Link
          href={`/admin/tenants/${tenantId}/pages`}
          className="inline-flex h-8 items-center rounded-md bg-brand-500 px-3 text-xs font-medium text-white hover:bg-brand-600 transition-colors"
        >
          Manage pages →
        </Link>
      </div>

      {/* Summary stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total pages" value={totalPages} />
        <StatCard label="Total blocks" value={totalBlocks} sub={`avg ${totalPages ? (totalBlocks / totalPages).toFixed(1) : "—"} per page`} />
        <StatCard label="Templates" value={Object.keys(byTemplate).length} sub="distinct templates used" />
        <StatCard
          label="CMS"
          value={cmsProvider}
          sub={cmsProvisioned ? `provisioned ${cmsProvisioned}` : "not provisioned"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">

        {/* Template breakdown */}
        <Card>
          <CardContent>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Template breakdown
            </p>
            {Object.keys(byTemplate).length === 0 ? (
              <p className="py-4 text-center text-sm text-neutral-400">No pages yet.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(byTemplate)
                  .sort((a, b) => b[1] - a[1])
                  .map(([key, count]) => (
                    <div key={key} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={templateVariant(key)} size="sm">
                          {templateLabel(key)}
                        </Badge>
                        <span className="text-xs text-neutral-400 font-mono">{key}</span>
                      </div>
                      <span className="text-sm font-semibold text-neutral-700">
                        {count} page{count !== 1 ? "s" : ""}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top block types */}
        <Card>
          <CardContent>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Block types used
            </p>
            {topBlocks.length === 0 ? (
              <p className="py-4 text-center text-sm text-neutral-400">No blocks yet.</p>
            ) : (
              <div className="space-y-2">
                {topBlocks.map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between gap-2">
                    <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-mono text-neutral-700">
                      {type}
                    </code>
                    <div className="flex flex-1 items-center gap-2">
                      <div
                        className="h-1.5 rounded-full bg-brand-300"
                        style={{
                          width: `${Math.max(8, (count / (topBlocks[0]?.[1] ?? 1)) * 100)}%`,
                          maxWidth: "100%",
                        }}
                      />
                      <span className="text-xs text-neutral-500 tabular-nums w-8 text-right">
                        {count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recently updated pages */}
        <Card className="lg:col-span-2">
          <CardContent>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Recently updated pages
            </p>
            {recentPages.length === 0 ? (
              <p className="py-4 text-center text-sm text-neutral-400">
                No pages found for this tenant.{" "}
                <Link
                  href={`/admin/tenants/${tenantId}/pages/new`}
                  className="text-brand-600 hover:underline"
                >
                  Create the first page →
                </Link>
              </p>
            ) : (
              <div className="overflow-hidden rounded border border-neutral-200">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-neutral-200 bg-neutral-50">
                    <tr>
                      <th className="px-3 py-2 text-xs font-semibold text-neutral-500">Title</th>
                      <th className="px-3 py-2 text-xs font-semibold text-neutral-500">Slug</th>
                      <th className="px-3 py-2 text-xs font-semibold text-neutral-500">Template</th>
                      <th className="px-3 py-2 text-xs font-semibold text-neutral-500">Blocks</th>
                      <th className="px-3 py-2 text-xs font-semibold text-neutral-500">Updated</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {recentPages.map((page) => (
                      <tr
                        key={page.id}
                        className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors"
                      >
                        <td className="px-3 py-2 font-medium text-neutral-900">
                          {page.title}
                        </td>
                        <td className="px-3 py-2">
                          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs font-mono text-neutral-600">
                            /{page.slug || ""}
                          </code>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={templateVariant(page.templateKey)} size="sm">
                            {templateLabel(page.templateKey)}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-neutral-500">
                          {page.contentBlocks.length}
                        </td>
                        <td className="px-3 py-2 text-neutral-400" title={formatDate(page.updatedAt)}>
                          {relativeAge(page.updatedAt)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Link
                            href={`/admin/tenants/${tenantId}/pages/${page.id}`}
                            className="text-xs text-neutral-400 hover:text-brand-700 transition-colors"
                          >
                            Edit →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {pages.length > 5 && (
              <div className="mt-3 text-right">
                <Link
                  href={`/admin/tenants/${tenantId}/pages`}
                  className="text-xs text-brand-600 hover:underline"
                >
                  View all {pages.length} pages →
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
