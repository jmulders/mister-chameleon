/**
 * CMS Provider Factory
 *
 * Returns the appropriate CMSProvider implementation based on the current
 * environment. The homepage and any other consumer imports this factory —
 * they never reference a concrete provider directly.
 *
 * ─── Selection logic ─────────────────────────────────────────────────────────
 *
 *   Priority: Sanity → Storyblok → Statamic → Mock
 *
 *   1. SANITY_PROJECT_ID is set         →  SanityProvider
 *   2. STORYBLOK_ACCESS_TOKEN is set    →  StoryblokProvider
 *   3. STATAMIC_API_URL is set          →  StatamicProvider
 *   4. None are set                     →  MockCMSProvider
 *
 *   Sanity takes priority because it was the first integration and is the
 *   current reference implementation. Set only the token that belongs to
 *   the active CMS for your environment — leave the other unset.
 *
 * ─── Env setup quick reference ───────────────────────────────────────────────
 *
 *   Local dev (no CMS):
 *     Leave SANITY_PROJECT_ID, STORYBLOK_ACCESS_TOKEN, and STATAMIC_API_URL
 *     unset. MockCMSProvider is used automatically.
 *
 *   Sanity:
 *     SANITY_PROJECT_ID=your_project_id
 *     SANITY_DATASET=production
 *     SANITY_API_VERSION=2024-01-01
 *     SANITY_READ_TOKEN=your_read_token   (optional, for draft content)
 *
 *   Storyblok:
 *     STORYBLOK_ACCESS_TOKEN=your_access_token
 *     STORYBLOK_REGION=eu                 (optional, default: "eu")
 *     STORYBLOK_VERSION=published         (optional, default: "published")
 *
 *   Statamic:
 *     STATAMIC_API_URL=https://cms.example.com
 *     STATAMIC_API_KEY=your_api_key       (optional, for protected collections)
 *
 *   See .env.example and lib/env.ts for the full variable reference.
 */

import type { CMSProvider } from "./cms-provider";
import { MockCMSProvider }      from "./mock-provider";
import { SanityProvider }       from "./sanity-provider";
import { StoryblokProvider }    from "./storyblok-provider";
import { StatamicProvider }     from "./statamic-provider";
import { PlatformCMSProvider }  from "./platform-provider";
import { CachedCMSProvider }    from "./cached-cms-provider";
import { serverEnv }            from "@/lib/env";
import { logger }               from "@/lib/logger";
import type { TenantCmsSettings } from "@/tenant/types";
import { getPlatformSanitySettings, getPlatformStoryblokSettings } from "@/platform/platform-store";
import {
  StoryblokClient,
  STORYBLOK_CDN_BASE_URLS,
  type StoryblokRegion,
} from "./storyblok-client";

/**
 * Returns the appropriate CMSProvider for the current request.
 *
 * ─── Selection logic ──────────────────────────────────────────────────────────
 *
 *   When `tenantCms` is supplied the factory first tries to honour the
 *   tenant's stated preference, falling back to the env-based priority order
 *   if the preferred provider is not configured (e.g. no credentials in env).
 *
 *   Without `tenantCms` (or when the preferred provider is unavailable) the
 *   original env-based priority applies:
 *
 *     Sanity (SANITY_PROJECT_ID set)
 *       → Storyblok (STORYBLOK_ACCESS_TOKEN set)
 *       → Statamic (STATAMIC_API_URL set)
 *       → Mock (fallback)
 *
 * @param tenantCms  Optional CMS settings from TenantSettings.  When present
 *                   the `provider` field is used to select the implementation
 *                   before falling back to env priority.  The optional
 *                   `projectId`, `dataset`, and `apiVersion` fields override
 *                   the platform-level environment variables so that each
 *                   tenant can point to its own Sanity project/dataset.
 * @param tenantId   Optional tenant identifier, e.g. "workengine".
 *                   Passed to the Sanity provider so all GROQ queries are scoped
 *                   to that tenant's documents plus shared (tenantId-less) documents.
 *                   Omit (or pass null) to return all-tenant documents — the
 *                   backward-compatible default.
 * @param locale     Optional locale code, e.g. "nl" or "de".
 *                   When provided, variant documents with a matching locale field
 *                   are preferred over the default (EN / no-locale) documents.
 */
