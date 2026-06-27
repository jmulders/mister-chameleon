/**
 * Tenant — Adaptive Blocks
 *
 * Per slot: list of all known block keys with their status:
 *   Customized      — this tenant has its own override
 *   Platform default — inheriting from the platform catalog
 *   Not configured  — no block defined at all
 *
 * Hover a row to Edit (customized) or Customize (platform default).
 * Customizing forks a tenant copy of the platform block and opens the edit drawer.
 */

import Link                         from "next/link";
import { ADAPTIVE_SLOT_REGISTRY }   from "@/decision/types";
import { listAdaptiveBlocksAction }  from "@/lib/adaptive-blocks/adaptive-blocks-actions";
import { TenantBlocksClient }        from "./_components/TenantBlocksClient";

interface Props {
  params: Promise<{ tenantId: string }>;
}

export default async function TenantBlocksPage({ params }: Props) {
  const { tenantId } = await params;

  // Load both tenant-specific blocks AND platform blocks in one call
  const result = await listAdaptiveBlocksAction(tenantId, /* includePlatform */ true);
  const allBlocks = result.ok ? result.blocks : [];

  const totalCustomized = allBlocks.filter((b) => b.tenantId === tenantId).length;

  return (
    <div className="p-8 space-y-8 max-w-4xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Adaptive blocks</h1>
          <p className="mt-1 text-sm text-neutral-500 max-w-2xl">
            Manage the personalised content for each adaptive slot on this tenant&apos;s site.
            Blocks marked <strong className="font-semibold text-neutral-700">Platform default</strong> inherit
            from the shared catalog — click <em>Customize</em> to create a tenant-specific version.
            Tenant blocks take full precedence over platform defaults.
          </p>
        </div>
        <Link
          href={`/admin/tenants/${tenantId}/blocks/generate`}
          className="shrink-0 rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          ✨ Generate variant
        </Link>
      </div>

      {/* Error */}
      {!result.ok && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          Failed to load blocks: {result.error}
        </div>
      )}

      {/* Stats strip */}
      <div className="flex flex-wrap gap-3">
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Customized</p>
          <p className="mt-0.5 text-xl font-semibold text-neutral-900">{totalCustomized}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Platform defaults</p>
          <p className="mt-0.5 text-xl font-semibold text-neutral-900">
            {allBlocks.filter((b) => !b.tenantId).length}
          </p>
        </div>
      </div>

      {/* Slot sections */}
      <TenantBlocksClient
        tenantId={tenantId}
        slots={ADAPTIVE_SLOT_REGISTRY.map((s) => ({
          id:          s.id,
          label:       s.label,
          description: s.description,
          keyPrefix:   s.keyPrefix,
          knownKeys:   s.knownKeys,
        }))}
        allBlocks={allBlocks}
      />

    </div>
  );
}
