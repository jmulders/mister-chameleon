/**
 * demo/content-generator.ts
 *
 * Orchestrates content generation for prospect demos.
 * Server only — no network calls of its own (delegates to ai-generator).
 *
 * Priority:
 *   1. AI-generated content (Claude) — if ANTHROPIC_API_KEY is set
 *   2. Rich bilingual templates       — always available as fallback
 *
 * Exports:
 *   generateScenarios(analysis)          — legacy 5-scenario array (backward compat)
 *   generatePageContent(analysis, lang)  — single-language DemoPageContent
 *   generateBilingualPageContent(analysis) — { en, nl } pair
 */

import type {
  SiteAnalysis,
  SiteCategory,
  DemoLanguage,
  DemoScenario,
  DemoScenarioId,
  DemoExperience,
  DemoVisitorContext,
  DemoPageContent,
  ServicesBlock,
  ProofBlock,
  CasesBlock,
  PricingBlock,
  CareersBlock,
  ScenarioOverride,
  ServiceCard,
  ProofMetric,
  Testimonial,
  PricingTier,
} from "./types";
import { generateBilingualContent, generatePageContentWithAI } from "./ai-generator";

// ── Public exports ────────────────────────────────────────────────────────────

/** Generate a full DemoPageContent for one language. AI first, templates fallback. */
export async function generatePageContent(
  analysis: SiteAnalysis,
  language: DemoLanguage,
): Promise<DemoPageContent> {
  const ai = await generatePageContentWithAI(analysis, language);
  if (ai) return ai;
  return buildTemplateContent(analysis, language);
}

/** Generate EN + NL page content in parallel. AI first per language, templates fallback. */
export async function generateBilingualPageContent(analysis: SiteAnalysis): Promise<{
  en: DemoPageContent;
  nl: DemoPageContent;
}> {
  const { en: aiEn, nl: aiNl } = await generateBilingualContent(analysis);
  return {
    en: aiEn ?? buildTemplateContent(analysis, "en"),
    nl: aiNl ?? buildTemplateContent(analysis, "nl"),
  };
}

/** Legacy: generate 5 DemoScenario objects (still used for the scenario switcher). */
export function generateScenarios(analysis: SiteAnalysis): DemoScenario[] {
  const ctx: TemplateContext = {
    siteName:    analysis.title     || extractDomain(analysis.fetchedUrl),
    description: analysis.description || "a great solution for your needs",
    category:    analysis.category,
    h1:          analysis.firstH1   || analysis.title || "",
  };
  const templates = SCENARIO_TEMPLATES[analysis.category] ?? SCENARIO_TEMPLATES["general"];
  return SCENARIO_IDS.map((id) => {
    const tpl = templates[id];
    return { id, label: tpl.label, description: tpl.description, context: tpl.context, experience: tpl.experience(ctx) };
  });
}

// ── Template content builder ──────────────────────────────────────────────────

function buildTemplateContent(analysis: SiteAnalysis, language: DemoLanguage): DemoPageContent {
  const ctx: TemplateContext = {
    siteName:    analysis.title     || extractDomain(analysis.fetchedUrl),
    description: analysis.description || "",
    category:    analysis.category,
    h1:          analysis.firstH1   || analysis.title || "",
  };
  const t    = TEMPLATES[language];
  const cat  = analysis.category;
  const tcat = t[cat] ?? t["general"];
  const bs   = analysis.brandSignals;

  // Hero (base — scenario overrides apply at render time)
  const hero = {
    headline:    tcat.hero.headline(ctx),
    subheadline: tcat.hero.subheadline(ctx),
    primaryCta:  tcat.hero.primaryCta,
    secondaryCta: tcat.hero.secondaryCta,
  };

  // Services
  const services: ServicesBlock = {
    heading:     tcat.servicesHeading,
    subheading:  tcat.servicesSubheading(ctx),
    services:    tcat.services,
  };

  // Proof
  const proof: ProofBlock = {
    heading:     tcat.proof.heading,
    metrics:     tcat.proof.metrics,
    testimonial: tcat.proof.testimonial,
  };

  // Cases
  const cases: CasesBlock | undefined = tcat.cases;

  // CTA (base)
  const cta = {
    heading:     tcat.cta.heading(ctx),
    body:        tcat.cta.body,
    primaryCta:  tcat.cta.primaryCta,
    secondaryCta: tcat.cta.secondaryCta,
  };

  // Pricing (B2B SaaS only)
  const pricing: PricingBlock | undefined = cat === "b2b_saas" ? tcat.pricing : undefined;

  // Careers
  const careers: CareersBlock | undefined = tcat.careers;

  // Scenario overrides (from legacy scenario templates)
  const legacyTemplates   = SCENARIO_TEMPLATES[cat] ?? SCENARIO_TEMPLATES["general"];
  const legacyCtx         = ctx;
  const scenarioOverrides: Partial<Record<DemoScenarioId, ScenarioOverride>> = {};

  for (const id of SCENARIO_IDS) {
    const exp = legacyTemplates[id].experience(legacyCtx);
    scenarioOverrides[id] = {
      heroHeadline:    exp.hero.headline,
      heroSubheadline: exp.hero.subheadline,
      heroCta:         exp.hero.ctaLabel,
      proofHeading:    exp.proof.heading,
      ctaHeading:      exp.cta.heading,
      ctaBody:         exp.cta.body,
      ctaCta:          exp.cta.ctaLabel,
    };
  }

  return { language, hero, services, proof, cases, cta, pricing, careers, scenarioOverrides };
}

// ── Template context ──────────────────────────────────────────────────────────

