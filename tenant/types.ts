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
import type { BlockTokenSet, CuratedBlockTokens } from "@/design-system/theme/block-token-set";
import type { BlockMedia } from "@/lib/media/block-media";

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
 * "platform"   — Built-in platform CMS stored in Supabase (no external CMS needed)
 */
export type CMSProviderName = "sanity" | "storyblok" | "statamic" | "mock" | "platform";

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

// ── Form submission settings ───────────────────────────────────────────────────

/**
 * Tenant-level configuration for all form submissions (`/api/forms/[formKey]`).
 *
 * These settings are stored per-tenant in the `tenant_form_settings` Supabase table
 * and loaded at request time by the form submission handler.  They override the
 * defaults coming from the form definition and the environment variables.
 *
 * Resolution priority (highest → lowest):
 *   1. TenantFormSettings (this — per-tenant, stored in DB)
 *   2. FormDefinition.action / FormEmailRouting (per-form, hardcoded)
 *   3. Environment variables (BACKOFFICE_EMAIL, RESEND_API_KEY, …)
 *
 * ─── Stored in DB, not in code ────────────────────────────────────────────────
 *
 *   Unlike TenantConfig (which lives in mister-chameleon-config.ts), these
 *   settings are edited by tenant admins at runtime through the admin UI
 *   at /admin/tenants/[tenantId]/content/forms.  No deployment is required to change them.
 */
export interface TenantFormSettings {
  /**
   * Whether to store form submissions in the `form_submissions` database table.
   * Turning this off disables DB writes but email/webhook still fire.
   * @default true
   */
  storeSubmissions: boolean;

  /**
   * Email addresses that receive a backoffice notification on every submission.
   *
   * When empty, falls back to the `BACKOFFICE_EMAIL` environment variable.
   * Multiple recipients are supported.
   *
   * @default []  (falls back to BACKOFFICE_EMAIL env var)
   */
  notificationRecipients: string[];

  /**
   * Optional reply-to address for backoffice notification emails.
   *
   * When set, recipients can reply directly to this address instead of the From
   * address. Useful for routing replies to a monitored inbox (e.g. a support
   * alias) rather than the transactional sender address.
   */
  replyTo?: string;

  /**
   * Whether to send a confirmation email to the submitter.
   * The submitter's address is resolved from the submission's email field.
   * @default true
   */
  sendConfirmationEmails: boolean;

  /**
   * Optional webhook URL.
   * When set, the submission handler POSTs a JSON payload to this URL after
   * validation.  This enables custom workflows (n8n, Zapier, HubSpot, etc.).
   * Payload shape: `{ formKey: string; values: Record<string, string> }`
   */
  webhookUrl?: string;

  /**
   * Optional HubSpot integration.
   * When true, submissions are forwarded to HubSpot via the Forms API.
   * Requires `HUBSPOT_PORTAL_ID` and `HUBSPOT_FORM_GUID` env vars to be set.
   * @default false
   */
  hubspotEnabled?: boolean;

  /**
   * Global success message override — shown to the submitter after a successful
   * submission.  When absent, each form definition's `successMessage` is used.
   */
  successMessage?: string;

  /**
   * Optional redirect URL after successful submission.
   * When set, the FormSectionBlock will navigate here instead of showing the
   * inline success message.
   * Must be an absolute URL or a root-relative path ("/thank-you").
   */
  successRedirectUrl?: string;

  /** GDPR: delete submissions older than this many days. null = keep forever. */
  submissionRetentionDays?: number | null;

  /**
   * Cloudflare Turnstile site key — PUBLIC, rendered in the form widget.
   * Safe to expose to the browser. Required (with the secret) for Turnstile.
   */
  turnstileSiteKey?: string;

  /**
   * Cloudflare Turnstile secret key — SERVER ONLY, encrypted at rest (via
   * lib/email-crypto). Used to verify the token against Cloudflare's siteverify.
   */
  turnstileSecretKey?: string;
}

/**
 * Default TenantFormSettings used when no settings have been saved for a tenant.
 * Mirrors the previous hardcoded behaviour (store + notify + confirm).
 */
export const DEFAULT_TENANT_FORM_SETTINGS: TenantFormSettings = {
  storeSubmissions:       true,
  notificationRecipients: [],
  sendConfirmationEmails: true,
};

// ── Per-form override settings ────────────────────────────────────────────────

/**
 * Per-form configuration override for a specific (tenant_id, form_key) pair.
 *
 * Stored in the `tenant_form_overrides` Supabase table as a JSONB `overrides`
 * column.  When `overrideEnabled` is true, these values take precedence over
 * the tenant-level defaults from `TenantFormSettings` for this specific form.
 *
 * ─── Resolution priority (highest → lowest) ────────────────────────────────
 *
 *   1. TenantFormOverrideSettings (this — per-form, when overrideEnabled)
 *   2. TenantFormSettings (tenant-level defaults, tenant_form_settings table)
 *   3. FormDefinition.action (per-form hardcoded code defaults)
 *   4. Environment variables
 *   5. System hardcoded defaults
 *
 * ─── Stored in DB, not in code ─────────────────────────────────────────────
 *
 *   Managed via the admin UI at /admin/tenants/[tenantId]/content/forms/[formKey].
 *   No deployment required to change per-form behaviour.
 */
export interface TenantFormOverrideSettings {
  /**
   * Master toggle.  When false, all other fields in this object are ignored
   * and the tenant-level defaults apply unchanged.
   * @default false
   */
  overrideEnabled: boolean;

  /**
   * Whether to send a backoffice notification for submissions to this form.
   * Overrides the form definition's `notifyBackoffice` flag when `overrideEnabled`.
   * @default true
   */
  notifyEnabled: boolean;

  /**
   * Whether to send a confirmation email to the submitter for this form.
   * Overrides the tenant-level `sendConfirmationEmails` flag when `overrideEnabled`.
   * @default true
   */
  confirmEnabled: boolean;

  /**
   * Whether to store submissions to DB for this form.
   * Overrides the tenant-level `storeSubmissions` flag when `overrideEnabled`.
   * @default true
   */
  storeEnabled: boolean;

  /**
   * Custom notification recipients for this form only.
   * When non-empty and `overrideEnabled`, replaces the tenant-level
   * `notificationRecipients` for this form's backoffice notification.
   * Falls through to tenant recipients when empty.
   * @default []
   */
  customRecipients: string[];

  /**
   * Custom email subject for the backoffice notification for this form.
   * When set and `overrideEnabled`, used instead of the form definition's
   * default subject template.
   */
  customSubject?: string;

  /**
   * Custom "From" display name for emails sent for this form.
   * When set and `overrideEnabled`, used instead of the tenant-level fromName.
   */
  customSenderName?: string;

  /**
   * Whether Cloudflare Turnstile (CAPTCHA) is required for THIS form.
   *
   * Deliberately INDEPENDENT of `overrideEnabled`: unlike the other override
   * fields, this flag is honoured on its own so a single form can require
   * Turnstile without flipping the master override for everything else.
   * Requires the tenant's `turnstileSiteKey` + `turnstileSecretKey` to be set;
   * with no keys configured the flag is a no-op.
   * @default false
   */
  turnstileEnabled: boolean;

  /**
   * Presentation layout for this form (phase 1 of forms-as-adaptive-blocks).
   * Honoured independently of `overrideEnabled` — it only affects arrangement,
   * not the field set or the server contract. Absent → default single column.
   */
  layout?: FormLayout;
}

/**
 * How a form is arranged on the page. Phase 1: a single column, or a split with
 * a contact panel on the left or right. The field set and validation are
 * unchanged — this is presentation only.
 */
export interface FormLayout {
  template: "single" | "split-left" | "split-right";
  contactPanel?: {
    name?:     string;
    role?:     string;
    /** @deprecated Legacy flat image URL. New saves write `media`; kept for backward-compat render. */
    photoUrl?: string;
    /** Shared block media (image / video with facade). Preferred over photoUrl. */
    media?:    BlockMedia;
    phone?:    string;
    email?:    string;
  };
}

/**
 * Default TenantFormOverrideSettings — no override active.
 * Returned when no row exists for the (tenant, form) pair.
 */
export const DEFAULT_FORM_OVERRIDE_SETTINGS: TenantFormOverrideSettings = {
  overrideEnabled: false,
  notifyEnabled:   true,
  confirmEnabled:  true,
  storeEnabled:    true,
  customRecipients: [],
  turnstileEnabled: false,
};

// ── Email transport settings ───────────────────────────────────────────────────

/**
 * Tenant-level email transport configuration.
 *
 * Stored in the `tenant_email_transport` Supabase table.  Controls which
 * transport (SMTP or Resend) is used to send transactional emails for this
 * tenant's form submissions.
 *
 * ─── Priority (highest → lowest) ──────────────────────────────────────────────
 *
 *   1. TenantEmailTransport (this — per-tenant, stored in DB)
 *   2. SMTP_HOST env var → SMTP transport
 *   3. RESEND_API_KEY env var → Resend transport
 *   4. No config → silent skip ("none")
 *
 * ─── Security note ────────────────────────────────────────────────────────────
 *
 *   SMTP credentials (smtpPassword, resendApiKey) should be stored encrypted
 *   in the DB and decrypted in the admin actions layer before use.
 *   The transport layer receives already-decrypted values.
 *
 * ─── Not in CMS ───────────────────────────────────────────────────────────────
 *
 *   Mail transport credentials are sensitive and should never appear in the CMS.
 *   They are managed exclusively via the admin UI at
 *   /admin/tenants/[tenantId]/email-transport and stored in the DB.
 */
export interface TenantEmailTransport {
  /** Which transport mechanism to use for this tenant's outbound email. */
  transportType: "resend" | "smtp" | "none";

  /**
   * Display name used in the "From" field, e.g. "Acme Recruiting".
   * Combined with `fromEmail` to form "Acme Recruiting <hello@acme.com>".
   */
  fromName?: string;

  /**
   * Email address in the "From" field, e.g. "hello@acme.com".
   * Falls back to MAIL_FROM_ADDRESS env var or "noreply@example.com".
   */
  fromEmail?: string;

  // ── Resend ──────────────────────────────────────────────────────────────────
  /** Resend API secret key. Required when transportType === "resend". */
  resendApiKey?: string;

