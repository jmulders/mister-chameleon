import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AboutBlock } from "./AboutBlock";
import type { AboutBlockData } from "@/page-config";
import type { PortableTextBlock } from "@/cms/types";

// ── Mock data ─────────────────────────────────────────────────────────────────

const bodyBlocks: PortableTextBlock[] = [
  {
    _type: "block",
    _key:  "a1",
    style: "normal",
    markDefs: [],
    children: [
      {
        _type: "span",
        _key:  "s1",
        text:  "We are a small, focused team on a mission to remove the friction between great ideas and great software. Founded in 2021, we have helped more than 200 companies move faster without sacrificing quality or security.",
        marks: [],
      },
    ],
  },
  {
    _type: "block",
    _key:  "a2",
    style: "normal",
    markDefs: [],
    children: [
      {
        _type: "span",
        _key:  "s2",
        text:  "We believe the best products come from diverse, collaborative teams — people who challenge each other, share what they know, and genuinely care about the end user.",
        marks: [],
      },
    ],
  },
];

const imageUrl = "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=900&q=80";

const teamMembers = [
  { name: "Sophie van den Berg", role: "Co-founder & CEO", imageUrl: "https://i.pravatar.cc/80?img=47", bio: "Previously VP Product at Booking.com." },
  { name: "Marco Verdi",          role: "Head of Design",    imageUrl: "https://i.pravatar.cc/80?img=11", bio: "10 years at Figma and Booking.com." },
  { name: "Aigerim Bekova",       role: "Lead Engineer",     imageUrl: "https://i.pravatar.cc/80?img=23", bio: "Former staff engineer at Stripe." },
  { name: "Tom Janssen",          role: "Head of Growth",    imageUrl: "https://i.pravatar.cc/80?img=56", bio: "Helped scale Adyen to Series B." },
  { name: "Priya Sharma",         role: "Customer Success",  imageUrl: "https://i.pravatar.cc/80?img=31", bio: "Passionate about long-term partnerships." },
  { name: "Luca Bianchi",         role: "Backend Engineer",  imageUrl: "https://i.pravatar.cc/80?img=60", bio: "Distributed systems specialist." },
] as const;

// ── Meta ───────────────────────────────────────────────────────────────────────

const meta: Meta<typeof AboutBlock> = {
  title:     "Blocks/Sections/About",
  component: AboutBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Narrative copy section with optional feature image. Three primary variants: media_right, media_left, media_full. Also supports team-grid for a team overview page.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AboutBlock>;

// ── Stories ────────────────────────────────────────────────────────────────────

export const MediaRight: Story = {
  name: "media_right — text left, image right",
  args: {
    data: {
      heading:  "Built by practitioners, for practitioners",
      body:     bodyBlocks,
      imageUrl,
      imageAlt: "Our team at work",
    } satisfies AboutBlockData,
    variant: "media_right",
  },
};

export const MediaLeft: Story = {
  name: "media_left — image left, text right",
  args: {
    data: {
      heading:  "Our mission",
      body:     bodyBlocks,
      imageUrl,
      imageAlt: "Team collaboration",
    } satisfies AboutBlockData,
    variant: "media_left",
  },
};

export const MediaFull: Story = {
  name: "media_full — full-width image above text",
  args: {
    data: {
      heading:  "Our story",
      body:     bodyBlocks,
      imageUrl,
      imageAlt: "Team collaboration",
    } satisfies AboutBlockData,
    variant: "media_full",
  },
};

export const TextOnly: Story = {
  name: "default — text only, no image",
  args: {
    data: {
      heading: "Who we are",
      body:    bodyBlocks,
    } satisfies AboutBlockData,
    variant: "default",
  },
};

export const TeamGrid: Story = {
  name: "team-grid — narrative + team member cards",
  args: {
    data: {
      heading:     "Meet the team",
      body:        bodyBlocks,
      teamMembers: [...teamMembers],
    } satisfies AboutBlockData,
    variant: "team-grid",
  },
};
