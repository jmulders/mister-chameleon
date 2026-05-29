/**
 * MockCMSProvider
 *
 * In-memory CMS provider for the MVP and test environments.
 * Contains hardcoded content for all 9 variant keys across the three
 * homepage block types. No network calls, no environment variables required.
 *
 * Content philosophy:
 *  - Each variant speaks directly to the intent of the traffic source
 *    that the decision engine routes it to.
 *  - Google variants: lead with a problem / urgency framing.
 *  - LinkedIn variants: lead with vision / thought leadership.
 *  - Default variants: lead with brand clarity.
 *
 * Replacing this provider:
 *  Swap `new MockCMSProvider()` for `new SanityCMSProvider()` at the
 *  call site (or DI root). No other code changes required.
 */

import type { CMSProvider, ProvisionResult, TestConnectionResult } from "./cms-provider";
import type { TenantSettings } from "@/tenant/types";
import type {
  HeroBlockData,
  ProofBlockData,
  CTABlockData,
  FeatureBlockData,
  ConversionBlockData,
  NotificationBlockData,
  SiteSettingsData,
  PageData,
  PageSectionData,
  CompanyData,
  NewsArticleData,
  VacancyData,
  StatsSectionData,
  RelatedContentData,
  PortableTextBlock,
  ProcessStepsSectionData,
  RecruiterPanelSectionData,
  ApplyPanelData,
} from "../types";
import type { CollectionContentSource, CollectionItem } from "@/page-config/collection-source";
import {
  mapCompanyToPageData,
  mapNewsArticleToPageData,
  mapVacancyToPageData,
} from "../mappers/entity-page-assemblers";

// ── Portable Text helper ──────────────────────────────────────────────────────
// Wraps a plain string into a single-paragraph Portable Text array so inline
// mock content stays readable without repeating the full block schema.

let _ptKey = 0;
function pt(text: string): PortableTextBlock[] {
  const k = ++_ptKey;
  return [
    {
      _type:    "block",
      _key:     `blk${k}`,
      style:    "normal",
      children: [{ _type: "span", _key: `sp${k}`, text, marks: [] }],
      markDefs: [],
    } as unknown as PortableTextBlock,
  ];
}

// ── Hero variants ─────────────────────────────────────────────────────────────

const HERO_VARIANTS: Record<string, HeroBlockData> = {
  /**
   * hero_google_problem
   * Audience: searchers who typed a problem into Google.
   * Framing:  Urgency. Name the pain before offering the solution.
   */
  hero_google_problem: {
    id: "hero_google_problem",
    tag: "Stop sending every visitor to the same page",
    title: "Your website speaks to no one.\nFix that in minutes.",
    subtitle:
      "Most visitors leave because your homepage wasn't written for them. Mister Chameleon detects where they came from and instantly serves the version of your site that converts.",
    ctas: [
      { label: "See how it works", href: "#how-it-works" },
      { label: "Book a demo",      href: "#demo",         variant: "secondary" as const },
    ],
  },

  /**
   * hero_linkedin_vision
   * Audience: professionals scrolling a thought-leadership feed.
   * Framing:  Vision. Speak to where the industry is going, not the pain.
   */
  hero_linkedin_vision: {
    id: "hero_linkedin_vision",
    tag: "The future of websites is contextual",
    title: "Your website,\never-adapting.",
    subtitle:
      "Mister Chameleon is the platform for growth teams who believe personalisation shouldn't require an engineering sprint, a data science team, or a six-figure enterprise contract.",
    ctas: [
      { label: "Explore the platform", href: "#platform" },
    ],
  },

  /**
   * hero_direct_brand
   * Audience: typed URL, bookmark, or dark social — intent unknown.
   * Framing:  Brand clarity. Lead with the core value proposition.
   * Layout:   hero_background — full-viewport backdrop, content centred.
   * Media:    YouTube video ioblgpA5eTo.
   */
  hero_direct_brand: {
    id:            "hero_direct_brand",
    layoutVariant: "hero_background",
    contentAlign:  "center" as const,
    tag:           "Adaptive websites, without the complexity",
    title:         "Your website, tailored\nto every visitor.",
    subtitle:
      "Mister Chameleon delivers the right message to the right person — automatically. No A/B testing required. No engineering sprints. No excuses.",
    ctas: [
      { label: "Start for free",   href: "#signup" },
      { label: "Watch the demo",   href: "#demo",  variant: "secondary" as const },
    ],
    media: {
      kind:  "video" as const,
      video: { source: "youtube" as const, videoId: "ioblgpA5eTo" },
    },
  },
};

// ── Proof variants ────────────────────────────────────────────────────────────

const PROOF_VARIANTS: Record<string, ProofBlockData> = {
  /**
   * proof_cases
   * Audience: problem-aware searchers who need ROI evidence.
   * Framing:  Hard numbers and time-to-value.
   */
  proof_cases: {
    id: "proof_cases",
    title: "Conversion lifts that speak for themselves",
    items: [
      {
        title: "3.2× more qualified leads",
        text: "SaaS teams using Mister Chameleon see an average 3.2× lift in demo requests within 30 days of going live — no engineering changes required.",
      },
      {
        title: "First experience live in < 5 minutes",
        text: "Connect your domain, define two rules, and your first adaptive experience is live. Most teams are shipping within a single afternoon.",
      },
      {
        title: "12 visitor signals, evaluated in real time",
        text: "Source, device, campaign, recency, and more — every visit triggers a silent evaluation so the right experience loads before the page paints.",
      },
    ],
  },

  /**
   * proof_vision
   * Audience: LinkedIn visitors in thought-leadership mode.
   * Framing:  Industry recognition and forward-looking positioning.
   */
  proof_vision: {
    id: "proof_vision",
    title: "What the industry is saying",
    items: [
      {
        title: "Recognised by Product Hunt",
        text: "#1 Product of the Day — 'Mister Chameleon is what adaptive marketing infrastructure should look like. Finally, personalisation without the platform tax.'",
      },
      {
        title: "Built for the next decade of growth",
        text: "Purpose-built for the era when every visitor expects a tailored experience, but engineering bandwidth is the scarcest resource on the team.",
      },
      {
        title: "Zero-engineer personalisation — at scale",
        text: "The only platform that brings decision-engine-grade adaptivity to marketing and product teams who don't have a machine learning department.",
      },
    ],
  },

  /**
   * proof_platform
   * Audience: direct/brand visitors — evaluating the platform itself.
   * Framing:  Technical credibility and reliability.
   */
  proof_platform: {
    id: "proof_platform",
    title: "Infrastructure you can trust",
    items: [
      {
        title: "Edge-native decision engine",
        text: "Context detection and experience resolution happen at the CDN edge — sub-5ms latency with no origin round-trip, regardless of visitor location.",
      },
      {
        title: "99.99% uptime SLA",
        text: "Deployed across a global active-active edge network with automatic failover, zero-downtime deployments, and a public status page.",
      },
      {
        title: "GDPR & CCPA compliant by default",
        text: "No PII is collected or stored. Every signal is evaluated ephemerally, in memory, in real time. Your visitors' privacy is preserved automatically.",
      },
    ],
  },
};

// ── CTA variants ──────────────────────────────────────────────────────────────

const CTA_VARIANTS: Record<string, CTABlockData> = {
  /**
   * cta_guide
   * Audience: Google visitors not yet ready to sign up.
   * Framing:  Low-friction nurture. Give before asking.
   */
  cta_guide: {
    id: "cta_guide",
    title: "Get the Adaptive Website Playbook",
    text: "A practical, no-fluff guide to personalising your homepage for your three highest-value traffic sources. Free. No email gate.",
    cta: {
      label: "Download the playbook",
      href: "#playbook",
    },
  },

  /**
   * cta_platform
   * Audience: LinkedIn visitors in product-evaluation mode.
   * Framing:  Product-led. Remove the barrier to starting.
   */
  cta_platform: {
    id: "cta_platform",
    title: "Start building for free",
    text: "Your first adaptive experience is free, forever. No credit card, no sales call, no six-month onboarding. Just connect, configure, and ship.",
    cta: {
      label: "Create your free account",
      href: "#signup",
    },
  },

  /**
   * cta_meeting
   * Audience: direct/brand visitors — likely evaluation or awareness stage.
   * Framing:  Sales-led. A concrete, low-commitment next step.
   */
  cta_meeting: {
    id: "cta_meeting",
    title: "See Mister Chameleon in action",
    text: "Book a 20-minute live demo. We'll show you exactly how your homepage would look to your three most important visitor segments.",
    cta: {
      label: "Book a demo",
      href: "#demo",
    },
  },
};

// ── WorkEngine entity data ────────────────────────────────────────────────────

