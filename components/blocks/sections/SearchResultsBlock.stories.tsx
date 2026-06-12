import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SearchResultsBlock } from "./SearchResultsBlock";
import type { SearchResultsBlockData } from "@/page-config";

const sampleItems = [
  {
    id:       "1",
    title:    "How personalisation increased our conversion by 3×",
    href:     "/blog/conversion",
    excerpt:  "A deep dive into the decision engine and how rule-based segments boosted checkout rates on a Dutch retailer's site.",
    date:     "2024-03-12",
    imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80",
    category: "Case Study",
    tags:     ["personalisation", "conversion"],
  },
  {
    id:       "2",
    title:    "GDPR-compliant personalisation without cookies",
    href:     "/blog/gdpr",
    excerpt:  "Server-side signal evaluation means no consent banner is needed. Here's how we achieve compliance by design.",
    date:     "2024-01-28",
    category: "Technical",
    tags:     ["gdpr", "privacy"],
  },
  {
    id:       "3",
    title:    "Getting started with context blocks",
    href:     "/docs/context-blocks",
    excerpt:  "A step-by-step guide to setting up your first adaptive context slot and creating variant content in Statamic.",
    date:     "2023-11-15",
    category: "Documentation",
    tags:     ["getting-started", "statamic"],
  },
  {
    id:       "4",
    title:    "Multi-site architecture on a single platform",
    href:     "/blog/multi-site",
    excerpt:  "How one media group runs 12 brand websites with a shared platform, separate content, and zero deployment overhead.",
    date:     "2023-09-02",
    imageUrl: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=600&q=80",
    category: "Case Study",
    tags:     ["multi-site", "architecture"],
  },
] as const;

const baseData: SearchResultsBlockData = {
  heading:      "Search results",
  emptyMessage: "No results found. Try adjusting your search terms.",
  items:        sampleItems,
  enableSearch: true,
  enableFilter: false,
  itemsPerPage: 12,
};

const meta: Meta<typeof SearchResultsBlock> = {
  title:     "Blocks/Sections/SearchResults",
  component: SearchResultsBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Filterable result set — typically paired with a FilterBarBlock on the same page. " +
          "Reads `q`, `category`, `tag`, and `sort` from URL params and filters client-side. " +
          "Falls back to rendering all items server-side (no JS required). " +
          "Variants: `default` (grid), `list` (single-column).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SearchResultsBlock>;

export const Default: Story = {
  name: "Default (grid, 4 results)",
  args: { data: baseData, variant: "default" },
};

export const ListVariant: Story = {
  name: "List variant",
  args: { data: { ...baseData, heading: undefined }, variant: "list" },
};

export const Empty: Story = {
  name: "Empty state",
  args: {
    data: {
      ...baseData,
      items:   [],
      heading: "Search results",
    },
    variant: "default",
  },
};

export const NoHeading: Story = {
  name: "No heading",
  args: { data: { ...baseData, heading: undefined }, variant: "default" },
};
