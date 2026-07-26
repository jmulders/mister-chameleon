/**
 * POST /api/forms/[formKey]/context
 *
 * Resolves the contextual overlay for a form on the current request: which
 * segment the visitor falls into (per the tenant's rules) and the resulting
 * heading / intro / submit label / thank-you message / field set.
 *
 * The FormSectionBlock (client) calls this on mount, passing the page path and
 * query string it was rendered on. Country is read server-side from the geo
 * header. When no rule matches (or the feature is off) the base FormDefinition
 * copy/fields are returned, so the caller can render uniformly.
 *
 * Request  (JSON, all optional):
 *   { path?: string; query?: Record<string,string> }
 * Response 200:
 *   { ok: true, form: ResolvedForm }         // segment may be null
 * Response 404:
 *   { ok: false, error: "Form not found" }    // unknown / CMS-only form key
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getActiveTenant } from "@/tenant/server";
import { resolveContextualForm } from "@/forms/context/load";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ formKey: string }> },
): Promise<NextResponse> {
  const { formKey } = await params;

  // Tenant scope (non-fatal — falls back to base form when unresolved).
  let tenantId: string | undefined;
  try {
    tenantId = (await getActiveTenant()).tenantId;
  } catch {
    /* no tenant scope */
  }

  // Signals from the client (path + query it rendered on).
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
    /* empty body is fine — resolves against path/country only */
  }

  // Country from the platform geo header (best-effort).
  const h = await headers();
  const country =
    h.get("x-vercel-ip-country") ||
    h.get("cf-ipcountry") ||
    null;

  const form = await resolveContextualForm(tenantId, formKey, { path, query, country });
  if (!form) {
    return NextResponse.json({ ok: false, error: "Form not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, form }, { status: 200 });
}
