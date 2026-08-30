"use client";

/**
 * SiteDesignTokensEditor
 *
 * Edits the SITE-WIDE default design tokens (design.defaultTokens) — the central
 * design-token system. One grouped editor for all curated tokens; whatever you
 * set here is emitted as CSS custom properties at the page root, so EVERY content
 * block and adaptive/context slot inherits it automatically — no per-component
 * assignment needed. Per-block token sets remain available as optional overrides.
 *
 * Saved in one shot via saveDefaultTokensAction. Includes colour pickers, a
 * "Start from a token set" convenience, and JSON import/export.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BlockTokenSet, CuratedBlockTokens } from "@/design-system/theme/block-token-set";
import { BLOCK_TOKEN_GROUPS, VALID_SURFACE_ROLES } from "@/design-system/theme/block-token-set";
import { EXAMPLE_SITE_DESIGN_TOKENS } from "@/design-system/theme/block-token-set-examples";
import { detectTokenPayloadKind, wrongBoxMessage } from "@/design-system/theme/token-import-detect";
import { saveDefaultTokensAction } from "@/app/admin/tenants/[tenantId]/actions";

const SURFACE_OPTIONS = ["", ...VALID_SURFACE_ROLES] as const;

function isColorish(v: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());
}

export interface SiteDesignTokensEditorProps {
  tenantId: string;
  initialTokens?: CuratedBlockTokens;
  /** Existing named sets — offered as a starting point ("Start from …"). */
  tokenSets?: readonly BlockTokenSet[];
}

