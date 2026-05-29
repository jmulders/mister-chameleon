import { cn } from "@/lib/utils";

/**
 * Select
 *
 * A token-driven native `<select>` atom. All standard select HTML attributes
 * are forwarded, making it a drop-in replacement for `<select>` with
 * consistent cross-tenant styling.
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --form-input-bg       Background (default: white)
 *   --form-input-border   Default border colour
 *   --form-input-radius   Border-radius
 *   --form-input-text     Text colour
 *   --color-error-500     Border colour when error = true
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   <Select id="country" name="country">
 *     <option value="">Select a country</option>
 *     <option value="nl">Netherlands</option>
 *   </Select>
 *
 *   <Select error aria-invalid defaultValue="">
 *     <option value="" disabled>Please choose…</option>
 *     {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
 *   </Select>
 */

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** When true, applies error-state border colour. */
  error?: boolean;
}

export function Select({ error = false, className, style, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        // Base layout
        "block w-full px-3 py-2 text-sm leading-6",
        // Border + outline
        "border outline-none",
        // Transition
        "transition-colors duration-150",
        // Cursor
        "cursor-pointer",
        // Focus ring
        "focus-visible:ring-2 focus-visible:ring-offset-0",
        className,
      )}
      style={{
        backgroundColor: "var(--form-input-bg, white)",
        borderColor:     error ? "var(--color-error-500)" : "var(--form-input-border)",
        borderRadius:    "var(--form-input-radius, 0.375rem)",
        color:           "var(--form-input-text)",
        ...style,
      }}
      {...props}
    >
      {children}
    </select>
  );
}
