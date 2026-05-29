/**
 * Platform Settings Store
 *
 * Server-only module for reading and writing platform-wide integration secrets.
 * Backed by the `platform_settings` Supabase table.
 *
 * ─── Security contract ────────────────────────────────────────────────────────
 *
 *   This module MUST only be imported in server contexts (server components,
 *   server actions, API routes).  It must NEVER be imported by client
 *   components — if a "use client" boundary is accidentally included in the
 *   import chain, Next.js will bundle this module into the client bundle,
 *   potentially exposing secrets.
 *
 *   Callers that need to surface status to the client must use the boolean-flag
 *   helpers exported from this module (e.g. sanityFlags) rather than passing
 *   the raw settings object across the boundary.
 *
 * ─── Storage layout ───────────────────────────────────────────────────────────
 *
 *   Table: platform_settings
 *   One row per integration section, keyed by a well-known string:
 *
 *     key = "sanity"  → PlatformSanitySettings
 *     key = "maxmind" → PlatformMaxMindSettings  (reserved for future use)
 *     key = "ai"      → PlatformAiSettings        (reserved for future use)
 *     key = "vercel"  → PlatformVercelSettings    (reserved for future use)
 *
 * ─── Fallback behaviour ───────────────────────────────────────────────────────
 *
 *   When a row is absent the getter returns an empty object (`{}`).
 *   Callers treat missing fields as "not configured" — no default secrets are
 *   injected from this module.
 *
 * ─── Env-var interplay ────────────────────────────────────────────────────────
 *
 *   Platform settings stored here are intended to supplement or replace
 *   environment variables.  The resolution order (highest priority first) is:
 *
 *     1. Per-tenant override (e.g. TenantSettings.cms.writeToken)
 *     2. This store            (platform_settings row)
 *     3. Environment variable  (SANITY_API_WRITE_TOKEN, SANITY_WRITE_TOKEN, …)
 *
 *   Implementing that priority chain is the responsibility of the callers
 *   (e.g. cms/seed/tenant-provisioner.ts).  This module only handles
 *   persistence — it makes no decisions about precedence.
 */

import { getDb } from "@/data/db";

// ── Integration section types ──────────────────────────────────────────────────

/**
 * Platform-wide Sanity CMS settings.
 *
 * Supplements / overrides the SANITY_PROJECT_ID, SANITY_DATASET,
 * SANITY_API_VERSION, and SANITY_API_WRITE_TOKEN environment variables.
 *
 * `writeToken` and `readToken` are server-only secrets — strip them before
 * crossing the server→client boundary.  Use `sanityFlags()` for safe
 * client-facing status.
 *
 * ─── Resolution order (highest priority first) ────────────────────────────
 *
 *   1. Per-tenant override (TenantSettings.cms fields)
 *   2. This store (platform_settings row)
 *   3. Environment variable (SANITY_PROJECT_ID, SANITY_DATASET, …)
 */
export interface PlatformSanitySettings {
  /** Sanity project ID, e.g. "in3s2m2m". */
  projectId?:   string;
  /** Sanity dataset name, e.g. "production". */
  dataset?:     string;
  /**
   * Sanity API version string, e.g. "2024-01-01".
   * Supplements SANITY_API_VERSION env var.
   * Defaults to "2024-01-01" when not set in either DB or env.
   */
  apiVersion?:  string;
  /**
   * Sanity API read token (for reading non-public / private datasets).
   * SERVER ONLY — must never be serialised to the client.
   * Supplements SANITY_READ_TOKEN / SANITY_API_TOKEN env vars.
   * Takes priority over the env fallbacks when present.
   */
  readToken?:   string;
  /**
   * Sanity API write token.
   * SERVER ONLY — must never be serialised to the client.
   * If present, takes priority over SANITY_API_WRITE_TOKEN env var when no
   * per-tenant token is configured.
   */
  writeToken?:  string;
}

/**
 * Platform-wide MaxMind GeoIP settings (reserved for future use).
 *
 * `licenseKey` is a server-only secret.
 */
export interface PlatformMaxMindSettings {
  /** MaxMind account ID. */
  accountId?:   string;
  /**
   * MaxMind license key.
   * SERVER ONLY — must never be serialised to the client.
   */
  licenseKey?:  string;
}

/**
 * Platform-wide AI provider keys (reserved for future use).
 *
 * Both keys are server-only secrets.
 */
export interface PlatformAiSettings {
  /**
   * Anthropic API key — platform-level fallback.
   * SERVER ONLY — must never be serialised to the client.
   */
  anthropicKey?: string;
  /**
   * OpenAI API key — platform-level fallback.
   * SERVER ONLY — must never be serialised to the client.
   */
  openaiKey?:    string;
  /**
   * Mister Chameleon demo tenant snippet site key (MC_DEMO_SITE_KEY).
   * Used by the Mirror Demo generator to identify which tenant/site key
   * the injected snippet should use when calling /api/snippet/decide.
   * SERVER ONLY — must never be serialised to the client.
   */
  demoSiteKey?:  string;
}

/**
 * Platform-wide Vercel integration settings (reserved for future use).
 *
 * `apiToken` is a server-only secret.
 */
export interface PlatformVercelSettings {
  /**
   * Vercel API token.
   * SERVER ONLY — must never be serialised to the client.
   */
  apiToken?: string;
  /** Vercel team ID, e.g. "team_abc123". */
  teamId?:   string;
}

/**
 * Platform-wide CRM integration settings.
 *
 * Currently supports HubSpot Private App authentication.
 * `accessToken` is a server-only secret — strip it before crossing the
 * server→client boundary. Use `crmFlags()` for safe client-facing status.
 */
export interface PlatformCrmSettings {
  /**
   * CRM provider name.
   * Currently only "hubspot" is implemented.
   * Stored to support future multi-provider selection.
   */
  provider?: "hubspot";
  /**
   * HubSpot Private App access token.
   * SERVER ONLY — must never be serialised to the client.
   * Format: "pat-na1-…" (HubSpot Private App token).
   */
  accessToken?: string;
}

/**
 * Platform-wide Storyblok CMS settings.
 *
 * These supplement / replace the STORYBLOK_ACCESS_TOKEN and STORYBLOK_REGION
 * environment variables.
 *
 * `accessToken` is a server-only secret — strip it before crossing the
 * server→client boundary.  Use `storyblokFlags()` for safe client-facing status.
 */
export interface PlatformStoryblokSettings {
  /**
   * Storyblok Content Delivery API access token (preview or public token).
   * SERVER ONLY — must never be serialised to the client.
   * Supplements STORYBLOK_ACCESS_TOKEN env var.
   */
  accessToken?: string;
  /**
   * Storyblok CDN region.
   * "eu" | "us" | "ap" | "ca" | "cn" (default: "eu").
   * Non-secret — safe to pass to client.
   */
  region?: string;
  /**
   * Draft / published content version.
   * "published" | "draft" (default: "published").
   * Non-secret — safe to pass to client.
   */
  version?: string;
  /**
   * Storyblok Management API personal access token.
   * Required for provisioning (creating/updating stories via the Management API).
   * SERVER ONLY — must never be serialised to the client.
   * Supplements STORYBLOK_MANAGEMENT_TOKEN env var.
   */
  managementToken?: string;
  /**
   * Storyblok numeric space ID.
   * Required for all Management API calls.
   * Non-secret — safe to pass to client.
   * Supplements STORYBLOK_SPACE_ID env var.
   */
  spaceId?: string;
}

/**
 * Platform-wide Statamic CMS settings.
 *
 * These supplement / replace the STATAMIC_API_URL and STATAMIC_API_KEY
 * environment variables.
 *
 * `apiKey` is a server-only secret — strip it before crossing the
 * server→client boundary.  Use `statamicFlags()` for safe client-facing status.
 */
export interface PlatformStatamicSettings {
  /**
   * Base URL of the Statamic site (e.g. "https://cms.example.com").
   * Non-secret — safe to pass to client.
   * Supplements STATAMIC_API_URL env var.
   */
  baseUrl?: string;
  /**
   * Statamic REST API key / Bearer token for protected API access.
   * SERVER ONLY — must never be serialised to the client.
   * Supplements STATAMIC_API_KEY env var.
   */
  apiKey?: string;
}

/**
 * Platform-wide enrichment provider credentials.
 *
 * Stores API keys for IP-to-company and network enrichment providers.
 * All keys are server-only secrets — strip them before crossing the
 * server→client boundary.  Use `enrichmentFlags()` for safe client-facing status.
 *
 * Resolution priority (highest first):
 *   1. Platform store (this object)
 *   2. Environment variable (CLEARBIT_SECRET_KEY, IPINFO_TOKEN, LEADINFO_API_KEY)
 */
