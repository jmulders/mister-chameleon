import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TextSectionBlock } from "./TextSectionBlock";
import type { TextSectionBlockData } from "@/page-config";
import type { PortableTextBlock } from "@/cms/types";

// ── Mock body ─────────────────────────────────────────────────────────────────

const body: PortableTextBlock[] = [
  {
    _type: "block",
    _key:  "t1",
    style: "normal",
    markDefs: [],
    children: [
      {
        _type: "span",
        _key:  "s1",
        text:  "These Terms of Service govern your use of the platform. By creating an account you agree to be bound by them. We have tried to keep the language as plain as possible — if something is unclear, please reach out.",
        marks: [],
      },
    ],
  },
  {
    _type: "block",
    _key:  "t2",
    style: "h3",
    markDefs: [],
    children: [{ _type: "span", _key: "s2", text: "1. Use of the service", marks: [] }],
  },
  {
    _type: "block",
    _key:  "t3",
    style: "normal",
    markDefs: [],
    children: [
      {
        _type: "span",
        _key:  "s3",
        text:  "You may only use the service for lawful purposes and in accordance with these Terms. You agree not to use the service in any way that violates any applicable local, national, or international law or regulation.",
        marks: [],
      },
    ],
  },
  {
    _type: "block",
    _key:  "t4",
    style: "h3",
    markDefs: [],
    children: [{ _type: "span", _key: "s4", text: "2. Intellectual property", marks: [] }],
  },
  {
    _type: "block",
    _key:  "t5",
    style: "normal",
    markDefs: [],
    children: [
      {
        _type: "span",
        _key:  "s5",
        text:  "The service and its original content (excluding user-generated content) are and will remain the exclusive property of the company and its licensors.",
        marks: [],
      },
    ],
  },
];

// ── Meta ───────────────────────────────────────────────────────────────────────

const meta: Meta<typeof TextSectionBlock> = {
  title:     "Blocks/Sections/TextSection",
  component: TextSectionBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Heading + Portable Text body section. Three variants: text_single (left-aligned column), text_split (heading label left, body right), text_lead (centred large-lead treatment).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof TextSectionBlock>;

// ── Stories ────────────────────────────────────────────────────────────────────

export const Single: Story = {
  name: "text_single — left-aligned column (default)",
  args: {
    data: { heading: "Terms of Service", body } satisfies TextSectionBlockData,
    variant: "text_single",
  },
};

export const Split: Story = {
  name: "text_split — heading left, body right",
  args: {
    data: { heading: "Privacy Policy", body } satisfies TextSectionBlockData,
    variant: "text_split",
  },
};

export const Lead: Story = {
  name: "text_lead — centred large-lead treatment",
  args: {
    data: {
      heading: "A better way to manage content",
      body:    [
        {
          _type: "block",
          _key:  "l1",
          style: "normal",
          markDefs: [],
          children: [
            {
              _type: "span",
              _key:  "s1",
              text:  "We built this platform because we were tired of watching great ideas get stuck in slow processes. Content should flow freely — from idea to audience — without friction.",
              marks: [],
            },
          ],
        },
      ],
    } satisfies TextSectionBlockData,
    variant: "text_lead",
  },
};
