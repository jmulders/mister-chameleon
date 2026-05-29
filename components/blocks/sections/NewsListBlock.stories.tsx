import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { NewsListBlock } from "./NewsListBlock";
import type { NewsListBlockData } from "@/page-config";

// ── Mock items ────────────────────────────────────────────────────────────────

const items = [
  {
    url:      "/news/platform-launch",
    title:    "We launched our new self-serve platform",
    excerpt:  "After twelve months of development and three beta cohorts, our platform is now open to all teams — no waitlist.",
    imageUrl: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&q=75",
    category: "Product",
    date:     "2025-04-10",
  },
  {
    url:      "/news/series-a",
    title:    "Announcing our €12 M Series A funding",
    excerpt:  "We closed our Series A round led by Index Ventures, with participation from existing investors Backed and LocalGlobe.",
    imageUrl: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=600&q=75",
    category: "Company",
    date:     "2025-03-22",
  },
  {
    url:      "/news/new-head-of-design",
    title:    "Welcome Marco — our new Head of Design",
    excerpt:  "Marco brings 10 years of product design experience from Booking.com and Figma. He will lead our design system and user research efforts.",
    imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=75",
    category: "Team",
    date:     "2025-02-14",
  },
  {
    url:      "/news/iso-certification",
    title:    "Mister Chameleon achieves ISO 27001 certification",
    excerpt:  "Our information security management system meets the rigorous requirements of the ISO 27001 standard.",
    imageUrl: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&q=75",
    category: "Security",
    date:     "2025-01-05",
  },
] as const;

const base: NewsListBlockData = {
  heading: "Latest news",
  items:   [...items],
};

// ── Meta ───────────────────────────────────────────────────────────────────────

const meta: Meta<typeof NewsListBlock> = {
  title:     "Blocks/Sections/NewsList",
  component: NewsListBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "News / blog article teaser block. Four variants: default/grid (3-col cards), list (single-column rows), featured (first item as wide hero card), news_slider (CSS-snap carousel).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof NewsListBlock>;

// ── Stories ────────────────────────────────────────────────────────────────────

export const Grid: Story = {
  name: "default / grid — 3-col card grid",
  args: { data: base, variant: "default" },
};

export const List: Story = {
  name: "list — single-column row list",
  args: { data: base, variant: "list" },
};

export const Featured: Story = {
  name: "featured — first item as wide hero, rest in 2-col grid",
  args: { data: base, variant: "featured" },
};

export const Slider: Story = {
  name: "news_slider — horizontal CSS-snap carousel",
  args: { data: base, variant: "news_slider" },
};

export const MaxItems: Story = {
  name: "default — capped at 3 items",
  args: { data: { ...base, maxItems: 3 }, variant: "default" },
};

export const NoHeading: Story = {
  name: "no section heading",
  args: { data: { ...base, heading: undefined }, variant: "default" },
};
