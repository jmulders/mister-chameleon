/**
 * Platform Storage Integration — Server Actions
 *
 * Reads and writes the "storage" row in `platform_settings`.
 * Manages which storage backend handles new tenant asset uploads:
 *
 *   sanity_assets    — Sanity REST Asset API (default; requires Sanity config)
 *   supabase_storage — Supabase Storage (built-in; no extra credentials)
 *   cloudflare_r2    — Cloudflare R2 (zero-egress; requires R2 credentials)
 *
 * ─── Secret handling ──────────────────────────────────────────────────────────
 *
 *   cloudflareR2.secretAccessKey is never returned to the client.
 *   Only a boolean `hasR2SecretAccessKey` flag is exposed.
 *
 * ─── Provider resolution order ───────────────────────────────────────────────
 *
 *   See lib/assets/storage-adapter.ts for the full resolution chain.
 */

"use server";

import { revalidatePath }            from "next/cache";
import {
  getPlatformStorageSettings,
  getPlatformSanitySettings,
  savePlatformStorageSettings,
  storageProviderFlags,
}                                    from "@/platform/platform-store";
import { serverEnv }                 from "@/lib/env";
import { buildAdapterForProvider }   from "@/lib/assets/storage-adapter";

// ── Safe types returned to the client ─────────────────────────────────────────

/**
 * Storage provider config exposed to the client.
 * All secrets are stripped; only boolean flags are included.
 */
export interface SafeStorageConfig {
  /** Currently configured active provider (null = auto-detect). */
  activeProvider:        string | null;
  /** Auto-detected effective provider (what will actually be used). */
  effectiveProvider:     string;

  // Sanity Assets
  /** Whether Sanity is configured (env or platform_settings). */
  sanityConfigured:      boolean;
  sanityProjectId:       string;
  sanityDataset:         string;
  sanityHasWriteToken:   boolean;

  // Supabase Storage
  supabaseBucketName:    string;
  supabaseIsPublic:      boolean;

  // Cloudflare R2 (secrets stripped)
  hasR2AccountId:        boolean;
  hasR2AccessKeyId:      boolean;
  hasR2SecretAccessKey:  boolean;
  hasR2BucketName:       boolean;
  hasR2PublicUrl:        boolean;
  r2AccountId:           string;
  r2AccessKeyId:         string;
  r2BucketName:          string;
  r2PublicUrl:           string;
  r2Configured:          boolean;

  updatedAt:             string | null;
}

// ── Read ───────────────────────────────────────────────────────────────────────

export async function getStorageSettingsAction(): Promise<
  | { ok: true;  config: SafeStorageConfig }
  | { ok: false; error: string }
