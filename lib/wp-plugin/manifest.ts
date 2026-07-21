/**
 * Mister Chameleon Connect — WordPress plugin update manifest.
 *
 * Single source of truth for the self-hosted plugin updater. The WordPress plugin
 * polls `/api/wp-plugin/update` (see app/api/wp-plugin/update/route.ts); if the
 * `version` here is newer than the installed one, WordPress shows the update in
 * its normal plugin screen and installs the `download_url` package.
 *
 * ─── Releasing a new plugin version ──────────────────────────────────────────
 *
 *   1. Bump the version in the plugin's own header (integrations/wordpress-plugin/…)
 *      AND `LATEST_VERSION` below — they must match.
 *   2. Rebuild the plugin zip and host it at `download_url` (see below).
 *
 *   The zip is NOT served from this repo; `download_url` points at wherever the
 *   built zip is hosted. Set WP_PLUGIN_DOWNLOAD_URL to that location (a platform
 *   static path, a GitHub release asset, or a CDN). Until it points at a real zip
 *   of LATEST_VERSION, WordPress will detect the update but the install will fail —
 *   so treat hosting the zip as part of the release.
 *
 * The wire shape uses snake_case keys because that is what the plugin's PHP reads
 * and what WordPress' own update/`plugins_api` structures expect.
 */

const LATEST_VERSION = "0.5.3";

export interface WpPluginManifest {
  name: string;
  slug: string;
  version: string;
  requires: string;
  tested: string;
  requires_php: string;
  download_url: string;
  homepage: string;
  sections: { description: string; changelog: string };
}

export function wpPluginManifest(): WpPluginManifest {
  const downloadUrl =
    process.env["WP_PLUGIN_DOWNLOAD_URL"] ??
    "https://www.misterchameleon.nl/downloads/mister-chameleon-connect.zip";

  return {
    name:         "Mister Chameleon Connect",
    slug:         "mister-chameleon-connect",
    version:      LATEST_VERSION,
    requires:     "6.0",
    tested:       "6.6",
    requires_php: "7.4",
    download_url: downloadUrl,
    homepage:     "https://www.misterchameleon.nl",
    sections: {
      description: "Real-time contentpersonalisatie via de Mister Chameleon-snippet.",
      changelog:   "Zie readme.txt in de plugin.",
    },
  };
}
