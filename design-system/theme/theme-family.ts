/**
 * Theme Family Layer
 *
 * A structural layer above visual token presets.  A ThemeFamily groups presets
 * that share a common *personality* — the same structural rhythm, the same kind
 * of hero treatment, the same brand-to-neutral relationship — even if their
 * colour palette or typography differ.
 *
 * ─── Why this exists ──────────────────────────────────────────────────────────
 *
 *   The 20 existing presets are excellent "paint-job" presets — they differ in
 *   colour, type, radius, and motion.  But they don't yet encode structural
 *   personality: should a hero have a dark cinematic background or a clean white
 *   one?  Should feature cards have elevation or be flat?  Should logo strips
 *   show full-colour or ghosted logos?
 *
 *   ThemeFamily answers these questions at the personality level, enabling:
 *
 *   1. Smart defaults   — when a new tenant picks a family, the best-fit preset
 *                         is pre-selected automatically.
 *   2. Contextual rules — "when it's Christmas, switch to a warm-season family"
 *                         selects the right *kind* of theme rather than a hard-
 *                         coded preset name.
 *   3. AI guidance      — the AI decision layer can recommend a family based on
 *                         industry/intent context without knowing specific presets.
 *   4. Future evolution — new presets can be added to existing families without
 *                         changing any selector or rule.
 *
 * ─── Relationship to ThemePresetKey ──────────────────────────────────────────
 *
 *   ThemePresetKey  → exact visual configuration (colours, type, radius, profile)
 *   ThemeFamilyKey  → structural personality group (hero character, card style, …)
 *
 *   Multiple presets share a family.  The family's `canonicalPreset` is the one
 *   the system selects when a family is chosen without a specific preset.
 *
 * ─── Recommended variants ─────────────────────────────────────────────────────
 *
 *   Each family carries `recommendedVariants` — a map from AdaptiveSlotId to
 *   the variant key that fits the family's personality best.  These are
 *   suggestions, not constraints; individual tenants can override them.
 *
 *   The hero slot is particularly important: some families are built around a
 *   dark cinematic hero (luxury-dark, startup-growth), others around a light or
 *   brand-coloured hero (wellness-care, editorial-publishing).
 */

import type { ThemePresetKey } from "./presets";

// ── Theme family key ───────────────────────────────────────────────────────────

/**
 * The structural personality families.
 *
 *   saas-product          — clean, airy, product-led; dark or brand hero
 *   corporate-professional — structured, authoritative, conservative
 *   editorial-publishing  — typographic, measured, content-first
 *   startup-growth        — energetic, vivid, rounded, no-dividers
 *   luxury-dark           — cinematic, high-contrast, premium
 *   industrial-utility    — uppercase, sharp, structural, functional
 *   wellness-care         — airy, spacious, soft, reassuring
 *   careers-human         — human, calm, candidate-first; warm teal light hero
 */
export type ThemeFamilyKey =
  | "saas-product"
  | "corporate-professional"
  | "editorial-publishing"
  | "startup-growth"
  | "luxury-dark"
  | "industrial-utility"
  | "wellness-care"
  | "careers-human"
  // ── Premium style families ─────────────────────────────────────────────
  | "dark-ai"            // near-black, AI-forward, violet accent
  | "clean-corporate"    // pure white, modern SaaS, sky-blue accent
  | "structured-saas";   // warm stone, amber accent, Plus Jakarta Sans, editorial product

// ── Theme family interface ─────────────────────────────────────────────────────

/**
 * Metadata and defaults for a structural theme personality.
 */
export interface ThemeFamily {
  /** Stable identifier for this family. */
  key: ThemeFamilyKey;

  /** Human-readable display name. */
  name: string;

  /** One-line positioning statement for admin UI. */
  tagline: string;

  /**
   * 2–3 sentence description of the family's character, target context,
   * and how it differs from other families.
   */
  description: string;

  /**
   * The first preset an operator sees when this family is selected.
   * Must be a member of `presets`.
   */
  canonicalPreset: ThemePresetKey;

  /**
   * All presets that belong to this family.
   * Ordered by visual diversity / recommended selection order.
   */
  presets: readonly ThemePresetKey[];

