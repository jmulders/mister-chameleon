import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RelatedContentBlock } from "./RelatedContentBlock";
import type { RelatedContentBlockData } from "@/page-config";

// ── Mock items ────────────────────────────────────────────────────────────────

const items = [
  {
    id:       "r1",
    title:    "Why headless architecture wins at scale",
    href:     "/blog/headless-architecture",
    excerpt:  "Monolithic CMS setups hit a ceiling. Headless architecture lets front-end and back-end teams move independently without stepping on each other.",
    imageUrl: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&q=75",
    imageAlt: "Server rack",
    category: "Engineering",
    date:     "2025-02-18",
  },
  {
    id:       "r2",
    title:    "Designing a content model that survives roadmap changes",
    href:     "/blog/content-modelling",
    excerpt:  "A good content model is schema-first and use-case driven. Here is how we think about content modelling for longevity.",
    imageUrl: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&q=75",
    imageAlt: "Whiteboard with diagrams",
    category: "Design",
    date:     "2025-01-30",
  },
  {
    id:       "r3",
    title:    "The case for progressive enhancement in 2025",
    href:     "/blog/progressive-enhancement",
    excerpt:  "JavaScript-optional experiences are back in vogue. We walk through how to layer interactivity on top of solid HTML foundations.",
    imageUrl: "https://images.unsplash.com/photo-1432888622747-4eb9a8efeb07?w=600&q=75",
    imageAlt: "Code editor",
    category: "Engineering",
    date:     "2024-12-10",
  },
] as const;

const base: RelatedContentBlockData = {
  heading: "Related articles",
  items:   [...items],
};

// ── Meta ───────────────────────────────────────────────────────────────────────

const meta: Meta<typeof RelatedContentBlock> = {
  title:     "Blocks/Sections/RelatedContent",
  component: RelatedContentBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Curated related content placed at the end of a detail page. Four variants: default/grid (3-col cards), list (single-column rows), carousel (horizontal scroll), related_slider (CSS-snap).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof RelatedContentBlock>;

// ── Stories ────────────────────────────────────────────────────────────────────

export const Grid: Story = {
  name: "default / grid — 3-col card grid",
  args: { data: base },
};

export const List: Story = {
  name: "list — single-column row list",
  args: { data: base, variant: "list" },
};

export const Carousel: Story = {
  name: "carousel — horizontal scrolling strip",
  args: { data: base, variant: "carousel" },
};

export const Slider: Story = {
  name: "related_slider — CSS-snap card carousel",
  args: { data: base, variant: "related_slider" },
};

export const MaxItems: Story = {
  name: "maxItems — capped at 2",
  args: { data: { ...base, maxItems: 2 } },
};

export const NoHeading: Story = {
  name: "no heading",
  args: { data: { ...base, heading: undefined } },
};
