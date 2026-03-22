/**
 * Experiments Dashboard — Server Actions
 *
 * All mutations to the experiments table go through these validated server
 * actions. The UI calls them from client components; the server is always the
 * authoritative validator regardless of any client-side guards.
 *
 * ─── Action inventory ─────────────────────────────────────────────────────────
 *
 *   listExperimentsAction()
 *     Thin pass-through to listAllExperiments(). Lets client components
 *     refresh experiment data without reaching into the repository directly.
 *
 *   createExperimentAction(input)
 *     Validates and inserts a new experiment row.
 *     - id: lowercase slug, 1–80 chars (alphanumeric, _, -)
 *     - name: non-empty, ≤ 100 chars
 *     - slot: "hero" | "proof" | "cta"
 *     - variants: ≥ 2 keys from the per-slot allow-list, no duplicates
 *     - traffic_fraction: 0 < f ≤ 1
 *     - status: optional, defaults to "active"
 *
 *   updateExperimentAction(id, input)
 *     Partially updates a single experiment. Only the keys present in the
 *     payload are touched — absent keys are left unchanged in the database.
 *     Mutable fields: name, status, traffic_fraction, variants.
 *     Immutable: id, slot, created_at.
 *     ended_at is stamped server-side on transition to "ended"; cleared on
 *     any transition away from "ended".
 *
 *   changeExperimentStatusAction(id, status)
 *     Focused action for lifecycle transitions only. Use this instead of
 *     updateExperimentAction when only the status is changing — makes call-site
 *     intent explicit and removes the risk of accidentally sending extra fields.
 *     Handles ended_at stamping identically to updateExperimentAction.
 *
 * ─── Variant key allow-lists ──────────────────────────────────────────────────
 *
 *   Variant keys are validated against ALLOWED_*_KEYS from the stored-rule
 *   vocabulary. This is the same vocabulary used by the rules editor and the
 *   decision engine, so all three layers share a single source of truth for
 *   which keys exist on the platform.
 */

"use server";

import {
  listAllExperiments,
  createExperiment,
  updateExperiment,
} from "@/data/repositories/experiments-repository";
import type { ExperimentRow, ExperimentInsert } from "@/data/types";
import {
  ALLOWED_HERO_KEYS,
  ALLOWED_PROOF_KEYS,
  ALLOWED_CTA_KEYS,
} from "@/decision/rules/stored-rule";

// ── Shared types ──────────────────────────────────────────────────────────────

type Slot   = "hero" | "proof" | "cta";
type Status = "active" | "paused" | "ended";

/** Result type shared by all mutation actions. */
export type ExperimentActionResult =
  | { ok: true;  experiment: ExperimentRow }
  | { ok: false; error: string; fieldErrors?: string[] };

// ── Constants ─────────────────────────────────────────────────────────────────

const VALID_SLOTS:    readonly Slot[]   = ["hero", "proof", "cta"];
const VALID_STATUSES: readonly Status[] = ["active", "paused", "ended"];

const MAX_ID_LENGTH   = 80;
const MAX_NAME_LENGTH = 100;
const ID_PATTERN      = /^[a-z0-9_-]{1,80}$/;

/** Per-slot allow-list — sourced from the rules vocabulary so all layers agree. */
const ALLOWED_VARIANTS_FOR_SLOT: Record<Slot, readonly string[]> = {
  hero:  ALLOWED_HERO_KEYS,
  proof: ALLOWED_PROOF_KEYS,
  cta:   ALLOWED_CTA_KEYS,
};

// ── Internal validation helpers ───────────────────────────────────────────────

function isValidSlot(v: unknown): v is Slot {
  return VALID_SLOTS.includes(v as Slot);
}

function isValidStatus(v: unknown): v is Status {
  return VALID_STATUSES.includes(v as Status);
}

/**
 * Validates a variants array against the per-slot allow-list.
 * Returns an array of error strings — empty array means valid.
 */
function validateVariants(variants: unknown, slot: Slot): string[] {
  const allowed = ALLOWED_VARIANTS_FOR_SLOT[slot];
  const errs: string[] = [];

  if (!Array.isArray(variants) || variants.length < 2) {
    errs.push("variants: at least 2 variant buckets are required");
    return errs;
  }

  const keys = variants as unknown[];

  const invalid = keys.filter((k) => !allowed.includes(k as string));
  if (invalid.length > 0) {
    errs.push(
      `variants: ${invalid.map((k) => `"${k}"`).join(", ")} ${
        invalid.length === 1 ? "is not a valid key" : "are not valid keys"
      } for slot "${slot}". Allowed: ${allowed.join(", ")}`,
    );
  }

  if (new Set(keys).size !== keys.length) {
    errs.push("variants: duplicate keys are not allowed");
  }

  return errs;
}

