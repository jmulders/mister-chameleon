/**
 * fetchVariantCatalogue
 *
 * Server-only function that queries Sanity for published heroVariant,
 * proofVariant, and ctaVariant documents, then merges them with the
 * platform-defined entries to produce a VariantCatalogue.
 *
 * ─── Resolution order ─────────────────────────────────────────────────────────
 *
 *   1. Platform variants (ALLOWED_*_KEYS) — always included first.
 *   2. CMS tenant-scoped variants (tenantId == $tenantId) — labelled "CMS / Tenant".
 *   3. CMS shared variants (!defined(tenantId)) — labelled "CMS / Shared".
 *
 *   Deduplication: if a CMS document uses the same key as a platform variant
 *   it is skipped — the platform entry takes precedence.  This prevents
 *   accidental double-entries when a CMS author re-creates a platform key.
 *
 * ─── Graceful fallback ────────────────────────────────────────────────────────
 *
 *   • When Sanity is not configured (no SANITY_PROJECT_ID), returns the
 *     platform-only catalogue immediately — no network call.
 *   • When the GROQ query throws, logs a warning and returns the platform-only
 *     catalogue — the rules editor degrades to the previous behaviour.
 *
 * ─── Caching ─────────────────────────────────────────────────────────────────
 *
 *   Uses Next.js ISR with the "sanity" cache tag so stale CMS variants are
 *   served immediately and revalidated in the background after the content
 *   webhook fires.
 */

import "server-only";

import { createSanityClient }  from "@/cms/providers/sanity-client";
import {
  SANITY_REVALIDATE_SECONDS,
  SANITY_CACHE_TAG,
}                              from "@/cms/providers/sanity-client";
import { serverEnv }           from "@/lib/env";
import { logger }              from "@/lib/logger";
import {
  buildPlatformCatalogue,
} from "./variant-catalogue";
import type { VariantCatalogue, VariantEntry, VariantSource } from "./variant-catalogue";
import { getAdaptiveBlockByKey } from "@/lib/adaptive-blocks/adaptive-blocks-store";
import { EMAIL_TEMPLATE_KEYS } from "@/lib/email/adaptive-email";

/**
 * Form types that can carry authored variants. Kept in sync with the decision
 * engine's validFormTypes (decision/rules/stored-rule.ts validatePlan) and the
 * FormKey union — a rule may only target one of these via plan.formVariants.
 */
const FORM_TYPES = ["contact", "application", "appointment"] as const;

// ── GROQ query ─────────────────────────────────────────────────────────────────

/**
 * Returns all published variant documents of a given type for the current
 * tenant, plus all shared (tenantless) documents.
 *
 * Projection:
 *   key       — the variant key string (e.g. "hero_direct_brand")
 *   title     — used as the human-readable label if `label` is absent
 *   label     — optional explicit label field
 *   tenantId  — used to distinguish tenant vs shared variants
 */
const VARIANT_QUERY = `
*[
  _type == $docType
  && isActive == true
  && defined(key)
  && (
    ($tenantId != null && tenantId == $tenantId)
    || !defined(tenantId)
  )
] {
  key,
  "label": coalesce(label, title, key),
  tenantId
}
`;

// ── Row type returned by the GROQ query ────────────────────────────────────────

interface SanityVariantRow {
  key:       string;
  label:     string;
  tenantId?: string | null;
}

// ── fetchVariantCatalogue ──────────────────────────────────────────────────────

/**
 * Build the full VariantCatalogue for the given tenant.
 *
 * @param tenantId  Active tenant slug.  Pass null / undefined when building
 *                  for the global (non-tenant-scoped) dashboard rules page —
 *                  only shared CMS variants will be added in that case.
 */
