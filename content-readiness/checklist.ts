/**
 * Content Readiness Checklist
 *
 * The default set of checks for evaluating whether a tenant has sufficient
 * content coverage and quality to launch on the Mister Chameleon platform.
 *
 * ─── Check inventory (19 checks) ─────────────────────────────────────────────
 *
 *   Coverage (5)
 *     hero-minimum-variants         [error]   At least 1 hero key has content
 *     proof-minimum-variants        [error]   At least 1 proof key has content
 *     cta-minimum-variants          [error]   At least 1 CTA key has content
 *     hero-recommended-variants     [warning] At least 2 hero keys have content
 *     all-blocks-have-coverage      [error]   Each enabled block has live content
 *
 *   Completeness (4)
 *     hero-all-keys-have-content    [error]   No configured hero key is missing
 *     proof-all-keys-have-content   [error]   No configured proof key is missing
 *     cta-all-keys-have-content     [error]   No configured CTA key is missing
 *     proof-items-minimum           [warning] Each proof variant has 2+ items
 *
 *   Quality (5)
 *     hero-titles-non-empty         [error]   Hero title fields are populated
 *     hero-subtitles-non-empty      [warning] Hero subtitle fields are populated
 *     cta-labels-non-placeholder    [error]   CTA button labels are not defaults
 *     cta-hrefs-non-placeholder     [error]   CTA hrefs are not placeholders
 *     hero-tags-present             [info]    Hero eyebrow tags are written
 *
 *   Metadata (3)
 *     hero-ids-match-keys           [warning] HeroBlockData.id matches the variant key
 *     proof-ids-match-keys          [warning] ProofBlockData.id matches the variant key
 *     cta-ids-match-keys            [warning] CTABlockData.id matches the variant key
 *
 *   Features (2)
 *     ab-testing-has-multiple-variants  [warning]  A/B testing needs 2+ variants
 *     contact-cta-has-booking-link      [info]     A CTA links to contact/booking
 *
 * ─── Evaluation lifecycle ─────────────────────────────────────────────────────
 *
 *   1. Call buildContentReadinessContext(tenant, cmsProvider) to fetch all CMS
 *      content for the tenant's configured variant keys. This is the async step.
 *
 *   2. Call evaluateReadiness(context) — or evaluateReadiness(context, customChecks)
 *      for a subset — to run all checks and produce a ReadinessReport.
 *
 *   3. Use the query helpers to filter and surface the results in admin tooling:
 *        getBlockingChecks(report)  → launch-blocking errors
 *        getFailedChecks(report)    → all failures (errors + warnings + infos)
 *        getChecksByCategory(report, "quality")  → quality checks only
 *
 * ─── Extending the checklist ─────────────────────────────────────────────────
 *
 *   To add a custom check, implement ContentReadinessCheck and append it to
 *   DEFAULT_READINESS_CHECKLIST, or pass a custom array to evaluateReadiness().
 *
 *   Custom check IDs must be added to ContentReadinessCheckId in types.ts
 *   (or use a type cast if you want to avoid modifying the core types).
 */

import type { CMSProvider } from "@/cms/providers/cms-provider";
import type { TenantConfig } from "@/tenant/types";
import type {
  ContentReadinessCheck,
  ContentReadinessContext,
  ContentSnapshot,
  CheckResult,
  CheckResultEntry,
  ReadinessSummary,
  ReadinessReport,
} from "./types";
import {
  ALLOWED_HERO_KEYS,
  ALLOWED_PROOF_KEYS,
  ALLOWED_CTA_KEYS,
} from "@/decision/rules/stored-rule";

// ─────────────────────────────────────────────────────────────────────────────
// PLATFORM DEFAULT VARIANT KEYS
//
// Derived from the decision module's canonical allow-lists so that there is a
// single source of truth for which variant keys exist on the platform:
//
//   decision/rules/stored-rule.ts  ←  ALLOWED_HERO_KEYS / ALLOWED_PROOF_KEYS / ALLOWED_CTA_KEYS
//     ↓ re-exposed here as
//   content-readiness/checklist.ts  ←  PLATFORM_VARIANT_KEYS  (fallback for unconfigured tenants)
//
// Per-tenant scoping is handled by the getHeroKeys / getProofKeys / getCTAKeys
// helpers below:
//   • tenant.variants is set  → use exactly those keys (per-site scope)
//   • tenant.variants absent  → fall back to ALL platform keys (full coverage)
// ─────────────────────────────────────────────────────────────────────────────

export const PLATFORM_VARIANT_KEYS = {
  hero:  ALLOWED_HERO_KEYS,
  proof: ALLOWED_PROOF_KEYS,
  cta:   ALLOWED_CTA_KEYS,
} as const;

/** Resolve the hero variant keys for a tenant, falling back to platform defaults. */
function getHeroKeys(tenant: TenantConfig): string[] {
  return tenant.variants?.hero ?? [...PLATFORM_VARIANT_KEYS.hero];
}

/** Resolve the proof variant keys for a tenant, falling back to platform defaults. */
function getProofKeys(tenant: TenantConfig): string[] {
  return tenant.variants?.proof ?? [...PLATFORM_VARIANT_KEYS.proof];
}

