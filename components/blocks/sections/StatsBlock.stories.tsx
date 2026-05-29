import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StatsBlock } from "./StatsBlock";
import type { StatsBlockData } from "@/page-config";

const stats: StatsBlockData = {
  heading: "The numbers that matter",
  items: [
    { value: "98%",  label: "Customer satisfaction score",  suffix: "" },
    { value: "2.4M", label: "Requests processed daily",     suffix: "" },
    { value: "140",  label: "Tenants on the platform",      suffix: "+" },
    { value: "4",    label: "Average pages per session",    prefix: "×" },
  ],
};

const threeStats: StatsBlockData = {
  heading: "At a glance",
  items: [
    { value: "50",  label: "Countries reached",  suffix: "+" },
    { value: "99.9", label: "Uptime SLA",        suffix: "%" },
    { value: "14",  label: "Day free trial" },
  ],
};

const meta: Meta<typeof StatsBlock> = {
  title:     "Blocks/Sections/Stats",
  component: StatsBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Key metrics block. Three variants: " +
          "`default` (large bordered metric cards on subtle bg), " +
          "`compact` (tight inline row with separator lines, no card backgrounds), and " +
          "`dark` (near-black section with vivid brand-coloured values — Dark AI / enterprise family).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof StatsBlock>;

export const Default: Story = {
  name: "Default (large cards)",
  args: { data: stats, variant: "default" },
};

export const Compact: Story = {
  name: "Compact (inline row)",
  args: { data: stats, variant: "compact" },
};

export const ThreeStats: Story = {
  name: "Three metrics",
  args: { data: threeStats, variant: "default" },
};

export const NoHeading: Story = {
  name: "No heading",
  args: { data: { items: stats.items }, variant: "default" },
};

export const CompactNoHeading: Story = {
  name: "Compact, no heading",
  args: { data: { items: stats.items }, variant: "compact" },
};

// ── New variant stories ────────────────────────────────────────────────────────

/**
 * dark — near-black section with large brand-coloured metric values.
 * No card borders — colour contrast carries the visual weight.
 * Dark AI / enterprise family variant.
 */
export const Dark: Story = {
  name: "dark — near-black section, vivid brand metrics",
  args: { data: stats, variant: "dark" },
};

export const DarkThreeStats: Story = {
  name: "dark — three metrics",
  args: { data: threeStats, variant: "dark" },
};

export const DarkNoHeading: Story = {
  name: "dark — no heading",
  args: { data: { items: stats.items }, variant: "dark" },
};
