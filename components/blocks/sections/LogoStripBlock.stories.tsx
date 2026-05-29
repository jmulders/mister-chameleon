import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LogoStripBlock } from "./LogoStripBlock";
import type { LogoStripBlockData } from "@/page-config";

// Use placeholder images via placehold.co so logos render without a real CDN.
// Each has a stable seed so the strip looks consistent across reloads.
const logos = [
  { name: "Acme Corp",   src: "https://placehold.co/160x48/e2e8f0/94a3b8?text=Acme",    url: "#" },
  { name: "Globex",      src: "https://placehold.co/160x48/e2e8f0/94a3b8?text=Globex",  url: "#" },
  { name: "Initech",     src: "https://placehold.co/160x48/e2e8f0/94a3b8?text=Initech", url: "#" },
  { name: "Umbrella",    src: "https://placehold.co/160x48/e2e8f0/94a3b8?text=Umbrella" },
  { name: "Stark",       src: "https://placehold.co/160x48/e2e8f0/94a3b8?text=Stark",   url: "#" },
  { name: "Wayne",       src: "https://placehold.co/160x48/e2e8f0/94a3b8?text=Wayne" },
  { name: "Oscorp",      src: "https://placehold.co/160x48/e2e8f0/94a3b8?text=Oscorp",  url: "#" },
  { name: "Weyland",     src: "https://placehold.co/160x48/e2e8f0/94a3b8?text=Weyland" },
  { name: "Soylent",     src: "https://placehold.co/160x48/e2e8f0/94a3b8?text=Soylent", url: "#" },
  { name: "Vandelay",    src: "https://placehold.co/160x48/e2e8f0/94a3b8?text=Vandelay" },
  { name: "Bluth",       src: "https://placehold.co/160x48/e2e8f0/94a3b8?text=Bluth",   url: "#" },
  { name: "Dunder Miff", src: "https://placehold.co/160x48/e2e8f0/94a3b8?text=Dunder" },
] as const;

const stripData: LogoStripBlockData = {
  heading: "Trusted by teams worldwide",
  logos:   logos.slice(0, 6),
};

const gridData: LogoStripBlockData = {
  heading: "Our customers",
  logos,
};

const noHeadingData: LogoStripBlockData = {
  logos: logos.slice(0, 5),
};

const meta: Meta<typeof LogoStripBlock> = {
  title:     "Blocks/Sections/LogoStrip",
  component: LogoStripBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Client / partner / integration logo showcase. Three variants: " +
          "`default` (horizontal flex strip, full contrast), " +
          "`muted` (same strip at reduced opacity and greyscale — classic 'trusted by' treatment), " +
          "`logo_grid` (multi-row CSS grid, ideal for 6–12+ logos).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof LogoStripBlock>;

export const Default: Story = {
  name: "default — full contrast strip",
  args: { data: stripData, variant: "default" },
};

export const Muted: Story = {
  name: "muted — greyscale reduced opacity",
  args: { data: stripData, variant: "muted" },
};

export const Grid: Story = {
  name: "logo_grid — multi-row cloud (12 logos)",
  args: { data: gridData, variant: "logo_grid" },
};

export const NoHeading: Story = {
  name: "No heading",
  args: { data: noHeadingData, variant: "default" },
};

export const MutedNoHeading: Story = {
  name: "Muted, no heading",
  args: { data: { logos: logos.slice(0, 5) }, variant: "muted" },
};

export const FewLogos: Story = {
  name: "Three logos",
  args: {
    data:    { heading: "Backed by", logos: logos.slice(0, 3) },
    variant: "default",
  },
};
