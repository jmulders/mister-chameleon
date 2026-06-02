"use client";

import { useState } from "react";

export function DemoCopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-50 transition-colors"
    >
      {copied ? "Copied!" : "Copy link"}
    </button>
  );
}
