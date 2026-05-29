/**
 * Platform CMS Settings — Server Actions
 *
 * Four actions for the /admin/platform/cms page:
 *
 *   getCmsPlatformSettingsAction    — read-only; strips secrets; safe to pass to client
 *   saveCmsPlatformSettingsAction   — write; never echoes secrets back
 *   testCmsPlatformConnectionAction — validates connectivity and write access live
 *   seedMarketingSiteAction         — seeds all marketing pages into Sanity (idempotent)
 *
 * ─── Security model ───────────────────────────────────────────────────────────
 *
 *   Only boolean flags and non-secret values (projectId, dataset) cross the
 *   server→client boundary.  The write token is accepted as input but never
 *   returned.  The test action uses the token server-side only and discards it
 *   after the test completes.
 *
 * ─── Test connection design ───────────────────────────────────────────────────
 *
 *   The test resolves effective config by merging form-provided values (which
 *   may include an unsaved token being evaluated before committing) on top of
 *   saved database values, then falling back to env vars.  This allows operators
 *   to test credentials before saving them.
 *
 *   Two checks are performed in sequence:
 *     1. Read check  — a zero-cost GROQ query to confirm connectivity,
 *                      project ID validity, and dataset validity.
 *     2. Write check — creates then immediately deletes a sentinel document
 *                      (`_id: "__platform_connection_test"`) to confirm the
 *                      token has write access.  Skipped if no token is resolved.
 *
 *   The sentinel document is always deleted on success.  On failure the delete
 *   is attempted as a best-effort cleanup; a warning is logged if it fails.
 */

"use server";

import { createClient }               from "@sanity/client";
import { revalidatePath }             from "next/cache";
import { getRequiredAdminSession }    from "@/lib/admin-auth/authorization";
import { allMarketingPages }          from "@/cms/seed/marketing-site-pages";
import { marketingSiteVariants }      from "@/cms/seed/marketing-site-variants";
import {
  getPlatformSanitySettings,
  savePlatformSanitySettings,
  sanityFlags,
  getPlatformStoryblokSettings,
  savePlatformStoryblokSettings,
  storyblokFlags,
  getPlatformStatamicSettings,
  savePlatformStatamicSettings,
  statamicFlags,
} from "@/platform/platform-store";

// ── Shared validation ──────────────────────────────────────────────────────────

const MAX_FIELD_LENGTH = 512;

