/**
 * Nascita Seed Content — Business Consulting Tenant
 *
 * Starter Sanity documents for the Nascita tenant — a business consulting firm.
 * Seeds a homepage page + adaptive variant set covering the key visitor journeys
 * used to demonstrate Mister Chameleon's adaptive experience engine.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   Set your environment variables first:
 *     SANITY_PROJECT_ID=your_project_id
 *     SANITY_DATASET=production
 *     SANITY_WRITE_TOKEN=your_write_token   (needs write access)
 *
 *   Then run:
 *     npx tsx cms/seed/nascita-seed.ts
 *
 *   Preview without writing (token not required):
 *     npx tsx cms/seed/nascita-seed.ts --dry-run
 *
 * ─── What is seeded ───────────────────────────────────────────────────────────
 *
 *   Pages  (slug → URL)
 *     nascita_page_home        home     → /        (homepage, marketing-page template)
 *     nascita_page_approach    approach → /approach
 *     nascita_page_about       about    → /about
 *     nascita_page_contact     contact  → /contact
 *
 *   Navigation items  (referenced by siteSettings.mainNavigation)
 *     nascita_nav_home     → "Home"         /
 *     nascita_nav_approach → "Our Approach" /approach
 *     nascita_nav_about    → "About"        /about
 *     nascita_nav_contact  → "Contact"      /contact
 *
 *   Site settings  (overrides DB nav so only real pages appear in the header)
 *     nascita_siteSettings  mainNavigation: Home · Our Approach · About · Contact
 *
 *   Hero variants  (_id → key)
 *     nascita_hero_direct_brand   → "hero_direct_brand"   ← FALLBACK_PLAN key
 *     nascita_hero_google_problem → "hero_google_problem"  problem-aware (Google)
 *     nascita_hero_linkedin_vision→ "hero_linkedin_vision" vision/thought leadership
 *     nascita_hero_consideration  → "hero_consideration"   returning / consideration
 *     nascita_hero_intent_direct  → "hero_intent_direct"   high-intent / ready to engage
 *
 *   Proof variants  (_id → key)
 *     nascita_proof_platform  → "proof_platform"  ← FALLBACK_PLAN key  firm credibility
 *     nascita_proof_cases     → "proof_cases"     specific client outcomes
 *     nascita_proof_default   → "proof_default"   broad new-visitor trust
 *
 *   CTA variants  (_id → key)
 *     nascita_cta_meeting  → "cta_meeting"  ← FALLBACK_PLAN key  book a discovery call
 *     nascita_cta_guide    → "cta_guide"    download a diagnostic / resource
 *     nascita_cta_platform → "cta_platform" explore the Nascita approach
 *
 * ─── Notes ────────────────────────────────────────────────────────────────────
 *
 *   - All documents use `createOrReplace` so re-running the script is safe.
 *   - Every document carries `tenantId: "nascita"` — GROQ resolves them only
 *     for queries scoped to this tenant, preventing cross-tenant bleed.
 *   - FALLBACK_PLAN keys (`hero_direct_brand`, `proof_platform`, `cta_meeting`)
 *     are required for the Tier-2 fallback chain in compose-experience.ts to
 *     work. Without them the homepage falls through to the Tier-4 static
 *     emergency experience.
 *   - Proof `items[]` must include `_key` fields (Sanity array item requirement).
 */

import { readFileSync } from "fs";
import { resolve }      from "path";

import { parse as parseDotenv } from "dotenv";
import { createClient }         from "@sanity/client";

// ── Env file loading ──────────────────────────────────────────────────────────
//
// tsx does not auto-load .env / .env.local — that's a Next.js-only behaviour.
// Load order (later file wins on duplicate keys):
//   1. .env          — committed base defaults
//   2. .env.local    — developer-local overrides (gitignored)
// Shell / CI variables are never overwritten.