/**
 * Returns the correct ended_at value for a given status.
 * "ended" → stamps the current server time.
 * anything else → null (clears a previous ended_at).
 */
function resolveEndedAt(status: Status): string | null {
  return status === "ended" ? new Date().toISOString() : null;
}

// ── listExperimentsAction ─────────────────────────────────────────────────────

/**
 * Returns all experiments regardless of status.
 * Thin pass-through to the repository so client components never import
 * from the data layer directly.
 */
export async function listExperimentsAction(): Promise<
  { ok: true; data: ExperimentRow[] } | { ok: false; error: string }
> {
  return listAllExperiments();
}

// ── createExperimentAction ────────────────────────────────────────────────────

/**
 * Validates and inserts a new experiment row.
 *
 * The `id` slug is the primary key — it must be unique and is immutable after
 * creation. The repository returns a 409-style error when the slug already
 * exists.
 *
 * @param input - Unvalidated payload from the UI form.
 */
export async function createExperimentAction(
  input: unknown,
): Promise<ExperimentActionResult> {
  if (typeof input !== "object" || input === null) {
    return { ok: false, error: "Invalid input: expected an object." };
  }

  const raw    = input as Record<string, unknown>;
  const errors: string[] = [];

  // ── id ──────────────────────────────────────────────────────────────────────
  const rawId = typeof raw.id === "string" ? raw.id.trim() : "";
  if (rawId.length === 0) {
    errors.push("id: required");
  } else if (!ID_PATTERN.test(rawId)) {
    errors.push(
      `id: 1–${MAX_ID_LENGTH} chars; lowercase letters, digits, underscores and hyphens only`,
    );
  }

  // ── name ────────────────────────────────────────────────────────────────────
  const rawName = typeof raw.name === "string" ? raw.name.trim() : "";
  if (rawName.length === 0) {
    errors.push("name: required");
  } else if (rawName.length > MAX_NAME_LENGTH) {
    errors.push(`name: must be ≤ ${MAX_NAME_LENGTH} characters`);
  }

  // ── slot ────────────────────────────────────────────────────────────────────
  if (!isValidSlot(raw.slot)) {
    errors.push(`slot: must be one of ${VALID_SLOTS.join(", ")}`);
  }

  // ── traffic_fraction ────────────────────────────────────────────────────────
  const tf = Number(raw.traffic_fraction);
  if (isNaN(tf) || tf <= 0 || tf > 1) {
    errors.push("traffic_fraction: must be a number > 0 and ≤ 1");
  }

  // ── variants ────────────────────────────────────────────────────────────────
  if (isValidSlot(raw.slot)) {
    // Slot is valid — check against the correct per-slot allow-list.
    errors.push(...validateVariants(raw.variants, raw.slot as Slot));
  } else if (!Array.isArray(raw.variants) || raw.variants.length < 2) {
    // Slot is invalid so we can't look up the allow-list, but still require ≥ 2.
    errors.push("variants: at least 2 variant buckets are required");
  }

  // ── status (optional — defaults to "active") ─────────────────────────────────
  const rawStatus: unknown = "status" in raw ? raw.status : "active";
  if (!isValidStatus(rawStatus)) {
    errors.push(`status: must be one of ${VALID_STATUSES.join(", ")}`);
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: `Validation failed (${errors.length} issue${errors.length === 1 ? "" : "s"}).`,
      fieldErrors: errors,
    };
  }

  const status = rawStatus as Status;

  const insert: ExperimentInsert = {
    id:               rawId,
    name:             rawName,
    slot:             raw.slot as Slot,
    variants:         raw.variants as string[],
    traffic_fraction: tf,
    status,
    ended_at:         resolveEndedAt(status),
  };

  const result = await createExperiment(insert);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return { ok: true, experiment: result.data };
}

// ── updateExperimentAction ─────────────────────────────────────────────────────

