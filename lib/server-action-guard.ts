/**
 * server-action-guard.ts
 *
 * Utility for Next.js server actions.
 *
 * Next.js implements redirect() and notFound() by throwing a special object
 * with a `digest` property (e.g. "NEXT_REDIRECT", "NEXT_NOT_FOUND").
 * These internal signals must NEVER be caught and swallowed inside a server
 * action's try-catch — doing so produces cryptic "Error: NEXT_REDIRECT"
 * messages in the client instead of performing the intended navigation.
 *
 * Usage — call this as the very first line of every catch block:
 *
 *   } catch (err) {
 *     rethrowNextInternal(err);
 *     return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
 *   }
 */
export function rethrowNextInternal(err: unknown): void {
  if (typeof err === "object" && err !== null && "digest" in err) throw err;
}
