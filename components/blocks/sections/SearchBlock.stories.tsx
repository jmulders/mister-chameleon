/**
 * SearchBlock stories
 *
 * ─── Note on the search API ────────────────────────────────────────────────────
 *
 *   The block makes a POST to /api/search on submit.  In Storybook there is no
 *   server, so the idle/empty state renders correctly but the loading → results
 *   flow fails.
 *
 *   The `WithResults*` stories use a `fetchMock` decorator that patches
 *   `window.fetch` for the duration of that story so a pre-defined fixture
 *   corpus is returned.  This lets you see and QA the full results UI without
 *   running the Next.js dev server.
 *
 * ─── Active search provider ────────────────────────────────────────────────────
 *
 *   When running in the full app, the search provider resolution is:
 *     1. Meilisearch (if tenant DB config present)
 *     2. Sanity GROQ  (if SANITY_PROJECT_ID is set)
 *     3. Statamic FS  (if STATAMIC_CMS_PATH is set — reads .md files from disk)
 *     4. InMemory fixture corpus (always-available fallback)
 */

import type { Meta, StoryObj, Decorator } from "@storybook/nextjs-vite";
import { SearchBlock }                     from "./SearchBlock";
import type { SearchBlockData }            from "@/page-config";
import type { SearchResponse, SearchResult } from "@/search";

// ─────────────────────────────────────────────────────────────────────────────
// Fixture corpus (mirrors real Statamic CMS content)
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_RESULTS: SearchResult[] = [
  {
    id:      "blog/de-toekomst-van-b2b-marketing",
    type:    "post",
    title:   "De toekomst van B2B-marketing: personalisatie op schaal",
    slug:    "/blog/de-toekomst-van-b2b-marketing",
    excerpt: "Hoe predictive personalisation de relatie tussen merk en koper fundamenteel " +
             "verandert — en waarom de winnaar die het CMS als beslissingsengine inzet.",
    image: {
      src: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80",
      alt: "Data on screen",
    },
    meta: [{ label: "Leestijd", value: "7 min" }],
  },
  {
    id:      "vacancies/senior-frontend-developer",
    type:    "vacancy",
    title:   "Senior Frontend Developer",
    slug:    "/vacancies/senior-frontend-developer",
    excerpt: "Wij zoeken een ervaren frontend developer met kennis van Next.js, TypeScript en " +
             "modern CSS. Je werkt samen met ons team aan uitdagende B2B-projecten.",
    meta: [
      { label: "Locatie",  value: "Amsterdam" },
      { label: "Contract", value: "Full-time" },
    ],
  },
  {
    id:      "pages/over",
    type:    "page",
    title:   "Over Mister Chameleon",
    slug:    "/over",
    excerpt: "Mister Chameleon is een B2B-marketingbureau gespecialiseerd in digitale strategie, " +
             "contentmarketing en website-ontwikkeling voor ambitieuze mkb-bedrijven.",
  },
  {
    id:      "pages/diensten",
    type:    "page",
    title:   "Onze diensten",
    slug:    "/diensten",
    excerpt: "Van contentmarketing tot technische SEO en website-development. " +
             "We bieden een volledig pakket voor B2B-bedrijven die willen groeien.",
  },
];