const _envLoad = (function loadEnvFiles() {
  const root   = process.cwd();
  const files  = [".env", ".env.local"] as const;
  const merged: Record<string, string> = {};
  const found:  string[] = [];

  for (const file of files) {
    try {
      const raw = readFileSync(resolve(root, file), "utf8");
      Object.assign(merged, parseDotenv(raw));
      found.push(file);
    } catch { /* file absent — skip */ }
  }

  let applied = 0;
  for (const [key, value] of Object.entries(merged)) {
    if (!(key in process.env)) { process.env[key] = value; applied++; }
  }
  return { files: found, applied };
})();

// ── Config resolution ─────────────────────────────────────────────────────────
//
//   projectId   SANITY_PROJECT_ID  →  NEXT_PUBLIC_SANITY_PROJECT_ID
//   dataset     SANITY_DATASET     →  NEXT_PUBLIC_SANITY_DATASET  →  "production"
//   token       SANITY_API_TOKEN   (no public fallback — server-only secret)

function resolveConfig() {
  const projectId =
    process.env.SANITY_PROJECT_ID ??
    process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;

  const dataset =
    process.env.SANITY_DATASET ??
    process.env.NEXT_PUBLIC_SANITY_DATASET ??
    "production";

  const token = process.env.SANITY_API_TOKEN;

  if (!projectId) {
    throw new Error(
      "\n  ❌  SANITY_PROJECT_ID is not set.\n\n" +
      "  Add one of the following to .env.local:\n" +
      "    SANITY_PROJECT_ID=your_project_id\n" +
      "    NEXT_PUBLIC_SANITY_PROJECT_ID=your_project_id   ← already used by the frontend\n",
    );
  }
  if (!token) {
    throw new Error(
      "\n  ❌  SANITY_API_TOKEN is not set.\n\n" +
      "  Steps:\n" +
      "    1. Open https://www.sanity.io/manage → your project → API → Tokens\n" +
      "    2. Add a token with the Editor role\n" +
      "    3. Add to .env.local:  SANITY_API_TOKEN=your_token_here\n",
    );
  }

  return { projectId, dataset, token };
}

function createWriteClient() {
  const { projectId, dataset, token } = resolveConfig();
  return createClient({
    projectId,
    dataset,
    token,
    apiVersion: process.env.SANITY_API_VERSION ?? "2024-01-01",
    useCdn: false,
  });
}

// ── Portable Text helpers ──────────────────────────────────────────────────────

function paragraph(text: string) {
  return {
    _type:    "block",
    _key:     crypto.randomUUID().replace(/-/g, "").slice(0, 12),
    style:    "normal",
    children: [{ _type: "span", _key: "s1", text, marks: [] }],
    markDefs: [],
  };
}

// ── Tenant constant ────────────────────────────────────────────────────────────

const TENANT = "nascita";

/** Stable Sanity _id for a nascita document */
function id(key: string): string {
  return `${TENANT}_${key}`;
}

/** Build a navigationItem document with a direct href (seed-data shorthand). */
function navItem(slug: string, label: string, href: string): object {
  return {
    _id:         id(`nav_${slug}`),
    _type:       "navigationItem",
    tenantId:    TENANT,
    label,
    linkType:    "external",
    externalUrl: href,
  };
}

/** Build a Sanity reference entry for use in mainNavigation arrays. */
function navRef(slug: string, keyPrefix: string): object {
  return {
    _type: "reference",
    _ref:  id(`nav_${slug}`),
    _key:  `${keyPrefix}${slug}`,
  };
}

// ── Seed documents ────────────────────────────────────────────────────────────

