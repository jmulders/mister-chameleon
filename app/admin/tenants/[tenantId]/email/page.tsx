/**
 * Admin — Adaptive email (preview).
 *
 * Slice 1 of adaptive email: render the personalised email a KNOWN recipient
 * would get, reusing the decision engine + block library. Preview only — no send.
 * See docs/design/adaptive-email.md. Auth via the tenant workspace layout.
 */

import { notFound } from "next/navigation";
import { getTenantById } from "@/tenant/server";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EMAIL_TEMPLATES } from "@/lib/email/adaptive-email";
import { EmailPreviewClient } from "./_components/EmailPreviewClient";

export const dynamic = "force-dynamic";

export default async function AdaptiveEmailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tenant = await getTenantById(tenantId);
  if (!tenant) return notFound();

  const templates = Object.entries(EMAIL_TEMPLATES).map(([key, t]) => ({ key, label: t.label }));

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <AdminPageHeader
        eyebrow="Personalisation"
        title="Adaptive email"
        description="Preview the personalised email a known recipient would receive. Same decision engine and blocks as the website — tailored to what you know about the lead. Preview only; sending comes later."
      />
      <EmailPreviewClient tenantId={tenantId} templates={templates} />
    </div>
  );
}
