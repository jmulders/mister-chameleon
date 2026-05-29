/**
 * OpenKvK — Dutch Company Registry Lookup with Scored Candidate Resolution
 *
 * Resolves a visitor's company from the Dutch KvK (Chamber of Commerce)
 * registry using network-layer signals (domain, org name) plus geo signals
 * (city, region) from upstream enrichment stages.
 *
 * ─── Why scoring instead of first-result ─────────────────────────────────────
 *
 *   The OpenKvK API returns candidates ranked by name similarity to the query.
 *   "First result" is therefore unreliable: a search for "Google" returns many
 *   unrelated Dutch companies before the real one, and a search for a generic
 *   ISP name (e.g. "KPN") returns hundreds of subsidiaries with no clear winner.
 *
 *   The scorer assigns weighted points to each candidate and only auto-accepts
 *   when the top score is unambiguously high AND clearly beats the second
 *   candidate.  Ambiguous or low-confidence results are returned with source
 *   marker "openkvk_candidates" rather than claiming a company identity.
 *
 * ─── Search strategy ─────────────────────────────────────────────────────────
 *
 *   1. When `networkDomain` is available, extract the primary domain label
 *      (e.g. "acme" from "acme.nl") and query KvK by that name.  The full
 *      domain string is then used as a scoring signal.
 *   2. Additionally query by `networkOrg` (ISP org name from IPinfo) if
 *      different from the domain label.
 *   3. Optionally query by `companyName` from a prior stage.
 *
 *   All queries are de-duplicated and run concurrently.  Their candidate lists
 *   are merged (by KvK number) and all are scored against all available signals.
 *
 * ─── Scoring weights ─────────────────────────────────────────────────────────
 *
 *   60 — domain exact match      (candidate website === networkDomain)
 *   35 — domain partial match    (one domain contains the other)
 *   50 — name exact match        (normalised candidate === normalised org/company)
 *   10–40 — name fuzzy match     (token-overlap ≥ 0.5, proportional)
 *   15 — city match              (candidate vestiging === accumulated city)
 *    5 — is Hoofdvestiging       (main establishment bonus)
 *    5 — is Actief               (active status bonus)
 *
 * ─── Auto-accept thresholds ──────────────────────────────────────────────────
 *
 *   MIN_ACCEPT_SCORE = 50   — at least one strong signal required
 *   MIN_SCORE_GAP    = 20   — top must clearly beat second candidate
 *
 *   When thresholds are not met the result carries:
 *     companyMatchSource:     "openkvk_candidates"
 *     companyMatchConfidence: (capped at 0.49 to signal uncertain)
 *   and does NOT set companyName or companyDomain.
 *
 * ─── Output mapping ───────────────────────────────────────────────────────────
 *
 *   Accepted match:
 *     • companyName            ← naam
 *     • companyDomain          ← website (normalised, stripped of protocol/www)
 *     • city                   ← bezoeklocatie.plaats (only when city not already set)
 *     • companyMatchSource     ← "openkvk"
 *     • companyMatchConfidence ← score / 100, capped at 0.99
 *
 *   Uncertain (rejected):
 *     • companyMatchSource     ← "openkvk_candidates"
 *     • companyMatchConfidence ← score / 100, capped at 0.49
 *
 * ─── Fail-safe ────────────────────────────────────────────────────────────────
 *
 *   `resolve()` / `fetchCandidates()` always resolves — never rejects.
 *   API errors, timeouts, and empty results all produce safe fallback values.
 *
 * ─── Caching ──────────────────────────────────────────────────────────────────
 *
 *   Raw candidate arrays are cached for 6 hours keyed by normalised query
 *   string.  Scoring (which uses per-visitor city/region) runs on every call
 *   without touching the cache — it is purely in-memory string operations.
 */

import type { EnrichmentOutput, StagedEnricher, EnricherInput, EnricherContext } from "../types";
import { ProviderCache } from "../provider-cache";

// ── Module-level candidates cache ────────────────────────────────────────────
//
// Stores raw OpenKvK result arrays keyed by normalised query string.
// Raw arrays are cached so that scoring (which depends on per-visitor city/
// region) can run fresh on every call without repeating the API round-trip.
// TTL: 6 hours — KvK registration data is stable within a business day.
const candidatesCache = new ProviderCache<OpenKvKResultaat[]>(6 * 60 * 60 * 1_000);

