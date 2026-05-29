"use client";

import { useState } from "react";

type Status = "idle" | "form" | "loading" | "success" | "error";

/**
 * RollbackTriggerButton
 *
 * Renders a red "Trigger rollback" button. On click it expands into an inline
 * form asking for the target Vercel deployment URL and an optional reason.
 * On submit it fires the rollback.yml workflow via the admin API route.
 */
export function RollbackTriggerButton({ className }: { className?: string }) {
  const [status,        setStatus]        = useState<Status>("idle");
  const [deploymentUrl, setDeploymentUrl] = useState("");
  const [reason,        setReason]        = useState("");
  const [error,         setError]         = useState<string | null>(null);

  function openForm() {
    setStatus("form");
    setError(null);
  }

  function cancel() {
    setStatus("idle");
    setError(null);
  }

  async function trigger() {
    if (!deploymentUrl.trim()) return;
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/admin/github/workflow-dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflow: "rollback.yml",
          ref: "main",
          inputs: {
            deployment_url: deploymentUrl.trim(),
            reason: reason.trim() || "Manual rollback via admin panel",
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Unknown error");
        setStatus("error");
      } else {
        setStatus("success");
        setTimeout(() => {
          setStatus("idle");
          setDeploymentUrl("");
          setReason("");
        }, 5000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setStatus("error");
    }
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (status === "success") {
    return (
      <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-xs text-green-800">
        <strong>✓ Rollback workflow triggered.</strong> Check GitHub Actions for the run status.
      </div>
    );
  }

  // ── Idle / error (just the button) ─────────────────────────────────────────
  if (status === "idle" || (status === "error" && !deploymentUrl)) {
    return (
      <div className="flex flex-col gap-1">
        <button type="button" onClick={openForm} className={className}>
          <GitHubIcon />
          Trigger rollback
        </button>
        {status === "error" && error && (
          <p className="text-xs text-red-600">{error}</p>
        )}
      </div>
    );
  }

  // ── Form (+ loading + error-with-form) ─────────────────────────────────────
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
      <p className="text-xs font-semibold text-red-800">Trigger rollback workflow</p>

      <div className="space-y-2">
        <label className="block">
          <span className="text-xs font-medium text-neutral-700">
            Vercel deployment URL <span className="text-red-500">*</span>
          </span>
          <input
            type="url"
            placeholder="https://mister-chameleon-abc123.vercel.app"
            value={deploymentUrl}
            onChange={(e) => setDeploymentUrl(e.target.value)}
            disabled={status === "loading"}
            className="mt-1 w-full rounded border border-neutral-200 bg-white px-3 py-1.5 font-mono text-xs text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-red-400 disabled:opacity-60"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-neutral-700">Reason</span>
          <input
            type="text"
            placeholder="e.g. CSS regression on homepage"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={status === "loading"}
            className="mt-1 w-full rounded border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-red-400 disabled:opacity-60"
          />
        </label>
      </div>

      {status === "error" && error && (
        <p className="text-xs text-red-700">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={trigger}
          disabled={!deploymentUrl.trim() || status === "loading"}
          className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
        >
          {status === "loading" ? (
            <><SpinnerIcon /> Triggering…</>
          ) : (
            "Trigger rollback"
          )}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={status === "loading"}
          className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────────

function GitHubIcon() {
  return (
    <svg className="size-3.5 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
               0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
               -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
               .07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15
               -.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27
               .68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12
               .51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48
               0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
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
