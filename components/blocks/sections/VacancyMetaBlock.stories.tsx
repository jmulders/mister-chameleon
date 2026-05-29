import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { VacancyMetaBlock } from "./VacancyMetaBlock";
import type { VacancyMetaBlockData } from "@/page-config";

// ── Mock data ─────────────────────────────────────────────────────────────────

const full: VacancyMetaBlockData = {
  title:        "Senior Frontend Engineer",
  department:   "Engineering",
  location:     "Amsterdam, Netherlands",
  remote:       "hybrid",
  contractType: "full-time",
  hoursPerWeek: "40 hours / week",
  salaryRange:  "€80,000 – €100,000",
  level:        "Senior",
  startDate:    "2025-06-01",
  closingDate:  "2025-05-15",
  breadcrumbs: [
    { label: "Home",      href: "/" },
    { label: "Careers",   href: "/careers" },
    { label: "Engineering", href: "/careers/engineering" },
  ],
};

// ── Meta ───────────────────────────────────────────────────────────────────────

const meta: Meta<typeof VacancyMetaBlock> = {
  title:     "Blocks/Sections/VacancyMeta",
  component: VacancyMetaBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Structured metadata card for a vacancy detail page. Shows location, contract type, hours, salary, deadline, and level. Three variants: default (full card), compact (inline badge strip), sidebar.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof VacancyMetaBlock>;

// ── Stories ────────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: "default — full metadata card",
  args: { data: full, variant: "default" },
};

export const Compact: Story = {
  name: "compact — inline badge strip",
  args: { data: full, variant: "compact" },
};

export const RemoteRole: Story = {
  name: "remote role — no physical location",
  args: {
    data: {
      title:        "Product Designer",
      department:   "Design",
      remote:       "remote",
      contractType: "full-time",
      hoursPerWeek: "32–40 hours / week",
      level:        "Mid",
      closingDate:  "2025-06-30",
    },
    variant: "default",
  },
};

export const UrgentDeadline: Story = {
  name: "compact — urgent deadline (within 14 days)",
  args: {
    data: {
      ...full,
      // Set to a date 5 days from now; Storybook renders with today's date
      closingDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    },
    variant: "compact",
  },
};

export const Minimal: Story = {
  name: "minimal fields — only required data",
  args: {
    data: {
      title:        "Customer Success Manager",
      location:     "London, UK",
      contractType: "full-time",
    },
    variant: "default",
  },
};
