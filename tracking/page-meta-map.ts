/**
 * Page Metadata Map — Mister Chameleon
 *
 * Resolves a page pathname to its `page_category` and `page_keywords` for
 * behavioral tracking enrichment.  Called by PageTracker so every page_view
 * event carries content-type context that the journey engine can use to build
 * interest profiles and funnel-stage signals.
 *
 * ─── Design ───────────────────────────────────────────────────────────────────
 *
 *   • Pure function — no I/O, no imports, safe to call in any client context.
 *   • Rules are evaluated in order; FIRST match wins.
 *   • More specific paths (e.g. /use-cases/saas) are placed before generic ones
 *     (e.g. /platform) to prevent over-matching.
 *   • Both English and Dutch slugs are covered (MC site is bilingual).
 *
 * ─── Categories ───────────────────────────────────────────────────────────────
 *
 *   homepage       /
 *   pricing        /pricing  /tarieven  /abonnement  /plans
 *   product        /platform  /features  /how-it-works  /hoe-het-werkt
 *   use_case       /use-cases  /oplossingen  /voor-*  /sector-*
 *   social_proof   /cases  /klanten  /customers  /testimonials
 *   contact        /contact
 *   about          /about  /over-ons  /team  /company
 *   content        /blog  /resources  /guides  /playbook  /ebook  /webinar
 *   careers        /careers  /vacatures  /werken-bij
 *   conversion     /signup  /start  /get-started  /aan-de-slag
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   import { resolvePageMeta } from "@/tracking/page-meta-map";
 *
 *   const { category, keywords } = resolvePageMeta(pathname);
 *   // → { category: "pricing", keywords: ["pricing", "plans", "tarieven", ...] }
 */

// ── Types ─────────────────────────────────────────────────────────────────────

interface PageMeta {
  /** Broad content category — stored as page_category in visitor_journey_events. */
  category: string;
  /** Interest-relevant keywords — stored as page_keywords in visitor_journey_events. */
  keywords: string[];
}

interface PageMetaRule {
  match: (pathname: string) => boolean;
  meta:  PageMeta;
}

// ── Rule table (most-specific → least-specific) ───────────────────────────────

