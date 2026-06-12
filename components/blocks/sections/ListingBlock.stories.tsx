import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ListingBlock } from "./ListingBlock";
import type { ListingBlockData } from "@/page-config";

// ── Mock data ─────────────────────────────────────────────────────────────────

const blogItems = [
  {
    id:       "1",
    title:    "How we built our design token system",
    href:     "/blog/design-tokens",
    excerpt:  "A deep dive into building a scalable token architecture that spans multiple tenants and themes.",
    imageUrl: "https://picsum.photos/seed/blog1/800/450",
    imageAlt: "Design token system",
    category: "Engineering",
    date:     "2026-03-15",
    meta:     [{ label: "Read time", value: "6 min" }],
  },
  {
    id:       "2",
    title:    "Accessible forms at scale",
    href:     "/blog/accessible-forms",
    excerpt:  "Practical patterns for building forms that work for everyone, including screen reader users.",
    imageUrl: "https://picsum.photos/seed/blog2/800/450",
    imageAlt: "Accessible forms",
    category: "Design",
    date:     "2026-02-28",
    meta:     [{ label: "Read time", value: "4 min" }],
  },
  {
    id:       "3",
    title:    "Multi-tenant architecture patterns",
    href:     "/blog/multi-tenant",
    excerpt:  "How to design a platform that serves dozens of tenants from a single codebase without data leaks.",
    imageUrl: "https://picsum.photos/seed/blog3/800/450",
    imageAlt: "Multi-tenant",
    category: "Engineering",
    date:     "2026-02-10",
    meta:     [{ label: "Read time", value: "8 min" }],
  },
  {
    id:       "4",
    title:    "The product design process we use",
    href:     "/blog/design-process",
    excerpt:  "From discovery to delivery — a practical walkthrough of our end-to-end design workflow.",
    imageUrl: "https://picsum.photos/seed/blog4/800/450",
    imageAlt: "Design process",
    category: "Product",
    date:     "2026-01-22",
    meta:     [{ label: "Read time", value: "5 min" }],
  },
  {
    id:       "5",
    title:    "Building with server components",
    href:     "/blog/rsc",
    excerpt:  "Lessons learned after migrating our block system to React Server Components.",
    imageUrl: "https://picsum.photos/seed/blog5/800/450",
    imageAlt: "Server components",
    category: "Engineering",
    date:     "2026-01-08",
    meta:     [{ label: "Read time", value: "7 min" }],
  },
  {
    id:       "6",
    title:    "Year in review: 2025",
    href:     "/blog/year-in-review",
    excerpt:  "What we shipped, what we learned, and what's coming in 2026.",
    imageUrl: "https://picsum.photos/seed/blog6/800/450",
    imageAlt: "Year in review",
    category: "Company",
    date:     "2025-12-30",
    meta:     [{ label: "Read time", value: "3 min" }],
  },
] as const;

const vacancyItems = [
  {
    id:       "v1",
    title:    "Senior Frontend Engineer",
    href:     "/careers/senior-frontend",
    excerpt:  "Build the next generation of our platform in a small, autonomous product team.",
    category: "Engineering",
    date:     "2026-03-01",
    meta:     [
      { label: "Location",  value: "Amsterdam / Remote" },
      { label: "Contract",  value: "Full-time" },
      { label: "Level",     value: "Senior" },
    ],
  },
  {
    id:       "v2",
    title:    "Product Designer",
    href:     "/careers/product-designer",
    excerpt:  "Own the end-to-end design of platform features from concept to ship.",
    category: "Design",
    date:     "2026-02-20",
    meta:     [
      { label: "Location",  value: "Amsterdam" },
      { label: "Contract",  value: "Full-time" },
      { label: "Level",     value: "Mid / Senior" },
    ],
  },
  {
    id:       "v3",
    title:    "Backend Engineer (Node.js)",
    href:     "/careers/backend-node",
    excerpt:  "Design and maintain the APIs and data layer that powers our multi-tenant platform.",
    category: "Engineering",
    date:     "2026-02-10",
    meta:     [
      { label: "Location",  value: "Remote (EU)" },
      { label: "Contract",  value: "Full-time" },
      { label: "Level",     value: "Senior" },
    ],
  },
  {
    id:       "v4",
    title:    "Growth Marketing Manager",
    href:     "/careers/growth-marketing",
    excerpt:  "Drive acquisition and retention with data-led campaigns and experiments.",
    category: "Marketing",
    date:     "2026-02-05",
    meta:     [
      { label: "Location",  value: "Amsterdam / Hybrid" },
      { label: "Contract",  value: "Full-time" },
    ],
  },
] as const;

const blogListData: ListingBlockData = {
  heading:      "Latest from the blog",
  items:        blogItems,
  viewAllHref:  "/blog",
  viewAllLabel: "All posts",
};

const vacancyListData: ListingBlockData = {
  heading:      "Open positions",
  items:        vacancyItems,
  viewAllHref:  "/careers",
  viewAllLabel: "See all vacancies",
};

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta: Meta<typeof ListingBlock> = {
  title:     "Blocks/Sections/Listing",
  component: ListingBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Content-type-agnostic listing block. Renders any `ListingItem[]` in four layout variants: " +
          "`default` / `grid` (3-col cards), `list` (single-column rows), `compact` (text-only list), " +
          "and `listing_slider` (horizontal CSS-snap carousel).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ListingBlock>;

// ── Stories ───────────────────────────────────────────────────────────────────

export const Grid: Story = {
  name: "Grid / default (blog cards)",
  args: {
    data:    blogListData,
    variant: "default",
  },
};

export const List: Story = {
  name: "List (vacancy rows)",
  args: {
    data:    vacancyListData,
    variant: "list",
  },
};

export const Compact: Story = {
  name: "Compact (text-only)",
  args: {
    data:    blogListData,
    variant: "compact",
  },
};

export const Slider: Story = {
  name: "Slider (horizontal carousel)",
  args: {
    data:    blogListData,
    variant: "listing_slider",
  },
};

export const MaxItems: Story = {
  name: "MaxItems cap (3 of 6)",
  args: {
    data:    { ...blogListData, maxItems: 3 },
    variant: "default",
  },
};

export const NoHeading: Story = {
  name: "No heading",
  args: {
    data: { items: blogItems.slice(0, 3) },
    variant: "default",
  },
};

export const WithHoverImages: Story = {
  name: "Grid — hover image swap (hover a card to see it)",
  args: {
    data: {
      heading:      "Hover each card to see the swap",
      items: blogItems.slice(0, 3).map((item, i) => ({
        ...item,
        // Use a different picsum seed for the hover state so the cross-fade
        // is clearly visible. In production this comes from overview_image_hover
        // in the Statamic CMS (or the equivalent field in other CMS providers).
        hoverImageUrl: `https://picsum.photos/seed/hover${i + 1}/800/450`,
      })),
    },
    variant: "default",
  },
};