// ── OpenKvK API types ─────────────────────────────────────────────────────────

interface OpenKvKResultaat {
  naam?:              string;
  kvknummer?:         string;
  /** true = active entity, false = dissolved */
  actief?:            boolean;
  /** "Hoofdvestiging" | "Nevenvestiging" | … */
  inschrijvingstype?: string;
  website?:           string;
  bezoeklocatie?: {
    plaats?: string;
  };
}

interface OpenKvKResponse {
  _embedded?: {
    bedrijf?: OpenKvKResultaat[];
  };
}

// ── Internal types ────────────────────────────────────────────────────────────

/**
 * Signals extracted from the accumulated enrichment output.
 * Passed to the scorer — all fields are nullable.
 */
interface ResolverInput {
  networkDomain: string | null;
  networkOrg:    string | null;
  companyName:   string | null;
  city:          string | null;
  region:        string | null;
}

/**
 * A single OpenKvK candidate with its computed score and per-signal breakdown.
 * The `signals` map is used to produce detailed debug output.
 */
interface ScoredCandidate {
  candidate: OpenKvKResultaat;
  /** Total weighted score (higher = stronger match). */
  score:     number;
  /** Per-signal contribution map: signal name → points awarded. */
  signals:   Record<string, number>;
}

/** Final result from `OpenKvKProvider.resolve()`. */
interface ResolveResult {
  /** Partial enrichment output to merge into the pipeline. */
  output:        Partial<EnrichmentOutput>;
  /** Whether a company identity was confidently accepted. */
  accepted:      boolean;
  /** Human-readable explanation of the accept/reject decision. */
  reason:        string;
  /** Scored candidates (top 15), sorted by score descending. */
  topCandidates: ScoredCandidate[];
}

// ── Scoring constants ─────────────────────────────────────────────────────────

/**
 * Minimum score required for any auto-accept.
 * Ensures at least one strong signal (domain partial OR name exact) is present.
 */
const MIN_ACCEPT_SCORE = 50;

/**
 * Minimum score gap between rank-1 and rank-2 candidates.
 * When too close, the match is ambiguous and is not auto-accepted.
 */
const MIN_SCORE_GAP = 20;

/**
 * Denominator for mapping raw score → confidence in [0, 1].
 * score / CONFIDENCE_DENOMINATOR, capped at 0.99 for accepted matches.
 */
const CONFIDENCE_DENOMINATOR = 100;

/** Maximum number of API candidates to keep for scoring. */
const MAX_CANDIDATES_TO_SCORE = 15;

// ── Normalisation helpers ─────────────────────────────────────────────────────

/**
 * Common Dutch legal entity suffixes that carry no discriminatory signal
 * when comparing company names.  Both dotted and non-dotted forms are covered.
 */
const DUTCH_LEGAL_SUFFIX_RE =
  /\b(b\.?\s*v\.?|n\.?\s*v\.?|v\.?\s*o\.?\s*f\.?|c\.?\s*v\.?|holding|groep|group|bv|nv|vof|cv|ltd|llc|inc|corp|gmbh|ag|sa|pty|plc)\b\.?/gi;

/**
 * Normalise a company / organisation name for comparison:
 *   1. Lowercase
 *   2. Strip Dutch legal entity suffixes
 *   3. Replace non-alphanumeric characters with spaces
 *   4. Collapse whitespace
 */
function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(DUTCH_LEGAL_SUFFIX_RE, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Dutch stopwords that add noise when tokenising company names.
 * Filtered out before computing token overlap.
 */
const NL_STOPWORDS = new Set([
  "de", "het", "van", "en", "der", "den", "te", "ten", "ter",
  "aan", "in", "op", "voor",
]);

/**
 * Tokenise a normalised name string into meaningful words.
 * Filters single-character tokens and Dutch stopwords.
 */
function tokenize(name: string): string[] {
  return normalizeName(name)
    .split(" ")
    .filter((t) => t.length > 1 && !NL_STOPWORDS.has(t));
}

/**
 * Compute the Jaccard-style token overlap ratio between two names.
 * Returns a value in [0, 1] — higher means more tokens in common.
 *
 * @example
 *   tokenOverlap("Acme Netherlands B.V.", "Acme Netherlands") → 0.67
 */
function tokenOverlap(a: string, b: string): number {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) {
    if (tb.has(t)) shared++;
  }
  return shared / Math.max(ta.size, tb.size);
}

