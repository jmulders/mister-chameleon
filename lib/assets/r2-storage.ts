/**
 * Cloudflare R2 Storage — asset upload and deletion
 *
 * Uses the AWS S3-compatible API supported by Cloudflare R2.
 * R2 has zero egress fees for objects served via Cloudflare's global network,
 * making it ideal for tenant asset delivery at scale without bandwidth costs.
 *
 * ─── Bucket layout ───────────────────────────────────────────────────────────
 *
 *   {tenantId}/{uuid}.{ext}
 *
 *   Same key pattern as the previous Supabase Storage backend so existing
 *   storage_path values in tenant_assets are portable without a data migration.
 *
 * ─── Configuration ────────────────────────────────────────────────────────────
 *
 *   Credentials are resolved in priority order:
 *
 *   1. Explicit R2Config passed as argument to uploadToR2 / deleteFromR2
 *      (used by storage-adapter.ts when credentials come from the admin UI / DB)
 *   2. serverEnv.r2 — env vars:
 *      R2_ACCOUNT_ID        — Cloudflare account ID (found in dashboard sidebar)
 *      R2_ACCESS_KEY_ID     — R2 API token Access Key ID
 *      R2_SECRET_ACCESS_KEY — R2 API token Secret Access Key
 *      R2_BUCKET_NAME       — Bucket name (e.g. "mister-chameleon-assets")
 *      R2_PUBLIC_URL        — Public bucket base URL
 *                             e.g. https://pub-xxxxxxxx.r2.dev  (built-in)
 *                             or   https://assets.yourdomain.com (custom)
 *
 * ─── Serving assets ──────────────────────────────────────────────────────────
 *
 *   When the bucket has public access enabled, objects are served at:
 *     {R2_PUBLIC_URL}/{key}
 *
 *   For custom domains: add a Cloudflare Worker or R2 custom domain route
 *   pointing to this bucket, then set R2_PUBLIC_URL to your domain.
 *
 * ─── Server-only ─────────────────────────────────────────────────────────────
 *
 *   This module uses serverEnv which is marked "server-only".  Do NOT import
 *   in Client Components.
 */

// Server-only guard — prevents Turbopack from including this module in the
// client bundle (which has no externals for @aws-sdk/client-s3).
import "server-only";

import { serverEnv } from "@/lib/env";

// ── Config type ────────────────────────────────────────────────────────────────

/**
 * Fully-resolved R2 credentials + bucket config.
 * When passed explicitly (by storage-adapter.ts), overrides env vars completely.
 */
export interface R2Config {
  accountId:        string;
  accessKeyId:      string;
  secretAccessKey:  string;
  bucketName:       string;
  publicUrl:        string;
}

// ── Client factory ────────────────────────────────────────────────────────────
//
// We do NOT cache across calls when explicit config is provided — credentials
// may differ between requests (e.g. different DB configs in tests).
// The env-var-based singleton path caches as before for the common case.
//
// @aws-sdk/client-s3 is declared in package.json and listed in
// next.config.mjs serverExternalPackages so it is never bundled by
// Turbopack/Webpack.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _envClient: any | null = null;

