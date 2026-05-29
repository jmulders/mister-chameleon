/**
 * MetaList
 *
 * Vertical stack of labelled metadata rows. Used for structured fact-lists
 * such as job vacancy details (location, contract type, salary, deadline).
 *
 * ─── Components ───────────────────────────────────────────────────────────────
 *
 *   MetaItem    — single label + value row with border-bottom separator
 *   MetaList    — vertical container for MetaItem elements
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --card-border        Row separator colour
 *   --text               Value text colour (default)
 *   --text-muted         Label text colour
 *   --color-error-500    Urgent value colour (e.g. approaching deadlines)
 */

// ── MetaItem ──────────────────────────────────────────────────────────────────

export interface MetaItemProps {
  /** Short descriptor shown in a fixed-width column on the left. */
  label:   string;
  /** The value to display. Accepts a string; render complex values via children. */
  value?:  string;
  /** When true, renders the value in the error accent colour. */
  urgent?: boolean;
  /** Custom content in place of (or alongside) value string. */
  children?: React.ReactNode;
}

export function MetaItem({ label, value, urgent, children }: MetaItemProps) {
  return (
    <div
      style={{
        display:             "grid",
        gridTemplateColumns: "8rem 1fr",
        gap:                 "0.5rem",
        alignItems:          "baseline",
        padding:             "0.625rem 0",
        borderBottom:        "1px solid var(--card-border)",
      }}
    >
      <span
        style={{
          fontSize:   "0.8125rem",
          color:      "var(--text-muted)",
          fontWeight: 500,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize:   "0.9375rem",
          color:      urgent ? "var(--color-error-500, #ef4444)" : "var(--text)",
          fontWeight: urgent ? 600 : 400,
        }}
      >
        {children ?? value}
      </span>
    </div>
  );
}

// ── MetaList ──────────────────────────────────────────────────────────────────

export interface MetaListProps {
  /** MetaItem elements. */
  children: React.ReactNode;
}

/**
 * Container for a vertical list of MetaItem rows. Removes the bottom border
 * from the last child so the list doesn't end with a hanging separator.
 */
export function MetaList({ children }: MetaListProps) {
  return (
    <div
      className="[&>*:last-child]:border-b-0"
      style={{ padding: "0 1.5rem" }}
    >
      {children}
    </div>
  );
}
