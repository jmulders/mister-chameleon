/**
 * Tenant Configuration Types
 *
 * A TenantConfig describes a single deployment of the platform — which
 * CMS backend to use, which decision provider to run, and which features
 * are active. The resolver (resolve-tenant.ts) selects the right config
 * from the incoming request hostname; the rest of the app treats the
 * resolved config as read-only truth for the lifetime of that request.
 *
 * ─── Module structure ────────────────────────────────────────────────────────
 *
 *   types.ts                  ← YOU ARE HERE — shared type definitions
 *   mister-chameleon-config.ts ← default MC tenant (only tenant today)
 *   resolve-tenant.ts          ← hostname → TenantConfig resolver
 *   get-active-tenant.ts       ← Next.js request-aware convenience wrapper
 *   index.ts                   ← barrel re-export
 *
 * ─── Extending for a second tenant ──────────────────────────────────────────
 *
 *   1. Create tenant/<new-tenant>-config.ts using TenantConfig as the type.
 *      Start from the TENANT_DEFAULTS in tenant/templates/base-template.ts.
 *   2. Register its hostnames in TENANT_REGISTRY (resolve-tenant.ts).
 *   3. Done — no other files change.
 *
 * ─── New platform fields (all optional / backward-compatible) ────────────────
 *
 *   contact        — contact form settings and n8n webhook override
 *   variants       — which variant keys this tenant's CMS has content for
 *   blocks         — which page section blocks are active
 *   pages          — which adaptive page types are enabled
 */

import type { TenantTheme } from "@/design-system/theme/tenant-theme";

// Re-export so consumers can import TenantTheme from "@/tenant" directly.
export type { TenantTheme };

// ── Provider names ─────────────────────────────────────────────────────────────
//
// Defined here rather than imported from the CMS/decision modules so that
// @/tenant stays self-contained and avoids circular dependencies.
//
// Keep these in sync with:
//   cms/providers/create-cms-provider.ts  → CMSProviderName
//   decision/providers/                   → DecisionProviderName

/**
 * Which CMS backend the tenant uses.
 *
 * "sanity"     — Sanity.io (requires SANITY_PROJECT_ID env var)
 * "storyblok"  — Storyblok CDN (requires STORYBLOK_ACCESS_TOKEN env var)
 * "statamic"   — Statamic CMS (requires STATAMIC_API_URL env var)
 * "mock"       — In-memory mock (development, preview, tests)
 */
export type CMSProviderName = "sanity" | "storyblok" | "statamic" | "mock";

/**
 * Which decision engine the tenant uses for experience selection.
 *
 * "rules" — static ordered rule set (MVP default, zero latency cost)
 * "ai"    — abstract AI base; subclass AiDecisionProvider to implement
 *            (requires confidence policy config + fallback rules provider)
 */
export type DecisionProviderName = "rules" | "ai";

// ── Feature flags ──────────────────────────────────────────────────────────────

/**
 * Boolean feature flags scoped to a single tenant deployment.
 *
 * All flags default to their safest / most conservative state when a
 * tenant config is absent. New flags should be added here with a comment
 * explaining the safe default value.
 */
export interface TenantFeatureFlags {
  /**
   * Show the diagnostics overlay bar in the browser.
   * Safe default: false (never show in production).
   * Typically driven by NODE_ENV === "development".
   */
  diagnosticsBar: boolean;

  /**
   * Render and accept submissions from the contact form.
   * Safe default: true.
   * Set false to suppress the contact form for tenants that route leads
   * through a different channel (e.g. HubSpot embed, Calendly direct link).
   */
  contactForm?: boolean;

  /**
   * Enable the A/B experiment layer (ExperimentDecisionProvider decorator).
   * Safe default: false.
   * When true, the runtime checks the experiments table on every request.
   * Leave false until the tenant has an active experiment to avoid the DB
   * round-trip cost.
   */
  abTesting?: boolean;

