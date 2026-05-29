import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProductOverviewBlock } from "./ProductOverviewBlock";
import type { ProductOverviewBlockData } from "@/page-config";

// ── Mock products ─────────────────────────────────────────────────────────────

const products: ProductOverviewBlockData["products"] = [
  {
    title:       "Adaptive Starter Kit",
    description: "Everything you need to launch a fast, adaptive marketing site in a day.",
    price:       "€0",
    badge:       "Free",
    cta:         { label: "Get started", href: "#", variant: "primary" },
  },
  {
    title:       "Growth Engine",
    description: "Full A/B experimentation, advanced analytics, and AI decision support.",
    price:       "€49 / mo",
    badge:       "Most popular",
    cta:         { label: "Start trial", href: "#", variant: "primary" },
  },
  {
    title:       "Enterprise Suite",
    description: "Dedicated SLA, SSO, custom contracts, and onboarding support.",
    price:       "Custom",
    cta:         { label: "Talk to sales", href: "#", variant: "outline" },
  },
];

const base: ProductOverviewBlockData = {
  heading:    "Our products",
  intro:      "Choose the plan that fits your team and budget.",
  products,
  showPrices: true,
};

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta: Meta<typeof ProductOverviewBlock> = {
  title:     "Blocks/Sections/ProductOverview",
  component: ProductOverviewBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Product overview section. Three variants: product_grid (3-col bordered grid), product_cards (elevated shadow cards), product_list (horizontal rows).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ProductOverviewBlock>;

// ── Stories ───────────────────────────────────────────────────────────────────

export const Grid: Story = {
  name: "product_grid — 3-col bordered grid (default)",
  args: { data: base, variant: "product_grid" },
};

export const Cards: Story = {
  name: "product_cards — elevated shadow cards",
  args: { data: base, variant: "product_cards" },
};

export const List: Story = {
  name: "product_list — horizontal list rows",
  args: { data: base, variant: "product_list" },
};

export const WithSectionCTA: Story = {
  name: "product_grid — with section-level CTA",
  args: {
    data: {
      ...base,
      cta: { label: "View all products", href: "/products", variant: "outline" },
    },
    variant: "product_grid",
  },
};

export const NoPrices: Story = {
  name: "product_grid — prices hidden",
  args: { data: { ...base, showPrices: false }, variant: "product_grid" },
};

export const MinimalData: Story = {
  name: "product_grid — heading / intro omitted",
  args: {
    data: { products },
    variant: "product_grid",
  },
};
