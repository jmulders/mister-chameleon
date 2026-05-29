import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ContactSectionBlock } from "./ContactSectionBlock";
import type { ContactSectionBlockData } from "@/page-config";

const fullData: ContactSectionBlockData = {
  heading:     "Get in touch",
  description: "Our team is based in Amsterdam and available during European business hours. We typically respond within one business day.",
  address:     "Prinsengracht 263\n1016 GV Amsterdam\nThe Netherlands",
  phone:       "+31 20 123 4567",
  email:       "hello@example.com",
  hours:       "Mon–Fri 09:00–17:30 CET",
  mapUrl:      "https://maps.google.com/?q=Prinsengracht+263+Amsterdam",
  ctas:        [
    { label: "Send a message", href: "/contact/form" },
    { label: "Book a demo",    href: "/demo" },
  ],
};

const splitData: ContactSectionBlockData = {
  heading:  "Visit our office",
  address:  "Prinsengracht 263\n1016 GV Amsterdam\nThe Netherlands",
  phone:    "+31 20 123 4567",
  email:    "hello@example.com",
  hours:    "Mon–Fri 09:00–17:30 CET",
  mapUrl:   "https://maps.google.com/?q=Prinsengracht+263+Amsterdam",
};

const minimalData: ContactSectionBlockData = {
  phone: "+31 20 123 4567",
  email: "hello@example.com",
  address: "Amsterdam, Netherlands",
};

const emailOnlyData: ContactSectionBlockData = {
  heading:     "Questions?",
  description: "Reach us any time — we read every email.",
  email:       "support@example.com",
  hours:       "Responses within 1 business day",
};

const meta: Meta<typeof ContactSectionBlock> = {
  title:     "Blocks/Sections/ContactSection",
  component: ContactSectionBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Contact details section. Three variants: " +
          "`contact_default` (stacked contact card on subtle bg, default), " +
          "`contact_split` (details left, map / link right), " +
          "`contact_minimal` (compact inline row of icon+value pairs).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ContactSectionBlock>;

export const Default: Story = {
  name: "contact_default — stacked card",
  args: { data: fullData, variant: "contact_default" },
};

export const Split: Story = {
  name: "contact_split — details + map",
  args: { data: splitData, variant: "contact_split" },
};

export const Minimal: Story = {
  name: "contact_minimal — inline row",
  args: { data: minimalData, variant: "contact_minimal" },
};

export const EmailOnly: Story = {
  name: "Email only (no phone or address)",
  args: { data: emailOnlyData, variant: "contact_default" },
};

export const NoHeading: Story = {
  name: "No heading",
  args: {
    data:    { address: fullData.address, phone: fullData.phone, email: fullData.email, hours: fullData.hours },
    variant: "contact_default",
  },
};

export const WithCTAs: Story = {
  name: "With CTAs",
  args: { data: fullData, variant: "contact_split" },
};
