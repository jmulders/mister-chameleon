/**
 * Centralised Environment Configuration
 *
 * Single source of truth for every environment variable the app reads.
 * Exposes two namespaces with a hard boundary between them:
 *
 *   clientEnv   — NEXT_PUBLIC_* variables, safe for server + client code
 *   serverEnv   — secret variables, server-side only
 *
 * ─── Server-only guard ───────────────────────────────────────────────────────
 *
 *   This file imports "server-only", which causes the Next.js bundler to
 *   emit a build error if the module is imported inside a Client Component
 *   ("use client" file). This is the correct Next.js-idiomatic way to
 *   prevent secret variables from being bundled into client JS.
 *
 *   If you need NEXT_PUBLIC_* values in a Client Component, read from
 *   process.env.NEXT_PUBLIC_* directly — those are safe because Next.js
 *   inlines them at build time and they carry no secrets by convention.
 *
 * ─── Validation model ────────────────────────────────────────────────────────
 *
 *   Validation is LAZY — it runs when a group is first accessed, not at
 *   module import time. This means:
 *
 *   1. Importing this module never throws (safe for static analysis / build).
 *   2. Missing required vars throw at first use with ALL missing names listed
 *      in one error — "fix five vars in one restart" rather than one-by-one.
 *   3. Validated results are memoised — subsequent accesses are O(1) reads.
 *
 * ─── Sanity special case ─────────────────────────────────────────────────────
 *
 *   SANITY_PROJECT_ID is optional at the app level — when absent, the app
 *   uses MockCMSProvider. serverEnv.sanity therefore returns an object with
 *   isConfigured: false rather than throwing. If SANITY_PROJECT_ID IS set,
 *   the remaining Sanity vars become required and throw if missing.
 *
 * ─── Adding a new variable ───────────────────────────────────────────────────
 *
 *   Public  (client-safe):  add to `clientEnv` using `process.env.NEXT_PUBLIC_*`
 *   Secret  (server-only):  add to the relevant group in `serverEnv`, or create
 *                           a new group using the `makeGroup()` helper below.
 *
 * ─── .env.example reference ──────────────────────────────────────────────────
 *
 *   # Public — safe for client bundles
 *   NEXT_PUBLIC_SITE_URL=https://misterchameleon.com
 *   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
 *
 *   # Sanity — required only when SANITY_PROJECT_ID is set
 *   SANITY_PROJECT_ID=your_project_id
 *   SANITY_DATASET=production
 *   SANITY_API_VERSION=2024-01-01
 *   SANITY_READ_TOKEN=your_read_token    # optional: needed for draft/preview only
 *
 *   # Supabase server-side
 *   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
 *
 *   # n8n automation webhooks
 *   N8N_CONTACT_WEBHOOK_URL=https://your-n8n-instance.com/webhook/...
 */

// ── Server-only guard ─────────────────────────────────────────────────────────
// The "server-only" package causes a hard build error if this module is
// imported inside a "use client" file. This is a zero-runtime-cost guard.
// Install: npm install server-only  (already in package.json)
import "server-only";

// ── Internal types ────────────────────────────────────────────────────────────

/** A required env var reader that collects missing names rather than throwing. */
type RequiredReader = (name: string) => string;
/** An optional env var reader that returns undefined when absent. */
type OptionalReader = (name: string) => string | undefined;
/** Factory signature passed to makeGroup. */
type GroupFactory<T> = (required: RequiredReader, optional: OptionalReader) => T;

// ── Public types ──────────────────────────────────────────────────────────────

/**
 * Validated Storyblok configuration.
 * isConfigured is false when STORYBLOK_ACCESS_TOKEN is not set.
 */
export interface StoryblokEnvConfig {
  /** Content Delivery API access token — read-only, passed as a query param */
  readonly accessToken: string;
  /**
   * CDN region — used to select the correct API base URL.
   * Accepts "eu" | "us" | "ap" | "ca" | "cn". Defaults to "eu".
   */
  readonly region: string;
  /**
   * Content version to fetch — "published" for production, "draft" for preview.
   * Defaults to "published".
   */
  readonly version: "published" | "draft";
  /**
   * True when STORYBLOK_ACCESS_TOKEN is set.
   * False when absent — MockCMSProvider is used instead.
   */
  readonly isConfigured: boolean;
}

