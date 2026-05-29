"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "success" | "error";

/**
 * WorkflowButton
 *
 * Triggers a GitHub Actions workflow_dispatch event via the admin API route.
 * Shows loading / success / error feedback inline.
 */
export function WorkflowButton({
  workflow,
  branch = "main",
  inputs,
  children,
  className,
}: {
  workflow: string;
  branch?: string;
  inputs?: Record<string, string>;
  children: React.ReactNode;
  className?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [error,  setError]  = useState<string | null>(null);

  async function trigger() {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/admin/github/workflow-dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow, ref: branch, inputs }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Unknown error");
        setStatus("error");
      } else {
        setStatus("success");
        setTimeout(() => setStatus("idle"), 3000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={trigger}
        disabled={status === "loading"}
        className={className}
      >
        {status === "loading" ? (
          <><SpinnerIcon /> Triggering…</>
        ) : status === "success" ? (
          <><CheckIcon /> Triggered ✓</>
        ) : (
          children
        )}
      </button>
      {status === "error" && error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────────

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
