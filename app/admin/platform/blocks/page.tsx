/**
 * Platform — Adaptive Blocks Catalog
 *
 * Per slot:
 *   • Eén interactieve preview (layout variant + uitlijning toggles) — links
 *   • Compacte lijst van alle bekende block-keys met status — rechts
 *
 * De preview toont de mogelijkheden van het slot-type (layout varianten,
 * uitlijning, media), niet de individuele content per block.
 * Alle blocks binnen een slot hebben dezelfde structurele opties.
 */

import Link                        from "next/link";
import { ADAPTIVE_SLOT_REGISTRY }  from "@/decision/types";
import { listPlatformBlocksAction } from "@/lib/adaptive-blocks/adaptive-blocks-actions";
import { SeedButton }              from "./_components/SeedButton";
import { BlocksPageClient }        from "./_components/BlocksPageClient";

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PlatformBlocksPage() {
  const result = await listPlatformBlocksAction();
  const blocks = result.ok ? result.blocks : [];

  const totalBlocks  = blocks.length;
  const activeBlocks = blocks.filter((b) => b.isActive).length;
  const coveredSlots = new Set(
    blocks.map((b) => {
      const slot = ADAPTIVE_SLOT_REGISTRY.find((s) => b.key.startsWith(s.keyPrefix));
      return slot?.id ?? "unknown";
    }),
  ).size;

  const totalKnownKeys = ADAPTIVE_SLOT_REGISTRY.reduce(
    (acc, s) => acc + s.knownKeys.length, 0,
  );
  const missingBlocks = totalKnownKeys - totalBlocks;

  return (
    <div className="p-8 space-y-8 max-w-5xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Adaptive blocks catalog</h1>
          <p className="mt-1 text-sm text-neutral-500 max-w-2xl">
            Platform-wide blocks available to all tenants. Per slot you can see the structural
            options (layout variant, alignment, media) and a list of all known block keys.
            Tenant-specific overrides live on the{" "}
            <Link href="/admin/tenants" className="underline hover:text-neutral-700">
              tenant content page
            </Link>
            .
          </p>
        </div>
        {totalBlocks > 0 && <SeedButton hasBlocks />}
      </div>

      {/* Error */}
      {!result.ok && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          Failed to load blocks: {result.error}
        </div>
      )}

      {/* Seed banner */}
      {totalBlocks === 0 && <SeedButton hasBlocks={false} />}

      {/* Stats */}
      {totalBlocks > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Platform blocks",  value: totalBlocks,   sub: `${totalKnownKeys} known` },
            { label: "Active blocks",    value: activeBlocks,  sub: `${totalBlocks - activeBlocks} inactive` },
            { label: "Slots covered",    value: coveredSlots,  sub: `of ${ADAPTIVE_SLOT_REGISTRY.length} total` },
            { label: "Still to create",  value: missingBlocks, sub: "in catalog" },
          ].map(({ label, value, sub }) => (
            <div key={label} className="rounded-lg bg-neutral-50 border border-neutral-200 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{label}</p>
              <p className="mt-1 text-2xl font-semibold text-neutral-900">{value}</p>
              <p className="text-[11px] text-neutral-400">{sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Info callout */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
        <p className="text-xs font-semibold text-blue-800">How adaptive blocks work</p>
        <p className="mt-0.5 text-xs text-blue-700 max-w-2xl">
          The decision engine selects the right block based on visitor signals
          (traffic source, intent, company). The block key determines which content is shown.
          Tokens like{" "}
          <code className="font-mono text-blue-600">{"{{company_name}}"}</code> and{" "}
          <code className="font-mono text-blue-600">{"{{industry}}"}</code> are
          resolved from visitor context at render time.
          Hover any block row and click <strong>Edit</strong> to update its content.
        </p>
      </div>

      {/* Slot sections — interactive edit via BlocksPageClient */}
      <BlocksPageClient
        slots={ADAPTIVE_SLOT_REGISTRY.map((s) => ({
          id:          s.id,
          label:       s.label,
          description: s.description,
          keyPrefix:   s.keyPrefix,
          knownKeys:   s.knownKeys,
        }))}
        blocks={blocks}
      />

    </div>
  );
}
