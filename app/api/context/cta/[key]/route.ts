/**
 * POST /api/context/cta/[key]
 *
 * Resolves the contextual overlay for a CTA/content block on the current
 * request: which segment the visitor falls into (per the tenant's form-context
 * rules) and the resulting heading / text / button overrides for this block key.
 *
 * The ContextualCtaSection (client) calls this on mount, passing the page path
 * and query it rendered on; country is read server-side from the geo header.
 *
 * Request  (JSON, all optional): { path?: string; query?: Record<string,string> }
 * Response 200: { ok: true, segment: string | null, overlay: CtaOverlay | null }
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getActiveTenant } from "@/tenant/server";
import { resolveContextualCta } from "@/forms/context/load";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
): Promise<NextResponse> {
  const { key } = await params;

  let tenantId: string | undefined;
  try {
    tenantId = (await getActiveTenant()).tenantId;
  } catch {
    /* no tenant scope */
  }

  let path: string | undefined;
  const query: Record<string, string> = {};
  try {
    const raw = (await request.json()) as { path?: unknown; query?: unknown };
    if (typeof raw.path === "string") path = raw.path;
    if (raw.query && typeof raw.query === "object" && !Array.isArray(raw.query)) {
      for (const [k, v] of Object.entries(raw.query as Record<string, unknown>)) {
        if (typeof v === "string") query[k.toLowerCase()] = v;
      }
    }
  } catch {
    /* empty body is fine */
  }

  const h = await headers();
  const country = h.get("x-vercel-ip-country") || h.get("cf-ipcountry") || null;

  const { segment, overlay } = await resolveContextualCta(tenantId, key, { path, query, country });
  return NextResponse.json({ ok: true, segment, overlay }, { status: 200 });
}
