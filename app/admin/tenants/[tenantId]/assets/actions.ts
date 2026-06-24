"use server";

import { rethrowNextInternal } from "@/lib/server-action-guard";

/**
 * Asset Library Server Actions
 *
 * Handles upload, update, and delete of tenant-scoped media assets.
 * All actions verify admin session + tenant access before touching data.
 *
 * ─── Upload flow ─────────────────────────────────────────────────────────────
 *
 *   1. Client submits FormData with: file, tenantId, title?, altText?, tags?
 *   2. Action authenticates and authorises the caller.
 *   3. File bytes are read from FormData and pushed to Supabase Storage.
 *   4. The public URL + metadata are written to tenant_assets.
 *   5. The page is revalidated so the new asset appears in the grid.
 *
 * ─── File validation ─────────────────────────────────────────────────────────
 *
 *   Max size     : 10 MB (matches the storage bucket limit)
 *   Allowed MIME : jpeg, jpg, png, webp, gif, svg+xml
 */

import { createClient }    from "@supabase/supabase-js";
import { revalidatePath }  from "next/cache";
import {
  getRequiredAdminSession,
  assertTenantAccess,
} from "@/lib/admin-auth/authorization";
import {
  uploadToStorage,
  createAsset,
  updateAsset,
  deleteAsset,
  type UpdateAssetInput,
} from "@/lib/assets/tenant-assets";

// ── Constants ──────────────────────────────────────────────────────────────────

// Vercel caps a serverless-function request body at ~4.5 MB, and this upload
// runs through a Server Action (= serverless function). The Next.js
// `serverActions.bodySizeLimit` can't raise that platform cap, so anything
// larger is rejected by Vercel BEFORE this action runs. We cap below 4.5 MB so
// the user gets a clear message instead of an opaque 413. Larger videos need the
// direct-to-storage (signed-URL) upload path.
const MAX_FILE_SIZE   = 4 * 1024 * 1024; // 4 MB (under Vercel's ~4.5 MB body cap)
const ALLOWED_MIMES   = new Set([
  // Images
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  // Video (short / compressed clips — see the 4 MB note above)
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
]);

// ── Action result types ────────────────────────────────────────────────────────

export interface UploadAssetResult {
  success: boolean;
  assetId?: string;
  publicUrl?: string;
  error?: string;
}

export interface UpdateAssetResult {
  success: boolean;
  error?: string;
}

export interface DeleteAssetResult {
  success: boolean;
  error?: string;
}

// ── Supabase service-role client factory ───────────────────────────────────────

function makeServiceClient() {
  return createClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false } },
  );
}

// ── uploadAssetAction ──────────────────────────────────────────────────────────

/**
 * Upload a new image to the tenant asset library.
 *
 * FormData fields:
 *   file      File      Required. Image file to upload.
 *   tenantId  string    Required. Tenant scope.
 *   title     string?   Optional human-readable label.
 *   altText   string?   Optional accessibility alt text.
 *   tags      string?   Optional comma-separated tag list.
 */
export async function uploadAssetAction(
  formData: FormData,
): Promise<UploadAssetResult> {
  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const session  = await getRequiredAdminSession();
    const tenantId = formData.get("tenantId") as string;
    if (!tenantId) return { success: false, error: "tenantId is required" };

    await assertTenantAccess(session, tenantId);

    // ── File validation ───────────────────────────────────────────────────────
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { success: false, error: "No file provided" };
    }

    if (file.size > MAX_FILE_SIZE) {
      return {
        success: false,
        error:   `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 4 MB through this uploader (Vercel body limit). For larger videos, use a direct-to-storage upload.`,
      };
    }

    if (!ALLOWED_MIMES.has(file.type)) {
      return {
        success: false,
        error:   `File type "${file.type}" is not allowed. Accepted: JPEG, PNG, WebP, GIF, SVG, MP4, WebM, OGG, MOV.`,
      };
    }

    // ── Metadata from form ────────────────────────────────────────────────────
    const title   = (formData.get("title")   as string | null)?.trim() || null;
    const altText = (formData.get("altText") as string | null)?.trim() || undefined;
    const tagsRaw = (formData.get("tags")    as string | null)?.trim() || "";
    const tags    = tagsRaw
      ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
      : [];

    // ── Upload to storage ─────────────────────────────────────────────────────
    const client  = makeServiceClient();
    const bytes   = await file.arrayBuffer();

    const {
      storagePath,
      publicUrl,
      storageBackend,
      providerBucket,
    } = await uploadToStorage(client, tenantId, {
      name:  file.name,
      type:  file.type,
      bytes,
    });

    // ── Create metadata row ───────────────────────────────────────────────────
    const asset = await createAsset(client, {
      tenantId,
      storagePath,
      publicUrl,
      fileName:      file.name,
      fileSize:      file.size,
      mimeType:      file.type,
      title:         title ?? file.name,
      altText,
      tags,
      uploadedBy:    session.email ?? "admin",
      storageBackend,
      providerBucket,
      // For Sanity assets, storagePath is the Sanity asset _id.
      sanityAssetId: storageBackend === "sanity_assets" ? storagePath : undefined,
      assetType:     "image",
    });

    // ── Revalidate ────────────────────────────────────────────────────────────
    revalidatePath(`/admin/tenants/${tenantId}/assets`);

    return { success: true, assetId: asset.id, publicUrl: asset.publicUrl };
  } catch (err) {
    rethrowNextInternal(err);
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[uploadAssetAction] error:", msg);
    return { success: false, error: msg };
  }
}

// ── updateAssetMetaAction ──────────────────────────────────────────────────────

/**
 * Update title, alt text, and/or tags for an existing asset.
 */
export async function updateAssetMetaAction(
  tenantId: string,
  assetId:  string,
  input:    UpdateAssetInput,
): Promise<UpdateAssetResult> {
  try {
    const session = await getRequiredAdminSession();
    await assertTenantAccess(session, tenantId);

    const client = makeServiceClient();
    await updateAsset(client, tenantId, assetId, input);

    revalidatePath(`/admin/tenants/${tenantId}/assets`);
    return { success: true };
  } catch (err) {
    rethrowNextInternal(err);
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[updateAssetMetaAction] error:", msg);
    return { success: false, error: msg };
  }
}

// ── deleteAssetAction ──────────────────────────────────────────────────────────

/**
 * Delete an asset — removes both the storage object and the metadata row.
 */
export async function deleteAssetAction(
  tenantId: string,
  assetId:  string,
): Promise<DeleteAssetResult> {
  try {
    const session = await getRequiredAdminSession();
    await assertTenantAccess(session, tenantId);

    const client = makeServiceClient();
    await deleteAsset(client, tenantId, assetId);

    revalidatePath(`/admin/tenants/${tenantId}/assets`);
    return { success: true };
  } catch (err) {
    rethrowNextInternal(err);
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[deleteAssetAction] error:", msg);
    return { success: false, error: msg };
  }
}
