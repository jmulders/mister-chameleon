/**
 * Form Submissions Repository
 *
 * Encapsulates all database access for the `form_submissions` table.
 * A submission row is written by the /api/forms/[formKey] route handler
 * when FormDefinition.action.storeSubmissions is true.
 *
 * ─── Table schema ─────────────────────────────────────────────────────────────
 *
 *   form_submissions (
 *     id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
 *     created_at  timestamptz NOT NULL DEFAULT now(),
 *     form_key    text        NOT NULL,
 *     values      jsonb       NOT NULL,
 *     session_id  uuid        NULL REFERENCES sessions(id) ON DELETE SET NULL,
 *     tenant_id   text        NULL
 *   )
 *
 * ─── Error handling ───────────────────────────────────────────────────────────
 *
 *   Returns a `RepositoryResult<T>` — never throws.  Callers check `result.ok`
 *   and handle the error case without try/catch at every call site.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   import { saveFormSubmission } from "@/data/repositories/form-submissions-repository";
 *
 *   const result = await saveFormSubmission({
 *     formKey:   "contact",
 *     values:    { name: "Jane", email: "jane@example.com", message: "Hello" },
 *     sessionId: "…uuid…",        // optional — omit when session is unavailable
 *     tenantId:  "acme",          // optional — omit for un-scoped submissions
 *   });
 *
 *   if (!result.ok) {
 *     // log the error, but do NOT block the submission response
 *     logger.warn("[forms] storage failed", { error: result.error });
 *   }
 */

import { getDb } from "../db";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RepositoryResult } from "./sessions-repository";
import { encryptPayload, decryptPayload, emailHash } from "@/lib/forms-crypto";

// Regex for detecting an email-looking value when computing the lookup hash.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Find the submitted email in a values map so it can be hashed for lookup.
 * Prefers an email-named field; falls back to the first email-looking value.
 * Kept local (a few lines) to avoid coupling the data layer to the heavier
 * lead-capture module; mirrors extractSubmittedEmail's heuristic.
 */
function emailFromValues(values: Record<string, string>): string | null {
  for (const [k, v] of Object.entries(values)) {
    if (typeof v === "string" && /e-?mail/i.test(k) && EMAIL_RE.test(v.trim())) {
      return v.trim();
    }
  }
  for (const v of Object.values(values)) {
    if (typeof v === "string" && EMAIL_RE.test(v.trim())) return v.trim();
  }
  return null;
}

/**
 * Decode a raw DB row's stored payload into plaintext values.
 *
 * Prefers the encrypted `payload_enc` column (decrypt then JSON.parse). Falls
 * back to the legacy plaintext `payload` jsonb for rows written before the
 * backfill. On any decrypt/parse failure it logs and returns the legacy payload
 * (or {}) so a read NEVER surfaces raw ciphertext to a caller.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function decodeValues(db: any): Record<string, string> {
  const enc = db?.payload_enc;
  if (typeof enc === "string" && enc.length > 0) {
    try {
      const parsed = JSON.parse(decryptPayload(enc)) as unknown;
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, string>;
      }
    } catch (err) {
      logger.error("[form-submissions-repository] payload decrypt/parse failed", {
        id:    db?.id != null ? String(db.id) : "",
        error: String(err),
      });
    }
    // Never return the ciphertext itself; fall through to the legacy column.
  }
  return (db?.payload ?? {}) as Record<string, string>;
}

// ── Row type ──────────────────────────────────────────────────────────────────

/**
 * Stable, domain-facing shape of a submission row. This repository is the single
 * adapter between the domain naming used across the app (`values`, `created_at`)
 * and the ACTUAL database columns (`payload`, `submitted_at`) — the physical
 * table was built with different names than the early migration, and the app was
 * silently failing every insert because it wrote a non-existent `values` column.
 * All queries below read/write the real columns and map to/from this shape, so
 * callers never see the physical names.
 */
export interface FormSubmissionRow {
  /** Primary key (bigint identity in the DB) stringified for the domain layer. */
  id:         string;
  /** ISO-8601 timestamp set by the database on insert (DB column: submitted_at). */
  created_at: string;
  /** Registered form key, e.g. "contact" | "application" */
  form_key:   string;
  /** Validated, trimmed submission values keyed by field key (DB column: payload). */
  values:     Record<string, string>;
  /** FK → sessions.id — nullable; absent for submissions without a platform session. */
  session_id: string | null;
  /** Owning tenant slug, e.g. "workengine". Null for legacy un-scoped rows. */
  tenant_id:  string | null;
}

