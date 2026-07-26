/**
 * GET /api/email/unsubscribe?t=<token>
 *
 * One-click unsubscribe for adaptive/campaign emails. Verifies the signed token,
 * adds the recipient to the tenant's suppression list, and shows a small
 * confirmation page. Idempotent — visiting twice is harmless.
 */

import { NextRequest } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe-token";
import { addSuppression } from "@/lib/lead-base/suppression-store";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function page(title: string, body: string, status = 200): Response {
  const html =
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>` +
    `<body style="margin:0;background:#f4f5f7;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">` +
    `<div style="max-width:480px;margin:64px auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;text-align:center;">` +
    `<h1 style="font-size:18px;color:#111827;margin:0 0 8px">${esc(title)}</h1>` +
    `<p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0">${body}</p>` +
    `</div></body></html>`;
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8" } });
}

export async function GET(request: NextRequest): Promise<Response> {
  const token  = request.nextUrl.searchParams.get("t") ?? "";
  const parsed = verifyUnsubscribeToken(token);

  if (!parsed) {
    return page("Invalid link", "This unsubscribe link is invalid or has expired.", 400);
  }

  await addSuppression(parsed.tenantId, parsed.email, "unsubscribe", "email-link").catch(() => {});

  return page(
    "You're unsubscribed",
    `<strong>${esc(parsed.email)}</strong> has been removed and won't receive further emails.` +
    ` Changed your mind? Just reply to any earlier email and we'll add you back.`,
  );
}
