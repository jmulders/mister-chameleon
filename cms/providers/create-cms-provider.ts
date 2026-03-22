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
import { MockCMSProvider } from "./mock-provider";
import { SanityProvider } from "./sanity-provider";
import { StoryblokProvider } from "./storyblok-provider";
import { StatamicProvider } from "./statamic-provider";
import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { TenantCmsSettings } from "@/tenant/types";

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
 *                   before falling back to env priority.
 * @param tenantId   Optional tenant identifier, e.g. "workengine".
 *                   Passed to the Sanity provider so all GROQ queries are scoped
 *                   to that tenant's documents plus shared (tenantId-less) documents.
 *                   Omit (or pass null) to return all-tenant documents — the
 *                   backward-compatible default.
 */
export function createCMSProvider(
  tenantCms?: TenantCmsSettings,
  tenantId?: string | null,
): CMSProvider {
  // ── Tenant preference (when available) ────────────────────────────────────
  if (tenantCms?.provider) {
    const preferred = tenantCms.provider;

    if (preferred === "mock") {
      logger.info("[CMS] Tenant override: using MockCMSProvider.", { tenantId: tenantId ?? null });
      return new MockCMSProvider();
    }

    if (preferred === "sanity" && serverEnv.sanity.isConfigured) {
      logger.info("[CMS] Tenant override: using SanityProvider.", {
        projectId: serverEnv.sanity.projectId,
        dataset:   serverEnv.sanity.dataset,
        tenantId:  tenantId ?? null,
      });
      return new SanityProvider(undefined, tenantId);
    }

    if (preferred === "storyblok" && serverEnv.storyblok.isConfigured) {
      logger.info("[CMS] Tenant override: using StoryblokProvider.", {
        region:   serverEnv.storyblok.region,
        version:  serverEnv.storyblok.version,
        tenantId: tenantId ?? null,
      });
      return new StoryblokProvider();
    }

    if (preferred === "statamic" && serverEnv.statamic.isConfigured) {
      logger.info("[CMS] Tenant override: using StatamicProvider.", {
        apiUrl:   serverEnv.statamic.apiUrl,
        tenantId: tenantId ?? null,
      });
      return new StatamicProvider();
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
    logger.info("[CMS] Using SanityProvider.", {
      projectId: serverEnv.sanity.projectId,
      dataset:   serverEnv.sanity.dataset,
      tenantId:  tenantId ?? null,
    });
    return new SanityProvider(undefined, tenantId);
  }

  // ── Storyblok (second priority) ────────────────────────────────────────────
  if (serverEnv.storyblok.isConfigured) {
    logger.info("[CMS] Using StoryblokProvider.", {
      region:  serverEnv.storyblok.region,
      version: serverEnv.storyblok.version,
    });
    return new StoryblokProvider();
  }

  // ── Statamic (third priority) ──────────────────────────────────────────────
  if (serverEnv.statamic.isConfigured) {
    logger.info("[CMS] Using StatamicProvider.", {
      apiUrl: serverEnv.statamic.apiUrl,
    });
    return new StatamicProvider();
  }

  // ── Mock (fallback) ────────────────────────────────────────────────────────
  logger.info("[CMS] No CMS configured — using MockCMSProvider.");
  return new MockCMSProvider();
}