const WORKENGINE_COMPANIES: CompanyData[] = [
  {
    id:          "acme-corp",
    name:        "Acme Corp",
    slug:        "acme-corp",
    logo:        { url: "/logos/acme.svg", alt: "Acme Corp logo" },
    description:
      "Acme Corp is a global manufacturing leader headquartered in Amsterdam, " +
      "scaling its engineering and operations division across Europe. " +
      "With over 4,000 employees in 12 countries, Acme partners with WorkEngine " +
      "to attract top technical talent at scale.",
    services:    ["Precision Manufacturing", "Industrial Engineering", "Supply Chain", "Quality Assurance"],
    branches: [
      { _key: "acme-b1", name: "Amsterdam HQ",  city: "Amsterdam",  address: "Keizersgracht 123" },
      { _key: "acme-b2", name: "Berlin Office", city: "Berlin",     address: "Unter den Linden 45" },
      { _key: "acme-b3", name: "London Office", city: "London",     address: "Canary Wharf, E14" },
    ],
    stats: [
      { _key: "acme-s1", label: "Founded",    value: "1998" },
      { _key: "acme-s2", label: "Employees",  value: "4,200+" },
      { _key: "acme-s3", label: "Countries",  value: "12" },
      { _key: "acme-s4", label: "Open roles", value: "38" },
    ],
    isPublished: true,
  },
  {
    id:          "beacon-group",
    name:        "Beacon Group",
    slug:        "beacon-group",
    logo:        { url: "/logos/beacon.svg", alt: "Beacon Group logo" },
    description:
      "Beacon Group is a mid-market professional services firm specialising in " +
      "strategy, finance, and technology advisory. We are expanding our consulting " +
      "and analyst teams across the Benelux and DACH regions, using WorkEngine to " +
      "identify and attract exceptional talent faster.",
    services:    ["Strategy Consulting", "Financial Advisory", "Technology Consulting", "Change Management"],
    branches: [
      { _key: "beacon-b1", name: "Rotterdam HQ",   city: "Rotterdam",  address: "Weena 505" },
      { _key: "beacon-b2", name: "Frankfurt Office", city: "Frankfurt", address: "Mainzer Landstraße 50" },
    ],
    stats: [
      { _key: "beacon-s1", label: "Founded",    value: "2007" },
      { _key: "beacon-s2", label: "Employees",  value: "850" },
      { _key: "beacon-s3", label: "Countries",  value: "5" },
      { _key: "beacon-s4", label: "Open roles", value: "14" },
    ],
    isPublished: true,
  },
  {
    id:          "meridian-labs",
    name:        "Meridian Labs",
    slug:        "meridian-labs",
    logo:        { url: "/logos/meridian.svg", alt: "Meridian Labs logo" },
    description:
      "Meridian Labs is a fast-growing life-science startup developing next-generation " +
      "diagnostics and clinical research tools. We hire across clinical research, " +
      "regulatory affairs, and bioinformatics — partnering with WorkEngine to move " +
      "quickly on critical specialist roles.",
    services:    ["Clinical Research", "Regulatory Affairs", "Bioinformatics", "Medical Devices"],
    branches: [
      { _key: "meridian-b1", name: "Utrecht HQ",   city: "Utrecht", address: "Heidelberglaan 2" },
      { _key: "meridian-b2", name: "Basel Office", city: "Basel",   address: "Grenzacherstrasse 124" },
    ],
    stats: [
      { _key: "meridian-s1", label: "Founded",    value: "2016" },
      { _key: "meridian-s2", label: "Employees",  value: "290" },
      { _key: "meridian-s3", label: "Countries",  value: "3" },
      { _key: "meridian-s4", label: "Open roles", value: "22" },
    ],
    isPublished: true,
  },
];

const WORKENGINE_NEWS_ARTICLES: NewsArticleData[] = [
  {
    id:          "ai-matching-bias-reduction",
    title:       "How AI matching reduces bias in early-stage screening",
    slug:        "ai-matching-bias-reduction",
    publishedAt: "2025-11-12",
    excerpt:
      "Structured scoring replaces gut-feel shortlisting and measurably increases diverse hire rates.",
    coverImage:  { url: "/images/news-ai-matching.jpg", alt: "AI matching illustration" },
    tags:        ["AI & Matching", "Diversity"],
    body: [
      {
        _type: "block", _key: "ai-p1", style: "normal",
        children: [{ _type: "span", _key: "ai-s1", text: "Early-stage screening is where unconscious bias does its most damage. When a recruiter reviews 200 CVs in an afternoon, pattern-matching against familiar signals — prestigious universities, well-known employers — is almost inevitable. AI-assisted matching changes this dynamic fundamentally." }],
      },
      {
        _type: "block", _key: "ai-p2", style: "h2",
        children: [{ _type: "span", _key: "ai-s2", text: "From gut feel to structured scoring" }],
      },
      {
        _type: "block", _key: "ai-p3", style: "normal",
        children: [{ _type: "span", _key: "ai-s3", text: "WorkEngine's matching engine evaluates every applicant against a structured competency model derived from the vacancy specification. Scores are calculated across skills overlap, experience trajectory, and role-specific indicators — not demographic proxies. Recruiters see ranked shortlists, not raw stacks." }],
      },
      {
        _type: "block", _key: "ai-p4", style: "normal",
        children: [{ _type: "span", _key: "ai-s4", text: "Clients running WorkEngine for 90 days report a 23% average increase in shortlist diversity and a 31% reduction in time-to-first-interview. The data is early, but the direction is consistent: structured scoring surfaces candidates that gut-feel screening misses." }],
      },
    ] as PortableTextBlock[],
    isPublished: true,
  },
  {
    id:          "vacancy-workflow-mistakes",
    title:       "5 vacancy workflow mistakes slowing your team down",
    slug:        "vacancy-workflow-mistakes",
    publishedAt: "2025-10-28",
    excerpt:
      "Simple process fixes that save 3–5 hours per open role per week.",
    coverImage:  { url: "/images/news-workflow.jpg", alt: "Workflow process diagram" },
    tags:        ["Best Practices", "Productivity"],
    body: [
      {
        _type: "block", _key: "wf-p1", style: "normal",
        children: [{ _type: "span", _key: "wf-s1", text: "Most recruitment teams don't have a capacity problem — they have a process problem. The same five workflow mistakes appear in almost every agency and in-house team we audit. Here's how to fix them." }],
      },
      {
        _type: "block", _key: "wf-p2", style: "h2",
        children: [{ _type: "span", _key: "wf-s2", text: "1. Approval loops with no deadline" }],
      },
      {
        _type: "block", _key: "wf-p3", style: "normal",
        children: [{ _type: "span", _key: "wf-s3", text: "When hiring managers can review shortlists at their convenience, 'convenience' becomes 'never'. Set a 48-hour review window with an automated reminder at 24 hours. In WorkEngine, deadline-driven approval stages are built into the vacancy board." }],
      },
      {
        _type: "block", _key: "wf-p4", style: "h2",
        children: [{ _type: "span", _key: "wf-s4", text: "2. Unstructured intake meetings" }],
      },
      {
        _type: "block", _key: "wf-p5", style: "normal",
        children: [{ _type: "span", _key: "wf-s5", text: "A 60-minute intake conversation with no template produces a brief that the recruiter immediately starts re-interpreting. Use a structured intake form — must-haves, nice-to-haves, disqualifiers — and get sign-off before sourcing starts." }],
      },
    ] as PortableTextBlock[],
    isPublished: true,
  },
  {
    id:          "q3-product-update",
    title:       "WorkEngine Q3 Product Update: Client Portal 2.0",
    slug:        "q3-product-update",
    publishedAt: "2025-10-03",
    excerpt:
      "New interview scheduling, offer tracking, and API webhooks now live for all plans.",
    coverImage:  { url: "/images/news-product.jpg", alt: "WorkEngine product dashboard" },
    tags:        ["Product"],
    body: [
      {
        _type: "block", _key: "q3-p1", style: "normal",
        children: [{ _type: "span", _key: "q3-s1", text: "This quarter's release centres on Client Portal 2.0 — a significant upgrade to the hiring manager experience. Here's what's new." }],
      },
      {
        _type: "block", _key: "q3-p2", style: "h2",
        children: [{ _type: "span", _key: "q3-s2", text: "Integrated interview scheduling" }],
      },
      {
        _type: "block", _key: "q3-p3", style: "normal",
        children: [{ _type: "span", _key: "q3-s3", text: "Hiring managers can now propose interview slots directly from the candidate card. Candidates receive a branded scheduling link and confirm their slot — no back-and-forth emails, no calendar conflicts." }],
      },
      {
        _type: "block", _key: "q3-p4", style: "h2",
        children: [{ _type: "span", _key: "q3-s4", text: "Offer tracking and e-signature" }],
      },
      {
        _type: "block", _key: "q3-p5", style: "normal",
        children: [{ _type: "span", _key: "q3-s5", text: "Track every offer from issued to accepted in real time. The new e-signature integration means offer letters are signed and filed without leaving the platform. Webhook events fire on every status change — your HR system stays in sync automatically." }],
      },
    ] as PortableTextBlock[],
    isPublished: true,
  },
  {
    id:          "2025-benchmarks-report",
    title:       "The 2025 Recruitment Benchmarks Report",
    slug:        "2025-benchmarks-report",
    publishedAt: "2025-09-15",
    excerpt:
      "Time-to-fill, offer acceptance rates, and source quality across 500 European employers.",
    coverImage:  { url: "/images/news-benchmarks.jpg", alt: "Recruitment benchmark data" },
    tags:        ["Research", "Data"],
    body: [
      {
        _type: "block", _key: "bm-p1", style: "normal",
        children: [{ _type: "span", _key: "bm-s1", text: "For the second consecutive year, WorkEngine surveyed 500 European employers on their recruitment performance. The findings reveal widening gaps between top-quartile teams and the median — and a clear pattern in what separates them." }],
      },
      {
        _type: "block", _key: "bm-p2", style: "h2",
        children: [{ _type: "span", _key: "bm-s2", text: "Key findings" }],
      },
      {
        _type: "block", _key: "bm-p3", style: "normal",
        children: [{ _type: "span", _key: "bm-s3", text: "Median time-to-fill across all sectors is 34 days — unchanged from 2024. Top-quartile teams fill in 18 days on average, enabled by structured intake, parallel sourcing, and time-boxed approval stages. Offer acceptance rates remain strong at 74%, though this masks significant variation by industry and seniority level." }],
      },
      {
        _type: "block", _key: "bm-p4", style: "normal",
        children: [{ _type: "span", _key: "bm-s4", text: "Source quality continues to shift: employee referrals and direct applications outperform job board traffic on conversion rate, but job boards remain the highest-volume channel. Teams that combine structured ATS data with AI-assisted source attribution are the first to identify these patterns and reallocate budget accordingly." }],
      },
    ] as PortableTextBlock[],
    isPublished: true,
  },
];

