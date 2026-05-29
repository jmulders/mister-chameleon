/**
 * Admin — Tenant pages list
 *
 * Lists all editable pages that belong to the specified tenant.
 * Mirrors the old /admin/pages UI but scoped to a single tenant.
 *
 * Server component — no client JS needed for a read-only list.
 */

import Link          from "next/link";
import { notFound }  from "next/navigation";
import { getPagesByTenant } from "@/page-store";
import type { EditablePage } from "@/page-store";
import { Badge }      from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Text }       from "@/components/primitives/Text";

// ── Template badge ──────────────────────────────────────────────────────────────

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

function templateVariant(key: string): BadgeVariant {
  return TEMPLATE_VARIANT[key] ?? "default";
}

function templateLabel(key: string): string {
  return TEMPLATE_LABEL[key] ?? key;
}

// ── Date formatter ──────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day:   "2-digit",
      month: "short",
      year:  "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ── Row component ───────────────────────────────────────────────────────────────

function PageRow({
  page,
  tenantId,
}: {
  page:     EditablePage;
  tenantId: string;
}) {
  const displaySlug = page.slug ? `/${page.slug}` : "/";

  return (
    <tr className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors">
      {/* Title */}
      <td className="px-4 py-3">
        <span className="text-sm font-medium text-neutral-900">{page.title}</span>
      </td>

      {/* Slug */}
      <td className="px-4 py-3">
        <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600 font-mono">
          {displaySlug}
        </code>
      </td>

      {/* Template */}
      <td className="px-4 py-3">
        <Badge variant={templateVariant(page.templateKey)} size="sm">
          {templateLabel(page.templateKey)}
        </Badge>
      </td>

      {/* Blocks */}
      <td className="px-4 py-3">
        <span className="text-sm text-neutral-500">
          {page.contentBlocks.length} block{page.contentBlocks.length !== 1 ? "s" : ""}
        </span>
      </td>

      {/* Updated */}
      <td className="px-4 py-3">
        <span className="text-sm text-neutral-400">{formatDate(page.updatedAt)}</span>
      </td>

      {/* Edit action */}
      <td className="px-4 py-3 text-right">
        <Link
          href={`/admin/tenants/${tenantId}/pages/${page.id}`}
          className="text-xs text-neutral-400 hover:text-brand-700 transition-colors"
          aria-label={`Edit ${page.title}`}
        >
          Edit →
        </Link>
      </td>
    </tr>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default async function TenantPagesPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const pages = await getPagesByTenant(tenantId);

  // If no pages found and tenantId looks invalid, surface a 404.
  // (An existing but empty tenant is fine — we show the empty state.)
  if (pages.length === 0) {
    // Allow empty tenants — only hard-404 if the tenantId is obviously wrong
    // format (contains characters not valid in a slug).  Real validation is left
    // to the tenant resolver; here we just avoid showing a confusing blank state
    // for typos in the URL.
    const validSlug = /^[a-z0-9-]+$/.test(tenantId);
    if (!validSlug) notFound();
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-4">
        <Link
          href={`/admin/tenants/${tenantId}`}
          className="text-xs text-neutral-400 transition-colors hover:text-brand-700"
        >
          ← Back to tenant
        </Link>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Pages</h1>
          <Text variant="body-sm" color="muted" className="mt-1">
            {pages.length} page{pages.length !== 1 ? "s" : ""} for{" "}
            <code className="font-mono text-xs">{tenantId}</code>
          </Text>
        </div>
      </div>

      {/* Table */}
      {pages.length === 0 ? (
        <Card>
          <CardContent>
            <p className="py-8 text-center text-sm text-neutral-400">
              No pages found for this tenant. The store may be empty or not yet seeded.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Title
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Slug
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Template
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Blocks
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Updated
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {pages.map((page) => (
                  <PageRow key={page.id} page={page} tenantId={tenantId} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