  /**
   * Suggested variant keys per adaptive slot for this personality.
   * Used as defaults when a new tenant activates a family-driven contextual rule.
   * All values are optional — only supply slots where the personality implies a
   * meaningful preference.
   */
  recommendedVariants: Partial<{
    hero:       string;
    proof:      string;
    cta:        string;
    feature:    string;
    conversion: string;
  }>;

  /**
   * Signals that this family handles well.
   * Used by the AI decision layer to match a family to a visitor's context
   * (intent, industry, campaign type) without hard-coding individual presets.
   *
   * Examples: "conversion", "trust", "enterprise", "luxury", "growth"
   */
  contentEmphasis: readonly string[];

  /**
   * Seasonal / contextual events for which this family is a natural fit.
   * Maps to SeasonalEvent values and campaign tags.
   *
   * Examples: "christmas", "black-friday", "valentines", "night"
   */
  contextualFit: readonly string[];
}

// ── Theme family registry ──────────────────────────────────────────────────────

/**
 * All registered theme families.
 *
 * Adding a new family: add an entry here, then update ThemeFamilyKey above
 * and add `familyKey` to the relevant THEME_CATALOG entries in presets.ts.
 */
export const THEME_FAMILIES: Readonly<Record<ThemeFamilyKey, ThemeFamily>> = {

  // ── SaaS Product ─────────────────────────────────────────────────────────────
  //
  // Clean white backgrounds, product screenshots with subtle elevation,
  // airy vertical rhythm, brand-tinted shadows, geometric headings.
  // The default family for B2B SaaS, developer tools, product-led growth sites.

  "saas-product": {
    key:             "saas-product",
    name:            "SaaS Product",
    tagline:         "Clean, product-led, conversion-oriented",
    description:
      "Optimised for B2B SaaS, developer tools, and product-led websites. " +
      "Characterised by clean white surfaces, airy spacing, and hero sections " +
      "that use a dark immersive background to create depth. Feature sections " +
      "float on card surfaces with subtle brand-tinted shadows.",
    canonicalPreset: "modern-saas",
    presets:         ["modern-saas", "tech-indigo"],
    recommendedVariants: {
      hero:    "hero_google_problem",
      proof:   "proof_platform",
      cta:     "cta_platform",
      feature: "feature_grid_primary",
    },
    contentEmphasis: ["conversion", "product", "developer", "growth", "efficiency"],
    contextualFit:   ["black-friday", "cyber-monday", "back-to-school"],
  },

  // ── Corporate Professional ────────────────────────────────────────────────────
  //
  // Navy or deep-blue heroes, structured dividers, conservative radius,
  // restrained logo strips, and trustworthy elevation.
  // For professional services, financial institutions, B2B consultancies.

  "corporate-professional": {
    key:             "corporate-professional",
    name:            "Corporate Professional",
    tagline:         "Authoritative, structured, trust-first",
    description:
      "Designed for professional services, financial institutions, and enterprise B2B. " +
      "Deep navy or slate heroes project institutional authority. " +
      "Structural dividers and conservative card radius signal reliability. " +
      "Logo strips are deliberately muted to let client credibility speak.",
    canonicalPreset: "corporate-blue",
    presets:         ["corporate-blue", "minimal-neutral", "corporate-trust", "corporate-clean"],
    recommendedVariants: {
      hero:  "hero_linkedin_vision",
      proof: "proof_cases",
      cta:   "cta_meeting",
    },
    contentEmphasis: ["trust", "enterprise", "authority", "credentials", "compliance"],
    contextualFit:   [],
  },

  // ── Editorial Publishing ──────────────────────────────────────────────────────
  //
  // Serif headings, measured spacing, polaroid media frames, strongly-muted
  // logos, visible hairline dividers. The family of content-rich, typographic
  // personalities that prioritise reading experience over conversion density.

  "editorial-publishing": {
    key:             "editorial-publishing",
    name:            "Editorial Publishing",
    tagline:         "Typographic, content-first, considered",
    description:
      "Built for publishers, law firms, long-form content brands, and " +
      "premium editorial experiences. Serif headings, warm paper undertones, " +
      "and polaroid-style image framing create a measured, deliberate reading " +
      "environment. Logos are ghosted to near-monochrome.",
    canonicalPreset: "editorial-classic",
    presets:         ["editorial-classic", "premium-editorial", "premium-luxury"],
    recommendedVariants: {
      hero:    "hero_linkedin_vision",
      proof:   "proof_vision",
      cta:     "cta_guide",
      feature: "feature_highlights",
    },
    contentEmphasis: ["thought-leadership", "research", "credibility", "authority", "brand"],
    contextualFit:   [],
  },

  // ── Startup Growth ────────────────────────────────────────────────────────────
  //
  // Vivid full-colour logos, open layouts with no dividers, rounded media,
  // energetic motion, brand-coloured CTAs. The family for consumer startups,
  // energy brands, and growth-stage companies.

  "startup-growth": {
    key:             "startup-growth",
    name:            "Startup Growth",
    tagline:         "Energetic, vivid, velocity-forward",
    description:
      "Designed for growth-stage startups, consumer apps, and energetic brands. " +
      "Full-colour logos, rounded media, vivid brand CTAs, and open layouts " +
      "with no structural dividers communicate speed, optimism, and ambition. " +
      "Motion is snappy; hierarchy is bold and clear.",
    canonicalPreset: "playful-startup",
    presets:         ["playful-startup", "startup-energy", "modern-green", "warm-professional", "recruitment-energy", "portfolio-showcase", "bold-marketing"],
    recommendedVariants: {
      hero:       "hero_direct_brand",
      proof:      "proof_cases",
      cta:        "cta_platform",
      conversion: "conversion_signup",
    },
    contentEmphasis: ["growth", "acquisition", "activation", "brand", "community"],
    contextualFit:   ["valentines", "halloween", "new-year"],
  },

  // ── Luxury Dark ───────────────────────────────────────────────────────────────
  //
  // Pure black or near-black backgrounds, ultra-tight heading tracking,
  // sharp geometry, ghosted logos, and no dividers. The maximum-contrast
  // family for luxury brands, creative agencies, and dark-mode SaaS.

  "luxury-dark": {
    key:             "luxury-dark",
    name:            "Luxury Dark",
    tagline:         "Cinematic, high-contrast, premium",
    description:
      "For luxury brands, creative agencies, fashion, and premium high-tech. " +
      "Pure black backgrounds, tight tracking, sharp geometry, and ghosted logos " +
      "create an austere, cinematic aesthetic. No dividers; space carries structure. " +
      "White-on-black primary actions deliver maximum contrast.",
    canonicalPreset: "dark-contrast",
    presets:         ["dark-contrast", "bold-dark"],
    recommendedVariants: {
      hero:  "hero_direct_brand",
      proof: "proof_vision",
      cta:   "cta_platform",
    },
    contentEmphasis: ["premium", "luxury", "fashion", "creative", "exclusivity"],
    contextualFit:   ["night", "halloween"],
  },

  // ── Industrial Utility ────────────────────────────────────────────────────────
  //
  // UPPERCASE headings, zero rounding, thick structural borders, desaturated
  // logos. Built for manufacturing, logistics, construction, and utility-grade
  // industrial contexts where function precedes aesthetics.

  "industrial-utility": {
    key:             "industrial-utility",
    name:            "Industrial Utility",
    tagline:         "Structural, functional, built to last",
    description:
      "Designed for manufacturing, logistics, construction, and engineering contexts. " +
      "UPPERCASE headings, zero border-radius, thick structural borders, and " +
      "desaturated logos communicate durability and precision. " +
      "No ornament — form follows function.",
    canonicalPreset: "industrial-strong",
    presets:         ["industrial-strong"],
    recommendedVariants: {
      hero:  "hero_direct_brand",
      proof: "proof_platform",
      cta:   "cta_meeting",
    },
    contentEmphasis: ["capability", "reliability", "scale", "safety", "precision"],
    contextualFit:   [],
  },

  // ── Wellness Care ─────────────────────────────────────────────────────────────
  //
  // Airy spacing, soft rounding, barely-there shadows, lightly muted logos,
  // and no structural dividers. The calm, reassuring family for healthcare,
  // wellness, coaching, and anything that needs to feel safe and unhurried.

  "wellness-care": {
    key:             "wellness-care",
    name:            "Wellness & Care",
    tagline:         "Calm, spacious, reassuring",
    description:
      "Built for healthcare, wellness, mental health, coaching, and educational " +
      "contexts where trust and calm are paramount. Very airy spacing, soft rounding, " +
      "and gentle shadows remove tension from the layout. " +
      "Lightly muted logos reduce visual noise and increase legibility.",
    canonicalPreset: "healthcare-calm",
    presets:         ["healthcare-calm"],
    recommendedVariants: {
      hero:    "hero_direct_brand",
      proof:   "proof_cases",
      cta:     "cta_guide",
      feature: "feature_grid_primary",
    },
    contentEmphasis: ["trust", "safety", "empathy", "wellbeing", "accessibility"],
    contextualFit:   ["valentines", "easter"],
  },

  // ── Careers Human ─────────────────────────────────────────────────────────────
  //
  // Warm teal palette, DM Sans typography at 500 weight, airy spacing, no dark
  // hero. Built specifically for candidate-facing recruitment platforms where the
  // visitor is evaluating the employer — not being sold a product.
  // No conversion pressure, no bold-display headings, no logo-wall proof sections.

  "careers-human": {
    key:             "careers-human",
    name:            "Careers Human",
    tagline:         "Human, calm, candidate-first",
    description:
      "Designed for werken-bij pages, careers sections, and employer-brand platforms " +
      "where candidates need to feel welcomed, not converted. " +
      "Warm teal palette, light hero, DM Sans at 500 weight, and generous whitespace " +
      "signal honesty, stability, and a people-first culture. " +
      "No conversion pressure — trust first, then action.",
    canonicalPreset: "careers-human",
    presets:         ["careers-human"],
    recommendedVariants: {
      hero:  "hero_careers_default",
      proof: "proof_careers_team",
      cta:   "cta_careers_browse",
    },
    contentEmphasis: ["trust", "candidate", "culture", "employer-brand", "recruitment", "transparency"],
    contextualFit:   [],
  },

  // ── Dark AI ───────────────────────────────────────────────────────────────────
  //
  // Near-black (#06060c) base with indigo-violet accent (#7b6eff).
  // Inspired by zerodrift.ai and modern AI-first product sites.
  // Sharp geometry, bold display headings, no dividers, subtle glow accents.
  // Built for AI tools, developer platforms, premium SaaS, and dark-mode-first
  // products where the interface signals technical sophistication.
  //
  // Ideal contextual triggers:
  //   - high-intent visitors (demo/pricing page visitors)
  //   - returning visitors (already know the product; ready for depth)
  //   - evening / night-time traffic
  //   - technical / developer audiences

  "dark-ai": {
    key:             "dark-ai",
    name:            "Dark AI",
    tagline:         "Near-black, AI-forward, precision-first",
    description:
      "Built for AI tools, developer platforms, premium SaaS, and dark-mode-first products. " +
      "Near-black surfaces, indigo-violet accents, sharp geometry, and bold display headings " +
      "signal technical sophistication and premium quality. " +
      "No dividers — space and colour carry structure. Subtle glow accents add depth without noise.",
    canonicalPreset: "dark-ai",
    presets:         ["dark-ai", "dark-contrast", "bold-dark"],
    recommendedVariants: {
      hero:    "hero_minimal_dark",
      proof:   "proof_logos",
      cta:     "cta_glow",
      feature: "feature_grid_dark",
    },
    contentEmphasis: ["premium", "ai", "developer", "product", "precision", "technical", "exclusive"],
    contextualFit:   ["night", "halloween", "high-intent", "returning"],
  },

  // ── Structured SaaS ───────────────────────────────────────────────────────────
  //
  // Warm stone (#fafaf9) base with amber-orange primary (#d97706).
  // Inspired by the Aelen Sanity template / Lexington Themes viewport.
  // Sharp radius, hairline borders, no shadows — editorial B2B product aesthetic.
  // Plus Jakarta Sans headings at 700 weight; Inter body for maximum legibility.
  //
  // Ideal contextual triggers:
  //   - consideration / evaluation stage visitors (scanning features, pricing, docs)
  //   - content-depth brands with changelogs, integrations, or rich documentation
  //   - B2B buyers who value structure and clarity over conversion energy
  //   - product-led brands with editorial confidence

  "structured-saas": {
    key:             "structured-saas",
    name:            "Structured SaaS",
    tagline:         "Editorial product confidence — structured, amber, precise",
    description:
      "Built for B2B SaaS and editorial-product brands that lead with content hierarchy. " +
      "Warm stone surfaces, amber-orange accent, hairline borders, and Plus Jakarta Sans typography " +
      "create a confident, structured aesthetic that says 'we have depth' without shouting. " +
      "Inspired by the Aelen / Lexington Themes editorial product viewport.",
    canonicalPreset: "structured-saas",
    presets:         ["structured-saas"],
    recommendedVariants: {
      hero:    "hero_split_structured",
      proof:   "proof_logos",
      cta:     "cta_soft",
      feature: "feature_grid_primary",
    },
    contentEmphasis: ["product", "editorial", "b2b", "structured", "content-depth", "developer", "saas"],
    contextualFit:   ["consideration", "evaluation", "content-referral"],
  },

  // ── Clean Corporate ───────────────────────────────────────────────────────────
  //
  // Pure white (#ffffff) base with sky-blue primary (#0284c7).
  // Inspired by yeldra.com — clean, modern, professional-but-not-stiff.
  // Balanced radius, very subtle shadows, airy whitespace, DM Sans typography.
  // The "trust on first meeting" aesthetic: crisp, credible, and focused.
  //
  // Ideal contextual triggers:
  //   - first-time visitors (awareness / discovery stage)
  //   - B2B corporate buyers (evaluation mindset)
  //   - broad default traffic
  //   - service-led and consultative journeys

  "clean-corporate": {
    key:             "clean-corporate",
    name:            "Clean Corporate",
    tagline:         "Crisp white, modern SaaS, trust-first",
    description:
      "Designed for modern B2B SaaS, professional services, and consultative brands. " +
      "Pure white surfaces, sky-blue accent, balanced radius, and very subtle card shadows " +
      "create an authoritative-yet-approachable aesthetic. " +
      "Airy whitespace and clean DM Sans typography communicate clarity and focus. " +
      "First impressions done right — credible without being cold.",
    canonicalPreset: "clean-corporate",
    presets:         ["clean-corporate", "corporate-trust", "modern-saas"],
    recommendedVariants: {
      hero:    "hero_split_clean",
      proof:   "proof_logos",
      cta:     "cta_soft",
      feature: "feature_grid_spacious",
    },
    contentEmphasis: ["trust", "clarity", "saas", "b2b", "professional", "modern", "credibility"],
    contextualFit:   ["first-visit", "awareness", "corporate-buyer"],
  },

} as const;

