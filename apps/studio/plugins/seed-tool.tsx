/**
 * Seed Tool Plugin — Sanity Studio v3
 *
 * Adds a "Seed" tab to the Studio toolbar. From there you can seed the
 * Mister Chameleon marketing site pages with one click — no terminal required.
 *
 * Uses the Studio's own authenticated session (useClient) so no extra
 * write token is needed. The logged-in user must have Editor role or higher.
 *
 * Registered in sanity.config.ts as seedToolPlugin().
 */

import React, { useState, useCallback } from "react";
import { definePlugin, useClient }      from "sanity";
import { allMarketingPages }            from "../../../cms/seed/marketing-site-pages";

// ── Types ─────────────────────────────────────────────────────────────────────

type Status = "idle" | "confirming" | "running" | "done" | "error";

interface PageResult {
  id:      string;
  slug:    string;
  ok:      boolean;
  error?:  string;
}

// ── Main component ────────────────────────────────────────────────────────────

function SeedTool(): React.ReactElement {
  const client = useClient({ apiVersion: "2024-01-01" });

  const [status,   setStatus]   = useState<Status>("idle");
  const [results,  setResults]  = useState<PageResult[]>([]);
  const [progress, setProgress] = useState(0);
  const total = allMarketingPages.length;

  const run = useCallback(async () => {
    setStatus("running");
    setResults([]);
    setProgress(0);

    const collected: PageResult[] = [];

    for (let i = 0; i < allMarketingPages.length; i++) {
      const doc  = allMarketingPages[i] as Record<string, unknown>;
      const id   = String(doc._id);
      const slug = (doc.slug as Record<string, unknown> | undefined)?.current
        ? String((doc.slug as Record<string, unknown>).current)
        : `[${String(doc._type)}] ${id}`;

      try {
        await client.createOrReplace(
          allMarketingPages[i] as Parameters<typeof client.createOrReplace>[0],
        );
        // Delete any open draft so Studio shows the freshly-seeded published
        // version rather than a stale draft from the tenant provisioner.
        try { await client.delete(`drafts.${id}`); } catch { /* no draft — fine */ }
        collected.push({ id, slug, ok: true });
      } catch (err) {
        collected.push({ id, slug, ok: false, error: err instanceof Error ? err.message : String(err) });
      }

      setProgress(i + 1);
      setResults([...collected]);
    }

    const anyFailed = collected.some((r) => !r.ok);
    setStatus(anyFailed ? "error" : "done");
  }, [client]);

  const ok    = results.filter((r) =>  r.ok).length;
  const fail  = results.filter((r) => !r.ok).length;
  const pct   = total > 0 ? Math.round((progress / total) * 100) : 0;

  // ── Styles (inline — no external CSS needed) ─────────────────────────────

  const card: React.CSSProperties = {
    maxWidth: 680, margin: "40px auto", padding: "32px",
    background: "#fff", borderRadius: 12,
    border: "1px solid #e2e8f0", fontFamily: "system-ui, sans-serif",
  };
  const h1: React.CSSProperties  = { fontSize: 22, fontWeight: 700, marginBottom: 6 };
  const sub: React.CSSProperties = { fontSize: 14, color: "#64748b", marginBottom: 28, lineHeight: 1.5 };

  const btn = (bg: string, col = "#fff"): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "10px 20px", borderRadius: 8, border: "none",
    background: bg, color: col, fontSize: 14, fontWeight: 600,
    cursor: "pointer", transition: "opacity .15s",
  });

  const progressBar: React.CSSProperties = {
    height: 6, borderRadius: 3, background: "#e2e8f0",
    margin: "20px 0 4px", overflow: "hidden",
  };
  const progressFill: React.CSSProperties = {
    height: "100%", borderRadius: 3, background: "#6366f1",
    width: `${pct}%`, transition: "width .2s",
  };

  const resultRow = (ok: boolean): React.CSSProperties => ({
    display: "flex", gap: 10, alignItems: "flex-start",
    padding: "5px 0", borderBottom: "1px solid #f1f5f9",
    fontSize: 13,
  });
  const badge = (ok: boolean): React.CSSProperties => ({
    flexShrink: 0, width: 20, height: 20, borderRadius: 10,
    background: ok ? "#d1fae5" : "#fee2e2",
    color: ok ? "#065f46" : "#991b1b",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 11, fontWeight: 700,
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: "40px 24px", background: "#f8fafc", minHeight: "100vh" }}>
      <div style={card}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 28 }}>🦎</span>
          <h1 style={h1}>Marketing site seed</h1>
        </div>
        <p style={sub}>
          Creates or replaces all <strong>{total}</strong> marketing documents (pages, nav items, site settings) for{" "}
          <code style={{ background: "#f1f5f9", padding: "1px 5px", borderRadius: 4 }}>
            mister-chameleon
          </code>{" "}
          in this dataset. Safe to run multiple times — uses <code>createOrReplace</code>.
        </p>

        {/* Page list preview */}
        {status === "idle" && (
          <details style={{ marginBottom: 24 }}>
            <summary style={{ fontSize: 13, color: "#6366f1", cursor: "pointer", fontWeight: 600 }}>
              Preview {total} pages
            </summary>
            <div style={{
              marginTop: 12, maxHeight: 280, overflowY: "auto",
              background: "#f8fafc", borderRadius: 8, padding: "8px 12px",
              fontSize: 12, fontFamily: "monospace",
            }}>
              {allMarketingPages.map((doc) => {
                const d    = doc as Record<string, unknown>;
                const slug = (d.slug as Record<string, unknown> | undefined)?.current
                  ? `/${String((d.slug as Record<string, unknown>).current)}`
                  : `[${String(d._type)}] ${String(d._id)}`;
                return (
                  <div key={String(d._id)} style={{ padding: "2px 0", color: "#475569" }}>
                    <span style={{ color: "#94a3b8" }}>{slug}</span>
                  </div>
                );
              })}
            </div>
          </details>
        )}

        {/* Idle — seed button */}
        {status === "idle" && (
          <button style={btn("#6366f1")} onClick={() => setStatus("confirming")}>
            Seed {total} pages →
          </button>
        )}

        {/* Confirming */}
        {status === "confirming" && (
          <div style={{
            background: "#fefce8", border: "1px solid #fde68a",
            borderRadius: 8, padding: "16px 20px", marginBottom: 20,
          }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#92400e", margin: "0 0 12px" }}>
              ⚠️  This will create or replace {total} page documents in Sanity.
            </p>
            <p style={{ fontSize: 13, color: "#78350f", margin: "0 0 16px" }}>
              Existing pages with the same <code>_id</code> will be overwritten.
              Content you have edited manually in Studio will be reset to the seed values.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button style={btn("#6366f1")} onClick={run}>
                Yes, seed {total} pages
              </button>
              <button
                style={btn("transparent", "#475569")}
                onClick={() => setStatus("idle")}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Running */}
        {status === "running" && (
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#334155", margin: "0 0 4px" }}>
              Seeding… {progress} / {total}
            </p>
            <div style={progressBar}><div style={progressFill} /></div>
            <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 20 }}>{pct}% complete</p>
          </div>
        )}

        {/* Done / Error summary */}
        {(status === "done" || status === "error") && (
          <div style={{ marginBottom: 20 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 16px", borderRadius: 8, marginBottom: 16,
              background: status === "done" ? "#d1fae5" : "#fee2e2",
              border: `1px solid ${status === "done" ? "#6ee7b7" : "#fca5a5"}`,
            }}>
              <span style={{ fontSize: 20 }}>{status === "done" ? "✅" : "⚠️"}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: status === "done" ? "#065f46" : "#991b1b" }}>
                {status === "done"
                  ? `All ${ok} pages seeded successfully.`
                  : `${ok} succeeded, ${fail} failed.`}
              </span>
            </div>
            <button style={{ ...btn("#f1f5f9", "#334155"), marginRight: 10 }} onClick={() => { setStatus("idle"); setResults([]); setProgress(0); }}>
              Reset
            </button>
            <button style={btn("#6366f1")} onClick={() => setStatus("confirming")}>
              Seed again
            </button>
          </div>
        )}

        {/* Result rows */}
        {results.length > 0 && (
          <div style={{
            marginTop: 20, maxHeight: 360, overflowY: "auto",
            background: "#f8fafc", borderRadius: 8, padding: "8px 12px",
          }}>
            {results.map((r) => (
              <div key={r.id} style={resultRow(r.ok)}>
                <span style={badge(r.ok)}>{r.ok ? "✓" : "✗"}</span>
                <div>
                  <span style={{ fontFamily: "monospace", fontSize: 12, color: "#334155" }}>
                    /{r.slug}
                  </span>
                  {r.error && (
                    <div style={{ fontSize: 11, color: "#dc2626", marginTop: 2 }}>{r.error}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer note */}
        <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 24, marginBottom: 0, borderTop: "1px solid #f1f5f9", paddingTop: 16 }}>
          Pages are created under <code>tenantId: mister-chameleon</code>.
          To re-seed from the terminal: <code>npm run seed:marketing</code> (from project root or apps/studio).
        </p>
      </div>
    </div>
  );
}

// ── Plugin export ─────────────────────────────────────────────────────────────

export const seedToolPlugin = definePlugin({
  name: "seed-tool",
  tools: [
    {
      name:      "seed",
      title:     "Seed",
      icon:      () => React.createElement("span", { style: { fontSize: 18 } }, "🦎"),
      component: SeedTool,
    },
  ],
});
