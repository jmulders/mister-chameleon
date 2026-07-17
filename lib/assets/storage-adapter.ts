/**
 * Storage Adapter — unified asset upload/delete/test interface
 *
 * Abstracts three storage backends behind a single interface so the Tenant
 * Asset Library never talks to a provider directly:
 *
 *   sanity_assets    — Sanity REST Asset API (default v1 provider)
 *   supabase_storage — Supabase Storage (built-in, easy v2 option)
 *   cloudflare_r2    — Cloudflare R2 (zero-egress, S3-compatible v3 option)
 *
 * ─── Provider resolution (highest priority first) ─────────────────────────────
 *
 *   1. platform_settings.storage.activeProvider  (set via admin UI)
 *   2. R2_ACCOUNT_ID env var present → "cloudflare_r2"
 *   3. Sanity configured (SANITY_PROJECT_ID or platform_settings.sanity) → "sanity_assets"
 *   4. "supabase_storage" — always available as last resort
 *
 * ─── Server-only ──────────────────────────────────────────────────────────────
 *
 *   This module uses server-only imports and must never be bundled into
 *   client components.
 */

import "server-only";

import { serverEnv }                   from "@/lib/env";
import {
  getPlatformStorageSettings,
  getPlatformSanitySettings,
}                                      from "@/platform/platform-store";
import { createClient }                from "@supabase/supabase-js";
// NOTE: r2-storage is intentionally NOT statically imported here.
// It is loaded dynamically inside buildR2Adapter() so that
// @aws-sdk/client-s3 is never required at build time when R2 is unused.

// ── Types ─────────────────────────────────────────────────────────────────────

export type StorageProviderType = "sanity_assets" | "supabase_storage" | "cloudflare_r2";

export interface UploadInput {
  tenantId:  string;
  fileName:  string;
  mimeType:  string;
  bytes:     ArrayBuffer;
  /** Optional label for error messages. */
  label?:    string;
}

export interface UploadResult {
  /** Object key / storage path within the provider. For Sanity this is the asset _id. */
  storagePath:    string;
  /** Canonical public delivery URL. */
  publicUrl:      string;
  /** Which provider stored this asset. Written to tenant_assets.storage_backend. */
  storageBackend: StorageProviderType;
  /** Bucket/dataset within the provider. Written to tenant_assets.provider_bucket. */
  providerBucket: string;
}

export interface TestResult {
  ok:      boolean;
  message: string;
}

/**
 * Result of a full integration test (upload → read → delete).
 *
 * Success shape:
 *   { ok: true,  provider, upload: true, read: true|false, delete: true }
 *
 * Failure shape:
 *   { ok: false, provider, step: "config"|"upload"|"read"|"delete", message }
 */
export type IntegrationTestResult =
  | {
      ok:       true;
      provider: StorageProviderType;
      upload:   boolean;
      read:     boolean;
      delete:   boolean;
    }
  | {
      ok:       false;
      provider: StorageProviderType;
      step:     "config" | "upload" | "read" | "delete";
      message:  string;
    };