export function createCMSProvider(
  tenantCms?: TenantCmsSettings,
  tenantId?: string | null,
  locale?: string | null,
): CMSProvider {
  // ── Tenant preference (when available) ────────────────────────────────────
  if (tenantCms?.provider) {
    const preferred = tenantCms.provider;

    if (preferred === "mock") {
      logger.info("[CMS] Tenant override: using MockCMSProvider.", { tenantId: tenantId ?? null });
      return wrap(new MockCMSProvider(), tenantId);
    }

    if (preferred === "sanity" && serverEnv.sanity.isConfigured) {
      // Build per-tenant overrides (undefined fields fall back to platform env).
      const sanityOverrides = {
        projectId:  tenantCms.projectId  || undefined,
        dataset:    tenantCms.dataset    || undefined,
        apiVersion: tenantCms.apiVersion || undefined,
      };
      logger.info("[CMS] Tenant override: using SanityProvider.", {
        projectId: sanityOverrides.projectId ?? serverEnv.sanity.projectId,
        dataset:   sanityOverrides.dataset   ?? serverEnv.sanity.dataset,
        tenantProjectIdOverride: !!sanityOverrides.projectId,
        tenantDatasetOverride:   !!sanityOverrides.dataset,
        tenantId:  tenantId ?? null,
      });
      return wrap(new SanityProvider(undefined, tenantId, sanityOverrides, false, locale), tenantId, locale);
    }

    if (preferred === "storyblok" && serverEnv.storyblok.isConfigured) {
      logger.info("[CMS] Tenant override: using StoryblokProvider.", {
        region:   serverEnv.storyblok.region,
        version:  serverEnv.storyblok.version,
        tenantId: tenantId ?? null,
      });
      return wrap(new StoryblokProvider(), tenantId);
    }

    if (preferred === "statamic" && serverEnv.statamic.isConfigured) {
      logger.info("[CMS] Tenant override: using StatamicProvider.", {
        apiUrl:   serverEnv.statamic.apiUrl,
        tenantId: tenantId ?? null,
      });
      return wrap(new StatamicProvider(), tenantId);
    }

    if (preferred === "platform" && tenantId) {
      // PlatformCMSProvider is NOT wrapped with CachedCMSProvider so that
      // admin edits are immediately visible on the next request.
      logger.info("[CMS] Tenant override: using PlatformCMSProvider.", { tenantId });
      return new PlatformCMSProvider(tenantId);
    }

    // Tenant prefers a provider that isn't configured in this environment.
    logger.warn(
      `[CMS] Tenant prefers provider "${preferred}" but it is not configured in this environment. ` +
      `Falling back to env-based selection.`,
      { preferred },
    );
  }

  // ── Env-based priority (original logic, unchanged) ─────────────────────────

  // ── Sanity (first priority) ────────────────────────────────────────────────
  if (serverEnv.sanity.isConfigured) {
    // Only apply per-tenant projectId/dataset overrides when the tenant's stated
    // provider is Sanity (or unset).  If the tenant prefers a different provider
    // but Storyblok/Statamic aren't configured in this environment, we fall back
    // to Sanity — but we must NOT carry over the tenant's non-Sanity projectId
    // (e.g. a Storyblok Space ID) which would fail Sanity's projectId validation.
    const tenantPrefersSanity = !tenantCms?.provider || tenantCms.provider === "sanity";
    const sanityOverrides = (tenantCms && tenantPrefersSanity) ? {
      projectId:  tenantCms.projectId  || undefined,
      dataset:    tenantCms.dataset    || undefined,
      apiVersion: tenantCms.apiVersion || undefined,
    } : undefined;
    logger.info("[CMS] Using SanityProvider.", {
      projectId: sanityOverrides?.projectId ?? serverEnv.sanity.projectId,
      dataset:   sanityOverrides?.dataset   ?? serverEnv.sanity.dataset,
      tenantId:  tenantId ?? null,
    });
    return wrap(new SanityProvider(undefined, tenantId, sanityOverrides, false, locale), tenantId, locale);
  }

  // ── Storyblok (second priority) ────────────────────────────────────────────
  if (serverEnv.storyblok.isConfigured) {
    logger.info("[CMS] Using StoryblokProvider.", {
      region:  serverEnv.storyblok.region,
      version: serverEnv.storyblok.version,
    });
    return wrap(new StoryblokProvider(), tenantId);
  }

  // ── Statamic (third priority) ──────────────────────────────────────────────
  if (serverEnv.statamic.isConfigured) {
    logger.info("[CMS] Using StatamicProvider.", {
      apiUrl: serverEnv.statamic.apiUrl,
    });
    return wrap(new StatamicProvider(), tenantId);
  }

  // ── Mock (fallback) ────────────────────────────────────────────────────────
  logger.info("[CMS] No CMS configured — using MockCMSProvider.");
  return wrap(new MockCMSProvider(), tenantId);
}

