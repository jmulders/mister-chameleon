/**
 * Tenant CMS Provisioner
 *
 * Builds and writes starter Sanity documents for a tenant that has been
 * configured in the admin.  Called by `provisionSiteAction` (server action)
 * when an operator clicks "Provision site to CMS" on the tenant detail page.
 *
 * ─── What gets provisioned ────────────────────────────────────────────────────
 *
 *   For every tenant (variant documents — always written):
 *     hero_default        (tenantId set)  — Starter hero variant
 *     proof_default       (tenantId set)  — Starter proof variant
 *     cta_default         (tenantId set)  — Starter CTA variant
 *     feature_default     (tenantId set)  — Starter feature highlights variant
 *     conversion_default  (tenantId set)  — Starter conversion block variant
 *
 *   Variant keys are tenant-scoped: the business key (e.g. "hero_default") is
 *   reusable across tenants. The Sanity document _id is still namespaced as
 *   hero_{tenantId}_default to guarantee dataset-wide uniqueness, but the
 *   key field — which the decision engine and GROQ queries use — is a plain
 *   string: a clean, non-suffixed identifier shared within a tenant's own key space.
 *
 *   Page documents — two modes:
 *
 *   With siteType (new tenant bootstrap):
 *     Pages are built from the matching site preset (corporate | recruitment |
 *     content) — no page-store read.  All preset entries produce a Sanity doc.
 *     Content depth is controlled by the includeDefaultBlocks and
 *     starterContentMode options passed from the "Initialize site" panel:
 *       includeDefaultBlocks = false  → empty sections (clean slate)
 *       starterContentMode = "none"   → block stubs only (no dummy copy)
 *       starterContentMode = "fill"   → rich starter copy; existing pages preserved
 *       starterContentMode = "overwrite" → rich starter copy; always replaced
 *
 *   Without siteType (re-provision / legacy):
 *     {tenantId}_page_home          — Homepage (package-gated sections)
 *     {tenantId}_page_about         — About page (starter or stored)
 *     {tenantId}_page_contact       — Contact page (starter or stored)
 *     {tenantId}_page_{slug}…       — Any additional pages from the page store
 *
 *     Starter pages for home/about/contact are always included.  If the page
 *     store contains a page with the same slug, the stored version replaces the
 *     starter.  Extra slugs in the store are appended.
 *
 * ─── Idempotency ──────────────────────────────────────────────────────────────
 *
 *   All documents are written via `createOrReplace`.  Re-running provisioning
 *   for a tenant that has already been provisioned is safe — existing documents
 *   are replaced.  Operators are warned in the UI.
 *
 * ─── Config resolution ────────────────────────────────────────────────────────
 *
 *   Project ID + dataset resolution (highest → lowest priority):
 *     1. Platform Settings dashboard (Admin → Platform Settings → Sanity)
 *     2. SANITY_PROJECT_ID / SANITY_DATASET env vars  (local/CI fallback)
 *
 *   Write token resolution (highest → lowest priority):
 *     1. Per-tenant writeToken stored in TenantCmsSettings  (admin-configured)
 *     2. Platform Settings dashboard write token             (admin-configured)
 *     3. SANITY_API_WRITE_TOKEN env var                      (preferred naming)
 *     4. SANITY_WRITE_TOKEN env var                          (legacy naming)
 *
 *   Platform settings are fetched once at the start of each provisioning run.
 *   If the platform settings store is unavailable (e.g. DB offline during CLI
 *   usage), the error is caught silently and the env-var fallbacks are used
 *   instead — preserving the existing behaviour for local dev and CI.
 *
 *   The active source for each credential is always logged (without secret
 *   values) so operators can diagnose permission issues without guessing which
 *   credential is in use.
 *
 * ─── Server-only ──────────────────────────────────────────────────────────────
 *
 *   This module requires a Sanity write token.  It must only be imported from
 *   server-only contexts (Server Actions, API routes, CLI scripts).
 *
 * ─── Usage (server action) ────────────────────────────────────────────────────
 *
 *   import { provisionTenant } from "@/cms/seed/tenant-provisioner";
 *   const result = await provisionTenant(tenant);
 *   if (!result.ok) { ... }
 *
 * ─── Usage (CLI dry-run) ──────────────────────────────────────────────────────
 *
 *   SANITY_PROJECT_ID=... SANITY_API_WRITE_TOKEN=... \
 *     npx tsx cms/seed/tenant-provisioner.ts --tenant=workengine [--dry-run]
 */

import { createClient }              from "@sanity/client";
import { getPackageDefinition }      from "@/tenant/packages";
import { getPlatformSanitySettings } from "@/platform/platform-store";
import { getPagesByTenant }          from "@/page-store";
import { getSitePreset, getPreset, getAllBlockDefinitions, isRegisteredBlockType } from "@/page-config";
import type { TenantSettings }       from "@/tenant/types";
import type { ContentBlockKey }      from "@/tenant/types";
import type { EditablePage }         from "@/page-store";
// ProvisionResult and StarterContentMode are defined on the CMSProvider interface
// so they can be shared across all provider implementations without duplication.
import type { ProvisionResult, StarterContentMode } from "@/cms/providers/cms-provider";

// ── Config resolution types ────────────────────────────────────────────────────

/**
 * The source that provided the effective Sanity write token.
 * Used in diagnostic log messages — never exposed to the client.
 */
type WriteTokenSource =
  | "tenant cms_write_token"
  | "platform settings"
  | "SANITY_API_WRITE_TOKEN"
  | "SANITY_WRITE_TOKEN";

interface WriteTokenResolution {
  /** The resolved token value — never log this. */
  token:  string;
  /** Human-readable source label — safe to log. */
  source: WriteTokenSource;
}

/** The source that provided the project ID or dataset. */
type CoordinateSource = "platform settings" | "env var";

interface ResolvedSanityConfig {
  projectId:        string;
  projectIdSource:  CoordinateSource;
  dataset:          string;
  datasetSource:    CoordinateSource | "default";
  tokenResolution:  WriteTokenResolution;
}

// ── Write token resolution ─────────────────────────────────────────────────────

/**
 * Resolves the effective Sanity write token and identifies which source
 * provided it.
 *
 * Priority (highest → lowest):
 *   1. Per-tenant writeToken from TenantCmsSettings  (admin-configured)
 *   2. Platform Settings write token                  (admin-configured)
 *   3. SANITY_API_WRITE_TOKEN env var                 (preferred naming)
 *   4. SANITY_WRITE_TOKEN env var                     (legacy naming)
 *
 * Returns `null` when no token is configured in any source, so callers can
 * surface a clear "no token" error rather than an obscure Sanity 401.
 *
 * IMPORTANT: never pass `.token` to a log call.  Log only `.source`.
 */
function resolveWriteToken(
  tenantWriteToken?:   string,
  platformWriteToken?: string,
): WriteTokenResolution | null {
  if (tenantWriteToken?.trim()) {
    return { token: tenantWriteToken.trim(), source: "tenant cms_write_token" };
  }
  if (platformWriteToken?.trim()) {
    return { token: platformWriteToken.trim(), source: "platform settings" };
  }
  if (process.env.SANITY_API_WRITE_TOKEN?.trim()) {
    return {
      token:  process.env.SANITY_API_WRITE_TOKEN.trim(),
      source: "SANITY_API_WRITE_TOKEN",
    };
  }
  if (process.env.SANITY_WRITE_TOKEN?.trim()) {
    return {
      token:  process.env.SANITY_WRITE_TOKEN.trim(),
      source: "SANITY_WRITE_TOKEN",
    };
  }
  return null;
}

// ── Sanity config resolution ───────────────────────────────────────────────────

/**
 * Resolves the full Sanity project configuration needed for a provisioning run.
 *
 * Loads platform settings from the database first; falls back to environment
 * variables when the store is unavailable or a field is not configured there.
 *
 * Returns `null` when required config (projectId or write token) is missing
 * from all sources — callers render a human-readable error in that case.
 *
 * @param tenantWriteToken  Optional per-tenant override token from TenantCmsSettings.
 */
async function resolveSanityConfig(
  tenantWriteToken?: string,
): Promise<ResolvedSanityConfig | { error: string }> {
  // ── Step 1: Load platform settings (best-effort) ──────────────────────────
  //
  // Failures here are non-fatal — they fall through to env-var fallback.
  // This ensures the provisioner continues to work in CLI and dev contexts
  // where the database may not be configured.
  let platformProjectId:  string | undefined;
  let platformDataset:    string | undefined;
  let platformWriteToken: string | undefined;

  try {
    const platformResult = await getPlatformSanitySettings();
    if (platformResult.ok) {
      platformProjectId  = platformResult.data.projectId?.trim()  || undefined;
      platformDataset    = platformResult.data.dataset?.trim()    || undefined;
      platformWriteToken = platformResult.data.writeToken?.trim() || undefined;
    }
  } catch {
    // Platform settings store unavailable — fall through to env vars.
    // No warning is emitted here because this is an expected state for CLI usage.
  }

  // ── Step 2: Resolve project ID ─────────────────────────────────────────────
  //
  // Platform settings take priority; env var is the fallback.
  const projectId       = platformProjectId ?? process.env.SANITY_PROJECT_ID;
  const projectIdSource = platformProjectId ? "platform settings" : "env var";

  if (!projectId) {
    return {
      error:
        "Sanity project ID is not configured. " +
        "Set it in Admin → Platform Settings → Sanity (projectId field), " +
        "or add SANITY_PROJECT_ID to your environment variables.",
    };
  }

  // ── Step 3: Resolve dataset ────────────────────────────────────────────────
  const dataset       = platformDataset ?? process.env.SANITY_DATASET ?? "production";
  const datasetSource: CoordinateSource | "default" =
    platformDataset              ? "platform settings"
    : process.env.SANITY_DATASET ? "env var"
    : "default";

  // ── Step 4: Resolve write token ────────────────────────────────────────────
  const tokenResolution = resolveWriteToken(tenantWriteToken, platformWriteToken);

  if (!tokenResolution) {
    return {
      error:
        "No Sanity write token configured. " +
        "Set one in Admin → Platform Settings → Sanity (write token field), " +
        "add SANITY_API_WRITE_TOKEN to your environment variables, " +
        "or configure a per-tenant token in the tenant's CMS Credentials panel.",
    };
  }

  return { projectId, projectIdSource, dataset, datasetSource, tokenResolution };
}

// ── Slug → document ID sanitizer ──────────────────────────────────────────────

/**
 * Converts a page slug to a safe Sanity document ID segment.
 *
 * Sanity document _id values must not contain `/`.  Slugs like "news/article"
 * would produce an invalid ID like "workengine_page_news/article".
 *
 * This function replaces every `/` with `__` (double underscore) so nested
 * slugs produce stable, valid, and human-readable IDs:
 *
 *   "home"         → "home"
 *   "about"        → "about"
 *   "news/article" → "news__article"
 *
 * The slug field inside the document data is always stored unchanged — only
 * the _id uses this sanitized form.
 *
 * The mapping is injective for all slug values that do not themselves contain
 * `__` at a slash boundary, which is the universal convention in this codebase.
 */