async function getR2Client(config?: R2Config) {
  // When explicit config is provided, always build a fresh client.
  if (config) {
    const { S3Client } = await import("@aws-sdk/client-s3");
    return new S3Client({
      region:      "auto",
      endpoint:    `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId:     config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  // No explicit config — fall back to env vars, caching the client.
  if (_envClient) return _envClient;

  const { S3Client } = await import("@aws-sdk/client-s3");
  const { accountId, accessKeyId, secretAccessKey } = serverEnv.r2;

  _envClient = new S3Client({
    region:      "auto",
    endpoint:    `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  return _envClient;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Resolve the effective R2 config, merging explicit override with env fallback.
 * Throws a clear error if required fields are missing.
 */
function resolveConfig(override?: Partial<R2Config>): R2Config {
  const env = serverEnv.r2;

  const accountId        = override?.accountId        || env.accountId;
  const accessKeyId      = override?.accessKeyId      || env.accessKeyId;
  const secretAccessKey  = override?.secretAccessKey  || env.secretAccessKey;
  const bucketName       = override?.bucketName       || env.bucketName;
  const publicUrl        = override?.publicUrl        || env.publicUrl;

  if (!accountId) {
    throw new Error(
      "[r2-storage] R2 account ID is not configured. " +
      "Set R2_ACCOUNT_ID or save credentials via Admin → Platform → Storage.",
    );
  }
  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "[r2-storage] R2 access key credentials are not configured. " +
      "Set R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY or save credentials via Admin → Platform → Storage.",
    );
  }
  if (!bucketName) {
    throw new Error(
      "[r2-storage] R2 bucket name is not configured. " +
      "Set R2_BUCKET_NAME or save credentials via Admin → Platform → Storage.",
    );
  }
  if (!publicUrl) {
    throw new Error(
      "[r2-storage] R2 public URL is not configured. " +
      "Set R2_PUBLIC_URL or save credentials via Admin → Platform → Storage.",
    );
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface R2UploadInput {
  /** Tenant ID — used as the first path segment of the object key. */
  tenantId: string;
  /** Original filename, used to infer the file extension. */
  fileName: string;
  /** IANA MIME type, e.g. "image/webp". */
  mimeType: string;
  /** Raw file bytes. */
  bytes:    ArrayBuffer;
  /**
   * Optional explicit R2 config.  When provided, overrides env vars.
   * Used by storage-adapter.ts to pass DB-stored credentials.
   */
  config?:  Partial<R2Config>;
}

export interface R2UploadResult {
  /**
   * R2 object key — stored as `storage_path` in tenant_assets.
   * Format: `{tenantId}/{uuid}.{ext}`
   */
  key:       string;
  /** Publicly accessible URL for the asset. */
  publicUrl: string;
}

// ── Upload ─────────────────────────────────────────────────────────────────────

/**
 * Upload a file to Cloudflare R2 and return its object key + public URL.
 *
 * When `input.config` is provided, those credentials take priority over env vars.
 * This allows the storage-adapter.ts R2 adapter to use DB-stored credentials.
 *
 * The object key uses a UUID to ensure uniqueness and make URL guessing
 * impractical. CacheControl is set to 1 year + immutable because the key
 * contains the UUID — any replacement is always a new key, never an update.
 */
export async function uploadToR2(input: R2UploadInput): Promise<R2UploadResult> {
  const cfg    = resolveConfig(input.config);
  const client = await getR2Client(input.config ? cfg : undefined);

  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const ext = input.fileName.split(".").pop()?.toLowerCase() ?? "bin";
  const key = `${input.tenantId}/${crypto.randomUUID()}.${ext}`;

  await client.send(
    new PutObjectCommand({
      Bucket:       cfg.bucketName,
      Key:          key,
      Body:         Buffer.from(input.bytes),
      ContentType:  input.mimeType,
      // Content-addressed by UUID — safe to cache forever
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  const publicUrl = `${cfg.publicUrl.replace(/\/$/, "")}/${key}`;
  return { key, publicUrl };
}

// ── Delete ─────────────────────────────────────────────────────────────────────

/**
 * Delete an object from R2 by its object key.
 *
 * When `config` is provided, those credentials take priority over env vars.
 *
 * R2 returns 204 No Content even when the key does not exist (same as AWS S3),
 * so this is safe to call without a prior existence check.
 */
export async function deleteFromR2(key: string, config?: Partial<R2Config>): Promise<void> {
  // If neither env nor override provides credentials, skip silently.
  const env = serverEnv.r2;
  if (!config && !env.isConfigured) {
    console.warn("[r2-storage] deleteFromR2 called but R2 is not configured — skipping.");
    return;
  }

  const cfg    = resolveConfig(config);
  const client = await getR2Client(config ? cfg : undefined);

  const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  await client.send(
    new DeleteObjectCommand({
      Bucket: cfg.bucketName,
      Key:    key,
    }),
  );
}