/**
 * Partially updates a single experiment.
 *
 * Only the keys present in `input` are sent to Supabase — absent keys are
 * left unchanged in the database. Mutable fields: name, status,
 * traffic_fraction, variants. The id and slot are immutable after creation.
 *
 * When updating variants, `slot` must also be present in the payload so the
 * server can validate keys against the correct allow-list. The slot value is
 * NOT written to the database.
 *
 * When status transitions to "ended", ended_at is stamped server-side.
 * When status transitions away from "ended", ended_at is cleared to null.
 *
 * @param id    - The experiment slug (primary key).
 * @param input - Partial payload; only the present keys are applied.
 */
export async function updateExperimentAction(
  id: string,
  input: unknown,
): Promise<ExperimentActionResult> {
  if (!id || typeof id !== "string") {
    return { ok: false, error: "Experiment ID is required." };
  }
  if (typeof input !== "object" || input === null) {
    return { ok: false, error: "Invalid input: expected an object." };
  }

  const raw    = input as Record<string, unknown>;
  const errors: string[] = [];
  const patch: Record<string, unknown> = {};

  // ── name ────────────────────────────────────────────────────────────────────
  if ("name" in raw) {
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (name.length === 0) {
      errors.push("name: required");
    } else if (name.length > MAX_NAME_LENGTH) {
      errors.push(`name: must be ≤ ${MAX_NAME_LENGTH} characters`);
    } else {
      patch.name = name;
    }
  }

  // ── status ──────────────────────────────────────────────────────────────────
  if ("status" in raw) {
    if (!isValidStatus(raw.status)) {
      errors.push(`status: must be one of ${VALID_STATUSES.join(", ")}`);
    } else {
      const status    = raw.status as Status;
      patch.status    = status;
      patch.ended_at  = resolveEndedAt(status);
    }
  }

  // ── traffic_fraction ────────────────────────────────────────────────────────
  if ("traffic_fraction" in raw) {
    const tf = Number(raw.traffic_fraction);
    if (isNaN(tf) || tf <= 0 || tf > 1) {
      errors.push("traffic_fraction: must be a number > 0 and ≤ 1");
    } else {
      patch.traffic_fraction = tf;
    }
  }

  // ── variants ─────────────────────────────────────────────────────────────────
  // Slot must accompany variants so the server can run the allow-list check.
  // The slot value itself is NOT written to the database (immutable after creation).
  if ("variants" in raw) {
    if (!isValidSlot(raw.slot)) {
      errors.push(
        "slot: must be included alongside variants for server-side allow-list validation",
      );
    } else {
      const varErrors = validateVariants(raw.variants, raw.slot as Slot);
      if (varErrors.length > 0) {
        errors.push(...varErrors);
      } else {
        patch.variants = raw.variants;
      }
    }
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: `Validation failed (${errors.length} issue${errors.length === 1 ? "" : "s"}).`,
      fieldErrors: errors,
    };
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "No fields provided to update." };
  }

  const result = await updateExperiment(id, patch);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return { ok: true, experiment: result.data };
}

// ── changeExperimentStatusAction ──────────────────────────────────────────────

/**
 * Focused action for experiment lifecycle transitions.
 *
 * Use this in preference to updateExperimentAction when only the status is
 * changing — the explicit signature removes the risk of accidentally sending
 * unintended fields and makes the call-site intent obvious.
 *
 * Supported transitions:
 *   active → paused    Pause traffic split; no analytics side-effects.
 *   paused → active    Resume the experiment.
 *   *      → ended     Marks the experiment finished; stamps ended_at server-side.
 *   ended  → active    Re-activates the experiment; clears ended_at.
 *   ended  → paused    Pauses without re-activating; clears ended_at.
 *
 * @param id     - The experiment slug (primary key).
 * @param status - Target lifecycle status.
 */
export async function changeExperimentStatusAction(
  id: string,
  status: unknown,
): Promise<ExperimentActionResult> {
  if (!id || typeof id !== "string") {
    return { ok: false, error: "Experiment ID is required." };
  }

  if (!isValidStatus(status)) {
    return {
      ok: false,
      error: `Invalid status "${String(status)}": must be one of ${VALID_STATUSES.join(", ")}.`,
      fieldErrors: [`status: must be one of ${VALID_STATUSES.join(", ")}`],
    };
  }

  const patch = {
    status:   status as Status,
    ended_at: resolveEndedAt(status as Status),
  };

  const result = await updateExperiment(id, patch);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return { ok: true, experiment: result.data };
}
