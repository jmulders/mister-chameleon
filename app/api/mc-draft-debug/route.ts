import { NextRequest, NextResponse } from "next/server";
import { getDraft } from "@/lib/statamic-draft-store";
import { createDraftStatamicProvider } from "@/cms";

/**
 * TEMPORARY diagnostic endpoint for Live Preview debugging.
 *
 * GET /api/mc-draft-debug?token=XXX
 *
 * Returns which Supabase project the production runtime actually uses, whether
 * getDraft() resolves the token at runtime, and the raw query param — so we can
 * pinpoint why ?_mc_draft= isn't applied. Safe (read-only, booleans only).
 * REMOVE after the live-preview issue is resolved.
 */

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";

  let supabaseHost: string | null = null;
  try {
    supabaseHost = new URL(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "",
    ).host;
  } catch {
    supabaseHost = null;
  }

  let found = false;
  let blockCount = -1;
  let error: string | null = null;
  let pageSections = -1;
  let pageTitle: string | null = null;
  let providerError: string | null = null;
  try {
    const entry = await getDraft(token);
    found = entry !== null;
    blockCount = Array.isArray(entry?.blocks) ? entry!.blocks.length : -1;

    if (entry) {
      try {
        const provider = createDraftStatamicProvider(entry.blocks);
        const page = await provider.getPageBySlug("home", "nl");
        pageSections = Array.isArray(page?.sections) ? page!.sections.length : -1;
        pageTitle = page?.title ?? null;
      } catch (pe) {
        providerError = String(pe);
      }
    }
  } catch (e) {
    error = String(e);
  }

  return NextResponse.json(
    {
      receivedToken: token,
      supabaseHost,
      serviceKeyPresent: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      getDraftFound: found,
      blockCount,
      pageSections,
      pageTitle,
      providerError,
      error,
      nodeEnv: process.env.NODE_ENV,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
