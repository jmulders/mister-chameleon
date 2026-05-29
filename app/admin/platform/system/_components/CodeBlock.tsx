"use client";

import { useState, useCallback } from "react";

/**
 * CodeBlock
 *
 * Dark-terminal-style code display with a one-click Copy button.
 * Clicking the button (or the block itself) copies the full content to
 * the clipboard and briefly shows a ✓ confirmation.
 */
export function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the text so the user can copy manually
    }
  }, [children]);

  return (
    <div className="relative group rounded-lg bg-neutral-900 overflow-hidden">
      {/* Copy button — visible on hover or after copy */}
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy to clipboard"
        className={`absolute right-3 top-3 flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium transition-all ${
          copied
            ? "bg-green-600 text-white opacity-100"
            : "bg-neutral-700 text-neutral-300 opacity-0 group-hover:opacity-100 hover:bg-neutral-600"
        }`}
      >
        {copied ? (
          <>
            <CheckIcon />
            Copied
          </>
        ) : (
          <>
            <CopyIcon />
            Copy
          </>
        )}
      </button>

      {/* Code content */}
      <code className="block px-5 py-3.5 font-mono text-sm text-green-400 whitespace-pre-wrap select-all leading-relaxed">
        {children}
      </code>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg className="size-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="5" y="5" width="9" height="9" rx="1.5" />
      <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="size-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M2.5 8.5l4 4 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
