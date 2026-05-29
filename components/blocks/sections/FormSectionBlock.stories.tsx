/**
 * FormSectionBlock stories
 *
 * The component calls getFormDefinition() at render time, so a valid
 * registered FormKey must be used — "contact", "application", or "appointment".
 * All variants share the same form definition; the variant only changes the
 * section wrapper / layout.
 *
 * NOTE: In Storybook the submit action POSTs to /api/forms/[formKey] which is
 * not available.  The UI will show a network error — that is expected.
 */

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FormSectionBlock } from "./FormSectionBlock";
import type { FormBlockData } from "@/page-config";

const contactData: FormBlockData = {
  formKey:        "contact",
  title:          "Get in touch",
  intro:          "Fill in the form and we will get back to you within one business day.",
  submitLabel:    "Send message",
  successMessage: "Thanks — your message has been sent!",
};

const meta: Meta<typeof FormSectionBlock> = {
  title:     "Blocks/Sections/FormSection",
  component: FormSectionBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Platform-driven form section. The field structure, validation, and routing come from the registered FormDefinition. Variants control the section wrapper style.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof FormSectionBlock>;

export const Default: Story = {
  name: "default — subtle bg, border separator",
  args: { data: contactData, variant: "default" },
};

export const Card: Story = {
  name: "card — form inside elevated card",
  args: { data: { ...contactData, title: "Book a demo", intro: "Tell us a bit about your project and we will set up a 30-minute call." }, variant: "card" },
};

export const Minimal: Story = {
  name: "minimal — no section bg (for embedding in article content)",
  args: { data: { ...contactData, title: "Leave a comment", intro: undefined }, variant: "minimal" },
};

export const Split: Story = {
  name: "form_split — intro left, form right",
  args: {
    data: {
      formKey:     "contact",
      title:       "Start a conversation",
      intro:       "Whether you have a question, a brief, or just want to explore what we can build together — we read every message.",
      submitLabel: "Send",
    },
    variant: "form_split",
  },
};

export const ApplicationForm: Story = {
  name: "application form (card variant)",
  args: {
    data: {
      formKey:     "application",
      title:       "Apply now",
      intro:       "Complete the form below to submit your application.",
      submitLabel: "Submit application",
    },
    variant: "card",
  },
};
