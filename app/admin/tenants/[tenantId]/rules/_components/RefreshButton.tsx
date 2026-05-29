"use client";

/**
 * RefreshButton
 *
 * Minimal client component that triggers a Next.js router.refresh() so the
 * enclosing server component tree re-fetches its data without a full page
 * navigation.  Used to add a manual "Refresh" control to server-rendered
 * panels such as VariantUsagePanel and RulesMatrix.
 */

import { useRouter }     from "next/navigation";
import { useTransition } from "react";

interface RefreshButtonProps {
  label?: string;
}

export function RefreshButton({ label = "Refresh" }: RefreshButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(() => { router.refresh(); });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      title="Re-fetch data from CMS and rules config"
      className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-600 shadow-sm transition-all hover:bg-neutral-50 hover:text-neutral-800 disabled:opacity-60 disabled:cursor-wait"
    >
      {/* Rotate icon while pending */}
      <svg
        className={`size-3 shrink-0 ${isPending ? "animate-spin" : ""}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 2v6h-6" />
        <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
        <path d="M3 22v-6h6" />
        <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      </svg>
      {isPending ? "Refreshing…" : label}
    </button>
  );
}
