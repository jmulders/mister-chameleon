/**
 * logServedVariants
 *
 * Bridges the experience layer and the data layer.
 * Called after the homepage experience is composed to record which
 * hero / proof / CTA variant was shown to a visitor session.
 *
 * ─── Responsibilities ────────────────────────────────────────────────────────
 *
 *   1. Extract the relevant fields from the HomepageExperience
 *   2. Delegate persistence to the variants repository
 *   3. Return the repository result so the caller can log failures
 *
 * ─── Why this file exists ────────────────────────────────────────────────────
 *
 *   The homepage Server Component should not need to know which repository
 *   function to call or how to map experience fields to DB column names.
 *   This helper is the single place where the experience shape (heroKey,
 *   proofKey, ctaKey, reason) is translated into a saveServedVariants call.
 *
 *   If the served_variants schema evolves — e.g. adding a `pathname` column
 *   or a `version` field — only this file needs to change, not the page.
 *
 * ─── Pre-condition: session row must already exist ────────────────────────────
 *
 *   `served_variants.session_id` is a NOT NULL FK → `sessions(id)`.
 *   The caller MUST call `upsertSession({ id: sessionId, ... })` and confirm
 *   `result.ok === true` before calling this function.  Calling this without
 *   a prior successful upsert will throw a FK violation at the DB level.
 *
 * ─── Usage (in the homepage Server Component) ─────────────────────────────────
 *
 *   import { upsertSession, sessionInputFromContext } from "@/data/repositories";
 *   import { logServedVariants } from "@/experience/log-served-variants";
 *
 *   const sessionUpsert = await upsertSession({
 *     id: sessionId,
 *     ...sessionInputFromContext(input, input.pathname ?? "/"),
 *   });
 *   if (sessionUpsert.ok) {
 *     await logServedVariants(sessionId, experience, tenantId);
 *   }
 *
 * ─── Error handling ──────────────────────────────────────────────────────────
 *
 *   Returns a RepositoryResult — never throws.
 *   Failures are logged by the repository; the caller may inspect result.ok
 *   and add additional context if needed.
 */

import { saveServedVariants } from "@/data/repositories";
import { logger } from "@/lib/logger";
import type { RepositoryResult } from "@/data/repositories";
import type { ServedVariantRow } from "@/data/types";
import type { HomepageExperience } from "./types";

/**
 * Persists the variant set served to a session.
 *
 * Extracts `heroKey`, `proofKey`, `ctaKey`, and `reason` from the resolved
 * `HomepageExperience.plan` and writes them to the `served_variants` table.
 *
 * @param sessionId   The UUID from the visitor's `mc_session_id` cookie.
 *                    MUST match an existing `sessions.id` row — call
 *                    `upsertSession` and verify `ok === true` before this.
 * @param experience  The fully composed homepage experience.
 * @returns           A `RepositoryResult` — ok:true on success, ok:false on error.
 */
export async function logServedVariants(
  sessionId: string,
  experience: HomepageExperience,
  tenantId: string,
): Promise<RepositoryResult<ServedVariantRow>> {
  const { heroKey, proofKey, ctaKey, reason } = experience.plan;

  const result = await saveServedVariants({
    sessionId,
    heroKey,
    proofKey,
    ctaKey,
    reason,
    tenantId,
  });

  if (!result.ok) {
    logger.error("[logServedVariants] Failed to persist served variants", {
      sessionId,
      tenantId,
      heroKey,
      proofKey,
      ctaKey,
      error: result.error,
    });
  }

  return result;
}
