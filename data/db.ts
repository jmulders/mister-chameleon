/**
 * Server-side Supabase Database Client
 *
 * Creates a single, lazily-initialised Supabase client that uses the
 * service-role key for unrestricted server-side database access.
 *
 * ─── Security model ───────────────────────────────────────────────────────────
 *
 *   The service-role key bypasses Row Level Security (RLS).
 *   This module is intentionally server-only — importing it in a Client
 *   Component causes a hard build error via the "server-only" guard in
 *   src/lib/env.ts (which this module imports transitively).
 *
 *   Never expose the service-role key to the browser.
 *
 * ─── Client vs. server client ─────────────────────────────────────────────────
 *
 *   This file exports the server (service-role) client only.
 *   For authenticated browser operations that respect RLS, create a
 *   separate client in a "use client" context using the anon key and
 *   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY directly.
 *
 * ─── Singleton pattern ────────────────────────────────────────────────────────
 *
 *   `getDb()` returns the same client instance across calls within a
 *   process — Supabase JS v2 clients are connection-pooled internally.
 *   The instance is created on first call (lazy) so module import never
 *   throws, consistent with the lazy validation model in src/lib/env.ts.
 *
 * ─── Next.js fetch compatibility ──────────────────────────────────────────────
 *
 *   Next.js 15+ decorates the global `fetch` for deduplication and caching.
 *   Supabase JS uses this global fetch for all REST API calls.  Without
 *   explicit `cache: "no-store"`, Next.js may cache query responses across
 *   requests, return stale results, or — in certain rendering contexts where
 *   the cache store is not yet initialised — throw a network-level error that
 *   surfaces as `TypeError: fetch failed`.
 *
 *   The custom `fetch` wrapper below always sets `cache: "no-store"` so every
 *   Supabase call bypasses Next.js's built-in fetch cache entirely.  This is
 *   the correct posture for a service-role client making dynamic, per-request
 *   queries.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   import { getDb } from "@/data/db";
 *
 *   const { data, error } = await getDb()
 *     .from("sessions")
 *     .insert({ ... })
 *     .select()
 *     .single();
 *
 * ─── Required env vars ────────────────────────────────────────────────────────
 *
 *   NEXT_PUBLIC_SUPABASE_URL        — project URL (public, also used client-side)
 *   SUPABASE_SERVICE_ROLE_KEY       — service role secret (server-only)
 *
 *   Both are validated by src/lib/env.ts on first access and will throw
 *   with a clear error message if absent.
 */

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientEnv, serverEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { RestBreaker, DatabaseUnavailableError } from "./db-breaker";
import type { Database } from "./types";

// ── Singleton instance ─────────────────────────────────────────────────────────

let _db: SupabaseClient<Database> | undefined;

// ── Diagnostics helper ─────────────────────────────────────────────────────────

/**
 * Classify a Supabase/PostgREST error message to decide whether it looks like
 * a network-level failure (as opposed to a DB query error).
 *
 * Supabase JS wraps raw fetch errors in the PostgREST error shape.  When the
 * underlying `fetch` call throws (DNS failure, connection refused, TLS error,
 * or a Next.js cache-context issue), the error message is the string form of
 * the thrown Error — typically "TypeError: fetch failed".
 *
 * Returns true for messages that look like transport-level failures, false for
 * DB/query errors (invalid JWT, table not found, RLS violation, etc.).
 */
function isNetworkError(message: string | undefined | null): boolean {
  // Guard: when Supabase throws a fetch-level error (e.g. project paused,
  // DNS failure) the error object may lack a message property entirely.
  if (!message) return true; // absence of a message = transport-level failure
  return (
    message.includes("fetch failed") ||
    message.includes("ENOTFOUND")    ||
    message.includes("ECONNREFUSED") ||
    message.includes("ECONNRESET")   ||
    message.includes("ETIMEDOUT")    ||
    message.includes("network")      ||
    // A request this module gave up on (see REST timeouts below), or one the
    // caller aborted. Not "timeout" on its own: Postgres words a cancelled
    // statement that way and that is a query error, not a transport failure.
    message.includes("TimeoutError") ||
    message.includes("AbortError")   ||
    message.includes("DatabaseUnavailableError") ||
    message.toLowerCase().includes("typeerror")
  );
}

// ── REST timeouts ──────────────────────────────────────────────────────────────
//
// On 13 Nov 2026 the production database stopped answering for five and a half
// hours. Requests to it did not fail, they hung, and every page that read from
// it hung with them for longer than 25 seconds. A database call now gives up
// after a fixed time and fails like any other transport error, so the caller's
// own fallback (a cached copy, a default, an error message) gets its turn.
//
// Only PostgREST calls (/rest/v1/) are limited. Storage uploads and downloads
// can legitimately take longer and are left alone.
//
// A write that times out here may still have been applied by the database: the
// limit ends the wait, not the statement. Writes therefore get more time.