export function SiteDesignTokensEditor({ tenantId, initialTokens, tokenSets }: SiteDesignTokensEditorProps) {
  const router = useRouter();
  const [tokens, setTokens] = useState<Record<string, string>>(() => ({ ...(initialTokens ?? {}) } as Record<string, string>));
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [jsonText, setJsonText] = useState("");

  function updateToken(field: string, value: string) {
    setTokens((prev) => {
      const next = { ...prev };
      if (value.trim()) next[field] = value;
      else delete next[field];
      return next;
    });
    setMsg(null);
  }

  function startFromSet(key: string) {
    const set = tokenSets?.find((s) => s.key === key);
    if (!set) return;
    setTokens({ ...(set.tokens as Record<string, string>) });
    setMsg({ text: `Loaded tokens from "${set.name}". Review and Save to apply site-wide.`, ok: true });
  }

  function loadExample() {
    setTokens({ ...(EXAMPLE_SITE_DESIGN_TOKENS as Record<string, string>) });
    setMsg({ text: "Loaded “Aurora Purple Gold” tokens into the editor. Review and Save to apply site-wide.", ok: true });
  }

  function clearAll() {
    setTokens({});
    setMsg({ text: "Cleared. Save to remove the site default (blocks fall back to the preset).", ok: true });
  }

  function applyImportedText(text: string, source: string) {
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        const hint = wrongBoxMessage(detectTokenPayloadKind(parsed), "tokens");
        throw new Error(hint ?? "JSON must be a single tokens object: { primary: \"#…\", … }.");
      }
      // Reject grouped presets pasted here (they need the preset import path).
      const kind = detectTokenPayloadKind(parsed);
      if (kind === "preset") {
        throw new Error(
          "This looks like a grouped theme preset (a theme plus color/typography groups). " +
          "Import it in the Builder tab (Import theme preset) or the Saved token sets panel on the Advanced tab. " +
          "This box expects a single flat tokens object: { \"primary\": \"#...\", ... }.",
        );
      }
      setTokens({ ...(parsed as Record<string, string>) });
      setShowJson(false);
      setMsg({ text: `Imported tokens from ${source}. Review and Save to apply.`, ok: true });
    } catch (e) {
      setMsg({ text: `Import failed: ${e instanceof Error ? e.message : String(e)}`, ok: false });
    }
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
    startTransition(async () => {
      const r = await saveDefaultTokensAction(tenantId, tokens);
      if (r.ok) {
        setMsg({ text: "Saved ✓. Applied site-wide to every block.", ok: true });
        router.refresh();
      } else {
        setMsg({ text: r.errors.join(" "), ok: false });
      }
    });
  }

  const fieldCount = Object.keys(tokens).length;
  const sampleTokens = Object.entries(tokens).slice(0, 6);

  return (
    <div>
      {/* Currently applied — what site tokens are set right now, with the
          existing Clear all action reused for one-click removal. */}
      <div style={{
        marginBottom: "1rem", padding: "0.85rem 1rem", borderRadius: "0.625rem",
        border: "1px solid #e5e7eb", background: "#fff",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "#94a3b8" }}>
            Currently applied
          </span>
          <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#374151" }}>
            {fieldCount > 0 ? `${fieldCount} site design token${fieldCount === 1 ? "" : "s"}` : "No site tokens set"}
          </span>
          <div style={{ flex: 1 }} />
          {fieldCount > 0 && (
            <button type="button" onClick={clearAll} style={btnStyle("danger")}>Clear all</button>
          )}
        </div>
        {sampleTokens.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {sampleTokens.map(([k, v]) => (
              <span key={k} style={{
                display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.6875rem",
                padding: "2px 8px", borderRadius: 999, border: "1px solid #e5e7eb", background: "#f9fafb", color: "#4b5563",
                fontFamily: "ui-monospace, monospace",
              }}>
                {isColorish(v) && (
                  <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: v, border: "1px solid rgba(0,0,0,.1)" }} />
                )}
                {k}: {v}
              </span>
            ))}
            {fieldCount > sampleTokens.length && (
              <span style={{ fontSize: "0.6875rem", color: "#94a3b8", alignSelf: "center" }}>
                +{fieldCount - sampleTokens.length} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem", alignItems: "center" }}>
        <button type="button" onClick={loadExample} style={btnStyle("ghost")}>Load tokens into editor</button>
        {tokenSets && tokenSets.length > 0 && (
          <select
            defaultValue=""
            onChange={(e) => { if (e.target.value) startFromSet(e.target.value); e.currentTarget.value = ""; }}
            style={{ ...inputStyle, width: "auto" }}
            title="Start from an existing token set"
          >
            <option value="">Start from a token set…</option>
            {tokenSets.map((s) => <option key={s.key} value={s.key}>{s.name || s.key}</option>)}
          </select>
        )}
        <button
          type="button"
          onClick={() => { setJsonText(JSON.stringify(tokens, null, 2)); setShowJson((v) => !v); }}
          style={btnStyle("ghost")}
        >
          {showJson ? "Hide JSON" : "Import / export JSON"}
        </button>
        <label style={{ ...btnStyle("ghost"), display: "inline-flex", alignItems: "center" }}>
          Import block tokens (flat JSON)
          <input type="file" accept="application/json,.json" style={{ display: "none" }}
            onChange={(e) => { importFromFile(e.target.files?.[0]); e.currentTarget.value = ""; }} />
        </label>
        <button type="button" onClick={clearAll} style={btnStyle("danger")}>Clear all</button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>{fieldCount} token{fieldCount === 1 ? "" : "s"} set</span>
        <button type="button" onClick={save} disabled={pending} style={btnStyle("save", pending)}>
          {pending ? "Saving…" : "Save site tokens"}
        </button>
      </div>

      {msg && (
        <p style={{ fontSize: "0.8125rem", margin: "0 0 1rem", color: msg.ok ? "#15803d" : "#b91c1c", fontWeight: 500 }}>
          {msg.text}
        </p>
      )}

      {/* Explainer */}
      <div style={{
        marginBottom: "1rem", padding: "0.75rem 1rem", borderRadius: "0.5rem",
        border: "1px solid #dcfce7", background: "#f0fdf4", fontSize: "0.8125rem", color: "#166534",
      }}>
        <strong>This is your central design system.</strong> Whatever you set here is applied to{" "}
        <strong>every component automatically</strong>, with no need to configure blocks individually.
        Only when a specific block needs to differ do you assign a <em>Block token set</em> (below),
        which overrides these defaults for that one block.
      </div>

      {/* Format note: flat block tokens here vs a grouped theme preset elsewhere */}
      <p style={{ fontSize: "0.8125rem", color: "#6b7280", margin: "0 0 1rem", lineHeight: 1.5 }}>
        These are flat, block-level tokens (<code style={{ fontFamily: "ui-monospace, monospace" }}>{"{ \"primary\": \"#...\", ... }"}</code>)
        that set the default look of every block. For a full theme preset (a{" "}
        <code style={{ fontFamily: "ui-monospace, monospace" }}>theme</code> plus grouped{" "}
        <code style={{ fontFamily: "ui-monospace, monospace" }}>color</code> /{" "}
        <code style={{ fontFamily: "ui-monospace, monospace" }}>typography</code> and header/footer chrome),
        use the Builder tab or the Saved token sets panel on the Advanced tab.
      </p>

      {/* JSON panel */}
      {showJson && (
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.4rem" }}>
            Expects a single flat tokens object, for example{" "}
            <code style={{ fontFamily: "ui-monospace, monospace" }}>{"{ \"primary\": \"#6d28d9\", \"fontBody\": \"Inter\" }"}</code>.
            Block token sets (an array) go in the Blocks tab; a full theme preset goes in the Builder tab.
          </div>
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            spellCheck={false}
            rows={12}
            style={{ width: "100%", fontFamily: "ui-monospace, monospace", fontSize: "0.75rem", padding: "0.75rem", border: "1px solid #e5e7eb", borderRadius: "0.5rem" }}
          />
          <button type="button" onClick={() => applyImportedText(jsonText, "text")} style={{ ...btnStyle("ghost"), marginTop: "0.5rem" }}>
            Apply imported JSON
          </button>
        </div>
      )}

      {/* Token fields — grouped */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: "0.625rem", padding: "0.5rem 1rem 1rem" }}>
        {BLOCK_TOKEN_GROUPS.map((group) => (
          <div key={group.title} style={{ marginTop: "0.75rem" }}>
            <p style={{ ...labelText, margin: "0.5rem 0 0.375rem", color: "#9ca3af" }}>{group.title}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: "0.625rem" }}>
              {group.fields.map((f) => {
                const raw = tokens[f.key] ?? "";
                return (
                  <label key={f.key} style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                    <span style={{ fontSize: "0.6875rem", color: "#6b7280" }}>{f.label}</span>
                    {f.kind === "surface" ? (
                      <select value={raw} onChange={(e) => updateToken(f.key, e.target.value)} style={inputStyle}>
                        {SURFACE_OPTIONS.map((o) => <option key={o} value={o}>{o === "" ? ": none: " : o}</option>)}
                      </select>
                    ) : f.kind === "color" ? (
                      <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
                        <input type="color" value={isColorish(raw) ? raw : "#ffffff"}
                          onChange={(e) => updateToken(f.key, e.target.value)}
                          style={{ width: "34px", height: "30px", padding: 0, border: "1px solid #d1d5db", borderRadius: "4px", cursor: "pointer", flexShrink: 0 }} />
                        <input value={raw} onChange={(e) => updateToken(f.key, e.target.value)}
                          placeholder="#111827 / rgba(…)"
                          style={{ ...inputStyle, fontFamily: "ui-monospace, monospace" }} />
                      </div>
                    ) : (
                      <input value={raw} onChange={(e) => updateToken(f.key, e.target.value)}
                        placeholder={f.placeholder ?? ""} style={inputStyle} />
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Inline styles ───────────────────────────────────────────────────────────────

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
    case "primary": return { ...base, background: "#7c3aed", color: "#fff" };
    case "save":    return { ...base, background: "#2563eb", color: "#fff" };
    case "danger":  return { ...base, background: "#fff", color: "#b91c1c", border: "1px solid #fecaca" };
    case "ghost":   return { ...base, background: "#fff", color: "#374151", border: "1px solid #d1d5db" };
  }
}
