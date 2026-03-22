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

import { Button } from "@/components/ui/Button";
import { trackEvent } from "@/tracking/track-event";

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
  className,
  style,
}: TrackedCTAButtonProps) {
  const handleClick = () => {
    trackEvent("cta_click", {
      href,
      cta_key: ctaKey,
      label,
      position,
    });
  };

  return (
    <Button
      as="a"
      size="lg"
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
