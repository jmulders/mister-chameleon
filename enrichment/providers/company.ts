/**
 * Company Identification Enrichment Provider
 *
 * Resolves: companyName, companyDomain, companyIndustry, companySize,
 *           companyMatchConfidence, companyMatchSource
 *
 * ─── Provider contract ────────────────────────────────────────────────────────
 *
 *   CompanyProvider is the vendor-agnostic interface. Swap implementations to use:
 *   - Clearbit Reveal (reverse-IP company lookup)
 *   - 6sense (account identification)
 *   - Demandbase (ABM platform)
 *   - IP2Company or similar self-hosted DB
 *
 * ─── Stub ─────────────────────────────────────────────────────────────────────
 *
 *   StubCompanyProvider returns an empty match. Safe for development and tests.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   // Clearbit Reveal adapter (example sketch)
 *   const companyProvider: CompanyProvider = {
 *     identify: async (ip) => {
 *       const res = await clearbit.Reveal.find({ ip });
 *       return {
 *         companyName:            res.company?.name         ?? null,
 *         companyDomain:          res.company?.domain       ?? null,
 *         companyIndustry:        res.company?.category?.industry ?? null,
 *         companySize:            res.company?.metrics?.employeesRange ?? null,
 *         companyMatchConfidence: res.fuzzy ? 0.6 : 0.9,
 *         companyMatchSource:     "clearbit",
 *       };
 *     },
 *   };
 */

import type { EnrichmentOutput, EnricherInput, LabeledEnricher } from "../types";

// ── CompanyOutput ─────────────────────────────────────────────────────────────

/** Fields this provider can resolve. */
export interface CompanyOutput {
  companyName:            string | null;
  companyDomain:          string | null;
  companyIndustry:        string | null;
  /** e.g. "1-10", "11-50", "51-200", "201-1000", "1001-5000", "5001+" */
  companySize:            string | null;
  /** 0–1 confidence score; null if provider doesn't emit one. */
  companyMatchConfidence: number | null;
  /** Provider identifier, e.g. "clearbit", "6sense", "demandbase". */
  companyMatchSource:     string | null;
}

// ── CompanyProvider ───────────────────────────────────────────────────────────

/**
 * Vendor-agnostic company identification provider interface.
 *
 * Implement this for any reverse-IP or firmographic lookup service.
 */
export interface CompanyProvider {
  /**
   * Identify the company associated with the given IP address.
   *
   * @param ip - Visitor IP (IPv4 or IPv6). May be null.
   * @returns  - Partial company output. Missing fields default to null.
   */
  identify(ip: string | null): Promise<Partial<CompanyOutput>>;
}

// ── StubCompanyProvider ───────────────────────────────────────────────────────

/**
 * No-op company provider for development and testing.
 * Returns empty object — no network call, no matches.
 */
export class StubCompanyProvider implements CompanyProvider {
  async identify(_ip: string | null): Promise<Partial<CompanyOutput>> {
    return {};
  }
}

// ── MockCompanyProvider ───────────────────────────────────────────────────────

/**
 * Static IP-to-company fixture map for local development and automated tests.
 *
 * Accepts a record of `ip → Partial<CompanyOutput>` at construction time.
 * Supports an optional `"*"` wildcard key as a catch-all — useful in local
 * dev where every visitor should appear to come from a known company.
 *
 * Lookup order:
 *   1. Exact IP match
 *   2. Wildcard `"*"` entry
 *   3. No match → empty object (all fields null after normalization)
 *
 * ─── Why use this instead of StubCompanyProvider ──────────────────────────────
 *
 *   StubCompanyProvider always returns no match, so company-gated rules never
 *   fire in development.  MockCompanyProvider lets you verify firmographic
 *   targeting (e.g. "show X only to Software companies with 51–200 employees")
 *   without a Clearbit or 6sense subscription.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   const mock = new MockCompanyProvider({
 *     "203.0.113.42": {
 *       companyName:            "Acme Corp",
 *       companyDomain:          "acme.com",
 *       companyIndustry:        "Software",
 *       companySize:            "51-200",
 *       companyMatchConfidence: 0.9,
 *       companyMatchSource:     "mock",
 *     },
 *     // Wildcard: all other IPs look like this company in dev
 *     "*": {
 *       companyName:    "Generic Co",
 *       companyDomain:  "generic.example",
 *       companyIndustry:"Technology",
 *       companySize:    "11-50",
 *     },
 *   });
 */
export class MockCompanyProvider implements CompanyProvider {
  private readonly fixtures: Record<string, Partial<CompanyOutput>>;

  constructor(fixtures: Record<string, Partial<CompanyOutput>> = {}) {
    this.fixtures = fixtures;
  }

  async identify(ip: string | null): Promise<Partial<CompanyOutput>> {
    if (ip) {
      const exact = this.fixtures[ip];
      if (exact !== undefined) return exact;
    }
    return this.fixtures["*"] ?? {};
  }
}

// ── normalizeCompanyOutput ─────────────────────────────────────────────────────

/**
 * Enforce the canonical internal format regardless of which provider ran.
 *
 * Exported so combined enrichers (e.g. `createIpCompanyHubSpotEnricher`) can
 * normalise raw company provider output without duplicating the logic.
 *
 * ─── Normalization rules ─────────────────────────────────────────────────────
 *
 *   All fields are guaranteed to be present (never `undefined`), so field
 *   resolvers and rule evaluators need only handle `null` as "not available".
 *
 *   companyMatchConfidence
 *     Three distinct states:
 *       null  — no match at all (provider returned nothing)
 *       0     — matched but provider omitted a confidence score
 *       > 0   — matched with a known confidence level
 *     This means rules can safely write `companyMatchConfidence > 0.7` without
 *     needing a separate null-check when a company is present.
 *
 *   companyMatchSource
 *     Defaults to `"unknown"` when a match exists but the provider omitted a
 *     source label, so it is never null when a company was identified.
 */
export function normalizeCompanyOutput(raw: Partial<CompanyOutput>): Partial<EnrichmentOutput> {
  const matched = raw.companyName != null || raw.companyDomain != null;
  return {
    companyName:     raw.companyName     ?? null,
    companyDomain:   raw.companyDomain   ?? null,
    companyIndustry: raw.companyIndustry ?? null,
    companySize:     raw.companySize     ?? null,
    companyMatchConfidence:
      raw.companyMatchConfidence != null
        ? raw.companyMatchConfidence
        : matched ? 0 : null,
    companyMatchSource:
      raw.companyMatchSource ?? (matched ? "unknown" : null),
  };
}

// ── createCompanyEnricher ─────────────────────────────────────────────────────

/**
 * Adapts a `CompanyProvider` into a generic `LabeledEnricher` for the pipeline.
 *
 * Raw provider output is passed through `normalizeCompanyOutput` before being
 * merged into the enrichment result, so all providers — stub, mock, or a live
 * Clearbit/6sense adapter — produce an identical field shape.
 *
 * @param provider - Any CompanyProvider implementation.
 * @returns        - A LabeledEnricher ready to pass to runEnrichmentPipeline().
 *
 * @example
 * import { createCompanyEnricher, StubCompanyProvider } from "@/enrichment/providers/company";
 *
 * const enrichers = [
 *   createCompanyEnricher(new StubCompanyProvider()),
 * ];
 */
export function createCompanyEnricher(provider: CompanyProvider): LabeledEnricher {
  return {
    label: "company",
    enricher: async (input: EnricherInput): Promise<Partial<EnrichmentOutput>> => {
      const raw = await provider.identify(input.ip);
      return normalizeCompanyOutput(raw);
    },
  };
}
