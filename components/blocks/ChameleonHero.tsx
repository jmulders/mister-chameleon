/**
 * ChameleonHero
 *
 * Rendert een `adaptiveHero` Sanity-document als een volledig gepersonaliseerde
 * hero-sectie.  Twee rendering-paden:
 *
 *   Bot / geen variantKey  →  defaultVariant (zonder token-vervanging, SEO-safe)
 *   Matched variantKey     →  adaptiveVariant met token-vervanging via parseTokens
 *
 * ─── Props ────────────────────────────────────────────────────────────────────
 *
 *   data          AdaptiveHeroDocument — rechtstreeks vanuit Sanity via GROQ.
 *   variantKey    De actieve variant-sleutel uit de Mr. Chameleon rule engine.
 *                 Null of undefined → defaultVariant.
 *   tokenContext  Bezoekersdata voor token-vervanging (uit buildTokenContext()).
 *   isBot         True = altijd defaultVariant (voor SSR zonder cookies).
 *
 * ─── Server Component ─────────────────────────────────────────────────────────
 *
 *   Dit is een React Server Component — geen "use client"-richtlijn nodig.
 *   Token-vervanging en variant-selectie vinden server-side plaats, zodat:
 *     • Gepersonaliseerde content direct als HTML wordt verzonden (geen flicker).
 *     • Zoekmachines altijd de SEO-fallback (defaultVariant) ontvangen.
 *
 * ─── Gebruik in een page-component ───────────────────────────────────────────
 *
 *   const experience    = await composeHomepageExperience(context, decision, cms);
 *   const tokenContext  = buildTokenContext(experience);
 *   const heroData      = await sanity.fetch<AdaptiveHeroDocument>(ADAPTIVE_HERO_QUERY, { key });
 *
 *   <ChameleonHero
 *     data={heroData}
 *     variantKey={experience.plan.heroKey}
 *     tokenContext={tokenContext}
 *   />
 */

import Image                             from "next/image";
import Link                              from "next/link";
import { parseTokens, type TokenContext } from "@/lib/tokens/parse-tokens";

// ── Sanity-data types ─────────────────────────────────────────────────────────
//
// Deze types spiegelen het adaptiveHero-schema.  Ze worden hier lokaal
// gedefinieerd zodat de component zelfstandig bruikbaar is.  In een groter
// project kun je ze exporteren vanuit cms/types.ts.

interface SanityImageAsset {
  _ref: string;
  url?: string;
}

interface AdaptiveHeroImage {
  asset:  SanityImageAsset;
  alt:    string;
  hotspot?: { x: number; y: number };
}

interface CtaLink {
  label:    string;
  href:     string;
  variant?: "primary" | "secondary" | "ghost";
}

interface VariantContent {
  title:    string;
  subtitle: string;
  tag?:     string;
  ctas?:    CtaLink[];
  image?:   AdaptiveHeroImage;
}

interface AdaptiveVariant {
  variantKey: string;
  label?:     string;
  content:    VariantContent;
}

