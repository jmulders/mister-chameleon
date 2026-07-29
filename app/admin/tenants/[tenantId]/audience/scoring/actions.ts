"use server";

import { rethrowNextInternal } from "@/lib/server-action-guard";

/**
 * Behavior Admin — Server Actions
 *
 * CRUD operations for:
 *   - behavior_scoring_rules
 *   - behavior_sequence_patterns
 *   - decay_profiles
 *
 * All write operations are tenant-scoped.
 */

import { getDb }                from "@/data/db";
import { revalidatePath }       from "next/cache";
import {
  getRequiredAdminSession,
  assertTenantAccess,
} from "@/lib/admin-auth/authorization";
import type {
  ScoringRule,
  SequencePattern,
  DecayProfile,
} from "@/lib/journey/types";
import { SEED_SCORING_RULES } from "@/behavior-scoring/seed";
import {
  findDependentRules,
  behavioralScoringMatcher,
  type DependentRule,
} from "@/decision/rules/find-dependent-rules";

// ── Inline sequence seed data ─────────────────────────────────────────────────
//
// Slugs must exactly match runtime-rules.json journey.matchedSequences values.
//
const SEED_SEQUENCE_PATTERNS = [
  {
    slug:          "homepage_to_product",
    label:         "Homepage → Pricing",
    sequence: [
      { event_type: "page_view", event_value: "/" },
      { event_type: "page_view", event_value: "/pricing" },
    ],
    maxGapMinutes: 60,
    score:         15,
  },
  {
    slug:          "pricing_to_demo",
    label:         "Pricing → Book Demo",
    sequence: [
      { event_type: "page_view", event_value: "/pricing" },
      { event_type: "page_view", event_value: "/book-demo" },
    ],
    maxGapMinutes: 60,
    score:         30,
  },
  {
    slug:          "case_to_pricing",
    label:         "Case Study → Pricing",
    sequence: [
      { event_type: "page_view", page_category: "social_proof" },
      { event_type: "page_view", event_value: "/pricing" },
    ],
    maxGapMinutes: 120,
    score:         20,
  },
];

// ── Type helpers ──────────────────────────────────────────────────────────────
//
// The new journey tables don't yet have generated Supabase type definitions,
// so we cast through `unknown` at every call site — the same approach used
// throughout fetch-visitor-history.ts and the fetch-journey-state module.

type DbRows<T>  = { data: T[] | null; error: { message: string } | null };
type DbRow<T>   = { data: T  | null; error: { message: string } | null };
type DbVoid     = { error?: { message: string } | null };

function asRows<T>(r: unknown): DbRows<T> { return r as DbRows<T>; }
function asRow<T>(r: unknown): DbRow<T>   { return r as DbRow<T>; }
function asVoid(r: unknown): DbVoid       { return r as DbVoid; }

