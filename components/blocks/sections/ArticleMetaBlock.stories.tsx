import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ArticleMetaBlock } from "./ArticleMetaBlock";
import type { ArticleMetaBlockData } from "@/page-config";

// ── Shared mock data ───────────────────────────────────────────────────────────

const base: ArticleMetaBlockData = {
  title:          "How structured content unlocks multi-channel distribution",
  summary:        "When you model content as data rather than HTML, you gain the ability to render it anywhere — web, mobile, email, and voice — without re-authoring.",
  publishedAt:    "2025-03-15",
  updatedAt:      "2025-04-02",
  readingTime:    7,
  category:       "Engineering",
  tags:           ["CMS", "Headless", "Architecture"],
  coverImageUrl:  "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&q=80",
  coverImageAlt:  "Code on a monitor",
  author: {
    name:      "Sophie van den Berg",
    role:      "Head of Engineering",
    avatarUrl: "https://i.pravatar.cc/48?img=47",
    href:      "/team/sophie",
  },
  breadcrumbs: [
    { label: "Home",    href: "/" },
    { label: "Blog",    href: "/blog" },
    { label: "Engineering", href: "/blog/engineering" },
  ],
};

// ── Meta ───────────────────────────────────────────────────────────────────────

const meta: Meta<typeof ArticleMetaBlock> = {
  title:     "Blocks/Sections/ArticleMeta",
  component: ArticleMetaBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Editorial header for a blog post or long-form article page. Three variants: hero (full-bleed cover), default (contained cover + title), compact (meta row only).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ArticleMetaBlock>;

// ── Stories ────────────────────────────────────────────────────────────────────

export const DefaultVariant: Story = {
  name: "default — contained cover image, title, summary, meta row",
  args: { data: base, variant: "default" },
};

export const Hero: Story = {
  name: "hero — full-bleed cover with title overlaid",
  args: { data: base, variant: "hero" },
};

export const Compact: Story = {
  name: "compact — meta row only (no title/image)",
  args: {
    data: {
      publishedAt: base.publishedAt,
      updatedAt:   base.updatedAt,
      readingTime: base.readingTime,
      category:    base.category,
      tags:        base.tags,
      author:      base.author,
      breadcrumbs: base.breadcrumbs,
    },
    variant: "compact",
  },
};

export const NoImage: Story = {
  name: "default — no cover image",
  args: {
    data: {
      ...base,
      coverImageUrl: undefined,
      coverImageAlt: undefined,
    },
    variant: "default",
  },
};

export const NoAuthor: Story = {
  name: "default — no author",
  args: {
    data: {
      ...base,
      author: undefined,
    },
    variant: "default",
  },
};
