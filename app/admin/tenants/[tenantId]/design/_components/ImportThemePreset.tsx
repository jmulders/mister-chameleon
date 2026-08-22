"use client";

/**
 * ImportThemePreset
 *
 * Import a grouped complete-look theme preset (our preset JSON, or a Figma /
 * Tokens Studio / DTCG export) and apply it to the tenant as a complete look
 * (replaces the current token overrides). Lives on the Token sets tab alongside
 * the saved-token-sets library, since both work on the grouped complete-look
 * format. Calls importDesignPresetAction (unchanged).
 *
 * A file whose payload belongs in another box (the flat per-block Site design
 * tokens) is rejected with a pointer, via detectTokenPayloadKind.
 */

import { useState, useTransition } from "react";
import { detectTokenPayloadKind, wrongBoxMessage } from "@/design-system/theme/token-import-detect";
import { importDesignPresetAction } from "@/app/admin/tenants/[tenantId]/actions";

export function ImportThemePreset({ tenantId }: { tenantId: string }) {
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  async function onImportFile(file: File) {
    setMsg(null);
    const text = await file.text();

    // Reject a file that belongs in another box, with a message that points the
    // right way, instead of a confusing partial import or generic server error.
    try {
      const wrong = wrongBoxMessage(detectTokenPayloadKind(JSON.parse(text)), "preset");
      if (wrong) { setMsg({ text: wrong, ok: false }); return; }
    } catch {
      setMsg({ text: "That file is not valid JSON. Export the preset again and retry.", ok: false });
      return;
    }

    startTransition(async () => {
      try {
        const r = await importDesignPresetAction(tenantId, text);
        if (r.ok) {
          // Not calling router.refresh(): re-rendering right after a full token
          // replace has triggered an edge-case crash. The tokens are saved; the
          // operator views the public site to see them.
          setMsg({ text: `Imported${r.name ? `: ${r.name}` : ""}. Saved. Open the public site to see it.`, ok: true });
        } else {
          setMsg({ text: r.errors.join(" "), ok: false });
        }
      } catch {
        setMsg({
          text: "Import failed. Likely an expired session after a new deploy. Refresh the page and try again.",
          ok: false,
        });
      }
    });
  }

  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
        Import theme preset (Figma / DTCG)
      </label>
      <label
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          fontSize: 13, fontWeight: 600, padding: "9px 16px", borderRadius: 9,
          border: "1px solid #4f46e5", background: "#eef2ff", color: "#4f46e5",
          cursor: pending ? "wait" : "pointer", opacity: pending ? 0.6 : 1,
        }}
      >
        Choose preset JSON...
        <input
          type="file"
          accept=".json,application/json"
          disabled={pending}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImportFile(f); e.target.value = ""; }}
          style={{ display: "none" }}
        />
      </label>
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
        Our preset JSON or a Figma / Tokens Studio export, applied as a complete look (replaces the current tokens).
      </div>
      {pending && <div style={{ fontSize: 11, color: "#6366f1", marginTop: 4 }}>Importing...</div>}
      {msg && (
        <div style={{ fontSize: 11, color: msg.ok ? "#16a34a" : "#b91c1c", marginTop: 4 }}>{msg.text}</div>
      )}
    </div>
  );
}
