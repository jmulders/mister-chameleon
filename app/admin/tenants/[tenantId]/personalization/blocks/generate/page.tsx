/**
 * Admin — Tenant Workspace › Adaptive blocks › Generate
 *
 * AI variant generator: a brief → a validated, aiReady draft → save as an
 * adaptive block. A per-slot cap guards against variant sprawl.
 * See docs/ai-variant-generator.md.
 */

import Link               from "next/link";
import { GenerateClient } from "./_components/GenerateClient";
import { MAX_VARIANTS_PER_SLOT } from "@/ai/variant-generator";

export default async function GenerateVariantPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  return (
    <div className="p-8 max-w-3xl space-y-5">
      <div>
        <Link
          href={`/admin/tenants/${tenantId}/personalization/blocks`}
          className="text-xs text-neutral-500 hover:text-neutral-800"
        >
          ← Adaptive blocks
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-neutral-900">Generate a variant</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Describe the audience and goal; the AI drafts a complete variant <em>with</em> its
          decision metadata, so it&apos;s instantly AI-selectable. Review before saving.
          Capped at {MAX_VARIANTS_PER_SLOT} variants per slot to keep the candidate set (and
          your rules) manageable.
        </p>
      </div>

      <GenerateClient tenantId={tenantId} />
    </div>
  );
}
