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
import { getAllBlockDefinitions } from "@/page-config/registry";

const btnPrimary = "rounded bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60";

interface TypeEntry { key: string; label: string }

// Adaptive-slot block types (context blocks populated by the rules/AI engine).
const ADAPTIVE_TYPES: readonly TypeEntry[] = [
  { key: "hero",         label: "Hero" },
  { key: "proof",        label: "Proof" },
  { key: "cta",          label: "CTA" },
  { key: "feature",      label: "Feature" },
  { key: "conversion",   label: "Conversion" },
  { key: "notification", label: "Notification" },
];

// Content block types, grouped by their registry category (keys match the
// block.blockType used at render, so a default here applies to every instance).
const CATEGORY_LABELS: Record<string, string> = {
  text: "Text", media: "Media", "social-proof": "Social proof",
  features: "Features", content: "Content", conversion: "Conversion",
};
const CATEGORY_ORDER = ["text", "media", "social-proof", "features", "content", "conversion"];

const CONTENT_GROUPS: readonly { category: string; label: string; types: TypeEntry[] }[] = (() => {
  const byCat = new Map<string, TypeEntry[]>();
  for (const d of getAllBlockDefinitions()) {
    const list = byCat.get(d.category) ?? [];
    list.push({ key: d.key, label: d.displayName });
    byCat.set(d.category, list);
  }
  return CATEGORY_ORDER
    .filter((c) => byCat.has(c))
    .map((c) => ({ category: c, label: CATEGORY_LABELS[c] ?? c, types: byCat.get(c)! }));
})();

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

  const rowFor = (t: TypeEntry) => (
    <TypeRow
      key={t.key}
      tenantId={tenantId}
      blockType={t.key}
      label={t.label}
      initial={initial[t.key] ?? []}
      onSaved={setStatus}
    />
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
        Default motion per block type, for both adaptive slots and content blocks. A block that has
        its own effect (set in Personalization -&gt; Blocks, or in the CMS) overrides this; a type with
        no default falls back to the tenant-wide default effects (Design -&gt; Block styles).
      </p>
      {status && (
        <div style={{ fontSize: 12, color: status.kind === "ok" ? "#15803d" : "#b91c1c" }}>{status.text}</div>
      )}

      <div>
        <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#6b7280", margin: "0 0 8px" }}>
          Adaptive blocks
        </h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {ADAPTIVE_TYPES.map(rowFor)}
        </div>
      </div>

      <div>
        <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#6b7280", margin: "4px 0 8px" }}>
          Content blocks
        </h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {CONTENT_GROUPS.map((g) => (
            <div key={g.category}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", margin: "0 0 6px" }}>{g.label}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {g.types.map(rowFor)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
