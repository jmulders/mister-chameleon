import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FaqSectionBlock } from "./FaqSectionBlock";
import type { FaqSectionBlockData } from "@/page-config";

// ── Fixture data ──────────────────────────────────────────────────────────────
// FAQ answers are plain text strings — the Sanity faqSection schema uses
// type "text", not Portable Text.  Do not wrap in block arrays.

const shortFaqs: FaqSectionBlockData = {
  heading: "Frequently asked questions",
  items: [
    {
      question: "What is included in the plan?",
      answer:
        "All plans include unlimited access to features, priority support, and monthly usage reports. You can cancel at any time with no penalties.",
    },
    {
      question: "Can I cancel at any time?",
      answer:
        "Yes — cancel from your account settings at any time. Your access continues until the end of the current billing period.",
    },
    {
      question: "Is there a free trial?",
      answer:
        "We offer a 14-day free trial on all plans. No credit card required to get started.",
    },
    {
      question: "How does billing work?",
      answer:
        "Billing is monthly or annual. Annual plans receive a 20% discount automatically applied at checkout.",
    },
  ],
};

const longFaqs: FaqSectionBlockData = {
  heading: "Everything you need to know",
  items: [
    ...shortFaqs.items!,
    {
      question: "Do you offer team plans?",
      answer:
        "Yes. Team plans support up to 50 seats and include a shared dashboard, admin controls, and SSO.",
    },
    {
      question: "Can I export my data?",
      answer:
        "You can export all your data as CSV or JSON at any time from the account settings panel.",
    },
    {
      question: "Is my data secure?",
      answer:
        "We are SOC 2 Type II certified and GDPR compliant. Data is encrypted at rest and in transit.",
    },
    {
      question: "What payment methods are accepted?",
      answer:
        "We accept Visa, Mastercard, American Express, and SEPA direct debit for European customers.",
    },
  ],
};

const noHeading: FaqSectionBlockData = {
  items: shortFaqs.items,
};

const meta: Meta<typeof FaqSectionBlock> = {
  title:     "Blocks/Sections/FaqSection",
  component: FaqSectionBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "FAQ accordion block. Renders an optional heading followed by native " +
          "`<details>`/`<summary>` accordion items. Two variants: " +
          "`default` (single-column) and `two-col` (two-column grid for dense sets).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof FaqSectionBlock>;

export const Default: Story = {
  args: {
    data:    shortFaqs,
    variant: "default",
  },
};

export const TwoColumn: Story = {
  name: "Two-column (dense set)",
  args: {
    data:    longFaqs,
    variant: "two-col",
  },
};

export const NoHeading: Story = {
  name: "No heading",
  args: {
    data:    noHeading,
    variant: "default",
  },
};

export const FaqDefault: Story = {
  name: "Canonical: faq_default",
  args: {
    data:    shortFaqs,
    variant: "faq_default",
  },
};

export const FaqSplit: Story = {
  name: "Canonical: faq_split",
  args: {
    data:    longFaqs,
    variant: "faq_split",
  },
};
