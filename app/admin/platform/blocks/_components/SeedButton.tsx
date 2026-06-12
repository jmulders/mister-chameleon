"use client";

import { useState, useTransition } from "react";
import { seedPlatformBlocksAction } from "@/lib/adaptive-blocks/adaptive-blocks-actions";

interface SeedButtonProps {
  /** When true, show overwrite variant (already seeded, re-seed?) */
  hasBlocks: boolean;
}

export function SeedButton({ hasBlocks }: SeedButtonProps) {
  const [result,     setResult]     = useState<string | null>(null);
  const [isPending,  startTransition] = useTransition();

  const run = (overwrite: boolean) => {
    setResult(null);
    startTransition(async () => {
      const res = await seedPlatformBlocksAction(overwrite);
      if (res.ok) {
        setResult(`✓ ${res.inserted} blocks seeded${res.skipped > 0 ? `, ${res.skipped} skipped` : ""}. Reloading…`);
        // Hard-reload so the server component re-fetches
        window.location.reload();
      } else {
        setResult(`Error: ${res.error}`);
      }
    });
  };

  if (hasBlocks) {
    return (
      <div className="flex items-center gap-3">
        {result && (
          <span className={`text-xs ${result.startsWith("Error") ? "text-red-600" : "text-green-700"}`}>
            {result}
          </span>
        )}
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors disabled:opacity-50"
        >
          {isPending ? "Seeding…" : "Re-seed (overwrite)"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-amber-900">No platform blocks in the database yet</p>
          <p className="mt-0.5 text-xs text-amber-800 max-w-xl">
            Click &ldquo;Seed platform blocks&rdquo; to populate the database with default Dutch content for all
            known variant keys (hero, proof, CTA, feature, conversion, notification).
            You can overwrite or extend the content per tenant afterwards.
          </p>
          {result && (
            <p className={`mt-2 text-xs font-semibold ${result.startsWith("Error") ? "text-red-700" : "text-green-700"}`}>
              {result}
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(false)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
        >
          {isPending ? "Seeding…" : "Seed platform blocks"}
        </button>
      </div>
    </div>
  );
}
