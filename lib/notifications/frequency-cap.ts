/**
 * Notification frequency capping — shared model.
 *
 * A notification can reappear on every load (default), once per browser session,
 * or once per a fixed period. When the visitor dismisses it, we write a marker
 * keyed by a STABLE per-notification id and suppress the notification while the
 * session or period lasts.
 *
 *   always           - sessionStorage; shown every session until dismissed, then
 *                      suppressed for the rest of that session (a manual dismissal
 *                      writes the marker; with no marker it shows every pageview).
 *   once_per_session - sessionStorage; suppressed until the tab/session closes.
 *   once_per_period  - localStorage; suppressed until `ttl` has elapsed.
 *
 * Storage is FUNCTIONAL, not tracking: the only value stored is a dismissal
 * timestamp keyed by the notification id. No visitor identity, no PII.
 *
 * ─── Storage keys ─────────────────────────────────────────────────────────────
 *
 *   Key:   `mc_notif_v1:<id>`   (NOTIF_KEY_PREFIX + id)
 *   Value: the dismissal time in epoch ms, as a string.
 *   Store: sessionStorage for once_per_session, localStorage for once_per_period.
 *
 * ─── Id strategy ──────────────────────────────────────────────────────────────
 *
 *   The `id` is the notification's stable identifier (its variant key, e.g.
 *   "notification_default"). Each distinct notification gets its own key, so
 *   dismissing one never suppresses another. Two showings of the SAME notification
 *   share a key (intended: "once" means once across those showings).
 *
 * This module is pure and SSR-safe (guards `window`), so NotificationBlock uses it
 * directly. The snippet mirrors the SAME key scheme (NOTIF_KEY_PREFIX) in its own
 * vanilla JS so capping behaves identically on the tenant's own site.
 */

export type NotificationFrequency = "always" | "once_per_session" | "once_per_period";
export type NotificationTtlUnit = "hours" | "days";

/** Storage-key namespace. Bump the version suffix to invalidate all markers. */
export const NOTIF_KEY_PREFIX = "mc_notif_v1:";

/**
 * The storage key for a notification.
 *
 * An optional `campaignId` (or version) is folded in as
 * `mc_notif_v1:<id>:<campaignId>`, so bumping it (a changed message or a new
 * campaign) resets the cap. Empty → falls back to the plain variant-key form.
 */
export function notifStorageKey(id: string, campaignId?: string): string {
  const c = (campaignId ?? "").trim();
  return c ? `${NOTIF_KEY_PREFIX}${id}:${c}` : `${NOTIF_KEY_PREFIX}${id}`;
}

/** Convert a ttl + unit to milliseconds (0 when absent/invalid). */
export function ttlToMs(ttl: number | undefined, unit: NotificationTtlUnit | undefined): number {
  if (!ttl || ttl <= 0) return 0;
  const perUnit = unit === "days" ? 86_400_000 : 3_600_000; // days or hours
  return ttl * perUnit;
}

function safeStorage(kind: "session" | "local"): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return kind === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null; // storage disabled (private mode, blocked) → behave as "always"
  }
}

/**
 * True when the notification should be hidden right now for this visitor.
 *
 * @param id         Stable notification id.
 * @param frequency  Capping mode.
 * @param ttlMs      Period length for once_per_period (from ttlToMs); ignored otherwise.
 * @param now        Injected clock (defaults to Date.now) — kept explicit for tests.
 */
export function isNotificationSuppressed(
  id: string,
  frequency: NotificationFrequency,
  ttlMs: number,
  campaignId: string = "",
  now: number = Date.now(),
): boolean {
  if (!id) return false;

  // "always" and "once_per_session" both suppress once a session marker exists.
  // For "always" the marker is written only on a manual dismissal, so with no
  // marker it still shows on every pageview (the prior default). This makes a
  // dismissal of an "always" notification stick for the rest of the session.
  if (frequency === "always" || frequency === "once_per_session") {
    const s = safeStorage("session");
    return !!s && s.getItem(notifStorageKey(id, campaignId)) !== null;
  }

  // once_per_period
  const s = safeStorage("local");
  if (!s) return false;
  const raw = s.getItem(notifStorageKey(id, campaignId));
  if (raw === null) return false;
  const ts = Number(raw);
  if (!Number.isFinite(ts)) return false;
  return now - ts < ttlMs; // still inside the period → suppressed
}

/**
 * Record a dismissal so the notification stays hidden per its frequency.
 *
 * "always" now writes a sessionStorage marker too, so a manual dismissal
 * suppresses the notification for the rest of the session (not just the current
 * pageview). once_per_period uses localStorage; always / once_per_session use
 * sessionStorage.
 */
export function recordNotificationDismissal(
  id: string,
  frequency: NotificationFrequency,
  campaignId: string = "",
  now: number = Date.now(),
): void {
  if (!id) return;
  const s = safeStorage(frequency === "once_per_period" ? "local" : "session");
  try {
    s?.setItem(notifStorageKey(id, campaignId), String(now));
  } catch {
    // Quota or blocked storage: capping silently degrades to "always".
  }
}
