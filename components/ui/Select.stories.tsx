import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Select } from "./Select";

const meta: Meta<typeof Select> = {
  title:     "Atoms/Form/Select",
  component: Select,
  tags:      ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Token-driven native `<select>` atom. A drop-in replacement for `<select>` " +
          "with consistent cross-tenant styling. Children are `<option>` elements.",
      },
    },
  },
  argTypes: {
    disabled: { control: "boolean" },
    error:    { control: "boolean" },
  },
  args: {
    error:    false,
    disabled: false,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: "24rem" }}>
        <Story />
      </div>
    ),
  ],
  render: (args) => (
    <Select {...args}>
      <option value="" disabled>Select a country</option>
      <option value="nl">Netherlands</option>
      <option value="de">Germany</option>
      <option value="be">Belgium</option>
      <option value="fr">France</option>
    </Select>
  ),
};

export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {};

export const ErrorState: Story = {
  name: "Error state",
  args: { error: true },
};

export const Disabled: Story = {
  args: { disabled: true },
};
