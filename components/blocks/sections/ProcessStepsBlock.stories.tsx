import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProcessStepsBlock } from "./ProcessStepsBlock";
import type { ProcessStepsBlockData } from "@/page-config";

// ── Mock data ─────────────────────────────────────────────────────────────────

const hiringSteps = [
  {
    title:       "Apply online",
    description: "Submit your CV and a short cover note via our application form. We read every application personally.",
    duration:    "5 min",
  },
  {
    title:       "Screening call",
    description: "A 30-minute call with our recruiter to learn about your background and tell you more about the role and our culture.",
    duration:    "30 min",
  },
  {
    title:       "Technical interview",
    description: "A 60-minute session with two engineers. We focus on problem-solving and collaboration, not whiteboard puzzles.",
    duration:    "60 min",
  },
  {
    title:       "Take-home challenge",
    description: "A real-world task that mirrors the work you would do in this role. We scope it to 3–4 hours and pay you for your time.",
    duration:    "3–4 h",
  },
  {
    title:       "Final interview",
    description: "Meet the wider team, discuss your challenge, and ask us anything. We usually make an offer within 48 hours.",
    duration:    "90 min",
  },
] as const;

const base: ProcessStepsBlockData = {
  heading: "Our hiring process",
  steps:   [...hiringSteps],
};

// ── Meta ───────────────────────────────────────────────────────────────────────

const meta: Meta<typeof ProcessStepsBlock> = {
  title:     "Blocks/Sections/ProcessSteps",
  component: ProcessStepsBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Ordered process steps section. Four variants: " +
          "`default` (numbered vertical list), `accordion` (collapsible details), " +
          "`compact` (tight numbered list), `horizontal` (step track with connecting line — ideal for 3–5 steps on landing pages).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ProcessStepsBlock>;

// ── Stories ────────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: "default — numbered vertical list with dividers",
  args: { data: base, variant: "default" },
};

export const Accordion: Story = {
  name: "accordion — collapsible steps (zero-JS)",
  args: { data: base, variant: "accordion" },
};

export const Compact: Story = {
  name: "compact — tight numbered list",
  args: { data: base, variant: "compact" },
};

export const NoHeading: Story = {
  name: "no section heading",
  args: { data: { ...base, heading: undefined }, variant: "default" },
};

// ── New variant stories ────────────────────────────────────────────────────────

/**
 * horizontal — step track with numbered nodes connected by a horizontal line.
 * Best for short 3–5 step flows; on mobile it falls back to the vertical list.
 */
export const Horizontal: Story = {
  name: "horizontal — step track (landing page / AI product)",
  args: {
    data: {
      heading: "Get set up in three steps",
      steps: [
        {
          title:       "Connect your data",
          description: "Point us at your database, API, or CSV — we handle the rest.",
          duration:    "2 min",
        },
        {
          title:       "Define your rules",
          description: "Use our no-code rule builder or drop in your own SQL.",
          duration:    "5 min",
        },
        {
          title:       "Go live",
          description: "Publish your changes and start seeing results in real time.",
          duration:    "Instant",
        },
      ],
    },
    variant: "horizontal",
  },
};

export const HorizontalFiveSteps: Story = {
  name: "horizontal — five steps (full hiring flow)",
  args: { data: base, variant: "horizontal" },
};

export const HorizontalMobile: Story = {
  name: "horizontal — mobile (375px, falls back to vertical)",
  args: {
    data: {
      heading: "Get set up in three steps",
      steps: [
        { title: "Connect your data",  description: "Point us at your source.", duration: "2 min"  },
        { title: "Define your rules",  description: "No-code rule builder.",    duration: "5 min"  },
        { title: "Go live",            description: "Publish and see results.", duration: "Instant" },
      ],
    },
    variant: "horizontal",
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};
