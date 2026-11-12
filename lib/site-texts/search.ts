/**
 * Site texts for search: the /search page, the search block, the search
 * results block, the filter bar and the search field in the header.
 *
 * A placeholder or empty-state message set in the CMS always wins. These are
 * the texts the platform shows when the CMS gives none.
 */

import type { SiteTexts } from "./locale";

export interface SearchTexts {
  /** Shared by the search block and the filter bar. */
  placeholder: string;
  /** aria-label of a search input. */
  inputLabel:  string;
  /** Something went wrong while searching. */
  error:       string;

  /** components/layout/SearchBar.tsx, the field in the header. */
  bar: {
    placeholder: string;
    submit:      string;
  };

  /** app/(site)/search/page.tsx */
  page: {
    heading:      string;
    headingFor:   (query: string) => string;
    results:      (count: number, query: string) => string;
    placeholder:  string;
    clear:        string;
    search:       string;
    searching:    string;
    typeHeading:  string;
    /** Group label when a result carries no collection title of its own. */
    typeLabels:   Record<"page" | "post" | "vacancy", string>;
    noResults:    (query: string) => string;
    idle:         string;
  };

  /** components/blocks/sections/SearchBlock.tsx */
  block: {
    submitLabel:  string;
    search:       string;
    searching:    string;
    startTyping:  string;
    noResults:    (query: string) => string;
    results:      (count: number, query: string) => string;
    scopesLabel:  string;
    scopes:       Record<"pages" | "posts" | "vacancies", string>;
    /** Badge on a result card. */
    typeBadges:   Record<"page" | "post" | "vacancy", string>;
  };

  /** components/blocks/sections/SearchResultsBlock.tsx */
  results: {
    count:     (shown: number, total: number) => string;
    noResults: string;
  };

  /** components/blocks/sections/FilterBarBlock.tsx */
  filter: {
    formLabel:     string;
    category:      string;
    byCategory:    string;
    allCategories: string;
    tag:           string;
    byTag:         string;
    allTags:       string;
    sortBy:        string;
    sortResults:   string;
    sort:          string;
    clear:         string;
  };
}

export const SEARCH_TEXTS: SiteTexts<SearchTexts> = {
  en: {
    placeholder: "Search…",
    inputLabel:  "Search",
    error:       "Something went wrong. Please try again.",

    bar: {
      placeholder: "Search…",
      submit:      "Search",
    },

    page: {
      heading:     "Search",
      headingFor:  (query) => `Searching for '${query}'`,
      results:     (count, query) => `${count} ${count === 1 ? "result" : "results"} for '${query}'`,
      placeholder: "Search the site…",
      clear:       "Clear search",
      search:      "Search",
      searching:   "Searching…",
      typeHeading: "Type",
      typeLabels:  { page: "Pages", post: "Articles", vacancy: "Vacancies" },
      noResults:   (query) => `No results found for '${query}'. Try a different search.`,
      idle:        "Type a search term and press Search.",
    },

    block: {
      submitLabel: "Submit search",
      search:      "Search",
      searching:   "Searching…",
      startTyping: "Start typing to search.",
      noResults:   (query) => `No results found for "${query}".`,
      results:     (count, query) =>
        count === 1 ? `1 result for "${query}"` : `${count} results for "${query}"`,
      scopesLabel: "Filter by content type",
      scopes:      { pages: "Pages", posts: "Posts", vacancies: "Vacancies" },
      typeBadges:  { page: "Page", post: "Post", vacancy: "Vacancy" },
    },

    results: {
      count: (shown, total) =>
        shown === total
          ? `${total} ${total === 1 ? "result" : "results"}`
          : `${shown} of ${total} ${total === 1 ? "result" : "results"}`,
      noResults: "No results found. Try adjusting your search or filters.",
    },

    filter: {
      formLabel:     "Filter results",
      category:      "Category",
      byCategory:    "Filter by category",
      allCategories: "All categories",
      tag:           "Tag",
      byTag:         "Filter by tag",
      allTags:       "All tags",
      sortBy:        "Sort by",
      sortResults:   "Sort results",
      sort:          "Sort",
      clear:         "Clear",
    },
  },

  nl: {
    placeholder: "Zoek…",
    inputLabel:  "Zoeken",
    error:       "Er is iets misgegaan. Probeer het opnieuw.",

    bar: {
      placeholder: "Zoek op de site…",
      submit:      "Zoek",
    },

    page: {
      heading:     "Zoeken",
      headingFor:  (query) => `Zoeken naar '${query}'`,
      results:     (count, query) => `${count} ${count === 1 ? "resultaat" : "resultaten"} voor '${query}'`,
      placeholder: "Zoek op de site…",
      clear:       "Wis zoekopdracht",
      search:      "Zoek",
      searching:   "Zoeken…",
      typeHeading: "Type",
      typeLabels:  { page: "Pagina's", post: "Artikelen", vacancy: "Vacatures" },
      noResults:   (query) => `Niets gevonden voor '${query}'. Probeer een andere zoekterm.`,
      idle:        "Typ een zoekterm en klik op Zoek.",
    },

    block: {
      submitLabel: "Zoek",
      search:      "Zoek",
      searching:   "Zoeken…",
      startTyping: "Typ om te zoeken.",
      noResults:   (query) => `Niets gevonden voor "${query}".`,
      results:     (count, query) =>
        count === 1 ? `1 resultaat voor "${query}"` : `${count} resultaten voor "${query}"`,
      scopesLabel: "Filter op soort inhoud",
      scopes:      { pages: "Pagina's", posts: "Artikelen", vacancies: "Vacatures" },
      typeBadges:  { page: "Pagina", post: "Artikel", vacancy: "Vacature" },
    },

    results: {
      count: (shown, total) =>
        shown === total
          ? `${total} ${total === 1 ? "resultaat" : "resultaten"}`
          : `${shown} van ${total} ${total === 1 ? "resultaat" : "resultaten"}`,
      noResults: "Niets gevonden. Pas je zoekterm of filters aan.",
    },

    filter: {
      formLabel:     "Resultaten filteren",
      category:      "Categorie",
      byCategory:    "Filter op categorie",
      allCategories: "Alle categorieën",
      tag:           "Tag",
      byTag:         "Filter op tag",
      allTags:       "Alle tags",
      sortBy:        "Sorteer op",
      sortResults:   "Resultaten sorteren",
      sort:          "Sorteer",
      clear:         "Wis filters",
    },
  },
};
