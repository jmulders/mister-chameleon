/**
 * AI Field Fill — Barrel Export
 *
 * Re-exports the public surface of the field fill module.
 * Import from here rather than from individual files.
 */

export type {
  FieldFillSpec,
  SlotFieldFillConfig,
  TenantFieldFillSettings,
  FieldFillInput,
  FieldFillOutput,
  FieldFillTrace,
  FieldFillResult,
} from "./types";

export { buildFieldFillPrompt }           from "./field-fill-prompt";
export type { FieldFillPrompt }           from "./field-fill-prompt";

export { validateFieldFillOutput }        from "./field-fill-validator";
export type { ValidationResult }          from "./field-fill-validator";

export { runFieldFill }                   from "./apply-field-fill";
export type { FieldFillAdapter }          from "./apply-field-fill";
