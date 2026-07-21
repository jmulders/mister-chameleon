/**
 * ResetDesignButton
 *
 * A single control that clears every visual design override on the tenant —
 * theme, token overrides, site default tokens, block token sets, custom fonts,
 * selected style family and typography-override flag — back to the platform
 * default, via resetDesignAction.
 *
 * Why it's here: importing a JSON token file (Advanced / Builder) writes token
 * overrides that sit at the highest specificity, so they keep masking any preset
 * activated afterwards ("presets won't load"). This gives the operator a clean
 * slate so they can activate a preset or import a fresh JSON again.
 *
 * The automatic theme-switching rules (themeRules) are preserved — see
 * resetDesignAction.
 *
 * Rendered on every Design tab (above the tab panels) so it's reachable whether
 * the operator got stuck in Style, Builder or Advanced.
 */

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetDesignAction } from "@/app/admin/tenants/[tenantId]/actions";

export function ResetDesignButton({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  function reset() {
    setMsg(null);
    startTransition(async () => {
      const r = await resetDesignAction(tenantId);
      setConfirming(false);
      if (r.ok) {
        setMsg({ text: "Reset ✓ — design terug naar default. Activeer een preset of laad een nieuwe JSON.", ok: true });
        router.refresh();
      } else {
        setMsg({ text: r.error, ok: false });
      }
    });
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
      {!confirming ? (
        <button
          type="button"
          onClick={() => { setMsg(null); setConfirming(true); }}
          disabled={pending}
          title="Wis alle design-overrides (kleuren, tokens, fonts, preset) en zet de theme terug op default. Automatische theme-regels blijven behouden."
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.375rem",
            padding: "0.375rem 0.75rem", borderRadius: "0.375rem",
            border: "1px solid #e5e7eb", background: "#fff", color: "#b91c1c",
            fontSize: "0.8125rem", fontWeight: 600, cursor: pending ? "default" : "pointer",
          }}
        >
          ↺ Reset design
        </button>
      ) : (
        <>
          <span style={{ fontSize: "0.8125rem", color: "#374151" }}>
            Alle design-overrides wissen en terug naar default?
          </span>
          <button
            type="button"
            onClick={reset}
            disabled={pending}
            style={{
              padding: "0.375rem 0.75rem", borderRadius: "0.375rem", border: "1px solid #b91c1c",
              background: "#b91c1c", color: "#fff", fontSize: "0.8125rem", fontWeight: 600,
              cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1,
            }}
          >
            {pending ? "Bezig…" : "Ja, reset"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={pending}
            style={{
              padding: "0.375rem 0.75rem", borderRadius: "0.375rem", border: "1px solid #e5e7eb",
              background: "#fff", color: "#374151", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
            }}
          >
            Annuleren
          </button>
        </>
      )}

      {msg && (
        <span style={{ fontSize: "0.8125rem", color: msg.ok ? "#15803d" : "#b91c1c", fontWeight: 500 }}>
          {msg.text}
        </span>
      )}
    </div>
  );
}
