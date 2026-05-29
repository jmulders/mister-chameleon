import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QuickLinksBlock } from "./QuickLinksBlock";
import type { QuickLinksBlockData } from "@/page-config";

const links = [
  {
    id:          "1",
    label:       "Getting started",
    href:        "/docs/getting-started",
    description: "Set up your first tenant in under 10 minutes.",
    icon:        "🚀",
  },
  {
    id:          "2",
    label:       "API reference",
    href:        "/docs/api",
    description: "Full REST & GraphQL endpoint documentation.",
    icon:        "📖",
  },
  {
    id:          "3",
    label:       "Design tokens",
    href:        "/docs/tokens",
    description: "Customise colours, typography, and spacing per tenant.",
    icon:        "🎨",
  },
  {
    id:          "4",
    label:       "Multi-tenancy guide",
    href:        "/docs/multi-tenancy",
    description: "Understand tenant isolation, routing, and data separation.",
    icon:        "🏢",
  },
  {
    id:          "5",
    label:       "Component library",
    href:        "/docs/components",
    description: "Browse every block and atom with live previews.",
    icon:        "🧩",
  },
  {
    id:          "6",
    label:       "Release notes",
    href:        "/changelog",
    description: "What's new in the latest platform release.",
    icon:        "📋",
  },
] as const;

const baseData: QuickLinksBlockData = {
  heading:     "Explore the docs",
  description: "Everything you need to build, customise, and scale your multi-tenant platform.",
  links,
};

const noDescriptionLinks: QuickLinksBlockData = {
  heading: "Quick links",
  links:   links.map(({ id, label, href, icon }) => ({ id, label, href, icon })),
};

const noIconsData: QuickLinksBlockData = {
  heading: "Resources",
  links:   links.map(({ id, label, href, description }) => ({ id, label, href, description })),
};

const meta: Meta<typeof QuickLinksBlock> = {
  title:     "Blocks/Sections/QuickLinks",
  component: QuickLinksBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Navigation hub or resource directory block. Three variants: " +
          "`quicklinks_grid` (icon + label cards in a 3-col grid, default), " +
          "`quicklinks_list` (single-column rows with chevrons), " +
          "`quicklinks_compact` (dense flex tile strip, label only).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof QuickLinksBlock>;

export const Grid: Story = {
  name: "quicklinks_grid (default)",
  args: { data: baseData, variant: "quicklinks_grid" },
};

export const List: Story = {
  name: "quicklinks_list — single-column rows",
  args: { data: baseData, variant: "quicklinks_list" },
};

export const Compact: Story = {
  name: "quicklinks_compact — dense tile strip",
  args: { data: baseData, variant: "quicklinks_compact" },
};

export const NoIcons: Story = {
  name: "No icons",
  args: { data: noIconsData, variant: "quicklinks_grid" },
};

export const NoDescriptions: Story = {
  name: "No item descriptions",
  args: { data: noDescriptionLinks, variant: "quicklinks_grid" },
};

export const NoHeading: Story = {
  name: "No heading",
  args: { data: { links }, variant: "quicklinks_list" },
};

export const FewLinks: Story = {
  name: "Three links",
  args: {
    data:    { heading: "Key resources", links: links.slice(0, 3) },
    variant: "quicklinks_grid",
  },
};
