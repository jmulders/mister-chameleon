/**
 * find-dependent-rules
 *
 * Utility that scans a tenant's stored rule conditions and returns the rules
 * that reference specific context-variable fields.
 *
 * Used by the admin UI to surface a dependency warning before deactivating an
 * interest profile or a behavioral scoring rule — so admins know which active
 * personalization rules will be silently affected.
 *
 * ─── Field matching ───────────────────────────────────────────────────────────
 *
 *   A `FieldMatcher` is a predicate `(fieldName, conditionValue) => boolean`.
 *   Two pre-built matchers are exported:
 *
 *     interestProfileMatcher(profileKey)
 *       Matches rules that reference:
 *         • interest<PascalKey>Score  (the per-profile numeric score field)
 *         • interestPrimary / interestSecondary  with value === profileKey
 *
 *     behavioralScoringMatcher()
 *       Matches rules that reference ANY journey.* field, because deactivating
 *       any scoring rule reduces the composite intentScore / funnelStage values
 *       that those fields expose.
 *
 * ─── Condition tree walk ──────────────────────────────────────────────────────
 *
 *   Conditions are JSON trees (FieldCondition | GroupCondition | NamedCondition
 *   | ContextCondition | ContextLibraryCondition).  We recursively walk groups
 *   and treat everything else as a leaf.  Only FieldCondition nodes carry a
 *   `field` property — the others are skipped.
 */

import { getDb }  from "@/data/db";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DependentRule {
  id:    string;
  label: string;
}

/**
 * Predicate called for each FieldCondition found in a rule's condition tree.
 *
 * @param fieldName  The `field` string from the FieldCondition.
 * @param value      The `value` from the FieldCondition (may be undefined).
 * @returns true if this field reference counts as a dependency.
 */
export type FieldMatcher = (fieldName: string, value: unknown) => boolean;

// ── Pre-built matchers ────────────────────────────────────────────────────────

/**
 * Converts an interest profile key to its per-profile score field name.
 * e.g. "pricing"          → "interestPricingScore"
 *      "use-case"         → "interestUseCaseScore"
 *      "commerce-product" → "interestCommerceProductScore"
 */
function profileKeyToScoreField(key: string): string {
  const pascal = key
    .replace(/[-_](.)/g, (_, c: string) => (c as string).toUpperCase())
    .replace(/^(.)/, (c) => (c as string).toUpperCase());
  return `interest${pascal}Score`;
}

/**
 * Matcher for interest profile dependencies.
 *
 * Fires when a rule condition references:
 *   - The numeric score field for this profile  (e.g. interestPricingScore)
 *   - interestPrimary with value equal to this profile key
 *   - interestSecondary with value equal to this profile key
 */
export function interestProfileMatcher(profileKey: string): FieldMatcher {
  const scoreField = profileKeyToScoreField(profileKey);
  return (fieldName: string, value: unknown): boolean => {
    // Per-profile score field — any condition on it depends on this profile.
    if (fieldName === scoreField) return true;
    // interestPrimary / interestSecondary — only if the value names this profile.
    if (fieldName === "interestPrimary" || fieldName === "interestSecondary") {
      if (value === profileKey) return true;
      if (Array.isArray(value) && (value as unknown[]).includes(profileKey)) return true;
    }
    return false;
  };
}

/**
 * Matcher for behavioral scoring dependencies.
 *
 * Fires when a rule condition references ANY journey.* field, because
 * deactivating any scoring rule can affect the composite scores those fields
 * expose (intentScore, funnelStage, etc.).
 */
export function behavioralScoringMatcher(): FieldMatcher {
  return (fieldName: string): boolean => fieldName.startsWith("journey.");
}

/**
 * Matcher for audience segment dependencies.
 *
 * Fires when a rule condition references the `audienceSegmentIds` field with
 * a value that includes the given segment key.  Covers:
 *   - Exact equality:  audienceSegmentIds equals "my-segment"
 *   - Substring:       audienceSegmentIds contains "my-segment"
 *   - Array set:       audienceSegmentIds in ["my-segment", "other"]
 *   - Existence:       audienceSegmentIds exists (matches any segment key)
 *
 * Used to warn admins before deactivating or deleting a segment that is
 * actively referenced by an enabled personalization rule.
 */
export function audienceSegmentMatcher(segmentKey: string): FieldMatcher {
  return (fieldName: string, value: unknown): boolean => {
    if (fieldName !== "audienceSegmentIds") return false;
    // exists / not_exists operators carry no value — any reference counts.
    if (value === undefined || value === null) return true;
    // Exact string match.
    if (value === segmentKey) return true;
    // Substring check (e.g. operator = "contains").
    if (typeof value === "string" && value.includes(segmentKey)) return true;
    // Array membership (e.g. operator = "in").
    if (Array.isArray(value) && (value as unknown[]).includes(segmentKey)) return true;
    return false;
  };
}

// ── Condition tree walker ─────────────────────────────────────────────────────

type Condition = Record<string, unknown>;

/**
 * Returns true if the condition tree contains at least one FieldCondition
 * that the provided matcher accepts.
 */
function conditionMatchesAny(condition: unknown, matcher: FieldMatcher): boolean {
  if (!condition || typeof condition !== "object") return false;
  const c = condition as Condition;

  if (c.type === "field") {
    return matcher(c.field as string, c.value);
  }

  if (c.type === "group") {
    const children = Array.isArray(c.conditions) ? (c.conditions as unknown[]) : [];
    return children.some((child) => conditionMatchesAny(child, matcher));
  }

  // NamedCondition, ContextCondition, ContextLibraryCondition — no field refs.
  return false;
}

// ── DB helpers ────────────────────────────────────────────────────────────────

type DbAny = { from: (t: string) => unknown };

type SingleResult<T> = { data: T | null; error: { message: string } | null };
function asSingle<T>(r: unknown): SingleResult<T> { return r as SingleResult<T>; }

function tenantRulesKey(tenantId: string): string {
  return `homepage_${tenantId}`;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Scan the tenant's stored rule config and return all enabled rules whose
 * condition tree references at least one field accepted by `matcher`.
 *
 * Returns an empty array when:
 *   - No rules config exists for the tenant yet.
 *   - The stored JSON is malformed.
 *   - A DB error occurs.
 *
 * Never throws.
 */
export async function findDependentRules(
  tenantId: string,
  matcher:  FieldMatcher,
): Promise<DependentRule[]> {
  if (!tenantId) return [];

  try {
    const db  = getDb() as unknown as DbAny;
    const key = tenantRulesKey(tenantId);

    const { data, error } = asSingle<{ config: Record<string, unknown> }>(
      await (db.from("rules_config") as {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<unknown>;
          };
        };
      })
        .select("config")
        .eq("key", key)
        .maybeSingle(),
    );

    if (error || !data) return [];

    const config = data.config as Record<string, unknown>;
    const rawRules = Array.isArray(config.rules) ? (config.rules as unknown[]) : [];

    const dependent: DependentRule[] = [];

    for (const raw of rawRules) {
      if (!raw || typeof raw !== "object") continue;
      const rule = raw as Record<string, unknown>;

      // Skip disabled rules — they won't fire anyway, so no actionable warning.
      if (rule.enabled === false) continue;

      const id    = typeof rule.id    === "string" ? rule.id    : "";
      const label = typeof rule.label === "string" ? rule.label : "(unlabelled rule)";

      if (id && conditionMatchesAny(rule.condition, matcher)) {
        dependent.push({ id, label });
      }
    }

    return dependent;
  } catch {
    return [];
  }
}
