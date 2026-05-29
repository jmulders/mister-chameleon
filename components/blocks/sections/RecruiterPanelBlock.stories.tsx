import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RecruiterPanelBlock } from "./RecruiterPanelBlock";
import type { RecruiterPanelBlockData } from "@/page-config";

// ── Mock data ─────────────────────────────────────────────────────────────────

const full: RecruiterPanelBlockData = {
  heading:   "Questions about this role?",
  name:      "Lisa van Dijk",
  role:      "Talent Partner",
  bio:       "Lisa manages hiring for our engineering and product teams. She is happy to answer any questions about the role, the team, or our culture before you apply.",
  avatarUrl: "https://i.pravatar.cc/80?img=47",
  email:     "lisa@example.com",
  phone:     "+31 20 123 4567",
  ctaLabel:  "Send Lisa a message",
  ctaHref:   "mailto:lisa@example.com",
};

// ── Meta ───────────────────────────────────────────────────────────────────────

const meta: Meta<typeof RecruiterPanelBlock> = {
  title:     "Blocks/Sections/RecruiterPanel",
  component: RecruiterPanelBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Recruiter contact card for vacancy detail pages. Three variants: default (full card with avatar + bio + contact row), compact (minimal inline bar), card (elevated standalone card).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof RecruiterPanelBlock>;

// ── Stories ────────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: "default — full card: avatar + name/role/bio + contact row",
  args: { data: full, variant: "default" },
};

export const Compact: Story = {
  name: "compact — minimal inline bar",
  args: { data: full, variant: "compact" },
};

export const Card: Story = {
  name: "card — elevated standalone card",
  args: { data: full, variant: "card" },
};

export const NoAvatar: Story = {
  name: "default — initials fallback (no avatar URL)",
  args: {
    data: { ...full, avatarUrl: undefined } satisfies RecruiterPanelBlockData,
    variant: "default",
  },
};

export const EmailOnly: Story = {
  name: "compact — email only, no phone",
  args: {
    data: {
      name:     "Tom Janssen",
      role:     "Recruiter",
      email:    "tom@example.com",
      ctaLabel: "Email Tom",
      ctaHref:  "mailto:tom@example.com",
    } satisfies RecruiterPanelBlockData,
    variant: "compact",
  },
};