// ── Detail page builders ──────────────────────────────────────────────────────
//
// These functions extend the base PageData produced by entity assemblers with
// additional blocks (stats, relatedContent) that contextualise the entity
// within the WorkEngine platform.

function buildCompanyDetailPage(company: CompanyData): PageData {
  const base = mapCompanyToPageData(company);

  const extraSections: PageSectionData[] = [];

  // Stats strip — company metrics
  if (company.stats && company.stats.length > 0) {
    const statsSection: StatsSectionData = {
      _key:    `${company.id}-stats`,
      _type:   "stats",
      variant: "compact",
      heading: "At a glance",
      items:   company.stats.map((s) => ({
        _key:  s._key,
        label: s.label,
        value: s.value,
      })),
    };
    extraSections.push(statsSection);
  }

  // Related news — articles linked to this company
  const relatedArticles = WORKENGINE_NEWS_ARTICLES.filter(
    (a) => a.relatedCompany?.slug === company.slug || a.isPublished,
  ).slice(0, 3);

  if (relatedArticles.length > 0) {
    const relatedSection: RelatedContentData = {
      _key:     `${company.id}-related`,
      _type:    "relatedContent",
      heading:  "Latest insights",
      maxItems: 3,
      items:    relatedArticles.map((a) => ({
        _key:     `${company.id}-rel-${a.id}`,
        id:       a.id,
        title:    a.title,
        href:     `/news/${a.slug}`,
        excerpt:  a.excerpt,
        imageUrl: a.coverImage?.url,
        imageAlt: a.coverImage?.alt,
        category: a.tags?.[0],
        date:     a.publishedAt,
      })),
    };
    extraSections.push(relatedSection);
  }

  return {
    ...base,
    sections: [...base.sections, ...extraSections],
  };
}

function buildNewsDetailPage(article: NewsArticleData): PageData {
  const base = mapNewsArticleToPageData(article);

  // Related articles — all others except this one
  const relatedArticles = WORKENGINE_NEWS_ARTICLES.filter(
    (a) => a.slug !== article.slug && a.isPublished,
  ).slice(0, 3);

  const extraSections: PageSectionData[] = [];

  if (relatedArticles.length > 0) {
    const relatedSection: RelatedContentData = {
      _key:     `${article.id}-related`,
      _type:    "relatedContent",
      heading:  "More insights",
      maxItems: 3,
      items:    relatedArticles.map((a) => ({
        _key:     `${article.id}-rel-${a.id}`,
        id:       a.id,
        title:    a.title,
        href:     `/news/${a.slug}`,
        excerpt:  a.excerpt,
        imageUrl: a.coverImage?.url,
        imageAlt: a.coverImage?.alt,
        category: a.tags?.[0],
        date:     a.publishedAt,
      })),
    };
    extraSections.push(relatedSection);
  }

  return {
    ...base,
    sections: [...base.sections, ...extraSections],
  };
}

// ── Listing page data ─────────────────────────────────────────────────────────

const WORKENGINE_COMPANIES_PAGE: PageData = {
  id:          "companies-listing",
  title:       "Companies — WorkEngine",
  slug:        "companies",
  seoTitle:    "Companies Hiring with WorkEngine",
  seoDescription:
    "Browse companies growing their teams with WorkEngine. " +
    "Find your next employer across manufacturing, consulting, life sciences, and more.",
  templateKey: "listing-page",
  sections: [
    {
      _key:               "co-filter",
      _type:              "filterBar",
      placeholder:        "Search companies…",
      showSearch:         true,
      showCategoryFilter: true,
      categories: [
        { _key: "co-cat-all", label: "All industries",  value: "" },
        { _key: "co-cat-mfg", label: "Manufacturing",   value: "Manufacturing" },
        { _key: "co-cat-con", label: "Consulting",       value: "Consulting" },
        { _key: "co-cat-ls",  label: "Life Sciences",    value: "Life Sciences" },
      ],
    },
    {
      _key:     "co-listing",
      _type:    "listing",
      variant:  "grid",
      heading:  "Companies hiring with WorkEngine",
      items:    WORKENGINE_COMPANIES.map((c) => ({
        _key:     `co-item-${c.id}`,
        id:       c.id,
        title:    c.name,
        href:     `/companies/${c.slug}`,
        excerpt:  c.description,
        imageUrl: c.logo?.url,
        imageAlt: c.logo?.alt,
        category: c.services?.[0],
        meta:     c.stats?.slice(0, 2).map((s) => ({ label: s.label, value: s.value })),
      })),
    },
  ],
};

const WORKENGINE_NEWS_PAGE: PageData = {
  id:          "news-listing",
  title:       "Insights — WorkEngine",
  slug:        "news",
  seoTitle:    "Recruitment Insights — WorkEngine",
  seoDescription:
    "Practical articles on recruitment, AI matching, workforce trends, " +
    "and platform updates from the WorkEngine team.",
  templateKey: "listing-page",
  sections: [
    {
      _key:               "news-filter",
      _type:              "filterBar",
      placeholder:        "Search articles…",
      showSearch:         true,
      showCategoryFilter: true,
      categories: [
        { _key: "news-cat-all", label: "All topics",     value: "" },
        { _key: "news-cat-ai",  label: "AI & Matching",  value: "AI & Matching" },
        { _key: "news-cat-bp",  label: "Best Practices", value: "Best Practices" },
        { _key: "news-cat-pr",  label: "Product",        value: "Product" },
        { _key: "news-cat-re",  label: "Research",       value: "Research" },
      ],
    },
    {
      _key:    "news-listing",
      _type:   "listing",
      variant: "grid",
      heading: "Insights from WorkEngine",
      items:   WORKENGINE_NEWS_ARTICLES.map((a) => ({
        _key:     `news-item-${a.id}`,
        id:       a.id,
        title:    a.title,
        href:     `/news/${a.slug}`,
        excerpt:  a.excerpt,
        imageUrl: a.coverImage?.url,
        imageAlt: a.coverImage?.alt,
        category: a.tags?.[0],
        date:     a.publishedAt,
      })),
    },
  ],
};

// ── Vacancy data ──────────────────────────────────────────────────────────────

