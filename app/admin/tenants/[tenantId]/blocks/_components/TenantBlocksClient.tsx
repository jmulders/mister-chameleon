"use client";

/**
 * TenantBlocksClient
 *
 * Interactive block list for a specific tenant.
 *
 * Per block key shows:
 *   - "Customized"         — tenant has its own row (edit button)
 *   - "Platform default"   — using platform block (customize button)
 *   - "Not configured"     — no block exists at all (create button)
 *
 * Customize = calls activateBlockForTenantAction to fork a tenant copy,
 *             then immediately opens the edit drawer.
 */

import { useState, useCallback, useTransition } from "react";
import { useRouter }                             from "next/navigation";
import { EditBlockDrawer }                       from "@/components/admin/EditBlockDrawer";
import type { BlockTokenSet }                     from "@/design-system/theme/block-token-set";
import { activateBlockForTenantAction }          from "@/lib/adaptive-blocks/adaptive-blocks-actions";
import type { AdaptiveBlockData }                from "@/cms/types";

// ── Types ──────────────────────────────────────────────────────────────────────

type BlockStatus = "customized" | "platform" | "missing";

interface ResolvedBlock {
  blockKey:       string;
  status:         BlockStatus;
  tenantBlock?:   AdaptiveBlockData;
  platformBlock?: AdaptiveBlockData;
}

// ── BlockRow ──────────────────────────────────────────────────────────────────

function BlockRow({
  resolved,
  tenantId,
  revalidatePath,
  onEdit,
  onCustomized,
}: {
  resolved:       ResolvedBlock;
  tenantId:       string;
  revalidatePath: string;
  onEdit:         (block: AdaptiveBlockData) => void;
  onCustomized:   (block: AdaptiveBlockData) => void;
}) {
  const [forking, startFork] = useTransition();
  const block = resolved.tenantBlock ?? resolved.platformBlock;

  function handleCustomize() {
    startFork(async () => {
      const res = await activateBlockForTenantAction(
        resolved.blockKey,
        tenantId,
        true,
        revalidatePath,
      );
      if (res.ok) {
        // Fetch the newly created tenant block from the action result
        // activateBlockForTenantAction returns { ok, id } — we build a minimal
        // block to open the drawer; the drawer will re-save with real content.
        const base = resolved.platformBlock ?? resolved.tenantBlock;
        if (base) {
          onCustomized({ ...base, id: res.id, tenantId });
        }
      }
    });
  }

  const statusBadge = {
    customized: (
      <span className="inline-flex items-center rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700 ring-1 ring-brand-200">
        Customized
      </span>
    ),
    platform: (
      <span className="inline-flex items-center rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 ring-1 ring-neutral-200">
        Platform default
      </span>
    ),
    missing: (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 ring-1 ring-amber-200">
        Not configured
      </span>
    ),
  }[resolved.status];

  return (
    <div className={[
      "group flex items-center gap-3 rounded-lg border px-4 py-2.5 transition-colors",
      resolved.status === "customized"
        ? "border-brand-200 bg-brand-50/30 hover:border-brand-300"
        : resolved.status === "platform"
          ? "border-neutral-200 bg-white hover:border-neutral-300"
          : "border-dashed border-neutral-200 bg-neutral-50/50",
    ].join(" ")}>

      <code className="min-w-0 flex-1 truncate text-xs font-mono font-semibold text-neutral-800">
        {resolved.blockKey}
      </code>

      {block?.defaultVariant.title && (
        <span className="hidden sm:block max-w-[200px] truncate text-[11px] text-neutral-400">
          {block.defaultVariant.title.length > 55
            ? `${block.defaultVariant.title.slice(0, 55)}…`
            : block.defaultVariant.title}
        </span>
      )}

      {statusBadge}

      {/* Actions */}
      {resolved.status === "customized" && resolved.tenantBlock && (
        <button
          type="button"
          onClick={() => onEdit(resolved.tenantBlock!)}
          className="shrink-0 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-600 opacity-0 transition-all hover:border-brand-300 hover:text-brand-600 group-hover:opacity-100"
        >
          Edit
        </button>
      )}

      {resolved.status === "platform" && (
        <button
          type="button"
          onClick={handleCustomize}
          disabled={forking}
          className="shrink-0 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-600 opacity-0 transition-all hover:border-brand-300 hover:text-brand-700 group-hover:opacity-100 disabled:opacity-40"
        >
          {forking ? "…" : "Customize"}
        </button>
      )}

      {resolved.status === "missing" && (
        <button
          type="button"
          onClick={handleCustomize}
          disabled={forking}
          className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 opacity-0 transition-all hover:bg-amber-100 group-hover:opacity-100 disabled:opacity-40"
        >
          {forking ? "…" : "Create"}
        </button>
      )}

    </div>
  );
}

