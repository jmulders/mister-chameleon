/**
 * adaptive-variant-to-overlay
 *
 * Shared mappers that turn a single AdaptiveVariantContent (the block draft as
 * edited in the admin) into the overlay data contracts consumed by the real
 * block components:
 *
 *   adaptiveVariantToConversionData   → ConversionBlockData
 *   adaptiveVariantToNotificationData → NotificationBlockData | null
 *
 * These are the SINGLE source of truth for the variant → overlay mapping. The
 * Statamic provider's private `adaptiveToConversion` / `adaptiveToNotification`
 * delegate here (after their own isActive guard), and the admin block preview
 * route uses them directly so the drawer preview renders the exact same data a
 * visitor would get on the live site.
 */

import type { AdaptiveVariantContent } from "@/cms/types";
import type { ConversionBlockData, NotificationBlockData } from "@/cms/types";
import { heroBannerMediaToBlockMedia } from "@/lib/media/hero-banner-to-block-media";

/** Map a variant draft to the conversion block data contract. */
export function adaptiveVariantToConversionData(
  c: AdaptiveVariantContent,
  key: string,
): ConversionBlockData {
  return {
    id:            key,
    layoutVariant: c.layoutVariant,
    title:         c.title,
    text:          c.subtitle,
    ctas:          c.ctas ?? [],
    ...(c.formKey ? { formKey: c.formKey } : {}),
  };
}

/**
 * Map a variant draft to the notification block data contract.
 *
 * Returns null when the message (`title`) is empty, mirroring the live provider:
 * a notification without a message is not renderable.
 */
export function adaptiveVariantToNotificationData(
  c: AdaptiveVariantContent,
  key: string,
): NotificationBlockData | null {
  // `title` is the notification message — required field.
  if (!c.title) return null;

  // Derive severity from the layoutVariant key:
  //   "notification_warning" → "warning"
  //   "notification_success" → "success"
  //   "notification_promo"   → "promo"
  //   anything else          → "info"  (safe default)
  const lv = c.layoutVariant ?? "";
  const severity: NotificationBlockData["severity"] =
    lv.includes("warning") ? "warning" :
    lv.includes("success") ? "success" :
    lv.includes("promo")   ? "promo"   : "info";

  const primaryCta = c.ctas?.[0];
  const media = heroBannerMediaToBlockMedia(c.media);
  return {
    id:          key,
    message:     c.title,
    severity,
    ctaLabel:    primaryCta?.label ?? undefined,
    ctaHref:     primaryCta?.href  ?? undefined,
    position:    c.notifPosition ?? "top",
    dismissible: c.notifDismissible ?? true,
    ...(c.notifAutoDismissMs !== undefined ? { autoDismissMs: c.notifAutoDismissMs } : {}),
    ...(c.notifFrequency ? { frequency: c.notifFrequency } : {}),
    ...(c.notifTtl !== undefined ? { ttl: c.notifTtl } : {}),
    ...(c.notifTtlUnit ? { ttlUnit: c.notifTtlUnit } : {}),
    ...(c.notifCampaignId ? { campaignId: c.notifCampaignId } : {}),
    ...(media          ? { media }               : {}),
    ...(c.mediaSide    ? { mediaSide: c.mediaSide } : {}),
  };
}
