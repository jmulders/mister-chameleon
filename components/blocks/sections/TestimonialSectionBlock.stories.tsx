import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TestimonialSectionBlock } from "./TestimonialSectionBlock";
import type { TestimonialSectionBlockData } from "@/page-config";

const testimonials = [
  {
    quote:   "The platform reduced our time-to-publish by 60%. Our editors love the flexibility and we love not having to maintain bespoke CMS integrations.",
    author:  "Sophie van der Berg",
    company: "Head of Digital — Nexus Media",
    avatar:  "https://i.pravatar.cc/150?img=47",
  },
  {
    quote:   "We evaluated five platforms and this was the only one that could handle our multi-brand, multi-market setup without custom development.",
    author:  "Mark Leuven",
    company: "CTO — BrandStack",
    avatar:  "https://i.pravatar.cc/150?img=12",
  },
  {
    quote:   "Design tokens made it trivial to maintain brand consistency across 12 different tenant sites. A real game-changer.",
    author:  "Priya Nair",
    company: "Lead Designer — Vantage Group",
    avatar:  "https://i.pravatar.cc/150?img=29",
  },
  {
    quote:   "The onboarding process was the smoothest we've had with any SaaS vendor. Up and running in a day.",
    author:  "James Wouter",
    company: "Engineering Manager — Flowbase",
    avatar:  "https://i.pravatar.cc/150?img=53",
  },
] as const;

const threeTestimonials: TestimonialSectionBlockData = {
  heading:      "What our customers say",
  testimonials: testimonials.slice(0, 3),
};

const allTestimonials: TestimonialSectionBlockData = {
  heading:      "Trusted by teams worldwide",
  testimonials: testimonials,
};

const singleTestimonial: TestimonialSectionBlockData = {
  testimonials: testimonials.slice(0, 1),
};

const meta: Meta<typeof TestimonialSectionBlock> = {
  title:     "Blocks/Sections/TestimonialSection",
  component: TestimonialSectionBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Testimonial showcase with five variants: " +
          "`default` (3-col grid), `quote-card` (full-width single quote), " +
          "`testimonial_slider` (CSS-snap carousel), `testimonial_highlight` (featured + grid), " +
          "`testimonial_featured_image` (large avatar + supporting grid).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof TestimonialSectionBlock>;

export const Grid: Story = {
  name: "Default — 3-col grid",
  args: { data: threeTestimonials, variant: "default" },
};

export const QuoteCard: Story = {
  name: "quote-card — single centred quote",
  args: { data: singleTestimonial, variant: "quote-card" },
};

export const Slider: Story = {
  name: "testimonial_slider — horizontal carousel",
  args: { data: allTestimonials, variant: "testimonial_slider" },
};

export const Highlight: Story = {
  name: "testimonial_highlight — featured + supporting grid",
  args: { data: allTestimonials, variant: "testimonial_highlight" },
};

export const FeaturedImage: Story = {
  name: "testimonial_featured_image — avatar feature",
  args: { data: allTestimonials, variant: "testimonial_featured_image" },
};

export const NoHeading: Story = {
  name: "No heading",
  args: { data: { testimonials: testimonials.slice(0, 3) }, variant: "default" },
};
