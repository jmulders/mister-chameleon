/**
 * GET /api/wp-plugin/update
 *
 * Update manifest for the self-hosted "Mister Chameleon Connect" WordPress plugin.
 * The plugin polls this endpoint (cached 6h server-side there) and, when the
 * returned `version` is newer than the installed one, WordPress surfaces the
 * update in its normal plugin screen. See lib/wp-plugin/manifest.ts.
 *
 * Public and side-effect free — it only exposes the latest public version and a
 * download URL. CORS is open so the check works from any site.
 */

import { NextResponse } from "next/server";
import { wpPluginManifest } from "@/lib/wp-plugin/manifest";

export function GET() {
  return NextResponse.json(wpPluginManifest(), {
    status: 200,
    headers: {
      "Cache-Control":                "public, max-age=300",
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
