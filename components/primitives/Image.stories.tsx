import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Image } from "./Image";

// Reliable placeholder images via picsum
const LANDSCAPE = "https://picsum.photos/seed/chameleon1/800/450";
const PORTRAIT  = "https://picsum.photos/seed/chameleon2/600/800";
const SQUARE    = "https://picsum.photos/seed/chameleon3/600/600";

const meta: Meta<typeof Image> = {
  title:     "Atoms/Image",
  component: Image,
  tags:      ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "CMS-friendly responsive image atom. Renders a standard `<img>` with lazy loading. " +
          "Use `aspectRatio` to prevent layout shift. Falls back to a placeholder div when `src` is absent.",
      },
    },
  },
  argTypes: {
    aspectRatio: { control: "select", options: ["auto", "video", "square", "portrait", "wide"] },
    fit:         { control: "select", options: ["cover", "contain", "fill"] },
    rounded:     { control: "select", options: [false, true, "sm", "md", "lg", "xl", "full"] },
    loading:     { control: "select", options: ["lazy", "eager"] },
  },
  args: {
    src:         LANDSCAPE,
    alt:         "Sample landscape image",
    aspectRatio: "video",
  },
  decorators: [(Story) => <div style={{ maxWidth: "40rem" }}><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof Image>;

export const Default: Story = {};

export const AspectRatios: Story = {
  name: "Aspect ratio variants",
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: "32rem" }}>
      {(["video", "wide", "square", "portrait"] as const).map((ratio) => (
        <div key={ratio}>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
            aspectRatio=&quot;{ratio}&quot;
          </p>
          <Image
            src={LANDSCAPE}
            alt={`${ratio} example`}
            aspectRatio={ratio}
            rounded="md"
          />
        </div>
      ))}
    </div>
  ),
};

export const Placeholder: Story = {
  name: "Placeholder (no src)",
  args: { src: undefined, alt: "Missing image", aspectRatio: "video" },
};

export const Rounded: Story = {
  name: "Rounded variants",
  render: () => (
    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
      {(["sm", "md", "lg", "xl", "full"] as const).map((r) => (
        <div key={r} style={{ width: "8rem" }}>
          <Image src={SQUARE} alt={r} aspectRatio="square" rounded={r} />
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center", marginTop: "0.25rem" }}>
            {r}
          </p>
        </div>
      ))}
    </div>
  ),
};

export const Portrait: Story = {
  name: "Portrait aspect ratio",
  args: { src: PORTRAIT, alt: "Portrait image", aspectRatio: "portrait", rounded: "lg" },
};

export const ObjectContain: Story = {
  name: "Object fit: contain",
  args: { src: LANDSCAPE, alt: "Contain", aspectRatio: "square", fit: "contain", rounded: "md" },
};
