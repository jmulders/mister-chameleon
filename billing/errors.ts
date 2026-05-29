/**
 * billing/errors.ts
 *
 * Error serialization utilities for Supabase / PostgREST errors.
 *
 * ─── The problem ──────────────────────────────────────────────────────────────
 *
 *   Supabase PostgREST errors are plain objects with shape:
 *     { code: string, details: string | null, hint: string | null, message: string }
 *
 *   They are NOT instanceof Error.  When caught in a try/catch block and
 *   serialized naïvely:
 *
 *     const msg = err instanceof Error ? err.message : String(err);
 *     console.error("...", { error: msg });
 *
 *   `String(err)` produces "[object Object]", logging appears as `{}` or
 *   near-empty in structured log formatters.  All DB error context is lost.
 *
 * ─── The fix ──────────────────────────────────────────────────────────────────
 *
 *   Use `formatSupabaseError(err)` instead of `String(err)` whenever the
 *   thrown value might come from a Supabase/PostgREST query.
 *
 *   Use `serializeError(err)` when you need a structured object for JSON logs.
 */

// ── PostgREST error shape ──────────────────────────────────────────────────────

interface PostgRESTError {
  code:    string;
  details: string | null;
  hint:    string | null;
  message: string;
}

function isPostgRESTError(err: unknown): err is PostgRESTError {
  return (
    err !== null &&
    typeof err === "object" &&
    "message" in err &&
    "code" in err &&
    typeof (err as Record<string, unknown>).message === "string"
  );
}

// ── Serializers ────────────────────────────────────────────────────────────────

/**
 * Convert any caught value to a human-readable string that always includes the
 * DB error code, message, and hints from PostgREST errors.
 *
 * Safe to use in all catch blocks instead of `String(err)`.
 *
 * @example
 *   } catch (err) {
 *     console.error("[billing/page] getCreditBalance error", {
 *       tenantId,
 *       error: formatSupabaseError(err),
 *     });
 *   }
 */
export function formatSupabaseError(err: unknown): string {
  if (err instanceof Error) return err.message;

  if (isPostgRESTError(err)) {
    const parts: string[] = [`${err.message} (code: ${err.code})`];
    if (err.details) parts.push(`details: ${err.details}`);
    if (err.hint)    parts.push(`hint: ${err.hint}`);
    return parts.join(" | ");
  }

  // Fallback: try JSON so we at least see the object shape
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/**
 * Serialize any caught value to a structured object suitable for console.error
 * log calls that accept objects (e.g. `console.error("msg", { error: ... })`).
 *
 * Returns an object with `message` always set, plus `code`, `details`, `hint`
 * when available from a PostgREST error.
 *
 * @example
 *   } catch (err) {
 *     console.error("[billing/page] getWallet error", {
 *       tenantId,
 *       ...serializeError(err),
 *     });
 *   }
 */
export function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { message: err.message, stack: err.stack };
  }

  if (isPostgRESTError(err)) {
    return {
      message: err.message,
      code:    err.code,
      details: err.details ?? undefined,
      hint:    err.hint    ?? undefined,
    };
  }

  try {
    return { message: JSON.stringify(err) };
  } catch {
    return { message: String(err) };
  }
}
