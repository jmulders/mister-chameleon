/**
 * Platform Seed Content — Shared Variant Documents
 *
 * Shared Sanity documents that belong to NO specific tenant.
 * Any Sanity-backed tenant can use these as fallback content when no
 * tenant-specific document exists for the requested variant key.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   Set your environment variables first:
 *     SANITY_PROJECT_ID=your_project_id
 *     SANITY_DATASET=production
 *     SANITY_WRITE_TOKEN=your_write_token   (needs write access)
 *
 *   Then run:
 *     npx tsx cms/seed/platform-seed.ts
 *
 *   Or from the project root:
 *     npx tsx cms/seed/platform-seed.ts --dry-run
 *     (prints documents without writing to Sanity)
 *
 * ─── What is seeded ───────────────────────────────────────────────────────────
 *
 *   Hero variants (no tenantId — shared platform content)
 *     hero_google_problem     Problem-aware copy for Google traffic
 *     hero_linkedin_vision    Vision-forward copy for LinkedIn traffic
 *     hero_direct_brand       Brand clarity — safe fallback for all visitors
 *
 *   Proof variants (no tenantId — shared platform content)
 *     proof_cases             Concrete case studies and ROI numbers
 *     proof_vision            Analyst quotes and industry recognition
 *     proof_platform          Platform scale and reliability stats
 *
 *   CTA variants (no tenantId — shared platform content)
 *     cta_guide               Low-friction nurture: free playbook download
 *     cta_platform            Product-led: start for free
 *     cta_meeting             Sales-led: book a demo
 *
 * ─── Resolution order ─────────────────────────────────────────────────────────
 *
 *   The Sanity GROQ query resolves variants in this order:
 *     1. Tenant-specific document (tenantId == $tenantId)  — highest priority
 *     2. Shared/platform document (!defined(tenantId))     — this seed
 *
 *   These shared documents are the last resort before the experience composer
 *   throws an error. Tenants should provide their own variants for any key
 *   the decision engine may select — these exist to prevent hard failures
 *   during development and for tenants that haven't seeded their own content.
 *
 * ─── Notes ────────────────────────────────────────────────────────────────────
 *
 *   - All documents use `createOrReplace` so re-running the script is safe.
 *   - The `key` field is a Sanity slug: { _type: "slug", current: "..." }.
 *   - No `tenantId` field is set — these are genuinely shared across all tenants.
 *   - Proof `items[]` include `_key` fields (Sanity array item requirement).
 *   - CTA hrefs use real anchor paths that pass the placeholder-href check.
 *   - Content mirrors the MockCMSProvider so Sanity and mock parity is maintained.
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

// ── Seed documents ────────────────────────────────────────────────────────────

/**
 * All shared platform variant documents.
 * No `tenantId` field — these serve every tenant as a shared fallback.
 */
