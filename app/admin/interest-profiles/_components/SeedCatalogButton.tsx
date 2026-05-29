"use client";

/**
 * SeedCatalogButton
 *
 * Client component that wraps the seedPlatformCatalogAction server action
 * with proper UX: loading spinner, success count, and error display.
 *
 * Replaces the bare <form action={seedPlatformCatalogFormAction}> in the
 * admin page so the user actually sees what happened.
 */

import { useState, useTransition } from "react";
import { useRouter }               from "next/navigation";
import { seedPlatformCatalogAction } from "../actions";

interface Props {
  /** When true, styles the button amber to signal the catalog is out of sync. */
  highlight?: boolean;
}

export function SeedCatalogButton({ highlight = false }: Props) {
  const router                      = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult]          = useState<
    | { ok: true;  inserted: number }
    | { ok: false; error: string }
    | null
  >(null);

  function handleClick() {
    setResult(null);
    startTransition(async () => {
      const res = await seedPlatformCatalogAction();
      setResult(res);
      if (res.ok) {
        // Refresh the server component tree so the profile table updates.
        router.refresh();
      }
    });
  }

  const baseClass = highlight
    ? "inline-flex items-center gap-1.5 rounded-lg border border-amber-400 bg-amber-50 px-3.5 py-2 text-sm font-medium text-amber-800 shadow-sm hover:bg-amber-100 hover:border-amber-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    : "inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3.5 py-2 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 hover:border-neutral-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={baseClass}
      >
        {isPending ? (
          <>
            {/* Spinner */}
            <svg
              className="h-4 w-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12" cy="12" r="10"
                stroke="currentColor" strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Seeding…
          </>
        ) : (
          <>
            <svg
              className="h-4 w-4 text-neutral-500"
              fill="none" viewBox="0 0 24 24"
              strokeWidth="1.5" stroke="currentColor"
            >
              <path
                strokeLinecap="round" strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
            Seed catalog
          </>
        )}
      </button>

      {/* Inline result feedback */}
      {result && (
        <p className={`text-xs font-medium ${result.ok ? "text-success-600" : "text-error-600"}`}>
          {result.ok
            ? `✓ ${result.inserted} profiles seeded`
            : `✗ ${result.error}`}
        </p>
      )}
    </div>
  );
}
