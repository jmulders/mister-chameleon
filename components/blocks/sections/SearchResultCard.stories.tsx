/**
 * SearchResultCard stories
 *
 * Three layout variants:
 *   card    — vertical card with optional cover image, type badge, title, excerpt, meta
 *   row     — horizontal thumb + text (default); used in the /search page result list
 *   compact — text-only with left border accent; good for sidebars or dense lists
 *
 * The component renders with dangerouslySetInnerHTML for <mark>-highlighted snippets.
 * All tokens are CSS custom properties; use the Theme toolbar to preview different brands.
 */

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SearchResultCard }    from "./SearchResultCard";
import type { SearchResult }   from "@/search";

// ─────────────────────────────────────────────────────────────────────────────
// Fixture data
// ─────────────────────────────────────────────────────────────────────────────

const pageResult: SearchResult = {
  id:      "pages/over",
  type:    "page",
  title:   "Over Mister Chameleon",
  slug:    "/over",
  excerpt: "Mister Chameleon is een B2B-marketingbureau gespecialiseerd in digitale strategie, " +
           "contentmarketing en website-ontwikkeling voor ambitieuze mkb-bedrijven.",
};

const postResult: SearchResult = {
  id:      "blog/de-toekomst-van-b2b-marketing",
  type:    "post",
  title:   "De toekomst van B2B-marketing: personalisatie op schaal",
  slug:    "/blog/de-toekomst-van-b2b-marketing",
  excerpt: "Hoe predictive personalisation de relatie tussen merk en koper fundamenteel verandert. " +
           "We duiken in de beslissingsengine, adaptive content slots en serverless targeting.",
  image: {
    src: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
    alt: "Data visualisation on a screen",
  },
  meta: [
    { label: "Leestijd", value: "7 min" },
    { label: "Categorie", value: "Strategie" },
  ],
};

const vacancyResult: SearchResult = {
  id:      "vacancies/senior-frontend-developer",
  type:    "vacancy",
  title:   "Senior Frontend Developer",
  slug:    "/vacancies/senior-frontend-developer",
  excerpt: "Wij zoeken een ervaren frontend developer met kennis van Next.js, TypeScript en " +
           "modern CSS. Je werkt samen met ons team aan uitdagende B2B-projecten.",
  meta: [
    { label: "Locatie",   value: "Amsterdam" },
    { label: "Contract",  value: "Full-time" },
  ],
};

/** Result with a highlighted excerpt snippet (contains <mark> tags). */
const highlightedResult: SearchResult = {
  id:      "blog/b2b-seo",
  type:    "post",
  title:   "SEO voor <mark>B2B</mark>: van zoekwoord naar pipeline",
  slug:    "/blog/b2b-seo",
  excerpt: "…hoe je <mark>B2B</mark>-SEO inricht als een volwaardig kanaal. " +
           "Keyword-clusters, topical authority en de verbinding met je CRM-pipeline…",
  highlights: [
    {
      field:   "excerpt",
      snippet: "…hoe je <mark>B2B</mark>-SEO inricht als een volwaardig kanaal. " +
               "Keyword-clusters, topical authority en de verbinding met je CRM-pipeline…",
    },
  ],
};

const imageResult: SearchResult = {
  ...vacancyResult,
  id:    "vacancies/marketing-manager",
  title: "Online Marketing Manager",
  slug:  "/vacancies/online-marketing-manager",
  image: {
    src: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400&q=80",
    alt: "Marketing team in office",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Meta
// ─────────────────────────────────────────────────────────────────────────────

const meta: Meta<typeof SearchResultCard> = {
  title:     "Blocks/Sections/SearchResultCard",
  component: SearchResultCard,
  tags:      ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Single search result card. Three layout variants: **row** (default — horizontal, " +
          "used in the /search results page), **card** (vertical grid card with optional cover " +
          "image), and **compact** (text-only with left border accent, suitable for sidebars). " +
          "Supports highlighted excerpts with `<mark>` tags rendered via `dangerouslySetInnerHTML`.",
      },
    },
  },
  argTypes: {
    layout:      { control: "select", options: ["row", "card", "compact"] },
    headingLevel:{ control: "select", options: [2, 3, 4] },
  },
};

export default meta;
type Story = StoryObj<typeof SearchResultCard>;

// ─────────────────────────────────────────────────────────────────────────────
// Row layout (default)
// ─────────────────────────────────────────────────────────────────────────────

export const RowPage: Story = {
  name: "row — page result",
  args: { result: pageResult, layout: "row" },
};

export const RowPost: Story = {
  name: "row — post with meta",
  args: { result: postResult, layout: "row" },
};

export const RowVacancy: Story = {
  name: "row — vacancy with meta",
  args: { result: vacancyResult, layout: "row" },
};

export const RowHighlighted: Story = {
  name: "row — highlighted excerpt (with <mark>)",
  args: { result: highlightedResult, layout: "row" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Card layout (vertical)
// ─────────────────────────────────────────────────────────────────────────────

export const CardWithImage: Story = {
  name: "card — post with cover image",
  args: { result: postResult, layout: "card" },
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360 }}>
        <Story />
      </div>
    ),
  ],
};

export const CardNoImage: Story = {
  name: "card — page without image",
  args: { result: pageResult, layout: "card" },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360 }}>
        <Story />
      </div>
    ),
  ],
};

export const CardVacancy: Story = {
  name: "card — vacancy with image + meta",
  args: { result: imageResult, layout: "card" },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360 }}>
        <Story />
      </div>
    ),
  ],
};

/** Shows how a 3-column card grid looks with mixed content types. */
export const CardGrid: Story = {
  name: "card — 3-column grid (mixed types)",
  render: () => (
    <div style={{
      display:               "grid",
      gridTemplateColumns:   "repeat(3, 1fr)",
      gap:                   "1rem",
    }}>
      {[postResult, pageResult, { ...vacancyResult, image: imageResult.image }].map(
        (r) => <SearchResultCard key={r.id} result={r} layout="card" />,
      )}
    </div>
  ),
  parameters: { layout: "padded" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Compact layout (sidebar / dense list)
// ─────────────────────────────────────────────────────────────────────────────

export const CompactPage: Story = {
  name: "compact — page",
  args: { result: pageResult, layout: "compact" },
};

export const CompactPost: Story = {
  name: "compact — post",
  args: { result: postResult, layout: "compact" },
};

/** Dense list of compact results, as you'd see in a sidebar search widget. */
export const CompactList: Story = {
  name: "compact — sidebar list (3 items)",
  render: () => (
    <div style={{ maxWidth: 320, background: "var(--bg-subtle, #f9fafb)", padding: "1rem", borderRadius: "0.5rem" }}>
      {[pageResult, postResult, vacancyResult].map((r) => (
        <SearchResultCard key={r.id} result={r} layout="compact" />
      ))}
    </div>
  ),
};
