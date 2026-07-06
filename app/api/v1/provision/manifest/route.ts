/**
 * GET /api/v1/provision/manifest
 *
 * Provisioning endpoint. The PLATFORM is the single source of truth for the
 * blocks, context slots, render templates and design tokens. This endpoint
 * generates the build artifacts for the requesting tenant — shaped for THEIR
 * CMS (tenant.cms.provider) and styled with THEIR tokens — and the per-CMS
 * adapter writes them into the site (Statamic addon: `php please mc:sync`).
 *
 * This is how a change made once in the platform rolls out everywhere without
 * hand-editing each CMS, and why the CMS and platform never drift.
 *
 * ─── Auth ────────────────────────────────────────────────────────────────────
 *   Authorization: Bearer <tenant_key>     (the public siteKey)
 *   …or ?siteKey=<tenant_key> for convenience.
 *
 * ─── Response (200) ──────────────────────────────────────────────────────────
 *   { cms, version, artifacts: [{ path, contents }, …] }
 *
 *   403 unknown/disabled key · 501 CMS not yet supported · 500 internal
 */

import { NextRequest, NextResponse } from "next/server";
import { getTenantBySiteKey } from "@/tenant/server";
import { generateStatamicManifest } from "@/provisioning/generators/statamic";
import type { TokenOverrides } from "@/provisioning/tokens-css";
import type { TenantSettings } from "@/tenant/types";
import { logger } from "@/lib/logger";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/** Pull a tenant's brand/neutral/font overrides from its theme, if any. */
function tokenOverridesFromTenant(tenant: TenantSettings): TokenOverrides {
  // tenant.theme is optional and loosely typed across providers; read defensively.
  const theme = (tenant as unknown as { theme?: Record<string, unknown> }).theme ?? {};
  const overrides: TokenOverrides = {};

  const brand = theme["brand"] as Record<string, string> | undefined;
  const neutral = theme["neutral"] as Record<string, string> | undefined;
  const fontSans = theme["fontSans"] as string | undefined;

  if (brand && typeof brand === "object") overrides.brand = brand as TokenOverrides["brand"];
  if (neutral && typeof neutral === "object") overrides.neutral = neutral as TokenOverrides["neutral"];
  if (typeof fontSans === "string") overrides.fontSans = fontSans;

  return overrides;
}

export async function GET(request: NextRequest) {
  // ── Resolve site key (bearer header preferred) ───────────────────────────────
  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const siteKey = bearer || request.nextUrl.searchParams.get("siteKey") || "";

  if (!siteKey) {
    return NextResponse.json(
      { error: "Missing tenant key. Send Authorization: Bearer <key>." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  let tenant: TenantSettings | null = null;
  try {
    tenant = await getTenantBySiteKey(siteKey);
  } catch (err) {
    logger.error("[provision/manifest] tenant lookup failed", { error: String(err) });
    return NextResponse.json({ error: "Internal error." }, { status: 500, headers: CORS_HEADERS });
  }

  if (!tenant) {
    return NextResponse.json({ error: "Unknown tenant key." }, { status: 403, headers: CORS_HEADERS });
  }

  // Typed as string so we can branch on CMS providers (e.g. "wordpress") that
  // aren't yet in the platform's CMSProviderName union.
  const provider: string = tenant.cms?.provider ?? "platform";
  const overrides = tokenOverridesFromTenant(tenant);

  try {
    switch (provider) {
      case "statamic": {
        // Pass the tenant's named block token sets so the per-block
        // "Design token set" field renders as a dropdown of their names.
        const sets = (tenant.design?.blockTokenSets ?? []).map((s) => ({ key: s.key, name: s.name }));
        const manifest = generateStatamicManifest(overrides, sets);
        return NextResponse.json(manifest, { status: 200, headers: CORS_HEADERS });
      }

      // WordPress / Sanity / Storyblok generators are wired the same way — each
      // turns the canonical definitions into its own artifact shape. Not yet
      // implemented; returns a clear 501 so the addon can report it cleanly.
      case "wordpress":
      case "sanity":
      case "storyblok":
        return NextResponse.json(
          { error: `Provisioning for "${provider}" is not available yet.`, cms: provider },
          { status: 501, headers: CORS_HEADERS },
        );

      default:
        return NextResponse.json(
          { error: `No provisioning generator for CMS "${provider}".`, cms: provider },
          { status: 501, headers: CORS_HEADERS },
        );
    }
  } catch (err) {
    logger.error("[provision/manifest] generation failed", {
      tenantId: tenant.tenantId,
      provider,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Could not generate manifest." }, { status: 500, headers: CORS_HEADERS });
  }
}