/** Validated Sanity configuration. isConfigured is false when Sanity is not enabled. */
export interface SanityEnvConfig {
  readonly projectId: string;
  readonly dataset: string;
  readonly apiVersion: string;
  readonly readToken: string | undefined;
  /**
   * True when all required Sanity vars are present and validated.
   * False when SANITY_PROJECT_ID is not set — MockCMSProvider is used instead.
   */
  readonly isConfigured: boolean;
}

/**
 * Validated Statamic configuration.
 * isConfigured is false when STATAMIC_API_URL is not set.
 */
export interface StatamicEnvConfig {
  /** Base URL of the Statamic site, e.g. "https://cms.example.com" */
  readonly apiUrl: string;
  /** Optional Bearer token for protected APIs */
  readonly apiKey: string | undefined;
  /**
   * True when STATAMIC_API_URL is set.
   * False when absent — MockCMSProvider is used instead.
   */
  readonly isConfigured: boolean;
}

/** Validated Supabase server-side configuration. */
export interface SupabaseServerEnvConfig {
  readonly serviceRoleKey: string;
}

/** n8n webhook configuration. All fields are optional. */
export interface N8nEnvConfig {
  readonly contactWebhookUrl: string | undefined;
}

/**
 * Vercel Domains API configuration.
 *
 * apiToken + projectId are required to enable the integration.
 * teamId is only needed for team-scoped tokens (most production setups).
 * isConfigured is true only when BOTH apiToken and projectId are present.
 *
 *   VERCEL_API_TOKEN   — Personal access token or team token with project:write
 *   VERCEL_PROJECT_ID  — The Vercel project ID to register domains against
 *   VERCEL_TEAM_ID     — Team ID (required when using a team-scoped token)
 */
export interface VercelEnvConfig {
  /** Vercel API token. Absent → Vercel integration disabled. */
  readonly apiToken:     string | undefined;
  /** Vercel project ID. Absent → Vercel integration disabled. */
  readonly projectId:    string | undefined;
  /**
   * Vercel team ID, e.g. "team_xxxxxxxxxxxxxxxxxxxxxxxx".
   * Required when the API token is team-scoped; absent for personal tokens.
   */
  readonly teamId:       string | undefined;
  /** True when both VERCEL_API_TOKEN and VERCEL_PROJECT_ID are present. */
  readonly isConfigured: boolean;
}

/**
 * Transactional email configuration.
 *
 * All fields are optional — when absent the email dispatch layer skips
 * sending rather than crashing. This keeps the site safe in environments
 * where email is not yet configured (local dev, staging, etc.).
 *
 *   RESEND_API_KEY       — Resend API key; absent → email sending skipped
 *   MAIL_FROM_ADDRESS    — "From" address for outbound email; e.g. hello@example.com
 *   BACKOFFICE_EMAIL     — Default recipient for backoffice notifications
 */
export interface EmailEnvConfig {
  /** Resend API secret key. Absent → email dispatch is silently skipped. */
  readonly resendApiKey:      string | undefined;
  /** Default "From" address, e.g. "Mister Chameleon <hello@example.com>" */
  readonly fromAddress:       string | undefined;
  /** Default backoffice notification recipient address. */
  readonly backofficeEmail:   string | undefined;
}

// ── Validation infrastructure ─────────────────────────────────────────────────

/**
 * Builds a validated group object.
 *
 * Passes two typed readers to `factory`:
 *   required(name)  — reads the var; collects the name if absent
 *   optional(name)  — reads the var; returns undefined if absent (never throws)
 *
 * If any required vars were missing, throws a single descriptive error listing
 * every missing name so the developer can fix them all in one restart.
 *
 * @param groupName   Human-readable label for the error message, e.g. "Sanity"
 * @param factory     Receives `required` and `optional` readers; returns the config
 */
function makeGroup<T>(groupName: string, factory: GroupFactory<T>): T {
  const missing: string[] = [];

  const required: RequiredReader = (name) => {
    const value = process.env[name];
    if (!value) missing.push(name);
    return value ?? "";
  };

  const optional: OptionalReader = (name) => process.env[name] || undefined;

  const result = factory(required, optional);

  if (missing.length > 0) {
    const noun = missing.length === 1 ? "variable" : "variables";
    const list = missing.map((n) => `  • ${n}`).join("\n");
    const fix =
      missing.length === 1 ? "Add it to" : "Add them to";

    throw new Error(
      `[env] Missing required environment ${noun} (${groupName}):\n\n` +
        `${list}\n\n` +
        `${fix} .env.local (development) or your deployment platform's ` +
        `environment config (production).\n` +
        `Refer to .env.example in the project root for the full variable reference.`,
    );
  }

  return result;
}