export const platformDocuments = [

  // ── Hero variants ─────────────────────────────────────────────────────────

  /**
   * hero_google_problem
   * Audience: searchers who typed a problem into Google.
   * Framing:  Urgency. Name the pain before offering the solution.
   */
  {
    _id:      "hero_google_problem",
    _type:    "heroVariant",
    // no tenantId — shared platform document
    key:      { _type: "slug", current: "hero_google_problem" },
    isActive: true,
    tag:      "Stop sending every visitor to the same page",
    title:    "Your website speaks to no one. Fix that in minutes.",
    subtitle:
      "Most visitors leave because your homepage wasn't written for them. " +
      "Mister Chameleon detects where they came from and instantly serves the " +
      "version of your site that converts.",
    ctaLabel: "See how it works",
    ctaHref:  "/how-it-works",
  },

  /**
   * hero_linkedin_vision
   * Audience: professionals scrolling a thought-leadership feed.
   * Framing:  Vision. Speak to where the industry is going, not the pain.
   */
  {
    _id:      "hero_linkedin_vision",
    _type:    "heroVariant",
    // no tenantId — shared platform document
    key:      { _type: "slug", current: "hero_linkedin_vision" },
    isActive: true,
    tag:      "The future of websites is contextual",
    title:    "Your website, ever-adapting.",
    subtitle:
      "Mister Chameleon is the platform for growth teams who believe personalisation " +
      "shouldn't require an engineering sprint, a data science team, or a six-figure " +
      "enterprise contract.",
    ctaLabel: "Explore the platform",
    ctaHref:  "/platform",
  },

  /**
   * hero_direct_brand
   * Audience: typed URL, bookmark, or dark social — intent unknown.
   * Framing:  Brand clarity. Lead with the core value proposition.
   * Also used as the last-resort FALLBACK_PLAN heroKey.
   */
  {
    _id:      "hero_direct_brand",
    _type:    "heroVariant",
    // no tenantId — shared platform document
    key:      { _type: "slug", current: "hero_direct_brand" },
    isActive: true,
    tag:      "Adaptive websites, without the complexity",
    title:    "Your website, tailored to every visitor.",
    subtitle:
      "Mister Chameleon delivers the right message to the right person — automatically. " +
      "No A/B testing required. No engineering sprints. No excuses.",
    ctaLabel: "Start for free",
    ctaHref:  "/signup",
  },

  // ── Proof variants ────────────────────────────────────────────────────────

  /**
   * proof_cases
   * Audience: problem-aware searchers who need ROI evidence.
   * Framing:  Hard numbers and time-to-value.
   */
  {
    _id:      "proof_cases",
    _type:    "proofVariant",
    // no tenantId — shared platform document
    key:      { _type: "slug", current: "proof_cases" },
    isActive: true,
    title:    "Conversion lifts that speak for themselves",
    items: [
      {
        _key:  "cases-item-1",
        title: "3.2× more qualified leads",
        text:
          "SaaS teams using Mister Chameleon see an average 3.2× lift in demo " +
          "requests within 30 days of going live — no engineering changes required.",
      },
      {
        _key:  "cases-item-2",
        title: "First experience live in under 5 minutes",
        text:
          "Connect your domain, define two rules, and your first adaptive experience " +
          "is live. Most teams are shipping within a single afternoon.",
      },
      {
        _key:  "cases-item-3",
        title: "12 visitor signals, evaluated in real time",
        text:
          "Source, device, campaign, recency, and more — every visit triggers a silent " +
          "evaluation so the right experience loads before the page paints.",
      },
    ],
  },

  /**
   * proof_vision
   * Audience: LinkedIn visitors in thought-leadership mode.
   * Framing:  Industry recognition and forward-looking positioning.
   */
  {
    _id:      "proof_vision",
    _type:    "proofVariant",
    // no tenantId — shared platform document
    key:      { _type: "slug", current: "proof_vision" },
    isActive: true,
    title:    "What the industry is saying",
    items: [
      {
        _key:  "vision-item-1",
        title: "Recognised by Product Hunt",
        text:
          "#1 Product of the Day — 'Mister Chameleon is what adaptive marketing " +
          "infrastructure should look like. Finally, personalisation without the platform tax.'",
      },
      {
        _key:  "vision-item-2",
        title: "Built for the next decade of growth",
        text:
          "Purpose-built for the era when every visitor expects a tailored experience, " +
          "but engineering bandwidth is the scarcest resource on the team.",
      },
      {
        _key:  "vision-item-3",
        title: "Zero-engineer personalisation — at scale",
        text:
          "The only platform that brings decision-engine-grade adaptivity to marketing " +
          "and product teams who don't have a machine learning department.",
      },
    ],
  },

  /**
   * proof_platform
   * Audience: direct/brand visitors — evaluating the platform itself.
   * Framing:  Technical credibility and reliability.
   * Also used as the last-resort FALLBACK_PLAN proofKey.
   */
  {
    _id:      "proof_platform",
    _type:    "proofVariant",
    // no tenantId — shared platform document
    key:      { _type: "slug", current: "proof_platform" },
    isActive: true,
    title:    "Infrastructure you can trust",
    items: [
      {
        _key:  "platform-item-1",
        title: "Edge-native decision engine",
        text:
          "Context detection and experience resolution happen at the CDN edge — " +
          "sub-5ms latency with no origin round-trip, regardless of visitor location.",
      },
      {
        _key:  "platform-item-2",
        title: "99.99% uptime SLA",
        text:
          "Deployed across a global active-active edge network with automatic failover, " +
          "zero-downtime deployments, and a public status page.",
      },
      {
        _key:  "platform-item-3",
        title: "GDPR & CCPA compliant by default",
        text:
          "No PII is collected or stored. Every signal is evaluated ephemerally, in " +
          "memory, in real time. Your visitors' privacy is preserved automatically.",
      },
    ],
  },

  // ── CTA variants ──────────────────────────────────────────────────────────

  /**
   * cta_guide
   * Audience: Google visitors not yet ready to sign up.
   * Framing:  Low-friction nurture. Give before asking.
   */
  {
    _id:      "cta_guide",
    _type:    "ctaVariant",
    // no tenantId — shared platform document
    key:      { _type: "slug", current: "cta_guide" },
    isActive: true,
    title:    "Get the Adaptive Website Playbook",
    text:
      "A practical, no-fluff guide to personalising your homepage for your three " +
      "highest-value traffic sources. Free. No email gate.",
    ctaLabel: "Download the playbook",
    ctaHref:  "/playbook",
  },

  /**
   * cta_platform
   * Audience: LinkedIn visitors in product-evaluation mode.
   * Framing:  Product-led. Remove the barrier to starting.
   */
  {
    _id:      "cta_platform",
    _type:    "ctaVariant",
    // no tenantId — shared platform document
    key:      { _type: "slug", current: "cta_platform" },
    isActive: true,
    title:    "Start building for free",
    text:
      "Your first adaptive experience is free, forever. No credit card, no sales call, " +
      "no six-month onboarding. Just connect, configure, and ship.",
    ctaLabel: "Create your free account",
    ctaHref:  "/signup",
  },

  /**
   * cta_meeting
   * Audience: direct/brand visitors — likely evaluation or awareness stage.
   * Framing:  Sales-led. A concrete, low-commitment next step.
   * Also used as the last-resort FALLBACK_PLAN ctaKey.
   */
  {
    _id:      "cta_meeting",
    _type:    "ctaVariant",
    // no tenantId — shared platform document
    key:      { _type: "slug", current: "cta_meeting" },
    isActive: true,
    title:    "See Mister Chameleon in action",
    text:
      "Book a 20-minute live demo. We'll show you exactly how your homepage would " +
      "look to your three most important visitor segments.",
    ctaLabel: "Book a demo",
    ctaHref:  "/demo",
  },

] as const;