export const nascitaDocuments = [

  // ── Homepage page ──────────────────────────────────────────────────────────
  //
  // contextConfig.*.fallbackVariantKey maps each adaptive slot to the
  // tenant's own fallback variant.  These are tried before the hardcoded
  // FALLBACK_PLAN keys in compose-experience.ts Tier 1.
  {
    _id:         id("page_home"),
    _type:       "page",
    tenantId:    TENANT,
    title:       "Nascita — Homepage",
    slug:        { _type: "slug", current: "home" },
    templateKey: "marketing-page",
    isPublished: true,

    contextConfig: {
      hero:  { fallbackVariantKey: "hero_direct_brand"  },
      proof: { fallbackVariantKey: "proof_platform"     },
      cta:   { fallbackVariantKey: "cta_meeting"        },
    },

    sections: [
      // Services overview
      {
        _type:   "featureGrid",
        _key:    "featureGrid_services",
        heading: "What we do",
        features: [
          {
            title:       "Strategic Advisory",
            description: "From market positioning to portfolio strategy — we bring the frameworks and the challenge.",
            icon:        "lightbulb",
          },
          {
            title:       "Operational Transformation",
            description: "Redesign processes, structures, and capabilities so the strategy actually lands.",
            icon:        "briefcase",
          },
          {
            title:       "Leadership Development",
            description: "Build the internal capability to lead change, not just manage it.",
            icon:        "users",
          },
        ],
      },
      // Testimonials
      {
        _type:   "testimonialSection",
        _key:    "testimonials_home",
        heading: "What clients say",
        testimonials: [
          {
            quote:   "Nascita did something rare: they pushed back when we were wrong, and they stayed when the work got hard.",
            author:  "Sophie van den Berg",
            company: "CFO, Meridian Group",
          },
          {
            quote:   "We came for a strategy. We got a team that helped us build the muscle to execute it ourselves.",
            author:  "David Klaar",
            company: "CEO, Arklight Capital Portfolio",
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // HERO VARIANTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * hero_direct_brand  ← FALLBACK_PLAN key
   * Audience: typed URL, bookmark, or dark social — source unknown.
   * Framing:  Brand clarity. Lead with the core value proposition.
   */
  {
    _id:      id("hero_direct_brand"),
    _type:    "heroVariant",
    tenantId: TENANT,
    key:      "hero_direct_brand",
    isActive: true,
    tag:      "Business transformation, built to last",
    title:    "Your next chapter starts with the right strategy.",
    subtitle:
      "Nascita partners with leadership teams to design and deliver transformations that stick. " +
      "From strategy to execution, we work alongside you — not just in front of you.",
    ctas: [
      { _key: "db-1", label: "Start the conversation", href: "/contact",  variant: "primary"   },
      { _key: "db-2", label: "Explore our approach",   href: "/approach", variant: "secondary" },
    ],
  },

  /**
   * hero_google_problem
   * Audience: searchers who typed a business problem into Google.
   * Framing:  Urgency. Name the pain before offering the path forward.
   */
  {
    _id:      id("hero_google_problem"),
    _type:    "heroVariant",
    tenantId: TENANT,
    key:      "hero_google_problem",
    isActive: true,
    tag:      "There's a smarter way through this",
    title:    "Stuck between the strategy and the execution?",
    subtitle:
      "Most transformation programmes fail not because the strategy is wrong, " +
      "but because implementation runs out of steam. " +
      "Nascita closes that gap — from diagnosis through delivery.",
    ctas: [
      { _key: "gp-1", label: "See how we work",        href: "/approach", variant: "primary"   },
      { _key: "gp-2", label: "Book a discovery call",  href: "/contact",  variant: "secondary" },
    ],
  },

  /**
   * hero_linkedin_vision
   * Audience: professionals engaging with thought-leadership content on LinkedIn.
   * Framing:  Vision. Speak to where high-performing organisations are heading.
   */
  {
    _id:      id("hero_linkedin_vision"),
    _type:    "heroVariant",
    tenantId: TENANT,
    key:      "hero_linkedin_vision",
    isActive: true,
    tag:      "The future of resilient organisations",
    title:    "Organisations that adapt, outperform.",
    subtitle:
      "The most effective leadership teams don't just react to change — they build " +
      "the capability to drive it. Nascita helps you build that capability from the inside out.",
    ctas: [
      { _key: "lv-1", label: "Explore our thinking",  href: "/insights", variant: "primary"   },
      { _key: "lv-2", label: "Talk to us",            href: "/contact",  variant: "secondary" },
    ],
  },

  /**
   * hero_consideration
   * Audience: returning visitors — have read a case study, attended a webinar, or
   *           explored the site across multiple sessions.
   * Framing:  Re-engagement. Acknowledge familiarity, reduce friction to the next step.
   */
  {
    _id:      id("hero_consideration"),
    _type:    "heroVariant",
    tenantId: TENANT,
    key:      "hero_consideration",
    isActive: true,
    tag:      "You've seen what we do. Here's the next step.",
    title:    "Ready to move from exploration to action?",
    subtitle:
      "You've seen the work. You know the kind of transformations we deliver. " +
      "The next step is a direct conversation about where you are and what's possible — " +
      "no pitch deck, no obligation.",
    ctas: [
      { _key: "co-1", label: "Book a 30-minute call", href: "/contact", variant: "primary"   },
      { _key: "co-2", label: "Read a case study",     href: "/cases",   variant: "secondary" },
    ],
  },

  /**
   * hero_intent_direct
   * Audience: high-intent visitors — viewed pricing, contacted us before, or
   *           showing strong engagement signals.
   * Framing:  Directness. Mirror their intent, reduce friction, accelerate.
   */
  {
    _id:      id("hero_intent_direct"),
    _type:    "heroVariant",
    tenantId: TENANT,
    key:      "hero_intent_direct",
    isActive: true,
    tag:      "One conversation away from a plan",
    title:    "You already know what needs to change. Let's build the path.",
    subtitle:
      "Whether you're facing a growth challenge, a structural overhaul, or a strategic pivot — " +
      "Nascita brings the frameworks, the experience, and the hands-on support to get it done. " +
      "Let's talk this week.",
    ctas: [
      { _key: "id-1", label: "Book a discovery call",  href: "/contact",  variant: "primary"   },
      { _key: "id-2", label: "See our approach first", href: "/approach", variant: "secondary" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // PROOF VARIANTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * proof_platform  ← FALLBACK_PLAN key
   * Audience: any / default.
   * Framing:  Firm credibility — track record, depth, embedded model.
   */
  {
    _id:      id("proof_platform"),
    _type:    "proofVariant",
    tenantId: TENANT,
    key:      "proof_platform",
    isActive: true,
    title:    "Proven across industries and scale",
    items: [
      {
        _key:  "pp-1",
        title: "120+ transformations delivered",
        text:
          "From PE-backed mid-market to listed multinationals — every engagement is " +
          "hands-on, outcomes-focused, and designed to build internal capability, not dependency.",
      },
      {
        _key:  "pp-2",
        title: "Embedded, not advisory-only",
        text:
          "Our consultants work inside your organisation for the duration of the programme. " +
          "Strategy and execution under the same roof means no handover gaps.",
      },
      {
        _key:  "pp-3",
        title: "Sector-agnostic rigour",
        text:
          "Financial services, industrial, technology, professional services — " +
          "we bring transferable frameworks and challenge cross-sector blind spots.",
      },
    ],
  },

  /**
   * proof_cases
   * Audience: consideration / high-intent visitors who want to see specific outcomes.
   * Framing:  Concrete results — numbers and named outcomes.
   */
  {
    _id:      id("proof_cases"),
    _type:    "proofVariant",
    tenantId: TENANT,
    key:      "proof_cases",
    isActive: true,
    title:    "Results that move the business forward",
    items: [
      {
        _key:  "pc-1",
        title: "40% reduction in time-to-market",
        text:
          "Operational redesign for a B2B technology company cut their product release cycle " +
          "from 18 weeks to 11 — without adding headcount.",
      },
      {
        _key:  "pc-2",
        title: "€18M in identified efficiency gains",
        text:
          "A 90-day diagnostic across a 600-person professional services firm surfaced " +
          "structural inefficiencies worth €18M annually — with a clear roadmap to capture them.",
      },
      {
        _key:  "pc-3",
        title: "3 portfolio companies scaled to exit",
        text:
          "Embedded strategy and operational support across three PE-backed businesses, " +
          "each achieving a successful exit within the investment horizon.",
      },
    ],
  },

  /**
   * proof_default
   * Audience: new visitors — first or second session, source unknown.
   * Framing:  Broad trust — credibility without requiring specifics.
   */
  {
    _id:      id("proof_default"),
    _type:    "proofVariant",
    tenantId: TENANT,
    key:      "proof_default",
    isActive: true,
    title:    "Trusted by leadership teams who need more than a slide deck",
    items: [
      {
        _key:  "pd-1",
        title: "From diagnosis to delivery",
        text:
          "We don't hand over a strategy and disappear. Nascita stays involved " +
          "through implementation — because that's where transformations are won or lost.",
      },
      {
        _key:  "pd-2",
        title: "Outcome-obsessed, not hours-billed",
        text:
          "Our engagements are structured around milestones, not retainers. " +
          "We succeed when you do — and we structure our fees to reflect that.",
      },
      {
        _key:  "pd-3",
        title: "Built for complex organisations",
        text:
          "Matrix structures, multiple stakeholders, legacy processes — we've navigated " +
          "all of it. Complexity is the job, not a reason to simplify the problem.",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // CTA VARIANTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * cta_meeting  ← FALLBACK_PLAN key
   * Audience: any / default.
   * Framing:  Book a discovery call — low-friction, no-commitment.
   */
  {
    _id:      id("cta_meeting"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    key:      "cta_meeting",
    isActive: true,
    title:    "Let's talk about what's next for your organisation",
    text:
      "A 30-minute discovery call is all it takes to understand whether Nascita is the right fit. " +
      "No pitch, no pressure — just an honest conversation about your situation and what's possible.",
    ctas: [
      { _key: "cm-1", label: "Book a discovery call",  href: "/contact",  variant: "primary"   },
      { _key: "cm-2", label: "Send us a brief first",  href: "/contact",  variant: "secondary" },
    ],
  },

  /**
   * cta_guide
   * Audience: early-stage, awareness, first visit — not yet ready to engage.
   * Framing:  Low-friction resource. Build trust before asking for time.
   */
  {
    _id:      id("cta_guide"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    key:      "cta_guide",
    isActive: true,
    title:    "The Transformation Readiness Diagnostic",
    text:
      "A practical self-assessment used by 400+ leadership teams to identify the three factors " +
      "most likely to derail their next change programme. Free — no email gate.",
    ctas: [
      { _key: "cg-1", label: "Download the diagnostic",  href: "/resources/diagnostic", variant: "primary"   },
      { _key: "cg-2", label: "Explore our thinking",     href: "/insights",             variant: "secondary" },
    ],
  },

  /**
   * cta_platform
   * Audience: LinkedIn / vision visitors, thought-leadership arrivals.
   * Framing:  Explore the Nascita approach — intellectual curiosity, not commitment.
   */
  {
    _id:      id("cta_platform"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    key:      "cta_platform",
    isActive: true,
    title:    "See how we approach transformation",
    text:
      "Our embedded delivery model combines strategic rigour with hands-on support at every stage. " +
      "Read how we work — and why clients come back.",
    ctas: [
      { _key: "cp-1", label: "Explore our approach",  href: "/approach", variant: "primary"   },
      { _key: "cp-2", label: "Talk to us",            href: "/contact",  variant: "secondary" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // PAGES  (nav-linked; simple section-free stubs that render via the template)
  // ─────────────────────────────────────────────────────────────────────────────

  {
    _id:         id("page_approach"),
    _type:       "page",
    tenantId:    TENANT,
    title:       "Our Approach",
    slug:        { _type: "slug", current: "approach" },
    templateKey: "marketing-page",
    isPublished: true,
    sections: [
      {
        _type:   "textSection",
        _key:    "approach_intro",
        heading: "How we work",
        body:    [
          paragraph(
            "Nascita's model is built around one principle: strategy without execution is just a document. " +
            "We embed ourselves inside your organisation for the duration of the engagement — " +
            "from diagnostic through delivery.",
          ),
          paragraph(
            "Every engagement starts with a rigorous diagnosis. We map what's actually happening, " +
            "not just what leadership believes is happening. From there we design the intervention — " +
            "structural, operational, or cultural — and stay to make it real.",
          ),
          paragraph(
            "We measure success by business outcomes, not deliverables. " +
            "Our fees are structured to reflect that.",
          ),
        ],
      },
    ],
  },

  {
    _id:         id("page_about"),
    _type:       "page",
    tenantId:    TENANT,
    title:       "About Nascita",
    slug:        { _type: "slug", current: "about" },
    templateKey: "marketing-page",
    isPublished: true,
    sections: [
      {
        _type:   "textSection",
        _key:    "about_intro",
        heading: "Who we are",
        body:    [
          paragraph(
            "Nascita is a transformation consultancy that works with leadership teams facing " +
            "complex, high-stakes change. We are a small team of experienced operators and " +
            "strategists who have run the programmes we advise on.",
          ),
          paragraph(
            "We don't believe in large delivery teams, vendor lock-in, or recommendation decks " +
            "that gather dust. Our model is deliberately lean — senior involvement throughout, " +
            "clear accountability, and a hard focus on what will actually move the business.",
          ),
        ],
      },
    ],
  },

  {
    _id:         id("page_contact"),
    _type:       "page",
    tenantId:    TENANT,
    title:       "Contact Nascita",
    slug:        { _type: "slug", current: "contact" },
    templateKey: "marketing-page",
    isPublished: true,
    sections: [
      {
        _type:   "textSection",
        _key:    "contact_intro",
        heading: "Start the conversation",
        body:    [
          paragraph(
            "The best way to start is a 30-minute call. No pitch, no deck — " +
            "just an honest conversation about where you are and whether there is a fit.",
          ),
          paragraph("Email us at hello@nascita.consulting or use the form below."),
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // NAVIGATION ITEMS  (referenced by siteSettings.mainNavigation)
  // ─────────────────────────────────────────────────────────────────────────────

  navItem("home",     "Home",          "/"),
  navItem("approach", "Our Approach",  "/approach"),
  navItem("about",    "About",         "/about"),
  navItem("contact",  "Contact",       "/contact"),

  // ─────────────────────────────────────────────────────────────────────────────
  // SITE SETTINGS  (overrides DB nav — only these pages actually exist)
  // ─────────────────────────────────────────────────────────────────────────────

  {
    _id:      id("siteSettings"),
    _type:    "siteSettings",
    tenantId: TENANT,

    siteTitle:             "Nascita Consulting",
    defaultSeoTitle:       "Nascita — Business transformation, built to last",
    defaultSeoDescription:
      "Nascita partners with leadership teams to design and deliver " +
      "transformations that stick. From strategy to execution.",
    contactEmail: "hello@nascita.consulting",

    mainNavigation: [
      navRef("home",     "mn_"),
      navRef("approach", "mn_"),
      navRef("about",    "mn_"),
      navRef("contact",  "mn_"),
    ],

    footerNavigation: [
      navRef("about",   "fn_"),
      navRef("contact", "fn_"),
    ],
  },

];

// ── Runner ────────────────────────────────────────────────────────────────────

const isDryRun = process.argv.includes("--dry-run");

async function run() {
  const cfg = resolveConfig();

  console.log(`\nNascita seed — ${nascitaDocuments.length} documents`);
  if (_envLoad.files.length > 0) {
    console.log(`   Env files  : ${_envLoad.files.join(", ")} (${_envLoad.applied} vars applied)`);
  }
  console.log(`   Project ID : ${cfg.projectId}`);
  console.log(`   Dataset    : ${cfg.dataset}`);
  console.log(`   Token      : present (SANITY_API_TOKEN)\n`);

  if (isDryRun) {
    console.log("DRY RUN — no writes will be made.\n");
    for (const doc of nascitaDocuments) {
      console.log(`  [dry] ${doc._type.padEnd(16)} ${doc._id}`);
    }
    console.log("\nDone (dry run).");
    return;
  }

  const client = createWriteClient();
  const transaction = client.transaction();

  for (const doc of nascitaDocuments) {
    transaction.createOrReplace(doc);
  }

  console.log(`Writing ${nascitaDocuments.length} documents to Sanity...`);
  const result = await transaction.commit({ autoGenerateArrayKeys: true });
  console.log(`\nDone. ${result.results.length} documents written.\n`);

  for (const doc of nascitaDocuments) {
    console.log(`  ✓ ${doc._type.padEnd(16)} ${doc._id}`);
  }
}

run().catch((err) => {
  console.error("\nSeed failed:", err.message);
  process.exit(1);
});
