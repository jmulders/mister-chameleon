/**
 * WorkEngine Seed Content
 *
 * Starter Sanity documents for the WorkEngine tenant.
 * Run this script once after setting up your Sanity project to pre-populate
 * the dataset with functional content.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   Set your environment variables first:
 *     SANITY_PROJECT_ID=your_project_id
 *     SANITY_DATASET=production
 *     SANITY_WRITE_TOKEN=your_write_token   (needs write access)
 *
 *   Then run:
 *     npx tsx cms/seed/workengine-seed.ts
 *
 *   Or from the project root:
 *     npx tsx cms/seed/workengine-seed.ts --dry-run
 *     (prints documents without writing to Sanity)
 *
 * ─── What is seeded ───────────────────────────────────────────────────────────
 *
 *   Documents created (all with tenantId: "workengine"):
 *
 *   Pages
 *     workengine_page_home     Homepage (marketing-page template)
 *
 *   Adaptive content variants
 *     hero_workengine_default    Hero variant — default brand copy
 *     proof_workengine_default   Proof variant — key metrics
 *     cta_workengine_default     CTA variant — register / contact
 *
 *   Companies
 *     workengine_company_acme    Acme Logistics (example employer)
 *     workengine_company_nova    Nova Finance (example employer)
 *
 *   News articles
 *     workengine_news_growth     Growth article
 *     workengine_news_award      Award article
 *
 *   Vacancies
 *     workengine_vacancy_fe      Frontend Engineer vacancy
 *
 * ─── Notes ────────────────────────────────────────────────────────────────────
 *
 *   - All documents use `createOrReplace` so re-running the script is safe.
 *   - The `key` field on heroVariant / proofVariant / ctaVariant is stored as a
 *     Sanity slug object { _type: "slug", current: "..." }.
 *   - Portable Text fields (body, description) use the minimal block format.
 */

import { createClient } from "@sanity/client";

// ── Sanity client ──────────────────────────────────────────────────────────────

