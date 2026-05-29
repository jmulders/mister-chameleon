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
 *   Requires a valid mc_admin_token session cookie (same as all admin API routes).
 *   Returns 401 if unauthenticated, 403 if 2FA not completed.
 */

import { NextRequest, NextResponse }      from "next/server";
import { cookies }                         from "next/headers";
import { verifySession, ADMIN_TOKEN_COOKIE } from "@/lib/admin-auth";
import {
  buildAdapterForProvider,
  type StorageProviderType,
}                                          from "@/lib/assets/storage-adapter";
import { getPlatformStorageSettings }      from "@/platform/platform-store";

// ── Auth guard ─────────────────────────────────────────────────────────────────

async function requireAdminSession(): Promise<
  | { ok: true }
  | { ok: false; status: 401 | 403; message: string }
> {
  const cookieStore = await cookies();
  const token       = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value ?? null;

  if (!token) {
    return { ok: false, status: 401, message: "Not authenticated." };
  }

  const session = await verifySession(token);
  if (!session) {
    return { ok: false, status: 401, message: "Invalid or expired session." };
  }

  if (session.twoFaEnabled && !session.twoFaVerified) {
    return { ok: false, status: 403, message: "2FA verification required." };
  }

  return { ok: true };
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Auth check.
  const auth = await requireAdminSession();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status },
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