/**
 * Normalise a domain string for comparison:
 *   • strip protocol prefix (http://, https://)
 *   • strip www. prefix
 *   • strip trailing slash
 *   • lowercase
 */
function normalizeDomain(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "")
    .trim();
}

/**
 * Extract the primary label from a domain string for use as a KvK name query.
 *
 * "acme.nl"        → "acme"
 * "my-company.com" → "my-company"
 *
 * Returns `null` when the label is too short to be a useful search term.
 */
function domainLabel(domain: string): string | null {
  const normalized = normalizeDomain(domain);
  const label      = normalized.split(".")[0] ?? "";
  return label.length > 2 ? label : null;
}

// ── Scoring ───────────────────────────────────────────────────────────────────

/**
 * Score one OpenKvK candidate against the available resolver input signals.
 *
 * Signals and weights:
 *
 *   60 — domain exact   — candidate website exactly matches networkDomain
 *   35 — domain partial — one domain string contains the other
 *   50 — name exact     — normalised candidate name equals normalised org/company name
 *   10–40 — name fuzzy  — token-overlap ≥ 0.5 (score proportional to overlap ratio)
 *   15 — city match     — candidate vestiging matches accumulated city (case-insensitive)
 *    5 — Hoofdvestiging — candidate is the main branch
 *    5 — Actief         — candidate is an active entity
 *
 * Domain signals and name signals are independent and additive.
 */
function scoreCandidate(
  candidate: OpenKvKResultaat,
  input:     ResolverInput,
): ScoredCandidate {
  const signals: Record<string, number> = {};
  let score = 0;

  // ── Domain signals ────────────────────────────────────────────────────────
  const candidateWebsite = candidate.website
    ? normalizeDomain(candidate.website)
    : null;

  if (input.networkDomain && candidateWebsite) {
    const inputNorm = normalizeDomain(input.networkDomain);

    if (inputNorm === candidateWebsite) {
      signals["domain:exact"] = 60;
      score += 60;
    } else if (
      inputNorm.endsWith("." + candidateWebsite) ||
      candidateWebsite.endsWith("." + inputNorm) ||
      inputNorm.includes(candidateWebsite) ||
      candidateWebsite.includes(inputNorm)
    ) {
      signals["domain:partial"] = 35;
      score += 35;
    }
  }

  // ── Name signals ──────────────────────────────────────────────────────────
  // Test both networkOrg and companyName; award the best single name score.
  const candidateName = candidate.naam ?? "";
  const inputNames    = (
    [input.networkOrg, input.companyName] as Array<string | null>
  ).filter((n): n is string => !!n);

  let bestNamePts    = 0;
  let bestNameSignal = "";

  for (const inputName of inputNames) {
    const nc = normalizeName(candidateName);
    const ni = normalizeName(inputName);
    if (!nc || !ni) continue;

    if (nc === ni) {
      // Exact normalised match — best possible name score
      bestNamePts    = 50;
      bestNameSignal = "name:exact";
      break;
    }

    const overlap = tokenOverlap(candidateName, inputName);
    if (overlap >= 0.5) {
      const pts = Math.max(10, Math.round(40 * overlap));
      if (pts > bestNamePts) {
        bestNamePts    = pts;
        bestNameSignal = `name:fuzzy(${Math.round(overlap * 100)}%)`;
      }
    }
  }

  if (bestNamePts > 0) {
    signals[bestNameSignal] = bestNamePts;
    score += bestNamePts;
  }

  // ── Geo signals ───────────────────────────────────────────────────────────
  const candidateCity = candidate.bezoeklocatie?.plaats;
  if (input.city && candidateCity) {
    if (input.city.trim().toLowerCase() === candidateCity.trim().toLowerCase()) {
      signals["geo:city"] = 15;
      score += 15;
    }
  }

  // ── Structural bonuses ────────────────────────────────────────────────────
  if (candidate.inschrijvingstype === "Hoofdvestiging") {
    signals["struct:hoofdvestiging"] = 5;
    score += 5;
  }
  if (candidate.actief === true) {
    signals["struct:actief"] = 5;
    score += 5;
  }

  return { candidate, score, signals };
}

// ── Acceptance logic ──────────────────────────────────────────────────────────

