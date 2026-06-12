import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QuoteBlock } from "./QuoteBlock";
import type { QuoteBlockData } from "@/page-config";

const baseData: QuoteBlockData = {
  quote:       "The best investment we ever made. Personalisation at this scale was something we thought would take years to build.",
  attribution: "Sophie van den Berg",
  source:      "Chief Marketing Officer, Groei B.V.",
  avatarUrl:   "https://i.pravatar.cc/80?img=47",
};

const meta: Meta<typeof QuoteBlock> = {
  title:     "Blocks/Sections/Quote",
  component: QuoteBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A single pull-quote with optional attribution, source, and avatar. " +
          "Distinct from TestimonialSection — a Quote is one highlighted statement " +
          "(analyst, founder, press) rather than a customer-review grid. " +
          "Variants: `quote-card` (default), `quote-minimal`.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof QuoteBlock>;

export const Card: Story = {
  name: "quote-card (default)",
  args: { data: baseData, variant: "quote-card" },
};

export const Minimal: Story = {
  name: "quote-minimal",
  args: { data: baseData, variant: "quote-minimal" },
};

export const NoAvatar: Story = {
  name: "No avatar",
  args: {
    data: { ...baseData, avatarUrl: undefined },
    variant: "quote-card",
  },
};

export const QuoteOnly: Story = {
  name: "Quote only (no attribution)",
  args: {
    data: {
      quote: "Move fast, break nothing — that's personalisation done right.",
    },
    variant: "quote-card",
  },
};
