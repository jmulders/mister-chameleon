import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Stack } from "./Stack";

const meta: Meta<typeof Stack> = {
  title:     "Atoms/Stack",
  component: Stack,
  tags:      ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "One-dimensional flex container — column by default, or row. " +
          "Controls direction, gap, alignment, and wrapping via props. " +
          "Used as the primary layout primitive throughout all molecules and blocks.",
      },
    },
  },
  argTypes: {
    direction: {
      control: "select",
      options: ["col", "row"],
    },
    gap: {
      control: "select",
      options: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, "px"],
    },
    align: {
      control: "select",
      options: ["start", "center", "end", "stretch", "baseline"],
    },
    justify: {
      control: "select",
      options: ["start", "center", "end", "between", "around", "evenly"],
    },
    wrap: { control: "boolean" },
  },
  args: {
    direction: "col",
    gap:       4,
    wrap:      false,
  },
};

export default meta;
type Story = StoryObj<typeof Stack>;

// Helper tile for visual demos
const Tile = ({ label, width = "auto" }: { label: string; width?: string }) => (
  <div
    style={{
      background:    "var(--primary, #6366f1)",
      color:         "#fff",
      padding:       "0.5rem 1rem",
      borderRadius:  "0.375rem",
      fontSize:      "0.875rem",
      fontWeight:    500,
      width,
      textAlign:     "center",
    }}
  >
    {label}
  </div>
);

export const Column: Story = {
  name: "Column (default)",
  render: () => (
    <Stack direction="col" gap={3}>
      <Tile label="Item 1" />
      <Tile label="Item 2" />
      <Tile label="Item 3" />
    </Stack>
  ),
};

export const Row: Story = {
  render: () => (
    <Stack direction="row" gap={3}>
      <Tile label="Item 1" />
      <Tile label="Item 2" />
      <Tile label="Item 3" />
    </Stack>
  ),
};

export const GapVariants: Story = {
  name: "Gap variants",
  render: () => (
    <Stack direction="col" gap={8}>
      {([0, 2, 4, 6, 8, 12] as const).map((gap) => (
        <div key={gap}>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
            gap={gap}
          </p>
          <Stack direction="row" gap={gap}>
            <Tile label="A" />
            <Tile label="B" />
            <Tile label="C" />
          </Stack>
        </div>
      ))}
    </Stack>
  ),
};

export const Alignment: Story = {
  name: "Cross-axis alignment",
  render: () => (
    <Stack direction="col" gap={6}>
      {(["start", "center", "end"] as const).map((align) => (
        <div key={align}>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
            align=&quot;{align}&quot;
          </p>
          <Stack
            direction="row"
            gap={3}
            align={align}
            style={{ background: "var(--subtle, #f8fafc)", padding: "0.75rem", borderRadius: "0.5rem" }}
          >
            <Tile label="Short" />
            <Tile label="Taller item" width="6rem" />
            <Tile label="Item" />
          </Stack>
        </div>
      ))}
    </Stack>
  ),
};

export const Justify: Story = {
  name: "Main-axis justify",
  render: () => (
    <Stack direction="col" gap={6}>
      {(["start", "center", "end", "between"] as const).map((justify) => (
        <div key={justify}>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
            justify=&quot;{justify}&quot;
          </p>
          <Stack
            direction="row"
            gap={3}
            justify={justify}
            style={{ background: "var(--subtle, #f8fafc)", padding: "0.75rem", borderRadius: "0.5rem" }}
          >
            <Tile label="A" />
            <Tile label="B" />
            <Tile label="C" />
          </Stack>
        </div>
      ))}
    </Stack>
  ),
};

export const Wrapping: Story = {
  name: "Flex wrap",
  render: () => (
    <Stack direction="row" gap={3} wrap style={{ maxWidth: "20rem" }}>
      {["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta"].map((label) => (
        <Tile key={label} label={label} />
      ))}
    </Stack>
  ),
};

export const SemanticElement: Story = {
  name: "Semantic element (as=ul)",
  render: () => (
    <Stack as="ul" direction="col" gap={2} style={{ listStyle: "none", padding: 0, margin: 0 }}>
      <li><Tile label="List item 1" /></li>
      <li><Tile label="List item 2" /></li>
      <li><Tile label="List item 3" /></li>
    </Stack>
  ),
};