  /**
   * Enable the AI decision provider (AiDecisionProvider abstract class).
   * Safe default: false.
   * When true, decisionProvider must be set to "ai" and the subclass must
   * be wired into the page.  Requires confidence policy configuration.
   */
  aiDecisionProvider?: boolean;
}

// ── Contact configuration ─────────────────────────────────────────────────────

/**
 * Contact form and n8n orchestration settings for a tenant.
 *
 * When absent, the global N8N_CONTACT_WEBHOOK_URL environment variable is used.
 * When present, the tenant-level webhookUrl overrides it — useful for multi-tenant
 * deployments where each client has their own n8n workflow.
 */
export interface TenantContactConfig {
  /**
   * Whether POST /api/contact accepts submissions for this tenant.
   * When false, the API returns 404 so client code should hide the form.
   */
  enabled: boolean;

  /**
   * Tenant-specific n8n webhook URL.
   *
   * When set, this URL is used instead of the N8N_CONTACT_WEBHOOK_URL env var.
   * Useful when each client has a separate n8n instance or workflow.
   *
   * Stored here (not in env vars) to allow per-tenant override at runtime
   * without deploying separate environment configs.
   *
   * Security: this is a server-only value — never exposed to the client.
   */
  webhookUrl?: string;
}

// ── Variant configuration ─────────────────────────────────────────────────────

/**
 * Declares which adaptive variant keys a tenant's CMS has content for.
 *
 * When specified, this acts as the authoritative list of variant keys that
 * the decision engine may serve for this tenant. Keys outside this list
 * should not be returned by the decision provider for this tenant.
 *
 * When absent, all variant keys defined in the platform types are assumed
 * to have CMS content — appropriate for the platform owner (Mister Chameleon)
 * but not for clients who may only need a subset.
 *
 * Key naming: must match the string literals in HeroVariantKey, ProofVariantKey,
 * and CTAVariantKey in decision/types.ts.
 */
export interface TenantVariantConfig {
  /** Hero variant keys with CMS content, e.g. ["hero_google_problem", "hero_direct_brand"] */
  hero: string[];
  /** Proof variant keys with CMS content, e.g. ["proof_cases", "proof_platform"] */
  proof: string[];
  /** CTA variant keys with CMS content, e.g. ["cta_meeting", "cta_platform"] */
  cta: string[];
}

// ── Block configuration ───────────────────────────────────────────────────────

/**
 * Which adaptive page section blocks are active for this tenant.
 *
 * All three blocks are enabled by default. Set a block to false to suppress
 * it from the page layout — useful if a client's design doesn't include a
 * social proof section, for example.
 */
export interface TenantBlockConfig {
  /** Whether the hero section (headline + subheadline + CTA) is rendered */
  hero: boolean;
  /** Whether the social proof / evidence section is rendered */
  proof: boolean;
  /** Whether the standalone CTA block is rendered */
  cta: boolean;
}

// ── Page configuration ────────────────────────────────────────────────────────

/**
 * Which page types the adaptive platform is active for.
 *
 * Currently only the homepage is supported. This shape is forward-looking —
 * future pages (pricing, about, blog) will be added as additional boolean keys
 * here as the platform expands beyond the homepage.
 */
export interface TenantPageConfig {
  /** Whether the homepage adaptive pipeline is active */
  homepage: boolean;
}

// ── Root TenantConfig ──────────────────────────────────────────────────────────

/**
 * The complete configuration object for a single tenant deployment.
 *
 * ─── Field summary ────────────────────────────────────────────────────────────
 *
 *   tenantId            Stable lowercase slug.  Used in logs and analytics.
 *   name                Human-readable display name.
 *   canonicalHostname   The primary production hostname, e.g. "misterchameleon.com".
 *                       Used for OG tags, canonical <link> elements, and sitemaps.
 *                       Does NOT include protocol or port.
 *   cmsProvider         Which CMS backend to instantiate.
 *   decisionProvider    Which decision engine to instantiate.
 *   features            Boolean capability flags checked at render time.
 *
 * ─── Stability contract ───────────────────────────────────────────────────────
 *
 *   Adding new optional fields is non-breaking.
 *   Removing or renaming existing fields is a breaking change — update all
 *   tenant config files before merging.
 */
