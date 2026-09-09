/**
 * lib/wp-plugin/update-manifest.ts
 *
 * Builds the "self-hosted JSON" that plugin-update-checker (PUC) expects from a
 * resolved GitHub release. Keys are snake_case because that is what PUC's
 * PluginInfo reader and WordPress' own update structures consume.
 */

import type { PluginRelease } from "./github-release";

export interface WpUpdateManifest {
  name:         string;
  slug:         string;
  version:      string;
  download_url: string;
  homepage:     string;
  requires:     string;
  tested:       string;
  requires_php: string;
  last_updated: string;
  author:       string;
  sections:     { changelog: string };
}

/**
 * @param release      The latest resolved plugin release.
 * @param slug         The plugin slug.
 * @param downloadUrl  Platform download URL (siteKey-authenticated), NOT the
 *                     GitHub asset URL — the token stays server-side.
 */
export function buildUpdateManifest(
  release: PluginRelease,
  { slug, downloadUrl }: { slug: string; downloadUrl: string },
): WpUpdateManifest {
  return {
    name:         "Chameleon Connect",
    slug,
    version:      release.version,
    download_url: downloadUrl,
    homepage:     "https://www.misterchameleon.nl",
    requires:     "6.0",
    tested:       "6.6",
    requires_php: "7.4",
    last_updated: release.publishedAt,
    author:       "Mister Chameleon",
    sections:     { changelog: release.body || "See the plugin readme." },
  };
}
