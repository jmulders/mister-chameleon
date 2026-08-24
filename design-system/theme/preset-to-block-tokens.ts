/**
 * preset-to-block-tokens.ts
 *
 * Derives a site-wide default block-token set (CuratedBlockTokens) from a design
 * preset's grouped token overrides. Applying a gallery preset is a COMPLETE look,
 * so besides the preset chrome (header/footer, theme vars) we also emit matching
 * block-level tokens — colours, buttons, cards, typography, proof/feature grids —
 * so every content block and adaptive slot inherits the preset's personality.
 *
 * Conservative by design: hero/CTA backgrounds are only set when the preset
 * ships an explicit gradient. Their text colour is luminance-aware: a dark
 * gradient keeps white text, a light gradient (e.g. Trans Pride's blue/pink/
 * white bands) instead gets the preset's dark foreground so the headline and
 * body stay readable. Otherwise those blocks keep the component defaults,
 * avoiding contrast pitfalls on light-primary presets.
 */

import type { CuratedBlockTokens } from "./block-token-set";
import type { TenantTokenOverrides } from "@/tenant/types";
import {
  hexToRgb, relativeLuminance, isLight, lighten, mix, readableText, contrastRatio,
} from "@/lib/color";

/**
 * Card-on-dark separation for the block-token layer.
 *
 * A dark preset card (color.card) can sit on a dark subtle section (color.muted)
 * with almost no separation, so the card melts into the band it sits on. The
 * theme var layer already lifts --card-bg on [data-site] (#221), but the derived
 * block tokens re-emit color.card raw on the more-specific site-default block
 * scope, which masks that lift on blocks (e.g. the CtaSectionBlock card variant).
 *
 * Mirror the #221 logic here so the block-token layer carries the same lift:
 * when the subtle section is dark and the card barely separates from it, lighten
 * the card until it clears the just-noticeable bar and strengthen its border to
 * match. The target sits a touch above #221's ~1.35 so a block card reads as
 * clearly elevated (and, being the more-specific scope, wins consistently).
 *
 * Returns the lifted { cardBg, cardBorder } or null when no lift is needed or the
 * colours cannot be parsed (non-destructive: callers keep the originals). Applied
 * at derivation time (blockTokensFromOverrides, for newly applied presets) and at
 * render time (the site-default block scope, for already-saved presets). Idempotent:
 * a card already at or above the target is left untouched, so re-running is a no-op.
 */
const CARD_ON_DARK_SEP_TARGET = 1.4;

export function liftDarkCardTokens(
  cardBg:   string | undefined,
  subtleBg: string | undefined,
  text:     string | undefined,
): { cardBg: string; cardBorder: string } | null {
  if (!cardBg || !subtleBg) return null;
  if (isLight(subtleBg)) return null;                 // only lift cards on dark sections
  const sep = contrastRatio(cardBg, subtleBg);
  if (sep === null || sep >= CARD_ON_DARK_SEP_TARGET) return null;
  // Lift the card to a lightened shade of the subtle section, stepping up until
  // it clears the target (a fixed step cannot guarantee the ratio on every base).
  let lifted = lighten(subtleBg, 0.14);
  for (let amount = 0.14; amount <= 0.4; amount += 0.06) {
    lifted = lighten(subtleBg, amount);
    const r = contrastRatio(lifted, subtleBg);
    if (r !== null && r >= CARD_ON_DARK_SEP_TARGET) break;
  }
  return { cardBg: lifted, cardBorder: mix(lifted, text ?? readableText(lifted), 0.24) };
}

/**
 * Average WCAG relative luminance of the hex colour stops in a CSS gradient
 * string. Returns null when the string has no parseable hex stops (e.g. a
 * gradient built from CSS variables), so callers keep their prior assumption.
 */
