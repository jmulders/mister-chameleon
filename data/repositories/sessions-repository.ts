/**
 * Sessions Repository
 *
 * Encapsulates all database access for the `sessions` table.
 * A session represents a single visitor request to the homepage —
 * one row is written on first load and can be retrieved for analytics
 * or to re-hydrate context in subsequent route handlers.
 *
 * ─── Table schema ─────────────────────────────────────────────────────────────
 *
 *   sessions (
 *     id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
 *     created_at   timestamptz NOT NULL    DEFAULT now(),
 *     source       text        NOT NULL,   -- linkedin | google | direct | unknown
 *     device       text        NOT NULL,   -- mobile | desktop
 *     visit_type   text        NOT NULL,   -- new | returning
 *     pathname     text        NOT NULL,
 *     referrer     text,
 *     utm_source   text,
 *     utm_medium   text,
 *     utm_campaign text
 *   )
 *
 * ─── Error handling ───────────────────────────────────────────────────────────
 *
 *   Both functions return typed result objects rather than throwing so that
 *   callers can handle database failures gracefully without try/catch at
 *   every call site.
 *
 *   Pattern:
 *     const result = await createSession(input);
 *     if (!result.ok) { logger.error(...); return; }
 *     const session = result.data;
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   import { createSession, getSessionById } from "@/data/repositories/sessions-repository";
 *   import type { CreateSessionInput } from "@/data/repositories/sessions-repository";
 */

import { getDb } from "../db";
import type { SessionRow } from "../types";
import { logger } from "@/lib/logger";
import type { VisitorContext } from "@/context/types";

// ── Input / output types ───────────────────────────────────────────────────────

/**
 * Data required to create a new session row.
 *
 * Maps directly from a `VisitorContext` snapshot — use `sessionInputFromContext()`
 * to build this from the resolved context at the top of a route/page handler.
 */
export interface CreateSessionInput {
  source: string;
  device: string;
  visitType: string;
  pathname: string;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
}

/**
 * Data required to upsert a session row with a caller-supplied UUID.
 *
 * Used when the session ID originates from the `mc_session_id` cookie
 * (set by middleware) so the cookie UUID and the DB primary key are the same.
 * The upsert silently skips the insert if the row already exists, ensuring
 * exactly one DB row per unique cookie session regardless of how many times
 * the page is rendered.
 */
export interface UpsertSessionInput extends CreateSessionInput {
  /** The UUID from the mc_session_id cookie. Used as the row primary key. */
  id: string;
}

/** A successful repository result. */
export type RepositoryOk<T> = { ok: true; data: T };
/** A failed repository result — never throws; callers decide how to respond. */
export type RepositoryErr = { ok: false; error: string };
/** Discriminated union returned by all repository functions. */
export type RepositoryResult<T> = RepositoryOk<T> | RepositoryErr;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Builds a `CreateSessionInput` from a fully-resolved `VisitorContext`.
 *
 * @param context   The context produced by `detectVisitorContext()`.
 * @param pathname  The pathname of the page being served, e.g. "/".
 */
export function sessionInputFromContext(
  context: VisitorContext,
  pathname: string,
): CreateSessionInput {
  return {
    source: context.source,
    device: context.device,
    visitType: context.visitType,
    pathname,
    referrer: context.rawReferrer,
    utmSource: context.utmSource,
    utmMedium: context.utmMedium,
    utmCampaign: context.utmCampaign,
  };
}

// ── Repository functions ───────────────────────────────────────────────────────

/**
 * Inserts a new session row and returns the created record.
 *
 * The database generates `id` (uuid) and `created_at` (now()) automatically.
 *
 * @param input  Session data, typically built via `sessionInputFromContext()`.
 * @returns      A `RepositoryResult` containing the full `SessionRow` on success.
 */
