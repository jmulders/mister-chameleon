/**
 * FilterBar stories
 *
 * Stories render FilterBarUI (the pure presentational component) directly,
 * bypassing FilterBarBlock's Suspense + router-adapter layer.  This means:
 *
 *   • No next/navigation dependency
 *   • No App Router context required
 *   • No <Suspense> wrapper needed
 *   • Filters are fully interactive via local useState
 *
 * FilterBarStory is a thin stateful wrapper that owns filter state and passes
 * it to FilterBarUI the same way FilterBarInner (the real router adapter) does
 * in the app — the only difference is that local state replaces URL params.
 */

import { useState, useRef }     from "react";
import type { Meta, StoryObj }  from "@storybook/nextjs-vite";
import { FilterBarUI }          from "./FilterBarBlock";
import { resolveBlockVariant }  from "@/page-config/block-variants";
import type { FilterBarVariant } from "@/page-config/block-variants";
import type { FilterBarBlockData } from "@/page-config";

// ── Stateful story wrapper ────────────────────────────────────────────────────
//
// Owns filter state locally so every story is interactive without needing a
// router.  Mirrors the shape of FilterBarBlock's args (data + variant) so
// Storybook controls work on those two fields.

interface FilterBarStoryProps {
  data:     FilterBarBlockData;
  variant?: string;
}

function FilterBarStory({ data, variant: rawVariant = "default" }: FilterBarStoryProps) {
  const variant = resolveBlockVariant("filterBar", rawVariant) as FilterBarVariant;

  const [searchValue,    setSearchValue]    = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [activeTag,      setActiveTag]      = useState("");
  const [activeSort,     setActiveSort]     = useState("");

  // Debounce ref kept for API symmetry with the real adapter; in stories the
  // timeout fires a no-op because there is no URL to update.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasActiveFilters =
    Boolean(searchValue) || Boolean(activeCategory) || Boolean(activeTag) || Boolean(activeSort);

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setSearchValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // In stories we update state immediately — no URL to debounce against.
    debounceRef.current = setTimeout(() => {/* no URL to push */}, 320);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Nothing to do — local state is already up to date.
  }

  function handleClearAll() {
    setSearchValue("");
    setActiveCategory("");
    setActiveTag("");
    setActiveSort("");
  }

  return (
    <FilterBarUI
      data={data}
      variant={variant}
      searchValue={searchValue}
      activeCategory={activeCategory}
      activeTag={activeTag}
      activeSort={activeSort}
      hasActiveFilters={hasActiveFilters}
      onSearchChange={handleSearchChange}
      onSearchSubmit={handleSearchSubmit}
      onCategoryChange={setActiveCategory}
      onTagChange={setActiveTag}
      onSortChange={setActiveSort}
      onClearAll={handleClearAll}
    />
  );
}

// ── Fixture data ──────────────────────────────────────────────────────────────

const fullData: FilterBarBlockData = {
  placeholder:        "Search articles, vacancies, guides…",
  showSearch:         true,
  showCategoryFilter: true,
  showTagFilter:      true,
  categories: [
    { value: "engineering", label: "Engineering", count: 14 },
    { value: "design",      label: "Design",      count: 7  },
    { value: "product",     label: "Product",     count: 5  },
    { value: "company",     label: "Company",     count: 9  },
  ],
  tags: [
    { value: "typescript", label: "TypeScript", count: 8  },
    { value: "react",      label: "React",      count: 11 },
    { value: "nextjs",     label: "Next.js",    count: 6  },
  ],
  sortOptions: [
    { value: "newest",  label: "Newest first" },
    { value: "oldest",  label: "Oldest first" },
    { value: "popular", label: "Most popular" },
  ],
};

const searchOnlyData: FilterBarBlockData = {
  placeholder:        "Search vacancies…",
  showSearch:         true,
  showCategoryFilter: false,
  showTagFilter:      false,
};

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta: Meta<typeof FilterBarStory> = {
  title:     "Blocks/Sections/FilterBar",
  component: FilterBarStory,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Interactive search + filter bar for listing pages. " +
          "In the real app, `FilterBarBlock` publishes filter state to URL params " +
          "(`q`, `category`, `tag`, `sort`) via `next/navigation`. " +
          "Stories render the presentational `FilterBarUI` layer directly — " +
          "no App Router or `<Suspense>` required.",
      },
    },
  },
  // No Suspense decorator needed — FilterBarUI has no next/navigation dependency
};

export default meta;
type Story = StoryObj<typeof FilterBarStory>;

// ── Stories ───────────────────────────────────────────────────────────────────

export const Default: Story = {
  args: {
    data:    fullData,
    variant: "default",
  },
};

export const Compact: Story = {
  name: "Compact (labels hidden)",
  args: {
    data:    fullData,
    variant: "compact",
  },
};

export const SearchOnly: Story = {
  name: "Search only (no filters)",
  args: {
    data:    searchOnlyData,
    variant: "default",
  },
};

export const CategoryAndSort: Story = {
  name: "Category + sort (no tags)",
  args: {
    data: {
      ...fullData,
      showTagFilter: false,
    },
    variant: "default",
  },
};