export interface PlatformEnrichmentSettings {
  /**
   * Clearbit Reveal secret key for IP-to-company firmographic lookup.
   * SERVER ONLY — must never be serialised to the client.
   * Format: "sk_live_…"
   */
  clearbitSecretKey?: string;
  /**
   * IPinfo API token for ASN / network-org enrichment.
   * SERVER ONLY — must never be serialised to the client.
   */
  ipinfoToken?: string;
  /**
   * Leadinfo API key for IP-to-company enrichment.
   * SERVER ONLY — must never be serialised to the client.
   */
  leadinfoApiKey?: string;
  /**
   * overheid.io API key (header: ovio-api-key) for the OpenKvK Dutch company
   * registry endpoint at api.overheid.io/v3/openkvk.
   * SERVER ONLY — must never be serialised to the client.
   * Register for free at https://overheid.io/register.
   */
  ovioApiKey?: string;
  /**
   * Official KvK (Kamer van Koophandel) Zoeken API key for the Dutch company
   * registry endpoint at api.kvk.nl/api/v2/zoeken.
   * SERVER ONLY — must never be serialised to the client.
   * Zoeken queries are free (€0/query); subscription €6.40/month.
   * Register at https://developers.kvk.nl.
   */
  kvkApiKey?: string;
}

/**
 * Platform-wide OpenKvK (Dutch company registry) enrichment settings.
 *
 * Controls how the OpenKvK stage behaves in the enrichment pipeline.
 * All fields are non-secret and safe to pass to client components via
 * `openKvKFlags()`.
 */
export interface PlatformOpenKvKSettings {
  /**
   * Operating mode for the OpenKvK enrichment stage.
   *
   *   "off"     — Stage is entirely disabled (default).
   *   "nl-only" — Stage runs only for visitors with countryCode === "NL".
   *   "always"  — Stage always runs, regardless of detected country.
   *               Useful when MaxMind / IPinfo geo data is unavailable.
   */
  mode?: "off" | "nl-only" | "always";
  /**
   * Minimum confidence score (0–1) required for OpenKvK match results to be
   * written into the enrichment output.
   *
   * Default: 0.5  (matches the hard-coded value in the provider).
   *
   * Lower values accept more speculative matches; higher values are stricter.
   * Set to 0 to accept all results regardless of confidence.
   */
  confidenceThreshold?: number;
  /**
   * Which upstream field to prefer as the OpenKvK search query.
   *
   *   "networkOrg"    — Use the ISP/org name from IPinfo (default).
   *   "companyName"   — Use a company name already resolved by a prior stage.
   *   "networkDomain" — Use the network domain from IPinfo as a fallback.
   *
   * The provider always falls back through all three in priority order;
   * this setting only controls which is tried first.
   */
  matchingStrategy?: "networkOrg" | "companyName" | "networkDomain";
}

/**
 * Platform-wide holiday provider settings (Nager.Date public holiday API).
 *
 * Controls the seasonal event enrichment stage that runs after all geo/company
 * stages and populates the `seasonalEvent` context variable.
 *
 * All fields are non-secret and safe to pass to client components via
 * `holidayFlags()`.
 */
export interface PlatformHolidaySettings {
  /**
   * Whether the holiday provider stage is enabled.
   * When false (default), the seasonal event stage is skipped entirely.
   */
  enabled?: boolean;
  /**
   * Cache TTL for Nager.Date API responses, in hours.
   *
   * Default: 24 hours.  Results are keyed by countryCode + year so a single
   * entry covers the entire year for a given country.
   * Setting a shorter TTL increases API call frequency; longer TTL reduces it.
   */
  cacheTtlHours?: number;
  /**
   * Comma-separated list of ISO 3166-1 alpha-2 country codes to enable
   * holiday detection for (e.g. "NL,DE,BE,GB").
   *
   * When set, the seasonal event stage is only run for visitors whose resolved
   * `countryCode` appears in this list.
   * When absent or empty, all countries supported by Nager.Date are eligible.
   */
  countriesFilter?: string;
}

/**
 * Platform-wide Reverse Geocode enrichment settings.
 *
 * Controls the ReverseGeocodeEnricher stage that resolves lat/lng coordinates
 * (produced by the geo stage) into human-readable address fields.
 *
 * The enricher runs AFTER the geo stage and DOES NOT participate in company
 * identification — it is a standalone address/location enricher.
 *
 * Provider fallback order:
 *   1. LocationIQ  — requires `locationIqApiKey`  (highest quality)
 *   2. BigDataCloud — no key required             (good fallback, 10k req/month free)
 *   3. Nominatim   — no key required, OSM data    (rate-limited tertiary fallback)
 */
export interface PlatformReverseGeocodeSettings {
  /**
   * Whether the reverse-geocode enrichment stage is enabled.
   * When false (default), the stage is skipped entirely.
   */
  enabled?: boolean;
  /**
   * LocationIQ API key for the primary reverse-geocode provider.
   * SERVER ONLY — must never be serialised to the client.
   * Obtain a free key at locationiq.com.
   * When absent, the chain starts at BigDataCloud.
   */
  locationIqApiKey?: string;
  /**
   * Cache TTL for reverse-geocode results, in hours.
   * Default: 6 hours.  Address data for a given coordinate is highly stable;
   * a longer TTL reduces API call frequency at the cost of slightly stale data
   * for very recently changed administrative boundaries.
   */
  cacheTtlHours?: number;
}

// ── PlatformGa4HistorySettings ─────────────────────────────────────────────────

/**
 * Platform-wide GA4 Analytics History enrichment settings.
 *
 * Controls the GA4 History enricher stage that looks up a returning visitor's
 * historical session data (city, region, country, session count, channel group)
 * from Google Analytics 4 using the Data API.
 *
 * This enricher is a *secondary / history* source — it never overwrites live
 * geo fields resolved by the IP-geo stage.  It writes only to the `ga*`-prefixed
 * context fields.
 *
 * `serviceAccountJson` is a server-only secret — strip it before crossing the
 * server→client boundary.  Use `ga4HistoryFlags()` for safe client-facing status.
 */
export interface PlatformGa4HistorySettings {
  /**
   * Whether the GA4 History enrichment stage is enabled.
   * When false (default), the stage is skipped entirely.
   */
  enabled?: boolean;

  /**
   * Google Analytics 4 property ID (numeric string, e.g. "123456789").
   * Found in GA4 Admin → Property Settings.
   * Non-secret — safe to pass to client.
   */
  propertyId?: string;

  /**
   * Full contents of the Google service account JSON key file as a string.
   * SERVER ONLY — must never be serialised to the client.
   *
   * The service account must have "Viewer" access to the GA4 property.
   * Download from Google Cloud Console → IAM → Service Accounts → Keys.
   */
  serviceAccountJson?: string;

  /**
   * Name of the User-scoped custom dimension in GA4 used to store the
   * first-party visitor ID (e.g. "visitor_id").
   * The "customUser:" prefix is added automatically by the enricher if absent.
   * Default: "visitor_id"
   */
  visitorIdDimension?: string;

  /**
   * How far back (in days) to look for GA4 sessions for a given visitor.
   * Larger values surface more returning visitors at the cost of slower queries.
   * Default: 90
   */
  lookbackDays?: number;

  /**
   * Cache TTL for GA4 results, in minutes.
   * Results are cached per visitorId to avoid redundant API calls within a
   * session.  Default: 30 minutes.
   */
  cacheTtlMinutes?: number;

  // ── GA4 Tracking (send) ──────────────────────────────────────────────────────

  /**
   * GA4 Measurement ID used for client-side (gtag) or server-side tracking.
   * E.g. "G-XXXXXXXXXX".  Non-secret — safe to pass to the client.
   */
  measurementId?: string;

  /**
   * Name of the visitor ID parameter used in GA4 user properties and the
   * matching custom dimension in the GA4 Data API query.
   * Must match the custom dimension name configured in GA4 Admin.
   * Default: "visitor_id"
   */
  visitorIdParamName?: string;

  /**
   * How GA4 tracking events are sent.
   *   "off"    — no tracking (default)
   *   "client" — inject gtag.js and fire events from the browser
   *   "server" — reserved for future Measurement Protocol support
   */
  sendMode?: "off" | "client" | "server";
}

// ── PlatformWeatherSettings ────────────────────────────────────────────────────

export interface PlatformWeatherSettings {
  /**
   * Whether the weather enrichment stage is enabled.
   * When false (default), the stage is skipped entirely.
   * No API key required — uses the free Open-Meteo API.
   */
  enabled?: boolean;
  /**
   * Cache TTL for weather results, in hours.
   * Default: 1 hour.  Weather data changes faster than address data;
   * a shorter TTL keeps results reasonably fresh without hammering the API.
   */
  cacheTtlHours?: number;
}

/**
 * Platform-wide email transport settings.
 *
 * Stored under the key "email" in `platform_settings`.  Provides the default
 * transport configuration for all form email delivery when no per-tenant
 * override is configured in `tenant_email_transport`.
 *
 * Secrets (resendApiKey, smtpPassword) are stored encrypted at the application
 * layer (lib/email-crypto.ts) and must be decrypted before use.
 * SERVER ONLY — never return raw secrets to the client.  Use emailPlatformFlags().
 *
 * Resolution order at send-time:
 *   1. Per-tenant DB config  (tenant_email_transport)
 *   2. This config           (platform_settings.email)
 *   3. Env vars              (RESEND_API_KEY / SMTP_HOST)
 *   4. None — silent skip
 */
