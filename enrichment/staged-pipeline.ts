/**
 * Enrichment Layer — Staged Pipeline Runner (with Wave-Parallel Execution)
 *
 * `runStagedPipeline` executes `StagedEnricher` stages in dependency order.
 * By default every stage runs sequentially so each stage can read the fully
 * accumulated output of every prior stage.  When stages carry a `wave` field,
 * all consecutive stages with the same wave number are dispatched as a
 * `Promise.all` group — they run concurrently and each sees the same
 * accumulated state that existed before the wave started.
 *
 * ─── Wave-based parallel execution ───────────────────────────────────────────
 *
 *   Consecutive stages sharing the same `wave` value are batched:
 *
 *     [IP-Class]             ← no wave → sequential
 *     [MaxMind, wave:1]      ┐
 *     [IPinfo,  wave:1]      ├ Promise.all (wave 1)
 *     [GA4,     wave:1]      ┘
 *     [CloudDet]             ← no wave → sequential
 *     [RevGeo,  wave:2]      ┐
 *     [Weather, wave:2]      ├ Promise.all (wave 2)
 *     [OpenKvK, wave:2]      │
 *     [Leadinfo,wave:2]      ┘
 *     [HubSpot]              ← no wave → sequential
 *     [Seasonal]             ← no wave → sequential
 *
 *   Each wave group produces its own merged partial output.  That partial is
 *   merged into `accumulated` before the next sequential (or wave) step runs.
 *
 * ─── Why sequential instead of fully parallel? ────────────────────────────────
 *
 *   Some stages depend on the output of earlier stages.  For example:
 *     • Cloud Detection reads `networkOrg/networkAsn` from IPinfo Lite.
 *     • OpenKvK gates on `countryCode === "NL"` + `isCloudProvider === false`.
 *     • HubSpot uses the best `companyDomain` resolved by OpenKvK / Leadinfo.
 *
 *   The wave system captures the first two thirds of the available parallelism
 *   (independent geo + network lookups) without breaking the dependency chain.
 *
 * ─── Fault tolerance ──────────────────────────────────────────────────────────
 *
 *   • Every stage (sequential or parallel) is wrapped in try/catch.
 *   • An optional per-stage timeout cuts off slow calls via `Promise.race`.
 *   • Failed stages contribute `{}` to accumulation and are logged in trace.
 *   • The function always resolves — it never rejects.
 *
 * ─── Merge strategy ───────────────────────────────────────────────────────────
 *
 *   Non-null values overwrite earlier values for the same key.  Null/undefined
 *   values in a later stage never erase a real value from an earlier stage.
 *   Within a parallel wave the outputs are merged in array order (deterministic).
 */

import type {
  StagedEnricher,
  StagedPipelineResult,
  StageTrace,
  EnricherInput,
  EnricherContext,
  EnrichmentOutput,
  EnrichmentTrace,
  EnrichmentFieldTrace,
} from "./types";

// ── Stage metadata lookup tables ──────────────────────────────────────────────
//
// Maps the well-known stage labels (set by provider factory functions) to
// human-readable source names and the EnricherInput fields each stage consumes.
// Used to populate EnrichmentFieldTrace without requiring providers to implement
// extra interfaces.

const STAGE_SOURCE_MAP: Record<string, string> = {
  "IP Classification": "request IP (in-process)",
  "geo:headers":       "CDN header",
  "geo:maxmind":       "MaxMind GeoLite2",
  "geo:ipapi":         "ip-api.com",
  "IPinfo Lite":       "ipinfo.io API",
  "Cloud Detection":   "in-process ASN / org pattern match",
  "Reverse Geocode":   "reverse-geocode (LocationIQ / BigDataCloud / Nominatim)",
  "Weather":           "Open-Meteo API",
  "GA4 History":       "Google Analytics 4 Data API",
  "Seasonal Event":    "Nager.Date / business-events",
};

const STAGE_INPUTS_MAP: Record<string, string[]> = {
  "IP Classification": ["ip"],                          // reads input.ip directly
  "geo:headers":       [],                              // reads HTTP headers, not raw IP
  "geo:maxmind":       ["effectiveIp"],
  "geo:ipapi":         ["effectiveIp"],
  "IPinfo Lite":       ["effectiveIp"],
  "Cloud Detection":   ["networkOrg", "networkAsn"],    // reads accumulated network fields
  "Reverse Geocode":   ["latitude", "longitude"],       // gates on accumulated lat/lng
  "Weather":           ["latitude", "longitude"],       // gates on accumulated lat/lng
  "GA4 History":       ["visitorId"],                   // gates on input.visitorId
  "Seasonal Event":    ["countryCode"],                 // gates on accumulated.countryCode
};

/**
 * Stage labels whose enrichers operate entirely on request-time data
 * (no external I/O, no API calls).  These stages get `cacheSource: "request-time"`
 * automatically — the enricher does not need to call `ctx.setCacheSource()`.
 */
const REQUEST_TIME_STAGE_LABELS = new Set([
  "IP Classification",
  "geo:headers",
  "Cloud Detection",
]);

