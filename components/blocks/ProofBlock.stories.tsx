import type { Meta, StoryObj } from "@storybook/react";
import { ProofBlock } from "./ProofBlock";

// ── Responsive viewport presets ───────────────────────────────────────────────

const RESPONSIVE_VIEWPORTS = {
  mobile:  { name: "Mobile  (375 × 812)",  styles: { width: "375px",  height: "812px"  } },
  tablet:  { name: "Tablet  (768 × 1024)", styles: { width: "768px",  height: "1024px" } },
  desktop: { name: "Desktop (1280 × 900)", styles: { width: "1280px", height: "900px"  } },
};

// ── Fixture data ──────────────────────────────────────────────────────────────

const statItems = [
  { title: "10,000+", text: "companies onboarded in the last 12 months" },
  { title: "99.9%",   text: "uptime SLA across all regions globally"     },
  { title: "< 5 min", text: "average time from sign-up to first value"   },
];

const logoItems = [
  { title: "Acme Corp",   text: "Global enterprise partner"        },
  { title: "Globex",      text: "Manufacturing & supply chain"     },
  { title: "Initech",     text: "Financial services leader"        },
  { title: "Umbrella Co", text: "Life sciences and biotech"        },
  { title: "Soylent",     text: "Consumer goods and retail"        },
  { title: "Massive Dyn", text: "Technology and infrastructure"    },
];

const quoteItems = [
  {
    title: "This platform cut our release cycle in half. We shipped 30 % more features this quarter.",
    text:  "— Alex Kim, VP Engineering at Acme Corp",
  },
  {
    title: "The onboarding was effortless. Our team was productive from day one with zero training.",
    text:  "— Sam Rivera, Head of Product at Globex",
  },
  {
    title: "Finally a tool that works the way our team thinks. Support is also genuinely excellent.",
    text:  "— Jordan Lee, CTO at Initech",
  },
];

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta: Meta<typeof ProofBlock> = {
  title:     "Blocks/Proof",
  component: ProofBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    viewport: {
      viewports: RESPONSIVE_VIEWPORTS,
    },
    docs: {
      description: {
        component:
          "Social-proof section block with three layout variants: " +
          "`proof_stats` (headline metric row), " +
          "`proof_logos` (flex-wrap logo strip), and " +
          "`proof_quotes` (testimonial card grid). " +
          "Mobile-first: logo strip wraps naturally; quote grid collapses to 1 col.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ProofBlock>;

// ── Stories — all variants at desktop ─────────────────────────────────────────

export const Stats: Story = {
  name: "Stats (default) — key metrics row",
  args: {
    title:         "Trusted by thousands of teams worldwide",
    items:         statItems,
    layoutVariant: "proof_stats",
  },
};

export const Logos: Story = {
  name: "Logos — client / partner strip",
  args: {
    title:         "Powering teams at",
    items:         logoItems,
    layoutVariant: "proof_logos",
  },
};

export const Quotes: Story = {
  name: "Quotes — testimonial card grid",
  args: {
    title:         "What our customers say",
    items:         quoteItems,
    layoutVariant: "proof_quotes",
  },
};

// ── Responsive viewport stories ───────────────────────────────────────────────

export const StatsMobile: Story = {
  name: "Stats — mobile (375px)",
  args: {
    title:         "Trusted by thousands of teams worldwide",
    items:         statItems,
    layoutVariant: "proof_stats",
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};

export const StatsTablet: Story = {
  name: "Stats — tablet (768px)",
  args: {
    title:         "Trusted by thousands of teams worldwide",
    items:         statItems,
    layoutVariant: "proof_stats",
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};

export const LogosMobile: Story = {
  name: "Logos — mobile (375px)",
  args: {
    title:         "Powering teams at",
    items:         logoItems,
    layoutVariant: "proof_logos",
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};

export const QuotesMobile: Story = {
  name: "Quotes — mobile (375px)",
  args: {
    title:         "What our customers say",
    items:         quoteItems,
    layoutVariant: "proof_quotes",
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};

export const QuotesTablet: Story = {
  name: "Quotes — tablet (768px)",
  args: {
    title:         "What our customers say",
    items:         quoteItems,
    layoutVariant: "proof_quotes",
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
