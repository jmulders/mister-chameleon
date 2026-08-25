/**
 * Plain, serialisable field metadata for the compact webhook-rule condition
 * editor. Derived from the engine's FIELD_REGISTRY so the editor offers exactly
 * the same fields/operators the engine evaluates — but as plain data, so the
 * registry's resolver closures never reach the client bundle.
 */

import { FIELD_REGISTRY, type FieldOperator } from "@/decision/rules/field-registry";

export interface ConditionFieldOption {
  key:            string;
  label:          string;
  group:          string;
  kind:           string;
  operators:      FieldOperator[];
  allowedValues?: string[];
}

/** All rule fields, grouped and sorted for the field dropdown. */
export function getConditionFieldOptions(): ConditionFieldOption[] {
  return Object.entries(FIELD_REGISTRY)
    .map(([key, def]) => ({
      key,
      label:     def.label,
      group:     def.group,
      kind:      def.kind,
      operators: [...def.operators],
      ...(def.allowedValues ? { allowedValues: [...def.allowedValues] } : {}),
    }))
    .sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));
}

/** Operators that take no value. */
export const NO_VALUE_OPERATORS: FieldOperator[] = ["exists", "not_exists"];
/** Operators that take a comma-separated list of values. */
export const ARRAY_VALUE_OPERATORS: FieldOperator[] = ["in", "not_in"];
