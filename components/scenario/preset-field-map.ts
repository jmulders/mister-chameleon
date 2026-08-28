/**
 * Mapping layer between the rules-editor field picker (FIELD_REGISTRY keys) and
 * the ScenarioOverrides shape a custom preset stores.
 *
 * The preset "overrides editor" reuses the shared FieldPicker + FieldValueInput
 * (driven by FIELD_REGISTRY metadata), but the registry key namespace ≠ the
 * ScenarioOverrides namespace. This curated allowlist bridges them:
 *   - Only fields that map to a settable ScenarioOverrides signal are offered.
 *   - funnelStage uses the JOURNEY variant (journey.funnelStage: awareness/
 *     consideration/intent/high_intent/customer) → override `funnelStage`.
 *   - Unknown registry keys (a future rename) are dropped at load — fail-open.
 *
 * The preset editor always uses the "equals" operator (set this field to a value),
 * so values are scalar (string / number / boolean); an array (e.g. multi-select)
 * is coerced to a comma-string, which is exactly what a segment override expects.
 */

import { FIELD_REGISTRY } from "@/decision/rules/field-registry";
import type { RuleFieldKey, FieldOperator } from "@/decision/rules/field-registry";
import type { FieldConditionValue } from "@/decision/rules/stored-rule";

export interface PresetFieldRow { field: RuleFieldKey; value: FieldConditionValue | undefined }

interface PresetFieldDef { field: RuleFieldKey; overrideKey: string }

// RuleFieldKey → keyof ScenarioOverrides. `field` strings are validated against
// FIELD_REGISTRY at load (fail-open) so a registry rename never throws.
const RAW: { field: string; overrideKey: string }[] = [
  // Funnel + scores
  { field: "journey.funnelStage",       overrideKey: "funnelStage" },
  { field: "journey.intentScore",       overrideKey: "intentScore" },
  { field: "journey.engagementScore",   overrideKey: "engagementScore" },
  { field: "journey.frictionScore",     overrideKey: "frictionScore" },
  { field: "journey.overallConfidence", overrideKey: "overallConfidence" },
  // Interest
  { field: "interestPrimary",           overrideKey: "interestPrimary" },
  { field: "interestSecondary",         overrideKey: "interestSecondary" },
  { field: "interestConfidence",        overrideKey: "interestConfidence" },
  // Segment
  { field: "audienceSegmentIds",        overrideKey: "audienceSegmentIds" },
  // Request
  { field: "source",                    overrideKey: "source" },
  { field: "device",                    overrideKey: "device" },
  { field: "visitType",                 overrideKey: "visitType" },
  // Company / geo
  { field: "companyName",               overrideKey: "companyName" },
  { field: "companyDomain",             overrideKey: "companyDomain" },
  { field: "companyIndustry",           overrideKey: "companyIndustry" },
  { field: "companySize",               overrideKey: "companySize" },
  { field: "countryCode",               overrideKey: "countryCode" },
  { field: "region",                    overrideKey: "region" },
  { field: "city",                      overrideKey: "city" },
  // Location (CBS buurt)
  { field: "locationAreaCode",          overrideKey: "locationAreaCode" },
  { field: "locationUrbanityClass",     overrideKey: "locationUrbanityClass" },
  { field: "locationIncomeBand",        overrideKey: "locationIncomeBand" },
  { field: "locationBusinessShare",     overrideKey: "locationBusinessShare" },
  // Time
  { field: "timeOfDay",                 overrideKey: "timeOfDay" },
  { field: "isWeekend",                 overrideKey: "isWeekend" },
  // Page flags
  { field: "journey.hasVisitedPricing", overrideKey: "hasVisitedPricing" },
  { field: "journey.hasVisitedAbout",   overrideKey: "hasVisitedAbout" },
  { field: "journey.hasVisitedCases",   overrideKey: "hasVisitedCases" },
  { field: "journey.hasVisitedContact", overrideKey: "hasVisitedContact" },
  { field: "hasClickedCta",             overrideKey: "hasClickedCta" },
  { field: "journey.hasStartedForm",    overrideKey: "hasStartedForm" },
  { field: "journey.hasSubmittedForm",  overrideKey: "hasSubmittedForm" },
];

/** The settable preset fields — only registry keys that actually exist. */
export const PRESET_FIELDS: readonly PresetFieldDef[] = RAW
  .filter((e) => e.field in FIELD_REGISTRY)
  .map((e) => ({ field: e.field as RuleFieldKey, overrideKey: e.overrideKey }));

/** Allowlist for the FieldPicker (only these fields are offered). */
export const PRESET_FIELD_KEYS: readonly RuleFieldKey[] = PRESET_FIELDS.map((f) => f.field);

/** The preset editor sets a value → always the "equals" operator. */
export const PRESET_OPERATOR: FieldOperator = "equals";

const OVERRIDE_KEY_BY_FIELD = new Map(PRESET_FIELDS.map((f) => [f.field, f.overrideKey]));
const FIELD_BY_OVERRIDE_KEY = new Map(PRESET_FIELDS.map((f) => [f.overrideKey, f.field]));

function coerce(value: FieldConditionValue | undefined): unknown {
  if (Array.isArray(value)) return value.join(","); // multi-select → comma-string
  return value;
}

/** Build a ScenarioOverrides bag from editor rows. Skips unmapped/empty rows. */
export function overridesFromRows(rows: readonly PresetFieldRow[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    const overrideKey = OVERRIDE_KEY_BY_FIELD.get(row.field);
    if (!overrideKey) continue;
    const v = coerce(row.value);
    if (v === undefined || v === "") continue;
    out[overrideKey] = v;
  }
  return out;
}

/** Inverse: editor rows from a stored overrides bag (for editing). Fail-open on
 *  unknown/unsupported override keys — they are simply not shown as editable rows. */
export function rowsFromOverrides(overrides: Record<string, unknown> | null | undefined): PresetFieldRow[] {
  if (!overrides) return [];
  const rows: PresetFieldRow[] = [];
  for (const [key, value] of Object.entries(overrides)) {
    const field = FIELD_BY_OVERRIDE_KEY.get(key);
    if (!field) continue;
    rows.push({ field, value: value as FieldConditionValue });
  }
  return rows;
}