/**
 * Map a raw DB row (physical columns) to the domain FormSubmissionRow.
 * Centralises the payload→values / submitted_at→created_at / bigint→string
 * translation so every query returns a consistent shape.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(db: any): FormSubmissionRow {
  return {
    id:         db?.id != null ? String(db.id) : "",
    created_at: db?.submitted_at ?? "",
    form_key:   db?.form_key ?? "",
    values:     decodeValues(db),
    session_id: db?.session_id ?? null,
    tenant_id:  db?.tenant_id ?? null,
  };
}

// ── Input types ───────────────────────────────────────────────────────────────

/**
 * Data required to persist a validated form submission.
 */
export interface SaveFormSubmissionInput {
  /** Registered form key, e.g. "contact" | "application" */
  formKey:    string;
  /** Validated, trimmed field values keyed by field key. */
  values:     Record<string, string>;
  /**
   * Platform session ID from the visitor's `mc_session_id` cookie.
   * Omit (or pass null/undefined) when the session is not available.
   * The submission is always written; session_id is nullable.
   */
  sessionId?: string | null;
  /**
   * Tenant slug that owns this submission.
   * Omit (or pass null/undefined) for un-scoped / legacy submissions.
   */
  tenantId?:  string | null;
  /** Page the form was submitted from (DB column: pathname). Optional. */
  pathname?:  string | null;
}

/**
 * Filters for listing submissions for a tenant.
 */
export interface ListFormSubmissionsInput {
  /** Tenant slug — required for scoped queries. */
  tenantId:  string;
  /** When provided, filter to this specific form key. */
  formKey?:  string;
  /** Full-text search across the JSONB values column. */
  search?:   string;
  /** ISO-8601 date lower bound (inclusive). */
  from?:     string;
  /** ISO-8601 date upper bound (inclusive). */
  to?:       string;
  /** Page size — defaults to 50. */
  limit?:    number;
  /** Zero-based row offset — defaults to 0. */
  offset?:   number;
}

/**
 * Paginated result of a form submissions list query.
 */
export interface FormSubmissionsPage {
  rows:  FormSubmissionRow[];
  total: number;
}

// ── Repository ────────────────────────────────────────────────────────────────

/**
 * Inserts a form submission row into the `form_submissions` table.
 *
 * Always returns a `RepositoryResult` — never throws.  Storage failures are
 * safe to log and swallow so the site never shows an error to the submitter
 * because of a DB write failing after successful validation.
 *
 * @param input  Submission data: formKey, validated values, optional sessionId.
 * @returns      RepositoryResult<FormSubmissionRow> — { ok: true, data } on success.
 */
export async function saveFormSubmission(
  input: SaveFormSubmissionInput,
): Promise<RepositoryResult<FormSubmissionRow>> {
  // Encrypt the whole payload at rest. The plaintext `payload` column keeps an
  // empty object so its NOT NULL constraint holds while no personal data lives
  // there; the real data goes into payload_enc. email_hash enables lookup by
  // email without decrypting rows.
  const email = emailFromValues(input.values);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (getDb() as any)
    .from("form_submissions")
    .insert({
      form_key:    input.formKey,
      payload:     {},
      payload_enc: encryptPayload(JSON.stringify(input.values)),
      email_hash:  email ? emailHash(email) : null,
      session_id:  input.sessionId ?? null,
      tenant_id:   input.tenantId  ?? null,
      pathname:    input.pathname  ?? null,
    })
    .select()
    .single();

  if (error) {
    logger.error("[form-submissions-repository] saveFormSubmission failed", {
      error:   (error as { message: string }).message,
      code:    (error as { code?: string }).code,
      formKey: input.formKey,
    });
    return { ok: false, error: (error as { message: string }).message };
  }

  return { ok: true, data: mapRow(data) };
}

/**
 * List form submissions for a tenant with optional filters and pagination.
 */
