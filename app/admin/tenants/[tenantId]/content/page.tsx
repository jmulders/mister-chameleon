/**
 * Admin — Tenant Workspace › Content
 *
 * CMS-first view of this tenant's content. Replaces the platform-first Pages
 * CRUD interface as the primary content tab in the tenant workspace.
 *
 * ─── What this page shows ─────────────────────────────────────────────────────
 *
 *   • CMS provider name and live connection status (testConnection())
 *   • "Open in CMS" deep-link into the connected CMS admin
 *   • Page inventory — title, slug, template, provisioning date (read-only)
 *   • Missing required pages warning (homepage, about, contact not yet provisioned)
 *   • Link to Content Status for full inventory stats
 *   • "Sync CMS" panel — recreates missing CMS docs without touching tenant settings
 *
 * ─── What this page does NOT do ───────────────────────────────────────────────
 *
 *   • No create / edit / delete page buttons — those belong in the CMS
 *   • No internal page-structure editing — use /pages/[id] for legacy edits
 *
 * Server component — all data fetched server-side; testConnection() is I/O but
 * safe to run here because this page is only visited by admin operators.
 */

import Link        from "next/link";
import { notFound } from "next/navigation";
import { getTenantById }   from "@/tenant/server";
import { normalizeTenant } from "@/tenant/normalize";
import { getPagesByTenant } from "@/page-store";
import { createCMSProvider } from "@/cms/providers/create-cms-provider";
import { CmsCredentialsPanel }  from "@/components/admin/CmsCredentialsPanel";
import { CmsProvisioningPanel } from "@/components/admin/CmsProvisioningPanel";
import { TenantCmsSeedPanel }      from "./_components/TenantCmsSeedPanel";
import { PlatformVariantsClient }   from "./_components/PlatformVariantsClient";
import { AdaptiveBlocksPanel }      from "./_components/AdaptiveBlocksPanel";
import { listPlatformVariantsAction } from "./actions";
import { listAdaptiveBlocksAction } from "@/lib/adaptive-blocks/adaptive-blocks-actions";
import { getPlatformStoryblokSettings, storyblokFlags } from "@/platform/platform-store";
import type { TestConnectionResult } from "@/cms/providers/cms-provider";
import type { CMSProviderName, TenantSettings } from "@/tenant/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  if (diffDay < 1)   return "today";
  if (diffDay === 1) return "yesterday";
  if (diffDay < 30)  return `${diffDay}d ago`;
  const diffWk = Math.floor(diffDay / 7);
  if (diffWk < 8)    return `${diffWk}w ago`;
  const diffMo = Math.floor(diffDay / 30);
  return `${diffMo}mo ago`;
}

// ── "Open CMS" link ───────────────────────────────────────────────────────────
//
// Returns a generic "Open CMS" action link for the connected provider.
// Label is always "Open CMS" to keep the UI consistent regardless of which
// CMS is configured — the provider badge on the card provides context.

interface CmsLink {
  label: string;
  href:  string;
}

function getCmsAdminLink(
  provider: CMSProviderName,
  projectId?: string,
): CmsLink | null {
  switch (provider) {
    case "sanity":
      return {
        label: "Open CMS",
        href:  projectId
          ? `https://sanity.io/manage/personal/project/${projectId}`
          : "https://sanity.io/manage",
      };
    case "storyblok":
      return { label: "Open CMS", href: "https://app.storyblok.com/" };
    case "statamic":
      // Statamic is self-hosted; we can't construct a generic URL.
      // The platform store may have the base URL, but fetching that here would
      // add latency. The Overview page has provisioning controls instead.
      return null;
    case "platform":
      // Platform CMS is edited directly on this page — no external link.
      return null;
    case "mock":
      return null;
    default:
      return null;
  }
}

// ── Provider label & badge ─────────────────────────────────────────────────────

const PROVIDER_LABEL: Record<CMSProviderName, string> = {
  platform:  "Platform (built-in)",
  sanity:    "Sanity",
  storyblok: "Storyblok",
  statamic:  "Statamic",
  mock:      "Mock (development)",
};

const PROVIDER_BADGE: Record<CMSProviderName, string> = {
  platform:  "bg-brand-50 text-brand-700 ring-brand-200",
  sanity:    "bg-blue-50 text-blue-700 ring-blue-200",
  storyblok: "bg-teal-50 text-teal-700 ring-teal-200",
  statamic:  "bg-amber-50 text-amber-700 ring-amber-200",
  mock:      "bg-neutral-100 text-neutral-600 ring-neutral-200",
};

