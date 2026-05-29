/**
 * site/content-generator.ts
 *
 * Generates scaffold content data for blueprint page blocks from intake data.
 *
 * ─── Design principles ────────────────────────────────────────────────────────
 *
 *   - No AI calls — deterministic, synchronous output based on intake fields.
 *   - Produces real strings, not Lorem Ipsum.  The result is a meaningful first
 *     draft the operator can edit rather than obvious placeholder text.
 *   - Each block type has its own generator.  Unknown block types get an empty
 *     data record (the renderer shows an "add content" empty state).
 *   - "Homepage-first" strategy: the richest scaffold is generated for the root
 *     page ("/").  Subsequent pages get lighter scaffold (headers + 1 CTA).
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   import { generateBlockData } from "@/site/content-generator";
 *
 *   const data = generateBlockData("hero", intake, { isHomepage: true });
 *   // → { headline: "...", subheadline: "...", ctas: [...] }
 */

import type { SiteIntakeData } from "./types";

// ── Options ───────────────────────────────────────────────────────────────────

export interface GenerateBlockOptions {
  /** True when generating content for the homepage slug ("/"). */
  isHomepage?: boolean;
  /** Page title — used in section headings for non-homepage blocks. */
  pageTitle?: string;
  /** Slug of the page, e.g. "/pricing". */
  slug?: string;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate scaffold data for a single content block.
 *
 * Returns a plain object ready to store in `EditableContentBlock.data`.
 * The shape must match what the block's renderer expects.
 */
export function generateBlockData(
  blockType: string,
  intake:    SiteIntakeData,
  opts:      GenerateBlockOptions = {},
): Record<string, unknown> {
  const gen = GENERATORS[blockType] ?? defaultGenerator;
  return gen(intake, opts);
}

// ── Block generators ──────────────────────────────────────────────────────────

type BlockGenerator = (
  intake: SiteIntakeData,
  opts:   GenerateBlockOptions,
) => Record<string, unknown>;

// ── hero ──────────────────────────────────────────────────────────────────────

const heroGenerator: BlockGenerator = (intake, opts) => {
  const headline = opts.isHomepage
    ? `${intake.companyName}`
    : `Welcome to ${intake.companyName}`;

  const subheadline = opts.isHomepage
    ? intake.description
    : `${intake.description} Built for ${intake.targetAudience}.`;

  return {
    headline,
    subheadline,
    ctas: [
      { label: intake.primaryCtaLabel, href: "/contact", variant: "primary" },
      { label: "Learn more",           href: "#features",  variant: "secondary" },
    ],
  };
};

// ── textSection ───────────────────────────────────────────────────────────────

const textSectionGenerator: BlockGenerator = (intake, opts) => {
  const title = opts.pageTitle ?? intake.companyName;

  if (opts.slug === "/pricing") {
    return {
      headline:    "Simple, transparent pricing",
      subheadline: `Everything ${intake.targetAudience} needs. No hidden fees.`,
    };
  }

  if (opts.slug === "/about") {
    return {
      headline:    `About ${intake.companyName}`,
      subheadline: intake.description,
    };
  }

  if (opts.slug === "/contact") {
    return {
      headline:    "Let's talk",
      subheadline: `Reach out — we'd love to help ${intake.targetAudience}.`,
    };
  }

  return {
    headline:    title,
    subheadline: intake.description,
  };
};

// ── featureGrid ───────────────────────────────────────────────────────────────

const featureGridGenerator: BlockGenerator = (intake, opts) => {
  if (opts.slug === "/pricing") {
    return {
      headline: "Choose the right plan",
      items: [
        { title: "Starter",    description: "Perfect for small teams getting started.",      badge: "Free" },
        { title: "Growth",     description: "For growing teams that need more power.",        badge: "Popular" },
        { title: "Enterprise", description: `Built for ${intake.targetAudience} at scale.`,  badge: "Custom" },
      ],
    };
  }

  return {
    headline: `Why ${intake.targetAudience} choose ${intake.companyName}`,
    items: [
      { title: "Fast to implement", description: "Up and running in minutes, not months." },
      { title: "Built to scale",    description: "Handles your growth without friction." },
      { title: "Always reliable",   description: "99.9% uptime SLA backed by our team." },
    ],
  };
};

// ── testimonialSection ────────────────────────────────────────────────────────

const testimonialSectionGenerator: BlockGenerator = (intake) => ({
  headline: "Trusted by teams worldwide",
  items: [
    {
      quote:   `"${intake.companyName} transformed how we work. Exactly what we needed."`,
      author:  "A happy customer",
      company: intake.targetAudience,
    },
  ],
});

// ── stats ─────────────────────────────────────────────────────────────────────

const statsGenerator: BlockGenerator = (intake) => ({
  headline: `${intake.companyName} by the numbers`,
  items: [
    { value: "500+",  label: "Customers" },
    { value: "99.9%", label: "Uptime" },
    { value: "4.9★",  label: "Customer rating" },
  ],
});

// ── logoStrip ─────────────────────────────────────────────────────────────────

const logoStripGenerator: BlockGenerator = () => ({
  headline: "Trusted by leading companies",
  logos:    [],
});

// ── ctaSection ────────────────────────────────────────────────────────────────

const ctaSectionGenerator: BlockGenerator = (intake) => ({
  headline:    `Ready to get started?`,
  subheadline: `Join ${intake.targetAudience} already using ${intake.companyName}.`,
  ctas: [
    { label: intake.primaryCtaLabel, href: "/contact", variant: "primary" },
  ],
});

// ── faqSection ────────────────────────────────────────────────────────────────

const faqSectionGenerator: BlockGenerator = (intake, opts) => ({
  headline: opts.slug === "/pricing" ? "Pricing FAQ" : "Frequently asked questions",
  items: [
    {
      question: `What is ${intake.companyName}?`,
      answer:   intake.description,
    },
    {
      question: `Who is ${intake.companyName} for?`,
      answer:   `${intake.companyName} is built for ${intake.targetAudience}.`,
    },
    {
      question: "How do I get started?",
      answer:   `Click "${intake.primaryCtaLabel}" to begin — setup takes just a few minutes.`,
    },
  ],
});

// ── teamSection ───────────────────────────────────────────────────────────────

const teamSectionGenerator: BlockGenerator = (intake) => ({
  headline: `Meet the team behind ${intake.companyName}`,
  members:  [],
});

// ── contactSection ────────────────────────────────────────────────────────────

const contactSectionGenerator: BlockGenerator = () => ({
  fields: ["name", "email", "company", "message"],
});

// ── Default (unknown block type) ──────────────────────────────────────────────

const defaultGenerator: BlockGenerator = () => ({});

// ── Registry ──────────────────────────────────────────────────────────────────

const GENERATORS: Record<string, BlockGenerator> = {
  hero:                heroGenerator,
  textSection:         textSectionGenerator,
  featureGrid:         featureGridGenerator,
  testimonialSection:  testimonialSectionGenerator,
  stats:               statsGenerator,
  logoStrip:           logoStripGenerator,
  ctaSection:          ctaSectionGenerator,
  faqSection:          faqSectionGenerator,
  teamSection:         teamSectionGenerator,
  contactSection:      contactSectionGenerator,
};
