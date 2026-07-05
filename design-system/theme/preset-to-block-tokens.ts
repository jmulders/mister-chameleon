/**
 * preset-to-block-tokens.ts
 *
 * Derives a site-wide default block-token set (CuratedBlockTokens) from a design
 * preset's grouped token overrides. Applying a gallery preset is a COMPLETE look,
 * so besides the preset chrome (header/footer, theme vars) we also emit matching
 * block-level tokens — colours, buttons, cards, typography, proof/feature grids —
 * so every content block and adaptive slot inherits the preset's personality.
 *
 * Conservative by design: hero/CTA backgrounds and their light text are only set
 * when the preset ships an explicit gradient (which is dark enough for white
 * text). Otherwise those blocks keep the component defaults, avoiding contrast
 * pitfalls on light-primary presets.
 */

import type { CuratedBlockTokens } from "./block-token-set";
import type { TenantTokenOverrides } from "@/tenant/types";

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

  // Hero / CTA — only when the preset ships a (dark) gradient, so white text is safe.
  if (c.gradientHero) {
    put("heroBg",            c.gradientHero);
    put("heroTitleColor",    "#ffffff");
    put("heroSubtitleColor", "rgba(255,255,255,0.85)");
    put("heroGlowColor",     c.secondary);
  }
  if (c.gradient) {
    put("ctaBg",       c.gradient);
    put("ctaBodyText", "rgba(255,255,255,0.88)");
  }

  // Dividers
  put("dividerColor", c.border);

  return out as CuratedBlockTokens;
}