  // ── SMTP ────────────────────────────────────────────────────────────────────
  /** SMTP server hostname, e.g. "smtp.mailgun.org". Required when transportType === "smtp". */
  smtpHost?: string;
  /** SMTP port. Defaults to 587 (STARTTLS). */
  smtpPort?: number;
  /** SMTP authentication username. */
  smtpUsername?: string;
  /** SMTP authentication password (decrypted). */
  smtpPassword?: string;
  /**
   * Use implicit TLS (port 465) when true; STARTTLS when false.
   * Defaults to false.
   */
  smtpSecure?: boolean;
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
   * Default content locale for this tenant, used when the visitor has no
   * `locale` cookie. A Dutch tenant should set "nl" so a first-time visitor
   * (and the CMS site-settings fetch) read NL content instead of the global
   * "en" fallback. One of "en" | "nl" | "de"; absent → DEFAULT_LOCALE ("en").
   */
  defaultLocale?: string;

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
   * CMS connection overrides for this tenant.
   *
   * `statamicBaseUrl` is the ABSOLUTE base URL of the tenant's Statamic CMS
   * (e.g. "https://cms.misterchameleon.nl"). The Live Preview path uses it to
   * resolve DRAFT asset references to the correct per-tenant CMS host, so images
   * load regardless of which frontend host renders the preview and without
   * depending on the global `STATAMIC_API_URL` env var. When absent, callers
   * fall back to `STATAMIC_API_URL`.
   */
  cms?: {
    readonly statamicBaseUrl?: string;
  };

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

// ── Template catalog key ──────────────────────────────────────────────────────

/**
 * The logical page types available in the platform's template catalog.
 *
 * Each key maps to a TemplateCatalogEntry in page-config/template-catalog.ts,
 * which in turn references a PagePreset used for provisioning.
 *
 * Defined here (in tenant/types.ts) rather than in page-config to avoid a
 * circular import: page-config/types.ts already imports ContextBlockKey /
 * ContentBlockKey from @/tenant.
 *
 * Keep in sync with TEMPLATE_CATALOG in page-config/template-catalog.ts.
 */
export type TemplateCatalogKey =
  // ── Legacy catalog entries (original set) ──────────────────────────────────
  | "home"
  | "about"
  | "services"
  | "contact"
  | "news-listing"
  | "news-detail"
  | "cases-listing"
  | "case-detail"
  | "vacancies-listing"
  | "vacancy-detail"
  | "landing"
  | "team"
  | "faq"
  // ── Template registry additions (added with template-registry.ts) ───────────
  // These keys correspond to TemplateRegistryEntry.catalogKey values for the
  // entries in CORE_TEMPLATE_REGISTRY and EXTENDED_TEMPLATE_REGISTRY that do
  // not have a legacy catalog equivalent.
  | "content-page"      // registry: content_page  — article-page, no slots
  | "listing-generic"   // registry: listing_page  — listing-page, no slots
  | "detail-generic"    // registry: detail_page   — detail-page, no slots
  | "basic-page"        // registry: basic_page    — article-page, minimal
  | "sector-page"       // registry: sector_page   — marketing-page, corporate
  | "comparison-page"   // registry: comparison_page — landing-page, comparison
  | "team-detail"       // registry: team_detail   — detail-page, person detail
  | "event-listing"     // registry: event_listing — listing-page, events archive
  | "event-detail"      // registry: event_detail  — marketing-page, single event + registration
  // ── Shop catalog entries ──────────────────────────────────────────────────────
  | "shop-home"         // shop homepage: hero + product grid + feature grid + testimonials
  | "products-listing"  // product catalogue: intro + product grid + CTA
  | "product-detail"    // single product: gallery + specs + add-to-cart CTA
  | "cart"              // shopping cart: cart summary + continue shopping + checkout
  | "checkout";         // checkout: payment provider placeholder

// ── Block key vocabularies ────────────────────────────────────────────────────

/**
 * The decision-engine controlled (adaptive) slots on a page.
 *
 * Each value maps to a typed slot in the ExperiencePlan produced by the
 * decision provider.  Packages gate which slots a tenant may activate.
 *
 * ─── Core slots (always available) ──────────────────────────────────────────
 *
 *   hero         — Adaptive headline + sub-headline section.
 *                  Variant type: heroVariant.  Key prefix: hero_
 *   proof        — Adaptive social proof / trust signals section.
 *                  Variant type: proofVariant.  Key prefix: proof_
 *   cta          — Adaptive primary call-to-action section.
 *                  Variant type: ctaVariant.  Key prefix: cta_
 *
 * ─── Extended adaptive slots (package-gated) ────────────────────────────────
 *
 *   feature      — Adaptive feature highlights / benefit grid section.
 *                  Variant type: featureVariant.  Key prefix: feature_
 *   conversion   — Adaptive conversion section (richer intent signalling
 *                  than a simple CTA — form, multi-step, urgency copy, etc.).
 *                  Variant type: conversionVariant.  Key prefix: conversion_
 *
 * ─── Reserved (add when variant document type + schema exist) ───────────────
 *
 *   content      — Long-form editorial content slot
 *   faq          — FAQ / collapsible accordion slot
 *   feed         — Dynamic news / blog-post feed slot
 *   trust        — Trust badges / certifications / awards slot
 *
 * ─── Adding a new slot ───────────────────────────────────────────────────────
 *
 *   1. Add the key here.
 *   2. Add a FeatureVariantKey / ConversionVariantKey analog in decision/types.ts.
 *   3. Add a *BlockData interface in cms/types.ts.
 *   4. Create cms/schemas/<type>Variant.ts + cms/queries/sanity/<type>-queries.ts.
 *   5. Add get*Variant() to CMSProvider + implementations in each provider.
 *   6. Add to ADAPTIVE_SLOT_REGISTRY in decision/types.ts.
 */
export type ContextBlockKey =
  | "hero"
  | "proof"
  | "cta"
  | "feature"
  | "conversion"
  | "notification";

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
  | "recruiterPanel"
  // conversion / pricing
  | "pricingSection"
  // content / editorial
  | "contentSection"
  | "teamSection"
  // new core blocks
  | "timeline"
  | "quickLinks"
  | "textMedia"
  | "contactSection"
  | "floatingContact"
  // commerce / product blocks
  | "productOverview"
  | "productDetail"
  | "cartSummary"
  | "checkoutBlock"
  // map
  | "mapBlock";

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

// ── Adaptive slot settings ────────────────────────────────────────────────────

/**
 * Per-slot selection mode for a single core adaptive slot.
 *
 * Mirrors SlotSelectionMode in decision/slot-selection-mode.ts — redeclared
 * here to keep @/tenant free of circular imports with @/decision.
 *
 *   "static"       — serve a fixed operator-chosen key; AI and rules bypassed.
 *   "rules-only"   — use the rules plan key only; AI never consulted for this slot.
 *   "ai-assisted"  — AI may select this slot (default behaviour).
 */
export type TenantSlotMode = "static" | "rules-only" | "ai-assisted";

/**
 * Configuration for a single core adaptive slot's selection behaviour.
 */
export interface TenantAdaptiveSlotConfig {
  /**
   * Selection mode for this slot.
   * Default when absent: "ai-assisted".
   */
  readonly mode: TenantSlotMode;

  /**
   * Fixed variant key to serve when mode === "static".
   * Must be a valid key for the slot type (e.g. "hero_default" for the hero slot).
   * When mode === "static" and staticKey is absent, falls back to "rules-only".
   */
  readonly staticKey?: string;
}

/**
 * Per-slot AI selection mode configuration for a tenant.
 *
 * Stored in TenantSettings.adaptiveSlots.
 * Managed via /admin/tenants/[tenantId]/behavior/slots.
 *
 * ─── Default (when absent) ───────────────────────────────────────────────────
 *
 *   When this field is absent from TenantSettings, all six slots default to
 *   "ai-assisted" mode — identical to the behaviour before Phase 1 was
 *   introduced.  No migration is required for existing tenants.
 *
 * ─── Relationship to TenantAiSettings ────────────────────────────────────────
 *
 *   TenantAiSettings.mode ("disabled" | "shadow" | "live") gates whether the
 *   AI layer runs at all.  TenantAdaptiveSlotSettings configures per-slot
 *   behaviour WITHIN the AI layer.  When AI is disabled, slot modes have no
 *   effect (all slots use the rules plan regardless).
 *
 * ─── Required vs optional slots ──────────────────────────────────────────────
 *
 *   hero / proof / cta are required slots present on every page.
 *   feature / conversion / notification are optional slots; when absent from
 *   the page layout they are ignored by the decision engine.
 */
export interface TenantAdaptiveSlotSettings {
  readonly hero?:         TenantAdaptiveSlotConfig;
  readonly proof?:        TenantAdaptiveSlotConfig;
  readonly cta?:          TenantAdaptiveSlotConfig;
  readonly feature?:      TenantAdaptiveSlotConfig;
  readonly conversion?:   TenantAdaptiveSlotConfig;
  readonly notification?: TenantAdaptiveSlotConfig;
}

// ── AI Policy settings (Phase 3 — unified governance) ────────────────────────

/**
 * AI policy mode stored at the tenant level.
 *
 * Mirrors AiPolicyMode from @/ai/policy/types but re-declared here to avoid
 * a circular import between @/tenant and @/ai.
 *
 *   disabled — AI is not called; original content is always served.
 *   shadow   — AI runs but output is only logged, never applied to responses.
 *   live     — AI runs and output is applied when confidence ≥ threshold.
 */
export type TenantAiPolicyMode = "disabled" | "shadow" | "live";

/**
 * Per-phase AI policy configuration stored in TenantSettings.aiPolicies.
 */
export interface TenantAiPolicyConfig {
  readonly mode?:                TenantAiPolicyMode;
  readonly confidenceThreshold?: number;
}

/**
 * Unified AI governance policies covering both Phase 1 (selection) and
 * Phase 2 (fieldFill).
 *
 * Stored in TenantSettings.aiPolicies.  Both fields are optional — absent
 * phase policies fall through to the platform policy and then system defaults.
 *
 * Resolution order (for each phase):
 *   slot override → TenantSettings.aiPolicies → platform policy → system default
 */
export interface TenantAiPolicies {
  /** Phase 1 — variant selection. */
  readonly selection?: TenantAiPolicyConfig;
  /** Phase 2 — content field fill. */
  readonly fieldFill?: TenantAiPolicyConfig;
}

// ── AI Field Fill settings (Phase 2) ─────────────────────────────────────────

/**
 * Per-field AI fill specification stored in TenantFieldFillSettings.
 *
 * Controls whether a specific text field may be AI-rewritten and what
 * constraints apply.  Absent from tenant settings = aiEnabled defaults to false.
 */
export interface TenantFieldFillSpec {
  /** Whether AI may rewrite this field. */
  readonly aiEnabled:  boolean;
  /** Maximum word count. undefined = no limit. */
  readonly maxWords?:  number;
  /** Maximum character count. undefined = no limit. */
  readonly maxChars?:  number;
  /** Tone/style directive for this field injected into the AI prompt. */
  readonly style?:     string;
}

/**
 * Per-slot AI field fill configuration.
 *
 * Stored in TenantSettings.fieldFill.[hero|proof|cta].
 */
export interface TenantSlotFieldFillConfig {
  /** Master switch — when false, no AI call is made for this slot. */
  readonly enabled:              boolean;
  /**
   * Minimum AI confidence to apply field fill.
   * When AI confidence < threshold, original CMS content is kept.
   * undefined = no confidence gating.
   */
  readonly confidenceThreshold?: number;
  /**
   * Per-field fill specs, keyed by field path.
   *
   * Supported paths per slot:
   *   hero:  "title", "subtitle", "tag", "ctas.0.label", "ctas.1.label"
   *   proof: "title", "items.0.title", "items.0.text", …
   *   cta:   "title", "text", "cta.label"
   */
  readonly fields:               Record<string, TenantFieldFillSpec>;
}

/**
 * Top-level field fill configuration stored in TenantSettings.
 *
 * All slots optional — absent slot means field fill disabled for that slot.
 */
export interface TenantFieldFillSettings {
  readonly hero?:  TenantSlotFieldFillConfig;
  readonly proof?: TenantSlotFieldFillConfig;
  readonly cta?:   TenantSlotFieldFillConfig;
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

// ── CRM settings ──────────────────────────────────────────────────────────────

/**
 * Tenant-level CRM integration settings.
 *
 * Controls whether the CRM enrichment pipeline is active for this tenant
 * and how CRM-derived context fields are used in decisioning.
 *
 * The platform-level HubSpot token is configured at
 * /admin/platform/crm.  These settings gate whether that integration is
 * exercised for each individual tenant's visitor traffic.
 *
 * ─── Fields ───────────────────────────────────────────────────────────────────
 *
 *   enabled            — master switch; when false the CRM enricher is skipped
 *                        for this tenant entirely (saves API quota).
 *   useCrmEnrichment   — when true, CRM-derived fields (crmMatched,
 *                        crmIsCustomer, crmIndustry, etc.) are included in
 *                        the enrichment payload passed to the decision engine.
 *                        Requires `enabled = true`.
 */
export interface TenantCrmSettings {
  /**
   * Master switch for CRM integration on this tenant.
   * Safe default: false (off until explicitly enabled).
   */
  readonly enabled: boolean;