function createWriteClient() {
  const projectId = process.env.SANITY_PROJECT_ID;
  const dataset   = process.env.SANITY_DATASET ?? "production";
  const token     = process.env.SANITY_WRITE_TOKEN;

  if (!projectId) {
    throw new Error("SANITY_PROJECT_ID is not set. Add it to your .env or environment.");
  }
  if (!token) {
    throw new Error(
      "SANITY_WRITE_TOKEN is not set. Create a write token at https://www.sanity.io/manage.",
    );
  }

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

// ── Seed documents ────────────────────────────────────────────────────────────

/**
 * All documents to seed. Each is a complete Sanity document object.
 * `createOrReplace` is used so IDs are stable and re-runs are safe.
 */
export const workengineDocuments = [

  // ── Homepage page ──────────────────────────────────────────────────────────
  {
    _id:         "workengine_page_home",
    _type:       "page",
    tenantId:    "workengine",
    title:       "WorkEngine — Homepage",
    slug:        { _type: "slug", current: "home" },
    templateKey: "marketing-page",
    isPublished: true,

    contextConfig: {
      hero:  { fallbackVariantKey: "hero_workengine_default" },
      proof: { fallbackVariantKey: "proof_workengine_default" },
      cta:   { fallbackVariantKey: "cta_workengine_default"  },
    },

    sections: [
      // Feature grid — WorkEngine's three core services
      {
        _type:   "featureGrid",
        _key:    "featureGrid_services",
        heading: "Hoe WorkEngine werkt",
        features: [
          {
            title:       "Staffing",
            description: "Snelle plaatsing van tijdelijke en vaste krachten op basis van uw vacature.",
            icon:        "users",
          },
          {
            title:       "RPO",
            description: "End-to-end recruitment process outsourcing — van sourcing tot contract.",
            icon:        "briefcase",
          },
          {
            title:       "Consulting",
            description: "Strategisch HR-advies voor groeiende organisaties in elke sector.",
            icon:        "lightbulb",
          },
        ],
      },
      // Testimonial section
      {
        _type:   "testimonialSection",
        _key:    "testimonials_home",
        heading: "Wat onze klanten zeggen",
        testimonials: [
          {
            quote:   "WorkEngine heeft ons recruitmentproces volledig getransformeerd. Binnen drie weken hadden we de juiste kandidaat.",
            author:  "Marieke van der Berg",
            company: "Acme Logistics",
          },
          {
            quote:   "Uitstekende service en een netwerk dat echt matcht met onze behoeften als financiële organisatie.",
            author:  "Stefan Kuijpers",
            company: "Nova Finance",
          },
        ],
      },
    ],
  },

  // ── Hero variant — default brand copy ─────────────────────────────────────
  {
    _id:      "hero_workengine_default",
    _type:    "heroVariant",
    tenantId: "workengine",
    key:      { _type: "slug", current: "hero_workengine_default" },
    isActive: true,
    tag:      "Recruitment & Staffing",
    title:    "De juiste kandidaat, op het juiste moment",
    subtitle:
      "WorkEngine verbindt ambitieuze professionals met toonaangevende werkgevers in logistics, finance en tech. Sneller, slimmer, en persoonlijker.",
    ctaLabel: "Bekijk vacatures",
    ctaHref:  "/vacatures",
  },

  // ── Proof variant — key metrics ────────────────────────────────────────────
  {
    _id:      "proof_workengine_default",
    _type:    "proofVariant",
    tenantId: "workengine",
    key:      { _type: "slug", current: "proof_workengine_default" },
    isActive: true,
    title:    "Bewezen resultaten",
    items: [
      {
        title: "500+ plaatsingen per jaar",
        text:  "Meer dan vijfhonderd succesvolle plaatsingen in het afgelopen jaar, in uiteenlopende sectoren.",
      },
      {
        title: "92% retentie na 12 maanden",
        text:  "Negen van de tien kandidaten die via WorkEngine worden geplaatst, zijn er een jaar later nog.",
      },
      {
        title: "14 dagen gemiddelde time-to-hire",
        text:  "Van vacature tot getekend contract in minder dan twee weken — gemiddeld over alle plaatsingen.",
      },
    ],
  },

  // ── CTA variant — register / contact ──────────────────────────────────────
  {
    _id:      "cta_workengine_default",
    _type:    "ctaVariant",
    tenantId: "workengine",
    key:      { _type: "slug", current: "cta_workengine_default" },
    isActive: true,
    title:    "Klaar om te groeien?",
    text:     "Of u nu op zoek bent naar uw volgende uitdaging of de perfecte kandidaat — WorkEngine staat voor u klaar.",
    ctaLabel: "Neem contact op",
    ctaHref:  "/contact",
  },

  // ── Company: Acme Logistics ────────────────────────────────────────────────
  {
    _id:         "workengine_company_acme",
    _type:       "company",
    tenantId:    "workengine",
    name:        "Acme Logistics",
    slug:        { _type: "slug", current: "acme-logistics" },
    isPublished: true,
    description: "Acme Logistics is een toonaangevende supply-chain oplossingen aanbieder, actief in heel Europa met een focus op duurzame logistiek.",
    services:    ["Supply Chain Management", "Warehousing", "Last-mile Delivery"],
    stats: [
      { _key: "stat_founded", label: "Opgericht",       value: "2008" },
      { _key: "stat_staff",   label: "Medewerkers",     value: "850+"  },
      { _key: "stat_depots",  label: "Depots",          value: "12"   },
    ],
    branches: [
      {
        _key:    "branch_rotterdam",
        name:    "Rotterdam HQ",
        city:    "Rotterdam",
        address: "Waalhaven Zuidzijde 17",
        phone:   "+31 10 123 4567",
      },
      {
        _key:    "branch_amsterdam",
        name:    "Amsterdam",
        city:    "Amsterdam",
        address: "Kabelweg 57",
      },
    ],
  },

  // ── Company: Nova Finance ──────────────────────────────────────────────────
  {
    _id:         "workengine_company_nova",
    _type:       "company",
    tenantId:    "workengine",
    name:        "Nova Finance",
    slug:        { _type: "slug", current: "nova-finance" },
    isPublished: true,
    description: "Nova Finance is een onafhankelijk financieel adviesbureau gespecialiseerd in groeifinancieringen voor het MKB in de Benelux.",
    services:    ["Corporate Finance", "M&A Advisory", "Financial Modelling"],
    stats: [
      { _key: "stat_founded",      label: "Opgericht",          value: "2014" },
      { _key: "stat_deals",        label: "Deals gesloten",     value: "200+" },
      { _key: "stat_total_value",  label: "Totale dealwaarde",  value: "€1.2 Mrd" },
    ],
    branches: [
      {
        _key:    "branch_amsterdam",
        name:    "Amsterdam HQ",
        city:    "Amsterdam",
        address: "Herengracht 420",
        phone:   "+31 20 456 7890",
      },
    ],
  },

  // ── News article: Growth ───────────────────────────────────────────────────
  {
    _id:         "workengine_news_growth",
    _type:       "newsArticle",
    tenantId:    "workengine",
    title:       "WorkEngine verdubbelt aantal plaatsingen in 2024",
    slug:        { _type: "slug", current: "workengine-verdubbelt-plaatsingen-2024" },
    isPublished: true,
    publishedAt: "2025-01-15T09:00:00Z",
    tags:        ["company news", "growth"],
    excerpt:     "Na een recordjaar heeft WorkEngine haar plaatsingsvolume in 2024 verdubbeld dankzij uitbreiding naar drie nieuwe sectoren.",
    body: [
      paragraph(
        "WorkEngine sluit 2024 af met een opmerkelijk resultaat: meer dan duizend plaatsingen in één jaar — een verdubbeling ten opzichte van 2023.",
      ),
      paragraph(
        "De groei is mede te danken aan de uitbreiding naar finance en tech, naast de traditionele core van logistics en manufacturing.",
      ),
      paragraph(
        "\"Onze klanten worden steeds veeleisender, en terecht\", zegt directeur Anna de Vries. " +
        "\"Door te investeren in onze database en matching-technologie leveren we sneller én betere resultaten.\"",
      ),
    ],
  },

  // ── News article: Award ────────────────────────────────────────────────────
  {
    _id:         "workengine_news_award",
    _type:       "newsArticle",
    tenantId:    "workengine",
    title:       "WorkEngine wint Beste Uitzendbureau 2025",
    slug:        { _type: "slug", current: "workengine-wint-beste-uitzendbureau-2025" },
    isPublished: true,
    publishedAt: "2025-03-01T10:00:00Z",
    tags:        ["award", "company news"],
    excerpt:     "Voor het tweede jaar op rij is WorkEngine uitgeroepen tot Beste Uitzendbureau door het vakblad Recruitment Today.",
    body: [
      paragraph(
        "Recruitment Today heeft WorkEngine voor de tweede keer op rij uitgeroepen tot Beste Uitzendbureau van het jaar. " +
        "De jury prees met name de hoge klanttevredenheidsscores en de innovatieve aanpak van matching.",
      ),
      paragraph(
        "\"Dit is een erkenning voor het hele team\", aldus Anna de Vries bij de uitreiking. " +
        "\"Elke dag zetten onze consultants alles op alles om de perfecte match te maken.\"",
      ),
    ],
  },

  // ── Vacancy: Frontend Engineer ─────────────────────────────────────────────
  {
    _id:          "workengine_vacancy_fe",
    _type:        "vacancy",
    tenantId:     "workengine",
    title:        "Senior Frontend Engineer",
    slug:         { _type: "slug", current: "senior-frontend-engineer" },
    isPublished:  true,
    location:     "Amsterdam",
    remote:       "hybrid",
    contractType: "full-time",
    department:   "Engineering",
    hoursPerWeek: "32–40 uur",
    salaryRange:  "€5 000 – €6 500 per maand",
    startDate:    "2025-05-01",
    closingDate:  "2025-04-15",
    description: [
      paragraph(
        "Als Senior Frontend Engineer bij WorkEngine bouw je mee aan het platform dat dagelijks duizenden kandidaten en werkgevers bij elkaar brengt.",
      ),
      paragraph(
        "Je werkt in een klein, autonoom team en hebt directe impact op de gebruikerservaring van zowel kandidaten als recruiters.",
      ),
    ],
    requirements: [
      "5+ jaar ervaring met React of een vergelijkbaar framework",
      "Sterke TypeScript-vaardigheden",
      "Ervaring met Next.js (App Router een pre)",
      "Oog voor detail en passie voor UX",
      "Goede communicatieve vaardigheden in Nederlands en Engels",
    ],
    processSteps: [
      {
        _key:        "step_intake",
        title:       "Kennismaking",
        description: "Een kort telefonisch gesprek met onze recruiter om kennis te maken.",
      },
      {
        _key:        "step_tech",
        title:       "Technische assessment",
        description: "Een praktische opdracht (max. 3 uur) om je aanpak te laten zien.",
      },
      {
        _key:        "step_interview",
        title:       "Eindgesprek",
        description: "Gesprek met het teamlead en een collega-developer over fit en ambitie.",
      },
      {
        _key:        "step_offer",
        title:       "Aanbod",
        description: "Binnen vijf werkdagen ontvangt u een schriftelijk aanbod.",
      },
    ],
    recruiter: {
      name:  "Lars Hendriks",
      role:  "Tech Recruiter",
      email: "lars@workengine.nl",
      phone: "+31 6 12 34 56 78",
    },
  },

] as const;

// ── Seed runner ────────────────────────────────────────────────────────────────

/**
 * Uploads all WorkEngine seed documents to Sanity using `createOrReplace`.
 * Safe to run multiple times — existing documents are overwritten cleanly.
 *
 * @param dryRun  When true, prints documents without writing to Sanity.
 */
export async function seedWorkEngine(dryRun = false): Promise<void> {
  console.log(`\n🌱  WorkEngine seed — ${dryRun ? "DRY RUN" : "LIVE"}\n`);

  if (dryRun) {
    console.log(`Would create/replace ${workengineDocuments.length} documents:\n`);
    for (const doc of workengineDocuments) {
      console.log(`  ${doc._id}  (${doc._type})`);
    }
    console.log("\n✅  Dry run complete.\n");
    return;
  }

  const client = createWriteClient();

  let successCount = 0;
  let errorCount   = 0;

  for (const doc of workengineDocuments) {
    try {
      await client.createOrReplace(doc as Parameters<typeof client.createOrReplace>[0]);
      console.log(`  ✅  ${doc._id}`);
      successCount++;
    } catch (err) {
      console.error(`  ❌  ${doc._id}`, err instanceof Error ? err.message : err);
      errorCount++;
    }
  }

  console.log(`\n🌱  Seed complete: ${successCount} ok, ${errorCount} errors.\n`);

  if (errorCount > 0) {
    process.exit(1);
  }
}

// ── CLI entry-point ────────────────────────────────────────────────────────────

// Run when invoked directly: npx tsx cms/seed/workengine-seed.ts [--dry-run]
const isDirect =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("workengine-seed.ts") || process.argv[1].endsWith("workengine-seed.js"));

if (isDirect) {
  const dryRun = process.argv.includes("--dry-run");
  seedWorkEngine(dryRun).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
