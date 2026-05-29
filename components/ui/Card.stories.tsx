import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Card, CardHeader, CardContent, CardFooter } from "./Card";
import { Button } from "./Button";

const meta: Meta<typeof Card> = {
  title:     "Atoms/Card",
  component: Card,
  tags:      ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Surface container with border, optional shadow, and padding. " +
          "Compose with `CardHeader`, `CardContent`, and `CardFooter` for structured layouts, " +
          "or use `Card` alone with children for simpler cases.",
      },
    },
  },
  argTypes: {
    padding: { control: "select", options: ["none", "sm", "md", "lg"] },
    shadow:  { control: "select", options: ["none", "sm", "md"] },
    hover:   { control: "boolean" },
  },
  args: { padding: "md", shadow: "sm", hover: false },
  decorators: [(Story) => <div style={{ maxWidth: "24rem" }}><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: (args) => (
    <Card {...args}>
      <p style={{ fontSize: "0.875rem" }}>Simple card content — no sub-components needed for basic use.</p>
    </Card>
  ),
};

export const Structured: Story = {
  name: "Structured (Header + Content + Footer)",
  render: () => (
    <Card>
      <CardHeader>
        <h3 style={{ fontWeight: 600, fontSize: "1rem" }}>Card title</h3>
        <p style={{ fontSize: "0.875rem", color: "var(--text-muted, #6b7280)" }}>
          Supporting description
        </p>
      </CardHeader>
      <CardContent>
        <p style={{ fontSize: "0.875rem" }}>
          Main content area. Add any text, media, or components here.
        </p>
      </CardContent>
      <CardFooter>
        <Button size="sm" variant="primary">Action</Button>
        <Button size="sm" variant="ghost" style={{ marginLeft: "0.5rem" }}>Cancel</Button>
      </CardFooter>
    </Card>
  ),
};

export const HoverEffect: Story = {
  name: "Hover effect",
  args: { hover: true },
  render: (args) => (
    <Card {...args}>
      <p style={{ fontSize: "0.875rem" }}>Hover over this card to see the shadow lift.</p>
    </Card>
  ),
};

export const ShadowVariants: Story = {
  name: "Shadow variants",
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {(["none", "sm", "md"] as const).map((shadow) => (
        <Card key={shadow} shadow={shadow}>
          <p style={{ fontSize: "0.875rem" }}>shadow=&quot;{shadow}&quot;</p>
        </Card>
      ))}
    </div>
  ),
};

export const PaddingVariants: Story = {
  name: "Padding variants",
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {(["none", "sm", "md", "lg"] as const).map((padding) => (
        <Card key={padding} padding={padding}>
          <p style={{ fontSize: "0.875rem" }}>padding=&quot;{padding}&quot;</p>
        </Card>
      ))}
    </div>
  ),
};

export const GridOfCards: Story = {
  name: "Grid of cards",
  render: () => (
    <div
      style={{
        display:               "grid",
        gridTemplateColumns:   "repeat(3, 1fr)",
        gap:                   "1.5rem",
        maxWidth:              "56rem",
      }}
    >
      {[
        { title: "Analytics",    desc: "Real-time dashboards and insights." },
        { title: "Integrations", desc: "Connect your favourite tools." },
        { title: "Security",     desc: "Enterprise-grade data protection." },
      ].map(({ title, desc }) => (
        <Card key={title} hover>
          <CardHeader>
            <h3 style={{ fontWeight: 600 }}>{title}</h3>
          </CardHeader>
          <CardContent>
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted, #6b7280)" }}>{desc}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  ),
};
