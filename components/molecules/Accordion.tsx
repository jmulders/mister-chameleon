/**
 * Accordion
 *
 * Zero-JS progressive disclosure using native <details>/<summary>. A molecule
 * built on Text and Stack atoms. Used by FaqSectionBlock and any other block
 * that needs collapsible content panels.
 *
 * ─── Components ───────────────────────────────────────────────────────────────
 *
 *   AccordionItem   — individual collapsible panel (title + children)
 *   Accordion       — Stack wrapper for a list of AccordionItem elements
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --card-bg               Item background
 *   --card-border           Item border colour
 *   --card-radius           Item border-radius
 *   --text                  Question text colour (default and hover — neutral)
 *   --text-subtle           Chevron icon colour
 *   --font-subheading-weight  Question font weight
 */

import { Stack } from "@/components/primitives/Stack";
import { Text }  from "@/components/primitives/Text";

// ── AccordionItem ──────────────────────────────────────────────────────────────

export interface AccordionItemProps {
  /** The collapsible panel title, shown in the summary bar. */
  title:       string;
  /** Content revealed when the item is opened. */
  children:    React.ReactNode;
  /** Whether the item is open by default. Defaults to false. */
  defaultOpen?: boolean;
}

export function AccordionItem({ title, children, defaultOpen }: AccordionItemProps) {
  return (
    <details
      open={defaultOpen}
      className="group border"
      style={{
        backgroundColor: "var(--card-bg)",
        borderColor:     "var(--card-border)",
        borderRadius:    "var(--card-radius)",
      }}
    >
      <summary
        className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 focus-visible:outline-none focus-visible:ring-2"
        style={{
          fontWeight: "var(--font-subheading-weight)",
          color:      "var(--text)",
        }}
      >
        {/* Hover affordance via opacity, not color — avoids any dependency on
            --primary / --text-brand which both resolve to the brand/accent color
            and would show as purple on the MC default theme.  opacity-75 gives
            a clear visual "this is interactive" signal that is fully theme-neutral:
            it works identically on Dutch Orange, Valentine Pink, Dark Contrast,
            and every other preset without hard-coding a brand color. */}
        <span className="transition-opacity group-hover:opacity-75">
          {title}
        </span>
        {/* Chevron — rotates 180° when open via group-open modifier */}
        <svg
          className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
          style={{ color: "var(--text-subtle)" }}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </summary>

      <div className="px-5 pb-5">
        {children}
      </div>
    </details>
  );
}

// ── Accordion ──────────────────────────────────────────────────────────────────

export interface AccordionProps {
  /** AccordionItem elements to stack. */
  children: React.ReactNode;
  /** Gap between items (Stack gap units). Defaults to 2. */
  gap?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16;
}

export function Accordion({ children, gap = 2 }: AccordionProps) {
  return (
    <Stack gap={gap}>
      {children}
    </Stack>
  );
}
