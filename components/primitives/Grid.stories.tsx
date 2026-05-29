import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Grid } from "./Grid";

const meta: Meta<typeof Grid> = {
  title:     "Atoms/Grid",
  component: Grid,
  tags:      ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "CSS-grid container with responsive column presets. " +
          "Columns collapse to 1 on mobile. " +
          "`cols` sets the target column count at md+ breakpoint.",
      },
    },
  },
  argTypes: {
    cols: { control: "select", options: [1, 2, 3, 4] },
    gap:  { control: "select", options: ["sm", "md", "lg", "xl"] },
  },
  args: { cols: 3, gap: "md" },
};

export default meta;
type Story = StoryObj<typeof Grid>;

const Cell = ({ n }: { n: number }) => (
  <div
    style={{
      background:   "var(--primary, #6366f1)",
      color:        "#fff",
      padding:      "1.5rem",
      borderRadius: "0.5rem",
      fontWeight:   500,
      textAlign:    "center",
    }}
  >
    Cell {n}
  </div>
);

export const ThreeCol: Story = {
  name: "3-column (default)",
  render: () => (
    <Grid cols={3} gap="md">
      {Array.from({ length: 6 }, (_, i) => <Cell key={i} n={i + 1} />)}
    </Grid>
  ),
};

export const TwoCol: Story = {
  name: "2-column",
  render: () => (
    <Grid cols={2} gap="md">
      {Array.from({ length: 4 }, (_, i) => <Cell key={i} n={i + 1} />)}
    </Grid>
  ),
};

export const FourCol: Story = {
  name: "4-column",
  render: () => (
    <Grid cols={4} gap="sm">
      {Array.from({ length: 8 }, (_, i) => <Cell key={i} n={i + 1} />)}
    </Grid>
  ),
};

export const GapVariants: Story = {
  name: "Gap variants",
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {(["sm", "md", "lg", "xl"] as const).map((gap) => (
        <div key={gap}>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
            gap=&quot;{gap}&quot;
          </p>
          <Grid cols={3} gap={gap}>
            {[1, 2, 3].map((n) => <Cell key={n} n={n} />)}
          </Grid>
        </div>
      ))}
    </div>
  ),
};