/**
 * The new journey tables (decay_profiles, behavior_scoring_rules,
 * behavior_sequence_patterns) were added via migration 20240101000028 and
 * do not yet have generated Supabase TypeScript bindings.  We cast to `any`
 * at the call site so the strongly-typed db client accepts the table names.
 * This matches the pattern used in data/repositories/*.ts for tables that
 * pre-date the generated type pipeline.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbAny() { return getDb() as any; }

// ── Decay profiles ────────────────────────────────────────────────────────────

export async function getDecayProfilesAction(): Promise<DecayProfile[]> {
  const db = dbAny();
  const res = asRows<DecayProfile>(
    await db.from("decay_profiles").select("*").order("slug"),
  );
  return res.data ?? [];
}

export async function saveDecayProfileAction(
  data: Omit<DecayProfile, "id" | "created_at"> & { id?: string },
): Promise<{ ok: boolean; error?: string }> {
  const db = dbAny();

  if (data.id) {
    const res = asVoid(
      await db
        .from("decay_profiles")
        .update({ label: (data as { label?: string }).label, day_1: data.day_1, day_7: data.day_7, day_30: data.day_30, day_90: data.day_90 })
        .eq("slug", data.slug),
    );
    if (res.error) return { ok: false, error: res.error.message };
  } else {
    const res = asVoid(
      await db.from("decay_profiles").insert(data),
    );
    if (res.error) return { ok: false, error: res.error.message };
  }
  return { ok: true };
}

// ── Scoring rules ─────────────────────────────────────────────────────────────

export async function getScoringRulesAction(
  tenantId: string,
): Promise<ScoringRule[]> {
  const db = dbAny();
  const res = asRows<ScoringRule>(
    await db
      .from("behavior_scoring_rules")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("priority")
      .order("label"),
  );
  return res.data ?? [];
}

export interface ScoringRuleInput {
  id?:            string;
  tenantId:       string;
  key?:           string | null;
  label:          string;
  description?:   string | null;
  eventType:      string;
  eventValue?:    string | null;
  pageCategory?:  string | null;
  score:          number;
  decayProfile:   string;
  isActive?:      boolean;
  priority?:      number;
}

export async function saveScoringRuleAction(
  sessionTenantId: string,
  data: ScoringRuleInput,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, sessionTenantId);

  const db = dbAny();

  const row = {
    tenant_id:     data.tenantId,
    key:           data.key           ?? null,
    label:         data.label,
    description:   data.description   ?? null,
    event_type:    data.eventType,
    event_value:   data.eventValue    ?? null,
    page_category: data.pageCategory  ?? null,
    score:         data.score,
    decay_profile: data.decayProfile,
    is_active:     data.isActive      ?? true,
    priority:      data.priority      ?? 100,
  };

  if (data.id) {
    const res = asVoid(
      await db.from("behavior_scoring_rules").update(row).eq("id", data.id).eq("tenant_id", data.tenantId),
    );
    if (res.error) return { ok: false, error: res.error.message };
  } else {
    const res = asVoid(
      await db.from("behavior_scoring_rules").insert(row),
    );
    if (res.error) return { ok: false, error: res.error.message };
  }

  revalidatePath(`/admin/tenants/${data.tenantId}/behavior`);
  return { ok: true };
}

export async function deleteScoringRuleAction(
  sessionTenantId: string,
  ruleId: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, sessionTenantId);

  const db = dbAny();
  const res = asVoid(
    await db
      .from("behavior_scoring_rules")
      .delete()
      .eq("id", ruleId)
      .eq("tenant_id", sessionTenantId),
  );
  if (res.error) return { ok: false, error: res.error.message };

  revalidatePath(`/admin/tenants/${sessionTenantId}/behavior`);
  return { ok: true };
}

// ── Sequence patterns ─────────────────────────────────────────────────────────

export async function getSequencePatternsAction(
  tenantId: string,
): Promise<SequencePattern[]> {
  const db = dbAny();
  const res = asRows<SequencePattern>(
    await db
      .from("behavior_sequence_patterns")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("label"),
  );
  return res.data ?? [];
}

export interface SequencePatternInput {
  id?:             string;
  tenantId:        string;
  slug:            string;
  label:           string;
  sequence:        Array<{ event_type: string; event_value?: string }>;
  maxGapMinutes:   number;
  score:           number;
}

export async function saveSequencePatternAction(
  sessionTenantId: string,
  data: SequencePatternInput,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, sessionTenantId);

  const db = dbAny();
  const row = {
    tenant_id:       data.tenantId,
    slug:            data.slug,
    label:           data.label,
    sequence:        data.sequence,
    max_gap_minutes: data.maxGapMinutes,
    score:           data.score,
  };

  if (data.id) {
    const res = asVoid(
      await db.from("behavior_sequence_patterns").update(row).eq("id", data.id).eq("tenant_id", data.tenantId),
    );
    if (res.error) return { ok: false, error: res.error.message };
  } else {
    const res = asVoid(
      await db.from("behavior_sequence_patterns").insert(row),
    );
    if (res.error) return { ok: false, error: res.error.message };
  }

  revalidatePath(`/admin/tenants/${data.tenantId}/behavior`);
  return { ok: true };
}

export async function deleteSequencePatternAction(
  sessionTenantId: string,
  patternId: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, sessionTenantId);

  const db = dbAny();
  const res = asVoid(
    await db
      .from("behavior_sequence_patterns")
      .delete()
      .eq("id", patternId)
      .eq("tenant_id", sessionTenantId),
  );
  if (res.error) return { ok: false, error: res.error.message };

  revalidatePath(`/admin/tenants/${sessionTenantId}/behavior`);
  return { ok: true };
}

/**
 * Deactivates a scoring rule by setting is_active = false.
 * Used by the plan enforcement layer — does not check plan limits (deactivation is always allowed).
 */
export async function deactivateScoringRuleAction(
  sessionTenantId: string,
  ruleId: string,
): Promise<{ ok: boolean; error?: string }> {
  const db = dbAny();
  const res = asVoid(
    await db
      .from("behavior_scoring_rules")
      .update({ is_active: false })
      .eq("id", ruleId)
      .eq("tenant_id", sessionTenantId),
  );
  if (res.error) return { ok: false, error: res.error.message };
  revalidatePath(`/admin/tenants/${sessionTenantId}/behavior`);
  return { ok: true };
}

// ── Seed scoring rules ────────────────────────────────────────────────────────

/**
 * Seed the tenant's scoring rules from SEED_SCORING_RULES.
 *
 * Idempotent: any rule whose key already exists for this tenant is skipped,
 * so re-running the seed never overwrites tenant customisations.
 *
 * @returns  { ok: true, created, skipped } on success.
 */