export async function listFormSubmissions(
  client: SupabaseClient,
  input: ListFormSubmissionsInput,
): Promise<RepositoryResult<FormSubmissionsPage>> {
  const limit  = input.limit  ?? 50;
  const offset = input.offset ?? 0;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (client as any)
      .from("form_submissions")
      .select("*", { count: "exact" })
      .eq("tenant_id", input.tenantId)
      .order("submitted_at", { ascending: false });

    if (input.formKey) {
      query = query.eq("form_key", input.formKey);
    }

    if (input.from) {
      query = query.gte("submitted_at", input.from);
    }

    if (input.to) {
      // Add one day to make the `to` date inclusive at end-of-day.
      const toDate = new Date(input.to);
      toDate.setDate(toDate.getDate() + 1);
      query = query.lt("submitted_at", toDate.toISOString());
    }

    if (input.search) {
      // Payloads are encrypted at rest, so free-text substring search across the
      // content is no longer possible. Search is an exact email lookup via the
      // deterministic email_hash column instead. A non-email term simply matches
      // no rows.
      const term = input.search.trim();
      if (term) {
        query = query.eq("email_hash", emailHash(term));
      }
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logger.error("[form-submissions-repository] listFormSubmissions failed", {
        error:    (error as { message: string }).message,
        tenantId: input.tenantId,
      });
      return { ok: false, error: (error as { message: string }).message };
    }

    return {
      ok:   true,
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rows:  ((data ?? []) as any[]).map(mapRow),
        total: count ?? 0,
      },
    };
  } catch (err) {
    logger.error("[form-submissions-repository] listFormSubmissions unexpected error", {
      error: String(err),
    });
    return { ok: false, error: String(err) };
  }
}

/**
 * Fetch a single submission by ID, guarded by tenant ownership.
 */
export async function getFormSubmission(
  client: SupabaseClient,
  id:       string,
  tenantId: string,
): Promise<RepositoryResult<FormSubmissionRow>> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (client as any)
      .from("form_submissions")
      .select("*")
      .eq("id",        id)
      .eq("tenant_id", tenantId)
      .single();

    if (error) {
      return { ok: false, error: (error as { message: string }).message };
    }

    return { ok: true, data: mapRow(data) };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Delete a single submission, guarded by tenant ownership.
 */
export async function deleteFormSubmission(
  client:   SupabaseClient,
  id:       string,
  tenantId: string,
): Promise<RepositoryResult<{ deleted: boolean }>> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (client as any)
      .from("form_submissions")
      .delete()
      .eq("id",        id)
      .eq("tenant_id", tenantId);

    if (error) {
      return { ok: false, error: (error as { message: string }).message };
    }

    return { ok: true, data: { deleted: true } };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Delete all submissions older than `retentionDays` days for the given tenant.
 * Used by the GDPR purge cron.
 */
export async function purgeExpiredSubmissions(
  client:        SupabaseClient,
  tenantId:      string,
  retentionDays: number,
): Promise<RepositoryResult<{ deletedCount: number }>> {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (client as any)
      .from("form_submissions")
      .delete()
      .eq("tenant_id", tenantId)
      .lt("submitted_at", cutoff.toISOString())
      .select("id");

    if (error) {
      return { ok: false, error: (error as { message: string }).message };
    }

    return { ok: true, data: { deletedCount: Array.isArray(data) ? data.length : 0 } };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Iterate all tenants that have a `submissionRetentionDays` setting > 0,
 * and purge expired submissions for each.
 * Designed to be called by the /api/cron/form-submission-purge endpoint.
 */
export async function purgeAllExpiredSubmissions(
  client: SupabaseClient,
): Promise<RepositoryResult<{ totalDeleted: number }>> {
  try {
    // Load all tenant_form_settings rows that have a retentionDays value set.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows, error } = await (client as any)
      .from("tenant_form_settings")
      .select("tenant_id, settings");

    if (error) {
      return { ok: false, error: (error as { message: string }).message };
    }

    let totalDeleted = 0;

    for (const row of (rows ?? []) as Array<{ tenant_id: string; settings: Record<string, unknown> }>) {
      const retention = row.settings?.submissionRetentionDays;
      if (typeof retention !== "number" || retention <= 0) continue;

      const result = await purgeExpiredSubmissions(client, row.tenant_id, retention);
      if (result.ok) {
        totalDeleted += result.data.deletedCount;
      } else {
        logger.warn("[form-submissions-repository] purgeAllExpiredSubmissions: tenant purge failed", {
          tenantId: row.tenant_id,
          error:    result.error,
        });
      }
    }

    return { ok: true, data: { totalDeleted } };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
