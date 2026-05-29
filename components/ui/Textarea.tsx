import { cn } from "@/lib/utils";

/**
 * Textarea
 *
 * A token-driven multi-line text input atom. Mirrors the Input API but renders
 * a `<textarea>` element. All standard textarea HTML attributes are forwarded.
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --form-input-bg           Background (default: white)
 *   --form-input-border       Default border colour
 *   --form-input-radius       Border-radius
 *   --form-input-text         Text colour
 *   --form-input-placeholder  Placeholder text colour
 *   --color-error-500         Border colour when error = true
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   <Textarea id="message" name="message" rows={5} placeholder="Your message…" />
 *   <Textarea error aria-invalid aria-describedby="message-error" />
 */

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** When true, applies error-state border colour. */
  error?: boolean;
}

export function Textarea({ error = false, className, style, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        // Base layout
        "block w-full px-3 py-2 text-sm leading-6",
        // Border + outline
        "border outline-none",
        // Resize — allow vertical only by default
        "resize-y",
        // Transition
        "transition-colors duration-150",
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
    />
  );
}
