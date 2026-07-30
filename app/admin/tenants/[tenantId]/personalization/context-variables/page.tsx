/**
 * Tenant Workspace — Context Variables
 *
 * Context variable metadata management within the tenant workspace.
 *
 * ─── Tenant context note ──────────────────────────────────────────────────────
 *
 *   Context variables are currently platform-wide — they are defined in
 *   context/registry.ts and the context_variable_metadata table has no
 *   tenant_id column.  Changes made here affect all tenants.
 *
 *   This page is surfaced inside the tenant workspace so operators can
 *   inspect and manage context variables without leaving the tenant context
 *   they are working in.  A prominent notice clarifies the platform-wide scope.
 *
 * ─── Functionality ────────────────────────────────────────────────────────────
 *
 *   Identical to /admin/context — full CRUD via ContextVariableManager:
 *     • Toggle enabled / disabled per variable
 *     • Edit label, description, category, availability gates
 *     • Create custom variables
 *     • Delete custom variables (built-ins are protected)
 */

import Link             from "next/link";
import { notFound }     from "next/navigation";
import { getTenantById }          from "@/tenant/server";
import { getMergedContextVariables } from "@/context/merged-registry";
import { ContextVariableManager }    from "@/app/admin/context/ContextVariableManager";

export default async function TenantContextPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  const tenant = await getTenantById(tenantId);
  if (!tenant) notFound();

  const vars = await getMergedContextVariables();

  return (
    <div className="p-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-900">Context Variables</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Manage the metadata for all runtime context variables available to the
          decision engine.
        </p>
      </div>

      {/* Platform-wide notice */}
      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-xs font-semibold text-amber-800">
          Platform-wide settings
        </p>
        <p className="mt-0.5 text-xs text-amber-700">
          Context variables are shared across all tenants. Changes here affect the
          entire platform, not just{" "}
          <code className="font-mono font-semibold">{tenantId}</code>.{" "}
          <Link
            href="/admin/context"
            className="underline hover:text-amber-900"
          >
            View in global admin →
          </Link>
        </p>
      </div>

      {/* Interactive manager */}
      <ContextVariableManager initialVars={vars} />
    </div>
  );
}
