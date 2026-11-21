/**
 * What is stored about a returning visitor, in one database read.
 *
 * A visitor who accepted cookies has stored history: page views, clicks, the
 * last variant served, the behaviour state and the profile. Three readers
 * fetched these with five or six requests at once (fetchVisitorHistory,
 * getKnownFirmographics, getReturningProfileSignals). On a database that has
 * been quiet for half a minute each request opens a connection of its own; on
 * 21 Nov 2026 the five of them took up to 5.9 s together, and the hero waited.
 *
 * startVisitorStoredContext() asks the database function visitor_stored_context
 * (migration 188) for all of it in one request. The page starts it once and
 * hands the promise to the three readers, which take their rows from it.
 *
 * It answers null when the one read is not available: the migration is not
 * applied yet, the read failed, or the answer does not look as expected. A
 * reader that gets null does its own reads, exactly as before. So this file
 * can be deployed before or after the migration.
 */

import { getDb } from "@/data/db";
import { foregroundRead } from "@/lib/cache/remembered-read";
import { logger } from "@/lib/logger";

export interface StoredEventRow {
  created_at: string;
  payload?: Record<string, unknown>;
}

export interface VisitorStoredContext {
  /** events of type page_view for the session, oldest first. */
  pageViews: StoredEventRow[];
  /** events of type cta_click for the session, oldest first. */
  ctaClicks: StoredEventRow[];
  /** The most recent served_variants row, or null. */
  lastVariant: { hero_key: string | null; cta_key: string | null } | null;
  /** The most recent visitor_behavior_state row, all columns, or null. */
  behaviorState: Record<string, unknown> | null;
  /** The columns of visitor_profiles the readers use, or null without a row. */
  profile: Record<string, unknown> | null;
}

/** How long a missing function is remembered before it is tried again. */
export const FUNCTION_MISSING_RETRY_MS = 5 * 60 * 1000;

let functionMissingUntil = 0;

/** For tests: forget that the function was missing. */
export function resetVisitorStoredContextAvailability(): void {
  functionMissingUntil = 0;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isEventRows = (v: unknown): v is StoredEventRow[] =>
  Array.isArray(v) && v.every((r) => isRecord(r) && typeof r.created_at === "string");

/** Turns the function's answer into a VisitorStoredContext, or null when it is not one. */
export function parseVisitorStoredContext(raw: unknown): VisitorStoredContext | null {
  if (!isRecord(raw)) return null;
  const { page_views, cta_clicks, last_variant, behavior_state, profile } = raw;
  if (!isEventRows(page_views) || !isEventRows(cta_clicks)) return null;
  if (last_variant != null && !isRecord(last_variant)) return null;
  if (behavior_state != null && !isRecord(behavior_state)) return null;
  if (profile != null && !isRecord(profile)) return null;
  return {
    pageViews: page_views,
    ctaClicks: cta_clicks,
    lastVariant: last_variant
      ? {
          hero_key: typeof last_variant.hero_key === "string" ? last_variant.hero_key : null,
          cta_key:  typeof last_variant.cta_key === "string" ? last_variant.cta_key : null,
        }
      : null,
    behaviorState: behavior_state ?? null,
    profile: profile ?? null,
  };
}

/**
 * Starts the one read. Never rejects: null means "do your own reads".
 *
 * The read counts as a foreground read, so the refresh of remembered
 * configuration waits until it has answered (lib/cache/remembered-read.ts).
 */
export function startVisitorStoredContext(
  tenantId: string,
  sessionId: string,
): Promise<VisitorStoredContext | null> {
  if (!tenantId || !sessionId) return Promise.resolve(null);
  if (Date.now() < functionMissingUntil) return Promise.resolve(null);

  const read = (async (): Promise<VisitorStoredContext | null> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = getDb() as any;
      const { data, error } = await db.rpc("visitor_stored_context", {
        p_tenant_id:  tenantId,
        p_session_id: sessionId,
      });
      if (error) {
        // PGRST202: PostgREST does not know the function. 42883: Postgres does not.
        if (error.code === "PGRST202" || error.code === "42883") {
          functionMissingUntil = Date.now() + FUNCTION_MISSING_RETRY_MS;
          logger.warn("[visitor-stored-context] function missing; reading the tables one by one. Apply migration 188.", { tenantId });
        } else {
          logger.debug("[visitor-stored-context] read failed; reading the tables one by one", {
            tenantId, code: error.code, message: error.message,
          });
        }
        return null;
      }
      const parsed = parseVisitorStoredContext(data);
      if (!parsed) {
        logger.warn("[visitor-stored-context] unexpected answer; reading the tables one by one", { tenantId });
      }
      return parsed;
    } catch (err) {
      logger.debug("[visitor-stored-context] read threw; reading the tables one by one", {
        tenantId, error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  })();

  return foregroundRead(read);
}
