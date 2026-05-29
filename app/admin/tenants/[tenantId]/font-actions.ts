"use server";

/**
 * Custom Font Upload & Management — Server Actions
 *
 * Handles uploading, replacing, and removing custom font files for a tenant's
 * typography configuration.  Font files are stored in the `tenant-fonts`
 * Supabase Storage bucket and referenced by public URL from the tenant's
 * `design.customFonts` settings object.
 *
 * ─── Storage path convention ─────────────────────────────────────────────────
 *
 *   {tenantId}/{role}/{weight}.{ext}
 *   e.g. "workengine/sans/regular.woff2"
 *        "workengine/sans/bold.woff2"
 *        "workengine/serif/regular.woff"
 *
 * ─── Security ────────────────────────────────────────────────────────────────
 *
 *   The `tenant-fonts` bucket is public (read-only for browsers, write via
 *   service-role key only).  Files are served directly from Supabase CDN.
 *   Only the service-role key (used here via getDb()) can upload or delete.
 */

import { getDb }                          from "@/data/db";
import { getTenantById, saveTenant }      from "@/tenant/tenant-store";
import type { CustomFontFace, TenantCustomFonts, TenantSettings } from "@/tenant/types";
import type { FontRole, CustomFontWeight }                        from "./types";

// ── Constants ─────────────────────────────────────────────────────────────────

const FONT_BUCKET          = "tenant-fonts";
const ALLOWED_MIME_TYPES   = new Set(["font/woff2", "font/woff", "application/font-woff", "application/font-woff2", "application/octet-stream"]);
const ALLOWED_EXTENSIONS   = new Set([".woff2", ".woff"]);
const MAX_FILE_SIZE_BYTES  = 5 * 1024 * 1024; // 5 MB

