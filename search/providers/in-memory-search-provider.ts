/**
 * InMemorySearchProvider
 *
 * A built-in, zero-dependency SearchProvider that performs case-insensitive
 * full-text matching over a pre-seeded content corpus.
 *
 * ─── Purpose ──────────────────────────────────────────────────────────────────
 *
 *   Serves two roles:
 *
 *   1. Local / development search — works without any external search backend,
 *      environment variables, or index setup.  Run `next dev` and search works
 *      immediately.
 *
 *   2. Reference implementation — documents the full SearchProvider contract
 *      with a concrete, readable implementation that external adapters
 *      (Algolia, Typesense, Sanity GROQ, etc.) can mirror.
 *
 * ─── Matching algorithm ───────────────────────────────────────────────────────
 *
 *   1. Tokenise the query string on whitespace.
 *   2. Score each corpus entry:
 *        title match    → 0.6 per term
 *        excerpt match  → 0.3 per term
 *        tag match      → 0.1 per term
 *      Normalised to [0, 1] per term; entries with score 0 are excluded.
 *   3. Sort by score descending (provider pre-sorted, per SearchProvider contract).
 *   4. Apply offset + limit pagination.
 *   5. Build SearchHighlight snippets: a ≤200-char extract centred on the
 *      first match, with matched terms wrapped in <mark>.
 *
 * ─── Corpus ───────────────────────────────────────────────────────────────────
 *
 *   Fixed set of pages, posts, and vacancies representative of the platform's
 *   own content.  Swap for a database-backed adapter when a production search
 *   backend is available (see search/providers/index.ts for wiring).
 */

import type {
  SearchProvider,
  SearchQuery,
  SearchResponse,
  SearchResult,
  SearchResultType,
  SearchScope,
  SearchHighlight,
  SearchSuggestion,
} from "@/search";

// ─────────────────────────────────────────────────────────────────────────────
// Internal corpus type
// ─────────────────────────────────────────────────────────────────────────────