  /**
   * When true, CRM-derived fields are made available to rules and the AI
   * decision provider for this tenant's traffic.
   * Has no effect when `enabled` is false.
   */
  readonly useCrmEnrichment: boolean;
}

// ── Privacy settings ─────────────────────────────────────────────────────────

/**
 * Tenant-level privacy policy settings.
 *
 * Controls which consent categories the platform is allowed to act on for this
 * tenant's visitors, independent of the visitor's own cookie consent.
 *
 * ─── Precedence model ─────────────────────────────────────────────────────────
 *
 *   finalAllowed(category) = tenantPolicyAllows(category) && userConsentGiven(category)
 *
 *   A tenant can restrict a category platform-wide (e.g. legal requirement,
 *   conservative data policy) even when the visitor would otherwise consent.
 *   User consent can only further restrict, never expand, the tenant ceiling.
 *
 * ─── Consent banner ───────────────────────────────────────────────────────────
 *
 *   `showConsentBanner: false` hides the banner entirely (useful for internal
 *   tools or B2B deployments where consent is governed by DPA, not cookies).
 *
 * ─── Defaults ─────────────────────────────────────────────────────────────────
 *
 *   When this field is absent from TenantSettings, the platform defaults to
 *   showing the banner and deferring entirely to the visitor's cookie choice.
 */
export interface TenantPrivacySettings {
  /**
   * Whether to show the cookie consent banner to visitors.
   * Default: true.  Set to false for internal/DPA-governed deployments.
   */
  readonly showConsentBanner?: boolean;

  /**
   * Tenant ceiling for analytics consent (page views, event logs, GA4).
   * When false, analytics tracking is disabled regardless of user consent.
   * Default: true.
   */
  readonly allowAnalytics?: boolean;

  /**
   * Tenant ceiling for personalization consent — PERSISTENT, cross-session
   * behaviour only: persistent visitor identity + history/journey
   * (visitor_behavior_state) + behavioural scoring built from them. It does NOT
   * cap the anonymous context layer (device, coarse geo, source/UTM/referrer,
   * time), which always runs. When false, no persistent behaviour is read or
   * written; the anonymous layer still personalizes. Default: true.
   */
  readonly allowPersonalization?: boolean;

  /**
   * Tenant ceiling for enrichment consent (IP-to-company, Leadinfo, CRM).
   * When false, all enrichment pipeline stages are skipped.
   * Default: true.
   */
  readonly allowEnrichment?: boolean;

  /**
   * Tenant ceiling for advertising / marketing consent — forwarding ad click
   * identifiers (gclid/fbclid) to third-party conversion APIs (Google/Meta).
   * When false, no ad id is ever sent to a CAPI regardless of user consent.
   * Default: true.
   */
  readonly allowAdvertising?: boolean;

  /**
   * Optional override for the consent banner title text.
   * Falls back to the platform default when absent.
   */
  readonly bannerTitle?: string;

  /**
   * Optional override for the consent banner body text.
   * Falls back to the platform default when absent.
   */
  readonly bannerDescription?: string;
}

// ── Enrichment settings ───────────────────────────────────────────────────────

/**
 * Tenant-level IP enrichment (geo + CRM) settings.
 *
 * Controls whether the enrichment pipeline is active for this tenant's visitor
 * traffic.  Credentials (MaxMind license key, HubSpot token) live at the
 * platform level — these flags gate whether those credentials are exercised.
 *
 * ─── Fields ───────────────────────────────────────────────────────────────────
 *
 *   enabled           — master switch; when false the enrichment pipeline is
 *                       skipped entirely for this tenant (saves quota).
 *   useGeoEnrichment  — when true, MaxMind GeoIP is queried and geo context
 *                       fields (geoCity, geoCountry, geoOrg, geoIsVpn, etc.)
 *                       are populated for the decision engine.
 *                       Requires `enabled = true`.
 */
export interface TenantEnrichmentSettings {
  /**
   * Master switch for all enrichment for this tenant.
   * Safe default: false (off until explicitly enabled).
   */
  readonly enabled: boolean;

  /**
   * When true, MaxMind GeoIP enrichment is performed for this tenant's traffic.
   * Has no effect when `enabled` is false.
   * The MaxMind license key must be configured at platform level.
   */
  readonly useGeoEnrichment: boolean;

  /**
   * When true, IPinfo Lite enrichment runs for this tenant to resolve
   * ASN, organization name, and network domain from the visitor IP.
   * Has no effect when `enabled` is false.
   * The IPinfo API token must be configured at platform level.
   */
  readonly useIpinfoLite: boolean;

  /**
   * When true, the OpenKvK Dutch company registry lookup runs for visitors
   * whose IP resolves to a Netherlands countryCode.
   * Has no effect when `enabled` is false or countryCode !== "NL".
   * No API key required — OpenKvK is a public API.
   */
  readonly useOpenKvK: boolean;

  /**
   * When true, Leadinfo IP-to-company enrichment runs for this tenant.
   * Has no effect when `enabled` is false.
   * The Leadinfo API key must be configured at platform level.
   */
  readonly useLeadinfo: boolean;

  /**
   * When true, IP-to-company enrichment runs (via Clearbit or other providers
   * configured at platform level).  Enables the company identification stages
   * of the enrichment pipeline.
   * Has no effect when `enabled` is false.
   */
  readonly useIpCompanyEnrichment: boolean;

  /**
   * When true, the seasonal event stage runs for this tenant.
   * This enables the Nager.Date public holiday API and the business-event
   * date-math layer (black-friday, cyber-monday, back-to-school).
   * Has no effect when `enabled` is false or the holiday provider is not
   * enabled at platform level (/admin/platform/integrations/enrichment).
   * Safe default: false.
   */
  readonly useSeasonalEvents?: boolean;

  /**
   * When true, the enrichment pipeline uses `testIpAddress` instead of the
   * real visitor IP.  Useful for QA and geo-targeting verification without
   * needing to physically change network location.
   *
   * Safety gate: only honoured in development mode or when the environment
   * variable `ENABLE_DEBUG_IP_OVERRIDE=true` is set.  The flag is silently
   * ignored in production without the env var.
   *
   * Safe default: false (disabled).
   */
  readonly testIpEnabled?: boolean;

  /**
   * The IP address to use when `testIpEnabled` is true.
   *
   * Must be a valid IPv4 or IPv6 address string, e.g. "8.8.8.8" or
   * "2001:4860:4860::8888".  An empty or absent value means no override
   * is applied even when `testIpEnabled` is true.
   */
  readonly testIpAddress?: string;

  /**
   * How many days a recognised visitor's firmographics (company name / domain /
   * industry / size) stay "fresh". Within this window, the company-identification
   * stages are SKIPPED for that visitor and the stored data is reused; after it,
   * they re-run once to refresh. Volatile enrichment (current geo, weather) always
   * runs. Default: 30.
   */
  readonly firmographicFreshnessDays?: number;

  /**
   * The lead-score (0–100) at or above which a returning visitor counts as a
   * "hot lead" — drives the `isHotLead` context variable, the Hot-leads segment,
   * and the ABM dashboard's hot count/filter. Default: 60.
   */
  readonly leadScoreHotThreshold?: number;

  /**
   * Percentage of visitors (0–50) deterministically held out from personalization
   * — served the default experience as a control group so the performance report
   * can measure true causal lift. Default: 0 (no holdout; everyone personalized).
   */
  readonly personalizationHoldoutPct?: number;

  /**
   * Lead-score tuning: per-component weight multipliers (default 1 each) and an
   * optional time-decay half-life in days (0 = off). Lets a tenant emphasise
   * identity vs intent vs recency vs engagement and cool old leads off.
   */
  readonly leadScoring?: {
    readonly weights?: {
      readonly level?:      number;
      readonly intent?:     number;
      readonly recency?:    number;
      readonly engagement?: number;
    };
    readonly decayHalfLifeDays?: number;
  };
}

// ── Domains settings ──────────────────────────────────────────────────────────

/**
 * Tenant-level domain and deployment configuration.
 *
 * Controls how this tenant maps to the underlying hosting infrastructure.
 * The Vercel API token that enables domain provisioning lives at the platform
 * level — these fields configure the per-tenant mapping.
 *
 * ─── Fields ───────────────────────────────────────────────────────────────────
 *
 *   vercelProjectId  — the Vercel project name or ID this tenant maps to.
 *                      Used to add/remove custom domains for this tenant via
 *                      the Vercel Domains API.  Leave blank to use the
 *                      platform-wide project default.
 *
 * Note: primaryDomain and additionalDomains (routing hostnames) live directly
 * on TenantSettings for historical reasons.  This type holds Vercel-specific
 * deployment configuration only.
 */
export interface TenantDomainsSettings {
  /**
   * Vercel project name or project ID this tenant is hosted on.
   * Example: "my-project", "prj_abc123"
   * Leave absent to use the platform-wide default Vercel project.
   */
  readonly vercelProjectId?: string;
}

// ── Debug settings ────────────────────────────────────────────────────────────

/**
 * On-site debug overlay visibility settings for this tenant.
 *
 * Controls whether the developer diagnostics panel is rendered on the site.
 * The runtime context-building and decision logic always runs regardless of
 * these settings — only the rendered output is gated.
 *
 * ─── Levels ───────────────────────────────────────────────────────────────────
 *
 *   "off"      Nothing is rendered. Same as showDebugOverlay = false.
 *   "summary"  Compact section: hero/proof/cta keys, source, AI mode, fallback.
 *   "full"     Full output: summary + ContextDebugPanel (all context variable
 *              tables) + EnrichmentDebugPanel (pipeline trace, IP, Leadinfo,
 *              GA4 history).
 *
 * ─── Default ──────────────────────────────────────────────────────────────────
 *
 *   When this field is absent on a tenant record the overlay is treated as OFF.
 *   This is the safe default — no debug information is rendered publicly.
 */
export interface TenantDebugSettings {
  /**
   * Master switch.  When false (or when this object is absent), no debug
   * overlay is rendered on the site regardless of debugLevel.
   */
  readonly showDebugOverlay: boolean;

  /**
   * Granularity of the debug output when showDebugOverlay is true.
   *
   *   "off"      — same as showDebugOverlay: false (belt-and-suspenders).
   *   "summary"  — hero/proof/cta/source/AI info only (compact, low noise).
   *   "full"     — everything: summary + all context variable tables +
   *                enrichment pipeline trace.
   *
   * Defaults to "full" when showDebugOverlay is true and this field is absent
   * (matches the pre-feature behaviour where the full panel was always shown).
   */
  readonly debugLevel: "off" | "summary" | "full";

