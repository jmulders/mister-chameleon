/**
 * First-party company DB enricher stage.
 *
 * Reads the durable, cross-tenant IP→company store (ip_company_cache) BEFORE any
 * paid company provider (KvK Zoeken / OpenKvK / Leadinfo) runs. On a confident
 * matched hit it writes the company firmographics and stamps
 * `companyMatchSource: "firstparty"`, which:
 *
 *   • makes OpenKvK/KvK skip (their existing `!accumulated.companyName` gate), and
 *   • makes Leadinfo skip (its `companyMatchSource === "firstparty"` guard in the
 *     chain),
 *
 * so a paid identify call is avoided entirely. A first-party hit is billed
 * separately and more cheaply than a paid provider (see build-decision-context +
 * the `firstparty_company_lookup` pricing key).
 *
 * On a miss, a no-match, or a below-threshold match it returns `{}` and the paid
 * providers run as normal (the provider-internal cache still short-circuits paid
 * no-match calls).
 *
 * Placed as a solo stage right after Cloud Detection so `isCloudProvider` is
 * available: cloud IPs never have a matched row (Leadinfo/OpenKvK skip them), but
 * the gate is kept as defence in depth.
 */

import type { StagedEnricher, EnricherInput, EnrichmentOutput } from "../types";
import type { LeadinfoPersistentCache } from "../ip-company-cache-ttl";

export const DEFAULT_FIRSTPARTY_CONFIDENCE_THRESHOLD = 0.6;

export interface FirstPartyCompanyDbOptions {
  /** Minimum stored confidence to short-circuit paid providers. Default 0.6. */
  confidenceThreshold?: number;
  /** Injectable store (defaults to the shared ipCompanyCache) — for tests. */
  cache?: LeadinfoPersistentCache;
  isDev?: boolean;
}

export function createFirstPartyCompanyDbEnricher(
  options: FirstPartyCompanyDbOptions = {},
): StagedEnricher {
  const threshold = options.confidenceThreshold ?? DEFAULT_FIRSTPARTY_CONFIDENCE_THRESHOLD;
  const injectedCache = options.cache;
  const isDev     = options.isDev ?? false;

  // Resolve the shared store lazily so importing this stage (e.g. in unit tests
  // with an injected cache) does not pull in the server-only DB module.
  async function getCache(): Promise<LeadinfoPersistentCache> {
    if (injectedCache) return injectedCache;
    return (await import("../ip-company-store")).ipCompanyCache;
  }

  return {
    label:    "First-party company DB",
    stageKey: "firstparty-company-db",

    // Only meaningful with an IP, off cloud IPs, and when no prior stage already
    // resolved a company.
    shouldRun: (input: EnricherInput, accumulated: Partial<EnrichmentOutput>): boolean =>
      !!input.ip && !accumulated.isCloudProvider && !accumulated.companyName,

    enricher: async (input: EnricherInput, _accumulated: Partial<EnrichmentOutput>) => {
      if (!input.ip) return {};
      const cache = await getCache();
      const hit = await cache.get(input.ip);
      if (!hit) return {};

      const out = hit.output;
      // No-match / empty row → let the paid providers (and their internal cache)
      // handle it; do not short-circuit and do not bill.
      if (!out.companyName) return {};

      const confidence = out.companyMatchConfidence ?? 0;
      if (confidence < threshold) {
        if (isDev) {
          console.debug("[firstparty-company-db] below threshold, deferring to paid providers", {
            confidence, threshold, company: out.companyName,
          });
        }
        return {};
      }

      if (isDev) {
        console.debug("[firstparty-company-db] hit — skipping paid providers", {
          company: out.companyName, confidence,
        });
      }

      // Stamp the source so downstream stages + post-pipeline billing recognise a
      // first-party hit. Provenance of the underlying record is kept in the DB row.
      return { ...out, companyMatchSource: "firstparty" };
    },
  };
}
