/**
 * data/db-breaker.ts
 *
 * A circuit breaker for database calls.
 *
 * ─── Why ──────────────────────────────────────────────────────────────────────
 *
 * A time limit per call is not enough on its own. One page render asks the
 * database in about ten rounds, one after the other. Measured on 13 Nov 2026
 * against a database that never answers: with an 8-second limit per call the
 * homepage took 80 seconds, ten rounds of 8.
 *
 * Once the database has let two calls in a row run into their limit, it is not
 * going to answer the third either. The breaker then rejects calls at once for
 * a short while, so the caller's fallback gets its turn immediately. After
 * that while it lets a single call through as a probe; an answer closes the
 * breaker, another timeout keeps it open.
 *
 * The state is per server instance and holds no timers: time is passed in.
 */

export type Admission = "pass" | "probe" | "reject";

export class RestBreaker {
  private failures  = 0;
  private openUntil = 0;
  private probing   = false;

  /**
   * @param openMs     How long calls are rejected after the breaker opens.
   *                   0 or less switches the breaker off.
   * @param threshold  Timeouts in a row, with no answer in between, that open it.
   */
  constructor(
    private readonly openMs: number,
    private readonly threshold: number = 2,
  ) {}

  /** May a call go out now? A "probe" is the one call let through to test the water. */
  admit(nowMs: number): Admission {
    if (this.openMs <= 0) return "pass";
    if (this.failures < this.threshold) return "pass";
    if (nowMs < this.openUntil) return "reject";
    if (this.probing) return "reject";
    this.probing = true;
    return "probe";
  }

  /** The database answered. Returns true when this closed an open breaker. */
  answered(admission: Admission): boolean {
    const wasOpen = this.failures >= this.threshold;
    this.failures  = 0;
    this.openUntil = 0;
    if (admission === "probe") this.probing = false;
    return wasOpen;
  }

  /** A call ran into its time limit. Returns true when this opened the breaker. */
  timedOut(nowMs: number, admission: Admission): boolean {
    if (admission === "probe") this.probing = false;
    if (this.openMs <= 0) return false;
    const wasOpen = this.failures >= this.threshold;
    this.failures += 1;
    if (this.failures < this.threshold) return false;
    this.openUntil = nowMs + this.openMs;
    return !wasOpen;
  }

  /**
   * A call ended in a way that says nothing about the database: the caller
   * aborted it, or the network refused at once. Frees the probe slot.
   */
  inconclusive(admission: Admission): void {
    if (admission === "probe") this.probing = false;
  }

  /** Milliseconds until the next probe is allowed; 0 when calls may go out. */
  retryInMs(nowMs: number): number {
    if (this.failures < this.threshold) return 0;
    return Math.max(0, this.openUntil - nowMs);
  }
}

/** Thrown, without a request going out, while the breaker is open. */
export class DatabaseUnavailableError extends Error {
  constructor(retryInMs: number) {
    super(`The database did not answer recently. Calls are skipped for another ${Math.ceil(retryInMs / 1000)} s.`);
    this.name = "DatabaseUnavailableError";
  }
}