interface TemplateContext {
  siteName:    string;
  description: string;
  category:    SiteCategory;
  h1:          string;
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

// ── Bilingual rich block templates ────────────────────────────────────────────
//
// These define static (non-AI) service cards, metrics, testimonials, pricing.
// They are category-specific and language-specific.

interface CategoryBlocks {
  hero: {
    headline:    (ctx: TemplateContext) => string;
    subheadline: (ctx: TemplateContext) => string;
    primaryCta:  string;
    secondaryCta?: string;
  };
  servicesHeading:    string;
  servicesSubheading: (ctx: TemplateContext) => string;
  services:           ServiceCard[];
  proof: {
    heading:     string;
    metrics:     ProofMetric[];
    testimonial: Testimonial;
  };
  cases?: CasesBlock;
  cta: {
    heading:     (ctx: TemplateContext) => string;
    body:        string;
    primaryCta:  string;
    secondaryCta?: string;
  };
  pricing?: PricingBlock;
  careers?: CareersBlock;
}

type LanguageTemplates = Record<SiteCategory, CategoryBlocks>;

// ─────────────────────────────────────────────────────────────────────────────
// ENGLISH TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

const EN: LanguageTemplates = {

  b2b_saas: {
    hero: {
      headline:    (ctx) => `${ctx.siteName} — built for teams who move fast`,
      subheadline: () => "Automate your workflows, align your team, and ship faster. Trusted by thousands of growing companies worldwide.",
      primaryCta:  "Start free trial",
      secondaryCta: "Watch 2-min demo",
    },
    servicesHeading:    "Everything your team needs",
    servicesSubheading: (ctx) => `${ctx.siteName} replaces the tools slowing you down.`,
    services: [
      { icon: "🚀", title: "Instant Deployment",    description: "Go live in minutes, not months. No complex onboarding or setup required." },
      { icon: "📊", title: "Real-time Analytics",   description: "See exactly how your team performs with live dashboards and actionable insights." },
      { icon: "🔒", title: "Enterprise Security",   description: "SOC 2 Type II, GDPR compliant, SSO, and role-based access controls included." },
      { icon: "⚡", title: "250+ Integrations",     description: "Connect to Slack, Salesforce, HubSpot, and every tool your team already uses." },
    ],
    proof: {
      heading: "Trusted by teams that deliver",
      metrics: [
        { value: "2,400+", label: "teams on the platform" },
        { value: "4.8/5",  label: "rating on G2" },
        { value: "98%",    label: "customer retention" },
      ],
      testimonial: {
        quote:   "This platform transformed the way our operations team works. We cut reporting time by 60% and our whole team actually enjoys the software.",
        author:  "Sarah Mitchell",
        role:    "VP of Operations",
        company: "ScaleUp BV",
      },
    },
    cases: {
      heading: "Customers seeing real results",
      cases: [
        { company: "Northwind Tech", industry: "FinTech", description: "Replaced 4 tools with a single platform", result: "60% reduction in operational overhead" },
        { company: "Bloom Agency",   industry: "Marketing", description: "Automated client reporting workflows",    result: "Team saves 12 hours per week" },
      ],
    },
    cta: {
      heading:     (ctx) => `Ready to see what ${ctx.siteName} can do for your team?`,
      body:        "No credit card required. Set up in under 10 minutes. Cancel any time.",
      primaryCta:  "Start free — no card needed",
      secondaryCta: "Talk to sales",
    },
    pricing: {
      heading:    "Simple, transparent pricing",
      subheading: "Start free. Upgrade when you're ready.",
      tiers: [
        {
          name:        "Starter",
          price:       "Free",
          period:      "forever",
          description: "Perfect for small teams just getting started.",
          features:    ["Up to 5 users", "Core features", "Email support", "14-day trial of Pro"],
          ctaLabel:    "Get started free",
          highlighted: false,
        },
        {
          name:        "Pro",
          price:       "€49",
          period:      "per user / month",
          description: "For growing teams that need more power.",
          features:    ["Unlimited users", "Advanced analytics", "All integrations", "Priority support", "Custom roles"],
          ctaLabel:    "Start Pro trial",
          highlighted: true,
        },
        {
          name:        "Enterprise",
          price:       "Custom",
          period:      "annual contract",
          description: "For large organisations with complex needs.",
          features:    ["Everything in Pro", "SSO & SCIM", "Dedicated CSM", "SLA guarantee", "Custom integrations"],
          ctaLabel:    "Contact sales",
          highlighted: false,
        },
      ],
    },
    careers: {
      heading:  "Build something you're proud of",
      body:     "We're a remote-first team of builders and problem-solvers. If you want real ownership, fast progression, and work that matters — we'd love to hear from you.",
      roles:    [
        { title: "Senior Product Engineer",   department: "Engineering", location: "Remote (EU)" },
        { title: "Customer Success Manager",  department: "CS",          location: "Amsterdam" },
        { title: "Head of Growth Marketing",  department: "Marketing",   location: "Remote (EU)" },
      ],
      ctaLabel: "See all open roles",
    },
  },

  agency: {
    hero: {
      headline:    (ctx) => `${ctx.siteName} — strategy, craft, results`,
      subheadline: () => "We help ambitious brands stand out, move faster, and tell better stories. Let's build something extraordinary.",
      primaryCta:  "View our work",
      secondaryCta: "Start a project",
    },
    servicesHeading:    "What we do",
    servicesSubheading: () => "End-to-end brand building, from strategy to launch.",
    services: [
      { icon: "✨", title: "Brand Strategy",         description: "Positioning, messaging, and identity systems built to last." },
      { icon: "🎨", title: "Creative & Design",      description: "Award-winning design that captures attention and drives action." },
      { icon: "📱", title: "Digital Campaigns",      description: "Multi-channel campaigns that reach the right audience at the right moment." },
      { icon: "📈", title: "Performance Marketing",  description: "Data-driven media buying that maximises ROI on every euro spent." },
    ],
    proof: {
      heading: "Brands that trust us with their story",
      metrics: [
        { value: "80+",    label: "brands launched" },
        { value: "€140M+", label: "in media managed" },
        { value: "NPS 74", label: "average client score" },
      ],
      testimonial: {
        quote:   "They didn't just deliver great work — they understood our brand better than anyone. The campaign exceeded every target we set.",
        author:  "James Erikson",
        role:    "CMO",
        company: "Brandify Group",
      },
    },
    cases: {
      heading: "Selected work",
      cases: [
        { company: "Vantage Foods",  industry: "FMCG",    description: "Full brand refresh and go-to-market", result: "32% increase in brand recall" },
        { company: "Orbis Capital",  industry: "Finance",  description: "Digital campaign and content strategy", result: "4.2× improvement in lead quality" },
      ],
    },
    cta: {
      heading:     (ctx) => `Let's talk about your project`,
      body:        "Tell us what you're building and we'll come back with a real point of view — not just a proposal.",
      primaryCta:  "Start the conversation",
      secondaryCta: "See our process",
    },
    careers: {
      heading:  "Do your best work here",
      body:     "Small enough to move fast. Experienced enough to do it right. We're a studio built around craft, curiosity, and collaboration.",
      roles:    [
        { title: "Senior Brand Strategist",  department: "Strategy",  location: "Amsterdam" },
        { title: "Creative Director",        department: "Creative",  location: "Amsterdam / Remote" },
        { title: "Paid Media Lead",          department: "Performance", location: "Remote (EU)" },
      ],
      ctaLabel: "Join the studio",
    },
  },

  ecommerce: {
    hero: {
      headline:    (ctx) => `Discover ${ctx.siteName}`,
      subheadline: () => "Free shipping on your first order. Curated quality, fast delivery, free 30-day returns.",
      primaryCta:  "Shop now",
      secondaryCta: "View new arrivals",
    },
    servicesHeading:    "Why customers choose us",
    servicesSubheading: () => "Shopping the way it should be.",
    services: [
      { icon: "🚚", title: "Free Fast Delivery",  description: "Free shipping on orders over €50. Next-day delivery available at checkout." },
      { icon: "↩️", title: "Easy Returns",        description: "30-day free returns, no questions asked. We make it simple to shop with confidence." },
      { icon: "🌟", title: "Curated Quality",     description: "Every product tested and approved by our expert buyers before it reaches you." },
      { icon: "💳", title: "Secure Checkout",     description: "Bank-grade security, 12+ payment methods, and encrypted transactions every time." },
    ],
    proof: {
      heading: "Thousands of happy customers",
      metrics: [
        { value: "54,000+", label: "orders shipped" },
        { value: "4.9/5",   label: "verified reviews" },
        { value: "30 days", label: "free return window" },
      ],
      testimonial: {
        quote:   "The quality is outstanding and delivery was faster than expected. The return process was effortless when I needed a different size. Won't shop anywhere else.",
        author:  "Emma van der Berg",
        role:    "Verified Customer",
        company: "",
      },
    },
    cta: {
      heading:     () => "Your cart is waiting",
      body:        "Free next-day delivery when you order before midnight. Secure checkout, easy returns.",
      primaryCta:  "Continue shopping",
      secondaryCta: "View bestsellers",
    },
    careers: {
      heading:  "Join our team",
      body:     "We're building the future of retail — and we need great people to help. Flexible roles, genuine progression, and staff discount from day one.",
      roles:    [
        { title: "Buying & Merchandising Manager", department: "Buying",    location: "Amsterdam" },
        { title: "Digital Marketing Specialist",   department: "Marketing", location: "Remote (NL)" },
        { title: "Customer Experience Lead",       department: "CX",        location: "Amsterdam" },
      ],
      ctaLabel: "See open roles",
    },
  },

  recruitment: {
    hero: {
      headline:    (ctx) => `Find the right fit — faster with ${ctx.siteName}`,
      subheadline: () => "The smarter way to hire and get hired. Thousands of quality roles. Intelligent matching. Results that speak for themselves.",
      primaryCta:  "Get started",
      secondaryCta: "Post a job free",
    },
    servicesHeading:    "Built to work for both sides",
    servicesSubheading: () => "Whether you're hiring or looking, we make the match.",
    services: [
      { icon: "🎯", title: "Smart Matching",      description: "AI-powered matching puts your role or profile in front of the right people immediately." },
      { icon: "⚡", title: "Fast Time-to-Hire",   description: "Average time from post to first interview: 48 hours. Quality candidates, fast." },
      { icon: "🔍", title: "Pre-screened Only",   description: "Every candidate is screened before they reach your inbox. No wasted time, no spam." },
      { icon: "📊", title: "Hiring Analytics",    description: "Track your pipeline, benchmark performance, and optimise your process in real time." },
    ],
    proof: {
      heading: "The platform that delivers results",
      metrics: [
        { value: "52,000+", label: "successful placements" },
        { value: "12 days",  label: "average time-to-hire" },
        { value: "8 cands.", label: "avg qualified per role" },
      ],
      testimonial: {
        quote:   "We filled three senior roles in under two weeks — all candidates were exactly what we were looking for. The quality filter is genuinely impressive.",
        author:  "Tom Bakker",
        role:    "HR Director",
        company: "ScaleUp BV",
      },
    },
    cases: {
      heading: "Employers seeing results",
      cases: [
        { company: "HealthTech NL",   industry: "Healthcare", description: "Hired 8 engineers in 3 weeks during rapid scale-up", result: "All hires still active 12 months later" },
        { company: "Retail Group BV", industry: "Retail",     description: "Seasonal hiring of 40 roles across 3 locations",      result: "100% fill rate before opening day" },
      ],
    },
    cta: {
      heading:     () => "Ready to find your next great hire?",
      body:        "First job post is free. No credit card required. Start finding qualified candidates today.",
      primaryCta:  "Post a job free",
      secondaryCta: "Talk to our team",
    },
    careers: {
      heading:  "Work at the platform connecting the world of work",
      body:     "We're on a mission to make recruitment human again. Join a team that's growing fast and doing work that genuinely matters.",
      roles:    [
        { title: "Talent Partnerships Manager", department: "Partnerships", location: "Amsterdam" },
        { title: "Full-stack Engineer",         department: "Engineering",  location: "Remote (EU)" },
        { title: "Account Manager — Employers", department: "Sales",        location: "Amsterdam" },
      ],
      ctaLabel: "View open positions",
    },
  },

  general: {
    hero: {
      headline:    (ctx) => `Welcome to ${ctx.siteName}`,
      subheadline: () => "We help businesses like yours grow smarter. Find out why thousands of customers choose us.",
      primaryCta:  "Get in touch",
      secondaryCta: "Learn more",
    },
    servicesHeading:    "How we can help",
    servicesSubheading: (ctx) => `${ctx.siteName} delivers measurable results.`,
    services: [
      { icon: "🎯", title: "Proven Results",      description: "Our clients see measurable improvement within 30 days of working with us." },
      { icon: "🤝", title: "Dedicated Support",   description: "A named account manager available when you need them, not just during business hours." },
      { icon: "🔒", title: "Secure & Compliant",  description: "GDPR compliant, ISO 27001 certified, and trusted by regulated industries." },
      { icon: "⚡", title: "Fast Onboarding",     description: "From first meeting to first result in under a week. We respect your time." },
    ],
    proof: {
      heading: "Trusted by businesses that take results seriously",
      metrics: [
        { value: "2,100+", label: "active clients" },
        { value: "4.8/5",  label: "satisfaction score" },
        { value: "30 days", label: "average time to first result" },
      ],
      testimonial: {
        quote:   "Working with this team was transformative. They understood our goals immediately and delivered results that exceeded every expectation we had.",
        author:  "Laura de Vries",
        role:    "CEO",
        company: "GrowthCo",
      },
    },
    cta: {
      heading:     (ctx) => `Let's find the right solution for ${ctx.siteName}`,
      body:        "A 20-minute conversation is all it takes to understand whether we're the right fit for your team.",
      primaryCta:  "Book a quick call",
      secondaryCta: "Download overview",
    },
    careers: {
      heading:  "Join a team that invests in you",
      body:     "Competitive pay, flexible working, and a culture that genuinely celebrates wins. We hire for attitude and train for skill.",
      roles:    [
        { title: "Account Executive",       department: "Sales",     location: "Amsterdam" },
        { title: "Operations Specialist",   department: "Ops",       location: "Remote (NL)" },
        { title: "Marketing Manager",       department: "Marketing", location: "Amsterdam" },
      ],
      ctaLabel: "See open roles",
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DUTCH TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

const NL: LanguageTemplates = {

  b2b_saas: {
    hero: {
      headline:    (ctx) => `${ctx.siteName} — gebouwd voor teams die snel bewegen`,
      subheadline: () => "Automatiseer workflows, zorg voor afstemming en lever sneller. Vertrouwd door duizenden groeiende bedrijven.",
      primaryCta:  "Gratis starten",
      secondaryCta: "Bekijk 2-min demo",
    },
    servicesHeading:    "Alles wat uw team nodig heeft",
    servicesSubheading: (ctx) => `${ctx.siteName} vervangt de tools die u vertragen.`,
    services: [
      { icon: "🚀", title: "Directe implementatie",  description: "Binnen minuten live, niet maanden. Geen complexe installatie of onboarding vereist." },
      { icon: "📊", title: "Real-time analyses",     description: "Bekijk precies hoe uw team presteert met live dashboards en bruikbare inzichten." },
      { icon: "🔒", title: "Enterprise beveiliging", description: "SOC 2 Type II, AVG-compliant, SSO en rolgebaseerde toegangscontrole inbegrepen." },
      { icon: "⚡", title: "250+ integraties",       description: "Verbind met Slack, Salesforce, HubSpot en alle tools die uw team al gebruikt." },
    ],
    proof: {
      heading: "Vertrouwd door teams die resultaten leveren",
      metrics: [
        { value: "2.400+", label: "teams op het platform" },
        { value: "4,8/5",  label: "beoordeling op G2" },
        { value: "98%",    label: "klantbehoud" },
      ],
      testimonial: {
        quote:   "Dit platform heeft de manier van werken van ons operationeel team volledig veranderd. We hebben de rapportagetijd met 60% verlaagd en het hele team is er fan van.",
        author:  "Sarah Mitchell",
        role:    "VP of Operations",
        company: "ScaleUp BV",
      },
    },
    cases: {
      heading: "Klanten met echte resultaten",
      cases: [
        { company: "Northwind Tech", industry: "FinTech",    description: "4 tools vervangen door één platform", result: "60% minder operationele overhead" },
        { company: "Bloom Agency",   industry: "Marketing",  description: "Klantrapportage geautomatiseerd",       result: "Team bespaart 12 uur per week" },
      ],
    },
    cta: {
      heading:     (ctx) => `Klaar om te zien wat ${ctx.siteName} voor uw team kan doen?`,
      body:        "Geen creditcard vereist. Binnen 10 minuten opgezet. Op elk moment opzegbaar.",
      primaryCta:  "Gratis starten — geen kaart nodig",
      secondaryCta: "Praat met sales",
    },
    pricing: {
      heading:    "Eenvoudige, transparante prijzen",
      subheading: "Begin gratis. Upgrade wanneer u er klaar voor bent.",
      tiers: [
        {
          name:        "Starter",
          price:       "Gratis",
          period:      "voor altijd",
          description: "Perfect voor kleine teams die net beginnen.",
          features:    ["Tot 5 gebruikers", "Kernfuncties", "E-mailsupport", "14 dagen Pro-proefperiode"],
          ctaLabel:    "Gratis starten",
          highlighted: false,
        },
        {
          name:        "Pro",
          price:       "€49",
          period:      "per gebruiker / maand",
          description: "Voor groeiende teams die meer kracht nodig hebben.",
          features:    ["Onbeperkte gebruikers", "Geavanceerde analyses", "Alle integraties", "Prioriteitssupport", "Aangepaste rollen"],
          ctaLabel:    "Start Pro-proefperiode",
          highlighted: true,
        },
        {
          name:        "Enterprise",
          price:       "Op maat",
          period:      "jaarcontract",
          description: "Voor grote organisaties met complexe behoeften.",
          features:    ["Alles in Pro", "SSO & SCIM", "Toegewijd CSM", "SLA-garantie", "Aangepaste integraties"],
          ctaLabel:    "Neem contact op",
          highlighted: false,
        },
      ],
    },
    careers: {
      heading:  "Bouw iets waar u trots op bent",
      body:     "We zijn een remote-first team van bouwers en probleemoplossers. Als u echte eigenaarschap, snelle groei en zinvol werk wilt — horen we graag van u.",
      roles:    [
        { title: "Senior Product Engineer",  department: "Engineering", location: "Remote (EU)" },
        { title: "Customer Success Manager", department: "CS",          location: "Amsterdam" },
        { title: "Head of Growth Marketing", department: "Marketing",   location: "Remote (EU)" },
      ],
      ctaLabel: "Bekijk alle vacatures",
    },
  },

  agency: {
    hero: {
      headline:    (ctx) => `${ctx.siteName} — strategie, vakmanschap, resultaten`,
      subheadline: () => "We helpen ambitieuze merken op te vallen, sneller te groeien en betere verhalen te vertellen. Laten we iets bijzonders bouwen.",
      primaryCta:  "Bekijk ons werk",
      secondaryCta: "Start een project",
    },
    servicesHeading:    "Wat we doen",
    servicesSubheading: () => "End-to-end merkopbouw, van strategie tot lancering.",
    services: [
      { icon: "✨", title: "Merkstrategie",       description: "Positionering, messaging en identiteitssystemen die de tand des tijds doorstaan." },
      { icon: "🎨", title: "Creatief & Design",   description: "Bekroond design dat aandacht trekt en actie stimuleert." },
      { icon: "📱", title: "Digitale campagnes",  description: "Multichannel campagnes die het juiste publiek op het juiste moment bereiken." },
      { icon: "📈", title: "Performance marketing", description: "Data-gedreven media-inkoop die het rendement op elke euro maximaliseert." },
    ],
    proof: {
      heading: "Merken die ons hun verhaal toevertrouwen",
      metrics: [
        { value: "80+",    label: "gelanceerde merken" },
        { value: "€140M+", label: "aan beheerd mediabudget" },
        { value: "NPS 74", label: "gemiddelde klantscore" },
      ],
      testimonial: {
        quote:   "Ze leverden niet alleen geweldig werk — ze begrepen ons merk beter dan wie dan ook. De campagne overtrof elk gesteld doel.",
        author:  "James Erikson",
        role:    "CMO",
        company: "Brandify Group",
      },
    },
    cases: {
      heading: "Geselecteerd werk",
      cases: [
        { company: "Vantage Foods", industry: "FMCG",    description: "Volledig merkrefresh en go-to-market", result: "32% toename in merkherkenning" },
        { company: "Orbis Capital", industry: "Finance",  description: "Digitale campagne en contentstrategie",  result: "4,2× verbetering in leadkwaliteit" },
      ],
    },
    cta: {
      heading:     () => "Laten we over uw project praten",
      body:        "Vertel ons wat u bouwt en we komen terug met een echte visie — niet alleen een offerte.",
      primaryCta:  "Start het gesprek",
      secondaryCta: "Bekijk ons proces",
    },
    careers: {
      heading:  "Doe uw beste werk hier",
      body:     "Klein genoeg om snel te bewegen. Ervaren genoeg om het goed te doen. Een studio gebouwd rondom vakmanschap, nieuwsgierigheid en samenwerking.",
      roles:    [
        { title: "Senior Merkstrateeg",   department: "Strategie",    location: "Amsterdam" },
        { title: "Creative Director",     department: "Creatief",     location: "Amsterdam / Remote" },
        { title: "Paid Media Lead",       department: "Performance",  location: "Remote (EU)" },
      ],
      ctaLabel: "Word onderdeel van de studio",
    },
  },

  ecommerce: {
    hero: {
      headline:    (ctx) => `Ontdek ${ctx.siteName}`,
      subheadline: () => "Gratis verzending bij uw eerste bestelling. Gecureerde kwaliteit, snelle levering, gratis retourneren binnen 30 dagen.",
      primaryCta:  "Nu shoppen",
      secondaryCta: "Nieuwkomers bekijken",
    },
    servicesHeading:    "Waarom klanten voor ons kiezen",
    servicesSubheading: () => "Shoppen zoals het hoort.",
    services: [
      { icon: "🚚", title: "Gratis snelle bezorging", description: "Gratis verzending bij bestellingen boven €50. Volgende-dag bezorging beschikbaar." },
      { icon: "↩️", title: "Eenvoudig retourneren",   description: "30 dagen gratis retourneren, geen vragen gesteld. Shoppen met vertrouwen." },
      { icon: "🌟", title: "Gecureerde kwaliteit",    description: "Elk product getest en goedgekeurd door onze experts voordat het u bereikt." },
      { icon: "💳", title: "Veilig betalen",          description: "Bankniveau beveiliging, 12+ betaalmethoden en versleutelde transacties." },
    ],
    proof: {
      heading: "Duizenden tevreden klanten",
      metrics: [
        { value: "54.000+", label: "verzonden bestellingen" },
        { value: "4,9/5",   label: "geverifieerde beoordelingen" },
        { value: "30 dagen", label: "gratis retourperiode" },
      ],
      testimonial: {
        quote:   "De kwaliteit is uitstekend en de bezorging was sneller dan verwacht. Het retourneerproces verliep moeiteloos. Ik koop nergens anders meer.",
        author:  "Emma van der Berg",
        role:    "Geverifieerde klant",
        company: "",
      },
    },
    cta: {
      heading:     () => "Uw winkelwagen wacht",
      body:        "Gratis volgende-dag bezorging bij bestellen voor middernacht. Veilig afrekenen, eenvoudig retourneren.",
      primaryCta:  "Verder winkelen",
      secondaryCta: "Bestsellers bekijken",
    },
    careers: {
      heading:  "Word lid van ons team",
      body:     "We bouwen de toekomst van retail — en we hebben geweldige mensen nodig om te helpen. Flexibele functies, echte doorgroeimogelijkheden en personeelskorting vanaf dag één.",
      roles:    [
        { title: "Inkoop & Merchandising Manager", department: "Inkoop",    location: "Amsterdam" },
        { title: "Digitaal Marketing Specialist",  department: "Marketing", location: "Remote (NL)" },
        { title: "Customer Experience Lead",       department: "CX",        location: "Amsterdam" },
      ],
      ctaLabel: "Bekijk vacatures",
    },
  },

  recruitment: {
    hero: {
      headline:    (ctx) => `De juiste match vinden — sneller met ${ctx.siteName}`,
      subheadline: () => "De slimme manier om aan te nemen en aangenomen te worden. Duizenden kwaliteitsvacatures. Intelligente matching. Resultaten die voor zich spreken.",
      primaryCta:  "Aan de slag",
      secondaryCta: "Gratis vacature plaatsen",
    },
    servicesHeading:    "Gebouwd voor beide kanten",
    servicesSubheading: () => "Of u nu aanneemt of zoekt, wij maken de match.",
    services: [
      { icon: "🎯", title: "Slimme matching",      description: "AI-gedreven matching brengt uw vacature of profiel direct bij de juiste mensen." },
      { icon: "⚡", title: "Snel aanwerven",       description: "Gemiddelde tijd van plaatsing tot eerste gesprek: 48 uur. Kwaliteit, snel." },
      { icon: "🔍", title: "Alleen voorgeselecteerd", description: "Elke kandidaat wordt gescreend voordat hij uw inbox bereikt. Geen spam, geen verspilde tijd." },
      { icon: "📊", title: "Hiring analytics",     description: "Volg uw pipeline, benchmark prestaties en optimaliseer uw proces in real time." },
    ],
    proof: {
      heading: "Het platform dat resultaten levert",
      metrics: [
        { value: "52.000+", label: "succesvolle plaatsingen" },
        { value: "12 dagen", label: "gem. time-to-hire" },
        { value: "8 kand.",  label: "gem. gekwalificeerd per vacature" },
      ],
      testimonial: {
        quote:   "We hebben drie senior functies gevuld in minder dan twee weken — alle kandidaten waren precies wat we zochten. De kwaliteitsfilter is indrukwekkend.",
        author:  "Tom Bakker",
        role:    "HR Director",
        company: "ScaleUp BV",
      },
    },
    cases: {
      heading: "Werkgevers met resultaten",
      cases: [
        { company: "HealthTech NL",   industry: "Gezondheidszorg", description: "8 engineers aangenomen in 3 weken tijdens snelle groei", result: "Alle aanwervingen nog actief na 12 maanden" },
        { company: "Retail Group BV", industry: "Retail",          description: "Seizoensinvulling van 40 functies op 3 locaties",         result: "100% invulling vóór openingsdag" },
      ],
    },
    cta: {
      heading:     () => "Klaar om uw volgende topkandidaat te vinden?",
      body:        "Eerste vacature plaatsen is gratis. Geen creditcard vereist. Begin vandaag met vinden.",
      primaryCta:  "Gratis vacature plaatsen",
      secondaryCta: "Praat met ons team",
    },
    careers: {
      heading:  "Werk bij het platform dat de arbeidswereld verbindt",
      body:     "We zijn op een missie om recruitment menselijker te maken. Word lid van een team dat snel groeit en werk doet dat er echt toe doet.",
      roles:    [
        { title: "Talent Partnerships Manager", department: "Partnerships", location: "Amsterdam" },
        { title: "Full-stack Engineer",         department: "Engineering",  location: "Remote (EU)" },
        { title: "Account Manager — Werkgevers", department: "Sales",       location: "Amsterdam" },
      ],
      ctaLabel: "Bekijk vacatures",
    },
  },

  general: {
    hero: {
      headline:    (ctx) => `Welkom bij ${ctx.siteName}`,
      subheadline: () => "We helpen bedrijven zoals het uwe slimmer te groeien. Ontdek waarom duizenden klanten voor ons kiezen.",
      primaryCta:  "Neem contact op",
      secondaryCta: "Meer informatie",
    },
    servicesHeading:    "Hoe we kunnen helpen",
    servicesSubheading: (ctx) => `${ctx.siteName} levert meetbare resultaten.`,
    services: [
      { icon: "🎯", title: "Bewezen resultaten",     description: "Onze klanten zien meetbare verbeteringen binnen 30 dagen na de start." },
      { icon: "🤝", title: "Toegewijde support",     description: "Een vaste accountmanager beschikbaar wanneer u hem nodig heeft." },
      { icon: "🔒", title: "Veilig & compliant",     description: "AVG-compliant, ISO 27001-gecertificeerd en vertrouwd door gereguleerde sectoren." },
      { icon: "⚡", title: "Snelle onboarding",      description: "Van eerste gesprek tot eerste resultaat in minder dan een week. We respecteren uw tijd." },
    ],
    proof: {
      heading: "Vertrouwd door bedrijven die resultaten serieus nemen",
      metrics: [
        { value: "2.100+", label: "actieve klanten" },
        { value: "4,8/5",  label: "tevredenheidsscore" },
        { value: "30 dagen", label: "gem. tijd tot eerste resultaat" },
      ],
      testimonial: {
        quote:   "De samenwerking was transformatief. Ze begrepen onze doelen direct en leverden resultaten die al onze verwachtingen overtroffen.",
        author:  "Laura de Vries",
        role:    "CEO",
        company: "GrowthCo",
      },
    },
    cta: {
      heading:     (ctx) => `Laten we de juiste oplossing vinden voor ${ctx.siteName}`,
      body:        "Een gesprek van 20 minuten is genoeg om te begrijpen of we de juiste fit zijn voor uw team.",
      primaryCta:  "Plan een kennismaking",
      secondaryCta: "Download overzicht",
    },
    careers: {
      heading:  "Word lid van een team dat in u investeert",
      body:     "Marktconform salaris, flexibel werken en een cultuur die echte successen viert. We stellen houding centraal en investeren in vaardigheden.",
      roles:    [
        { title: "Account Executive",     department: "Sales",     location: "Amsterdam" },
        { title: "Operations Specialist", department: "Ops",       location: "Remote (NL)" },
        { title: "Marketing Manager",     department: "Marketing", location: "Amsterdam" },
      ],
      ctaLabel: "Bekijk vacatures",
    },
  },
};

const TEMPLATES: Record<DemoLanguage, LanguageTemplates> = { en: EN, nl: NL };

// ── Legacy scenario templates (unchanged — still powers the scenario switcher) ─

const SCENARIO_IDS: DemoScenarioId[] = [
  "new_visitor", "returning_visitor", "high_intent", "careers", "evening",
];

interface ScenarioTemplate {
  label:       string;
  description: string;
  context:     DemoVisitorContext;
  experience:  (ctx: TemplateContext) => DemoExperience;
}
type TemplateSets = Record<DemoScenarioId, ScenarioTemplate>;

const B2B_SAAS_TEMPLATES: TemplateSets = {
  new_visitor: {
    label: "New visitor", description: "First-time visitor arriving from organic search or social. Awareness stage — focus on value proposition and credibility.",
    context: { description: "Anonymous first-time visitor, likely from Google search", segment: "Unknown — possibly mid-market or SMB", intent: "browsing", source: "Organic search" },
    experience: ({ siteName }) => ({
      hero:  { headline: `Welcome to ${siteName}`, subheadline: "Join thousands of teams who've transformed how they work. See why we're the platform others switch to.", ctaLabel: "Start free trial" },
      proof: { heading: "Trusted by growing teams worldwide", body: "From fast-growing startups to established enterprises, teams choose us when they're serious about results.", stat: "4.8 / 5 on G2 · Trusted by 2,000+ companies" },
      cta:   { heading: "Ready to see the difference?", body: "No credit card required. Set up in minutes, not months.", ctaLabel: "Get started free" },
    }),
  },
  returning_visitor: {
    label: "Returning visitor", description: "Visitor who has been on the site before. Now ready for a deeper look at features or pricing.",
    context: { description: "Returning visitor who browsed the site 3 days ago", segment: "Likely evaluating options", intent: "researching", source: "Direct / bookmark" },
    experience: ({ siteName }) => ({
      hero:  { headline: `Welcome back. Ready to go deeper?`, subheadline: `You've seen what ${siteName} can do — now see how it fits your team's specific workflow.`, ctaLabel: "Book a personalised demo" },
      proof: { heading: "See how teams like yours made the switch", body: "Our onboarding team has helped hundreds of companies migrate — often in under a week.", stat: "Average time-to-value: 4 days" },
      cta:   { heading: "Still comparing options?", body: "We'll map out the ROI for your team — no obligation, no sales pitch.", ctaLabel: "Talk to our team" },
    }),
  },
  high_intent: {
    label: "High intent", description: "Visitor showing strong buying signals — visited pricing, spent time on feature pages.",
    context: { description: "Buyer-stage visitor who viewed pricing and feature pages", segment: "Mid-market, 50–200 employees", intent: "buying", source: "Competitor comparison site" },
    experience: ({ siteName }) => ({
      hero:  { headline: "Ready to make the call? Let's make it easy.", subheadline: `${siteName} integrates with your existing tools in hours. Our team can have you live before the end of the week.`, ctaLabel: "Start your trial now" },
      proof: { heading: "Companies like yours switched in days", body: "Our implementation team handles the heavy lifting. Most customers go live within 48 hours of signing.", stat: "98% of customers active within 5 days" },
      cta:   { heading: "Lock in your pricing today", body: "Annual plans include priority onboarding, a dedicated CSM, and a 30-day money-back guarantee.", ctaLabel: "Get my custom quote" },
    }),
  },
  careers: {
    label: "Careers visitor", description: "Visitor navigating toward the Careers section — potential job candidate.",
    context: { description: "Prospective employee exploring culture and open roles", intent: "browsing", source: "LinkedIn job listing" },
    experience: ({ siteName }) => ({
      hero:  { headline: `Build something meaningful at ${siteName}`, subheadline: "We're a team of builders, thinkers, and problem-solvers. If you love solving hard problems with great people, we want to hear from you.", ctaLabel: "See open roles" },
      proof: { heading: "Why people love working here", body: "Flexible working, genuine ownership, and a team that celebrates wins together. We invest in your growth because your success is ours.", stat: "4.7 / 5 Glassdoor · 94% would recommend us" },
      cta:   { heading: "Found a role that fits?", body: "Applications take under 10 minutes. We review every one, and you'll hear back within 5 working days.", ctaLabel: "Apply now" },
    }),
  },
  evening: {
    label: "Evening visitor", description: "Late-evening visitor — likely a decision-maker doing research outside office hours.",
    context: { description: "Decision-maker browsing after hours (8–11 PM)", segment: "Director or VP level", intent: "researching", timeContext: "Tuesday evening" },
    experience: ({ siteName }) => ({
      hero:  { headline: "The research you do tonight shapes the decision you make tomorrow.", subheadline: `${siteName} gives your team exactly what they've been asking for — without the enterprise price tag or 6-month rollout.`, ctaLabel: "See the 5-minute overview" },
      proof: { heading: "Everything you need to make the case internally", body: "ROI calculator, security docs, customer references, and a ready-made deck for your next stakeholder meeting — all in one place." },
      cta:   { heading: "Leave with answers, not questions", body: "Our buyer guide covers pricing, integrations, and implementation timeline — all in plain language.", ctaLabel: "Download the buyer guide" },
    }),
  },
};

const AGENCY_TEMPLATES: TemplateSets = {
  new_visitor: {
    label: "New visitor", description: "Prospective client seeing the agency for the first time.",
    context: { description: "Potential client visiting for the first time", intent: "browsing", source: "Referral or search" },
    experience: ({ siteName }) => ({
      hero:  { headline: `${siteName} — where strategy meets craft`, subheadline: "We help ambitious brands stand out, grow fast, and tell better stories. Let's make something great together.", ctaLabel: "See our work" },
      proof: { heading: "Award-winning work for ambitious brands", body: "From early-stage startups to category leaders, we've shaped the brands people actually remember.", stat: "60+ brands launched · 3× industry awards" },
      cta:   { heading: "Let's talk about your project", body: "Tell us what you're building and we'll come back with a point of view — not just a proposal.", ctaLabel: "Start the conversation" },
    }),
  },
  returning_visitor: {
    label: "Returning visitor", description: "Prospect who has seen the portfolio. Now weighing the agency against alternatives.",
    context: { description: "Returning prospective client comparing agencies", intent: "researching" },
    experience: ({ siteName }) => ({
      hero:  { headline: "Still thinking? Here's what sets us apart.", subheadline: `${siteName} doesn't do generic. Every engagement starts with a real brief — and ends with work that performs.`, ctaLabel: "Read our case studies" },
      proof: { heading: "Clients who came back — and brought friends", body: "Over 70% of our clients extend or refer after their first project. We measure success by outcomes, not deliverables.", stat: "NPS: 72 · 70% repeat or referral clients" },
      cta:   { heading: "Ready to compare properly?", body: "We'll walk you through a project brief, our process, and typical timelines — so you can compare apples to apples.", ctaLabel: "Book a discovery call" },
    }),
  },
  high_intent: {
    label: "High intent", description: "Client actively scoping a project.",
    context: { description: "Active project scoping — visited brief and pricing pages", intent: "buying" },
    experience: ({ siteName }) => ({
      hero:  { headline: "You've done the research. Let's get into the detail.", subheadline: `${siteName} can turn your brief into a live campaign in as little as 3 weeks. Here's how we'd approach your project.`, ctaLabel: "Submit a project brief" },
      proof: { heading: "What happens after you reach out", body: "You'll hear from a senior strategist within 24 hours — not a BDR. We scope properly, price fairly, and start fast.", stat: "Average brief-to-kickoff: 10 days" },
      cta:   { heading: "Your project deserves the right team.", body: "Submit a brief today and receive a tailored response by tomorrow — no generic pitch decks.", ctaLabel: "Submit your brief" },
    }),
  },
  careers: {
    label: "Careers visitor", description: "Creative or strategist exploring the agency as a potential employer.",
    context: { description: "Creative professional exploring a career opportunity", intent: "browsing", source: "LinkedIn or portfolio referral" },
    experience: ({ siteName }) => ({
      hero:  { headline: `Do your best work at ${siteName}`, subheadline: "Small enough to move fast. Experienced enough to do it right. We're looking for people who care deeply about craft.", ctaLabel: "View open positions" },
      proof: { heading: "A studio built around great work", body: "No unnecessary layers. Direct client relationships. A team that challenges each other and celebrates together.", stat: "Average tenure: 3.2 years · 90% retention" },
      cta:   { heading: "Like what you see?", body: "Send us your portfolio and a short note about the work you want to be doing. We read everything.", ctaLabel: "Get in touch" },
    }),
  },
  evening: {
    label: "Evening visitor", description: "Marketing director or founder researching agency options after hours.",
    context: { description: "Senior decision-maker doing evening research", intent: "researching", timeContext: "Wednesday evening" },
    experience: ({ siteName }) => ({
      hero:  { headline: "The agency brief you write tonight determines next quarter's results.", subheadline: `${siteName} turns strategic briefs into high-performing creative — fast. See the work, then let's talk.`, ctaLabel: "Explore our case studies" },
      proof: { heading: "Everything you need before your next internal meeting", body: "Credentials deck, case studies by industry, and references available on request — all ready to share with your stakeholders." },
      cta:   { heading: "Tell us what you're working on", body: "Leave your brief or a quick note. You'll hear from a senior team member by 9 AM.", ctaLabel: "Leave us a brief" },
    }),
  },
};

const ECOMMERCE_TEMPLATES: TemplateSets = {
  new_visitor: { label: "New visitor", description: "First-time shopper discovering the brand.", context: { description: "New shopper, first visit", intent: "browsing", source: "Instagram ad or Google Shopping" }, experience: ({ siteName }) => ({ hero: { headline: `Welcome to ${siteName}`, subheadline: "Free shipping on your first order. Discover what thousands of happy customers already love.", ctaLabel: "Shop now" }, proof: { heading: "Loved by customers everywhere", body: "Real reviews from real customers. We stand behind every product with our no-quibble return policy.", stat: "4.9 stars · 12,000+ verified reviews" }, cta: { heading: "First-time shopper? Here's a treat.", body: "Get 10% off your first order when you sign up for our newsletter.", ctaLabel: "Claim your 10% discount" } }) },
  returning_visitor: { label: "Returning visitor", description: "Customer who has shopped before.", context: { description: "Returning customer, last order 3 weeks ago", intent: "browsing" }, experience: ({ siteName }) => ({ hero: { headline: "Welcome back — new arrivals just for you", subheadline: `We've added new styles to ${siteName} since your last visit. Loyal customers get early access to our latest drops.`, ctaLabel: "See what's new" }, proof: { heading: "Your loyalty means the world to us", body: "As a returning customer, you get free returns, priority support, and early access to sales.", stat: "Members save an average of €47 per order" }, cta: { heading: "Ready to treat yourself?", body: "Your wishlist is waiting. Free next-day delivery on orders over €50.", ctaLabel: "Continue shopping" } }) },
  high_intent: { label: "High intent", description: "Shopper who has added items to cart.", context: { description: "Shopper with items in cart, high purchase intent", intent: "buying" }, experience: ({ siteName }) => ({ hero: { headline: "Your cart is waiting — and so is free shipping", subheadline: `Complete your ${siteName} order today and get free next-day delivery. Limited stock on selected items.`, ctaLabel: "Complete my order" }, proof: { heading: "100% secure checkout", body: "We use bank-grade encryption. Your payment details are never stored. Free returns within 30 days, no questions asked.", stat: "30-day free returns · Secure checkout" }, cta: { heading: "Don't miss out", body: "Items in your cart are popular — we can't guarantee availability. Order now and receive by tomorrow.", ctaLabel: "Checkout now" } }) },
  careers: { label: "Careers visitor", description: "Potential employee browsing career opportunities.", context: { description: "Job seeker interested in retail or e-commerce careers", intent: "browsing" }, experience: ({ siteName }) => ({ hero: { headline: `Join the ${siteName} team`, subheadline: "We're building something special — and we want great people to build it with us. Flexible roles, real growth.", ctaLabel: "See open roles" }, proof: { heading: "A great place to grow", body: "Staff discount, flexible hours, and a culture that invests in your development. We promote from within.", stat: "60% of managers started in entry-level roles" }, cta: { heading: "Ready to apply?", body: "Applications take under 5 minutes. You'll hear back within 3 working days.", ctaLabel: "Apply now" } }) },
  evening: { label: "Evening visitor", description: "Evening shopper — often making considered purchases with time to browse.", context: { description: "Relaxed evening shopper with time to browse", intent: "browsing", timeContext: "Sunday evening" }, experience: ({ siteName }) => ({ hero: { headline: "Evening inspiration — free next-day delivery when you order tonight", subheadline: `Browse the full ${siteName} collection at your own pace. Order before midnight for next-day delivery.`, ctaLabel: "Start browsing" }, proof: { heading: "No rush — free returns on everything", body: "Not sure? Order two sizes and return the one that doesn't fit, free. We make it easy to shop with confidence.", stat: "Free returns · 30 days to decide" }, cta: { heading: "Found something you love?", body: "Order tonight and receive tomorrow. Gift wrapping available at checkout.", ctaLabel: "Shop the collection" } }) },
};

const RECRUITMENT_TEMPLATES: TemplateSets = {
  new_visitor: { label: "New visitor", description: "Job seeker or employer finding the platform for the first time.", context: { description: "First-time visitor — could be employer or candidate", intent: "browsing", source: "Google search" }, experience: ({ siteName }) => ({ hero: { headline: `Find the right fit — faster with ${siteName}`, subheadline: "Whether you're hiring or job-seeking, we make the match. Thousands of roles and top-tier talent, all in one place.", ctaLabel: "Get started" }, proof: { heading: "The platform that works for both sides", body: "Employers fill roles faster. Candidates land offers they actually want. Everyone wins.", stat: "50,000+ placements · Average fill time: 12 days" }, cta: { heading: "Not sure where to start?", body: "Tell us whether you're hiring or looking — and we'll personalise your experience from there.", ctaLabel: "Tell us your goal" } }) },
  returning_visitor: { label: "Returning visitor", description: "Returning candidate or employer — show progress and next steps.", context: { description: "Returning user who started a profile or job search", intent: "researching" }, experience: ({ siteName }) => ({ hero: { headline: "Welcome back — your next step is waiting", subheadline: `New roles matching your profile have been added to ${siteName} since your last visit. Don't let the right opportunity pass.`, ctaLabel: "See new matches" }, proof: { heading: "Candidates who stayed consistent got results", body: "Active profiles receive 3× more employer views. Update your availability and let opportunities come to you.", stat: "3× more employer views for active profiles" }, cta: { heading: "Ready to take the next step?", body: "Complete your profile and get matched to top employers in your field — free.", ctaLabel: "Complete my profile" } }) },
  high_intent: { label: "High intent", description: "Employer ready to post or candidate ready to apply — reduce friction.", context: { description: "Decision-stage user ready to post or apply", intent: "buying" }, experience: ({ siteName }) => ({ hero: { headline: "Ready to post? You're two minutes from your first applicant.", subheadline: `${siteName}'s smart matching puts your role in front of the right candidates immediately. No wasted applications.`, ctaLabel: "Post a job now" }, proof: { heading: "First applicants within hours, not weeks", body: "Our matching algorithm screens for fit before candidates apply — so your shortlist is always quality-first.", stat: "Average: 8 qualified applicants in 48 hours" }, cta: { heading: "Post today, interview this week", body: "First job post is free. No credit card required.", ctaLabel: "Post my first role free" } }) },
  careers: { label: "Careers visitor", description: "Someone interested in working at the recruitment platform itself.", context: { description: "Job seeker interested in internal roles at the platform", intent: "browsing" }, experience: ({ siteName }) => ({ hero: { headline: `Work at ${siteName} — help people find their next chapter`, subheadline: "We're on a mission to make recruitment human again. Join the team that's changing how the world finds work.", ctaLabel: "See our open roles" }, proof: { heading: "Inside the team that builds the platform", body: "A mix of tech, talent, and hustle. We're growing fast and looking for people who want real impact from day one.", stat: "40 countries represented · Fully remote-friendly" }, cta: { heading: "Ready to join us?", body: "Browse our current openings and apply in minutes. Every application gets a personal response.", ctaLabel: "View open roles" } }) },
  evening: { label: "Evening visitor", description: "Candidate doing evening job search — motivated, focused, ready to act.", context: { description: "Motivated job seeker researching after work hours", intent: "researching", timeContext: "Thursday evening" }, experience: ({ siteName }) => ({ hero: { headline: "The right move starts with the right search", subheadline: `Browse ${siteName} at your own pace tonight — set up job alerts so you never miss the role that fits.`, ctaLabel: "Search jobs now" }, proof: { heading: "Confidential, discreet, effective", body: "Your current employer will never be notified. Browse and apply privately — we only connect you when you're ready.", stat: "100% confidential job searching" }, cta: { heading: "Set up your alert before you sleep", body: "New roles matching your criteria, delivered to your inbox each morning. Takes 60 seconds to set up.", ctaLabel: "Create my job alert" } }) },
};

const GENERAL_TEMPLATES: TemplateSets = {
  new_visitor: { label: "New visitor", description: "First-time visitor — focus on clarity and value proposition.", context: { description: "First-time visitor discovering the brand", intent: "browsing", source: "Search or referral" }, experience: ({ siteName }) => ({ hero: { headline: `Welcome to ${siteName}`, subheadline: "We help businesses like yours grow smarter. Find out why thousands of customers choose us.", ctaLabel: "Learn more" }, proof: { heading: "Trusted by businesses like yours", body: "From small teams to global companies, we deliver results that matter.", stat: "2,000+ happy customers · 4.8 / 5 rating" }, cta: { heading: "Ready to get started?", body: "Talk to our team and find out what we can do for you.", ctaLabel: "Get in touch" } }) },
  returning_visitor: { label: "Returning visitor", description: "Returning visitor doing deeper research before deciding.", context: { description: "Returning visitor evaluating options", intent: "researching" }, experience: ({ siteName }) => ({ hero: { headline: "Good to see you back — still have questions?", subheadline: `We're here to help you make the right decision. See how ${siteName} stacks up for your specific needs.`, ctaLabel: "Talk to an expert" }, proof: { heading: "Real results for real businesses", body: "Our customers see measurable improvement within 30 days. We'll show you exactly how.", stat: "Customers see results within 30 days" }, cta: { heading: "Let's find the right fit together", body: "A quick 20-minute call is all it takes to know if we're the right choice for your team.", ctaLabel: "Book a quick call" } }) },
  high_intent: { label: "High intent", description: "Decision-stage visitor — remove friction and make it easy to act.", context: { description: "Visitor in the decision stage", intent: "buying" }, experience: ({ siteName }) => ({ hero: { headline: "Make your move — we'll make it seamless", subheadline: `${siteName} is ready when you are. Our team will have you set up and seeing results within days.`, ctaLabel: "Get started today" }, proof: { heading: "Fast onboarding, lasting results", body: "We've helped hundreds of companies get up and running quickly — and stay happy long after.", stat: "Average time to first result: 72 hours" }, cta: { heading: "Let's make it official", body: "Get a personalised plan and pricing for your team today.", ctaLabel: "Request my plan" } }) },
  careers: { label: "Careers visitor", description: "Potential employee browsing career opportunities.", context: { description: "Prospective employee exploring the company", intent: "browsing" }, experience: ({ siteName }) => ({ hero: { headline: `Grow your career at ${siteName}`, subheadline: "Join a team that's passionate about what they do. We invest in people, reward great work, and have fun along the way.", ctaLabel: "See open roles" }, proof: { heading: "A place where careers thrive", body: "Competitive pay, flexible working, and a culture built on trust. We're proud of the team we've built.", stat: "Glassdoor rating: 4.6 · 91% would recommend" }, cta: { heading: "Find your next role", body: "We hire for attitude and train for skill. If you share our values, we want to hear from you.", ctaLabel: "Apply now" } }) },
  evening: { label: "Evening visitor", description: "Late-evening visitor doing self-directed research.", context: { description: "Decision-maker browsing outside office hours", intent: "researching", timeContext: "Evening" }, experience: ({ siteName }) => ({ hero: { headline: "Taking your time to get this right? Smart.", subheadline: `${siteName} gives you everything you need to make an informed decision — case studies, pricing, and references all in one place.`, ctaLabel: "Explore at your pace" }, proof: { heading: "All the information — none of the pressure", body: "Download our product guide, read customer stories, or compare plans — we make the research easy." }, cta: { heading: "Leave with what you need", body: "Drop us a question and we'll send a personal reply by 9 AM tomorrow.", ctaLabel: "Ask us anything" } }) },
};

const SCENARIO_TEMPLATES: Record<SiteCategory, TemplateSets> = {
  b2b_saas:    B2B_SAAS_TEMPLATES,
  agency:      AGENCY_TEMPLATES,
  ecommerce:   ECOMMERCE_TEMPLATES,
  recruitment: RECRUITMENT_TEMPLATES,
  general:     GENERAL_TEMPLATES,
};