export interface PlatformEmailSettings {
  /** Selected transport: "resend" | "smtp" | "none". */
  transportType?: "resend" | "smtp" | "none";
  /** Display name for the From address, e.g. "Acme Platform". */
  fromName?:       string;
  /** From address, e.g. "hello@acme.com". */
  fromEmail?:      string;
  /**
   * Platform-level backoffice notification address.
   * Falls through to BACKOFFICE_EMAIL env var when absent.
   * SERVER-SAFE — not a secret; can be shown in the UI.
   */
  backofficeEmail?: string;
  // ── Resend ──────────────────────────────────────────────────────────────────
  /** Resend API key. SERVER ONLY — encrypted at rest. */
  resendApiKey?:   string;
  // ── SMTP ────────────────────────────────────────────────────────────────────
  /** SMTP server hostname. */
  smtpHost?:       string;
  /** SMTP port (default 587). */
  smtpPort?:       number;
  /** SMTP auth username. */
  smtpUsername?:   string;
  /** SMTP auth password. SERVER ONLY — encrypted at rest. */
  smtpPassword?:   string;
  /** Use implicit TLS (port 465) when true; STARTTLS when false. */
  smtpSecure?:     boolean;
}

/**
 * Platform-wide Stripe payment integration settings.
 *
 * Stores the three credentials required to run the Stripe integration:
 * a publishable key (safe to expose to browsers), a secret key (server-only),
 * and a webhook signing secret (server-only).
 *
 * ─── Key format reference ─────────────────────────────────────────────────────
 *
 *   Publishable key:   pk_live_…  or  pk_test_…
 *   Secret key:        sk_live_…  or  sk_test_…
 *   Webhook secret:    whsec_…
 *
 * ─── Webhook URL ──────────────────────────────────────────────────────────────
 *
 *   Register exactly ONE webhook endpoint in the Stripe Dashboard:
 *     https://<your-domain>/api/webhooks/stripe
 *
 *   The webhook secret is generated by Stripe when you create the endpoint.
 *
 * ─── Secret handling ──────────────────────────────────────────────────────────
 *
 *   `secretKey` and `webhookSecret` are SERVER ONLY — they must never be
 *   serialised to the client.  Use `stripeFlags()` for safe client-facing status.
 *   `publishableKey` is safe to pass to the client (it is public by design).
 */
export interface PlatformStripeSettings {
  /**
   * Stripe publishable key (pk_live_… or pk_test_…).
   * Safe to expose to the browser — used to initialise Stripe.js.
   * Supplements the NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY env var.
   */
  publishableKey?: string;
  /**
   * Stripe secret API key (sk_live_… or sk_test_…).
   * SERVER ONLY — used for server-side Stripe API calls.
   * Supplements the STRIPE_SECRET_KEY env var.
   */
  secretKey?: string;
  /**
   * Stripe webhook signing secret (whsec_…).
   * SERVER ONLY — used to verify incoming webhook signatures in /api/webhooks/stripe.
   * Supplements the STRIPE_WEBHOOK_SECRET env var.
   */
  webhookSecret?: string;

  // ── Credit bundle Price IDs ──────────────────────────────────────────────────
  //
  // Stripe Price IDs for one-time credit bundle purchases.
  // These supplement the STRIPE_PRICE_CREDITS_* environment variables.
  // Resolved at runtime: env var (highest priority) → this store → undefined.
  //
  // Format: price_xxx (Stripe Dashboard → Products → Prices)

  /**
   * Stripe Price ID for the 250-credit bundle.
   * Supplements STRIPE_PRICE_CREDITS_250 env var.
   */
  creditBundle250PriceId?:  string;
  /**
   * Stripe Price ID for the 1,000-credit bundle.
   * Supplements STRIPE_PRICE_CREDITS_1000 env var.
   */
  creditBundle1000PriceId?: string;
  /**
   * Stripe Price ID for the 5,000-credit bundle.
   * Supplements STRIPE_PRICE_CREDITS_5000 env var.
   */
  creditBundle5000PriceId?: string;

  // ── Subscription plan Price IDs ──────────────────────────────────────────────
  //
  // Stripe Price IDs for recurring subscription plans.
  // These supplement the STRIPE_PRICE_<PLAN>_MONTHLY / _ANNUAL env vars and the
  // billing_plans DB table.  Resolution order (highest first):
  //   1. STRIPE_PRICE_<PLAN>_MONTHLY/ANNUAL env var  (production / CI)
  //   2. STRIPE_TEST_PRICE_<PLAN>_MONTHLY/ANNUAL env var  (test mode)
  //   3. platform_settings DB  ← these fields
  //   4. billing_plans DB table  (per-plan row; separate admin screen)
  //
  // Non-secret — safe to read client-side (they are Stripe Price IDs, not keys).
  // Format: price_xxx

  /** Starter plan — monthly recurring. Supplements STRIPE_PRICE_STARTER_MONTHLY. */
  planStarterMonthlyPriceId?: string;
  /** Starter plan — annual recurring. Supplements STRIPE_PRICE_STARTER_ANNUAL. */
  planStarterAnnualPriceId?:  string;
  /** Growth plan — monthly recurring. Supplements STRIPE_PRICE_GROWTH_MONTHLY. */
  planGrowthMonthlyPriceId?:  string;
  /** Growth plan — annual recurring. Supplements STRIPE_PRICE_GROWTH_ANNUAL. */
  planGrowthAnnualPriceId?:   string;
  /** Pro plan — monthly recurring. Supplements STRIPE_PRICE_PRO_MONTHLY. */
  planProMonthlyPriceId?:     string;
  /** Pro plan — annual recurring. Supplements STRIPE_PRICE_PRO_ANNUAL. */
  planProAnnualPriceId?:      string;
}

/**
 * Platform-wide asset storage configuration.
 *
 * Determines which storage backend is used for new tenant asset uploads.
 * Stored under the key "storage" in `platform_settings`.
 *
 * ─── Provider overview ────────────────────────────────────────────────────────
 *
 *   cloudflare_r2    — Cloudflare R2 (zero-egress, S3-compatible).
 *                      Requires account ID, access key, secret key, bucket, public URL.
 *   supabase_storage — Supabase Storage.
 *                      Uses existing Supabase project credentials.
 *                      Configurable bucket name (default: "tenant-assets").
 *   sanity_assets    — Read-only Sanity CDN assets.
 *                      No upload support; used for browsing CMS-sourced images.
 *                      Auto-detected when Sanity is configured.
 *
 * ─── Secret handling ──────────────────────────────────────────────────────────
 *
 *   cloudflareR2.secretAccessKey is SERVER ONLY.
 *   Strip it before crossing the server→client boundary.
 *   Use `storageProviderFlags()` for safe client-facing status.
 *
 * ─── Resolution order for active provider ────────────────────────────────────
 *
 *   1. platform_settings.storage.activeProvider  (this config)
 *   2. Env vars (R2_ACCOUNT_ID set → "cloudflare_r2")
 *   3. Sanity configured → "sanity_assets" (read-only fallback)
 *   4. "supabase_storage" (always available as last resort)
 */
export interface PlatformStorageSettings {
  /**
   * Which provider handles new asset uploads.
   * null / undefined = auto-detect (see resolution order above).
   */
  activeProvider?: "cloudflare_r2" | "supabase_storage" | null;

  /** Cloudflare R2 provider credentials. */
  cloudflareR2?: {
    /** Cloudflare account ID. Non-secret. */
    accountId?:        string;
    /** R2 API token Access Key ID. Non-secret. */
    accessKeyId?:      string;
    /**
     * R2 API token Secret Access Key.
     * SERVER ONLY — encrypted at rest, never returned to client.
     */
    secretAccessKey?:  string;
    /** R2 bucket name. Non-secret. */
    bucketName?:       string;
    /** Public base URL for asset delivery (no trailing slash). Non-secret. */
    publicUrl?:        string;
  };

  /** Supabase Storage provider settings. */
  supabaseStorage?: {
    /**
     * Bucket name to use for tenant assets.
     * Defaults to "tenant-assets" when absent.
     */
    bucketName?: string;
    /**
     * Whether the bucket is publicly accessible.
     * When true, public URLs are used directly.
     * When false, signed URLs are generated per request.
     * Defaults to true.
     */
    isPublic?: boolean;
  };
}

// ── Well-known keys ────────────────────────────────────────────────────────────

const KEYS = {
  sanity:          "sanity",
  maxmind:         "maxmind",
  ai:              "ai",
  vercel:          "vercel",
  crm:             "crm",
  storyblok:       "storyblok",
  statamic:        "statamic",
  enrichment:      "enrichment",
  openkvk:         "openkvk",
  holidays:        "holidays",
  reverseGeocode:  "reverse-geocode",
  weather:         "weather",
  ga4History:      "ga4-history",
  email:           "email",
  stripe:          "stripe",
  storage:         "storage",
  contentBudget:   "content_budget",
  googleCalendar:  "google-calendar",
} as const;

// ── Generic read / write ───────────────────────────────────────────────────────

/**
 * Result of reading a platform settings section.
 *
 * `updatedAt` is the ISO-8601 timestamp of the last write to this row
 * (`updated_at` column value).  It is `null` when the row does not yet exist.
 * It is safe to pass to the client — it contains no secrets.
 */