function stageSource(label: string): string {
  return STAGE_SOURCE_MAP[label] ?? label;
}

function stageInputs(label: string): string[] {
  return STAGE_INPUTS_MAP[label] ?? ["effectiveIp"];
}

// ── Options ───────────────────────────────────────────────────────────────────

export interface StagedPipelineOptions {
  /**
   * Maximum milliseconds to wait for any single stage.
   * Stages that exceed this budget are recorded as timed-out errors.
   * Default: 3 000 ms.
   */
  timeoutMs?: number;

  /**
   * Optional structured logger.
   * Called for every stage that errors or times out.
   */
  logger?: (entry: {
    label:    string;
    timedOut: boolean;
    error:    unknown;
  }) => void;

  /**
   * Optional initial accumulated output to seed the pipeline with.
   *
   * Use this to inject the output of a zero-cost pre-pass enricher (e.g.
   * CDN header geo) so that stage 1 and later stages can read those fields
   * via `accumulated`.  Fields set here are treated as lowest-priority —
   * any stage that produces a non-null value for the same key overwrites them.
   */
  initialAccumulated?: Partial<EnrichmentOutput>;
}

// ── Internal types ────────────────────────────────────────────────────────────

/** A group of stages to run together as a `Promise.all` wave. */
interface WaveGroup {
  kind:   "wave";
  wave:   number;
  stages: StagedEnricher[];
}

/** A single stage to run sequentially. */
interface SoloGroup {
  kind:  "solo";
  stage: StagedEnricher;
}

type StageGroup = WaveGroup | SoloGroup;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Merge `next` on top of `base`.
 * Non-null values in `next` overwrite `base`; null/undefined values in `next`
 * are skipped so earlier non-null results are preserved.
 */
function mergeOutput(
  base: Partial<EnrichmentOutput>,
  next: Partial<EnrichmentOutput>,
): Partial<EnrichmentOutput> {
  const merged = { ...base };
  for (const key of Object.keys(next) as (keyof EnrichmentOutput)[]) {
    const val = next[key];
    if (val !== null && val !== undefined) {
      // Type-safe assignment via unknown cast — keys are guaranteed to align.
      (merged as Record<string, unknown>)[key] = val;
    }
  }
  return merged;
}

/** Wrap a promise with a rejection after `ms` milliseconds. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Stage timed out after ${ms} ms`)), ms),
    ),
  ]);
}

/**
 * Partition a flat stage array into sequential groups and parallel wave groups.
 *
 * Consecutive stages with the same `wave` value are collected into a `WaveGroup`.
 * All other stages become individual `SoloGroup` entries.
 *
 * A wave group with only one member is kept as a WaveGroup (not demoted to Solo)
 * so the trace correctly records the wave number.
 */
function groupStages(stages: StagedEnricher[]): StageGroup[] {
  const groups: StageGroup[] = [];
  let i = 0;

  while (i < stages.length) {
    const stage = stages[i];
    const wave  = stage.wave;

    if (wave === undefined) {
      groups.push({ kind: "solo", stage });
      i++;
      continue;
    }

    // Collect all consecutive stages with the same wave number.
    const waveStages: StagedEnricher[] = [stage];
    i++;
    while (i < stages.length && stages[i].wave === wave) {
      waveStages.push(stages[i]);
      i++;
    }
    groups.push({ kind: "wave", wave, stages: waveStages });
  }

  return groups;
}

// ── Single-stage execution ────────────────────────────────────────────────────

/**
 * Run a single stage against a snapshot of accumulated output.
 * Returns a `StageTrace` entry that describes what happened.
 *
 * The `wave` argument is forwarded into the trace when the stage was dispatched
 * as part of a parallel wave group.
 */
