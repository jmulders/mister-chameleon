"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Error state for an admin or dashboard route. The sidebar stays, so the
 * operator can move on. The technical message is logged, never shown: it can
 * hold internals, and the reference is what support needs.
 */
export function RouteError({
  error,
  reset,
  homeHref,
}: {
  error:    Error & { digest?: string };
  reset:    () => void;
  homeHref: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="max-w-4xl p-4 sm:p-8">
      <div className="rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-lg font-semibold text-neutral-900">This page could not load</h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-500">
          Something went wrong on our side. Nothing was changed. Try again, and if it keeps
          happening, pass the reference below to support.
        </p>
        {error.digest && (
          <p className="mt-3 text-xs text-neutral-400">
            Reference <code className="font-mono text-neutral-600">{error.digest}</code>
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            Try again
          </button>
          <Link href={homeHref} className="text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900">
            Back to overview
          </Link>
        </div>
      </div>
    </div>
  );
}
