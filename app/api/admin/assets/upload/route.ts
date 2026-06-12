/**
 * POST /api/admin/assets/upload
 *
 * Route-handler equivalent of upload-for-picker-action.ts.
 *
 * Server Actions in Next.js 16 (Turbopack dev mode) have a hard 1 MB body
 * limit that ignores next.config serverActions.bodySizeLimit.  This route
 * handler is used instead — Route Handlers stream the request body and are
 * not subject to that restriction.
 *
 * Auth: requires a valid admin session cookie (same as server actions).
 *
 * Request: multipart/form-data
 *   file      File     Required. Image to upload.
 *   tenantId  string   Required. Tenant scope.
 *   altText   string?  Optional alt text.
 *
 * Response: application/json
 *   { ok: true,  asset: TenantAsset }   on success
 *   { ok: false, error: string }        on validation / auth error
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }               from "@supabase/supabase-js";
import {
  getRequiredAdminSession,
  assertTenantAccess,
}                                     from "@/lib/admin-auth/authorization";
import {
  uploadToStorage,
  createAsset,
}                                     from "@/lib/assets/tenant-assets";

const MAX_IMAGE_SIZE = 10  * 1024 * 1024; // 10 MB
const MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200 MB

const ALLOWED_MIMES = new Set([
  // Images
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  // Videos
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",   // .mov
  "video/x-msvideo",  // .avi
  "video/mpeg",
]);

export async function POST(req: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const session = await getRequiredAdminSession();

    // ── Parse multipart body ──────────────────────────────────────────────────
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid multipart body" }, { status: 400 });
    }

    const tenantId = formData.get("tenantId") as string | null;
    if (!tenantId) {
      return NextResponse.json({ ok: false, error: "tenantId is required" }, { status: 400 });
    }

    await assertTenantAccess(session, tenantId);

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });
    }

    const isVideo  = file.type.startsWith("video/");
    const maxBytes = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    const maxLabel = isVideo ? "200 MB" : "10 MB";
    if (file.size > maxBytes) {
      return NextResponse.json(
        {
          ok: false,
          error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${maxLabel}.`,
        },
        { status: 413 },
      );
    }

    if (!ALLOWED_MIMES.has(file.type)) {
      return NextResponse.json(
        {
          ok: false,
          error: `File type "${file.type}" is not allowed. Accepted: JPEG, PNG, WebP, GIF, SVG.`,
        },
        { status: 415 },
      );
    }

    const altText = (formData.get("altText") as string | null)?.trim() || undefined;
    const bytes   = await file.arrayBuffer();

    // ── Upload to storage + insert metadata ───────────────────────────────────
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
      fileName:       file.name,
      fileSize:       file.size,
      mimeType:       file.type,
      assetType:      file.type.startsWith("video/") ? "video" : "image",
      title:          file.name,
      altText,
      tags:           [],
      uploadedBy:     session.email ?? "admin",
      storageBackend,
      providerBucket,
    });

    return NextResponse.json({ ok: true, asset });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
