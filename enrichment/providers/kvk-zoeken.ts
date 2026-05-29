/**
 * KvK Zoeken — Official Dutch Chamber of Commerce Search API
 *
 * Enrichment stage that searches the official KvK (Kamer van Koophandel) Zoeken API
 * at api.kvk.nl to identify Dutch companies by name.
 *
 * ─── API details ──────────────────────────────────────────────────────────────
 *
 *   Test URL:    https://api.kvk.nl/test/api/v2/zoeken
 *   Prod URL:    https://api.kvk.nl/api/v2/zoeken
 *   Auth:        apikey: {key}  (request header)
 *   Pricing:     Zoeken is free (€0/query). Subscription €6.40/month.
 *   Register at: https://developers.kvk.nl
 *
 * ─── Scoring ──────────────────────────────────────────────────────────────────
 *
 *   Name match:          normalised token overlap (0–1)
 *   City bonus:          +0.2 when candidate city matches accumulated city
 *   Hoofdvestiging bonus: +0.1 when type === "hoofdvestiging"
 *   Accept threshold:    score > 0.5 (name overlap ≥ 50% OR city match pushes above)
 *
 * ─── Caching ──────────────────────────────────────────────────────────────────
 *
 *   Raw result arrays are cached for 30 min keyed by normalised query string.
 *   Scoring (which uses per-visitor city) runs fresh on every call.
 */

import type {
  EnrichmentOutput,
  StagedEnricher,
  EnricherInput,
  EnricherContext,
} from "../types";
import { ProviderCache } from "../provider-cache";

// ── Module-level candidates cache ────────────────────────────────────────────
//
// TTL: 30 minutes — KvK registration data is stable within a session.
const candidatesCache = new ProviderCache<KvkZoekenResultaat[]>(30 * 60 * 1_000);

// ── KvK Zoeken API types ──────────────────────────────────────────────────────

interface KvkZoekenBinnenlandsAdres {
  type?:       string;
  straatnaam?: string;
  huisnummer?: number;
  postcode?:   string;
  plaats?:     string;
}

interface KvkZoekenAdres {
  binnenlandsAdres?: KvkZoekenBinnenlandsAdres;
}

interface KvkZoekenResultaat {
  kvkNummer?:        string;
  naam?:             string;
  /** "hoofdvestiging" | "nevenvestiging" | "rechtspersoon" */
  type?:             string;
  vestigingsnummer?: string;
  adres?:            KvkZoekenAdres;
}

interface KvkZoekenResponse {
  pagina?:              number;
  resultatenPerPagina?: number;
  totaal?:              number;
  resultaten?:          KvkZoekenResultaat[];
}

// ── Options ───────────────────────────────────────────────────────────────────

/**
 * Free test key provided by KvK for integration testing.
 * Mapped to the test base URL automatically when this key is used.
 */
export const KVK_TEST_API_KEY = "l7xx1f2691f2520d487b902f4e0b57a0b197";
const KVK_PROD_BASE_URL = "https://api.kvk.nl/api/v2";
const KVK_TEST_BASE_URL = "https://api.kvk.nl/test/api/v2";

export interface KvkZoekenStagedEnricherOptions {
  /**
   * KvK API key (header: apikey).
   * When absent or equal to the test key, the test base URL is used.
   * Obtain a subscription key at https://developers.kvk.nl.
   */
  apiKey?: string;
  /**
   * Override API base URL (useful in tests).
   * Defaults to test URL when using the test key, prod URL otherwise.
   */
  apiBase?: string;
  /** Enable verbose debug logging. */
  isDev?: boolean;
  /**
   * Cache TTL in milliseconds for raw candidate arrays.
   * Default: 30 minutes.
   */
  cacheTtlMs?: number;
}

// ── Scoring helpers ───────────────────────────────────────────────────────────

/**
 * Normalise a company name for token-based comparison:
 *   - lowercase
 *   - strip common legal suffixes (B.V., N.V., etc.)
 *   - split into word tokens
 */
function normaliseTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/\b(b\.?v\.?|n\.?v\.?|v\.?o\.?f\.?|bv|nv|vof|cv|inc\.?|ltd\.?|s\.a\.?|gmbh)\.?\b/gi, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Jaccard-like token overlap score: |A ∩ B| / |A ∪ B|.
 * Returns 0 when either set is empty.
 */
function tokenOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Extract city from a KvK result's adres field.
 */
function extractCity(r: KvkZoekenResultaat): string | null {
  return r.adres?.binnenlandsAdres?.plaats ?? null;
}

/**
 * Compute a composite score for a candidate against the query signals.
 *
 * Returns a number in [0, 1+]:
 *   - base:             token overlap between candidate name and query term (0–1)
 *   - city bonus:       +0.2 when candidate city matches accumulated.city (case-insensitive)
 *   - hoofdvestiging:   +0.1 when type === "hoofdvestiging"
 */
