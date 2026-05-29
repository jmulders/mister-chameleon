import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ArticleBodyBlock } from "./ArticleBodyBlock";
import type { ArticleBodyBlockData } from "@/page-config";
import type { PortableTextBlock } from "@/cms/types";

// ── Mock Portable Text body ────────────────────────────────────────────────────

const mockBody: PortableTextBlock[] = [
  {
    _type: "block",
    _key:  "b1",
    style: "normal",
    markDefs: [],
    children: [
      {
        _type: "span",
        _key:  "s1",
        text:  "Modern web platforms require a thoughtful approach to content architecture. When you separate presentation logic from content structure, you gain the flexibility to evolve your design system without disrupting editorial workflows.",
        marks: [],
      },
    ],
  },
  {
    _type: "block",
    _key:  "b2",
    style: "h2",
    markDefs: [],
    children: [{ _type: "span", _key: "s2", text: "The role of structured content", marks: [] }],
  },
  {
    _type: "block",
    _key:  "b3",
    style: "normal",
    markDefs: [],
    children: [
      { _type: "span", _key: "s3", text: "Structured content means every field has a ", marks: [] },
      { _type: "span", _key: "s4", text: "purpose and a schema", marks: ["strong"] },
      { _type: "span", _key: "s5", text: ". Rather than a single blob of HTML, you store title, summary, body, tags, and author as discrete typed fields. This unlocks multi-channel distribution, AI enrichment, and consistent rendering across contexts.", marks: [] },
    ],
  },
  {
    _type: "block",
    _key:  "b4",
    style: "blockquote",
    markDefs: [],
    children: [
      {
        _type: "span",
        _key:  "s6",
        text:  "Content is the product. Everything else is the delivery mechanism.",
        marks: [],
      },
    ],
  },
  {
    _type: "block",
    _key:  "b5",
    style: "h3",
    markDefs: [],
    children: [{ _type: "span", _key: "s7", text: "Practical implementation tips", marks: [] }],
  },
  {
    _type: "block",
    _key:  "b6",
    style: "normal",
    markDefs: [],
    children: [
      {
        _type: "span",
        _key:  "s8",
        text:  "Start with your most-queried content type and model it in isolation. Resist the urge to create a universal mega-schema. A ",
        marks: [],
      },
      { _type: "span", _key: "s9", text: "focused schema", marks: ["em"] },
      {
        _type: "span",
        _key:  "s10",
        text:  " that covers 80 % of real use-cases ships faster and is easier to maintain than one that tries to anticipate every edge case upfront.",
        marks: [],
      },
    ],
  },
];

// ── Meta ───────────────────────────────────────────────────────────────────────

const meta: Meta<typeof ArticleBodyBlock> = {
  title:     "Blocks/Sections/ArticleBody",
  component: ArticleBodyBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Primary long-form reading body for blog posts, vacancy descriptions, and documentation pages. Renders Portable Text with optional footnotes.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ArticleBodyBlock>;

// ── Stories ────────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: "default — narrow prose column (~70ch)",
  args: { data: { body: mockBody }, variant: "default" },
};

export const Wide: Story = {
  name: "wide — full content-column width",
  args: { data: { body: mockBody }, variant: "wide" },
};

export const WithFootnotes: Story = {
  name: "default + footnotes",
  args: {
    data: {
      body:      mockBody,
      footnotes: [
        "Content as a Service (CaaS) is a delivery model where a CMS provides content via API to any front-end.",
        "Portable Text is an open specification for rich text authored and stored as structured data.",
        "Multi-channel distribution means the same structured content can be rendered in web, mobile, email, and voice interfaces.",
      ],
    },
    variant: "default",
  },
};
