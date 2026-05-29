/**
 * FormGroup
 *
 * A semantic <fieldset>/<legend> wrapper for logically grouped form fields.
 * Builds on the Stack atom for consistent field spacing and uses design
 * tokens for the optional legend label.
 *
 * Use FormGroup when a form contains distinct sections (e.g. "Personal details"
 * and "Work details") that benefit from a visible or accessible group label.
 * For simple single-section forms, using Stack directly is fine.
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   legend      string          Optional <legend> text shown above the fields.
 *   gap         number          Stack gap between fields (default 5).
 *   children    React.ReactNode Form field atoms / FieldRenderer elements.
 *   className   string          Optional additional class names.
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --form-label-color    Legend text colour
 *   --form-label-weight   Legend font weight
 */

import { Stack } from "@/components/primitives/Stack";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface FormGroupProps {
  legend?:    string;
  gap?:       0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16;
  children:   React.ReactNode;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FormGroup({ legend, gap = 5, children, className }: FormGroupProps) {
  // Use a <fieldset> only when a legend is present — a fieldset without a
  // legend adds unnecessary ARIA overhead.
  if (legend) {
    return (
      <fieldset
        style={{ border: "none", margin: 0, padding: 0 }}
        className={className}
      >
        <legend
          className="mb-4"
          style={{
            float:      "left",        // Float trick: lets Stack flow below legend
            width:      "100%",
            fontSize:   "0.9375rem",
            fontWeight: "var(--form-label-weight, 600)",
            color:      "var(--form-label-color, var(--text))",
            paddingBottom: "0.25rem",
            borderBottom: "1px solid var(--card-border)",
          }}
        >
          {legend}
        </legend>
        {/* Clearfix for the floated legend */}
        <div style={{ clear: "both" }} />
        <Stack gap={gap}>
          {children}
        </Stack>
      </fieldset>
    );
  }

  return (
    <Stack gap={gap} className={className}>
      {children}
    </Stack>
  );
}
