/**
 * platformFirstVariants — adaptive variant resolution for the snippet path.
 *
 * Principle: the adaptive blocks (hero/proof/cta/feature/conversion/notification
 * variants) that the snippet swaps into an external site are authored in — and
 * served from — OUR platform. A customer keeps their own CMS for their own
 * pages and just adds the snippet; the adaptive variant content does not depend
 * on whichever CMS they use.
 *
 * Resolution (per key):
 *   1. Tenant precedence — if the tenant has authored their OWN adaptive_blocks
 *      row for this key, that row WINS. Previously a like-named
 *      platform_cms_content entry silently shadowed the tenant's edit on the
 *      snippet path (the block editor only warned about it); now the tenant's
 *      adaptive block is served, so the snippet path and the platform-hosted
 *      path converge on the same content.
 *   2. Otherwise platform-first — read the platform store (PlatformCMSProvider →
 *      platform_cms_content) first, and fall back to the tenant's configured CMS
 *      provider only when the platform has no entry for that key. This keeps
 *      platform-native the winner while staying backward-compatible with tenants
 *      whose variants still live in an external CMS (until migrated).
 *
 * The tenant's adaptive block is served through the fallback CMS provider, which
 * already maps an adaptive_blocks row to the variant shape (e.g. the Statamic /
 * Storyblok providers prefer adaptive_blocks over their own CMS documents).
 *
 * Scope: use this on the SNIPPET routes (/api/snippet/decide, /api/v1/slot)
 * only. The platform-hosted rendering path keeps using the tenant's CMS
 * provider directly, so a tenant can run both models (snippet on external sites
 * AND a platform-hosted / external-CMS site) without the two interfering.
 */

import { PlatformCMSProvider } from "./platform-provider";
import { logger } from "@/lib/logger";
import type { CMSProvider } from "./cms-provider";
import type {
  HeroBlockData,
  ProofBlockData,
  CTABlockData,
  FeatureBlockData,
  ConversionBlockData,
  NotificationBlockData,
} from "../types";

type VariantType = "hero" | "proof" | "cta" | "feature" | "conversion" | "notification";

export interface VariantResolver {
  getHeroVariant:         (key: string) => Promise<HeroBlockData | null>;
  getProofVariant:        (key: string) => Promise<ProofBlockData | null>;
  getCTAVariant:          (key: string) => Promise<CTABlockData | null>;
  getFeatureVariant:      (key: string) => Promise<FeatureBlockData | null>;
  getConversionVariant:   (key: string) => Promise<ConversionBlockData | null>;
  getNotificationVariant: (key: string) => Promise<NotificationBlockData | null>;
}

/**
 * Injectable dependencies. Production leaves these unset and the real platform
 * store / adaptive-blocks store / override detector are used; tests inject fakes
 * so the resolver can be unit-tested without a database.
 */
export interface PlatformFirstDeps {
  /** Platform variant source (defaults to a PlatformCMSProvider for the tenant). */
  platform?: VariantResolver;
  /** True when the tenant has their OWN adaptive_blocks row for this key. */
  hasTenantAdaptiveRow?: (tenantId: string, key: string) => Promise<boolean>;
  /** True when a like-named platform_cms_content row exists (drives the warning). */
  hasPlatformContentEntry?: (tenantId: string, variantType: string, variantKey: string) => Promise<boolean>;
}

async function firstOf<T>(
  primary:  Promise<T | null>,
  fallback: () => Promise<T | null>,
): Promise<T | null> {
  const hit = await primary.catch(() => null);
  if (hit) return hit;
  return fallback().catch(() => null);
}

/** Default: does the tenant have their OWN (not the platform-wide) adaptive row? */
async function defaultHasTenantAdaptiveRow(tenantId: string, key: string): Promise<boolean> {
  try {
    const { getAdaptiveBlockByKey } = await import("@/lib/adaptive-blocks/adaptive-blocks-store");
    const block = await getAdaptiveBlockByKey(key, tenantId);
    // getAdaptiveBlockByKey falls back to the platform-wide row (tenantId === null);
    // only a row whose tenantId matches is a tenant-authored override.
    return !!block && block.tenantId === tenantId;
  } catch {
    return false;
  }
}

/** Default: reuse the block-editor's shadow-detection helper (read-only). */
async function defaultHasPlatformContentEntry(
  tenantId: string, variantType: string, variantKey: string,
): Promise<boolean> {
  try {
    const { hasPlatformContentEntry } = await import("@/lib/adaptive-blocks/platform-content-override");
    return await hasPlatformContentEntry(tenantId, variantType, variantKey);
  } catch {
    return false;
  }
}

/**
 * Returns a variant resolver that lets a tenant-authored adaptive block win, and
 * otherwise prefers the platform store, falling back to the tenant's own CMS.
 */
export function platformFirstVariants(
  tenantId: string,
  fallback: CMSProvider,
  deps:     PlatformFirstDeps = {},
): VariantResolver {
  const platform         = deps.platform ?? new PlatformCMSProvider(tenantId);
  const hasTenantRow     = deps.hasTenantAdaptiveRow    ?? defaultHasTenantAdaptiveRow;
  const hasPlatformEntry = deps.hasPlatformContentEntry ?? defaultHasPlatformContentEntry;

  async function resolve<T>(
    type:        VariantType,
    key:         string,
    platformGet: () => Promise<T | null>,
    fallbackGet: () => Promise<T | null>,
  ): Promise<T | null> {
    // 1) Tenant precedence — the tenant's own adaptive block wins over a
    //    like-named platform_cms_content entry. The fallback CMS provider serves
    //    the adaptive block, so consult it first when such a row exists.
    if (await hasTenantRow(tenantId, key)) {
      const tenantHit = await fallbackGet().catch(() => null);
      if (tenantHit) {
        if (await hasPlatformEntry(tenantId, type, key)) {
          logger.info(
            "[platform-first] tenant adaptive block wins over platform content",
            { tenantId, type, key },
          );
        }
        return tenantHit;
      }
      // No servable tenant hit (e.g. wrong-type row) → fall through to platform-first.
    }
    // 2) Platform-first (unchanged).
    return firstOf(platformGet(), fallbackGet);
  }

  return {
    getHeroVariant:         (k) => resolve("hero",         k, () => platform.getHeroVariant(k),         () => fallback.getHeroVariant(k)),
    getProofVariant:        (k) => resolve("proof",        k, () => platform.getProofVariant(k),        () => fallback.getProofVariant(k)),
    getCTAVariant:          (k) => resolve("cta",          k, () => platform.getCTAVariant(k),          () => fallback.getCTAVariant(k)),
    getFeatureVariant:      (k) => resolve("feature",      k, () => platform.getFeatureVariant(k),      () => fallback.getFeatureVariant(k)),
    getConversionVariant:   (k) => resolve("conversion",   k, () => platform.getConversionVariant(k),   () => fallback.getConversionVariant(k)),
    getNotificationVariant: (k) => resolve("notification", k, () => platform.getNotificationVariant(k), () => fallback.getNotificationVariant(k)),
  };
}