// ── Required pages ─────────────────────────────────────────────────────────────

/** Slugs that every tenant site should have provisioned. */
const REQUIRED_SLUGS = ["", "about", "contact"] as const;

// ── Template labels ────────────────────────────────────────────────────────────

const TEMPLATE_LABEL: Record<string, string> = {
  "marketing-page": "Marketing",
  "landing-page":   "Landing",
  "article-page":   "Article",
  "listing-page":   "Listing",
  "detail-page":    "Detail",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TenantContentPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  const [rawTenant, pages, storyblokPlatform] = await Promise.all([
    getTenantById(tenantId),
    getPagesByTenant(tenantId),
    getPlatformStoryblokSettings().catch(() => null),
  ]);

  if (!rawTenant) notFound();

  const tenant      = normalizeTenant(rawTenant);
  const isPlatformCms = (tenant.cms?.provider ?? "mock") === "platform";
  // Adaptive blocks are always shown — platform-managed Supabase table is
  // used by all providers. Sanity tenants can use it as a supplement/override.
  const showAdaptivePanel = true;

  // Fetch platform variants only when the Platform CMS is active.
  const platformVariantsResult = isPlatformCms
    ? await listPlatformVariantsAction(tenantId)
    : null;

  // Fetch adaptive blocks for non-Sanity providers (platform-managed via Supabase).
  // includePlatform=true so platform-wide blocks (tenant_id IS NULL) are also shown.
  const adaptiveBlocksResult = showAdaptivePanel
    ? await listAdaptiveBlocksAction(tenantId, true)
    : null;

  // Capture write token presence BEFORE stripping secrets.
  const hasCmsWriteToken = Boolean(rawTenant.cms?.writeToken);

  // Storyblok platform credentials (used for the tenant-level seed panel).
  const sbFlags             = storyblokPlatform?.ok ? storyblokFlags(storyblokPlatform.data) : null;
  const hasManagementToken  = sbFlags?.hasManagementToken ?? false;
  const hasSpaceId          = !!(storyblokPlatform?.ok && storyblokPlatform.data.spaceId?.trim());

  // Strip secrets before passing to client components.
  const safeTenant: TenantSettings = {
    ...tenant,
    cms: { ...(tenant.cms ?? { provider: "mock" }), writeToken: undefined },
  };

  // ── CMS connection test ──────────────────────────────────────────────────────
  let connectionResult: TestConnectionResult | null = null;
  try {
    const provider = createCMSProvider(tenant.cms, tenantId);
    connectionResult = await provider.testConnection();
  } catch (err) {
    connectionResult = {
      ok:       false,
      provider: tenant.cms?.provider ?? "mock",
      error:    err instanceof Error ? err.message : "Unknown error",
    };
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const cmsProvider  = tenant.cms?.provider ?? "mock";
  const cmsLink      = getCmsAdminLink(cmsProvider, tenant.cms?.projectId);
  const provisionedAt = tenant.cmsProvisionedAt
    ? formatDate(tenant.cmsProvisionedAt)
    : null;

  // Normalise "home" → "" so that a page stored as "home" (the DB convention
  // for the root URL, enforced by migration 20240101000023) satisfies the
  // REQUIRED_SLUGS check for "" which represents "/".
  console.log("[content/page] pages for", tenantId, "→", pages.map((p) => ({ id: p.id, slug: p.slug })));
  const existingSlugs = new Set(
    pages.map((p) => (p.slug === "home" ? "" : (p.slug ?? ""))),
  );
  const missingRequired = REQUIRED_SLUGS.filter((s) => !existingSlugs.has(s));

  const base = `/admin/tenants/${tenantId}`;

  return (
    <div className="p-8 space-y-6">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Content</h1>
          <p className="mt-1 text-sm text-neutral-500">
            CMS connection status and page inventory for{" "}
            <code className="font-mono text-xs">{tenantId}</code>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {cmsLink && (
            <a
              href={cmsLink.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700 transition-colors"
            >
              {cmsLink.label}
              <span aria-hidden="true">↗</span>
            </a>
          )}
          <a
            href="#cms-sync"
            className="inline-flex h-8 items-center rounded-md border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            Sync CMS ↓
          </a>
        </div>
      </div>

      {/* Role-separation callout ─────────────────────────────────────────────
          Reminds operators of the two-environment model:
            Platform = site configuration, design, and behaviour rules
            CMS      = all content editing (copy, images, pages, articles)
          This box is shown whenever a real CMS is connected. */}
      {cmsLink && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-blue-800">
                Your content editing environment
              </p>
              <p className="mt-0.5 text-xs text-blue-700">
                Write copy, manage pages, and publish updates in{" "}
                <span className="font-medium">{PROVIDER_LABEL[cmsProvider]}</span>.
                Return here to adjust design, behaviour rules, or integrations.
              </p>
            </div>
            <a
              href={cmsLink.href}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Open CMS <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      )}

      {/* CMS connection card */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-neutral-900">CMS Provider</p>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${PROVIDER_BADGE[cmsProvider]}`}
              >
                {PROVIDER_LABEL[cmsProvider]}
              </span>
            </div>
            {provisionedAt && (
              <p className="text-xs text-neutral-400">
                Last provisioned: {provisionedAt}
              </p>
            )}
            {!provisionedAt && (
              <p className="text-xs text-neutral-400">
                Not yet provisioned —{" "}
                <a href="#cms-sync" className="text-brand-600 hover:underline">
                  sync below
                </a>
                .
              </p>
            )}
          </div>

          {/* Connection status */}
          <div className="flex items-center gap-1.5">
            {connectionResult === null ? (
              <span className="text-xs text-neutral-400">Checking…</span>
            ) : connectionResult.ok ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-green-700">
                <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                Connected
                {connectionResult.readAccess && (
                  <span className="text-neutral-400 font-normal">· read access confirmed</span>
                )}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-medium text-red-700">
                <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                Connection failed
                <span className="text-red-500 font-normal truncate max-w-xs" title={connectionResult.error}>
                  · {connectionResult.error}
                </span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Missing required pages */}
      {missingRequired.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-semibold text-amber-800">
            Missing required pages ({missingRequired.length})
          </p>
          <p className="mt-0.5 text-xs text-amber-700">
            The following pages have not been provisioned:{" "}
            {missingRequired.map((s) => (
              <code key={s} className="mx-0.5 rounded bg-amber-100 px-1 font-mono text-[11px]">
                /{s}
              </code>
            ))}
            . Use{" "}
            <a href="#cms-sync" className="font-medium underline hover:text-amber-900">
              Sync CMS
            </a>{" "}
            below to recreate missing documents, or{" "}
            <a href="../" className="font-medium underline hover:text-amber-900">
              Initialize site
            </a>{" "}
            on the Overview tab for first-time setup.
          </p>
        </div>
      )}

      {/* Page inventory */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Page Inventory
            <span className="ml-2 font-normal normal-case text-neutral-400">
              {pages.length} page{pages.length !== 1 ? "s" : ""} in internal DB
            </span>
          </p>
          <Link
            href={`${base}/content-status`}
            className="text-[11px] text-brand-600 hover:underline"
          >
            Full content stats →
          </Link>
        </div>

        {pages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 py-10 text-center">
            <p className="text-sm font-medium text-neutral-500">No pages provisioned yet</p>
            <p className="mt-1 text-xs text-neutral-400">
              Use{" "}
              <a href="#cms-sync" className="text-brand-600 hover:underline">
                Sync CMS
              </a>{" "}
              below to provision starter pages, or{" "}
              <a href="../" className="text-brand-600 hover:underline">
                Initialize site
              </a>{" "}
              on the Overview tab for first-time setup.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50">
                <tr>
                  <th className="px-4 py-2.5 text-xs font-semibold text-neutral-500">Title</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-neutral-500">Slug</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-neutral-500">Template</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-neutral-500">Blocks</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-neutral-500">Updated</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((page) => (
                  <tr
                    key={page.id}
                    className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors"
                  >
                    <td className="px-4 py-2.5 font-medium text-neutral-900">
                      {page.title}
                    </td>
                    <td className="px-4 py-2.5">
                      <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-mono text-neutral-600">
                        /{page.slug ?? ""}
                      </code>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-neutral-500">
                        {TEMPLATE_LABEL[page.templateKey] ?? page.templateKey}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-neutral-500 tabular-nums">
                      {page.contentBlocks.length}
                    </td>
                    <td
                      className="px-4 py-2.5 text-xs text-neutral-400"
                      title={formatDate(page.updatedAt)}
                    >
                      {relativeAge(page.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Platform CMS variant editor ─────────────────────────────────── */}
      {isPlatformCms && (
        <div className="rounded-lg border border-neutral-200 bg-white p-5">
          <PlatformVariantsClient
            tenantId={tenantId}
            initialVariants={
              platformVariantsResult?.ok ? platformVariantsResult.variants : []
            }
          />
          {platformVariantsResult && !platformVariantsResult.ok && (
            <p className="mt-3 text-xs text-red-600">
              ⚠ Could not load variants: {platformVariantsResult.error}
            </p>
          )}
        </div>
      )}

      {/* ── Adaptive Blocks (Content Matrix) ─────────────────────────────── */}
      {/* Shown for all providers — the platform-managed Supabase table is the
          source of truth for adaptive blocks regardless of which CMS is active. */}
      {showAdaptivePanel && (
        <div className="rounded-lg border border-neutral-200 bg-white p-5">
          <AdaptiveBlocksPanel
            tenantId={tenantId}
            initialBlocks={adaptiveBlocksResult?.ok ? adaptiveBlocksResult.blocks : []}
          />
          {adaptiveBlocksResult && !adaptiveBlocksResult.ok && (
            <p className="mt-3 text-xs text-red-600">
              ⚠ Could not load adaptive blocks: {adaptiveBlocksResult.error}
            </p>
          )}
        </div>
      )}

      {/* ── CMS Sync ──────────────────────────────────────────────────────── */}
      {/* Credentials panel (write token) + sync panel live here so operators
          can manage and repair CMS content in one place.
          For first-time tenant bootstrap use "Initialize site" on the Overview. */}
      <div id="cms-sync" className="space-y-4 pt-4 border-t border-neutral-100">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            CMS Sync
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            Recreate missing or stale CMS documents without changing tenant settings,
            design, or integrations.{" "}
            <a href="../" className="text-brand-600 hover:underline">
              Use Initialize site on the Overview tab
            </a>{" "}
            for first-time tenant bootstrap.
          </p>
        </div>

        {/* Per-tenant write token — required for provisioning.  Secret is
            stored server-side; only the boolean presence flag crosses the
            server→client boundary. */}
        <CmsCredentialsPanel
          tenantId={tenantId}
          hasCmsWriteToken={hasCmsWriteToken}
          cmsProvider={safeTenant.cms?.provider ?? "mock"}
        />

        {/* Provisioning — writes starter pages + variants to the CMS.
            Idempotent: existing documents are skipped.
            Package-gated: block and feature restrictions are applied. */}
        <CmsProvisioningPanel
          tenant={{
            tenantId:         safeTenant.tenantId,
            packageKey:       safeTenant.packageKey,
            design:           safeTenant.design,
            cms:              safeTenant.cms,   // writeToken already stripped
            cmsProvisionedAt: tenant.cmsProvisionedAt,
            hasCmsWriteToken,
          }}
        />

        {/* CMS content seed — tenant-scoped.
            Writes the starter stories / documents for this specific tenant.
            Only shown for providers that have a seed operation (Sanity, Storyblok). */}
        <TenantCmsSeedPanel
          tenantId={tenantId}
          cmsProvider={cmsProvider}
          hasWriteToken={hasCmsWriteToken}
          hasManagementToken={hasManagementToken}
          hasSpaceId={hasSpaceId}
        />
      </div>

      {/* Footer note */}
      <p className="text-[11px] text-neutral-400">
        {isPlatformCms
          ? "Platform CMS stores variant content directly in this database. Page structure, navigation, and entity documents require an external CMS."
          : <>
              Pages listed here are the structural definitions stored in the platform database.
              Actual content (copy, images, variants) lives in the CMS
              ({PROVIDER_LABEL[cmsProvider]}).
              {" Adaptive blocks (Content Matrix) are platform-managed and stored here regardless of CMS."}
              {cmsLink && (
                <>
                  {" "}
                  <a
                    href={cmsLink.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-600 hover:underline"
                  >
                    Open CMS →
                  </a>
                </>
              )}
            </>
        }
      </p>

    </div>
  );
}
