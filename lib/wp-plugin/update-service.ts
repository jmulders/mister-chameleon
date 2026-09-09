/**
 * lib/wp-plugin/update-service.ts
 *
 * The siteKey-authenticated core of the WordPress plugin update proxy, pure over
 * its dependencies so it is unit-testable without HTTP: the routes
 * (app/api/plugin/wp/update, /download) wire the real tenant lookup + GitHub
 * reader; tests inject fakes.
 *
 * Auth model: a WP site sends only its public siteKey. We resolve it to an
 * existing, ACTIVE tenant (snippet enabled). Unknown / inactive → 404 (no update,
 * no download) — never a token, never a leak.
 */

import type { PluginRelease } from "./github-release";
import { buildUpdateManifest, type WpUpdateManifest } from "./update-manifest";

/** The only plugin this proxy serves. */
export const PLUGIN_SLUG = "mister-chameleon-connect";

/** Minimal tenant shape the proxy needs. */
export interface UpdateTenant {
  tenantId: string;
  /** True when the tenant is active (snippet enabled). */
  active: boolean;
}

export interface UpdateDeps {
  /** Resolve a siteKey to a tenant, or null when unknown. */
  getTenant:  (siteKey: string) => Promise<UpdateTenant | null>;
  /** The latest plugin release, or null when none / proxy unconfigured. */
  getRelease: () => Promise<PluginRelease | null>;
}

export interface DownloadDeps extends UpdateDeps {
  /** Fetch the release asset bytes (server-side, tokened). */
  fetchAsset: (assetApiUrl: string) => Promise<Response | null>;
}

export type UpdateResult =
  | { status: 200; manifest: WpUpdateManifest }
  | { status: 404 };

export type DownloadResult =
  | { status: 200; response: Response }
  | { status: 404 }
  | { status: 502 };

/**
 * Validate the siteKey → active tenant, then (slug ok, release present) build the
 * PUC manifest whose download_url points back at our own siteKey-authenticated
 * download route.
 *
 * @param origin  The platform origin (e.g. https://www.misterchameleon.nl).
 */
export async function resolveUpdate(
  params: { siteKey: string; slug: string; origin: string },
  deps:   UpdateDeps,
): Promise<UpdateResult> {
  const { siteKey, slug, origin } = params;

  if (!siteKey) return { status: 404 };
  if (slug && slug !== PLUGIN_SLUG) return { status: 404 };

  const tenant = await deps.getTenant(siteKey);
  if (!tenant || !tenant.active) return { status: 404 };

  const release = await deps.getRelease();
  if (!release || !release.zipAsset) return { status: 404 };

  const downloadUrl =
    `${origin}/api/plugin/wp/download` +
    `?siteKey=${encodeURIComponent(siteKey)}&slug=${encodeURIComponent(PLUGIN_SLUG)}`;

  return { status: 200, manifest: buildUpdateManifest(release, { slug: PLUGIN_SLUG, downloadUrl }) };
}

/**
 * Validate the siteKey → active tenant, then fetch the release ZIP asset for
 * streaming. Unknown/inactive siteKey → 404; asset fetch failure → 502.
 */
export async function resolveDownload(
  params: { siteKey: string; slug: string },
  deps:   DownloadDeps,
): Promise<DownloadResult> {
  const { siteKey, slug } = params;

  if (!siteKey) return { status: 404 };
  if (slug && slug !== PLUGIN_SLUG) return { status: 404 };

  const tenant = await deps.getTenant(siteKey);
  if (!tenant || !tenant.active) return { status: 404 };

  const release = await deps.getRelease();
  if (!release || !release.zipAsset) return { status: 404 };

  const response = await deps.fetchAsset(release.zipAsset.apiUrl);
  if (!response) return { status: 502 };

  return { status: 200, response };
}
