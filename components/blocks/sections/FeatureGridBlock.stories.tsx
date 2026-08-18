import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FeatureGridBlock } from "./FeatureGridBlock";
import type { FeatureGridBlockData } from "@/page-config";

// ── Responsive viewport presets ───────────────────────────────────────────────

const RESPONSIVE_VIEWPORTS = {
  mobile:  { name: "Mobile  (375 × 812)",  styles: { width: "375px",  height: "812px"  } },
  tablet:  { name: "Tablet  (768 × 1024)", styles: { width: "768px",  height: "1024px" } },
  desktop: { name: "Desktop (1280 × 900)", styles: { width: "1280px", height: "900px"  } },
};

// ── Fixture data ──────────────────────────────────────────────────────────────

const threeFeatures: FeatureGridBlockData = {
  heading:  "Why teams choose us",
  features: [
    {
      icon:        "⚡",
      title:       "Blazing fast",
      description: "Built for performance from the ground up. Pages load in under 200 ms globally.",
    },
    {
      icon:        "🔒",
      title:       "Enterprise-grade security",
      description: "SOC 2 Type II certified. Data encrypted at rest and in transit at all times.",
    },
    {
      icon:        "🔌",
      title:       "Extensible by design",
      description: "Connect any tool in your stack via our open API and 50+ native integrations.",
    },
  ],
};

const sixFeatures: FeatureGridBlockData = {
  heading:  "Everything your team needs",
  features: [
    ...threeFeatures.features!,
    {
      icon:        "📊",
      title:       "Powerful analytics",
      description: "Real-time dashboards with drill-down reporting and CSV export.",
    },
    {
      icon:        "🤝",
      title:       "Team collaboration",
      description: "Comments, mentions, and shared workspaces keep everyone aligned.",
    },
    {
      icon:        "🌍",
      title:       "Global CDN",
      description: "Content served from 40+ edge locations worldwide.",
    },
  ],
};

const eightFeatures: FeatureGridBlockData = {
  heading:  "Feature overview",
  features: [
    ...sixFeatures.features!,
    {
      icon:        "🔔",
      title:       "Smart notifications",
      description: "Only get notified when it matters — fully configurable per channel.",
    },
    {
      icon:        "🎨",
      title:       "White-label ready",
      description: "Apply your brand colours, logo, and domain in minutes.",
    },
  ],
};