const WORKENGINE_VACANCIES: VacancyData[] = [
  {
    id:           "senior-frontend-engineer",
    title:        "Senior Frontend Engineer",
    slug:         "senior-frontend-engineer",
    company:      { id: "acme-corp",    name: "Acme Corp",    slug: "acme-corp"    },
    location:     "Amsterdam",
    remote:       "hybrid",
    contractType: "full-time",
    department:   "Engineering",
    hoursPerWeek: "32–40 uur",
    salaryRange:  "€ 5 000 – € 6 500 / maand",
    startDate:    "2026-04-01",
    closingDate:  "2026-03-28",
    description: [
      {
        _type: "block", _key: "sfe-p1", style: "normal",
        children: [{ _type: "span", _key: "sfe-s1", text: "Acme Corp is looking for an experienced Senior Frontend Engineer to join their growing engineering division in Amsterdam. You will lead the development of their internal supply chain dashboard and help shape frontend architecture decisions across the team." }],
      },
      {
        _type: "block", _key: "sfe-p2", style: "h2",
        children: [{ _type: "span", _key: "sfe-s2", text: "What you'll do" }],
      },
      {
        _type: "block", _key: "sfe-p3", style: "normal",
        children: [{ _type: "span", _key: "sfe-s3", text: "You'll own the frontend development of a complex, data-heavy React application used daily by logistics and operations teams. Working closely with a product manager and two other engineers, you'll translate requirements into clean, accessible interfaces and contribute to shared component libraries." }],
      },
    ] as PortableTextBlock[],
    requirements: [
      "5+ years of commercial experience with React (or equivalent)",
      "Strong TypeScript skills and appreciation of type safety",
      "Experience with data visualisation libraries (Recharts, D3, or similar)",
      "Familiarity with CI/CD pipelines and pull-request-based workflows",
      "Excellent written and spoken English; Dutch is a bonus",
    ],
    processSteps: [
      { _key: "sfe-step-1", title: "Application review",   description: "We read every application carefully and will respond within 3 business days.",   },
      { _key: "sfe-step-2", title: "Introductory call",    description: "A 30-minute video call with a recruiter to discuss your background and the role.", },
      { _key: "sfe-step-3", title: "Technical interview",  description: "A 90-minute technical session with two engineers — we focus on problem-solving, not puzzles.", },
      { _key: "sfe-step-4", title: "Final interview",      description: "Meet the team lead and product manager for a culture and vision conversation.", },
      { _key: "sfe-step-5", title: "Offer & onboarding",   description: "We move quickly — expect an offer within one week of the final interview.", },
    ],
    recruiter: {
      name:   "Sophie van der Berg",
      role:   "Technical Recruiter",
      email:  "sophie@workengine.io",
      phone:  "+31 6 12 34 56 78",
      avatar: { url: "/avatars/sophie.jpg", alt: "Sophie van der Berg" },
    },
    isPublished: true,
  },
  {
    id:           "product-manager-marketplace",
    title:        "Product Manager — Marketplace",
    slug:         "product-manager-marketplace",
    company:      { id: "beacon-group", name: "Beacon Group", slug: "beacon-group" },
    location:     "Rotterdam",
    remote:       "hybrid",
    contractType: "full-time",
    department:   "Product",
    hoursPerWeek: "40 uur",
    salaryRange:  "€ 4 800 – € 6 000 / maand",
    startDate:    "2026-05-01",
    closingDate:  "2026-04-10",
    description: [
      {
        _type: "block", _key: "pm-p1", style: "normal",
        children: [{ _type: "span", _key: "pm-s1", text: "Beacon Group is seeking a Product Manager to take ownership of the company's B2B marketplace product. You'll work at the intersection of growth, operations, and technology to deliver features that delight both buyers and sellers on the platform." }],
      },
      {
        _type: "block", _key: "pm-p2", style: "h2",
        children: [{ _type: "span", _key: "pm-s2", text: "The role" }],
      },
      {
        _type: "block", _key: "pm-p3", style: "normal",
        children: [{ _type: "span", _key: "pm-s3", text: "Reporting to the Head of Product, you'll own the roadmap for the marketplace layer of the platform — from discovery and pricing features to search relevance and fulfilment flows. You'll collaborate daily with design, engineering, and commercial stakeholders." }],
      },
    ] as PortableTextBlock[],
    requirements: [
      "3+ years of product management experience in a marketplace or platform environment",
      "Strong analytical skills — comfortable with SQL and event-based analytics",
      "Experience facilitating user research and translating insights into requirements",
      "Fluent in English; Dutch an advantage",
    ],
    processSteps: [
      { _key: "pm-step-1", title: "CV screening",        description: "Initial review by the recruiter — we aim to respond within 2 business days.", },
      { _key: "pm-step-2", title: "Recruiter call",      description: "30-minute intro call to align on role, expectations, and your career goals.", },
      { _key: "pm-step-3", title: "Case study",          description: "A take-home case study (approximately 2 hours) focused on a product scenario.", },
      { _key: "pm-step-4", title: "Stakeholder panel",   description: "Present your case study to the Head of Product and two cross-functional leads.", },
      { _key: "pm-step-5", title: "Offer",               description: "Decision within 5 business days of the panel interview.", },
    ],
    recruiter: {
      name:   "Liam de Vries",
      role:   "Senior Recruiter",
      email:  "liam@workengine.io",
      phone:  "+31 6 98 76 54 32",
      avatar: { url: "/avatars/liam.jpg", alt: "Liam de Vries" },
    },
    isPublished: true,
  },
  {
    id:           "clinical-research-associate",
    title:        "Clinical Research Associate",
    slug:         "clinical-research-associate",
    company:      { id: "meridian-labs", name: "Meridian Labs", slug: "meridian-labs" },
    location:     "Utrecht",
    remote:       "on-site",
    contractType: "full-time",
    department:   "Clinical Research",
    hoursPerWeek: "40 uur",
    salaryRange:  "€ 3 800 – € 4 800 / maand",
    startDate:    "2026-06-01",
    closingDate:  "2026-04-30",
    description: [
      {
        _type: "block", _key: "cra-p1", style: "normal",
        children: [{ _type: "span", _key: "cra-s1", text: "Meridian Labs is looking for a Clinical Research Associate (CRA) to support ongoing Phase II and III clinical trials across European study sites. You'll ensure protocol compliance, data quality, and site readiness as the company advances its regulatory pipeline." }],
      },
      {
        _type: "block", _key: "cra-p2", style: "h2",
        children: [{ _type: "span", _key: "cra-s2", text: "Your responsibilities" }],
      },
      {
        _type: "block", _key: "cra-p3", style: "normal",
        children: [{ _type: "span", _key: "cra-s3", text: "You will conduct routine and for-cause monitoring visits at investigator sites across the Netherlands and Belgium, verify data against source documents, and act as the primary point of contact between the sponsor and site personnel. Regular reporting to the Clinical Project Manager is expected." }],
      },
    ] as PortableTextBlock[],
    requirements: [
      "BSc or MSc in life sciences, pharmacology, or a related field",
      "Minimum 1 year of CRA experience (ICH-GCP certified)",
      "Experience with EDC systems (Medidata Rave or similar)",
      "Willingness to travel to study sites (up to 40%)",
      "Fluent in English; Dutch or French an advantage",
    ],
    processSteps: [
      { _key: "cra-step-1", title: "Application review",   description: "Applications reviewed within 5 business days.", },
      { _key: "cra-step-2", title: "Phone screening",      description: "20-minute screening call with HR to confirm basic requirements.", },
      { _key: "cra-step-3", title: "Technical interview",  description: "60-minute interview with the Clinical Project Manager — GCP knowledge and monitoring experience assessed.", },
      { _key: "cra-step-4", title: "Offer",                description: "Successful candidates receive an offer within 1 week of the technical interview.", },
    ],
    recruiter: {
      name:   "Anna Klaassen",
      role:   "Life Sciences Recruiter",
      email:  "anna@workengine.io",
      phone:  "+31 6 55 44 33 22",
      avatar: { url: "/avatars/anna.jpg", alt: "Anna Klaassen" },
    },
    isPublished: true,
  },
];

// ── Vacancy detail page builder ────────────────────────────────────────────────