export interface TenantConfig {
  /**
   * Stable, URL-safe, lowercase identifier.
   * Examples: "mister-chameleon", "acme-corp", "demo-staging"
   */
  tenantId: string;

  /**
   * Human-readable display name shown in admin UIs and log annotations.
   * Example: "Mister Chameleon"
   */
  name: string;

  /**
   * Primary production hostname — no protocol, no trailing slash.
   * Used for absolute URL construction and canonical link generation.
   * Example: "misterchameleon.com"
   *
   * Not used for resolver matching directly — that is handled by the
   * TENANT_REGISTRY map in resolve-tenant.ts, which supports multiple
   * hostnames per tenant (www, staging, localhost, etc.).
   */
  canonicalHostname: string;

  /**
   * Which CMS backend this tenant uses.
   * Consumed by createCMSProvider() (integration: see resolve-tenant.ts).
   */
  cmsProvider: CMSProviderName;

  /**
   * Which decision engine this tenant uses.
   * Consumed by createDecisionProvider() (integration: see resolve-tenant.ts).
   */
  decisionProvider: DecisionProviderName;

  /**
   * Feature flags. Checked at render time by page components and API routes.
   */
  features: TenantFeatureFlags;

  /**
   * Visual identity and brand theme for this tenant.
   *
   * Consumed by tenantThemeToCSS() in the root layout to inject CSS custom
   * property overrides that govern colours, radius, and brand metadata for
   * the duration of every request. All components inherit these values via
   * the CSS variable cascade — no component code changes when the theme
   * changes.
   *
   * See design-system/theme/tenant-theme.ts for the full TenantTheme shape.
   */
  theme: TenantTheme;

  // ── Platform extension fields (all optional — backward-compatible) ──────────

  /**
   * Contact form and n8n orchestration settings.
   *
   * When absent, the contact form is enabled and uses N8N_CONTACT_WEBHOOK_URL.
   * Populate to disable the form, or to override the webhook URL per-tenant.
   */
  contact?: TenantContactConfig;

  /**
   * Declares which variant keys this tenant's CMS has content for.
   *
   * When absent, all platform variant keys are assumed to have content.
   * Set for clients who populate only a subset (e.g. no LinkedIn variant).
   */
  variants?: TenantVariantConfig;

  /**
   * Which page section blocks are active.
   *
   * When absent, all three blocks (hero, proof, cta) are rendered.
   * Set to suppress blocks this tenant's design doesn't include.
   */
  blocks?: TenantBlockConfig;

  /**
   * Which adaptive page types are enabled for this tenant.
   *
   * When absent, the homepage pipeline is assumed active.
   * Explicit config is required as multi-page support expands.
   */
  pages?: TenantPageConfig;

  /**
   * Tenant-level AI decision layer settings.
   *
   * When absent, the AI layer is configured entirely from environment
   * variables (see ai/config.ts — MC_HOMEPAGE_DECISION_PROVIDER,
   * SHADOW_AI_ENABLED, etc.).
   *
   * When present, these settings override the env-based config for this
   * specific tenant — enabling per-tenant provider selection, model
   * pinning, and optional API key management without changing shared env vars.
   *
   * Override precedence (highest → lowest):
   *   1. tenant.ai.liveProvider / shadowProvider (provider name + model)
   *   2. tenant.ai.liveProvider.apiKey / shadowProvider.apiKey (API key)
   *   3. Environment variables (ANTHROPIC_API_KEY, MC_HOMEPAGE_DECISION_PROVIDER…)
   *
   * ─── Security ───────────────────────────────────────────────────────────────
   *
   *   apiKey fields within liveProvider/shadowProvider are server-only values.
   *   They must never be serialised to a client-side response or logged.
   *   Treat this field as a server secret — never import TenantConfig into
   *   a client component or expose it through a public API route.
   */
  ai?: TenantAiSettings;
}

