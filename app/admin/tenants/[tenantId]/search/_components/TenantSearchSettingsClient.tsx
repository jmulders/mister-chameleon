"use client";

/**
 * TenantSearchSettingsClient
 *
 * Client component for configuring per-tenant Meilisearch settings and
 * triggering a content reindex from the admin panel.
 *
 * ─── UI state machine ─────────────────────────────────────────────────────────
 *
 *   Save bar:  idle → saving → saved | error
 *   Reindex:   idle → indexing → indexed | error
 *
 * ─── Secret handling ──────────────────────────────────────────────────────────
 *
 *   The Meilisearch API key follows the same "has key" pattern as email transport:
 *   - Server returns `hasApiKey: boolean` — no plaintext
 *   - Client shows "Key saved ✓" + "Replace key" button when hasApiKey is true
 *   - "Replace" reveals a password input; cancel restores the badge
 *   - Submitting empty key = "preserve existing" (server ignores it)
 */

import { useState, useTransition }    from "react";
import type { SafeSearchConfig, SearchSettingsFormInput } from "../actions";

interface Props {
  tenantId:     string;
  initialConfig: SafeSearchConfig;
  saveAction:   (tenantId: string, input: SearchSettingsFormInput) => Promise<{ ok: true } | { ok: false; error: string }>;
  reindexAction:(tenantId: string) => Promise<
    | { ok: true;  docCount: number; errorCount: number; indexedAt: string }
    | { ok: false; error: string }
  >;
}

