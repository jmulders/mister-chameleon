/**
 * ThemePreviewScene
 *
 * A self-contained page composition used exclusively for theme previews.
 * Renders HeroBlock + FeatureGridBlock + CTABlock with content and layout
 * variants tailored to each theme's visual family.
 *
 * ─── Design goal ─────────────────────────────────────────────────────────────
 *
 *   Each theme should feel like a distinct template, not just a colour swap.
 *   THEME_HERO_CONFIGS maps every preset key to:
 *     • a hero layout variant  (hero_split_clean / hero_background / hero_editorial …)
 *     • thematic copy          (recruitment, healthcare, corporate, editorial …)
 *     • optional photo         (picsum seed, dimensions, content-align)
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   presetKey  Optional  Theme preset key (e.g. "corporate-blue").
 *              Looked up in THEME_HERO_CONFIGS to drive layout, copy, and
 *              photo.  Falls back to DEFAULT_HERO_CONFIG when absent or
 *              unknown — no regression for existing usages.
 */

import type { HeroBannerImage } from "@/cms/types";
import { HeroBlock }        from "@/components/blocks/HeroBlock";
import { FeatureGridBlock } from "@/components/blocks/sections/FeatureGridBlock";
import { CTABlock }         from "@/components/blocks/CTABlock";

// ── Picsum helper ─────────────────────────────────────────────────────────────

function picsumUrl(seed: string, w: number, h: number): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
}

// ── Per-theme hero configuration ──────────────────────────────────────────────
//
// Each entry drives:
//   layout  — which HeroBlock layout variant to use
//   tag     — eyebrow badge text
//   title   — main headline  (use \n for intentional line breaks)
//   sub     — supporting paragraph
//   align   — content alignment in hero_background (default: "center")
//   photo   — true = pass a picsum photo as media; false = no photo (text-only)
//   seed    — override the picsum seed (defaults to the presetKey)

interface HeroCfg {
  layout:  string;
  tag:     string;
  title:   string;
  sub:     string;
  align?:  "left" | "center" | "right";
  photo:   boolean;
  seed?:   string;
}

