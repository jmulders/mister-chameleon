import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProductDetailBlock } from "./ProductDetailBlock";
import type { ProductDetailBlockData } from "@/page-config";

// ── Mock data ─────────────────────────────────────────────────────────────────

const base: ProductDetailBlockData = {
  title:       "Growth Engine",
  description:
    "The Growth Engine bundles full A/B experimentation, adaptive hero variants, advanced analytics dashboards, and AI-assisted decision support into one cohesive platform tier. Perfect for teams that are scaling fast and need data-driven confidence at every step.",
  price:       "€49 / month",
  badge:       "Most popular",
  gallery:     [
    { url: "https://placehold.co/800x500/e2e8f0/94a3b8?text=Product+Image+1", alt: "Product screenshot — dashboard" },
    { url: "https://placehold.co/800x500/dbeafe/93c5fd?text=Product+Image+2", alt: "Product screenshot — experiments" },
    { url: "https://placehold.co/800x500/dcfce7/86efac?text=Product+Image+3", alt: "Product screenshot — analytics" },
  ],
  specs: [
    { label: "Workspaces",    value: "Up to 5"             },
    { label: "Team members",  value: "Unlimited"           },
    { label: "Storage",       value: "50 GB"               },
    { label: "Support",       value: "Priority email + chat" },
    { label: "Custom domains", value: "Yes"                },
    { label: "SLA",           value: "99.9 % uptime"       },
  ],
  cta:          { label: "Start free trial", href: "#", variant: "primary"  },
  secondaryCta: { label: "View pricing",     href: "#", variant: "outline"  },
  relatedProducts: [
    {
      title:       "Adaptive Starter Kit",
      description: "Launch a fast, adaptive marketing site for free.",
      price:       "€0",
      badge:       "Free",
      cta:         { label: "Get started", href: "#", variant: "primary" },
    },
    {
      title:       "Enterprise Suite",
      description: "Dedicated SLA, SSO, and custom contracts.",
      price:       "Custom",
      cta:         { label: "Talk to sales", href: "#", variant: "outline" },
    },
  ],
};

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta: Meta<typeof ProductDetailBlock> = {
  title:     "Blocks/Sections/ProductDetail",
  component: ProductDetailBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Product detail section. Two variants: product_detail_default (2-col gallery + copy), product_detail_full (stacked full-width).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ProductDetailBlock>;

// ── Stories ───────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: "product_detail_default — 2-col gallery + copy",
  args: { data: base, variant: "product_detail_default" },
};

export const Full: Story = {
  name: "product_detail_full — stacked full-width",
  args: { data: base, variant: "product_detail_full" },
};

export const NoGallery: Story = {
  name: "product_detail_default — no gallery (placeholder shown)",
  args: { data: { ...base, gallery: undefined }, variant: "product_detail_default" },
};

export const NoSpecs: Story = {
  name: "product_detail_default — no specs table",
  args: { data: { ...base, specs: undefined }, variant: "product_detail_default" },
};

export const NoRelated: Story = {
  name: "product_detail_default — no related products",
  args: { data: { ...base, relatedProducts: undefined }, variant: "product_detail_default" },
};

export const MinimalData: Story = {
  name: "product_detail_default — minimal (title + CTA only)",
  args: {
    data: {
      title: "Growth Engine",
      cta:   { label: "Start free trial", href: "#", variant: "primary" },
    },
    variant: "product_detail_default",
  },
};
