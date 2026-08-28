/**
 * Admin — Custom Attributes
 *
 * Declare tenant domain attributes (e.g. massa / categorie / occasion) that a
 * page supplies and a rule can match with an AttributeCondition. Declaring an
 * attribute here makes it selectable in the rule editor and lets the decide
 * endpoint keep the value; undeclared attribute names are ignored server-side.
 *
 * Attribute values are client-supplied and spoofable: content variation only,
 * never access, pricing, or security. See docs/custom-attributes-spec.md.
 */

import { notFound }                  from "next/navigation";
import { getTenantById }             from "@/tenant/server";
import { getCustomAttributesAction } from "./actions";
import { AttributesClient }          from "./_components/AttributesClient";

export const dynamic = "force-dynamic";

export default async function AttributesPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  const tenant = await getTenantById(tenantId);
  if (!tenant) return notFound();

  const declarations = await getCustomAttributesAction(tenantId);

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-900">Custom attributes</h1>
        <p className="mt-1 text-sm text-neutral-500 max-w-2xl">
          Declare domain attributes the page supplies (for example a trailer
          model&apos;s mass, category, or occasion status). A declared attribute
          becomes selectable in an Attribute condition in the rule editor. Supply
          it on the page with{" "}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">data-mc-attr-&lt;name&gt;</code>{" "}
          or <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">window.mcAttributes</code>.
        </p>
      </div>

      <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-xs text-amber-800">
          Attribute values are supplied by the page and can be spoofed by a
          visitor. Use them for content variation only, never for access,
          pricing, or any security decision.
        </p>
      </div>

      <AttributesClient tenantId={tenantId} initialDeclarations={declarations} />
    </div>
  );
}