function buildVacancyDetailPage(vacancy: VacancyData): PageData {
  const base = mapVacancyToPageData(vacancy);

  const extraSections: PageSectionData[] = [];

  // Process steps — application / hiring process
  if (vacancy.processSteps && vacancy.processSteps.length > 0) {
    const processSection: ProcessStepsSectionData = {
      _key:    `${vacancy.id}-process`,
      _type:   "processSteps",
      variant: "default",
      heading: "Our hiring process",
      steps:   vacancy.processSteps.map((s) => ({
        _key:        s._key,
        title:       s.title,
        description: s.description,
      })),
    };
    extraSections.push(processSection);
  }

  // Recruiter panel — the human contact for this vacancy
  if (vacancy.recruiter) {
    const recruiterSection: RecruiterPanelSectionData = {
      _key:      `${vacancy.id}-recruiter`,
      _type:     "recruiterPanel",
      variant:   "default",
      heading:   "Meet your recruiter",
      name:      vacancy.recruiter.name,
      role:      vacancy.recruiter.role,
      email:     vacancy.recruiter.email,
      phone:     vacancy.recruiter.phone,
      avatarUrl: vacancy.recruiter.avatar?.url,
      ctaLabel:  "Send a message",
      ctaHref:   vacancy.recruiter.email
        ? `mailto:${vacancy.recruiter.email}`
        : undefined,
    };
    extraSections.push(recruiterSection);
  }

  // Apply panel — application CTA anchored to the platform application form
  const applySection: ApplyPanelData = {
    _key:     `${vacancy.id}-apply`,
    _type:    "applyPanel",
    variant:  "default",
    heading:  "Ready to apply?",
    body:     "Submit your application below and we'll be in touch within 3 business days.",
    primaryCta:   { label: "Apply now", href: `#apply-form` },
    secondaryCta: { label: "Save for later", href: `#` },
    formKey:      "application",
    closingDate:  vacancy.closingDate,
  };
  extraSections.push(applySection);

  return {
    ...base,
    sections: [...base.sections, ...extraSections],
  };
}

// ── Careers listing page ───────────────────────────────────────────────────────

const WORKENGINE_CAREERS_PAGE: PageData = {
  id:          "careers-listing",
  title:       "Careers — WorkEngine",
  slug:        "careers",
  seoTitle:    "Open Vacancies — WorkEngine",
  seoDescription:
    "Browse open roles at WorkEngine partner companies. " +
    "Engineering, product, clinical, and consulting positions across Europe.",
  templateKey: "listing-page",
  sections: [
    // Filter bar
    {
      _key:               "careers-filter",
      _type:              "filterBar",
      placeholder:        "Search vacancies…",
      showSearch:         true,
      showCategoryFilter: true,
      categories: [
        { _key: "careers-cat-all",  label: "All departments",   value: "" },
        { _key: "careers-cat-eng",  label: "Engineering",       value: "Engineering" },
        { _key: "careers-cat-prod", label: "Product",           value: "Product" },
        { _key: "careers-cat-clin", label: "Clinical Research", value: "Clinical Research" },
      ],
      tags: [
        { _key: "careers-tag-remote",  label: "Remote",  value: "remote"  },
        { _key: "careers-tag-hybrid",  label: "Hybrid",  value: "hybrid"  },
        { _key: "careers-tag-onsite",  label: "On-site", value: "on-site" },
      ],
      showTagFilter: true,
    },
    // Vacancy listing — one card per vacancy
    {
      _key:     "careers-listing",
      _type:    "listing",
      variant:  "list",
      heading:  "Open positions",
      items:    WORKENGINE_VACANCIES.filter((v) => v.isPublished).map((v) => ({
        _key:     `vac-item-${v.id}`,
        id:       v.id,
        title:    v.title,
        href:     `/careers/${v.slug}`,
        excerpt:  v.description?.[0]?.children?.[0]?.text?.slice(0, 160) ?? "",
        category: v.department,
        tags:     [v.remote ?? "", v.location ?? ""].filter(Boolean),
        meta: [
          ...(v.company ? [{ label: "Company",      value: v.company.name      }] : []),
          ...(v.location ? [{ label: "Location",    value: v.location          }] : []),
          ...(v.contractType ? [{ label: "Contract", value: v.contractType      }] : []),
          ...(v.salaryRange ? [{ label: "Salary",   value: v.salaryRange       }] : []),
        ],
      })),
    },
    // Team / recruiter intro — about block with team-grid variant
    {
      _key:     "careers-team",
      _type:    "about",
      variant:  "team-grid",
      heading:  "Our recruitment team",
      body: [
        {
          _type: "block", _key: "ct-p1", style: "normal",
          children: [{ _type: "span", _key: "ct-s1", text: "Our team of specialist recruiters works across engineering, product, clinical, and consulting disciplines. We bring deep sector knowledge and a genuine commitment to finding the right fit — for both candidates and employers." }],
        },
      ] as PortableTextBlock[],
      teamMembers: [
        { _key: "tm-sophie", name: "Sophie van der Berg", role: "Technical Recruiter",    bio: "Specialist in software engineering and product roles across the Netherlands.", imageUrl: "/avatars/sophie.jpg" },
        { _key: "tm-liam",   name: "Liam de Vries",       role: "Senior Recruiter",       bio: "Focused on product, strategy, and commercial leadership positions.",          imageUrl: "/avatars/liam.jpg"   },
        { _key: "tm-anna",   name: "Anna Klaassen",        role: "Life Sciences Recruiter", bio: "15 years placing clinical research and regulatory affairs professionals.",     imageUrl: "/avatars/anna.jpg"   },
      ],
    },
    // FAQ
    {
      _key:     "careers-faq",
      _type:    "faqSection",
      variant:  "default",
      heading:  "Frequently asked questions",
      items: [
        { question: "How long does the application process take?",      answer: "Typically 2–4 weeks from application to offer, depending on the role and company. Your recruiter will keep you informed at every stage." },
        { question: "Can I apply for multiple roles at once?",          answer: "Yes — you can apply for as many roles as you are genuinely interested in. We recommend tailoring your application for each position." },
        { question: "Do you place candidates outside the Netherlands?", answer: "Primarily the Netherlands and Belgium, with some roles in Germany and the UK. Each vacancy indicates the location and remote policy." },
        { question: "Is there a fee for candidates?",                   answer: "Never. WorkEngine is entirely free for job seekers. Our fees are always paid by the hiring company." },
        { question: "What happens to my personal data?",                answer: "Your data is processed in line with GDPR. We share your information with hiring companies only with your explicit consent, and you can request deletion at any time." },
      ],
    },
  ],
};

// ── Contact page ──────────────────────────────────────────────────────────────

const WORKENGINE_CONTACT_PAGE: PageData = {
  id:          "contact",
  title:       "Contact — WorkEngine",
  slug:        "contact",
  seoTitle:    "Contact WorkEngine",
  seoDescription:
    "Get in touch with the WorkEngine team. Find the right office, " +
    "recruiter, or support channel for your enquiry.",
  templateKey: "detail-page",
  sections: [
    // Search block — company finder
    {
      _key:            "contact-search",
      _type:           "search",
      title:           "Find a company or recruiter",
      placeholder:     "Search for a company, recruiter, or topic…",
      scopes:          ["pages", "vacancies"],
      showFilters:     true,
      enableInstant:   true,
      maxResults:      8,
      emptyMessage:    "Start typing to search companies, recruiters, and open roles.",
      noResultsMessage:"No results found. Try a different search term.",
    },
    // Filter bar — office / region selector
    {
      _key:               "contact-filter",
      _type:              "filterBar",
      variant:            "compact",
      placeholder:        "Filter by region…",
      showCategoryFilter: true,
      categories: [
        { _key: "cf-all",  label: "All offices",    value: "" },
        { _key: "cf-ams",  label: "Amsterdam",      value: "amsterdam" },
        { _key: "cf-rtm",  label: "Rotterdam",      value: "rotterdam" },
        { _key: "cf-utr",  label: "Utrecht",        value: "utrecht"   },
      ],
    },
    // Address / branch text section
    {
      _key:     "contact-address",
      _type:    "textSection",
      variant:  "default",
      heading:  "Our offices",
      body: [
        {
          _type: "block", _key: "ca-p1", style: "normal",
          children: [{ _type: "span", _key: "ca-s1", text: "WorkEngine operates from three offices across the Netherlands. Our Amsterdam headquarters houses the platform and engineering teams; Rotterdam and Utrecht host our specialist recruitment practices." }],
        },
        {
          _type: "block", _key: "ca-p2", style: "h3",
          children: [{ _type: "span", _key: "ca-s2", text: "Amsterdam (HQ)" }],
        },
        {
          _type: "block", _key: "ca-p3", style: "normal",
          children: [{ _type: "span", _key: "ca-s3", text: "Herengracht 182, 1016 BR Amsterdam · hello@workengine.io · +31 20 123 4567" }],
        },
        {
          _type: "block", _key: "ca-p4", style: "h3",
          children: [{ _type: "span", _key: "ca-s4", text: "Rotterdam" }],
        },
        {
          _type: "block", _key: "ca-p5", style: "normal",
          children: [{ _type: "span", _key: "ca-s5", text: "Coolsingel 40, 3011 AD Rotterdam · rotterdam@workengine.io · +31 10 234 5678" }],
        },
        {
          _type: "block", _key: "ca-p6", style: "h3",
          children: [{ _type: "span", _key: "ca-s6", text: "Utrecht" }],
        },
        {
          _type: "block", _key: "ca-p7", style: "normal",
          children: [{ _type: "span", _key: "ca-s7", text: "Lange Viestraat 2B, 3511 BK Utrecht · utrecht@workengine.io · +31 30 345 6789" }],
        },
      ] as PortableTextBlock[],
    },
    // Contact form
    {
      _key:           "contact-form",
      _type:          "formSection",
      variant:        "card",
      formKey:        "contact",
      title:          "Send us a message",
      intro:          "Not sure who to contact? Fill in the form and we'll route your message to the right person.",
      submitLabel:    "Send message",
      successMessage: "Thanks for reaching out — we'll reply within one business day.",
    },
  ],
};

