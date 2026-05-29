import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CheckoutBlock } from "./CheckoutBlock";
import type { CheckoutBlockData } from "@/page-config";

// ── Mock data ─────────────────────────────────────────────────────────────────

const base: CheckoutBlockData = {
  heading:         "Checkout",
  intro:           "Complete your purchase below.",
  paymentProvider: "Payment provider not yet configured.",
};

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta: Meta<typeof CheckoutBlock> = {
  title:     "Blocks/Sections/Checkout",
  component: CheckoutBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Foundation checkout block. Renders a payment-provider placeholder and a security note. " +
          "Integrators replace the placeholder region with their payment processor embed " +
          "(Stripe Elements, Mollie, PayPal, etc.). " +
          "Variant: checkout_default.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof CheckoutBlock>;

// ── Stories ───────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: "checkout_default — payment placeholder (unconfigured)",
  args: { data: base, variant: "checkout_default" },
};

export const WithProviderLabel: Story = {
  name: "checkout_default — Stripe provider label",
  args: {
    data: {
      ...base,
      paymentProvider: "Stripe Elements — replace this placeholder with <Elements>.",
    },
    variant: "checkout_default",
  },
};

export const CustomHeading: Story = {
  name: "checkout_default — custom heading and intro",
  args: {
    data: {
      heading: "Secure checkout",
      intro:   "You're one step away. Review your order and confirm your payment.",
    },
    variant: "checkout_default",
  },
};

export const MinimalData: Story = {
  name: "checkout_default — all defaults (no data supplied)",
  args: { data: {}, variant: "checkout_default" },
};