// ═════════════════════════════════════════════════════════════════════════════
// Package & settings model
//
// The types below define the commercial / subscription layer on top of the
// deployment config above.  They are the building blocks for:
//
//   tenant/packages.ts     — starter / growth / pro package definitions
//
// Design intent:
//   - TenantSettings is the high-level entitlement model (what a tenant is
//     *allowed* to use based on their package).
//   - TenantConfig (above) is the runtime deployment config (how a specific
//     deployment is actually wired up).
//   - The two live side-by-side: packages gate what is possible; TenantConfig
//     expresses what has been configured within those gates.
// ═════════════════════════════════════════════════════════════════════════════

// ── Package key ───────────────────────────────────────────────────────────────

/**
 * The three subscription tiers available on the platform.
 *
 *   starter — core adaptive blocks, no experiments, no AI
 *   growth  — full block set, experiments enabled, analytics, no AI
 *   pro     — everything: experiments + AI shadow/live + full analytics
 */
export type PackageKey = "starter" | "growth" | "pro";

// ── Block key vocabularies ────────────────────────────────────────────────────

/**
 * The decision-engine controlled (adaptive) blocks on the homepage.
 *
 * Each value maps to a slot in the ExperiencePlan produced by the decision
 * provider.  Packages gate which slots a tenant may activate.
 *
 *   hero   — headline + sub-headline section
 *   proof  — social proof / trust signals section
 *   cta    — primary call-to-action section
 */
export type ContextBlockKey = "hero" | "proof" | "cta";

/**
 * CMS-authored page section block types.
 *
 * Each value matches the `_type` discriminator in the CMS type system and
 * corresponds to a rendered component in `app/page.tsx`.
 *
 * ─── Text ────────────────────────────────────────────────────────────────────
 *   textSection        — heading + rich-text body (PortableText)
 *   richText           — pure rich-text body only; no heading wrapper
 *
 * ─── Media ───────────────────────────────────────────────────────────────────
 *   image              — single image with optional caption
 *   video              — embedded or native video (YouTube / Vimeo / native)
 *   slider             — image/content carousel
 *
 * ─── Social proof ────────────────────────────────────────────────────────────
 *   testimonialSection — customer quotes / testimonials
 *   quote              — pull-quote / block-quote with attribution
 *   logoStrip          — horizontal strip of client/partner logos
 *   stats              — key metrics / headline numbers
 *
 * ─── Features / content ──────────────────────────────────────────────────────
 *   featureGrid        — icon + label feature grid
 *   faqSection         — collapsible FAQ entries
 *   about              — about / team section with optional bios
 *   newsList           — recent news or blog-post teasers
 *   caseHighlight      — client case-study highlight with metrics
 *
 * ─── Listing / detail (blog + vacancy) ───────────────────────────────────────
 *   listing            — generic item listing (blog posts, vacancies, news);
 *                        reusable across overview pages of any content type
 *   articleBody        — long-form prose body for articles and detail pages
 *   articleMeta        — editorial metadata (author, date, tags, reading time)
 *   relatedContent     — related item teasers rendered at the end of a detail page
 *   vacancyMeta        — structured metadata for a job vacancy (location,
 *                        contract type, salary range, closing date, etc.)
 *   applyPanel         — application CTA panel for vacancy detail pages;
 *                        can link to a form block or an external ATS
 *   filterBar          — interactive search / filter bar for listing pages
 *   searchResults      — dynamic result container rendered alongside filterBar;
 *                        internal rendering concept — NOT a tenant-facing key;
 *                        do not add to VALID_CONTENT_BLOCKS or admin UI lists
 *
 * ─── Conversion ──────────────────────────────────────────────────────────────
 *   ctaSection         — full-width call-to-action banner
 *
 * ─── Forms ───────────────────────────────────────────────────────────────────
 *   formSection        — reusable form (contact, application, etc.)
 *                        CMS places the form by formKey; platform drives behaviour
 *
 * ─── Search ──────────────────────────────────────────────────────────────────
 *   search             — full-text search input + inline results;
 *                        scoped by content type (pages, posts, vacancies);
 *                        provider-agnostic — wired to a SearchProvider at the
 *                        edge via /api/search
 */