export function TenantSearchSettingsClient({
  tenantId,
  initialConfig,
  saveAction,
  reindexAction,
}: Props) {
  // ── Form state ────────────────────────────────────────────────────────────
  const [provider, setProvider]       = useState<"none" | "meilisearch">(initialConfig.provider);
  const [host, setHost]               = useState(initialConfig.meilisearchHost);
  const [indexPrefix, setIndexPrefix] = useState(initialConfig.indexPrefix);

  // API key secret handling
  const [hasApiKey, setHasApiKey]       = useState(initialConfig.hasApiKey);
  const [showKeyInput, setShowKeyInput] = useState(!initialConfig.hasApiKey);
  const [apiKey, setApiKey]             = useState("");

  // ── Save state ────────────────────────────────────────────────────────────
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDirty, setIsDirty]     = useState(false);

  // ── Reindex state ─────────────────────────────────────────────────────────
  const [reindexState, setReindexState] = useState<"idle" | "indexing" | "done" | "error">("idle");
  const [reindexResult, setReindexResult] = useState<{
    docCount: number; errorCount: number; indexedAt: string;
  } | null>(null);
  const [reindexError, setReindexError] = useState<string | null>(null);

  // Using useTransition to avoid blocking while async actions run
  const [, startTransition] = useTransition();

  const markDirty = () => {
    setIsDirty(true);
    setSaveState("idle");
  };

  // ── Save handler ──────────────────────────────────────────────────────────
  async function handleSave() {
    setSaveState("saving");
    setSaveError(null);

    const input: SearchSettingsFormInput = {
      provider,
      meilisearchHost:   host.trim(),
      indexPrefix:       indexPrefix.trim(),
      meilisearchApiKey: showKeyInput ? apiKey : "",
    };

    try {
      const result = await saveAction(tenantId, input);
      if (result.ok) {
        setSaveState("saved");
        setIsDirty(false);
        if (showKeyInput && apiKey) {
          setHasApiKey(true);
          setShowKeyInput(false);
          setApiKey("");
        }
      } else {
        setSaveState("error");
        setSaveError(result.error);
      }
    } catch {
      setSaveState("error");
      setSaveError("An unexpected error occurred.");
    }
  }

  // ── Reindex handler ───────────────────────────────────────────────────────
  function handleReindex() {
    setReindexState("indexing");
    setReindexResult(null);
    setReindexError(null);

    startTransition(async () => {
      try {
        const result = await reindexAction(tenantId);
        if (result.ok) {
          setReindexState("done");
          setReindexResult({
            docCount:   result.docCount,
            errorCount: result.errorCount,
            indexedAt:  result.indexedAt,
          });
        } else {
          setReindexState("error");
          setReindexError(result.error);
        }
      } catch {
        setReindexState("error");
        setReindexError("Reindex failed unexpectedly.");
      }
    });
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const isMeilisearch = provider === "meilisearch";
  const indexName     = `${indexPrefix}${tenantId}`;
  const canReindex    = isMeilisearch && !!host.trim() && hasApiKey && reindexState !== "indexing";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── Provider selector ── */}
      <section style={sectionStyle}>
        <h3 style={sectionHeadingStyle}>Search provider</h3>
        <p style={descStyle}>
          Select the search engine for this tenant. "Platform default" uses Sanity GROQ-based
          search (suitable for smaller sites). Meilisearch provides full-text indexing with
          relevance ranking, highlights, and faceting.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.75rem" }}>
          {(["none", "meilisearch"] as const).map((p) => (
            <label key={p} style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
              <input
                type="radio"
                name="provider"
                value={p}
                checked={provider === p}
                onChange={() => { setProvider(p); markDirty(); }}
              />
              <span style={{ fontWeight: 500 }}>
                {p === "none" ? "Platform default (Sanity GROQ / InMemory)" : "Meilisearch"}
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* ── Meilisearch credentials (only shown when provider === "meilisearch") ── */}
      {isMeilisearch && (
        <section style={sectionStyle}>
          <h3 style={sectionHeadingStyle}>Meilisearch credentials</h3>
          <p style={descStyle}>
            Enter your Meilisearch instance URL and a search/admin API key.
            The key is stored encrypted and never returned to the browser.
          </p>

          <div style={fieldGroupStyle}>
            {/* Host */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Instance URL</label>
              <input
                type="url"
                placeholder="https://search.example.com"
                value={host}
                onChange={(e) => { setHost(e.target.value); markDirty(); }}
                style={inputStyle}
              />
              <p style={hintStyle}>No trailing slash. Include protocol (https://).</p>
            </div>

            {/* API key — "has key" pattern */}
            <div style={fieldStyle}>
              <label style={labelStyle}>API key</label>
              {hasApiKey && !showKeyInput ? (
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={badgeStyle}>✓ Key saved</span>
                  <button
                    type="button"
                    onClick={() => { setShowKeyInput(true); markDirty(); }}
                    style={ghostButtonStyle}
                  >
                    Replace key
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input
                    type="password"
                    placeholder="Paste new API key…"
                    value={apiKey}
                    onChange={(e) => { setApiKey(e.target.value); markDirty(); }}
                    style={{ ...inputStyle, flex: 1 }}
                    autoComplete="off"
                  />
                  {hasApiKey && (
                    <button
                      type="button"
                      onClick={() => { setShowKeyInput(false); setApiKey(""); }}
                      style={ghostButtonStyle}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}
              <p style={hintStyle}>
                Use a search-only key for read queries, or an admin key when also reindexing
                from this panel.
              </p>
            </div>

            {/* Index prefix */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Index prefix</label>
              <input
                type="text"
                placeholder="prod_"
                value={indexPrefix}
                onChange={(e) => { setIndexPrefix(e.target.value); markDirty(); }}
                style={{ ...inputStyle, maxWidth: "200px" }}
              />
              <p style={hintStyle}>
                Final index name: <code style={codeStyle}>{indexName || tenantId}</code>.
                Leave empty to use the tenant ID as the index name.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── Save bar ── */}
      {isDirty && (
        <div style={saveBarStyle}>
          <button
            type="button"
            onClick={handleSave}
            disabled={saveState === "saving"}
            style={primaryButtonStyle(saveState === "saving")}
          >
            {saveState === "saving" ? "Saving…" : "Save settings"}
          </button>
          {saveState === "saved"  && <span style={{ color: "#15803d", fontWeight: 500 }}>✓ Saved</span>}
          {saveState === "error"  && <span style={{ color: "#dc2626" }}>{saveError ?? "Save failed"}</span>}
        </div>
      )}

      {/* ── Reindex section ── */}
      {isMeilisearch && (
        <section style={sectionStyle}>
          <h3 style={sectionHeadingStyle}>Index content</h3>
          <p style={descStyle}>
            Push all published CMS content (pages, news, vacancies, events) to
            the <code style={codeStyle}>{indexName || tenantId}</code> index.
            This overwrites existing documents with current CMS data.
          </p>

          {/* Last index stats */}
          {initialConfig.lastIndexedAt && !reindexResult && (
            <div style={statsStyle}>
              <span>Last indexed: <strong>{formatDate(initialConfig.lastIndexedAt)}</strong></span>
              {initialConfig.lastIndexStats && (
                <>
                  <span style={{ marginLeft: "1rem" }}>
                    Documents: <strong>{initialConfig.lastIndexStats.docCount}</strong>
                  </span>
                  {initialConfig.lastIndexStats.errorCount > 0 && (
                    <span style={{ marginLeft: "1rem", color: "#b45309" }}>
                      Errors: {initialConfig.lastIndexStats.errorCount}
                    </span>
                  )}
                </>
              )}
            </div>
          )}

          {/* Reindex result */}
          {reindexResult && (
            <div style={{ ...statsStyle, background: "#f0fdf4", borderColor: "#86efac" }}>
              <span>Indexed at: <strong>{formatDate(reindexResult.indexedAt)}</strong></span>
              <span style={{ marginLeft: "1rem" }}>Documents: <strong>{reindexResult.docCount}</strong></span>
              {reindexResult.errorCount > 0 && (
                <span style={{ marginLeft: "1rem", color: "#b45309" }}>
                  Fetch errors: {reindexResult.errorCount}
                </span>
              )}
            </div>
          )}

          {reindexError && (
            <p style={{ color: "#dc2626", marginBottom: "0.75rem" }}>{reindexError}</p>
          )}

          {!canReindex && isMeilisearch && (
            <p style={{ color: "#6b7280", fontSize: "0.8125rem", marginBottom: "0.75rem" }}>
              {!host.trim()
                ? "Configure the instance URL above and save before reindexing."
                : !hasApiKey
                ? "Add an API key above and save before reindexing."
                : null}
            </p>
          )}

          <button
            type="button"
            onClick={handleReindex}
            disabled={!canReindex}
            style={primaryButtonStyle(!canReindex)}
          >
            {reindexState === "indexing" ? "Indexing…" : "Reindex now"}
          </button>
        </section>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Style helpers
// ─────────────────────────────────────────────────────────────────────────────

const sectionStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  padding: "1.25rem 1.5rem",
};

const sectionHeadingStyle: React.CSSProperties = {
  margin: "0 0 0.25rem",
  fontSize: "0.9375rem",
  fontWeight: 600,
};

const descStyle: React.CSSProperties = {
  margin: "0 0 0.5rem",
  fontSize: "0.8125rem",
  color: "#6b7280",
  lineHeight: 1.5,
};

const fieldGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
  marginTop: "0.75rem",
};

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.375rem",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.8125rem",
  fontWeight: 500,
  color: "#374151",
};

const inputStyle: React.CSSProperties = {
  padding: "0.4375rem 0.625rem",
  border: "1px solid #d1d5db",
  borderRadius: "6px",
  fontSize: "0.875rem",
  outline: "none",
};

const hintStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "#9ca3af",
  margin: 0,
};

const codeStyle: React.CSSProperties = {
  background: "#f1f5f9",
  padding: "1px 4px",
  borderRadius: "3px",
  fontSize: "0.8125rem",
  fontFamily: "monospace",
};

const badgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.25rem",
  padding: "0.25rem 0.625rem",
  background: "#f0fdf4",
  border: "1px solid #86efac",
  borderRadius: "999px",
  fontSize: "0.8125rem",
  color: "#15803d",
  fontWeight: 500,
};

const ghostButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#4f46e5",
  fontSize: "0.8125rem",
  cursor: "pointer",
  padding: "0.25rem 0.5rem",
  textDecoration: "underline",
};

const saveBarStyle: React.CSSProperties = {
  position: "sticky",
  bottom: "1rem",
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  padding: "0.75rem 1rem",
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
};

const statsStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.25rem",
  padding: "0.5rem 0.75rem",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "6px",
  fontSize: "0.8125rem",
  color: "#374151",
  marginBottom: "0.75rem",
};

function primaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "0.5rem 1rem",
    background: disabled ? "#d1d5db" : "#4f46e5",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "0.875rem",
    fontWeight: 500,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}
