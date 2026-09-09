/**
 * GET /api/plugin/wp/update?siteKey=…&slug=mister-chameleon-connect
 *
 * siteKey-authenticated update manifest for the Chameleon Connect WordPress
 * plugin. A WP site sends only its public siteKey (which it already configured);
 * we resolve it to an active tenant and return PUC-compatible "self-hosted JSON"
 * whose download_url points back at our own siteKey-authenticated download route
 * — so the GitHub repo stays private and no token ever reaches the client.
 *
 * Unknown / inactive siteKey → 404 (WordPress simply shows no update). CORS is
 * open so the check works from any site.
 */

import { NextRequest, NextResponse } from "next/server";
import { getTenantBySiteKey } from "@/tenant/tenant-store";
import { getLatestPluginRelease } from "@/lib/wp-plugin/github-release";
import { resolveUpdate, PLUGIN_SLUG } from "@/lib/wp-plugin/update-service";

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

  const result = await resolveUpdate(
    { siteKey, slug, origin: url.origin },
    {
      getTenant: async (key) => {
        const tenant = await getTenantBySiteKey(key);
        if (!tenant) return null;
        return { tenantId: tenant.tenantId, active: Boolean(tenant.snippet?.enabled) };
      },
      getRelease: () => getLatestPluginRelease(),
    },
  );

  if (result.status === 404) {
    // 404 = "no update for this key"; PUC/WordPress treat it as up-to-date.
    return NextResponse.json({ error: "No update available." }, { status: 404, headers: CORS_HEADERS });
  }

  return NextResponse.json(result.manifest, {
    status:  200,
    headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=300" },
  });
}
