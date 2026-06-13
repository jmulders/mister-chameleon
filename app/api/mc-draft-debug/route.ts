import { NextRequest, NextResponse } from "next/server";
import { getDraft } from "@/lib/statamic-draft-store";
import { createCMSProvider, createDraftStatamicProvider } from "@/cms";
import { getActiveTenant, getTenantById } from "@/tenant/server";

/**
 * TEMPORARY diagnostic endpoint for Live Preview / tenant-resolution debugging.
 * GET /api/mc-draft-debug?token=XXX
 * Safe (read-only). REMOVE after the issue is resolved.
 */

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const out: Record<string, unknown> = {};

  // ── Supabase / draft store ────────────────────────────────────────────────
  try {
    out.supabaseHost = new URL(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "",
    ).host;
  } catch { out.supabaseHost = null; }

  try {
    const entry = await getDraft(token);
    out.getDraftFound = entry !== null;
    out.blockCount = Array.isArray(entry?.blocks) ? entry!.blocks.length : -1;
    if (entry) {
      const p = createDraftStatamicProvider(entry.blocks);
      const page = await p.getPageBySlug("home", "nl");
      out.draftPageSections = Array.isArray(page?.sections) ? page!.sections.length : -1;
    }
  } catch (e) { out.draftError = String(e); }

  // ── Tenant + CMS provider resolution (the live homepage path) ─────────────
  try {
    const tc = await getActiveTenant();
    out.tenantId = tc.tenantId;
    out.staticCmsProvider = (tc as { cmsProvider?: string }).cmsProvider ?? null;

    const t = await getTenantById(tc.tenantId);
    out.dbTenantFound = t !== null;
    out.dbCms = (t as { cms?: unknown } | null)?.cms ?? null;

    const provider = createCMSProvider(
      (t as { cms?: never } | null)?.cms,
      tc.tenantId,
      "nl",
    );
    out.providerClass = provider.constructor?.name ?? null;

    const home = await provider.getPageBySlug("home", "nl");
    out.homeTitle = home?.title ?? null;
    out.homeSections = Array.isArray(home?.sections) ? home!.sections.length : -1;
  } catch (e) { out.tenantError = String(e); }

  // ── Env presence (no values) ──────────────────────────────────────────────
  out.env = {
    SANITY_PROJECT_ID: !!process.env.SANITY_PROJECT_ID,
    STATAMIC_API_URL: !!process.env.STATAMIC_API_URL,
    STORYBLOK_ACCESS_TOKEN: !!process.env.STORYBLOK_ACCESS_TOKEN,
  };

  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
