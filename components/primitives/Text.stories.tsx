import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Text } from "./Text";

const meta: Meta<typeof Text> = {
  title:     "Atoms/Text",
  component: Text,
  tags:      ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Polymorphic typography primitive. Covers the full type scale from " +
          "`display` hero headings to `caption` labels. The `as` prop overrides " +
          "the default element for semantic flexibility.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["display", "h1", "h2", "h3", "h4", "body", "body-sm", "caption", "label"],
    },
    color: {
      control: "select",
      options: ["default", "muted", "subtle", "brand", "inverse", "inherit"],
    },
    align: {
      control: "select",
      options: ["left", "center", "right"],
    },
    weight: {
      control: "select",
      options: ["normal", "medium", "semibold", "bold"],
    },
    balance:  { control: "boolean" },
    children: { control: "text" },
  },
  args: {
    variant:  "body",
    color:    "default",
    children: "The quick brown fox jumps over the lazy dog.",
  },
};

export default meta;
type Story = StoryObj<typeof Text>;

export const Body: Story = {};

export const TypeScale: Story = {
  name: "Full type scale",
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <Text variant="display">Display — Hero headline</Text>
      <Text variant="h1">H1 — Page title</Text>
      <Text variant="h2">H2 — Section heading</Text>
      <Text variant="h3">H3 — Block heading</Text>
      <Text variant="h4">H4 — Card heading</Text>
      <Text variant="body">Body — Paragraph text. The quick brown fox jumps over the lazy dog.</Text>
      <Text variant="body-sm">Body small — Supporting text for compact layouts.</Text>
      <Text variant="caption">Caption — Meta info, timestamps, fine print.</Text>
      <Text variant="label">Label — Form label or UI chip.</Text>
    </div>
  ),
};

export const ColorVariants: Story = {
  name: "Colour variants",
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <Text color="default">Default colour</Text>
      <Text color="muted">Muted — secondary prose</Text>
      <Text color="subtle">Subtle — de-emphasised</Text>
      <Text color="brand">Brand — accent text</Text>
      <div style={{ background: "#0f172a", padding: "0.75rem 1rem", borderRadius: "0.5rem" }}>
        <Text color="inverse">Inverse — for dark surfaces</Text>
      </div>
    </div>
  ),
};

export const Alignment: Story = {
  name: "Text alignment",
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: "32rem" }}>
      <Text align="left">Left-aligned text (default)</Text>
      <Text align="center">Centre-aligned text</Text>
      <Text align="right">Right-aligned text</Text>
    </div>
  ),
};
