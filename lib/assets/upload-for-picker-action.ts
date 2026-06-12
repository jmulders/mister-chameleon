"use server";

/**
 * Upload Asset — picker-scoped server action
 *
 * Shared upload action for the AssetPickerModal so editors can upload
 * a new file without navigating to the full Asset Library.
 *
 * Accepts the same FormData shape as the page-scoped uploadAssetAction
 * (file, tenantId, altText?) and returns the created asset.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   import { uploadForPickerAction } from "@/lib/assets/upload-for-picker-action";
 *
 *   <AssetPickerModal uploadAsset={uploadForPickerAction} ... />
 */

import { createClient }           from "@supabase/supabase-js";
import {
  getRequiredAdminSession,
  assertTenantAccess,
}                                 from "@/lib/admin-auth/authorization";
import {
  uploadToStorage,
  createAsset,
}                                 from "@/lib/assets/tenant-assets";
import type { TenantAsset }       from "@/lib/assets/tenant-assets";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

export type PickerUploadResult =
  | { ok: true;  asset: TenantAsset }
  | { ok: false; error: string };

/**
 * Upload a new image and return the created TenantAsset record,
 * ready to be immediately selected in the picker.
 *
 * FormData fields:
 *   file      File     Required. Image to upload.
 *   tenantId  string   Required. Tenant scope.
 *   altText   string?  Optional alt text.
 */
export async function uploadForPickerAction(
  formData: FormData,
): Promise<PickerUploadResult> {
  try {
    const session  = await getRequiredAdminSession();
    const tenantId = formData.get("tenantId") as string | null;

    if (!tenantId) {
      return { ok: false, error: "tenantId is required" };
    }

    await assertTenantAccess(session, tenantId);

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { ok: false, error: "No file provided" };
    }

    if (file.size > MAX_FILE_SIZE) {
      return {
        ok: false,
        error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 10 MB.`,
      };
    }

    if (!ALLOWED_MIMES.has(file.type)) {
      return {
        ok: false,
        error: `File type "${file.type}" is not allowed. Accepted: JPEG, PNG, WebP, GIF, SVG.`,
      };
    }

    const altText = (formData.get("altText") as string | null)?.trim() || undefined;
    const bytes   = await file.arrayBuffer();

    const client = createClient(
      process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
      process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
      { auth: { persistSession: false } },
    );

    const { storagePath, publicUrl, storageBackend, providerBucket } =
      await uploadToStorage(client, tenantId, {
        name:  file.name,
        type:  file.type,
        bytes,
      });

    const asset = await createAsset(client, {
      tenantId,
      storagePath,
      publicUrl,
      fileName:      file.name,
      fileSize:      file.size,
      mimeType:      file.type,
      title:         file.name,
      altText,
      tags:          [],
      uploadedBy:    session.email ?? "admin",
      storageBackend,
      providerBucket,
    });

    return { ok: true, asset };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