function trimField(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function validateLength(field: string, value: string): string | null {
  if (value.length > MAX_FIELD_LENGTH) {
    return `${field} must be ${MAX_FIELD_LENGTH} characters or fewer.`;
  }
  return null;
}

// ── Read ───────────────────────────────────────────────────────────────────────

/**
 * Load the current platform Sanity CMS settings, stripped of secrets.
 *
 * Returns:
 *   projectId    — plain string (empty when not set)
 *   dataset      — plain string (empty when not set)
 *   hasWriteToken — boolean; true when a write token is stored
 *   updatedAt    — ISO-8601 last-write timestamp; null when never saved
 */
export async function getCmsPlatformSettingsAction(): Promise<
  | {
      ok:           true;
      projectId:    string;
      dataset:      string;
      hasWriteToken: boolean;
      updatedAt:    string | null;
    }
  | { ok: false; error: string }
> {
  const result = await getPlatformSanitySettings();
  if (!result.ok) return { ok: false, error: result.error };

  const flags = sanityFlags(result.data);

  return {
    ok:            true,
    projectId:     result.data.projectId ?? "",
    dataset:       result.data.dataset   ?? "",
    hasWriteToken: flags.hasWriteToken,
    updatedAt:     result.updatedAt,
  };
}

// ── Write ──────────────────────────────────────────────────────────────────────

/**
 * Save platform Sanity CMS settings.
 *
 * `writeToken` behaviour:
 *   - Provided non-empty string  → stored as new token
 *   - Provided empty string ""   → clears any stored token
 *   - Omitted / undefined        → existing token is left unchanged
 *
 * Non-secret fields (projectId, dataset) are always overwritten with the
 * trimmed value supplied.
 */
export async function saveCmsPlatformSettingsAction(input: {
  projectId:   string;
  dataset:     string;
  writeToken?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const projectId  = trimField(input.projectId);
  const dataset    = trimField(input.dataset);
  const writeToken = input.writeToken !== undefined ? trimField(input.writeToken) : undefined;

  for (const [field, value] of [
    ["Project ID", projectId],
    ["Dataset",   dataset],
  ] as [string, string][]) {
    const err = validateLength(field, value);
    if (err) return { ok: false, error: err };
  }

  if (writeToken !== undefined) {
    const err = validateLength("Write token", writeToken);
    if (err) return { ok: false, error: err };
  }

  const result = await savePlatformSanitySettings({ projectId, dataset, writeToken });
  if (!result.ok) return result;

  revalidatePath("/admin/platform/cms");
  revalidatePath("/admin/platform/integrations/cms");
  return { ok: true };
}

// ── Test connection ────────────────────────────────────────────────────────────

/** Result returned to the client after a connection test. */
export type TestConnectionResult =
  | {
      ok:      true;
      message: string;
      details: {
        project:     string;
        dataset:     string;
        writeAccess: boolean;
      };
    }
  | {
      ok:    false;
      error: string;
      hint?: string;
    };

/**
 * Parses a raw Sanity API error into a human-readable error + optional hint.
 * Never throws — always returns a safe string pair.
 */
function parseSanityError(err: unknown): { error: string; hint?: string } {
  const msg        = err instanceof Error ? err.message : String(err);
  const msgLower   = msg.toLowerCase();
  const statusCode =
    (err as { statusCode?: number }).statusCode ??
    (err as { response?: { statusCode?: number } }).response?.statusCode;

  if (statusCode === 401 || msgLower.includes("unauthorized") || msgLower.includes("unauthenticated")) {
    return {
      error: "Token is invalid or has been revoked.",
      hint:  "Create a new token at sanity.io/manage → Project → API → Tokens.",
    };
  }
  if (statusCode === 403 || msgLower.includes("forbidden") || msgLower.includes("permission")) {
    return {
      error: "Token has insufficient permissions.",
      hint:  "The token needs Editor or Administrator role. Create a new token at sanity.io/manage → API → Tokens.",
    };
  }
  if (msgLower.includes("project") && (msgLower.includes("not found") || msgLower.includes("don't have access") || msgLower.includes("no access"))) {
    return {
      error: "Sanity project not found or not accessible.",
      hint:  "Verify the Project ID at sanity.io/manage.",
    };
  }
  if (msgLower.includes("dataset") && msgLower.includes("not found")) {
    return {
      error: "Dataset not found in this project.",
      hint:  "Check available datasets at sanity.io/manage → Datasets.",
    };
  }
  if (msgLower.includes("getaddrinfo") || msgLower.includes("network") || msgLower.includes("enotfound")) {
    return {
      error: "Network error — could not reach Sanity API.",
      hint:  "Check your internet connection and try again.",
    };
  }
  return { error: msg };
}

/**
 * Test platform Sanity CMS connectivity and write access.
 *
 * Accepts the current form state so operators can test new credentials before
 * saving.  Any field left empty falls back to the saved platform setting, then
 * to environment variables.
 *
 * @param input.projectId   Form value for project ID (may be empty = use saved)
 * @param input.dataset     Form value for dataset (may be empty = use saved)
 * @param input.writeToken  New token to test (absent or empty = use saved token)
 */
export async function testCmsPlatformConnectionAction(input: {
  projectId:   string;
  dataset:     string;
  writeToken?: string;
}): Promise<TestConnectionResult> {
  // ── Step 1: Load saved settings for fallback ───────────────────────────────
  let savedProjectId:  string | undefined;
  let savedDataset:    string | undefined;
  let savedWriteToken: string | undefined;

  try {
    const saved = await getPlatformSanitySettings();
    if (saved.ok) {
      savedProjectId  = saved.data.projectId?.trim()  || undefined;
      savedDataset    = saved.data.dataset?.trim()    || undefined;
      savedWriteToken = saved.data.writeToken?.trim() || undefined;
    }
  } catch {
    // Non-fatal — fall through to env vars.
  }

  // ── Step 2: Resolve effective config ──────────────────────────────────────
  //
  // Form values (non-empty) > saved platform settings > env var fallback
  const projectId =
    trimField(input.projectId) ||
    savedProjectId             ||
    process.env.SANITY_PROJECT_ID;

  const dataset =
    trimField(input.dataset)   ||
    savedDataset               ||
    process.env.SANITY_DATASET ||
    "production";

  // Write token: form value (if non-empty) > saved token > env vars
  const formToken = input.writeToken ? trimField(input.writeToken) : undefined;
  const writeToken =
    (formToken                                       ) ||
    savedWriteToken                                    ||
    process.env.SANITY_API_WRITE_TOKEN?.trim()         ||
    process.env.SANITY_WRITE_TOKEN?.trim();

  if (!projectId) {
    return {
      ok:    false,
      error: "No Project ID configured.",
      hint:  "Set the Project ID above and save, or add SANITY_PROJECT_ID to environment variables.",
    };
  }

  // ── Step 3: Create Sanity client ───────────────────────────────────────────
  //
  // We always create the client even without a token so we can at least test
  // whether the projectId / dataset combination is valid.
  const client = createClient({
    projectId,
    dataset,
    token:      writeToken,
    apiVersion: process.env.SANITY_API_VERSION ?? "2024-01-01",
    useCdn:     false,
  });

  // ── Step 4: Read check ────────────────────────────────────────────────────
  //
  // `count(*[false])` always returns 0 without touching any real documents.
  // It confirms: projectId exists, dataset exists, network is reachable,
  // and the token (if any) is accepted for at least read-level operations.
  try {
    await client.fetch<number>("count(*[false])");
  } catch (err) {
    const { error, hint } = parseSanityError(err);
    return {
      ok:    false,
      error: `Read check failed: ${error}`,
      hint,
    };
  }

  // ── Step 5: Write check (only when a token is available) ──────────────────
  //
  // Creates then immediately deletes a sentinel document.
  // This confirms the token has write access to this project/dataset.
  // Skipped when no token is resolved — the read check result is still useful
  // for validating projectId/dataset correctness before a token is configured.
  if (!writeToken) {
    return {
      ok:      true,
      message: `Connected to project "${projectId}" / dataset "${dataset}". No write token configured — provisioning will not work until a token is set.`,
      details: { project: projectId, dataset, writeAccess: false },
    };
  }

  const sentinelId = "__platform_connection_test";

  try {
    await client.createOrReplace({
      _id:   sentinelId,
      _type: "sanity.connectionTest",
    });
  } catch (err) {
    const { error, hint } = parseSanityError(err);
    return {
      ok:    false,
      error: `Write check failed: ${error}`,
      hint,
    };
  }

  // Always clean up the sentinel, but don't fail the test if cleanup fails.
  try {
    await client.delete(sentinelId);
  } catch (cleanupErr) {
    console.warn(
      `[platform-cms] cleanup of connection test document failed: ` +
      `${cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)}`,
    );
  }

  return {
    ok:      true,
    message: `Connected to project "${projectId}" / dataset "${dataset}". Read and write access confirmed.`,
    details: { project: projectId, dataset, writeAccess: true },
  };
}

// ── Storyblok ──────────────────────────────────────────────────────────────────

/**
 * Load the current platform Storyblok settings, stripped of secrets.
 *
 * Returns:
 *   region          — CDN region string (empty when not set, defaults to "eu")
 *   version         — content version string (empty when not set, defaults to "published")
 *   hasAccessToken  — boolean; true when an access token is stored
 *   updatedAt       — ISO-8601 last-write timestamp; null when never saved
 */
export async function getCmsStoryblokSettingsAction(): Promise<
  | {
      ok:                 true;
      region:             string;
      version:            string;
      spaceId:            string;
      hasAccessToken:     boolean;
      hasManagementToken: boolean;
      updatedAt:          string | null;
    }
  | { ok: false; error: string }
> {
  const result = await getPlatformStoryblokSettings();
  if (!result.ok) return { ok: false, error: result.error };

  const flags = storyblokFlags(result.data);

  return {
    ok:                 true,
    region:             result.data.region  ?? "",
    version:            result.data.version ?? "",
    spaceId:            result.data.spaceId ?? "",
    hasAccessToken:     flags.hasAccessToken,
    hasManagementToken: flags.hasManagementToken,
    updatedAt:          result.updatedAt,
  };
}

/**
 * Save platform Storyblok CMS settings.
 *
 * `accessToken` behaviour:
 *   - Provided non-empty string  → stored as new token
 *   - Provided empty string ""   → clears any stored token
 *   - Omitted / undefined        → existing token is left unchanged
 */
export async function saveCmsStoryblokSettingsAction(input: {
  region:           string;
  version:          string;
  spaceId:          string;
  accessToken?:     string;
  managementToken?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const region          = typeof input.region   === "string" ? input.region.trim()   : "";
  const version         = typeof input.version  === "string" ? input.version.trim()  : "";
  const spaceId         = typeof input.spaceId  === "string" ? input.spaceId.trim().replace(/^#\s*/, "") : "";
  const accessToken     = input.accessToken !== undefined
    ? (typeof input.accessToken === "string" ? input.accessToken.trim() : "")
    : undefined;
  const managementToken = input.managementToken !== undefined
    ? (typeof input.managementToken === "string" ? input.managementToken.trim() : "")
    : undefined;

  if (region.length > 512)      return { ok: false, error: "Region must be 512 characters or fewer." };
  if (version.length > 512)     return { ok: false, error: "Version must be 512 characters or fewer." };
  if (spaceId.length > 64)      return { ok: false, error: "Space ID must be 64 characters or fewer." };
  if (accessToken !== undefined && accessToken.length > 512) {
    return { ok: false, error: "Access token must be 512 characters or fewer." };
  }
  if (managementToken !== undefined && managementToken.length > 512) {
    return { ok: false, error: "Management token must be 512 characters or fewer." };
  }

  const result = await savePlatformStoryblokSettings({ region, version, spaceId, accessToken, managementToken });
  if (!result.ok) return result;

  revalidatePath("/admin/platform/integrations/cms");
  return { ok: true };
}

/** Result returned to the client after a Storyblok connection test. */
export type StoryblokTestConnectionResult =
  | { ok: true;  message: string; region: string }
  | { ok: false; error: string; hint?: string };

/**
 * Test Storyblok Content Delivery API connectivity.
 *
 * Accepts an optional access token from the form so operators can test new
 * credentials before saving.  If no token is provided, the stored DB token
 * (or STORYBLOK_ACCESS_TOKEN env var) is used.
 *
 * Uses StoryblokProvider.testConnection() which fetches a guaranteed-absent
 * story — null is success, an exception is failure.
 */
export async function testCmsStoryblokConnectionAction(input: {
  accessToken?: string;
  region?:      string;
}): Promise<StoryblokTestConnectionResult> {
  await getRequiredAdminSession();

  // Resolve token: form input → DB → env var
  let token  = input.accessToken?.trim() ?? "";
  let region = input.region?.trim()      ?? "";

  if (!token || !region) {
    const stored = await getPlatformStoryblokSettings().catch(() => null);
    if (stored?.ok) {
      if (!token)  token  = stored.data.accessToken ?? "";
      if (!region) region = stored.data.region      ?? "";
    }
  }

  // Fallback to env var
  if (!token) token = process.env.STORYBLOK_ACCESS_TOKEN ?? "";

  if (!token) {
    return {
      ok:    false,
      error: "No Storyblok access token configured.",
      hint:  "Enter a token above and save, or set STORYBLOK_ACCESS_TOKEN in your .env.local.",
    };
  }

  const resolvedRegion = (region || "eu") as import("@/cms/providers/storyblok-client").StoryblokRegion;
  const { STORYBLOK_CDN_BASE_URLS, StoryblokClient } = await import("@/cms/providers/storyblok-client");
  const { StoryblokProvider } = await import("@/cms/providers/storyblok-provider");

  const cdnBaseUrl = STORYBLOK_CDN_BASE_URLS[resolvedRegion] ?? STORYBLOK_CDN_BASE_URLS.eu;
  const client     = new StoryblokClient(token, cdnBaseUrl, "published");
  const provider   = new StoryblokProvider(client);
  const result     = await provider.testConnection();

  if (!result.ok) {
    const msg      = result.error ?? "Unknown error";
    const msgLower = msg.toLowerCase();
    let hint: string | undefined;
    if (msgLower.includes("401") || msgLower.includes("unauthorized")) {
      hint = "The token is invalid or expired. Check it at app.storyblok.com → Settings → Access Tokens.";
    } else if (msgLower.includes("403") || msgLower.includes("forbidden")) {
      hint = "The token does not have read access to this space.";
    } else if (msgLower.includes("enotfound") || msgLower.includes("network")) {
      hint = "Network error — check your internet connection.";
    }
    return { ok: false, error: msg, hint };
  }

  return {
    ok:      true,
    message: "Connected to Storyblok Content Delivery API successfully.",
    region:  resolvedRegion,
  };
}

// ── Storyblok Management API test ─────────────────────────────────────────────

/** Result returned to the client after a Storyblok Management API connection test. */
export type StoryblokManagementTestResult =
  | { ok: true;  message: string; spaceName: string }
  | { ok: false; error: string; hint?: string };

/**
 * Test Storyblok Management API connectivity using the stored management token
 * and space ID.  Optionally accepts form-provided values so operators can test
 * new credentials before saving.
 */
export async function testCmsStoryblokManagementAction(input: {
  managementToken?: string;
  spaceId?:         string;
}): Promise<StoryblokManagementTestResult> {
  await getRequiredAdminSession();

  // Resolve token + spaceId: form input → DB → env var
  let token   = input.managementToken?.trim() ?? "";
  let spaceId = input.spaceId?.trim()         ?? "";

  if (!token || !spaceId) {
    const stored = await getPlatformStoryblokSettings().catch(() => null);
    if (stored?.ok) {
      if (!token)   token   = stored.data.managementToken ?? "";
      if (!spaceId) spaceId = stored.data.spaceId         ?? "";
    }
  }

  // Env var fallbacks
  if (!token)   token   = process.env.STORYBLOK_MANAGEMENT_TOKEN ?? "";
  if (!spaceId) spaceId = process.env.STORYBLOK_SPACE_ID         ?? "";

  if (!token) {
    return {
      ok:    false,
      error: "No Storyblok Management API token configured.",
      hint:  "Enter a Personal Access Token above and save, or set STORYBLOK_MANAGEMENT_TOKEN in your .env.local.",
    };
  }

  if (!spaceId) {
    return {
      ok:    false,
      error: "No Storyblok Space ID configured.",
      hint:  "Enter the numeric Space ID above and save, or set STORYBLOK_SPACE_ID in your .env.local.",
    };
  }

  const { createStoryblokManagementClient } = await import(
    "@/cms/providers/storyblok-management-client"
  );

  const client = createStoryblokManagementClient(token, spaceId);
  const result = await client.testConnection();

  if (!result.ok) {
    return { ok: false, error: result.error, hint: result.hint };
  }

  return {
    ok:        true,
    message:   `Connected to Storyblok Management API successfully. Ready to provision content.`,
    spaceName: result.spaceName,
  };
}

// ── Statamic ───────────────────────────────────────────────────────────────────

/**
 * Load the current platform Statamic settings, stripped of secrets.
 *
 * Returns:
 *   baseUrl    — base URL of the Statamic site (empty when not set)
 *   hasApiKey  — boolean; true when an API key is stored
 *   updatedAt  — ISO-8601 last-write timestamp; null when never saved
 */
export async function getCmsStatamicSettingsAction(): Promise<
  | {
      ok:        true;
      baseUrl:   string;
      hasApiKey: boolean;
      updatedAt: string | null;
    }
  | { ok: false; error: string }
> {
  const result = await getPlatformStatamicSettings();
  if (!result.ok) return { ok: false, error: result.error };

  const flags = statamicFlags(result.data);

  return {
    ok:        true,
    baseUrl:   result.data.baseUrl ?? "",
    hasApiKey: flags.hasApiKey,
    updatedAt: result.updatedAt,
  };
}

/**
 * Save platform Statamic CMS settings.
 *
 * `apiKey` behaviour:
 *   - Provided non-empty string  → stored as new key
 *   - Provided empty string ""   → clears any stored key
 *   - Omitted / undefined        → existing key is left unchanged
 */
export async function saveCmsStatamicSettingsAction(input: {
  baseUrl:  string;
  apiKey?:  string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const baseUrl = typeof input.baseUrl === "string" ? input.baseUrl.trim() : "";
  const apiKey  = input.apiKey !== undefined
    ? (typeof input.apiKey === "string" ? input.apiKey.trim() : "")
    : undefined;

  if (baseUrl.length > 512) return { ok: false, error: "Base URL must be 512 characters or fewer." };
  if (apiKey !== undefined && apiKey.length > 512) {
    return { ok: false, error: "API key must be 512 characters or fewer." };
  }

  const result = await savePlatformStatamicSettings({ baseUrl, apiKey });
  if (!result.ok) return result;

  revalidatePath("/admin/platform/integrations/cms");
  return { ok: true };
}

// ── Marketing site seed ────────────────────────────────────────────────────────

/** Per-page result returned to the client (no secrets). */
export interface SeedPageResult {
  id:     string;
  slug:   string;
  ok:     boolean;
  error?: string;
}

/** Summary returned after a seed run. */
export type SeedMarketingSiteResult =
  | {
      ok:      true;
      total:   number;
      seeded:  number;
      failed:  number;
      results: SeedPageResult[];
    }
  | { ok: false; error: string };

/**
 * Seed (or re-seed) all marketing site pages + variants into Sanity.
 *
 * ─── Design ───────────────────────────────────────────────────────────────────
 *
 *   Uses `createOrReplace` so the action is idempotent — safe to re-run after
 *   content changes without duplicating documents.
 *
 *   Credentials are resolved in the same priority order as the test connection:
 *     Form-provided values > platform_settings DB > env var fallback.
 *
 *   All pages and variant documents are written sequentially; a failure on one
 *   document does not abort the run — errors are collected and returned in the
 *   summary.
 *
 * ─── Cleanup (post-seed) ──────────────────────────────────────────────────────
 *
 *   After upserting, two classes of stale documents are removed (best-effort,
 *   non-fatal):
 *
 *   1. Legacy bare variant IDs — variant documents without a tenantId whose
 *      _id equals a bare variant key (e.g. "hero_direct_brand").  These predate
 *      the tenant-scoping migration and must be absent so GROQ queries don't
 *      return them ahead of the tenant-scoped equivalents.
 *
 *   2. Stale tenant variant documents — any heroVariant / proofVariant /
 *      ctaVariant / featureVariant / notificationVariant document that belongs
 *      to the mister-chameleon tenant but whose _id is no longer in the current
 *      seed.  These arise when a variant is renamed or removed.
 *
 *   3. Duplicate page documents — any page whose slug matches a canonical seed
 *      page but whose _id differs from the canonical "mister-chameleon_page_*"
 *      form.
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   No secrets cross the server→client boundary.
 *   The Sanity write token is read from the DB / env var server-side only.
 */
export async function seedMarketingSiteAction(): Promise<SeedMarketingSiteResult> {
  // ── 1. Resolve Sanity credentials ──────────────────────────────────────────
  let savedProjectId:  string | undefined;
  let savedDataset:    string | undefined;
  let savedWriteToken: string | undefined;

  try {
    const saved = await getPlatformSanitySettings();
    if (saved.ok) {
      savedProjectId  = saved.data.projectId?.trim()  || undefined;
      savedDataset    = saved.data.dataset?.trim()    || undefined;
      savedWriteToken = saved.data.writeToken?.trim() || undefined;
    }
  } catch {
    // Non-fatal — fall through to env vars.
  }

  const projectId =
    savedProjectId             ||
    process.env.SANITY_PROJECT_ID?.trim();

  const dataset =
    savedDataset               ||
    process.env.SANITY_DATASET?.trim() ||
    "production";

  const writeToken =
    savedWriteToken                          ||
    process.env.SANITY_API_WRITE_TOKEN?.trim() ||
    process.env.SANITY_WRITE_TOKEN?.trim()     ||
    process.env.SANITY_API_TOKEN?.trim();

  if (!projectId) {
    return {
      ok:    false,
      error: "No Sanity Project ID configured. Set it in the Sanity section above, or add SANITY_PROJECT_ID to your environment variables.",
    };
  }

  if (!writeToken) {
    return {
      ok:    false,
      error: "No Sanity write token configured. Add one in the Sanity section above (Editor role or higher required).",
    };
  }

  // ── 2. Create Sanity client ─────────────────────────────────────────────────
  const client = createClient({
    projectId,
    dataset,
    token:      writeToken,
    apiVersion: process.env.SANITY_API_VERSION ?? "2024-01-01",
    useCdn:     false,
  });

  // ── 3. Seed pages + variants ────────────────────────────────────────────────
  //
  // Variants (heroVariant, proofVariant, ctaVariant, …) are stored separately
  // from page documents but must be seeded together so the decision engine can
  // resolve them.  Both arrays use `createOrReplace`, so the action is fully
  // idempotent and safe to re-run.
  const allDocs = [...allMarketingPages, ...marketingSiteVariants];
  const results: SeedPageResult[] = [];

  for (const doc of allDocs) {
    const d        = doc as Record<string, unknown>;
    const id       = String(d._id);
    const rawSlug  = d.slug as Record<string, unknown> | undefined;
    const slug     = rawSlug?.current ? String(rawSlug.current) : id;

    try {
      await client.createOrReplace(doc as Parameters<typeof client.createOrReplace>[0]);
      results.push({ id, slug, ok: true });
    } catch (err) {
      results.push({
        id,
        slug,
        ok:    false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const seeded = results.filter((r) =>  r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  // ── 4. Cleanup: legacy bare variant IDs (pre-tenant-scoping migration) ────────
  //
  // Variant documents used to be stored with bare _ids equal to the variant key
  // (e.g. "hero_direct_brand") and no tenantId.  Delete any that still exist so
  // GROQ queries never return them ahead of the tenant-scoped equivalents.
  const legacyIds = marketingSiteVariants.map(
    (v) => (v as Record<string, unknown>).key as string,
  );
  for (const id of legacyIds) {
    try {
      const existing = await client.fetch<{ _id: string } | null>(
        `*[_id == $id && !defined(tenantId)][0]{ _id }`, { id },
      );
      if (existing) {
        await client.delete(id);
        try { await client.delete(`drafts.${id}`); } catch { /* no draft */ }
      }
    } catch { /* non-fatal */ }
  }

  // ── 5. Cleanup: stale tenant variant documents ─────────────────────────────────
  //
  // Any variant document belonging to the mister-chameleon tenant whose _id is
  // no longer in the current seed (renamed or removed variant).
  const canonicalVariantIds = new Set(
    marketingSiteVariants.map((v) => String((v as Record<string, unknown>)._id)),
  );
  const VARIANT_TYPES = [
    "heroVariant", "proofVariant", "ctaVariant",
    "featureVariant", "notificationVariant", "conversionVariant",
  ];
  try {
    const staleVariants = await client.fetch<{ _id: string }[]>(
      `*[_type in $types && tenantId == "mister-chameleon" && !(_id in path("drafts.**"))]{_id}`,
      { types: VARIANT_TYPES },
    );
    for (const doc of staleVariants) {
      if (!canonicalVariantIds.has(doc._id)) {
        try {
          await client.delete(doc._id);
          try { await client.delete(`drafts.${doc._id}`); } catch { /* no draft */ }
        } catch { /* non-fatal */ }
      }
    }
  } catch { /* non-fatal — don't fail the whole seed */ }

  // ── 6. Cleanup: duplicate page documents (non-canonical _ids) ─────────────────
  //
  // For each slug in the seed, delete any page documents that belong to the
  // mister-chameleon tenant, share the slug, but have a non-canonical _id.
  const canonicalPageIds = new Set(
    allMarketingPages.map((p) => String((p as Record<string, unknown>)._id)),
  );
  const processedSlugs = new Set<string>();
  for (const doc of allMarketingPages) {
    const d    = doc as Record<string, unknown>;
    const slug = (d.slug as Record<string, unknown> | undefined)?.current as string | undefined;
    if (!slug || processedSlugs.has(slug)) continue;
    processedSlugs.add(slug);
    try {
      const dupes = await client.fetch<{ _id: string }[]>(
        `*[
          _type == "page" &&
          tenantId == "mister-chameleon" &&
          slug.current == $slug &&
          !(_id in $canonicalIds) &&
          !(_id in path("drafts.**"))
        ]{_id}`,
        { slug, canonicalIds: [...canonicalPageIds] },
      );
      for (const dupe of dupes) {
        try {
          await client.delete(dupe._id);
          try { await client.delete(`drafts.${dupe._id}`); } catch { /* no draft */ }
        } catch { /* non-fatal */ }
      }
    } catch { /* non-fatal */ }
  }

  return {
    ok:      true,
    total:   allDocs.length,
    seeded,
    failed,
    results,
  };
}

// ── Storyblok Space Seed ───────────────────────────────────────────────────────

/** Summary returned after a Storyblok seed run. */
export type SeedStoryblokSpaceResult =
  | {
      ok:      true;
      total:   number;
      seeded:  number;
      failed:  number;
      results: SeedPageResult[];
    }
  | { ok: false; error: string };

/**
 * Seed (or re-seed) the platform Storyblok space with the default starter
 * stories.
 *
 * ─── What is seeded ───────────────────────────────────────────────────────────
 *
 *   Variant folders + 26 variant stories:
 *     hero-variants/{6 keys}         — Hero variants (direct/brand, problem-aware, vision, consideration, intent, default)
 *     proof-variants/{3 keys}        — Proof variants (platform, cases, default)
 *     cta-variants/{4 keys}          — CTA variants (meeting, guide, platform, default)
 *     feature-variants/{3 keys}      — Feature variants (grid_primary, highlights, comparison)
 *     conversion-variants/{3 keys}   — Conversion variants (demo, contact, signup)
 *     notification-variants/{4 keys} — Notification variants (default, offer, urgency, returning)
 *
 *   7 page stories at the root with rich sections content:
 *     home      — marketing-page  (intro, featureGrid, testimonials, CTA)
 *     approach  — detail-page     (intro, processSteps, differentiators)
 *     services  — detail-page     (intro, service lines, how engagements work)
 *     cases     — detail-page     (intro, case study highlights)
 *     about     — detail-page     (intro, track record, values)
 *     contact   — detail-page     (intro, contact form)
 *     site-settings               (main nav with 6 items, footer nav)
 *
 * ─── Idempotency ──────────────────────────────────────────────────────────────
 *
 *   upsertStory() does GET-then-PUT/POST, so the action is safe to re-run.
 *   Existing stories are updated rather than duplicated.
 *
 * ─── Credentials ──────────────────────────────────────────────────────────────
 *
 *   Uses the platform-level Management API token and Space ID configured in
 *   Admin → Platform → Integrations → CMS → Storyblok (Provisioning section).
 *   Falls back to STORYBLOK_MANAGEMENT_TOKEN / STORYBLOK_SPACE_ID env vars.
 */
export async function seedStoryblokSpaceAction(): Promise<SeedStoryblokSpaceResult> {
  await getRequiredAdminSession();

  // ── 1. Resolve credentials ─────────────────────────────────────────────────
  let managementToken: string | undefined;
  let spaceId:         string | undefined;

  try {
    const result = await getPlatformStoryblokSettings();
    if (result.ok) {
      managementToken = result.data.managementToken?.trim() || undefined;
      spaceId         = result.data.spaceId?.trim()         || undefined;
    }
  } catch {
    // Non-fatal — fall through to env vars.
  }

  if (!managementToken) managementToken = process.env.STORYBLOK_MANAGEMENT_TOKEN?.trim() || undefined;
  if (!spaceId)         spaceId         = process.env.STORYBLOK_SPACE_ID?.trim()         || undefined;

  if (!managementToken) {
    return {
      ok:    false,
      error: "No Storyblok Management API token configured. Add one in the Storyblok section above (Provisioning section).",
    };
  }

  if (!spaceId) {
    return {
      ok:    false,
      error: "No Storyblok Space ID configured. Add it in the Storyblok section above (Provisioning section).",
    };
  }

  // ── 2. Create Management client ────────────────────────────────────────────
  const { createStoryblokManagementClient } = await import(
    "@/cms/providers/storyblok-management-client"
  );
  const {
    heroVariantSlug,
    proofVariantSlug,
    ctaVariantSlug,
    featureVariantSlug,
    conversionVariantSlug,
    notificationVariantSlug,
    HERO_VARIANTS_FOLDER,
    PROOF_VARIANTS_FOLDER,
    CTA_VARIANTS_FOLDER,
    FEATURE_VARIANTS_FOLDER,
    CONVERSION_VARIANTS_FOLDER,
    NOTIFICATION_VARIANTS_FOLDER,
  } = await import("@/cms/queries/storyblok");

  const client = createStoryblokManagementClient(managementToken, spaceId);
  const results: SeedPageResult[] = [];

  // ── 2.5. Provision component schemas ───────────────────────────────────────
  //
  // Register every component used by the variant stories and page stories so
  // that the Storyblok visual editor renders proper field controls instead of
  // a raw key-value dump.  Uses an upsert strategy: existing components are
  // updated in place; new ones are created.
  //
  // Component whitelist entries in `bloks` fields reference the technical
  // `name` key of each component — these match the `component` field values
  // written into the story content objects further below.
  {
    const { STORYBLOK_COMPONENT_DEFINITIONS } = await import(
      "@/cms/seed/storyblok-components"
    );

    // Load all existing component schemas once, build a name→id lookup map.
    const existing      = await client.listComponents();
    const existingMap   = new Map(existing.map((c) => [c.name, c.id]));

    for (const def of STORYBLOK_COMPONENT_DEFINITIONS) {
      try {
        await client.upsertComponent(def, existingMap);
        // Add the newly-created component to the map so subsequent definitions
        // that reference it in a whitelist can find it if needed.
        // (We do not need the id after creation, so we just record a sentinel.)
        if (!existingMap.has(def.name)) existingMap.set(def.name, -1);
      } catch {
        // Non-fatal: a component schema failure should not abort the story seed.
      }
    }
  }

  // ── 3. Ensure variant folders ──────────────────────────────────────────────
  let heroFolderId:         number;
  let proofFolderId:        number;
  let ctaFolderId:          number;
  let featureFolderId:      number;
  let conversionFolderId:   number;
  let notificationFolderId: number;
  let casesFolderId:        number;
  let newsFolderId:         number;

  try {
    heroFolderId         = await client.ensureFolder("Hero Variants",         HERO_VARIANTS_FOLDER);
    proofFolderId        = await client.ensureFolder("Proof Variants",        PROOF_VARIANTS_FOLDER);
    ctaFolderId          = await client.ensureFolder("CTA Variants",          CTA_VARIANTS_FOLDER);
    featureFolderId      = await client.ensureFolder("Feature Variants",      FEATURE_VARIANTS_FOLDER);
    conversionFolderId   = await client.ensureFolder("Conversion Variants",   CONVERSION_VARIANTS_FOLDER);
    notificationFolderId = await client.ensureFolder("Notification Variants", NOTIFICATION_VARIANTS_FOLDER);
    casesFolderId        = await client.ensureFolder("Cases",                 "cases");
    newsFolderId         = await client.ensureFolder("News",                  "news");
  } catch (err) {
    return {
      ok:    false,
      error: `Failed to create variant folders: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // ── 4. Seed variant stories ────────────────────────────────────────────────
  //
  // Resolve the app URL once here — used both as `previewUrl` on each variant
  // story (so "Open preview" in Storyblok opens the homepage, where variants
  // are rendered, rather than the non-routable folder path) and later to set
  // the space-level preview domain in step 6.
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");

  // Covers all keys the decision engine resolves so the adaptive experience
  // actually changes between visitor segments.  Content is written for a
  // business-consulting demo tenant (Nascita) — generic enough to demo the
  // platform with any prospect, specific enough to be believable copy.
  //
  // Hero variants  (hero-variants/{key})
  //   hero_direct_brand   ← FALLBACK_PLAN key — direct / unknown traffic
  //   hero_google_problem — problem-aware copy for search arrivals
  //   hero_linkedin_vision— thought-leadership angle for social traffic
  //   hero_consideration  — re-engagement for returning visitors
  //   hero_intent_direct  — high-intent / ready-to-engage visitors
  //   hero_default        — generic starter / provisioning fallback
  //
  // Proof variants  (proof-variants/{key})
  //   proof_platform  ← FALLBACK_PLAN key — firm credibility
  //   proof_cases     — concrete client outcomes with numbers
  //   proof_default   — broad first-visit trust
  //
  // CTA variants  (cta-variants/{key})
  //   cta_meeting  ← FALLBACK_PLAN key — book a discovery call
  //   cta_guide    — download a resource (low-friction, early funnel)
  //   cta_platform — explore the approach (LinkedIn / vision arrivals)
  //   cta_default  — generic starter / provisioning fallback

  const variantStories = [

    // ── Hero variants ─────────────────────────────────────────────────────────

    {
      id:       "hero_direct_brand",
      slug:     "hero_direct_brand",
      fullSlug: heroVariantSlug("hero_direct_brand"),
      name:     "Hero — Direct / Brand",
      parentId: heroFolderId,
      content:  {
        component: "hero_variant",
        key:       "hero_direct_brand",
        is_active: true,
        tag:       "Business transformation, built to last",
        title:     "Your next chapter starts with the right strategy.",
        subtitle:
          "Nascita partners with leadership teams to design and deliver transformations that stick. " +
          "From strategy to execution, we work alongside you — not just in front of you.",
        ctas: [
          { _uid: "hdb-cta-0", component: "ctaLink", label: "Start the conversation", href: "/contact"  },
          { _uid: "hdb-cta-1", component: "ctaLink", label: "Explore our approach",   href: "/approach" },
        ],
      },
    },

    {
      id:       "hero_google_problem",
      slug:     "hero_google_problem",
      fullSlug: heroVariantSlug("hero_google_problem"),
      name:     "Hero — Google / Problem-Aware",
      parentId: heroFolderId,
      content:  {
        component: "hero_variant",
        key:       "hero_google_problem",
        is_active: true,
        tag:       "There's a smarter way through this",
        title:     "Stuck between the strategy and the execution?",
        subtitle:
          "Most transformation programmes fail not because the strategy is wrong, " +
          "but because implementation runs out of steam. " +
          "Nascita closes that gap — from diagnosis through delivery.",
        ctas: [
          { _uid: "hgp-cta-0", component: "ctaLink", label: "See how we work",       href: "/approach" },
          { _uid: "hgp-cta-1", component: "ctaLink", label: "Book a discovery call", href: "/contact"  },
        ],
      },
    },

    {
      id:       "hero_linkedin_vision",
      slug:     "hero_linkedin_vision",
      fullSlug: heroVariantSlug("hero_linkedin_vision"),
      name:     "Hero — LinkedIn / Vision",
      parentId: heroFolderId,
      content:  {
        component: "hero_variant",
        key:       "hero_linkedin_vision",
        is_active: true,
        tag:       "The future of resilient organisations",
        title:     "Organisations that adapt, outperform.",
        subtitle:
          "The most effective leadership teams don't just react to change — they build " +
          "the capability to drive it. Nascita helps you build that capability from the inside out.",
        ctas: [
          { _uid: "hlv-cta-0", component: "ctaLink", label: "Explore our thinking", href: "/insights" },
          { _uid: "hlv-cta-1", component: "ctaLink", label: "Talk to us",           href: "/contact"  },
        ],
      },
    },

    {
      id:       "hero_consideration",
      slug:     "hero_consideration",
      fullSlug: heroVariantSlug("hero_consideration"),
      name:     "Hero — Consideration / Returning",
      parentId: heroFolderId,
      content:  {
        component: "hero_variant",
        key:       "hero_consideration",
        is_active: true,
        tag:       "You've seen what we do. Here's the next step.",
        title:     "Ready to move from exploration to action?",
        subtitle:
          "You've seen the work. You know the kind of transformations we deliver. " +
          "The next step is a direct conversation about where you are and what's possible — " +
          "no pitch deck, no obligation.",
        ctas: [
          { _uid: "hco-cta-0", component: "ctaLink", label: "Book a 30-minute call", href: "/contact" },
          { _uid: "hco-cta-1", component: "ctaLink", label: "Read a case study",     href: "/cases"   },
        ],
      },
    },

    {
      id:       "hero_intent_direct",
      slug:     "hero_intent_direct",
      fullSlug: heroVariantSlug("hero_intent_direct"),
      name:     "Hero — High Intent",
      parentId: heroFolderId,
      content:  {
        component: "hero_variant",
        key:       "hero_intent_direct",
        is_active: true,
        tag:       "One conversation away from a plan",
        title:     "You already know what needs to change. Let's build the path.",
        subtitle:
          "Whether you're facing a growth challenge, a structural overhaul, or a strategic pivot — " +
          "Nascita brings the frameworks, the experience, and the hands-on support to get it done. " +
          "Let's talk this week.",
        ctas: [
          { _uid: "hid-cta-0", component: "ctaLink", label: "Book a discovery call",  href: "/contact"  },
          { _uid: "hid-cta-1", component: "ctaLink", label: "See our approach first", href: "/approach" },
        ],
      },
    },

    {
      id:       "hero_default",
      slug:     "hero_default",
      fullSlug: heroVariantSlug("hero_default"),
      name:     "Hero — Default",
      parentId: heroFolderId,
      content:  {
        component: "hero_variant",
        key:       "hero_default",
        is_active: true,
        tag:       "",
        title:     "Welcome",
        subtitle:  "We're glad you're here. Discover what we can do for you.",
        ctas:      [{ _uid: "hdef-cta-0", component: "ctaLink", label: "Learn more", href: "/about" }],
      },
    },

    {
      id:       "hero_customer_onboarding",
      slug:     "hero_customer_onboarding",
      fullSlug: heroVariantSlug("hero_customer_onboarding"),
      name:     "Hero — Customer Onboarding",
      parentId: heroFolderId,
      content:  {
        component: "hero_variant",
        key:       "hero_customer_onboarding",
        is_active: true,
        tag:       "Welcome to Nascita",
        title:     "You've made the decision. Now let's build something lasting.",
        subtitle:
          "Your engagement starts now. Over the coming weeks, we'll run the diagnostic, " +
          "introduce the team, and co-build the transformation roadmap. " +
          "Everything is already in motion — here's where to begin.",
        ctas: [
          { _uid: "hco2-cta-0", component: "ctaLink", label: "Access your onboarding guide", href: "/onboarding"  },
          { _uid: "hco2-cta-1", component: "ctaLink", label: "Meet the team",                href: "/contact"     },
        ],
      },
    },

    // ── Proof variants ────────────────────────────────────────────────────────

    {
      id:       "proof_platform",
      slug:     "proof_platform",
      fullSlug: proofVariantSlug("proof_platform"),
      name:     "Proof — Platform / Firm Credibility",
      parentId: proofFolderId,
      content:  {
        component: "proof_variant",
        key:       "proof_platform",
        is_active: true,
        title:     "Proven across industries and scale",
        items: [
          {
            _uid: "pp-item-0", component: "proofItem",
            title: "120+ transformations delivered",
            text:  "From PE-backed mid-market to listed multinationals — every engagement is hands-on, outcomes-focused, and designed to build internal capability, not dependency.",
          },
          {
            _uid: "pp-item-1", component: "proofItem",
            title: "Embedded, not advisory-only",
            text:  "Our consultants work inside your organisation for the duration of the programme. Strategy and execution under the same roof means no handover gaps.",
          },
          {
            _uid: "pp-item-2", component: "proofItem",
            title: "Sector-agnostic rigour",
            text:  "Financial services, industrial, technology, professional services — we bring transferable frameworks and challenge cross-sector blind spots.",
          },
        ],
      },
    },

    {
      id:       "proof_cases",
      slug:     "proof_cases",
      fullSlug: proofVariantSlug("proof_cases"),
      name:     "Proof — Case Studies",
      parentId: proofFolderId,
      content:  {
        component: "proof_variant",
        key:       "proof_cases",
        is_active: true,
        title:     "Results that move the business forward",
        items: [
          {
            _uid: "pc-item-0", component: "proofItem",
            title: "40% reduction in time-to-market",
            text:  "Operational redesign for a B2B technology company cut their product release cycle from 18 weeks to 11 — without adding headcount.",
          },
          {
            _uid: "pc-item-1", component: "proofItem",
            title: "€18M in identified efficiency gains",
            text:  "A 90-day diagnostic across a 600-person professional services firm surfaced structural inefficiencies worth €18M annually — with a clear roadmap to capture them.",
          },
          {
            _uid: "pc-item-2", component: "proofItem",
            title: "3 portfolio companies scaled to exit",
            text:  "Embedded strategy and operational support across three PE-backed businesses, each achieving a successful exit within the investment horizon.",
          },
        ],
      },
    },

    {
      id:       "proof_default",
      slug:     "proof_default",
      fullSlug: proofVariantSlug("proof_default"),
      name:     "Proof — Default",
      parentId: proofFolderId,
      content:  {
        component: "proof_variant",
        key:       "proof_default",
        is_active: true,
        title:     "Trusted by leadership teams who need more than a slide deck",
        items: [
          {
            _uid: "pd-item-0", component: "proofItem",
            title: "From diagnosis to delivery",
            text:  "We don't hand over a strategy and disappear. Nascita stays involved through implementation — because that's where transformations are won or lost.",
          },
          {
            _uid: "pd-item-1", component: "proofItem",
            title: "Outcome-obsessed, not hours-billed",
            text:  "Our engagements are structured around milestones, not retainers. We succeed when you do — and we structure our fees to reflect that.",
          },
          {
            _uid: "pd-item-2", component: "proofItem",
            title: "Built for complex organisations",
            text:  "Matrix structures, multiple stakeholders, legacy processes — we've navigated all of it. Complexity is the job, not a reason to simplify the problem.",
          },
        ],
      },
    },

    {
      id:       "proof_vision",
      slug:     "proof_vision",
      fullSlug: proofVariantSlug("proof_vision"),
      name:     "Proof — Vision / Thought Leadership",
      parentId: proofFolderId,
      content:  {
        component: "proof_variant",
        key:       "proof_vision",
        is_active: true,
        title:     "A conviction, not just a service line",
        items: [
          {
            _uid: "pv-item-0", component: "proofItem",
            title: "Transformation is a capability, not a project",
            text:
              "Organisations that sustain change build an internal muscle for it. " +
              "Every Nascita engagement is designed to leave that muscle behind — " +
              "not to create a dependency on continued consulting support.",
          },
          {
            _uid: "pv-item-1", component: "proofItem",
            title: "The strategy–execution gap is a leadership problem",
            text:
              "Most programmes don't fail because the strategy was wrong. " +
              "They fail because no one closed the distance between the plan and the people responsible for delivering it. " +
              "That distance is where Nascita operates.",
          },
          {
            _uid: "pv-item-2", component: "proofItem",
            title: "Dependency-free consulting is possible",
            text:
              "The standard consulting model is structurally biased toward renewal. " +
              "Ours isn't. We measure success partly by how little you need us when the engagement ends — " +
              "because that means the capability is genuinely yours.",
          },
        ],
      },
    },

    // ── CTA variants ──────────────────────────────────────────────────────────

    {
      id:       "cta_meeting",
      slug:     "cta_meeting",
      fullSlug: ctaVariantSlug("cta_meeting"),
      name:     "CTA — Book a Discovery Call",
      parentId: ctaFolderId,
      content:  {
        component: "cta_variant",
        key:       "cta_meeting",
        is_active: true,
        title:     "Let's talk about what's next for your organisation",
        text:
          "A 30-minute discovery call is all it takes to understand whether Nascita is the right fit. " +
          "No pitch, no pressure — just an honest conversation about your situation.",
        cta_label: "Book a discovery call",
        cta_href:  "/contact",
      },
    },

    {
      id:       "cta_guide",
      slug:     "cta_guide",
      fullSlug: ctaVariantSlug("cta_guide"),
      name:     "CTA — Download Diagnostic",
      parentId: ctaFolderId,
      content:  {
        component: "cta_variant",
        key:       "cta_guide",
        is_active: true,
        title:     "The Transformation Readiness Diagnostic",
        text:
          "A practical self-assessment used by 400+ leadership teams to identify the three factors " +
          "most likely to derail their next change programme. Free — no email gate.",
        cta_label: "Download the diagnostic",
        cta_href:  "/resources/diagnostic",
      },
    },

    {
      id:       "cta_platform",
      slug:     "cta_platform",
      fullSlug: ctaVariantSlug("cta_platform"),
      name:     "CTA — Explore Approach",
      parentId: ctaFolderId,
      content:  {
        component: "cta_variant",
        key:       "cta_platform",
        is_active: true,
        title:     "See how we approach transformation",
        text:
          "Our embedded delivery model combines strategic rigour with hands-on support at every stage. " +
          "Read how we work — and why clients come back.",
        cta_label: "Explore our approach",
        cta_href:  "/approach",
      },
    },

    {
      id:       "cta_default",
      slug:     "cta_default",
      fullSlug: ctaVariantSlug("cta_default"),
      name:     "CTA — Default",
      parentId: ctaFolderId,
      content:  {
        component: "cta_variant",
        key:       "cta_default",
        is_active: true,
        title:     "Ready to get started?",
        text:      "Get in touch with our team today.",
        cta_label: "Contact us",
        cta_href:  "/contact",
      },
    },

    {
      id:       "cta_expansion",
      slug:     "cta_expansion",
      fullSlug: ctaVariantSlug("cta_expansion"),
      name:     "CTA — Expand Engagement",
      parentId: ctaFolderId,
      content:  {
        component: "cta_variant",
        key:       "cta_expansion",
        is_active: true,
        title:     "Ready to expand what we're doing together?",
        text:
          "You've seen the impact. The natural next step is broadening the scope — a new workstream, " +
          "a deeper engagement, or a different part of the business. " +
          "One conversation is all it takes to map out what that could look like.",
        cta_label: "Talk to your account lead",
        cta_href:  "/contact",
      },
    },

    {
      id:       "cta_onboarding",
      slug:     "cta_onboarding",
      fullSlug: ctaVariantSlug("cta_onboarding"),
      name:     "CTA — Onboarding",
      parentId: ctaFolderId,
      content:  {
        component: "cta_variant",
        key:       "cta_onboarding",
        is_active: true,
        title:     "Your transformation is already in motion.",
        text:
          "Over the next 30 days we'll run the diagnostic, meet the key stakeholders, " +
          "and build the roadmap together. " +
          "Everything you need to get started is in the onboarding guide below.",
        cta_label: "Access your onboarding guide",
        cta_href:  "/onboarding",
      },
    },

    // ── Feature variants ──────────────────────────────────────────────────────
    //
    // FeatureVariantKey values: feature_grid_primary | feature_highlights | feature_comparison

    {
      id:       "feature_grid_primary",
      slug:     "feature_grid_primary",
      fullSlug: featureVariantSlug("feature_grid_primary"),
      name:     "Feature — Grid Primary",
      parentId: featureFolderId,
      content:  {
        component:      "feature_variant",
        key:            "feature_grid_primary",
        is_active:      true,
        layout_variant: "feature_grid",
        title:          "The Nascita embedded delivery model",
        subtitle:
          "Three integrated service lines that take organisations from strategic clarity through to lasting change.",
        items: [
          {
            _uid:      "fgp-item-0",
            component: "featureItem",
            title:     "Strategic diagnosis",
            body:
              "A 30–90 day structured deep-dive surfaces the real operating, leadership, or strategic challenge — and delivers a prioritised transformation roadmap with clear ownership.",
            icon: "magnifying-glass",
          },
          {
            _uid:      "fgp-item-1",
            component: "featureItem",
            title:     "Embedded programme delivery",
            body:
              "Our consultants work inside your organisation for the full duration — not as external advisors, but as active participants accountable for outcomes, not just outputs.",
            icon: "rocket-launch",
          },
          {
            _uid:      "fgp-item-2",
            component: "featureItem",
            title:     "Capability building",
            body:
              "Every engagement ends with your team in full control. We build the internal muscle to sustain the transformation after we leave — no dependency, no recurring retainer.",
            icon: "academic-cap",
          },
          {
            _uid:      "fgp-item-3",
            component: "featureItem",
            title:     "Post-merger integration",
            body:
              "Day-one readiness, integration office setup, culture alignment, and synergy tracking — designed for PE-backed businesses and corporate acquirers under time pressure.",
            icon: "puzzle-piece",
          },
        ],
      },
    },

    {
      id:       "feature_highlights",
      slug:     "feature_highlights",
      fullSlug: featureVariantSlug("feature_highlights"),
      name:     "Feature — Key Differentiators",
      parentId: featureFolderId,
      content:  {
        component:      "feature_variant",
        key:            "feature_highlights",
        is_active:      true,
        layout_variant: "feature_highlights",
        title:          "What makes Nascita different",
        subtitle:
          "The gap between strategy and execution is where transformation programmes fail. Here is how we close it.",
        items: [
          {
            _uid:      "fh-item-0",
            component: "featureItem",
            title:     "Truly embedded — not advisory-only",
            body:
              "Our consultants sit in your offices, attend your meetings, and work your timelines. There is no 'client side' and 'consultant side' — we are on the same side, accountable for the same outcomes.",
            icon: "users",
          },
          {
            _uid:      "fh-item-1",
            component: "featureItem",
            title:     "Outcome accountability, not hours billed",
            body:
              "Every Nascita engagement is structured around milestones and defined outcomes. We succeed when you do — and our fees are structured to reflect that alignment, not to maximise engagement duration.",
            icon: "check-badge",
          },
          {
            _uid:      "fh-item-2",
            component: "featureItem",
            title:     "Built for complexity",
            body:
              "Matrix structures, multiple stakeholders, legacy processes, cross-border integrations — we have navigated all of it. Complexity is the work, not a reason to simplify the problem.",
            icon: "chart-bar",
          },
        ],
      },
    },

    {
      id:       "feature_comparison",
      slug:     "feature_comparison",
      fullSlug: featureVariantSlug("feature_comparison"),
      name:     "Feature — Nascita vs Traditional Consulting",
      parentId: featureFolderId,
      content:  {
        component:      "feature_variant",
        key:            "feature_comparison",
        is_active:      true,
        layout_variant: "feature_comparison",
        title:          "Nascita vs. traditional consulting",
        subtitle:
          "Most consulting models are built around deliverables. Ours is built around outcomes.",
        items: [
          {
            _uid:      "fc-item-0",
            component: "featureItem",
            title:     "Embedded in your organisation",
            body:
              "Traditional consultants operate from the outside, presenting work and waiting for sign-off. Nascita consultants work inside your organisation for the full programme duration — attending meetings, unblocking obstacles, and driving delivery day to day.",
            icon: "building-office",
          },
          {
            _uid:      "fc-item-1",
            component: "featureItem",
            title:     "Milestone-based fees",
            body:
              "Most consulting retainers reward time, not results. Nascita engagements are scoped to fixed outcomes with milestone-based payment structures — so our commercial incentives are aligned with your transformation goals.",
            icon: "currency-euro",
          },
          {
            _uid:      "fc-item-2",
            component: "featureItem",
            title:     "Capability transfer, not dependency",
            body:
              "The standard consulting model creates a dependency on continued external support. Every Nascita programme is designed to leave your team with the skills, tools, and confidence to sustain the change without us.",
            icon: "arrow-trending-up",
          },
        ],
      },
    },

    // ── Conversion variants ───────────────────────────────────────────────────
    //
    // ConversionVariantKey values: conversion_signup | conversion_demo | conversion_contact

    {
      id:       "conversion_demo",
      slug:     "conversion_demo",
      fullSlug: conversionVariantSlug("conversion_demo"),
      name:     "Conversion — Book a Discovery Call",
      parentId: conversionFolderId,
      content:  {
        component:     "conversion_variant",
        key:           "conversion_demo",
        is_active:     true,
        title:         "One conversation changes the picture.",
        text:
          "A 30-minute discovery call is all it takes to understand your situation and whether Nascita is the right partner. " +
          "No pitch, no obligation — just an honest conversation about where you are and what is possible.",
        form_key:      "book-demo",
        ctas: [
          {
            _uid:      "cd-cta-0",
            component: "conversionCta",
            label:     "Book a 30-minute call",
            href:      "/book-demo",
            variant:   "primary",
          },
          {
            _uid:      "cd-cta-1",
            component: "conversionCta",
            label:     "See how we work first",
            href:      "/approach",
            variant:   "ghost",
          },
        ],
        urgency_label: "No obligation. Responds within one business day.",
      },
    },

    {
      id:       "conversion_contact",
      slug:     "conversion_contact",
      fullSlug: conversionVariantSlug("conversion_contact"),
      name:     "Conversion — Contact / Enquiry",
      parentId: conversionFolderId,
      content:  {
        component: "conversion_variant",
        key:       "conversion_contact",
        is_active: true,
        title:     "Get in touch.",
        text:
          "Whether you are exploring options, evaluating a specific challenge, or ready to start — we would like to hear from you. " +
          "Fill in the form and we will be in touch within one business day.",
        ctas: [
          {
            _uid:      "cc-cta-0",
            component: "conversionCta",
            label:     "Send us a message",
            href:      "/contact",
            variant:   "primary",
          },
        ],
        form_key: "contact",
      },
    },

    {
      id:       "conversion_signup",
      slug:     "conversion_signup",
      fullSlug: conversionVariantSlug("conversion_signup"),
      name:     "Conversion — Download Diagnostic",
      parentId: conversionFolderId,
      content:  {
        component: "conversion_variant",
        key:       "conversion_signup",
        is_active: true,
        title:     "The Transformation Readiness Diagnostic",
        text:
          "A practical self-assessment used by 400+ leadership teams to identify the three factors " +
          "most likely to derail their next change programme. Free — no email gate.",
        ctas: [
          {
            _uid:      "cs-cta-0",
            component: "conversionCta",
            label:     "Download the diagnostic",
            href:      "/resources/diagnostic",
            variant:   "primary",
          },
          {
            _uid:      "cs-cta-1",
            component: "conversionCta",
            label:     "Talk to us instead",
            href:      "/contact",
            variant:   "ghost",
          },
        ],
        urgency_label: "Free — no email required.",
      },
    },

    // ── Notification variants ─────────────────────────────────────────────────
    //
    // NotificationVariantKey values: notification_default | notification_offer |
    //                                notification_urgency | notification_returning

    {
      id:       "notification_default",
      slug:     "notification_default",
      fullSlug: notificationVariantSlug("notification_default"),
      name:     "Notification — Default",
      parentId: notificationFolderId,
      content:  {
        component:   "notification_variant",
        key:         "notification_default",
        is_active:   true,
        message:     "New: our Transformation Readiness Diagnostic is now available — free, no sign-up required.",
        severity:    "info",
        cta_label:   "Download now",
        cta_href:    "/resources/diagnostic",
        position:    "top",
        dismissible: true,
      },
    },

    {
      id:       "notification_offer",
      slug:     "notification_offer",
      fullSlug: notificationVariantSlug("notification_offer"),
      name:     "Notification — Offer / Promo",
      parentId: notificationFolderId,
      content:  {
        component:       "notification_variant",
        key:             "notification_offer",
        is_active:       true,
        message:         "Limited availability: Nascita is accepting two new diagnostic engagements starting Q3. Secure your slot.",
        severity:        "promo",
        cta_label:       "Enquire now",
        cta_href:        "/contact",
        position:        "top",
        dismissible:     true,
        auto_dismiss_ms: "",
      },
    },

    {
      id:       "notification_urgency",
      slug:     "notification_urgency",
      fullSlug: notificationVariantSlug("notification_urgency"),
      name:     "Notification — Urgency",
      parentId: notificationFolderId,
      content:  {
        component:       "notification_variant",
        key:             "notification_urgency",
        is_active:       true,
        message:         "Our next available programme start date is filling fast. Book a discovery call to hold your slot.",
        severity:        "warning",
        cta_label:       "Book now",
        cta_href:        "/contact",
        position:        "top",
        dismissible:     true,
        auto_dismiss_ms: "",
      },
    },

    {
      id:       "notification_returning",
      slug:     "notification_returning",
      fullSlug: notificationVariantSlug("notification_returning"),
      name:     "Notification — Returning Visitor",
      parentId: notificationFolderId,
      content:  {
        component:       "notification_variant",
        key:             "notification_returning",
        is_active:       true,
        message:         "Welcome back. Ready to take the next step? Our team is available for a no-obligation conversation.",
        severity:        "info",
        cta_label:       "Book a call",
        cta_href:        "/contact",
        position:        "bottom-right",
        dismissible:     true,
        auto_dismiss_ms: "8000",
      },
    },

  ];

  for (const story of variantStories) {
    try {
      await client.upsertStory({
        name:       story.name,
        slug:       story.slug,
        fullSlug:   story.fullSlug,
        parentId:   story.parentId,
        content:    story.content as Record<string, unknown>,
        // Variant stories live at slugs like "hero-variants/hero_consideration"
        // which have no Next.js route.  Override the editor preview URL to the
        // homepage — that is where all adaptive variants are actually rendered.
        previewUrl: appUrl ? `${appUrl}/` : "/",
      });
      results.push({ id: story.id, slug: story.fullSlug, ok: true });
    } catch (err) {
      results.push({
        id:    story.id,
        slug:  story.fullSlug,
        ok:    false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── 5. Seed page stories ───────────────────────────────────────────────────
  //
  // Each page story has a `sections` array of Storyblok nested-component
  // blocks.  StoryblokProvider.getPageBySlug() reads these at runtime and maps
  // them to PageData.sections using mapStoryblokPage().
  //
  // Section `component` names mirror the CMS types `_type` values
  // (textSection, featureGrid, testimonialSection, processSteps, formSection)
  // so the mapper can handle them generically without per-page logic.

  const pageStories = [

    // ── Home ─────────────────────────────────────────────────────────────────
    {
      id:   "home",
      name: "Home",
      slug: "home",
      content: {
        component: "page",
        title:     "Home",
        template:  "marketing-page",
        seo_title: "Nascita Consulting — Business Transformation Partners",
        seo_description:
          "Nascita partners with leadership teams to design and deliver transformations that stick — from strategy to execution.",
        sections: [
          {
            _uid:      "home-services",
            component: "featureGrid",
            heading:   "What we do",
            features: [
              {
                _uid:        "f-strategy",
                component:   "feature",
                title:       "Strategic Advisory",
                description: "From market positioning to portfolio strategy — we bring the frameworks and the challenge.",
                icon:        "lightbulb",
              },
              {
                _uid:        "f-execution",
                component:   "feature",
                title:       "Operational Transformation",
                description: "Redesign processes, structures, and capabilities so the strategy actually lands.",
                icon:        "briefcase",
              },
              {
                _uid:        "f-capability",
                component:   "feature",
                title:       "Leadership Development",
                description: "Build the internal capability to lead change, not just manage it.",
                icon:        "users",
              },
            ],
            cta_label: "Explore our approach",
            cta_href:  "/approach",
          },
          {
            _uid:      "home-proof",
            component: "testimonialSection",
            heading:   "What clients say",
            testimonials: [
              {
                _uid:      "t1",
                component: "testimonial",
                quote:     "Nascita did something rare: they pushed back when we were wrong, and they stayed when the work got hard.",
                author:    "Sophie van den Berg",
                role:      "CFO",
                company:   "Meridian Group",
              },
              {
                _uid:      "t2",
                component: "testimonial",
                quote:     "We came for a strategy. We got a team that helped us build the muscle to execute it ourselves.",
                author:    "David Klaar",
                role:      "CEO",
                company:   "Arklight Capital Portfolio",
              },
            ],
          },
        ],
      },
    },

    // ── Our Approach ──────────────────────────────────────────────────────────
    {
      id:   "approach",
      name: "Our Approach",
      slug: "approach",
      content: {
        component: "page",
        title:     "Our Approach",
        template:  "detail-page",
        seo_title: "Our Approach — Nascita Consulting",
        seo_description:
          "The Nascita embedded delivery model: a four-phase approach that takes organisations from diagnosis to lasting change.",
        sections: [
          {
            _uid:      "approach-intro",
            component: "textSection",
            variant:   "text_lead",
            heading:   "Strategy and execution — under the same roof.",
            body:
              "Most transformation programmes fail not because the strategy is wrong, but because implementation runs out of steam. Nascita is built to close that gap.\n\n" +
              "Our embedded delivery model puts experienced consultants inside your organisation for the full duration of the programme — not as external advisors, but as active participants in making change happen.",
          },
          {
            _uid:      "approach-phases",
            component: "processSteps",
            heading:   "The four-phase Nascita method",
            steps: [
              {
                _uid:        "phase-diagnose",
                component:   "step",
                title:       "1. Diagnose",
                description: "A structured 30–90 day deep-dive into your operating model, leadership dynamics, and strategic priorities. We surface the real problem — not the presenting one — and define what transformation success looks like for your organisation.",
                duration:    "30–90 days",
              },
              {
                _uid:        "phase-design",
                component:   "step",
                title:       "2. Design",
                description: "We co-create the transformation roadmap with your leadership team. Every workstream is scoped, resourced, and sequenced — with clear owners and measurable milestones from day one.",
                duration:    "4–8 weeks",
              },
              {
                _uid:        "phase-deliver",
                component:   "step",
                title:       "3. Deliver",
                description: "Our consultants work inside your organisation — attending steering meetings, unblocking obstacles, coaching leaders, and accelerating delivery. We are accountable for outcomes, not just outputs.",
                duration:    "3–18 months",
              },
              {
                _uid:        "phase-embed",
                component:   "step",
                title:       "4. Embed",
                description: "We build the internal capability your team needs to sustain the change after we leave. This includes knowledge transfer, leadership coaching, and a 90-day post-programme review to confirm the gains are holding.",
                duration:    "8–12 weeks",
              },
            ],
          },
          {
            _uid:      "approach-differentiators",
            component: "featureGrid",
            heading:   "What makes our model different",
            features: [
              {
                _uid:        "d-embedded",
                component:   "feature",
                title:       "Truly embedded",
                description: "We sit in your offices, attend your meetings, and work your timelines. There is no 'client side' and 'consultant side' — we are on the same side.",
                icon:        "users",
              },
              {
                _uid:        "d-outcomes",
                component:   "feature",
                title:       "Outcome accountability",
                description: "Our engagements are structured around milestones, not hours billed. We succeed when you do — and we structure our fees to reflect that.",
                icon:        "check-badge",
              },
              {
                _uid:        "d-capability",
                component:   "feature",
                title:       "No dependency created",
                description: "Every programme ends with your team in full control. We measure success partly by how little you need us afterwards.",
                icon:        "arrow-trending-up",
              },
            ],
          },
        ],
      },
    },

    // ── About ─────────────────────────────────────────────────────────────────
    {
      id:   "about",
      name: "About",
      slug: "about",
      content: {
        component: "page",
        title:     "About",
        template:  "detail-page",
        seo_title: "About Nascita Consulting",
        seo_description:
          "Nascita is a business transformation consultancy working with leadership teams across Europe to design and deliver lasting organisational change.",
        sections: [
          {
            _uid:      "about-intro",
            component: "textSection",
            variant:   "text_lead",
            heading:   "We are Nascita.",
            body:
              "Nascita is a business transformation consultancy founded on a simple conviction: that the best consulting work happens when advisors and clients operate as genuine partners — not as service provider and buyer.\n\n" +
              "We work with leadership teams at ambitious organisations across Europe, helping them navigate complex transformations with the rigour of a strategy house and the hands-on discipline of an operations firm.",
          },
          {
            _uid:      "about-numbers",
            component: "featureGrid",
            heading:   "Our track record",
            features: [
              {
                _uid:        "n-transformations",
                component:   "feature",
                title:       "120+ transformations delivered",
                description: "From PE-backed mid-market businesses to listed multinationals across financial services, industrials, technology, and professional services.",
                icon:        "chart-bar",
              },
              {
                _uid:        "n-sectors",
                component:   "feature",
                title:       "Sector-agnostic rigour",
                description: "We bring transferable frameworks and deliberately challenge cross-sector blind spots. The best ideas in your industry often come from adjacent ones.",
                icon:        "globe-alt",
              },
              {
                _uid:        "n-exits",
                component:   "feature",
                title:       "3 portfolio exits supported",
                description: "Embedded strategy and operational support across PE-backed businesses, each achieving a successful exit within the investment horizon.",
                icon:        "trophy",
              },
            ],
          },
          {
            _uid:      "about-values",
            component: "contentSection",
            eyebrow:   "How we work",
            heading:   "Principles we don't compromise on.",
            intro:
              "Nascita was built around three operating principles that shape every engagement we take on.",
            body:
              "Honesty before comfort. We tell clients what they need to hear — not what they want to hear. If the strategy is right but the leadership team isn't ready to execute it, we say so.\n\n" +
              "Skin in the game. We structure every engagement around client outcomes. Our incentives are aligned with yours — not with hours billed or deliverables signed off.\n\n" +
              "Permanent progress. We build internal capability alongside delivery. The goal is always a transformation your team owns — not one that depends on continued consulting support.",
          },
        ],
      },
    },

    // ── Contact ───────────────────────────────────────────────────────────────
    {
      id:   "contact",
      name: "Contact",
      slug: "contact",
      content: {
        component: "page",
        title:     "Contact",
        template:  "detail-page",
        seo_title: "Contact Nascita Consulting",
        seo_description:
          "Get in touch with Nascita to discuss your transformation agenda. We offer a no-obligation 30-minute discovery call.",
        sections: [
          {
            _uid:      "contact-intro",
            component: "textSection",
            variant:   "text_lead",
            heading:   "Let's talk.",
            body:
              "A 30-minute discovery call is enough to understand your situation and whether Nascita is the right partner for your next transformation. No pitch, no obligation — just an honest conversation.\n\n" +
              "Fill in the form below and we will be in touch within one business day.",
          },
          {
            _uid:      "contact-form",
            component: "formSection",
            form_key:  "contact",
            title:     "Send us a message",
            intro:     "Tell us a little about your organisation and the challenge you are working on.",
          },
        ],
      },
    },

    // ── Services ──────────────────────────────────────────────────────────────
    {
      id:   "services",
      name: "Services",
      slug: "services",
      content: {
        component: "page",
        title:     "Services",
        template:  "detail-page",
        seo_title: "Services — Nascita Consulting",
        seo_description:
          "Nascita offers three core service lines: strategic diagnosis, transformation programme delivery, and post-merger integration.",
        sections: [
          {
            _uid:      "services-intro",
            component: "textSection",
            variant:   "text_lead",
            heading:   "What we offer.",
            body:
              "Nascita's services are built around the three moments where leadership teams most need hands-on external support: understanding the real problem, building and executing the plan, and integrating organisations after a transaction.",
          },
          {
            _uid:      "services-lines",
            component: "featureGrid",
            heading:   "Our service lines",
            features: [
              {
                _uid:        "sl-diagnosis",
                component:   "feature",
                title:       "Strategic diagnosis",
                description: "A structured 30–90 day deep-dive that surfaces the real operating, leadership, or strategic challenge. Deliverable: a prioritised transformation agenda with clear ownership and a credible roadmap.",
                icon:        "magnifying-glass",
              },
              {
                _uid:        "sl-transformation",
                component:   "feature",
                title:       "Transformation programme delivery",
                description: "End-to-end programme management with embedded Nascita consultants. We sit inside your organisation, manage the workstreams, and are accountable for outcomes — not just deliverables.",
                icon:        "rocket-launch",
              },
              {
                _uid:        "sl-pmi",
                component:   "feature",
                title:       "Post-merger integration",
                description: "Day-one readiness, integration office setup, culture and operating model alignment, synergy tracking. Built for PE-backed businesses and corporate acquirers running complex integrations under time pressure.",
                icon:        "puzzle-piece",
              },
              {
                _uid:        "sl-leadership",
                component:   "feature",
                title:       "Leadership capability",
                description: "Executive coaching, leadership team effectiveness programmes, and change-readiness assessments. Standalone or embedded in a wider transformation programme.",
                icon:        "user-group",
              },
            ],
          },
          {
            _uid:      "services-how",
            component: "contentSection",
            eyebrow:   "How engagements work",
            heading:   "No retainers. No surprises.",
            intro:     "Every Nascita engagement is structured around clear outcomes, not open-ended time commitments.",
            body:
              "We start with a scoping conversation to understand your situation and define what success looks like. If there is a fit, we propose an engagement structure — fixed scope, fixed outcomes, milestone-based fees.\n\n" +
              "We do not do retainer consulting. Every engagement has a defined start, a defined end, and a defined set of outcomes we are accountable for.",
            ctas: [
              { _uid: "cta-contact", component: "ctaLink", label: "Start the conversation", href: "/contact" },
            ],
          },
        ],
      },
    },

    // ── Cases ─────────────────────────────────────────────────────────────────
    {
      id:   "cases",
      name: "Case Studies",
      slug: "cases",
      content: {
        component: "page",
        title:     "Case Studies",
        template:  "detail-page",
        seo_title: "Case Studies — Nascita Consulting",
        seo_description:
          "A selection of Nascita client outcomes across transformation programme delivery, strategic diagnosis, and post-merger integration.",
        sections: [
          {
            _uid:      "cases-intro",
            component: "textSection",
            variant:   "text_lead",
            heading:   "Results that move the business forward.",
            body:
              "We measure our success by the outcomes our clients achieve — not the decks we produce or the hours we bill. A selection of recent work is below.\n\n" +
              "Client names have been anonymised in line with our confidentiality commitments.",
          },
          {
            _uid:      "cases-highlights",
            component: "featureGrid",
            heading:   "Selected outcomes",
            features: [
              {
                _uid:        "c1",
                component:   "feature",
                title:       "40% reduction in time-to-market",
                description: "Operational redesign for a B2B technology company cut their product release cycle from 18 weeks to 11 — without adding headcount. Delivered over a 9-month embedded programme.",
                icon:        "clock",
              },
              {
                _uid:        "c2",
                component:   "feature",
                title:       "€18M in identified efficiency gains",
                description: "A 90-day diagnostic across a 600-person professional services firm surfaced structural inefficiencies worth €18M annually. A clear roadmap to capture them was agreed within the quarter.",
                icon:        "currency-euro",
              },
              {
                _uid:        "c3",
                component:   "feature",
                title:       "3 portfolio exits within investment horizon",
                description: "Embedded strategy and operational support across three PE-backed businesses, each achieving a successful exit. Scope included operating model redesign, leadership alignment, and commercial acceleration.",
                icon:        "trophy",
              },
              {
                _uid:        "c4",
                component:   "feature",
                title:       "Post-merger integration: Day 1 in 60 days",
                description: "Full integration office setup, culture alignment programme, and synergy tracking framework for a cross-border acquisition — from signing to Day 1 readiness in 60 days.",
                icon:        "link",
              },
            ],
          },
          {
            _uid:      "cases-cta",
            component: "contentSection",
            eyebrow:   "Talk to us",
            heading:   "Want to understand what this could look like for your organisation?",
            ctas: [
              { _uid: "cta-contact", component: "ctaLink", label: "Book a discovery call", href: "/contact" },
            ],
          },
        ],
      },
    },

    // ── Site settings ────────────────────────────────────────────────────────
    // Fetched by StoryblokProvider.getSiteSettings() at slug "site-settings".
    // All fields are read by the enriched getSiteSettings() mapper.
    {
      id:   "site-settings",
      name: "Site Settings",
      slug: "site-settings",
      content: {
        component: "siteSettings",
        siteTitle: "Nascita Consulting",

        // ── Branding ─────────────────────────────────────────────────────────
        logo_url:  "/nascita-logo.svg",
        logo_alt:  "Nascita Consulting",

        // ── Header CTA ───────────────────────────────────────────────────────
        header_cta_label: "Book a call",
        header_cta_href:  "/contact",
        header_cta_style: "primary",

        // ── Main navigation ───────────────────────────────────────────────────
        mainNavigation: [
          { _uid: "mn-home",     component: "navItem", label: "Home",         href: "/"         },
          { _uid: "mn-approach", component: "navItem", label: "Our Approach", href: "/approach" },
          { _uid: "mn-about",    component: "navItem", label: "About",        href: "/about"    },
          { _uid: "mn-contact",  component: "navItem", label: "Contact",      href: "/contact"  },
        ],

        // ── Footer columns ────────────────────────────────────────────────────
        footerColumns: [
          {
            _uid:      "fc-what-we-do",
            component: "footerColumn",
            title:     "What we do",
            links: [
              { _uid: "fl-approach",   component: "footerLink", label: "Our Approach", href: "/approach"              },
              { _uid: "fl-diagnostic", component: "footerLink", label: "Diagnostic",   href: "/resources/diagnostic" },
            ],
          },
          {
            _uid:      "fc-company",
            component: "footerColumn",
            title:     "Company",
            links: [
              { _uid: "fl-about",   component: "footerLink", label: "About Nascita", href: "/about"   },
              { _uid: "fl-contact", component: "footerLink", label: "Contact",       href: "/contact" },
            ],
          },
        ],

        // ── Footer bottom links (Privacy, Terms, etc.) ────────────────────────
        footerNavigation: [
          { _uid: "fn-privacy", component: "navItem", label: "Privacy Policy",    href: "/privacy" },
          { _uid: "fn-terms",   component: "navItem", label: "Terms of Service",  href: "/terms"   },
        ],

        // ── Contact ───────────────────────────────────────────────────────────
        contact_email: "hello@nascita.com",
        contact_phone: "+31 20 123 4567",

        // ── Social links ──────────────────────────────────────────────────────
        socialLinks: [
          {
            _uid:      "sl-linkedin",
            component: "socialLink",
            label:     "LinkedIn",
            url:       "https://www.linkedin.com/company/nascita-consulting",
          },
        ],
      },
    },
  ];

  for (const page of pageStories) {
    try {
      await client.upsertStory({
        name:     page.name,
        slug:     page.slug,
        fullSlug: page.slug,
        parentId: 0,           // root
        content:  page.content,
      });
      results.push({ id: page.id, slug: page.slug, ok: true });
    } catch (err) {
      results.push({
        id:    page.id,
        slug:  page.slug,
        ok:    false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const seeded = results.filter((r) =>  r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  // ── 5b. Seed entity detail stories ────────────────────────────────────────
  //
  // Case study and news/insight article stories are nested inside folders
  // (cases/ and news/) so they route to /cases/[slug] and /news/[slug].
  // They use the same `page` component with articleMeta + articleBody sections.

  type EntityStory = {
    id: string; name: string; slug: string; fullSlug: string;
    parentId: number; content: Record<string, unknown>;
  };

  const entityStories: EntityStory[] = [
    // ── Case Studies ─────────────────────────────────────────────────────────
    {
      id:       "case-transforming-operations",
      name:     "Transforming Operations",
      slug:     "transforming-operations",
      fullSlug: "cases/transforming-operations",
      parentId: casesFolderId,
      content: {
        component:       "page",
        title:           "Transforming Operations at Scale",
        template:        "article-page",
        seo_title:       "Case Study: Transforming Operations at Scale — Nascita Consulting",
        seo_description: "How Nascita helped a B2B technology company cut their product release cycle from 18 weeks to 11, without adding headcount.",
        sections: [
          {
            _uid: "cs1-meta", component: "articleMeta",
            title:           "Transforming Operations at Scale",
            published_at:    "2024-09-15",
            category:        "Operational Excellence",
            reading_time:    "6",
            author_name:     "Nascita Consulting",
            author_role:     "Transformation Team",
          },
          {
            _uid: "cs1-body", component: "articleBody",
            body:
              "A fast-growing B2B technology company came to us with a familiar problem: as they scaled, their product delivery had slowed. Eighteen weeks from decision to release. Missed market windows. Teams working hard but not together.\n\n" +
              "We began with a four-week diagnostic — not a set of assumptions, but a structured investigation. We mapped how decisions were made, where handoffs broke down, and what the leadership team actually knew about the bottlenecks. What we found was not a process problem. It was a clarity problem.\n\n" +
              "Responsibilities had grown organically without being formalised. Three teams believed they owned the same decision. Nobody was wrong — the problem was the structure, not the people.\n\n" +
              "We redesigned the operating model in two phases. First, we defined ownership clearly — not aspirationally, but operationally. Then we restructured how work flowed through the organisation, removing approval steps that existed for historical rather than risk-management reasons.\n\n" +
              "Nine months after we began, the release cycle was 11 weeks. More importantly, the team understood why — and owned the result.",
          },
          {
            _uid: "cs1-related", component: "relatedContent",
            heading: "Related work",
            items: JSON.stringify([
              { title: "Our Approach to Operational Redesign", href: "/approach", category: "Approach" },
              { title: "€18M in Identified Efficiency Gains",  href: "/cases/strategic-diagnosis", category: "Case Study" },
            ]),
          },
        ],
      },
    },
    {
      id:       "case-strategic-diagnosis",
      name:     "Strategic Diagnosis",
      slug:     "strategic-diagnosis",
      fullSlug: "cases/strategic-diagnosis",
      parentId: casesFolderId,
      content: {
        component:       "page",
        title:           "€18M in Identified Efficiency Gains",
        template:        "article-page",
        seo_title:       "Case Study: €18M in Identified Efficiency Gains — Nascita Consulting",
        seo_description: "A 90-day diagnostic across a 600-person professional services firm surfaced structural inefficiencies worth €18M annually.",
        sections: [
          {
            _uid: "cs2-meta", component: "articleMeta",
            title:           "€18M in Identified Efficiency Gains",
            published_at:    "2024-06-20",
            category:        "Strategic Diagnosis",
            reading_time:    "5",
            author_name:     "Nascita Consulting",
            author_role:     "Strategy Team",
          },
          {
            _uid: "cs2-body", component: "articleBody",
            body:
              "A 600-person professional services firm had grown through acquisition. What looked like strength — three complementary practice areas — had become operational complexity. Margins were compressing, but nobody could agree on why.\n\n" +
              "Our diagnostic ran for 90 days and covered every part of the business: delivery economics, commercial structures, support function overhead, and the cost of the seams between the acquired businesses.\n\n" +
              "The findings were uncomfortable, as good diagnostics often are. The largest inefficiencies were not in the obvious places — they were embedded in how the business had been integrated, or more precisely, not integrated. Three separate HR systems. Two finance teams. Duplicated roles created during the acquisitions that had never been rationalised.\n\n" +
              "We presented the findings with a 24-month roadmap to capture €18M in annualised gains. The roadmap was sequenced by impact and feasibility — not everything at once, but nothing indefinitely deferred. The board approved it within the quarter.",
          },
          {
            _uid: "cs2-cta", component: "ctaSection",
            title:       "Want a diagnostic for your organisation?",
            description: "We run structured, time-boxed diagnostics that give leadership teams clarity on where value is hidden — and a plan to capture it.",
            cta_label:   "Book a diagnostic conversation",
            cta_href:    "/contact",
          },
        ],
      },
    },
    // ── Insights / Articles ───────────────────────────────────────────────────
    {
      id:       "news-transformation-capability",
      name:     "Transformation Is a Capability, Not a Project",
      slug:     "transformation-is-a-capability",
      fullSlug: "news/transformation-is-a-capability",
      parentId: newsFolderId,
      content: {
        component:       "page",
        title:           "Transformation Is a Capability, Not a Project",
        template:        "article-page",
        seo_title:       "Transformation Is a Capability, Not a Project — Nascita Insights",
        seo_description: "Why organisations that treat transformation as a one-off project systematically underperform those that build it as a standing capability.",
        sections: [
          {
            _uid: "ins1-meta", component: "articleMeta",
            title:           "Transformation Is a Capability, Not a Project",
            published_at:    "2024-11-04",
            category:        "Perspective",
            reading_time:    "7",
            author_name:     "Nascita Consulting",
            author_role:     "Editorial",
          },
          {
            _uid: "ins1-body", component: "articleBody",
            body:
              "Most transformation programmes are designed to end. There is a start date, a project team, a set of deliverables, and a point at which the organisation is supposed to return to normal. This is the wrong model.\n\n" +
              "The organisations that adapt fastest are not those that run the best transformation programmes. They are the ones that have made adaptation a standing feature of how they operate — embedded in how they plan, how they resource, and how they lead.\n\n" +
              "The distinction matters practically. A project-based transformation exhausts the organisation. Leadership attention peaks and then dissipates. The programme team disbands. The changes are handed over to operations, which is often unprepared to sustain them. Within 18 months, much of what was built has eroded.\n\n" +
              "A capability-based approach looks different. It invests in the skills and structures that make change manageable as a continuous condition — not as an exceptional event. It builds decision-making clarity so that new pressures are absorbed rather than accumulated. It creates feedback loops that surface emerging problems before they become strategic crises.\n\n" +
              "This is not about always being in transformation mode. It is about being able to move when the environment demands it — without the disruption and cost of treating it as an emergency each time.\n\n" +
              "The question we ask clients is simple: if the market shifted tomorrow and you needed to restructure your model in the next 12 months, how confident are you in your ability to do that? The answer tells you a great deal about the difference between the transformation you have done and the capability you have built.",
          },
          {
            _uid: "ins1-related", component: "relatedContent",
            heading: "Further reading",
            items: JSON.stringify([
              { title: "The Strategy–Execution Gap Is a Leadership Problem", href: "/news/strategy-execution-gap", category: "Perspective" },
              { title: "Transforming Operations at Scale",                    href: "/cases/transforming-operations", category: "Case Study" },
            ]),
          },
        ],
      },
    },
    {
      id:       "news-strategy-execution-gap",
      name:     "The Strategy–Execution Gap Is a Leadership Problem",
      slug:     "strategy-execution-gap",
      fullSlug: "news/strategy-execution-gap",
      parentId: newsFolderId,
      content: {
        component:       "page",
        title:           "The Strategy–Execution Gap Is a Leadership Problem",
        template:        "article-page",
        seo_title:       "The Strategy–Execution Gap Is a Leadership Problem — Nascita Insights",
        seo_description: "Why the gap between declared strategy and actual organisational behaviour is not a process failure — it is a leadership failure.",
        sections: [
          {
            _uid: "ins2-meta", component: "articleMeta",
            title:           "The Strategy–Execution Gap Is a Leadership Problem",
            published_at:    "2024-08-12",
            category:        "Leadership",
            reading_time:    "6",
            author_name:     "Nascita Consulting",
            author_role:     "Editorial",
          },
          {
            _uid: "ins2-body", component: "articleBody",
            body:
              "Strategy consultants produce strategies. Implementation consultants help execute them. But the gap between the two — the space where strategies go to be quietly abandoned — is rarely treated as the central problem it is.\n\n" +
              "In our experience, the strategy–execution gap is almost never a process problem. It is a leadership problem. Specifically, it is a problem of unclear ownership, unresolved conflicts, and the persistent tendency of leadership teams to agree on strategy in the boardroom and then disagree about it in every operational decision that follows.\n\n" +
              "Strategy sets direction. Execution is where direction meets reality. The gap opens when leaders are not aligned on what the strategy actually requires them to do differently — not what it says, but what it demands.\n\n" +
              "The symptoms are familiar: initiatives that lose energy six months in; transformation programmes that are officially complete but have not changed the day-to-day; priorities that cascade from the top and arrive at the front line unrecognisable. These are not execution failures. They are reflections of ambiguity that was present at the point of strategy.\n\n" +
              "The fix is not better project management. It is better leadership alignment — achieved not through workshops, but through the hard work of surfacing and resolving the conflicts that every strategy creates. Which markets will we not serve? Which investments will we not make? Which ways of working will we actively stop?\n\n" +
              "Until those questions are answered — in operational terms, not just strategic ones — the gap remains open.",
          },
          {
            _uid: "ins2-cta", component: "ctaSection",
            title:       "Closing the gap in your organisation",
            description: "We work alongside leadership teams to turn strategy into operational clarity. If you're facing this challenge, let's talk.",
            cta_label:   "Start a conversation",
            cta_href:    "/contact",
          },
        ],
      },
    },
  ];

  for (const entity of entityStories) {
    try {
      await client.upsertStory({
        name:       entity.name,
        slug:       entity.slug,
        fullSlug:   entity.fullSlug,
        parentId:   entity.parentId,
        content:    entity.content,
        previewUrl: appUrl ? `${appUrl}/` : "/",
      });
      results.push({ id: entity.id, slug: entity.fullSlug, ok: true });
    } catch (err) {
      results.push({
        id:    entity.id,
        slug:  entity.fullSlug,
        ok:    false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── 6. Set preview domain ──────────────────────────────────────────────────
  //
  // Storyblok uses the space's `domain` setting to build the "Open preview"
  // URL: it appends the story slug to this domain, e.g. {domain}/approach.
  // Without it the editor falls back to its Liquid renderer, which emits
  // "Template 404.liquid is missing" for every page.
  //
  // NEXT_PUBLIC_APP_URL is the canonical public URL of the Next.js app, e.g.
  // "https://nascita.example.com".  Trailing slashes are stripped so Storyblok
  // doesn't produce double-slash URLs like "https://app.com//approach".
  // (appUrl was resolved above, before the variant stories loop.)
  //
  // Best-effort: a domain update failure does not fail the seed response.
  if (appUrl) {
    await client.setPreviewDomain(appUrl).catch(() => undefined);
  }

  return {
    ok:    true,
    total: variantStories.length + pageStories.length,
    seeded,
    failed,
    results,
  };
}