/**
 * Async variant of `createCMSProvider` that additionally checks
 * `platform_settings` for Sanity credentials when environment variables are
 * not set.  Use this in async server components and route handlers that want
 * to work without a `.env.local` file in production.
 *
 * Resolution order (highest priority first):
 *   1. Environment variables  (SANITY_PROJECT_ID / STORYBLOK_ACCESS_TOKEN / …)
 *   2. platform_settings DB   (/admin/platform/integrations/cms)
 *      — Sanity:    projectId + dataset required
 *      — Storyblok: accessToken required
 *   3. Mock (if nothing is configured)
 *
 * @param tenantCms  Optional per-tenant CMS settings (same as `createCMSProvider`).
 * @param tenantId   Optional tenant identifier for GROQ query scoping.
 * @param locale     Optional locale code for locale-aware variant resolution.
 */
export async function createCMSProviderAsync(
  tenantCms?: TenantCmsSettings,
  tenantId?: string | null,
  locale?: string | null,
): Promise<CMSProvider> {
  // Fast path: env vars are set → delegate to the synchronous factory unchanged.
  if (serverEnv.sanity.isConfigured || serverEnv.storyblok.isConfigured || serverEnv.statamic.isConfigured) {
    return createCMSProvider(tenantCms, tenantId, locale);
  }

  // Slow path: env vars are absent → check the DB for CMS credentials.
  // Check Sanity and Storyblok in parallel (Statamic is env-only for now).
  const [sanityDbResult, storyblokDbResult] = await Promise.all([
    getPlatformSanitySettings().catch(() => ({ ok: false as const, error: "db-error" })),
    getPlatformStoryblokSettings().catch(() => ({ ok: false as const, error: "db-error" })),
  ]);

  // ── Sanity DB fallback ────────────────────────────────────────────────────
  if (sanityDbResult.ok && sanityDbResult.data.projectId && sanityDbResult.data.dataset) {
    const dbSettings = sanityDbResult.data;
    // Only apply per-tenant overrides when the tenant actually prefers Sanity —
    // avoid passing a Storyblok/Statamic projectId into the Sanity client.
    const tenantPrefersSanity = !tenantCms?.provider || tenantCms.provider === "sanity";
    const overrides = {
      projectId:  (tenantPrefersSanity && tenantCms?.projectId)  ? tenantCms.projectId  : dbSettings.projectId,
      dataset:    (tenantPrefersSanity && tenantCms?.dataset)    ? tenantCms.dataset    : dbSettings.dataset,
      apiVersion: (tenantPrefersSanity && tenantCms?.apiVersion) ? tenantCms.apiVersion : (dbSettings.apiVersion || "2024-01-01"),
      readToken:  dbSettings.readToken  || undefined,
    };

    logger.info("[CMS] Using SanityProvider — credentials loaded from platform_settings DB.", {
      projectId: overrides.projectId,
      dataset:   overrides.dataset,
      tenantId:  tenantId ?? null,
    });

    return wrap(new SanityProvider(undefined, tenantId, overrides, false, locale), tenantId, locale);
  }

  // ── Storyblok DB fallback ─────────────────────────────────────────────────
  if (storyblokDbResult.ok && storyblokDbResult.data.accessToken) {
    const { accessToken, region, version } = storyblokDbResult.data;
    const cdnBaseUrl =
      STORYBLOK_CDN_BASE_URLS[(region ?? "eu") as StoryblokRegion] ??
      STORYBLOK_CDN_BASE_URLS.eu;
    const contentVersion: "published" | "draft" =
      version === "draft" ? "draft" : "published";

    logger.info("[CMS] Using StoryblokProvider — credentials loaded from platform_settings DB.", {
      region:  region ?? "eu",
      version: contentVersion,
      tenantId: tenantId ?? null,
    });

    const client = new StoryblokClient(accessToken, cdnBaseUrl, contentVersion);
    return wrap(new StoryblokProvider(client), tenantId);
  }

  // No env vars, no DB config → MockCMSProvider.
  logger.info("[CMS] No CMS configured (env or DB) — using MockCMSProvider.");
  return wrap(new MockCMSProvider(), tenantId);
}