/** Unified storage provider interface. */
export interface StorageAdapter {
  readonly provider: StorageProviderType;
  /** Upload a file and return metadata needed to create a tenant_assets row. */
  upload(input: UploadInput): Promise<UploadResult>;
  /** Delete a previously uploaded asset by its storage path. */
  delete(storagePath: string, providerBucket?: string): Promise<void>;
  /** Lightweight check: verify credentials and bucket/dataset reachability. */
  testConnection(): Promise<TestResult>;
  /**
   * Full integration test: upload a tiny test file, read it back, then delete it.
   * Proves write + read + delete access end-to-end without side effects.
   */
  runIntegrationTest(): Promise<IntegrationTestResult>;
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Returns the active storage adapter, resolving the provider according to the
 * priority order documented at the top of this module.
 *
 * Throws if no provider can be resolved — callers should surface a clear
 * "configure a storage provider" message rather than a raw error.
 */
export async function getActiveStorageAdapter(): Promise<StorageAdapter> {
  // 1. Read DB config.
  const storageResult = await getPlatformStorageSettings();
  const storageCfg    = storageResult.ok ? storageResult.data : {};

  const activeProvider = storageCfg.activeProvider ?? null;

  // 2. Resolve provider type.
  let providerType: StorageProviderType;

  if (activeProvider === "cloudflare_r2") {
    providerType = "cloudflare_r2";
  } else if (activeProvider === "supabase_storage") {
    providerType = "supabase_storage";
  } else if (activeProvider === "sanity_assets") {
    providerType = "sanity_assets";
  } else {
    // Auto-detect: R2 env vars → Sanity → Supabase.
    if (serverEnv.r2.isConfigured) {
      providerType = "cloudflare_r2";
    } else {
      // Check if Sanity is configured (env or platform_settings).
      const sanityEnv = serverEnv.sanity;
      const sanityResult = await getPlatformSanitySettings();
      const sanityDb = sanityResult.ok ? sanityResult.data : {};

      const sanityProjectId =
        (sanityEnv.isConfigured ? sanityEnv.projectId : undefined) ??
        sanityDb.projectId;

      providerType = sanityProjectId ? "sanity_assets" : "supabase_storage";
    }
  }

  // 3. Build and return the adapter.
  switch (providerType) {
    case "cloudflare_r2":
      return buildR2Adapter(storageCfg.cloudflareR2);

    case "supabase_storage":
      return buildSupabaseAdapter(storageCfg.supabaseStorage);

    case "sanity_assets":
      return buildSanityAdapter();
  }
}

// ── Cloudflare R2 adapter ─────────────────────────────────────────────────────
//
// r2-storage (and therefore @aws-sdk/client-s3) is loaded ONLY when this
// adapter is actually used.  The static import at the top of this file was
// intentionally removed so that builds succeed when the package is absent.

function buildR2Adapter(
  dbCfg?: {
    accountId?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    bucketName?: string;
    publicUrl?: string;
  },
): StorageAdapter {
  // DB config takes priority over env vars.
  const envR2       = serverEnv.r2;
  const accountId   = dbCfg?.accountId       || envR2.accountId;
  const bucketName  = dbCfg?.bucketName      || envR2.bucketName;

  /** Lazily loads r2-storage — throws a clear message if the package is absent. */
  async function loadR2() {
    try {
      return await import("./r2-storage");
    } catch {
      throw new Error(
        "[storage-adapter] Cloudflare R2 is selected as the storage provider but " +
        "@aws-sdk/client-s3 is not installed. Run `npm install @aws-sdk/client-s3` " +
        "in your project root, or switch to a different provider in Admin → Platform → Storage.",
      );
    }
  }

  return {
    provider: "cloudflare_r2",

    async upload(input: UploadInput): Promise<UploadResult> {
      const { uploadToR2 } = await loadR2();

      // Pass the resolved DB config so uploadToR2 uses the correct credentials.
      // env-var fallback still applies inside resolveConfig() when fields are absent.
      const { key, publicUrl: assetUrl } = await uploadToR2({
        tenantId: input.tenantId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        bytes:    input.bytes,
        config: {
          accountId:       dbCfg?.accountId       || undefined,
          accessKeyId:     dbCfg?.accessKeyId     || undefined,
          secretAccessKey: dbCfg?.secretAccessKey || undefined,
          bucketName:      dbCfg?.bucketName      || undefined,
          publicUrl:       dbCfg?.publicUrl        || undefined,
        },
      });

      return {
        storagePath:    key,
        publicUrl:      assetUrl,
        storageBackend: "cloudflare_r2",
        providerBucket: bucketName,
      };
    },

    async delete(storagePath: string): Promise<void> {
      const { deleteFromR2 } = await loadR2();
      // Pass DB config override so deleteFromR2 uses the correct credentials.
      await deleteFromR2(storagePath, {
        accountId:       dbCfg?.accountId       || undefined,
        accessKeyId:     dbCfg?.accessKeyId     || undefined,
        secretAccessKey: dbCfg?.secretAccessKey || undefined,
        bucketName:      dbCfg?.bucketName      || undefined,
        publicUrl:       dbCfg?.publicUrl        || undefined,
      });
    },

    async testConnection(): Promise<TestResult> {
      try {
        if (!accountId || !bucketName) {
          return { ok: false, message: "R2 account ID or bucket name is not configured." };
        }

        const accessKeyId     = dbCfg?.accessKeyId     || envR2.accessKeyId;
        const secretAccessKey = dbCfg?.secretAccessKey || envR2.secretAccessKey;

        if (!accessKeyId || !secretAccessKey) {
          return { ok: false, message: "R2 access key credentials are not configured." };
        }

        // Dynamic import — resolved to the real SDK when installed, or to the
        // build-time stub (lib/assets/stubs/aws-sdk-client-s3.js) via the
        // next.config.mjs webpack/turbopack alias when not installed.
        // The stub's constructor throws a clear installation error at runtime.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let S3Client: any, HeadBucketCommand: any;
        try {
          ({ S3Client, HeadBucketCommand } = await import("@aws-sdk/client-s3"));
        } catch {
          return {
            ok:      false,
            message: "Cloudflare R2 dependency missing — run `npm install @aws-sdk/client-s3`, then clear .next/ and rebuild.",
          };
        }

        const client = new S3Client({
          region:   "auto",
          endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
          credentials: { accessKeyId, secretAccessKey },
        });

        await client.send(new HeadBucketCommand({ Bucket: bucketName }));
        return { ok: true, message: `Connected to R2 bucket "${bucketName}" successfully.` };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, message: `R2 connection failed: ${msg}` };
      }
    },

    async runIntegrationTest(): Promise<IntegrationTestResult> {
      if (!accountId || !bucketName) {
        return { ok: false, provider: "cloudflare_r2", step: "config", message: "R2 account ID or bucket name is not configured." };
      }

      const accessKeyId     = dbCfg?.accessKeyId     || envR2.accessKeyId;
      const secretAccessKey = dbCfg?.secretAccessKey || envR2.secretAccessKey;

      if (!accessKeyId || !secretAccessKey) {
        return { ok: false, provider: "cloudflare_r2", step: "config", message: "R2 access key credentials are not configured." };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let S3Client: any, PutObjectCommand: any, GetObjectCommand: any, DeleteObjectCommand: any;
      try {
        ({ S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = await import("@aws-sdk/client-s3"));
      } catch {
        return {
          ok: false, provider: "cloudflare_r2", step: "config",
          message: "Cloudflare R2 dependency missing — run `npm install @aws-sdk/client-s3`.",
        };
      }

      const client = new S3Client({
        region:      "auto",
        endpoint:    `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      });

      const testKey = `_integration-test/test-file-${Date.now()}.txt`;
      let uploaded  = false;
      let read      = false;

      try {
        // 1. Upload
        await client.send(new PutObjectCommand({
          Bucket:      bucketName,
          Key:         testKey,
          Body:        Buffer.from("test"),
          ContentType: "text/plain",
        }));
        uploaded = true;

        // 2. Read back (optional — R2 is eventually consistent but usually immediate)
        try {
          await client.send(new GetObjectCommand({ Bucket: bucketName, Key: testKey }));
          read = true;
        } catch {
          // Non-fatal — read is best-effort
        }

        // 3. Delete
        await client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: testKey }));

        return { ok: true, provider: "cloudflare_r2", upload: true, read, delete: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);

        // Best-effort cleanup
        if (uploaded) {
          try { await client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: testKey })); } catch { /* ignore */ }
        }

        return {
          ok:       false,
          provider: "cloudflare_r2",
          step:     uploaded ? "read" : "upload",
          message:  msg,
        };
      }
    },
  };
}

// ── Supabase Storage adapter ──────────────────────────────────────────────────

function buildSupabaseAdapter(
  dbCfg?: { bucketName?: string; isPublic?: boolean },
): StorageAdapter {
  const bucketName = dbCfg?.bucketName ?? "tenant-assets";

  function getClient() {
    const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
    const serviceKey  = process.env["SUPABASE_SERVICE_ROLE_KEY"];

    if (!supabaseUrl || !serviceKey) {
      throw new Error(
        "[storage-adapter] Supabase credentials not found. " +
        "Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.",
      );
    }

    return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  }

  return {
    provider: "supabase_storage",

    async upload(input: UploadInput): Promise<UploadResult> {
      const client = getClient();
      const ext    = input.fileName.split(".").pop()?.toLowerCase() ?? "bin";
      const key    = `${input.tenantId}/${crypto.randomUUID()}.${ext}`;

      const doUpload = () =>
        client.storage
          .from(bucketName)
          .upload(key, Buffer.from(input.bytes), {
            contentType:  input.mimeType,
            cacheControl: "public, max-age=31536000, immutable",
            upsert:       false,
          });

      let { error } = await doUpload();

      // Supabase buckets may be configured with an image-only MIME type allow-list.
      // When a video (or any non-image) upload is rejected for that reason, lift the
      // restriction by clearing allowedMimeTypes (our API route already validates
      // types before this point) and retry once.
      if (error && /mime type.*not supported/i.test(error.message)) {
        // updateBucket requires `public` — it is a full update, not a patch. The
        // call omitted it, so TypeScript rejected the argument (the build ignored
        // that). Hardcoding `public: true` would silently expose any bucket that
        // happens to be private when this fallback fires, so read the bucket's
        // current visibility and hand it straight back.
        const { data: bucketInfo } = await client.storage.getBucket(bucketName);

        const { error: updateError } = await client.storage.updateBucket(bucketName, {
          public:           bucketInfo?.public ?? true,
          // Empty = no MIME restriction. Route-level validation has already checked
          // the type before this point.
          allowedMimeTypes: [],
        });
        if (updateError) {
          throw new Error(
            `Supabase Storage upload failed: ${error.message}. ` +
            `Also could not update bucket MIME-type config: ${updateError.message}. ` +
            `Go to Supabase → Storage → ${bucketName} → Edit and clear the allowed MIME types list.`,
          );
        }
        // Retry with the relaxed bucket config.
        ({ error } = await doUpload());
      }

      if (error) {
        throw new Error(`Supabase Storage upload failed: ${error.message}`);
      }

      const { data: urlData } = client.storage
        .from(bucketName)
        .getPublicUrl(key);

      return {
        storagePath:    key,
        publicUrl:      urlData.publicUrl,
        storageBackend: "supabase_storage",
        providerBucket: bucketName,
      };
    },

    async delete(storagePath: string): Promise<void> {
      const client = getClient();
      const { error } = await client.storage
        .from(bucketName)
        .remove([storagePath]);

      if (error) {
        throw new Error(`Supabase Storage delete failed: ${error.message}`);
      }
    },

    async testConnection(): Promise<TestResult> {
      try {
        const client = getClient();
        // list() with limit: 1 tests both auth and bucket access.
        const { error } = await client.storage
          .from(bucketName)
          .list("", { limit: 1 });

        if (error) {
          return { ok: false, message: `Bucket "${bucketName}" not accessible: ${error.message}` };
        }

        return { ok: true, message: `Connected to Supabase Storage bucket "${bucketName}" successfully.` };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, message: `Supabase Storage connection failed: ${msg}` };
      }
    },

    async runIntegrationTest(): Promise<IntegrationTestResult> {
      const testKey = `_integration-test/test-file-${Date.now()}.txt`;
      let uploaded  = false;
      let read      = false;

      let client: ReturnType<typeof getClient>;
      try {
        client = getClient();
      } catch (err) {
        return {
          ok: false, provider: "supabase_storage", step: "config",
          message: err instanceof Error ? err.message : String(err),
        };
      }

      try {
        // 1. Upload
        const { error: uploadError } = await client.storage
          .from(bucketName)
          .upload(testKey, Buffer.from("test"), {
            contentType: "text/plain",
            upsert:      true,
          });
        if (uploadError) throw new Error(uploadError.message);
        uploaded = true;

        // 2. Read back
        try {
          const { error: downloadError } = await client.storage
            .from(bucketName)
            .download(testKey);
          read = !downloadError;
        } catch {
          // Non-fatal
        }

        // 3. Delete
        const { error: deleteError } = await client.storage
          .from(bucketName)
          .remove([testKey]);
        if (deleteError) throw new Error(deleteError.message);

        return { ok: true, provider: "supabase_storage", upload: true, read, delete: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);

        // Best-effort cleanup
        if (uploaded) {
          try { await client.storage.from(bucketName).remove([testKey]); } catch { /* ignore */ }
        }

        return {
          ok:       false,
          provider: "supabase_storage",
          step:     uploaded ? "delete" : "upload",
          message:  msg,
        };
      }
    },
  };
}

// ── Sanity Assets adapter ─────────────────────────────────────────────────────

function buildSanityAdapter(): StorageAdapter {
  /**
   * Resolve Sanity credentials from env or platform_settings.
   * We need: projectId, dataset, apiVersion, writeToken.
   */
  function getSanityCredentials(): {
    projectId:  string;
    dataset:    string;
    apiVersion: string;
    writeToken: string;
  } {
    const env = serverEnv.sanity;

    if (!env.isConfigured) {
      throw new Error(
        "[storage-adapter] Sanity is not configured. " +
        "Set SANITY_PROJECT_ID, SANITY_DATASET, SANITY_API_VERSION, and " +
        "SANITY_API_WRITE_TOKEN (or configure Sanity in Admin → Platform → Integrations → CMS).",
      );
    }

    const writeToken =
      process.env["SANITY_API_WRITE_TOKEN"] ??
      process.env["SANITY_API_TOKEN"] ??
      env.readToken;

    if (!writeToken) {
      throw new Error(
        "[storage-adapter] Sanity write token is not configured. " +
        "Set SANITY_API_WRITE_TOKEN in .env.local or in Admin → Platform → Integrations → CMS.",
      );
    }

    return {
      projectId:  env.projectId,
      dataset:    env.dataset,
      apiVersion: env.apiVersion,
      writeToken,
    };
  }

  return {
    provider: "sanity_assets",

    async upload(input: UploadInput): Promise<UploadResult> {
      const { projectId, dataset, apiVersion, writeToken } = getSanityCredentials();

      // Sanity Asset Upload API:
      // POST https://{projectId}.api.sanity.io/v{apiVersion}/assets/images/{dataset}
      // Body: raw image bytes
      // Headers: Content-Type, Authorization, X-Sanity-Label (optional)
      const uploadUrl = `https://${projectId}.api.sanity.io/v${apiVersion}/assets/images/${dataset}`;

      const label = input.label ?? input.fileName;
      const res   = await fetch(uploadUrl, {
        method:  "POST",
        headers: {
          "Content-Type":  input.mimeType,
          "Authorization": `Bearer ${writeToken}`,
          // Tag with tenant + filename for identification in the Sanity Studio media library.
          "X-Sanity-Label": `tenant:${input.tenantId} | ${label}`,
        },
        body: input.bytes,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "(no body)");
        throw new Error(
          `Sanity asset upload failed (HTTP ${res.status}): ${body}`,
        );
      }

      const json = await res.json() as {
        document: {
          _id:      string;
          url:      string;
          metadata: { dimensions?: { width?: number; height?: number } };
        };
      };

      const assetDoc = json.document;
      // Sanity asset _id format: "image-{hash}-{WxH}-{ext}"
      // Public URL is returned directly in the upload response.
      const sanityAssetId = assetDoc._id;
      const publicUrl     = assetDoc.url;

      return {
        storagePath:    sanityAssetId,  // stored as storage_path in tenant_assets
        publicUrl,
        storageBackend: "sanity_assets",
        providerBucket: dataset,
      };
    },

    async delete(storagePath: string, providerBucket?: string): Promise<void> {
      const { projectId, apiVersion, writeToken } = getSanityCredentials();
      const dataset = providerBucket ?? serverEnv.sanity.dataset;

      // Sanity Mutations API: delete asset document by _id.
      const mutateUrl = `https://${projectId}.api.sanity.io/v${apiVersion}/data/mutate/${dataset}`;

      const res = await fetch(mutateUrl, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${writeToken}`,
        },
        body: JSON.stringify({
          mutations: [{ delete: { id: storagePath } }],
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "(no body)");
        throw new Error(
          `Sanity asset delete failed (HTTP ${res.status}): ${body}`,
        );
      }
    },

    async testConnection(): Promise<TestResult> {
      try {
        const { projectId, dataset, apiVersion, writeToken } = getSanityCredentials();

        // Test by fetching the Sanity project info endpoint (lightweight, no data returned).
        const projectUrl = `https://api.sanity.io/v${apiVersion}/projects/${projectId}`;
        const res = await fetch(projectUrl, {
          headers: { "Authorization": `Bearer ${writeToken}` },
        });

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          return { ok: false, message: `Sanity API returned HTTP ${res.status}: ${body.slice(0, 200)}` };
        }

        return {
          ok:      true,
          message: `Connected to Sanity project "${projectId}" / dataset "${dataset}" successfully.`,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, message: `Sanity connection failed: ${msg}` };
      }
    },

    async runIntegrationTest(): Promise<IntegrationTestResult> {
      let credentials: ReturnType<typeof getSanityCredentials>;
      try {
        credentials = getSanityCredentials();
      } catch (err) {
        return {
          ok: false, provider: "sanity_assets", step: "config",
          message: err instanceof Error ? err.message : String(err),
        };
      }

      const { projectId, dataset, apiVersion, writeToken } = credentials;
      // Use a deterministic, recognisable doc ID — easier to clean up if something goes wrong.
      const testDocId  = `_integration-test-${Date.now()}`;
      const mutateUrl  = `https://${projectId}.api.sanity.io/v${apiVersion}/data/mutate/${dataset}`;
      const queryUrl   = `https://${projectId}.api.sanity.io/v${apiVersion}/data/query/${dataset}`;
      const authHeader = { "Authorization": `Bearer ${writeToken}` };

      let created = false;
      let read    = false;

      try {
        // 1. Upload — create a test document via the Mutations API.
        const createRes = await fetch(mutateUrl, {
          method:  "POST",
          headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({
            mutations: [{
              create: {
                _id:        testDocId,
                _type:      "_integrationTest",
                fileName:   `test-file-${Date.now()}.txt`,
                content:    "test",
              },
            }],
          }),
        });

        if (!createRes.ok) {
          const body = await createRes.text().catch(() => "");
          throw new Error(`Sanity create failed (HTTP ${createRes.status}): ${body.slice(0, 200)}`);
        }
        created = true;

        // 2. Read back — query the document by ID.
        try {
          const queryRes = await fetch(
            `${queryUrl}?query=${encodeURIComponent(`*[_id == "${testDocId}"][0]`)}`,
            { headers: authHeader },
          );
          if (queryRes.ok) {
            const json = await queryRes.json() as { result?: unknown };
            read = json.result != null;
          }
        } catch {
          // Non-fatal
        }

        // 3. Delete.
        const deleteRes = await fetch(mutateUrl, {
          method:  "POST",
          headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({
            mutations: [{ delete: { id: testDocId } }],
          }),
        });

        if (!deleteRes.ok) {
          const body = await deleteRes.text().catch(() => "");
          throw new Error(`Sanity delete failed (HTTP ${deleteRes.status}): ${body.slice(0, 200)}`);
        }

        return { ok: true, provider: "sanity_assets", upload: true, read, delete: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);

        // Best-effort cleanup
        if (created) {
          try {
            await fetch(mutateUrl, {
              method:  "POST",
              headers: { ...authHeader, "Content-Type": "application/json" },
              body: JSON.stringify({ mutations: [{ delete: { id: testDocId } }] }),
            });
          } catch { /* ignore */ }
        }

        return {
          ok:       false,
          provider: "sanity_assets",
          step:     created ? "delete" : "upload",
          message:  msg,
        };
      }
    },
  };
}

// ── Tenant-aware adapter (checks per-tenant override first) ──────────────────

/**
 * Returns the active storage adapter for a specific tenant.
 *
 * Resolution order:
 *   1. tenant_settings[tenantId].storage.activeProvider  (per-tenant override)
 *   2. platform_settings.storage.activeProvider          (platform default)
 *   3. Auto-detection from env vars
 *   4. "supabase_storage"                                (last resort)
 *
 * Provider credentials always come from platform_settings — only the
 * active provider selection can be overridden per tenant.
 */
export async function getActiveStorageAdapterForTenant(
  tenantId: string,
): Promise<StorageAdapter> {
  // Lazy import to avoid circular dependency at module load time.
  const { getTenantById } = await import("@/tenant/tenant-store");

  const tenant = await getTenantById(tenantId);
  const tenantProvider = tenant?.storage?.activeProvider ?? null;

  if (
    tenantProvider === "cloudflare_r2" ||
    tenantProvider === "supabase_storage" ||
    tenantProvider === "sanity_assets"
  ) {
    // Tenant overrides the active provider — but still uses platform credentials.
    const storageResult = await getPlatformStorageSettings();
    const storageCfg    = storageResult.ok ? storageResult.data : {};
    return buildAdapterForProvider(tenantProvider, storageCfg);
  }

  // No tenant override: fall back to platform-level selection.
  return getActiveStorageAdapter();
}

// ── Public factory for testing specific providers ──────────────────────────────

/**
 * Build a storage adapter for a specific provider type, using DB config
 * and env-var fallback.  Used by the test-connection admin action.
 */
export async function buildAdapterForProvider(
  provider: StorageProviderType,
  storageCfg: {
    cloudflareR2?:    { accountId?: string; accessKeyId?: string; secretAccessKey?: string; bucketName?: string; publicUrl?: string };
    supabaseStorage?: { bucketName?: string; isPublic?: boolean };
  },
): Promise<StorageAdapter> {
  switch (provider) {
    case "cloudflare_r2":
      return buildR2Adapter(storageCfg.cloudflareR2);
    case "supabase_storage":
      return buildSupabaseAdapter(storageCfg.supabaseStorage);
    case "sanity_assets":
      return buildSanityAdapter();
  }
}
