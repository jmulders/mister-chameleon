import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Input } from "./Input";

const meta: Meta<typeof Input> = {
  title:     "Atoms/Form/Input",
  component: Input,
  tags:      ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Token-driven `<input>` atom. Inherits all native input attributes. " +
          "Styling is driven entirely by CSS custom properties — colours, radius, and border.",
      },
    },
  },
  argTypes: {
    type: {
      control: "select",
      options: ["text", "email", "tel", "url", "password", "search", "number"],
    },
    placeholder: { control: "text" },
    disabled:    { control: "boolean" },
    error:       { control: "boolean", description: "Applies error-state border colour." },
  },
  args: {
    type:        "text",
    placeholder: "Enter a value…",
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
type Story = StoryObj<typeof Input>;

export const Default: Story = {};

export const WithValue: Story = {
  name: "With value",
  args: { defaultValue: "example@domain.com", type: "email" },
};

export const ErrorState: Story = {
  name: "Error state",
  args: { error: true, defaultValue: "bad-email", type: "email" },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: "Cannot be edited" },
};

export const InputTypes: Story = {
  name: "All input types",
  render: () => (
    <div className="flex flex-col gap-3" style={{ maxWidth: "24rem" }}>
      <Input type="text"     placeholder="text"     />
      <Input type="email"    placeholder="email"    />
      <Input type="tel"      placeholder="tel"      />
      <Input type="url"      placeholder="url"      />
      <Input type="password" placeholder="password" />
      <Input type="search"   placeholder="search"   />
      <Input type="number"   placeholder="number"   />
    </div>
  ),
};