// ── Join page ─────────────────────────────────────────────────────────────────

const WORKENGINE_JOIN_PAGE: PageData = {
  id:          "join",
  title:       "Join WorkEngine — Grow Your Team Smarter",
  slug:        "join",
  seoTitle:    "Partner with WorkEngine — Smarter Recruitment for Growing Teams",
  seoDescription:
    "Join the WorkEngine network. Whether you're an employer looking to scale " +
    "or a recruiter building your practice, we have the tools and talent to support you.",
  templateKey: "article-page",
  sections: [
    // 1. Benefits grid — employer / recruiter value props
    {
      _key:     "join-benefits",
      _type:    "featureGrid",
      variant:  "cards",
      heading:  "Why partner with WorkEngine?",
      features: [
        { title: "AI-assisted matching",    description: "Our matching engine surfaces the highest-quality candidates for each role, reducing time-to-shortlist by up to 60%.",         icon: "sparkles" },
        { title: "Structured workflows",    description: "From intake to offer, every step is tracked, accountable, and auditable — no more lost emails or missed follow-ups.",         icon: "clipboard-check" },
        { title: "Deep recruiter network",  description: "Access a curated network of specialist recruiters with proven track records in your sector.",                                  icon: "users" },
        { title: "Transparent reporting",  description: "Real-time dashboards give hiring managers full visibility into funnel metrics, source quality, and time-to-fill.",            icon: "chart-bar" },
        { title: "GDPR-compliant by default", description: "Candidate data is processed and stored in line with European data protection regulations. Built-in consent management.", icon: "shield-check" },
        { title: "Fast to get started",    description: "Most clients are live within 48 hours. Our onboarding team walks you through setup and integrates with your existing ATS.",    icon: "rocket-launch" },
      ],
    },
    // 2. Stats strip
    {
      _key:     "join-stats",
      _type:    "stats",
      variant:  "default",
      heading:  "WorkEngine by the numbers",
      items: [
        { _key: "stat-companies",    label: "Partner companies",  value: "120+",   description: "Employers across the Netherlands, Belgium, and beyond." },
        { _key: "stat-placements",   label: "Placements in 2025", value: "1 400+", description: "Successful hires across all sectors and seniority levels." },
        { _key: "stat-ttf",          label: "Avg. time-to-fill",  value: "18 days", description: "vs. sector median of 34 days." },
        { _key: "stat-satisfaction", label: "Hiring manager NPS",  value: "72",     description: "Net Promoter Score — consistently above industry average." },
      ],
    },
    // 3. Process steps — how onboarding works
    {
      _key:     "join-process",
      _type:    "processSteps",
      variant:  "accordion",
      heading:  "How to get started",
      steps: [
        { _key: "jp-step-1", title: "Book a discovery call",    description: "Fill in the form below and one of our account managers will reach out to understand your recruitment needs and answer your questions.", duration: "30 min" },
        { _key: "jp-step-2", title: "Platform setup",           description: "We configure your WorkEngine workspace, connect your ATS (if applicable), and onboard your team — typically within 48 hours.",          duration: "1–2 days" },
        { _key: "jp-step-3", title: "First vacancy briefing",   description: "Your assigned recruiter runs a structured intake session to understand the role, team, and culture before going to market.",             duration: "60 min" },
        { _key: "jp-step-4", title: "Candidate shortlist",      description: "Within 5 business days, you receive a curated shortlist of pre-screened candidates with detailed profiles and match scores.",           duration: "5 days" },
        { _key: "jp-step-5", title: "Interview & offer",        description: "We coordinate interview logistics, collect feedback, and support offer negotiation so you can move fast when you find the right person.", duration: "1–2 weeks" },
      ],
    },
    // 4. Company carousel — partner logos / cards
    {
      _key:         "join-companies",
      _type:        "listing",
      variant:      "compact",
      heading:      "Companies already partnering with us",
      viewAllHref:  "/companies",
      viewAllLabel: "See all companies",
      items: WORKENGINE_COMPANIES.map((c) => ({
        _key:     `join-co-${c.id}`,
        id:       c.id,
        title:    c.name,
        href:     `/companies/${c.slug}`,
        excerpt:  c.description,
        imageUrl: c.logo?.url,
        imageAlt: c.logo?.alt,
        category: c.services?.[0],
      })),
    },
    // 5. Appointment form
    {
      _key:           "join-form",
      _type:          "formSection",
      variant:        "card",
      formKey:        "appointment",
      title:          "Book a discovery call",
      intro:          "Tell us about your recruitment needs and we'll schedule a call within one business day.",
      submitLabel:    "Request a call",
      successMessage: "Thanks! We'll be in touch within one business day to arrange your call.",
    },
  ],
};

// ── Site settings ─────────────────────────────────────────────────────────────

const MOCK_SITE_SETTINGS: SiteSettingsData = {
  siteTitle: "Mister Chameleon",
  logo: null,
  mainNavigation: [
    { id: "nav-how-it-works", label: "How it works", href: "#how-it-works" },
    { id: "nav-platform",     label: "Platform",     href: "#platform" },
    { id: "nav-companies",    label: "Companies",    href: "/companies" },
    { id: "nav-news",         label: "Insights",     href: "/news" },
    { id: "nav-careers",      label: "Careers",      href: "/careers" },
    { id: "nav-pricing",      label: "Pricing",      href: "#pricing" },
    { id: "nav-join",         label: "Partner with us", href: "/join" },
    { id: "nav-contact",      label: "Contact",      href: "/contact" },
  ],
  footerNavigation: [
    { id: "footer-companies", label: "Companies", href: "/companies" },
    { id: "footer-news",      label: "Insights",  href: "/news" },
    { id: "footer-careers",   label: "Careers",   href: "/careers" },
    { id: "footer-join",      label: "Join",      href: "/join" },
    { id: "footer-contact",   label: "Contact",   href: "/contact" },
    { id: "footer-about",     label: "About",     href: "#about" },
    { id: "footer-privacy",   label: "Privacy",   href: "#privacy" },
    { id: "footer-terms",     label: "Terms",     href: "#terms" },
  ],
};

// ── WorkEngine homepage mock data ─────────────────────────────────────────────
//
// Eight content blocks composing the WorkEngine homepage content flow.
// Block order:  logo strip → about (split) → listing (company cards) →
//               feature grid → stats → testimonials → news list → CTA
//
// Hero, proof, and cta context slots are handled separately by the decision
// engine — they are NOT in this sections array.

