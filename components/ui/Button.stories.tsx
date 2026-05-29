import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./Button";

const meta: Meta<typeof Button> = {
  title:     "Atoms/Button",
  component: Button,
  tags:      ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "The primary interactive element. Four visual variants × three sizes. " +
          "Renders as `<button>` by default; pass `as='a'` with `href` for navigation.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "outline", "ghost"],
      description: "Visual emphasis level.",
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
      description: "Height and horizontal padding.",
    },
    loading: {
      control: "boolean",
      description: "Shows a spinner and disables the button.",
    },
    disabled: {
      control: "boolean",
    },
    children: {
      control: "text",
    },
  },
  args: {
    children: "Button label",
    variant:  "primary",
    size:     "md",
    loading:  false,
    disabled: false,
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// ── Individual variant stories ─────────────────────────────────────────────

export const Primary: Story = {
  args: { variant: "primary" },
};

export const Secondary: Story = {
  args: { variant: "secondary" },
};

export const Outline: Story = {
  args: { variant: "outline" },
};

export const Ghost: Story = {
  args: { variant: "ghost" },
};

// ── Size stories ──────────────────────────────────────────────────────────

export const Small: Story = {
  args: { size: "sm" },
};

export const Medium: Story = {
  args: { size: "md" },
};

export const Large: Story = {
  args: { size: "lg" },
};

// ── State stories ─────────────────────────────────────────────────────────

export const Loading: Story = {
  args: { loading: true, children: "Saving…" },
};

export const Disabled: Story = {
  args: { disabled: true },
};

// ── All variants at once ──────────────────────────────────────────────────

export const AllVariants: Story = {
  name: "All variants",
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
    </div>
  ),
};

export const AllSizes: Story = {
  name: "All sizes",
  render: () => (
    <div className="flex flex-wrap items-end gap-3">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};
