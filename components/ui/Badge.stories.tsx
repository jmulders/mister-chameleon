import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "./Badge";

const meta: Meta<typeof Badge> = {
  title:     "Atoms/Badge",
  component: Badge,
  tags:      ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Small inline label for statuses, categories, and counts. " +
          "Six semantic colour variants + optional leading dot indicator.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "primary", "success", "warning", "error", "outline"],
    },
    size: {
      control: "select",
      options: ["sm", "md"],
    },
    dot: {
      control: "boolean",
      description: "Shows a coloured dot before the label.",
    },
    children: { control: "text" },
  },
  args: {
    children: "Badge",
    variant:  "default",
    size:     "sm",
    dot:      false,
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {};

export const Primary: Story   = { args: { variant: "primary",  children: "New"      } };
export const Success: Story   = { args: { variant: "success",  children: "Active"   } };
export const Warning: Story   = { args: { variant: "warning",  children: "Pending"  } };
export const Error: Story     = { args: { variant: "error",    children: "Failed"   } };
export const Outline: Story   = { args: { variant: "outline",  children: "Inactive" } };

export const WithDot: Story = {
  name: "With dot",
  args: { variant: "success", children: "Online", dot: true },
};

export const AllVariants: Story = {
  name: "All variants",
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="default">Default</Badge>
      <Badge variant="primary">Primary</Badge>
      <Badge variant="success" dot>Success</Badge>
      <Badge variant="warning" dot>Warning</Badge>
      <Badge variant="error"   dot>Error</Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
  ),
};
