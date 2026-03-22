/**
 * Form submission storage
 *
 * Thin wrapper over the form-submissions Supabase repository.
 * Imported by the /api/forms/[formKey] route handler to persist validated
 * submissions when FormDefinition.action.storeSubmissions is true.
 *
 * ─── Architecture position ───────────────────────────────────────────────────
 *
 *   This module is the boundary between the forms/* domain and the data/*
 *   infrastructure layer.  It keeps the repository import out of the forms
 *   types/validation/email modules so those remain dependency-free and
 *   testable without a DB connection.
 *
 * ─── Failure safety ──────────────────────────────────────────────────────────
 *
 *   storeSubmission() NEVER throws and NEVER rejects.  Storage errors are
 *   logged and returned as { ok: false, error } so the API route can log them
 *   without blocking the success response to the submitter.
 *
 * ─── Module structure ────────────────────────────────────────────────────────
 *
 *   StoreSubmissionInput     — input shape for the storage call
 *   StoreSubmissionResult    — typed result (ok | error)
 *   storeSubmission(input)   — persist one validated submission
 */

import "server-only";
import { saveFormSubmission }   from "@/data/repositories/form-submissions-repository";
import { logger }               from "@/lib/logger";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Input shape for storeSubmission().
 * Intentionally mirrors SaveFormSubmissionInput so the route handler
 * can pass its already-typed values directly without re-mapping.
 */
export interface StoreSubmissionInput {
  /** Registered form key, e.g. "contact" | "application" */
  formKey:    string;
  /** Validated, trimmed field values from validateSubmission().values */
  values:     Record<string, string>;
  /**
   * Platform session ID from the visitor's mc_session_id cookie.
   * Omit when unavailable — submission is written with session_id = null.
   */
  sessionId?: string | null;
}

/**
 * Typed result of a storage attempt.
 * Mirrors the RepositoryResult pattern used across the data layer.
 */
export type StoreSubmissionResult =
  | { ok: true;  id: string }
  | { ok: false; error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Persists a validated form submission to the `form_submissions` table.
 *
 * Safe to call fire-and-forget from the API route — never throws, never rejects.
 * Returns { ok: true, id } on success or { ok: false, error } on failure.
 * Callers should log errors but must not block the HTTP response on them.
 *
 * @example — fire-and-forget (don't await if the route shouldn't block):
 * void storeSubmission({ formKey, values, sessionId }).then((result) => {
 *   if (!result.ok) logger.warn("[forms] storage failed", result);
 * });
 *
 * @example — awaited (when you need the submission ID for logging):
 * const stored = await storeSubmission({ formKey, values, sessionId });
 * if (stored.ok) logger.info("[forms] stored", { id: stored.id });
 */
export async function storeSubmission(
  input: StoreSubmissionInput,
): Promise<StoreSubmissionResult> {
  try {
    const result = await saveFormSubmission({
      formKey:   input.formKey,
      values:    input.values,
      sessionId: input.sessionId ?? null,
    });

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    return { ok: true, id: result.data.id };

  } catch (err) {
    // Belt-and-suspenders: repository should never throw, but wrap in case.
    const message = err instanceof Error ? err.message : "Unknown storage error";
    logger.error("[forms/storage] Unexpected error in storeSubmission", { error: message });
    return { ok: false, error: message };
  }
}