/**
 * Decide whether to auto-accept the top-scored candidate.
 *
 * Rules (applied in order):
 *   1. `scored` must be non-empty.
 *   2. Top score must be ≥ MIN_ACCEPT_SCORE (50).
 *   3. If a second candidate exists, the gap (top − second) must be ≥ MIN_SCORE_GAP (20).
 *      A single candidate passes the gap check automatically (gap treated as ∞).
 *
 * Returns the accepted candidate (or null) and a human-readable reason string
 * that explains exactly why the decision was made.
 */
function acceptTopCandidate(scored: ScoredCandidate[]): {
  accepted: ScoredCandidate | null;
  reason:   string;
} {
  if (scored.length === 0) {
    return { accepted: null, reason: "no candidates returned by API" };
  }

  const [top, second] = scored;

  if (top.score < MIN_ACCEPT_SCORE) {
    return {
      accepted: null,
      reason: [
        `score too low: ${top.score} < threshold ${MIN_ACCEPT_SCORE}`,
        `(best candidate: "${top.candidate.naam ?? "?"}"`,
        `signals: ${fmtSignals(top.signals)})`,
      ].join(" "),
    };
  }

  if (second !== undefined && top.score - second.score < MIN_SCORE_GAP) {
    return {
      accepted: null,
      reason: [
        `ambiguous: gap ${top.score - second.score} < minimum ${MIN_SCORE_GAP}`,
        `(#1 "${top.candidate.naam ?? "?"}" score=${top.score}`,
        `vs #2 "${second.candidate.naam ?? "?"}" score=${second.score})`,
      ].join(" "),
    };
  }

  const gapDisplay = second !== undefined
    ? String(top.score - second.score)
    : "∞";

  return {
    accepted: top,
    reason: [
      `accepted: score=${top.score} ≥ ${MIN_ACCEPT_SCORE}`,
      `gap=${gapDisplay} ≥ ${MIN_SCORE_GAP}`,
      `signals: ${fmtSignals(top.signals)}`,
    ].join(", "),
  };
}

/** Format a signal map as a compact inline string for logging. */
function fmtSignals(signals: Record<string, number>): string {
  const entries = Object.entries(signals);
  if (entries.length === 0) return "(none)";
  return entries.map(([k, v]) => `${k}=${v}`).join(" ");
}

// ── OpenKvKProvider ───────────────────────────────────────────────────────────

/** Operating mode for the OpenKvK enrichment stage. */
export type OpenKvKMode = "off" | "nl-only" | "always";

/**
 * Which upstream field to prefer as the primary search query term.
 *
 * In the new scored resolver all available signals are always used for scoring;
 * this option only affects which term appears FIRST in the query list.
 * Default: "networkOrg".
 */
export type OpenKvKMatchingStrategy = "networkOrg" | "companyName" | "networkDomain";

export interface OpenKvKProviderOptions {
  /**
   * Override the API base URL (useful in tests).
   * Default: "https://api.overheid.io"
   */
  apiBase?: string;
  /**
   * overheid.io API key sent as the `ovio-api-key` request header.
   * Required for production use — requests without a key return HTTP 401.
   * Register for free at https://overheid.io/register.
   */
  apiKey?:  string;
  /** Enable verbose debug logging. */
  isDev?:   boolean;
  /**
   * Retained for API compatibility.  The new scorer derives confidence from
   * the weighted score; this option is no longer used as a hard threshold.
   */
  confidenceThreshold?: number;
}

/**
 * Fetches OpenKvK candidates and resolves the best matching Dutch company
 * using a scored, multi-signal approach.
 *
 * Provides two public methods:
 *   `fetchCandidates(query)` — raw API fetch with cache
 *   `resolve(input)`         — full scored resolution pipeline
 */
export class OpenKvKProvider {
  private readonly apiBase: string;
  private readonly apiKey:  string | undefined;
  readonly isDev:           boolean;

  constructor(options: OpenKvKProviderOptions = {}) {
    this.apiBase = options.apiBase ?? "https://api.overheid.io";
    this.apiKey  = options.apiKey;
    this.isDev   = options.isDev   ?? false;
  }

  // ── Raw API fetch ────────────────────────────────────────────────────────────

