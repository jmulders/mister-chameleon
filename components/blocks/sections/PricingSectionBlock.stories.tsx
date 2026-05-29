import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PricingSectionBlock } from "./PricingSectionBlock";
import type { PricingSectionBlockData } from "@/page-config";

// ── Mock tiers ────────────────────────────────────────────────────────────────

const tiers = [
  {
    name:        "Starter",
    price:       "€0",
    period:      "/ month",
    description: "Get started for free. No credit card required.",
    features:    [
      "1 workspace",
      "Up to 3 team members",
      "5 GB storage",
      "Email support",
    ],
    ctaLabel:    "Get started",
    ctaHref:     "#",
    highlighted: false,
  },
  {
    name:        "Pro",
    price:       "€49",
    period:      "/ month",
    description: "For growing teams that need more power and integrations.",
    features:    [
      "5 workspaces",
      "Unlimited team members",
      "50 GB storage",
      "Priority email & chat support",
      "Custom domains",
      "Advanced analytics",
    ],
    ctaLabel:    "Start free trial",
    ctaHref:     "#",
    highlighted: true,
    badge:       "Most popular",
  },
  {
    name:        "Enterprise",
    price:       "Custom",
    period:      undefined,
    description: "Tailored for large organisations with specific compliance and SLA needs.",
    features:    [
      "Unlimited workspaces",
      "SSO / SAML",
      "Dedicated SLA",
      "Custom contracts",
      "Onboarding & training",
      "99.99 % uptime SLA",
    ],
    ctaLabel:    "Talk to sales",
    ctaHref:     "#",
    highlighted: false,
  },
] as const;

const base: PricingSectionBlockData = {
  heading:    "Simple, transparent pricing",
  subheading: "Start free, scale when you are ready. No hidden fees.",
  tiers:      [...tiers],
  footnote:   "Prices exclude VAT. Annual billing available at 20 % discount.",
};

// ── Meta ───────────────────────────────────────────────────────────────────────

const meta: Meta<typeof PricingSectionBlock> = {
  title:     "Blocks/Sections/PricingSection",
  component: PricingSectionBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Pricing tiers section. Three variants: pricing_tiers (elevated card grid), pricing_compact (row list with inline price), pricing_table (feature comparison table).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof PricingSectionBlock>;

// ── Stories ────────────────────────────────────────────────────────────────────

export const Tiers: Story = {
  name: "pricing_tiers — elevated card grid (default)",
  args: { data: base, variant: "pricing_tiers" },
};

export const Compact: Story = {
  name: "pricing_compact — row list with inline price",
  args: { data: base, variant: "pricing_compact" },
};

export const Table: Story = {
  name: "pricing_table — feature comparison table",
  args: { data: base, variant: "pricing_table" },
};

export const NoFootnote: Story = {
  name: "pricing_tiers — no footnote",
  args: { data: { ...base, footnote: undefined }, variant: "pricing_tiers" },
};
