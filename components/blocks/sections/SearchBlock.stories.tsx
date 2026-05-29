/**
 * SearchBlock stories
 *
 * The block makes a POST to /api/search on submit — that call will fail in
 * Storybook (no server). The idle/empty state renders correctly without a
 * server; the loading and result states require running the full app.
 */

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SearchBlock } from "./SearchBlock";
import type { SearchBlockData } from "@/page-config";

const meta: Meta<typeof SearchBlock> = {
  title:     "Blocks/Sections/Search",
  component: SearchBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Full-text search input + inline results block. Submit-driven by default; supports instant search (debounced). Three variants: default (section heading + results), minimal (bare input), full (with scope filter toggles).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SearchBlock>;

const base: SearchBlockData = {
  title:             "Search",
  description:       "Find articles, pages, and vacancies across the site.",
  placeholder:       "Type to search…",
  emptyMessage:      "Enter a keyword to get started.",
  noResultsMessage:  "No results found — try a different search term.",
  maxResults:        9,
  enableInstant:     false,
  showFilters:       false,
};

export const Default: Story = {
  name: "default — heading + description + search bar",
  args: { data: base, variant: "default" },
};

export const Full: Story = {
  name: "full — default + scope filter toggles (Pages / Posts / Vacancies)",
  args: {
    data: {
      ...base,
      title:       "Site search",
      description: "Search across all content types.",
      showFilters: true,
      scopes:      ["pages", "posts", "vacancies"],
    },
    variant: "full",
  },
};

export const Minimal: Story = {
  name: "minimal — bare search input only",
  args: {
    data: {
      formKey:          undefined,
      placeholder:      "Search the site…",
      emptyMessage:     "Start typing to search.",
      noResultsMessage: "Nothing found.",
    } as SearchBlockData,
    variant: "minimal",
  },
};

export const VacanciesOnly: Story = {
  name: "vacancies only — scoped search",
  args: {
    data: {
      ...base,
      title:       "Find open roles",
      description: "Search our current vacancies by keyword, location, or team.",
      placeholder: "e.g. Frontend, Amsterdam, Marketing…",
      scopes:      ["vacancies"],
    },
    variant: "default",
  },
};
