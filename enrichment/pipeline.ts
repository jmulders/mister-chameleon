/**
 * Enrichment Pipeline
 *
 * Runs a set of enrichers in parallel, each with a per-enricher timeout.
 * Merges partial outputs into a single `EnrichmentOutput`.
 *
 * ─── Fail-safe guarantees ────────────────────────────────────────────────────
 *
 *   • runEnrichmentPipeline() ALWAYS resolves — it never rejects.
 *   • Each enricher runs inside Promise.race([enricher(input), timeout]).
 *   • Timeouts and thrown errors produce {} and an EnrichmentLogEntry.
 *   • A completely failed pipeline returns { output: {}, errors: [...] }.
 *
 * ─── Merge strategy ──────────────────────────────────────────────────────────
 *
 *   Results are merged in enricher order: later enrichers overwrite earlier
 *   ones for the same key. Enrichers should be ordered by ascending priority
 *   (highest-trust provider last).
 *
 * ─── Performance ─────────────────────────────────────────────────────────────
 *
 *   All enrichers run concurrently via Promise.allSettled — the total wall
 *   time is bounded by max(timeoutMs, slowest-successful-enricher).
 *   Default timeout: 2000 ms.
 */

import type {
  Enricher,
  EnricherInput,
  EnrichmentOutput,
  EnrichmentLogEntry,
  EnrichmentPipelineResult,
  LabeledEnricher,
  PipelineOptions,
} from "./types";

// ── Default options ───────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 2_000;

// ── Timeout helper ────────────────────────────────────────────────────────────

/**
 * Returns a promise that rejects with a sentinel timeout error after `ms`.
 * Used in Promise.race() to enforce per-enricher time budgets.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject(new TimeoutError(ms));
    }, ms);
  });
  return Promise.race([promise, timeout]);
}

class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Enricher timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

// ── runEnrichmentPipeline ─────────────────────────────────────────────────────

/**
 * Execute all enrichers in parallel and merge their outputs.
 *
 * @param enrichers - Array of enrichers (plain functions or LabeledEnricher objects).
 * @param input     - Signals available to every enricher.
 * @param options   - Optional timeout and logger configuration.
 * @returns         - Always resolves with merged output + error log.
 *
 * @example
 * const result = await runEnrichmentPipeline(
 *   [createGeoEnricher(myGeoProvider), createCompanyEnricher(myCompanyProvider)],
 *   { ip, tenantId, utm, sessionId },
 *   { timeoutMs: 1500 },
 * );
 * // result.output.countryCode === "NL"
 * // result.errors === []
 */
export async function runEnrichmentPipeline(
  enrichers: Array<Enricher | LabeledEnricher>,
  input: EnricherInput,
  options: PipelineOptions = {},
): Promise<EnrichmentPipelineResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const logger    = options.logger ?? defaultLogger;

  // Normalise to LabeledEnricher for consistent internal handling
  const labeled: LabeledEnricher[] = enrichers.map((e) =>
    typeof e === "function" ? { enricher: e } : e,
  );

  // Run all enrichers concurrently, each with its own timeout
  const settled = await Promise.allSettled(
    labeled.map(({ enricher, label }, index) =>
      withTimeout(enricher(input), timeoutMs).catch((error) => {
        const entry: EnrichmentLogEntry = {
          enricherIndex: index,
          enricherLabel: label,
          timedOut: error instanceof TimeoutError,
          error,
        };
        logger(entry);
        // Re-throw a structured entry so the settled handler can record it
        throw entry;
      }),
    ),
  );

  // Collect results and errors
  const errors: EnrichmentLogEntry[] = [];
  let merged: Partial<EnrichmentOutput> = {};

  for (const result of settled) {
    if (result.status === "fulfilled") {
      // Merge: later enrichers win for duplicate keys
      merged = { ...merged, ...result.value };
    } else {
      // result.reason is an EnrichmentLogEntry (thrown above)
      const reason = result.reason as EnrichmentLogEntry;
      errors.push(reason);
    }
  }

  return { output: merged, errors };
}

// ── buildEnricherInput ────────────────────────────────────────────────────────

/**
 * Convenience helper to construct an `EnricherInput` from common request
 * signals. Callers may also build `EnricherInput` directly.
 *
 * @example
 * const input = buildEnricherInput({
 *   ip: request.headers.get("x-forwarded-for"),
 *   tenantId: tenant.tenantId,
 *   utmParams: visitorContext.utm,
 *   sessionId: session.id,
 * });
 */
export function buildEnricherInput(opts: {
  ip:        string | null | undefined;
  tenantId:  string | null | undefined;
  sessionId: string | null | undefined;
  email?:    string | null | undefined;
  /**
   * First-party visitor identifier used by the GA4 History enricher.
   * Should be the stable `mc_session_id` UUID — the same value set as the
   * GA4 user property by `Ga4TrackingProvider` on the client side.
   */
  visitorId?: string | null | undefined;
  utmParams?: {
    campaign?: string | null;
    source?:   string | null;
    medium?:   string | null;
    term?:     string | null;
    content?:  string | null;
  } | null;
  /** Visitor-provided location from a form submit (postcode primary, place coarse). */
  formLocation?: { postcode: string | null; place: string | null } | null;
}): EnricherInput {
  return {
    ip:        opts.ip        ?? null,
    tenantId:  opts.tenantId  ?? null,
    sessionId: opts.sessionId ?? null,
    email:     opts.email     ?? null,
    visitorId: opts.visitorId ?? null,
    formLocation: opts.formLocation ?? null,
    utm: {
      campaign: opts.utmParams?.campaign ?? null,
      source:   opts.utmParams?.source   ?? null,
      medium:   opts.utmParams?.medium   ?? null,
      term:     opts.utmParams?.term     ?? null,
      content:  opts.utmParams?.content  ?? null,
    },
  };
}

// ── Default logger ────────────────────────────────────────────────────────────

function defaultLogger(entry: EnrichmentLogEntry): void {
  const label = entry.enricherLabel ? ` (${entry.enricherLabel})` : "";
  const kind  = entry.timedOut ? "timed out" : "failed";
  console.warn(
    `[enrichment] Enricher #${entry.enricherIndex}${label} ${kind}:`,
    entry.error,
  );
}