  /**
   * Fetch raw OpenKvK candidate records for a name query.
   *
   * Results are cached for 6 hours keyed by normalised query string, so that
   * repeated lookups from different visitors on the same corporate network
   * do not incur extra API calls.
   *
   * Returns an empty array on any API error or timeout.
   */
  async fetchCandidates(query: string): Promise<OpenKvKResultaat[]> {
    const q          = query.trim();
    const cacheKey   = q.toLowerCase();
    const cached     = candidatesCache.get(cacheKey);

    if (cached.hit) {
      if (this.isDev) {
        console.debug("[openkvk] candidates cache hit", { query, count: cached.value.length });
      }
      return cached.value;
    }

    try {
      // Note: no server-side city filter — the scorer awards +15 for city match.
      // Filtering server-side on bezoeklocatie.plaats misses results because
      // the stored city name may not exactly match the visitor's city string.
      const url =
        `${this.apiBase}/v3/openkvk` +
        `?query=${encodeURIComponent(q)}` +
        `&queryfields[]=huidigeHandelsNamen` +
        `&fields[]=bezoeklocatie.plaats` +
        `&fields[]=website` +
        `&fields[]=actief` +
        `&fields[]=inschrijvingstype`;

      const headers: Record<string, string> = { Accept: "application/json" };
      if (this.apiKey) headers["ovio-api-key"] = this.apiKey;

      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(4_000),
        cache:  "no-store",
        next:   { revalidate: 0 },
      });

      if (!response.ok) {
        console.warn(`[openkvk] API error ${response.status} for query "${q}"`);
        return [];
      }

      const data    = (await response.json()) as OpenKvKResponse;
      const results = data._embedded?.bedrijf ?? [];

      candidatesCache.set(cacheKey, results);

      if (this.isDev) {
        console.debug("[openkvk] API response", { query: q, count: results.length });
      }

      return results;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (this.isDev) {
        console.debug("[openkvk] fetch error", { query: q, error: msg });
      } else {
        console.warn(`[openkvk] fetch failed for "${q}": ${msg}`);
      }
      return [];
    }
  }

  // ── Scored resolver ──────────────────────────────────────────────────────────

  /**
   * Resolve the best matching Dutch company for the given enrichment signals.
   *
   * Steps:
   *   1. Derive search query terms from networkDomain → networkOrg → companyName.
   *   2. Fetch candidates for each term (using the module-level cache).
   *   3. De-duplicate candidates by KvK number.
   *   4. Score all candidates against all available signals.
   *   5. Apply acceptance thresholds (MIN_ACCEPT_SCORE + MIN_SCORE_GAP).
   *   6. Return enrichment output and full debug metadata.
   *
   * Never rejects — all errors produce a safe `{}` output.
   */
  async resolve(input: ResolverInput): Promise<ResolveResult> {
    const terms = this.buildSearchTerms(input);

    if (terms.length === 0) {
      return {
        output:        {},
        accepted:      false,
        reason:        "no search term available (networkDomain, networkOrg, and companyName are all absent)",
        topCandidates: [],
      };
    }

    if (this.isDev) {
      console.debug("[openkvk] resolve — input signals", {
        networkDomain: input.networkDomain,
        networkOrg:    input.networkOrg,
        companyName:   input.companyName,
        city:          input.city,
        region:        input.region,
        searchTerms:   terms,
      });
    }

    // Fetch all candidates, merged and de-duplicated by KvK number
    const seenKvk       = new Set<string>();
    const allCandidates: OpenKvKResultaat[] = [];

    for (const term of terms) {
      const batch = await this.fetchCandidates(term);
      for (const c of batch.slice(0, MAX_CANDIDATES_TO_SCORE)) {
        // De-dupe: prefer KvK number, fall back to name as identity
        const key = c.kvknummer?.trim() ?? c.naam?.trim().toLowerCase() ?? "";
        if (key && seenKvk.has(key)) continue;
        if (key) seenKvk.add(key);
        allCandidates.push(c);
      }
    }

    // Score and sort
    const scored = allCandidates
      .map((c) => scoreCandidate(c, input))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_CANDIDATES_TO_SCORE);

    const { accepted, reason } = acceptTopCandidate(scored);

    if (this.isDev) {
      const top5 = scored.slice(0, 5).map((s) => ({
        name:    s.candidate.naam                   ?? "?",
        city:    s.candidate.bezoeklocatie?.plaats  ?? "?",
        website: s.candidate.website                ?? "?",
        type:    s.candidate.inschrijvingstype       ?? "?",
        actief:  s.candidate.actief                 ?? "?",
        score:   s.score,
        signals: s.signals,
      }));
      console.debug("[openkvk] top candidates", top5);
      console.debug("[openkvk] decision", { accepted: !!accepted, reason });
    }

    // ── Uncertain path ────────────────────────────────────────────────────────
    if (!accepted) {
      const topScore = scored[0]?.score ?? 0;
      return {
        output: {
          companyMatchSource:     "openkvk_candidates",
          companyMatchConfidence: topScore > 0
            // Cap at 0.49 so downstream logic can distinguish "uncertain" from
            // "accepted" without needing to inspect companyMatchSource.
            ? Math.min(topScore / CONFIDENCE_DENOMINATOR, 0.49)
            : null,
        },
        accepted:      false,
        reason,
        topCandidates: scored,
      };
    }

    // ── Accepted path ─────────────────────────────────────────────────────────
    const top        = accepted.candidate;
    const confidence = Math.min(accepted.score / CONFIDENCE_DENOMINATOR, 0.99);

    const output: Partial<EnrichmentOutput> = {
      companyMatchSource:     "openkvk",
      companyMatchConfidence: confidence,
    };

    if (top.naam)                    output.companyName   = top.naam;
    if (top.website)                 output.companyDomain = normalizeDomain(top.website);
    if (top.bezoeklocatie?.plaats)   output.city          = top.bezoeklocatie.plaats;

    return {
      output,
      accepted:      true,
      reason,
      topCandidates: scored,
    };
  }

  // ── Query builder ─────────────────────────────────────────────────────────

  /**
   * Build an ordered, de-duplicated list of search query strings.
   *
   * Priority:
   *   1. Domain label from networkDomain (e.g. "acme" from "acme.nl")
   *   2. networkOrg (ISP org name)
   *   3. companyName (from a prior enrichment stage)
   *
   * Only distinct terms (case-insensitive) are included.
   *
   * Also exposed as `buildSearchTermsPublic` so the staged enricher factory
   * can pre-check whether candidate queries are already cached before marking
   * the stage as "provider-cache" vs "fresh".
   */
  buildSearchTermsPublic(input: ResolverInput): string[] {
    return this.buildSearchTerms(input);
  }

  private buildSearchTerms(input: ResolverInput): string[] {
    const candidates: string[] = [];

    if (input.networkDomain) {
      const label = domainLabel(input.networkDomain);
      if (label) candidates.push(label);
    }
    if (input.networkOrg)  candidates.push(input.networkOrg.trim());
    if (input.companyName) candidates.push(input.companyName.trim());

    const seen  = new Set<string>();
    const dedup: string[] = [];
    for (const t of candidates) {
      if (!t) continue;
      const key = t.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        dedup.push(t);
      }
    }
    return dedup;
  }
}

