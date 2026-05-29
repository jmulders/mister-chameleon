import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Heading } from "./Heading";

const meta: Meta<typeof Heading> = {
  title:     "Atoms/Heading",
  component: Heading,
  tags:      ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Semantic heading primitive that decouples HTML level from visual scale. " +
          "Use `level` to set the document outline (h1–h6); use `size` to override the visual scale independently. " +
          "When `size` is omitted it defaults to the matching visual scale for the level.",
      },
    },
  },
  argTypes: {
    level: { control: "select", options: [1, 2, 3, 4, 5, 6] },
    size:  { control: "select", options: ["display", "h1", "h2", "h3", "h4"] },
    align: { control: "select", options: ["left", "center", "right"] },
    color: { control: "select", options: ["default", "muted", "brand", "subtle"] },
    balance: { control: "boolean" },
  },
  args: {
    level: 2,
    children: "The quick brown fox jumps over the lazy dog",
  },
};

export default meta;
type Story = StoryObj<typeof Heading>;

export const Default: Story = {};

export const Display: Story = {
  name: "Display scale (hero headings)",
  args: { level: 1, size: "display", children: "Welcome to the platform" },
};

export const AllLevels: Story = {
  name: "All semantic levels",
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {([1, 2, 3, 4, 5, 6] as const).map((level) => (
        <Heading key={level} level={level}>
          Heading level {level} — h{level} element
        </Heading>
      ))}
    </div>
  ),
};

export const DecoupledScale: Story = {
  name: "Decoupled level vs scale",
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <Heading level={2} size="display">h2 element, display scale</Heading>
      <Heading level={2} size="h3">h2 element, h3 scale</Heading>
      <Heading level={3} size="h1">h3 element, h1 scale</Heading>
      <Heading level={4} size="h2">h4 element, h2 scale</Heading>
    </div>
  ),
};

export const Centered: Story = {
  name: "Centred + balanced",
  args: { level: 2, align: "center", balance: true, children: "Centred section heading with text-wrap balance" },
};

export const MutedColor: Story = {
  name: "Muted colour",
  args: { level: 3, color: "muted", children: "Supporting sub-heading in muted colour" },
};
