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
    message.toLowerCase().includes("typeerror")
  );
}

// ── Custom fetch with Next.js cache bypass ─────────────────────────────────────

/**
 * Wraps the global `fetch` to:
 *   1. Force `cache: "no-store"` on every call so Next.js's built-in fetch
 *      deduplication/caching layer is bypassed for all Supabase REST requests.
 *   2. Re-throw network errors with a more actionable message that includes:
 *        - the URL host that was targeted
 *        - the original error cause
 *        - a hint about common causes (Supabase project paused, DNS failure)
 */
function supabaseFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return fetch(input, {
    ...init,
    // Bypass Next.js's fetch cache entirely for all Supabase calls.
    // Without this, Next.js 15+ may serve stale rows or fail with
    // "TypeError: fetch failed" when the cache store is not ready.
    cache: "no-store",
  }).catch((cause: unknown) => {
    // Extract the target host for diagnostic logging (never the service key).
    let host = "(unknown host)";
    try {
      const url = typeof input === "string" ? input
        : input instanceof URL       ? input.href
        : (input as Request).url;
      host = new URL(url).hostname;
    } catch {
      // URL parse failure — keep the fallback.
    }

    const causeMessage =
      cause instanceof Error ? cause.message : String(cause);

    logger.error("[db] Supabase fetch failed", {
      host,
      cause: causeMessage,
      hint: "Common causes: Supabase project is paused (check dashboard.supabase.com), " +
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