function scoreCandidate(
  candidate: KvkZoekenResultaat,
  queryTokens: string[],
  city: string | null,
): number {
  const candName = candidate.naam ?? "";
  if (!candName) return 0;

  const candTokens = normaliseTokens(candName);
  let score = tokenOverlap(queryTokens, candTokens);

  // City match bonus
  if (city && extractCity(candidate)) {
    const candCity = (extractCity(candidate) ?? "").toLowerCase();
    const refCity  = city.toLowerCase();
    if (candCity === refCity || candCity.includes(refCity) || refCity.includes(candCity)) {
      score += 0.2;
    }
  }

  // Hoofdvestiging bonus
  if ((candidate.type ?? "").toLowerCase() === "hoofdvestiging") {
    score += 0.1;
  }

  return score;
}

const ACCEPT_THRESHOLD = 0.5;

// ── Raw API fetch ─────────────────────────────────────────────────────────────

/**
 * Fetch candidates from the KvK Zoeken API for a given name query.
 * Returns empty array on any error or timeout.
 * Uses the module-level cache.
 */
async function fetchKvkCandidates(
  naam:    string,
  apiKey:  string,
  apiBase: string,
  city?:   string | null,
  isDev?:  boolean,
): Promise<KvkZoekenResultaat[]> {
  const q        = naam.trim();
  if (!q) return [];

  const cacheKey = `${q.toLowerCase()}${city ? `|${city.toLowerCase()}` : ""}`;
  const cached   = candidatesCache.get(cacheKey);

  if (cached.hit) {
    if (isDev) console.debug("[kvk-zoeken] candidates cache hit", { naam, count: cached.value.length });
    return cached.value;
  }

  try {
    const url = new URL(`${apiBase}/zoeken`);
    url.searchParams.set("naam", q);
    url.searchParams.set("resultatenPerPagina", "10");
    if (city) url.searchParams.set("plaats", city);

    const response = await fetch(url.toString(), {
      headers: {
        Accept:  "application/json",
        apikey:  apiKey,
      },
      signal: AbortSignal.timeout(6_000),
      cache:  "no-store",
    });

    if (!response.ok) {
      if (isDev) console.debug("[kvk-zoeken] API error", { status: response.status, naam });
      candidatesCache.set(cacheKey, []);
      return [];
    }

    const data = (await response.json()) as KvkZoekenResponse;
    const results = data.resultaten ?? [];

    if (isDev) console.debug("[kvk-zoeken] fetch", { naam, city, count: results.length });

    candidatesCache.set(cacheKey, results);
    return results;

  } catch (err) {
    if (isDev) console.debug("[kvk-zoeken] fetch error", { naam, err });
    return [];
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Creates a `StagedEnricher` for the KvK Zoeken stage.
 *
 * Gate conditions (evaluated by `shouldRun`):
 *   1. `apiKey` must be configured
 *   2. `accumulated.isCloudProvider` must not be true
 *   3. At least one of `networkOrg`, `networkDomain`, or `companyName` must be present
 *
 * Non-clobbering rules:
 *   • `companyName` already set by a higher-confidence prior stage is never overwritten.
 *   • `city` is only written when not already present in accumulated output.
 *
 * On accept writes:
 *   • `companyName`           (only when not already set)
 *   • `city`                  (only when not already set)
 *   • `companyMatchSource`    = "kvk_zoeken"
 *   • `companyMatchConfidence`
 */
export function createKvkZoekenStagedEnricher(
  options: KvkZoekenStagedEnricherOptions = {},
): StagedEnricher {
  const {
    apiKey,
    apiBase: apiBaseOverride,
    isDev = false,
  } = options;

  // Determine the effective base URL:
  //   - explicit override wins
  //   - test key → test URL
  //   - otherwise → prod URL
  const apiBase =
    apiBaseOverride ??
    (!apiKey || apiKey === KVK_TEST_API_KEY ? KVK_TEST_BASE_URL : KVK_PROD_BASE_URL);

  return {
    label: "KvK Zoeken (officieel kvk.nl)",

    shouldRun: (
      _input:      EnricherInput,
      accumulated: Partial<EnrichmentOutput>,
    ): boolean => {
      if (!apiKey)                        return false;
      if (accumulated.isCloudProvider)    return false;
      return !!(accumulated.networkOrg || accumulated.networkDomain || accumulated.companyName);
    },

    getSkipReason: (
      _input:      EnricherInput,
      accumulated: Partial<EnrichmentOutput>,
    ): string => {
      if (!apiKey) return "KvK Zoeken API key not configured.";
      if (accumulated.isCloudProvider) {
        return `Cloud/datacenter IP skipped — networkOrg="${accumulated.networkOrg ?? "?"}".`;
      }
      return "No networkOrg, networkDomain, or companyName available from prior stages.";
    },

    enricher: async (
      _input:      EnricherInput,
      accumulated: Partial<EnrichmentOutput>,
      ctx?:        EnricherContext,
    ): Promise<Partial<EnrichmentOutput>> => {
      if (!apiKey) return {};

      try {
        const city = accumulated.city ?? null;

        // ── Build deduplicated search terms ──────────────────────────────────
        //
        // Priority: networkOrg → domain label from networkDomain → companyName
        // Domain label: strip TLD, e.g. "acme.nl" → "acme"

        const rawTerms: string[] = [];

        if (accumulated.networkOrg) {
          rawTerms.push(accumulated.networkOrg);
        }
        if (accumulated.networkDomain) {
          // Extract label from domain, e.g. "acme.nl" → "acme"
          const label = accumulated.networkDomain.replace(/\.[^.]+$/, "").trim();
          if (label && label !== accumulated.networkOrg) rawTerms.push(label);
        }
        if (accumulated.companyName) {
          if (!rawTerms.includes(accumulated.companyName)) {
            rawTerms.push(accumulated.companyName);
          }
        }

        // Deduplicate (case-insensitive)
        const seen   = new Set<string>();
        const terms: string[] = [];
        for (const t of rawTerms) {
          const key = t.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            terms.push(t);
          }
        }

        if (terms.length === 0) return {};

        // ── Suffix-strip helper ───────────────────────────────────────────────
        function stripSuffix(s: string): string {
          return s
            .replace(/\s+(B\.?V\.?|N\.?V\.?|V\.?O\.?F\.?|BV|NV|VOF|CV|Inc\.?|Ltd\.?|S\.A\.?|GmbH)\.?\s*$/i, "")
            .trim();
        }

        // ── Collect all candidates ────────────────────────────────────────────
        //
        // For each search term:
        //   1. Exact search (no city)
        //   2. With city hint (if available)
        //   3. Suffix-stripped term (if different)

        const allCandidates: KvkZoekenResultaat[] = [];
        const fetchedTerms = new Set<string>();

        async function fetchTerm(naam: string, withCity?: string | null): Promise<void> {
          const key = `${naam.toLowerCase()}|${withCity?.toLowerCase() ?? ""}`;
          if (fetchedTerms.has(key)) return;
          fetchedTerms.add(key);
          const results = await fetchKvkCandidates(naam, apiKey!, apiBase, withCity, isDev);
          for (const r of results) allCandidates.push(r);
        }

        for (const term of terms) {
          await fetchTerm(term);
          if (city) await fetchTerm(term, city);
          const stripped = stripSuffix(term);
          if (stripped && stripped !== term) {
            await fetchTerm(stripped);
            if (city) await fetchTerm(stripped, city);
          }
        }

        if (allCandidates.length === 0) {
          ctx?.setCacheSource("fresh");
          return {};
        }

        // ── Score all candidates ──────────────────────────────────────────────
        //
        // Use the first search term's tokens as the primary query signal
        // (it has the highest priority).

        const primaryTokens = normaliseTokens(terms[0]);

        interface Scored { candidate: KvkZoekenResultaat; score: number; }
        const scored: Scored[] = allCandidates
          .filter((c) => c.naam)
          .map((c) => ({ candidate: c, score: scoreCandidate(c, primaryTokens, city) }))
          .sort((a, b) => b.score - a.score);

        const best = scored[0];

        if (isDev) {
          console.debug("[kvk-zoeken] top candidates", scored.slice(0, 5).map((s) => ({
            naam:  s.candidate.naam,
            type:  s.candidate.type,
            score: s.score.toFixed(2),
          })));
        }

        if (!best || best.score <= ACCEPT_THRESHOLD) {
          ctx?.setCacheSource("fresh");
          if (isDev) console.debug("[kvk-zoeken] no accept", { threshold: ACCEPT_THRESHOLD, best: best?.score });
          return {};
        }

        // ── Build output ──────────────────────────────────────────────────────

        const output: Partial<EnrichmentOutput> = {
          companyMatchSource:     "kvk_zoeken",
          companyMatchConfidence: Math.min(1, best.score),
        };

        // Only write companyName when not already set by a prior stage
        if (!accumulated.companyName && best.candidate.naam) {
          output.companyName = best.candidate.naam;
        }

        // Only write city when not already set
        const candidateCity = extractCity(best.candidate);
        if (!accumulated.city && candidateCity) {
          output.city = candidateCity;
        }

        if (isDev) {
          console.debug("[kvk-zoeken] accepted", {
            naam:       best.candidate.naam,
            kvkNummer:  best.candidate.kvkNummer,
            type:       best.candidate.type,
            score:      best.score.toFixed(2),
          });
        }

        ctx?.setCacheSource("fresh");
        return output;

      } catch (err) {
        // Never throw — return empty partial on any unexpected error
        if (isDev) console.debug("[kvk-zoeken] unexpected error", err);
        return {};
      }
    },
  };
}
