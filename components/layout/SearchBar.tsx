"use client";

/**
 * SearchBar
 *
 * Slim search input rendered in the middle band of the header_triband layout.
 * On submit (Enter or icon click), navigates to the search results page with
 * the query as a `?q=` param.
 *
 * Fully client-side — no server dependency.  The search results page is
 * responsible for reading the query param and rendering results.
 */

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  /** Path of the search results page. Defaults to "/search". */
  searchHref?: string;
  /** Placeholder text inside the input. */
  placeholder?: string;
  className?: string;
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      className="size-4 shrink-0"
    >
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path strokeLinecap="round" d="m13.5 13.5 3.5 3.5" />
    </svg>
  );
}

export function SearchBar({
  searchHref  = "/search",
  placeholder = "Search…",
  className,
}: SearchBarProps) {
  const [query, setQuery]   = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router   = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      inputRef.current?.focus();
      return;
    }
    // Guard: a non-string / empty href (e.g. an unwrapped CMS link object) would
    // stringify to "[object Object]" and 404. Fall back to the canonical path.
    const base = typeof searchHref === "string" && searchHref ? searchHref : "/search";
    router.push(`${base}?q=${encodeURIComponent(q)}`);
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className={cn("flex items-center", className)}
    >
      <div
        className={cn(
          "flex items-center gap-2 rounded-full border px-3 py-1.5 transition-all duration-150",
          // Colour tokens from header CSS variables
          "border-[var(--header-border,var(--border))]",
          "bg-[var(--header-input-bg,var(--bg-subtle,var(--bg)))]",
          focused
            ? "ring-2 ring-[var(--ring)] ring-offset-1 border-transparent"
            : "hover:border-[var(--primary,var(--ring))]",
        )}
      >
        {/* Icon — also acts as submit button */}
        <button
          type="submit"
          aria-label="Search"
          className={cn(
            "shrink-0 transition-colors",
            "text-[var(--text-muted)] hover:text-[var(--text-brand,var(--primary))]",
            "focus-visible:outline-none",
          )}
        >
          <SearchIcon />
        </button>

        <input
          ref={inputRef}
          type="search"
          name="q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          autoComplete="off"
          className={cn(
            "w-56 min-w-0 bg-transparent text-sm outline-none",
            "text-[var(--header-fg,var(--text))]",
            "placeholder:text-[var(--text-muted)]",
            // Expand on focus for better usability
            "transition-[width] duration-200 focus:w-72",
          )}
        />
      </div>
    </form>
  );
}
