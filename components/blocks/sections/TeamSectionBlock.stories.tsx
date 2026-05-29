import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TeamSectionBlock } from "./TeamSectionBlock";
import type { TeamSectionBlockData } from "@/page-config";

const members = [
  {
    name:        "Sophie van der Berg",
    role:        "CEO & Co-founder",
    bio:         "Previously VP Product at FinTech unicorn. Obsessed with developer experience and design systems.",
    imageUrl:    "https://i.pravatar.cc/150?img=47",
    profileHref: "/team/sophie",
    socials:     { linkedin: "#", twitter: "#" },
  },
  {
    name:        "Mark Leuven",
    role:        "CTO & Co-founder",
    bio:         "15 years building distributed systems. Wrote the first line of code for this platform in 2020.",
    imageUrl:    "https://i.pravatar.cc/150?img=12",
    profileHref: "/team/mark",
    socials:     { linkedin: "#", github: "#" },
  },
  {
    name:        "Priya Nair",
    role:        "Head of Design",
    bio:         "Formerly at Figma and Shopify. Believes design tokens are the future of scalable brand management.",
    imageUrl:    "https://i.pravatar.cc/150?img=29",
    profileHref: "/team/priya",
    socials:     { linkedin: "#", twitter: "#" },
  },
  {
    name:        "James Wouter",
    role:        "Lead Engineer",
    bio:         "Open-source contributor and Next.js enthusiast. Maintainer of our public component library.",
    imageUrl:    "https://i.pravatar.cc/150?img=53",
    profileHref: "/team/james",
    socials:     { linkedin: "#", github: "#" },
  },
] as const;

const gridData: TeamSectionBlockData = {
  heading:  "Meet the team",
  intro:    "A small team of product and engineering specialists on a mission to make multi-tenant platforms easier to build.",
  members,
};

const compactData: TeamSectionBlockData = {
  heading: "Our team",
  members: members,
};

const noAvatarData: TeamSectionBlockData = {
  heading: "Core team",
  members: members.map(({ name, role, socials }) => ({ name, role, socials })),
};

const meta: Meta<typeof TeamSectionBlock> = {
  title:     "Blocks/Sections/TeamSection",
  component: TeamSectionBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Team member showcase. Two variants: " +
          "`team_grid` (card grid with avatar, bio, social links) and " +
          "`team_compact` (tight single-column list: avatar + name + role inline).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof TeamSectionBlock>;

export const Grid: Story = {
  name: "team_grid (default)",
  args: { data: gridData, variant: "team_grid" },
};

export const Compact: Story = {
  name: "team_compact (list rows)",
  args: { data: compactData, variant: "team_compact" },
};

export const NoAvatars: Story = {
  name: "No avatar images (initials fallback)",
  args: { data: noAvatarData, variant: "team_grid" },
};

export const NoIntro: Story = {
  name: "No intro text",
  args: { data: { heading: "The team", members }, variant: "team_grid" },
};
