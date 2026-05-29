/**
 * Admin — Platform Integrations › Storage
 *
 * Configure the asset storage backend used by the Tenant Asset Library.
 * Accessible at /admin/platform/integrations/storage.
 *
 * ─── Supported providers ──────────────────────────────────────────────────────
 *
 *   sanity_assets    — Sanity REST Asset API (v1 default)
 *                      Uses your Sanity dataset as an image store.
 *                      Requires a write token in the CMS integration.
 *
 *   supabase_storage — Supabase Storage (v2 built-in)
 *                      Built into the project; no external setup.
 *                      Configurable bucket name (default: "tenant-assets").
 *
 *   cloudflare_r2    — Cloudflare R2 (v3 zero-egress)
 *                      Optional; requires external Cloudflare account + bucket.
 *                      Zero-egress fees for assets served via Cloudflare network.
 *
 * ─── Resolution order ─────────────────────────────────────────────────────────
 *
 *   1. Explicitly set via this page (platform_settings.storage.activeProvider)
 *   2. R2_ACCOUNT_ID env var present → cloudflare_r2
 *   3. Sanity configured → sanity_assets
 *   4. supabase_storage (always available)
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   R2 secret access key is stored server-side only and never returned to
 *   the browser — only a boolean "has key" flag is passed to the client.
 */

import Link                        from "next/link";
import {
  getStorageSettingsAction,
  setActiveProviderAction,
  saveR2CredentialsAction,
  saveSupabaseStorageAction,
  testProviderConnectionAction,
}                                  from "./actions";
import { StoragePlatformClient }   from "./_components/StoragePlatformClient";

export default async function IntegrationsStoragePage() {
  const result = await getStorageSettingsAction();

  return (
    <div className="mx-auto max-w-xl space-y-5 p-8">

      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Asset Storage</h1>
        <div className="mt-1 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden />
            Platform default
          </span>
        </div>
        <p className="mt-2 text-sm text-neutral-500">
          Choose where new tenant asset uploads are stored. The active provider is used by
          the Tenant Asset Library for all uploads. Existing assets continue to work via
          their stored public URLs regardless of which provider is active.
        </p>
      </div>

      {/* Provider resolution note */}
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
        <p className="font-medium text-neutral-700 mb-1.5">Provider resolution order (highest priority first)</p>
        <ol className="space-y-0.5">
          <li className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-brand-700 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden />
              1. Admin UI
            </span>
            <span>— explicitly set via this page</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-neutral-500 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" aria-hidden />
              2. Env vars
            </span>
            <span>—{" "}
              <code className="bg-neutral-100 px-0.5 rounded">R2_ACCOUNT_ID</code> set → cloudflare_r2
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-neutral-500 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" aria-hidden />
              3. Auto
            </span>
            <span>— Sanity configured → sanity_assets; else supabase_storage</span>
          </li>
        </ol>
      </div>

      {/* Security callout */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800">
        <strong>Secrets stay server-side.</strong>{" "}
        The Cloudflare R2 secret access key is stored encrypted at rest and never
        returned to the browser after saving.
        Only a &ldquo;key saved&rdquo; status is shown in the UI.
      </div>

      {/* Load error */}
      {!result.ok && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Failed to load storage settings:</strong> {result.error}
        </div>
      )}

      {/* Settings */}
      {result.ok && (
        <StoragePlatformClient
          initialConfig={result.config}
          setActiveProviderAction={setActiveProviderAction}
          saveR2CredentialsAction={saveR2CredentialsAction}
          saveSupabaseStorageAction={saveSupabaseStorageAction}
          testProviderConnectionAction={testProviderConnectionAction}
        />
      )}

    </div>
  );
}
