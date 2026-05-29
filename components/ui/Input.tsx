import { cn } from "@/lib/utils";

/**
 * Input
 *
 * A token-driven text input atom. Renders a standard `<input>` element
 * with consistent styling driven by CSS custom properties — no hardcoded
 * colours or radii.
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --form-input-bg           Input background (default: white)
 *   --form-input-border       Default border colour
 *   --form-input-radius       Border-radius
 *   --form-input-text         Input text colour
 *   --form-input-placeholder  Placeholder text colour
 *   --form-input-focus-ring   Focus ring / border colour on :focus-visible
 *   --color-error-500         Border colour when error = true
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   // Standard text input:
 *   <Input id="name" name="name" type="text" placeholder="Your name" />
 *
 *   // With error state:
 *   <Input id="email" name="email" type="email" error aria-invalid />
 *
 *   // All standard <input> HTML attributes are forwarded:
 *   <Input required disabled autoComplete="email" />
 */

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** When true, applies error-state border and ring colours. */
  error?: boolean;
}

export function Input({ error = false, className, style, ...props }: InputProps) {
  return (
    <input
      className={cn(
        // Base layout
        "block w-full px-3 py-2 text-sm leading-6",
        // Border + radius (token-driven via inline style)
        "border outline-none",
        // Transition
        "transition-colors duration-150",
        // Focus ring — uses focus-within if inside a wrapper, or direct focus
        "focus-visible:ring-2 focus-visible:ring-offset-0",
        className,
      )}
      style={{
        backgroundColor:    "var(--form-input-bg, white)",
        borderColor:        error ? "var(--color-error-500)" : "var(--form-input-border)",
        borderRadius:       "var(--form-input-radius, 0.375rem)",
        color:              "var(--form-input-text)",
        // Placeholder is handled via CSS custom property injected on the root
        // The ring colour isn't settable via inline style; see note below.
        ...style,
      }}
      {...props}
    />
  );
}

/*
 * ─── Note on focus ring colour ────────────────────────────────────────────────
 *
 *   Tailwind's `ring-*` utilities rely on CSS variables that the utility itself
 *   sets on the element. To make the ring respect `--form-input-focus-ring`,
 *   FormSectionBlock (or any parent "use client" component) can attach
 *   onFocus/onBlur event handlers that set `style.boxShadow` directly — the
 *   same technique used before this atom existed.  This atom intentionally
 *   does not mandate "use client" so it stays RSC-compatible.
 *
 *   Alternatively, pair with a `<style>` tag or CSS module that applies:
 *     input:focus-visible { box-shadow: 0 0 0 3px color-mix(in srgb, var(--form-input-focus-ring) 20%, transparent); }
 */
