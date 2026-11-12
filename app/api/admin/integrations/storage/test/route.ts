/**
 * POST /api/admin/integrations/storage/test
 *
 * Full integration test for a storage provider: upload a tiny test file,
 * read it back, then delete it.  Proves write + read + delete access
 * end-to-end without leaving any artifacts in the bucket/dataset.
 *
 * ─── Request body ─────────────────────────────────────────────────────────────
 *
 *   { "provider": "cloudflare_r2" | "supabase_storage" | "sanity_assets" }
 *
 * ─── Success response (200) ───────────────────────────────────────────────────
 *
 *   {
 *     "ok":       true,
 *     "provider": "cloudflare_r2",
 *     "upload":   true,
 *     "read":     true,
 *     "delete":   true
 *   }
 *
 * ─── Error response (200 with ok:false, or 4xx) ───────────────────────────────
 *
 *   {
 *     "ok":       false,
 *     "provider": "cloudflare_r2",
 *     "step":     "upload" | "read" | "delete" | "config",
 *     "message":  "S3ServiceException: NoSuchBucket …"
 *   }
 *
 * ─── Auth ─────────────────────────────────────────────────────────────────────
 *
 *   Requires a superadmin session.
 *   Returns 401 if unauthenticated, 403 if 2FA not completed.
 */

import { NextRequest, NextResponse }      from "next/server";
import { guardSuperAdminRoute }            from "@/lib/admin-auth/route-guard";
import {
  buildAdapterForProvider,
  type StorageProviderType,
}                                          from "@/lib/assets/storage-adapter";
import { getPlatformStorageSettings }      from "@/platform/platform-store";

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Auth check: superadmin, this tests the platform's storage credentials.
  const guard = await guardSuperAdminRoute();
  if (!guard.ok) {
    const status = guard.response.status;
    return NextResponse.json(
      { ok: false, message: status === 401 ? "Not authenticated." : "Superadmin only." },
      { status },
    );
  }

  // 2. Parse request body.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const { provider } = (body ?? {}) as Record<string, unknown>;

  const VALID_PROVIDERS: StorageProviderType[] = [
    "cloudflare_r2",
    "supabase_storage",
    "sanity_assets",
  ];

  if (typeof provider !== "string" || !VALID_PROVIDERS.includes(provider as StorageProviderType)) {
    return NextResponse.json(
      {
        ok:      false,
        message: `Invalid provider "${String(provider ?? "")}". ` +
                 `Must be one of: ${VALID_PROVIDERS.join(", ")}.`,
      },
      { status: 400 },
    );
  }

  const providerType = provider as StorageProviderType;

  // 3. Load current platform storage config (needed for R2 credentials etc.).
  const storageResult = await getPlatformStorageSettings();
  const storageCfg    = storageResult.ok ? storageResult.data : {};

  // 4. Build adapter + run full integration test.
  try {
    const adapter = await buildAdapterForProvider(providerType, storageCfg);
    const result  = await adapter.runIntegrationTest();

    // Always return 200 — ok/false is a logical failure, not an HTTP error.
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/admin/integrations/storage/test] Unexpected error:", message);
    return NextResponse.json(
      { ok: false, provider: providerType, step: "config", message },
      { status: 200 },
    );
  }
}