export async function createSession(
  input: CreateSessionInput,
): Promise<RepositoryResult<SessionRow>> {
  const { data, error } = await getDb()
    .from("sessions")
    .insert({
      source: input.source,
      device: input.device,
      visit_type: input.visitType,
      pathname: input.pathname,
      referrer: input.referrer ?? null,
      utm_source: input.utmSource ?? null,
      utm_medium: input.utmMedium ?? null,
      utm_campaign: input.utmCampaign ?? null,
    })
    .select()
    .single();

  if (error) {
    logger.error("[sessions-repository] createSession failed", {
      error: error.message,
      code: error.code,
    });
    return { ok: false, error: error.message };
  }

  return { ok: true, data };
}

/**
 * Inserts a session row using a caller-supplied UUID, or does nothing if a row
 * with that UUID already exists.
 *
 * The "one DB row per cookie session" rule is enforced here:
 *   - First visit  → no existing row → inserts the new session row
 *   - Reload / return within the same cookie session → row already exists → no-op
 *
 * ─── Why two steps? ───────────────────────────────────────────────────────────
 *
 *   `onConflict: "id", ignoreDuplicates: true` maps to `ON CONFLICT (id) DO NOTHING`.
 *   When the row already exists PostgREST returns an **empty** result set — zero rows.
 *   Chaining `.select().single()` on zero rows raises PGRST116 ("JSON object
 *   requested, multiple (or no) rows returned").
 *
 *   The safe pattern is therefore:
 *     1. Upsert without `.select()` — just confirm no DB-level error.
 *     2. Fetch the (now-guaranteed) row by PK using `.maybeSingle()`.
 *
 *   This adds one extra indexed PK lookup per call but eliminates PGRST116 on
 *   every subsequent page-load within the same cookie session.
 *
 * @param input  Session data including `id` from the mc_session_id cookie.
 * @returns      A `RepositoryResult` containing the `SessionRow`.
 */
export async function upsertSession(
  input: UpsertSessionInput,
): Promise<RepositoryResult<SessionRow>> {
  // ── Step 1: idempotent insert ─────────────────────────────────────────────
  // Do NOT call .select() or .single() here.
  // ignoreDuplicates (ON CONFLICT DO NOTHING) returns 0 rows when the row
  // already exists; .single() on 0 rows always throws PGRST116.
  const { error: insertError } = await getDb()
    .from("sessions")
    .upsert(
      {
        id: input.id,
        source: input.source,
        device: input.device,
        visit_type: input.visitType,
        pathname: input.pathname,
        referrer: input.referrer ?? null,
        utm_source: input.utmSource ?? null,
        utm_medium: input.utmMedium ?? null,
        utm_campaign: input.utmCampaign ?? null,
      },
      {
        onConflict: "id",
        ignoreDuplicates: true,
      },
    );

  if (insertError) {
    logger.error("[sessions-repository] upsertSession insert failed", {
      error: insertError.message,
      code: insertError.code,
      id: input.id,
    });
    return { ok: false, error: insertError.message };
  }

  // ── Step 2: fetch the row that now definitely exists ──────────────────────
  // A PK lookup — always a single, indexed row.  .maybeSingle() (not .single())
  // avoids PGRST116 in the astronomically unlikely case the row is somehow gone.
  const { data, error: fetchError } = await getDb()
    .from("sessions")
    .select()
    .eq("id", input.id)
    .maybeSingle();

  if (fetchError) {
    logger.error("[sessions-repository] upsertSession post-fetch failed", {
      error: fetchError.message,
      code: fetchError.code,
      id: input.id,
    });
    return { ok: false, error: fetchError.message };
  }

  if (!data) {
    // Should never happen — we just inserted or confirmed the row exists.
    logger.error("[sessions-repository] upsertSession: row missing after upsert", { id: input.id });
    return { ok: false, error: "Session row not found after upsert" };
  }

  return { ok: true, data };
}

/**
 * Retrieves a session by its UUID primary key.
 *
 * @param id  The session UUID.
 * @returns   A `RepositoryResult` containing the `SessionRow`, or `null` if not found.
 */
export async function getSessionById(
  id: string,
): Promise<RepositoryResult<SessionRow | null>> {
  const { data, error } = await getDb()
    .from("sessions")
    .select()
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logger.error("[sessions-repository] getSessionById failed", {
      error: error.message,
      code: error.code,
      id,
    });
    return { ok: false, error: error.message };
  }

  return { ok: true, data };
}
