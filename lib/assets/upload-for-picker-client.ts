/**
 * upload-for-picker-client.ts
 *
 * Client-side upload helper for AssetPickerModal.
 *
 * Small files (< 4 MB images) POST to /api/admin/assets/upload. Large files and
 * any video bypass the ~4.5 MB Vercel serverless body cap by uploading STRAIGHT
 * to Supabase Storage via a signed upload URL (createAssetUploadUrlAction →
 * browser PUT → registerUploadedAssetAction), then the created asset is returned
 * in the same PickerUploadResult shape so this stays a drop-in replacement.
 */

import { createClient } from "@supabase/supabase-js";
import type { PickerUploadResult } from "./upload-for-picker-action";
import type { TenantAsset } from "./tenant-assets";
import {
  createAssetUploadUrlAction,
  registerUploadedAssetAction,
} from "@/app/admin/tenants/[tenantId]/content/assets/actions";

// Files at/above this size (or any video) take the direct-to-storage path.
const DIRECT_THRESHOLD = 4 * 1024 * 1024; // 4 MB

export async function uploadForPickerClient(
  formData: FormData,
): Promise<PickerUploadResult> {
  const file     = formData.get("file");
  const tenantId = (formData.get("tenantId") as string | null) ?? "";
  const altText  = (formData.get("altText")  as string | null) ?? null;

  // ── Large file / video → direct-to-storage ────────────────────────────────
  if (
    file instanceof File &&
    (file.size >= DIRECT_THRESHOLD || file.type.startsWith("video/"))
  ) {
    return directPickerUpload(file, tenantId, altText);
  }

  // ── Small image → existing API route ──────────────────────────────────────
  let res: Response;
  try {
    res = await fetch("/api/admin/assets/upload", { method: "POST", body: formData });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, error: `HTTP ${res.status}: ${res.statusText}` };
  }
  return json as PickerUploadResult;
}

async function directPickerUpload(
  file:     File,
  tenantId: string,
  altText:  string | null,
): Promise<PickerUploadResult> {
  const issued = await createAssetUploadUrlAction({
    tenantId,
    fileName: file.name,
    mimeType: file.type,
    fileSize: file.size,
  });
  if (!issued.success || !issued.bucket || !issued.path || !issued.token || !issued.publicUrl) {
    return { ok: false, error: issued.error ?? "Could not start the upload." };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return { ok: false, error: "Storage is not configured (missing public Supabase keys)." };
  }
  const supabase = createClient(supabaseUrl, anonKey);
  const { error: uploadError } = await supabase.storage
    .from(issued.bucket)
    .uploadToSignedUrl(issued.path, issued.token, file, { contentType: file.type });
  if (uploadError) {
    return { ok: false, error: `Upload failed: ${uploadError.message}` };
  }

  const reg = await registerUploadedAssetAction({
    tenantId,
    storagePath: issued.path,
    publicUrl:   issued.publicUrl,
    fileName:    file.name,
    fileSize:    file.size,
    mimeType:    file.type,
    altText,
    tags:        [],
  });
  if (!reg.success || !reg.assetId) {
    return { ok: false, error: reg.error ?? "Upload succeeded but registering the asset failed." };
  }

  const now = new Date().toISOString();
  const asset: TenantAsset = {
    id:             reg.assetId,
    tenantId,
    storagePath:    issued.path,
    publicUrl:      reg.publicUrl ?? issued.publicUrl,
    fileName:       file.name,
    fileSize:       file.size,
    mimeType:       file.type,
    width:          null,
    height:         null,
    assetType:      file.type.startsWith("video/") ? "video" : "image",
    sanityAssetId:  null,
    title:          file.name,
    altText,
    tags:           [],
    uploadedBy:     null,
    createdAt:      now,
    updatedAt:      now,
    storageBackend: "supabase_storage",
    providerBucket: issued.bucket,
  };
  return { ok: true, asset };
}
