import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Accordion, AccordionItem } from "./Accordion";
import { Text } from "@/components/primitives/Text";

const meta: Meta<typeof AccordionItem> = {
  title:     "Molecules/Accordion",
  component: AccordionItem,
  tags:      ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Zero-JS collapsible panel built on native `<details>`/`<summary>`. " +
          "No JavaScript required — open/close is handled by the browser. " +
          "The `Accordion` wrapper stacks multiple `AccordionItem` elements with consistent gap.",
      },
    },
  },
  argTypes: {
    title:       { control: "text" },
    defaultOpen: { control: "boolean" },
  },
  args: {
    title:       "What is included in the plan?",
    defaultOpen: false,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: "40rem" }}>
        <Story />
      </div>
    ),
  ],
  render: (args) => (
    <AccordionItem {...args}>
      <Text color="muted">
        Our plan includes unlimited access to all features, priority support,
        and monthly reporting. You can cancel at any time with no penalties.
      </Text>
    </AccordionItem>
  ),
};

export default meta;
type Story = StoryObj<typeof AccordionItem>;

export const Default: Story = {};

export const OpenByDefault: Story = {
  name: "Open by default",
  args: { defaultOpen: true },
};

export const FAQGroup: Story = {
  name: "FAQ group (Accordion wrapper)",
  render: () => (
    <div style={{ maxWidth: "40rem" }}>
      <Accordion>
        <AccordionItem title="What is included in the plan?" defaultOpen>
          <Text color="muted">
            All plans include unlimited access to features, priority support, and monthly reports.
          </Text>
        </AccordionItem>
        <AccordionItem title="Can I cancel at any time?">
          <Text color="muted">
            Yes — cancel from your account settings at any time with no additional fees.
          </Text>
        </AccordionItem>
        <AccordionItem title="Is there a free trial?">
          <Text color="muted">
            We offer a 14-day free trial on all plans. No credit card required.
          </Text>
        </AccordionItem>
        <AccordionItem title="How does billing work?">
          <Text color="muted">
            Billing is monthly or annual. Annual plans receive a 20% discount automatically.
          </Text>
        </AccordionItem>
      </Accordion>
    </div>
  ),
};

export const SingleItem: Story = {
  name: "Single item (no wrapper)",
  render: () => (
    <div style={{ maxWidth: "40rem" }}>
      <AccordionItem title="Expand for more detail" defaultOpen>
        <Text color="muted">
          This is a standalone accordion item used outside of an Accordion group wrapper.
          Useful for inline progressive disclosure.
        </Text>
      </AccordionItem>
    </div>
  ),
};

export const TightGap: Story = {
  name: "Tight gap variant",
  render: () => (
    <div style={{ maxWidth: "40rem" }}>
      <Accordion gap={1}>
        <AccordionItem title="Section A">
          <Text color="muted">Content for section A.</Text>
        </AccordionItem>
        <AccordionItem title="Section B">
          <Text color="muted">Content for section B.</Text>
        </AccordionItem>
        <AccordionItem title="Section C">
          <Text color="muted">Content for section C.</Text>
        </AccordionItem>
      </Accordion>
    </div>
  ),
};