/**
 * Memoises a factory function so it runs at most once.
 *
 * The first call runs the factory, caches the result, and returns it.
 * Subsequent calls return the cached value directly.
 * If the factory throws, the error propagates and nothing is cached —
 * the next call will attempt to run the factory again.
 */
function once<T>(factory: () => T): () => T {
  // Wrap in an object to distinguish "cached undefined" from "not yet run".
  let cache: { value: T } | undefined;
  return () => {
    if (!cache) cache = { value: factory() };
    return cache.value;
  };
}

// ── Group validators (lazy, memoised) ─────────────────────────────────────────

const getStoryblokConfig = once((): StoryblokEnvConfig => {
  // If STORYBLOK_ACCESS_TOKEN is absent, Storyblok is not enabled.
  // Return a "not configured" sentinel so MockCMSProvider is used instead.
  const accessToken = process.env.STORYBLOK_ACCESS_TOKEN;
  if (!accessToken) {
    return {
      accessToken: "",
      region: "eu",
      version: "published",
      isConfigured: false,
    };
  }

  // STORYBLOK_ACCESS_TOKEN is set → resolve optional vars with safe defaults.
  const rawVersion = process.env.STORYBLOK_VERSION;
  const version: "published" | "draft" =
    rawVersion === "draft" ? "draft" : "published";

  return {
    accessToken,
    region: process.env.STORYBLOK_REGION || "eu",
    version,
    isConfigured: true,
  };
});

const getSanityConfig = once((): SanityEnvConfig => {
  // If SANITY_PROJECT_ID is absent, Sanity is not enabled.
  // Return a "not configured" sentinel rather than throwing so that
  // MockCMSProvider can be selected as the fallback without config errors.
  const projectId = process.env.SANITY_PROJECT_ID;
  if (!projectId) {
    return {
      projectId: "",
      dataset: "",
      apiVersion: "",
      readToken: undefined,
      isConfigured: false,
    };
  }

  // SANITY_PROJECT_ID is set → the remaining vars become required.
  return makeGroup("Sanity", (required, optional) => ({
    projectId: required("SANITY_PROJECT_ID"),
    dataset: required("SANITY_DATASET"),
    apiVersion: required("SANITY_API_VERSION"),
    readToken: optional("SANITY_READ_TOKEN"),
    isConfigured: true,
  }));
});

const getStatamicConfig = once((): StatamicEnvConfig => {
  // If STATAMIC_API_URL is absent, Statamic is not enabled.
  // Return a "not configured" sentinel so MockCMSProvider is used instead.
  const apiUrl = process.env.STATAMIC_API_URL;
  if (!apiUrl) {
    return {
      apiUrl: "",
      apiKey: undefined,
      isConfigured: false,
    };
  }

  // STATAMIC_API_URL is set → resolve optional API key.
  return {
    apiUrl,
    apiKey: process.env.STATAMIC_API_KEY || undefined,
    isConfigured: true,
  };
});

const getSupabaseServerConfig = once((): SupabaseServerEnvConfig =>
  makeGroup("Supabase (server)", (required) => ({
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  })),
);

const getN8nConfig = once(
  (): N8nEnvConfig => ({
    // All n8n vars are optional — the contact form is a nice-to-have
    contactWebhookUrl: process.env.N8N_CONTACT_WEBHOOK_URL || undefined,
  }),
);

const getEmailConfig = once(
  (): EmailEnvConfig => ({
    // All email vars are optional — email sending is skipped when absent.
    resendApiKey:    process.env.RESEND_API_KEY    || undefined,
    fromAddress:     process.env.MAIL_FROM_ADDRESS  || undefined,
    backofficeEmail: process.env.BACKOFFICE_EMAIL   || undefined,
  }),
);

const getVercelConfig = once((): VercelEnvConfig => {
  // Try both common env var names for the API token.
  const apiToken  = process.env.VERCEL_API_TOKEN || process.env.VERCEL_TOKEN || undefined;
  const projectId = process.env.VERCEL_PROJECT_ID || undefined;
  const teamId    = process.env.VERCEL_TEAM_ID    || undefined;

  return {
    apiToken,
    projectId,
    teamId,
    isConfigured: !!(apiToken && projectId),
  };
});

// ── Client environment ────────────────────────────────────────────────────────