  /**
   * When true, the operator/demo scenario console (bottom-right) is mounted
   * site-wide for this tenant. Absent/false (the default) keeps it off so it
   * never appears unintentionally on a live tenant. This is the main switch;
   * the client-side /demo-controls toggle and auto-open on an active scenario
   * still apply as a second layer once the console is mounted.
   */
  readonly showScenarioControl?: boolean;
}

// ── Experiments settings ──────────────────────────────────────────────────────

/**
 * Tenant-level A/B experiment runtime settings.
 *
 * Controls whether the experiment evaluation layer runs at all for this
 * tenant's traffic.  Individual experiment on/off state is managed via
 * each experiment's `status` field ("active" / "paused" / "ended").
 *
 * ─── Global toggle ─────────────────────────────────────────────────────────────
 *
 *   enabled = true  (default) — active experiments are evaluated normally.
 *   enabled = false           — ALL experiment evaluation is skipped for this
 *                               tenant.  Visitors receive the rules/fallback plan.
 *
 * ─── Default ──────────────────────────────────────────────────────────────────
 *
 *   When this field is absent on a tenant record the engine treats it as
 *   enabled = true (experiments run by default, preserving legacy behaviour).
 */
export interface TenantExperimentsSettings {
  /**
   * Global experiment master switch.
   * When false, ExperimentDecisionProvider skips all experiment evaluation for
   * this tenant and returns the base rules plan unchanged.
   * Defaults to true when absent.
   */
  readonly enabled: boolean;
}

// ── GA4 settings ──────────────────────────────────────────────────────────────

/**
 * Tenant-level GA4 tracking configuration (Measurement Protocol / gtag send).
 *
 * Controls whether this tenant sends visitor events to Google Analytics 4,
 * which measurement stream to use, and how events are dispatched (client JS
 * or server-side Measurement Protocol).
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   `apiSecret` is a server-only value.  Strip it before crossing the
 *   server→client boundary (pass only `hasApiSecret: boolean` to the client).
 */
export interface TenantGa4TrackingSettings {
  /** Master switch. When false, no events are sent to GA4. */
  readonly enabled: boolean;

  /**
   * GA4 Measurement ID from Admin → Data Streams → Web stream.
   * Format: "G-XXXXXXXXXX".  Required for both client and server send modes.
   */
  readonly measurementId?: string;

  /**
   * How GA4 events are dispatched.
   *
   *   "off"    — no events sent (default)
   *   "client" — gtag.js injected in the browser; events sent from the client
   *   "server" — Measurement Protocol; events sent from Next.js API routes
   */
  readonly sendMode?: "off" | "client" | "server";

  /**
   * Name of the GA4 user property / custom dimension that stores the visitor ID.
   * Must match the GA4 custom dimension and the History enricher's dimension name.
   * Default: "visitor_id"
   */
  readonly visitorIdParamName?: string;

  /**
   * API Secret for server-side Measurement Protocol sends.
   * Created in GA4 Admin → Data Streams → Measurement Protocol API secrets.
   * Required when sendMode === "server".
   *
   * SERVER ONLY — must never be serialised to a client-side response or logged.
   */
  readonly apiSecret?: string;
}

/**
 * Tenant-level GA4 Analytics History enrichment settings.
 *
 * Controls whether this tenant reads historical GA4 signals for returning
 * visitors via the GA4 Data API, using a service account credential.
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   `serviceAccountJson` is a server-only secret — strip it before crossing
 *   the server→client boundary (pass only `hasServiceAccount: boolean`).
 */
export interface TenantGa4HistorySettings {
  /** Master switch. When false, GA4 history enrichment is skipped. */
  readonly enabled: boolean;

  /**
   * GA4 property ID (numeric, not the measurement ID).
   * Found in GA4 Admin → Property Settings.
   * Example: "123456789"
   */
  readonly propertyId?: string;

  /**
   * Google service account JSON key file (full JSON string).
   * The account must have Viewer access to the GA4 property.
   *
   * SERVER ONLY — must never be serialised to a client-side response or logged.
   */
  readonly serviceAccountJson?: string;

  /**
   * Name of the User-scoped custom dimension in GA4 that stores the visitor ID.
   * The "customUser:" prefix is added automatically by the enricher.
   * Default: "visitor_id"
   */
  readonly visitorIdDimension?: string;

  /**
   * How far back to query GA4 for visitor history (days).
   * Default: 90
   */
  readonly lookbackDays?: number;

  /**
   * How long to cache GA4 results per visitor (minutes).
   * Default: 30
   */
  readonly cacheTtlMinutes?: number;
}

/**
 * Combined GA4 settings for a tenant.
 *
 * Bundles tracking (send) and history (read) into a single optional field
 * on TenantSettings.  Both sub-settings are independently optional — a tenant
 * can enable client-side tracking without history enrichment, or vice versa.
 */
export interface TenantGa4Settings {
  readonly tracking?: TenantGa4TrackingSettings;
  readonly history?:  TenantGa4HistorySettings;
}

// ── Leadinfo settings ─────────────────────────────────────────────────────────

/**
 * Tenant-level Leadinfo client-side enrichment settings.
 *
 * Leadinfo is a B2B IP-identification service.  Unlike the server-side
 * `useLeadinfo` flag (which gates the server-to-server API call),
 * these settings control the *client-side* integration: the Leadinfo
 * `identify` script is executed in the visitor's browser with the real
 * client IP, then the normalised result is persisted in the `mc_li`
 * cookie for server-side enrichment.
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   `siteToken` is a non-secret public identifier — Leadinfo embeds it in
 *   the browser-facing JS snippet.  Store it here (not as an env var) so it
 *   can be per-tenant in multi-tenant deployments.
 *
 * ─── Fields ───────────────────────────────────────────────────────────────────
 *
 *   enabled         — master switch; no client-side script runs when false
 *   siteToken       — Leadinfo site/tracking token (public, non-secret)
 *   pushToDataLayer — when true, normalised company fields are pushed to
 *                     window.dataLayer after the identify call succeeds,
 *                     making them available to GTM tags
 *   storeInContext  — when true, the result is POSTed to /api/enrichment/leadinfo
 *                     and persisted in the mc_li cookie so the server can read
 *                     it on subsequent requests
 */
export interface TenantLeadinfoSettings {
  /** Master switch for Leadinfo client-side integration. Default: false. */
  readonly enabled: boolean;

  /**
   * Leadinfo site token — the public identifier for this tenant's Leadinfo account.
   * Found in the Leadinfo dashboard under Script Settings.
   * Example: "abc123def456"
   */
  readonly siteToken?: string;

  /**
   * When true, Leadinfo identify results are pushed to window.dataLayer
   * as a "leadinfo_identified" event with company fields as properties.
   * Enables GTM tags to use Leadinfo data without additional setup.
   * Default: false.
   */
  readonly pushToDataLayer?: boolean;

  /**
   * When true, the normalised Leadinfo result is POSTed to
   * /api/enrichment/leadinfo and persisted in the mc_li httpOnly cookie.
   * This makes the data available for server-side enrichment on subsequent
   * page loads via buildDecisionContext.
   * Default: true.
   */
  readonly storeInContext?: boolean;
}

// ── GTM (Google Tag Manager) settings ──────────────────────────────────────────

export interface TenantGtmSettings {
  /**
   * GTM container ID, e.g. "GTM-ABC1234". When set, the GTM snippet is rendered
   * in the site's <head> + <body>, which establishes window.dataLayer — enabling
   * GTM tags (and any dataLayer-based integration, e.g. Leadinfo's dataLayer push).
   * Validated against /^GTM-[A-Z0-9]+$/i before rendering (it goes into an inline
   * script), so an invalid value is simply ignored.
   */
  readonly containerId?: string;
}

// ── CMS settings ──────────────────────────────────────────────────────────────

/**
 * CMS integration settings for a single tenant.
 *
 * Uses `CMSProviderName` (declared above) as the provider discriminator so
 * the two type families stay consistent.
 *
 * ─── Provider-specific fields ─────────────────────────────────────────────────
 *
 *   Sanity:
 *     projectId   — Sanity project ID (overrides platform default)
 *     dataset     — Sanity dataset name, e.g. "production"
 *     writeToken  — Sanity write token (server-only; overrides platform default)
 *
 *   Storyblok:
 *     projectId        — Storyblok space ID (overrides platform default)
 *     storyblokRegion  — CDN region: "eu" | "us" | "ap" (overrides platform)
 *     storyblokVersion — "published" | "draft" (overrides platform)
 *
 *   Statamic:
 *     statamicBaseUrl  — Base URL of the Statamic site (overrides platform)
 *
 *   mock — all fields ignored
 *
 * ─── Resolution order ──────────────────────────────────────────────────────────
 *
 *   Tenant-level value → Platform store value → Environment variable
 */
export interface TenantCmsSettings {
  readonly provider:   CMSProviderName;

  // ── Shared / Sanity ────────────────────────────────────────────────────────
  readonly projectId?:  string;
  readonly dataset?:    string;
  /**
   * Sanity API version override for this tenant, e.g. "2024-01-01".
   * Overrides the platform-level SANITY_API_VERSION environment variable.
   * Falls back to serverEnv.sanity.apiVersion when absent.
   */
  readonly apiVersion?: string;
  /**
   * URL of the Sanity Studio for this tenant.
   * Informational only — used in admin UIs and debug output.
   * Example: "https://my-studio.sanity.studio"
   */
  readonly studioUrl?:  string;
  /**
   * Write token for the CMS provider.
   * SERVER ONLY — must never be serialised to a client response or logged.
   * When present, takes precedence over the platform-level token.
   */
  readonly writeToken?: string;

  // ── Storyblok-specific (non-secret) ───────────────────────────────────────
  /**
   * Storyblok CDN region for this tenant.
   * "eu" | "us" | "ap" | "ca" | "cn" (default: platform default or "eu").
   */
  readonly storyblokRegion?:   string;
  /**
   * Storyblok content version for this tenant.
   * "published" | "draft" (default: platform default or "published").
   */
  readonly storyblokVersion?:  string;

