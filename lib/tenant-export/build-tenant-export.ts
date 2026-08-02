/**
 * Tenant Data Export
 *
 * Gathers a tenant's accumulated personalization value into one portable JSON
 * object: the segmentation/scoring work (rules config), the authored variants
 * (adaptive blocks), and the visitor profiles with their interest history.
 *
 * This is the "take your work with you" export — both a customer-portability
 * guarantee (a tenant that leaves keeps its segmentation work) and a sales
 * argument (no lock-in). It is a read-only gather; it never mutates anything.
 *
 * Note: the visitor-profile section contains personal data. Exporting is a
 * controller action performed by the tenant's own admin over the tenant's own
 * data. The profile set is capped (see PROFILE_EXPORT_CAP) so a very large
 * tenant can't produce an unbounded payload; `truncated` flags when the cap hit.
 */

import "server-only";

import { loadTenantRulesConfig } from "@/decision/rules/load-tenant-rules";
import { listAdaptiveBlocks } from "@/lib/adaptive-blocks/adaptive-blocks-store";
import { listVisitorProfiles } from "@/lib/lead-base/visitor-profiles-store";

/** Upper bound on exported visitor profiles (newest activity first). */
export const PROFILE_EXPORT_CAP = 50_000;

export interface TenantExport {
  exportVersion: 1;
  exportedAt:    string;
  tenantId:      string;
  /** Segmentation + scoring work: the full stored rules configuration. */
  rulesConfig:   unknown | null;
  /** Authored variants (form/email/block adaptive blocks) owned by this tenant. */
  variants:      unknown[];
  /** Visitor profiles including interest history (capped, newest first). */
  visitorProfiles: unknown[];
  counts: {
    rules:           number;
    variants:        number;
    visitorProfiles: number;
  };
  /** True when the visitor-profile set was cut off at PROFILE_EXPORT_CAP. */
  truncated: boolean;
}

/**
 * Build the export object for a tenant. Never throws: each source degrades to
 * an empty/null section so a partial failure still yields a usable file.
 */
export async function buildTenantExport(tenantId: string): Promise<TenantExport> {
  const [rulesConfig, variants, visitorProfiles] = await Promise.all([
    loadTenantRulesConfig(tenantId).catch(() => null),
    // Tenant's own blocks only — exclude shared platform seed blocks.
    listAdaptiveBlocks(tenantId, false).catch(() => []),
    listVisitorProfiles(tenantId, { limit: PROFILE_EXPORT_CAP }).catch(() => []),
  ]);

  const ruleCount = Array.isArray(
    (rulesConfig as { rules?: unknown[] } | null)?.rules,
  )
    ? ((rulesConfig as { rules: unknown[] }).rules.length)
    : 0;

  return {
    exportVersion: 1,
    exportedAt:    new Date().toISOString(),
    tenantId,
    rulesConfig:   rulesConfig ?? null,
    variants:      variants ?? [],
    visitorProfiles: visitorProfiles ?? [],
    counts: {
      rules:           ruleCount,
      variants:        (variants ?? []).length,
      visitorProfiles: (visitorProfiles ?? []).length,
    },
    truncated: (visitorProfiles ?? []).length >= PROFILE_EXPORT_CAP,
  };
}
