import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FormField } from "./FormField";
import { Input }     from "./Input";
import { Textarea }  from "./Textarea";
import { Select }    from "./Select";

const meta: Meta<typeof FormField> = {
  title:     "Atoms/Form/FormField",
  component: FormField,
  tags:      ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Composable form field wrapper: label → input → hint / error. " +
          "Handles accessible wiring (`htmlFor`, `aria-describedby`, `role=alert`). " +
          "Accepts a plain child node or a render-prop to receive the generated error ID.",
      },
    },
  },
  argTypes: {
    label:    { control: "text" },
    htmlFor:  { control: "text" },
    required: { control: "boolean" },
    hint:     { control: "text" },
    error:    { control: "text", description: "Validation error message. Replaces hint when set." },
  },
  args: {
    label:    "Email address",
    htmlFor:  "email",
    required: false,
    hint:     "",
    error:    "",
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: "24rem" }}>
        <Story />
      </div>
    ),
  ],
  render: (args) => (
    <FormField {...args}>
      <Input id="email" name="email" type="email" placeholder="you@example.com" />
    </FormField>
  ),
};

export default meta;
type Story = StoryObj<typeof FormField>;

export const Default: Story = {};

export const Required: Story = {
  args: {
    label:    "Email address",
    htmlFor:  "email-req",
    required: true,
    hint:     "We'll never share your email.",
  },
  render: (args) => (
    <FormField {...args}>
      <Input id="email-req" name="email" type="email" placeholder="you@example.com" />
    </FormField>
  ),
};

export const WithHint: Story = {
  name: "With hint",
  args: {
    hint: "Use a strong password of at least 8 characters.",
    htmlFor: "pwd",
    label: "Password",
  },
  render: (args) => (
    <FormField {...args}>
      <Input id="pwd" name="password" type="password" />
    </FormField>
  ),
};

export const WithError: Story = {
  name: "With validation error",
  args: {
    error:   "Please enter a valid email address.",
    htmlFor: "email-err",
    label:   "Email address",
  },
  render: (args) => (
    <FormField {...args}>
      {(errorId) => (
        <Input
          id="email-err"
          name="email"
          type="email"
          error
          aria-invalid
          aria-describedby={errorId}
          defaultValue="not-an-email"
        />
      )}
    </FormField>
  ),
};

export const WithTextarea: Story = {
  name: "Textarea field",
  args: {
    label:    "Message",
    htmlFor:  "msg",
    required: true,
  },
  render: (args) => (
    <FormField {...args}>
      <Textarea id="msg" name="message" placeholder="Your message…" rows={4} />
    </FormField>
  ),
};

export const WithSelect: Story = {
  name: "Select field",
  args: {
    label:   "Department",
    htmlFor: "dept",
  },
  render: (args) => (
    <FormField {...args}>
      <Select id="dept" name="department">
        <option value="">Choose a department</option>
        <option value="eng">Engineering</option>
        <option value="design">Design</option>
        <option value="marketing">Marketing</option>
      </Select>
    </FormField>
  ),
};