async function runStage(
  stage:       StagedEnricher,
  input:       EnricherInput,
  accumulated: Partial<EnrichmentOutput>,
  timeoutMs:   number,
  loggerFn:    StagedPipelineOptions["logger"],
  wave?:       number,
): Promise<{ trace: StageTrace; output: Partial<EnrichmentOutput>; fieldMeta: EnrichmentFieldTrace | null }> {
  // ── Gate check ──────────────────────────────────────────────────────────────
  if (stage.shouldRun && !stage.shouldRun(input, accumulated)) {
    const skipReason = stage.getSkipReason
      ? stage.getSkipReason(input, accumulated)
      : undefined;
    return {
      trace: {
        label:      stage.label,
        durationMs: 0,
        skipped:    true,
        output:     {},
        ...(skipReason ? { skipReason } : {}),
        ...(wave !== undefined ? { wave } : {}),
      },
      output:    {},
      fieldMeta: null,
    };
  }

  // ── Execute with timeout ────────────────────────────────────────────────────
  const start = Date.now();
  let stageOutput: Partial<EnrichmentOutput> = {};
  let errorMsg: string | undefined;

  let stageCacheSource: "request-time" | "provider-cache" | "fresh" =
    REQUEST_TIME_STAGE_LABELS.has(stage.label) ? "request-time" : "fresh";

  const ctx: EnricherContext = {
    setCacheSource(source) { stageCacheSource = source; },
  };

  try {
    stageOutput = await withTimeout(
      stage.enricher(input, accumulated, ctx),
      timeoutMs,
    );
  } catch (err) {
    const timedOut =
      err instanceof Error && err.message.startsWith("Stage timed out");
    errorMsg = err instanceof Error ? err.message : String(err);
    loggerFn?.({ label: stage.label, timedOut, error: err });
  }

  const durationMs = Date.now() - start;

  // ── Field provenance metadata ───────────────────────────────────────────────
  let fieldMeta: EnrichmentFieldTrace | null = null;
  if (!errorMsg) {
    fieldMeta = {
      provider:    stage.label,
      source:      stageSource(stage.label),
      cacheStatus: "n/a",   // overridden by buildDecisionContext after return
      inputsUsed:  stageInputs(stage.label),
    };
  }

  return {
    trace: {
      label:       stage.label,
      durationMs,
      skipped:     false,
      output:      stageOutput,
      cacheSource: stageCacheSource,
      ...(errorMsg    ? { error: errorMsg } : {}),
      ...(wave !== undefined ? { wave } : {}),
    },
    output:    stageOutput,
    fieldMeta,
  };
}

// ── runStagedPipeline ─────────────────────────────────────────────────────────

/**
 * Execute `stages` in dependency order, running independent wave groups in
 * parallel and sequential stages one at a time.
 *
 * @param stages   — ordered list of `StagedEnricher` definitions
 * @param input    — original request signals shared by every stage
 * @param options  — optional timeout, logger, and initial accumulated output
 * @returns        — final merged output, per-stage trace, and field provenance
 */
export async function runStagedPipeline(
  stages:  StagedEnricher[],
  input:   EnricherInput,
  options: StagedPipelineOptions = {},
): Promise<StagedPipelineResult> {
  const { timeoutMs = 3_000, logger, initialAccumulated } = options;

  let accumulated: Partial<EnrichmentOutput> = initialAccumulated ? { ...initialAccumulated } : {};
  const trace: StageTrace[] = [];

  // ── Field-level provenance ────────────────────────────────────────────────
  const enrichmentTrace: EnrichmentTrace = {};

  // Seed provenance for any fields already in initialAccumulated (e.g. CDN-
  // header geo pre-pass run by buildDecisionContext before the staged pipeline).
  if (initialAccumulated) {
    const headersMeta: EnrichmentFieldTrace = {
      provider:   "geo:headers",
      source:     stageSource("geo:headers"),
      cacheStatus: "n/a",
      inputsUsed: stageInputs("geo:headers"),
    };
    for (const key of Object.keys(initialAccumulated) as (keyof EnrichmentOutput)[]) {
      const val = initialAccumulated[key];
      if (val !== null && val !== undefined) {
        (enrichmentTrace as Record<string, EnrichmentFieldTrace>)[key] = headersMeta;
      }
    }
  }

  // ── Partition into solo / wave groups ─────────────────────────────────────
  const groups = groupStages(stages);

  for (const group of groups) {
    // ── Sequential (solo) stage ─────────────────────────────────────────────
    if (group.kind === "solo") {
      const result = await runStage(
        group.stage, input, accumulated, timeoutMs, logger,
      );
      trace.push(result.trace);
      if (result.fieldMeta) {
        for (const key of Object.keys(result.output) as (keyof EnrichmentOutput)[]) {
          const val = result.output[key];
          if (val !== null && val !== undefined && result.fieldMeta) {
            (enrichmentTrace as Record<string, EnrichmentFieldTrace>)[key] = result.fieldMeta;
          }
        }
      }
      accumulated = mergeOutput(accumulated, result.output);
      continue;
    }

    // ── Parallel wave group ─────────────────────────────────────────────────
    //
    // Snapshot `accumulated` before the wave so all stages in the wave see
    // the same context (none can read another wave member's output).
    const waveSnapshot = { ...accumulated };

    const waveResults = await Promise.all(
      group.stages.map((stage) =>
        runStage(stage, input, waveSnapshot, timeoutMs, logger, group.wave),
      ),
    );

    // Merge all wave outputs in array order (deterministic; matches the
    // "last non-null wins" semantics of sequential runs).
    let waveAccumulated: Partial<EnrichmentOutput> = {};
    for (const result of waveResults) {
      trace.push(result.trace);
      if (result.fieldMeta) {
        for (const key of Object.keys(result.output) as (keyof EnrichmentOutput)[]) {
          const val = result.output[key];
          if (val !== null && val !== undefined && result.fieldMeta) {
            (enrichmentTrace as Record<string, EnrichmentFieldTrace>)[key] = result.fieldMeta;
          }
        }
      }
      waveAccumulated = mergeOutput(waveAccumulated, result.output);
    }

    accumulated = mergeOutput(accumulated, waveAccumulated);
  }

  return { output: accumulated, trace, enrichmentTrace };
}