export async function fetchVariantCatalogue(
  tenantId?: string | null,
): Promise<VariantCatalogue> {
  // Form + email variants are tenant-authored (adaptive_blocks), independent of
  // Sanity — load them up front so both the Sanity and fallback paths attach them.
  const [forms, emails] = await Promise.all([
    fetchAdaptiveVariants(tenantId ?? null, FORM_TYPES, "form"),
    fetchAdaptiveVariants(tenantId ?? null, EMAIL_TEMPLATE_KEYS, "email"),
  ]);

  // ── Fallback: no Sanity → platform-only ────────────────────────────────────
  if (!serverEnv.sanity.projectId) {
    return { ...buildPlatformCatalogue(), forms, emails };
  }

  try {
    const client = createSanityClient();

    // Fetch all five slot types in parallel.
    const [heroRows, proofRows, ctaRows, featureRows, conversionRows] = await Promise.all([
      fetchSlotVariants(client, "heroVariant",       tenantId ?? null),
      fetchSlotVariants(client, "proofVariant",      tenantId ?? null),
      fetchSlotVariants(client, "ctaVariant",        tenantId ?? null),
      fetchSlotVariants(client, "featureVariant",    tenantId ?? null),
      fetchSlotVariants(client, "conversionVariant", tenantId ?? null),
    ]);

    const platform = buildPlatformCatalogue();

    return {
      hero:       mergeEntries(platform.hero,       heroRows,       tenantId ?? null),
      proof:      mergeEntries(platform.proof,      proofRows,      tenantId ?? null),
      cta:        mergeEntries(platform.cta,        ctaRows,        tenantId ?? null),
      feature:    mergeEntries(platform.feature,    featureRows,    tenantId ?? null),
      conversion: mergeEntries(platform.conversion, conversionRows, tenantId ?? null),
      forms,
      emails,
    };
  } catch (err) {
    logger.warn("[fetchVariantCatalogue] Sanity query failed; using platform catalogue only.", { error: String(err) });
    return { ...buildPlatformCatalogue(), forms, emails };
  }
}

/**
 * Load tenant-authored variants for a family of adaptive-block keys (forms use
 * the `form:<type>` rows, emails the `email:<template>` rows). Returns a map
 * keyed by the family key, always including every known key (even with zero
 * variants) so the rules editor can render a visible, disabled select plus a
 * hint rather than hiding the control. Never throws.
 */
async function fetchAdaptiveVariants(
  tenantId: string | null,
  keys:     readonly string[],
  prefix:   "form" | "email",
): Promise<Record<string, VariantEntry[]>> {
  if (!tenantId) return {};
  const out: Record<string, VariantEntry[]> = {};
  try {
    const blocks = await Promise.all(
      keys.map((key) => getAdaptiveBlockByKey(`${prefix}:${key}`, tenantId)),
    );
    keys.forEach((key, i) => {
      out[key] = (blocks[i]?.adaptiveVariants ?? []).map((v) => ({
        key:    v.variantKey,
        label:  v.label || v.variantKey,
        source: "cms-tenant" as const,
      }));
    });
  } catch (err) {
    logger.warn(`[fetchVariantCatalogue] ${prefix}-variant load failed; omitted.`, { error: String(err) });
  }
  return out;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function fetchSlotVariants(
  client:   ReturnType<typeof createSanityClient>,
  docType:  string,
  tenantId: string | null,
): Promise<SanityVariantRow[]> {
  return client.fetch<SanityVariantRow[]>(
    VARIANT_QUERY,
    { docType, tenantId },
    {
      next: {
        revalidate: SANITY_REVALIDATE_SECONDS,
        tags:       [SANITY_CACHE_TAG],
      },
    },
  );
}

/**
 * Merge CMS rows into the platform entries for one slot.
 *
 * Rules:
 *   - Platform entries come first.
 *   - CMS entries whose key already appears in the platform list are skipped.
 *   - Tenant-scoped CMS entries are labelled "cms-tenant".
 *   - Shared (no tenantId) CMS entries are labelled "cms-shared".
 *   - Within CMS entries, tenant-scoped appear before shared.
 */
function mergeEntries(
  platformEntries: VariantEntry[],
  rows:            SanityVariantRow[],
  tenantId:        string | null,
): VariantEntry[] {
  const platformKeys = new Set(platformEntries.map((e) => e.key));

  const tenantRows: VariantEntry[] = [];
  const sharedRows: VariantEntry[] = [];
  const seen = new Set<string>(platformKeys);

  for (const row of rows) {
    if (!row.key || seen.has(row.key)) continue;
    seen.add(row.key);

    const source: VariantSource =
      row.tenantId && row.tenantId === tenantId ? "cms-tenant" : "cms-shared";

    const entry: VariantEntry = {
      key:    row.key,
      label:  row.label || row.key,
      source,
    };

    if (source === "cms-tenant") {
      tenantRows.push(entry);
    } else {
      sharedRows.push(entry);
    }
  }

  return [...platformEntries, ...tenantRows, ...sharedRows];
}