interface CorpusEntry {
  readonly id:        string;
  readonly type:      SearchResultType;
  readonly scope:     SearchScope;
  readonly title:     string;
  readonly slug:      string;
  readonly excerpt:   string;
  readonly meta?:     readonly { readonly label: string; readonly value: string }[];
  readonly tags?:     readonly string[];
  readonly category?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixture corpus
// ─────────────────────────────────────────────────────────────────────────────

const CORPUS: readonly CorpusEntry[] = [

  // ── Pages ──────────────────────────────────────────────────────────────────

  {
    id:      "page-home",
    type:    "page",
    scope:   "pages",
    title:   "Adaptive Websites, Without the Complexity",
    slug:    "/",
    excerpt:
      "Mister Chameleon delivers the right message to the right visitor — automatically. No A/B testing required, no engineering sprints, no excuses.",
    tags:    ["personalisation", "adaptive", "homepage"],
  },
  {
    id:      "page-about",
    type:    "page",
    scope:   "pages",
    title:   "About Mister Chameleon",
    slug:    "/about",
    excerpt:
      "We're a small team of engineers and growth marketers who believe personalisation shouldn't require a data science team or a six-figure platform contract.",
    tags:    ["team", "about", "company"],
  },
  {
    id:      "page-platform",
    type:    "page",
    scope:   "pages",
    title:   "Platform — How It Works",
    slug:    "/platform",
    excerpt:
      "Mister Chameleon's decision engine evaluates 12 visitor signals in real time — source, device, campaign, recency, and more — before the page paints.",
    tags:    ["platform", "features", "technology", "decision engine"],
  },
  {
    id:      "page-pricing",
    type:    "page",
    scope:   "pages",
    title:   "Pricing — Simple, Transparent Plans",
    slug:    "/pricing",
    excerpt:
      "Start for free. Your first adaptive experience is free, forever. Scale to Pro and Growth as your conversion demands grow.",
    tags:    ["pricing", "plans", "free"],
    meta:    [{ label: "Plans", value: "Free · Pro · Growth" }],
  },
  {
    id:       "page-docs-quickstart",
    type:     "page",
    scope:    "pages",
    title:    "Quickstart Guide",
    slug:     "/docs/quickstart",
    excerpt:
      "Connect your domain, define your first two rules, and ship your first adaptive experience in under five minutes. No code required.",
    tags:     ["docs", "quickstart", "guide", "onboarding"],
    category: "documentation",
  },
  {
    id:       "page-docs-api",
    type:     "page",
    scope:    "pages",
    title:    "API Reference",
    slug:     "/docs/api",
    excerpt:
      "Full reference for the Mister Chameleon REST and edge API. Authenticate requests, query visitor context, and override decisions programmatically.",
    tags:     ["docs", "api", "reference", "developer"],
    category: "documentation",
  },

  // ── Posts ──────────────────────────────────────────────────────────────────

  {
    id:       "post-personalisation-decision-engine",
    type:     "post",
    scope:    "posts",
    title:    "Why Personalisation Fails Without a Decision Engine",
    slug:     "/blog/personalisation-decision-engine",
    excerpt:
      "Most personalisation tools give you a canvas and ask you to paint. A decision engine gives you a camera and photographs the visitor automatically.",
    tags:     ["personalisation", "decision engine", "strategy"],
    category: "strategy",
    meta:     [
      { label: "Reading time", value: "6 min" },
      { label: "Category",     value: "Strategy" },
    ],
  },
  {
    id:       "post-conversion-adaptive-content",
    type:     "post",
    scope:    "posts",
    title:    "3 Ways to Increase Conversion with Adaptive Content",
    slug:     "/blog/conversion-adaptive-content",
    excerpt:
      "Adaptive content matches visitor intent before they scroll. Here are three concrete patterns that lift B2B conversion rates within the first 30 days.",
    tags:     ["conversion", "adaptive", "B2B", "content"],
    category: "growth",
    meta:     [
      { label: "Reading time", value: "8 min" },
      { label: "Category",     value: "Growth" },
    ],
  },
  {
    id:       "post-context-aware-landing-pages",
    type:     "post",
    scope:    "posts",
    title:    "Introducing Context-Aware Landing Pages",
    slug:     "/blog/context-aware-landing-pages",
    excerpt:
      "A landing page that knows whether a visitor came from a paid campaign, organic search, or a LinkedIn share — and adapts its headline accordingly.",
    tags:     ["landing pages", "context", "adaptive", "campaigns"],
    category: "product",
    meta:     [
      { label: "Reading time", value: "5 min" },
      { label: "Category",     value: "Product" },
    ],
  },
  {
    id:       "post-high-converting-b2b-homepage",
    type:     "post",
    scope:    "posts",
    title:    "The Anatomy of a High-Converting B2B Homepage",
    slug:     "/blog/high-converting-b2b-homepage",
    excerpt:
      "There are six sections every high-converting B2B homepage needs, and three visitor signals you should use to decide which variant of each section to show.",
    tags:     ["B2B", "homepage", "conversion", "design"],
    category: "strategy",
    meta:     [
      { label: "Reading time", value: "10 min" },
      { label: "Category",     value: "Strategy" },
    ],
  },

  // ── Vacancies ──────────────────────────────────────────────────────────────

  {
    id:       "vacancy-senior-frontend-engineer",
    type:     "vacancy",
    scope:    "vacancies",
    title:    "Senior Frontend Engineer (React / Next.js)",
    slug:     "/vacancies/senior-frontend-engineer",
    excerpt:
      "Build the platform that makes personalisation accessible to every growth team. You'll own the block rendering system, the CMS integration layer, and the adaptive component model.",
    tags:     ["engineering", "frontend", "React", "Next.js"],
    category: "engineering",
    meta:     [
      { label: "Location", value: "Amsterdam (hybrid)" },
      { label: "Contract", value: "Full-time" },
      { label: "Level",    value: "Senior" },
    ],
  },
  {
    id:       "vacancy-backend-engineer",
    type:     "vacancy",
    scope:    "vacancies",
    title:    "Backend Engineer (Node.js / Edge Runtime)",
    slug:     "/vacancies/backend-engineer",
    excerpt:
      "Design and maintain the decision engine that evaluates visitor signals in under 5 ms. You'll work at the edge, with Vercel, Cloudflare Workers, and the Next.js App Router.",
    tags:     ["engineering", "backend", "Node.js", "edge", "Vercel"],
    category: "engineering",
    meta:     [
      { label: "Location", value: "Amsterdam (hybrid)" },
      { label: "Contract", value: "Full-time" },
      { label: "Level",    value: "Mid–Senior" },
    ],
  },
  {
    id:       "vacancy-product-designer",
    type:     "vacancy",
    scope:    "vacancies",
    title:    "Product Designer",
    slug:     "/vacancies/product-designer",
    excerpt:
      "Design the admin interface, the CMS block editor, and the onboarding flow for a platform used by growth teams across Europe. Token-based design system, Figma, close collaboration with engineering.",
    tags:     ["design", "product", "UX", "Figma"],
    category: "design",
    meta:     [
      { label: "Location", value: "Amsterdam (hybrid)" },
      { label: "Contract", value: "Full-time" },
      { label: "Level",    value: "Mid–Senior" },
    ],
  },
  {
    id:       "vacancy-growth-marketing-manager",
    type:     "vacancy",
    scope:    "vacancies",
    title:    "Growth Marketing Manager",
    slug:     "/vacancies/growth-marketing-manager",
    excerpt:
      "Own the demand generation funnel for a product that sells itself. Run campaigns across Google and LinkedIn, optimise landing pages with our own platform, and report directly to the founders.",
    tags:     ["marketing", "growth", "SEO", "PPC", "campaigns"],
    category: "marketing",
    meta:     [
      { label: "Location", value: "Amsterdam (remote-friendly)" },
      { label: "Contract", value: "Full-time" },
      { label: "Level",    value: "Mid–Senior" },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Matching helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Escape a string for safe use as a literal RegExp pattern. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Score a corpus entry against an array of query terms.
 *
 * Returns a number in [0, 1] — 0 means no match.
 * Title matches score higher than excerpt matches, which score higher than tags.
 * An empty `terms` array is treated as "match all" and returns 1.
 */
function scoreEntry(entry: CorpusEntry, terms: readonly string[]): number {
  if (terms.length === 0) return 1;

  const titleLower   = entry.title.toLowerCase();
  const excerptLower = entry.excerpt.toLowerCase();
  const tagsLower    = (entry.tags ?? []).join(" ").toLowerCase();

  let raw = 0;
  for (const term of terms) {
    const t = term.toLowerCase();
    if (titleLower.includes(t))   raw += 0.6;
    if (excerptLower.includes(t)) raw += 0.3;
    if (tagsLower.includes(t))    raw += 0.1;
  }

  // Normalise: divide by max possible score per term (1.0) × terms count
  return Math.min(raw / terms.length, 1);
}

/**
 * Build a SearchHighlight for a field by wrapping matched terms in <mark>.
 * Returns null if no terms match the field's text.
 *
 * The snippet is at most ~200 characters, centred on the first match.
 * HTML in the source text is NOT escaped — the corpus contains plain text,
 * so this is safe.  Do NOT use with user-generated content without escaping.
 */
function buildHighlight(
  field: string,
  text:  string,
  terms: readonly string[],
): SearchHighlight | null {
  if (terms.length === 0) return null;

  const matchPattern = new RegExp(terms.map(escapeRegex).join("|"), "i");
  const matchIndex   = text.search(matchPattern);
  if (matchIndex === -1) return null;

  // Centre a ~200-char window around the first match
  const start = Math.max(0, matchIndex - 60);
  const end   = Math.min(text.length, matchIndex + 140);
  let snippet = text.slice(start, end);
  if (start > 0)         snippet = "…" + snippet;
  if (end < text.length) snippet = snippet + "…";

  // Wrap all occurrences of any term in <mark>
  const highlighted = snippet.replace(
    new RegExp(`(${terms.map(escapeRegex).join("|")})`, "gi"),
    "<mark>$1</mark>",
  );

  return { field, snippet: highlighted };
}

/**
 * Map a CorpusEntry and matched terms to a normalised SearchResult.
 */
function toSearchResult(
  entry: CorpusEntry,
  terms: readonly string[],
  score: number,
): SearchResult {
  const highlights: SearchHighlight[] = [];

  if (terms.length > 0) {
    const th = buildHighlight("title",   entry.title,   terms);
    const eh = buildHighlight("excerpt", entry.excerpt, terms);
    if (th) highlights.push(th);
    if (eh) highlights.push(eh);
  }

  return {
    id:         entry.id,
    type:       entry.type,
    title:      entry.title,
    slug:       entry.slug,
    excerpt:    entry.excerpt,
    meta:       entry.meta,
    highlights: highlights.length > 0 ? highlights : undefined,
    score,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// InMemorySearchProvider
// ─────────────────────────────────────────────────────────────────────────────

export class InMemorySearchProvider implements SearchProvider {
  /**
   * Execute a full-text search against the in-memory corpus.
   *
   * Tokenises the query on whitespace, scores each corpus entry against all
   * terms, filters out zero-score entries, sorts by score descending, then
   * applies limit/offset pagination.
   */
  async search(query: SearchQuery): Promise<SearchResponse> {
    const start   = Date.now();
    const terms   = query.query.trim().split(/\s+/).filter(Boolean);
    const limit   = Math.max(1, Math.min(query.limit  ?? 10, 100));
    const offset  = Math.max(0, query.offset ?? 0);

    // Resolve scope filter — null means "all scopes"
    const scopeSet: Set<SearchScope> | null =
      query.scopes && query.scopes.length > 0
        ? new Set(query.scopes)
        : null;

    // Filter by scope, then score
    const scored = CORPUS
      .filter((e) => scopeSet === null || scopeSet.has(e.scope))
      .map((e) => ({ entry: e, score: scoreEntry(e, terms) }))
      .filter(({ score }) => score > 0);

    // Sort by relevance (pre-sorted per SearchProvider contract)
    scored.sort((a, b) => b.score - a.score);

    const total   = scored.length;
    const page    = scored.slice(offset, offset + limit);
    const results = page.map(({ entry, score }) =>
      toSearchResult(entry, terms, score),
    );

    return {
      query,
      results,
      total,
      hasMore: offset + results.length < total,
      took:    Date.now() - start,
    };
  }

  /**
   * Return autocomplete suggestions for a partial query string.
   *
   * Matches titles that contain the partial string (case-insensitive).
   * Returns up to 5 suggestions, most specific first.
   */
  async suggest(
    partial: string,
    scopes?: readonly SearchScope[],
  ): Promise<readonly SearchSuggestion[]> {
    if (!partial.trim()) return [];

    const lower    = partial.toLowerCase();
    const scopeSet = scopes && scopes.length > 0 ? new Set(scopes) : null;

    return CORPUS
      .filter((e) =>
        (scopeSet === null || scopeSet.has(e.scope)) &&
        e.title.toLowerCase().includes(lower),
      )
      .slice(0, 5)
      .map((e): SearchSuggestion => ({ text: e.title, scope: e.type }));
  }
}
