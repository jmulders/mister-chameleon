/**
 * Notification Variant — Storyblok content type and slug builder
 *
 * Defines:
 *   StoryblokNotificationContent  — the content field shape of a notification_variant story
 *   notificationVariantSlug()     — builds the full slug for a notification variant story
 *
 * ─── Storyblok component: notification_variant ───────────────────────────────
 *
 *   Stories are stored in the "notification-variants" folder:
 *     notification-variants/notification_default
 *     notification-variants/notification_offer
 *     notification-variants/notification_urgency
 *     notification-variants/notification_returning
 *
 * ─── Field name mapping ────────────────────────────────────────────────────────
 *
 *   StoryblokNotificationContent  →  NotificationBlockData
 *   ──────────────────────           ──────────────────────
 *   key                          →  id
 *   message                      →  message
 *   severity                     →  severity
 *   cta_label                    →  ctaLabel
 *   cta_href                     →  ctaHref
 *   position                     →  position
 *   dismissible                  →  dismissible
 *   auto_dismiss_ms              →  autoDismissMs
 */

// ── Storyblok folder slug ─────────────────────────────────────────────────────

export const NOTIFICATION_VARIANTS_FOLDER = "notification-variants" as const;

// ── Content types ─────────────────────────────────────────────────────────────

/**
 * Content fields of a Storyblok `notification_variant` story.
 *
 * Field names use Storyblok's snake_case convention.
 * The mapper (mapStoryblokNotification) translates these to NotificationBlockData.
 */
export interface StoryblokNotificationContent {
  /** Variant identifier — matches the story slug and the NotificationVariantKey */
  key:              string;
  /** Soft-disable flag — false means the slot returns null */
  is_active:        boolean;
  /** Main notification message text */
  message:          string;
  /** Visual severity / colour scheme */
  severity:         "info" | "success" | "warning" | "promo";
  /** Optional CTA button label */
  cta_label?:       string;
  /** Optional CTA href — when set, the notification renders a clickable button */
  cta_href?:        string;
  /**
   * Where the notification is anchored on screen.
   *   top          — fixed banner across the full viewport top
   *   bottom-right — floating toast in the bottom-right corner
   */
  position?:        "top" | "bottom-right";
  /** Whether the visitor can dismiss the notification. Defaults to true. */
  dismissible?:     boolean;
  /**
   * Auto-dismiss delay in milliseconds.
   * 0 or absent = never auto-dismiss.
   * Storyblok stores this as a text field; the mapper coerces it to a number.
   */
  auto_dismiss_ms?: number | string;
}

// ── Slug builder ──────────────────────────────────────────────────────────────

/**
 * Builds the full Storyblok story slug for a notification variant.
 *
 * @param key  The variant key, e.g. "notification_offer"
 * @returns    The full story slug, e.g. "notification-variants/notification_offer"
 */
export function notificationVariantSlug(key: string): string {
  return `${NOTIFICATION_VARIANTS_FOLDER}/${key}`;
}