  // ── Statamic-specific (non-secret) ────────────────────────────────────────
  /**
   * Base URL of this tenant's Statamic installation.
   * Example: "https://cms.tenant.com"
   * Overrides the platform-level STATAMIC_API_URL / platform store baseUrl.
   */
  readonly statamicBaseUrl?:   string;
}

// ── Design settings ───────────────────────────────────────────────────────────

/**
 * Named theme keys representing pre-built visual design configurations.
 *
 * Package tiers gate which themes are available:
 *   starter   → default only
 *   growth    → default + minimal + most commercial themes
 *   pro       → all themes including bold, custom, and specialist themes
 *
 * ─── Original platform presets ────────────────────────────────────────────
 *   default               — indigo-violet, balanced radius (platform standard)
 *   minimal               — neutral slate, sharp radius (enterprise clean)
 *   bold                  — deep indigo, soft radius, heavy weight
 *   custom                — fully bespoke; pro tier only
 *
 * ─── Curated commercial themes ────────────────────────────────────────────
 *   corporate-blue        — navy blue, sharp radius; professional services, B2B
 *   modern-green          — emerald, balanced; sustainability, growth-focused
 *   minimal-neutral       — zinc monochrome, sharp; architecture, design, editorial
 *   bold-dark             — amber on near-black; product launches, high-energy SaaS
 *   tech-indigo           — deep violet-800, sharp; developer tools, dashboards
 *   warm-professional     — amber-600, balanced; consulting, coaching, HR
 *   recruitment-energy    — orange, soft, heavy; job boards, career sites
 *   healthcare-calm       — cyan on sky-blue, soft; healthcare, wellness
 *   industrial-strong     — red on stone, sharp; manufacturing, logistics
 *   premium-editorial     — gold on warm-white, sharp; publishing, luxury, legal
 *   dark-contrast         — pure black / white; high-contrast minimal premium
 *   editorial-classic     — white editorial; serif headings, newspaper-style
 *   playful-startup       — vivid violet, soft radius, rounded fonts; consumer apps, EdTech
 *   startup-energy        — rose-red, ultra-bold, spring motion; product launches, B2C
 *   corporate-trust       — blue-600, balanced, DM Sans; financial, professional services
 */
export type ThemeKey =
  // ── Original platform presets ────────────────────────────────────────────
  | "default"
  | "minimal"
  | "bold"
  | "custom"
  // ── Curated commercial themes ─────────────────────────────────────────────
  | "corporate-blue"
  | "modern-green"
  | "minimal-neutral"
  | "bold-dark"
  | "tech-indigo"
  | "warm-professional"
  | "recruitment-energy"
  | "healthcare-calm"
  | "industrial-strong"
  | "premium-editorial"
  | "dark-contrast"
  | "editorial-classic"
  | "playful-startup"
  | "startup-energy"
  | "corporate-trust"
  | "modern-saas"
  | "corporate-clean"
  | "bold-marketing"
  // ── Signature themes (editorial · corporate · bold · showcase · luxury) ────
  | "portfolio-showcase"
  | "premium-luxury"
  // ── Seasonal themes ────────────────────────────────────────────────────────
  | "valentine-pink"
  | "dutch-orange"
  // ── Careers / HR themes ───────────────────────────────────────────────────
  | "careers-human"
  // ── Premium families ──────────────────────────────────────────────────────
  | "dark-ai"
  | "clean-corporate"
  | "structured-saas"
  // ── Client-type blueprints ────────────────────────────────────────────────
  | "werkenbij-blueprint"
  | "corporate-b2b-blueprint"
  | "saas-blueprint";

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

  /**
   * Layout-shell component token overrides.
   *
   * Well-known keys are mapped to specific CSS custom properties:
   *   headerBg          → --header-bg          (header background, default / top of page)
   *   headerBgScrolled  → --header-bg-scrolled (header background after scroll)
   *   headerFg          → --header-fg          (header foreground / text colour)
   *   headerBorder      → --header-border      (header bottom-border colour)
   *   footerBg          → --footer-bg          (footer background)
   *   footerFg          → --footer-fg          (footer foreground / text colour)
   *   footerBorder      → --footer-border      (footer top-border colour)
   *
   * Unknown keys fall back to `--layout-{kebab-key}`.
   */
  readonly layout?: Readonly<Record<string, string>>;

  /**
   * Grid / content-structure tokens.
   *   columns      → --grid-columns      (card grids: "2" | "3" | "4")
   *   gutter       → --grid-gutter        (gap between grid items)
   *   contentWidth → --content-width      (max content measure)
   * Unknown keys fall back to `--grid-{kebab-key}`.
   */
  readonly grid?: Readonly<Record<string, string>>;

  /**
   * Responsive section-rhythm tokens (per breakpoint vertical section padding).
   *   sectionDesktop → --section-py-desktop
   *   sectionTablet  → --section-py-tablet
   *   sectionMobile  → --section-py-mobile
   * Consumed by the section shell via @media rules in theme.css.
   */
  readonly responsive?: Readonly<Record<string, string>>;

  /**
   * Elevation tokens.
   *   mode       → --elevation-mode ("flat" | "elevated"; advisory)
   *   cardShadow → --card-shadow
   * Unknown keys fall back to `--elevation-{kebab-key}`.
   */
  readonly elevation?: Readonly<Record<string, string>>;

  /**
   * Focus-ring tokens (accessibility).
   *   ringWidth → --focus-ring-width
   *   ringColor → --ring
   * Unknown keys fall back to `--focus-{kebab-key}`.
   */
  readonly focus?: Readonly<Record<string, string>>;

  /**
   * Button per-variant + geometry tokens. Most map onto existing --btn-* vars.
   *   primaryFill → --btn-bg, primaryHover → --btn-hover-bg, primaryText → --btn-text,
   *   radius → --btn-radius, paddingX → --btn-px, paddingY → --btn-py,
   *   weight → --btn-font-weight, transform → --btn-text-transform,
   *   tracking → --btn-tracking, shadow → --btn-shadow,
   *   secondaryStyle → --btn-secondary-style.
   * Unknown keys fall back to `--button-{kebab-key}`.
   */
  readonly button?: Readonly<Record<string, string>>;
}

// ── Custom font types ──────────────────────────────────────────────────────────

/**
 * Metadata for one uploaded custom font file set.
 *
 * Font files are stored in the `tenant-fonts` Supabase Storage bucket at
 * path `{tenantId}/{role}/{weight}.{ext}`.  The public URL is stored here.
 *
 * Only `regularUrl` is required.  Medium, bold, and italic variants are
 * optional — the browser will synthesise them from regular when absent.
 */
export interface CustomFontFace {
  /** CSS font-family name to use in @font-face and font stacks, e.g. "Brandica". */
  readonly name: string;
  /** Public URL to the regular (400) weight font file (woff2 or woff). */
  readonly regularUrl: string;
  /** Public URL to the medium (500) weight font file, if uploaded. */
  readonly mediumUrl?: string;
  /** Public URL to the bold (700) weight font file, if uploaded. */
  readonly boldUrl?: string;
  /** Public URL to the italic (400 italic) font file, if uploaded. */
  readonly italicUrl?: string;
}

/**
 * Collection of custom fonts configured for each semantic font role.
 *
 * Stored as `design.customFonts` in TenantDesignSettings.
 */
export interface TenantCustomFonts {
  /** Custom font for the primary sans/body role (--font-sans). */
  readonly sans?:  CustomFontFace;
  /** Custom font for the editorial serif role (--font-serif). */
  readonly serif?: CustomFontFace;
  /** Custom font for the monospace/code role (--font-mono). */
  readonly mono?:  CustomFontFace;
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
 *
 * `customFonts` carries platform-level custom font configurations (woff2/woff
 * files uploaded to Supabase Storage).  @font-face declarations are generated
 * from this at request time and injected as Layer D in app/layout.tsx.
 */
/**
 * Header structural variant.
 *
 *   minimal     — compact bar, horizontal links, no mega/flyout panels
 *   flyout      — standard bar, vertical flyout dropdown panels on hover
 *   mega        — full-width bar, multi-column mega-menu panels
 *   transparent — no initial background; floats over the hero section
 *   triband     — three-band layout (see components/layout/TriBandNav.tsx)
 *
 * When absent the active theme family prescribes the default.
 * Store as `design.headerVariant` in TenantDesignSettings.
 *
 * ─── Why triband was added here ──────────────────────────────────────────────
 *
 *   The tri-band header exists: TriBandNav.tsx renders it, Header.tsx switches
 *   to it, HeaderShell knows the layout, and the CMS SiteSettings type offers it.
 *   This union did not — so LayoutVariantEditor, which is typed on it, could
 *   never offer the option, and design.headerVariant = "triband" was not even
 *   representable. A tenant could only reach the tri-band header by editing site
 *   settings in the CMS. Nothing failed; the option was simply not there.
 *
 *   Safe to widen: no tenant has ever stored a headerVariant (all four rows are
 *   null), so there is no persisted value to migrate either way.
 */
export type HeaderVariant = "minimal" | "flyout" | "mega" | "transparent" | "triband";

/**
 * Footer structural variant.
 *
 *   minimal    — single-row strip: brand | nav links | copyright
 *   corporate  — multi-column: brand+tagline on the left, link columns on the right
 *   branding   — centred layout: prominent logo, centred nav, centred copyright
 *
 * When absent the active theme family prescribes the default.
 * Store as `design.footerVariant` in TenantDesignSettings.
 */
export type FooterVariant = "minimal" | "corporate" | "branding";

/**
 * Footer padding density.
 *   compact      — tighter vertical rhythm (business / data-dense sites)
 *   comfortable  — balanced rhythm (default for most family presets)
 *   spacious     — generous padding (editorial / luxury sites)
 */
export type FooterDensity = "compact" | "comfortable" | "spacious";

export interface TenantDesignSettings {
  readonly theme:           ThemeKey;
  readonly primaryColor?:   string;
  readonly primaryFont?:    string;
  /**
   * Fine-grained CSS token overrides set via the design token upload.
   * Applied on top of the preset — highest specificity in the theme cascade.
   */
  readonly tokenOverrides?: TenantTokenOverrides;
  /**
   * Platform-level custom font configurations.
   * Keyed by font role: sans, serif, mono.
   * @font-face CSS is generated from these at request time (Layer D).
   */
  readonly customFonts?:    TenantCustomFonts;
  /**
   * Named, reusable block-level token sets.
   *
   * Each set bundles a handful of curated design tokens (background/surface,
   * text, primary/accent, card, heading, dividers) under a stable `key`.
   * Individual content blocks and adaptive/context slots reference a set by
   * that key (optionally layering inline tweaks on top), and the renderer emits
   * the resolved CSS custom properties scoped to just that block — restyling it
   * without touching the site-wide theme.
   *
   * See design-system/theme/block-token-set.ts for the model and resolver.
   */
  readonly blockTokenSets?: readonly BlockTokenSet[];
  /**
   * Site-wide default design tokens — the central design-token system.
   *
   * These are emitted as CSS custom properties at the PAGE ROOT, so every
   * content block and adaptive/context slot inherits them automatically, with
   * no per-component assignment required. Per-block `tokenSet`/`tokens` still
   * override this default for their own subtree (nested scope wins).
   *
   * Set once in Admin → Design → "Site design tokens".
   */
  readonly defaultTokens?: CuratedBlockTokens;
  /**
   * Tenant-wide default block effects (design-system/effects). Applied to every
   * content block that has no effect ref of its own (lowest of the three tiers:
   * tenant default < named effect set < per-block inline). Each entry is a
   * declarative BlockEffectConfig ({ effect, params }); there is no raw-JS field.
   * Set in Admin → Design → Effects.
   */
  readonly defaultEffects?: readonly import("@/design-system/effects/effect-ref").BlockEffectConfig[];
  /**
   * Per-block-type default effects, keyed by block type — either an adaptive slot
   * type (hero, proof, cta, feature, conversion, notification) or a content block
   * type (stats, featureGrid, ...). Sits between the per-block instance ref and the
   * tenant-wide default (instance ref < block-type default < tenant default). Each
   * value is a declarative BlockEffectConfig[]; no raw JS. Set in Admin → Settings →
   * Allowed Blocks. Lives in the design JSON — no migration.
   */
  readonly blockTypeEffects?: Partial<Record<ContextBlockKey | ContentBlockKey, readonly import("@/design-system/effects/effect-ref").BlockEffectConfig[]>>;
  /**
   * The Featured Theme Family that was explicitly selected in Design → Style.
   *
   * This field tracks the user's intentional family choice so the admin UI can
   * display "Inherited from [Family Name]" labels in the Typography and Layout
   * sections.  It does NOT affect CSS rendering — family defaults are applied at
   * render time via familyTypographyToVars() / familyStructuralToVars() using the
   * preset's own `featuredFamilyKey` property.
   *
   * Set automatically when the user activates a preset that belongs to a
   * featured family.  Absent for tenants created before this field was added;
   * in that case the UI falls back to deriving the family from `design.theme`.
   *
   * Stored as a plain string (not the typed union) so that future family keys
   * added to FeaturedFamilyKey do not cause deserialization errors on older data.
   */
  readonly selectedStyleFamily?: string;
  /**
   * Whether tenant typography token overrides are actively applied.
   *
   * When `true`: values in `tokenOverrides.typography` (fontHeading, fontBody,
   * fontSans, etc.) are merged on top of the active theme family's typography,
   * letting the tenant customise individual font roles.
   *
   * When `false` or absent (the default): all `tokenOverrides.typography` values
   * are ignored and the active theme family's typography is used as-is.
   * This ensures switching theme families always results in visually distinct
   * typography without requiring a manual "reset" step.
   *
   * Set via the "Override typography" toggle in Design → Typography.
   * Automatically reset to `false` when the operator switches to a different
   * theme preset from the Style gallery.
   */
  readonly typographyOverrideEnabled?: boolean;
  /**
   * "Inherit host style" mode for snippet-injected blocks.
   *
   * When `true`, snippet blocks are rendered so the host page's own colours and
   * backgrounds win (text -> inherit, surfaces -> transparent, borders/accents ->
   * currentColor, buttons -> outlined) instead of imposing the tenant palette.
   * See render-block-html.ts (INHERIT_HOST_STYLE_VARS). Set by applying the
   * "Inherit host style" gallery preset. Only affects the snippet render path;
   * platform-hosted tenants (React components) are unaffected.
   */
  readonly inheritHostStyle?: boolean;
  /**
   * Header structural variant override.
   *
   * When set, this takes precedence over the theme family's default header
   * style and nav-dropdown pattern.  When absent, the active family's
   * structural config applies (editorial → flyout/light, corporate → mega/light,
   * bold-marketing → flyout/transparent, etc.).
   *
   * See HeaderVariant for the full set of accepted values.
   */
  readonly headerVariant?: HeaderVariant;
  /**
   * Footer structural variant override.
   *
   * When set, this takes precedence over the theme family's default footer
   * layout.  When absent, the active family's structural footer config applies.
   *
   * See FooterVariant for the full set of accepted values.
   */
  readonly footerVariant?: FooterVariant;
  /**
   * Footer padding density override.
   *
   * Controls vertical rhythm of the footer section.  When absent, the active
   * family's density setting applies (spacious for editorial/luxury/marketing,
   * compact for corporate/portfolio).
   */
  readonly footerDensity?: FooterDensity;
  /**
   * @deprecated Use plan.themeKey on StoredRules in rules_config instead.
   *
   * Legacy contextual theme rule configuration.  The production theme decision
   * engine now reads StoredRulesConfig (rules_config table) and evaluates
   * plan.themeKey on matched rules.  This field is preserved for backward
   * compatibility so existing stored data is not lost, but it is no longer
   * evaluated at runtime.
   *
   * New theme overrides should be configured via the Design → Theme Overrides
   * panel, which writes to plan.themeKey on individual StoredRules.
   */
  readonly themeRules?: import("@/decision/theme-decision").ThemeRuleConfig;
}

// ── Search settings ───────────────────────────────────────────────────────────

/**
 * Per-tenant search provider configuration.
 *
 * Stored in the `tenant_search_settings` Supabase table (config JSONB column).
 * The Meilisearch API key is stored encrypted (AES-256-GCM) and is NEVER
 * present in this type — runtime loaders decrypt it when building the provider.
 *
 * ─── Provider resolution order ────────────────────────────────────────────────
 *
 *   1. Meilisearch  — when provider === "meilisearch" AND host + key are set
 *   2. Sanity GROQ  — when SANITY_PROJECT_ID is set in the environment
 *   3. InMemory     — always-available fixture-corpus fallback
 *
 * ─── Index naming ─────────────────────────────────────────────────────────────
 *
 *   A single Meilisearch index per tenant is used:
 *     {indexPrefix}{tenantId}
 *
 *   All content types (pages, posts, vacancies, etc.) are stored in one index
 *   with a `contentType` field for scope-based filtering.  This avoids
 *   multi-index fan-out and simplifies cross-type ranking.
 *
 * ─── Indexing ─────────────────────────────────────────────────────────────────
 *
 *   Content is pushed to Meilisearch by the reindex action
 *   (`reindexTenantSearchAction`) triggered from the admin panel.
 *   The source of truth remains the CMS (Sanity).
 */
export interface TenantSearchSettings {
  /**
   * Which search provider is active for this tenant.
   *
   *   "none"          — use platform default (Sanity GROQ or InMemory)
   *   "meilisearch"   — use Meilisearch with the credentials below
   */
  readonly provider: "none" | "meilisearch";

