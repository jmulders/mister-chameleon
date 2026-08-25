/**
 * Tenant Asset Library — data access layer
 *
 * All queries are scoped to a single tenantId.  This module is used exclusively
 * from server components and server actions (never imported in client bundles).
 *
 * ─── Storage layout ──────────────────────────────────────────────────────────
 *
 *   Storage backend : Cloudflare R2 (S3-compatible)
 *   Object key      : {tenantId}/{uuid}.{ext}
 *
 *   The tenantId prefix gives natural isolation at the storage layer.
 *   Public access is via the R2 public URL (configured in R2_PUBLIC_URL).
 *
 *   Legacy assets uploaded before the R2 migration have storage_path values
 *   pointing to Supabase Storage paths — the public_url column is the canonical
 *   delivery URL so those assets continue to work unchanged.
 *
 * ─── Metadata table ───────────────────────────────────────────────────────────
 *
 *   tenant_assets — stores per-asset metadata (title, alt, tags, file info,
 *   public URL, tenant_id).  Always filtered by tenant_id before returning.
 *
 * ─── Supabase client note ─────────────────────────────────────────────────────
 *
 *   Callers pass in a Supabase service-role client (created in the route handler)
 *   for metadata operations.  Storage operations go directly to R2 and do not
 *   require the Supabase client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
// Note: storage adapter is imported dynamically inside uploadToStorage to allow
// per-tenant override selection without circular imports at module load time.

// ── Types ───────────────────────────────────────────────────────────────────────

/** DB row shape returned by Supabase (snake_case). */
export interface TenantAssetRow {
  id:               string;
  tenant_id:        string;
  storage_path:     string;
  public_url:       string;
  file_name:        string;
  file_size:        number | null;
  mime_type:        string | null;
  width:            number | null;
  height:           number | null;
  /** Discriminant: "image" | "video" | "document" | "sanity" | null */
  asset_type:       string | null;
  /** Sanity CMS asset _id for CMS-sourced assets; null for direct uploads. */
  sanity_asset_id:  string | null;
  title:            string | null;
  alt_text:         string | null;
  tags:             string[];
  /** Virtual organization folder (org metadata only; storage stays flat). null = unfiled. */
  folder:           string | null;
  uploaded_by:      string | null;
  created_at:       string;
  updated_at:       string;
  /**
   * Which storage provider holds the binary.
   * "cloudflare_r2" | "supabase_storage" | "sanity_assets" | null (legacy)
   */
  storage_backend:  string | null;
  /** Bucket or dataset name within the provider. */
  provider_bucket:  string | null;
}

/** Application-level camelCase shape. */
export interface TenantAsset {
  id:             string;
  tenantId:       string;
  storagePath:    string;
  publicUrl:      string;
  fileName:       string;
  fileSize:       number | null;
  mimeType:       string | null;
  width:          number | null;
  height:         number | null;
  /** Discriminant: "image" | "video" | "document" | "sanity" | null */
  assetType:      string | null;
  /** Sanity CMS asset _id for CMS-sourced assets; null for direct uploads. */
  sanityAssetId:  string | null;
  title:          string | null;
  altText:        string | null;
  tags:           string[];
  /** Virtual organization folder (org metadata only; storage stays flat). null = unfiled. */
  folder:         string | null;
  uploadedBy:     string | null;
  createdAt:      string;
  updatedAt:      string;
  /**
   * Which storage provider holds the binary.
   * "cloudflare_r2" | "supabase_storage" | "sanity_assets" | null (legacy)
   */
  storageBackend: string | null;
  /** Bucket or dataset name within the provider. */
  providerBucket: string | null;
}

export interface GetAssetsOptions {
  /** Free-text search across title and file_name (case-insensitive contains). */
  search?: string;
  /** Filter to assets that contain ALL of the specified tags. */
  tags?:   string[];
  /**
   * Filter by virtual folder. A string matches that folder exactly; `null`
   * matches unfiled assets (folder IS NULL); omit for no folder filter.
   */
  folder?: string | null;
  /** Max results to return (default: 200). */
  limit?:  number;
  /** Offset for pagination (default: 0). */
  offset?: number;
  /** Filter to a specific asset type (e.g. "image"). */
  assetType?: string;
}

export interface CreateAssetInput {
  tenantId:       string;
  storagePath:    string;
  publicUrl:      string;
  fileName:       string;
  fileSize?:      number;
  mimeType?:      string;
  width?:         number;
  height?:        number;
  /** Discriminant: "image" | "video" | "document" | "sanity". Defaults to "image" for direct uploads. */
  assetType?:     string;
  /** Sanity CMS asset _id — set when mirroring a Sanity asset. */
  sanityAssetId?: string;
  title?:         string;
  altText?:       string;
  tags?:          string[];
  /** Virtual organization folder to file the asset under on creation. */
  folder?:        string | null;
  uploadedBy?:    string;
  /** Which storage provider holds the binary. Written by uploadToStorage(). */
  storageBackend?: string;
  /** Bucket / dataset name within the provider. Written by uploadToStorage(). */
  providerBucket?: string;
}

