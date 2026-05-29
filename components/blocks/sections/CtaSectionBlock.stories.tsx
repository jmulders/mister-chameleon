import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CtaSectionBlock } from "./CtaSectionBlock";
import type { CtaSectionBlockData } from "@/page-config";

// ── Shared fixture data ────────────────────────────────────────────────────────

const baseData: CtaSectionBlockData = {
  title:       "Ready to get started?",
  description: "Join thousands of teams already using the platform. No credit card required.",
  primaryCta:   { label: "Start for free",  href: "/signup" },
  secondaryCta: { label: "Book a demo",     href: "/demo" },
};

const splitData: CtaSectionBlockData = {
  title:       "Transform how your team works",
  description: "Centralise your workflows and reduce context switching with a unified workspace.",
  primaryCta:   { label: "Get started",  href: "/signup" },
  secondaryCta: { label: "See pricing",  href: "/pricing" },
};

const bannerDefaultData: CtaSectionBlockData = {
  title:       "New: AI-powered reports are here",
  description: "Automatically summarise your data into shareable reports.",
  primaryCta:   { label: "Try it now",  href: "/ai-reports" },
  secondaryCta: { label: "Learn more",  href: "/docs/ai-reports" },
};

const bannerCompactData: CtaSectionBlockData = {
  title:       "🎉 Launch week — 30% off all plans",
  primaryCta:   { label: "Claim offer", href: "/pricing" },
};

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta: Meta<typeof CtaSectionBlock> = {
  title:     "Blocks/Sections/CtaSection",
  component: CtaSectionBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Call-to-action block with 8 variants: `cta_banner` (brand centred), " +
          "`cta_split` (text left / CTAs right), `cta_card` (elevated card on neutral), " +
          "`cta_banner_default` (compact horizontal bar), `cta_banner_compact` " +
          "(notification-bar on brand bg), `cta_glow` (near-black with brand radial glow — Dark AI), " +
          "`cta_soft` (light neutral, copy-led — Clean Corporate), and " +
          "`cta_newsletter` (email capture form — Content Blog).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof CtaSectionBlock>;

// ── Stories ───────────────────────────────────────────────────────────────────

export const BannerDefault: Story = {
  name: "cta_banner (default brand centred)",
  args: {
    data:    baseData,
    variant: "cta_banner",
  },
};

export const CtaSplit: Story = {
  name: "cta_split (heading left / CTAs right)",
  args: {
    data:    splitData,
    variant: "cta_split",
  },
};

export const CtaCard: Story = {
  name: "cta_card (elevated card)",
  args: {
    data:    baseData,
    variant: "cta_card",
  },
};

export const BannerSoft: Story = {
  name: "cta_banner_default (compact soft bar)",
  args: {
    data:    bannerDefaultData,
    variant: "cta_banner_default",
  },
};

export const BannerCompact: Story = {
  name: "cta_banner_compact (notification bar)",
  args: {
    data:    bannerCompactData,
    variant: "cta_banner_compact",
  },
};

export const SingleCTA: Story = {
  name: "Single CTA (no secondary)",
  args: {
    data: {
      title:       "Ready to get started?",
      description: "Sign up in under 2 minutes.",
      primaryCta:  { label: "Start for free", href: "/signup" },
    },
    variant: "cta_banner",
  },
};

export const NoTitle: Story = {
  name: "No title (description only)",
  args: {
    data: {
      description: "Unlock all features — no credit card required.",
      primaryCta:   { label: "Get started",  href: "/signup" },
      secondaryCta: { label: "View pricing", href: "/pricing" },
    },
    variant: "cta_split",
  },
};

// ── New variant stories ────────────────────────────────────────────────────────

/**
 * cta_glow — near-black section with a vivid brand-coloured radial glow.
 * Dark AI family signature variant.
 */
export const CtaGlow: Story = {
  name: "cta_glow — dark section, brand radial glow (Dark AI)",
  args: {
    data: {
      title:       "The AI platform built for speed",
      description: "Deploy intelligent workflows in hours, not months. No ML expertise required.",
      primaryCta:   { label: "Start building",  href: "/signup" },
      secondaryCta: { label: "View the docs",   href: "/docs"   },
    },
    variant: "cta_glow",
  },
};

export const CtaGlowSingle: Story = {
  name: "cta_glow — single CTA",
  args: {
    data: {
      title:     "Ship your first AI feature today",
      primaryCta: { label: "Get started free", href: "/signup" },
    },
    variant: "cta_glow",
  },
};

/**
 * cta_soft — very light neutral section; copy-led; primary + ghost secondary.
 * Clean Corporate family signature variant.
 */
export const CtaSoft: Story = {
  name: "cta_soft — light neutral, copy-led (Clean Corporate)",
  args: {
    data: {
      title:       "Ready to improve how your team works?",
      description: "Join over 2,000 teams that have simplified their workflows and reduced delivery time.",
      primaryCta:   { label: "Request a demo",  href: "/demo"   },
      secondaryCta: { label: "See case studies", href: "/stories" },
    },
    variant: "cta_soft",
  },
};

export const CtaSoftNoCopy: Story = {
  name: "cta_soft — title only, single CTA",
  args: {
    data: {
      title:      "Start your 14-day free trial",
      primaryCta: { label: "Create account", href: "/signup" },
    },
    variant: "cta_soft",
  },
};

/**
 * cta_newsletter — inline email capture; heading left, input + submit right.
 * Content Blog / content-first family variant.
 */
export const CtaNewsletter: Story = {
  name: "cta_newsletter — email capture (Content Blog)",
  args: {
    data: {
      title:       "Stay in the loop",
      description: "Get the latest posts, tutorials, and product updates straight to your inbox. No spam, ever.",
    },
    variant: "cta_newsletter",
  },
};

export const CtaNewsletterNoDescription: Story = {
  name: "cta_newsletter — title only",
  args: {
    data: { title: "Get weekly insights from our team" },
    variant: "cta_newsletter",
  },
};