  /**
   * Meilisearch instance URL.
   * Example: "https://search.acme.com", "http://localhost:7700"
   * Required when provider === "meilisearch".
   */
  readonly meilisearchHost?: string;

  /**
   * Meilisearch index name prefix.
   * Final index name: `{indexPrefix}{tenantId}`.
   * Defaults to "" (empty — index name equals tenantId).
   * Example: "prod_" → index "prod_acme"
   */
  readonly indexPrefix?: string;

  /**
   * ISO 8601 timestamp (UTC) of the most recent successful reindex run.
   * Set by `reindexTenantSearchAction` after a completed index push.
   * Absent when the index has never been built.
   */
  readonly lastIndexedAt?: string;

  /**
   * Summary statistics from the most recent reindex run.
   * Written alongside `lastIndexedAt` by the indexer.
   */
  readonly lastIndexStats?: {
    readonly docCount: number;
    readonly errorCount: number;
  };
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
 *   ai                — AI layer settings specific to this tenant (mode, provider, model)
 *   cms               — CMS provider + per-tenant config (provider, projectId, overrides)
 *   crm               — CRM enablement flags for this tenant
 *   enrichment        — IP/geo enrichment enablement flags for this tenant
 *   domains           — Vercel deployment mapping for this tenant
 *   design            — visual design settings for this tenant
 *   cmsProvisionedAt  — ISO 8601 timestamp of the last successful CMS provisioning
 *                       run.  Set by provisionSiteAction; absent when the tenant
 *                       has not yet been provisioned into the CMS.
 *
 * ─── Two-layer integration model ─────────────────────────────────────────────
 *
 *   Platform layer (/admin/platform/integrations):
 *     Stores API keys, tokens, and infrastructure defaults that apply to all
 *     tenants unless overridden.  Contains only secrets and optional defaults.
 *
 *   Tenant layer (this type, managed at /admin/tenants/[id]/integrations):
 *     Stores usage config: which integrations are active for this tenant,
 *     tenant-specific provider settings, and per-tenant overrides.
 *     Contains no secrets (writeToken is the sole exception — it's a
 *     per-tenant CMS write credential, not a copy of the platform secret).
 */

// ── Language configuration ────────────────────────────────────────────────────

/**
 * A single language (= Statamic "site") configured for a tenant.
 *
 * ─── Statamic mapping ────────────────────────────────────────────────────────
 *   code      → site handle key in resources/sites.yaml (e.g. "nl", "en-gb")
 *   locale    → PHP/ICU locale string (e.g. "nl_NL", "en_GB")
 *   name      → human-readable label shown in the language switcher
 *   isDefault → true for exactly one language; its URL is "/" (root), all
 *               others are "/{code}"
 *   enabled   → maps to the Statamic custom attribute showSite: 'true'|'false'
 *               — the site is defined and translatable, but only publicly
 *               visible when enabled.  Allows staging a new language without
 *               going live.
 *
 * When `languages` is absent or empty the platform treats the site as
 * mono-lingual and uses the detected locale from the CMS filesystem.
 */
export interface TenantLanguageConfig {
  readonly code:      string;   // "nl", "en-gb", "de" — site handle + URL slug
  readonly locale:    string;   // "nl_NL", "en_GB", "de_DE" — PHP locale
  readonly name:      string;   // "Nederlands", "English", "Deutsch"
  readonly isDefault: boolean;  // exactly one language should be true; url: /
  readonly enabled:   boolean;  // showSite attribute; false = staged but not live
}

/**
 * Per-tenant Google Calendar booking configuration.
 *
 * No secrets live here — authentication uses the shared platform service
 * account. The tenant only points at a calendar and sets working hours.
 */
export interface TenantCalendarSettings {
  /** When true, this tenant's booking endpoints use the calendar below. */
  readonly enabled?: boolean;
  /**
   * Google Calendar ID to book into / check availability for. Usually the
   * mailbox address of the calendar. The calendar must be shared (with write
   * access) with the platform service-account email.
   */
  readonly calendarId?: string;
  /** IANA timezone for slot generation. Default: "Europe/Amsterdam". */
  readonly bookingTimezone?: string;
  /** First bookable hour, inclusive (24h). Default: 9. */
  readonly bookingHoursStart?: number;
  /** Last hour, exclusive (24h). Default: 17 (last slot 16:30). */
  readonly bookingHoursEnd?: number;
}

/**
 * A tenant-declared domain attribute usable in an AttributeCondition. Declaring
 * an attribute makes it available to the rule editor and lets the page supply it
 * (data-mc-attr-<name> / window.mcAttributes). Attribute values are client-
 * supplied and spoofable: content variation only, never access / pricing /
 * security. See docs/custom-attributes-spec.md.
 */
export interface CustomAttributeDeclaration {
  /** Attribute name. Lowercase [a-z0-9_-], 1..40 chars. Matches customAttributes[name]. */
  readonly name: string;
  /** Value type. Supplied values are coerced to this and dropped if they cannot be. */
  readonly type: "string" | "number" | "boolean";
  /** Optional English label shown in the admin UI (falls back to the name). */
  readonly label?: string;
  /** Optional operator description shown in the editor. */
  readonly description?: string;
  /**
   * Optional allowlist of values (for "string" / "number"). When set, the editor
   * offers these as a dropdown and the server drops any supplied value not in it.
   */
  readonly allowedValues?: readonly (string | number)[];
}

/**
 * One row of a copy variable's value map: turn a raw context value into a
 * human-readable display value. `from` "*" is the catch-all default applied to
 * any non-empty value that no exact row matched.
 */
export interface CopyVariableMapping {
  readonly from: string;
  readonly to:   string;
}

/**
 * A tenant-managed insertable copy variable ({token}) with optional value
 * mapping. Operators manage these on the Variables page; the insert dropdown and
 * the render-time substitution both read this registry. Distinct from
 * CustomAttributeDeclaration (which declares rule-matchable attributes): a copy
 * variable's `source` points at either a curated built-in field or a declared
 * custom attribute, and adds display mapping + fallback on top.
 *
 * Values remain untrusted (visitor-influenced); substitution HTML-escapes and
 * neutralises markup in the resolved, mapped, and fallback values alike.
 */
export interface CopyVariable {
  /** The token inserted in copy as {token}. Lowercase [a-z0-9_-], 1..40 chars. */
  readonly token: string;
  /** English label shown in the insert dropdown (falls back to the token). */
  readonly label?: string;
  /**
   * Where the raw value comes from:
   *   - builtin: a curated FIELD_REGISTRY key (scalar, display-friendly).
   *   - custom:  a declared custom attribute name (coerced to a string).
   */
  readonly source:
    | { readonly kind: "builtin"; readonly key: string }
    | { readonly kind: "custom";  readonly name: string };
  /** Raw -> display value map. `from` "*" is the catch-all default. */
  readonly valueMap?: readonly CopyVariableMapping[];
  /** Display value used when the raw value is empty/missing (before stripping). */
  readonly fallback?: string;
}

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

