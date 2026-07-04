"use client";

/**
 * TokenExtractorClient
 *
 * URL input → calls extractDesignTokensFromUrlAction → renders the distilled
 * tokens (colour swatches + values) and the importable JSON, with copy +
 * download. The JSON is in the grouped token-upload shape, so it imports
 * directly in any tenant's Design → Builder / Advanced "IMPORT FROM JSON".
 */

import { useMemo, useState, useTransition } from "react";
import { extractDesignTokensFromUrlAction } from "../actions";

type Tokens = {
  theme?: string;
  color?: Record<string, string>;
  typography?: Record<string, string>;
  radius?: Record<string, string>;
  shadow?: Record<string, string>;
};

export function TokenExtractorClient() {
  const [url, setUrl]         = useState("");
  const [pages, setPages]     = useState(5);
  const [pending, start]      = useTransition();
  const [tokens, setTokens]   = useState<Tokens | null>(null);
  const [blockTokens, setBlockTokens] = useState<Record<string, string> | null>(null);
  const [notes, setNotes]     = useState<string[]>([]);
  const [error, setError]     = useState<string | null>(null);
  const [copied, setCopied]   = useState(false);
  const [copiedBlock, setCopiedBlock] = useState(false);

  function run() {
    setError(null);
    setTokens(null);
    setBlockTokens(null);
    setNotes([]);
    setCopied(false);
    start(async () => {
      const r = await extractDesignTokensFromUrlAction(url.trim(), pages);
      if (r.ok) { setTokens(r.tokens as Tokens); setBlockTokens(r.blockTokens); setNotes(r.notes); }
      else setError(r.error);
    });
  }

  const json = useMemo(() => {
    if (!tokens) return "";
    const file = {
      $schema: "mister-chameleon-design-preset@1",
      meta: { source: url, extractedAt: new Date().toISOString() },
      ...tokens,
    };
    return JSON.stringify(file, null, 2);
  }, [tokens, url]);

  // Block token set — maps the grouped extraction to the curated per-block token
  // schema (see design-system/theme/block-token-set) so it can be pasted 1:1
  // into a tenant's Design → Blocks. Emitted as an array (the shape that tab imports).
  const blockJson = useMemo(() => {
    if (!blockTokens || Object.keys(blockTokens).length === 0) return "";
    let host = "extracted";
    try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { /* keep default */ }
    const key = host.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "extracted";
    const set = {
      id:          `bts_${key}`,
      key,
      name:        `${host} (extracted)`,
      description: `Extracted from ${url}`,
      tokens:      blockTokens,
    };
    return JSON.stringify([set], null, 2);
  }, [blockTokens, url]);

  function copy() {
    navigator.clipboard?.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function copyBlock() {
    navigator.clipboard?.writeText(blockJson).then(() => {
      setCopiedBlock(true);
      setTimeout(() => setCopiedBlock(false), 1500);
    });
  }

  function download() {
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    let host = "tokens";
    try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { /* keep default */ }
    a.download = `${host}.tokens.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const color = tokens?.color ?? {};
  const typo  = tokens?.typography ?? {};
  const radius = tokens?.radius ?? {};
  const shadow = tokens?.shadow ?? {};

  return (
    <div className="space-y-6">
      {/* URL input */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <label htmlFor="extract-url" className="block text-sm font-medium text-neutral-700">
          Website-URL
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="extract-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && url.trim()) run(); }}
            placeholder="https://voorbeeld.nl"
            className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          <label className="flex shrink-0 items-center gap-1.5 text-xs text-neutral-600" title="Aantal pagina's dat wordt geanalyseerd (crawlt interne links)">
            Pagina&apos;s
            <select
              value={pages}
              onChange={(e) => setPages(Number(e.target.value))}
              className="rounded-lg border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-brand-500"
            >
              {[1, 3, 5, 8].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <button
            type="button"
            onClick={run}
            disabled={pending || !url.trim()}
            className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            {pending ? "Bezig…" : "Extraheer tokens"}
          </button>
        </div>
        <p className="mt-2 text-xs text-neutral-400">
          Analyseert de start-URL plus interne pagina&apos;s (crawlt links) en aggregeert de CSS voor een rijker palet. Werkt het best op sites die hun CSS direct serveren (Tailwind/shadcn, design systems).
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-900">Niet gelukt</p>
          <p className="mt-0.5 text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Results */}
      {tokens && (
        <div className="space-y-5">
          {notes.length > 0 && (
            <ul className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600 space-y-1">
              {notes.map((n, i) => <li key={i}>• {n}</li>)}
            </ul>
          )}

          {/* Colour swatches */}
          {Object.keys(color).length > 0 && (
            <div className="rounded-xl border border-neutral-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-neutral-900">Kleuren</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {Object.entries(color).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2.5">
                    <span
                      className="h-8 w-8 shrink-0 rounded-md border border-neutral-200"
                      style={{ background: v }}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium text-neutral-800">{k}</div>
                      <div className="truncate font-mono text-[11px] text-neutral-500">{v}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Typography / radius / shadow */}
          {(Object.keys(typo).length > 0 || Object.keys(radius).length > 0 || Object.keys(shadow).length > 0) && (
            <div className="grid gap-4 sm:grid-cols-3">
              <TokenList title="Typografie" entries={typo} />
              <TokenList title="Radius" entries={radius} />
              <TokenList title="Schaduw" entries={shadow} />
            </div>
          )}

          {/* Importable JSON */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-neutral-900">Importeerbare JSON</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={copy}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  {copied ? "Gekopieerd ✓" : "Kopieer"}
                </button>
                <button
                  type="button"
                  onClick={download}
                  className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-700"
                >
                  Download .json
                </button>
              </div>
            </div>
            <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-neutral-900 p-4 text-[11px] leading-relaxed text-neutral-100">
              {json}
            </pre>
            <p className="mt-2 text-xs text-neutral-400">
              Importeer dit in een tenant via Design → Builder (&quot;Of importeer een preset-JSON&quot;) of de Advanced-tab.
            </p>
          </div>

          {/* Block token set JSON — for Design → Blocks */}
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">Block token set</h2>
                <p className="text-xs text-neutral-500">Voor <strong>Design → Blocks</strong> (per-block styling)</p>
              </div>
              <button
                type="button"
                onClick={copyBlock}
                className="shrink-0 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
              >
                {copiedBlock ? "Gekopieerd ✓" : "Kopieer"}
              </button>
            </div>
            <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-neutral-900 p-4 text-[11px] leading-relaxed text-neutral-100">
              {blockJson}
            </pre>
            <p className="mt-2 text-xs text-neutral-400">
              Plak dit in een tenant via Design → <strong>Blocks</strong> → &quot;Import / export JSON&quot;, of gebruik &quot;Upload JSON file&quot; met de download hierboven. Wijs de set daarna toe aan een block via z&apos;n key.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}


// (block-token mapping now happens server-side in url-token-extractor)

function TokenList({ title, entries }: { title: string; entries: Record<string, string> }) {
  const keys = Object.keys(entries);
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{title}</h3>
      {keys.length === 0 ? (
        <p className="mt-2 text-xs text-neutral-400">—</p>
      ) : (
        <dl className="mt-2 space-y-1.5">
          {keys.map((k) => (
            <div key={k} className="flex items-baseline justify-between gap-2">
              <dt className="text-xs text-neutral-600">{k}</dt>
              <dd className="truncate font-mono text-[11px] text-neutral-500" title={entries[k]}>{entries[k]}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
