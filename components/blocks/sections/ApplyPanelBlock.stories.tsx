import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ApplyPanelBlock } from "./ApplyPanelBlock";
import type { ApplyPanelBlockData } from "@/page-config";

// ── Meta ───────────────────────────────────────────────────────────────────────

const meta: Meta<typeof ApplyPanelBlock> = {
  title:     "Blocks/Sections/ApplyPanel",
  component: ApplyPanelBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Primary application CTA for a vacancy detail page. Supports external ATS links (primaryCta) or an inline platform form (formKey). Shows urgency callout when deadline is within 14 days.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ApplyPanelBlock>;

// ── Stories ────────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: "default — full-width CTA section",
  args: {
    data: {
      heading:     "Ready to join the team?",
      body:        "We review every application personally and aim to respond within five business days.",
      primaryCta:  { label: "Apply now", href: "#" },
      secondaryCta: { label: "Ask a question", href: "#" },
    } satisfies ApplyPanelBlockData,
    variant: "default",
  },
};

export const Inline: Story = {
  name: "inline — card embedded mid-page",
  args: {
    data: {
      heading:    "Apply for this role",
      body:       "Send us your CV and a short note about why you are a great fit.",
      primaryCta: { label: "Apply on LinkedIn", href: "#" },
    } satisfies ApplyPanelBlockData,
    variant: "inline",
  },
};

export const UrgentDeadline: Story = {
  name: "default — urgency callout (deadline in 3 days)",
  args: {
    data: {
      heading:      "Applications close soon",
      body:         "Do not miss your chance — submit your application before the deadline.",
      primaryCta:   { label: "Apply now", href: "#" },
      closingDate:  new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    } satisfies ApplyPanelBlockData,
    variant: "default",
  },
};

export const WithForm: Story = {
  name: "inline — platform form (formKey: 'application')",
  args: {
    data: {
      heading: "Apply now",
      body:    "Complete the form below. We read every submission personally.",
      formKey: "application",
    } satisfies ApplyPanelBlockData,
    variant: "inline",
  },
};

export const PrimaryOnly: Story = {
  name: "default — primary CTA only",
  args: {
    data: {
      heading:    "Join our team",
      primaryCta: { label: "View open roles", href: "/careers" },
    } satisfies ApplyPanelBlockData,
    variant: "default",
  },
};