function gradientAverageLuminance(gradient: string): number | null {
  const stops = gradient.match(/#[0-9a-fA-F]{3,8}/g);
  if (!stops) return null;
  let sum = 0;
  let n = 0;
  for (const stop of stops) {
    const rgb = hexToRgb(stop);
    if (rgb) { sum += relativeLuminance(rgb); n += 1; }
  }
  return n > 0 ? sum / n : null;
}

/** A gradient reads as "light" when its average stop luminance clears the WCAG midpoint. */
function isLightGradient(gradient: string): boolean {
  const lum = gradientAverageLuminance(gradient);
  return lum !== null && lum > 0.5;
}

export function blockTokensFromOverrides(
  o: TenantTokenOverrides | null | undefined,
): CuratedBlockTokens {
  const out: Record<string, string> = {};
  if (!o) return out as CuratedBlockTokens;

  const c = (o.color      ?? {}) as Record<string, string>;
  const t = (o.typography ?? {}) as Record<string, string>;
  const r = (o.radius     ?? {}) as Record<string, string>;
  const s = (o.shadow     ?? {}) as Record<string, string>;
  const f = (o.focus      ?? {}) as Record<string, string>;

  const put = (k: string, v?: string) => { if (typeof v === "string" && v.trim()) out[k] = v; };

  // Surfaces & text
  put("background",  c.background);
  put("bgSubtle",    c.muted);
  put("text",        c.foreground);
  put("textMuted",   c.mutedForeground);
  put("border",      c.border);
  put("borderStrong", c.secondary);

  // Primary / accent
  put("primary",       c.primary);
  put("primaryHover",  c.primaryHover);
  put("primaryActive", c.primaryHover);   // presets have no separate active; reuse hover
  put("primarySubtle", c.accent);
  put("primaryText",   c.onPrimary);
  put("textBrand",     c.primary);
  put("ring",          f.ringColor || c.primary);

  // Buttons
  put("btnBg",     c.primary);
  put("btnText",   c.onPrimary);
  put("btnHoverBg", c.primaryHover);
  put("btnRadius", r.interactive);
  put("btnShadow", s.md);

  // Cards
  put("cardBg",     c.card);
  put("cardBorder", c.border);
  put("cardRadius", r.card);
  put("cardShadow", s.md);
  put("cardQuote",  c.secondary);

  // Radius
  put("radiusInteractive", r.interactive);
  put("radiusPopover",     r.card);

  // Typography
  put("headingFont",     t.fontHeading);
  put("headingWeight",   t.headingWeight);
  put("headingTracking", t.letterSpacing);
  put("fontSans",        t.fontBody);

  // Proof / testimonials
  put("proofBg",         c.muted);
  put("proofCardBg",     c.card);
  put("proofCardBorder", c.border);
  put("proofQuoteColor", c.secondary);

  // Feature grid
  put("featureGridBg",         c.muted);
  put("featureGridCardBg",     c.card);
  put("featureGridCardBorder", c.border);
  put("featureGridIconBg",     c.accent);

  // Hero — only when the preset ships a gradient background. Text colour follows
  // the gradient's luminance: a light gradient gets the preset's dark foreground
  // (a light glow would wash out, so use the brand primary), a dark gradient
  // keeps white text. Presets always ship gradientHero alongside gradient, so
  // heroTitleColor is set here whenever a gradient is present and never falls back
  // to the (now possibly dark) --text-inverse.
  if (c.gradientHero) {
    put("heroBg", c.gradientHero);
    if (isLightGradient(c.gradientHero)) {
      put("heroTitleColor",    c.foreground);
      put("heroSubtitleColor", c.mutedForeground || c.foreground);
      put("heroGlowColor",     c.primary);
    } else {
      put("heroTitleColor",    "#ffffff");
      put("heroSubtitleColor", "rgba(255,255,255,0.85)");
      put("heroGlowColor",     c.secondary);
    }
  }

  // CTA — same luminance-aware treatment for the gradient banner / split section.
  // On a light gradient the heading (Text color="inverse" -> --text-inverse) and
  // body both switch to the dark foreground, and the inverted CTA button becomes
  // a solid brand fill so it does not blend into the light background.
  if (c.gradient) {
    put("ctaBg", c.gradient);
    if (isLightGradient(c.gradient)) {
      put("ctaBodyText",   c.mutedForeground || c.foreground);
      put("textInverse",   c.foreground);
      put("ctaButtonBg",   c.primary);
      put("ctaButtonText", c.onPrimary || "#ffffff");
    } else {
      put("ctaBodyText", "rgba(255,255,255,0.88)");
    }
  }

  // Dividers
  put("dividerColor", c.border);

  // Card-on-dark: lift a dark card that barely separates from its subtle section
  // so it reads as elevated. Mirrors the theme-var lift (#221) at derivation time,
  // so a freshly applied preset already ships a separated card in the block layer.
  const cardLift = liftDarkCardTokens(out.cardBg, out.bgSubtle, out.text);
  if (cardLift) {
    out.cardBg     = cardLift.cardBg;
    out.cardBorder = cardLift.cardBorder;
  }

  return out as CuratedBlockTokens;
}
