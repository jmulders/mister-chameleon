"use client";

/**
 * ViewAllLink
 *
 * Client Component — renders the "View all →" link at the foot of a
 * ListingBlock with a hover-opacity effect.
 *
 * Kept as a dedicated file so ListingBlock can remain a Server Component
 * while still supporting the inline-style hover interaction.
 *
 * Props
 *   href   — destination URL
 *   label  — link text (default: "View all")
 */

interface ViewAllLinkProps {
  href:   string;
  label?: string;
}

export function ViewAllLink({ href, label = "View all" }: ViewAllLinkProps) {
  return (
    <div>
      <a
        href={href}
        style={{
          display:        "inline-flex",
          alignItems:     "center",
          gap:            "0.375rem",
          fontSize:       "0.875rem",
          fontWeight:     600,
          color:          "var(--text)",
          textDecoration: "none",
          transition:     "color var(--transition-base), opacity var(--transition-base)",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--primary)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text)"; }}
      >
        {label}
        {/* Arrow → */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 8h10M9 4l4 4-4 4" />
        </svg>
      </a>
    </div>
  );
}