// ── SlotSection ───────────────────────────────────────────────────────────────

function SlotSection({
  id,
  label,
  description,
  keyPrefix,
  knownKeys,
  tenantId,
  revalidatePath,
  allBlocks,
  onEdit,
  onCustomized,
}: {
  id:             string;
  label:          string;
  description:    string;
  keyPrefix:      string;
  knownKeys:      readonly string[];
  tenantId:       string;
  revalidatePath: string;
  allBlocks:      AdaptiveBlockData[];
  onEdit:         (block: AdaptiveBlockData) => void;
  onCustomized:   (block: AdaptiveBlockData) => void;
}) {
  const tenantMap   = new Map(
    allBlocks.filter((b) => b.tenantId === tenantId && b.key.startsWith(keyPrefix)).map((b) => [b.key, b]),
  );
  const platformMap = new Map(
    allBlocks.filter((b) => !b.tenantId && b.key.startsWith(keyPrefix)).map((b) => [b.key, b]),
  );

  const resolved: ResolvedBlock[] = knownKeys.map((key) => {
    const tenantBlock   = tenantMap.get(key);
    const platformBlock = platformMap.get(key);
    const status: BlockStatus = tenantBlock ? "customized" : platformBlock ? "platform" : "missing";
    return { blockKey: key, status, tenantBlock, platformBlock };
  });

  const customizedCount = resolved.filter((r) => r.status === "customized").length;

  const slotColors: Record<string, string> = {
    hero:         "bg-brand-50 text-brand-700 ring-brand-200",
    proof:        "bg-teal-50 text-teal-700 ring-teal-200",
    cta:          "bg-amber-50 text-amber-700 ring-amber-200",
    feature:      "bg-purple-50 text-purple-700 ring-purple-200",
    conversion:   "bg-green-50 text-green-700 ring-green-200",
    notification: "bg-red-50 text-red-700 ring-red-200",
  };

  return (
    <section className="space-y-3">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-sm font-semibold text-neutral-900">{label}</h2>
          {customizedCount > 0 && (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${slotColors[id] ?? "bg-neutral-100 text-neutral-600 ring-neutral-200"}`}>
              {customizedCount} customized
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-neutral-400 max-w-2xl">{description}</p>
      </div>
      <div className="space-y-2">
        {resolved.map((r) => (
          <BlockRow
            key={r.blockKey}
            resolved={r}
            tenantId={tenantId}
            revalidatePath={revalidatePath}
            onEdit={onEdit}
            onCustomized={onCustomized}
          />
        ))}
      </div>
    </section>
  );
}

// ── TenantBlocksClient ────────────────────────────────────────────────────────

interface SlotSpec {
  id:          string;
  label:       string;
  description: string;
  keyPrefix:   string;
  knownKeys:   readonly string[];
}

interface TenantBlocksClientProps {
  tenantId:   string;
  slots:      readonly SlotSpec[];
  allBlocks:  AdaptiveBlockData[];
  blockTokenSets?: readonly BlockTokenSet[];
}

export function TenantBlocksClient({ tenantId, slots, allBlocks, blockTokenSets = [] }: TenantBlocksClientProps) {
  const router          = useRouter();
  const revalidatePath  = `/admin/tenants/${tenantId}/blocks`;
  const [editing, setEditing] = useState<AdaptiveBlockData | null>(null);

  const handleSaved = useCallback(() => {
    setEditing(null);
    router.refresh();
  }, [router]);

  return (
    <>
      <div className="space-y-10">
        {slots.map((slot) => (
          <SlotSection
            key={slot.id}
            id={slot.id}
            label={slot.label}
            description={slot.description}
            keyPrefix={slot.keyPrefix}
            knownKeys={slot.knownKeys}
            tenantId={tenantId}
            revalidatePath={revalidatePath}
            allBlocks={allBlocks}
            onEdit={setEditing}
            onCustomized={(block) => setEditing(block)}
          />
        ))}
      </div>

      {editing && (
        <EditBlockDrawer
          block={{ ...editing, tenantId }}
          tenantId={tenantId}
          revalidatePath={revalidatePath}
          blockTokenSets={blockTokenSets}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
