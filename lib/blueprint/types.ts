/**
 * Blueprint System Types
 *
 * A Blueprint is a self-contained, versioned package of variant content,
 * canonical rules, and a default plan that can be loaded into a tenant's
 * personalization configuration.
 *
 * ── Source labels ─────────────────────────────────────────────────────────────
 *
 *   "system"    Shipped with the platform. Updated automatically on each deploy.
 *               Tenants cannot directly edit these; they can override by creating
 *               a "tenant" copy.
 *
 *   "blueprint" Installed from a starter/demo blueprint. Safe to re-apply or
 *               overwrite during a blueprint reset. Tenants CAN edit these, but
 *               doing so effectively promotes the entity to "tenant" source.
 *
 *   "tenant"    Created or customised by the tenant. NEVER overwritten by any
 *               merge or reset operation. Explicitly protected.
 *
 * ── Merge semantics ───────────────────────────────────────────────────────────
 *
 *   Merge mode (default)
 *     - If entity key doesn't exist → create it.
 *     - If entity key exists AND source is "system" or "blueprint" → update.
 *     - If entity key exists AND source is "tenant" → skip (protect).
 *
 *   Reset mode (explicit, requires UI confirmation)
 *     - Replaces all "system" and "blueprint" entities with blueprint content.
 *     - "tenant" entities are never touched.
 *
 * See apply-blueprint.ts for the merge implementation.
 */

// ── Source label ──────────────────────────────────────────────────────────────

export type SourceLabel = "system" | "blueprint" | "tenant";

// ── Variant descriptors ────────────────────────────────────────────────────────

/**
 * A single variant that can be seeded into the CMS / variant catalogue.
 * `content` is a flexible key-value bag; the exact shape depends on the
 * variant type (hero / proof / CTA) and the CMS schema in use.
 */
export interface BlueprintVariant {
  /** Stable key matching the variant type (e.g. HeroVariantKey). */
  key: string;

  /** Origin label — controls whether a merge can overwrite this entry. */
  source: SourceLabel;

  /** Human-readable name shown in the editor and debug panel. */
  label: string;

  /**
   * The actual display content for this variant.
   * Shape is variant-type specific:
   *   hero  → { headline, subheadline, cta? }
   *   proof → { headline?, items: Array<{ stat, label }> | Array<{ quote, author }> }
   *   cta   → { label, href?, variant?: "primary" | "secondary" }
   */
  content: Record<string, unknown>;
}

// ── Rule descriptors ──────────────────────────────────────────────────────────

/**
 * The variant keys assigned when a blueprint rule fires.
 * Mirrors StoredPlan from stored-rule.ts but typed as plain strings so the
 * blueprint package does not need to import decision internals.
 */
export interface BlueprintPlan {
  heroKey:   string;
  proofKey:  string;
  ctaKey:    string;
  themeKey?: string;
}

/**
 * A single rule entry inside a Blueprint.
 * The `condition` field is typed as `unknown` so the blueprint package remains
 * decoupled from the RuleCondition discriminated union — the rule engine
 * validates the shape on load.
 */
export interface BlueprintRule {
  /** Stable ID, referenced in analytics events and the debug panel. */
  id: string;

  /** Origin label — controls merge/reset behaviour. */
  source: SourceLabel;

  /** Evaluation precedence (lower = higher priority). */
  priority: number;

  /** Human-readable label shown in the rules editor. */
  label: string;

  /** Declarative condition descriptor (validated by the rule engine on load). */
  condition: unknown;

  /** Variant keys to apply when this rule fires. */
  plan: BlueprintPlan;

  /** Explanation surfaced in debug output and analytics. */
  reason: string;
}

// ── Default plan ──────────────────────────────────────────────────────────────

export interface BlueprintDefaultPlan {
  heroKey:  string;
  proofKey: string;
  ctaKey:   string;
  reason:   string;
}

// ── Scenario mapping ──────────────────────────────────────────────────────────

/**
 * A single entry in the blueprint's scenario → rule → variant mapping table.
 * Used in Storybook, the Scenario Control Panel, tests, and admin documentation
 * to give a named, human-readable view of each adaptive experience.
 */
export interface BlueprintScenario {
  /** Short name used as the key in presets (e.g. "New Visitor"). */
  name: string;

  /** Rule ID that fires for this scenario. */
  ruleId: string;

  /**
   * Synthetic journey overrides that reproduce this scenario in the
   * Scenario Control Panel and in tests.
   */
  journeyOverrides: Record<string, unknown>;

  /** The variant keys produced by this scenario (before confidence gating). */
  plan: BlueprintPlan;

  /** Minimum expected confidence band after gating. */
  expectedBand: "low" | "medium" | "high" | "very_high";
}

// ── Page definitions ──────────────────────────────────────────────────────────

/**
 * A single content block within a page.
 * `type` maps to a registered block component; `content` is block-specific.
 */
export interface BlueprintBlock {
  /** Block type identifier (e.g. "hero", "proof", "pricing", "faq"). */
  type: string;

  /** Slot key when this block is adaptive (links to variant system). */
  slotKey?: string;

  /**
   * Static content for this block.
   * Shape is block-type specific and is used to seed CMS documents.
   */
  content: Record<string, unknown>;
}

/**
 * A page definition included in the blueprint.
 * Pages can be seeded into the CMS or used as reference for manual setup.
 */
export interface BlueprintPage {
  /** Slug used as the URL path (e.g. "/", "/pricing", "/demo"). */
  slug: string;

  /** Human-readable page title. */
  title: string;

  /** SEO meta description. */
  description: string;

  /** Block order and content for this page. */
  blocks: BlueprintBlock[];
}

// ── Sequence definitions ──────────────────────────────────────────────────────

/**
 * A named visitor journey sequence used by the rule engine.
 * When a visitor completes the steps in order (within a session or across sessions),
 * the sequence key is added to `journey.matchedSequences`.
 */
export interface BlueprintSequence {
  /** Stable key referenced in rule conditions (e.g. "homepage_product_pricing"). */
  key: string;

  /** Human-readable label shown in the debug panel and rules editor. */
  label: string;

  /** Pages visited in order to match this sequence (by slug). */
  steps: string[];

  /** Whether steps must be completed within a single session. */
  requiresSingleSession?: boolean;
}

// ── Top-level Blueprint ───────────────────────────────────────────────────────

export interface Blueprint {
  /** Stable identifier for this blueprint (e.g. "b2b-saas-platform"). */
  id: string;

  /** Semver string — bumped when the blueprint content changes. */
  version: string;

  /** Human-readable name shown in the admin UI. */
  name: string;

  /** Short description of the blueprint's purpose. */
  description: string;

  /** Industry vertical (e.g. "saas", "agency", "ecommerce"). */
  industry?: string;

  /** Default theme applied when this blueprint is installed. */
  defaultThemeId?: string;

  /** Hero variant seeds. */
  heroVariants: BlueprintVariant[];

  /** Proof variant seeds. */
  proofVariants: BlueprintVariant[];

  /** CTA variant seeds. */
  ctaVariants: BlueprintVariant[];

  /** Canonical rules in priority order. */
  rules: BlueprintRule[];

  /** Default plan applied when no rule matches. */
  defaultPlan: BlueprintDefaultPlan;

  /** Scenario → rule → variant mapping table for demos and testing. */
  scenarios: BlueprintScenario[];

  /** Page definitions (content seeded into CMS on blueprint apply). */
  pages?: BlueprintPage[];

  /** Named visitor journey sequences for rule conditions. */
  sequences?: BlueprintSequence[];
}
