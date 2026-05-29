import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ContentSectionBlock } from "./ContentSectionBlock";
import type { ContentSectionBlockData } from "@/page-config";
import type { PortableTextBlock } from "@/cms/types";

// ── Mock Portable Text ────────────────────────────────────────────────────────

const bodyBlocks: PortableTextBlock[] = [
  {
    _type: "block",
    _key:  "c1",
    style: "normal",
    markDefs: [],
    children: [
      {
        _type: "span",
        _key:  "s1",
        text:  "We believe great software starts with clear thinking. Our process combines structured discovery workshops with rapid prototyping so you can validate assumptions before writing a single line of production code.",
        marks: [],
      },
    ],
  },
  {
    _type: "block",
    _key:  "c2",
    style: "normal",
    markDefs: [],
    children: [
      {
        _type: "span",
        _key:  "s2",
        text:  "Every engagement begins with a two-day kickoff where we map your users, constraints, and success metrics. From there we move into weekly shipping cycles with demos every Friday.",
        marks: [],
      },
    ],
  },
];

// ── Shared base data ──────────────────────────────────────────────────────────

const base: ContentSectionBlockData = {
  eyebrow:  "Our process",
  heading:  "From idea to shipped product in eight weeks",
  intro:    "A sprint-based delivery model that keeps stakeholders aligned and reduces the risk of building the wrong thing.",
  body:     bodyBlocks,
  ctas: [
    { label: "See how it works", href: "#", variant: "primary" },
    { label: "View case studies", href: "#", variant: "secondary" },
  ],
};

// ── Meta ───────────────────────────────────────────────────────────────────────

const meta: Meta<typeof ContentSectionBlock> = {
  title:     "Blocks/Sections/ContentSection",
  component: ContentSectionBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Flexible editorial section: eyebrow + heading + intro + Portable Text body + 0–2 CTAs. Two variants: content_default (single column) and content_split (heading left, body right).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ContentSectionBlock>;

// ── Stories ────────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: "content_default — single left-aligned column",
  args: { data: base, variant: "content_default" },
};

export const Split: Story = {
  name: "content_split — eyebrow/heading left, body right",
  args: { data: base, variant: "content_split" },
};

export const NoCTAs: Story = {
  name: "no CTAs",
  args: { data: { ...base, ctas: [] }, variant: "content_default" },
};

export const IntroOnly: Story = {
  name: "intro only — no body or CTAs",
  args: {
    data: {
      eyebrow:  "Quick note",
      heading:  "We are currently in private beta",
      intro:    "Join the waitlist and we will let you know as soon as we open the doors.",
    },
    variant: "content_default",
  },
};
