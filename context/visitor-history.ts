/**
 * Visitor History
 *
 * Lightweight first-party history signals derived from the visitor's own
 * session data — events and served variants recorded in previous page loads
 * within the same browser session.
 *
 * ─── Privacy model ───────────────────────────────────────────────────────────
 *
 *   All signals are derived ONLY from first-party app data written by this
 *   platform for this specific visitor's session:
 *
 *     sessions.id        ← UUID from the visitor's own mc_session_id cookie
 *     events             ← events the visitor themselves generated
 *     served_variants    ← variants this platform rendered for them
 *
 *   No cross-site tracking. No device fingerprinting. No third-party data.
 *   No persistent identifier beyond the first-party cookie the app sets.
 *
 * ─── Session identity model ──────────────────────────────────────────────────
 *
 *   The `mc_session_id` cookie has a 30-day maxAge and uses `upsertSession`
 *   with `ignoreDuplicates: true`. This means one DB row is shared across
 *   all page loads within a 30-day inactivity window for the same browser.
 *
 *   Querying events and served_variants by session_id therefore captures
 *   the full history of that visitor's interactions within the current window
 *   — naturally first-party, naturally scoped to the browser, naturally expiring.
 *
 * ─── What is NOT stored ──────────────────────────────────────────────────────
 *
 *   • No IP address
 *   • No geolocation
 *   • No device fingerprint
 *   • No cross-session stitching beyond what the browser's own cookie provides
 *   • No PII (names, emails, etc.)
 *
 * ─── When history is empty ───────────────────────────────────────────────────
 *
 *   `emptyHistory()` returns a safe zero-value struct used when:
 *     - The DB query fails (graceful degradation)
 *     - The caller is in a context where DB access isn't available (tests, edge)
 *     - The session is brand-new and has no recorded events yet
 */

// ── VisitorHistory type ───────────────────────────────────────────────────────

/**
 * First-party behavioural history for the current visitor session.
 *
 * All numeric fields start at 0; all boolean flags start at false;
 * all nullable string fields start at null. This is the shape returned
 * by `emptyHistory()` and is the safe default across all decision rules.
 */
export interface VisitorHistory {
  /**
   * Number of `page_view` events recorded for this session ID.
   *
   * Because events are written after the response is sent (`after()`),
   * this count reflects *prior* visits — not the one currently in-flight.
   *
   * Interpretation guide:
   *   0 — first-ever page render for this session (no prior events yet)
   *   1 — one previous page view; this is the second load
   *   3+ — highly engaged; visitor keeps returning
   */
  pageViewCount: number;

  /**
   * Whether this session has ever produced at least one `cta_click` event.
   *
   * Useful for showing a different experience to visitors who already
   * engaged once — e.g. escalating from a guide offer to a meeting invite.
   */
  hasClickedCta: boolean;

  /**
   * Total number of `cta_click` events for this session.
   * Useful for measuring re-engagement (clicked more than once).
   */
  ctaClickCount: number;

  /**
   * The hero variant key from the most recently recorded served_variant row
   * for this session, or null if no variants have been logged yet.
   *
   * Used to detect whether to rotate the hero on the next visit or to
   * maintain consistency if the visitor previously engaged with a specific
   * variant.
   */
  lastHeroKey: string | null;

  /**
   * The CTA variant key from the most recently recorded served_variant row,
   * or null if no variants have been logged yet.
   */
  lastCtaKey: string | null;

  /**
   * ISO-8601 timestamp of the first event ever recorded for this session.
   * null on the very first render (no events written yet).
   *
   * Provides a proxy for "how long has this visitor been around" when a
   * full visitor profile is not available.
   */
  firstSeenAt: string | null;

  /**
   * True when the history struct was populated from a successful DB query.
   * False when `emptyHistory()` was used as a fallback (DB error, first visit).
   *
   * Rules that require reliable history (e.g. "has clicked CTA") should
   * check this flag before acting on the data to avoid false negatives on
   * DB errors masquerading as "no history".
   */
  fromDatabase: boolean;
}

// ── Safe zero value ───────────────────────────────────────────────────────────

/**
 * Returns a safe zero-value `VisitorHistory` with all counts at 0,
 * all flags at false, and `fromDatabase: false`.
 *
 * Used as the fallback when the DB query fails or is unavailable.
 * Decision rules that branch on history should treat `fromDatabase: false`
 * as "insufficient data" rather than "definitely no history".
 *
 * @example
 * const history = await fetchVisitorHistory(sessionId).catch(() => emptyHistory());
 */
export function emptyHistory(): VisitorHistory {
  return {
    pageViewCount: 0,
    hasClickedCta: false,
    ctaClickCount: 0,
    lastHeroKey: null,
    lastCtaKey: null,
    firstSeenAt: null,
    fromDatabase: false,
  };
}

/**
 * Derives a plain-object snapshot of `VisitorHistory` suitable for passing
 * to `logger.info()` and storing in `ai_decision_logs.context`.
 */
export function historyToLogMeta(history: VisitorHistory): Record<string, unknown> {
  return {
    pageViewCount: history.pageViewCount,
    hasClickedCta: history.hasClickedCta,
    ctaClickCount: history.ctaClickCount,
    lastHeroKey: history.lastHeroKey,
    lastCtaKey: history.lastCtaKey,
    firstSeenAt: history.firstSeenAt,
    fromDatabase: history.fromDatabase,
  };
}