export interface UpdateAssetInput {
  title?:   string;
  altText?: string;
  tags?:    string[];
  /** Move the asset to a folder (string) or unfile it (null). Omit to leave unchanged. */
  folder?:  string | null;
}

// ── Mapper ──────────────────────────────────────────────────────────────────────

function rowToAsset(row: TenantAssetRow): TenantAsset {
  return {
    id:             row.id,
    tenantId:       row.tenant_id,
    storagePath:    row.storage_path,
    publicUrl:      row.public_url,
    fileName:       row.file_name,
    fileSize:       row.file_size,
    mimeType:       row.mime_type,
    width:          row.width,
    height:         row.height,
    assetType:      row.asset_type      ?? null,
    sanityAssetId:  row.sanity_asset_id ?? null,
    title:          row.title,
    altText:        row.alt_text,
    tags:           row.tags            ?? [],
    folder:         row.folder          ?? null,
    uploadedBy:     row.uploaded_by,
    createdAt:      row.created_at,
    updatedAt:      row.updated_at,
    storageBackend: row.storage_backend ?? null,
    providerBucket: row.provider_bucket ?? null,
  };
}

// ── Queries ─────────────────────────────────────────────────────────────────────

/**
 * List all assets for a tenant, newest first.
 *
 * Optionally filter by free-text search (title / file_name), tags, or asset type.
 */
export async function getAssets(
  client:   SupabaseClient,
  tenantId: string,
  options:  GetAssetsOptions = {},
): Promise<TenantAsset[]> {
  const { search, tags, folder, limit = 200, offset = 0, assetType } = options;

  let query = client
    .from("tenant_assets")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`title.ilike.${term},file_name.ilike.${term}`);
  }

  if (tags && tags.length > 0) {
    query = query.contains("tags", tags);
  }

  // Folder filter: a name matches that folder; null matches unfiled assets.
  if (folder !== undefined) {
    query = folder === null ? query.is("folder", null) : query.eq("folder", folder);
  }

  if (assetType) {
    query = query.eq("asset_type", assetType);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(
      `getAssets failed for tenant ${tenantId}: ${error.message} (code: ${error.code ?? "?"})`
    );
  }

  return (data as TenantAssetRow[]).map(rowToAsset);
}

/**
 * Fetch a single asset by ID, scoped to tenantId for safety.
 * Returns null if not found or belongs to a different tenant.
 */
export async function getAssetById(
  client:   SupabaseClient,
  tenantId: string,
  assetId:  string,
): Promise<TenantAsset | null> {
  const { data, error } = await client
    .from("tenant_assets")
    .select("*")
    .eq("id", assetId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    throw new Error(`getAssetById failed: ${error.message} (code: ${error.code ?? "?"})`);
  }

  return data ? rowToAsset(data as TenantAssetRow) : null;
}

/**
 * Get all distinct tags used across a tenant's assets.
 * Used to populate the tag filter dropdown in the UI.
 */
export async function getAssetTags(
  client:   SupabaseClient,
  tenantId: string,
): Promise<string[]> {
  const { data, error } = await client
    .from("tenant_assets")
    .select("tags")
    .eq("tenant_id", tenantId);

  if (error) {
    throw new Error(`getAssetTags failed: ${error.message}`);
  }

  const all = (data as { tags: string[] }[]).flatMap((r) => r.tags ?? []);
  return [...new Set(all)].sort();
}

/**
 * Get all distinct virtual folders in use across a tenant's assets, sorted.
 * Powers the folder browser/filter. Folders are derived from the `folder`
 * column, so a folder exists exactly while at least one asset is filed under it.
 */
export async function getAssetFolders(
  client:   SupabaseClient,
  tenantId: string,
): Promise<string[]> {
  const { data, error } = await client
    .from("tenant_assets")
    .select("folder")
    .eq("tenant_id", tenantId)
    .not("folder", "is", null);

  if (error) {
    throw new Error(`getAssetFolders failed: ${error.message}`);
  }

  const all = (data as { folder: string | null }[])
    .map((r) => r.folder)
    .filter((f): f is string => typeof f === "string" && f.length > 0);
  return [...new Set(all)].sort((a, b) => a.localeCompare(b));
}

// ── Mutations ───────────────────────────────────────────────────────────────────

/**
 * Insert a new asset metadata row after a successful storage upload.
 */
export async function createAsset(
  client: SupabaseClient,
  input:  CreateAssetInput,
): Promise<TenantAsset> {
  const { data, error } = await client
    .from("tenant_assets")
    .insert({
      tenant_id:       input.tenantId,
      storage_path:    input.storagePath,
      public_url:      input.publicUrl,
      file_name:       input.fileName,
      file_size:       input.fileSize      ?? null,
      mime_type:       input.mimeType      ?? null,
      width:           input.width         ?? null,
      height:          input.height        ?? null,
      asset_type:      input.assetType     ?? "image",
      sanity_asset_id: input.sanityAssetId ?? null,
      title:           input.title           ?? null,
      alt_text:        input.altText         ?? null,
      tags:            input.tags            ?? [],
      folder:          input.folder          ?? null,
      uploaded_by:     input.uploadedBy      ?? null,
      storage_backend: input.storageBackend  ?? null,
      provider_bucket: input.providerBucket  ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`createAsset failed: ${error.message} (code: ${error.code ?? "?"})`);
  }

  return rowToAsset(data as TenantAssetRow);
}