// Weight → URL field name mapping
const WEIGHT_URL_KEY: Record<CustomFontWeight, keyof CustomFontFace> = {
  regular: "regularUrl",
  medium:  "mediumUrl",
  bold:    "boldUrl",
  italic:  "italicUrl",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

function storagePath(tenantId: string, role: FontRole, weight: CustomFontWeight, ext: string): string {
  return `${tenantId}/${role}/${weight}${ext}`;
}

// ── Action result types ────────────────────────────────────────────────────────

export type FontActionResult<T = void> =
  | { ok: true;  data: T }
  | { ok: false; error: string };

// ── uploadCustomFontAction ────────────────────────────────────────────────────

/**
 * Upload a custom font file (woff2 or woff) for a tenant font role + weight.
 *
 * Validates the file type and size, uploads to Supabase Storage, then updates
 * the tenant's `design.customFonts.{role}.{weight}Url` with the public URL.
 *
 * @param tenantId  The tenant slug, e.g. "workengine".
 * @param role      Font role: "sans" | "serif" | "mono".
 * @param weight    Font weight variant: "regular" | "medium" | "bold" | "italic".
 * @param formData  FormData containing the file under the key "file", and the
 *                  custom font name under the key "name".
 */
export async function uploadCustomFontAction(
  tenantId: string,
  role:     FontRole,
  weight:   CustomFontWeight,
  formData: FormData,
): Promise<FontActionResult<{ url: string }>> {
  // ── Validate inputs ───────────────────────────────────────────────────────
  const file = formData.get("file");
  const name = (formData.get("name") as string | null)?.trim() ?? "";

  if (!(file instanceof File)) {
    return { ok: false, error: "No file provided." };
  }
  if (!name) {
    return { ok: false, error: "Custom font name is required." };
  }

  const ext = extensionOf(file.name);
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { ok: false, error: `Unsupported file type: ${ext || "(none)"}. Only .woff2 and .woff files are accepted.` };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 5 MB.` };
  }

  // ── Load current tenant settings ─────────────────────────────────────────
  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    return { ok: false, error: `Tenant "${tenantId}" not found.` };
  }

  // ── Upload to Supabase Storage ────────────────────────────────────────────
  const db           = getDb();
  const path         = storagePath(tenantId, role, weight, ext);
  const fileBuffer   = await file.arrayBuffer();

  const { error: uploadError } = await db.storage
    .from(FONT_BUCKET)
    .upload(path, fileBuffer, {
      contentType:    file.type || (ext === ".woff2" ? "font/woff2" : "font/woff"),
      upsert:         true, // overwrite if re-uploading same weight
    });

  if (uploadError) {
    return { ok: false, error: `Upload failed: ${uploadError.message}` };
  }

  // ── Get public URL ────────────────────────────────────────────────────────
  const { data: urlData } = db.storage
    .from(FONT_BUCKET)
    .getPublicUrl(path);

  const publicUrl = urlData.publicUrl;

  // ── Merge into tenant settings ────────────────────────────────────────────
  const existingCustomFonts: TenantCustomFonts = (tenant.design?.customFonts ?? {}) as TenantCustomFonts;
  const existingFace: Partial<CustomFontFace>  = (existingCustomFonts[role] ?? {}) as Partial<CustomFontFace>;

  const urlKey = WEIGHT_URL_KEY[weight];
  const updatedFace: CustomFontFace = {
    name,
    regularUrl:  existingFace.regularUrl ?? "",
    ...(existingFace.mediumUrl  ? { mediumUrl:  existingFace.mediumUrl  } : {}),
    ...(existingFace.boldUrl    ? { boldUrl:    existingFace.boldUrl    } : {}),
    ...(existingFace.italicUrl  ? { italicUrl:  existingFace.italicUrl  } : {}),
    [urlKey]: publicUrl,
  };

  const updatedCustomFonts: TenantCustomFonts = {
    ...existingCustomFonts,
    [role]: updatedFace,
  };

  // Deep-merge: update design.customFonts only
  const updatedSettings = {
    ...tenant,
    design: {
      ...tenant.design,
      customFonts: updatedCustomFonts,
    },
  };

  await saveTenant(updatedSettings as TenantSettings);

  return { ok: true, data: { url: publicUrl } };
}

// ── removeCustomFontWeightAction ──────────────────────────────────────────────

/**
 * Remove a single weight variant from a tenant's custom font configuration.
 *
 * Deletes the file from Supabase Storage and clears the URL from the config.
 * If this was the last URL for the role, the entire role entry is removed.
 *
 * @param tenantId  The tenant slug.
 * @param role      Font role: "sans" | "serif" | "mono".
 * @param weight    Weight variant to remove: "regular" | "medium" | "bold" | "italic".
 */
export async function removeCustomFontWeightAction(
  tenantId: string,
  role:     FontRole,
  weight:   CustomFontWeight,
): Promise<FontActionResult> {
  const tenant = await getTenantById(tenantId);
  if (!tenant) return { ok: false, error: `Tenant "${tenantId}" not found.` };

  const existingCustomFonts = (tenant.design?.customFonts ?? {}) as TenantCustomFonts;
  const existingFace        = (existingCustomFonts[role] ?? null) as CustomFontFace | null;
  if (!existingFace) return { ok: true, data: undefined };

  // Try to delete from storage (best-effort — don't fail if file is gone)
  // We don't know the extension at this point, so try both woff2 and woff.
  const db = getDb();
  await Promise.allSettled([
    db.storage.from(FONT_BUCKET).remove([storagePath(tenantId, role, weight, ".woff2")]),
    db.storage.from(FONT_BUCKET).remove([storagePath(tenantId, role, weight, ".woff")]),
  ]);

  // Build updated face without the removed weight URL
  const updatedFace: Partial<CustomFontFace> = { ...existingFace };
  const urlKey = WEIGHT_URL_KEY[weight];
  delete (updatedFace as Record<string, unknown>)[urlKey];

  // If no URLs remain (only name left), drop the whole role entry
  const hasAnyUrl = ["regularUrl", "mediumUrl", "boldUrl", "italicUrl"].some(
    (k) => !!(updatedFace as Record<string, unknown>)[k],
  );

  const updatedCustomFonts: TenantCustomFonts = { ...existingCustomFonts };
  if (hasAnyUrl) {
    (updatedCustomFonts as Record<string, unknown>)[role] = updatedFace;
  } else {
    delete (updatedCustomFonts as Record<string, unknown>)[role];
  }

  const updatedSettings = {
    ...tenant,
    design: {
      ...tenant.design,
      customFonts: Object.keys(updatedCustomFonts).length > 0 ? updatedCustomFonts : undefined,
    },
  };

  await saveTenant(updatedSettings as TenantSettings);
  return { ok: true, data: undefined };
}

// ── updateCustomFontNameAction ────────────────────────────────────────────────

/**
 * Update the CSS font-family name for an existing custom font configuration
 * without re-uploading the files.
 *
 * @param tenantId  The tenant slug.
 * @param role      Font role: "sans" | "serif" | "mono".
 * @param name      New CSS font-family name, e.g. "Brandica".
 */
export async function updateCustomFontNameAction(
  tenantId: string,
  role:     FontRole,
  name:     string,
): Promise<FontActionResult> {
  const trimmedName = name.trim();
  if (!trimmedName) return { ok: false, error: "Font name must not be empty." };

  const tenant = await getTenantById(tenantId);
  if (!tenant) return { ok: false, error: `Tenant "${tenantId}" not found.` };

  const existingCustomFonts = (tenant.design?.customFonts ?? {}) as TenantCustomFonts;
  const existingFace        = existingCustomFonts[role] as CustomFontFace | undefined;
  if (!existingFace) return { ok: false, error: `No custom font configured for role "${role}".` };

  const updatedCustomFonts: TenantCustomFonts = {
    ...existingCustomFonts,
    [role]: { ...existingFace, name: trimmedName },
  };

  const updatedSettings = {
    ...tenant,
    design: {
      ...tenant.design,
      customFonts: updatedCustomFonts,
    },
  };

  await saveTenant(updatedSettings as TenantSettings);
  return { ok: true, data: undefined };
}
