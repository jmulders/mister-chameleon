/**
 * Admin — Tenant Search Settings
 *
 * Accessible at /admin/tenants/[tenantId]/search.
 *
 * Lets tenant admins configure the search provider (Meilisearch) and
 * trigger a full content reindex from the CMS.
 *
 * ─── Data flow ────────────────────────────────────────────────────────────────
 *
 *   1. Server page loads current settings via getTenantSearchSettingsAction().
 *   2. TenantSearchSettingsClient renders a form pre-filled with current values.
 *   3. On save, calls saveTenantSearchSettingsAction(tenantId, input).
 *   4. On reindex, calls reindexTenantSearchAction(tenantId) which:
 *        a. Fetches all published content from Sanity
 *        b. Pushes to Meilisearch index
 *        c. Persists docCount + lastIndexedAt back to DB
 *   5. Runtime: getSearchProvider(tenantId) reads the settings and returns
 *        a MeilisearchSearchProvider instead of the SanitySearchProvider.
 *
 * ─── Database migration ───────────────────────────────────────────────────────
 *
 *   Run once before using this page:
 *
 *   CREATE TABLE IF NOT EXISTS public.tenant_search_settings (
 *     tenant_id   text PRIMARY KEY,
 *     config      jsonb NOT NULL DEFAULT '{}',
 *     updated_at  timestamptz NOT NULL DEFAULT now()
 *   );
 */

import { notFound }                   from "next/navigation";
import { getTenantById }             from "@/tenant/server";
import { normalizeTenant }           from "@/tenant/normalize";
import {
  getTenantSearchSettingsAction,
  saveTenantSearchSettingsAction,
  reindexTenantSearchAction,
}                                    from "./actions";
import { TenantSearchSettingsClient } from "./_components/TenantSearchSettingsClient";

export default async function TenantSearchPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  const rawTenant = await getTenantById(tenantId);
  if (!rawTenant) notFound();

  const tenant = normalizeTenant(rawTenant);
  const result = await getTenantSearchSettingsAction(tenantId);

  const isMigrationMissing =
    !result.ok && result.error.startsWith("TABLE_NOT_FOUND");

  return (
    <div className="p-8 max-w-2xl space-y-5">
      <div>

        {/* Page header */}
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Search</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Configure the search engine for{" "}
            <code className="font-mono text-xs">{tenant.name ?? tenantId}</code>.
            Meilisearch provides fast full-text search with relevance ranking,
            highlighted snippets, and scope-based filtering across content types.
          </p>
        </div>

        {/* Migration missing banner */}
        {isMigrationMissing && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            <strong>Database migration required.</strong> The{" "}
            <code className="font-mono text-xs bg-yellow-100 px-1 py-0.5 rounded">
              tenant_search_settings
            </code>{" "}
            table does not exist yet. Run the migration SQL shown in the page source
            comment before using this feature.
          </div>
        )}

        {/* Error banner (non-migration) */}
        {!result.ok && !isMigrationMissing && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Failed to load search settings: {result.error}
          </div>
        )}

        {/* Main settings form */}
        {result.ok && (
          <TenantSearchSettingsClient
            tenantId={tenantId}
            initialConfig={result.config}
            saveAction={saveTenantSearchSettingsAction}
            reindexAction={reindexTenantSearchAction}
          />
        )}

        {/* Placeholder when table is missing — show read-only defaults */}
        {isMigrationMissing && (
          <TenantSearchSettingsClient
            tenantId={tenantId}
            initialConfig={{
              provider:        "none",
              meilisearchHost: "",
              indexPrefix:     "",
              hasApiKey:       false,
              lastIndexedAt:   null,
              lastIndexStats:  null,
            }}
            saveAction={saveTenantSearchSettingsAction}
            reindexAction={reindexTenantSearchAction}
          />
        )}

      </div>
    </div>
  );
}