/** Resolve the CTA variant keys for a tenant, falling back to platform defaults. */
function getCTAKeys(tenant: TenantConfig): string[] {
  return tenant.variants?.cta ?? [...PLATFORM_VARIANT_KEYS.cta];
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Variant key patterns that indicate placeholder / unfilled content. */
const PLACEHOLDER_HREF_PATTERNS: readonly RegExp[] = [
  /^#$/,                          // bare hash anchor
  /^\/todo/i,                     // /TODO, /todo, /Todo
  /^\/placeholder/i,              // /placeholder-*
  /^https?:\/\/example\.com/i,    // http(s)://example.com*
  /^https?:\/\/localhost/i,       // localhost hrefs
];

/** CTA button labels that indicate unfilled placeholder text. */
const PLACEHOLDER_CTA_LABELS: readonly string[] = [
  "click here",
  "button",
  "cta",
  "call to action",
  "learn more",     // warning-level: too generic to be meaningful
  "read more",
];

/** Strings that indicate a contact or booking destination. */
const BOOKING_HREF_PATTERNS: readonly RegExp[] = [
  /\/contact/i,
  /\/book/i,
  /\/demo/i,
  /\/meeting/i,
  /\/schedule/i,
  /calendly\.com/i,
  /hubspot\.com/i,
  /cal\.com/i,
];

function isPlaceholderHref(href: string): boolean {
  return PLACEHOLDER_HREF_PATTERNS.some(pattern => pattern.test(href));
}

function isPlaceholderLabel(label: string): boolean {
  return PLACEHOLDER_CTA_LABELS.includes(label.trim().toLowerCase());
}

function isBookingHref(href: string): boolean {
  return BOOKING_HREF_PATTERNS.some(pattern => pattern.test(href));
}

function passResult(message: string): CheckResult {
  return { status: "pass", message };
}

function failResult(
  message: string,
  details?: string,
  affectedKeys?: string[],
): CheckResult {
  return { status: "fail", message, details, affectedKeys };
}

function skipResult(reason: string): CheckResult {
  return { status: "skipped", message: `Skipped — ${reason}` };
}

// ─────────────────────────────────────────────────────────────────────────────
// COVERAGE CHECKS
// ─────────────────────────────────────────────────────────────────────────────

const heroMinimumVariants: ContentReadinessCheck = {
  id:          "hero-minimum-variants",
  label:       "Hero variants have content",
  description: "Verifies that at least one configured hero variant key has real CMS content. Without any hero content the platform cannot render the hero block and will rely entirely on the fallback.",
  severity:    "error",
  category:    "coverage",
  evaluate({ tenant, snapshot }) {
    if (tenant.blocks?.hero === false) {
      return skipResult("hero block is explicitly disabled for this tenant.");
    }
    const liveKeys = getHeroKeys(tenant).filter(k => snapshot.hero[k] !== null && snapshot.hero[k] !== undefined);
    if (liveKeys.length === 0) {
      const configured = getHeroKeys(tenant);
      return failResult(
        `No hero variants have CMS content (${configured.length} key${configured.length !== 1 ? "s" : ""} configured, 0 live).`,
        "Create at least one hero variant entry in the CMS for the configured keys.",
        configured,
      );
    }
    return passResult(`${liveKeys.length} hero variant${liveKeys.length !== 1 ? "s" : ""} have content.`);
  },
};

const proofMinimumVariants: ContentReadinessCheck = {
  id:          "proof-minimum-variants",
  label:       "Proof variants have content",
  description: "Verifies that at least one configured proof variant key has real CMS content. Without proof content the proof block will fall back, eroding credibility on the page.",
  severity:    "error",
  category:    "coverage",
  evaluate({ tenant, snapshot }) {
    if (tenant.blocks?.proof === false) {
      return skipResult("proof block is explicitly disabled for this tenant.");
    }
    const liveKeys = getProofKeys(tenant).filter(k => snapshot.proof[k] !== null && snapshot.proof[k] !== undefined);
    if (liveKeys.length === 0) {
      const configured = getProofKeys(tenant);
      return failResult(
        `No proof variants have CMS content (${configured.length} key${configured.length !== 1 ? "s" : ""} configured, 0 live).`,
        "Create at least one proof variant entry in the CMS.",
        configured,
      );
    }
    return passResult(`${liveKeys.length} proof variant${liveKeys.length !== 1 ? "s" : ""} have content.`);
  },
};

const ctaMinimumVariants: ContentReadinessCheck = {
  id:          "cta-minimum-variants",
  label:       "CTA variants have content",
  description: "Verifies that at least one configured CTA variant key has real CMS content. A missing CTA means the page has no primary conversion action.",
  severity:    "error",
  category:    "coverage",
  evaluate({ tenant, snapshot }) {
    if (tenant.blocks?.cta === false) {
      return skipResult("CTA block is explicitly disabled for this tenant.");
    }
    const liveKeys = getCTAKeys(tenant).filter(k => snapshot.cta[k] !== null && snapshot.cta[k] !== undefined);
    if (liveKeys.length === 0) {
      const configured = getCTAKeys(tenant);
      return failResult(
        `No CTA variants have CMS content (${configured.length} key${configured.length !== 1 ? "s" : ""} configured, 0 live).`,
        "Create at least one CTA variant entry in the CMS.",
        configured,
      );
    }
    return passResult(`${liveKeys.length} CTA variant${liveKeys.length !== 1 ? "s" : ""} have content.`);
  },
};

const heroRecommendedVariants: ContentReadinessCheck = {
  id:          "hero-recommended-variants",
  label:       "Two or more hero variants exist",
  description: "Recommends at least two hero variants so the decision engine can serve different content to different visitor segments. A single hero variant means every visitor sees the same thing regardless of their context — the adaptive pipeline has nothing to adapt.",
  severity:    "warning",
  category:    "coverage",
  evaluate({ tenant, snapshot }) {
    if (tenant.blocks?.hero === false) {
      return skipResult("hero block is explicitly disabled for this tenant.");
    }
    const liveKeys = getHeroKeys(tenant).filter(k => snapshot.hero[k] !== null && snapshot.hero[k] !== undefined);
    if (liveKeys.length < 2) {
      return failResult(
        `Only ${liveKeys.length} hero variant${liveKeys.length !== 1 ? "s have" : " has"} content — 2 or more are recommended.`,
        "Add a second hero variant to allow the decision engine to personalise based on traffic source (e.g. one for search traffic, one for direct brand visitors).",
      );
    }
    return passResult(`${liveKeys.length} hero variants are live — sufficient for personalisation.`);
  },
};

const allBlocksHaveCoverage: ContentReadinessCheck = {
  id:          "all-blocks-have-coverage",
  label:       "All enabled blocks have live content",
  description: "Verifies that every block enabled in the tenant config (hero, proof, CTA) has at least one live variant with CMS content. A block that is enabled but has no content will render an empty or fallback section.",
  severity:    "error",
  category:    "coverage",
  evaluate({ tenant, snapshot }) {
    const missing: string[] = [];

    if (tenant.blocks?.hero) {
      const live = getHeroKeys(tenant).filter(k => snapshot.hero[k] != null).length;
      if (live === 0) missing.push("hero");
    }
    if (tenant.blocks?.proof) {
      const live = getProofKeys(tenant).filter(k => snapshot.proof[k] != null).length;
      if (live === 0) missing.push("proof");
    }
    if (tenant.blocks?.cta) {
      const live = getCTAKeys(tenant).filter(k => snapshot.cta[k] != null).length;
      if (live === 0) missing.push("cta");
    }

    if (missing.length > 0) {
      return failResult(
        `${missing.length} enabled block${missing.length !== 1 ? "s have" : " has"} no live content: ${missing.join(", ")}.`,
        "Create CMS entries for the missing blocks before launching.",
        missing,
      );
    }
    return passResult("All enabled blocks have at least one live content variant.");
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPLETENESS CHECKS
// ─────────────────────────────────────────────────────────────────────────────

const heroAllKeysHaveContent: ContentReadinessCheck = {
  id:          "hero-all-keys-have-content",
  label:       "All configured hero keys have content",
  description: "Every key listed in tenant.variants.hero must have a corresponding CMS entry. A key without content causes the decision engine to select it but the CMS to return null, forcing a fallback to the default experience — exactly the silent failure this checklist is designed to prevent.",
  severity:    "error",
  category:    "completeness",
  evaluate({ tenant, snapshot }) {
    const keys = getHeroKeys(tenant);
    if (keys.length === 0) return skipResult("no hero variants are configured for this tenant.");

    const missingKeys = keys.filter(k => snapshot.hero[k] == null);
    if (missingKeys.length > 0) {
      return failResult(
        `${missingKeys.length} hero key${missingKeys.length !== 1 ? "s are" : " is"} missing CMS content.`,
        "Create CMS entries for each missing key. Until they exist, the decision engine will fall back to the default hero when these keys are selected.",
        missingKeys,
      );
    }
    return passResult(`All ${keys.length} configured hero key${keys.length !== 1 ? "s have" : " has"} CMS content.`);
  },
};

const proofAllKeysHaveContent: ContentReadinessCheck = {
  id:          "proof-all-keys-have-content",
  label:       "All configured proof keys have content",
  description: "Every key listed in tenant.variants.proof must have a corresponding CMS entry. Missing proof keys cause silent fallback to default social proof — visitors in certain segments see no personalised evidence.",
  severity:    "error",
  category:    "completeness",
  evaluate({ tenant, snapshot }) {
    const keys = getProofKeys(tenant);
    if (keys.length === 0) return skipResult("no proof variants are configured for this tenant.");

    const missingKeys = keys.filter(k => snapshot.proof[k] == null);
    if (missingKeys.length > 0) {
      return failResult(
        `${missingKeys.length} proof key${missingKeys.length !== 1 ? "s are" : " is"} missing CMS content.`,
        "Create proof variant entries in the CMS for each missing key.",
        missingKeys,
      );
    }
    return passResult(`All ${keys.length} configured proof key${keys.length !== 1 ? "s have" : " has"} CMS content.`);
  },
};

const ctaAllKeysHaveContent: ContentReadinessCheck = {
  id:          "cta-all-keys-have-content",
  label:       "All configured CTA keys have content",
  description: "Every key listed in tenant.variants.cta must have a corresponding CMS entry. A missing CTA key causes the decision engine to select it but the CMS to return null, leaving the primary conversion action missing from the page.",
  severity:    "error",
  category:    "completeness",
  evaluate({ tenant, snapshot }) {
    const keys = getCTAKeys(tenant);
    if (keys.length === 0) return skipResult("no CTA variants are configured for this tenant.");

    const missingKeys = keys.filter(k => snapshot.cta[k] == null);
    if (missingKeys.length > 0) {
      return failResult(
        `${missingKeys.length} CTA key${missingKeys.length !== 1 ? "s are" : " is"} missing CMS content.`,
        "Create CTA variant entries in the CMS for each missing key.",
        missingKeys,
      );
    }
    return passResult(`All ${keys.length} configured CTA key${keys.length !== 1 ? "s have" : " has"} CMS content.`);
  },
};

const proofItemsMinimum: ContentReadinessCheck = {
  id:          "proof-items-minimum",
  label:       "Proof variants have sufficient items",
  description: "Each proof variant should have at least 2 proof items (stat cards, testimonials, or capability statements). A single proof item looks sparse in the rendered layout and provides weak social evidence.",
  severity:    "warning",
  category:    "completeness",
  evaluate({ tenant, snapshot }) {
    if (tenant.blocks?.proof === false) return skipResult("proof block is explicitly disabled for this tenant.");

    const underfilledKeys: string[] = [];
    for (const key of (getProofKeys(tenant))) {
      const content = snapshot.proof[key];
      if (content && content.items.length < 2) {
        underfilledKeys.push(key);
      }
    }
    if (underfilledKeys.length > 0) {
      return failResult(
        `${underfilledKeys.length} proof variant${underfilledKeys.length !== 1 ? "s have" : " has"} fewer than 2 items.`,
        "Add a second proof item to each underfilled variant. Three items is the standard layout expectation; two is the acceptable minimum.",
        underfilledKeys,
      );
    }
    return passResult("All proof variants have at least 2 items.");
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// QUALITY CHECKS
// ─────────────────────────────────────────────────────────────────────────────

const heroTitlesNonEmpty: ContentReadinessCheck = {
  id:          "hero-titles-non-empty",
  label:       "Hero titles are populated",
  description: "Every hero variant with CMS content must have a non-empty title field. An empty title renders a blank headline above the fold — immediately visible and brand-damaging.",
  severity:    "error",
  category:    "quality",
  evaluate({ tenant, snapshot }) {
    const affectedKeys: string[] = [];
    for (const key of (getHeroKeys(tenant))) {
      const content = snapshot.hero[key];
      if (content && !content.title?.trim()) {
        affectedKeys.push(key);
      }
    }
    if (affectedKeys.length > 0) {
      return failResult(
        `${affectedKeys.length} hero variant${affectedKeys.length !== 1 ? "s have" : " has"} an empty title.`,
        "Add a headline to each affected hero variant in the CMS.",
        affectedKeys,
      );
    }
    return passResult("All hero variants have non-empty titles.");
  },
};

const heroSubtitlesNonEmpty: ContentReadinessCheck = {
  id:          "hero-subtitles-non-empty",
  label:       "Hero subtitles are populated",
  description: "Every hero variant should have a non-empty subtitle field. An empty subtitle leaves the page with only a headline and no supporting copy, which reduces conversion and fails to communicate the value proposition clearly.",
  severity:    "warning",
  category:    "quality",
  evaluate({ tenant, snapshot }) {
    const affectedKeys: string[] = [];
    for (const key of (getHeroKeys(tenant))) {
      const content = snapshot.hero[key];
      if (content && !content.subtitle?.trim()) {
        affectedKeys.push(key);
      }
    }
    if (affectedKeys.length > 0) {
      return failResult(
        `${affectedKeys.length} hero variant${affectedKeys.length !== 1 ? "s are" : " is"} missing subtitle copy.`,
        "Add supporting copy to each affected hero variant. The subtitle should expand on the headline value proposition in 1–2 sentences.",
        affectedKeys,
      );
    }
    return passResult("All hero variants have subtitles.");
  },
};

const ctaLabelsNonPlaceholder: ContentReadinessCheck = {
  id:          "cta-labels-non-placeholder",
  label:       "CTA button labels are meaningful",
  description: "CTA button labels must not be generic placeholders. Labels like \"Click here\", \"Button\", or \"Learn more\" indicate unfilled copy templates and undermine conversion rate on the primary call-to-action.",
  severity:    "error",
  category:    "quality",
  evaluate({ tenant, snapshot }) {
    const affectedKeys: string[] = [];
    for (const key of (getCTAKeys(tenant))) {
      const content = snapshot.cta[key];
      if (content && isPlaceholderLabel(content.cta.label)) {
        affectedKeys.push(key);
      }
    }
    if (affectedKeys.length > 0) {
      return failResult(
        `${affectedKeys.length} CTA variant${affectedKeys.length !== 1 ? "s use" : " uses"} a generic placeholder button label.`,
        `Replace the button label with a specific action-oriented phrase. Examples: "Book a 20-minute intro call", "Start personalising your site", "Get the free guide". Affected keys: ${affectedKeys.join(", ")}.`,
        affectedKeys,
      );
    }
    return passResult("All CTA variants have meaningful button labels.");
  },
};

const ctaHrefsNonPlaceholder: ContentReadinessCheck = {
  id:          "cta-hrefs-non-placeholder",
  label:       "CTA hrefs point to real destinations",
  description: "CTA button href fields must not contain placeholder values such as \"#\", \"/TODO\", or \"https://example.com\". A placeholder href means the primary conversion action leads nowhere — the most critical launch blocker.",
  severity:    "error",
  category:    "quality",
  evaluate({ tenant, snapshot }) {
    const affectedKeys: string[] = [];
    for (const key of (getCTAKeys(tenant))) {
      const content = snapshot.cta[key];
      if (content && isPlaceholderHref(content.cta.href)) {
        affectedKeys.push(key);
      }
    }
    // Also check hero CTA hrefs
    for (const key of (getHeroKeys(tenant))) {
      const content = snapshot.hero[key];
      if (content && isPlaceholderHref(content.cta.href)) {
        affectedKeys.push(key);
      }
    }
    if (affectedKeys.length > 0) {
      return failResult(
        `${affectedKeys.length} variant${affectedKeys.length !== 1 ? "s contain" : " contains"} a placeholder CTA href.`,
        "Replace all placeholder hrefs with the real destination URL. These are the most critical content gaps — a broken CTA means zero conversions from those variants.",
        affectedKeys,
      );
    }
    return passResult("All CTA hrefs point to real destinations.");
  },
};

const heroTagsPresent: ContentReadinessCheck = {
  id:          "hero-tags-present",
  label:       "Hero variants have eyebrow tags",
  description: "Hero variants can include an optional eyebrow tag — a short badge rendered above the headline (e.g. \"For B2B SaaS teams\", \"Trusted by 500+ marketers\"). Populated tags improve the headline scan-rate and add credibility context, especially for cold traffic.",
  severity:    "info",
  category:    "quality",
  evaluate({ tenant, snapshot }) {
    if (tenant.blocks?.hero === false) return skipResult("hero block is explicitly disabled for this tenant.");

    const missingTagKeys: string[] = [];
    for (const key of (getHeroKeys(tenant))) {
      const content = snapshot.hero[key];
      if (content && !content.tag?.trim()) {
        missingTagKeys.push(key);
      }
    }
    if (missingTagKeys.length > 0) {
      return failResult(
        `${missingTagKeys.length} hero variant${missingTagKeys.length !== 1 ? "s are" : " is"} missing an eyebrow tag.`,
        "Consider adding a short eyebrow tag to each hero variant. Good eyebrow tags name the audience segment or reinforce credibility (e.g. \"For growth-stage B2B\", \"Rated 4.9 on G2\").",
        missingTagKeys,
      );
    }
    return passResult("All hero variants have eyebrow tags.");
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// METADATA CHECKS
// ─────────────────────────────────────────────────────────────────────────────

const heroIdsMatchKeys: ContentReadinessCheck = {
  id:          "hero-ids-match-keys",
  label:       "Hero content IDs match variant keys",
  description: "The `id` field of each HeroBlockData entry should match the variant key it was fetched under. A mismatch indicates a CMS entry was created under the wrong key or was duplicated incorrectly, which can cause confusing analytics attribution.",
  severity:    "warning",
  category:    "metadata",
  evaluate({ tenant, snapshot }) {
    const mismatchedKeys: string[] = [];
    for (const key of (getHeroKeys(tenant))) {
      const content = snapshot.hero[key];
      if (content && content.id !== key) {
        mismatchedKeys.push(key);
      }
    }
    if (mismatchedKeys.length > 0) {
      return failResult(
        `${mismatchedKeys.length} hero variant${mismatchedKeys.length !== 1 ? "s have" : " has"} a content ID that does not match the variant key.`,
        "In the CMS, update each entry's id field to exactly match its variant key. This ensures analytics events correctly attribute variant performance.",
        mismatchedKeys,
      );
    }
    return passResult("All hero content IDs match their variant keys.");
  },
};

const proofIdsMatchKeys: ContentReadinessCheck = {
  id:          "proof-ids-match-keys",
  label:       "Proof content IDs match variant keys",
  description: "The `id` field of each ProofBlockData entry should match the variant key it was fetched under. Mismatches cause incorrect analytics attribution and make it hard to diagnose which proof angle is performing.",
  severity:    "warning",
  category:    "metadata",
  evaluate({ tenant, snapshot }) {
    const mismatchedKeys: string[] = [];
    for (const key of (getProofKeys(tenant))) {
      const content = snapshot.proof[key];
      if (content && content.id !== key) {
        mismatchedKeys.push(key);
      }
    }
    if (mismatchedKeys.length > 0) {
      return failResult(
        `${mismatchedKeys.length} proof variant${mismatchedKeys.length !== 1 ? "s have" : " has"} a content ID that does not match the variant key.`,
        "Update the id field in the CMS to match the variant key for each affected entry.",
        mismatchedKeys,
      );
    }
    return passResult("All proof content IDs match their variant keys.");
  },
};

const ctaIdsMatchKeys: ContentReadinessCheck = {
  id:          "cta-ids-match-keys",
  label:       "CTA content IDs match variant keys",
  description: "The `id` field of each CTABlockData entry should match the variant key it was fetched under. A mismatch here specifically breaks the variant-served analytics event, which attributes conversions to the wrong CTA variant.",
  severity:    "warning",
  category:    "metadata",
  evaluate({ tenant, snapshot }) {
    const mismatchedKeys: string[] = [];
    for (const key of (getCTAKeys(tenant))) {
      const content = snapshot.cta[key];
      if (content && content.id !== key) {
        mismatchedKeys.push(key);
      }
    }
    if (mismatchedKeys.length > 0) {
      return failResult(
        `${mismatchedKeys.length} CTA variant${mismatchedKeys.length !== 1 ? "s have" : " has"} a content ID that does not match the variant key.`,
        "Update the id field in the CMS to match the variant key for each affected entry.",
        mismatchedKeys,
      );
    }
    return passResult("All CTA content IDs match their variant keys.");
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE-SPECIFIC CHECKS
// ─────────────────────────────────────────────────────────────────────────────

const abTestingHasMultipleVariants: ContentReadinessCheck = {
  id:          "ab-testing-has-multiple-variants",
  label:       "A/B testing has multiple variants per dimension",
  description: "When A/B testing is enabled, each decision dimension should have at least 2 live variants. A single variant per dimension means the experiment table is queried on every request but there is nothing to test against — adding overhead with no personalisation or testing benefit.",
  severity:    "warning",
  category:    "features",
  evaluate({ tenant, snapshot }) {
    if (!tenant.features?.abTesting) {
      return passResult("A/B testing is not enabled — no minimum variant requirement.");
    }

    const insufficientDimensions: string[] = [];

    const heroLive = (getHeroKeys(tenant)).filter(k => snapshot.hero[k] != null);
    if (heroLive.length < 2) insufficientDimensions.push(`hero (${heroLive.length} live)`);

    const proofLive = (getProofKeys(tenant)).filter(k => snapshot.proof[k] != null);
    if (proofLive.length < 2) insufficientDimensions.push(`proof (${proofLive.length} live)`);

    const ctaLive = (getCTAKeys(tenant)).filter(k => snapshot.cta[k] != null);
    if (ctaLive.length < 2) insufficientDimensions.push(`cta (${ctaLive.length} live)`);

    if (insufficientDimensions.length > 0) {
      return failResult(
        `A/B testing is enabled but ${insufficientDimensions.length} decision dimension${insufficientDimensions.length !== 1 ? "s have" : " has"} fewer than 2 live variants.`,
        "Add a second live variant for each underpopulated dimension, or disable features.abTesting until the content is ready. Experiment overhead is incurred on every request even when there is only one variant to serve.",
        insufficientDimensions,
      );
    }
    return passResult("A/B testing is enabled and all dimensions have 2+ live variants.");
  },
};

const contactCtaHasBookingLink: ContentReadinessCheck = {
  id:          "contact-cta-has-booking-link",
  label:       "A CTA variant links to the contact or booking page",
  description: "When the contact form is enabled, at least one CTA variant's href should point to a contact, booking, or meeting URL. Without a booking link, the contact form may receive traffic but CTAs across the adaptive variants don't drive visitors there proactively.",
  severity:    "info",
  category:    "features",
  evaluate({ tenant, snapshot }) {
    if (!tenant.contact?.enabled) {
      return passResult("Contact form is not enabled — no booking link required.");
    }

    // Check CTA block variants
    const ctaKeys = getCTAKeys(tenant);
    const hasBookingCta = ctaKeys.some(k => {
      const content = snapshot.cta[k];
      return content && isBookingHref(content.cta.href);
    });

    // Also check hero CTA hrefs
    const heroKeys = getHeroKeys(tenant);
    const hasBookingHero = heroKeys.some(k => {
      const content = snapshot.hero[k];
      return content && isBookingHref(content.cta.href);
    });

    if (!hasBookingCta && !hasBookingHero) {
      return failResult(
        "No CTA variant links to a contact, booking, or meeting destination.",
        "Add at least one CTA variant whose href points to the contact form, a Calendly link, or a booking page. This ensures visitors who see the contact form enabled on the page have a clear path to it from the adaptive CTAs.",
      );
    }
    return passResult("At least one CTA variant links to a contact or booking destination.");
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT CHECKLIST
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The default content readiness checklist.
 *
 * 19 checks across 5 categories. Ordered for natural reading in the admin view:
 *   1. Coverage — do enough variants exist?
 *   2. Completeness — does every configured key have content?
 *   3. Quality — is the content well-formed?
 *   4. Metadata — are IDs and keys consistent?
 *   5. Features — do enabled features have sufficient content?
 *
 * Pass this to evaluateReadiness() or use a subset for targeted checks.
 */
export const DEFAULT_READINESS_CHECKLIST: readonly ContentReadinessCheck[] = [
  // Coverage
  heroMinimumVariants,
  proofMinimumVariants,
  ctaMinimumVariants,
  heroRecommendedVariants,
  allBlocksHaveCoverage,

  // Completeness
  heroAllKeysHaveContent,
  proofAllKeysHaveContent,
  ctaAllKeysHaveContent,
  proofItemsMinimum,

  // Quality
  heroTitlesNonEmpty,
  heroSubtitlesNonEmpty,
  ctaLabelsNonPlaceholder,
  ctaHrefsNonPlaceholder,
  heroTagsPresent,

  // Metadata
  heroIdsMatchKeys,
  proofIdsMatchKeys,
  ctaIdsMatchKeys,

  // Features
  abTestingHasMultipleVariants,
  contactCtaHasBookingLink,
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT BUILDER (async)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a ContentReadinessContext by fetching all CMS content for the
 * tenant's configured variant keys.
 *
 * Uses the same CMSProvider methods as the live homepage — getHeroVariant(),
 * getProofVariant(), getCTAVariant() — so the checker and the live site are
 * always looking at the same data. All three key sets are fetched concurrently
 * to minimise wall-clock time.
 *
 * The fetch path matters: each provider queries by the variant `key` field
 * (e.g. Sanity: `*[_type == "heroVariant" && key == $key && isActive == true]`),
 * NOT by the Sanity document `_id`. Using any other lookup path would silently
 * miss documents that the live page renders correctly.
 *
 * Fetch errors for individual keys are captured in snapshot.errors rather than
 * thrown — a single missing variant does not abort the entire readiness check.
 *
 * @example
 * const cms = createCMSProvider(tenant);
 * const context = await buildContentReadinessContext(tenant, cms);
 * const report = evaluateReadiness(context);
 */
export async function buildContentReadinessContext(
  tenant: TenantConfig,
  cmsProvider: CMSProvider,
): Promise<ContentReadinessContext> {
  const heroKeys  = getHeroKeys(tenant);
  const proofKeys = getProofKeys(tenant);
  const ctaKeys   = getCTAKeys(tenant);

  const heroMap:  Record<string, import("@/cms/types").HeroBlockData  | null> = {};
  const proofMap: Record<string, import("@/cms/types").ProofBlockData | null> = {};
  const ctaMap:   Record<string, import("@/cms/types").CTABlockData   | null> = {};
  const errors:   ContentSnapshot["errors"] = [];

  await Promise.all([
    ...heroKeys.map(async (key) => {
      try {
        const data = await cmsProvider.getHeroVariant(key);
        heroMap[key] = data;
        if (data === null) {
          errors.push({ key, blockType: "hero", errorType: "not-found",
            message: `Hero variant "${key}" was not found in the CMS.` });
        }
      } catch (err) {
        heroMap[key] = null;
        errors.push({ key, blockType: "hero", errorType: "fetch-error",
          message: `Failed to fetch hero variant "${key}": ${err instanceof Error ? err.message : String(err)}` });
      }
    }),
    ...proofKeys.map(async (key) => {
      try {
        const data = await cmsProvider.getProofVariant(key);
        proofMap[key] = data;
        if (data === null) {
          errors.push({ key, blockType: "proof", errorType: "not-found",
            message: `Proof variant "${key}" was not found in the CMS.` });
        }
      } catch (err) {
        proofMap[key] = null;
        errors.push({ key, blockType: "proof", errorType: "fetch-error",
          message: `Failed to fetch proof variant "${key}": ${err instanceof Error ? err.message : String(err)}` });
      }
    }),
    ...ctaKeys.map(async (key) => {
      try {
        const data = await cmsProvider.getCTAVariant(key);
        ctaMap[key] = data;
        if (data === null) {
          errors.push({ key, blockType: "cta", errorType: "not-found",
            message: `CTA variant "${key}" was not found in the CMS.` });
        }
      } catch (err) {
        ctaMap[key] = null;
        errors.push({ key, blockType: "cta", errorType: "fetch-error",
          message: `Failed to fetch CTA variant "${key}": ${err instanceof Error ? err.message : String(err)}` });
      }
    }),
  ]);

  const snapshot: ContentSnapshot = {
    hero:      heroMap,
    proof:     proofMap,
    cta:       ctaMap,
    fetchedAt: new Date().toISOString(),
    errors,
  };

  return { tenant, snapshot };
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE EVALUATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluates a single content readiness check against the provided context.
 *
 * Wraps the check's evaluate() function in a try/catch so that a buggy
 * check definition cannot abort the entire evaluation run.
 */
export function evaluateCheck(
  check: ContentReadinessCheck,
  context: ContentReadinessContext,
): CheckResult {
  try {
    return check.evaluate(context);
  } catch (err) {
    // A check that throws is a bug in the check definition, not in the content.
    // Return a skipped result with an internal error note so the run completes.
    return {
      status:  "skipped",
      message: `Check "${check.id}" threw an unexpected error and was skipped.`,
      details: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Runs all checks in the provided checklist against the context and returns
 * a complete ReadinessReport.
 *
 * The report includes all results (pass, fail, skipped), a summary, and the
 * top-level isLaunchReady flag which is false if any error-severity check fails.
 *
 * @param context  The content readiness context (tenant config + CMS snapshot).
 * @param checks   Checklist to evaluate. Defaults to DEFAULT_READINESS_CHECKLIST.
 *
 * @example
 * const context = await buildContentReadinessContext(tenant, cms);
 * const report  = evaluateReadiness(context);
 *
 * if (!report.isLaunchReady) {
 *   const blockers = getBlockingChecks(report);
 *   console.error("Launch blocked:", blockers.map(e => e.result.message));
 * }
 */
export function evaluateReadiness(
  context:  ContentReadinessContext,
  checks:   readonly ContentReadinessCheck[] = DEFAULT_READINESS_CHECKLIST,
): ReadinessReport {
  const results: CheckResultEntry[] = checks.map(check => ({
    check,
    result: evaluateCheck(check, context),
  }));

  // Build summary
  const evaluated = results.filter(e => e.result.status !== "skipped");
  const summary: ReadinessSummary = {
    total:    evaluated.length,
    passed:   evaluated.filter(e => e.result.status === "pass").length,
    errors:   evaluated.filter(e => e.result.status === "fail" && e.check.severity === "error").length,
    warnings: evaluated.filter(e => e.result.status === "fail" && e.check.severity === "warning").length,
    infos:    evaluated.filter(e => e.result.status === "fail" && e.check.severity === "info").length,
    skipped:  results.filter(e => e.result.status === "skipped").length,
  };

  return {
    tenantId:      context.tenant.tenantId,
    evaluatedAt:   new Date().toISOString(),
    results,
    summary,
    isLaunchReady: summary.errors === 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all failed checks from a report (any severity, any category).
 * Skipped checks are excluded.
 *
 * Useful for rendering "here's what needs fixing" in admin tooling.
 */
export function getFailedChecks(report: ReadinessReport): CheckResultEntry[] {
  return report.results.filter(e => e.result.status === "fail");
}

/**
 * Returns the failed checks that block launch (severity === "error").
 *
 * The report's isLaunchReady flag is false if and only if this list is non-empty.
 * Use this to render the "launch blocked" banner with specific reasons.
 */
export function getBlockingChecks(report: ReadinessReport): CheckResultEntry[] {
  return report.results.filter(
    e => e.result.status === "fail" && e.check.severity === "error"
  );
}

/**
 * Returns all check results for a specific category.
 *
 * Useful for rendering a "Coverage" or "Quality" tab in the admin readiness view.
 *
 * @example
 * const qualityChecks = getChecksByCategory(report, "quality");
 */
export function getChecksByCategory(
  report:   ReadinessReport,
  category: import("./types").CheckCategory,
): CheckResultEntry[] {
  return report.results.filter(e => e.check.category === category);
}

/**
 * Returns all checks that were skipped for this tenant.
 *
 * Useful for showing a "not applicable" section in the readiness view,
 * so operators understand which checks were intentionally bypassed.
 */
export function getSkippedChecks(report: ReadinessReport): CheckResultEntry[] {
  return report.results.filter(e => e.result.status === "skipped");
}

/**
 * Returns all checks that passed.
 *
 * Useful for rendering a "what's looking good" affirmation section in the
 * readiness view — gives the content team positive reinforcement alongside
 * the things that need fixing.
 */
export function getPassedChecks(report: ReadinessReport): CheckResultEntry[] {
  return report.results.filter(e => e.result.status === "pass");
}

/**
 * Returns a formatted text summary of the readiness report.
 *
 * Suitable for logging, Slack notifications, or admin email digests.
 *
 * @example
 * console.log(formatReadinessSummary(report));
 * // "acme-growth: NOT READY — 3 errors, 2 warnings, 1 info (8/14 checks passed)"
 */
export function formatReadinessSummary(report: ReadinessReport): string {
  const { summary, isLaunchReady, tenantId } = report;
  const status = isLaunchReady ? "READY" : "NOT READY";
  const issues: string[] = [];
  if (summary.errors   > 0) issues.push(`${summary.errors} error${summary.errors   !== 1 ? "s" : ""}`);
  if (summary.warnings > 0) issues.push(`${summary.warnings} warning${summary.warnings !== 1 ? "s" : ""}`);
  if (summary.infos    > 0) issues.push(`${summary.infos} info`);
  const issueStr = issues.length > 0 ? ` — ${issues.join(", ")}` : "";
  return `${tenantId}: ${status}${issueStr} (${summary.passed}/${summary.total} checks passed)`;
}

/**
 * Returns all variant keys across all dimensions that appear in at least one
 * failed check's affectedKeys list.
 *
 * Useful for generating a flat "content gaps" list for the CMS team:
 * "these are the specific entries you need to create or fix".
 */
export function getAffectedKeys(report: ReadinessReport): string[] {
  const keySet = new Set<string>();
  for (const entry of getFailedChecks(report)) {
    for (const key of (entry.result.affectedKeys ?? [])) {
      keySet.add(key);
    }
  }
  return Array.from(keySet).sort();
}
