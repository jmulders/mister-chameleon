/**
 * Admin — Contextual forms.
 *
 * Define rules (URL/UTM/query/country → segment) and, per form per segment,
 * override the heading, intro, submit label, thank-you message, and field set.
 * Stored in tenant settings (settings.formContext). Auth via the tenant layout.
 */

export const runtime = "nodejs";

import { notFound } from "next/navigation";
import Link from "next/link";
import { getTenantById } from "@/tenant/server";
import { getAllFormDefinitions } from "@/forms";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { saveFormContextAction } from "./actions";
import { FormContextClient } from "./_components/FormContextClient";
import type { TenantFormContext, TenantBlockContext } from "@/forms/context/types";

export default async function ContextualFormsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tenant = await getTenantById(tenantId);
  if (!tenant) return notFound();

  const initial: TenantFormContext =
    (tenant as { formContext?: TenantFormContext }).formContext ?? { rules: [], overlays: {} };
  const initialBlock: TenantBlockContext =
    (tenant as { blockContext?: TenantBlockContext }).blockContext ?? { overlays: {} };

  const forms = getAllFormDefinitions().map((d) => ({
    key:         d.key,
    title:       d.title,
    description: d.description,
    fields:      d.fields,
  }));

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <AdminPageHeader
        eyebrow="Personalisation"
        title="Contextual forms"
        description="Show a different heading, intro, call-to-action, thank-you message, and even a different set of fields depending on where the visitor comes from — using your own rules on URL, UTM, query string, and country."
      />
      <div className="text-sm">
        <Link href={`/admin/tenants/${tenantId}/forms`} className="text-indigo-600 hover:underline">← Back to form settings</Link>
      </div>
      <FormContextClient tenantId={tenantId} initial={initial} initialBlock={initialBlock} forms={forms} />
    </div>
  );
}
