import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CTAGroup } from "./CTAGroup";
import type { BlockCTA } from "@/page-config";

const primaryOnly: readonly BlockCTA[] = [
  { label: "Get started", href: "#" },
];

const primaryAndSecondary: readonly BlockCTA[] = [
  { label: "Get started",  href: "#" },
  { label: "Learn more",   href: "#" },
];

const threeButtons: readonly BlockCTA[] = [
  { label: "Primary",    href: "#" },
  { label: "Secondary",  href: "#" },
  { label: "Ghost",      href: "#", variant: "ghost" },
];

const meta: Meta<typeof CTAGroup> = {
  title:     "Molecules/CTAGroup",
  component: CTAGroup,
  tags:      ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Renders a `BlockCTA[]` array as a horizontal flex-wrap row of Buttons. " +
          "First CTA is primary, subsequent CTAs are outline by default. " +
          "The `inverted` prop switches to a contrasting palette for use on brand or dark backgrounds.",
      },
    },
  },
  argTypes: {
    size:     { control: "select", options: ["sm", "md", "lg"] },
    align:    { control: "select", options: ["start", "center", "end"] },
    inverted: { control: "boolean" },
  },
  args: {
    ctas:     primaryAndSecondary,
    size:     "md",
    align:    "start",
    inverted: false,
  },
};

export default meta;
type Story = StoryObj<typeof CTAGroup>;

export const Default: Story = {};

export const SingleCTA: Story = {
  name: "Single CTA",
  args: { ctas: primaryOnly },
};

export const ThreeCTAs: Story = {
  name: "Three CTAs",
  args: { ctas: threeButtons },
};

export const SmallSize: Story = {
  name: "Small size",
  args: { size: "sm" },
};

export const LargeSize: Story = {
  name: "Large size",
  args: { size: "lg" },
};

export const CentreAligned: Story = {
  name: "Centre aligned",
  args: { align: "center" },
};

export const EndAligned: Story = {
  name: "End aligned",
  args: { align: "end" },
};

export const InvertedOnBrand: Story = {
  name: "Inverted (on brand background)",
  args: { inverted: true },
  decorators: [
    (Story) => (
      <div
        style={{
          background:    "var(--primary, #6366f1)",
          padding:       "2rem",
          borderRadius:  "0.75rem",
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export const InvertedOnDark: Story = {
  name: "Inverted (on dark background)",
  args: { inverted: true },
  decorators: [
    (Story) => (
      <div
        style={{
          background:    "#0f172a",
          padding:       "2rem",
          borderRadius:  "0.75rem",
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export const EmptyCTAs: Story = {
  name: "Empty array (renders nothing)",
  args: { ctas: [] },
};
