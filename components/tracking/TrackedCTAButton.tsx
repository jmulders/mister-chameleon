"use client";

/**
 * TrackedCTAButton
 *
 * Client Component wrapper around `<Button as="a">` that fires a `cta_click`
 * tracking event when the visitor clicks the button.
 *
 * ─── Why a separate component? ────────────────────────────────────────────────
 *
 *   `CTABlock` and `HeroBlock` are Server Components — they cannot attach
 *   onClick handlers directly. This component is the minimal client-side
 *   boundary: the blocks themselves stay server-rendered; only the
 *   interactive button element crosses into the client bundle.
 *
 * ─── Tracking payload ─────────────────────────────────────────────────────────
 *
 *   The `cta_click` event payload includes:
 *     cta_key   — the variant key from the decision layer (e.g. "cta_meeting")
 *     href      — the link destination
 *     label     — the visible button text
 *     position  — which block the button lives in ("hero" | "cta_block")
 *
 *   All fields are optional at the API level; omit any that are not relevant.
 *
 * ─── keepalive ────────────────────────────────────────────────────────────────
 *
 *   trackEvent uses `keepalive: true` so the tracking request completes even
 *   when the click navigates the page away immediately.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   // Inside a Server Component block:
 *   <TrackedCTAButton
 *     href={cta.href}
 *     label={cta.label}
 *     ctaKey="cta_meeting"
 *     position="cta_block"
 *     variant="primary"
 *   />
 *
 *   // With token-based inline style overrides (e.g. inverted CTA button):
 *   <TrackedCTAButton
 *     href={cta.href}
 *     label={cta.label}
 *     position="cta_block"
 *     style={{ backgroundColor: 'var(--card-bg)', color: 'var(--primary-active)' }}
 *     className="shadow-lg"
 *   />
 */

import Link           from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { trackEvent } from "@/tracking/track-event";
import {
  getJourneyStoreVisitorId,
  pushToJourneyStore,
  generateEventId,
} from "@/tracking/journey-store";
import { hasConsent } from "@/tracking/consent-store";

interface TrackedCTAButtonProps {
  /** Navigation destination */
  href: string;
  /** Visible button text */
  label: string;
  /**
   * Variant key from the decision layer (e.g. "cta_meeting").
   * Included in the tracking payload for attribution.
   */
  ctaKey?: string;
  /**
   * Which block / section this button lives in.
   * Helps distinguish hero CTA clicks from bottom-of-page CTA clicks.
   * e.g. "hero" | "cta_block"
   */
  position?: string;
  /** Visual variant forwarded to Button. Defaults to "primary". */
  variant?: "primary" | "secondary" | "outline" | "ghost";
  /** Button size forwarded to Button. Defaults to "lg" (unchanged for existing callers). */
  size?: "sm" | "md" | "lg";
  /** Additional Tailwind classes forwarded to Button. */
  className?: string;
  /**
   * Inline style overrides — primarily for CSS variable-based token theming.
   * Use when a specific placement needs an inverted or token-driven appearance
   * that can't be expressed via `variant` alone.
   * Example: `style={{ backgroundColor: 'var(--card-bg)', color: 'var(--primary-active)' }}`
   */
  style?: React.CSSProperties;
}

export function TrackedCTAButton({
  href,
  label,
  ctaKey,
  position,
  variant = "primary",
  size = "lg",
  className,
  style,
}: TrackedCTAButtonProps) {
  const pathname = usePathname();

  const handleClick = () => {
    const payload = {
      href,
      cta_key:    ctaKey,
      label,
      position,
      page_path:  pathname,
      visitor_id: getJourneyStoreVisitorId() ?? undefined,
    };

    if (hasConsent("analytics") && hasConsent("personalization")) {
      // Normal path: consent granted — trackEvent handles local store + DB write.
      trackEvent("cta_click", payload);
    } else {
      // Consent not yet given (e.g. admin testing before accepting the banner).
      // Push directly to the local journey store for immediate Live State
      // reflection, and write to the DB via the scenario endpoint which
      // intentionally bypasses the consent gate for demo/admin use.
      pushToJourneyStore(generateEventId(), "cta_click", {
        ...payload,
        occurred_at:    new Date().toISOString(),
        scenario_panel: true,
      });
      fetch("/api/scenario/event", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          eventType:  "cta_click",
          pagePath:   pathname,
          eventValue: ctaKey ?? href,
        }),
        credentials: "include",
      }).catch(() => {/* fire-and-forget */});
    }
  };

  return (
    <Button
      as={Link}
      size={size}
      variant={variant}
      href={href}
      className={className}
      style={style}
      onClick={handleClick}
    >
      {label}
    </Button>
  );
}