// ── Seed runner ────────────────────────────────────────────────────────────────

/**
 * Uploads all shared platform documents to Sanity using `createOrReplace`.
 * Safe to run multiple times — existing documents are overwritten cleanly.
 *
 * Run this once per Sanity project, before any tenant-specific seeds.
 * Tenant seeds (e.g. workengine-seed.ts) can be run independently.
 *
 * @param dryRun  When true, prints documents without writing to Sanity.
 */
export async function seedPlatform(dryRun = false): Promise<void> {
  console.log(`\n🌱  Platform seed (shared variants) — ${dryRun ? "DRY RUN" : "LIVE"}\n`);

  if (dryRun) {
    console.log(`Would create/replace ${platformDocuments.length} documents:\n`);
    for (const doc of platformDocuments) {
      console.log(`  ${doc._id}  (${doc._type})`);
    }
    console.log("\n✅  Dry run complete.\n");
    return;
  }

  const client = createWriteClient();

  let successCount = 0;
  let errorCount   = 0;

  for (const doc of platformDocuments) {
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

// Run when invoked directly: npx tsx cms/seed/platform-seed.ts [--dry-run]
const isDirect =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("platform-seed.ts") || process.argv[1].endsWith("platform-seed.js"));

if (isDirect) {
  const dryRun = process.argv.includes("--dry-run");
  seedPlatform(dryRun).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
