/**
 * Account List Match Enrichment Provider (ABM)
 *
 * Resolves: targetAccountMatched, targetAccountTier, targetAccountList
 *
 * ─── Provider contract ────────────────────────────────────────────────────────
 *
 *   AccountListProvider is the vendor-agnostic interface. Implement for:
 *   - An in-house account list (CSV/DB table of target company domains + tiers)
 *   - 6sense Segments API
 *   - Demandbase Account Watch
 *   - Terminus / RollWorks account lists
 *   - Any ABM platform that exposes domain-level list membership
 *
 * ─── Match strategy ──────────────────────────────────────────────────────────
 *
 *   The primary match signal is `companyDomain` from the company enricher.
 *   Providers can also match via `companyName` as a fallback.
 *
 *   For best results, run `createCompanyEnricher` before `createAccountListEnricher`
 *   in the pipeline so the domain is available on `input.resolvedDomain`.
 *
 *   The `AccountListLookupInput` carries whichever domain/name signal was
 *   resolved upstream. Providers should handle null values gracefully.
 *
 * ─── Tier convention ─────────────────────────────────────────────────────────
 *
 *   Use "tier-1", "tier-2", "tier-3" as the standard tier labels.
 *   Custom tiers (e.g. "strategic", "growth") are also valid — document them
 *   in the allowedValues of the context registry entry.
 *
 * ─── Stub ─────────────────────────────────────────────────────────────────────
 *
 *   StubAccountListProvider returns targetAccountMatched: false.
 *
 * ─── Note on ordering ────────────────────────────────────────────────────────
 *
 *   This enricher depends on `companyDomain` which is produced by the company
 *   enricher. However, because all enrichers run in parallel via Promise.allSettled,
 *   this enricher receives the raw `EnricherInput` (not yet enriched context).
 *
 *   Options:
 *   a) Accept IP as the match signal and perform its own reverse-IP lookup.
 *   b) Run the account list enricher in a second pipeline pass after company.
 *   c) Have the adapter call both (company identify + list lookup) internally.
 *
 *   The interface accepts both `ip` and an optional pre-resolved `companyDomain`
 *   to support all three strategies.
 */

import type { EnrichmentOutput, EnricherInput, LabeledEnricher } from "../types";

// ── AccountListOutput ─────────────────────────────────────────────────────────

/** Fields this provider can resolve. */
export interface AccountListOutput {
  /** Whether the visitor's company is on any target account list. */
  targetAccountMatched: boolean | null;
  /** e.g. "tier-1", "tier-2", "tier-3" */
  targetAccountTier:    string | null;
  /** Name of the matched list, e.g. "Q2-2025-ICP" */
  targetAccountList:    string | null;
}

// ── AccountListLookupInput ────────────────────────────────────────────────────

/**
 * Input for the account list lookup.
 * Extends EnricherInput with an optional pre-resolved company domain.
 */
export interface AccountListLookupInput extends EnricherInput {
  /**
   * Company domain resolved upstream (e.g. from the company enricher).
   * Pass null if not available — the provider may fall back to IP lookup.
   */
  companyDomain?: string | null;
}

// ── AccountListProvider ───────────────────────────────────────────────────────

/**
 * Vendor-agnostic account list match provider interface.
 */
export interface AccountListProvider {
  /**
   * Check whether the visitor's company is on a target account list.
   *
   * @param input - Lookup input including ip, tenantId, and optional companyDomain.
   * @returns     - Partial account list output.
   */
  lookup(input: AccountListLookupInput): Promise<Partial<AccountListOutput>>;
}

// ── StubAccountListProvider ───────────────────────────────────────────────────

/**
 * No-op account list provider for development and testing.
 * Returns no match without making any network call.
 */
export class StubAccountListProvider implements AccountListProvider {
  async lookup(_input: AccountListLookupInput): Promise<Partial<AccountListOutput>> {
    return { targetAccountMatched: false };
  }
}

// ── createAccountListEnricher ─────────────────────────────────────────────────

/**
 * Adapts an `AccountListProvider` into a generic `LabeledEnricher`.
 *
 * @param provider         - Any AccountListProvider implementation.
 * @param companyDomainFn  - Optional function to resolve the company domain
 *                           from external context (e.g. a cached company lookup).
 *                           If omitted, `companyDomain` is passed as null.
 * @returns                - A LabeledEnricher ready to pass to runEnrichmentPipeline().
 *
 * @example
 * import {
 *   createAccountListEnricher,
 *   StubAccountListProvider,
 * } from "@/enrichment/providers/account-list";
 *
 * const enrichers = [
 *   createAccountListEnricher(new StubAccountListProvider()),
 * ];
 */
export function createAccountListEnricher(
  provider: AccountListProvider,
  companyDomainFn?: (input: EnricherInput) => string | null,
): LabeledEnricher {
  return {
    label: "account-list",
    enricher: async (input: EnricherInput): Promise<Partial<EnrichmentOutput>> => {
      const lookupInput: AccountListLookupInput = {
        ...input,
        companyDomain: companyDomainFn ? companyDomainFn(input) : null,
      };

      const result = await provider.lookup(lookupInput);
      return {
        targetAccountMatched: result.targetAccountMatched ?? null,
        targetAccountTier:    result.targetAccountTier    ?? null,
        targetAccountList:    result.targetAccountList    ?? null,
      };
    },
  };
}