export type ContentBlockKey =
  // text
  | "textSection"
  | "richText"
  // media
  | "image"
  | "video"
  | "slider"
  // social proof
  | "testimonialSection"
  | "quote"
  | "logoStrip"
  | "stats"
  // features / content
  | "featureGrid"
  | "faqSection"
  | "about"
  | "newsList"
  | "caseHighlight"
  // listing / detail
  | "listing"
  | "articleBody"
  | "articleMeta"
  | "relatedContent"
  | "vacancyMeta"
  | "applyPanel"
  | "filterBar"
  // searchResults is an internal rendering concept (paired with filterBar);
  // NOT a tenant-facing configuration key — excluded from VALID_CONTENT_BLOCKS,
  // admin UI, and package entitlements.  Kept here because ContentBlockType
  // (page-config) is an alias of ContentBlockKey and the renderer needs it.
  | "searchResults"
  // conversion
  | "ctaSection"
  // forms
  | "formSection"
  // search
  | "search"
  // careers / W6
  | "processSteps"
  | "recruiterPanel";

/**
 * The combined block entitlement for a tenant.
 *
 * `context` is the allow-list of adaptive slots the decision engine may
 * populate for this tenant.  `content` is the allow-list of CMS section
 * types an editor may create.
 *
 * Both are treated as strict allow-lists: a block not present in the list
 * must not be rendered, regardless of what the CMS or rules engine returns.
 */
export interface TenantBlocks {
  readonly context: readonly ContextBlockKey[];
  readonly content: readonly ContentBlockKey[];
}

// ── Feature entitlements ──────────────────────────────────────────────────────

/**
 * Platform feature entitlements for a tenant.
 *
 * These are package-level capabilities — they describe what a tenant *may*
 * use, not what is currently switched on.  Runtime flags live in
 * `TenantFeatureFlags` (above); the package gates what those flags can be.
 *
 *   experiments — A/B testing via the ExperimentDecisionProvider
 *   ai          — AI decision layer (shadow or live; requires ai.mode != "disabled")
 *   analytics   — event tracking and served-variant logging to the DB
 */
export interface TenantFeatures {
  readonly experiments: boolean;
  readonly ai:          boolean;
  readonly analytics:   boolean;
}

// ── AI settings ───────────────────────────────────────────────────────────────

/**
 * The AI provider identifiers that can be configured at the tenant level.
 *
 * Extends the platform's core runtime providers ("claude" | "openai") with
 * forward-declared identifiers that can be stored in tenant settings before
 * the runtime implementation is available.
 *
 *   claude  — Anthropic Claude (implemented; requires ANTHROPIC_API_KEY or tenant apiKey)
 *   openai  — OpenAI GPT       (implemented; requires OPENAI_API_KEY or tenant apiKey)
 *   gemini  — Google Gemini    (forward-declared; runtime implementation pending)
 */
export type TenantAiProviderName = "openai" | "claude" | "gemini";

/**
 * Per-slot provider configuration stored within TenantAiSettings.
 *
 * Allows per-tenant provider selection, model pinning, and an optional API
 * key override — useful when a client brings their own key rather than
 * sharing the platform's key.
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   apiKey is a server-only value.  It must never be serialised to a
 *   client-side response, included in a JSON API reply, or logged.
 *   When present it overrides the platform env var (ANTHROPIC_API_KEY,
 *   OPENAI_API_KEY, etc.) for this tenant only.
 *
 *   model is an optional override for the model identifier.
 *   When absent the platform default for the chosen provider is used
 *   (e.g. "claude-3-5-haiku-20241022" for Claude, "gpt-4o-mini" for OpenAI).
 */