/** Reads (GET, HEAD) give up after this many milliseconds. */
export const DEFAULT_REST_READ_TIMEOUT_MS = 8_000;

/** Writes and RPC calls (POST, PATCH, PUT, DELETE) give up after this many. */
export const DEFAULT_REST_WRITE_TIMEOUT_MS = 15_000;

/** A non-negative integer from the environment, else the fallback. */
function envTimeout(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * How long a request to `url` may take, or null for no limit.
 *
 *   SUPABASE_REST_READ_TIMEOUT_MS   overrides the read limit
 *   SUPABASE_REST_WRITE_TIMEOUT_MS  overrides the write limit
 *
 * 0 switches a limit off.
 */
export function restTimeoutMs(
  url: string,
  method: string | undefined,
  env: Record<string, string | undefined> = process.env,
): number | null {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }
  if (!pathname.startsWith("/rest/v1/")) return null;

  const verb   = (method ?? "GET").toUpperCase();
  const isRead = verb === "GET" || verb === "HEAD";
  const ms = isRead
    ? envTimeout(env["SUPABASE_REST_READ_TIMEOUT_MS"],  DEFAULT_REST_READ_TIMEOUT_MS)
    : envTimeout(env["SUPABASE_REST_WRITE_TIMEOUT_MS"], DEFAULT_REST_WRITE_TIMEOUT_MS);
  return ms > 0 ? ms : null;
}

/** After two timeouts in a row, calls are rejected at once for this long. */
export const DEFAULT_REST_BREAKER_OPEN_MS = 15_000;

/**
 * The single call that tests the water after that gets at most this long. A
 * healthy database answers in well under a second, so the visitor whose render
 * carries the probe does not wait a full limit again.
 */
export const REST_PROBE_TIMEOUT_MS = 2_000;

/**
 * One breaker per server instance (see ./db-breaker.ts).
 *
 *   SUPABASE_REST_BREAKER_OPEN_MS  overrides how long it stays open; 0 switches it off
 */
let _breaker: RestBreaker | undefined;
function breaker(): RestBreaker {
  _breaker ??= new RestBreaker(
    envTimeout(process.env["SUPABASE_REST_BREAKER_OPEN_MS"], DEFAULT_REST_BREAKER_OPEN_MS),
  );
  return _breaker;
}

/** Start again with a closed breaker, re-reading the environment. For tests. */
export function resetRestBreaker(): void {
  _breaker = undefined;
}

/** The URL a fetch call targets, as a string. */
function requestUrl(input: RequestInfo | URL): string {
  return typeof input === "string" ? input
    : input instanceof URL         ? input.href
    : (input as Request).url;
}

// ── Custom fetch with Next.js cache bypass ─────────────────────────────────────

/**
 * Wraps the global `fetch` to:
 *   1. Force `cache: "no-store"` on every call so Next.js's built-in fetch
 *      deduplication/caching layer is bypassed for all Supabase REST requests.
 *   2. Give a PostgREST call a time limit (see REST timeouts above). A signal
 *      the caller passed keeps working next to it. After two timeouts in a row
 *      the breaker rejects PostgREST calls at once for a short while.
 *   3. Re-throw network errors with a more actionable message that includes:
 *        - the URL host that was targeted
 *        - the original error cause
 *        - a hint about common causes (Supabase project paused, DNS failure)
 */