  /**
   * IANA timezone string for this tenant, e.g. "Europe/Amsterdam" or
   * "America/New_York".  Used to derive time-based context variables
   * (currentHour, dayOfWeek, timeOfDay, seasonalEvent, etc.) in local
   * tenant time rather than raw UTC.
   *
   * Defaults to "UTC" when absent.
   *
   * @example "Europe/Amsterdam", "America/Chicago", "Asia/Tokyo"
   */
  readonly timezone?: string;

  /**
   * Ordered list of languages (Statamic sites) configured for this tenant.
   *
   * When absent or empty the platform treats the site as mono-lingual and
   * falls back to the locale detected from the CMS filesystem.
   *
   * Exactly one entry must have `isDefault: true` — its URL is the root path
   * ("/").  All other entries use "/{code}" as the URL prefix.
   *
   * `enabled: false` stages a language (it is translatable in the CP) but
   * hides it from public site navigation via the Statamic `showSite` attribute.
   *
   * Managed via the Languages panel in the tenant admin settings.
   */
  readonly languages?: readonly TenantLanguageConfig[];

  readonly packageKey:        PackageKey;
  readonly features:          TenantFeatures;
  readonly blocks:            TenantBlocks;

  /**
   * AI decision layer configuration — provider, mode, model, confidence.
   *
   * Platform-level API keys are stored at /admin/platform/integrations/ai.
   * These settings control which mode is active, which provider/model to use,
   * and the per-tenant confidence threshold.
   *
   * The optional `liveProvider.apiKey` / `shadowProvider.apiKey` fields allow a
   * per-tenant API key override — use only when a client brings their own key.
   */
  readonly ai:                TenantAiSettings;

  /**
   * CMS integration settings — provider + per-tenant provider config.
   *
   * Platform-level CMS credentials (write tokens, access tokens) are stored at
   * /admin/platform/integrations/cms.  These settings control which CMS provider
   * this tenant uses and any tenant-specific overrides (projectId, dataset, etc.).
   */
  readonly cms:               TenantCmsSettings;

  /**
   * CRM integration settings — enablement and usage flags.
   *
   * The HubSpot access token lives at /admin/platform/integrations/crm.
   * These flags gate whether that integration runs for this tenant's traffic.
   *
   * When absent, CRM enrichment is disabled for this tenant.
   */
  readonly crm?: TenantCrmSettings;

  /**
   * Enrichment integration settings — geo enrichment enablement.
   *
   * The MaxMind license key lives at /admin/platform/integrations/enrichment.
   * These flags gate whether geo enrichment runs for this tenant's traffic.
   *
   * When absent, enrichment is disabled for this tenant.
   */
  readonly enrichment?: TenantEnrichmentSettings;

  /**
   * Domains and deployment settings for this tenant.
   *
   * The Vercel API token lives at /admin/platform/integrations/domains.
   * This object holds the per-tenant Vercel project mapping for domain
   * provisioning.  Routing hostnames are in primaryDomain / additionalDomains.
   */
  readonly domains?: TenantDomainsSettings;

  /**
   * GA4 integration settings — tracking (event send) and Analytics History.
   *
   * When absent, GA4 tracking and history enrichment are both disabled for
   * this tenant.  Configure tracking.measurementId + tracking.sendMode to
   * enable event sending; configure history.propertyId + history.serviceAccountJson
   * to enable the GA4 Analytics History enrichment stage.
   *
   * ─── Security ─────────────────────────────────────────────────────────────
   *
   *   ga4.tracking.apiSecret and ga4.history.serviceAccountJson are
   *   server-only secrets.  They must never be serialised to a client
   *   component or included in a public API response.
   */
  readonly ga4?: TenantGa4Settings;

  /**
   * Leadinfo client-side enrichment settings.
   *
   * When absent or `enabled: false`, the Leadinfo identify script is not
   * injected into the page.  When enabled, the LeadinfoProvider component
   * runs the Leadinfo Identify API in the visitor's browser and persists the
   * normalised result in the `mc_li` cookie for server-side decision context.
   *
   * `siteToken` is a non-secret public identifier — safe to include in the
   * browser-facing component props.
   */
  readonly leadinfo?: TenantLeadinfoSettings;

  /** Google Tag Manager container — establishes window.dataLayer when set. */
  readonly gtm?: TenantGtmSettings;

  /**
   * Per-tenant Google Calendar demo/appointment booking.
   *
   * Authentication uses the SHARED platform service account (configured under
   * Platform → Integrations → Calendar). The tenant only supplies which calendar
   * to book into plus its working hours, and shares that calendar with the
   * platform service-account email. When absent or `enabled !== true`, the
   * booking endpoints fall back to the platform-level calendar.
   *
   * Configure via the Calendar tab under the tenant's Integrations workspace.
   */
  readonly calendar?: TenantCalendarSettings;

  /**
   * Tenant-level privacy policy.
   *
   * Controls which consent categories the platform may act on for this tenant's
   * visitors, and whether to show the cookie consent banner.
   *
   * When absent: banner is shown, all categories defer to visitor cookie.
   * Configure via the Privacy tab in the tenant admin workspace.
   */
  readonly privacy?: TenantPrivacySettings;

  /**
   * On-site debug overlay visibility settings.
   *
   * When absent the overlay is treated as OFF — no debug information is
   * rendered.  Enable via the Debug tab in the tenant admin workspace.
   */
  readonly debug?: TenantDebugSettings;

  /**
   * A/B experiment runtime settings.
   *
   * When absent, experiments are treated as enabled (preserves legacy
   * behaviour where the engine ran unconditionally).  Disable via the
   * Experiments tab in the tenant admin workspace.
   */
  readonly experiments?: TenantExperimentsSettings;

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

  /**
   * ISO 8601 timestamp (UTC) of the most recent successful full site
   * initialization run via `createSiteAction`.
   *
   * Set after all initialization sections complete: tenant base, design system,
   * CMS pages and variants, site settings, integration baseline, domain baseline.
   * Absent when the tenant has not yet been initialized via "Create starter site".
   *
   * Distinct from `cmsProvisionedAt`, which records CMS-only provisioning.
   */
  readonly siteInitializedAt?: string;

  /**
   * The site archetype chosen during initialization.
   *
   * Acts as a starter preset that drives the recommended template selection —
   * it does NOT gate features or templates after initialization.
   *
   * Optional: absent on tenants created before site-type selection was
   * introduced.  Callers should treat a missing value as "unknown" rather
   * than a specific site type.
   *
   * Typed as string (not SiteType) to avoid a circular import between
   * tenant/types.ts and page-config.  Validated by createSiteAction before use.
   */
  readonly siteType?: string;

  /**
   * The page templates explicitly selected by the operator during site
   * initialization.
   *
   * This is the authoritative provisioning input used by `createSiteAction`.
   * The site type is stored separately as metadata only.
   *
   * When absent (tenants initialized before template selection was introduced),
   * `createSiteAction` falls back to the site preset's `pages` list for
   * backward compatibility.
   */
  readonly selectedTemplates?: readonly TemplateCatalogKey[];

  /**
   * Functionality modules selected by the operator during site initialisation
   * (wizard step 3 — "Functionaliteiten").
   *
   * Values are FunctionalityModuleKey strings from @/page-config.  Stored as
   * plain strings here to avoid a circular import.  In phase 1 these are
   * informational and stored for reporting; future phases can use them to gate
   * block rendering or pre-wire integrations.
   */
  readonly selectedModules?: readonly string[];

  /**
   * Meilisearch (or future search provider) settings for this tenant.
   *
   * When absent or `provider: "none"`, the platform falls back to the
   * SanitySearchProvider → InMemorySearchProvider resolution chain.
   *
   * The Meilisearch API key is stored encrypted in `tenant_search_settings`
   * and is NEVER included in this interface — only a boolean `hasApiKey`
   * flag is surfaced to the client.  Runtime loaders decrypt on demand.
   *
   * Configure at /admin/tenants/[tenantId]/search.
   */
  readonly search?: TenantSearchSettings;

  /**
   * Per-slot AI selection mode configuration (Phase 1 — AI Slot Selector).
   *
   * Controls whether each core content slot (hero / proof / cta) uses AI,
   * rules-only, or a fixed static key.
   *
   * When absent (the default), all slots are "ai-assisted" — the AI may
   * select any slot when the global confidence gates pass.  This matches
   * the pre-Phase-1 behaviour exactly; no migration is required.
   *
   * ─── Relationship to ai.mode ──────────────────────────────────────────────
   *
   *   ai.mode must be "shadow" or "live" for any "ai-assisted" slot to have
   *   effect.  When ai.mode === "disabled" the AI layer does not run at all
   *   and all slots fall through to the rules plan regardless of adaptiveSlots.
   *
   * Configure via /admin/tenants/[tenantId]/behavior/slots.
   */
  readonly adaptiveSlots?: TenantAdaptiveSlotSettings;

  /**
   * Unified AI governance policies — Phase 3.
   *
   * Controls the operational mode (disabled / shadow / live) and confidence
   * thresholds for both Phase 1 (variant selection) and Phase 2 (field fill).
   *
   * ─── Resolution order ───────────────────────────────────────────────────────
   *
   *   For each AI phase:
   *     slot override → aiPolicies → platform env vars → system defaults
   *
   *   Absent fields fall through to the next tier, allowing partial overrides.
   *   For example, a tenant can set only `fieldFill.confidenceThreshold` and
   *   inherit everything else from platform defaults.
   *
   * ─── Relationship to ai.mode ─────────────────────────────────────────────
   *
   *   `ai.mode` (legacy) maps to `aiPolicies.selection.mode` for backward
   *   compatibility.  When `aiPolicies` is set, it takes precedence over
   *   the legacy `ai.mode` for both phases.
   *
   * ─── Backward compatibility ─────────────────────────────────────────────
   *
   *   When this field is absent, the system falls back to the platform
   *   environment variables and then system defaults.  Existing tenants
   *   that rely on `ai.mode` continue to work unchanged.
   *
   * Configure via /admin/tenants/[tenantId]/behavior/ai-policy.
   */
  readonly aiPolicies?: TenantAiPolicies;