const THEME_HERO_CONFIGS: Record<string, HeroCfg> = {

  // ── Corporate / business ───────────────────────────────────────────────────

  "corporate-blue": {
    layout: "hero_split_clean",
    tag:    "Enterprise solutions",
    title:  "Grow your business\nwith confidence",
    sub:    "Streamlined workflows, accurate reporting, and tools your whole team will actually use.",
    photo:  true,
  },
  "corporate-trust": {
    layout: "hero_split_clean",
    tag:    "Built for trust",
    title:  "The platform your clients depend on",
    sub:    "Professional-grade tools that make your business look as good as it performs.",
    photo:  true,
  },
  "corporate-clean": {
    layout: "hero_split_clean",
    tag:    "Clean. Simple. Effective.",
    title:  "Less complexity.\nMore results.",
    sub:    "A clear, focused platform for teams that value clarity over clutter.",
    photo:  true,
  },

  // ── SaaS / Tech ────────────────────────────────────────────────────────────

  "modern-saas": {
    layout: "hero_dark_split",
    tag:    "Modern SaaS platform",
    title:  "Ship features,\nnot firefights",
    sub:    "The developer platform that scales with your product from MVP to millions of users.",
    photo:  true,
  },
  "tech-indigo": {
    layout: "hero_minimal_dark",
    tag:    "Next-gen infrastructure",
    title:  "Code less.\nScale more.",
    sub:    "AI-powered tooling that turns complex architecture decisions into one-click deploys.",
    photo:  false,
  },
  "modern-green": {
    layout: "hero_dark_split",
    tag:    "Built for engineers",
    title:  "From zero to production\nin minutes",
    sub:    "A platform your engineers love and your managers trust — from first sprint to global scale.",
    photo:  true,
  },

  // ── Bold / Marketing ───────────────────────────────────────────────────────

  "bold-dark": {
    layout: "hero_background",
    tag:    "Bold by design",
    title:  "Make an impact",
    sub:    "High-contrast branding that commands attention and drives conversion.",
    align:  "center",
    photo:  true,
  },
  "bold-marketing": {
    layout: "hero_background",
    tag:    "Campaigns that convert",
    title:  "Turn visitors\ninto customers",
    sub:    "A powerful marketing platform built for ambitious growth teams and performance-first brands.",
    align:  "left",
    photo:  true,
  },
  "dark-contrast": {
    layout: "hero_minimal_dark",
    tag:    "High contrast · High impact",
    title:  "Design that demands attention",
    sub:    "Maximum contrast, premium feel. Built for brands that refuse to blend in.",
    photo:  false,
  },

  // ── Editorial / Premium ────────────────────────────────────────────────────

  "premium-editorial": {
    layout: "hero_editorial",
    tag:    "Editorial excellence",
    title:  "Stories worth reading",
    sub:    "A refined publishing platform for brands that take content as seriously as design.",
    photo:  false,
  },
  "editorial-classic": {
    layout: "hero_editorial",
    tag:    "Classic editorial",
    title:  "Timeless writing.\nModern platform.",
    sub:    "Elegant typography and considered layout for publications that respect their readers.",
    photo:  false,
  },
  "portfolio-showcase": {
    layout: "hero_editorial",
    tag:    "Creative portfolio",
    title:  "Your work,\nbeautifully presented",
    sub:    "A showcase-first platform for designers, photographers, and creative studios.",
    photo:  false,
  },

  // ── Startup / Energy ───────────────────────────────────────────────────────

  "startup-energy": {
    layout: "hero_background",
    tag:    "Move fast",
    title:  "Build the thing\nyou've been putting off",
    sub:    "All the infrastructure of a funded startup — available to you from day one.",
    align:  "left",
    photo:  true,
  },
  "playful-startup": {
    layout: "hero_background",
    tag:    "Early stage? No problem.",
    title:  "Your big idea\ndeserves a great home",
    sub:    "Colourful, energetic, and built to help new ventures make a memorable first impression.",
    align:  "center",
    photo:  true,
  },

  // ── Recruitment / Careers ──────────────────────────────────────────────────

  "recruitment-energy": {
    layout: "hero_background",
    tag:    "Talent acquisition",
    title:  "Find your next\nstar hire",
    sub:    "A recruitment platform that makes your employer brand as strong as your culture.",
    align:  "left",
    photo:  true,
    seed:   "recruitment-energy-people",
  },
  "careers-human": {
    layout: "hero_split",
    tag:    "People-first hiring",
    title:  "Work that feels human",
    sub:    "Authentic employer branding and career pages that attract the right people for the right reasons.",
    photo:  true,
    seed:   "careers-human-team",
  },

  // ── Healthcare ─────────────────────────────────────────────────────────────

  "healthcare-calm": {
    layout: "hero_split_clean",
    tag:    "Healthcare solutions",
    title:  "Care that starts\nbefore the appointment",
    sub:    "A calm, reassuring digital experience for patients who deserve better than the status quo.",
    photo:  true,
    seed:   "healthcare-calm-medical",
  },

  // ── Industrial ─────────────────────────────────────────────────────────────

  "industrial-strong": {
    layout: "hero_background",
    tag:    "Built tough",
    title:  "Reliable systems\nfor demanding work",
    sub:    "Engineered for the industries that keep the world running. No nonsense, no downtime.",
    align:  "left",
    photo:  true,
    seed:   "industrial-strong-factory",
  },

  // ── Luxury ─────────────────────────────────────────────────────────────────

  "premium-luxury": {
    layout: "hero_background",
    tag:    "Exclusive",
    title:  "Crafted for those who\nknow the difference",
    sub:    "A luxury digital experience where every detail — from typeface to interaction — is considered.",
    align:  "center",
    photo:  true,
    seed:   "premium-luxury-interior",
  },

  // ── Professional / Warm ────────────────────────────────────────────────────

  "warm-professional": {
    layout: "hero_split",
    tag:    "Professional services",
    title:  "Expertise you can trust",
    sub:    "Warm, approachable, and deeply professional. The platform for consultants and service businesses.",
    photo:  true,
  },

  // ── Minimal / Neutral ──────────────────────────────────────────────────────

  "minimal-neutral": {
    layout: "hero_editorial",
    tag:    "Less is more",
    title:  "Clarity above all",
    sub:    "A stripped-back, content-first experience for brands that let their work do the talking.",
    photo:  false,
  },

  // ── Seasonal ───────────────────────────────────────────────────────────────

  "valentine-pink": {
    layout: "hero_background",
    tag:    "Valentine's Day campaign",
    title:  "Celebrate\nwhat matters most",
    sub:    "Seasonal campaigns that feel warm, personal, and perfectly on-brand.",
    align:  "center",
    photo:  true,
    seed:   "valentine-pink-flowers",
  },
  "dutch-orange": {
    layout: "hero_background",
    tag:    "Koningsdag · Dutch Pride",
    title:  "Oranje boven",
    sub:    "Seizoenscampagnes in de kleuren van Nederland. Feestelijk, herkenbaar en vol energie.",
    align:  "center",
    photo:  true,
    seed:   "dutch-orange-celebration",
  },
};

