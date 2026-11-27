/**
 * GET /api/billing/invoices/{number}/pdf?tenantId=…
 *
 * An invoice the platform issued, as a PDF. Only for someone with a session
 * that may see this tenant, and only an invoice of this tenant: the number
 * alone is not enough to read one.
 */

import { NextRequest, NextResponse } from "next/server";
import { getDb }                     from "@/data/db";
import { guardTenantRoute }          from "@/lib/admin-auth/route-guard";
import { getInvoice, invoiceForPdf } from "@/billing/invoices";
import { invoicePdf }                from "@/billing/invoice-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ number: string }> },
): Promise<NextResponse> {
  const tenantId = request.nextUrl.searchParams.get("tenantId");
  const guard = await guardTenantRoute(tenantId);
  if (!guard.ok) return guard.response;

  const { number } = await context.params;
  if (typeof tenantId !== "string" || !/^\d{8}-\d{4,}$/.test(number)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const invoice = await getInvoice(getDb(), tenantId, number);
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pdf = invoicePdf(invoiceForPdf(invoice));
  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `attachment; filename="factuur-${invoice.number}.pdf"`,
      "Cache-Control":       "private, no-store",
    },
  });
}