export async function seedScoringRulesAction(
  tenantId: string,
): Promise<{ ok: true; created: number; skipped: number } | { ok: false; error: string }> {
  if (!tenantId) return { ok: false, error: "Tenant ID is required." };

  const db = dbAny();

  // Fetch existing keys to determine what's already there.
  const { data: existing } = await db
    .from("behavior_scoring_rules")
    .select("key")
    .eq("tenant_id", tenantId)
    .not("key", "is", null);

  const existingKeys = new Set<string>(
    (existing ?? []).map((r: { key: string }) => r.key).filter(Boolean),
  );

  const toCreate = SEED_SCORING_RULES.filter((r) => !existingKeys.has(r.key));
  const skipped  = SEED_SCORING_RULES.length - toCreate.length;

  if (toCreate.length === 0) {
    return { ok: true, created: 0, skipped };
  }

  let created = 0;
  for (const seed of toCreate) {
    const res = asVoid(
      await db.from("behavior_scoring_rules").insert({
        tenant_id:     tenantId,
        key:           seed.key,
        label:         seed.label,
        description:   seed.description ?? null,
        event_type:    seed.eventType,
        event_value:   seed.eventValue ?? null,
        page_category: seed.pageCategory ?? null,
        score:         seed.score,
        decay_profile: seed.decayProfile,
        is_active:     seed.isActive,
        priority:      seed.priority,
      }),
    );
    if (!res.error) created++;
  }

  revalidatePath(`/admin/tenants/${tenantId}/audience/scoring`);
  return { ok: true, created, skipped };
}

// ── Seed sequence patterns ────────────────────────────────────────────────────

/**
 * Seed the tenant's sequence patterns from SEED_SEQUENCE_PATTERNS.
 *
 * Idempotent: any pattern whose slug already exists for this tenant is skipped,
 * so re-running the seed never overwrites tenant customisations.
 *
 * @returns  { ok: true, created, skipped } on success.
 */
export async function seedSequencePatternsAction(
  tenantId: string,
): Promise<{ ok: true; created: number; skipped: number } | { ok: false; error: string }> {
  if (!tenantId) return { ok: false, error: "Tenant ID is required." };

  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, tenantId);

  const db = dbAny();

  // Fetch existing slugs to determine what's already there.
  const { data: existing } = await db
    .from("behavior_sequence_patterns")
    .select("slug")
    .eq("tenant_id", tenantId);

  const existingSlugs = new Set<string>(
    (existing ?? []).map((r: { slug: string }) => r.slug).filter(Boolean),
  );

  const toCreate = SEED_SEQUENCE_PATTERNS.filter((p) => !existingSlugs.has(p.slug));
  const skipped  = SEED_SEQUENCE_PATTERNS.length - toCreate.length;

  if (toCreate.length === 0) {
    return { ok: true, created: 0, skipped };
  }

  let created = 0;
  for (const seed of toCreate) {
    const res = asVoid(
      await db.from("behavior_sequence_patterns").insert({
        tenant_id:       tenantId,
        slug:            seed.slug,
        key:             seed.slug,   // mirrors slug (NOT NULL, migration 034)
        name:            seed.label,  // mirrors label (NOT NULL, migration 034)
        label:           seed.label,
        sequence:        seed.sequence,
        max_gap_minutes: seed.maxGapMinutes,
        score:           seed.score,
      }),
    );
    if (res.error) {
      console.error("[seedSequencePatternsAction] insert failed:", res.error.message, seed.slug);
    } else {
      created++;
    }
  }

  revalidatePath(`/admin/tenants/${tenantId}/audience/scoring`);
  return { ok: true, created, skipped };
}

// ── checkScoringRuleDependenciesAction ────────────────────────────────────────

/**
 * Returns the enabled personalization rules that reference any journey.*
 * field condition — meaning deactivating this scoring rule could reduce the
 * intentScore / funnelStage values those rules condition on.
 *
 * Used by the admin UI to show a confirmation dialog before deactivating a
 * scoring rule so admins know which rules may be silently affected.
 */
export async function checkScoringRuleDependenciesAction(
  tenantId: string,
): Promise<{ ok: true; dependentRules: DependentRule[] } | { ok: false; error: string }> {
  if (!tenantId) return { ok: false, error: "Tenant ID is required." };

  try {
    const dependentRules = await findDependentRules(tenantId, behavioralScoringMatcher());
    return { ok: true, dependentRules };
  } catch (err) {
    rethrowNextInternal(err);
    return { ok: false, error: err instanceof Error ? err.message : "Dependency check failed." };
  }
}