export interface TenantAiProviderConfig {
  readonly name:    TenantAiProviderName;
  readonly apiKey?: string;
  readonly model?:  string;
}

/**
 * AI decision layer configuration for a tenant.
 *
 * Maps to the `AiMode` runtime type in `@/ai/config` — redeclared here to
 * keep `@/tenant` free of circular dependencies with the `@/ai` module.
 *
 * ─── Mode semantics ───────────────────────────────────────────────────────────
 *
 *   disabled — no AI call; rules engine is the sole decision source
 *   shadow   — AI runs in parallel; result is logged but never served to visitors
 *   live     — AI may override the rules plan when confidence ≥ threshold
 *
 * ─── Provider slots ───────────────────────────────────────────────────────────
 *
 *   liveProvider   — the provider to use when mode === "live".
 *                    When absent, the platform falls back to env var config.
 *   shadowProvider — the provider to use when mode === "shadow".
 *                    When absent, the platform falls back to env var config.
 *
 *   Specifying a provider slot is optional even when that slot is active —
 *   the platform env vars (MC_HOMEPAGE_DECISION_PROVIDER, SHADOW_AI_PROVIDER)
 *   serve as the fallback.
 *
 * `confidenceThreshold` overrides the platform default (0.70) when set.
 * Only relevant when mode is "live".
 */
export interface TenantAiSettings {
  readonly mode:                 "disabled" | "shadow" | "live";
  readonly liveProvider?:        TenantAiProviderConfig;
  readonly shadowProvider?:      TenantAiProviderConfig;
  readonly confidenceThreshold?: number;
}

// ── CMS settings ──────────────────────────────────────────────────────────────

/**
 * CMS integration settings expressed at the settings/entitlement level.
 *
 * Uses `CMSProviderName` (declared above) as the provider discriminator so
 * the two type families stay consistent.
 *
 * `projectId` and `dataset` are provider-specific credential references —
 * their meaning depends on the chosen provider:
 *
 *   sanity     — Sanity project ID + dataset name
 *   storyblok  — Space ID + environment name
 *   statamic   — Site ID + collection name
 *   mock       — ignored
 */
export interface TenantCmsSettings {
  readonly provider:    CMSProviderName;
  readonly projectId?:  string;
  readonly dataset?:    string;
  /**
   * Write token for the CMS provider (e.g. Sanity write token).
   * Used by the provisioner to create/replace documents for this tenant.
   *
   * ─── Security ────────────────────────────────────────────────────────────────
   *
   *   Server-only.  MUST NEVER be serialised to a client-side response or logged.
   *   The admin page strips this field before passing TenantSettings to any
   *   client component and shows only a boolean "configured" hint in its place.
   *
   *   When present, takes precedence over the platform-level
   *   SANITY_API_WRITE_TOKEN / SANITY_WRITE_TOKEN environment variables.
   */
  readonly writeToken?: string;
}

// ── Design settings ───────────────────────────────────────────────────────────

/**
 * Named theme keys representing pre-built visual design configurations.
 *
 * Package tiers gate which themes are available.  Custom themes require
 * the "pro" tier.
 *
 *   default  — platform standard theme (indigo-violet, balanced radius)
 *   minimal  — reduced visual weight; neutral palette, sharp radius
 *   bold     — high-contrast, expressive brand colour, soft radius
 *   custom   — fully bespoke TenantTheme object; pro tier only
 */
export type ThemeKey = "default" | "minimal" | "bold" | "custom";

