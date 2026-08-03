/**
 * platformFirstVariants — adaptive variant resolution for the snippet path.
 *
 * Principle: the adaptive blocks (hero/proof/cta/feature/conversion/notification
 * variants) that the snippet swaps into an external site are authored in — and
 * served from — OUR platform. A customer keeps their own CMS for their own
 * pages and just adds the snippet; the adaptive variant content does not depend
 * on whichever CMS they use.
 *
 * Implementation: read each variant from the platform store
 * (PlatformCMSProvider → platform_cms_content) first, and fall back to the
 * tenant's configured CMS provider only when the platform has no entry for that
 * key. This makes platform-native the winner while staying backward-compatible
 * with tenants whose variants still live in an external CMS (until migrated).
 *
 * Scope: use this on the SNIPPET routes (/api/snippet/decide, /api/v1/slot)
 * only. The platform-hosted rendering path keeps using the tenant's CMS
 * provider directly, so a tenant can run both models (snippet on external sites
 * AND a platform-hosted / external-CMS site) without the two interfering.
 */

import { PlatformCMSProvider } from "./platform-provider";
import type { CMSProvider } from "./cms-provider";
import type {
  HeroBlockData,
  ProofBlockData,
  CTABlockData,
  FeatureBlockData,
  ConversionBlockData,
  NotificationBlockData,
} from "../types";

export interface VariantResolver {
  getHeroVariant:         (key: string) => Promise<HeroBlockData | null>;
  getProofVariant:        (key: string) => Promise<ProofBlockData | null>;
  getCTAVariant:          (key: string) => Promise<CTABlockData | null>;
  getFeatureVariant:      (key: string) => Promise<FeatureBlockData | null>;
  getConversionVariant:   (key: string) => Promise<ConversionBlockData | null>;
  getNotificationVariant: (key: string) => Promise<NotificationBlockData | null>;
}

async function firstOf<T>(
  primary:  Promise<T | null>,
  fallback: () => Promise<T | null>,
): Promise<T | null> {
  const hit = await primary.catch(() => null);
  if (hit) return hit;
  return fallback().catch(() => null);
}

/**
 * Returns a variant resolver that prefers the platform store and falls back to
 * the tenant's own CMS provider.
 */
export function platformFirstVariants(
  tenantId: string,
  fallback: CMSProvider,
): VariantResolver {
  const platform = new PlatformCMSProvider(tenantId);
  return {
    getHeroVariant:         (k) => firstOf(platform.getHeroVariant(k),         () => fallback.getHeroVariant(k)),
    getProofVariant:        (k) => firstOf(platform.getProofVariant(k),        () => fallback.getProofVariant(k)),
    getCTAVariant:          (k) => firstOf(platform.getCTAVariant(k),          () => fallback.getCTAVariant(k)),
    getFeatureVariant:      (k) => firstOf(platform.getFeatureVariant(k),      () => fallback.getFeatureVariant(k)),
    getConversionVariant:   (k) => firstOf(platform.getConversionVariant(k),   () => fallback.getConversionVariant(k)),
    getNotificationVariant: (k) => firstOf(platform.getNotificationVariant(k), () => fallback.getNotificationVariant(k)),
  };
}