export type SettingsResult<T> =
  | { ok: true;  data: T; updatedAt: string | null }
  | { ok: false; error: string };

/**
 * Read a platform settings row by key.
 * Returns an empty object when the row is absent (treated as unconfigured).
 * Includes the row's `updated_at` timestamp so callers can surface "last updated".
 */
async function readSection<T>(key: string): Promise<SettingsResult<T>> {
  try {
    const { data, error } = await getDb()
      .from("platform_settings")
      .select("value, updated_at")
      .eq("key", key)
      .maybeSingle() as {
        data: { value: Record<string, unknown>; updated_at: string } | null;
        error: { message: string } | null;
      };

    if (error) {
      return { ok: false, error: `Failed to read platform settings [${key}]: ${error.message}` };
    }

    return {
      ok:        true,
      data:      (data?.value ?? {}) as T,
      updatedAt: data?.updated_at ?? null,
    };
  } catch (err) {
    return {
      ok:    false,
      error: `Unexpected error reading platform settings [${key}]: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Upsert a platform settings row by key.
 * Merges the provided patch on top of the existing value so that partial
 * updates (e.g. "only update writeToken, leave projectId unchanged") work
 * correctly.
 */
async function writeSection<T extends Record<string, unknown>>(
  key:   string,
  patch: T,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    // Read existing value first so we can merge.
    const existing = await readSection<Record<string, unknown>>(key);
    const base     = existing.ok ? existing.data : {};

    // Strip undefined values from the patch so they don't overwrite stored data.
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) cleaned[k] = v;
    }

    const now    = new Date().toISOString();
    const merged = { ...base, ...cleaned };

    // TS2769: platform_settings Insert resolves to never in the hand-authored
    // Database type (same pattern as rules_config / tenant_settings upserts).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (getDb() as any)
      .from("platform_settings")
      .upsert(
        { key, value: merged, updated_at: now },
        { onConflict: "key" },
      ) as { error: { message: string } | null };

    if (error) {
      return { ok: false, error: `Failed to save platform settings [${key}]: ${error.message}` };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok:    false,
      error: `Unexpected error saving platform settings [${key}]: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ── Sanity ─────────────────────────────────────────────────────────────────────

/** Read the platform Sanity settings (server-only — includes writeToken). */
export async function getPlatformSanitySettings(): Promise<SettingsResult<PlatformSanitySettings>> {
  return readSection<PlatformSanitySettings>(KEYS.sanity);
}

/**
 * Persist platform Sanity settings.
 *
 * Pass `writeToken: ""` to clear the stored token without touching other fields.
 * Pass `writeToken: undefined` to leave the existing token untouched.
 * Same semantics apply to `readToken`.
 */
export async function savePlatformSanitySettings(
  patch: PlatformSanitySettings,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Normalise: empty string → explicit null so the UI can detect "cleared" state.
  const normalized: Record<string, unknown> = {
    ...(patch.projectId  !== undefined ? { projectId:  patch.projectId  || null  } : {}),
    ...(patch.dataset    !== undefined ? { dataset:    patch.dataset    || null  } : {}),
    ...(patch.apiVersion !== undefined ? { apiVersion: patch.apiVersion || null  } : {}),
  };

  if (patch.readToken !== undefined) {
    normalized.readToken = patch.readToken === "" ? null : patch.readToken;
  }
  if (patch.writeToken !== undefined) {
    normalized.writeToken = patch.writeToken === "" ? null : patch.writeToken;
  }

  return writeSection<Record<string, unknown>>(KEYS.sanity, normalized);
}

/**
 * Safe boolean flags for the Sanity section — suitable to pass to client components.
 * Never includes token values; only boolean presence indicators.
 */
export function sanityFlags(settings: PlatformSanitySettings): {
  hasProjectId:   boolean;
  hasDataset:     boolean;
  hasApiVersion:  boolean;
  hasReadToken:   boolean;
  hasWriteToken:  boolean;
  /** True when the minimum required fields (projectId + dataset) are present. */
  isConfigured:   boolean;
} {
  return {
    hasProjectId:  Boolean(settings.projectId),
    hasDataset:    Boolean(settings.dataset),
    hasApiVersion: Boolean(settings.apiVersion),
    hasReadToken:  Boolean(settings.readToken),
    hasWriteToken: Boolean(settings.writeToken),
    isConfigured:  Boolean(settings.projectId) && Boolean(settings.dataset),
  };
}

// ── MaxMind ────────────────────────────────────────────────────────────────────

/** Read the platform MaxMind settings (server-only — includes licenseKey). */
export async function getPlatformMaxMindSettings(): Promise<SettingsResult<PlatformMaxMindSettings>> {
  return readSection<PlatformMaxMindSettings>(KEYS.maxmind);
}

/** Persist platform MaxMind settings. */
export async function savePlatformMaxMindSettings(
  patch: PlatformMaxMindSettings,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized: Record<string, unknown> = {
    ...(patch.accountId  !== undefined ? { accountId:  patch.accountId  } : {}),
  };

  if (patch.licenseKey !== undefined) {
    normalized.licenseKey = patch.licenseKey === "" ? null : patch.licenseKey;
  }

  return writeSection<Record<string, unknown>>(KEYS.maxmind, normalized);
}

/** Safe boolean flags for the MaxMind section. */
export function maxmindFlags(settings: PlatformMaxMindSettings): {
  hasAccountId:   boolean;
  hasLicenseKey:  boolean;
} {
  return {
    hasAccountId:  Boolean(settings.accountId),
    hasLicenseKey: Boolean(settings.licenseKey),
  };
}

// ── AI ─────────────────────────────────────────────────────────────────────────

/** Read the platform AI settings (server-only — includes API keys). */
export async function getPlatformAiSettings(): Promise<SettingsResult<PlatformAiSettings>> {
  return readSection<PlatformAiSettings>(KEYS.ai);
}

/** Persist platform AI provider keys. */
export async function savePlatformAiSettings(
  patch: PlatformAiSettings,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized: Record<string, unknown> = {};

  if (patch.anthropicKey !== undefined) {
    normalized.anthropicKey = patch.anthropicKey === "" ? null : patch.anthropicKey;
  }
  if (patch.openaiKey !== undefined) {
    normalized.openaiKey = patch.openaiKey === "" ? null : patch.openaiKey;
  }
  if (patch.demoSiteKey !== undefined) {
    normalized.demoSiteKey = patch.demoSiteKey === "" ? null : patch.demoSiteKey;
  }

  return writeSection<Record<string, unknown>>(KEYS.ai, normalized);
}

/** Safe boolean flags for the AI section. */
export function aiPlatformFlags(settings: PlatformAiSettings): {
  hasAnthropicKey: boolean;
  hasOpenaiKey:    boolean;
  hasDemoSiteKey:  boolean;
} {
  return {
    hasAnthropicKey: Boolean(settings.anthropicKey),
    hasOpenaiKey:    Boolean(settings.openaiKey),
    hasDemoSiteKey:  Boolean(settings.demoSiteKey),
  };
}

// ── Vercel ─────────────────────────────────────────────────────────────────────

/** Read the platform Vercel settings (server-only — includes apiToken). */
export async function getPlatformVercelSettings(): Promise<SettingsResult<PlatformVercelSettings>> {
  return readSection<PlatformVercelSettings>(KEYS.vercel);
}

/** Persist platform Vercel integration settings. */
export async function savePlatformVercelSettings(
  patch: PlatformVercelSettings,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized: Record<string, unknown> = {
    ...(patch.teamId !== undefined ? { teamId: patch.teamId } : {}),
  };

  if (patch.apiToken !== undefined) {
    normalized.apiToken = patch.apiToken === "" ? null : patch.apiToken;
  }

  return writeSection<Record<string, unknown>>(KEYS.vercel, normalized);
}

/** Safe boolean flags for the Vercel section. */
export function vercelFlags(settings: PlatformVercelSettings): {
  hasApiToken: boolean;
  hasTeamId:   boolean;
} {
  return {
    hasApiToken: Boolean(settings.apiToken),
    hasTeamId:   Boolean(settings.teamId),
  };
}

// ── CRM ────────────────────────────────────────────────────────────────────────

/** Read the platform CRM settings (server-only — includes accessToken). */
export async function getPlatformCrmSettings(): Promise<SettingsResult<PlatformCrmSettings>> {
  return readSection<PlatformCrmSettings>(KEYS.crm);
}

/**
 * Persist platform CRM settings.
 *
 * `accessToken` behaviour:
 *   - Provided non-empty string  → stored as new token
 *   - Provided empty string ""   → clears any stored token
 *   - Omitted / undefined        → existing token is left unchanged
 *
 * `provider` is always overwritten when provided (not a secret).
 */
export async function savePlatformCrmSettings(
  patch: PlatformCrmSettings,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized: Record<string, unknown> = {
    ...(patch.provider !== undefined ? { provider: patch.provider } : {}),
  };

  if (patch.accessToken !== undefined) {
    normalized.accessToken = patch.accessToken === "" ? null : patch.accessToken;
  }

  return writeSection<Record<string, unknown>>(KEYS.crm, normalized);
}

/** Safe boolean flags for the CRM section — suitable to pass to client components. */
export function crmFlags(settings: PlatformCrmSettings): {
  hasAccessToken: boolean;
  provider:       string;
} {
  return {
    hasAccessToken: Boolean(settings.accessToken),
    provider:       settings.provider ?? "hubspot",
  };
}

// ── Storyblok ──────────────────────────────────────────────────────────────────

/** Read the platform Storyblok settings (server-only — includes accessToken). */
export async function getPlatformStoryblokSettings(): Promise<SettingsResult<PlatformStoryblokSettings>> {
  return readSection<PlatformStoryblokSettings>(KEYS.storyblok);
}

/**
 * Persist platform Storyblok settings.
 *
 * `accessToken` behaviour:
 *   - Provided non-empty string  → stored as new token
 *   - Provided empty string ""   → clears any stored token
 *   - Omitted / undefined        → existing token is left unchanged
 *
 * `region` and `version` are always overwritten when provided (not secrets).
 */
export async function savePlatformStoryblokSettings(
  patch: PlatformStoryblokSettings,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized: Record<string, unknown> = {
    ...(patch.region  !== undefined ? { region:  patch.region  } : {}),
    ...(patch.version !== undefined ? { version: patch.version } : {}),
    ...(patch.spaceId !== undefined ? { spaceId: patch.spaceId } : {}),
  };

  if (patch.accessToken !== undefined) {
    normalized.accessToken = patch.accessToken === "" ? null : patch.accessToken;
  }

  if (patch.managementToken !== undefined) {
    normalized.managementToken = patch.managementToken === "" ? null : patch.managementToken;
  }

  return writeSection<Record<string, unknown>>(KEYS.storyblok, normalized);
}

/** Safe boolean flags for the Storyblok section — suitable to pass to client components. */
export function storyblokFlags(settings: PlatformStoryblokSettings): {
  hasAccessToken:    boolean;
  hasManagementToken: boolean;
} {
  return {
    hasAccessToken:    Boolean(settings.accessToken),
    hasManagementToken: Boolean(settings.managementToken),
  };
}

// ── Statamic ───────────────────────────────────────────────────────────────────

/** Read the platform Statamic settings (server-only — includes apiKey). */
export async function getPlatformStatamicSettings(): Promise<SettingsResult<PlatformStatamicSettings>> {
  return readSection<PlatformStatamicSettings>(KEYS.statamic);
}

/**
 * Persist platform Statamic settings.
 *
 * `apiKey` behaviour:
 *   - Provided non-empty string  → stored as new key
 *   - Provided empty string ""   → clears any stored key
 *   - Omitted / undefined        → existing key is left unchanged
 *
 * `baseUrl` is always overwritten when provided (not a secret).
 */
export async function savePlatformStatamicSettings(
  patch: PlatformStatamicSettings,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized: Record<string, unknown> = {
    ...(patch.baseUrl !== undefined ? { baseUrl: patch.baseUrl } : {}),
  };

  if (patch.apiKey !== undefined) {
    normalized.apiKey = patch.apiKey === "" ? null : patch.apiKey;
  }

  return writeSection<Record<string, unknown>>(KEYS.statamic, normalized);
}

/** Safe boolean flags for the Statamic section — suitable to pass to client components. */
export function statamicFlags(settings: PlatformStatamicSettings): {
  hasApiKey: boolean;
} {
  return {
    hasApiKey: Boolean(settings.apiKey),
  };
}

// ── Enrichment ─────────────────────────────────────────────────────────────────

/** Read the platform enrichment provider settings (server-only — includes all API keys). */
export async function getPlatformEnrichmentSettings(): Promise<SettingsResult<PlatformEnrichmentSettings>> {
  return readSection<PlatformEnrichmentSettings>(KEYS.enrichment);
}

/**
 * Persist platform enrichment provider credentials.
 *
 * Secret key behaviour for each field:
 *   - Provided non-empty string  → stored as new credential
 *   - Provided empty string ""   → clears any stored credential
 *   - Omitted / undefined        → existing credential is left unchanged
 */
export async function savePlatformEnrichmentSettings(
  patch: PlatformEnrichmentSettings,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized: Record<string, unknown> = {};

  if (patch.clearbitSecretKey !== undefined) {
    normalized.clearbitSecretKey = patch.clearbitSecretKey === "" ? null : patch.clearbitSecretKey;
  }
  if (patch.ipinfoToken !== undefined) {
    normalized.ipinfoToken = patch.ipinfoToken === "" ? null : patch.ipinfoToken;
  }
  if (patch.leadinfoApiKey !== undefined) {
    normalized.leadinfoApiKey = patch.leadinfoApiKey === "" ? null : patch.leadinfoApiKey;
  }
  if (patch.ovioApiKey !== undefined) {
    normalized.ovioApiKey = patch.ovioApiKey === "" ? null : patch.ovioApiKey;
  }
  if (patch.kvkApiKey !== undefined) {
    normalized.kvkApiKey = patch.kvkApiKey === "" ? null : patch.kvkApiKey;
  }

  return writeSection<Record<string, unknown>>(KEYS.enrichment, normalized);
}

/** Safe boolean flags for the Enrichment section — suitable to pass to client components. */
export function enrichmentFlags(settings: PlatformEnrichmentSettings): {
  hasClearbitKey:  boolean;
  hasIpinfoToken:  boolean;
  hasLeadinfoKey:  boolean;
  hasOvioApiKey:   boolean;
  hasKvkApiKey:    boolean;
} {
  return {
    hasClearbitKey:  Boolean(settings.clearbitSecretKey),
    hasIpinfoToken:  Boolean(settings.ipinfoToken),
    hasLeadinfoKey:  Boolean(settings.leadinfoApiKey),
    hasOvioApiKey:   Boolean(settings.ovioApiKey),
    hasKvkApiKey:    Boolean(settings.kvkApiKey),
  };
}

// ── OpenKvK ────────────────────────────────────────────────────────────────────

/** Read the platform OpenKvK settings. All fields are non-secret. */
export async function getPlatformOpenKvKSettings(): Promise<SettingsResult<PlatformOpenKvKSettings>> {
  return readSection<PlatformOpenKvKSettings>(KEYS.openkvk);
}

/**
 * Persist platform OpenKvK settings.
 *
 * All fields (`mode`, `confidenceThreshold`, `matchingStrategy`) are
 * non-secret and are always overwritten when provided.
 */
export async function savePlatformOpenKvKSettings(
  patch: PlatformOpenKvKSettings,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized: Record<string, unknown> = {
    ...(patch.mode                !== undefined ? { mode:                patch.mode                } : {}),
    ...(patch.confidenceThreshold !== undefined ? { confidenceThreshold: patch.confidenceThreshold } : {}),
    ...(patch.matchingStrategy    !== undefined ? { matchingStrategy:    patch.matchingStrategy    } : {}),
  };

  return writeSection<Record<string, unknown>>(KEYS.openkvk, normalized);
}

/**
 * Safe flags for the OpenKvK section — suitable to pass to client components.
 *
 * Returns all non-secret configuration fields as-is since none are sensitive.
 */
export function openKvKFlags(settings: PlatformOpenKvKSettings): {
  mode:                "off" | "nl-only" | "always";
  confidenceThreshold: number;
  matchingStrategy:    "networkOrg" | "companyName" | "networkDomain";
} {
  return {
    mode:                settings.mode                ?? "off",
    confidenceThreshold: settings.confidenceThreshold ?? 0.5,
    matchingStrategy:    settings.matchingStrategy    ?? "networkOrg",
  };
}

// ── Holidays ───────────────────────────────────────────────────────────────────

/** Read the platform holiday provider settings. All fields are non-secret. */
export async function getPlatformHolidaySettings(): Promise<SettingsResult<PlatformHolidaySettings>> {
  return readSection<PlatformHolidaySettings>(KEYS.holidays);
}

/**
 * Persist platform holiday provider settings.
 *
 * All fields (`enabled`, `cacheTtlHours`, `countriesFilter`) are non-secret
 * and are always overwritten when provided.
 */
export async function savePlatformHolidaySettings(
  patch: PlatformHolidaySettings,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized: Record<string, unknown> = {
    ...(patch.enabled        !== undefined ? { enabled:        patch.enabled        } : {}),
    ...(patch.cacheTtlHours  !== undefined ? { cacheTtlHours:  patch.cacheTtlHours  } : {}),
    ...(patch.countriesFilter !== undefined ? { countriesFilter: patch.countriesFilter } : {}),
  };

  return writeSection<Record<string, unknown>>(KEYS.holidays, normalized);
}

/**
 * Safe flags for the Holiday section — suitable to pass to client components.
 *
 * Returns all non-secret configuration fields as-is since none are sensitive.
 */
export function holidayFlags(settings: PlatformHolidaySettings): {
  enabled:         boolean;
  cacheTtlHours:   number;
  countriesFilter: string;
} {
  return {
    enabled:         settings.enabled        ?? false,
    cacheTtlHours:   settings.cacheTtlHours  ?? 24,
    countriesFilter: settings.countriesFilter ?? "",
  };
}

// ── Reverse Geocode ────────────────────────────────────────────────────────────

/** Read the platform reverse-geocode settings (server-only — includes API key). */
export async function getPlatformReverseGeocodeSettings(): Promise<SettingsResult<PlatformReverseGeocodeSettings>> {
  return readSection<PlatformReverseGeocodeSettings>(KEYS.reverseGeocode);
}

/**
 * Persist platform reverse-geocode settings.
 *
 * Secret key behaviour:
 *   - Non-empty string  → stored as new credential
 *   - Empty string ""   → clears any stored credential
 *   - Undefined         → existing credential is left unchanged
 *
 * Non-secret fields (`enabled`, `cacheTtlHours`) are always overwritten when provided.
 */
export async function savePlatformReverseGeocodeSettings(
  patch: PlatformReverseGeocodeSettings,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized: Record<string, unknown> = {};

  if (patch.enabled !== undefined) {
    normalized.enabled = patch.enabled;
  }
  if (patch.locationIqApiKey !== undefined) {
    normalized.locationIqApiKey = patch.locationIqApiKey === "" ? null : patch.locationIqApiKey;
  }
  if (patch.cacheTtlHours !== undefined) {
    normalized.cacheTtlHours = patch.cacheTtlHours;
  }

  return writeSection<Record<string, unknown>>(KEYS.reverseGeocode, normalized);
}

/**
 * Safe flags for the Reverse Geocode section — suitable to pass to client components.
 *
 * Strips the `locationIqApiKey` secret; returns only boolean presence flags and
 * non-secret configuration values.
 */
export function reverseGeocodeFlags(settings: PlatformReverseGeocodeSettings): {
  enabled:              boolean;
  hasLocationIqApiKey:  boolean;
  cacheTtlHours:        number;
} {
  return {
    enabled:              settings.enabled             ?? false,
    hasLocationIqApiKey:  Boolean(settings.locationIqApiKey),
    cacheTtlHours:        settings.cacheTtlHours        ?? 6,
  };
}

// ── Weather (Open-Meteo) ───────────────────────────────────────────────────────

/** Read the platform weather enrichment settings (no secrets — safe to read server-side). */
export async function getPlatformWeatherSettings(): Promise<SettingsResult<PlatformWeatherSettings>> {
  return readSection<PlatformWeatherSettings>(KEYS.weather);
}

/**
 * Persist platform weather enrichment settings.
 * Non-secret fields only — enabled toggle and cache TTL.
 */
export async function savePlatformWeatherSettings(
  patch: PlatformWeatherSettings,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized: Record<string, unknown> = {};

  if (patch.enabled !== undefined) {
    normalized.enabled = patch.enabled;
  }
  if (patch.cacheTtlHours !== undefined) {
    normalized.cacheTtlHours = patch.cacheTtlHours;
  }

  return writeSection<Record<string, unknown>>(KEYS.weather, normalized);
}

/**
 * Safe flags for the Weather section — suitable to pass to client components.
 */
export function weatherFlags(settings: PlatformWeatherSettings): {
  enabled:       boolean;
  cacheTtlHours: number;
} {
  return {
    enabled:       settings.enabled       ?? false,
    cacheTtlHours: settings.cacheTtlHours ?? 1,
  };
}

// ── GA4 Analytics History ──────────────────────────────────────────────────────

/** Read the platform GA4 History enrichment settings (secrets stripped by flags helper). */
export async function getPlatformGa4HistorySettings(): Promise<SettingsResult<PlatformGa4HistorySettings>> {
  return readSection<PlatformGa4HistorySettings>(KEYS.ga4History);
}

/**
 * Persist platform GA4 History enrichment settings.
 *
 * `serviceAccountJson` is stored as-is (encrypted at rest by the DB).
 * An empty string clears the existing value (disables the enricher).
 * Omitting a field leaves the existing stored value unchanged.
 */
export async function savePlatformGa4HistorySettings(
  patch: PlatformGa4HistorySettings,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized: Record<string, unknown> = {};

  if (patch.enabled !== undefined) {
    normalized.enabled = patch.enabled;
  }
  if (patch.propertyId !== undefined) {
    normalized.propertyId = patch.propertyId === "" ? null : patch.propertyId;
  }
  if (patch.serviceAccountJson !== undefined) {
    normalized.serviceAccountJson = patch.serviceAccountJson === "" ? null : patch.serviceAccountJson;
  }
  if (patch.visitorIdDimension !== undefined) {
    normalized.visitorIdDimension = patch.visitorIdDimension === "" ? "visitor_id" : patch.visitorIdDimension;
  }
  if (patch.lookbackDays !== undefined) {
    normalized.lookbackDays = patch.lookbackDays;
  }
  if (patch.cacheTtlMinutes !== undefined) {
    normalized.cacheTtlMinutes = patch.cacheTtlMinutes;
  }
  if (patch.measurementId !== undefined) {
    normalized.measurementId = patch.measurementId === "" ? null : patch.measurementId;
  }
  if (patch.visitorIdParamName !== undefined) {
    normalized.visitorIdParamName = patch.visitorIdParamName === "" ? "visitor_id" : patch.visitorIdParamName;
  }
  if (patch.sendMode !== undefined) {
    normalized.sendMode = patch.sendMode;
  }

  return writeSection<Record<string, unknown>>(KEYS.ga4History, normalized);
}

/**
 * Safe flags for the GA4 History section — suitable to pass to client components.
 *
 * Strips the `serviceAccountJson` secret; returns only boolean presence flags
 * and non-secret configuration values.
 */
export function ga4HistoryFlags(settings: PlatformGa4HistorySettings): {
  enabled:              boolean;
  hasServiceAccount:    boolean;
  propertyId:           string;
  visitorIdDimension:   string;
  lookbackDays:         number;
  cacheTtlMinutes:      number;
  measurementId:        string;
  visitorIdParamName:   string;
  sendMode:             "off" | "client" | "server";
} {
  return {
    enabled:            settings.enabled            ?? false,
    hasServiceAccount:  Boolean(settings.serviceAccountJson),
    propertyId:         settings.propertyId         ?? "",
    visitorIdDimension: settings.visitorIdDimension ?? "visitor_id",
    lookbackDays:       settings.lookbackDays        ?? 90,
    cacheTtlMinutes:    settings.cacheTtlMinutes     ?? 30,
    measurementId:      settings.measurementId       ?? "",
    visitorIdParamName: settings.visitorIdParamName  ?? "visitor_id",
    sendMode:           settings.sendMode            ?? "off",
  };
}

// ── Email ──────────────────────────────────────────────────────────────────────

/** Read the platform email settings (includes secrets — server-only). */
export async function getPlatformEmailSettings(): Promise<SettingsResult<PlatformEmailSettings>> {
  return readSection<PlatformEmailSettings>(KEYS.email);
}

/**
 * Persist platform email settings.
 *
 * Secret fields (resendApiKey, smtpPassword):
 *   pass new value to set, "" to clear, omit (undefined) to leave unchanged.
 *
 * Non-secret fields are always overwritten with the trimmed value supplied.
 * Pass undefined to leave a field unchanged.
 */
export async function savePlatformEmailSettings(
  patch: PlatformEmailSettings,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized: Record<string, unknown> = {};

  if (patch.transportType !== undefined) {
    normalized.transportType = patch.transportType;
  }
  if (patch.fromName !== undefined) {
    normalized.fromName = patch.fromName === "" ? null : patch.fromName;
  }
  if (patch.fromEmail !== undefined) {
    normalized.fromEmail = patch.fromEmail === "" ? null : patch.fromEmail;
  }
  if (patch.backofficeEmail !== undefined) {
    normalized.backofficeEmail = patch.backofficeEmail === "" ? null : patch.backofficeEmail;
  }
  if (patch.resendApiKey !== undefined) {
    normalized.resendApiKey = patch.resendApiKey === "" ? null : patch.resendApiKey;
  }
  if (patch.smtpHost !== undefined) {
    normalized.smtpHost = patch.smtpHost === "" ? null : patch.smtpHost;
  }
  if (patch.smtpPort !== undefined) {
    normalized.smtpPort = patch.smtpPort;
  }
  if (patch.smtpUsername !== undefined) {
    normalized.smtpUsername = patch.smtpUsername === "" ? null : patch.smtpUsername;
  }
  if (patch.smtpPassword !== undefined) {
    normalized.smtpPassword = patch.smtpPassword === "" ? null : patch.smtpPassword;
  }
  if (patch.smtpSecure !== undefined) {
    normalized.smtpSecure = patch.smtpSecure;
  }

  return writeSection<Record<string, unknown>>(KEYS.email, normalized);
}

/**
 * Safe flags for the Email section — suitable to pass to client components.
 * Strips resendApiKey and smtpPassword; returns boolean presence flags.
 */
export function emailPlatformFlags(settings: PlatformEmailSettings): {
  transportType:    "resend" | "smtp" | "none";
  configured:       boolean;
  fromName:         string;
  fromEmail:        string;
  backofficeEmail:  string;
  hasResendKey:     boolean;
  smtpHost:         string;
  smtpPort:         number;
  smtpUsername:     string;
  hasSmtpPassword:  boolean;
  smtpSecure:       boolean;
} {
  const transportType: "resend" | "smtp" | "none" =
    settings.transportType === "resend" || settings.transportType === "smtp"
      ? settings.transportType
      : "none";

  const configured =
    (transportType === "resend" && Boolean(settings.resendApiKey)) ||
    (transportType === "smtp"   && Boolean(settings.smtpHost));

  return {
    transportType,
    configured,
    fromName:        settings.fromName        ?? "",
    fromEmail:       settings.fromEmail       ?? "",
    backofficeEmail: settings.backofficeEmail ?? "",
    hasResendKey:    Boolean(settings.resendApiKey),
    smtpHost:        settings.smtpHost        ?? "",
    smtpPort:        settings.smtpPort        ?? 587,
    smtpUsername:    settings.smtpUsername    ?? "",
    hasSmtpPassword: Boolean(settings.smtpPassword),
    smtpSecure:      settings.smtpSecure      ?? false,
  };
}

// ── Stripe ─────────────────────────────────────────────────────────────────────

/** Read the platform Stripe settings (server-only — includes secretKey + webhookSecret). */
export async function getPlatformStripeSettings(): Promise<SettingsResult<PlatformStripeSettings>> {
  return readSection<PlatformStripeSettings>(KEYS.stripe);
}

/**
 * Persist platform Stripe settings.
 *
 * For each secret field (secretKey, webhookSecret):
 *   • Pass the new value to set it.
 *   • Pass "" to clear it.
 *   • Omit (undefined) to leave the existing value untouched.
 *
 * publishableKey is non-secret but follows the same omit-to-preserve pattern
 * for consistency.
 */
export async function savePlatformStripeSettings(
  patch: PlatformStripeSettings,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized: Record<string, unknown> = {};

  // publishableKey: non-secret — store as-is (empty string clears it)
  if (patch.publishableKey !== undefined) {
    normalized.publishableKey = patch.publishableKey === "" ? null : patch.publishableKey;
  }

  // secretKey: server-only secret
  if (patch.secretKey !== undefined) {
    normalized.secretKey = patch.secretKey === "" ? null : patch.secretKey;
  }

  // webhookSecret: server-only secret
  if (patch.webhookSecret !== undefined) {
    normalized.webhookSecret = patch.webhookSecret === "" ? null : patch.webhookSecret;
  }

  // Credit bundle price IDs (non-secret — safe to store as plain text)
  if (patch.creditBundle250PriceId !== undefined) {
    normalized.creditBundle250PriceId = patch.creditBundle250PriceId === "" ? null : patch.creditBundle250PriceId;
  }
  if (patch.creditBundle1000PriceId !== undefined) {
    normalized.creditBundle1000PriceId = patch.creditBundle1000PriceId === "" ? null : patch.creditBundle1000PriceId;
  }
  if (patch.creditBundle5000PriceId !== undefined) {
    normalized.creditBundle5000PriceId = patch.creditBundle5000PriceId === "" ? null : patch.creditBundle5000PriceId;
  }

  // Subscription plan price IDs (non-secret — safe to store as plain text)
  if (patch.planStarterMonthlyPriceId !== undefined) {
    normalized.planStarterMonthlyPriceId = patch.planStarterMonthlyPriceId === "" ? null : patch.planStarterMonthlyPriceId;
  }
  if (patch.planStarterAnnualPriceId !== undefined) {
    normalized.planStarterAnnualPriceId = patch.planStarterAnnualPriceId === "" ? null : patch.planStarterAnnualPriceId;
  }
  if (patch.planGrowthMonthlyPriceId !== undefined) {
    normalized.planGrowthMonthlyPriceId = patch.planGrowthMonthlyPriceId === "" ? null : patch.planGrowthMonthlyPriceId;
  }
  if (patch.planGrowthAnnualPriceId !== undefined) {
    normalized.planGrowthAnnualPriceId = patch.planGrowthAnnualPriceId === "" ? null : patch.planGrowthAnnualPriceId;
  }
  if (patch.planProMonthlyPriceId !== undefined) {
    normalized.planProMonthlyPriceId = patch.planProMonthlyPriceId === "" ? null : patch.planProMonthlyPriceId;
  }
  if (patch.planProAnnualPriceId !== undefined) {
    normalized.planProAnnualPriceId = patch.planProAnnualPriceId === "" ? null : patch.planProAnnualPriceId;
  }

  return writeSection<Record<string, unknown>>(KEYS.stripe, normalized);
}

/**
 * Safe flags for the Stripe section — suitable to pass to client components.
 *
 * Returns:
 *   • publishableKey — the actual value (safe to expose to browser)
 *   • hasSecretKey   — boolean only; never the value
 *   • hasWebhookSecret — boolean only; never the value
 *   • liveMode       — inferred from publishableKey prefix (pk_live_ vs pk_test_)
 */
export function stripeFlags(settings: PlatformStripeSettings): {
  publishableKey:         string;
  hasSecretKey:           boolean;
  hasWebhookSecret:       boolean;
  liveMode:               boolean;
  /** Price IDs are non-secret — safe to return for client display. */
  creditBundle250PriceId:  string;
  creditBundle1000PriceId: string;
  creditBundle5000PriceId: string;
  /** Subscription plan price IDs — non-secret, safe for client display. */
  planStarterMonthlyPriceId: string;
  planStarterAnnualPriceId:  string;
  planGrowthMonthlyPriceId:  string;
  planGrowthAnnualPriceId:   string;
  planProMonthlyPriceId:     string;
  planProAnnualPriceId:      string;
} {
  const publishableKey = settings.publishableKey ?? "";
  return {
    publishableKey,
    hasSecretKey:            Boolean(settings.secretKey),
    hasWebhookSecret:        Boolean(settings.webhookSecret),
    liveMode:                publishableKey.startsWith("pk_live_"),
    creditBundle250PriceId:  settings.creditBundle250PriceId  ?? "",
    creditBundle1000PriceId: settings.creditBundle1000PriceId ?? "",
    creditBundle5000PriceId: settings.creditBundle5000PriceId ?? "",
    planStarterMonthlyPriceId: settings.planStarterMonthlyPriceId ?? "",
    planStarterAnnualPriceId:  settings.planStarterAnnualPriceId  ?? "",
    planGrowthMonthlyPriceId:  settings.planGrowthMonthlyPriceId  ?? "",
    planGrowthAnnualPriceId:   settings.planGrowthAnnualPriceId   ?? "",
    planProMonthlyPriceId:     settings.planProMonthlyPriceId     ?? "",
    planProAnnualPriceId:      settings.planProAnnualPriceId      ?? "",
  };
}

/**
 * Resolve Stripe runtime credentials — DB first, env var fallback.
 *
 * Resolution order (highest priority first):
 *   1. platform_settings DB row (saved via admin dashboard)
 *   2. Environment variables (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET)
 *
 * Mode is inferred from the publishable key prefix:
 *   pk_live_  → "live"
 *   pk_test_  → "test"
 *   absent    → falls back to STRIPE_MODE env var, then "live"
 *
 * This is the canonical credential resolver for server-side Stripe usage.
 * Use it in API routes and webhook handlers instead of reading env vars directly.
 */
export async function resolveStripeCredentials(): Promise<{
  secretKey:     string;
  webhookSecret: string;
  mode:          "live" | "test";
}> {
  const result = await getPlatformStripeSettings();
  const db = result.ok ? result.data : ({} as PlatformStripeSettings);

  const secretKey =
    db.secretKey ??
    process.env["STRIPE_SECRET_KEY"] ??
    process.env["STRIPE_TEST_SECRET_KEY"] ??
    "";

  const webhookSecret =
    db.webhookSecret ??
    process.env["STRIPE_WEBHOOK_SECRET"] ??
    process.env["STRIPE_TEST_WEBHOOK_SECRET"] ??
    "";

  // Infer mode from publishable key if available; fall back to env var; default live.
  const pubKey = db.publishableKey ?? "";
  let mode: "live" | "test";
  if (pubKey.startsWith("pk_test_"))      mode = "test";
  else if (pubKey.startsWith("pk_live_")) mode = "live";
  else if (secretKey.startsWith("sk_test_")) mode = "test";
  else mode = process.env["STRIPE_MODE"] === "test" ? "test" : "live";

  return { secretKey, webhookSecret, mode };
}

// ── Storage ────────────────────────────────────────────────────────────────────

/** Read the platform storage settings (server-only — includes R2 secret key). */
export async function getPlatformStorageSettings(): Promise<SettingsResult<PlatformStorageSettings>> {
  return readSection<PlatformStorageSettings>(KEYS.storage);
}

/**
 * Persist platform storage settings.
 *
 * Pass `cloudflareR2.secretAccessKey: ""` to clear the stored secret without
 * touching other fields.  Pass `undefined` to leave the existing value untouched.
 */
export async function savePlatformStorageSettings(
  patch: PlatformStorageSettings,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized: Record<string, unknown> = {};

  if (patch.activeProvider !== undefined) {
    normalized.activeProvider = patch.activeProvider;
  }

  if (patch.cloudflareR2 !== undefined) {
    const r2 = patch.cloudflareR2;
    const existing = await readSection<PlatformStorageSettings>(KEYS.storage);
    const existingR2 = existing.ok ? (existing.data.cloudflareR2 ?? {}) : {};

    normalized.cloudflareR2 = {
      ...existingR2,
      ...(r2.accountId   !== undefined ? { accountId:   r2.accountId   } : {}),
      ...(r2.accessKeyId !== undefined ? { accessKeyId: r2.accessKeyId } : {}),
      ...(r2.bucketName  !== undefined ? { bucketName:  r2.bucketName  } : {}),
      ...(r2.publicUrl   !== undefined ? { publicUrl:   r2.publicUrl   } : {}),
      // secretAccessKey: "" clears, undefined preserves
      ...(r2.secretAccessKey !== undefined
        ? { secretAccessKey: r2.secretAccessKey === "" ? null : r2.secretAccessKey }
        : {}),
    };
  }

  if (patch.supabaseStorage !== undefined) {
    const ss = patch.supabaseStorage;
    normalized.supabaseStorage = {
      ...(ss.bucketName !== undefined ? { bucketName: ss.bucketName } : {}),
      ...(ss.isPublic   !== undefined ? { isPublic:   ss.isPublic   } : {}),
    };
  }

  return writeSection<Record<string, unknown>>(KEYS.storage, normalized);
}

/**
 * Safe boolean flags for the storage section — suitable to pass to client components.
 * Never includes the R2 secret access key value.
 */
export function storageProviderFlags(settings: PlatformStorageSettings): {
  activeProvider:          string | null;
  hasR2AccountId:          boolean;
  hasR2AccessKeyId:        boolean;
  hasR2SecretAccessKey:    boolean;
  hasR2BucketName:         boolean;
  hasR2PublicUrl:          boolean;
  r2AccountId:             string;
  r2AccessKeyId:           string;
  r2BucketName:            string;
  r2PublicUrl:             string;
  r2Configured:            boolean;
  supabaseBucketName:      string;
  supabaseIsPublic:        boolean;
} {
  const r2 = settings.cloudflareR2 ?? {};
  const ss = settings.supabaseStorage ?? {};

  const r2Configured =
    Boolean(r2.accountId) &&
    Boolean(r2.accessKeyId) &&
    Boolean(r2.secretAccessKey) &&
    Boolean(r2.bucketName) &&
    Boolean(r2.publicUrl);

  return {
    activeProvider:          settings.activeProvider ?? null,
    hasR2AccountId:          Boolean(r2.accountId),
    hasR2AccessKeyId:        Boolean(r2.accessKeyId),
    hasR2SecretAccessKey:    Boolean(r2.secretAccessKey),
    hasR2BucketName:         Boolean(r2.bucketName),
    hasR2PublicUrl:          Boolean(r2.publicUrl),
    r2AccountId:             r2.accountId       ?? "",
    r2AccessKeyId:           r2.accessKeyId     ?? "",
    r2BucketName:            r2.bucketName      ?? "",
    r2PublicUrl:             r2.publicUrl       ?? "",
    r2Configured,
    supabaseBucketName:      ss.bucketName ?? "tenant-assets",
    supabaseIsPublic:        ss.isPublic   ?? true,
  };
}

// ── Content Budget ─────────────────────────────────────────────────────────────

/**
 * Per-slot maximum variant counts.
 *
 * When the total number of variants in a slot (platform + CMS) approaches or
 * exceeds these values the admin UI surfaces a warning, prompting the team to
 * consolidate before creating new content.
 *
 * All fields are optional — absent fields fall back to CONTENT_BUDGET_DEFAULTS
 * in decision/rules/variant-usage.ts.
 */
export interface PlatformContentBudgetSettings {
  /** Max hero variants. Default: 16. */
  heroMax?:       number;
  /** Max proof variants. Default: 14. */
  proofMax?:      number;
  /** Max CTA variants. Default: 20. */
  ctaMax?:        number;
  /** Max feature variants. Default: 5. */
  featureMax?:    number;
  /** Max conversion variants. Default: 4. */
  conversionMax?: number;
}

export async function getPlatformContentBudgetSettings(): Promise<SettingsResult<PlatformContentBudgetSettings>> {
  return readSection<PlatformContentBudgetSettings>(KEYS.contentBudget);
}

export async function savePlatformContentBudgetSettings(
  input: PlatformContentBudgetSettings,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Clamp each value: must be a positive integer when present.
  const clamp = (v: number | undefined): number | undefined =>
    v === undefined ? undefined : Math.max(1, Math.round(v));

  const patch: PlatformContentBudgetSettings = {
    heroMax:       clamp(input.heroMax),
    proofMax:      clamp(input.proofMax),
    ctaMax:        clamp(input.ctaMax),
    featureMax:    clamp(input.featureMax),
    conversionMax: clamp(input.conversionMax),
  };
  return writeSection<Record<string, unknown>>(KEYS.contentBudget, patch as Record<string, unknown>);
}

// ── Google Calendar ────────────────────────────────────────────────────────────

/**
 * Platform-wide Google Calendar integration settings for demo booking.
 *
 * Uses a Service Account (not OAuth2) — credentials come from the JSON key
 * file downloaded from Google Cloud Console.
 *
 * ─── Resolution order at runtime ─────────────────────────────────────────────
 *
 *   1. platform_settings DB  (this store)       — highest priority
 *   2. Env vars              (GOOGLE_SERVICE_ACCOUNT_EMAIL etc.) — legacy fallback
 *
 * ─── Secret handling ──────────────────────────────────────────────────────────
 *
 *   `serviceAccountPrivateKey` is SERVER ONLY — encrypted at rest.
 *   Use `googleCalendarFlags()` for safe client-facing status.
 */
export interface PlatformGoogleCalendarSettings {
  /**
   * Service account email from Google Cloud Console.
   * e.g. demo-booking@my-project.iam.gserviceaccount.com
   * Non-secret — safe to show in the UI.
   */
  serviceAccountEmail?: string;
  /**
   * RSA private key PEM string from the service account JSON.
   * SERVER ONLY — encrypted at rest, never returned to the client.
   */
  serviceAccountPrivateKey?: string;
  /**
   * Google Calendar ID to check for availability.
   * Usually the service account owner's email address.
   * Non-secret — safe to show in the UI.
   */
  calendarId?: string;
  /**
   * IANA timezone string for slot generation.
   * Default: "Europe/Amsterdam"
   */
  bookingTimezone?: string;
  /**
   * First available slot hour (inclusive, 24h). Default: 9
   */
  bookingHoursStart?: number;
  /**
   * Last slot hour (exclusive, 24h). Default: 17
   * e.g. 17 = slots up to 16:30 are shown.
   */
  bookingHoursEnd?: number;
}

export async function getPlatformGoogleCalendarSettings(): Promise<SettingsResult<PlatformGoogleCalendarSettings>> {
  return readSection<PlatformGoogleCalendarSettings>(KEYS.googleCalendar);
}

export async function savePlatformGoogleCalendarSettings(
  patch: PlatformGoogleCalendarSettings,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { encryptSecret } = await import("@/lib/email-crypto");

  const normalized: Record<string, unknown> = {};

  if (patch.serviceAccountEmail  !== undefined) normalized.serviceAccountEmail  = patch.serviceAccountEmail  || null;
  if (patch.calendarId           !== undefined) normalized.calendarId           = patch.calendarId           || null;
  if (patch.bookingTimezone      !== undefined) normalized.bookingTimezone      = patch.bookingTimezone      || null;
  if (patch.bookingHoursStart    !== undefined) normalized.bookingHoursStart    = patch.bookingHoursStart;
  if (patch.bookingHoursEnd      !== undefined) normalized.bookingHoursEnd      = patch.bookingHoursEnd;

  // Empty string = clear; non-empty = encrypt and store.
  if (patch.serviceAccountPrivateKey !== undefined) {
    normalized.serviceAccountPrivateKey = patch.serviceAccountPrivateKey
      ? encryptSecret(patch.serviceAccountPrivateKey)
      : null;
  }

  return writeSection<Record<string, unknown>>(KEYS.googleCalendar, normalized);
}

/** Safe flags for client components — private key replaced with boolean. */
export function googleCalendarFlags(s: PlatformGoogleCalendarSettings): {
  serviceAccountEmail:  string;
  hasPrivateKey:        boolean;
  calendarId:           string;
  bookingTimezone:      string;
  bookingHoursStart:    number;
  bookingHoursEnd:      number;
  isConfigured:         boolean;
} {
  return {
    serviceAccountEmail: s.serviceAccountEmail ?? "",
    hasPrivateKey:       Boolean(s.serviceAccountPrivateKey),
    calendarId:          s.calendarId          ?? "",
    bookingTimezone:     s.bookingTimezone      ?? "Europe/Amsterdam",
    bookingHoursStart:   s.bookingHoursStart    ?? 9,
    bookingHoursEnd:     s.bookingHoursEnd      ?? 17,
    isConfigured:        Boolean(s.serviceAccountEmail && s.serviceAccountPrivateKey && s.calendarId),
  };
}