  /**
   * AI field fill configuration — Phase 2.
   *
   * Controls whether AI may rewrite individual text fields within a
   * CMS-fetched variant block, and which specific fields are eligible.
   *
   * ─── Relationship to adaptiveSlots ────────────────────────────────────────
   *
   *   adaptiveSlots (Phase 1) controls WHICH variant key is selected.
   *   fieldFill     (Phase 2) controls WHAT text is shown within that variant.
   *
   *   Both phases are independently configurable and can be active, inactive,
   *   or mixed (e.g. rules-only variant selection + AI-enhanced copy).
   *
   * ─── Fail-safe ────────────────────────────────────────────────────────────
   *
   *   Any failure in the field fill pipeline silently returns the original
   *   CMS content.  The variant is always served — field fill is best-effort.
   *
   * ─── Backward compatibility ───────────────────────────────────────────────
   *
   *   When this field is absent from TenantSettings, all slots serve the
   *   original CMS field values without any AI modification — identical to
   *   the pre-Phase-2 behaviour.  No migration required.
   *
   * Configure via /admin/tenants/[tenantId]/behavior/field-fill.
   */
  readonly fieldFill?: TenantFieldFillSettings;

  /**
   * JavaScript snippet integration settings.
   *
   * Enables the one-line `<script>` tag integration mode: a small async
   * JavaScript snippet fetches personalised variant content from the
   * `/api/snippet/decide` endpoint and swaps it into DOM elements marked
   * with `data-mc-slot` attributes — without any server-side rendering.
   *
   * ─── Use case ─────────────────────────────────────────────────────────────
   *
   *   Existing websites, SPAs, and non-Next.js frameworks that cannot adopt
   *   the full server-rendering pipeline.  Drop one `<script>` tag into the
   *   `<head>` and add `data-mc-slot="hero-title"` attributes to the elements
   *   you want to personalise.  The snippet does the rest.
   *
   * ─── Site key ─────────────────────────────────────────────────────────────
   *
   *   `siteKey` is a public identifier (not a secret) embedded in the snippet
   *   script tag.  It identifies the tenant when the browser calls the decide
   *   endpoint.  Format: `sk_live_<random>`.
   *
   *   Generate via /admin/tenants/[tenantId]/snippet or the
   *   `generateSnippetSiteKeyAction` server action.
   *
   * ─── Security ─────────────────────────────────────────────────────────────
   *
   *   The site key is intentionally public — it is embedded in the page HTML.
   *   It gates which variant content the decide endpoint returns, but does not
   *   grant access to any admin or write operations.
   *
   * Configure via /admin/tenants/[tenantId]/snippet.
   */
  readonly snippet?: TenantSnippetSettings;

  /**
   * Tenant-declared domain attributes usable in rule conditions (an
   * AttributeCondition), e.g. Cluistra: massa / categorie / occasion. Declaring
   * an attribute here is what lets a page supply it (data-mc-attr-<name> or
   * window.mcAttributes) and a rule match on it, without adding a named field to
   * the shared FIELD_REGISTRY. Undeclared attribute names are ignored server-side.
   *
   * Values are client-supplied and spoofable: content variation only, never
   * access / pricing / security. See docs/custom-attributes-spec.md.
   *
   * Configure via /admin/tenants/[tenantId]/personalization.
   */
  readonly customAttributes?: readonly CustomAttributeDeclaration[];

  /**
   * Managed copy-variable registry: the insertable {tokens} for body copy with
   * per-variable value mapping + fallback. When absent/empty the platform falls
   * back to the implicit default (curated built-ins + string custom attributes).
   * Managed on /personalization/variables. Stored in settings.copyVariables.
   */
  readonly copyVariables?: readonly CopyVariable[];

  /**
   * Ad-network role. When "advertiser", this tenant's siteKey is embedded by
   * *publisher* sites and its adaptive slots are served as ads (see lib/ads).
   * Absent = a normal site tenant. Stored in settings.tenantRole.
   */
  readonly tenantRole?: "advertiser";

  /**
   * Billing mode. "usage_ads" meters ad impressions/clicks against the wallet
   * and skips the per-session subscription/dunning gate; the default
   * ("subscription", or absent) keeps the normal session-based billing.
   * Stored in settings.billingMode.
   */
  readonly billingMode?: "subscription" | "usage_ads";

  /**
   * Advertiser only: which adaptive slot types this ad account offers to
   * publishers (subset of hero/proof/cta/feature/conversion/notification).
   * Drives the publisher embed code and which slots ads can be created for.
   * Absent = all slots. Stored in settings.adSlots.
   */
  readonly adSlots?: readonly string[];

  /**
   * Adaptive email triggers. `onFormSubmit` (opt-in, default off) sends the
   * chosen adaptive email template to a form submitter after capture — the live
   * form-submit trigger. Stored in settings.adaptiveEmail.
   */
  readonly adaptiveEmail?: {
    readonly onFormSubmit?: { readonly enabled: boolean; readonly templateKey: string };
  };

  /**
   * Advertiser only: per-tenant CPM/CPC rate-card override (cents). Set by a
   * platform super-admin; overrides the global platform rate-card for this
   * advertiser's ads. Absent (or a missing field) = inherit the global rate.
   * The advertiser can never set this. Stored in settings.adRateCard.
   */
  readonly adRateCard?: { readonly cpmCents?: number; readonly cpcCents?: number };

  /**
   * Per-tenant adaptive-email template overrides, keyed by template key. Each
   * entry may override the subject line and/or the block set (which adaptive
   * blocks, in what order). Block CONTENT still comes from the adaptive blocks
   * library. Absent = use the code default (EMAIL_TEMPLATES). Stored in
   * settings.emailTemplates.
   */
  readonly emailTemplates?: Record<string, { subject?: string; blocks?: string[]; preheader?: string }>;

  /**
   * Asset storage override for this tenant.
   *
   * When set, the specified provider is used instead of the platform-wide
   * default for all asset uploads by this tenant.  The actual provider
   * credentials (R2 keys, Supabase token, Sanity write token) remain stored
   * at the platform level — only the active provider selection is per-tenant.
   *
   * Resolution order:
   *   1. tenant.storage.activeProvider  (this field)
   *   2. platform_settings.storage.activeProvider  (platform default)
   *   3. Auto-detection from env vars
   *   4. "supabase_storage" (last resort)
   *
   * Configure via /admin/tenants/[tenantId]/storage.
   */
  readonly storage?: TenantStorageSettings;

  /**
   * Per-tenant deploy settings (Statamic tenants only).
   *
   * `cmsDeployHookUrl` is this tenant's Ploi deploy webhook — each Statamic
   * instance has its own. Used by the "Deploy CMS" button on the tenant setup
   * page to trigger git pull + composer install + `php please mc:sync`.
   *
   * Configure via /admin/tenants/[tenantId]/setup.
   */
  readonly deploy?: TenantDeploySettings;
}

// ── Storage settings ───────────────────────────────────────────────────────────

/**
 * Per-tenant asset storage configuration.
 *
 * Overrides the platform-wide active provider for this tenant's asset uploads.
 * All provider credentials remain at platform level.
 */
export interface TenantStorageSettings {
  /**
   * Override the active storage provider for this tenant.
   * null or absent = use platform default.
   */
  activeProvider?: "cloudflare_r2" | "supabase_storage" | "sanity_assets" | null;
}

// ── Snippet settings ───────────────────────────────────────────────────────────

/**
 * JavaScript snippet integration settings for a tenant.
 *
 * See TenantSettings.snippet for full documentation.
 */
export interface TenantDeploySettings {
  /**
   * Ploi deploy webhook URL for this tenant's Statamic instance.
   * A capability URL (a secret) — server-only, never sent to the client.
   * POSTing to it runs the instance's deploy script (git pull + composer install
   * + `php please mc:sync` + cache clear).
   */
  cmsDeployHookUrl?: string;
}

export interface TenantSnippetSettings {
  /**
   * Whether the snippet integration is enabled for this tenant.
   * When false, the `/api/snippet/decide` endpoint rejects requests from this
   * tenant's site key with a 403.
   * @default false
   */
  enabled?: boolean;

  /**
   * Public site key embedded in the `<script>` tag.
   * Format: `sk_live_<random>`.
   * Generated by `generateSnippetSiteKeyAction`.
   * Absent until the operator generates a key for the first time.
   */
  siteKey?: string;

  /**
   * ISO 8601 timestamp (UTC) when the site key was last generated or
   * regenerated.  Used to show "Generated on …" in the admin UI.
   */
  siteKeyGeneratedAt?: string;

  /**
   * Slot-key → CSS selector map. Lets a slot target an element on the tenant's
   * site that carries no `data-mc-slot` attribute — the mechanism that makes the
   * snippet usable inside CMSes where the markup can't be edited (WordPress page
   * builders, etc.). Returned to the snippet as the response `selectors` map.
   *
   * This is a TRUSTED source: selectors are set by the operator in the admin UI,
   * never derived from visitor input.
   *
   * See docs/design/snippet-wordpress-plugin.md.
   * @example { "hero-title": ".hero h1", "cta-cta-label": "a.btn-primary" }
   */
  selectorMap?: Record<string, string>;

  /**
   * Allowlist of hostnames the snippet is permitted to call `/api/snippet/decide`
   * from. Each entry is a bare hostname (e.g. "nascita.nl", "www.nascita.nl").
   *
   * The site key is a PUBLIC identifier embedded in the snippet, so without this
   * anyone could POST it from any origin to run up a tenant's usage/costs. When
   * this list is non-empty the decide endpoint rejects (403) any request whose
   * `Origin` (or `Referer`) host is not on it.
   *
   * Opt-in by design: an EMPTY/absent list means "no origin restriction" so
   * existing tenants are never broken. Once the operator adds at least one host,
   * enforcement is strict. Matching is case-insensitive and treats a leading
   * "www." as equivalent to the apex; every other subdomain must be listed
   * explicitly.
   *
   * Note: an Origin header can be forged by a non-browser client (curl), so this
   * is defence-in-depth against browser-based abuse, layered on top of the
   * per-site-key rate limiting — not an airtight guarantee.
   */
  allowedSnippetOrigins?: readonly string[];

  /**
   * How long (ms) the snippet keeps the page hidden waiting for the decision
   * before revealing the default. A late decision is still applied (a swap),
   * so this only controls how long we wait to avoid a visible swap. Baked into
   * the embed as `data-mc-reveal-ms`. Absent → snippet default (700).
   * Clamped in the snippet to 0–5000.
   */
  revealMs?: number;

  /**
   * Hard upper bound (ms) on the decide request before the snippet aborts it.
   * Raise it for a slow or low-traffic backend where the cold-start decide +
   * first TLS handshake can exceed the default. Baked into the embed as
   * `data-mc-call-ms`. Absent → snippet default (4000). Clamped to 500–15000.
   */
  callMs?: number;

  /**
   * How the visitor's consent (read from the host page by the snippet) is applied
   * when the host sends NO consent signal at all.
   *
   *   "auto"   — deny by default (privacy-first). Enrichment, behavioural
   *              personalization and analytics stay off until a host CMP signal
   *              (publisher signal, IAB TCF, Google Consent Mode) or an explicit
   *              grant says otherwise. The default for new tenants.
   *   "always" — grant by default. For hosts that gate loading the snippet behind
   *              their own consent banner (the pre-CMP-integration behaviour).
   *              Existing snippet tenants are migrated to this so they do not
   *              suddenly stop enriching/personalising.
   *
   * An explicit host signal (including GPC/DNT, which always denies) is honoured
   * in BOTH modes; consentSource only decides the no-signal fallback. The tenant
   * privacy ceiling (TenantSettings.privacy.allow*) is applied on top in both.
   * Absent -> treated as "auto". See docs/design/host-cmp-consent.md.
   */
  consentSource?: "auto" | "always";
}