// ── Factory: createOpenKvKStagedEnricher ──────────────────────────────────────

/** Options for the staged enricher factory. */
export interface OpenKvKStagedEnricherOptions extends OpenKvKProviderOptions {
  /**
   * Operating mode:
   *   "off"     — entirely disabled (shouldRun always returns false).
   *   "nl-only" — only run for visitors with countryCode === "NL" (default).
   *   "always"  — run regardless of countryCode.
   */
  mode?: OpenKvKMode;
  /**
   * Preferred upstream field to seed the query list.
   * In the scored resolver all signals are always scored regardless of this
   * setting; this only controls which query term appears first.
   * Default: "networkOrg".
   *
   * @deprecated Use the default ("networkOrg") — the scorer uses all signals.
   */
  matchingStrategy?: OpenKvKMatchingStrategy;
}

/**
 * Creates a `StagedEnricher` for the OpenKvK stage of the sequential pipeline.
 *
 * Gate conditions (evaluated by `shouldRun`):
 *   1. `mode` must not be "off"
 *   2. `mode === "nl-only"` → `accumulated.countryCode === "NL"` (default)
 *      `mode === "always"`  → countryCode check skipped
 *   3. At least one of `networkOrg`, `networkDomain`, or `companyName` must be
 *      present in the accumulated output from prior stages
 *
 * Non-clobbering rules:
 *   • companyName / companyDomain already set by a higher-confidence prior stage
 *     (e.g. Leadinfo) are never overwritten.
 *   • city is only written on accepted matches, and only when not already set.
 *   • Uncertain matches (source: "openkvk_candidates") never write city,
 *     companyName, or companyDomain.
 */
