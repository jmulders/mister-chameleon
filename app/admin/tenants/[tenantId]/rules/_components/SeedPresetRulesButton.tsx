"use client";

/**
 * SeedPresetRulesButton
 *
 * Calls seedPresetRulesAction() and shows a brief success/error toast.
 * Preserves tenant-authored rules — only adds/refreshes blueprint-sourced
 * preset rules.  After a successful seed the page revalidates automatically
 * via the server action's revalidatePath() call.
 */

import { useState, useTransition } from "react";

interface Props {
  seedAction: () => Promise<{ ok: true; count: number } | { ok: false; error: string }>;
}

export function SeedPresetRulesButton({ seedAction }: Props) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "ok";    count: number }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  function handleClick() {
    setStatus({ kind: "idle" });
    startTransition(async () => {
      const result = await seedAction();
      if (result.ok) {
        setStatus({ kind: "ok", count: result.count });
      } else {
        setStatus({ kind: "error", message: result.error });
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? (
          <>
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Seeding…
          </>
        ) : (
          <>
            <span>⚡</span>
            Seed preset rules
          </>
        )}
      </button>

      {status.kind === "ok" && (
        <span className="text-sm text-green-700">
          ✓ {status.count} rules seeded — reload to see them.
        </span>
      )}

      {status.kind === "error" && (
        <span className="text-sm text-red-700">
          ✗ {status.message}
        </span>
      )}
    </div>
  );
}
