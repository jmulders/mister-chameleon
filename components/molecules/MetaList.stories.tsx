import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MetaItem, MetaList } from "./MetaList";

const meta: Meta<typeof MetaItem> = {
  title:     "Molecules/MetaList",
  component: MetaItem,
  tags:      ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Vertical stack of labelled metadata rows. `MetaItem` renders a label + value " +
          "grid row with a bottom-border separator. `MetaList` removes the trailing border " +
          "from its last child. Used for structured fact-lists on vacancy and article detail pages.",
      },
    },
  },
  argTypes: {
    label:  { control: "text" },
    value:  { control: "text" },
    urgent: { control: "boolean" },
  },
  args: {
    label:  "Location",
    value:  "Amsterdam, Netherlands",
    urgent: false,
  },
  decorators: [
    (Story) => (
      <div
        style={{
          maxWidth:     "28rem",
          background:   "var(--card-bg, #fff)",
          borderRadius: "var(--card-radius, 0.5rem)",
          border:       "1px solid var(--card-border, #e2e8f0)",
          paddingBlock: "0.5rem",
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof MetaItem>;

export const SingleItem: Story = {
  name: "Single MetaItem",
  render: (args) => (
    <MetaList>
      <MetaItem {...args} />
    </MetaList>
  ),
};

export const UrgentItem: Story = {
  name: "Urgent value",
  args: { label: "Deadline", value: "31 March 2026", urgent: true },
  render: (args) => (
    <MetaList>
      <MetaItem {...args} />
    </MetaList>
  ),
};

export const VacancyDetails: Story = {
  name: "Vacancy details (MetaList)",
  render: () => (
    <MetaList>
      <MetaItem label="Location"  value="Amsterdam, NL" />
      <MetaItem label="Contract"  value="Full-time" />
      <MetaItem label="Salary"    value="€75,000 – €95,000" />
      <MetaItem label="Level"     value="Senior" />
      <MetaItem label="Start"     value="1 April 2026" />
      <MetaItem label="Deadline"  value="31 March 2026" urgent />
    </MetaList>
  ),
};

export const ArticleMeta: Story = {
  name: "Article metadata",
  render: () => (
    <MetaList>
      <MetaItem label="Author"    value="Sophie van der Berg" />
      <MetaItem label="Published" value="28 March 2026" />
      <MetaItem label="Category"  value="Engineering" />
      <MetaItem label="Read time" value="6 min" />
    </MetaList>
  ),
};

export const WithCustomContent: Story = {
  name: "Custom child content",
  render: () => (
    <MetaList>
      <MetaItem label="Status">
        <span
          style={{
            display:      "inline-flex",
            alignItems:   "center",
            gap:          "0.375rem",
            fontSize:     "0.875rem",
            color:        "var(--color-success-600, #16a34a)",
            fontWeight:   600,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
            <circle cx="6" cy="6" r="6" />
          </svg>
          Active
        </span>
      </MetaItem>
      <MetaItem label="Location" value="Amsterdam, NL" />
    </MetaList>
  ),
};
