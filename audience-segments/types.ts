/**
 * Audience Segment Types
 *
 * Named visitor segments that are evaluated at request time against the
 * fully-assembled DecisionContext.  Visitors matching all criteria are
 * tagged with the segment key via the `audienceSegmentIds` context variable,
 * which rules and AI decisions can condition on.
 *
 * ─── Architecture position ────────────────────────────────────────────────────
 *
 *   Admin creates segment (key + label + RuleCondition criteria)
 *        ↓  stored in audience_segments table
 *   Runtime: buildDecisionContext()
 *        ↓  evaluateAudienceSegments(ctx, tenantId)
 *   matched segment keys → audienceSegmentIds (comma-joined string)
 *        ↓  available in rules engine + AI context
 *   Rules condition on  audienceSegmentIds  contains "high-intent-enterprise"
 *
 * ─── Condition format ─────────────────────────────────────────────────────────
 *
 *   criteria is a RuleCondition tree — the same JSON format used by the
 *   decision rules engine:
 *
 *     FieldCondition   { type:"field",  field, operator, value }
 *     GroupCondition   { type:"group",  logic:"and"|"or", conditions:[] }
 *
 *   evaluateCondition() from decision/rules/stored-rule.ts evaluates the tree
 *   against a RuleEvaluationContext at runtime.
 */

// ── Domain types ──────────────────────────────────────────────────────────────

/**
 * A single audience segment row as used in application code.
 * camelCase field names — converted from the snake_case DB row.
 */
export interface AudienceSegment {
  id:          string;
  tenantId:    string;
  key:         string;
  label:       string;
  description: string | null;
  /** RuleCondition tree — evaluated at runtime. */
  criteria:    Record<string, unknown>;
  isActive:    boolean;
  createdAt:   string;
  updatedAt:   string;
}

/**
 * Input for creating a new audience segment.
 */
export interface AudienceSegmentInput {
  tenantId:    string;
  key:         string;
  label:       string;
  description?: string | null;
  criteria:    Record<string, unknown>;
  isActive?:   boolean;
}

/**
 * Partial update payload for an existing segment.
 * All fields are optional — only present keys are updated.
 */
export interface AudienceSegmentPatch {
  label?:       string;
  description?: string | null;
  criteria?:    Record<string, unknown>;
  isActive?:    boolean;
}

// ── DB row type ───────────────────────────────────────────────────────────────

/**
 * Raw DB row from the audience_segments table.
 * snake_case field names as returned by Supabase.
 */
export interface AudienceSegmentRow {
  id:          string;
  tenant_id:   string;
  key:         string;
  label:       string;
  description: string | null;
  criteria:    Record<string, unknown>;
  is_active:   boolean;
  created_at:  string;
  updated_at:  string;
}
