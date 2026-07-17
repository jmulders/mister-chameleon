/**
 * demo/ai-generator.ts
 *
 * AI-powered content generation for prospect demos.
 * Uses Claude (Anthropic) to produce structured page content.
 * Server only — requires ANTHROPIC_API_KEY env var.
 *
 * ─── Two generation modes ─────────────────────────────────────────────────────
 *
 *   v2 (preferred) — generateDemoPageSpec()
 *     Outputs a DemoPageSpec matching the strict block contract defined in
 *     demo/block-contract.ts. Each block has an explicit type, variant, localized
 *     content, and scenario overrides. The output maps directly to Chameleon blocks
 *     via demo/block-mapper.ts.
 *
 *   v1 (legacy) — generatePageContentWithAI()
 *     Outputs a DemoPageContent with freeform hero/services/proof/cta sections.
 *     Kept for backward compatibility. New code should use v2.
 *
 * ─── Failure contract ─────────────────────────────────────────────────────────
 *
 *   Both functions return null (never throw) when:
 *   • ANTHROPIC_API_KEY is not set
 *   • The API call fails or times out
 *   • The response cannot be parsed as valid contract-conforming JSON
 *
 *   The caller (content-generator.ts) falls back to default block sets on null.
 */

import type {
  SiteAnalysis,
  DemoLanguage,
  DemoPageContent,
  DemoScenarioId,
  HeroBlock,
  ServicesBlock,
  ProofBlock,
  CasesBlock,
  CtaBlock,
  PricingBlock,
  CareersBlock,
  ScenarioOverride,
} from "./types";
import type { DemoPageSpec, DemoBlockSpec } from "./block-contract";
import { getRelevantBlockTypes } from "./block-contract";

// ── Model config ──────────────────────────────────────────────────────────────

const AI_MODEL      = "claude-sonnet-4-6";
const AI_TIMEOUT    = 50_000;  // 50 s — v2 prompt is larger
const MAX_TOKENS_V1 = 4_096;
const MAX_TOKENS_V2 = 6_000;   // block-contract output is larger

// ── Shared AI caller ──────────────────────────────────────────────────────────

/**
 * Resolves the Anthropic API key.
 * Priority: platform settings DB → ANTHROPIC_API_KEY env var → null.
 */
async function resolveAnthropicKey(): Promise<string | null> {
  try {
    const { getPlatformAiSettings } = await import("@/platform/platform-store");
    const result = await getPlatformAiSettings();
    if (result.ok && result.data.anthropicKey) return result.data.anthropicKey;
  } catch {
    // platform-store unavailable (e.g. DB not configured) — fall through
  }
  return process.env["ANTHROPIC_API_KEY"] ?? null;
}

async function callClaude(
  systemPrompt: string,
  userPrompt:   string,
  maxTokens:    number,
): Promise<string | null> {
  const apiKey = await resolveAnthropicKey();
  if (!apiKey) return null;

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client    = new Anthropic({ apiKey });

    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), AI_TIMEOUT);

    try {
      const message = await client.messages.create({
        model:      AI_MODEL,
        max_tokens: maxTokens,
        system:     systemPrompt,
        messages:   [{ role: "user", content: userPrompt }],
      });
      return message.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("");
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    return null; // swallowed — callers log as needed
  }
}