/**
 * Fine-grained CSS token overrides applied on top of the active theme preset.
 *
 * These are set via the design token upload on the admin tenant detail page
 * and take higher priority than the preset values in the resolver.
 *
 * ─── Legacy flat fields ───────────────────────────────────────────────────────
 *
 *   radiusInteractive / radiusCard / radiusPopover — kept for backward compat
 *   with token files uploaded before the grouped format was introduced.
 *
 * ─── Grouped token fields ─────────────────────────────────────────────────────
 *
 *   Each group holds an open Record<string, string> validated against the
 *   per-group allowlist defined in design-token-validator.ts.  The resolver
 *   (resolve-theme.ts) maps the keys to CSS custom properties.
 *
 * When both a legacy flat field and its grouped equivalent are present (e.g.
 * radiusInteractive and radius.interactive) the grouped value wins because the
 * resolver applies grouped overrides after legacy ones.
 */
export interface TenantTokenOverrides {
  // ── Legacy flat radius fields (kept for backward compatibility) ─────────────

  /** CSS value for --radius-interactive (buttons, inputs, badges), e.g. "4px", "0.5rem" */
  readonly radiusInteractive?: string;
  /** CSS value for --radius-card (cards, panels, modals), e.g. "8px", "1rem" */
  readonly radiusCard?: string;
  /** CSS value for --radius-popover (dropdowns, tooltips, menus), e.g. "6px" */
  readonly radiusPopover?: string;

  // ── Grouped token overrides (new) ───────────────────────────────────────────

  /**
   * Color token overrides.  Keys map to CSS custom properties following the
   * shadcn/ui convention, e.g. primary → --primary, --ring, --text-brand.
   */
  readonly color?: Readonly<Record<string, string>>;

  /**
   * Typography token overrides.  fontSans → --font-sans, fontMono → --font-mono,
   * fontSerif → --font-serif; other keys map to --typography-{kebab-key}.
   */
  readonly typography?: Readonly<Record<string, string>>;

  /**
   * Radius token overrides (granular).  interactive → --radius-interactive,
   * card → --radius-card, popover → --radius-popover; other keys map to
   * --radius-{kebab-key}.  Takes precedence over the legacy radius flat fields.
   */
  readonly radius?: Readonly<Record<string, string>>;

  /** Spacing token overrides.  Keys map to --spacing-{kebab-key}. */
  readonly spacing?: Readonly<Record<string, string>>;

  /** Border token overrides.  Keys map to --border-{kebab-key}. */
  readonly border?: Readonly<Record<string, string>>;

  /** Shadow token overrides.  Keys map to --shadow-{kebab-key}. */
  readonly shadow?: Readonly<Record<string, string>>;

  /** Motion token overrides (durations, easings).  Keys map to --motion-{kebab-key}. */
  readonly motion?: Readonly<Record<string, string>>;

  /** Component token overrides.  Keys map to --component-{kebab-key}. */
  readonly component?: Readonly<Record<string, string>>;
}

/**
 * Visual design settings for a tenant at the settings/entitlement level.
 *
 * `theme` must be a member of the tenant's package's `allowedThemes` list.
 *
 * `primaryColor` and `primaryFont` are optional CSS-value overrides applied
 * on top of the chosen base theme.  They follow standard CSS syntax:
 *   primaryColor — any valid CSS `<color>` value, e.g. "#e63946" or "hsl(354,73%,56%)"
 *   primaryFont  — any valid CSS `font-family` stack, e.g. "'Inter', sans-serif"
 *
 * `tokenOverrides` carries fine-grained per-token overrides (e.g. radius values)
 * that are set via the design token upload and not exposed in the main settings
 * form.  They are applied after the preset and primaryColor/primaryFont.
 */
export interface TenantDesignSettings {
  readonly theme:           ThemeKey;
  readonly primaryColor?:   string;
  readonly primaryFont?:    string;
  /**
   * Fine-grained CSS token overrides set via the design token upload.
   * Applied on top of the preset — highest specificity in the theme cascade.
   */
  readonly tokenOverrides?: TenantTokenOverrides;
}

// ── Top-level TenantSettings ──────────────────────────────────────────────────