export function supabaseFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  let url = "";
  try { url = requestUrl(input); } catch { /* keep "" — no limit, no host */ }

  const method  = init?.method ?? (input instanceof Request ? input.method : undefined);
  const limitMs = restTimeoutMs(url, method);

  // Only calls with a time limit go through the breaker: they are the ones
  // that can tell whether the database answers.
  const guarded   = limitMs !== null;
  const admission = guarded ? breaker().admit(Date.now()) : "pass";
  if (admission === "reject") {
    return Promise.reject(new DatabaseUnavailableError(breaker().retryInMs(Date.now())));
  }

  const timeoutMs = limitMs !== null && admission === "probe"
    ? Math.min(limitMs, REST_PROBE_TIMEOUT_MS)
    : limitMs;
  const signal    = timeoutMs === null
    ? init?.signal
    : init?.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(timeoutMs)])
      : AbortSignal.timeout(timeoutMs);

  return fetch(input, {
    ...init,
    ...(signal ? { signal } : {}),
    // Bypass Next.js's fetch cache entirely for all Supabase calls.
    // Without this, Next.js 15+ may serve stale rows or fail with
    // "TypeError: fetch failed" when the cache store is not ready.
    cache: "no-store",
  }).then((response) => {
    // Any answer, also an error status, means the database is reachable.
    if (guarded && breaker().answered(admission)) {
      logger.info("[db] Database answers again, calls resumed");
    }
    return response;
  }).catch((cause: unknown) => {
    // Extract the target host for diagnostic logging (never the service key).
    let host = "(unknown host)";
    try {
      host = new URL(url).hostname;
    } catch {
      // URL parse failure — keep the fallback.
    }

    const causeMessage =
      cause instanceof Error ? cause.message : String(cause);
    const timedOut = cause instanceof Error && cause.name === "TimeoutError";

    if (guarded) {
      if (!timedOut) {
        breaker().inconclusive(admission);
      } else if (breaker().timedOut(Date.now(), admission)) {
        logger.error("[db] Database does not answer, skipping calls for a while", {
          host,
          skipMs: breaker().retryInMs(Date.now()),
        });
      }
    }

    logger.error(timedOut ? "[db] Supabase request timed out" : "[db] Supabase fetch failed", {
      host,
      cause: causeMessage,
      ...(timedOut ? { timeoutMs, method: (method ?? "GET").toUpperCase() } : {}),
      hint: timedOut
        ? "The database did not answer in time. Check its load and its Disk IO budget in the Supabase dashboard."
        : "Common causes: Supabase project is paused (check dashboard.supabase.com), " +
          "DNS resolution failed, or the server has no outbound internet access.",
    });

    // Re-throw so the Supabase client wraps it in a PostgrestError as usual.
    throw cause;
  });
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Returns the shared server-side Supabase client (service-role key).
 *
 * Lazily created on first call; subsequent calls return the cached instance.
 * Throws immediately (before any network I/O) when:
 *   - NEXT_PUBLIC_SUPABASE_URL is missing or not a valid URL
 *   - SUPABASE_SERVICE_ROLE_KEY is missing
 *
 * @returns  A fully-configured SupabaseClient with the Database type applied.
 */
export function getDb(): SupabaseClient<Database> {
  if (_db) return _db;

  // ── Validate NEXT_PUBLIC_SUPABASE_URL ──────────────────────────────────────

  const supabaseUrl = clientEnv.supabaseUrl;

  if (!supabaseUrl) {
    throw new Error(
      "[db] Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL\n" +
      "Add it to .env.local (development) or your deployment platform's environment config.\n" +
      "Expected format: https://<project-ref>.supabase.co",
    );
  }

  // Parse the URL early so we can give a clear error for malformed values
  // (e.g. a placeholder like "https://your-project.supabase.co" still passes
  // the presence check but would produce a confusing DNS failure at query time).
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(supabaseUrl);
  } catch {
    throw new Error(
      `[db] NEXT_PUBLIC_SUPABASE_URL is not a valid URL.\n` +
      `Value (truncated): "${supabaseUrl.slice(0, 60)}"\n` +
      `Expected format: https://<project-ref>.supabase.co`,
    );
  }

  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    throw new Error(
      `[db] NEXT_PUBLIC_SUPABASE_URL must use https:// or http://.\n` +
      `Got protocol: "${parsedUrl.protocol}"`,
    );
  }

  // ── Read service-role key (throws if absent via serverEnv validation) ───────

  const serviceRoleKey = serverEnv.supabase.serviceRoleKey;

  // ── Diagnostic log (host only — never the key or full URL) ──────────────────

  logger.debug("[db] Supabase client initialising", {
    host:              parsedUrl.hostname,
    urlPresent:        true,
    serviceKeyPresent: !!serviceRoleKey,
  });

  // ── Create client ────────────────────────────────────────────────────────────

  _db = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      // Service-role key does not use sessions — disable persistence entirely.
      persistSession:      false,
      autoRefreshToken:    false,
      detectSessionInUrl:  false,
    },
    global: {
      // Route all Supabase HTTP calls through our custom fetch wrapper.
      // This enforces `cache: "no-store"` and improves network error messages.
      fetch: supabaseFetch,
    },
  });

  return _db;
}

// ── Re-exported helper ─────────────────────────────────────────────────────────

/**
 * Returns true when the given Supabase/PostgREST error message indicates a
 * transport-level failure (DNS, connection refused, Next.js fetch context).
 *
 * Exported so that callers (e.g. tenant-store) can log differentiated messages.
 */
export { isNetworkError };
