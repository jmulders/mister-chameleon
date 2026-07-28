"use client";

/**
 * BlockTokenSetsEditor
 *
 * Manages the tenant's named, reusable block-level token sets
 * (design.blockTokenSets). Each set bundles a handful of curated tokens
 * (surface/background, text, primary/accent, card, heading, dividers) under a
 * slug `key` that individual content blocks and adaptive slots reference.
 *
 * The whole list is edited locally and submitted in one shot via
 * saveBlockTokenSetsAction (which replaces the stored array).
 *
 * Includes:
 *   • Add / edit / remove sets with colour pickers + selects.
 *   • "Load example sets" to populate coherent starter sets for testing.
 *   • JSON import/export for power users.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BlockTokenSet, CuratedBlockTokens } from "@/design-system/theme/block-token-set";
import { BLOCK_TOKEN_GROUPS, VALID_SURFACE_ROLES, BLOCK_TOKEN_SET_SLOTS } from "@/design-system/theme/block-token-set";
import { EXAMPLE_BLOCK_TOKEN_SETS } from "@/design-system/theme/block-token-set-examples";
import { detectTokenPayloadKind, wrongBoxMessage } from "@/design-system/theme/token-import-detect";
import { saveBlockTokenSetsAction } from "@/app/admin/tenants/[tenantId]/actions";

const SURFACE_OPTIONS = ["", ...VALID_SURFACE_ROLES] as const;

// ── Helpers ─────────────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function newEmptySet(): BlockTokenSet {
  const id = `bts_${Math.random().toString(36).slice(2, 9)}`;
  return { id, key: "", name: "", tokens: {} };
}

function isColorish(v: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());
}

function toggleSlot(slots: readonly string[] | undefined, slot: string): string[] {
  const set = new Set(slots ?? []);
  if (set.has(slot)) set.delete(slot); else set.add(slot);
  return [...set];
}

// ── Component ────────────────────────────────────────────────────────────────────

export interface BlockTokenSetsEditorProps {
  tenantId: string;
  initialSets?: readonly BlockTokenSet[];
}

export function BlockTokenSetsEditor({ tenantId, initialSets }: BlockTokenSetsEditorProps) {
  const router = useRouter();
  const [sets, setSets] = useState<BlockTokenSet[]>(() =>
    initialSets && initialSets.length > 0 ? initialSets.map((s) => ({ ...s, tokens: { ...s.tokens } })) : [],
  );
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [jsonText, setJsonText] = useState("");

  // ── Mutators ──────────────────────────────────────────────────────────────
  function updateSet(idx: number, patch: Partial<BlockTokenSet>) {
    setSets((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
    setMsg(null);
  }
  function updateToken(idx: number, field: keyof CuratedBlockTokens, value: string) {
    setSets((prev) =>
      prev.map((s, i) => {
        if (i !== idx) return s;
        const tokens = { ...s.tokens };
        if (value.trim()) (tokens as Record<string, string>)[field] = value;
        else delete (tokens as Record<string, string>)[field];
        return { ...s, tokens };
      }),
    );
    setMsg(null);
  }
  function addSet() {
    setSets((prev) => [...prev, newEmptySet()]);
    setMsg(null);
  }
  function removeSet(idx: number) {
    setSets((prev) => prev.filter((_, i) => i !== idx));
    setMsg(null);
  }
  function loadExamples() {
    setSets((prev) => {
      const keys = new Set(prev.map((s) => s.key));
      const toAdd = EXAMPLE_BLOCK_TOKEN_SETS.filter((e) => !keys.has(e.key)).map((e) => ({
        ...e,
        id: `${e.id}_${Math.random().toString(36).slice(2, 6)}`,
        tokens: { ...e.tokens },
      }));
      return [...prev, ...toAdd];
    });
    setMsg({ text: "Example sets added below — review and Save to persist.", ok: true });
  }
  function applyImportedText(text: string, source: string) {
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        const hint = wrongBoxMessage(detectTokenPayloadKind(parsed), "array");
        throw new Error(hint ?? "JSON must be an array of token sets: [{ key, name, tokens }].");
      }
      setSets(parsed.map((s: BlockTokenSet) => ({ ...s, tokens: { ...(s.tokens ?? {}) } })));
      setShowJson(false);
      setMsg({ text: `Imported ${parsed.length} set(s) from ${source} — review and Save to persist.`, ok: true });
    } catch (e) {
      setMsg({ text: `Import failed: ${e instanceof Error ? e.message : String(e)}`, ok: false });
    }
  }
  function importJson() {
    applyImportedText(jsonText, "text");
  }
  function importFromFile(file: File | null | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => applyImportedText(String(reader.result ?? ""), file.name);
    reader.onerror = () => setMsg({ text: "Could not read the file.", ok: false });
    reader.readAsText(file);
  }

  function save() {
    setMsg(null);
    // Auto-fill blank keys from the name so the user rarely has to type a slug.
    const payload = sets.map((s) => ({ ...s, key: s.key.trim() || slugify(s.name) }));
    startTransition(async () => {
      const r = await saveBlockTokenSetsAction(tenantId, payload);
      if (r.ok) {
        setSets(payload);
        setMsg({ text: "Saved ✓ — assign a set to any block by its key.", ok: true });
        router.refresh();
      } else {
        setMsg({ text: r.errors.join(" "), ok: false });
      }
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem", alignItems: "center" }}>
        <button type="button" onClick={addSet} style={btnStyle("primary")}>+ Add set</button>
        <button type="button" onClick={loadExamples} style={btnStyle("ghost")}>Load example sets</button>
        <button
          type="button"
          onClick={() => { setJsonText(JSON.stringify(sets, null, 2)); setShowJson((v) => !v); }}
          style={btnStyle("ghost")}
        >
          {showJson ? "Hide JSON" : "Import / export JSON"}
        </button>
        <label style={{ ...btnStyle("ghost"), display: "inline-flex", alignItems: "center" }}>
          Upload JSON file
          <input
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={(e) => { importFromFile(e.target.files?.[0]); e.currentTarget.value = ""; }}
          />
        </label>
        <div style={{ flex: 1 }} />
        <button type="button" onClick={save} disabled={pending} style={btnStyle("save", pending)}>
          {pending ? "Saving…" : "Save token sets"}
        </button>
      </div>

      {msg && (
        <p style={{ fontSize: "0.8125rem", margin: "0 0 1rem", color: msg.ok ? "#15803d" : "#b91c1c", fontWeight: 500 }}>
          {msg.text}
        </p>
      )}

      {/* How-to-apply hint — a set is only a definition until assigned to a block */}
      <div style={{
        marginBottom: "1rem", padding: "0.75rem 1rem", borderRadius: "0.5rem",
        border: "1px solid #dbeafe", background: "#eff6ff", fontSize: "0.8125rem", color: "#1e40af",
      }}>
        <strong>Saving here only defines the sets.</strong> To actually see a set on the site,
        assign its <strong>key</strong> to a block: content blocks via the <em>Token set</em> field
        in the page builder, or adaptive blocks via <em>Blocks → Edit → Design tokens</em>. Nothing
        on the site changes until a block references the key.
      </div>

      {/* JSON panel */}
      {showJson && (
        <div style={{ marginBottom: "1rem" }}>
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            spellCheck={false}
            rows={12}
            style={{
              width: "100%", fontFamily: "ui-monospace, monospace", fontSize: "0.75rem",
              padding: "0.75rem", border: "1px solid #e5e7eb", borderRadius: "0.5rem",
            }}
          />
          <button type="button" onClick={importJson} style={{ ...btnStyle("ghost"), marginTop: "0.5rem" }}>
            Apply imported JSON
          </button>
        </div>
      )}

      {/* Empty state */}
      {sets.length === 0 && (
        <div style={{ padding: "1.5rem", border: "1px dashed #e5e7eb", borderRadius: "0.5rem", background: "#fafafa", textAlign: "center" }}>
          <p style={{ fontSize: "0.8125rem", color: "#6b7280", margin: 0 }}>
            No block token sets yet. Click <strong>Add set</strong> to create one, or{" "}
            <strong>Load example sets</strong> to start from worked-out examples.
          </p>
        </div>
      )}

      {/* Set cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {sets.map((set, idx) => (
          <div key={set.id} style={{ border: "1px solid #e5e7eb", borderRadius: "0.625rem", overflow: "hidden" }}>
            {/* Header: name, key, remove */}
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end", padding: "0.875rem 1rem", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
              <label style={labelWrap}>
                <span style={labelText}>Name</span>
                <input
                  value={set.name}
                  onChange={(e) => updateSet(idx, { name: e.target.value })}
                  placeholder="Dark section"
                  style={inputStyle}
                />
              </label>
              <label style={labelWrap}>
                <span style={labelText}>Key (slug)</span>
                <input
                  value={set.key}
                  onChange={(e) => updateSet(idx, { key: e.target.value })}
                  placeholder={set.name ? slugify(set.name) : "dark-section"}
                  style={{ ...inputStyle, fontFamily: "ui-monospace, monospace" }}
                />
              </label>
              <label style={{ ...labelWrap, flex: 2, minWidth: "180px" }}>
                <span style={labelText}>Description (optional)</span>
                <input
                  value={set.description ?? ""}
                  onChange={(e) => updateSet(idx, { description: e.target.value })}
                  placeholder="When to use this set"
                  style={inputStyle}
                />
              </label>
              <button type="button" onClick={() => removeSet(idx)} style={btnStyle("danger")}>Remove</button>

              {/* Block-type scope — which block editors offer this set */}
              <div style={{ ...labelWrap, flex: "1 1 100%", minWidth: "100%" }}>
                <span style={labelText}>
                  Applies to{" "}
                  <span style={{ color: "#9ca3af", fontWeight: 400 }}>(none selected = all block types)</span>
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", paddingTop: "0.25rem" }}>
                  {BLOCK_TOKEN_SET_SLOTS.map((slot) => {
                    const active = (set.slots ?? []).includes(slot);
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => updateSet(idx, { slots: toggleSlot(set.slots, slot) })}
                        style={{
                          fontSize: "0.6875rem", padding: "0.2rem 0.6rem", borderRadius: "9999px",
                          border: active ? "1px solid #6366f1" : "1px solid #d1d5db",
                          background: active ? "#eef2ff" : "#fff",
                          color: active ? "#4338ca" : "#6b7280",
                          cursor: "pointer", textTransform: "capitalize",
                        }}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Token fields — grouped */}
            <div style={{ padding: "0.5rem 1rem 1rem" }}>
              {BLOCK_TOKEN_GROUPS.map((group) => (
                <div key={group.title} style={{ marginTop: "0.75rem" }}>
                  <p style={{ ...labelText, margin: "0.5rem 0 0.375rem", color: "#9ca3af" }}>{group.title}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: "0.625rem" }}>
                    {group.fields.map((f) => {
                      const raw = (set.tokens as Record<string, string>)[f.key] ?? "";
                      return (
                        <label key={f.key} style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                          <span style={{ fontSize: "0.6875rem", color: "#6b7280" }}>{f.label}</span>

                          {f.kind === "surface" ? (
                            <select value={raw} onChange={(e) => updateToken(idx, f.key, e.target.value)} style={inputStyle}>
                              {SURFACE_OPTIONS.map((o) => (
                                <option key={o} value={o}>{o === "" ? "— none —" : o}</option>
                              ))}
                            </select>
                          ) : f.kind === "color" ? (
                            <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
                              <input
                                type="color"
                                value={isColorish(raw) ? raw : "#ffffff"}
                                onChange={(e) => updateToken(idx, f.key, e.target.value)}
                                style={{ width: "34px", height: "30px", padding: 0, border: "1px solid #d1d5db", borderRadius: "4px", cursor: "pointer", flexShrink: 0 }}
                              />
                              <input
                                value={raw}
                                onChange={(e) => updateToken(idx, f.key, e.target.value)}
                                placeholder="#111827 / rgba(…)"
                                style={{ ...inputStyle, fontFamily: "ui-monospace, monospace" }}
                              />
                            </div>
                          ) : (
                            <input
                              value={raw}
                              onChange={(e) => updateToken(idx, f.key, e.target.value)}
                              placeholder={f.placeholder ?? ""}
                              style={inputStyle}
                            />
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Inline styles ───────────────────────────────────────────────────────────────

const labelWrap: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1, minWidth: "120px" };
const labelText: React.CSSProperties = { fontSize: "0.6875rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em" };
const inputStyle: React.CSSProperties = {
  padding: "0.375rem 0.5rem", fontSize: "0.8125rem", border: "1px solid #d1d5db",
  borderRadius: "0.375rem", background: "#fff", color: "#111827", width: "100%", boxSizing: "border-box",
};

function btnStyle(kind: "primary" | "ghost" | "save" | "danger", disabled = false): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "0.375rem 0.75rem", fontSize: "0.75rem", fontWeight: 600, borderRadius: "0.375rem",
    cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1, transition: "all 0.12s ease",
    border: "1px solid transparent",
  };
  switch (kind) {
    case "primary": return { ...base, background: "#111827", color: "#fff" };
    case "save":    return { ...base, background: "#2563eb", color: "#fff" };
    case "danger":  return { ...base, background: "#fff", color: "#b91c1c", border: "1px solid #fecaca" };
    case "ghost":   return { ...base, background: "#fff", color: "#374151", border: "1px solid #d1d5db" };
  }
}