const WORKENGINE_HOMEPAGE: PageData = {
  id:          "homepage",
  title:       "WorkEngine — Smarter Recruitment",
  slug:        "home",
  seoTitle:    "WorkEngine — Smarter Recruitment Platform",
  seoDescription:
    "WorkEngine connects ambitious companies with top talent faster. " +
    "AI-assisted matching, vacancy management, and recruiter dashboards — all in one platform.",
  sections: [

    // ── 1. Logo strip — trusted employer logos ────────────────────────────────
    {
      _key:     "hp-logos",
      _type:    "logoStrip",
      variant:  "muted",
      heading:  "Trusted by leading employers",
      logos: [
        { _key: "logo-1", name: "Acme Corp",      src: "/logos/acme.svg"      },
        { _key: "logo-2", name: "Beacon Group",   src: "/logos/beacon.svg"    },
        { _key: "logo-3", name: "Meridian Labs",  src: "/logos/meridian.svg"  },
        { _key: "logo-4", name: "Apex Partners",  src: "/logos/apex.svg"      },
        { _key: "logo-5", name: "Crestline Co",   src: "/logos/crestline.svg" },
      ],
    },

    // ── 2. About / split-media — platform overview ────────────────────────────
    {
      _key:     "hp-about",
      _type:    "about",
      variant:  "split",
      heading:  "The platform that connects talent with opportunity",
      body: [
        {
          _type: "block",
          _key:  "ab-body-1",
          style: "normal",
          children: [
            {
              _type: "span",
              _key:  "ab-span-1",
              text:  "WorkEngine combines AI-assisted candidate matching with a " +
                     "structured vacancy workflow so your recruitment team can focus " +
                     "on the conversations that matter — not the admin that slows them down.",
            },
          ],
        },
        {
          _type: "block",
          _key:  "ab-body-2",
          style: "normal",
          children: [
            {
              _type: "span",
              _key:  "ab-span-2",
              text:  "From first vacancy to signed contract, WorkEngine gives you " +
                     "full visibility across every role, every candidate, and every " +
                     "client relationship.",
            },
          ],
        },
      ],
      imageUrl: "/images/platform-dashboard.png",
      imageAlt: "WorkEngine recruitment platform dashboard",
    },

    // ── 3. Listing — featured company cards ───────────────────────────────────
    {
      _key:         "hp-companies",
      _type:        "listing",
      variant:      "grid",
      heading:      "Companies growing with WorkEngine",
      viewAllHref:  "/companies",
      viewAllLabel: "See all companies",
      items: [
        {
          _key:     "co-1",
          id:       "acme-corp",
          title:    "Acme Corp",
          href:     "/companies/acme-corp",
          excerpt:  "A global manufacturing leader scaling its engineering division across Europe.",
          category: "Manufacturing",
          imageUrl: "/logos/acme.svg",
          imageAlt: "Acme Corp logo",
        },
        {
          _key:     "co-2",
          id:       "beacon-group",
          title:    "Beacon Group",
          href:     "/companies/beacon-group",
          excerpt:  "Professional services firm expanding its advisory and consulting teams.",
          category: "Consulting",
          imageUrl: "/logos/beacon.svg",
          imageAlt: "Beacon Group logo",
        },
        {
          _key:     "co-3",
          id:       "meridian-labs",
          title:    "Meridian Labs",
          href:     "/companies/meridian-labs",
          excerpt:  "Life-science startup hiring across clinical research and regulatory affairs.",
          category: "Life Sciences",
          imageUrl: "/logos/meridian.svg",
          imageAlt: "Meridian Labs logo",
        },
      ],
    },

    // ── 4. Feature grid — platform capabilities ───────────────────────────────
    {
      _key:     "hp-features",
      _type:    "featureGrid",
      variant:  "default",
      heading:  "Everything you need to scale recruitment",
      features: [
        {
          title:       "AI-Assisted Matching",
          description: "Surface the best candidates instantly. Our matching engine ranks applicants by fit score so your team reviews the right people first.",
          icon:        "sparkles",
        },
        {
          title:       "Vacancy Management",
          description: "Create, publish, and track every vacancy from a single board. Status updates, deadlines, and approval workflows — built in.",
          icon:        "clipboard-list",
        },
        {
          title:       "Recruiter Dashboard",
          description: "Your full pipeline at a glance. See every candidate, every role, and every next action — no toggling between tools.",
          icon:        "layout-dashboard",
        },
        {
          title:       "Client Portal",
          description: "Give hiring managers a clean view of shortlists, interview schedules, and offer stages — without inbox overload.",
          icon:        "users",
        },
        {
          title:       "Automated Outreach",
          description: "Send personalised candidate outreach at scale. Templates, sequencing, and reply tracking — all tied to your ATS data.",
          icon:        "mail",
        },
        {
          title:       "Analytics & Reporting",
          description: "Know your time-to-fill, source quality, and team capacity at a glance. Export-ready reports for client QBRs.",
          icon:        "bar-chart",
        },
      ],
    },

    // ── 5. Stats — key platform metrics ──────────────────────────────────────
    {
      _key:    "hp-stats",
      _type:   "stats",
      variant: "default",
      heading: "Recruitment at scale",
      items: [
        {
          _key:   "stat-1",
          value:  "500",
          suffix: "+",
          label:  "Companies hiring",
        },
        {
          _key:   "stat-2",
          value:  "12,000",
          suffix: "+",
          label:  "Placements made",
        },
        {
          _key:   "stat-3",
          value:  "4.8",
          label:  "Average client rating",
          suffix: " / 5",
        },
        {
          _key:   "stat-4",
          value:  "18",
          label:  "Average days to placement",
          suffix: " days",
        },
      ],
    },

    // ── 6. Testimonials — client voices ──────────────────────────────────────
    {
      _key:     "hp-testimonials",
      _type:    "testimonialSection",
      variant:  "default",
      heading:  "What our clients say",
      testimonials: [
        {
          quote:   "WorkEngine cut our time-to-hire by 40%. The matching quality is genuinely impressive — candidates arrive already pre-screened for culture and skills.",
          author:  "Sophie van der Berg",
          company: "Acme Corp — Head of Talent",
        },
        {
          quote:   "We scaled from 12 to 45 open roles in a quarter without adding headcount to our recruitment team. The dashboard keeps everyone aligned.",
          author:  "James Holloway",
          company: "Beacon Group — VP Operations",
        },
        {
          quote:   "The client portal changed how we work with hiring managers. They now engage with shortlists in hours, not weeks.",
          author:  "Lena Koster",
          company: "Meridian Labs — HR Director",
        },
      ],
    },

    // ── 7. News list — recent articles ────────────────────────────────────────
    {
      _key:     "hp-news",
      _type:    "newsList",
      variant:  "featured",
      heading:  "Insights from WorkEngine",
      maxItems: 4,
      items: [
        {
          _key:     "news-1",
          title:    "How AI matching reduces bias in early-stage screening",
          url:      "/news/ai-matching-bias-reduction",
          excerpt:  "Structured scoring replaces gut-feel shortlisting and measurably increases diverse hire rates.",
          date:     "2025-11-12",
          category: "AI & Matching",
          imageUrl: "/images/news-ai-matching.jpg",
        },
        {
          _key:     "news-2",
          title:    "5 vacancy workflow mistakes slowing your team down",
          url:      "/news/vacancy-workflow-mistakes",
          excerpt:  "Simple process fixes that save 3-5 hours per open role per week.",
          date:     "2025-10-28",
          category: "Best Practices",
          imageUrl: "/images/news-workflow.jpg",
        },
        {
          _key:     "news-3",
          title:    "WorkEngine Q3 Product Update: Client Portal 2.0",
          url:      "/news/q3-product-update",
          excerpt:  "New interview scheduling, offer tracking, and API webhooks now live for all plans.",
          date:     "2025-10-03",
          category: "Product",
          imageUrl: "/images/news-product.jpg",
        },
        {
          _key:     "news-4",
          title:    "The 2025 Recruitment Benchmarks Report",
          url:      "/news/2025-benchmarks-report",
          excerpt:  "Time-to-fill, offer acceptance rates, and source quality across 500 European employers.",
          date:     "2025-09-15",
          category: "Research",
          imageUrl: "/images/news-benchmarks.jpg",
        },
      ],
    },

    // ── 8. CTA section — inline conversion block ──────────────────────────────
    {
      _key:        "hp-cta",
      _type:       "ctaSection",
      variant:     "brand",
      title:       "Ready to fill your next role faster?",
      description: "Join 500+ companies using WorkEngine to reduce time-to-hire and improve candidate quality.",
      buttonLabel: "Book a demo",
      buttonHref:  "/contact",
    },
  ],
};

// ── Provider implementation ───────────────────────────────────────────────────

export class MockCMSProvider implements CMSProvider {
  /**
   * Returns the hero variant for the given key, or null if not found.
   * Simulates async CMS I/O with Promise.resolve — drop-in compatible
   * with the eventual SanityCMSProvider interface.
   */
  async getHeroVariant(key: string): Promise<HeroBlockData | null> {
    return Promise.resolve(HERO_VARIANTS[key] ?? null);
  }

  async getProofVariant(key: string): Promise<ProofBlockData | null> {
    return Promise.resolve(PROOF_VARIANTS[key] ?? null);
  }

  async getCTAVariant(key: string): Promise<CTABlockData | null> {
    return Promise.resolve(CTA_VARIANTS[key] ?? null);
  }

  async getFeatureVariant(_key: string): Promise<FeatureBlockData | null> {
    // Extended slot — no mock data seeded; returns null so the slot is gracefully absent.
    return Promise.resolve(null);
  }

  async getConversionVariant(_key: string): Promise<ConversionBlockData | null> {
    // Extended slot — no mock data seeded; returns null so the slot is gracefully absent.
    return Promise.resolve(null);
  }

  async getNotificationVariant(_key: string): Promise<NotificationBlockData | null> {
    // Extended slot — no mock data seeded; returns null so the notification is gracefully absent.
    return Promise.resolve(null);
  }

  async getAdaptiveBlock(_key: string): Promise<import("../types").AdaptiveBlockData | null> {
    // No mock adaptive blocks seeded. Returns null so ChameleonHero falls back
    // to its defaultVariant (the SEO-safe fallback) in development.
    return Promise.resolve(null);
  }

  async getSiteSettings(_locale = "en"): Promise<SiteSettingsData | null> {
    return Promise.resolve(MOCK_SITE_SETTINGS);
  }

