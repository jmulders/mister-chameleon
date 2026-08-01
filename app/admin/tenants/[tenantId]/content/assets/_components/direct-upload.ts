/**
 * Direct-to-storage upload helper (client-side)
 *
 * Bypasses the ~4.5 MB Vercel Server-Action body cap by uploading the file
 * straight to Supabase Storage via a short-lived signed upload URL:
 *
 *   1. createAssetUploadUrlAction  → { bucket, path, token, publicUrl }
 *   2. browser PUTs the bytes directly to Storage (uploadToSignedUrl)
 *   3. registerUploadedAssetAction → creates the tenant_assets row
 *
 * Use this for video and any file larger than a few MB. Small images can still
 * use the plain uploadAssetAction.
 */

import { createClient } from "@supabase/supabase-js";
import {
  createAssetUploadUrlAction,
  registerUploadedAssetAction,
} from "../actions";

export interface DirectUploadResult {
  success:   boolean;
  assetId?:  string;
  publicUrl?: string;
  error?:    string;
}

export async function directUploadAsset(opts: {
  tenantId: string;
  file:     File;
  title?:   string | null;
  altText?: string | null;
  tags?:    string[];
}): Promise<DirectUploadResult> {
  const { tenantId, file } = opts;

  // 1. Signed upload URL.
  const issued = await createAssetUploadUrlAction({
    tenantId,
    fileName: file.name,
    mimeType: file.type,
    fileSize: file.size,
  });
  if (!issued.success || !issued.bucket || !issued.path || !issued.token || !issued.publicUrl) {
    return { success: false, error: issued.error ?? "Could not start the upload." };
  }

  // 2. Direct browser → Storage upload.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return { success: false, error: "Storage is not configured (missing public Supabase keys)." };
  }
  const supabase = createClient(supabaseUrl, anonKey);
  const { error: uploadError } = await supabase.storage
    .from(issued.bucket)
    .uploadToSignedUrl(issued.path, issued.token, file, { contentType: file.type });
  if (uploadError) {
    return { success: false, error: `Upload failed: ${uploadError.message}` };
  }

  // 3. Register the asset.
  const registered = await registerUploadedAssetAction({
    tenantId,
    storagePath: issued.path,
    publicUrl:   issued.publicUrl,
    fileName:    file.name,
    fileSize:    file.size,
    mimeType:    file.type,
    title:       opts.title ?? null,
    altText:     opts.altText ?? null,
    tags:        opts.tags ?? [],
  });
  if (!registered.success) {
    return { success: false, error: registered.error ?? "Upload succeeded but registering the asset failed." };
  }
  return { success: true, assetId: registered.assetId, publicUrl: registered.publicUrl };
}

/** Files at/above this size use the direct path; smaller ones can use the Server Action. */
export const DIRECT_UPLOAD_THRESHOLD = 4 * 1024 * 1024; // 4 MB