> {
  const [storageResult, sanityResult] = await Promise.all([
    getPlatformStorageSettings(),
    getPlatformSanitySettings(),
  ]);

  if (!storageResult.ok) {
    return { ok: false, error: storageResult.error };
  }

  const flags = storageProviderFlags(storageResult.data);

  // Resolve sanity config from env + platform_settings.
  const sanityEnv    = serverEnv.sanity;
  const sanityDb     = sanityResult.ok ? sanityResult.data : {};
  const sanityProjectId =
    (sanityEnv.isConfigured ? sanityEnv.projectId : undefined) ??
    sanityDb.projectId ?? "";
  const sanityDataset =
    (sanityEnv.isConfigured ? sanityEnv.dataset : undefined) ??
    sanityDb.dataset ?? "";
  const sanityHasWriteToken =
    Boolean(
      process.env["SANITY_API_WRITE_TOKEN"] ||
      process.env["SANITY_API_TOKEN"]       ||
      sanityEnv.readToken                   ||
      sanityDb.writeToken,
    );
  const sanityConfigured = Boolean(sanityProjectId);

  // Determine effective provider (what getActiveStorageAdapter() would use).
  const activeProvider = storageResult.data.activeProvider ?? null;
  let effectiveProvider: string;

  if (activeProvider === "cloudflare_r2" || activeProvider === "supabase_storage" || activeProvider === "sanity_assets") {
    effectiveProvider = activeProvider;
  } else if (serverEnv.r2.isConfigured) {
    effectiveProvider = "cloudflare_r2";
  } else if (sanityConfigured) {
    effectiveProvider = "sanity_assets";
  } else {
    effectiveProvider = "supabase_storage";
  }

  return {
    ok: true,
    config: {
      activeProvider,
      effectiveProvider,
      sanityConfigured,
      sanityProjectId,
      sanityDataset,
      sanityHasWriteToken,
      supabaseBucketName:    flags.supabaseBucketName,
      supabaseIsPublic:      flags.supabaseIsPublic,
      hasR2AccountId:        flags.hasR2AccountId,
      hasR2AccessKeyId:      flags.hasR2AccessKeyId,
      hasR2SecretAccessKey:  flags.hasR2SecretAccessKey,
      hasR2BucketName:       flags.hasR2BucketName,
      hasR2PublicUrl:        flags.hasR2PublicUrl,
      r2AccountId:           flags.r2AccountId,
      r2AccessKeyId:         flags.r2AccessKeyId,
      r2BucketName:          flags.r2BucketName,
      r2PublicUrl:           flags.r2PublicUrl,
      r2Configured:          flags.r2Configured,
      updatedAt:             storageResult.updatedAt,
    },
  };
}

// ── Write — active provider ────────────────────────────────────────────────────

export async function setActiveProviderAction(
  provider: "cloudflare_r2" | "supabase_storage" | "sanity_assets" | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await savePlatformStorageSettings({ activeProvider: provider });
  if (result.ok) {
    revalidatePath("/admin/platform/integrations/storage");
    revalidatePath("/admin/platform/integrations");
  }
  return result;
}

// ── Write — Cloudflare R2 credentials ─────────────────────────────────────────

export interface SaveR2CredentialsInput {
  accountId?:        string;
  accessKeyId?:      string;
  secretAccessKey?:  string;
  bucketName?:       string;
  publicUrl?:        string;
}

export async function saveR2CredentialsAction(
  input: SaveR2CredentialsInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await savePlatformStorageSettings({
    cloudflareR2: {
      accountId:       input.accountId        ?? undefined,
      accessKeyId:     input.accessKeyId      ?? undefined,
      secretAccessKey: input.secretAccessKey  ?? undefined,
      bucketName:      input.bucketName       ?? undefined,
      publicUrl:       input.publicUrl        ?? undefined,
    },
  });

  if (result.ok) {
    revalidatePath("/admin/platform/integrations/storage");
  }
  return result;
}

// ── Write — Supabase Storage settings ─────────────────────────────────────────

export interface SaveSupabaseStorageInput {
  bucketName?: string;
  isPublic?:   boolean;
}

export async function saveSupabaseStorageAction(
  input: SaveSupabaseStorageInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await savePlatformStorageSettings({
    supabaseStorage: {
      bucketName: input.bucketName ?? undefined,
      isPublic:   input.isPublic   ?? undefined,
    },
  });

  if (result.ok) {
    revalidatePath("/admin/platform/integrations/storage");
  }
  return result;
}

// ── Test connection ────────────────────────────────────────────────────────────

/**
 * Test connectivity for a specific storage provider using stored credentials.
 * Builds a fresh adapter for the given provider type and runs testConnection().
 */
export async function testProviderConnectionAction(
  provider: "cloudflare_r2" | "supabase_storage" | "sanity_assets",
): Promise<{ ok: boolean; message: string }> {
  try {
    const storageResult = await getPlatformStorageSettings();
    const storageCfg    = storageResult.ok ? storageResult.data : {};

    const adapter = await buildAdapterForProvider(provider, storageCfg);
    return await adapter.testConnection();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: msg };
  }
}
