/**
 * AI Theme Metadata
 *
 * Structured decision metadata for every theme preset, enabling the AI
 * decision layer to select the most contextually appropriate visual theme
 * for a given visitor session.
 *
 * ─── Design goals ─────────────────────────────────────────────────────────────
 *
 *   Human-readable  Each entry uses plain language that maps naturally to
 *                   visitor signals — traffic sources, funnel stages, industry
 *                   signals, time-of-day patterns.
 *
 *   Orthogonal      Theme selection is independent of variant selection.
 *                   The AI may suggest a theme even when it defers to rules
 *                   for hero/proof/cta variant selection (and vice-versa).
 *
 *   Soft gate       The AI theme suggestion is a soft override: invalid or
 *                   absent `themeKey` in the AI response falls back to the
 *                   rule-selected or tenant-default theme, never hard-rejects
 *                   the entire experience plan.
 *
 *   Complete        Every ThemePresetKey in presets.ts has an entry here.
 *                   The type system enforces exhaustiveness via a mapped type
 *                   constant — adding a new preset without metadata is a
 *                   compile-time error.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   In prompt-builder.ts — format theme candidates for the system prompt so
 *   the model understands what each theme communicates.
 *
 *   In ai-confidence-policy.ts — validate the themeKey returned by the model
 *   against ALLOWED_THEME_KEYS (soft gate: invalid key → no-op, not rejection).
 *
 * ─── Field semantics ──────────────────────────────────────────────────────────
 *
 *   label            Short display name.  Matches THEME_CATALOG entry.
 *
 *   summary          One sentence: what this theme communicates visually and
 *                    emotionally to a visitor.  Written from the visitor's
 *                    perspective, not a technical description.
 *
 *   personality      Three to five comma-separated adjectives that capture
 *                    the theme's tonal register.
 *
 *   bestForSources   Traffic sources where this theme is most appropriate.
 *                    Drawn from the same source vocabulary as variant meta:
 *                    google, linkedin, direct, referral, email, partner, other.
 *
 *   bestForFunnel    Funnel stages where this theme performs best.
 *                    Values: awareness, consideration, decision.
 *
 *   intendedUse      Two to four use cases — industry / product categories this
 *                    theme is optimised for.
 *
 *   disqualifiers    Hard reasons not to choose this theme.  The AI treats
 *                    these as absolute constraints, not preferences.
 *
 *   contextualFit    Free-text signals (seasonal, time-of-day, campaign type,
 *                    visitor intent) that make this theme especially relevant.
 *                    Written in plain language to match how the AI sees signals.
 */

import type { ThemePresetKey } from "@/design-system/theme/presets";

// ── ThemeDecisionMeta type ─────────────────────────────────────────────────────

/**
 * AI-facing decision metadata for a single theme preset.
 *
 * Mirrors the structure of VariantDecisionMeta in variant-meta.ts but is
 * scoped to the visual presentation layer rather than content selection.
 */
export interface ThemeDecisionMeta {
  /** Short display label matching THEME_CATALOG. */
  label: string;

  /**
   * One-sentence summary of what this theme communicates to a visitor.
   * Written from the visitor's emotional/visual perspective.
   */
  summary: string;

  /**
   * Tonal adjectives — comma-separated, 3–5 words.
   * e.g. "professional, restrained, trustworthy"
   */
  personality: string;

  /**
   * Traffic sources where this theme creates the strongest first impression.
   * Values from the platform source vocabulary.
   */
  bestForSources: readonly string[];

  /**
   * Funnel stages where this theme's visual tone is most persuasive.
   */
  bestForFunnel: readonly ("awareness" | "consideration" | "decision")[];

  /**
   * Industries, product types, or site categories this theme is designed for.
   */
  intendedUse: readonly string[];

  /**
   * Conditions that make this theme a particularly strong choice.
   * Written in natural language to match how the AI sees visitor signals.
   */
  contextualFit: readonly string[];

  /**
   * Hard disqualifiers — do not choose this theme if any of these apply.
   * The AI treats these as absolute constraints.
   */
  disqualifiers: readonly string[];
}

// ── Allowed theme key set ──────────────────────────────────────────────────────

/**
 * Exhaustive array of all ThemePresetKey values that have AI metadata.
 *
 * Used by:
 *  - ai-confidence-policy.ts to soft-validate AI-returned themeKey
 *  - prompt-builder.ts to enumerate theme candidates in the system prompt
 *
 * Kept in sync with THEME_CATALOG via the exhaustive type assertion below.
 */
