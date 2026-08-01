/**
 * Admin — New page (from preset)
 *
 * Route: /admin/tenants/[tenantId]/content/pages/new
 *
 * Server component that:
 *   1. Reads all registered presets from the central registry.
 *   2. Binds the tenant-scoped createPageFromPresetAction.
 *   3. Renders the <NewPageForm> client component.
 *
 * On submit the client component calls the bound action, which persists the
 * new page to the store and returns the new pageId.  The client then navigates
 * directly to the new page's editor (/admin/tenants/[tenantId]/content/pages/[pageId]).
 */

import Link                        from "next/link";
import { notFound }                from "next/navigation";
import { getAllPresets }            from "@/page-config";
import { Text }                    from "@/components/primitives/Text";
import { NewPageForm }             from "./NewPageForm";
import { createPageFromPresetAction } from "./actions";

export default async function NewTenantPagePage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  // Mirror the format check from the pages list page to avoid blank states.
  const validSlug = /^[a-z0-9-]+$/.test(tenantId);
  if (!validSlug) notFound();

  const presets     = getAllPresets();
  // Bind tenantId into the server action — client never sees it.
  const boundAction = createPageFromPresetAction.bind(null, tenantId);

  return (
    <div className="p-8">
      {/* Back link */}
      <div className="mb-4">
        <Link
          href={`/admin/tenants/${tenantId}/content/pages`}
          className="text-xs text-neutral-400 transition-colors hover:text-brand-700"
        >
          ← Back to pages
        </Link>
      </div>

      {/* Heading */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-neutral-900">New page</h1>
        <Text variant="body-sm" color="muted" className="mt-1">
          Choose a preset to scaffold the page structure, then set a title and
          slug.  All blocks and content can be edited after creation.
        </Text>
      </div>

      {/* Form */}
      <NewPageForm
        presets={presets}
        tenantId={tenantId}
        onSubmit={boundAction}
      />
    </div>
  );
}