function slugToIdSegment(slug: string): string {
  return slug.replace(/\//g, "__");
}

/**
 * Builds the stable Sanity document _id for a page.
 *
 * Pattern: `{tenantId}_page_{sanitizedSlug}`
 *
 * Examples:
 *   pageDocId("workengine",       "home")         → "workengine_page_home"
 *   pageDocId("workengine",       "about")        → "workengine_page_about"
 *   pageDocId("workengine",       "news/article") → "workengine_page_news__article"
 *   pageDocId("mister-chameleon", "home")         → "mister-chameleon_page_home"
 */
function pageDocId(tenantId: string, slug: string): string {
  return `${tenantId}_page_${slugToIdSegment(slug)}`;
}

// ── Sanity write client ────────────────────────────────────────────────────────

/**
 * Creates a Sanity write client from pre-resolved credentials.
 *
 * Accepts the token and project coordinates as explicit arguments rather than
 * re-reading env vars, so the client is guaranteed to use the same values that
 * were validated and logged by the caller.
 */
function createWriteClient(
  resolvedToken: string,
  projectId:     string,
  dataset:       string,
) {
  return createClient({
    projectId,
    dataset,
    token:      resolvedToken,
    apiVersion: process.env.SANITY_API_VERSION ?? "2024-01-01",
    useCdn:     false,
  });
}

// ── Portable Text helpers ──────────────────────────────────────────────────────

function paragraph(text: string) {
  return {
    _type:    "block",
    _key:     uniqueKey("p"),
    style:    "normal",
    children: [{ _type: "span", _key: "s1", text, marks: [] }],
    markDefs: [],
  };
}

let _keyCounter = 0;
function uniqueKey(prefix = "k"): string {
  _keyCounter++;
  return `${prefix}${Date.now().toString(36)}${_keyCounter.toString(36)}`;
}

// ── Display name helper ────────────────────────────────────────────────────────

/**
 * Converts a tenantId slug to a human-readable display name.
 * "workengine"  → "Workengine"
 * "acme-corp"   → "Acme Corp"
 * "my-brand-io" → "My Brand Io"
 */
function tenantDisplayName(tenantId: string): string {
  return tenantId
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// ── Seeded content constants ──────────────────────────────────────────────────
//
// Stable slugs and metadata for the three starter news articles and three
// starter case study company docs written during provisioning.  Using constants
// here ensures the listing section item hrefs and the detail page slugs are
// always kept in sync.

const SEEDED_NEWS_ITEMS = [
  {
    slug:     "five-trends-reshaping-professional-services",
    title:    "Five Trends Reshaping Professional Services in 2025",
    excerpt:  "From AI-augmented delivery to purpose-driven talent strategies — our analysis of the forces that will define the industry this year and beyond.",
    date:     "2025-01-15",
    category: "Industry Insights",
  },
  {
    slug:     "building-high-performance-teams",
    title:    "Building High-Performance Teams That Last",
    excerpt:  "The science and practice behind assembling, developing, and retaining teams that consistently outperform. What separates great teams from good ones?",
    date:     "2024-11-28",
    category: "Leadership",
  },
  {
    slug:     "the-future-of-work-remote-hybrid",
    title:    "The Future of Work: Remote, Hybrid, and What Comes Next",
    excerpt:  "Remote-first, AI-augmented, and purpose-driven — the new baseline for attracting top professional services talent in a post-pandemic world.",
    date:     "2024-09-12",
    category: "Future of Work",
  },
] as const;

const SEEDED_CASE_ITEMS = [
  {
    slug:     "apex-doubled-revenue",
    title:    "How Apex Doubled Their Revenue in 18 Months",
    excerpt:  "A deep dive into how we helped Apex Solutions restructure their operations and achieve 2× revenue growth through focused strategic alignment.",
    date:     "2024-12-01",
    category: "Strategy",
  },
  {
    slug:     "meridian-from-reactive-to-strategic",
    title:    "Meridian Group: From Reactive to Strategic",
    excerpt:  "Meridian Group partnered with us to shift from fire-fighting mode to long-term strategic clarity — with measurable results within six months.",
    date:     "2024-10-15",
    category: "Transformation",
  },
  {
    slug:     "elevate-scaling-without-losing-culture",
    title:    "Elevate Partners: Scaling Without Losing Culture",
    excerpt:  "When Elevate Partners needed to scale quickly without sacrificing culture, they called us. Here is how we helped them grow without losing what made them great.",
    date:     "2024-08-20",
    category: "Growth",
  },
] as const;

// ── Document builders ─────────────────────────────────────────────────────────

function buildHeroVariant(tenantId: string) {
  const name = tenantDisplayName(tenantId);
  return {
    // _id is namespaced by tenantId to remain globally unique in the Sanity dataset.
    // key is a clean tenant-scoped plain string business key — no tenant suffix needed.
    _id:      `hero_${tenantId}_default`,
    _type:    "heroVariant",
    tenantId,
    key:      "hero_default",
    isActive: true,
    tag:      "New",
    title:    `Welcome to ${name}`,
    subtitle:
      `${name} helps you achieve more — with the right people, tools, and content ` +
      `delivered at exactly the right moment.`,
    // Modern ctas[] array (replaces deprecated ctaLabel / ctaHref).
    // Two CTAs: primary "Get Started" + secondary "Learn More".
    ctas: [
      { _key: uniqueKey("cta"), label: "Get Started", href: "/contact", variant: "primary"   },
      { _key: uniqueKey("cta"), label: "Learn More",  href: "/about",   variant: "secondary" },
    ],
    // Starter media: YouTube placeholder.
    // Replace videoId with your own asset or switch mediaType to "image".
    media: {
      mediaType:   "video",
      videoSource: "youtube",
      videoId:     "ScMzIvxBSi4",
    },
  };
}

function buildProofVariant(tenantId: string) {
  const name = tenantDisplayName(tenantId);
  return {
    _id:      `proof_${tenantId}_default`,
    _type:    "proofVariant",
    tenantId,
    key:      "proof_default",
    isActive: true,
    title:    "Why Choose Us",
    items: [
      {
        _key:  uniqueKey("pi"),
        title: "Expertise You Can Trust",
        text:  `${name} brings proven experience and a results-focused approach to every engagement.`,
      },
      {
        _key:  uniqueKey("pi"),
        title: "Fast Time-to-Value",
        text:  "We move quickly — from first conversation to measurable results in weeks, not months.",
      },
      {
        _key:  uniqueKey("pi"),
        title: "Long-term Partnership",
        text:  "Our clients stay because we deliver. We measure success by your outcomes, not ours.",
      },
    ],
  };
}

function buildCtaVariant(tenantId: string) {
  const name = tenantDisplayName(tenantId);
  return {
    _id:      `cta_${tenantId}_default`,
    _type:    "ctaVariant",
    tenantId,
    key:      "cta_default",
    isActive: true,
    title:    "Ready to Get Started?",
    text:
      `Whether you have a question or a specific project in mind, the ${name} team ` +
      `is here to help. Reach out today.`,
    // Modern ctas[] array (replaces deprecated ctaLabel / ctaHref).
    ctas: [
      { _key: uniqueKey("cta"), label: "Get in Touch", href: "/contact", variant: "primary" },
    ],
  };
}

function buildFeatureVariant(tenantId: string) {
  const name = tenantDisplayName(tenantId);
  return {
    // _id namespaced by tenantId for dataset-wide uniqueness.
    // key is a clean, tenant-scoped plain string business key.
    _id:      `feature_${tenantId}_default`,
    _type:    "featureVariant",
    tenantId,
    key:      "feature_default",
    isActive: true,
    title:    `Why ${name}`,
    subtitle: "The capabilities that set us apart.",
    items: [
      {
        _key:  uniqueKey("fi"),
        title: "Deep domain expertise",
        body:
          `${name} brings hands-on experience across a wide range of sectors ` +
          `and challenges — so you get advice grounded in real-world practice.`,
        icon:  "award",
      },
      {
        _key:  uniqueKey("fi"),
        title: "Collaborative approach",
        body:
          "We work alongside your team, not above it. Clear communication, " +
          "shared goals, and genuine partnership from day one.",
        icon:  "users",
      },
      {
        _key:  uniqueKey("fi"),
        title: "Results you can measure",
        body:
          "Every engagement is anchored to outcomes you care about. " +
          "We define success together — and stay accountable to it.",
        icon:  "bar-chart-2",
      },
    ],
  };
}

function buildConversionVariant(tenantId: string) {
  const name = tenantDisplayName(tenantId);
  return {
    // _id namespaced by tenantId for dataset-wide uniqueness.
    // key is a clean, tenant-scoped plain string business key.
    _id:      `conversion_${tenantId}_default`,
    _type:    "conversionVariant",
    tenantId,
    key:      "conversion_default",
    isActive: true,
    title:    "Let's talk about what you need",
    text:
      `Whether you have a clear brief or just an early idea, the ${name} team ` +
      `is ready to listen and help you find the right path forward.`,
    ctas: [
      { _key: uniqueKey("cta"), label: "Get in Touch", href: "/contact", variant: "primary" },
    ],
    urgencyLabel: "No commitment required — just a conversation",
  };
}

/**
 * @deprecated Use buildPresetSections() with the "homepage_corporate" preset instead.
 *
 * Retained for backward compatibility only. No longer called from the
 * main provisioning path.  Remove once the legacy re-provision path is
 * fully migrated.
 *
 * Builds the homepage sections array, gated by the tenant's package.
 *
 * Only sections whose `_type` maps to an allowed ContentBlockKey are included.
 * The starter package only allows textSection; growth and pro unlock
 * featureGrid and testimonialSection.
 */
function buildHomepageSections(
  tenantId:       string,
  allowedContent: readonly ContentBlockKey[],
): object[] {
  const name    = tenantDisplayName(tenantId);
  const allowed = new Set<string>(allowedContent);
  const sections: object[] = [];

  // ── textSection (starter+) ────────────────────────────────────────────────
  if (allowed.has("textSection")) {
    sections.push({
      _type:   "textSection",
      _key:    uniqueKey("ts"),
      heading: `About ${name}`,
      body: [
        paragraph(
          `${name} is built to deliver results. We combine deep domain expertise ` +
          `with a personal approach to ensure every client gets what they actually need.`,
        ),
        paragraph(
          `Our team is ready to help you grow — whether that means finding the right ` +
          `talent, delivering an innovative solution, or simply getting out of the way ` +
          `so you can focus on what matters most.`,
        ),
      ],
    });
  }

  // ── featureGrid (growth+) ─────────────────────────────────────────────────
  if (allowed.has("featureGrid")) {
    sections.push({
      _type:    "featureGrid",
      _key:     uniqueKey("fg"),
      heading:  `What We Do`,
      features: [
        {
          _key:        uniqueKey("f"),
          title:       "Strategy",
          description: "We help you define a clear path forward — from initial discovery to a concrete action plan.",
          icon:        "lightbulb",
        },
        {
          _key:        uniqueKey("f"),
          title:       "Delivery",
          description: "We execute with precision. Our team brings structure and accountability to every project.",
          icon:        "briefcase",
        },
        {
          _key:        uniqueKey("f"),
          title:       "Support",
          description: "We stay engaged after launch. Long-term success is our measure — not the handover date.",
          icon:        "users",
        },
      ],
    });
  }

  // ── testimonialSection (growth+) ─────────────────────────────────────────
  if (allowed.has("testimonialSection")) {
    sections.push({
      _type:        "testimonialSection",
      _key:         uniqueKey("tes"),
      heading:      "What Our Clients Say",
      testimonials: [
        {
          _key:    uniqueKey("t"),
          quote:   `Working with ${name} changed how we approach this entirely. The results speak for themselves.`,
          author:  "A Satisfied Client",
          company: "Client Organisation",
        },
        {
          _key:    uniqueKey("t"),
          quote:   `The team is responsive, professional, and genuinely invested in outcomes. We'd recommend them to anyone.`,
          author:  "Another Happy Client",
          company: "Partner Organisation",
        },
      ],
    });
  }

  return sections;
}

// ── Starter section builders ──────────────────────────────────────────────────
//
// Produce Sanity section objects for any preset block type.
//
//   mode = "none"             — minimal stub: only _type + _key (no dummy copy)
//   mode = "fill"|"overwrite" — rich dummy copy suitable for immediate preview

/**
 * Builds a single Sanity section object for a given content block type.
 *
 * Returns a minimal stub when `mode` is "none", and rich starter copy when
 * mode is "fill" or "overwrite".  Unknown block types always return the stub
 * so provisioning never fails on unrecognised types.
 *
 * @param blockType  The `_type` of the Sanity section block.
 * @param variant    Optional variant key from the preset (passed through as-is).
 * @param tenantId   Used to personalise stub text where helpful.
 * @param mode       StarterContentMode determining content depth.
 */
function buildStarterSection(
  blockType: string,
  variant:   string | undefined,
  tenantId:  string,
  mode:      StarterContentMode,
  presetKey?: string,
): object {
  const name = tenantDisplayName(tenantId);
  const key  = uniqueKey(blockType.slice(0, 4));

  // Minimal structural stub — used for "none" mode and as a base for rich modes.
  const stub = { _type: blockType, _key: key, ...(variant ? { variant } : {}) };

  if (mode === "none") return stub;

  // ── Rich starter copy ─────────────────────────────────────────────────────
  //
  // "fill" and "overwrite" modes.  Every registered block type has its own
  // realistic dummy content that an editor can immediately use or replace.
  // The content is generic but plausible — no lorem ipsum.
  //
  // Guidelines:
  //   • Headings are sentence-case, action-oriented, and < 8 words.
  //   • Body copy is 1–2 short paragraphs; professional but warm.
  //   • CTAs link to /contact (safe on any site).
  //   • List items use the tenant name where it makes the copy feel personal.
  //   • Unknown / future block types fall through to the stub at the bottom.

  switch (blockType) {

    // ── Text / copy ──────────────────────────────────────────────────────────

    case "textSection":
      // ── Team page intro ───────────────────────────────────────────────────
      if (presetKey === "team_default") {
        return {
          ...stub,
          heading: "Meet the Team",
          body: [
            paragraph(
              `The ${name} team brings together specialists across strategy, delivery, and ` +
              `client success — united by a genuine commitment to the outcomes we help create.`,
            ),
            paragraph(
              `We believe great results come from great relationships. Each member of the team ` +
              `is selected not just for their expertise, but for their ability to work closely ` +
              `with clients and deliver with care.`,
            ),
          ],
        };
      }

      // ── Services page intro ───────────────────────────────────────────────
      if (presetKey === "services_default") {
        return {
          ...stub,
          heading: "What Drives Our Approach",
          body: [
            paragraph(
              `Every service we offer starts with a clear understanding of your context. ` +
              `We do not apply off-the-shelf frameworks — we build solutions that fit.`,
            ),
            paragraph(
              `Whether you need strategic clarity, managed change, or one-to-one coaching, ` +
              `${name} delivers with the precision and partnership that produces lasting results.`,
            ),
          ],
        };
      }

      // ── News / cases listing page intro ───────────────────────────────────
      if (presetKey === "listing_news") {
        return {
          ...stub,
          heading: "News & Insights",
          body: [
            paragraph(
              `Stay up to date with the latest thinking from the ${name} team — ` +
              `from industry trends and leadership insights to practical guides and case studies.`,
            ),
          ],
        };
      }

      if (presetKey === "listing_cases") {
        return {
          ...stub,
          heading: "Client Case Studies",
          body: [
            paragraph(
              `Real work. Real results. Browse our case studies to see how ${name} has helped ` +
              `organisations achieve sustainable growth, navigate complex change, and build ` +
              `high-performing teams.`,
            ),
          ],
        };
      }

      // ── Default ───────────────────────────────────────────────────────────
      return {
        ...stub,
        heading: `About ${name}`,
        body: [
          paragraph(
            `${name} is built to deliver results. We combine deep domain expertise ` +
            `with a personal approach to ensure every client gets what they actually need.`,
          ),
          paragraph(
            `Our team is ready to help you grow — whether that means finding the right ` +
            `talent, delivering an innovative solution, or simply getting out of the way ` +
            `so you can focus on what matters most.`,
          ),
        ],
      };

    case "richText":
      return {
        ...stub,
        body: [
          paragraph(
            `${name} brings together people, process, and technology to help organisations ` +
            `move faster and deliver better outcomes.`,
          ),
          paragraph(
            `From initial discovery to long-term partnership, we stay invested in your ` +
            `success at every stage. Edit this block to add your own story.`,
          ),
        ],
      };

    case "contentSection":
      return {
        ...stub,
        heading: "Our Approach",
        body: [
          paragraph(
            `Everything we do starts with understanding. Before we recommend a path ` +
            `forward, we listen — to your goals, your constraints, and the context ` +
            `your team operates in.`,
          ),
          paragraph(
            `That understanding shapes every recommendation we make and every solution ` +
            `we deliver. It's why clients come back — and why they refer others.`,
          ),
        ],
        ctaLabel: "Learn More",
        ctaHref:  "/about",
      };

    // ── Features / grids ─────────────────────────────────────────────────────

    case "featureGrid":
      // ── Team page: show team members instead of generic features ─────────
      if (presetKey === "team_default") {
        return {
          ...stub,
          heading:  "Meet the Team",
          features: [
            {
              _key:        uniqueKey("f"),
              title:       "Alex Rivera",
              description: "Chief Executive Officer — 15 years building high-performing organisations across technology and professional services.",
              icon:        "users",
            },
            {
              _key:        uniqueKey("f"),
              title:       "Jordan Lee",
              description: "Head of Strategy — expert in organisational transformation, stakeholder alignment, and long-range planning.",
              icon:        "lightbulb",
            },
            {
              _key:        uniqueKey("f"),
              title:       "Morgan Clarke",
              description: "Head of Client Success — passionate about ensuring every client relationship delivers measurable, lasting value.",
              icon:        "briefcase",
            },
          ],
        };
      }

      // ── Services page: show services with from-price ──────────────────────
      if (presetKey === "services_default") {
        return {
          ...stub,
          heading:  "Our Services",
          features: [
            {
              _key:        uniqueKey("f"),
              title:       "Strategic Consulting",
              description: "From £1,500 / day — We help organisations define a clear path forward, align stakeholders, and build actionable roadmaps for sustainable growth.",
              icon:        "lightbulb",
            },
            {
              _key:        uniqueKey("f"),
              title:       "Change Management",
              description: "From £2,500 / project — We guide teams through organisational change — from initial diagnosis to embedding new ways of working that stick.",
              icon:        "briefcase",
            },
            {
              _key:        uniqueKey("f"),
              title:       "Executive Coaching",
              description: "From £800 / session — One-to-one coaching for senior leaders navigating complexity, transition, or ambitious growth targets.",
              icon:        "users",
            },
          ],
        };
      }

      // ── Default: generic feature grid ─────────────────────────────────────
      return {
        ...stub,
        heading: "What We Do",
        // NOTE: "subheading" is not a Sanity schema field on featureGrid — omitted
        features: [
          {
            _key:        uniqueKey("f"),
            title:       "Strategy & Planning",
            description: "We help you define a clear path forward — from initial discovery to a concrete action plan that aligns stakeholders.",
            icon:        "lightbulb",
          },
          {
            _key:        uniqueKey("f"),
            title:       "Delivery & Execution",
            description: "We execute with precision, bringing structure, accountability, and clear communication to every engagement.",
            icon:        "briefcase",
          },
          {
            _key:        uniqueKey("f"),
            title:       "Support & Growth",
            description: "We stay engaged after launch. Long-term success is our measure — not the handover date.",
            icon:        "users",
          },
        ],
      };

    // ── About / split media ───────────────────────────────────────────────────

    case "about": {
      // ── Contact page: show location / contact details ─────────────────────
      if (presetKey === "contact_default") {
        return {
          ...stub,
          heading:  "Find Us",
          body: [
            paragraph(
              `The ${name} team is based in London and works with clients across the UK ` +
              `and internationally. Get in touch — we'd love to hear from you.`,
            ),
            paragraph("1 Business Street, City of London, EC1A 1BB"),
            paragraph("Phone: +44 (0)20 0000 0000"),
            paragraph(`Email: hello@${tenantId.replace(/[^a-z0-9-]/g, "")}.com`),
            paragraph("Monday – Friday: 09:00 – 18:00"),
          ],
          imageUrl: "https://picsum.photos/seed/london-office/800/600",
          imageAlt: `${name} — London headquarters`,
        };
      }

      // Differentiate heading/copy by variant so two "about" blocks on the same
      // page (e.g. about_default uses media_right + media_left) look distinct.
      const isSecondVariant = variant === "media_left";
      return {
        ...stub,
        heading: isSecondVariant ? "How We Work" : "Our Story",
        body: isSecondVariant
          ? [
              paragraph(
                `Every engagement starts with listening. Before we recommend anything, ` +
                `we take time to understand your context, constraints, and what success ` +
                `genuinely looks like for your team.`,
              ),
              paragraph(
                `That understanding shapes every recommendation and every solution we ` +
                `deliver. It is why clients come back — and why they refer others.`,
              ),
            ]
          : [
              paragraph(
                `${name} was founded with a single mission: to deliver genuine value to every client we work with.`,
              ),
              paragraph(
                `Today our team brings together expertise across strategy, delivery, and ` +
                `long-term partnership — giving organisations the confidence to move forward ` +
                `with clarity and purpose.`,
              ),
            ],
        // imageUrl / imageAlt are plain string fields on the "about" schema.
        // These placeholder URLs (picsum.photos) render immediately in Studio
        // and the frontend.  Replace with your own asset once uploaded.
        imageUrl: isSecondVariant
          ? "https://picsum.photos/seed/collaboration/800/600"
          : "https://picsum.photos/seed/officeteam/800/600",
        imageAlt: isSecondVariant
          ? "Team collaborating in a modern workspace"
          : `The ${name} team at work`,
        // NOTE: "ctaLabel" and "ctaHref" are not schema fields on "about" — omitted.
        // Use a separate ctaSection block for call-to-action copy.
      };
    }

    case "textMedia":
      return {
        ...stub,
        heading: "Built for the Way You Work",
        body: [
          paragraph(
            `Modern teams need solutions that adapt — not rigid platforms that force ` +
            `you to change how you operate.`,
          ),
          paragraph(
            `${name} takes the time to understand your workflow first, then builds ` +
            `around it. The result is a solution your team actually uses.`,
          ),
        ],
        ctaLabel: "See How It Works",
        ctaHref:  "/services",
      };

    // ── Social proof ──────────────────────────────────────────────────────────

    case "testimonialSection":
      return {
        ...stub,
        heading:      "What Our Clients Say",
        // NOTE: "subheading" is not a schema field on testimonialSection — omitted.
        // NOTE: "role" is not a schema field on testimonialItem — omitted.
        testimonials: [
          {
            _key:    uniqueKey("t"),
            quote:   `Working with ${name} changed how we approach this entirely. We came in with a problem and left with a long-term partner.`,
            author:  "Sarah Mitchell",
            company: "Apex Solutions",
          },
          {
            _key:    uniqueKey("t"),
            quote:   "The team is responsive, professional, and genuinely invested in outcomes. We'd recommend them to anyone serious about results.",
            author:  "James Thornton",
            company: "Meridian Group",
          },
          {
            _key:    uniqueKey("t"),
            quote:   "What impressed us most was how quickly they got up to speed with our context. It felt like they'd been part of the team for years.",
            author:  "Priya Sharma",
            company: "Elevate Partners",
          },
        ],
      };

    case "logoStrip":
      return {
        ...stub,
        heading: "Trusted by organisations across the industry",
        // Schema: logos[].name (required), logos[].src (required), logos[].url (optional)
        // placehold.co URLs render a simple placeholder rectangle in Studio and the frontend.
        // Replace each src with your client's actual logo URL once available.
        logos: [
          { _key: uniqueKey("l"), name: "Apex Solutions",   src: "https://placehold.co/160x60/e2e8f0/64748b?text=Apex"     },
          { _key: uniqueKey("l"), name: "Meridian Group",   src: "https://placehold.co/160x60/e2e8f0/64748b?text=Meridian"  },
          { _key: uniqueKey("l"), name: "Elevate Partners", src: "https://placehold.co/160x60/e2e8f0/64748b?text=Elevate"   },
          { _key: uniqueKey("l"), name: "Summit Capital",   src: "https://placehold.co/160x60/e2e8f0/64748b?text=Summit"    },
          { _key: uniqueKey("l"), name: "Vantage Works",    src: "https://placehold.co/160x60/e2e8f0/64748b?text=Vantage"   },
        ],
      };

    case "stats":
      // Schema: items[].label (required), items[].value (required),
      // items[].prefix, items[].suffix, items[].description.
      if (presetKey === "about_default") {
        // About-page context: highlight company milestones and achievements.
        return {
          ...stub,
          heading: "Our Impact in Numbers",
          items: [
            { _key: uniqueKey("st"), value: "2012",  label: "Founded",            description: "Over a decade of trusted delivery for our clients." },
            { _key: uniqueKey("st"), value: "200+",  label: "Clients served",     description: "Organisations across diverse industries and sizes." },
            { _key: uniqueKey("st"), value: "98%",   label: "Satisfaction rate",  description: "Based on post-engagement feedback surveys." },
            { _key: uniqueKey("st"), value: "40+",   label: "Team members",       description: "Specialists across every core discipline." },
          ],
        };
      }
      // Default: homepage or generic usage — highlight headline metrics.
      return {
        ...stub,
        heading: `${name} by the Numbers`,
        items: [
          { _key: uniqueKey("st"), value: "200+",   label: "Clients served",    description: "Across diverse industries and organisation sizes." },
          { _key: uniqueKey("st"), value: "98%",    label: "Satisfaction rate", description: "Based on post-engagement feedback surveys." },
          { _key: uniqueKey("st"), value: "12 yrs", label: "In operation",      description: "A decade of expertise you can rely on." },
          { _key: uniqueKey("st"), value: "40+",    label: "Team members",      description: "Specialists across every core discipline." },
        ],
      };

    // ── Conversion / CTA ─────────────────────────────────────────────────────

    case "ctaSection":
      // Schema: title (string), description (text), buttonLabel (string), buttonHref (string)
      // Renamed heading→title, ctaLabel→buttonLabel, ctaHref→buttonHref.
      // Removed subheading, ctaSecondaryLabel, ctaSecondaryHref — not in schema.
      return {
        ...stub,
        title:       "Ready to Get Started?",
        description: `Whether you have a question or a specific project in mind, the ${name} team is here to help. Reach out today.`,
        buttonLabel: "Get in Touch",
        buttonHref:  "/contact",
      };

    case "contactSection":
      return {
        ...stub,
        heading:   "Let's Talk",
        intro:     `Reach out to the ${name} team — we typically respond within one business day.`,
        email:     `hello@${tenantId.replace(/[^a-z0-9-]/g, "")}.com`,
        phone:     "+44 (0) 20 0000 0000",
        address:   "1 Business Street, City, Country",
        ctaLabel:  "Send Us a Message",
        ctaHref:   "/contact",
      };

    // ── Forms ────────────────────────────────────────────────────────────────

    case "formSection":
      // Schema: formKey (required), title (string), intro (text), submitLabel, successMessage
      // Renamed heading→title; added formKey so the required field is populated.
      return {
        ...stub,
        formKey: "contact",
        title:   "Get in Touch",
        intro:   `Have a question or want to discuss a project? The ${name} team would love to hear from you. Fill in the form and we'll be in touch within one business day.`,
      };

    // ── Process / steps ───────────────────────────────────────────────────────

    case "processSteps":
      return {
        ...stub,
        heading:    "How It Works",
        subheading: "A clear, proven process that keeps you in control at every stage.",
        steps: [
          { _key: uniqueKey("s"), number: "01", title: "Discovery",  description: "We start by listening — understanding your goals, constraints, and what success really looks like for your team." },
          { _key: uniqueKey("s"), number: "02", title: "Strategy",   description: "Together we map out the best path forward, aligning stakeholders and clarifying scope before a single line is written." },
          { _key: uniqueKey("s"), number: "03", title: "Delivery",   description: "Our team executes with precision. Regular check-ins keep you informed and in control throughout." },
          { _key: uniqueKey("s"), number: "04", title: "Follow-up",  description: "We stay engaged after delivery to ensure the results stick and keep improving over time." },
        ],
      };

    case "timeline":
      return {
        ...stub,
        heading: "Our Journey",
        items: [
          { _key: uniqueKey("tl"), year: "2012", title: "Founded",       description: `${name} was established with a clear mission: to deliver genuine value to every client.` },
          { _key: uniqueKey("tl"), year: "2015", title: "First 50 Clients", description: "Rapid growth driven by client referrals and a reputation for delivering on promises." },
          { _key: uniqueKey("tl"), year: "2018", title: "Expansion",     description: "We broadened our service offering and opened a second office to serve a wider geography." },
          { _key: uniqueKey("tl"), year: "2021", title: "Platform Launch", description: "Launched our proprietary platform, enabling faster delivery and better client outcomes." },
          { _key: uniqueKey("tl"), year: "Today", title: "200+ Clients",  description: "A team of 40+ specialists serving organisations across the industry — and growing." },
        ],
      };

    case "quickLinks":
      return {
        ...stub,
        heading: "Explore",
        links: [
          { _key: uniqueKey("ql"), label: "About Us",        href: "/about",    description: `Learn more about who we are and what drives the ${name} team.` },
          { _key: uniqueKey("ql"), label: "Our Services",    href: "/services", description: "Discover how we can help your organisation move forward." },
          { _key: uniqueKey("ql"), label: "Case Studies",    href: "/cases",    description: "See real examples of the results we've delivered for clients." },
          { _key: uniqueKey("ql"), label: "Open Roles",      href: "/vacancies",description: "Join the team — we're always looking for talented people." },
          { _key: uniqueKey("ql"), label: "Get in Touch",    href: "/contact",  description: "Ready to talk? Reach out and we'll get back to you fast." },
        ],
      };

    // ── Recruitment ───────────────────────────────────────────────────────────

    case "recruiterPanel":
      return {
        ...stub,
        heading:     "Meet Our Recruiters",
        description: `The ${name} recruitment team combines deep market knowledge with a genuinely personal approach. We take the time to understand both sides of every placement — so the right match is made every time.`,
      };

    // ── Team ─────────────────────────────────────────────────────────────────

    case "teamSection":
      return {
        ...stub,
        heading:    "Meet the Team",
        subheading: `The ${name} team brings together specialists across strategy, delivery, and client success.`,
        members: [
          { _key: uniqueKey("tm"), name: "Alex Rivera",   role: "Chief Executive Officer",  bio: "15 years building high-performing organisations across technology and professional services." },
          { _key: uniqueKey("tm"), name: "Jordan Lee",    role: "Head of Strategy",          bio: "Expert in organisational transformation, stakeholder alignment, and long-range planning." },
          { _key: uniqueKey("tm"), name: "Morgan Clarke", role: "Head of Client Success",    bio: "Passionate about ensuring every client relationship delivers measurable, lasting value." },
          { _key: uniqueKey("tm"), name: "Taylor Singh",  role: "Lead Consultant",           bio: "Brings deep domain expertise across delivery, operations, and process improvement." },
        ],
      };

    // ── Pricing ───────────────────────────────────────────────────────────────

    case "pricingSection":
      return {
        ...stub,
        heading:    "Simple, Transparent Pricing",
        subheading: "Choose the plan that fits where you are right now. Upgrade any time as you grow.",
        tiers: [
          {
            _key:       uniqueKey("pr"),
            name:       "Starter",
            price:      "£999",
            period:     "/ month",
            description: "Everything you need to get started — core platform access and onboarding support.",
            features:   [
              { _key: uniqueKey("pf"), text: "Core platform access" },
              { _key: uniqueKey("pf"), text: "Up to 5 team members"  },
              { _key: uniqueKey("pf"), text: "Email support"         },
              { _key: uniqueKey("pf"), text: "Monthly reporting"     },
            ],
            ctaLabel: "Start Free Trial",
            ctaHref:  "/contact",
            featured: false,
          },
          {
            _key:       uniqueKey("pr"),
            name:       "Growth",
            price:      "£2,499",
            period:     "/ month",
            description: "Advanced features, more team seats, and priority support for growing teams.",
            features:   [
              { _key: uniqueKey("pf"), text: "Everything in Starter"           },
              { _key: uniqueKey("pf"), text: "Up to 25 team members"           },
              { _key: uniqueKey("pf"), text: "Priority support"                },
              { _key: uniqueKey("pf"), text: "Advanced analytics"              },
              { _key: uniqueKey("pf"), text: "Custom integrations"             },
            ],
            ctaLabel: "Get Started",
            ctaHref:  "/contact",
            featured: true,
          },
          {
            _key:       uniqueKey("pr"),
            name:       "Enterprise",
            price:      "Custom",
            period:     "",
            description: "Tailored pricing for large organisations with complex needs and dedicated support.",
            features:   [
              { _key: uniqueKey("pf"), text: "Everything in Growth"            },
              { _key: uniqueKey("pf"), text: "Unlimited team members"          },
              { _key: uniqueKey("pf"), text: "Dedicated account manager"       },
              { _key: uniqueKey("pf"), text: "SLA guarantees"                  },
              { _key: uniqueKey("pf"), text: "Custom contract terms"           },
            ],
            ctaLabel: "Talk to Sales",
            ctaHref:  "/contact",
            featured: false,
          },
        ],
      };

    // ── Listing / overview ────────────────────────────────────────────────────

    case "listing": {
      // Schema: heading (string), items[], maxItems, viewAllHref, viewAllLabel
      const isVacancies = !!(presetKey === "listing_vacancies" || variant?.includes("vacanc"));
      const isCases     = !!(presetKey === "listing_cases"     || variant?.includes("case"));
      const listHeading = isVacancies ? "Open Positions" : isCases ? "Case Studies" : "Latest Articles";
      const slugBase    = isVacancies ? "/vacancies" : isCases ? "/cases" : "/news";

      // Listing items referencing the seeded content slugs so detail pages
      // resolve immediately without requiring "placeholder" URL fixup.
      const items = isVacancies
        ? SEEDED_VACANCY_ITEMS.map((v) => ({
            _key:     uniqueKey("li"),
            title:    v.title,
            href:     `/vacancies/${v.slug}`,
            excerpt:  v.excerpt,
            category: v.department,
            date:     "2024-03-15",
          }))
        : isCases
        ? SEEDED_CASE_ITEMS.map((c) => ({
            _key:     uniqueKey("li"),
            title:    c.title,
            href:     `/cases/${c.slug}`,
            excerpt:  c.excerpt,
            category: c.category,
            date:     c.date,
          }))
        : SEEDED_NEWS_ITEMS.map((n) => ({
            _key:     uniqueKey("li"),
            title:    n.title,
            href:     `/news/${n.slug}`,
            excerpt:  n.excerpt,
            category: n.category,
            date:     n.date,
          }));

      return {
        ...stub,
        heading:      listHeading,
        viewAllHref:  slugBase,
        viewAllLabel: `View all ${listHeading.toLowerCase()}`,
        items,
      };
    }

    case "filterBar":
      return {
        ...stub,
        placeholder: "Search by title, location, or keyword…",
      };

    case "searchResults":
      // On the dedicated search_default page the search block above already
      // provides the input — disable the duplicate search field here.
      return {
        ...stub,
        heading:      "Search Results",
        emptyMessage: "No results found. Try adjusting your search terms or filters.",
        itemsPerPage: 12,
        enableSearch: presetKey === "search_default" ? false : true,
        enableFilter: true,
      };

    case "search":
      // Schema fields: title (string), description (text), placeholder (string),
      // scopes[] (array of "pages"|"news"|"vacancies"), showFilters, enableInstant,
      // maxResults, emptyMessage, noResultsMessage.
      // NOTE: schema uses "title", NOT "heading".
      return {
        ...stub,
        title:            "Search",
        description:      `Find articles, pages, and more across the ${name} website.`,
        placeholder:      "Type to search…",
        scopes:           ["pages", "news"],
        enableInstant:    true,
        emptyMessage:     "No results yet — type a keyword above to get started.",
        noResultsMessage: "No results found. Try different keywords or browse our latest news.",
      };

    case "newsList":
      // Schema: heading (string), items[] (title (req), url (req), excerpt, date, imageUrl, category),
      // maxItems (number).  Populated with seeded news items so the block renders immediately.
      return {
        ...stub,
        heading:  "News & Insights",
        maxItems: 3,
        items: SEEDED_NEWS_ITEMS.map((n) => ({
          _key:     uniqueKey("nl"),
          title:    n.title,
          url:      `/news/${n.slug}`,
          excerpt:  n.excerpt,
          date:     n.date,
          category: n.category,
        })),
      };

    // ── Article / vacancy detail ──────────────────────────────────────────────

    case "articleMeta":
      return {
        ...stub,
        // Meta block draws its content from the CMS article document itself —
        // the heading/author/date fields are populated at render time.
        // The stub is sufficient; we just ensure the block is present.
      };

    case "articleBody":
      return {
        ...stub,
        body: [
          paragraph(
            `This is the article body. Replace this placeholder with your article content. ` +
            `Use headings, images, and quotes to structure your piece.`,
          ),
          paragraph(
            `Tip: the article body block supports rich text — add links, bold text, ` +
            `and inline images directly from the Sanity Studio editor.`,
          ),
        ],
      };

    case "relatedContent":
      // Schema: heading (string), maxItems (number), items[] (required, min 1)
      // items[].relatedItem: title (required), href (required), excerpt, category, date, image
      return {
        ...stub,
        heading: "You Might Also Like",
        items: [
          {
            _key:    uniqueKey("ri"),
            title:   "Related Article",
            href:    "/news/related-article",
            excerpt: "A brief summary of the related content goes here. Update this placeholder with a real article link.",
          },
        ],
      };

    case "vacancyMeta":
      return {
        ...stub,
        // Meta block draws its content from the CMS vacancy document.
        // The stub is sufficient; fields populate at render time.
      };

    case "applyPanel":
      // Schema: heading, body (text), closingDate, primaryCta {label, href}, secondaryCta {label, href}, formKey
      // "intro" and "ctaLabel" are not schema fields — use "body" and "primaryCta" instead.
      return {
        ...stub,
        heading:    "Interested in This Role?",
        body:       `We'd love to hear from you. Send us your CV and a short note about why you'd be a great fit at ${name}.`,
        primaryCta: { label: "Apply Now", href: "/contact" },
      };

    // ── FAQ ───────────────────────────────────────────────────────────────────

    case "faqSection":
      // Schema: heading (string), items[].question (string), items[].answer (text — plain string).
      // answer is type "text" (not Portable Text) — write plain strings, not block arrays.
      return {
        ...stub,
        heading: "Frequently Asked Questions",
        items: [
          {
            _key:     uniqueKey("fq"),
            question: "How does the process work?",
            answer:   "We start with a discovery conversation to understand your needs, then map out a clear plan and execute against it. You're involved at every stage.",
          },
          {
            _key:     uniqueKey("fq"),
            question: "How quickly can we get started?",
            answer:   "Most engagements begin within a week of our first conversation. We move quickly and keep momentum high from day one.",
          },
          {
            _key:     uniqueKey("fq"),
            question: "What makes you different from other providers?",
            answer:   `${name} combines deep expertise with a genuinely personal approach. We measure our success by yours — not by hours billed or deliverables shipped.`,
          },
          {
            _key:     uniqueKey("fq"),
            question: "Do you work with smaller organisations?",
            answer:   "Absolutely. We work with organisations of all sizes — from ambitious start-ups to established enterprises. Our approach scales to fit where you are right now.",
          },
        ],
      };

    default:
      // Unknown or future block type — return the minimal stub so provisioning
      // never fails on unrecognised types.
      return stub;
  }
}

/**
 * The complete set of section object types registered in the Sanity `page`
 * schema (cms/schemas/page.ts → sections[]).  Only these types are valid
 * `_type` values inside a page's `sections` array.
 *
 * Types that exist in REGISTERED_CONTENT_BLOCK_TYPES but are NOT here
 * (richText, processSteps, recruiterPanel, pricingSection, contentSection,
 * teamSection) have no Sanity schema object — writing them to `sections`
 * produces "/" ghost entries and "Unknown field found" warnings in Studio.
 */
const SANITY_SCHEMA_SECTION_TYPES = new Set<string>([
  "textSection",
  "featureGrid",
  "testimonialSection",
  "faqSection",
  "ctaSection",
  "formSection",
  "listing",
  "filterBar",
  "searchResults",
  "articleMeta",
  "articleBody",
  "relatedContent",
  "vacancyMeta",
  "applyPanel",
  "search",
  "logoStrip",
  "stats",
  "about",
  "newsList",
]);

/**
 * Builds the sections array for a preset's block list.
 *
 * ─── Filter strategy ────────────────────────────────────────────────────────
 *
 *   Provisioning deliberately does NOT apply the package-tier allowedContent
 *   filter.  Applying it here would silently produce near-empty starter pages
 *   for Starter and Growth tenants (e.g. the corporate homepage preset uses
 *   featureGrid + about + testimonialSection + ctaSection, all of which are
 *   absent from the Starter allowlist).
 *
 *   Package-gating applies at RUNTIME via the page builder and block renderer —
 *   it prevents editors from adding new non-entitled blocks.  Provisioned
 *   content that was written before a package downgrade remains visible.
 *
 *   The only filter applied here is SANITY_SCHEMA_SECTION_TYPES: block types
 *   that have no corresponding Sanity schema object (richText, processSteps,
 *   recruiterPanel, pricingSection, contentSection, teamSection) are skipped
 *   because writing them to sections[] produces "/" ghost entries and
 *   "Unknown field found" warnings in Sanity Studio.
 *
 * @param presetBlocks   Ordered block list from the PagePreset definition.
 * @param tenantId       Tenant being provisioned (passed to buildStarterSection).
 * @param mode           StarterContentMode — controls starter copy depth.
 */
function buildPresetSections(
  presetBlocks: ReadonlyArray<{ blockType: string; variant?: string }>,
  tenantId:     string,
  mode:         StarterContentMode,
  presetKey?:   string,
): object[] {
  const skipped: string[] = [];
  const sections = presetBlocks
    .filter((b) => {
      if (SANITY_SCHEMA_SECTION_TYPES.has(b.blockType)) return true;
      skipped.push(b.blockType);
      return false;
    })
    .map((b) => buildStarterSection(b.blockType, b.variant, tenantId, mode, presetKey));

  if (skipped.length > 0) {
    console.log(
      `[tenant-provisioner] skipped ${skipped.length} block(s) with no Sanity schema: ` +
      skipped.join(", "),
    );
  }

  return sections;
}

/**
 * Derives the Sanity contextConfig object from a page preset's contextSlots.
 *
 * Maps hero/proof/cta slot IDs to the tenant's own default variant keys so
 * newly provisioned pages immediately resolve to valid fallbacks in the CMS.
 * Returns an empty object when the preset has no context slots.
 */
function buildContextConfigForPreset(
  presetKey: string,
  tenantId:  string,
): object {
  const preset = getPreset(presetKey);
  if (!preset || preset.contextSlots.length === 0) return {};

  const cfg: Record<string, { fallbackVariantKey: string }> = {};
  for (const slot of preset.contextSlots) {
    // Variant keys are tenant-scoped: use the clean business key.
    // The GROQ query resolves tenant-specific documents first (by tenantId),
    // then falls back to shared/platform documents (!defined(tenantId)).
    if (slot.slotId === "hero") {
      cfg.hero  = { fallbackVariantKey: "hero_default"  };
    } else if (slot.slotId === "proof") {
      cfg.proof = { fallbackVariantKey: "proof_default" };
    } else if (slot.slotId === "cta") {
      cfg.cta   = { fallbackVariantKey: "cta_default"   };
    }
  }
  return cfg;
}

/**
 * @deprecated Use buildPageForPresetEntry(tenantId, "homepage_corporate", ...) instead.
 * Retained for backward compatibility — no longer called from the main provisioning path.
 */
function buildHomepagePage(
  tenantId:       string,
  allowedContent: readonly ContentBlockKey[],
) {
  const name = tenantDisplayName(tenantId);
  return {
    _id:         pageDocId(tenantId, "home"),
    _type:       "page",
    tenantId,
    title:       `${name} — Homepage`,
    slug:        { _type: "slug", current: "home" },
    templateKey: "marketing-page",
    isPublished: true,

    // Context slot config — tenant-scoped variant keys (no suffix hacks).
    // The GROQ query resolves tenantId + key together; "hero_default" resolves
    // to this tenant's own document first, falling back to the shared platform variant.
    contextConfig: {
      hero:  { fallbackVariantKey: "hero_default"  },
      proof: { fallbackVariantKey: "proof_default" },
      cta:   { fallbackVariantKey: "cta_default"   },
    },

    sections: buildHomepageSections(tenantId, allowedContent),
  };
}

/**
 * @deprecated Use buildPageForPresetEntry(tenantId, "about_default", ...) instead.
 * Retained for backward compatibility — no longer called from the main provisioning path.
 *
 * Builds a starter About page document for a tenant.
 */
function buildAboutPage(
  tenantId: string,
) {
  const name = tenantDisplayName(tenantId);
  return {
    _id:         pageDocId(tenantId, "about"),
    _type:       "page",
    tenantId,
    title:       `${name} — About`,
    slug:        { _type: "slug", current: "about" },
    templateKey: "marketing-page",
    isPublished: true,

    // CTA slot at the bottom of the about page.
    // Tenant-scoped key: resolves to this tenant's "cta_default" first.
    contextConfig: {
      cta: { fallbackVariantKey: "cta_default" },
    },

    sections: [
      {
        _type:   "textSection",
        _key:    uniqueKey("ts"),
        heading: `About ${name}`,
        body: [
          paragraph(
            `${name} is a team of dedicated professionals committed to delivering ` +
            `exceptional results for every client we work with.`,
          ),
          paragraph(
            `Founded on the principles of integrity, expertise, and genuine care for ` +
            `our clients' success, we bring a collaborative approach to every project.`,
          ),
          paragraph(
            `Whether you're looking to scale, transform, or optimise, we have the ` +
            `experience and passion to help you achieve your goals.`,
          ),
        ],
      },
    ],
  };
}

/**
 * @deprecated Use buildPageForPresetEntry(tenantId, "contact_default", ...) instead.
 * Retained for backward compatibility — no longer called from the main provisioning path.
 *
 * Builds a starter Contact page document for a tenant.
 */
function buildContactPage(
  tenantId: string,
) {
  const name = tenantDisplayName(tenantId);
  return {
    _id:         pageDocId(tenantId, "contact"),
    _type:       "page",
    tenantId,
    title:       `${name} — Contact`,
    slug:        { _type: "slug", current: "contact" },
    templateKey: "marketing-page",
    isPublished: true,

    contextConfig: {},

    sections: [
      {
        _type:   "textSection",
        _key:    uniqueKey("ts"),
        heading: "Get in Touch",
        body: [
          paragraph(
            `We'd love to hear from you. Whether you have a question about our ` +
            `services, want to start a project, or just want to say hello — ` +
            `the ${name} team is ready to help.`,
          ),
          paragraph(
            `Reach out via the form below or email us directly. We typically ` +
            `respond within one business day.`,
          ),
        ],
      },
    ],
  };
}

/**
 * Converts an EditablePage from the page store to a Sanity page document.
 *
 * The Sanity _id is always `{tenantId}_page_{slug}` — not the EditablePage.id —
 * so documents have stable, predictable IDs regardless of where the
 * EditablePage originated.
 *
 * Context slots are mapped to `contextConfig[slotId].fallbackVariantKey`.
 * Content blocks are mapped to the `sections` array; `block.id` is used as
 * the Sanity `_key` for stability across re-provisioning runs.
 *
 * @param page The EditablePage from the page store.
 */
function editablePageToSanityDoc(
  page: EditablePage,
): object {
  // Context config: slotId → fallbackVariantKey
  const contextConfig: Record<string, { fallbackVariantKey: string | null }> = {};
  for (const slot of page.contextSlots) {
    contextConfig[slot.slotId] = { fallbackVariantKey: slot.variantKey };
  }

  // Sections: use block.id as _key for stable array item identity across runs
  const sections = page.contentBlocks.map((block) => ({
    _type: block.blockType,
    _key:  block.id,
    ...(block.variant ? { variant: block.variant } : {}),
    ...block.data,
  }));

  // Normalise the homepage slug: the page-store persists "" for the root
  // page (no leading slash after strip), but Sanity always uses "home" as
  // the slug.current value so that `getPageBySlug("home")` resolves correctly
  // on the frontend.  All other callers in this file already apply this
  // normalisation (navItemDocId, buildNavItemDoc, buildPageForPresetEntry).
  const normalSlug = page.slug === "" ? "home" : page.slug;

  return {
    _id:         pageDocId(page.tenantId, normalSlug),
    _type:       "page",
    tenantId:    page.tenantId,
    title:       page.title,
    slug:        { _type: "slug", current: normalSlug },
    templateKey: page.templateKey,
    isPublished: true,
    ...(Object.keys(contextConfig).length > 0 ? { contextConfig } : {}),
    // Sanity page schema uses flat seoTitle / seoDescription fields — not a nested seo object.
    ...(page.seo.title       ? { seoTitle:       page.seo.title       } : {}),
    ...(page.seo.description ? { seoDescription: page.seo.description } : {}),
    sections,
  };
}

// ── Navigation and site settings builders ─────────────────────────────────────

/**
 * Returns a stable Sanity document ID for a per-tenant navigation item.
 *
 * Encodes the slug into a Sanity-safe ID segment: forward slashes in
 * nested slugs (e.g. "news/article") become underscores.
 */
function navItemDocId(tenantId: string, slug: string): string {
  const slugKey = (slug === "" ? "home" : slug).replace(/\//g, "_");
  return `navItem_${tenantId}_${slugKey}`;
}

/**
 * Builds a Sanity `navigationItem` document for a single internal page entry.
 *
 * Links to the corresponding page document via an internal reference
 * so the nav label is always consistent with the page title.
 *
 * @param tenantId  The tenant being provisioned.
 * @param label     Navigation label (typically the page title).
 * @param slug      URL slug for the page (no leading slash; "" = homepage).
 */
function buildNavItemDoc(
  tenantId: string,
  label:    string,
  slug:     string,
): object {
  // The referenced page doc uses "home" internally for the homepage slug.
  const pageRef = pageDocId(tenantId, slug === "" ? "home" : slug);
  return {
    _id:          navItemDocId(tenantId, slug),
    _type:        "navigationItem",
    tenantId,
    label,
    linkType:     "internal",
    internalPage: { _type: "reference", _ref: pageRef },
  };
}

/**
 * Builds a Sanity `navigationItem` document pointing to an external URL.
 *
 * Used for social links, privacy policy links, and other off-site items
 * that do not correspond to a CMS page document.
 *
 * @param tenantId  The tenant being provisioned.
 * @param label     Navigation label shown in the footer.
 * @param url       Absolute external URL.
 * @param idSuffix  Short unique suffix appended to the doc ID (e.g. "privacy").
 */
function buildExternalNavItemDoc(
  tenantId: string,
  label:    string,
  url:      string,
  idSuffix: string,
): object {
  return {
    _id:         `navItem_${tenantId}_ext_${idSuffix}`,
    _type:       "navigationItem",
    tenantId,
    label,
    linkType:    "external",
    externalUrl: url,
  };
}

/**
 * Builds a per-tenant `siteSettings` Sanity document.
 *
 * Uses a per-tenant `_id` (`siteSettings_${tenantId}`) so multiple tenants
 * can share one Sanity dataset without conflicting.
 *
 * Navigation arrays reference the corresponding navigationItem documents via
 * Sanity reference objects; main nav and footer nav are derived from the
 * site preset entries supplied by the caller.
 *
 * @param tenantId             The tenant being provisioned.
 * @param mainNavSlugs         Slug/label pairs for the main navigation.
 * @param footerNavSlugs       Slug/label pairs for the footer navigation (internal pages).
 * @param footerExternalItems  External nav item ID suffixes for the footer (e.g. "privacy").
 * @param includeComponentsNav Whether to append the /components nav item to the main nav.
 */
function buildSiteSettingsDoc(
  tenantId:            string,
  mainNavSlugs:        Array<{ slug: string; label: string }>,
  footerNavSlugs:      Array<{ slug: string; label: string }>,
  footerExternalItems: Array<{ idSuffix: string; keyPrefix?: string }> = [],
  includeComponentsNav = false,
): object {
  const name  = tenantDisplayName(tenantId);
  const email = `hello@${tenantId.replace(/[^a-z0-9-]/g, "")}.com`;

  // Internal-page reference (to a navigationItem doc by its stable _id)
  const toRef = (slug: string, keyPrefix = "") => ({
    _type: "reference",
    _ref:  navItemDocId(tenantId, slug),
    _key:  `${keyPrefix}${navItemDocId(tenantId, slug)}`,
  });

  // External-item reference (to an external navigationItem doc)
  const toExtRef = (idSuffix: string, keyPrefix = "") => ({
    _type: "reference",
    _ref:  `navItem_${tenantId}_ext_${idSuffix}`,
    _key:  `${keyPrefix}navItem_${tenantId}_ext_${idSuffix}`,
  });

  // Main nav: provisioned pages + optional /components link at end
  const mainNavRefs = [
    ...mainNavSlugs.map(({ slug }) => toRef(slug, "main_")),
    ...(includeComponentsNav
      ? [toRef("components", "main_")]
      : []),
  ];

  // Footer nav: relevant internal pages (about, services, cases, news, contact)
  // filtered from footerNavSlugs, then utility external items (privacy etc.)
  const footerInternalSlugs = ["about", "services", "cases", "news", "contact"];
  const filteredFooterSlugs = footerNavSlugs.filter(
    ({ slug }) => footerInternalSlugs.includes(slug),
  );
  const footerNavRefs = [
    ...filteredFooterSlugs.map(({ slug }) => toRef(slug, "foot_")),
    ...footerExternalItems.map(({ idSuffix, keyPrefix = "foot_" }) =>
      toExtRef(idSuffix, keyPrefix),
    ),
  ];

  return {
    _id:      `siteSettings-${tenantId}`,
    _type:    "siteSettings",
    tenantId, // stored for multi-tenant GROQ queries: *[_type=="siteSettings" && tenantId==$tenantId]
    siteTitle:             name,
    defaultSeoTitle:       `${name} — Your trusted partner`,
    defaultSeoDescription:
      `${name} delivers proven results for every client we work with. ` +
      `Discover how we can help you grow.`,
    contactEmail: email,
    socialLinks: [
      {
        _key:  uniqueKey("sl"),
        label: "LinkedIn",
        url:   `https://linkedin.com/company/${tenantId}`,
      },
      {
        _key:  uniqueKey("sl"),
        label: "Twitter / X",
        url:   `https://twitter.com/${tenantId}`,
      },
    ],
    mainNavigation:   mainNavRefs,
    footerNavigation: footerNavRefs,
  };
}

// ── Site-preset page builder ──────────────────────────────────────────────────

/**
 * Builds a Sanity page document for a single site-preset entry.
 *
 * ─── Content modes ────────────────────────────────────────────────────────────
 *
 *   includeDefaultBlocks = false
 *     Always returns sections: [] — operator fills from the CMS editor.
 *     contextConfig is still derived from the preset's contextSlots.
 *
 *   includeDefaultBlocks = true, starterContentMode = "fill" | "overwrite"
 *     For home/about/contact: delegates to the rich starter builders (fully
 *     formatted copy ready for preview).
 *     For all other slugs: builds sections from the preset's block list using
 *     rich starter copy per block type via buildPresetSections().
 *
 *   includeDefaultBlocks = true, starterContentMode = "none"
 *     For all slugs: builds sections from the preset's block list using
 *     minimal stubs (type + key only, no dummy copy).  The rich home/about/
 *     contact builders are bypassed — the operator sees clean block shapes.
 *
 * @param tenantId              The tenant being provisioned.
 * @param presetKey             The PagePreset key from page-presets.ts.
 * @param title                 Human-readable page title.
 * @param slug                  URL slug (no leading slash; "" = homepage).
 * @param allowedContent        Package-gated content block allow-list.
 * @param includeDefaultBlocks  When false, always returns empty sections.
 * @param starterContentMode    Controls starter content depth.
 */
function buildPageForPresetEntry(
  tenantId:             string,
  presetKey:            string,
  title:                string,
  slug:                 string,
  allowedContent:       readonly ContentBlockKey[],
  includeDefaultBlocks: boolean          = true,
  starterContentMode:   StarterContentMode = "fill",
): object {
  const normalSlug = slug === "" ? "home" : slug;

  // ── No-blocks path: always empty sections ─────────────────────────────────
  if (!includeDefaultBlocks) {
    const preset      = getPreset(presetKey);
    const templateKey = preset?.templateKey ?? "marketing-page";
    const name        = tenantDisplayName(tenantId);
    return {
      _id:           pageDocId(tenantId, normalSlug),
      _type:         "page",
      tenantId,
      title:         title || `${name} — ${normalSlug}`,
      slug:          { _type: "slug", current: normalSlug },
      templateKey,
      isPublished:   true,
      contextConfig: buildContextConfigForPreset(presetKey, tenantId),
      sections:      [],
    };
  }

  // ── Generic preset builder: all pages ────────────────────────────────────
  //
  // All pages — including home, about, and contact — now flow through this
  // unified path.  buildPresetSections() drives content for every slug using
  // the block composition defined in the preset registry (page-presets.ts),
  // so the starter content library is consistently applied everywhere.
  const preset      = getPreset(presetKey);
  const templateKey = preset?.templateKey ?? "marketing-page";
  const name        = tenantDisplayName(tenantId);

  const sections = preset
    ? buildPresetSections(preset.blocks, tenantId, starterContentMode, presetKey)
    : [];

  return {
    _id:           pageDocId(tenantId, normalSlug),
    _type:         "page",
    tenantId,
    title:         title || `${name} — ${normalSlug}`,
    slug:          { _type: "slug", current: normalSlug },
    templateKey,
    isPublished:   true,
    contextConfig: buildContextConfigForPreset(presetKey, tenantId),
    sections,
  };
}

// ── Component showcase page builder ───────────────────────────────────────────

/**
 * Selects the showcase variants to include for a given block's allowedVariants.
 *
 * Strategy: always include the first variant.  When a "default" variant exists
 * and is NOT already the first, add it as a second entry so operators can see
 * how the default layout differs from the primary variant.
 *
 * This keeps the showcase manageable (≤ 2 entries per block) while still
 * covering the most-used rendering paths.
 */
function showcaseVariantsFor(allowedVariants: readonly string[] | undefined): string[] {
  if (!allowedVariants || allowedVariants.length === 0) return [undefined as unknown as string];
  const first     = allowedVariants[0];
  const hasDefault = allowedVariants.includes("default");
  if (hasDefault && first !== "default") {
    return [first, "default"];
  }
  return [first];
}

/**
 * Builds the component showcase page Sanity document.
 *
 * ─── Purpose ──────────────────────────────────────────────────────────────────
 *
 *   A single, non-published CMS page at slug `components` that contains one
 *   section per registered block type (plus a second entry for blocks that
 *   have a distinct "default" variant).  Useful as a living style guide inside
 *   Sanity Studio — editors can browse all available components without
 *   deploying a separate design-system environment.
 *
 * ─── Schema compliance ───────────────────────────────────────────────────────
 *
 *   Only types in SANITY_SCHEMA_SECTION_TYPES are included.  Block types that
 *   are registered in REGISTERED_CONTENT_BLOCK_TYPES but have no corresponding
 *   Sanity schema object (e.g. richText, processSteps, recruiterPanel) are
 *   skipped — they would produce "/" ghost entries and "Unknown field found"
 *   warnings in Sanity Studio.
 *
 * ─── Package gating ──────────────────────────────────────────────────────────
 *
 *   The showcase page is intentionally NOT package-gated — it includes every
 *   schema-valid block regardless of the tenant's plan.  Its purpose is
 *   operator reference, not end-user content delivery.  The page is set to
 *   `isPublished: true` so it is accessible at /components in the frontend.
 *
 * @param tenantId  Tenant for which the showcase page is built.
 */
function buildComponentShowcasePage(
  tenantId: string,
): object {
  const name = tenantDisplayName(tenantId);
  const defs  = getAllBlockDefinitions();

  const sections: object[] = [];

  for (const def of defs) {
    // Skip blocks that are not yet "live" (no mapper + renderer support).
    if (!isRegisteredBlockType(def.key)) continue;

    // Skip block types that have no Sanity schema object — writing them to
    // sections[] produces "/" ghost entries and "Unknown field found" warnings.
    if (!SANITY_SCHEMA_SECTION_TYPES.has(def.key)) continue;

    const variants = showcaseVariantsFor(def.allowedVariants);

    for (const variant of variants) {
      // Build a rich starter section so the page looks populated in Studio.
      // Do NOT spread any non-schema metadata fields (like _showcaseLabel) —
      // they would trigger "Unknown field found" warnings in Sanity Studio.
      const section = buildStarterSection(def.key, variant, tenantId, "fill");
      sections.push(section);
    }
  }

  // Use "article-page" template: it has no hero/proof/cta context slots,
  // avoiding the confusing empty slot configuration shown by "marketing-page".
  return {
    _id:         pageDocId(tenantId, "components"),
    _type:       "page",
    tenantId,
    title:       `${name} — Component Showcase`,
    slug:        { _type: "slug", current: "components" },
    templateKey: "article-page",
    isPublished: true,    // published so the page is retrievable at /components
    sections,
  };
}

// ── Seeded content document builders ─────────────────────────────────────────
//
// These produce standalone Sanity documents (newsArticle, company) written
// alongside the page documents.  They are skipped in "none" mode, written
// with createIfNotExists in "fill" mode, and createOrReplace in "overwrite".

/**
 * Builds 3 starter newsArticle documents for the given tenant.
 *
 * Each article includes title, slug, excerpt, publishedAt, body (PortableText),
 * and isPublished=true so they are immediately accessible via GROQ queries.
 * No coverImage is set — this field requires an uploaded Sanity asset.
 */
function buildStarterNewsArticles(tenantId: string): object[] {
  const name = tenantDisplayName(tenantId);

  return SEEDED_NEWS_ITEMS.map((item) => ({
    _id:         `newsArticle_${tenantId}_${item.slug}`,
    _type:       "newsArticle",
    tenantId,
    title:       item.title,
    slug:        { _type: "slug", current: item.slug },
    publishedAt: `${item.date}T09:00:00Z`,
    excerpt:     item.excerpt,
    body: [
      paragraph(item.excerpt),
      paragraph(
        `This article explores the implications for organisations like ${name} and ` +
        `our clients across the industry. Understanding these dynamics is essential ` +
        `for any team serious about maintaining a competitive edge.`,
      ),
      paragraph(
        `Our analysis draws on direct experience from client engagements and the ` +
        `broader trends we observe across the markets we serve. Reach out if you would ` +
        `like to discuss how these developments apply to your specific context.`,
      ),
    ],
    tags:        [item.category],
    isPublished: true,
  }));
}

/**
 * Builds 3 starter company documents used as case studies.
 *
 * Each company doc includes name, slug, description (case summary), stats
 * (key results), and services (what we delivered) — all fields in the company
 * schema.  isPublished=true makes them accessible via GROQ queries.
 */
function buildStarterCompanyCases(tenantId: string): object[] {
  const cases = [
    {
      slug:        "apex-solutions",
      name:        "Apex Solutions",
      description: "Apex Solutions engaged us for a full operational restructure following a period of rapid but uncoordinated growth. Over 18 months we redesigned their delivery model, aligned leadership around a shared strategy, and implemented the processes needed to sustain 2× revenue growth.",
      stats: [
        { _key: uniqueKey("st"), label: "Revenue growth",      value: "2×"       },
        { _key: uniqueKey("st"), label: "Time to results",     value: "18 months" },
        { _key: uniqueKey("st"), label: "Team satisfaction",   value: "+42%"      },
      ],
      services: [
        { _key: uniqueKey("sv"), label: "Strategic Consulting" },
        { _key: uniqueKey("sv"), label: "Operational Redesign" },
      ],
    },
    {
      slug:        "meridian-group",
      name:        "Meridian Group",
      description: "Meridian Group came to us in reactive mode — leadership was consumed by day-to-day fire-fighting with no capacity to think strategically. In six months we helped them establish a governance framework, build a forward-looking planning process, and reposition the leadership team as a strategic force.",
      stats: [
        { _key: uniqueKey("st"), label: "Planning horizon",    value: "3 years"   },
        { _key: uniqueKey("st"), label: "Leadership capacity", value: "+60%"      },
        { _key: uniqueKey("st"), label: "Decisions delegated", value: "70%"       },
      ],
      services: [
        { _key: uniqueKey("sv"), label: "Change Management"    },
        { _key: uniqueKey("sv"), label: "Executive Coaching"   },
      ],
    },
    {
      slug:        "elevate-partners",
      name:        "Elevate Partners",
      description: "Elevate Partners were scaling fast but starting to feel the strain on their culture and quality standards. We partnered with them to design a scalable operating model, define cultural principles that could survive rapid headcount growth, and build the onboarding infrastructure to sustain it.",
      stats: [
        { _key: uniqueKey("st"), label: "Headcount growth",    value: "3×"        },
        { _key: uniqueKey("st"), label: "Quality score",       value: "Maintained" },
        { _key: uniqueKey("st"), label: "Retention rate",      value: "94%"       },
      ],
      services: [
        { _key: uniqueKey("sv"), label: "Growth Strategy"      },
        { _key: uniqueKey("sv"), label: "Culture Design"        },
      ],
    },
  ];

  return cases.map((c) => ({
    _id:         `company_${tenantId}_${c.slug}`,
    _type:       "company",
    tenantId,
    name:        c.name,
    slug:        { _type: "slug", current: c.slug },
    description: c.description,
    stats:       c.stats,
    services:    c.services,
    isPublished: true,
  }));
}

/**
 * Builds the main company document for the tenant — used for contact /
 * location data (office address, phone, opening hours via branches[]).
 */
function buildStarterCompanyDoc(tenantId: string): object {
  const name = tenantDisplayName(tenantId);
  return {
    _id:         `company_${tenantId}_main`,
    _type:       "company",
    tenantId,
    name,
    slug:        { _type: "slug", current: "main" },
    description:
      `${name} is a consulting and advisory firm based in London, working with ` +
      `organisations across the UK and internationally to deliver meaningful, ` +
      `measurable results.`,
    branches: [
      {
        _key:    uniqueKey("br"),
        name:    "Headquarters",
        city:    "London",
        address: "1 Business Street, City of London, EC1A 1BB",
        phone:   "+44 (0)20 0000 0000",
      },
    ],
    isPublished: true,
  };
}

// ── Seeded vacancy items ───────────────────────────────────────────────────────
//
// Three starter vacancies provisioned alongside the main page documents.
// Using stable slugs here ensures listing block hrefs and detail page slugs
// remain in sync across re-provisioning runs.

const SEEDED_VACANCY_ITEMS = [
  {
    slug:         "senior-consultant-london",
    title:        "Senior Consultant — London",
    department:   "Operations",
    location:     "London, UK",
    remote:       "hybrid" as const,
    contractType: "full-time" as const,
    salaryRange:  "£65,000 – £85,000 / year",
    excerpt:      "We are looking for an experienced consultant to join our growing London team. Competitive salary and flexible working.",
  },
  {
    slug:         "business-development-manager",
    title:        "Business Development Manager — Remote",
    department:   "Sales",
    location:     "Remote — UK",
    remote:       "remote" as const,
    contractType: "full-time" as const,
    salaryRange:  "£50,000 – £70,000 + OTE",
    excerpt:      "Drive new business and grow existing accounts across UK and European markets. Fully remote with occasional travel.",
  },
  {
    slug:         "hr-business-partner-manchester",
    title:        "HR Business Partner — Manchester",
    department:   "People",
    location:     "Manchester, UK",
    remote:       "hybrid" as const,
    contractType: "full-time" as const,
    salaryRange:  "£45,000 – £55,000 / year",
    excerpt:      "Support our Manchester-based clients as a strategic HR partner. Ideal for someone with 5+ years in HR or consulting.",
  },
] as const;

/**
 * Builds 3 starter vacancy documents for the given tenant.
 *
 * Each vacancy includes title, slug, department, location, remote arrangement,
 * contractType, salaryRange, description (PortableText), and isPublished=true
 * so they are immediately accessible via GROQ queries.
 */
function buildStarterVacancies(tenantId: string): object[] {
  const name = tenantDisplayName(tenantId);

  return SEEDED_VACANCY_ITEMS.map((item) => ({
    _id:          `vacancy_${tenantId}_${item.slug}`,
    _type:        "vacancy",
    tenantId,
    title:        item.title,
    slug:         { _type: "slug", current: item.slug },
    department:   item.department,
    location:     item.location,
    remote:       item.remote,
    contractType: item.contractType,
    salaryRange:  item.salaryRange,
    description: [
      paragraph(item.excerpt),
      paragraph(
        `At ${name} we believe in investing in our people. This role offers the ` +
        `opportunity to work on high-impact client engagements, develop your expertise, ` +
        `and grow within a supportive and ambitious team.`,
      ),
      paragraph(
        `We are looking for someone who is proactive, client-focused, and excited ` +
        `about the opportunity to make a measurable difference. If that sounds like you, ` +
        `we would love to hear from you.`,
      ),
    ],
    requirements: [
      { _key: uniqueKey("req"), text: "5+ years of relevant professional experience" },
      { _key: uniqueKey("req"), text: "Strong communication and stakeholder management skills" },
      { _key: uniqueKey("req"), text: "Ability to work autonomously and manage multiple priorities" },
      { _key: uniqueKey("req"), text: "A genuine commitment to delivering value for clients" },
    ],
    processSteps: [
      { _key: uniqueKey("ps"), title: "Initial screening",  description: "A 30-minute call to discuss the role and your background." },
      { _key: uniqueKey("ps"), title: "Interview",          description: "A competency-based interview with two senior team members." },
      { _key: uniqueKey("ps"), title: "Final conversation", description: "A brief final chat with a principal or director." },
      { _key: uniqueKey("ps"), title: "Offer",              description: "We move quickly — expect a decision within two working days." },
    ],
    recruiter: {
      name:  "Alex Rivera",
      role:  "Talent Acquisition Lead",
      email: `talent@${tenantId.replace(/[^a-z0-9-]/g, "")}.com`,
    },
    isPublished: true,
  }));
}

/**
 * Builds 3 vacancy detail page documents at /vacancies/{slug}.
 *
 * Each page uses the "detail-page" template with vacancyMeta + articleBody +
 * applyPanel sections.  The vacancyMeta block draws its structured display
 * values from the vacancy document at render time.
 */
function buildVacancyDetailPages(tenantId: string, mode: StarterContentMode): object[] {
  return SEEDED_VACANCY_ITEMS.map((item) => {
    const pageSlug = `vacancies/${item.slug}`;
    const sections = mode === "none"
      ? [
          { _type: "vacancyMeta", _key: uniqueKey("vm") },
          { _type: "articleBody", _key: uniqueKey("ab") },
          { _type: "applyPanel",  _key: uniqueKey("ap") },
        ]
      : [
          buildStarterSection("vacancyMeta", undefined, tenantId, mode),
          buildStarterSection("articleBody", undefined, tenantId, mode),
          buildStarterSection("applyPanel",  undefined, tenantId, mode),
        ];

    return {
      _id:         pageDocId(tenantId, pageSlug),
      _type:       "page",
      tenantId,
      title:       item.title,
      slug:        { _type: "slug", current: pageSlug },
      templateKey: "detail-page",
      isPublished: true,
      contextConfig: {},
      sections,
    };
  });
}

/**
 * Builds 3 news detail page documents at /news/{slug}.
 *
 * Each page uses the "article-page" template with articleMeta + articleBody +
 * relatedContent sections.  The articleMeta block draws its display values
 * (title, author, date) from the newsArticle document at render time, not
 * from the page sections — so only the block stubs are needed here.
 */
function buildNewsDetailPages(tenantId: string, mode: StarterContentMode): object[] {
  return SEEDED_NEWS_ITEMS.map((item) => {
    const pageSlug = `news/${item.slug}`;
    const sections = mode === "none"
      ? [
          { _type: "articleMeta",    _key: uniqueKey("am")  },
          { _type: "articleBody",    _key: uniqueKey("ab")  },
          { _type: "relatedContent", _key: uniqueKey("rc")  },
        ]
      : [
          buildStarterSection("articleMeta",    undefined, tenantId, mode),
          buildStarterSection("articleBody",    undefined, tenantId, mode),
          buildStarterSection("relatedContent", undefined, tenantId, mode),
        ];

    return {
      _id:         pageDocId(tenantId, pageSlug),
      _type:       "page",
      tenantId,
      title:       item.title,
      slug:        { _type: "slug", current: pageSlug },
      templateKey: "article-page",
      isPublished: true,
      contextConfig: {},
      sections,
    };
  });
}

/**
 * Builds 3 case study detail page documents at /cases/{slug}.
 *
 * Mirrors buildNewsDetailPages but uses the case item slugs and a suitable
 * article-page template composition (articleMeta + articleBody + relatedContent).
 */
function buildCaseDetailPages(tenantId: string, mode: StarterContentMode): object[] {
  return SEEDED_CASE_ITEMS.map((item) => {
    const pageSlug = `cases/${item.slug}`;
    const sections = mode === "none"
      ? [
          { _type: "articleMeta",    _key: uniqueKey("am")  },
          { _type: "articleBody",    _key: uniqueKey("ab")  },
          { _type: "relatedContent", _key: uniqueKey("rc")  },
        ]
      : [
          buildStarterSection("articleMeta",    undefined, tenantId, mode),
          buildStarterSection("articleBody",    undefined, tenantId, mode),
          buildStarterSection("relatedContent", undefined, tenantId, mode),
        ];

    return {
      _id:         pageDocId(tenantId, pageSlug),
      _type:       "page",
      tenantId,
      title:       item.title,
      slug:        { _type: "slug", current: pageSlug },
      templateKey: "article-page",
      isPublished: true,
      contextConfig: {},
      sections,
    };
  });
}

// ── Main provisioner ──────────────────────────────────────────────────────────

/**
 * Provisions starter CMS content for a tenant.
 *
 * Writes hero/proof/cta variant documents plus page documents.
 *
 * ─── Page provisioning modes ─────────────────────────────────────────────────
 *
 *   siteType provided (new tenant bootstrap):
 *     Pages are driven by the matching site preset
 *     (corporate | recruitment | content).  No page-store read.  All preset
 *     entries produce a Sanity doc; home/about/contact use rich starters,
 *     other slugs get a minimal stub with the correct templateKey.
 *
 *   siteType absent (re-provision / legacy):
 *     1. Build starter docs for home, about, and contact.
 *     2. Load pages from the page store for this tenant.
 *     3. Stored pages override starters for matching slugs; extra slugs added.
 *     4. All documents are written via `createOrReplace` (idempotent).
 *
 * Pre-fetches existing Sanity page IDs so the result can distinguish between
 * newly created pages and updated ones.
 *
 * ─── Config resolution ─────────────────────────────────────────────────────────
 *
 *   Project ID + dataset (highest → lowest):
 *     1. Platform Settings (Admin → Platform Settings → Sanity)
 *     2. SANITY_PROJECT_ID / SANITY_DATASET env vars
 *
 *   Write token (highest → lowest):
 *     1. tenant.cms.writeToken  (per-tenant, admin-configured)
 *     2. Platform Settings write token  (admin-configured)
 *     3. SANITY_API_WRITE_TOKEN (platform env var, preferred name)
 *     4. SANITY_WRITE_TOKEN     (platform env var, legacy name)
 *
 * @param tenant               The tenant's stored settings.
 * @param dryRun               When true, builds documents and returns their IDs without writing.
 * @param siteType             Optional site type (corporate | recruitment | content).
 *                             When provided, enables site-settings and nav-item writes.
 * @param pages                Explicit page list from the operator's template selection
 *                             (produced by templateKeysToPageEntries).  When provided,
 *                             these pages are provisioned instead of the full site-preset
 *                             list.  When absent, the full preset list is used (backward
 *                             compatible with direct calls that only pass siteType).
 * @param includeDefaultBlocks When false, all pages are provisioned with empty sections
 *                             (clean slate for the CMS editor).  When true (default),
 *                             pages include the block structure from their preset.
 * @param starterContentMode   Controls how starter content is applied inside sections.
 *                             "none"      — blocks are minimal stubs (no dummy copy).
 *                             "fill"      — rich starter copy; existing pages preserved
 *                                           via createIfNotExists (non-destructive).
 *                             "overwrite" — rich starter copy; pages always replaced
 *                                           via createOrReplace (destructive on re-run).
 *                             Defaults to "fill".
 */
export async function provisionTenant(
  tenant:               TenantSettings,
  dryRun              = false,
  siteType?:            string,
  pages?:               ReadonlyArray<{ presetKey: string; title: string; slug: string }>,
  includeDefaultBlocks: boolean | undefined            = true,
  starterContentMode:   StarterContentMode | undefined = "fill",
  includeShowcasePage:  boolean | undefined            = true,
): Promise<ProvisionResult> {
  // Normalise optional booleans — callers may pass undefined to get the default.
  const _includeBlocks = includeDefaultBlocks ?? true;
  const _contentMode:  StarterContentMode = starterContentMode ?? "fill";
  const { tenantId, packageKey } = tenant;
  const warnings: string[] = [];

  // ── Resolve package and design ────────────────────────────────────────────
  const pkg            = getPackageDefinition(packageKey);
  const allowedContent = pkg.allowedBlocks.content;

  // ── Build variant documents ───────────────────────────────────────────────
  const variantDocs = [
    buildHeroVariant(tenantId),
    buildProofVariant(tenantId),
    buildCtaVariant(tenantId),
    buildFeatureVariant(tenantId),
    buildConversionVariant(tenantId),
  ];

  // ── Build page documents ──────────────────────────────────────────────────
  //
  // Two modes:
  //
  //   siteType provided — CMS-first bootstrap via site preset.
  //     All pages come from the site preset definition; the page store is
  //     not read.  This is the primary path for new tenant bootstrapping.
  //
  //   siteType absent — legacy re-provision.
  //     Built-in starters for home/about/contact, then page-store merge.
  //     Stored pages override starters for matching slugs; extra slugs added.
  const pageDocBySlug = new Map<string, object>();

  const sitePreset = siteType ? getSitePreset(siteType) : undefined;

  // ── Resolve the page list to provision ─────────────────────────────────────
  //
  // Priority:
  //   1. `pages` argument — explicit operator selection from the "Initialize
  //      site" / "Re-initialize site" panel (via templateKeysToPageEntries).
  //      This is the only list of pages that should be provisioned.
  //   2. `sitePreset.pages` — full preset list, used as a fallback when
  //      `pages` is absent (backward compatible with direct/CLI callers that
  //      only pass siteType and expect the full preset).
  //   3. Empty array — triggers the legacy home/about/contact path below.
  //
  // NOTE: This was the root cause of the "selected pages not appearing in
  // Studio" bug.  Previously `pages` was never threaded through from
  // createSiteAction, so the full preset list was always used regardless of
  // what the operator had selected.
  const pageEntries: ReadonlyArray<{ presetKey: string; title: string; slug: string }> =
    pages && pages.length > 0
      ? pages
      : sitePreset?.pages ?? [];

  if (pageEntries.length > 0) {
    // ── CMS-first: build pages from the resolved entry list ──────────────
    for (const entry of pageEntries) {
      const doc = buildPageForPresetEntry(
        tenantId,
        entry.presetKey,
        entry.title,
        entry.slug,
        allowedContent,
        _includeBlocks,
        _contentMode,
      );
      // Use pageDocId key for consistency: "" → "home"
      const mapKey = entry.slug === "" ? "home" : entry.slug;
      pageDocBySlug.set(mapKey, doc);
    }
    const selectionNote = pages && pages.length > 0 ? "operator selection" : "full preset";
    console.log(
      `[tenant-provisioner] siteType="${siteType ?? "none"}" — ` +
      `provisioning ${pageEntries.length} page(s) for "${tenantId}" (${selectionNote}, no page-store read)`,
    );
  } else {
    // ── Legacy: home + about + contact + page-store merge ────────────────
    //
    // Use the canonical preset compositions for core pages so they benefit
    // from the full starter content library, just like the siteType path.
    const legacyName = tenantDisplayName(tenantId);
    pageDocBySlug.set("home",    buildPageForPresetEntry(tenantId, "homepage_corporate", `${legacyName} — Homepage`, "",        allowedContent, _includeBlocks, _contentMode));
    pageDocBySlug.set("about",   buildPageForPresetEntry(tenantId, "about_default",      `${legacyName} — About`,    "about",   allowedContent, _includeBlocks, _contentMode));
    pageDocBySlug.set("contact", buildPageForPresetEntry(tenantId, "contact_default",    `${legacyName} — Contact`,  "contact", allowedContent, _includeBlocks, _contentMode));

    try {
      const storedPages = await getPagesByTenant(tenantId);
      for (const page of storedPages) {
        // Normalise the key so the homepage (page.slug === "") merges into
        // the "home" entry that was seeded above, rather than creating a
        // second "" entry in the map.  editablePageToSanityDoc now applies
        // the same normalisation internally.
        const mapKey = page.slug === "" ? "home" : page.slug;
        pageDocBySlug.set(mapKey, editablePageToSanityDoc(page));
      }
      if (storedPages.length > 0) {
        console.log(
          `[tenant-provisioner] merging ${storedPages.length} stored page(s) for "${tenantId}"`,
        );
      }
    } catch (err) {
      // Non-fatal — fall through to built-in starters.
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(
        `Could not load stored pages from page store: ${msg}. ` +
        `Proceeding with built-in starter pages only.`,
      );
    }
  }

  const pageDocs = Array.from(pageDocBySlug.values());

  // ── Build showcase page doc ───────────────────────────────────────────────
  //
  // Always included (default true) so /components loads out-of-the-box.
  // The showcase page is always written with createOrReplace — it is reference
  // tooling, not editorial content, so overwriting it on re-runs is safe.
  const _showcaseDoc = (includeShowcasePage ?? true)
    ? buildComponentShowcasePage(tenantId)
    : null;

  // ── Build seeded content documents ───────────────────────────────────────
  //
  // Standalone Sanity documents (newsArticle, company) that power listing pages
  // and detail pages.  Skipped when _contentMode === "none" (structural-stubs
  // only run — no dummy content).
  const seededDocs: object[] = _contentMode !== "none" ? [
    ...buildStarterNewsArticles(tenantId),
    ...buildStarterCompanyCases(tenantId),
    buildStarterCompanyDoc(tenantId),
    ...buildStarterVacancies(tenantId),
  ] : [];

  // ── Build seeded detail pages ─────────────────────────────────────────────
  //
  // Page documents at /news/{slug}, /cases/{slug}, and /vacancies/{slug} for
  // each seeded article, case study, and vacancy.  Included even in "none" mode
  // (structural stubs) so routes resolve, but sections are empty stubs.
  const seededDetailPages: object[] = [
    ...buildNewsDetailPages(tenantId, _contentMode),
    ...buildCaseDetailPages(tenantId, _contentMode),
    ...buildVacancyDetailPages(tenantId, _contentMode),
  ];

  const allDocumentIds = [
    ...variantDocs.map((d)         => (d as { _id: string })._id),
    ...pageDocs.map((d)            => (d as { _id: string })._id),
    ...(_showcaseDoc ? [((_showcaseDoc as { _id: string })._id)] : []),
    ...seededDetailPages.map((d)   => (d as { _id: string })._id),
    ...seededDocs.map((d)          => (d as { _id: string })._id),
  ];

  // ── Dry run ───────────────────────────────────────────────────────────────
  if (dryRun) {
    warnings.push("Dry run — no documents were written to Sanity.");
    return {
      ok:                  true,
      documentIds:         allDocumentIds,
      pagesCreated:        0,
      pagesUpdated:        0,
      variantsWritten:     0,
      siteSettingsWritten: false,
      navItemsWritten:     0,
      warnings,
    };
  }

  // ── Resolve Sanity config ─────────────────────────────────────────────────
  //
  // Reads platform settings from the admin dashboard first, then falls back
  // to environment variables.  See resolveSanityConfig() for the full
  // priority order and error handling details.
  const configResult = await resolveSanityConfig(tenant.cms?.writeToken);

  if ("error" in configResult) {
    return { ok: false, error: configResult.error };
  }

  const { projectId, projectIdSource, dataset, datasetSource, tokenResolution } = configResult;

  // ── Consistency check ─────────────────────────────────────────────────────
  //
  // Warn when projectId and dataset come from different sources — this is
  // valid but unusual and worth flagging so operators know the mix is intentional.
  if (projectIdSource !== datasetSource && datasetSource !== "default") {
    console.warn(
      `[tenant-provisioner] mixed Sanity config sources: ` +
      `projectId from "${projectIdSource}", dataset from "${datasetSource}". ` +
      `Consider aligning both in Platform Settings.`,
    );
  }

  // ── Diagnostic log (non-secret) ───────────────────────────────────────────
  console.log(
    `[tenant-provisioner] provisioning "${tenantId}" — ` +
    `project="${projectId}" (source: ${projectIdSource}) ` +
    `dataset="${dataset}" (source: ${datasetSource}) ` +
    `token_source="${tokenResolution.source}" ` +
    `variants=${variantDocs.length} pages=${pageDocs.length}`,
  );

  // ── Create Sanity write client ────────────────────────────────────────────
  let client;
  try {
    client = createWriteClient(tokenResolution.token, projectId, dataset);
  } catch (err) {
    return {
      ok:    false,
      error: err instanceof Error ? err.message : "Failed to create Sanity write client.",
    };
  }

  // ── Pre-fetch existing page IDs ───────────────────────────────────────────
  //
  // Used to categorise writes as "created" vs "updated" in the result.
  // Failure here is non-fatal — the result counts will show 0 updated (all
  // treated as created), which is conservative but never blocks provisioning.
  const existingPageIdSet = new Set<string>();
  try {
    const existingIds = await client.fetch<string[]>(
      `*[_type == "page" && tenantId == $tenantId]._id`,
      { tenantId },
    );
    for (const id of existingIds) existingPageIdSet.add(id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(
      `Could not pre-fetch existing page IDs: ${msg}. ` +
      `Created/updated counts may be inaccurate.`,
    );
  }

  // ── Pre-fetch IDs of existing pages that have no sections ─────────────────
  //
  // Used in "fill" mode to patch pages that were previously provisioned with
  // empty sections (e.g. from a prior "none"-mode run or a clean-slate init).
  // Non-fatal — if the query fails, those pages are silently left unchanged.
  const emptyExistingPageIds = new Set<string>();
  if (_contentMode === "fill") {
    try {
      const emptyIds = await client.fetch<string[]>(
        `*[_type == "page" && tenantId == $tenantId && (!defined(sections) || count(sections) == 0)]._id`,
        { tenantId },
      );
      for (const id of emptyIds) emptyExistingPageIds.add(id);
      if (emptyIds.length > 0) {
        console.log(
          `[tenant-provisioner] found ${emptyIds.length} existing page(s) with no sections — ` +
          `will patch with starter content (fill mode)`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(
        `Could not pre-fetch empty page IDs: ${msg}. ` +
        `Existing pages with no sections may not be filled on this run.`,
      );
    }
  }

  // ── Pre-fetch existing seeded document IDs ───────────────────────────────
  //
  // Used in "fill" mode to skip seeded docs that already exist, preventing
  // unnecessary overwrites on re-initialize runs.  Non-fatal — if the query
  // fails, every doc is treated as new (conservative but safe).
  const existingSeededIdSet = new Set<string>();
  if (_contentMode === "fill" && seededDocs.length > 0) {
    try {
      const seededIds = await client.fetch<string[]>(
        `*[(  _type == "newsArticle" || _type == "company") && tenantId == $tenantId]._id`,
        { tenantId },
      );
      for (const id of seededIds) existingSeededIdSet.add(id);
      if (seededIds.length > 0) {
        console.log(
          `[tenant-provisioner] found ${seededIds.length} existing seeded doc(s) — ` +
          `will skip in fill mode`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(
        `Could not pre-fetch existing seeded document IDs: ${msg}. ` +
        `Existing seeded documents may be overwritten on this run.`,
      );
    }
  }

  // ── Write variant documents ───────────────────────────────────────────────
  const written: string[] = [];

  for (const doc of variantDocs) {
    const docId = (doc as { _id: string })._id;
    try {
      await client.createOrReplace(doc as Parameters<typeof client.createOrReplace>[0]);
      written.push(docId);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return {
        ok:      false,
        error:   `Failed to write document "${docId}": ${reason}`,
        partial: written,
      };
    }
  }

  const variantsWritten = written.length;

  // ── Write page documents ──────────────────────────────────────────────────
  //
  // Three write strategies controlled by starterContentMode:
  //
  //   "fill" (default, non-destructive)
  //     New pages:    createIfNotExists — creates the full starter document.
  //     Empty pages:  patch sections — fills pages that exist but have no
  //                   sections (e.g. from a prior "none"-mode or clean-slate run).
  //     Filled pages: left unchanged — existing content is never overwritten.
  //
  //   "overwrite" (destructive)
  //     All pages:    createOrReplace — always writes the full starter document,
  //                   replacing any existing content with rich starter copy.
  //
  //   "none" (structural stubs only)
  //     All pages:    createOrReplace — writes block stubs (type + key, no copy).
  //                   Useful for a clean-slate where editors fill content manually.
  //
  const useFill = _contentMode === "fill";
  let pagesCreated = 0;
  let pagesUpdated = 0;

  for (const doc of pageDocs) {
    const docId = (doc as { _id: string })._id;
    try {
      if (useFill) {
        if (emptyExistingPageIds.has(docId)) {
          // Page exists but has no sections — patch with starter sections
          // rather than skipping entirely.  This handles re-initialize runs
          // on pages that were previously created with empty sections.
          const starterSections = (doc as { sections?: unknown[] }).sections ?? [];
          if (starterSections.length > 0) {
            await (client.patch(docId).set({ sections: starterSections }).commit() as Promise<unknown>);
            written.push(docId);
            pagesUpdated++;
            console.log(
              `[tenant-provisioner] patched empty page "${docId}" with ` +
              `${starterSections.length} starter section(s)`,
            );
          }
          // If starterSections is also empty (mode="none"), no-op is correct.
        } else {
          // createIfNotExists returns the existing document unchanged when the
          // id already exists — non-destructive on re-runs.
          await client.createIfNotExists(doc as Parameters<typeof client.createIfNotExists>[0]);
          if (existingPageIdSet.has(docId)) {
            // Document already had content — left unchanged (fill mode).
            console.log(`[tenant-provisioner] page "${docId}" already has content — skipped (fill mode)`);
          } else {
            written.push(docId);
            pagesCreated++;
            console.log(`[tenant-provisioner] created new page "${docId}"`);
          }
        }
      } else {
        await client.createOrReplace(doc as Parameters<typeof client.createOrReplace>[0]);
        written.push(docId);
        if (existingPageIdSet.has(docId)) {
          pagesUpdated++;
          console.log(`[tenant-provisioner] replaced page "${docId}" (${_contentMode} mode)`);
        } else {
          pagesCreated++;
          console.log(`[tenant-provisioner] created page "${docId}" (${_contentMode} mode)`);
        }
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return {
        ok:      false,
        error:   `Failed to write document "${docId}": ${reason}`,
        partial: written,
      };
    }
  }

  // ── Write component showcase page (optional) ─────────────────────────────
  //
  // Only written when includeShowcasePage is true.  The showcase page lists
  // every registered block type so editors can browse components in Studio.
  // It is always written with createOrReplace (the doc is never "content" —
  // it is a generated reference page that can safely be overwritten).
  if (_showcaseDoc) {
    const showcaseDoc = _showcaseDoc;
    const showcaseId  = (showcaseDoc as { _id: string })._id;
    try {
      await client.createOrReplace(showcaseDoc as Parameters<typeof client.createOrReplace>[0]);
      written.push(showcaseId);
      if (existingPageIdSet.has(showcaseId)) {
        pagesUpdated++;
      } else {
        pagesCreated++;
      }
      console.log(`[tenant-provisioner] showcase page written: "${showcaseId}"`);
    } catch (err) {
      // Non-fatal: the showcase page is optional operator tooling.
      const reason = err instanceof Error ? err.message : String(err);
      warnings.push(
        `Could not write component showcase page "${showcaseId}": ${reason}. ` +
        `Re-initialize with "Include component showcase" enabled to retry.`,
      );
    }
  }

  // ── Write seeded detail pages (news + case study routes) ─────────────────
  //
  // Written using the same fill/overwrite/none strategy as regular pages.
  // These are true page documents (type = "page"), so they re-use the same
  // existingPageIdSet / emptyExistingPageIds tracking established above.
  for (const doc of seededDetailPages) {
    const docId = (doc as { _id: string })._id;
    try {
      if (useFill) {
        if (emptyExistingPageIds.has(docId)) {
          const starterSections = (doc as { sections?: unknown[] }).sections ?? [];
          if (starterSections.length > 0) {
            await (client.patch(docId).set({ sections: starterSections }).commit() as Promise<unknown>);
            written.push(docId);
            pagesUpdated++;
          }
        } else {
          await client.createIfNotExists(doc as Parameters<typeof client.createIfNotExists>[0]);
          if (!existingPageIdSet.has(docId)) {
            written.push(docId);
            pagesCreated++;
            console.log(`[tenant-provisioner] created seeded detail page "${docId}"`);
          }
        }
      } else {
        await client.createOrReplace(doc as Parameters<typeof client.createOrReplace>[0]);
        written.push(docId);
        if (existingPageIdSet.has(docId)) {
          pagesUpdated++;
        } else {
          pagesCreated++;
        }
        console.log(`[tenant-provisioner] wrote seeded detail page "${docId}" (${_contentMode} mode)`);
      }
    } catch (err) {
      // Non-fatal: detail pages are convenience scaffolding.  Log and continue.
      const reason = err instanceof Error ? err.message : String(err);
      warnings.push(
        `Could not write seeded detail page "${docId}": ${reason}. ` +
        `Re-initialize to retry.`,
      );
    }
  }

  // ── Write seeded content documents (newsArticle, company) ─────────────────
  //
  // "fill"      → createIfNotExists — never overwrites existing editorial data.
  // "overwrite" → createOrReplace   — always replaces with fresh starter docs.
  // "none"      → skipped entirely  (seededDocs array is empty in none mode).
  let seededDocsWritten = 0;
  for (const doc of seededDocs) {
    const docId = (doc as { _id: string })._id;
    try {
      if (useFill) {
        if (existingSeededIdSet.has(docId)) {
          console.log(`[tenant-provisioner] seeded doc "${docId}" already exists — skipped (fill mode)`);
        } else {
          await client.createIfNotExists(doc as Parameters<typeof client.createIfNotExists>[0]);
          written.push(docId);
          seededDocsWritten++;
          console.log(`[tenant-provisioner] created seeded doc "${docId}"`);
        }
      } else {
        await client.createOrReplace(doc as Parameters<typeof client.createOrReplace>[0]);
        written.push(docId);
        seededDocsWritten++;
        console.log(`[tenant-provisioner] wrote seeded doc "${docId}" (${_contentMode} mode)`);
      }
    } catch (err) {
      // Non-fatal: seeded content is convenience scaffolding.
      const reason = err instanceof Error ? err.message : String(err);
      warnings.push(
        `Could not write seeded document "${docId}": ${reason}. ` +
        `Re-initialize to retry.`,
      );
    }
  }

  if (seededDocsWritten > 0) {
    console.log(`[tenant-provisioner] seeded ${seededDocsWritten} content doc(s) for "${tenantId}"`);
  }

  // ── Write navigation items + site settings (siteType path only) ──────────
  //
  // Only written when siteType is provided (new tenant bootstrap).
  // Re-provisioning without a siteType uses the legacy path and skips these
  // documents — the operator configures navigation manually in Sanity Studio.
  let siteSettingsWritten = false;
  let navItemsWritten     = 0;

  if (sitePreset) {
    // Main nav: provisioned non-detail pages only.
    // Use pageEntries (the actual selection) rather than sitePreset.pages so
    // that pages the operator deselected do not get nav items written for them.
    const mainNavEntries = pageEntries.filter(
      (entry) => !entry.presetKey.startsWith("detail_"),
    );

    // Footer nav: content-section pages that are likely provisioned.
    // Prefer: about, services, cases, news, contact — in that order.
    const footerSlugPriority = ["about", "services", "cases", "news", "contact"];
    const provisonedSlugs    = new Set(pageEntries.map((e) => e.slug));
    const footerNavEntries   = footerSlugPriority
      .filter((s) => provisonedSlugs.has(s))
      .map((s) => pageEntries.find((e) => e.slug === s)!)
      .filter(Boolean);

    // Build and write nav item docs for main navigation
    for (const entry of mainNavEntries) {
      const navDoc = buildNavItemDoc(tenantId, entry.title, entry.slug);
      const docId  = (navDoc as { _id: string })._id;
      try {
        await client.createOrReplace(navDoc as Parameters<typeof client.createOrReplace>[0]);
        written.push(docId);
        navItemsWritten++;
      } catch (err) {
        // Non-fatal: navigation is a convenience — pages still work without nav
        const reason = err instanceof Error ? err.message : String(err);
        warnings.push(
          `Could not write navigation item "${docId}": ${reason}. ` +
          `Navigation will need to be configured manually in Sanity Studio.`,
        );
      }
    }

    // Build and write nav item docs for footer navigation (if not already in main nav)
    const mainNavSlugSet = new Set(mainNavEntries.map((e) => e.slug));
    for (const entry of footerNavEntries) {
      if (mainNavSlugSet.has(entry.slug)) continue; // already written above
      const navDoc = buildNavItemDoc(tenantId, entry.title, entry.slug);
      const docId  = (navDoc as { _id: string })._id;
      try {
        await client.createOrReplace(navDoc as Parameters<typeof client.createOrReplace>[0]);
        written.push(docId);
        navItemsWritten++;
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        warnings.push(
          `Could not write footer navigation item "${docId}": ${reason}.`,
        );
      }
    }

    // Write /components nav item (for the showcase page in main nav)
    if (_showcaseDoc) {
      const componentsNavDoc = buildNavItemDoc(tenantId, "Components", "components");
      const componentsNavId  = (componentsNavDoc as { _id: string })._id;
      try {
        await client.createOrReplace(componentsNavDoc as Parameters<typeof client.createOrReplace>[0]);
        written.push(componentsNavId);
        navItemsWritten++;
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        warnings.push(
          `Could not write components navigation item: ${reason}.`,
        );
      }
    }

    // Write external nav items for footer utility links (Privacy Policy etc.)
    const privacyNavDoc = buildExternalNavItemDoc(tenantId, "Privacy Policy", "/privacy", "privacy");
    const privacyNavId  = (privacyNavDoc as { _id: string })._id;
    try {
      await client.createOrReplace(privacyNavDoc as Parameters<typeof client.createOrReplace>[0]);
      written.push(privacyNavId);
      navItemsWritten++;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      warnings.push(`Could not write privacy nav item: ${reason}.`);
    }

    // Write per-tenant siteSettings doc
    // Map SitePageEntry[] → { slug, label }[] (the helper uses "label" for nav item text;
    // the SitePageEntry carries the same text under "title").
    const toNavRef = (e: { slug: string; title: string }) => ({ slug: e.slug, label: e.title });
    const siteSettingsDoc = buildSiteSettingsDoc(
      tenantId,
      mainNavEntries.map(toNavRef),
      footerNavEntries.map(toNavRef),
      [{ idSuffix: "privacy" }],   // footer utility: Privacy Policy (external link)
      !!_showcaseDoc,              // include /components in main nav
    );
    const settingsDocId   = (siteSettingsDoc as { _id: string })._id;
    try {
      await client.createOrReplace(siteSettingsDoc as Parameters<typeof client.createOrReplace>[0]);
      written.push(settingsDocId);
      siteSettingsWritten = true;
    } catch (err) {
      // Non-fatal: site settings are convenience scaffolding
      const reason = err instanceof Error ? err.message : String(err);
      warnings.push(
        `Could not write site settings document "${settingsDocId}": ${reason}. ` +
        `Site settings will need to be configured manually in Sanity Studio.`,
      );
    }
  }

  return {
    ok:                  true,
    documentIds:         written,
    pagesCreated,
    pagesUpdated,
    variantsWritten,
    siteSettingsWritten,
    navItemsWritten,
    warnings,
  };
}

// ── CLI entry-point ────────────────────────────────────────────────────────────
//
// Invoked directly for manual or CI provisioning:
//   SANITY_PROJECT_ID=... SANITY_API_WRITE_TOKEN=... \
//     npx tsx cms/seed/tenant-provisioner.ts --tenant=workengine [--dry-run]

const isDirect =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  (
    process.argv[1].endsWith("tenant-provisioner.ts") ||
    process.argv[1].endsWith("tenant-provisioner.js")
  );

if (isDirect) {
  (async () => {
    const args      = process.argv.slice(2);
    const dryRun    = args.includes("--dry-run");
    const tenantArg = args.find((a) => a.startsWith("--tenant="));

    if (!tenantArg) {
      console.error("\nUsage: npx tsx cms/seed/tenant-provisioner.ts --tenant=<tenantId> [--dry-run]\n");
      process.exit(1);
    }

    const tenantId = tenantArg.split("=")[1]?.trim();
    if (!tenantId) {
      console.error("No tenantId provided in --tenant= argument.");
      process.exit(1);
    }

    // For CLI usage we build a minimal TenantSettings stub.
    // The store is not available in all CLI environments, so we accept
    // an optional --package flag and default to "starter".
    const packageArg = args.find((a) => a.startsWith("--package="));
    const packageKey = (packageArg?.split("=")[1]?.trim() ?? "starter") as
      "starter" | "growth" | "pro";

    const stub: TenantSettings = {
      tenantId,
      packageKey,
      features: { experiments: false, ai: false, analytics: true },
      blocks:   { context: ["hero", "proof", "cta"], content: [] },
      ai:       { mode: "disabled" },
      cms:      { provider: "sanity" },
      design:   { theme: "default" },
    };

    console.log(`\n🌱  Provisioning "${tenantId}" (${packageKey}) — ${dryRun ? "DRY RUN" : "LIVE"}\n`);

    const result = await provisionTenant(stub, dryRun);

    if (!result.ok) {
      console.error(`\n❌  Provisioning failed: ${result.error}`);
      if (result.partial?.length) {
        console.log(`  Partial writes: ${result.partial.join(", ")}`);
      }
      process.exit(1);
    }

    console.log(`\n✅  Provisioned ${result.documentIds.length} documents:`);
    for (const id of result.documentIds) {
      console.log(`  ${id}`);
    }
    if (!dryRun) {
      console.log(
        `\n  Pages created: ${result.pagesCreated}  updated: ${result.pagesUpdated}` +
        `  Variants written: ${result.variantsWritten}` +
        `  Nav items: ${result.navItemsWritten}` +
        `  Site settings: ${result.siteSettingsWritten ? "✓" : "skipped"}`,
      );
    }
    if (result.warnings.length > 0) {
      console.log("\nWarnings:");
      for (const w of result.warnings) {
        console.log(`  ⚠  ${w}`);
      }
    }
    console.log();
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
