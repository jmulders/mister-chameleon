import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CartSummaryBlock } from "./CartSummaryBlock";
import type { CartSummaryBlockData } from "@/page-config";

// ── Mock data ─────────────────────────────────────────────────────────────────

const base: CartSummaryBlockData = {
  heading:               "Your cart",
  emptyMessage:          "Your cart is empty.",
  checkoutHref:          "/checkout",
  continueShoppingHref:  "/products",
  checkoutLabel:         "Proceed to checkout",
  continueShoppingLabel: "Continue shopping",
};

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta: Meta<typeof CartSummaryBlock> = {
  title:     "Blocks/Sections/CartSummary",
  component: CartSummaryBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Foundation cart summary block. Renders a placeholder cart view with empty-state message and checkout / continue-shopping actions. " +
          "Integrators replace the placeholder region with their cart provider (e.g. Shopify Storefront API, Stripe). " +
          "Variant: cart_default.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof CartSummaryBlock>;

// ── Stories ───────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: "cart_default — foundation placeholder with actions",
  args: { data: base, variant: "cart_default" },
};

export const CustomLabels: Story = {
  name: "cart_default — custom labels and hrefs",
  args: {
    data: {
      ...base,
      heading:               "Shopping bag",
      emptyMessage:          "Your bag is empty. Add some products to continue.",
      checkoutLabel:         "Go to checkout",
      continueShoppingLabel: "Back to shop",
      checkoutHref:          "/shop/checkout",
      continueShoppingHref:  "/shop",
    },
    variant: "cart_default",
  },
};

export const MinimalData: Story = {
  name: "cart_default — all defaults (no data supplied)",
  args: { data: {}, variant: "cart_default" },
};
