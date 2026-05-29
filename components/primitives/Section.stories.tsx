import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Section } from "./Section";
import { Container } from "./Container";

const meta: Meta<typeof Section> = {
  title:     "Atoms/Section",
  component: Section,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Semantic `<section>` with standardised vertical padding. " +
          "Always pair with `Container` for a complete layout unit. " +
          "Five spacing presets: `sm` (40px), `md` (64px), `lg` (96px), `xl` (128px), `none`.",
      },
    },
  },
  argTypes: {
    spacing: { control: "select", options: ["none", "sm", "md", "lg", "xl"] },
  },
  args: { spacing: "md" },
};

export default meta;
type Story = StoryObj<typeof Section>;

const InnerContent = ({ label }: { label: string }) => (
  <Container size="lg">
    <div
      style={{
        background:   "var(--primary, #6366f1)",
        color:        "#fff",
        padding:      "1rem",
        borderRadius: "0.5rem",
        textAlign:    "center",
        fontSize:     "0.875rem",
        fontWeight:   500,
      }}
    >
      {label}
    </div>
  </Container>
);

export const Default: Story = {
  render: (args) => (
    <Section {...args}>
      <InnerContent label={`spacing="${args.spacing}" — section content area`} />
    </Section>
  ),
};

export const AllSpacings: Story = {
  name: "All spacing variants",
  render: () => (
    <div>
      {(["none", "sm", "md", "lg", "xl"] as const).map((spacing, i) => (
        <Section
          key={spacing}
          spacing={spacing}
          style={{ background: i % 2 === 0 ? "var(--section-subtle-bg, #f8fafc)" : "white" }}
        >
          <InnerContent label={`spacing="${spacing}"`} />
        </Section>
      ))}
    </div>
  ),
};

export const WithBackground: Story = {
  name: "With background token",
  render: () => (
    <Section
      spacing="lg"
      style={{ background: "var(--section-cta-bg, #4f46e5)" }}
    >
      <Container size="md">
        <div style={{ color: "#fff", textAlign: "center", fontWeight: 600 }}>
          Section with background token
        </div>
      </Container>
    </Section>
  ),
};
