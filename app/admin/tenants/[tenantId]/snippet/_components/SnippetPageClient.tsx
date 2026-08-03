"use client";

/**
 * SnippetPageClient
 *
 * Interactive component for the snippet installation page.
 * Handles: site key generation, copy-to-clipboard, enable/disable toggle.
 */

import { useState, useTransition } from "react";
import {
  generateSnippetSiteKeyAction,
  setSnippetEnabledAction,
} from "../actions";

interface SnippetPageClientProps {
  tenantId:    string;
  siteKey:     string | null;
  enabled:     boolean;
  generatedAt: string | null;
  snippetSrc:  string;
  /** Per-tenant snippet timing, baked into the embed as data-mc-* when set. */
  revealMs?:   number | null;
  callMs?:     number | null;
}

// ── Helper: copy to clipboard ──────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write failed — silent
    }
  }

  return (
    <button
      onClick={handleCopy}
      type="button"
      className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
    >
      {copied ? (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3.5 text-green-500">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Copy
        </>
      )}
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function SnippetPageClient({
  tenantId,
  siteKey: initialSiteKey,
  revealMs,
  callMs,
  enabled: initialEnabled,
  generatedAt: initialGeneratedAt,
  snippetSrc,
}: SnippetPageClientProps) {
  const [siteKey,     setSiteKey]     = useState(initialSiteKey);
  const [enabled,     setEnabled]     = useState(initialEnabled);
  const [generatedAt, setGeneratedAt] = useState(initialGeneratedAt);
  const [error,       setError]       = useState<string | null>(null);
  const [isPending,   startTransition] = useTransition();

  // Per-tenant timing overrides, when set, are baked into the embed so the copied
  // script tag carries them (the snippet.js file itself is generic and cached).
  const timingAttrs =
    (typeof revealMs === "number" ? `\n  data-mc-reveal-ms="${revealMs}"` : "") +
    (typeof callMs   === "number" ? `\n  data-mc-call-ms="${callMs}"`     : "");
  const scriptTag = siteKey
    ? `<script\n  src="${snippetSrc}"\n  data-site-key="${siteKey}"${timingAttrs}\n  async\n></script>`
    : null;

  // ── Generate / Regenerate site key ──────────────────────────────────────────

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const result = await generateSnippetSiteKeyAction(tenantId);
      if (result.ok) {
        if (result.siteKey) {
          setSiteKey(result.siteKey);
          setGeneratedAt(new Date().toISOString());
        }
      } else if ("error" in result) {
        setError(result.error as string);
      }
    });
  }

  // ── Toggle enabled ───────────────────────────────────────────────────────────

  function handleToggleEnabled() {
    const newEnabled = !enabled;
    setEnabled(newEnabled); // optimistic
    setError(null);
    startTransition(async () => {
      const result = await setSnippetEnabledAction(tenantId, newEnabled);
      if (!result.ok && "error" in result) {
        setEnabled(!newEnabled); // rollback
        setError(result.error as string);
      }
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">

      {/* ── Status bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className={`size-2.5 rounded-full ${enabled && siteKey ? "bg-green-400" : "bg-neutral-300"}`} />
          <div>
            <p className="text-sm font-medium text-neutral-900">
              {enabled && siteKey ? "Active" : !siteKey ? "Not configured" : "Disabled"}
            </p>
            <p className="text-xs text-neutral-500">
              {!siteKey
                ? "Generate a site key to start"
                : enabled
                ? "The snippet is personalising visitors on your site"
                : "Integration is paused. Generate a key and enable to start"}
            </p>
          </div>
        </div>

        {siteKey && (
          <button
            type="button"
            onClick={handleToggleEnabled}
            disabled={isPending}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50
              ${enabled ? "bg-indigo-600" : "bg-neutral-200"}`}
            role="switch"
            aria-checked={enabled}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                ${enabled ? "translate-x-5" : "translate-x-0"}`}
            />
          </button>
        )}
      </div>

      {/* ── Site key section ─────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-neutral-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-neutral-900">Site Key</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Your public identifier, safe to include in page HTML.
          </p>
        </div>

        <div className="px-6 py-5">
          {siteKey ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <code className="flex-1 rounded-lg bg-neutral-50 border border-neutral-200 px-4 py-2.5 font-mono text-sm text-neutral-800 select-all">
                  {siteKey}
                </code>
                <CopyButton text={siteKey} />
              </div>

              {generatedAt && (
                <p className="text-xs text-neutral-400">
                  Generated {new Date(generatedAt).toLocaleDateString("en-GB", {
                    day:   "numeric",
                    month: "long",
                    year:  "numeric",
                    hour:  "2-digit",
                    minute:"2-digit",
                  })}
                </p>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                    <path d="M23 4v6h-6M1 20v-6h6"/>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                  </svg>
                  Regenerate key
                </button>
                <span className="text-xs text-neutral-400">
                  Regenerating invalidates the current key immediately.
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <p className="text-sm text-neutral-500">No site key yet.</p>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-60"
              >
                {isPending ? "Generating…" : "Generate site key"}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── Script tag ───────────────────────────────────────────────────────── */}
      {scriptTag && (
        <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-neutral-100 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">Script Tag</h2>
              <p className="mt-0.5 text-xs text-neutral-500">
                Paste this into your site&apos;s <code className="font-mono text-xs">&lt;head&gt;</code>, before the closing tag.
              </p>
            </div>
            <CopyButton text={scriptTag} />
          </div>

          <div className="px-6 py-5">
            <pre className="overflow-x-auto rounded-lg bg-neutral-950 px-5 py-4 text-sm text-neutral-100 leading-relaxed">
              <code>{scriptTag}</code>
            </pre>
          </div>
        </section>
      )}

      {/* ── Error display ────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Markup guide ─────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-neutral-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-neutral-900">Markup Convention</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Mark the elements you want personalised with <code className="font-mono text-xs">data-mc-slot</code>.
          </p>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Slot reference table */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Available Slot Names
            </h3>
            <div className="overflow-x-auto rounded-lg border border-neutral-200">
              <table className="min-w-full divide-y divide-neutral-100 text-xs">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold text-neutral-700">Slot name</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-neutral-700">Content</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-neutral-700">Block</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {[
                    ["hero-title",       "Primary headline",            "Hero"],
                    ["hero-subtitle",    "Supporting paragraph",        "Hero"],
                    ["hero-tag",         "Eyebrow / badge label",       "Hero"],
                    ["hero-cta-label",   "Primary CTA button text",     "Hero"],
                    ["hero-cta-href",    "Primary CTA link URL",        "Hero"],
                    ["hero-cta2-label",  "Secondary CTA button text",   "Hero"],
                    ["hero-cta2-href",   "Secondary CTA link URL",      "Hero"],
                    ["proof-title",      "Section heading",             "Proof"],
                    ["proof-item-0-title","First proof point (label)",  "Proof"],
                    ["proof-item-0-text", "First proof point (text)",   "Proof"],
                    ["cta-title",        "CTA headline",                "CTA"],
                    ["cta-text",         "CTA supporting copy",         "CTA"],
                    ["cta-cta-label",    "CTA button text",             "CTA"],
                    ["cta-cta-href",     "CTA button URL",              "CTA"],
                  ].map(([slot, content, block]) => (
                    <tr key={slot}>
                      <td className="px-4 py-2.5 font-mono text-indigo-700">{slot}</td>
                      <td className="px-4 py-2.5 text-neutral-600">{content}</td>
                      <td className="px-4 py-2.5 text-neutral-400">{block}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Code example */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Example
            </h3>
            <pre className="overflow-x-auto rounded-lg bg-neutral-950 px-5 py-4 text-xs text-neutral-100 leading-relaxed">
              <code>{`<!-- Hero section -->
<section>
  <span  data-mc-slot="hero-tag">Adaptive websites</span>
  <h1    data-mc-slot="hero-title">Default headline</h1>
  <p     data-mc-slot="hero-subtitle">Default subtitle text here.</p>
  <a     data-mc-slot="hero-cta-label"
         data-mc-slot-href="hero-cta-href"
         href="/signup">Default CTA</a>
</section>

<!-- For HTML content, add data-mc-html="true" -->
<p data-mc-slot="hero-subtitle" data-mc-html="true">
  Default subtitle with <strong>bold</strong> text.
</p>`}</code>
            </pre>
          </div>

          {/* Notes */}
          <ul className="space-y-2 text-xs text-neutral-500">
            <li className="flex gap-2">
              <span className="text-indigo-400">•</span>
              The snippet replaces <code className="font-mono bg-neutral-100 px-1 rounded">textContent</code> by default.
              Add <code className="font-mono bg-neutral-100 px-1 rounded">data-mc-html=&quot;true&quot;</code> to use <code className="font-mono bg-neutral-100 px-1 rounded">innerHTML</code>.
            </li>
            <li className="flex gap-2">
              <span className="text-indigo-400">•</span>
              Use <code className="font-mono bg-neutral-100 px-1 rounded">data-mc-slot-href=&quot;slot-name&quot;</code> on <code className="font-mono bg-neutral-100 px-1 rounded">&lt;a&gt;</code> elements to also swap the <code className="font-mono bg-neutral-100 px-1 rounded">href</code>.
            </li>
            <li className="flex gap-2">
              <span className="text-indigo-400">•</span>
              If the decide endpoint does not respond within 1.5 s, the page reveals with original content, so there is no user-visible delay.
            </li>
            <li className="flex gap-2">
              <span className="text-indigo-400">•</span>
              The <code className="font-mono bg-neutral-100 px-1 rounded">async</code> attribute on the script tag is required. It prevents render blocking.
            </li>
          </ul>
        </div>
      </section>

    </div>
  );
}
