import { cn } from "@/lib/utils";

/**
 * FormField
 *
 * A composable form field wrapper that renders:
 *   label → field (child) → optional help text → optional error message
 *
 * This atom handles the consistent structure and accessibility wiring that
 * every form field needs. The actual input (Input, Textarea, Select, or any
 * other element) is passed as `children`.
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --form-label-color    Label text colour
 *   --form-label-weight   Label font weight
 *   --form-help-color     Help / hint text colour
 *   --color-error-500     Error message text colour + required asterisk colour
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   // Basic field:
 *   <FormField label="Full name" htmlFor="name">
 *     <Input id="name" name="name" type="text" />
 *   </FormField>
 *
 *   // Required with help text:
 *   <FormField label="Email" htmlFor="email" required hint="We'll never share your email.">
 *     <Input id="email" name="email" type="email" />
 *   </FormField>
 *
 *   // With validation error:
 *   <FormField label="Message" htmlFor="message" error="Message is required">
 *     <Textarea id="message" name="message" error aria-invalid aria-describedby="message-error" />
 *   </FormField>
 *
 *   // Using the auto-generated error ID in the child:
 *   <FormField label="Phone" htmlFor="phone" error="Please enter a valid phone number">
 *     {(errorId) => (
 *       <Input id="phone" name="phone" error aria-invalid aria-describedby={errorId} />
 *     )}
 *   </FormField>
 *
 * ─── Accessibility ────────────────────────────────────────────────────────────
 *
 *   - The label is associated with the input via `htmlFor` → `id`.
 *   - The error message gets a stable `id` derived from `htmlFor` so the input
 *     can reference it via `aria-describedby`. The `id` is exposed via the
 *     children render-prop form.
 *   - Error messages use role="alert" and are announced by screen readers on
 *     re-render when a new error appears.
 */

export interface FormFieldProps {
  /** Label text shown above the field. */
  label:      string;
  /**
   * The `id` of the associated form control. Sets the label's `htmlFor` and
   * drives the generated error-message `id`.
   */
  htmlFor:    string;
  /** Marks the field as required and appends a styled asterisk to the label. */
  required?:  boolean;
  /** Hint / help text shown below the field when there is no error. */
  hint?:      string;
  /** Validation error message. When set, displayed below the field in red. */
  error?:     string;
  /** Additional class names applied to the outermost wrapper div. */
  className?: string;
  /**
   * Field content. Accepts either:
   *   - A React node (plain children usage)
   *   - A render function `(errorId: string | undefined) => ReactNode` that
   *     receives the generated error-message ID for aria-describedby wiring.
   */
  children:   React.ReactNode | ((errorId: string | undefined) => React.ReactNode);
}

export function FormField({
  label,
  htmlFor,
  required  = false,
  hint,
  error,
  className,
  children,
}: FormFieldProps) {
  const hasError = Boolean(error);
  // Stable ID derived from the control ID — safe to pass to aria-describedby
  const errorId  = hasError ? `${htmlFor}-error` : undefined;

  const resolvedChildren =
    typeof children === "function" ? children(errorId) : children;

  return (
    <div className={cn("flex flex-col gap-1", className)}>

      {/* Label */}
      <label
        htmlFor={htmlFor}
        className="text-sm"
        style={{
          fontWeight: "var(--form-label-weight, 500)",
          color:      "var(--form-label-color)",
        }}
      >
        {label}
        {required && (
          <span
            aria-hidden="true"
            className="ml-1"
            style={{ color: "var(--color-error-500)" }}
          >
            *
          </span>
        )}
      </label>

      {/* Field */}
      {resolvedChildren}

      {/* Help text — hidden when an error is visible to avoid clutter */}
      {hint && !hasError && (
        <p
          className="text-xs"
          style={{ color: "var(--form-help-color)" }}
        >
          {hint}
        </p>
      )}

      {/* Error message */}
      {hasError && (
        <p
          id={errorId}
          role="alert"
          className="text-xs"
          style={{ color: "var(--color-error-500)" }}
        >
          {error}
        </p>
      )}

    </div>
  );
}
