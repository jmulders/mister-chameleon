"use client";

import { useState, useEffect } from "react";

type Status = "idle" | "loading" | "success" | "error";

/**
 * GitCommitPanel
 *
 * Only renders in development (gated server-side via the API route).
 * Shows changed files, a commit message input, and a commit+push button.
 */
export function GitCommitPanel() {
  const [changedFiles, setChangedFiles]   = useState<string[]>([]);
  const [available,    setAvailable]      = useState<boolean | null>(null);
  const [message,      setMessage]        = useState("");
  const [deploy,       setDeploy]         = useState(true);
  const [status,       setStatus]         = useState<Status>("idle");
  const [output,       setOutput]         = useState<string | null>(null);
  const [error,        setError]          = useState<string | null>(null);

  // Probe on mount — also tells us if we're in dev mode
  useEffect(() => {
    fetch("/api/admin/git/commit-push")
      .then((r) => r.json())
      .then((d) => {
        setAvailable(d.available ?? false);
        setChangedFiles(d.changedFiles ?? []);
      })
      .catch(() => setAvailable(false));
  }, [status]); // re-fetch after a successful commit to refresh the file list

  // Not in dev mode — render nothing
  if (available === false) return null;
  // Still loading
  if (available === null) return null;

  async function handleCommit() {
    if (!message.trim()) return;
    setStatus("loading");
    setOutput(null);
    setError(null);

    // Step 1: commit & push
    const res  = await fetch("/api/admin/git/commit-push", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ message }),
    });
    const data = await res.json();

    if (!res.ok) {
      setStatus("error");
      setError(data.error ?? "Onbekende fout");
      setOutput(data.output ?? null);
      return;
    }

    const lines = [data.output ?? ""];

    // Step 2: trigger production workflow (if checkbox checked)
    if (deploy) {
      const wfRes  = await fetch("/api/admin/github/workflow-dispatch", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ workflow: "production.yml", ref: "main" }),
      });
      const wfData = await wfRes.json();
      if (wfRes.ok) {
        lines.push("✓ GitHub Actions workflow gestart (production.yml)");
      } else {
        lines.push(`⚠ Workflow trigger mislukt: ${wfData.error ?? wfRes.status}`);
      }
    }

    setStatus("success");
    setOutput(lines.filter(Boolean).join("\n\n"));
    setMessage("");
    setTimeout(() => setStatus("idle"), 6000);
  }

  const hasChanges = changedFiles.length > 0;

  return (
    <div className="space-y-4">
      {/* Changed files */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">
          Gewijzigde bestanden
        </p>
        {hasChanges ? (
          <ul className="space-y-1">
            {changedFiles.map((f) => {
              const flag = f.slice(0, 2).trim();
              const path = f.slice(3);
              return (
                <li key={f} className="flex items-center gap-2 font-mono text-xs text-neutral-700">
                  <span className={`w-4 font-semibold ${
                    flag === "M"  ? "text-amber-600"  :
                    flag === "A"  ? "text-green-600"  :
                    flag === "D"  ? "text-red-600"    :
                    flag === "??" ? "text-blue-500"   : "text-neutral-400"
                  }`}>{flag || "·"}</span>
                  {path}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-neutral-400 italic">Working tree is clean — niets te committen.</p>
        )}
      </div>

      {/* Commit message + button */}
      <div className="flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && hasChanges && message.trim() && handleCommit()}
          placeholder="Commit message…"
          disabled={!hasChanges || status === "loading"}
          className="flex-1 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-900 placeholder-neutral-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleCommit}
          disabled={!hasChanges || !message.trim() || status === "loading"}
          className="inline-flex items-center gap-1.5 rounded-md border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 transition-colors hover:border-brand-300 hover:bg-brand-100 disabled:opacity-50"
        >
          {status === "loading" ? (
            <><SpinnerIcon /> {deploy ? "Pushen & deployen…" : "Pushen…"}</>
          ) : status === "success" ? (
            <><CheckIcon /> {deploy ? "Gepusht & gedeployed ✓" : "Gepusht ✓"}</>
          ) : (
            <><GitIcon /> {deploy ? "Commit, push & deploy" : "Commit & push"}</>
          )}
        </button>
      </div>

      {/* Deploy checkbox */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={deploy}
          onChange={(e) => setDeploy(e.target.checked)}
          disabled={status === "loading"}
          className="h-3.5 w-3.5 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
        />
        <span className="text-xs text-neutral-600">
          Deploy to production na push <span className="text-neutral-400">(triggert production.yml)</span>
        </span>
      </label>

      {/* Error */}
      {status === "error" && error && (
        <p className="rounded-md bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700">{error}</p>
      )}

      {/* Output log */}
      {output && (
        <pre className="rounded-md bg-neutral-900 px-4 py-3 text-xs text-green-400 overflow-x-auto whitespace-pre-wrap">
          {output}
        </pre>
      )}
    </div>
  );
}

function SpinnerIcon() {
  return (
    <svg className="size-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M2.5 8.5l4 4 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GitIcon() {
  return (
    <svg className="size-3.5 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M15.698 7.287 8.712.302a1.03 1.03 0 0 0-1.457 0l-1.45 1.45 1.84 1.84a1.223 1.223 0 0 1 1.55 1.56l1.773 1.774a1.224 1.224 0 0 1 1.267 2.025 1.226 1.226 0 0 1-2.002-1.334L8.58 5.963v4.353a1.226 1.226 0 1 1-1.008-.036V5.887a1.226 1.226 0 0 1-.666-1.608L5.093 2.465l-4.79 4.79a1.03 1.03 0 0 0 0 1.457l6.986 6.986a1.03 1.03 0 0 0 1.457 0l6.953-6.953a1.031 1.031 0 0 0-.001-1.458z" />
    </svg>
  );
}
