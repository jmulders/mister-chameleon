/**
 * lib/wp-plugin/github-release.ts
 *
 * Server-side reader for the private GitHub releases of the Chameleon Connect
 * WordPress plugin. The GitHub token lives in server env and NEVER leaves the
 * server — the update proxy (app/api/plugin/wp/*) uses this to resolve the latest
 * version and to stream the release ZIP to WP sites authenticated only by their
 * siteKey.
 *
 * Server only. `fetch` is injectable so tests never hit the network.
 */

import "server-only";

import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

/** The release ZIP asset the WP updater installs (built by the plugin's build-zip.sh). */
const ASSET_REGEX = /mister-chameleon-connect(?:\.\d+)*\.zip$/i;

const GITHUB_API = "https://api.github.com";

/** Short server-side cache so a burst of WP checks hits GitHub at most once/TTL. */
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface PluginReleaseAsset {
  name: string;
  /** GitHub asset API URL (…/releases/assets/:id) — streamed with an octet-stream Accept. */
  apiUrl: string;
  size: number;
}

export interface PluginRelease {
  /** Semver without the leading "v" (matches the plugin header Version). */
  version: string;
  tag: string;
  name: string;
  /** Release body (markdown) → shown as the changelog. */
  body: string;
  publishedAt: string;
  htmlUrl: string;
  /** The installable ZIP asset, or null when the release has none. */
  zipAsset: PluginReleaseAsset | null;
}

type FetchFn = typeof fetch;

let cache: { at: number; release: PluginRelease | null } | null = null;

/** Standard authenticated GitHub API headers. */
function ghHeaders(token: string, accept = "application/vnd.github+json"): Record<string, string> {
  return {
    Authorization:          `Bearer ${token}`,
    Accept:                 accept,
    "User-Agent":           "mister-chameleon-platform",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/** Parse the GitHub "latest release" payload into our shape. */
function parseRelease(raw: unknown): PluginRelease | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const tag = typeof r.tag_name === "string" ? r.tag_name : "";
  if (!tag) return null;

  const assets = Array.isArray(r.assets) ? r.assets : [];
  let zipAsset: PluginReleaseAsset | null = null;
  for (const a of assets) {
    const o = (a ?? {}) as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name : "";
    if (name && ASSET_REGEX.test(name) && typeof o.url === "string") {
      zipAsset = { name, apiUrl: o.url, size: typeof o.size === "number" ? o.size : 0 };
      break;
    }
  }

  return {
    version:     tag.replace(/^v/i, ""),
    tag,
    name:        typeof r.name === "string" && r.name ? r.name : tag,
    body:        typeof r.body === "string" ? r.body : "",
    publishedAt: typeof r.published_at === "string" ? r.published_at : "",
    htmlUrl:     typeof r.html_url === "string" ? r.html_url : "",
    zipAsset,
  };
}

/**
 * Resolve the latest plugin release (cached ~5 min). Returns null when the proxy
 * is not configured (no token) or GitHub is unreachable — callers treat null as
 * "no update available", never as an error to the WP site.
 */
export async function getLatestPluginRelease(
  opts: { fetchImpl?: FetchFn; force?: boolean } = {},
): Promise<PluginRelease | null> {
  const now = Date.now();
  if (!opts.force && cache && now - cache.at < CACHE_TTL_MS) {
    return cache.release;
  }

  const cfg = serverEnv.wpPlugin;
  if (!cfg.isConfigured || !cfg.githubToken) {
    logger.warn("[wp-plugin] update proxy not configured (no GitHub token)");
    return null;
  }

  const doFetch = opts.fetchImpl ?? fetch;
  try {
    const res = await doFetch(`${GITHUB_API}/repos/${cfg.repo}/releases/latest`, {
      headers: ghHeaders(cfg.githubToken),
    });
    if (!res.ok) {
      logger.error("[wp-plugin] GitHub latest-release fetch failed", { status: res.status });
      cache = { at: now, release: null };
      return null;
    }
    const release = parseRelease(await res.json());
    cache = { at: now, release };
    return release;
  } catch (err) {
    logger.error("[wp-plugin] GitHub latest-release fetch threw", {
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Fetch a release asset's bytes with the server-side token. Returns the raw
 * Response (its `body` is a stream the route pipes straight to the WP site), or
 * null when unconfigured / the download failed. The token is only ever sent to
 * api.github.com.
 */
export async function fetchPluginAsset(
  assetApiUrl: string,
  opts: { fetchImpl?: FetchFn } = {},
): Promise<Response | null> {
  const cfg = serverEnv.wpPlugin;
  if (!cfg.isConfigured || !cfg.githubToken) return null;

  const doFetch = opts.fetchImpl ?? fetch;
  try {
    const res = await doFetch(assetApiUrl, {
      headers:  ghHeaders(cfg.githubToken, "application/octet-stream"),
      redirect: "follow", // GitHub 302s to a signed asset URL.
    });
    if (!res.ok) {
      logger.error("[wp-plugin] GitHub asset download failed", { status: res.status });
      return null;
    }
    return res;
  } catch (err) {
    logger.error("[wp-plugin] GitHub asset download threw", {
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Reset the in-memory cache — test-only seam. */
export function _resetReleaseCacheForTests(): void {
  cache = null;
}