const RULES: PageMetaRule[] = [

  // ── Conversion entry points ───────────────────────────────────────────────

  {
    match: (p) => /^\/(signup|registreer|registratie|start|get-started|aan-de-slag|create-account)(\/|$)/i.test(p),
    meta: {
      category: "conversion",
      keywords: ["signup", "start", "trial", "free", "gratis", "onboarding", "aan-de-slag", "account"],
    },
  },

  // ── Pricing / plans ───────────────────────────────────────────────────────

  {
    match: (p) => /^\/(pricing|tarieven|abonnement|plans?|pakket|offerte|pakketten)(\/|$)/i.test(p),
    meta: {
      category: "pricing",
      keywords: [
        "pricing", "plans", "tarieven", "abonnement", "enterprise", "growth",
        "prijs", "pakket", "offerte", "kosten", "cost", "budget",
      ],
    },
  },

  // ── SaaS use case (before generic /use-cases) ─────────────────────────────

  {
    match: (p) => /\/(saas|software-as-a-service|scale-up|startup)(\/|$)/i.test(p),
    meta: {
      category: "use_case",
      keywords: [
        "saas", "software", "scale-up", "startup", "product-led", "plg",
        "personalization", "growth", "conversion", "adaptive",
      ],
    },
  },

  // ── Agency use case ───────────────────────────────────────────────────────

  {
    match: (p) => /\/(agency|bureau|agentschap|voor-bureaus|marketing-bureau)(\/|$)/i.test(p),
    meta: {
      category: "use_case",
      keywords: [
        "agency", "bureau", "marketing agency", "client", "klanten",
        "white-label", "partner", "reseller", "personalization", "adaptive",
      ],
    },
  },

  // ── Generic use cases / solutions ─────────────────────────────────────────

  {
    match: (p) => /^\/(use-cases?|use_cases?|oplossingen?|oplossing|solution|sector|industrie|industry|branche|voor-)(\/|$)/i.test(p),
    meta: {
      category: "use_case",
      keywords: [
        "use-case", "solution", "sector", "industry", "oplossing",
        "toepassing", "personalization", "adaptive", "scenario",
      ],
    },
  },

  // ── How it works ──────────────────────────────────────────────────────────

  {
    match: (p) => /^\/(how-it-works|hoe-het-werkt|hoe-werkt-het|hoe-werkt|werking)(\/|$)/i.test(p),
    meta: {
      category: "product",
      keywords: [
        "how-it-works", "personalization", "adaptive", "technology", "platform",
        "personalisatie", "contextual", "decision-engine", "hoe-het-werkt",
      ],
    },
  },

  // ── Platform / features / capabilities ───────────────────────────────────

  {
    match: (p) => /^\/(platform|features?|functionaliteiten|mogelijkheden|capabilities|integrations?)(\/|$)/i.test(p),
    meta: {
      category: "product",
      keywords: [
        "platform", "features", "capabilities", "integrations", "personalization",
        "adaptive", "personalisatie", "functionaliteiten", "mogelijkheden",
      ],
    },
  },

  // ── ROI calculator ────────────────────────────────────────────────────────

  {
    match: (p) => /^\/(roi|calculator|business-case|businesscase|rendement|besparing)(\/|$)/i.test(p),
    meta: {
      category: "product",
      keywords: [
        "roi", "calculator", "business-case", "savings", "besparing",
        "rendement", "return", "waarde", "value", "impact", "conversion",
      ],
    },
  },

  // ── Cases / social proof ──────────────────────────────────────────────────

  {
    match: (p) => /^\/(cases?|klanten|customers?|testimonials?|reviews?|referenties)(\/|$)/i.test(p),
    meta: {
      category: "social_proof",
      keywords: [
        "cases", "customers", "roi", "results", "case-study", "klanten",
        "social-proof", "trust", "testimonials", "referenties", "reviews",
      ],
    },
  },

  // ── Contact ───────────────────────────────────────────────────────────────

  {
    match: (p) => /^\/contact(\/|$)/i.test(p),
    meta: {
      category: "contact",
      keywords: ["contact", "demo", "meeting", "sales", "afspraak", "gesprek", "book"],
    },
  },

  // ── About / company / team ────────────────────────────────────────────────

  {
    match: (p) => /^\/(about|over-ons|over-mij|team|bedrijf|company|missie|mission|founders?)(\/|$)/i.test(p),
    meta: {
      category: "about",
      keywords: [
        "about", "team", "mission", "company", "over-ons", "bedrijf",
        "visie", "founders", "story", "verhaal",
      ],
    },
  },

  // ── Content / blog / resources ────────────────────────────────────────────

  {
    match: (p) => /^\/(blog|resources?|gids|guides?|artikel|articles?|playbook|webinar|ebook|whitepaper|content|magazine)(\/|$)/i.test(p),
    meta: {
      category: "content",
      keywords: [
        "content", "blog", "guide", "resources", "marketing", "personalization",
        "growth", "personalisatie", "strategy", "tips", "ebook", "playbook",
      ],
    },
  },

  // ── Careers ───────────────────────────────────────────────────────────────

  {
    match: (p) => /^\/(careers?|vacatures?|werken-bij|loopbaan|jobs?)(\/|$)/i.test(p),
    meta: {
      category: "careers",
      keywords: ["careers", "vacatures", "team", "culture", "jobs", "werken-bij", "loopbaan"],
    },
  },

  // ── Legal / docs / changelog (low-signal pages) ───────────────────────────

  {
    match: (p) => /^\/(privacy|terms|voorwaarden|legal|security|changelog|docs|documentatie|status)(\/|$)/i.test(p),
    meta: {
      category: "trust",
      keywords: ["privacy", "security", "gdpr", "compliance", "terms", "beveiliging"],
    },
  },

  // ── Homepage (must be last — least specific) ──────────────────────────────

  {
    match: (p) => p === "/" || p === "",
    meta: {
      category: "homepage",
      keywords: [
        "personalization", "adaptive", "website", "contextual", "conversion",
        "personalisatie", "marketing", "growth",
      ],
    },
  },
];

// ── Public resolver ───────────────────────────────────────────────────────────

/**
 * Returns the page_category and page_keywords for a given pathname.
 *
 * Rules are evaluated in order; first match wins.  Returns `{ category: null,
 * keywords: [] }` when no rule matches (e.g. unknown slug pages).
 *
 * @param pathname  The current page pathname, e.g. "/pricing" or "/cases/acme".
 */
export function resolvePageMeta(pathname: string): { category: string | null; keywords: string[] } {
  // Normalise: lowercase, strip query string and hash.
  const normalized = pathname.toLowerCase().split("?")[0].split("#")[0];

  for (const rule of RULES) {
    if (rule.match(normalized)) {
      return { category: rule.meta.category, keywords: rule.meta.keywords };
    }
  }

  return { category: null, keywords: [] };
}