export const ALLOWED_THEME_KEYS: readonly ThemePresetKey[] = [
  "corporate-blue",
  "modern-green",
  "minimal-neutral",
  "bold-dark",
  "tech-indigo",
  "warm-professional",
  "recruitment-energy",
  "healthcare-calm",
  "industrial-strong",
  "premium-editorial",
  "dark-contrast",
  "editorial-classic",
  "playful-startup",
  "startup-energy",
  "corporate-trust",
  "modern-saas",
  "corporate-clean",
  "bold-marketing",
  "portfolio-showcase",
  "premium-luxury",
  "valentine-pink",
  "dutch-orange",
  "careers-human",
  // ── Premium families ──────────────────────────────────────────────────────
  "dark-ai",
  "clean-corporate",
  "structured-saas",
] as const;

// ── Theme decision metadata registry ──────────────────────────────────────────

/**
 * Complete metadata registry keyed by ThemePresetKey.
 *
 * The type `Record<ThemePresetKey, ThemeDecisionMeta>` enforces exhaustiveness:
 * every preset must have an entry, and TypeScript will error if any key is
 * added to ThemePresetKey without a corresponding metadata entry here.
 */
export const THEME_DECISION_META: Record<ThemePresetKey, ThemeDecisionMeta> = {

  // ── Corporate themes ────────────────────────────────────────────────────────

  "corporate-blue": {
    label:       "Corporate Blue",
    summary:     "A deep navy palette that projects institutional trust and professional-services authority.",
    personality: "authoritative, institutional, trustworthy, formal",
    bestForSources: ["linkedin", "direct", "referral"],
    bestForFunnel:  ["consideration", "decision"],
    intendedUse:    ["professional services", "financial services", "legal", "management consulting"],
    contextualFit:  [
      "Visitor arrives from LinkedIn with professional or executive context",
      "Company industry signal is financial services, legal, or consulting",
      "ABM-matched visitor from a financial or professional services account",
      "UTM campaign references a case study, whitepaper, or RFP context",
    ],
    disqualifiers: [
      "Campaign signals startup energy, growth hacking, or consumer brand context",
      "Visitor is from a creative agency or design-led industry",
      "Healthcare-specific context (cyan/calm palette is more appropriate)",
    ],
  },

  "minimal-neutral": {
    label:       "Minimal Neutral",
    summary:     "A zinc monochrome palette that lets content breathe — pure structure with no colour distraction.",
    personality: "minimal, structural, refined, understated",
    bestForSources: ["direct", "referral", "linkedin"],
    bestForFunnel:  ["consideration", "decision"],
    intendedUse:    ["design agencies", "architecture firms", "portfolio sites", "premium SaaS"],
    contextualFit:  [
      "Visitor's industry signal suggests creative, design, or architecture",
      "Premium positioning context where restraint signals sophistication",
      "Returning expert visitor doing deep product evaluation — reduce noise",
      "Visitor is comparing multiple vendors and prefers clean, scannable layout",
    ],
    disqualifiers: [
      "High-energy campaign context where neutral may read as lifeless",
      "Consumer app context expecting expressive colour",
      "Recruitment or career-site context requiring energy and emotion",
    ],
  },

  "premium-editorial": {
    label:       "Premium Editorial",
    summary:     "Warm brown serif typography with generous spacing — projects high-end editorial authority.",
    personality: "elegant, authoritative, editorial, premium",
    bestForSources: ["direct", "referral", "email"],
    bestForFunnel:  ["awareness", "consideration"],
    intendedUse:    ["luxury consulting", "editorial platforms", "high-end professional services", "private equity"],
    contextualFit:  [
      "Industry signal is luxury, private equity, investment, or high-end consulting",
      "Visitor comes via a referral from a thought-leadership or editorial source",
      "Email campaign is content-led (newsletter, long-form, research report)",
      "Visitor interest signals are aligned with finance, strategy, or leadership",
    ],
    disqualifiers: [
      "Tech-first or developer-facing audience — serif editorial reads as too slow",
      "Startup or growth-hacking context expecting fast, punchy communication",
      "Industrial or blue-collar context where elegance signals mismatch",
    ],
  },

  "industrial-strong": {
    label:       "Industrial Strong",
    summary:     "Red on stone with uppercase headings — projects industrial strength, reliability, and no-nonsense grit.",
    personality: "strong, direct, industrial, no-nonsense",
    bestForSources: ["direct", "google", "referral"],
    bestForFunnel:  ["awareness", "consideration"],
    intendedUse:    ["manufacturing", "logistics", "construction", "industrial equipment"],
    contextualFit:  [
      "Company industry signal is manufacturing, logistics, construction, or utilities",
      "Visitor arrives from a trade publication or industrial referral source",
      "UTM campaign references safety, compliance, or operational efficiency",
    ],
    disqualifiers: [
      "SaaS or technology product context — industrial palette signals hardware, not software",
      "Healthcare context — clinical audience will find red alarming",
      "Consumer brand or lifestyle context",
    ],
  },

  // ── Marketing themes ────────────────────────────────────────────────────────

  "bold-dark": {
    label:       "Bold Dark",
    summary:     "Amber on near-black — a high-energy dark experience that signals cutting-edge product launches.",
    personality: "bold, dramatic, high-energy, premium-dark",
    bestForSources: ["direct", "email", "google"],
    bestForFunnel:  ["awareness"],
    intendedUse:    ["product launches", "developer conferences", "premium tech products", "gaming"],
    contextualFit:  [
      "Evening or night time-of-day signal — dark themes feel natural at night",
      "UTM campaign explicitly references a product launch, release, or beta",
      "Visitor interest signals are developer, tech, or gaming oriented",
      "Seasonal event is a tech conference or product announcement period",
    ],
    disqualifiers: [
      "Healthcare or medical context — dark backgrounds reduce clinical trust",
      "Financial services requiring calm and accessible colour",
      "Visitor is a known customer in renewal mode — not a launch moment",
    ],
  },

  "modern-green": {
    label:       "Modern Green",
    summary:     "An emerald palette that communicates growth, sustainability, and forward-looking B2B confidence.",
    personality: "fresh, growth-oriented, sustainable, optimistic",
    bestForSources: ["google", "linkedin", "referral"],
    bestForFunnel:  ["awareness", "consideration"],
    intendedUse:    ["sustainability platforms", "greentech", "growth-stage B2B", "health-adjacent SaaS"],
    contextualFit:  [
      "UTM campaign or referrer signals a sustainability, ESG, or green tech context",
      "Visitor interest signal is aligned with environment, health, or growth",
      "Spring seasonal event — green feels timely and fresh",
      "Company is a growth-stage B2B where optimism is a selling point",
    ],
    disqualifiers: [
      "Industrial or manufacturing context where green may feel out of place",
      "Luxury context expecting warm or neutral tones",
      "Evening or dark-mode preference signals (green-on-white can feel bright)",
    ],
  },

  "warm-professional": {
    label:       "Warm Professional",
    summary:     "Amber-600 with a human, coaching feel — approachable expertise without corporate coldness.",
    personality: "warm, approachable, human, coaching",
    bestForSources: ["direct", "referral", "email"],
    bestForFunnel:  ["awareness", "consideration"],
    intendedUse:    ["coaching", "consulting", "HR platforms", "learning and development"],
    contextualFit:  [
      "Visitor arrives from a personal referral or community source",
      "UTM references a webinar, podcast, or community event",
      "Company size signal is SMB — warmth resonates with smaller teams",
      "Visitor interest signal is HR, learning, coaching, or leadership",
    ],
    disqualifiers: [
      "Enterprise procurement context requiring institutional gravitas",
      "Financial or legal context where warmth signals lack of rigour",
      "Industrial or manufacturing context",
    ],
  },

  // ── Specialist themes ───────────────────────────────────────────────────────

  "tech-indigo": {
    label:       "Tech Indigo",
    summary:     "Deep violet on dark backgrounds — the aesthetic of serious developer tooling and technical SaaS.",
    personality: "technical, precise, developer-focused, serious",
    bestForSources: ["google", "direct", "referral"],
    bestForFunnel:  ["consideration", "decision"],
    intendedUse:    ["developer tools", "APIs", "data platforms", "technical SaaS dashboards"],
    contextualFit:  [
      "Referrer is a developer community site, GitHub, or technical publication",
      "UTM campaign is a developer conference, hackathon, or OSS campaign",
      "Visitor interest signals are developer, data engineering, or API oriented",
      "Evening time signal — developers often browse technical tools after hours",
    ],
    disqualifiers: [
      "Non-technical buyer context — deep indigo on dark signals complexity",
      "Healthcare or wellness context",
      "Consumer or lifestyle brand context",
    ],
  },

  "recruitment-energy": {
    label:       "Recruitment Energy",
    summary:     "Orange energy with heavy weight — signals opportunity, momentum, and urgency for job seekers.",
    personality: "energetic, urgent, opportunistic, motivating",
    bestForSources: ["google", "direct", "referral"],
    bestForFunnel:  ["awareness"],
    intendedUse:    ["job boards", "career platforms", "staffing agencies", "employer branding"],
    contextualFit:  [
      "UTM campaign references job, career, opportunity, or hiring",
      "Visitor arrives from a job board or career aggregator referral",
      "Company context is HR, talent acquisition, or staffing",
      "Morning time signal — job seekers browse early in the day",
    ],
    disqualifiers: [
      "B2B enterprise procurement context — orange energy can undermine gravitas",
      "Healthcare or medical context",
      "Financial services context",
    ],
  },

  "healthcare-calm": {
    label:       "Healthcare Calm",
    summary:     "Cyan on sky-blue with generous spacing — clinical trust and calm that healthcare buyers expect.",
    personality: "calm, clinical, trustworthy, accessible",
    bestForSources: ["direct", "linkedin", "referral"],
    bestForFunnel:  ["awareness", "consideration"],
    intendedUse:    ["healthcare SaaS", "wellness platforms", "medical technology", "telehealth"],
    contextualFit:  [
      "Company industry signal is healthcare, medical, or clinical",
      "UTM references a clinical outcome, patient engagement, or compliance topic",
      "Visitor interest signal is health, medicine, or wellness aligned",
      "Referrer is a healthcare conference, clinical publication, or medical association",
    ],
    disqualifiers: [
      "Industrial or manufacturing context",
      "Consumer entertainment or lifestyle context",
      "Dark-mode or night time signals where clinical cyan reads as cold",
    ],
  },

  // ── Premium themes ──────────────────────────────────────────────────────────

  "dark-contrast": {
    label:       "Dark Contrast",
    summary:     "Stark black-and-white minimalism — luxury restraint that lets work speak for itself.",
    personality: "luxurious, minimal, stark, sophisticated",
    bestForSources: ["direct", "referral"],
    bestForFunnel:  ["awareness", "consideration"],
    intendedUse:    ["luxury brands", "creative agencies", "high-end design studios", "fashion tech"],
    contextualFit:  [
      "Evening or night time-of-day signal — dark experiences feel premium at night",
      "Visitor arrives from a luxury brand, design, or creative industry referral",
      "Industry or company signal is fashion, architecture, luxury goods, or high-end creative",
      "UTM campaign references brand identity, craft, or premium positioning",
    ],
    disqualifiers: [
      "Healthcare context — high-contrast black reduces clinical warmth",
      "Recruitment context where energy and colour drive engagement",
      "Enterprise procurement context that expects conventional blue or grey",
    ],
  },

  "editorial-classic": {
    label:       "Editorial Classic",
    summary:     "Clean white with serif headings — the editorial credibility of a respected publication.",
    personality: "credible, editorial, authoritative, classic",
    bestForSources: ["direct", "referral", "email"],
    bestForFunnel:  ["awareness", "consideration"],
    intendedUse:    ["news", "publishing", "law firms", "financial research", "academic platforms"],
    contextualFit:  [
      "Visitor arrives from an editorial referral (publication, newsletter, research report)",
      "Email campaign is long-form, research-based, or thought-leadership oriented",
      "Company industry signal is legal, financial research, or academic",
      "Visitor interest signals are aligned with finance, law, or policy",
    ],
    disqualifiers: [
      "Growth-stage startup context expecting modern SaaS aesthetic",
      "Developer-facing context where serif feels dated",
      "Consumer or lifestyle brand context expecting colour and energy",
    ],
  },

  "playful-startup": {
    label:       "Playful Startup",
    summary:     "Vivid violet with expressive typography — communicates innovation, creativity, and fun product energy.",
    personality: "playful, innovative, creative, youthful",
    bestForSources: ["direct", "referral", "email"],
    bestForFunnel:  ["awareness"],
    intendedUse:    ["consumer apps", "EdTech", "lifestyle brands", "creative tools", "B2C SaaS"],
    contextualFit:  [
      "UTM campaign references a product launch, beta, or new feature",
      "Visitor age or interest signal suggests younger or creative demographic",
      "Referrer is Product Hunt, Hacker News, or a consumer tech publication",
      "Company is consumer-facing or B2C",
    ],
    disqualifiers: [
      "Enterprise or institutional B2B context",
      "Healthcare, legal, or financial services",
      "Industrial or manufacturing context",
    ],
  },

  "startup-energy": {
    label:       "Startup Energy",
    summary:     "Rose-red with ultra-bold text and spring motion — maximum conversion energy for product launches.",
    personality: "urgent, bold, growth-hacking, conversion-focused",
    bestForSources: ["google", "email", "direct"],
    bestForFunnel:  ["awareness"],
    intendedUse:    ["B2C launches", "growth campaigns", "conversion landing pages", "flash sales"],
    contextualFit:  [
      "UTM campaign explicitly references a launch, promotion, or limited-time offer",
      "Email campaign is high-intensity conversion-focused",
      "Black Friday, Cyber Monday, or seasonal sale event signal",
      "Visitor interest signals strong purchase intent",
    ],
    disqualifiers: [
      "B2B enterprise context — high-energy red can feel alarming in procurement",
      "Healthcare or clinical context",
      "Returning visitor in renewal or loyalty mode — urgency is off-message",
    ],
  },

  "corporate-trust": {
    label:       "Corporate Trust",
    summary:     "Blue-600 with DM Sans — the reliable professionalism of an established financial or SaaS institution.",
    personality: "reliable, professional, institutional, clean",
    bestForSources: ["linkedin", "direct", "email"],
    bestForFunnel:  ["consideration", "decision"],
    intendedUse:    ["financial SaaS", "professional services", "compliance platforms", "established B2B"],
    contextualFit:  [
      "Visitor is LinkedIn-sourced with professional or financial services context",
      "Company reverse-IP is a financial institution or professional services firm",
      "CRM-matched visitor in active evaluation or renewal stage",
      "UTM campaign references compliance, security, or enterprise readiness",
    ],
    disqualifiers: [
      "Growth-stage startup context wanting edge and differentiation",
      "Creative agency or design-led industry expecting visual personality",
      "Consumer app or lifestyle brand context",
    ],
  },

  "modern-saas": {
    label:       "Modern SaaS",
    summary:     "Blue-violet with clean airy spacing — the contemporary visual language of product-led SaaS growth.",
    personality: "clean, airy, contemporary, product-led",
    bestForSources: ["google", "direct", "referral"],
    bestForFunnel:  ["awareness", "consideration"],
    intendedUse:    ["product-led SaaS", "growth-stage B2B", "developer-friendly platforms", "modern tooling"],
    contextualFit:  [
      "Visitor arrives via organic or paid search with a modern SaaS or software keyword",
      "Referrer is a SaaS comparison site, G2, Capterra, or product review publication",
      "UTM references a product tour, free trial, or self-serve onboarding campaign",
      "Visitor interest signal suggests product exploration or tool discovery mode",
    ],
    disqualifiers: [
      "Industrial or manufacturing context",
      "Luxury or editorial context expecting warmer or more opinionated aesthetics",
      "Healthcare or clinical context requiring explicit calm-palette signals",
    ],
  },

  // ── New curated themes ────────────────────────────────────────────────────────

  "corporate-clean": {
    label:       "Corporate Clean",
    summary:     "Slate-neutral on pure white — structured, whitespace-driven authority with no blue bias; the anti-navy corporate theme.",
    personality: "clean, structured, restrained, professional, minimal",
    bestForSources: ["linkedin", "direct", "referral"],
    bestForFunnel:  ["consideration", "decision"],
    intendedUse:    ["management consulting", "modern law firms", "clean B2B SaaS", "professional services"],
    contextualFit:  [
      "Visitor arrives from LinkedIn with a consulting or advisory context",
      "Company is a professional services firm preferring neutral over blue",
      "Returning visitor in evaluation mode — reduce noise, increase legibility",
      "UTM campaign references a proposal, whitepaper, or capability review",
    ],
    disqualifiers: [
      "High-energy campaign or startup context where neutral reads as flat",
      "Consumer brand or lifestyle context expecting colour and warmth",
      "Healthcare or wellness context (calm palette more appropriate)",
    ],
  },

  "bold-marketing": {
    label:       "Bold Marketing",
    summary:     "Vivid fuchsia-pink with 900-weight headings, full-colour logos, and maximum whitespace — the visual energy of B2C campaigns and product launches.",
    personality: "vivid, bold, campaign-ready, brand-forward, energetic",
    bestForSources: ["social", "email", "google"],
    bestForFunnel:  ["awareness", "consideration"],
    intendedUse:    ["B2C product launches", "consumer campaigns", "event landing pages", "brand-awareness initiatives"],
    contextualFit:  [
      "UTM campaign references a product launch, sale, or brand-awareness push",
      "Visitor arrives from a social media or consumer marketing channel",
      "Seasonal event with high consumer engagement (Black Friday, summer sales)",
      "Visitor interest signals consumer or lifestyle context",
    ],
    disqualifiers: [
      "Enterprise procurement or B2B professional services context",
      "Healthcare, legal, or compliance-driven audience",
      "Premium/luxury context where fuchsia reads as too aggressive",
    ],
  },

  // ── Signature themes ─────────────────────────────────────────────────────────

  "portfolio-showcase": {
    label:       "Portfolio Showcase",
    summary:     "Teal-cyan with full-bleed media and floating shadow cards — built for agencies and studios whose work is the hero.",
    personality: "visual, media-forward, spacious, agency, case-driven",
    bestForSources: ["direct", "referral", "google"],
    bestForFunnel:  ["awareness", "consideration"],
    intendedUse:    ["creative agencies", "design studios", "architecture firms", "case study sites"],
    contextualFit:  [
      "Visitor arrives from a design or creative community referral",
      "Session context suggests visual portfolio or case study browsing",
      "UTM campaign references a creative services pitch or award entry",
      "Visitor interests suggest design, creative, or visual-first context",
    ],
    disqualifiers: [
      "Enterprise procurement context expecting conservative authority signals",
      "Healthcare or legal context where media dominance feels inappropriate",
      "Long-form editorial content that requires neutral reading aesthetics",
    ],
  },

  "premium-luxury": {
    label:       "Premium Luxury",
    summary:     "Deep gold on warm cream with refined serif headings — the visual register of exclusive brands, prestige consulting, and high-end services.",
    personality: "refined, restrained, elegant, exclusive, timeless",
    bestForSources: ["direct", "linkedin", "referral"],
    bestForFunnel:  ["consideration", "decision"],
    intendedUse:    ["luxury brands", "prestige consulting", "wealth management", "high-end hospitality"],
    contextualFit:  [
      "Visitor is CRM-matched to a high-value or senior account contact",
      "Campaign explicitly targets premium or C-suite audience segments",
      "Industry signal is luxury goods, private banking, or executive advisory",
      "Visitor arrives from a referral signalling exclusive community membership",
    ],
    disqualifiers: [
      "High-energy campaign or growth-hacking context where luxury feels slow",
      "Consumer app or startup context expecting speed and vibrancy",
      "Healthcare or clinical context requiring calm functional signals",
    ],
  },

  // ── Seasonal themes ──────────────────────────────────────────────────────────

  "valentine-pink": {
    label:       "Valentine Pink",
    summary:     "A warm rose palette with rounded shapes and airy spacing — the visual language of romance, gifting, and Valentine's Day campaigns.",
    personality: "romantic, warm, soft, inviting, celebratory",
    bestForSources: ["social", "email", "direct"],
    bestForFunnel:  ["awareness", "consideration"],
    intendedUse:    ["Valentine's Day campaigns", "gifting", "lifestyle", "consumer brands"],
    contextualFit:  [
      "Seasonal event is valentines (Feb 12–14)",
      "UTM campaign references Valentine's Day, gifting, or romance themes",
      "Consumer brand audience during February seasonal window",
    ],
    disqualifiers: [
      "B2B or professional services audience where romantic palette feels mismatched",
      "Outside February Valentine's season",
      "Industrial, healthcare, or enterprise context",
    ],
  },

  "dutch-orange": {
    label:       "Dutch Orange",
    summary:     "Bold orange with maximum-weight headings and full-colour logos — the unmistakable visual energy of Dutch national identity and King's Day.",
    personality: "bold, national, energetic, direct, proud",
    bestForSources: ["social", "direct", "email"],
    bestForFunnel:  ["awareness", "consideration"],
    intendedUse:    ["King's Day campaigns", "Dutch sports events", "Netherlands-first brands", "national campaigns"],
    contextualFit:  [
      "Visitor locale is Netherlands or UTM campaign references Dutch national events",
      "King's Day (April 27) or Dutch sporting events",
      "Seasonal campaign targeting Dutch national identity",
    ],
    disqualifiers: [
      "International audience without Dutch cultural context",
      "Premium or luxury context where bold orange feels inappropriate",
      "Healthcare or calm-wellness context",
    ],
  },

  "careers-human": {
    label:       "Careers Human",
    summary:     "Warm teal, 500-weight DM Sans, and generous whitespace — a calm, human employer-brand theme that says 'we're honest, stable, and good to work with'.",
    personality: "calm, human, trustworthy, welcoming, transparent",
    bestForSources: ["linkedin", "direct", "email", "referral"],
    bestForFunnel:  ["awareness", "consideration"],
    intendedUse:    ["werken-bij pages", "employer-brand campaigns", "careers sections", "recruitment sites", "staffing agencies"],
    contextualFit:  [
      "Tenant industry is recruitment, HR, or employer branding",
      "Site is a careers/vacatures page or werken-bij section",
      "Candidate-facing context where trust and calm matter more than conversion",
      "Blueprint careers_platform is active",
    ],
    disqualifiers: [
      "B2B SaaS context where product clarity matters more than warmth",
      "Consumer e-commerce or campaign landing page requiring energy",
      "Luxury or premium positioning context",
      "High-urgency conversion page where calm reduces intent",
    ],
  },

  // ── Premium AI / Dark themes ───────────────────────────────────────────────

  "dark-ai": {
    label:       "Dark AI",
    summary:     "Near-black surface with indigo-violet accent — the visual language of AI tools, developer platforms, and premium dark-mode SaaS.",
    personality: "precise, premium, technical, AI-forward, exclusive",
    bestForSources: ["direct", "linkedin", "developer", "referral"],
    bestForFunnel:  ["consideration", "decision"],
    intendedUse:    ["AI tools", "developer APIs", "ML infrastructure", "premium dark-mode SaaS", "technical founder products"],
    contextualFit:  [
      "Product is an AI, ML, or developer-infrastructure platform",
      "Visitor arrives via direct/dark traffic or developer community (e.g. Hacker News, GitHub)",
      "Brand positioning is 'precision engineering' or 'AI-native' rather than general B2B",
      "Returning or high-intent visitor in an evening/night session cohort",
      "Campaign explicitly targets ML engineers, data scientists, or CTOs",
    ],
    disqualifiers: [
      "First-visit/awareness stage where the dark surface may reduce approachability",
      "Healthcare, education, or government context where dark palettes feel inappropriate",
      "Consumer-facing product where broad accessibility trumps premium positioning",
      "Clean Corporate or editorial family is already serving well for the tenant's audience",
    ],
  },

  // ── Premium Corporate / Light themes ──────────────────────────────────────

  "clean-corporate": {
    label:       "Clean Corporate",
    summary:     "Pure white with sky-blue accent — the trust-on-first-meeting aesthetic for modern B2B SaaS and professional-services brands.",
    personality: "clean, professional, trustworthy, modern, structured",
    bestForSources: ["linkedin", "direct", "google", "referral"],
    bestForFunnel:  ["awareness", "consideration"],
    intendedUse:    ["B2B SaaS", "professional services", "consulting", "accounting / law firms", "corporate software"],
    contextualFit:  [
      "First-visit or awareness stage where trust and clarity are the primary conversion levers",
      "Visitor arrives from LinkedIn or a professional referral with corporate buying intent",
      "Blueprint is clean_corporate_saas or similar professional-services variant",
      "Broad default traffic with no strong segmentation signal — safe universal starting point",
      "Product must pass a CFO/board-level credibility test on first impression",
    ],
    disqualifiers: [
      "Product is positioned as a 'developer tool' or 'AI-native' platform (use dark-ai instead)",
      "Creative agency, design studio, or portfolio site requiring more typographic personality",
      "Luxury or premium-dark positioning where white surfaces undercut the premium signal",
      "High-energy startup or consumer brand where the clean palette reads as bland",
    ],
  },

  // ── Structured SaaS / Editorial Product ──────────────────────────────────────

  "structured-saas": {
    label:       "Structured SaaS",
    summary:     "Warm amber on stone-white, hairline borders, Plus Jakarta Sans — the editorial product aesthetic for B2B SaaS that leads with content hierarchy over conversion energy.",
    personality: "structured, editorial, confident, precise, content-first",
    bestForSources: ["linkedin", "direct", "google", "referral"],
    bestForFunnel:  ["consideration", "decision"],
    intendedUse:    ["B2B SaaS product sites", "editorial-product brands", "developer tools with editorial positioning", "product-led B2B with content depth"],
    contextualFit:  [
      "Product has a rich content library, changelog, or documentation that is a sales differentiator",
      "Visitor is in a comparison or evaluation phase — scanning features, pricing, and case studies",
      "Brand positioning is 'structured, proven, reliable' rather than energetic startup",
      "Blueprint is structured_saas or the tenant runs a content-index-heavy product site",
      "Visitor arrives from a content-driven referral (blog, documentation, newsletter)",
    ],
    disqualifiers: [
      "Consumer brand or high-energy campaign requiring vivid, rounded, marketing energy",
      "Dark-mode AI or developer platform where the amber-on-white palette undercuts the premium signal",
      "Luxury positioning where warm stone reads as 'professional' rather than 'exclusive'",
      "Recruitment or wellness context where the editorial structure feels too corporate",
    ],
  },

  // ── Client-type blueprints ────────────────────────────────────────────────

  "werkenbij-blueprint": {
    label:       "Werkenbij Blueprint",
    summary:     "Warm amber-orange on off-white with soft rounded corners — the human, approachable aesthetic of employer-brand and careers sites that lead with culture over conversion.",
    personality: "warm, human, approachable, energetic, people-first",
    bestForSources: ["linkedin", "direct", "email", "referral"],
    bestForFunnel:  ["awareness", "consideration"],
    intendedUse:    ["werkenbij sites", "employer branding", "careers pages", "recruitment marketing", "HR platforms"],
    contextualFit:  [
      "Tenant is deploying a werkenbij or employer-brand site",
      "Visitor arrives from LinkedIn or a job board with a careers context",
      "Session context suggests talent acquisition or candidate evaluation",
      "Blueprint careers_platform is active and the audience is candidate-facing",
    ],
    disqualifiers: [
      "B2B or enterprise corporate context where amber reads as too informal",
      "SaaS product site where product clarity and precision matter more than warmth",
      "Luxury or premium positioning context",
      "High-urgency conversion page where soft radius and warm palette reduce intent signal",
    ],
  },

  "corporate-b2b-blueprint": {
    label:       "Corporate B2B Blueprint",
    summary:     "Deep corporate blue with sharp edges and cool slate neutrals — the authoritative, trust-first aesthetic for professional services, consultancy, and B2B enterprise sites.",
    personality: "authoritative, trustworthy, professional, precise, structured",
    bestForSources: ["linkedin", "direct", "referral", "google"],
    bestForFunnel:  ["consideration", "decision"],
    intendedUse:    ["professional services", "management consulting", "B2B enterprise", "financial services", "legal"],
    contextualFit:  [
      "Visitor arrives from LinkedIn with a professional or senior executive context",
      "Company industry signal is consultancy, financial services, or enterprise B2B",
      "ABM-matched visitor from a corporate or institutional account",
      "UTM campaign references a case study, whitepaper, or RFP context",
      "Blueprint corporate_b2b is the active client-type configuration",
    ],
    disqualifiers: [
      "Startup or growth-hacking context where blue authority reads as stuffy",
      "Consumer brand, lifestyle, or entertainment context",
      "Healthcare-specific context where teal/calm palette is more appropriate",
      "Careers / werkenbij context where warmth and approachability are primary signals",
    ],
  },

  "saas-blueprint": {
    label:       "SaaS Blueprint",
    summary:     "Confident violet on near-white with sharp edges — the product-led visual language for B2B SaaS platforms that lead with capability, trial, and modern tooling.",
    personality: "modern, product-confident, sharp, clean, conversion-focused",
    bestForSources: ["google", "direct", "referral"],
    bestForFunnel:  ["awareness", "consideration", "decision"],
    intendedUse:    ["B2B SaaS", "product-led growth platforms", "developer tooling", "HR-tech", "marketing technology"],
    contextualFit:  [
      "Tenant is deploying a B2B SaaS or product-led marketing site",
      "Visitor arrives via organic search with a software or SaaS comparison keyword",
      "Referrer is a SaaS comparison site (G2, Capterra) or product review publication",
      "UTM campaign references a product tour, free trial, or self-serve onboarding",
      "Blueprint saas_product is active and the audience evaluates product vs. vendor",
    ],
    disqualifiers: [
      "Enterprise services site where violet reads as too startup / product-forward",
      "Healthcare or clinical context requiring calm functional signals",
      "Luxury or editorial positioning where violet undercuts the premium aesthetic",
      "Careers / employer-brand site where warmth matters more than product sharpness",
    ],
  },

} as const satisfies Record<ThemePresetKey, ThemeDecisionMeta>;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the ThemeDecisionMeta for a given preset key, or undefined if not
 * found.  (All keys should be present — this is a safe accessor for callers
 * that work with dynamic values.)
 */
export function getThemeMeta(key: ThemePresetKey): ThemeDecisionMeta {
  return THEME_DECISION_META[key];
}

/**
 * Returns an array of all ThemeDecisionMeta entries, sorted by label.
 * Useful for rendering theme candidates in the system prompt.
 */
export function getAllThemeMeta(): Array<{ key: ThemePresetKey; meta: ThemeDecisionMeta }> {
  return ALLOWED_THEME_KEYS.map((key) => ({ key, meta: THEME_DECISION_META[key] }));
}

/**
 * Returns a filtered subset of themes that are appropriate for a given traffic
 * source.  Used to reduce the number of theme candidates in the system prompt
 * when the source is strongly suggestive of a theme family.
 *
 * Returns all themes if no source is provided or if fewer than 3 themes match.
 */
export function getThemeMetaForSource(
  source: string,
): Array<{ key: ThemePresetKey; meta: ThemeDecisionMeta }> {
  const all = getAllThemeMeta();
  const matching = all.filter(({ meta }) =>
    meta.bestForSources.includes(source),
  );
  return matching.length >= 3 ? matching : all;
}