/**
 * Update editorial metadata for an existing asset.
 * Only title, alt_text, and tags can be updated.
 */
export async function updateAsset(
  client:   SupabaseClient,
  tenantId: string,
  assetId:  string,
  input:    UpdateAssetInput,
): Promise<TenantAsset> {
  const patch: Record<string, unknown> = {};
  if (input.title   !== undefined) patch["title"]    = input.title;
  if (input.altText !== undefined) patch["alt_text"] = input.altText;
  if (input.tags    !== undefined) patch["tags"]     = input.tags;
  if (input.folder  !== undefined) patch["folder"]   = input.folder;

  const { data, error } = await client
    .from("tenant_assets")
    .update(patch)
    .eq("id", assetId)
    .eq("tenant_id", tenantId)     // safety: tenant scope
    .select()
    .single();

  if (error) {
    throw new Error(`updateAsset failed: ${error.message} (code: ${error.code ?? "?"})`);
  }

  return rowToAsset(data as TenantAssetRow);
}

/**
 * Delete an asset — removes the storage object AND the metadata row.
 *
 * Storage deletion is attempted first; if it fails the metadata row is left
 * intact (orphaned storage is better than orphaned metadata).
 *
 * Routes to the correct storage provider using the asset's `storage_backend`
 * column.  Assets without a `storage_backend` value are treated as legacy
 * Supabase Storage assets and deletion is skipped for the storage layer
 * (the metadata row is still removed).
 */
export async function deleteAsset(
  client:   SupabaseClient,
  tenantId: string,
  assetId:  string,
): Promise<void> {
  // 1. Fetch the row to get the storage path + backend (tenant-scoped)
  const asset = await getAssetById(client, tenantId, assetId);
  if (!asset) {
    throw new Error(`Asset ${assetId} not found for tenant ${tenantId}`);
  }

  // 2. Delete from the storage provider.
  //    For Sanity assets, we use the asset's sanityAssetId as the storage path.
  //    For R2/Supabase, we use the regular storagePath.
  if (asset.storageBackend) {
    try {
      const { getActiveStorageAdapter } = await import("./storage-adapter");
      const adapter = await getActiveStorageAdapter();
      // Sanity assets: use the sanityAssetId (= Sanity _id) as the deletion key.
      // All other providers: use the regular storagePath (object key).
      const pathToDelete =
        asset.storageBackend === "sanity_assets" && asset.sanityAssetId
          ? asset.sanityAssetId
          : asset.storagePath;

      await adapter.delete(pathToDelete, asset.providerBucket ?? undefined);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`deleteAsset: storage delete failed for ${asset.storagePath}: ${msg}`);
    }
  }
  // Legacy assets (storage_backend IS NULL) — skip storage deletion; only remove metadata.

  // 3. Delete metadata row
  const { error } = await client
    .from("tenant_assets")
    .delete()
    .eq("id", assetId)
    .eq("tenant_id", tenantId);

  if (error) {
    throw new Error(`deleteAsset: metadata delete failed: ${error.message}`);
  }
}

// ── Storage helpers ─────────────────────────────────────────────────────────────

/**
 * Upload a file using the active storage provider and return the storage path + public URL.
 *
 * The active provider is resolved from platform_settings.storage.activeProvider
 * (set via Admin → Platform → Integrations → Storage), falling back through:
 *   R2 env vars → Sanity → Supabase Storage.
 *
 * The Supabase client parameter is accepted for backward-compatibility but is
 * no longer used for storage — all binary data goes to the active provider.
 * The client is still used by the caller to write the metadata row.
 */
export async function uploadToStorage(
  _client:  SupabaseClient,   // unused for storage — kept for call-site compat
  tenantId: string,
  file:     { name: string; type: string; bytes: ArrayBuffer },
): Promise<{ storagePath: string; publicUrl: string; storageBackend: string; providerBucket: string }> {
  // Use per-tenant storage override when configured, otherwise fall back to
  // platform-level provider selection.
  const { getActiveStorageAdapterForTenant } = await import("./storage-adapter");
  const adapter = await getActiveStorageAdapterForTenant(tenantId);

  const result = await adapter.upload({
    tenantId,
    fileName: file.name,
    mimeType: file.type,
    bytes:    file.bytes,
  });

  return {
    storagePath:    result.storagePath,
    publicUrl:      result.publicUrl,
    storageBackend: result.storageBackend,
    providerBucket: result.providerBucket,
  };
}

// ── Format helpers ──────────────────────────────────────────────────────────────

/** Human-readable file size. Re-exported from lib/assets/format.ts for convenience. */
export { formatFileSize } from "./format";
