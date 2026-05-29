import type { Meta, StoryObj } from "@storybook/react";
import { CTABlock } from "./CTABlock";

// ── Responsive viewport presets ───────────────────────────────────────────────

const RESPONSIVE_VIEWPORTS = {
  mobile:  { name: "Mobile  (375 × 812)",  styles: { width: "375px",  height: "812px"  } },
  tablet:  { name: "Tablet  (768 × 1024)", styles: { width: "768px",  height: "1024px" } },
  desktop: { name: "Desktop (1280 × 900)", styles: { width: "1280px", height: "900px"  } },
};

// ── Shared fixture data ───────────────────────────────────────────────────────

const defaultCta = { label: "Get started free", href: "#" };

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta: Meta<typeof CTABlock> = {
  title:     "Blocks/CTA",
  component: CTABlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    viewport: {
      viewports: RESPONSIVE_VIEWPORTS,
    },
    docs: {
      description: {
        component:
          "Bottom-of-page conversion block with three layout variants: " +
          "`cta_banner` (full-width brand background, centered), " +
          "`cta_split` (text left, button right; stacks on mobile), and " +
          "`cta_card` (elevated card on subtle section background). " +
          "Mobile-first: `cta_split` stacks text above button on small screens.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof CTABlock>;

// ── Stories — all variants at desktop ─────────────────────────────────────────

export const Banner: Story = {
  name: "Banner — full-width brand background",
  args: {
    title:         "Ready to get started?",
    text:          "Join thousands of teams already using our platform to ship faster and smarter.",
    cta:           defaultCta,
    layoutVariant: "cta_banner",
  },
};

export const Split: Story = {
  name: "Split — text left, button right",
  args: {
    title:         "Ready to get started?",
    text:          "Join thousands of teams already using our platform to ship faster and smarter.",
    cta:           defaultCta,
    layoutVariant: "cta_split",
  },
};

export const Card: Story = {
  name: "Card — elevated on neutral background",
  args: {
    title:         "Start your free trial today",
    text:          "No credit card required. Cancel any time. Full feature access for 14 days.",
    cta:           { label: "Start free trial", href: "#" },
    layoutVariant: "cta_card",
  },
};

// ── Responsive viewport stories ───────────────────────────────────────────────

export const BannerMobile: Story = {
  name: "Banner — mobile (375px)",
  args: {
    title:         "Ready to get started?",
    text:          "Join thousands of teams already using our platform to ship faster and smarter.",
    cta:           defaultCta,
    layoutVariant: "cta_banner",
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};

export const SplitMobile: Story = {
  name: "Split — mobile (375px) — stacked",
  args: {
    title:         "Ready to get started?",
    text:          "Join thousands of teams already using our platform to ship faster and smarter.",
    cta:           defaultCta,
    layoutVariant: "cta_split",
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};

export const SplitTablet: Story = {
  name: "Split — tablet (768px)",
  args: {
    title:         "Ready to get started?",
    text:          "Join thousands of teams already using our platform to ship faster and smarter.",
    cta:           defaultCta,
    layoutVariant: "cta_split",
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};

export const CardMobile: Story = {
  name: "Card — mobile (375px)",
  args: {
    title:         "Start your free trial today",
    text:          "No credit card required. Cancel any time. Full feature access for 14 days.",
    cta:           { label: "Start free trial", href: "#" },
    layoutVariant: "cta_card",
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};
