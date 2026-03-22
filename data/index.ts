/**
 * Data layer barrel export
 *
 * Public API for all Supabase persistence utilities.
 * Import from "@/data" to access the database client, repositories,
 * and row types without coupling to internal file paths.
 *
 * ─── Modules ──────────────────────────────────────────────────────────────────
 *
 *   getDb()          — lazily-initialised server-side Supabase client
 *   session          — resolveSession, SESSION_COOKIE, SEEN_COOKIE, CookieSpec, …
 *   repositories     — createSession, upsertSession, saveServedVariants, saveEvent, …
 *   types            — SessionRow, ServedVariantRow, EventRow, Database, …
 *
 * NOTE: This barrel imports server-only code (via db.ts → env.ts).
 * Importing "@/data" inside a "use client" file will cause a build error.
 * That is intentional — all database access must remain on the server.
 */

// ── Database client ───────────────────────────────────────────────────────────

export { getDb } from "./db";

// ── Session resolver ──────────────────────────────────────────────────────────

export {
  resolveSession,
  SESSION_COOKIE,
  SEEN_COOKIE,
  SEEN_COOKIE_VALUE,
  SESSION_MAX_AGE,
  SEEN_MAX_AGE,
  type CookieSpec,
  type SessionResolution,
} from "./session";

// ── Repositories ──────────────────────────────────────────────────────────────

export {
  // sessions
  createSession,
  upsertSession,
  getSessionById,
  sessionInputFromContext,
  type CreateSessionInput,
  type UpsertSessionInput,
  type RepositoryOk,
  type RepositoryErr,
  type RepositoryResult,
  // served variants
  saveServedVariants,
  servedVariantsInputFromPlan,
  getServedVariantsBySession,
  type SaveServedVariantsInput,
  // events
  saveEvent,
  getRecentEventsBySession,
  type SaveEventInput,
} from "./repositories";

// ── Row types ─────────────────────────────────────────────────────────────────

export type {
  SessionRow,
  ServedVariantRow,
  EventRow,
  SessionInsert,
  ServedVariantInsert,
  EventInsert,
  Database,
} from "./types";
