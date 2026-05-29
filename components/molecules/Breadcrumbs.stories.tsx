import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Breadcrumbs } from "./Breadcrumbs";
import type { BreadcrumbItem } from "./Breadcrumbs";

const twoLevel: readonly BreadcrumbItem[] = [
  { label: "Home",    href: "/" },
  { label: "About" },
];

const threeLevel: readonly BreadcrumbItem[] = [
  { label: "Home",      href: "/" },
  { label: "Blog",      href: "/blog" },
  { label: "Article title" },
];

const deepTrail: readonly BreadcrumbItem[] = [
  { label: "Home",         href: "/" },
  { label: "Careers",      href: "/careers" },
  { label: "Engineering",  href: "/careers/engineering" },
  { label: "Senior Frontend Developer" },
];

const meta: Meta<typeof Breadcrumbs> = {
  title:     "Molecules/Breadcrumbs",
  component: Breadcrumbs,
  tags:      ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Accessible navigation trail (`<nav aria-label=\"Breadcrumb\">`). " +
          "Last item is the current page (`aria-current=\"page\"`). " +
          "Includes JSON-LD `BreadcrumbList` structured data for SEO.",
      },
    },
  },
  args: {
    items: threeLevel,
  },
};

export default meta;
type Story = StoryObj<typeof Breadcrumbs>;

export const Default: Story = {};

export const TwoLevels: Story = {
  name: "Two levels",
  args: { items: twoLevel },
};

export const ThreeLevels: Story = {
  name: "Three levels",
  args: { items: threeLevel },
};

export const DeepTrail: Story = {
  name: "Deep trail (4 levels)",
  args: { items: deepTrail },
};

export const SingleItem: Story = {
  name: "Single item (home page)",
  args: {
    items: [{ label: "Home" }],
  },
};

export const NoHrefs: Story = {
  name: "No links (breadcrumb text only)",
  args: {
    items: [
      { label: "Section" },
      { label: "Sub-section" },
      { label: "Current page" },
    ],
  },
};