/**
 * NEXT_PUBLIC_* environment variables.
 *
 * These are safe to use in Server Components, Client Components, and
 * middleware. Next.js inlines the values at build time; they carry no secrets.
 *
 * Values may be `undefined` at runtime if not set — callers must handle
 * this gracefully (e.g. fall back to a relative URL if siteUrl is absent).
 */
export const clientEnv = {
  /**
   * Canonical origin of the site, e.g. "https://misterchameleon.com".
   * Used for OG/SEO tags, sitemaps, and absolute URL construction.
   * Set NEXT_PUBLIC_SITE_URL in your deployment env.
   */
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL as string | undefined,

  /**
   * Supabase project URL, e.g. "https://abc123.supabase.co".
   * Required for Supabase client-side operations (auth, realtime, storage).
   */
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined,

  /**
   * Supabase anonymous/public key.
   * Safe to expose — this key enforces Row Level Security, not full access.
   */
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined,
} as const;

// ── Server environment ────────────────────────────────────────────────────────

/**
 * Server-only environment configuration.
 *
 * NEVER import this in files marked "use client". The `server-only` package
 * at the top of this module enforces that constraint at build time.
 *
 * Each property is a getter backed by a lazy, memoised validator:
 *   - First access validates and caches the result.
 *   - Required vars throw with ALL missing names listed in one error.
 *   - Subsequent accesses return the cached value — no repeated I/O.
 *
 * @example
 * import { serverEnv } from "@/lib/env";
 *
 * // Sanity (safe: returns isConfigured:false if SANITY_PROJECT_ID not set)
 * if (serverEnv.sanity.isConfigured) {
 *   const client = createClient({ projectId: serverEnv.sanity.projectId, ... });
 * }
 *
 * // Supabase (throws if SUPABASE_SERVICE_ROLE_KEY not set)
 * const supabase = createClient(clientEnv.supabaseUrl!, serverEnv.supabase.serviceRoleKey);
 *
 * // n8n (all optional — never throws)
 * const webhookUrl = serverEnv.n8n.contactWebhookUrl;
 */
export const serverEnv = {
  /**
   * Storyblok CMS configuration.
   *
   * When STORYBLOK_ACCESS_TOKEN is not set: returns `{ isConfigured: false }`.
   * When STORYBLOK_ACCESS_TOKEN is set: resolves optional vars with defaults.
   * Never throws — all Storyblok vars beyond the access token are optional.
   */
  get storyblok(): StoryblokEnvConfig {
    return getStoryblokConfig();
  },

  /**
   * Sanity CMS configuration.
   *
   * When SANITY_PROJECT_ID is not set: returns `{ isConfigured: false }`.
   * When SANITY_PROJECT_ID is set but SANITY_DATASET or SANITY_API_VERSION
   *   are missing: throws with both names listed.
   */
  get sanity(): SanityEnvConfig {
    return getSanityConfig();
  },

  /**
   * Statamic CMS configuration.
   *
   * When STATAMIC_API_URL is not set: returns `{ isConfigured: false }`.
   * When STATAMIC_API_URL is set: resolves optional API key.
   * Never throws — the API key is optional for public collections.
   */
  get statamic(): StatamicEnvConfig {
    return getStatamicConfig();
  },

  /**
   * Supabase server-side configuration.
   * Throws if SUPABASE_SERVICE_ROLE_KEY is not set.
   * Access only in server-only code paths (API routes, Server Actions, RSCs).
   */
  get supabase(): SupabaseServerEnvConfig {
    return getSupabaseServerConfig();
  },

  /**
   * n8n automation webhook configuration.
   * All fields are optional — never throws.
   * Returns undefined values when the vars are not set.
   */
  get n8n(): N8nEnvConfig {
    return getN8nConfig();
  },

  /**
   * Transactional email configuration (Resend).
   *
   * All fields are optional — never throws.
   * When resendApiKey is absent, email dispatch is silently skipped.
   * Set RESEND_API_KEY, MAIL_FROM_ADDRESS, and BACKOFFICE_EMAIL to enable.
   */
  get email(): EmailEnvConfig {
    return getEmailConfig();
  },

  /**
   * Vercel Domains API configuration.
   *
   * All fields are optional — never throws.
   * When isConfigured is false, custom domains are activated immediately
   * without Vercel registration or DNS verification.
   *
   * Set VERCEL_API_TOKEN (or VERCEL_TOKEN) and VERCEL_PROJECT_ID to enable
   * automatic domain registration and DNS verification via Vercel.
   */
  get vercel(): VercelEnvConfig {
    return getVercelConfig();
  },
} as const;
