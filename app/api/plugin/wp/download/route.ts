/**
 * GET /api/plugin/wp/download?siteKey=…&slug=mister-chameleon-connect
 *
 * siteKey-authenticated download proxy for the Chameleon Connect plugin ZIP.
 * Re-validates the siteKey → active tenant, then streams the latest GitHub
 * release asset fetched SERVER-SIDE with the platform's GitHub token (the token
 * is only ever sent to api.github.com, never to the WP site). This keeps the
 * plugin repo private while WP downloads the update with just its siteKey.
 *
 * Unknown / inactive siteKey → 404; upstream asset failure → 502.
 */

import { NextRequest, NextResponse } from "next/server";
import { getTenantBySiteKey } from "@/tenant/tenant-store";
import { getLatestPluginRelease, fetchPluginAsset } from "@/lib/wp-plugin/github-release";
import { resolveDownload, PLUGIN_SLUG } from "@/lib/wp-plugin/update-service";

export const runtime = "nodejs";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const url     = new URL(request.url);
  const siteKey = url.searchParams.get("siteKey") ?? "";
  const slug    = url.searchParams.get("slug") ?? PLUGIN_SLUG;

  const result = await resolveDownload(
    { siteKey, slug },
    {
      getTenant: async (key) => {
        const tenant = await getTenantBySiteKey(key);
        if (!tenant) return null;
        return { tenantId: tenant.tenantId, active: Boolean(tenant.snippet?.enabled) };
      },
      getRelease: () => getLatestPluginRelease(),
      fetchAsset: (assetApiUrl) => fetchPluginAsset(assetApiUrl),
    },
  );

  if (result.status !== 200) {
    return NextResponse.json(
      { error: result.status === 502 ? "Upstream download failed." : "Not found." },
      { status: result.status, headers: CORS_HEADERS },
    );
  }

  // Stream the ZIP straight through to the WP site.
  return new NextResponse(result.response.body, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      "Content-Type":        "application/zip",
      "Content-Disposition": `attachment; filename="${PLUGIN_SLUG}.zip"`,
      "Cache-Control":       "public, max-age=300",
    },
  });
}
