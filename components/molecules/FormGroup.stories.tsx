import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FormGroup } from "./FormGroup";
import { FormField } from "@/components/ui/FormField";
import { Input }     from "@/components/ui/Input";
import { Textarea }  from "@/components/ui/Textarea";
import { Select }    from "@/components/ui/Select";

const meta: Meta<typeof FormGroup> = {
  title:     "Molecules/FormGroup",
  component: FormGroup,
  tags:      ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Semantic `<fieldset>`/`<legend>` grouper for logically related form fields. " +
          "When `legend` is omitted, renders a plain `Stack`. " +
          "Uses design tokens for legend colour and weight.",
      },
    },
  },
  argTypes: {
    legend: { control: "text" },
    gap:    { control: "select", options: [2, 3, 4, 5, 6, 8] },
  },
  args: {
    legend: "Personal details",
    gap:    5,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: "32rem" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof FormGroup>;

export const Default: Story = {
  render: (args) => (
    <FormGroup {...args}>
      <FormField label="First name" htmlFor="fn">
        <Input id="fn" name="firstName" placeholder="Jane" />
      </FormField>
      <FormField label="Last name" htmlFor="ln">
        <Input id="ln" name="lastName" placeholder="Smith" />
      </FormField>
      <FormField label="Email address" htmlFor="em">
        <Input id="em" name="email" type="email" placeholder="jane@example.com" />
      </FormField>
    </FormGroup>
  ),
};

export const NoLegend: Story = {
  name: "No legend (plain Stack)",
  args: { legend: "" },
  render: (args) => (
    <FormGroup {...args}>
      <FormField label="Email address" htmlFor="em2">
        <Input id="em2" name="email" type="email" placeholder="you@example.com" />
      </FormField>
      <FormField label="Password" htmlFor="pw">
        <Input id="pw" name="password" type="password" />
      </FormField>
    </FormGroup>
  ),
};

export const MultiSection: Story = {
  name: "Multi-section form",
  render: () => (
    <form style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <FormGroup legend="Personal details">
        <FormField label="Full name" htmlFor="ms-name" required>
          <Input id="ms-name" name="name" placeholder="Jane Smith" />
        </FormField>
        <FormField label="Email" htmlFor="ms-email" required>
          <Input id="ms-email" name="email" type="email" placeholder="jane@example.com" />
        </FormField>
      </FormGroup>

      <FormGroup legend="Work details">
        <FormField label="Department" htmlFor="ms-dept">
          <Select id="ms-dept" name="department">
            <option value="">Choose a department</option>
            <option value="eng">Engineering</option>
            <option value="design">Design</option>
            <option value="marketing">Marketing</option>
          </Select>
        </FormField>
        <FormField label="Motivation" htmlFor="ms-msg">
          <Textarea id="ms-msg" name="motivation" rows={3} placeholder="Tell us why you'd like to join…" />
        </FormField>
      </FormGroup>
    </form>
  ),
};

export const TightGap: Story = {
  name: "Tight gap (gap=3)",
  args: { gap: 3, legend: "Contact info" },
  render: (args) => (
    <FormGroup {...args}>
      <FormField label="Phone" htmlFor="ph">
        <Input id="ph" name="phone" type="tel" placeholder="+31 6 1234 5678" />
      </FormField>
      <FormField label="Website" htmlFor="web">
        <Input id="web" name="website" type="url" placeholder="https://yoursite.com" />
      </FormField>
    </FormGroup>
  ),
};