// Fallback for any preset key not yet in the map above.
const DEFAULT_HERO_CFG: HeroCfg = {
  layout: "hero_background",
  tag:    "New — Theme Preview",
  title:  "Build your next great product",
  sub:    "Everything your team needs to ship faster, collaborate better, and delight your customers.",
  align:  "center",
  photo:  true,
};

// ── Shared feature / CTA mock content ────────────────────────────────────────

const FEATURE_DATA = {
  heading:  "Why teams choose us",
  features: [
    {
      title:       "Blazing-fast setup",
      description: "Go from sign-up to your first deployment in under five minutes. No infrastructure expertise required.",
      icon:        "⚡",
    },
    {
      title:       "Built-in collaboration",
      description: "Comments, mentions, and real-time cursors so your whole team stays in sync without switching apps.",
      icon:        "🤝",
    },
    {
      title:       "Enterprise-grade security",
      description: "SOC 2 Type II certified, end-to-end encryption, and granular role-based access controls.",
      icon:        "🔒",
    },
  ],
} satisfies Parameters<typeof FeatureGridBlock>[0]["data"];

const CTA_PROPS = {
  title: "Ready to ship faster?",
  text:  "Join thousands of teams already building with us. Start your free trial today — no credit card required.",
  cta:   { label: "Get started free", href: "#" },
} satisfies Parameters<typeof CTABlock>[0];

// ── Shared CTAs ───────────────────────────────────────────────────────────────

const HERO_CTAS = [
  { label: "Start for free",   href: "#" },
  { label: "See how it works", href: "#", variant: "secondary" as const },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export interface ThemePreviewSceneProps {
  /**
   * Theme preset key (e.g. "corporate-blue", "modern-saas").
   *
   * Looked up in THEME_HERO_CONFIGS to select a structurally distinct hero
   * layout variant, thematic copy, and an appropriate background photo.
   *
   * When absent the component falls back to DEFAULT_HERO_CFG — the generic
   * hero_background layout used before per-theme configs were added.
   */
  presetKey?: string;
}

export function ThemePreviewScene({ presetKey }: ThemePreviewSceneProps = {}) {
  const cfg = (presetKey && THEME_HERO_CONFIGS[presetKey]) || DEFAULT_HERO_CFG;

  // Build picsum photo — use cfg.seed override when provided, else presetKey.
  const photoSeed = cfg.seed ?? presetKey ?? "preview";

  // Split / dark-split panels look best with a 4:3 landscape crop.
  // Background variants fill the full 16:9 viewport.
  const isBgLayout   = cfg.layout === "hero_background";
  const isSplitLayout =
    cfg.layout === "hero_split" ||
    cfg.layout === "hero_split_clean" ||
    cfg.layout === "hero_dark_split";

  const heroMedia: HeroBannerImage | undefined =
    cfg.photo && (isBgLayout || isSplitLayout)
      ? {
          kind: "image" as const,
          url:  picsumUrl(photoSeed, isBgLayout ? 1280 : 800, isBgLayout ? 720 : 600),
          alt:  "",
        }
      : undefined;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg, #ffffff)" }}>
      <HeroBlock
        tag={cfg.tag}
        title={cfg.title}
        subtitle={cfg.sub}
        ctas={HERO_CTAS}
        layoutVariant={cfg.layout}
        contentAlign={cfg.align ?? "center"}
        media={heroMedia}
      />
      <FeatureGridBlock data={FEATURE_DATA} />
      <CTABlock         {...CTA_PROPS} />
    </div>
  );
}
