import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { VideoBlock } from "./VideoBlock";
import type { VideoBlockData } from "@/page-config";

const youtubeData: VideoBlockData = {
  url:       "https://www.youtube.com/embed/dQw4w9WgXcQ",
  platform:  "youtube",
  caption:   "Product walkthrough — see how personalisation works end to end.",
};

const vimeoData: VideoBlockData = {
  url:      "https://player.vimeo.com/video/148751763",
  platform: "vimeo",
  caption:  "Behind the scenes at our engineering team.",
};

const nativeData: VideoBlockData = {
  url:       "https://www.w3schools.com/html/mov_bbb.mp4",
  platform:  "native",
  posterUrl: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=1200&q=80",
  caption:   "Hosted MP4 with poster image.",
  autoPlay:  false,
  loop:      false,
};

const meta: Meta<typeof VideoBlock> = {
  title:     "Blocks/Sections/Video",
  component: VideoBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Standalone video section — responsive 16:9 embed for YouTube, Vimeo, or a " +
          "native `<video>` element for direct file URLs. " +
          "Variants: `contained` (default — centred, max 56rem), `full-width`.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof VideoBlock>;

export const YouTube: Story = {
  name: "YouTube — contained (default)",
  args: { data: youtubeData, variant: "contained" },
};

export const YouTubeFullWidth: Story = {
  name: "YouTube — full-width",
  args: { data: youtubeData, variant: "full-width" },
};

export const Vimeo: Story = {
  name: "Vimeo embed",
  args: { data: vimeoData, variant: "contained" },
};

export const Native: Story = {
  name: "Native <video> with poster",
  args: { data: nativeData, variant: "contained" },
};

export const NoCaption: Story = {
  name: "No caption",
  args: { data: { ...youtubeData, caption: undefined }, variant: "contained" },
};
