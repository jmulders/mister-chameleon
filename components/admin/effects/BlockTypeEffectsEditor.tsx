"use client";

/**
 * BlockTypeEffectsEditor
 *
 * Per-block-type default motion effects (design.blockTypeEffects), keyed by
 * context block type. This is the tier between a block's own instance ref and the
 * tenant-wide default: e.g. "every Hero reveals" without touching each block.
 *
 * Each type has its own declarative effect list (reusing the shared
 * EffectListEditor) and its own focused save (setBlockTypeEffectsAction), so this
 * saves independently of the big settings form. English admin UI.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BlockEffectConfig } from "@/design-system/effects/effect-ref";
import { EffectListEditor } from "@/components/admin/effects/EffectListEditor";
import { setBlockTypeEffectsAction } from "@/app/admin/tenants/[tenantId]/design/effect-set-actions";

const btnPrimary = "rounded bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60";

const BLOCK_TYPES: readonly { key: string; label: string }[] = [
  { key: "hero",         label: "Hero" },
  { key: "proof",        label: "Proof" },
  { key: "cta",          label: "CTA" },
  { key: "feature",      label: "Feature" },
  { key: "conversion",   label: "Conversion" },
  { key: "notification", label: "Notification" },
];

type EffectMap = Partial<Record<string, readonly BlockEffectConfig[]>>;

function TypeRow({
  tenantId, blockType, label, initial, onSaved,
}: {
  tenantId:  string;
  blockType: string;
  label:     string;
  initial:   readonly BlockEffectConfig[];
  onSaved:   (msg: { kind: "ok" | "error"; text: string }) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [effects, setEffects] = useState<BlockEffectConfig[]>([...initial]);

  function save() {
    start(async () => {
      const r = await setBlockTypeEffectsAction(tenantId, blockType, effects);
      if (r.ok) { onSaved({ kind: "ok", text: `Saved default effects for ${label}.` }); router.refresh(); }
      else onSaved({ kind: "error", text: r.error });
    });
  }

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{label}</span>
        <button type="button" className={btnPrimary} disabled={pending} onClick={save}>
          {pending ? "Saving..." : "Save"}
        </button>
      </div>
      <EffectListEditor value={effects} onChange={setEffects} />
    </div>
  );
}

export function BlockTypeEffectsEditor({
  tenantId,
  initial,
}: {
  tenantId: string;
  initial:  EffectMap;
}) {
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
        Default motion per block type. A block that has its own effect (set in Personalization -&gt;
        Blocks) overrides this; a type with no default falls back to the tenant-wide default effects
        (Design -&gt; Block styles).
      </p>
      {status && (
        <div style={{ fontSize: 12, color: status.kind === "ok" ? "#15803d" : "#b91c1c" }}>{status.text}</div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {BLOCK_TYPES.map((t) => (
          <TypeRow
            key={t.key}
            tenantId={tenantId}
            blockType={t.key}
            label={t.label}
            initial={initial[t.key] ?? []}
            onSaved={setStatus}
          />
        ))}
      </div>
    </div>
  );
}
