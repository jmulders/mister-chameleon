/**
 * /admin/tenants/[tenantId]/content/assets
 *
 * Tenant Asset Library — browse, upload, and manage tenant-scoped media assets.
 *
 * ─── Storage strategy ────────────────────────────────────────────────────────
 *
 *   The active storage provider is resolved at upload time by the storage
 *   adapter (lib/assets/storage-adapter.ts).  Supported providers:
 *
 *     sanity_assets    — Sanity REST Asset API (default)
 *     supabase_storage — Supabase Storage (built-in)
 *     cloudflare_r2    — Cloudflare R2 (optional, zero-egress)
 *
 *   Configure the active provider at:
 *   Admin → Platform → Integrations → Storage
 *
 *   Metadata (title, alt text, tags, file info, public URL, provider) lives
 *   in the tenant_assets table, always queried with a tenant_id filter.
 *
 * ─── Error handling ───────────────────────────────────────────────────────────
 *
 *   If the tenant_assets table doesn't exist yet (migration 066 not applied),
 *   the page renders a visible migration notice instead of crashing.
 */

import { createClient }   from "@supabase/supabase-js";
import { notFound }       from "next/navigation";
import { getTenantById }  from "@/tenant/server";
import {
  getRequiredAdminSession,
  isSuperAdmin as checkIsSuperAdmin,
} from "@/lib/admin-auth/authorization";
import { getAssets, getAssetTags, getAssetFolders } from "@/lib/assets/tenant-assets";
import { AssetLibraryClient }      from "./_components/AssetLibraryClient";
import { rethrowNextInternal } from "@/lib/server-action-guard";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

// ── LoadError shape ────────────────────────────────────────────────────────────

interface LoadError {
  message:          string;
  isMigrationError: boolean;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function TenantAssetsPage({ params }: PageProps) {
  const { tenantId } = await params;

  // ── Auth ────────────────────────────────────────────────────────────────────
  const adminSession    = await getRequiredAdminSession();
  const isSuperAdmin    = checkIsSuperAdmin(adminSession);

  // ── Tenant ─────────────────────────────────────────────────────────────────
  const tenant = await getTenantById(tenantId);
  if (!tenant) notFound();

  // ── Data loading ────────────────────────────────────────────────────────────
  const client = createClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false } },
  );

  let assets:     Awaited<ReturnType<typeof getAssets>>   = [];
  let allTags:    string[]                                 = [];
  let allFolders: string[]                                 = [];
  let loadError:  LoadError | null                         = null;

  try {
    [assets, allTags, allFolders] = await Promise.all([
      getAssets(client, tenantId),
      getAssetTags(client, tenantId),
      getAssetFolders(client, tenantId),
    ]);
  } catch (err) {
    rethrowNextInternal(err);
    const msg = err instanceof Error ? err.message : String(err);

    // 42P01 = relation does not exist (PostgreSQL)
    // PGRST205 = table not found in PostgREST schema cache (occurs when table
    //            is truly absent — local Supabase auto-reloads schema on migration)
    const isMigrationError =
      msg.includes("42P01")        ||
      msg.includes("PGRST205")     ||
      msg.includes("does not exist") ||
      msg.includes("tenant_assets");

    console.error("[TenantAssetsPage] data load error:", msg);
    loadError = { message: msg, isMigrationError };
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Asset Library</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Upload and manage images for <strong>{tenant.name ?? tenantId}</strong>.
            Assets are tenant-scoped and can be reused across pages and blocks.
          </p>
        </div>
      </div>

      {/* Load error */}
      {loadError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
          <h2 className="mb-1 text-base font-semibold text-amber-900">
            {loadError.isMigrationError
              ? "Database setup incomplete"
              : "Asset library unavailable"}
          </h2>
          {loadError.isMigrationError ? (
            <div className="space-y-2 text-sm text-amber-700">
              <p>
                The <code className="rounded bg-amber-100 px-1 font-mono text-xs">tenant_assets</code> table
                or the <code className="rounded bg-amber-100 px-1 font-mono text-xs">tenant-assets</code> storage
                bucket has not been created yet.
              </p>
              <p>
                Run{" "}
                <code className="rounded bg-amber-100 px-1 font-mono text-xs">supabase db push</code>{" "}
                from your project root to apply migration 066 which creates both the table and
                the storage bucket automatically.
              </p>
            </div>
          ) : (
            <p className="text-sm text-amber-700">{loadError.message}</p>
          )}
          {isSuperAdmin && (
            <pre className="mt-3 rounded bg-amber-100 p-3 text-xs text-amber-800 overflow-auto">
              {loadError.message}
            </pre>
          )}
        </div>
      ) : (
        <AssetLibraryClient
          tenantId={tenantId}
          initialAssets={assets}
          allTags={allTags}
          allFolders={allFolders}
        />
      )}
    </div>
  );
}