// ── Featured theme families (admin first-class entities) ──────────────────────
//
// These five entries represent the flagship personality choices shown at the
// top of the admin design page as distinct selectable families — a layer above
// the raw colour/font preset grid.
//
// Each entry maps to an existing ThemePresetKey as its canonical expression.
// The descriptions here are the single source of truth for admin copy.
//
// Adding a new featured family: append an entry; the presetKey must be a valid
// ThemePresetKey in THEME_PRESETS.

export interface FeaturedThemeFamily {
  /** Canonical preset that represents this family. */
  presetKey:   ThemePresetKey;
  /** Display name for the admin UI. */
  name:        string;
  /** Short tagline shown below the name. */
  tagline:     string;
  /** 1–2 sentence description of the family personality. */
  description: string;
}

export const FEATURED_THEME_FAMILIES: readonly FeaturedThemeFamily[] = [
  {
    presetKey:   "editorial-classic",
    name:        "Editorial Classic",
    tagline:     "Content-first · Typographic · Considered",
    description:
      "Serif headings, warm paper undertones, measured spacing, and polaroid " +
      "image frames. Built for publishers, law firms, and long-form content " +
      "brands that value reading experience over conversion density.",
  },
  {
    presetKey:   "corporate-clean",
    name:        "Corporate Clean",
    tagline:     "Professional · Structured · Trust-first",
    description:
      "Navy or slate heroes, conservative radius, and structured dividers. " +
      "A restrained, authoritative personality for professional services, " +
      "financial institutions, and enterprise B2B sites.",
  },
  {
    presetKey:   "bold-marketing",
    name:        "Bold Marketing",
    tagline:     "High-energy · Vivid · Conversion-focused",
    description:
      "Full-colour logos, vivid brand CTAs, and open layouts with no dividers. " +
      "Designed for growth-stage campaigns, product launches, and any brand " +
      "that wants to communicate speed, ambition, and impact.",
  },
  {
    presetKey:   "portfolio-showcase",
    name:        "Portfolio Showcase",
    tagline:     "Visual-first · Generous · Creative",
    description:
      "Expansive media areas, generous whitespace, and clean editorial type. " +
      "Ideal for creative agencies, designers, photographers, and anyone whose " +
      "work needs to breathe and speak for itself.",
  },
  {
    presetKey:   "premium-luxury",
    name:        "Premium Luxury",
    tagline:     "Elegant · Refined · Premium",
    description:
      "Tight heading tracking, elevated whitespace, sophisticated restraint, " +
      "and a muted palette with gold or platinum accents. For luxury brands, " +
      "boutique hospitality, and premium professional services.",
  },
  {
    presetKey:   "careers-human",
    name:        "Careers Human",
    tagline:     "Human · Calm · Candidate-First",
    description:
      "Warm teal palette, DM Sans at 500 weight, generous whitespace, and a " +
      "light welcoming hero. Built for werken-bij pages and employer-brand " +
      "platforms — trust first, then action, never conversion pressure.",
  },
  {
    presetKey:   "dark-ai",
    name:        "Dark AI",
    tagline:     "AI-forward · Precision · Premium Dark",
    description:
      "Near-black surface, indigo-violet accent, sharp geometry, and bold display " +
      "headings. Designed for AI tools, developer platforms, and premium SaaS " +
      "products that need to signal technical sophistication on first impression.",
  },
  {
    presetKey:   "clean-corporate",
    name:        "Clean Corporate",
    tagline:     "Modern SaaS · Crisp · Trust-first",
    description:
      "Pure white surfaces, sky-blue accent, balanced radius, and DM Sans " +
      "typography. The 'trust on first meeting' aesthetic for modern B2B SaaS, " +
      "professional services, and consultative brands.",
  },
  {
    presetKey:   "structured-saas",
    name:        "Structured SaaS",
    tagline:     "Editorial Product · Structured · Content-first",
    description:
      "Warm stone surfaces, amber-orange accent, hairline borders, and Plus Jakarta " +
      "Sans typography. The editorial product aesthetic for B2B SaaS brands that " +
      "lead with content depth and structured confidence over conversion energy.",
  },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * All theme family keys in display order.
 */
export const THEME_FAMILY_KEYS: readonly ThemeFamilyKey[] = [
  "saas-product",
  "corporate-professional",
  "editorial-publishing",
  "startup-growth",
  "luxury-dark",
  "industrial-utility",
  "wellness-care",
  "careers-human",
  "dark-ai",
  "clean-corporate",
  "structured-saas",
] as const;

/**
 * Ordered catalog for admin UI rendering.
 */
export const THEME_FAMILY_CATALOG: readonly ThemeFamily[] =
  THEME_FAMILY_KEYS.map((k) => THEME_FAMILIES[k]);

/**
 * Look up the family a given preset belongs to.
 *
 * Returns undefined if the preset is not registered in any family's `presets`
 * array (should not happen for platform presets; may occur for tenant-custom
 * presets not yet registered in a family).
 */
export function getFamilyForPreset(
  presetKey: ThemePresetKey,
): ThemeFamily | undefined {
  return THEME_FAMILY_CATALOG.find((f) => f.presets.includes(presetKey));
}

/**
 * Returns the canonical preset for a given family key.
 * Safe type-helper — avoids having to index THEME_FAMILIES manually.
 */
export function getCanonicalPreset(familyKey: ThemeFamilyKey): ThemePresetKey {
  return THEME_FAMILIES[familyKey].canonicalPreset;
}

/**
 * Returns all presets that contextually fit a given event or signal.
 *
 * Looks across all families for `contextualFit` matches, then returns the
 * presets of every matching family.  Used by the contextual theme decision
 * layer to narrow candidates before applying priority rules.
 *
 * @param signal — a SeasonalEvent value, time-of-day value, or campaign tag
 */
export function getPresetsForContext(signal: string): readonly ThemePresetKey[] {
  const matching = THEME_FAMILY_CATALOG.filter((f) =>
    f.contextualFit.includes(signal),
  );
  return matching.flatMap((f) => f.presets as ThemePresetKey[]);
}
