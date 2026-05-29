import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TimelineBlock } from "./TimelineBlock";
import type { TimelineBlockData } from "@/page-config";

const items = [
  {
    id:          "1",
    date:        "2020",
    title:       "Company founded",
    description: "Two engineers and a designer start building a multi-tenant platform from a shared apartment in Amsterdam.",
  },
  {
    id:          "2",
    date:        "2021 Q2",
    title:       "First paying customer",
    description: "A regional media group becomes our first production tenant, running 4 brand sites on a single platform.",
  },
  {
    id:          "3",
    date:        "2022",
    title:       "Series A — €4.2M",
    description: "Raised Series A funding to expand the engineering team and build out the self-service dashboard.",
  },
  {
    id:          "4",
    date:        "2023 Q3",
    title:       "50 tenants milestone",
    description: "Platform reaches 50 active tenants across media, recruitment, and SaaS verticals.",
  },
  {
    id:          "5",
    date:        "2024",
    title:       "Design token system launched",
    description: "Released the fully token-driven theming system, enabling zero-deployment brand changes.",
  },
  {
    id:          "6",
    date:        "2025",
    title:       "140+ tenants globally",
    description: "Expanded to 140+ tenants across 50 countries with a fully remote, distributed team.",
  },
] as const;

const baseData: TimelineBlockData = {
  heading:     "Our story",
  description: "From a two-person startup to a global platform — here's how we got here.",
  items,
};

const meta: Meta<typeof TimelineBlock> = {
  title:     "Blocks/Sections/Timeline",
  component: TimelineBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Ordered list of milestones, events, or history entries. Three variants: " +
          "`timeline_vertical` (default — vertical with dot markers), " +
          "`timeline_compact` (tight list with inline dates), " +
          "`timeline_milestones` (bold date cards in a grid).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof TimelineBlock>;

export const Vertical: Story = {
  name: "timeline_vertical (default)",
  args: { data: baseData, variant: "timeline_vertical" },
};

export const Compact: Story = {
  name: "timeline_compact",
  args: { data: baseData, variant: "timeline_compact" },
};

export const Milestones: Story = {
  name: "timeline_milestones (card grid)",
  args: { data: baseData, variant: "timeline_milestones" },
};

export const NoDescription: Story = {
  name: "No description",
  args: { data: { heading: "Key milestones", items }, variant: "timeline_vertical" },
};

export const NoHeading: Story = {
  name: "No heading",
  args: { data: { items }, variant: "timeline_compact" },
};
