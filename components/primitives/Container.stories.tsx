import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Container } from "./Container";

const meta: Meta<typeof Container> = {
  title:     "Atoms/Container",
  component: Container,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Constrains content to a max-width with symmetric horizontal padding. " +
          "Always pair with `Section` for a complete layout unit. " +
          "Five sizes: `sm` (640px), `md` (896px), `lg` (1152px default), `xl` (1280px), `full` (no max).",
      },
    },
  },
  argTypes: {
    size: { control: "select", options: ["sm", "md", "lg", "xl", "full"] },
  },
  args: { size: "lg" },
};

export default meta;
type Story = StoryObj<typeof Container>;

const Filler = ({ label }: { label: string }) => (
  <div
    style={{
      background: "var(--primary, #6366f1)",
      color:      "#fff",
      padding:    "1rem",
      fontSize:   "0.875rem",
      fontWeight: 500,
      borderRadius: "0.375rem",
      textAlign:  "center",
    }}
  >
    {label}
  </div>
);

export const Default: Story = {
  render: (args) => (
    <div style={{ background: "var(--section-subtle-bg, #f8fafc)", padding: "2rem 0" }}>
      <Container {...args}>
        <Filler label={`size="${args.size}" — content area`} />
      </Container>
    </div>
  ),
};

export const AllSizes: Story = {
  name: "All sizes",
  render: () => (
    <div style={{ background: "var(--section-subtle-bg, #f8fafc)", padding: "2rem 0", display: "flex", flexDirection: "column", gap: "1rem" }}>
      {(["sm", "md", "lg", "xl", "full"] as const).map((size) => (
        <Container key={size} size={size}>
          <Filler label={`size="${size}"`} />
        </Container>
      ))}
    </div>
  ),
};

export const AsMain: Story = {
  name: "Semantic element (as=main)",
  render: () => (
    <Container as="main" size="md">
      <Filler label="Rendered as <main>" />
    </Container>
  ),
};
