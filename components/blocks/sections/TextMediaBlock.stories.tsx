import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TextMediaBlock } from "./TextMediaBlock";
import type { TextMediaBlockData } from "@/page-config";

const base: TextMediaBlockData = {
  eyebrow:   "Platform capabilities",
  heading:   "Everything your team needs to move faster",
  mediaUrl:  "https://picsum.photos/seed/textmedia1/800/500",
  mediaAlt:  "Platform dashboard showing analytics and workflow tools",
  mediaType: "image",
  caption:   "The unified platform dashboard",
  ctas: [
    { label: "Get started",  href: "/signup" },
    { label: "See the docs", href: "/docs" },
  ],
};

const noEyebrow: TextMediaBlockData = {
  heading:   "Scalable by design",
  mediaUrl:  "https://picsum.photos/seed/textmedia2/800/500",
  mediaAlt:  "Architecture diagram",
  mediaType: "image",
  ctas: [
    { label: "Learn more", href: "/architecture" },
  ],
};

const noCta: TextMediaBlockData = {
  eyebrow:   "How it works",
  heading:   "Built for the modern stack",
  mediaUrl:  "https://picsum.photos/seed/textmedia3/800/500",
  mediaAlt:  "Code editor showing a clean component hierarchy",
  mediaType: "image",
};

const meta: Meta<typeof TextMediaBlock> = {
  title:     "Blocks/Sections/TextMedia",
  component: TextMediaBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Editorial text + image/video split block. " +
          "Three variants: `text_media_right` (text left, media right), " +
          "`text_media_left` (media left, text right), " +
          "`text_media_stacked` (media above, text below).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof TextMediaBlock>;

export const MediaRight: Story = {
  name: "text_media_right — text left, media right (default)",
  args: {
    data:    base,
    variant: "text_media_right",
  },
};

export const MediaLeft: Story = {
  name: "text_media_left — media left, text right",
  args: {
    data:    base,
    variant: "text_media_left",
  },
};

export const Stacked: Story = {
  name: "text_media_stacked — media above, full-width",
  args: {
    data:    base,
    variant: "text_media_stacked",
  },
};

export const NoEyebrow: Story = {
  name: "No eyebrow",
  args: {
    data:    noEyebrow,
    variant: "text_media_right",
  },
};

export const NoCTA: Story = {
  name: "No CTAs",
  args: {
    data:    noCta,
    variant: "text_media_left",
  },
};