const noIcons: FeatureGridBlockData = {
  heading:  "Core capabilities",
  features: threeFeatures.features!.map(({ title, description }) => ({ title, description })),
};

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta: Meta<typeof FeatureGridBlock> = {
  title:     "Blocks/Sections/FeatureGrid",
  component: FeatureGridBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    viewport: {
      viewports: RESPONSIVE_VIEWPORTS,
    },
    docs: {
      description: {
        component:
          "Feature grid block with four layout variants: " +
          "`default` (3-col bordered cards on subtle bg), " +
          "`cards` (elevated shadow cards on white), " +
          "`compact` (2-col dense grid), " +
          "`icons-left` (horizontal icon + text rows), and " +
          "`feature_grid_4up` (4-col grid for larger feature sets). " +
          "Mobile-first: grids collapse to 1 col at 375px.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof FeatureGridBlock>;

// ── Stories ───────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: "Default (3-col bordered cards)",
  args: {
    data:    threeFeatures,
    variant: "default",
  },
};

export const Cards: Story = {
  name: "Cards (elevated, on white)",
  args: {
    data:    threeFeatures,
    variant: "cards",
  },
};

export const Compact: Story = {
  name: "Compact (2-col dense grid)",
  args: {
    data:    sixFeatures,
    variant: "compact",
  },
};

export const IconsLeft: Story = {
  name: "Icons left (checklist rows)",
  args: {
    data:    sixFeatures,
    variant: "icons-left",
  },
};

export const FourUp: Story = {
  name: "4-up grid (feature_grid_4up)",
  args: {
    data:    eightFeatures,
    variant: "feature_grid_4up",
  },
};

export const NoHeading: Story = {
  name: "No heading",
  args: {
    data:    { features: threeFeatures.features },
    variant: "default",
  },
};

export const NoIcons: Story = {
  name: "No icons",
  args: {
    data:    noIcons,
    variant: "default",
  },
};

export const CanonicalChecklist: Story = {
  name: "Canonical: feature_grid_checklist",
  args: {
    data:    sixFeatures,
    variant: "feature_grid_checklist",
  },
};

// ── Responsive viewport stories ───────────────────────────────────────────────
//
// Lock specific stories to a viewport to QA column-collapse behaviour and
// card padding changes across breakpoints.

export const DefaultMobile: Story = {
  name: "Default (3-col) — mobile (375px)",
  args: {
    data:    threeFeatures,
    variant: "default",
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};

export const DefaultTablet: Story = {
  name: "Default (3-col) — tablet (768px)",
  args: {
    data:    threeFeatures,
    variant: "default",
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};

export const CardsMobile: Story = {
  name: "Cards — mobile (375px)",
  args: {
    data:    threeFeatures,
    variant: "cards",
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};

export const CompactMobile: Story = {
  name: "Compact (2-col) — mobile (375px)",
  args: {
    data:    sixFeatures,
    variant: "compact",
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};

export const IconsLeftMobile: Story = {
  name: "Icons left — mobile (375px)",
  args: {
    data:    sixFeatures,
    variant: "icons-left",
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};

export const FourUpMobile: Story = {
  name: "4-up grid — mobile (375px)",
  args: {
    data:    eightFeatures,
    variant: "feature_grid_4up",
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};

// ── CTA stories ───────────────────────────────────────────────────────────────

const withPrimaryCTA: FeatureGridBlockData = {
  ...threeFeatures,
  cta: { label: "See all features", href: "/features", variant: "primary" },
};

const withOutlineCTA: FeatureGridBlockData = {
  ...threeFeatures,
  cta: { label: "Learn more", href: "/about", variant: "outline" },
};

const withLinkCTA: FeatureGridBlockData = {
  ...threeFeatures,
  cta: { label: "View full feature list →", href: "/features", variant: "link" },
};

export const WithCTAPrimary: Story = {
  name: "With CTA — primary button",
  args: {
    data:    withPrimaryCTA,
    variant: "default",
  },
};

export const WithCTAOutline: Story = {
  name: "With CTA — outline button",
  args: {
    data:    withOutlineCTA,
    variant: "cards",
  },
};

export const WithCTALink: Story = {
  name: "With CTA — link style",
  args: {
    data:    withLinkCTA,
    variant: "icons-left",
  },
};

// ── feature_spotlight stories ──────────────────────────────────────────────────

const spotlightPhotoMedia = {
  kind: "image" as const, source: "asset" as const,
  url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80", fit: "cover" as const,
};

const spotlightPriceAndCta: FeatureGridBlockData = {
  heading: "Uitgelicht aanbod",
  features: [{
    title: "Bakwagen op maat", description: "Robuuste bakwagen, geremd, klaar voor zwaar werk. Achteraf om te bouwen in onze werkplaats.",
    price: "vanaf €1.250", ctaLabel: "Offerte aanvragen", ctaHref: "/contact", media: spotlightPhotoMedia,
  }],
};

const spotlightPriceOnly: FeatureGridBlockData = {
  heading: "Alleen prijs, geen knop",
  features: [{ title: "Tuinaanhanger", description: "Licht en wendbaar voor thuis en tuin.", price: "vanaf €650", media: spotlightPhotoMedia }],
};

const spotlightCtaOnly: FeatureGridBlockData = {
  heading: "Alleen knop, geen prijs",
  features: [{ title: "Maatwerk", description: "Vertel ons wat u nodig heeft, wij bouwen het.", ctaLabel: "Start maatwerk", ctaHref: "/contact", media: spotlightPhotoMedia }],
};

const spotlightBare: FeatureGridBlockData = {
  heading: "Geen prijs, geen knop",
  features: [{ title: "Onze werkplaats", description: "Onderhoud, reparatie en ombouw onder een dak.", media: spotlightPhotoMedia }],
};

const spotlightSlider: FeatureGridBlockData = {
  heading: "Meerdere aanbiedingen",
  features: [spotlightPriceAndCta.features![0], spotlightCtaOnly.features![0], spotlightBare.features![0]],
};

export const SpotlightPriceAndCta: Story = {
  name: "Spotlight — price + CTA",
  args: { data: spotlightPriceAndCta, variant: "feature_spotlight" },
};
export const SpotlightPriceOnly: Story = {
  name: "Spotlight — price only",
  args: { data: spotlightPriceOnly, variant: "feature_spotlight" },
};
export const SpotlightCtaOnly: Story = {
  name: "Spotlight — CTA only",
  args: { data: spotlightCtaOnly, variant: "feature_spotlight" },
};
export const SpotlightBare: Story = {
  name: "Spotlight — no price, no CTA",
  args: { data: spotlightBare, variant: "feature_spotlight" },
};
export const SpotlightSlider: Story = {
  name: "Spotlight — slider (3 offers)",
  args: { data: spotlightSlider, variant: "feature_spotlight" },
};