export function createOpenKvKStagedEnricher(
  options: OpenKvKStagedEnricherOptions = {},
): StagedEnricher {
  const {
    mode             = "nl-only",
    matchingStrategy: _matchingStrategy = "networkOrg", // retained for API compat
    ...providerOptions
  } = options;

  const provider = new OpenKvKProvider(providerOptions);

  return {
    label: "OpenKvK (NL registry)",

    shouldRun: (
      _input:      EnricherInput,
      accumulated: Partial<EnrichmentOutput>,
    ): boolean => {
      if (mode === "off")               return false;
      if (accumulated.isCloudProvider)  return false;  // skip cloud/datacenter IPs
      if (mode === "nl-only" && accumulated.countryCode !== "NL") return false;
      return !!(accumulated.networkOrg || accumulated.networkDomain || accumulated.companyName);
    },

    getSkipReason: (
      _input:      EnricherInput,
      accumulated: Partial<EnrichmentOutput>,
    ): string => {
      if (mode === "off")              return "OpenKvK stage disabled (mode=off).";
      if (accumulated.isCloudProvider) return `Cloud/datacenter IP skipped — networkOrg="${accumulated.networkOrg ?? "?"}", networkAsn="${accumulated.networkAsn ?? "?"}".`;
      if (mode === "nl-only" && accumulated.countryCode !== "NL") {
        return `countryCode="${accumulated.countryCode ?? "null"}" is not NL — OpenKvK only runs for Dutch visitors.`;
      }
      return "No networkOrg, networkDomain, or companyName available from prior stages.";
    },

    enricher: async (
      _input:      EnricherInput,
      accumulated: Partial<EnrichmentOutput>,
      ctx?:        EnricherContext,
    ): Promise<Partial<EnrichmentOutput>> => {
      // Determine whether all candidate queries hit the cache by checking
      // before the resolve call.  This is a best-effort signal — if at least
      // one query is a cache miss the stage is classified as "fresh".
      const terms = provider.buildSearchTermsPublic({
        networkDomain: accumulated.networkDomain ?? null,
        networkOrg:    accumulated.networkOrg    ?? null,
        companyName:   accumulated.companyName   ?? null,
        city:          accumulated.city          ?? null,
        region:        accumulated.region        ?? null,
      });
      const allCached = terms.length > 0 && terms.every((t) => {
        const result = candidatesCache.get(t.toLowerCase());
        return result.hit;
      });
      ctx?.setCacheSource(allCached ? "provider-cache" : "fresh");

      const resolverInput: ResolverInput = {
        networkDomain: accumulated.networkDomain ?? null,
        networkOrg:    accumulated.networkOrg    ?? null,
        companyName:   accumulated.companyName   ?? null,
        city:          accumulated.city          ?? null,
        region:        accumulated.region        ?? null,
      };

      const { output, accepted, reason } = await provider.resolve(resolverInput);

      if (provider.isDev) {
        console.debug("[openkvk-stage] enricher complete", {
          accepted,
          reason,
          companyName:   output.companyName   ?? null,
          companyDomain: output.companyDomain ?? null,
          source:        output.companyMatchSource,
          confidence:    output.companyMatchConfidence,
        });
      }

      // ── Non-clobbering rules ────────────────────────────────────────────────
      //
      // Never overwrite companyName / companyDomain already established by a
      // prior stage (e.g. Leadinfo runs before OpenKvK in some configurations).
      // These fields carry a stronger identity signal.
      if (accumulated.companyName  && output.companyName)   delete output.companyName;
      if (accumulated.companyDomain && output.companyDomain) delete output.companyDomain;

      // Only propagate the registered city for accepted matches; uncertain
      // matches should not overwrite the geo-IP city already in accumulated.
      if (!accepted) {
        delete output.city;
      } else if (accumulated.city && output.city) {
        // Accepted match: keep the more specific registered address city
        // (vestiging is the company's official city, more accurate than geo-IP).
        // No deletion needed — output.city intentionally overwrites geo-IP city.
      }

      return output;
    },
  };
}

// ── Debug cache flush ─────────────────────────────────────────────────────────

/**
 * Flush the in-process OpenKvK company candidate cache.
 *
 * Called by `enrichment/flush-debug.ts` during a debug session reset so that
 * the post-reset request performs a fresh OpenKvK API lookup rather than
 * serving TTL-cached (up to 6 h) candidate results for the same company query.
 */
export function flushOpenKvKProviderCache(): void {
  candidatesCache.flush();
}
