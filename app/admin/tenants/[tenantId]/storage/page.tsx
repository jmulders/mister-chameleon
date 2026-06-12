/**
 * Tenant — Storage Settings
 *
 * Lets the operator override which storage provider is used for this
 * tenant's asset uploads.  Provider credentials (R2 keys, Supabase,
 * Sanity write token) are always configured at the platform level;
 * only the active provider selection is per-tenant.
 *
 * Resolution order used by uploadAssetAction:
 *   1. This tenant's override  ← configured here
 *   2. Platform default        ← /admin/platform/integrations/storage
 *   3. Auto-detect from env vars
 *   4. supabase_storage (always available)
 */

import Link                              from "next/link";
import { getTenantStorageStateAction }   from "./actions";
import { StorageTenantClient }           from "./_components/StorageTenantClient";

interface Props {
  params: Promise<{ tenantId: string }>;
}

export default async function TenantStoragePage({ params }: Props) {
  const { tenantId } = await params;
  const result = await getTenantStorageStateAction(tenantId);

  return (
    <div className="p-8 space-y-8 max-w-2xl">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Asset storage</h1>
        <p className="mt-1 text-sm text-neutral-500 max-w-xl">
          Choose which storage provider is used when uploading assets for this tenant.
          Leave on <strong className="text-neutral-700">Platform default</strong> unless
          this tenant needs a dedicated provider.
          Provider credentials are managed at{" "}
          <Link
            href="/admin/platform/integrations/storage"
            className="text-brand-600 hover:underline"
          >
            Platform → Storage
          </Link>.
        </p>
      </div>

      {/* Error */}
      {!result.ok && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          Failed to load storage settings: {result.error}
        </div>
      )}

      {/* Client-side provider picker */}
      {result.ok && (
        <StorageTenantClient
          tenantId={tenantId}
          initialState={result.state}
        />
      )}

    </div>
  );
}
