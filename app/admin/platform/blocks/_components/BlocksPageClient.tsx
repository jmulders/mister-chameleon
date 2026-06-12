"use client";

/**
 * BlocksPageClient
 *
 * Client wrapper for the Adaptive Blocks catalog page.
 * Renders all slot sections with Edit buttons and manages the
 * EditBlockDrawer open/close state and post-save refresh.
 */

import { useState, useCallback } from "react";
import { useRouter }              from "next/navigation";
import { EditBlockDrawer }        from "./EditBlockDrawer";
import type { AdaptiveBlockData } from "@/cms/types";

// ── BlockRow ──────────────────────────────────────────────────────────────────

function BlockRow({
  blockKey,
  block,
  onEdit,
}: {
  blockKey: string;
  block:    AdaptiveBlockData | undefined;
  onEdit:   (block: AdaptiveBlockData) => void;
}) {
  if (!block) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-4 py-2.5 opacity-60">
        <code className="text-xs font-mono text-neutral-400 min-w-0 flex-1 truncate">
          {blockKey}
        </code>
        <span className="shrink-0 text-[10px] text-neutral-400 italic">not created yet</span>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 hover:border-neutral-300 transition-colors">
      {/* Key */}
      <code className="text-xs font-mono font-semibold text-neutral-800 min-w-0 flex-1 truncate">
        {block.key}
      </code>

      {/* Headline preview */}
      {block.defaultVariant.title && (
        <span className="hidden sm:block text-[11px] text-neutral-400 truncate max-w-[200px]">
          {block.defaultVariant.title.length > 55
            ? `${block.defaultVariant.title.slice(0, 55)}…`
            : block.defaultVariant.title}
        </span>
      )}

      {/* Active badge */}
      <span className={[
        "shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1",
        block.isActive
          ? "bg-green-50 text-green-700 ring-green-200"
          : "bg-neutral-100 text-neutral-400 ring-neutral-200",
      ].join(" ")}>
        {block.isActive ? "active" : "inactive"}
      </span>

      {/* Edit button */}
      <button
        type="button"
        onClick={() => onEdit(block)}
        className="shrink-0 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-600 opacity-0 group-hover:opacity-100 hover:border-brand-300 hover:text-brand-600 transition-all"
      >
        Edit
      </button>
    </div>
  );
}

// ── SlotSection ───────────────────────────────────────────────────────────────

function SlotSection({
  id,
  label,
  keyPrefix,
  knownKeys,
  blocks,
  onEdit,
}: {
  id:        string;
  label:     string;
  keyPrefix: string;
  knownKeys: readonly string[];
  blocks:    AdaptiveBlockData[];
  onEdit:    (block: AdaptiveBlockData) => void;
}) {
  const blockMap = new Map(
    blocks.filter((b) => b.key.startsWith(keyPrefix)).map((b) => [b.key, b]),
  );

  const slotColors: Record<string, string> = {
    hero:         "bg-brand-50 text-brand-700 ring-brand-200",
    proof:        "bg-teal-50 text-teal-700 ring-teal-200",
    cta:          "bg-amber-50 text-amber-700 ring-amber-200",
    feature:      "bg-purple-50 text-purple-700 ring-purple-200",
    conversion:   "bg-green-50 text-green-700 ring-green-200",
    notification: "bg-red-50 text-red-700 ring-red-200",
  };

  const coveredCount   = knownKeys.filter((k) => blockMap.has(k)).length;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-neutral-900">{label}</h2>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${slotColors[id] ?? "bg-neutral-100 text-neutral-600 ring-neutral-200"}`}>
          {coveredCount} / {knownKeys.length}
        </span>
      </div>
      <div className="space-y-2">
        {knownKeys.map((key) => (
          <BlockRow
            key={key}
            blockKey={key}
            block={blockMap.get(key)}
            onEdit={onEdit}
          />
        ))}
      </div>
    </section>
  );
}

// ── BlocksPageClient ───────────────────────────────────────────────────────────

interface SlotSpec {
  id:          string;
  label:       string;
  description: string;
  keyPrefix:   string;
  knownKeys:   readonly string[];
}

interface BlocksPageClientProps {
  slots:  readonly SlotSpec[];
  blocks: AdaptiveBlockData[];
}

export function BlocksPageClient({ slots, blocks }: BlocksPageClientProps) {
  const router = useRouter();

  const [editingBlock, setEditingBlock] = useState<AdaptiveBlockData | null>(null);

  const handleSaved = useCallback(() => {
    setEditingBlock(null);
    router.refresh();
  }, [router]);

  return (
    <>
      <div className="space-y-12">
        {slots.map((slot) => (
          <SlotSection
            key={slot.id}
            id={slot.id}
            label={slot.label}
            keyPrefix={slot.keyPrefix}
            knownKeys={slot.knownKeys}
            blocks={blocks}
            onEdit={setEditingBlock}
          />
        ))}
      </div>

      {editingBlock && (
        <EditBlockDrawer
          block={editingBlock}
          tenantId=""
          revalidatePath="/admin/platform/blocks"
          onClose={() => setEditingBlock(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
