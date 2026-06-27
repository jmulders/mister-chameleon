/**
 * ABM personalized-URL entry point — GET /go/{token}
 *
 * The opaque handle a lead is sent to (e.g. /go/ax93z). Resolves the lead for
 * the active tenant, stamps its id into the `mc_lead` cookie, records the visit,
 * and 307-redirects to the lead's target page. The Node-side AbmLeadEnricher then
 * personalizes subsequent pages from the cookie.
 *
 * Fail-open: unknown / paused / expired handles silently redirect to "/" — never
 * a 404 or an error that reveals the mechanism. Vanity paths (e.g.
 * /offer-for-john) reach here too: the (site)/[slug] route detects a vanity
 * match on a page miss and forwards to /go/{identifier}.
 *
 * See docs/abm-personalized-urls.md.
 */

import { NextRequest, NextResponse, after } from "next/server";
import { getActiveTenant }           from "@/tenant/get-active-tenant";
import { getAbmLeadByHandle, recordAbmVisit } from "@/lib/abm/abm-store";
import { fireAbmVisitWebhook }        from "@/lib/abm/abm-webhook";

export const runtime = "nodejs";

const LEAD_COOKIE   = "mc_lead";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await ctx.params;
  const origin    = req.nextUrl.origin;
  const home      = NextResponse.redirect(new URL("/", origin));

  let tenantId: string;
  try {
    tenantId = (await getActiveTenant()).tenantId;
  } catch {
    return home;
  }

  const lead = await getAbmLeadByHandle(tenantId, token);
  if (!lead) return home; // fail-open

  // Only allow internal redirect targets (never an open redirect).
  const target = lead.targetPath.startsWith("/") ? lead.targetPath : "/";

  const res = NextResponse.redirect(new URL(target, origin), { status: 307 });
  res.cookies.set(LEAD_COOKIE, lead.id, {
    httpOnly: true,
    sameSite: "lax",
    secure:   true,
    path:     "/",
    maxAge:   COOKIE_MAX_AGE,
  });

  // After the redirect is sent: record the visit (with the landing path) and
  // fan out the optional outbound webhook. Runs post-response via after() so it
  // never blocks the redirect, yet still executes reliably on the platform.
  after(async () => {
    await recordAbmVisit(lead.id, target);
    await fireAbmVisitWebhook(lead, target);
  });

  return res;
}