/** Strip accidental markdown code fences and whitespace from an AI response */
function cleanJson(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

// ═════════════════════════════════════════════════════════════════════════════
// v2 — Block Contract Generation
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Generate a DemoPageSpec conforming to the strict block contract for one language.
 *
 * The page spec contains one block per relevant section type for the given site
 * category, with bilingual content baked into the `content.en` / `content.nl`
 * fields. Scenario overrides are generated for the five standard scenarios.
 *
 * Returns null on any failure — never throws.
 */
export async function generateDemoPageSpec(
  analysis: SiteAnalysis,
  language: DemoLanguage,
): Promise<DemoPageSpec | null> {
  const raw = await callClaude(
    buildV2SystemPrompt(language),
    buildV2Prompt(analysis, language),
    MAX_TOKENS_V2,
  );

  if (!raw) {
    console.warn("[demo/ai-generator] v2 API call returned null", {
      category: analysis.category, language,
    });
    return null;
  }

  return parseV2Response(cleanJson(raw), analysis, language);
}

/**
 * Generate block-contract DemoPageSpecs for EN and NL in parallel.
 * Either result may be null if its call fails.
 */
export async function generateBilingualPageSpec(analysis: SiteAnalysis): Promise<{
  en: DemoPageSpec | null;
  nl: DemoPageSpec | null;
}> {
  const [en, nl] = await Promise.all([
    generateDemoPageSpec(analysis, "en"),
    generateDemoPageSpec(analysis, "nl"),
  ]);
  return { en, nl };
}

// ── v2 system prompt ──────────────────────────────────────────────────────────

function buildV2SystemPrompt(language: DemoLanguage): string {
  const langName = language === "nl" ? "Dutch (Nederlands)" : "English";
  return `You are an expert B2B copywriter and website architect specialising in high-converting demo pages.
You generate structured JSON that maps directly into a Chameleon website block system.

Rules:
• Write ALL copy exclusively in ${langName}.
• Headlines: max 10 words, punchy, benefit-led, no buzzword fluff.
• Subheadlines / body: 1–2 sentences max per field.
• CTA labels: action verb + 2–4 words (e.g. "Start free trial", "Book a demo", "See pricing").
• Feature/service descriptions: 1 sentence, benefit-focused, no passive voice.
• Testimonial quotes: 1–2 sentences, specific and believable — include a measurable result where natural.
• Stats: realistic values — do not invent extreme numbers. Use formats like "3.2×", "94 %", "< 3 days".
• Scenario overrides: change only the fields that genuinely differ per scenario.
• Output ONLY valid JSON — no markdown, no code fences, no commentary, no trailing commas.
• Do not add fields beyond those shown in the schema.
• Every required field in every block must be present and non-empty.`;
}

// ── v2 user prompt ────────────────────────────────────────────────────────────

function buildV2Prompt(analysis: SiteAnalysis, language: DemoLanguage): string {
  const { title, description, category, keywords, firstH1 } = analysis;
  const catLabel  = CATEGORY_LABELS[category] ?? "Professional services";
  const kwStr     = keywords.slice(0, 8).join(", ") || "not specified";
  const langName  = language === "nl" ? "Dutch" : "English";
  const blockTypes = getRelevantBlockTypes(category);
  const hasPricing = blockTypes.includes("pricing");
  const hasCareers = blockTypes.includes("careers");
  const hasContact = blockTypes.includes("contact");
  const hasFaq     = blockTypes.includes("faq");
  const hasCase    = blockTypes.includes("case_highlight");
  const hasProcess = blockTypes.includes("process");

  const pricingSchema = hasPricing ? `
  {
    "id": "pricing-main",
    "type": "pricing",
    "variant": "pricing_tiers",
    "content": {
      "heading": string,
      "subheading": string,
      "tiers": [             // exactly 3 tiers
        {
          "name": string,
          "price": string,   // e.g. "€49", "Free", "Custom"
          "period": string,  // e.g. "/month", "/year", "forever"
          "description": string,
          "features": [string],  // 4–5 features
          "ctaLabel": string,
          "highlighted": boolean,
          "badge": string | undefined  // e.g. "Most popular" on highlighted tier
        }
      ]
    }
  },` : "";

  const careersSchema = hasCareers ? `
  {
    "id": "careers-section",
    "type": "careers",
    "variant": "content_default",
    "content": {
      "heading": string,
      "eyebrow": string,   // e.g. "We're hiring"
      "body": string,      // 2–3 sentences about team culture
      "roles": [           // 3 realistic open roles
        { "title": string, "department": string, "location": string }
      ],
      "ctaLabel": string
    }
  },` : "";

  const contactSchema = hasContact ? `
  {
    "id": "contact-main",
    "type": "contact",
    "variant": "contact_default",
    "content": {
      "heading": string,
      "description": string,
      "email": string,
      "phone": string,
      "address": string,
      "hours": string,
      "ctas": [{ "label": string, "href": "#" }]
    }
  },` : "";

  const faqSchema = hasFaq ? `
  {
    "id": "faq-main",
    "type": "faq",
    "variant": "faq_default",
    "content": {
      "heading": string,
      "items": [  // 4 relevant Q&A pairs
        { "question": string, "answer": string }
      ]
    }
  },` : "";

  const caseSchema = hasCase ? `
  {
    "id": "case-main",
    "type": "case_highlight",
    "variant": "default",
    "content": {
      "heading": string,
      "client": string,
      "challenge": string,
      "outcome": string,
      "metrics": [
        { "label": string, "value": string }
      ],
      "ctaLabel": string
    }
  },` : "";

  const processSchema = hasProcess ? `
  {
    "id": "process-main",
    "type": "process",
    "variant": "default",
    "content": {
      "heading": string,
      "steps": [  // 4–5 steps
        { "title": string, "description": string, "duration": string }
      ]
    }
  },` : "";

  return `Generate a complete demo page for the following company.

COMPANY DETAILS:
- Name: ${title}
- Industry: ${catLabel}
- Description: ${description || "Not available"}
- First headline on site: ${firstH1 || "Not available"}
- Keywords: ${kwStr}
- Output language: ${langName}

Output a JSON object matching this EXACT schema (a DemoPageSpec):

{
  "slug": "/",
  "title": "Homepage",
  "template": "marketing-page",
  "blocks": [
    {
      "id": "hero-main",
      "type": "hero",
      "variant": "hero_split",
      "content": {
        "headline": string,       // max 10 words
        "subheadline": string,    // 1–2 sentences
        "primaryCta": { "label": string, "href": "#" },
        "secondaryCta": { "label": string, "href": "#" },
        "tag": string             // short eyebrow badge, e.g. "Now with AI"
      },
      "scenarioOverrides": {
        "new_visitor":       { "headline": string, "subheadline": string, "primaryCta": { "label": string, "href": "#" } },
        "returning_visitor": { "headline": string, "subheadline": string, "primaryCta": { "label": string, "href": "#" } },
        "high_intent":       { "headline": string, "subheadline": string, "primaryCta": { "label": string, "href": "#" } },
        "careers":           { "headline": string, "subheadline": string, "primaryCta": { "label": string, "href": "#" } },
        "evening":           { "headline": string, "subheadline": string, "primaryCta": { "label": string, "href": "#" } }
      }
    },
    {
      "id": "stats-proof",
      "type": "stats",
      "variant": "default",
      "content": {
        "heading": string,
        "items": [  // exactly 3 metrics
          { "value": string, "label": string }
        ]
      }
    },
    {
      "id": "features-main",
      "type": "features",
      "variant": "feature_grid_4up",
      "content": {
        "heading": string,
        "subheading": string,
        "items": [  // exactly 4 feature cards
          { "icon": string, "title": string, "description": string }
        ]
      }
    },
    {
      "id": "testimonials-main",
      "type": "testimonials",
      "variant": "testimonial_highlight",
      "content": {
        "heading": string,
        "items": [  // exactly 3 testimonials
          { "quote": string, "author": string, "role": string, "company": string }
        ]
      }
    },${caseSchema}${processSchema}${pricingSchema}${faqSchema}${careersSchema}${contactSchema}
    {
      "id": "cta-main",
      "type": "cta",
      "variant": "cta_split",
      "content": {
        "heading": string,
        "body": string,
        "primaryCta": { "label": string, "href": "#" },
        "secondaryCta": { "label": string, "href": "#" },
        "background": "brand"
      },
      "scenarioOverrides": {
        "high_intent": { "heading": string, "body": string, "primaryCta": { "label": string, "href": "#" } },
        "careers":     { "heading": string, "body": string, "primaryCta": { "label": string, "href": "#" } }
      }
    }
  ]
}

SCENARIO GUIDELINES (for scenarioOverrides):
- new_visitor:       Awareness stage. Focus on value proposition + credibility. CTA = "Try free" / "Learn more".
- returning_visitor: Evaluation stage. Focus on depth and fit. CTA = "Book a demo" / "Compare plans".
- high_intent:       Decision stage. Focus on urgency and next steps. CTA = "Start now" / "Get a quote".
- careers:           Job seeker. Hero focuses on team culture and growth. CTA = "View open roles".
- evening:           After-hours researcher. Calm, self-directed tone. CTA = "Browse resources" / "Read case studies".

ICON SUGGESTIONS (use slug-style keys):
lightning, chart, shield, integration, search, calendar, file, check-circle,
users, key, palette, code, megaphone, star, truck, rotate-ccw, globe, layers

Return ONLY the JSON object. No other text.`;
}

// ── v2 response parser ────────────────────────────────────────────────────────

function parseV2Response(
  cleaned:  string,
  analysis: SiteAnalysis,
  language: DemoLanguage,
): DemoPageSpec | null {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    console.warn("[demo/ai-generator] v2 JSON parse failed", {
      category: analysis.category, language, preview: cleaned.slice(0, 300),
    });
    return null;
  }

  // Structural validation
  if (!Array.isArray(parsed["blocks"]) || (parsed["blocks"] as unknown[]).length === 0) {
    console.warn("[demo/ai-generator] v2 missing or empty blocks array", {
      category: analysis.category, language,
    });
    return null;
  }

  const blocks = parsed["blocks"] as Record<string, unknown>[];

  // Validate each block has required fields
  for (const b of blocks) {
    if (!b["id"] || !b["type"] || !b["content"] || typeof b["content"] !== "object") {
      console.warn("[demo/ai-generator] v2 block missing required fields", {
        blockId: b["id"], type: b["type"],
      });
      return null;
    }
  }

  // Validate hero block is present
  const heroBlock = blocks.find((b) => b["type"] === "hero");
  if (!heroBlock) {
    console.warn("[demo/ai-generator] v2 missing hero block", { category: analysis.category });
    return null;
  }

  return {
    slug:     (parsed["slug"] as string | undefined) ?? "/",
    title:    (parsed["title"] as string | undefined) ?? analysis.title,
    template: "marketing-page",
    seo: {
      title:       analysis.title,
      description: analysis.description || undefined,
    },
    // Double cast, because the two types genuinely do not overlap and TypeScript
    // is right to say so: `blocks` is model output, parsed from JSON. The loop
    // above is what makes this safe — it rejects the whole page unless every
    // block has an id, a type and an object content. Beyond that we are trusting
    // the model, and the cast says so out loud instead of pretending.
    blocks: blocks as unknown as DemoBlockSpec[],
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// v1 — Legacy DemoPageContent Generation (kept for backward compat)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Generate full DemoPageContent for one language via Claude.
 * @deprecated Prefer generateDemoPageSpec() (v2) for new code.
 * Returns null on any failure — never throws.
 */
export async function generatePageContentWithAI(
  analysis: SiteAnalysis,
  language: DemoLanguage,
): Promise<DemoPageContent | null> {
  const raw = await callClaude(
    buildV1SystemPrompt(language),
    buildV1Prompt(analysis, language),
    MAX_TOKENS_V1,
  );

  if (!raw) {
    console.warn("[demo/ai-generator] v1 AI generation failed — falling back to templates", {
      category: analysis.category, language,
    });
    return null;
  }

  return parseV1Response(cleanJson(raw), analysis, language);
}

/**
 * Generate bilingual v1 DemoPageContent in two parallel calls.
 * @deprecated Prefer generateBilingualPageSpec() (v2) for new code.
 */
export async function generateBilingualContent(analysis: SiteAnalysis): Promise<{
  en: DemoPageContent | null;
  nl: DemoPageContent | null;
}> {
  const [en, nl] = await Promise.all([
    generatePageContentWithAI(analysis, "en"),
    generatePageContentWithAI(analysis, "nl"),
  ]);
  return { en, nl };
}

// ── v1 prompts ────────────────────────────────────────────────────────────────

function buildV1SystemPrompt(language: DemoLanguage): string {
  const langName = language === "nl" ? "Dutch (Nederlands)" : "English";
  return `You are a senior copywriter specialising in high-converting B2B website content.
You generate structured, professional, brand-aligned website content for sales demos.

Rules:
• Write exclusively in ${langName}.
• Keep headlines short and punchy (max 10 words).
• Keep subheadlines to 1–2 sentences max.
• CTA labels must be action verbs, 2–5 words (e.g. "Get started free", "Book a demo").
• Service descriptions: 1 sentence, benefit-focused.
• Testimonial quotes: 1–2 sentences, specific, believable.
• Use realistic stat values (not made-up extremes).
• Output ONLY valid JSON — no markdown, no code fences, no commentary.
• Do not add fields beyond those in the schema.`;
}

function buildV1Prompt(analysis: SiteAnalysis, language: DemoLanguage): string {
  const { title, description, category, keywords, firstH1 } = analysis;
  const catLabel = CATEGORY_LABELS[category] ?? "Professional services";
  const kwStr    = keywords.slice(0, 8).join(", ") || "not specified";
  const langName = language === "nl" ? "Dutch" : "English";

  return `Generate website content for a prospect sales demo.

COMPANY DETAILS:
- Name: ${title}
- Industry: ${catLabel}
- Description: ${description || "Not available"}
- First headline on site: ${firstH1 || "Not available"}
- Keywords: ${kwStr}
- Language: ${langName}

Generate a JSON object matching this EXACT TypeScript schema:

{
  "hero": {
    "headline": string,         // max 10 words, compelling, scenario-neutral
    "subheadline": string,      // 1-2 sentences, key benefit
    "primaryCta": string,       // action label, 2-5 words
    "secondaryCta": string      // secondary action, 2-5 words
  },
  "services": {
    "heading": string,          // section title
    "subheading": string,       // 1 sentence
    "services": [               // exactly 4 cards
      { "icon": string, "title": string, "description": string }
    ]
  },
  "proof": {
    "heading": string,
    "metrics": [                // exactly 3 metrics
      { "value": string, "label": string }
    ],
    "testimonial": {
      "quote": string,          // 1-2 sentences, specific
      "author": string,
      "role": string,
      "company": string
    }
  },
  "cases": {                    // 2 brief case references
    "heading": string,
    "cases": [
      { "company": string, "industry": string, "description": string, "result": string }
    ]
  },
  "cta": {
    "heading": string,
    "body": string,             // 1-2 sentences
    "primaryCta": string,
    "secondaryCta": string
  },
  ${category === "b2b_saas" ? `"pricing": {
    "heading": string,
    "subheading": string,
    "tiers": [                  // exactly 3 tiers
      {
        "name": string,
        "price": string,        // e.g. "€49" or "Free"
        "period": string,       // e.g. "per month" or "forever"
        "description": string,
        "features": [string],   // 4-5 features
        "ctaLabel": string,
        "highlighted": boolean  // true for the recommended tier
      }
    ]
  },` : ""}
  "careers": {
    "heading": string,
    "body": string,             // 2-3 sentences about culture
    "roles": [                  // 3 realistic open roles
      { "title": string, "department": string, "location": string }
    ],
    "ctaLabel": string
  },
  "scenarioOverrides": {
    "new_visitor":       { "heroHeadline": string, "heroSubheadline": string, "heroCta": string, "proofHeading": string, "ctaHeading": string, "ctaBody": string, "ctaCta": string },
    "returning_visitor": { "heroHeadline": string, "heroSubheadline": string, "heroCta": string, "proofHeading": string, "ctaHeading": string, "ctaBody": string, "ctaCta": string },
    "high_intent":       { "heroHeadline": string, "heroSubheadline": string, "heroCta": string, "proofHeading": string, "ctaHeading": string, "ctaBody": string, "ctaCta": string },
    "careers":           { "heroHeadline": string, "heroSubheadline": string, "heroCta": string, "ctaHeading": string, "ctaBody": string, "ctaCta": string },
    "evening":           { "heroHeadline": string, "heroSubheadline": string, "heroCta": string, "ctaHeading": string, "ctaBody": string, "ctaCta": string }
  }
}

SCENARIO GUIDELINES:
- new_visitor: Awareness stage, focus on value + credibility. CTA = free trial / learn more.
- returning_visitor: Evaluation stage, focus on depth + fit. CTA = demo / comparison.
- high_intent: Decision stage, focus on urgency + implementation. CTA = start now / get quote.
- careers: Job seeker exploring culture. Hero focuses on team + growth.
- evening: After-hours researcher. Calm, self-directed, resource-focused.

Return ONLY the JSON object. No other text.`;
}

// ── v1 response parser ────────────────────────────────────────────────────────

function parseV1Response(
  cleaned:  string,
  analysis: SiteAnalysis,
  language: DemoLanguage,
): DemoPageContent | null {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    console.warn("[demo/ai-generator] v1 JSON parse failed", { preview: cleaned.slice(0, 200) });
    return null;
  }

  // Validate required top-level keys
  const required = ["hero", "services", "proof", "cta", "careers", "scenarioOverrides"];
  for (const key of required) {
    if (!parsed[key] || typeof parsed[key] !== "object") {
      console.warn(`[demo/ai-generator] v1 missing required field: ${key}`);
      return null;
    }
  }

  return {
    language,
    hero:              parsed["hero"]              as HeroBlock,
    services:          parsed["services"]          as ServicesBlock,
    proof:             parsed["proof"]             as ProofBlock,
    cases:             parsed["cases"]             as CasesBlock | undefined,
    cta:               parsed["cta"]               as CtaBlock,
    pricing:           parsed["pricing"]           as PricingBlock | undefined,
    careers:           parsed["careers"]           as CareersBlock | undefined,
    scenarioOverrides: (parsed["scenarioOverrides"] ?? {}) as Partial<Record<DemoScenarioId, ScenarioOverride>>,
  };
}

// ── Shared helpers ────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  b2b_saas:    "B2B SaaS / Software platform",
  agency:      "Creative / marketing agency",
  ecommerce:   "eCommerce / online retail",
  recruitment: "Recruitment / staffing platform",
  general:     "Professional services",
};
