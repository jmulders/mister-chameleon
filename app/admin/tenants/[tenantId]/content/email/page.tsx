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
import { EMAIL_TEMPLATES, EMAIL_BLOCK_KEYS } from "@/lib/email/adaptive-email";
import { getEmailTemplatesAction } from "./actions";
import { listEmailVariantsAction } from "./email-variants-actions";
import { EmailPreviewClient } from "./_components/EmailPreviewClient";
import { EmailTemplatesClient } from "./_components/EmailTemplatesClient";
import { EmailVariantsEditor, type EmailTemplateMeta } from "./_components/EmailVariantsEditor";
import type { EmailVariantEntry } from "@/lib/email/email-variant";

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
  const templatesOverview = await getEmailTemplatesAction(tenantId);

  // Email-variant authoring: metadata + any authored variants per template.
  const variantTemplates: EmailTemplateMeta[] = Object.entries(EMAIL_TEMPLATES).map(([key, t]) => ({
    key,
    label:          t.label,
    defaultSubject: t.subject,
    defaultBlocks:  t.blocks.filter((b): b is string => typeof b === "string"),
  }));
  const variantLists = await Promise.all(
    variantTemplates.map((t) => listEmailVariantsAction(tenantId, t.key)),
  );
  const initialEmailVariants: Record<string, EmailVariantEntry[]> = {};
  variantTemplates.forEach((t, i) => { initialEmailVariants[t.key] = variantLists[i]; });
  const trig = (tenant as { adaptiveEmail?: { onFormSubmit?: { enabled?: boolean; templateKey?: string } } })
    .adaptiveEmail?.onFormSubmit;
  const formSubmit = {
    enabled:     !!trig?.enabled,
    templateKey: trig?.templateKey ?? (templates[0]?.key ?? ""),
  };

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <AdminPageHeader
        eyebrow="Personalisation"
        title="Adaptive email"
        description="Preview the personalised email a known recipient would receive. Same decision engine and blocks as the website, tailored to what you know about the lead. Preview only; sending comes later."
      />
      <EmailTemplatesClient tenantId={tenantId} overview={templatesOverview} />
      <EmailVariantsEditor
        tenantId={tenantId}
        blockKeys={[...EMAIL_BLOCK_KEYS]}
        templates={variantTemplates}
        initialVariants={initialEmailVariants}
      />
      <EmailPreviewClient tenantId={tenantId} templates={templates} formSubmit={formSubmit} />
    </div>
  );
}
