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
 *     session_id  uuid        NULL REFERENCES sessions(id) ON DELETE SET NULL
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
 *   });
 *
 *   if (!result.ok) {
 *     // log the error, but do NOT block the submission response
 *     logger.warn("[forms] storage failed", { error: result.error });
 *   }
 */

import { getDb } from "../db";
import type { FormSubmissionRow } from "../types";
import { logger } from "@/lib/logger";
import type { RepositoryResult } from "./sessions-repository";

// ── Input type ────────────────────────────────────────────────────────────────

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
  const { data, error } = await getDb()
    .from("form_submissions")
    .insert({
      form_key:   input.formKey,
      values:     input.values,
      session_id: input.sessionId ?? null,
    })
    .select()
    .single();

  if (error) {
    logger.error("[form-submissions-repository] saveFormSubmission failed", {
      error:   error.message,
      code:    error.code,
      formKey: input.formKey,
    });
    return { ok: false, error: error.message };
  }

  return { ok: true, data };
}