/**
 * The high-level entitlement and settings object for a single tenant.
 *
 * ─── TenantSettings vs TenantConfig ──────────────────────────────────────────
 *
 *   TenantConfig (above) answers: "How is this deployment wired up?"
 *   TenantSettings answers:       "What is this tenant entitled to use?"
 *
 *   A tenant's settings are typically derived by merging the base
 *   PackageDefinition (from packages.ts) with any tenant-specific overrides
 *   agreed at onboarding.
 *
 * ─── Fields ───────────────────────────────────────────────────────────────────
 *
 *   tenantId          — stable URL-safe lowercase slug, e.g. "acme-corp"
 *   name              — human-readable display name, e.g. "Acme Corp"
 *   slug              — editable public identifier for URL routing, e.g. "acme"
 *   primaryDomain     — primary production hostname for domain-based routing
 *   additionalDomains — secondary hostnames (www, staging, etc.)
 *   packageKey        — which tier the tenant is subscribed to
 *   features          — which platform features are entitled (derived from package)
 *   blocks            — which blocks are entitled (derived from package)
 *   ai                — AI layer settings specific to this tenant
 *   cms               — CMS integration settings specific to this tenant
 *   design            — visual design settings for this tenant
 *   cmsProvisionedAt  — ISO 8601 timestamp of the last successful CMS provisioning
 *                       run.  Set by provisionSiteAction; absent when the tenant
 *                       has not yet been provisioned into the CMS.
 */
export interface TenantSettings {
  readonly tenantId:          string;

  // ── Identity fields ────────────────────────────────────────────────────────
  //
  // These fields separate the stable internal identity (tenantId) from the
  // editable public-facing identity (name, slug, domains).  Changing a tenant's
  // name or slug does not affect any stored data keyed on tenantId.

  /**
   * Human-readable display name for this tenant.
   * Example: "Acme Corp", "WorkEngine"
   *
   * Used in admin UIs, page titles, and CMS content labels.
   * Does not affect routing or internal identifiers.
   */
  readonly name?: string;

  /**
   * Editable public slug — URL-safe lowercase identifier used for routing.
   *
   * Constraints:
   *   • lowercase letters, digits, and hyphens only
   *   • must start and end with a letter or digit
   *   • Example: "acme", "work-engine", "client-demo-2025"
   *
   * Unlike tenantId, slug may be changed after creation.  Used in URL paths
   * and as a human-readable alternative to the tenantId in dev overrides.
   */
  readonly slug?: string;

  /**
   * Primary production hostname for domain-based tenant resolution.
   *
   * Format: hostname only — no protocol, no trailing slash.
   * Example: "acme.com", "app.workengine.io"
   *
   * When set, `getActiveTenant()` will match requests for this hostname to this
   * tenant even if the hostname is not in the static TENANT_REGISTRY.  This
   * allows admin-provisioned tenants to be routed without code deploys.
   */
  readonly primaryDomain?: string;

  /**
   * Additional hostnames for this tenant (www, staging, preview, etc.).
   *
   * Same format as primaryDomain.  All listed hostnames will resolve to this
   * tenant in `getActiveTenant()`.
   * Example: ["www.acme.com", "staging.acme.com"]
   */
  readonly additionalDomains?: readonly string[];

  readonly packageKey:        PackageKey;
  readonly features:          TenantFeatures;
  readonly blocks:            TenantBlocks;
  readonly ai:                TenantAiSettings;
  readonly cms:               TenantCmsSettings;
  readonly design:            TenantDesignSettings;

  /**
   * ISO 8601 timestamp (UTC) of the most recent successful CMS provisioning run.
   *
   * Set automatically by `provisionSiteAction` after the homepage page document
   * and starter content have been written to Sanity.  Absent when the site has
   * not yet been provisioned.
   *
   * Used by SiteBuilderReadiness to surface "CMS content provisioned" status and
   * by the admin panel to show when the last provisioning occurred.
   */
  readonly cmsProvisionedAt?: string;
}
