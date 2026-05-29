import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Textarea } from "./Textarea";

const meta: Meta<typeof Textarea> = {
  title:     "Atoms/Form/Textarea",
  component: Textarea,
  tags:      ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Token-driven `<textarea>` atom — the multi-line counterpart to Input. " +
          "Accepts all native textarea attributes.",
      },
    },
  },
  argTypes: {
    rows:        { control: "number" },
    placeholder: { control: "text" },
    disabled:    { control: "boolean" },
    error:       { control: "boolean" },
  },
  args: {
    rows:        4,
    placeholder: "Enter your message…",
    error:       false,
    disabled:    false,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: "24rem" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Textarea>;

export const Default: Story = {};

export const ErrorState: Story = {
  name: "Error state",
  args: { error: true },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: "Cannot be edited" },
};
