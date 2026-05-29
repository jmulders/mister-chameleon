import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RichTextBlock } from "./RichTextBlock";
import type { RichTextBlockData } from "@/page-config";
import type { PortableTextBlock } from "@/cms/types";

// ── Mock body ─────────────────────────────────────────────────────────────────

const body: PortableTextBlock[] = [
  {
    _type: "block",
    _key:  "r1",
    style: "h2",
    markDefs: [],
    children: [{ _type: "span", _key: "s1", text: "Why content architecture matters", marks: [] }],
  },
  {
    _type: "block",
    _key:  "r2",
    style: "normal",
    markDefs: [],
    children: [
      { _type: "span", _key: "s2", text: "Most teams underestimate the cost of unstructured content. When editorial copy lives as blobs of HTML, ", marks: [] },
      { _type: "span", _key: "s3", text: "migrating, repurposing, and governing it becomes an engineering problem", marks: ["strong"] },
      { _type: "span", _key: "s4", text: " instead of an editorial one.", marks: [] },
    ],
  },
  {
    _type: "block",
    _key:  "r3",
    style: "blockquote",
    markDefs: [],
    children: [
      { _type: "span", _key: "s5", text: "Structure is the difference between content you own and content that owns you.", marks: [] },
    ],
  },
  {
    _type: "block",
    _key:  "r4",
    style: "h3",
    markDefs: [],
    children: [{ _type: "span", _key: "s6", text: "The three-layer model", marks: [] }],
  },
  {
    _type: "block",
    _key:  "r5",
    style: "normal",
    markDefs: [],
    children: [
      { _type: "span", _key: "s7", text: "Think of your content stack in three layers: the ", marks: [] },
      { _type: "span", _key: "s8", text: "schema layer", marks: ["em"] },
      { _type: "span", _key: "s9", text: " (what fields exist), the ", marks: [] },
      { _type: "span", _key: "s10", text: "authoring layer", marks: ["em"] },
      { _type: "span", _key: "s11", text: " (how editors create content), and the ", marks: [] },
      { _type: "span", _key: "s12", text: "delivery layer", marks: ["em"] },
      { _type: "span", _key: "s13", text: " (how content reaches its audience). Each layer has different owners and different change rates.", marks: [] },
    ],
  },
];

// ── Meta ───────────────────────────────────────────────────────────────────────

const meta: Meta<typeof RichTextBlock> = {
  title:     "Blocks/Sections/RichText",
  component: RichTextBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "General-purpose Portable Text body drop-in. The block-level maxWidth field takes priority over the variant prop. Three width options: narrow, default, wide.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof RichTextBlock>;

// ── Stories ────────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: "default — standard content-column width",
  args: { data: { body }, variant: "default" },
};

export const Narrow: Story = {
  name: "narrow — ~65ch reading-width column",
  args: { data: { body, maxWidth: "narrow" }, variant: "narrow" },
};

export const Wide: Story = {
  name: "wide — full container width",
  args: { data: { body, maxWidth: "wide" }, variant: "wide" },
};