/** Build a fake SearchResponse from the fixture corpus. */
function mockResponse(query: string, scopes?: string[]): SearchResponse {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = FIXTURE_RESULTS.filter((r) => {
    const inScope = !scopes?.length || scopes.includes(r.type === "page" ? "pages" : r.type === "post" ? "posts" : "vacancies");
    if (!inScope) return false;
    const text = `${r.title} ${r.excerpt ?? ""}`.toLowerCase();
    return terms.some((t) => text.includes(t));
  });

  return {
    query:   { query, scopes: scopes as never, limit: 10, offset: 0 },
    results: filtered,
    total:   filtered.length,
    hasMore: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch mock decorator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Patches window.fetch for the story's lifetime so /api/search returns fixture
 * data.  Restores the original fetch when the story unmounts.
 */
const withFetchMock: Decorator = (Story, context) => {
  // Install mock only once per story render
  if (typeof window !== "undefined") {
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/search")) {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        const resp  = mockResponse(body.query ?? "", body.scopes);
        // Simulate a small network delay so loading state is visible
        await new Promise((r) => setTimeout(r, 350));
        return new Response(JSON.stringify(resp), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(input, init);
    };
    // Storybook cleans up decorators between stories, but we need to restore
    // synchronously — use the story's afterEach via a side-effect cleanup
    context.parameters._restoreFetch = () => { window.fetch = originalFetch; };
  }
  return <Story />;
};

// ─────────────────────────────────────────────────────────────────────────────
// Meta
// ─────────────────────────────────────────────────────────────────────────────

const meta: Meta<typeof SearchBlock> = {
  title:     "Blocks/Sections/Search",
  component: SearchBlock,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Full-text search input + inline results block. Submit-driven by default; " +
          "supports instant search (debounced). Three variants: **default** (section heading + " +
          "results), **minimal** (bare input), **full** (with scope filter toggles). " +
          "In production, search is served by the active SearchProvider — resolution order: " +
          "Meilisearch → Sanity GROQ → **Statamic FS** → InMemory.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SearchBlock>;

// ─────────────────────────────────────────────────────────────────────────────
// Base data
// ─────────────────────────────────────────────────────────────────────────────

const base: SearchBlockData = {
  title:             "Zoeken",
  description:       "Vind artikelen, pagina's en vacatures op de site.",
  placeholder:       "Typ om te zoeken…",
  emptyMessage:      "Voer een zoekterm in om resultaten te zien.",
  noResultsMessage:  "Geen resultaten gevonden — probeer een andere term.",
  maxResults:        9,
  enableInstant:     false,
  showFilters:       false,
};

// ─────────────────────────────────────────────────────────────────────────────
// Idle / empty-state stories (no server needed)
// ─────────────────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: "default — heading + description + search bar (idle)",
  args: { data: base, variant: "default" },
};

export const Full: Story = {
  name: "full — default + scope filter toggles (idle)",
  args: {
    data: {
      ...base,
      title:       "Site zoeken",
      description: "Doorzoek alle content-types.",
      showFilters: true,
      scopes:      ["pages", "posts", "vacancies"],
    },
    variant: "full",
  },
};

export const Minimal: Story = {
  name: "minimal — bare search input only (idle)",
  args: {
    data: {
      placeholder:      "Doorzoek de site…",
      emptyMessage:     "Begin met typen om te zoeken.",
      noResultsMessage: "Niets gevonden.",
    } as SearchBlockData,
    variant: "minimal",
  },
};

export const VacanciesOnly: Story = {
  name: "vacancies only — scoped search (idle)",
  args: {
    data: {
      ...base,
      title:       "Vacatures zoeken",
      description: "Doorzoek onze openstaande vacatures.",
      placeholder: "bijv. Frontend, Amsterdam, Marketing…",
      scopes:      ["vacancies"],
    },
    variant: "default",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// With-results stories (fetch mock active)
//
// These stories pre-type a search term so results are visible immediately.
// They use the `withFetchMock` decorator and `play` to submit the form.
// ─────────────────────────────────────────────────────────────────────────────

export const WithResultsDefault: Story = {
  name: "default — with results (mocked API)",
  args: {
    data: {
      ...base,
      enableInstant: true,
    },
    variant: "default",
  },
  decorators: [withFetchMock],
  play: async ({ canvasElement }) => {
    // Trigger an instant search so results are visible without clicking
    const input = canvasElement.querySelector<HTMLInputElement>("input[type='search']");
    if (!input) return;
    // Use native input value setter so React picks up the change
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    nativeInputValueSetter?.call(input, "marketing");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  },
};

export const WithResultsFull: Story = {
  name: "full — with results + scope filters (mocked API)",
  args: {
    data: {
      ...base,
      title:       "Site zoeken",
      description: "Doorzoek alle content-types.",
      showFilters: true,
      scopes:      ["pages", "posts", "vacancies"],
      enableInstant: true,
    },
    variant: "full",
  },
  decorators: [withFetchMock],
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector<HTMLInputElement>("input[type='search']");
    if (!input) return;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(input, "b2b");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  },
};

export const NoResults: Story = {
  name: "default — no results (mocked API, unmatched query)",
  args: {
    data: {
      ...base,
      enableInstant: true,
      noResultsMessage: "Geen resultaten gevonden voor deze zoekopdracht.",
    },
    variant: "default",
  },
  decorators: [withFetchMock],
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector<HTMLInputElement>("input[type='search']");
    if (!input) return;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(input, "zzzznotfound");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  },
};
