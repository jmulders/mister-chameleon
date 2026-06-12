import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MapBlock } from "./MapBlock";
import type { MapBlockData } from "@/page-config";

const baseData: MapBlockData = {
  heading: "Visit us",
  address: "Keizersgracht 125",
  city:    "Amsterdam",
  country: "Netherlands",
  email:   "hello@mister-chameleon.com",
  phone:   "+31 20 123 4567",
  // Google Maps embed of the Keizersgracht area (public, no API key needed for story).
  embedUrl:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2436.066792041!2d4.8801!3d52.3731!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2snl!4v1700000000000",
};

const meta: Meta<typeof MapBlock> = {
  title:     "Blocks/Sections/Map",
  component: MapBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Office location block — a Google Maps iframe alongside address, phone, and email. " +
          "Desktop: map on the left (2/3), contact details on the right (1/3). " +
          "Mobile: stacked, map first.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof MapBlock>;

export const Default: Story = {
  name: "Default (with map embed)",
  args: { data: baseData },
};

export const NoEmbed: Story = {
  name: "No embed URL (contact details only)",
  args: {
    data: { ...baseData, embedUrl: undefined },
  },
};

export const NoHeading: Story = {
  name: "No heading",
  args: {
    data: { ...baseData, heading: undefined },
  },
};

export const MinimalContact: Story = {
  name: "Minimal — email only",
  args: {
    data: {
      email:    "hello@example.com",
      embedUrl: baseData.embedUrl,
    },
  },
};