/**
 * Returns a preview-mode CMSProvider for draft content rendering.
 *
 * This factory is the preview counterpart of `createCMSProvider`.  Key
 * differences from the standard factory:
 *
 *   1. The underlying Sanity client uses `perspective: "previewDrafts"` —
 *      draft documents are returned when available, published otherwise.
 *   2. All fetches use `cache: "no-store"` — the Next.js data cache is
 *      bypassed entirely so stale published content is never served.
 *   3. The result is NOT wrapped with CachedCMSProvider — the in-process
 *      CMS variant cache must be skipped in preview mode for the same reason.
 *
 * Preview is only supported with SanityProvider because:
 *   - Storyblok draft mode requires a separate draft access token + API endpoint
 *     (not yet implemented in StoryblokProvider).
 *   - Statamic draft support is not implemented.
 *   - MockCMSProvider has no concept of draft vs published content.
 *
 * When Sanity is not configured, falls back to MockCMSProvider (same as the
 * standard factory) so preview calls fail gracefully.
 *
 * @param tenantCms  Optional CMS settings from TenantSettings.
 * @param tenantId   Optional tenant identifier for GROQ query scoping.
 */
export function createPreviewCMSProvider(
  tenantCms?: TenantCmsSettings,
  tenantId?: string | null,
  locale?: string | null,
): CMSProvider {
  if (!serverEnv.sanity.isConfigured) {
    logger.warn(
      "[CMS] Preview mode requested but Sanity is not configured. " +
        "Falling back to MockCMSProvider — draft content will not be available.",
    );
    return new MockCMSProvider();
  }

  const sanityOverrides = tenantCms
    ? {
        projectId:  tenantCms.projectId  || undefined,
        dataset:    tenantCms.dataset    || undefined,
        apiVersion: tenantCms.apiVersion || undefined,
      }
    : undefined;

  logger.info("[CMS] Preview mode: using SanityProvider with previewDrafts perspective.", {
    projectId: sanityOverrides?.projectId ?? serverEnv.sanity.projectId,
    dataset:   sanityOverrides?.dataset   ?? serverEnv.sanity.dataset,
    tenantId:  tenantId ?? null,
  });

  // Pass `preview: true` to SanityProvider so it:
  //   - creates a client with `perspective: "previewDrafts"` and `useCdn: false`
  //   - uses `cache: "no-store"` for every fetch
  //
  // Deliberately NOT wrapped with CachedCMSProvider — the in-process cache
  // must not serve stale published snapshots during preview.
  return new SanityProvider(undefined, tenantId, sanityOverrides, true, locale);
}

// ── Internal helper ───────────────────────────────────────────────────────────

/**
 * Wraps the inner provider with the in-process CMS variant cache.
 *
 * All variant / page / site-settings fetches are routed through
 * `CachedCMSProvider` before hitting the underlying CMS API.  Admin
 * operations (provisionSite, testConnection) are passed through unchanged.
 */
function wrap(inner: CMSProvider, tenantId?: string | null, locale?: string | null): CMSProvider {
  return new CachedCMSProvider(inner, tenantId, locale);
}
