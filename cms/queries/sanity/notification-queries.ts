/**
 * Notification Variant — Sanity GROQ query and raw response type
 *
 * Defines:
 *   NOTIFICATION_BY_KEY_QUERY  — fetch a single notificationVariant document by its `key` field
 *   SanityNotificationRaw      — TypeScript shape of the GROQ projection result
 *
 * ─── Sanity document type: notificationVariant ───────────────────────────────
 *
 *   key            string   Unique variant identifier (e.g. "notif_promo_spring")
 *   tenantId       string?  Optional tenant scope
 *   message        string   Notification body text
 *   severity       string   "info" | "success" | "warning" | "promo"
 *   ctaLabel       string?  Optional CTA button label
 *   ctaHref        string?  Optional CTA destination URL
 *   position       string   "top" | "bottom-right"
 *   dismissible    boolean  Whether the user can close the notification
 *   autoDismissMs  number   Auto-dismiss delay in ms (0 = never)
 *   isActive       boolean  Only active documents are returned by this query
 */

import { buildVariantQuery } from "./query-builder";

// ── Raw response type ─────────────────────────────────────────────────────────

/**
 * Shape of the data returned by NOTIFICATION_BY_KEY_QUERY.
 *
 * Field names match the Sanity schema field names exactly.
 * The mapper (mapSanityNotification) translates these to NotificationBlockData.
 */
export interface SanityNotificationRaw {
  _id:           string;
  tenantId?:     string;
  key:           string;
  message:       string;
  severity:      "info" | "success" | "warning" | "promo";
  ctaLabel?:     string;
  ctaHref?:      string;
  position:      "top" | "bottom-right";
  dismissible:   boolean;
  autoDismissMs: number;
}

// ── GROQ query ────────────────────────────────────────────────────────────────

/**
 * Fetch a single notificationVariant document by its `key` field.
 *
 * Parameters:
 *   $key  string  The variant key, e.g. "notif_promo_spring"
 *
 * Returns: SanityNotificationRaw | null
 *
 * @example
 *   const result = await client.fetch<SanityNotificationRaw | null>(
 *     NOTIFICATION_BY_KEY_QUERY,
 *     { key: "notif_promo_spring" },
 *   );
 */
export const NOTIFICATION_BY_KEY_QUERY = buildVariantQuery(
  "notificationVariant",
  `
    _id,
    tenantId,
    key,
    message,
    severity,
    ctaLabel,
    ctaHref,
    position,
    dismissible,
    autoDismissMs
  `,
);
