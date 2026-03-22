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
import type { Database } from "./types";

// ── Singleton instance ─────────────────────────────────────────────────────────

let _db: SupabaseClient<Database> | undefined;

/**
 * Returns the shared server-side Supabase client (service-role key).
 *
 * Lazily created on first call; subsequent calls return the cached instance.
 * Throws if NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY are missing.
 *
 * @returns  A fully-configured SupabaseClient with the Database type applied.
 */
export function getDb(): SupabaseClient<Database> {
  if (_db) return _db;

  const supabaseUrl = clientEnv.supabaseUrl;
  if (!supabaseUrl) {
    throw new Error(
      "[db] Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL\n" +
        "Add it to .env.local (development) or your deployment platform's environment config.",
    );
  }

  const serviceRoleKey = serverEnv.supabase.serviceRoleKey;

  _db = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      // Service-role key does not use sessions — disable persistence entirely.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return _db;
}