export interface AdaptiveHeroDocument {
  _id:              string;
  key:              { current: string };
  is_active:        boolean;
  defaultVariant:   VariantContent;
  adaptiveVariants: AdaptiveVariant[];
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ChameleonHeroProps {
  /** Het adaptiveHero-document direct vanuit Sanity. */
  data: AdaptiveHeroDocument;

  /**
   * De actieve variant-sleutel gekozen door de rule engine
   * (bijv. "hero_roi", "hero_linkedin_vision").
   * Bij null of undefined wordt de defaultVariant gerenderd.
   */
  variantKey?: string | null;

  /**
   * Bezoekersdata voor token-vervanging.
   * Gebruik `buildTokenContext(experience)` om dit samen te stellen.
   * Laat weg als je geen personalisatie nodig hebt.
   */
  tokenContext?: TokenContext;

  /**
   * Geef true mee wanneer de bezoeker een bot is (bijv. Googlebot).
   * Forceert rendering van de defaultVariant zonder tokens — SEO-safe.
   */
  isBot?: boolean;
}

// ── Variant-selectie ─────────────────────────────────────────────────────────

/**
 * Kiest de juiste VariantContent op basis van de gegeven sleutel.
 * Geeft altijd de defaultVariant terug als fallback — nooit null.
 */
function selectVariant(
  data:       AdaptiveHeroDocument,
  variantKey: string | null | undefined,
  isBot:      boolean,
): { content: VariantContent; isDefault: boolean } {
  if (isBot || !variantKey || !data.adaptiveVariants?.length) {
    return { content: data.defaultVariant, isDefault: true };
  }

  const match = data.adaptiveVariants.find((v) => v.variantKey === variantKey);

  return match
    ? { content: match.content, isDefault: false }
    : { content: data.defaultVariant, isDefault: true };
}

// ── Token-vervanging op een VariantContent-object ─────────────────────────────

/**
 * Vervangt alle tokens in title, subtitle en tag van het content-object.
 * De defaultVariant wordt ongewijzigd teruggegeven (geen tokens).
 */
function applyTokens(
  content:   VariantContent,
  ctx:       TokenContext | undefined,
  isDefault: boolean,
): VariantContent {
  if (isDefault || !ctx) return content;

  return {
    ...content,
    title:    parseTokens(content.title,    ctx),
    subtitle: parseTokens(content.subtitle, ctx),
    tag:      content.tag ? parseTokens(content.tag, ctx) : content.tag,
  };
}

// ── CTA-stijlen ───────────────────────────────────────────────────────────────

const CTA_STYLES: Record<NonNullable<CtaLink["variant"]>, string> = {
  primary:   "rounded-lg bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity",
  secondary: "rounded-lg border border-white/40 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors",
  ghost:     "px-6 py-3 text-sm font-semibold text-white/70 hover:text-white transition-colors underline-offset-4 hover:underline",
};

// ── Sub-componenten ───────────────────────────────────────────────────────────

function HeroTag({ tag }: { tag: string }) {
  return (
    <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-white/80 mb-4">
      {tag}
    </span>
  );
}

function HeroCTAs({ ctas }: { ctas: CtaLink[] }) {
  if (!ctas.length) return null;
  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
      {ctas.map((cta, i) => (
        <Link
          key={i}
          href={cta.href}
          className={CTA_STYLES[cta.variant ?? (i === 0 ? "primary" : "secondary")]}
        >
          {cta.label}
        </Link>
      ))}
    </div>
  );
}

function HeroMedia({ image }: { image: AdaptiveHeroImage }) {
  const src = image.asset.url;
  if (!src) return null;

  return (
    <div className="mt-12 mx-auto max-w-3xl overflow-hidden rounded-xl shadow-2xl shadow-black/40">
      <Image
        src={src}
        alt={image.alt}
        width={1200}
        height={630}
        className="w-full object-cover"
        priority
      />
    </div>
  );
}

// ── ChameleonHero ─────────────────────────────────────────────────────────────

/**
 * Rendert een adaptive hero-sectie op basis van het Mr. Chameleon-variant-systeem.
 *
 * - Server Component — geen client-side hydration vereist.
 * - SEO-safe — bots ontvangen altijd de defaultVariant.
 * - Token-aware — title/subtitle/tag worden gepersonaliseerd voor echte bezoekers.
 */
export function ChameleonHero({
  data,
  variantKey,
  tokenContext,
  isBot = false,
}: ChameleonHeroProps) {

  // Blok uitgeschakeld → niets renderen.
  if (!data.is_active) return null;

  // 1. Kies de juiste variant (of default).
  const { content: raw, isDefault } = selectVariant(data, variantKey, isBot);

  // 2. Vervang tokens (alleen voor adaptieve varianten, nooit voor de default).
  const content = applyTokens(raw, tokenContext, isDefault);

  return (
    <section
      className="relative overflow-hidden bg-gray-900 py-24 px-6 text-center text-white"
      // data-variant wordt gebruikt door analytics en Playwright-tests
      // om te verifiëren welke variant is gerenderd.
      data-variant={isDefault ? "default" : (variantKey ?? "default")}
      data-block-key={data.key.current}
    >
      {/* Decoratieve achtergrond-gradient */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--primary)]/20 via-transparent to-transparent"
      />

      <div className="relative mx-auto max-w-3xl">
        {/* Eyebrow badge */}
        {content.tag && <HeroTag tag={content.tag} />}

        {/* Koptekst — h1 voor homepage, h2 voor ingebedde blokken */}
        <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
          {content.title}
        </h1>

        {/* Subtekst */}
        <p className="mt-6 text-lg leading-relaxed text-white/70 sm:text-xl">
          {content.subtitle}
        </p>

        {/* CTA-knoppen */}
        <HeroCTAs ctas={content.ctas ?? []} />
      </div>

      {/* Optionele hero-afbeelding */}
      {content.image && <HeroMedia image={content.image} />}
    </section>
  );
}
