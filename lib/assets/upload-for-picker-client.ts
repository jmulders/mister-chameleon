/**
 * upload-for-picker-client.ts
 *
 * Client-side upload helper for AssetPickerModal.
 *
 * Calls POST /api/admin/assets/upload instead of a Server Action so that
 * large files (up to 10 MB) are not rejected by the Next.js Server Action
 * body-size gate (which in Turbopack dev mode ignores next.config overrides).
 *
 * The return type is identical to PickerUploadResult so this function is a
 * drop-in replacement for uploadForPickerAction in client components.
 */

import type { PickerUploadResult } from "./upload-for-picker-action";

export async function uploadForPickerClient(
  formData: FormData,
): Promise<PickerUploadResult> {
  let res: Response;
  try {
    res = await fetch("/api/admin/assets/upload", {
      method: "POST",
      body:   formData,
      // Do NOT set Content-Type header — the browser sets it automatically
      // with the correct multipart boundary when body is FormData.
    });
  } catch (err) {
    return {
      ok:    false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, error: `HTTP ${res.status}: ${res.statusText}` };
  }

  return json as PickerUploadResult;
}