  async getPageBySlug(slug: string, _locale = "en"): Promise<PageData | null> {
    // ── Homepage ──────────────────────────────────────────────────────────────
    if (slug === "home") return Promise.resolve(WORKENGINE_HOMEPAGE);

    // ── Listing pages ─────────────────────────────────────────────────────────
    if (slug === "companies") return Promise.resolve(WORKENGINE_COMPANIES_PAGE);
    if (slug === "news")      return Promise.resolve(WORKENGINE_NEWS_PAGE);
    if (slug === "careers")   return Promise.resolve(WORKENGINE_CAREERS_PAGE);

    // ── Static pages ──────────────────────────────────────────────────────────
    if (slug === "contact") return Promise.resolve(WORKENGINE_CONTACT_PAGE);
    if (slug === "join")    return Promise.resolve(WORKENGINE_JOIN_PAGE);

    // ── Company detail: "companies/<slug>" ────────────────────────────────────
    if (slug.startsWith("companies/")) {
      const companySlug = slug.slice("companies/".length);
      const company = WORKENGINE_COMPANIES.find((c) => c.slug === companySlug) ?? null;
      if (!company) return Promise.resolve(null);
      return Promise.resolve(buildCompanyDetailPage(company));
    }

    // ── News detail: "news/<slug>" ────────────────────────────────────────────
    if (slug.startsWith("news/")) {
      const articleSlug = slug.slice("news/".length);
      const article = WORKENGINE_NEWS_ARTICLES.find((a) => a.slug === articleSlug) ?? null;
      if (!article) return Promise.resolve(null);
      return Promise.resolve(buildNewsDetailPage(article));
    }

    // ── Vacancy detail: "careers/<slug>" ─────────────────────────────────────
    if (slug.startsWith("careers/")) {
      const vacancySlug = slug.slice("careers/".length);
      const vacancy = WORKENGINE_VACANCIES.find((v) => v.slug === vacancySlug) ?? null;
      if (!vacancy) return Promise.resolve(null);
      return Promise.resolve(buildVacancyDetailPage(vacancy));
    }

    return Promise.resolve(null);
  }

  async getContentByKeys(keys: string[]): Promise<Record<string, unknown>> {
    if (keys.length === 0) return {};
    const result: Record<string, unknown> = {};
    for (const key of keys) {
      result[key] =
        (HERO_VARIANTS[key] as unknown) ??
        (PROOF_VARIANTS[key] as unknown) ??
        (CTA_VARIANTS[key] as unknown) ??
        null;
    }
    return Promise.resolve(result);
  }

  // ── Entity document methods ────────────────────────────────────────────────
  //
  // Backed by in-memory WorkEngine entity arrays above.
  // Swap MockCMSProvider for SanityCMSProvider to connect to a live CMS.

  async getNewsArticleBySlug(slug: string): Promise<NewsArticleData | null> {
    return Promise.resolve(
      WORKENGINE_NEWS_ARTICLES.find((a) => a.slug === slug) ?? null,
    );
  }

  async getNewsArticles(
    options?: { limit?: number; tags?: string[]; company?: string },
  ): Promise<NewsArticleData[]> {
    let articles = WORKENGINE_NEWS_ARTICLES.filter((a) => a.isPublished);
    if (options?.tags && options.tags.length > 0) {
      const filter = new Set(options.tags);
      articles = articles.filter((a) => a.tags?.some((t) => filter.has(t)));
    }
    if (options?.company) {
      articles = articles.filter((a) => a.relatedCompany?.slug === options.company);
    }
    if (options?.limit) {
      articles = articles.slice(0, options.limit);
    }
    return Promise.resolve(articles);
  }

  async getVacancyBySlug(slug: string): Promise<VacancyData | null> {
    return Promise.resolve(
      WORKENGINE_VACANCIES.find((v) => v.slug === slug) ?? null,
    );
  }

  async getVacancies(
    options?: { limit?: number; company?: string; department?: string },
  ): Promise<VacancyData[]> {
    let vacancies = WORKENGINE_VACANCIES.filter((v) => v.isPublished);
    if (options?.company) {
      vacancies = vacancies.filter((v) => v.company?.slug === options.company);
    }
    if (options?.department) {
      vacancies = vacancies.filter((v) => v.department === options.department);
    }
    if (options?.limit) {
      vacancies = vacancies.slice(0, options.limit);
    }
    return Promise.resolve(vacancies);
  }

  async getCompanyBySlug(slug: string): Promise<CompanyData | null> {
    return Promise.resolve(
      WORKENGINE_COMPANIES.find((c) => c.slug === slug) ?? null,
    );
  }

  async getCompanies(options?: { limit?: number }): Promise<CompanyData[]> {
    const companies = WORKENGINE_COMPANIES.filter((c) => c.isPublished);
    if (options?.limit) {
      return Promise.resolve(companies.slice(0, options.limit));
    }
    return Promise.resolve(companies);
  }

  // ── Collection resolution ─────────────────────────────────────────────────

  async resolveCollection(source: CollectionContentSource): Promise<CollectionItem[]> {
    const { collection, mode, limit, sortDir = "desc", selectedIds } = source;

    // ── Map collection key → mock entity fetch ────────────────────────────
    let items: CollectionItem[] = [];

    if (collection === "articles" || collection === "news") {
      const articles = await this.getNewsArticles({ limit: mode === "recent" ? (limit ?? 10) : undefined });
      items = articles.map((a): CollectionItem => ({
        id:       a.slug,             // stable identifier
        title:    a.title,
        href:     `/news/${a.slug}`,
        excerpt:  a.excerpt      ?? undefined,
        date:     a.publishedAt  ?? undefined,
        imageUrl: a.coverImage?.url ?? undefined,
        imageAlt: a.coverImage?.alt ?? undefined,
        tags:     a.tags         ?? undefined,
      }));
    } else if (collection === "vacancies") {
      const vacancies = await this.getVacancies({ limit: mode === "recent" ? (limit ?? 10) : undefined });
      items = vacancies.map((v): CollectionItem => ({
        id:       v.slug,
        title:    v.title,
        href:     `/careers/${v.slug}`,
        date:     v.closingDate  ?? undefined,
        category: v.department   ?? undefined,
      }));
    } else if (collection === "companies") {
      const companies = await this.getCompanies({ limit: mode === "recent" ? (limit ?? 10) : undefined });
      items = companies.map((c): CollectionItem => ({
        id:       c.slug,
        title:    c.name,
        href:     `/companies/${c.slug}`,
        excerpt:  c.description ?? undefined,
      }));
    } else {
      // "cases" and any future keys — no mock data yet, return empty
      return [];
    }

    // ── Apply mode-specific processing ───────────────────────────────────
    if (mode === "specific") {
      if (!selectedIds?.length) return [];
      const idSet = new Set(selectedIds);
      // Filter to selected IDs only — sortBySelectedIds is called by the resolver
      return items.filter((item) => idSet.has(item.id));
    }

    // recent mode — apply sort direction and limit
    if (sortDir === "asc") {
      items = [...items].reverse();
    }
    if (limit) {
      items = items.slice(0, limit);
    }
    return items;
  }

  // ── Provider management ───────────────────────────────────────────────────

  /**
   * MockCMSProvider does not write to any external system — provisionSite()
   * returns a successful no-op result so that provisioning flows don't fail
   * in development / test environments that use the mock provider.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async provisionSite(_tenant: TenantSettings, _options?: { dryRun?: boolean; siteType?: string; pages?: ReadonlyArray<{ presetKey: string; title: string; slug: string }>; includeDefaultBlocks?: boolean; starterContentMode?: import("./cms-provider").StarterContentMode; includeShowcasePage?: boolean }): Promise<ProvisionResult> {
    return {
      ok:                  true,
      documentIds:         [],
      pagesCreated:        0,
      pagesUpdated:        0,
      variantsWritten:     0,
      siteSettingsWritten: false,
      navItemsWritten:     0,
      warnings:            ["MockCMSProvider: provisionSite() is a no-op. No documents were written."],
    };
  }

  /** MockCMSProvider is always reachable — returns ok immediately. */
  async testConnection(): Promise<TestConnectionResult> {
    return { ok: true, provider: "mock", readAccess: true };
  }

  // ── Introspection helpers (testing / debug use only) ────────────────────

  /** All available hero variant keys */
  static get heroKeys(): string[] {
    return Object.keys(HERO_VARIANTS);
  }

  /** All available proof variant keys */
  static get proofKeys(): string[] {
    return Object.keys(PROOF_VARIANTS);
  }

  /** All available CTA variant keys */
  static get ctaKeys(): string[] {
    return Object.keys(CTA_VARIANTS);
  }
}
