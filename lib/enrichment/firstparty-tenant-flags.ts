/**
 * Resolve the two per-tenant first-party company-DB ToS gates.
 *
 *   • consume  (READ)  — may this tenant read the shared pool to skip a paid call?
 *   • contribute (WRITE) — may this tenant's Leadinfo results warm the shared pool?
 *
 * Both default to the platform-wide settings and can be overridden per tenant via
 * `tenant_pipeline_stages` (stage keys `firstpartyConsume` / `firstpartyContribute`).
 *
 * Shared by the staged-enricher chain builder and the client-side Leadinfo route
 * (which gates its writeback on `contribute`), so the gate is resolved identically
 * everywhere.
 */

import {
  getPlatformFirstPartyCompanySettings,
  firstPartyCompanyFlags,
} from "@/platform/platform-store";
import { getTenantPipelineStages } from "@/tenant/server";

export interface FirstPartyTenantFlags {
  consume:             boolean;
  contribute:          boolean;
  confidenceThreshold: number;
}

export async function resolveFirstPartyTenantFlags(
  tenantId: string | null | undefined,
): Promise<FirstPartyTenantFlags> {
  const [platformResult, stages] = await Promise.all([
    getPlatformFirstPartyCompanySettings(),
    tenantId ? getTenantPipelineStages(tenantId) : Promise.resolve([]),
  ]);

  const defaults = firstPartyCompanyFlags(platformResult.ok ? platformResult.data : {});
  const cfg = new Map(stages.map((s) => [s.stageKey, s]));
  const enabled = (key: string, fallback: boolean): boolean =>
    cfg.has(key) ? Boolean(cfg.get(key)?.enabled) : fallback;

  return {
    consume:             enabled("firstpartyConsume", defaults.consume),
    contribute:          enabled("firstpartyContribute", defaults.contribute),
    confidenceThreshold: defaults.confidenceThreshold,
  };
}
