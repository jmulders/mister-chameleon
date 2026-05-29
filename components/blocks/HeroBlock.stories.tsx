import type { Meta, StoryObj } from "@storybook/react";
import { HeroBlock } from "./HeroBlock";

// ── Responsive viewport presets ───────────────────────────────────────────────
//
// Used by the Storybook viewport addon to test mobile-first layout behaviour.
// Stories suffixed with "Mobile" / "Tablet" lock to those dimensions by default.

const RESPONSIVE_VIEWPORTS = {
  mobile:  { name: "Mobile  (375 × 812)",  styles: { width: "375px",  height: "812px"  } },
  tablet:  { name: "Tablet  (768 × 1024)", styles: { width: "768px",  height: "1024px" } },
  desktop: { name: "Desktop (1280 × 900)", styles: { width: "1280px", height: "900px"  } },
};

const meta: Meta<typeof HeroBlock> = {
  title: "Blocks/Hero",
  component: HeroBlock,
  parameters: {
    layout: "fullscreen",
    viewport: {
      viewports: RESPONSIVE_VIEWPORTS,
    },
    docs: {
      description: {
        component:
          "Above-the-fold hero section with eight layout variants: " +
          "`hero_default` (centered, dark), `hero_split` (50/50 text+panel), " +
          "`hero_proof` (centered + social-proof bar), `hero_background` (full-bleed bg media), " +
          "`hero_minimal_dark` (tight dark centered — Dark AI family), " +
          "`hero_split_clean` (light bg split — Clean Corporate family), " +
          "`hero_dark_split` (dark bg split — Structured SaaS family), " +
          "`hero_editorial` (light, typographic — Content Blog family). " +
          "Supports optional image or video media (uploaded file, YouTube, or Vimeo). " +
          "Mobile-first: all variants stack correctly at 375px.",
      },
    },
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof HeroBlock>;

// ── Shared mock data ───────────────────────────────────────────────────────────

const defaultCtas = [
  { label: "Get started free", href: "#", variant: "primary" as const },
  { label: "See how it works", href: "#", variant: "secondary" as const },
] as const;

const singleCta = [
  { label: "Book a demo", href: "#", variant: "primary" as const },
] as const;

// ── Text-only stories (no media) ──────────────────────────────────────────────

export const Default: Story = {
  name: "Default — text only",
  args: {
    title: "The platform that grows with your business",
    subtitle:
      "Streamline operations, delight customers, and scale without friction — all from one place.",
    ctas: defaultCtas,
    tag: "Now in public beta",
    layoutVariant: "hero_default",
  },
};

export const Split: Story = {
  name: "Split — text left, decorative panel right",
  args: {
    title: "Clarity for every team, every sprint",
    subtitle:
      "Stop context-switching between five tools. Bring planning, tracking, and reporting under one roof.",
    ctas: defaultCtas,
    tag: "New",
    layoutVariant: "hero_split",
  },
};

export const Proof: Story = {
  name: "Proof — centered + social-proof bar",
  args: {
    title: "Trusted by teams shipping faster",
    subtitle:
      "Join thousands of teams who've cut delivery time by 40 % in their first quarter.",
    ctas: singleCta,
    tag: "Case studies",
    layoutVariant: "hero_proof",
  },
};

export const NoCtas: Story = {
  name: "No CTAs",
  args: {
    title: "Coming soon",
    subtitle: "Something big is on its way. Leave your email and we will let you know first.",
    ctas: [],
    layoutVariant: "hero_default",
  },
};

export const NoTag: Story = {
  name: "No eyebrow tag",
  args: {
    title: "Build better products, together",
    subtitle:
      "Collaborate in real time, ship with confidence, and get instant feedback from every stakeholder.",
    ctas: defaultCtas,
    layoutVariant: "hero_default",
  },
};

// ── Image media stories ───────────────────────────────────────────────────────

export const WithImage: Story = {
  name: "Default — with image below CTA",
  args: {
    title: "Your dashboard. Your way.",
    subtitle:
      "One interface for every metric that matters. Customise, share, and act — all without leaving the tab.",
    ctas: defaultCtas,
    tag: "Product",
    layoutVariant: "hero_default",
    media: {
      kind: "image",
      url: "https://placehold.co/1200x675/1a1a2e/ffffff?text=Product+screenshot",
      alt: "Screenshot of the product dashboard",
    },
  },
};

export const SplitWithImage: Story = {
  name: "Split — with image in right panel",
  args: {
    title: "A picture is worth a thousand words",
    subtitle:
      "Show your product alongside the message. The right panel automatically displays your image.",
    ctas: defaultCtas,
    tag: "New",
    layoutVariant: "hero_split",
    media: {
      kind: "image",
      url: "https://placehold.co/800x600/1a1a2e/ffffff?text=Product+image",
      alt: "Product feature illustration",
    },
  },
};

export const ProofWithImage: Story = {
  name: "Proof — with image below proof bar",
  args: {
    title: "Trusted by teams worldwide",
    subtitle: "Join the companies already getting results with our platform.",
    ctas: singleCta,
    tag: "Social proof",
    layoutVariant: "hero_proof",
    media: {
      kind: "image",
      url: "https://placehold.co/1200x675/1a1a2e/ffffff?text=Customer+success+screenshot",
      alt: "Customer success dashboard",
    },
  },
};

// ── Uploaded / self-hosted video stories ──────────────────────────────────────

export const WithUploadVideo: Story = {
  name: "Default — with uploaded video",
  args: {
    title: "See it in action",
    subtitle:
      "A 60-second walkthrough of the core workflow — from setup to first result.",
    ctas: singleCta,
    tag: "Demo",
    layoutVariant: "hero_default",
    media: {
      kind: "video",
      video: {
        source: "upload",
        // Replace with a real hosted video URL in production
        url: "https://www.w3schools.com/html/mov_bbb.mp4",
        poster: "https://placehold.co/1200x675/1a1a2e/ffffff?text=Video+poster",
        autoplay: false,
        muted: false,
        loop: false,
        controls: true,
      },
    },
  },
};

export const SplitWithUploadVideo: Story = {
  name: "Split — with uploaded video in right panel",
  args: {
    title: "Watch the product do the work",
    subtitle:
      "A quick demo showing how teams go from chaos to clarity in under five minutes.",
    ctas: defaultCtas,
    tag: "Product tour",
    layoutVariant: "hero_split",
    media: {
      kind: "video",
      video: {
        source: "upload",
        url: "https://www.w3schools.com/html/mov_bbb.mp4",
        poster: "https://placehold.co/800x600/1a1a2e/ffffff?text=Video+poster",
        autoplay: true,
        muted: true,
        loop: true,
        controls: false,
      },
    },
  },
};

// ── YouTube embed stories ─────────────────────────────────────────────────────

export const WithYouTube: Story = {
  name: "Default — with YouTube embed",
  args: {
    title: "Watch our product overview",
    subtitle:
      "A three-minute walkthrough of everything you can do from day one.",
    ctas: singleCta,
    tag: "Watch",
    layoutVariant: "hero_default",
    media: {
      kind: "video",
      video: {
        source: "youtube",
        // Replace with your actual YouTube video ID
        videoId: "dQw4w9WgXcQ",
      },
    },
  },
};

export const SplitWithYouTube: Story = {
  name: "Split — with YouTube in right panel",
  args: {
    title: "The story behind the product",
    subtitle:
      "Our founders explain why we built this and what it means for your team.",
    ctas: defaultCtas,
    tag: "Our story",
    layoutVariant: "hero_split",
    media: {
      kind: "video",
      video: {
        source: "youtube",
        videoId: "dQw4w9WgXcQ",
      },
    },
  },
};

// ── Vimeo embed stories ───────────────────────────────────────────────────────

export const WithVimeo: Story = {
  name: "Default — with Vimeo embed",
  args: {
    title: "A cinematic look at what we built",
    subtitle:
      "High-quality product film — two minutes that show the soul of the product.",
    ctas: singleCta,
    tag: "Film",
    layoutVariant: "hero_default",
    media: {
      kind: "video",
      video: {
        source: "vimeo",
        // Replace with your actual Vimeo video ID
        videoId: "76979871",
      },
    },
  },
};

export const SplitWithVimeo: Story = {
  name: "Split — with Vimeo in right panel",
  args: {
    title: "Crafted with care",
    subtitle:
      "We obsess over the details so your team can focus on the work that matters.",
    ctas: defaultCtas,
    tag: "Behind the scenes",
    layoutVariant: "hero_split",
    media: {
      kind: "video",
      video: {
        source: "vimeo",
        videoId: "76979871",
      },
    },
  },
};

// ── Background-media variant stories ──────────────────────────────────────────
//
// hero_background renders the media as a full-viewport background with a
// semi-transparent tint overlay.  Content (tag, title, subtitle, CTAs) is
// overlaid on top and can be aligned left, center, or right via `contentAlign`.
//
// Design tokens:
//   --hero-overlay-color   (default #000)  — tint colour
//   --hero-overlay-opacity (default 0.45)  — tint opacity

export const BackgroundImageCenter: Story = {
  name: "Background — image, center aligned",
  args: {
    title: "Make a bold first impression",
    subtitle:
      "A full-bleed hero with your brand imagery sets the tone before a single word is read.",
    ctas: defaultCtas,
    tag: "Visual impact",
    layoutVariant: "hero_background",
    contentAlign: "center",
    media: {
      kind: "image",
      url: "https://placehold.co/1920x1080/0f172a/ffffff?text=Background+image",
      alt: "Hero background — decorative",
    },
  },
};

export const BackgroundImageLeft: Story = {
  name: "Background — image, left aligned",
  args: {
    title: "Enterprise-grade security,\nstartup-grade speed",
    subtitle:
      "Deploy in minutes, scale to millions. Left-aligned content leaves room for the scene behind.",
    ctas: [
      { label: "Start for free", href: "#", variant: "primary" as const },
      { label: "Talk to sales",  href: "#", variant: "outline" as const },
    ],
    tag: "Security",
    layoutVariant: "hero_background",
    contentAlign: "left",
    media: {
      kind: "image",
      url: "https://placehold.co/1920x1080/1e3a5f/ffffff?text=Background+image",
      alt: "Hero background — decorative",
    },
  },
};

export const BackgroundImageRight: Story = {
  name: "Background — image, right aligned",
  args: {
    title: "Ship faster.\nBreak nothing.",
    subtitle:
      "Continuous deployment with automated rollbacks. Right-aligned for an editorial feel.",
    ctas: [
      { label: "See the demo", href: "#", variant: "primary" as const },
    ],
    tag: "CI/CD",
    layoutVariant: "hero_background",
    contentAlign: "right",
    media: {
      kind: "image",
      url: "https://placehold.co/1920x1080/1a1a2e/ffffff?text=Background+image",
      alt: "Hero background — decorative",
    },
  },
};

export const BackgroundVideo: Story = {
  name: "Background — uploaded video, center",
  args: {
    title: "A living backdrop for your message",
    subtitle:
      "Self-hosted video plays automatically and loops silently — no distractions, just atmosphere.",
    ctas: defaultCtas,
    tag: "Ambient",
    layoutVariant: "hero_background",
    contentAlign: "center",
    media: {
      kind: "video",
      video: {
        source: "upload",
        url: "https://www.w3schools.com/html/mov_bbb.mp4",
        poster: "https://placehold.co/1920x1080/0f172a/ffffff?text=Video+poster",
        // Background videos default to autoplay + muted + loop in the component
        autoplay: true,
        muted:    true,
        loop:     true,
        controls: false,
      },
    },
  },
};

export const BackgroundYouTube: Story = {
  name: "Background — YouTube video, center",
  args: {
    title: "Powered by the same infrastructure\nthat runs the internet",
    subtitle:
      "A YouTube video loops silently in the background using Vimeo background-mode params.",
    ctas: singleCta,
    tag: "Infrastructure",
    layoutVariant: "hero_background",
    contentAlign: "center",
    media: {
      kind: "video",
      video: {
        source: "youtube",
        videoId: "dQw4w9WgXcQ",
      },
    },
  },
};

export const BackgroundVimeo: Story = {
  name: "Background — Vimeo video, left aligned",
  args: {
    title: "Motion tells the story\nwords can't",
    subtitle:
      "Vimeo background mode plays the video silently without controls or branding.",
    ctas: [
      { label: "Explore the platform", href: "#", variant: "primary"   as const },
      { label: "View pricing",         href: "#", variant: "secondary" as const },
    ],
    tag: "Cinematic",
    layoutVariant: "hero_background",
    contentAlign: "left",
    media: {
      kind: "video",
      video: {
        source: "vimeo",
        videoId: "76979871",
      },
    },
  },
};

export const BackgroundNoMedia: Story = {
  name: "Background — no media (dark brand fallback)",
  args: {
    title: "No image? No problem.",
    subtitle:
      "When no background media is supplied the variant falls back to a dark brand colour " +
      "with the standard radial glow, keeping the layout consistent.",
    ctas: defaultCtas,
    tag: "Fallback",
    layoutVariant: "hero_background",
    contentAlign: "center",
  },
};

// ── Responsive viewport stories ───────────────────────────────────────────────
//
// These stories lock to specific viewport dimensions to make it easy to QA
// mobile-first layout behaviour directly in Storybook.

export const DefaultMobile: Story = {
  name: "Default — mobile (375px)",
  args: {
    title: "The platform that grows with your business",
    subtitle:
      "Streamline operations, delight customers, and scale without friction — all from one place.",
    ctas: defaultCtas,
    tag: "Now in public beta",
    layoutVariant: "hero_default",
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};

export const SplitWithImageMobile: Story = {
  name: "Split — image panel, mobile (375px)",
  args: {
    title: "A picture is worth a thousand words",
    subtitle:
      "Show your product alongside the message. On mobile the image appears below the text.",
    ctas: defaultCtas,
    tag: "New",
    layoutVariant: "hero_split",
    media: {
      kind: "image",
      url: "https://placehold.co/800x600/1a1a2e/ffffff?text=Product+image",
      alt: "Product feature illustration",
    },
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};

export const SplitWithImageTablet: Story = {
  name: "Split — image panel, tablet (768px)",
  args: {
    title: "A picture is worth a thousand words",
    subtitle:
      "Show your product alongside the message. Columns appear side-by-side from lg upward.",
    ctas: defaultCtas,
    tag: "New",
    layoutVariant: "hero_split",
    media: {
      kind: "image",
      url: "https://placehold.co/800x600/1a1a2e/ffffff?text=Product+image",
      alt: "Product feature illustration",
    },
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};

export const BackgroundImageMobile: Story = {
  name: "Background — image, mobile (375px)",
  args: {
    title: "Make a bold first impression",
    subtitle: "A full-bleed hero with your brand imagery sets the tone before a single word is read.",
    ctas: defaultCtas,
    tag: "Visual impact",
    layoutVariant: "hero_background",
    contentAlign: "center",
    media: {
      kind: "image",
      url: "https://placehold.co/1920x1080/0f172a/ffffff?text=Background+image",
      alt: "Hero background — decorative",
    },
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};

export const ProofMobile: Story = {
  name: "Proof — social-proof bar, mobile (375px)",
  args: {
    title: "Trusted by teams shipping faster",
    subtitle:
      "Join thousands of teams who've cut delivery time by 40 % in their first quarter.",
    ctas: singleCta,
    tag: "Case studies",
    layoutVariant: "hero_proof",
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};

// ── New premium / family variant stories ──────────────────────────────────────

/**
 * hero_minimal_dark — near-black full-width hero; centered content; tight bold
 * heading; narrow brand-glow line. No decorative panel.
 * Dark AI family signature variant.
 */
export const MinimalDark: Story = {
  name: "Minimal dark — tight centered hero (Dark AI)",
  args: {
    title: "AI that understands your product",
    subtitle:
      "Surface the right features at the right moment — without writing a single rule by hand.",
    ctas: defaultCtas,
    tag: "Powered by GPT-4",
    layoutVariant: "hero_minimal_dark",
  },
};

export const MinimalDarkWithImage: Story = {
  name: "Minimal dark — with product screenshot below CTA",
  args: {
    title: "From zero to production-ready AI",
    subtitle:
      "Connect your data, define your logic, deploy to edge. One platform — no ML team required.",
    ctas: defaultCtas,
    tag: "Developer preview",
    layoutVariant: "hero_minimal_dark",
    media: {
      kind: "image",
      url: "https://placehold.co/1200x675/0a0a0f/818cf8?text=Product+screenshot",
      alt: "Platform dashboard screenshot",
    },
  },
};

export const MinimalDarkMobile: Story = {
  name: "Minimal dark — mobile (375px)",
  args: {
    title: "AI that understands your product",
    subtitle:
      "Surface the right features at the right moment — no rules needed.",
    ctas: defaultCtas,
    tag: "Powered by GPT-4",
    layoutVariant: "hero_minimal_dark",
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};

/**
 * hero_split_clean — light-background split hero; dark text left;
 * framed product screenshot right. Clean Corporate family variant.
 */
export const SplitClean: Story = {
  name: "Split clean — light bg, product screenshot right (Clean Corporate)",
  args: {
    title: "The reporting suite your finance team will actually use",
    subtitle:
      "Crystal-clear dashboards, automated reconciliation, and audit-ready exports — all in one place.",
    ctas: [
      { label: "Request a demo",  href: "#", variant: "primary"   as const },
      { label: "See pricing",     href: "#", variant: "secondary" as const },
    ],
    tag: "Enterprise ready",
    layoutVariant: "hero_split_clean",
    media: {
      kind: "image",
      url: "https://placehold.co/800x600/f8fafc/334155?text=Product+screenshot",
      alt: "Finance dashboard screenshot",
    },
  },
};

export const SplitCleanNoMedia: Story = {
  name: "Split clean — no media (placeholder panel)",
  args: {
    title: "Clarity at every level of your organisation",
    subtitle:
      "Give leadership the visibility they need, and give your team the focus they deserve.",
    ctas: [
      { label: "Get started free", href: "#", variant: "primary"   as const },
      { label: "Talk to sales",    href: "#", variant: "secondary" as const },
    ],
    tag: "B2B SaaS",
    layoutVariant: "hero_split_clean",
  },
};

export const SplitCleanMobile: Story = {
  name: "Split clean — mobile (375px)",
  args: {
    title: "The reporting suite your finance team will actually use",
    subtitle:
      "Crystal-clear dashboards and audit-ready exports — all in one place.",
    ctas: [
      { label: "Request a demo", href: "#", variant: "primary" as const },
    ],
    tag: "Enterprise ready",
    layoutVariant: "hero_split_clean",
    media: {
      kind: "image",
      url: "https://placehold.co/800x600/f8fafc/334155?text=Product+screenshot",
      alt: "Finance dashboard",
    },
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};

/**
 * hero_dark_split — dark brand background + text left + vivid glow panel right.
 * Structured SaaS / Dark AI split entry point.
 */
export const DarkSplit: Story = {
  name: "Dark split — dark bg, glow panel right (Structured SaaS / Dark AI)",
  args: {
    title: "Infrastructure that scales with you",
    subtitle:
      "From 10 to 10 million requests per day — the same code, the same API, zero rearchitecting.",
    ctas: defaultCtas,
    tag: "Globally distributed",
    layoutVariant: "hero_dark_split",
  },
};

export const DarkSplitWithMedia: Story = {
  name: "Dark split — with media in right panel",
  args: {
    title: "Built for the teams that can't afford downtime",
    subtitle:
      "99.999% uptime SLA, multi-region failover, and an incident response team on call 24/7.",
    ctas: [
      { label: "Start free trial",  href: "#", variant: "primary"   as const },
      { label: "View reliability",  href: "#", variant: "secondary" as const },
    ],
    tag: "Enterprise SaaS",
    layoutVariant: "hero_dark_split",
    media: {
      kind: "image",
      url: "https://placehold.co/800x600/0f172a/818cf8?text=Architecture+diagram",
      alt: "Multi-region architecture diagram",
    },
  },
};

export const DarkSplitMobile: Story = {
  name: "Dark split — mobile (375px)",
  args: {
    title: "Infrastructure that scales with you",
    subtitle:
      "From 10 to 10 million requests — zero rearchitecting.",
    ctas: defaultCtas,
    tag: "Globally distributed",
    layoutVariant: "hero_dark_split",
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};

/**
 * hero_editorial — light neutral section; large typographic centered heading.
 * Content Blog / editorial-first family variant.
 */
export const Editorial: Story = {
  name: "Editorial — large type, light bg (Content Blog)",
  args: {
    title: "Ideas worth building on",
    subtitle:
      "In-depth articles, how-tos, and perspectives from the people shipping the platform.",
    ctas: [
      { label: "Read the blog",      href: "#", variant: "primary"   as const },
      { label: "Subscribe to updates", href: "#", variant: "secondary" as const },
    ],
    tag: "Product blog",
    layoutVariant: "hero_editorial",
  },
};

export const EditorialWithImage: Story = {
  name: "Editorial — with featured image below CTA",
  args: {
    title: "The quiet revolution in B2B software",
    subtitle:
      "How a generation of founders is building companies you never see on the front page — and why that matters.",
    ctas: [
      { label: "Read the piece", href: "#", variant: "primary" as const },
    ],
    tag: "Long read",
    layoutVariant: "hero_editorial",
    media: {
      kind: "image",
      url: "https://placehold.co/1200x675/f8fafc/334155?text=Featured+article+image",
      alt: "Abstract illustration for the featured article",
    },
  },
};

export const EditorialNoCtas: Story = {
  name: "Editorial — no CTAs (announcement / splash)",
  args: {
    title: "We shipped something big today",
    subtitle:
      "After two years of building, we're opening the platform to everyone — no waitlist, no invite code.",
    ctas: [],
    tag: "Announcement",
    layoutVariant: "hero_editorial",
  },
};

export const EditorialMobile: Story = {
  name: "Editorial — mobile (375px)",
  args: {
    title: "Ideas worth building on",
    subtitle:
      "In-depth articles, how-tos, and perspectives from the people shipping the platform.",
    ctas: [{ label: "Read the blog", href: "#", variant: "primary" as const }],
    tag: "Product blog",
    layoutVariant: "hero_editorial",
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};
