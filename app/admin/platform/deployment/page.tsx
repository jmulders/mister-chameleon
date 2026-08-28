/**
 * /admin/platform/deployment
 *
 * Deployment dashboard — shows setup status, env var checklist, and a step-by-step
 * guide for deploying Mister Chameleon on Vercel + Supabase Cloud.
 *
 * All checks run server-side.  Env var values are NEVER sent to the client —
 * only boolean isSet flags reach the browser.
 */

import { createClient }              from "@supabase/supabase-js";
import { getRequiredAdminSession }   from "@/lib/admin-auth/authorization";
import {
  getPlatformStorageSettings,
  storageProviderFlags,
  getPlatformEmailSettings,
  emailPlatformFlags,
}                                    from "@/platform/platform-store";
import { DeploymentDashboard }       from "./_components/DeploymentDashboard";
import { rethrowNextInternal } from "@/lib/server-action-guard";

export const dynamic = "force-dynamic";

// ── Env var manifest ──────────────────────────────────────────────────────────

export interface EnvVarEntry {
  key:         string;
  required:    boolean;
  group:       string;
  description: string;
  howToGet:    string;
  /**
   * When true, this variable can alternatively be configured via the admin
   * integrations UI (stored in platform_settings DB).  The env var itself is
   * optional in that case.
   */
  canUseDb?:   boolean;
}

const ENV_VAR_MANIFEST: EnvVarEntry[] = [
  // Supabase
  { key: "NEXT_PUBLIC_SUPABASE_URL",    required: true,  group: "Supabase",    description: "Project URL",                         howToGet: "Supabase dashboard → Settings → API → Project URL" },
  { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", required: true, group: "Supabase",   description: "Public anon key (browser-safe)",        howToGet: "Supabase dashboard → Settings → API → Project API keys" },
  { key: "SUPABASE_SERVICE_ROLE_KEY",   required: true,  group: "Supabase",    description: "Secret service-role key (server only)", howToGet: "Supabase dashboard → Settings → API → Project API keys" },
  // Admin auth
  { key: "ADMIN_SESSION_SECRET",        required: true,  group: "Admin Auth",  description: "JWT signing secret (≥32 chars)",        howToGet: "Generate: openssl rand -hex 32" },
  { key: "ADMIN_TOTP_ISSUER",           required: false, group: "Admin Auth",  description: "Issuer name shown in authenticator apps", howToGet: "Any string, e.g. \"Mister Chameleon\"" },
  // Site
  { key: "NEXT_PUBLIC_SITE_URL",        required: false, group: "Site",        description: "Canonical origin for OG/SEO/sitemaps",   howToGet: "Your production domain, e.g. https://example.com" },
  { key: "MC_FALLBACK_TENANT_ID",       required: false, group: "Site",        description: "Tenant to use on unrecognised hostnames", howToGet: "A tenantId from tenant/resolve-tenant.ts" },
  { key: "MC_HOMEPAGE_DECISION_PROVIDER", required: false, group: "Site",      description: "Decision engine: rules | claude | openai", howToGet: "Default: rules (no API key needed)" },
  // Demo generator
  { key: "MC_DEMO_SITE_KEY",            required: false, group: "Demo Generator", description: "API key protecting the /api/demo/mirror endpoint from public use", howToGet: "Generate: openssl rand -hex 32 — then set the same value in the generator client", canUseDb: true },
  // Sanity
  { key: "SANITY_PROJECT_ID",           required: false, group: "Sanity CMS",  description: "Sanity project ID",                     howToGet: "manage.sanity.io → Settings → API" },
  { key: "SANITY_DATASET",              required: false, group: "Sanity CMS",  description: "Dataset name (usually \"production\")",   howToGet: "manage.sanity.io → Datasets" },
  { key: "SANITY_API_VERSION",          required: false, group: "Sanity CMS",  description: "API version date, e.g. 2024-01-01",      howToGet: "Use today's date when creating a new project" },
  { key: "SANITY_READ_TOKEN",           required: false, group: "Sanity CMS",  description: "Read token for draft/preview content",   howToGet: "manage.sanity.io → Settings → API → Tokens" },
  { key: "SANITY_API_WRITE_TOKEN",      required: false, group: "Sanity CMS",  description: "Write token for CMS provisioning",       howToGet: "manage.sanity.io → Settings → API → Tokens (Write access)" },
  { key: "SANITY_API_TOKEN",            required: false, group: "Sanity CMS",  description: "Editor token used by \"Seed platform variants\" — read from the server env, so set it on the Vercel project (and in .env.local locally)", howToGet: "manage.sanity.io → your project → API → Tokens → Add API token (Editor role)" },
  // Storyblok CMS
  { key: "STORYBLOK_ACCESS_TOKEN",      required: false, group: "Storyblok CMS", description: "Content Delivery API access token (Preview or Public)", howToGet: "app.storyblok.com → your space → Settings → Access Tokens",                                              canUseDb: true },
  { key: "STORYBLOK_REGION",            required: false, group: "Storyblok CMS", description: "CDN region: eu | us | ap | ca | cn (default: eu)",     howToGet: "Match the region where your Storyblok space was created",                                                 canUseDb: true },
  { key: "STORYBLOK_VERSION",           required: false, group: "Storyblok CMS", description: "Content version: published | draft (default: published)", howToGet: "Use \"draft\" only in development to see unpublished content",                                         canUseDb: true },
  // Email
  { key: "RESEND_API_KEY",              required: false, group: "Email",       description: "Resend API key for transactional email", howToGet: "resend.com/api-keys",                                                                        canUseDb: true },
  { key: "SMTP_HOST",                   required: false, group: "Email",       description: "SMTP server hostname",                  howToGet: "Your email provider's SMTP settings",                                                       canUseDb: true },
  { key: "SMTP_PORT",                   required: false, group: "Email",       description: "SMTP port (587 or 465)",                 howToGet: "Your email provider's SMTP settings",                                                       canUseDb: true },
  { key: "SMTP_USER",                   required: false, group: "Email",       description: "SMTP auth username",                    howToGet: "Your email provider's SMTP credentials",                                                    canUseDb: true },
  { key: "SMTP_PASS",                   required: false, group: "Email",       description: "SMTP auth password",                    howToGet: "Your email provider's SMTP credentials",                                                    canUseDb: true },
  { key: "MAIL_FROM_ADDRESS",           required: false, group: "Email",       description: "Default From address",                  howToGet: "Format: Display Name <address@example.com>" },
  { key: "BACKOFFICE_EMAIL",            required: false, group: "Email",       description: "Platform-level notification recipient", howToGet: "Your ops team email address" },
  { key: "EMAIL_ENCRYPTION_KEY",        required: false, group: "Email",       description: "Key for encrypting per-tenant SMTP secrets", howToGet: "Generate: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"" },
  // AI
  { key: "ANTHROPIC_API_KEY",           required: false, group: "AI Providers", description: "Anthropic Claude API key",              howToGet: "console.anthropic.com" },
  { key: "OPENAI_API_KEY",              required: false, group: "AI Providers", description: "OpenAI API key",                        howToGet: "platform.openai.com/api-keys" },
  // Vercel
  { key: "VERCEL_API_TOKEN",            required: false, group: "Vercel",      description: "Token for domain management API",       howToGet: "vercel.com/account/tokens" },
  { key: "VERCEL_PROJECT_ID",           required: false, group: "Vercel",      description: "Your Vercel project ID",                howToGet: "vercel.com/[team]/[project]/settings → General" },
  { key: "VERCEL_TEAM_ID",              required: false, group: "Vercel",      description: "Your Vercel team ID (team_…)",           howToGet: "vercel.com/[team]/settings → General" },
  // Storage
  { key: "R2_ACCOUNT_ID",              required: false, group: "Cloudflare R2", description: "Cloudflare account ID",                howToGet: "dash.cloudflare.com → right sidebar",                     canUseDb: true },
  { key: "R2_ACCESS_KEY_ID",           required: false, group: "Cloudflare R2", description: "R2 API token Access Key ID",           howToGet: "dash.cloudflare.com → R2 → API tokens",                   canUseDb: true },
  { key: "R2_SECRET_ACCESS_KEY",       required: false, group: "Cloudflare R2", description: "R2 API token Secret Access Key",       howToGet: "Shown once on token creation in R2 dashboard",            canUseDb: true },
  { key: "R2_BUCKET_NAME",             required: false, group: "Cloudflare R2", description: "R2 bucket name",                      howToGet: "Create a bucket in dash.cloudflare.com → R2",             canUseDb: true },
  { key: "R2_PUBLIC_URL",              required: false, group: "Cloudflare R2", description: "Public base URL for R2 assets",        howToGet: "Bucket overview or custom domain on R2 bucket",           canUseDb: true },
  // Statamic CMS
  { key: "STATAMIC_API_URL",           required: false, group: "Statamic CMS", description: "Base URL of the Statamic site (no trailing slash)", howToGet: "The tenant's CMS domain, e.g. https://cms.example.com",   canUseDb: true },
  { key: "STATAMIC_API_KEY",           required: false, group: "Statamic CMS", description: "API token AND shared secret for the CMS write route — must equal MISTER_CHAMELEON_CMS_WRITE_TOKEN in the Statamic app's .env", howToGet: "Generate: openssl rand -base64 32 — set the same value in Ploi", canUseDb: true },
  { key: "STATAMIC_WEBHOOK_SECRET",    required: false, group: "Statamic CMS", description: "x-statamic-secret for the cache-flush webhook",   howToGet: "Generate: openssl rand -base64 32 — set as MISTER_CHAMELEON_WEBHOOK_SECRET in Ploi", canUseDb: true },
  // Cron
  { key: "CRON_SECRET",                required: true,  group: "Cron",        description: "Gates every /api/cron/* endpoint",       howToGet: "Auto-injected by Vercel in production; set manually for local/staging" },
  // Lead base & webhooks
  { key: "LEAD_INBOUND_SECRET",        required: false, group: "Lead base",   description: "x-mc-secret for /api/webhooks/inbound-form (Statamic form bridge)", howToGet: "Generate: openssl rand -base64 32 — same value in the Statamic app's .env" },
  { key: "LEAD_SUPPRESSION_SECRET",    required: false, group: "Lead base",   description: "x-mc-secret for /api/webhooks/suppression (ESP unsubscribes)",     howToGet: "Generate: openssl rand -base64 32 — give it to your ESP" },
  // Stripe
  { key: "STRIPE_SECRET_KEY",          required: false, group: "Stripe",      description: "Live secret key",                        howToGet: "dashboard.stripe.com/apikeys",                            canUseDb: true },
  { key: "STRIPE_WEBHOOK_SECRET",      required: false, group: "Stripe",      description: "Signing secret for /api/webhooks/stripe", howToGet: "Stripe → Developers → Webhooks → your endpoint",          canUseDb: true },
  { key: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", required: false, group: "Stripe", description: "Publishable key (browser-safe)",      howToGet: "dashboard.stripe.com/apikeys",                            canUseDb: true },
  { key: "STRIPE_MODE",                required: false, group: "Stripe",      description: "test | live (default live) — validated against event.livemode", howToGet: "Set to \"test\" while developing" },
  // Enrichment
  { key: "MAXMIND_DB_PATH",            required: false, group: "Enrichment",  description: "Path to the local MaxMind GeoLite database", howToGet: "Download GeoLite2 from maxmind.com and point to the .mmdb file", canUseDb: true },
  { key: "IPINFO_TOKEN",               required: false, group: "Enrichment",  description: "IPinfo token for ASN/network-org lookup",  howToGet: "ipinfo.io/account",                                       canUseDb: true },
  { key: "CLEARBIT_SECRET_KEY",        required: false, group: "Enrichment",  description: "Clearbit Reveal (reverse-IP → company); absent = stub provider", howToGet: "dashboard.clearbit.com",                canUseDb: true },
  { key: "LEADINFO_API_KEY",           required: false, group: "Enrichment",  description: "Leadinfo IP-to-company",                  howToGet: "Your Leadinfo account",                                   canUseDb: true },
  { key: "LOCATIONIQ_API_KEY",         required: false, group: "Enrichment",  description: "Reverse-geocoding",                       howToGet: "locationiq.com",                                          canUseDb: true },
  // CRM
  { key: "HUBSPOT_ACCESS_TOKEN",       required: false, group: "HubSpot CRM", description: "Private App token for company/contact sync", howToGet: "HubSpot → Settings → Integrations → Private Apps",       canUseDb: true },
  // Google Calendar
  { key: "GOOGLE_SERVICE_ACCOUNT_EMAIL",       required: false, group: "Google Calendar", description: "Service account for demo bookings", howToGet: "console.cloud.google.com → IAM → Service Accounts",   canUseDb: true },
  { key: "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", required: false, group: "Google Calendar", description: "Private key for that service account", howToGet: "Download the JSON key and copy the private_key field", canUseDb: true },
  { key: "GOOGLE_CALENDAR_ID",                 required: false, group: "Google Calendar", description: "Target calendar for demo bookings", howToGet: "Google Calendar → Settings → Integrate calendar",     canUseDb: true },
];

// ── Status types ──────────────────────────────────────────────────────────────

export interface EnvVarStatus extends EnvVarEntry {
  isSet: boolean;
  /**
   * True when this variable's value is stored in platform_settings (DB)
   * via the admin integrations UI rather than as an environment variable.
   * When true, the env var not being set is expected and not a problem.
   */
  isSetViaDb?: boolean;
}

export type CheckStatus = "ok" | "warning" | "error" | "unknown";

export interface DeploymentCheck {
  id:      string;
  label:   string;
  status:  CheckStatus;
  detail:  string;
  fixHint?: string;
  /** True when a server action can fix this from the browser. */
  actionable?: boolean;
  actionId?:   string;
}

export interface DeploymentData {
  envVars:  EnvVarStatus[];
  checks:   DeploymentCheck[];
  dbConnected: boolean;
  enrichmentPricingRows:      number;
  enrichmentPricingZeroRows:  number;
  migrationCount:             number;
}

// ── Server-side data collection ───────────────────────────────────────────────

async function collectDeploymentData(): Promise<DeploymentData> {
  const envVars: EnvVarStatus[] = ENV_VAR_MANIFEST.map((entry) => ({
    ...entry,
    // Only the boolean — never the value itself
    isSet: Boolean(process.env[entry.key]?.trim()),
  }));

  // Special case: ADMIN_SESSION_SECRET must not be the placeholder value
  const adminSecretEntry = envVars.find((e) => e.key === "ADMIN_SESSION_SECRET");
  if (adminSecretEntry) {
    const raw = process.env["ADMIN_SESSION_SECRET"] ?? "";
    if (raw.includes("replace-with") || raw.length < 16) {
      adminSecretEntry.isSet = false;
    }
  }

  const checks: DeploymentCheck[] = [];
  let dbConnected            = false;
  let enrichmentPricingRows  = 0;
  let enrichmentPricingZeroRows = 0;
  let migrationCount         = 0;

  // ── Required env vars ─────────────────────────────────────────────────────
  const missingRequired = envVars.filter((e) => e.required && !e.isSet);
  checks.push({
    id:     "env-required",
    label:  "Required environment variables",
    status: missingRequired.length === 0 ? "ok" : "error",
    detail: missingRequired.length === 0
      ? "All 4 required variables are set."
      : `Missing: ${missingRequired.map((e) => e.key).join(", ")}`,
    fixHint: missingRequired.length > 0
      ? "Add these to .env.local (dev) or Vercel → Project Settings → Environment Variables (prod)."
      : undefined,
  });

  // ── Admin session secret quality ──────────────────────────────────────────
  const adminSecret = process.env["ADMIN_SESSION_SECRET"] ?? "";
  const secretOk = adminSecret.length >= 32 && !adminSecret.includes("replace-with");
  checks.push({
    id:      "admin-secret",
    label:   "Admin session secret strength",
    status:  secretOk ? "ok" : "error",
    detail:  secretOk
      ? "ADMIN_SESSION_SECRET is set and meets the minimum length requirement."
      : "ADMIN_SESSION_SECRET is missing, too short, or still uses the placeholder value.",
    fixHint: secretOk ? undefined : "Generate a strong secret: openssl rand -hex 32",
  });

  // ── Database connection ───────────────────────────────────────────────────
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (url && key) {
    try {
      const db = createClient(url, key, { auth: { persistSession: false } });

      // Test connection + check a key table
      const { error: connErr } = await db
        .from("tenant_wallets")
        .select("id")
        .limit(1);

      if (!connErr || connErr.code === "42P01") {
        dbConnected = true;
        checks.push({
          id:     "db-connection",
          label:  "Database connection",
          status: "ok",
          detail: "Successfully connected to Supabase.",
        });
      } else {
        checks.push({
          id:     "db-connection",
          label:  "Database connection",
          status: "error",
          detail: `Connection failed: ${connErr.message}`,
          fixHint: "Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are correct.",
        });
      }

      if (dbConnected) {
        // ── Migrations applied ─────────────────────────────────────────────
        // Check a few key tables from different migrations
        const tableChecks = [
          "visitor_sessions", "tenant_settings", "usage_events",
          "tenant_wallets", "wallet_ledger", "enrichment_pricing",
        ];
        let tablesOk = 0;
        for (const t of tableChecks) {
          const { error } = await db.from(t).select("id").limit(0);
          if (!error || error.code !== "42P01") tablesOk++;
        }
        migrationCount = tablesOk;

        checks.push({
          id:     "db-migrations",
          label:  "Database migrations",
          status: tablesOk === tableChecks.length ? "ok"
                : tablesOk >= 3                   ? "warning"
                : "error",
          detail: `${tablesOk}/${tableChecks.length} key tables present.`,
          fixHint: tablesOk < tableChecks.length
            ? "Run: npm run db:migrate  (applies supabase/migrations and records them in public._migrations)"
            : undefined,
        });

        // ── Enrichment pricing seeded ──────────────────────────────────────
        const { data: pricingRows, error: pricingErr } = await db
          .from("enrichment_pricing")
          .select("enrichment_type, credit_cost");

        if (!pricingErr && pricingRows) {
          enrichmentPricingRows     = pricingRows.length;
          enrichmentPricingZeroRows = pricingRows.filter(
            (r) => Number((r as { credit_cost: unknown }).credit_cost) === 0,
          ).length;

          checks.push({
            id:     "enrichment-pricing",
            label:  "Enrichment pricing",
            status: enrichmentPricingRows === 0              ? "warning"
                  : enrichmentPricingZeroRows > 0            ? "warning"
                  : "ok",
            detail: enrichmentPricingRows === 0
              ? "No pricing rows — enrichments will not be billed."
              : enrichmentPricingZeroRows > 0
                ? `${enrichmentPricingRows} rows found, but ${enrichmentPricingZeroRows} have credit_cost = 0 — those enrichments bill 0 credits.`
                : `${enrichmentPricingRows} rows seeded with non-zero credit costs.`,
            fixHint: enrichmentPricingRows === 0 || enrichmentPricingZeroRows > 0
              ? "Use the 'Reset to defaults' button below to fix pricing."
              : undefined,
            actionable: enrichmentPricingRows === 0 || enrichmentPricingZeroRows > 0,
            actionId: "seed-enrichment-pricing",
          });
        } else if (pricingErr?.code === "42P01") {
          checks.push({
            id:     "enrichment-pricing",
            label:  "Enrichment pricing",
            status: "error",
            detail: "enrichment_pricing table missing — run migrations first.",
            fixHint: "Run: npm run db:migrate",
          });
        }
      }
    } catch (err) {
    rethrowNextInternal(err);
      checks.push({
        id:     "db-connection",
        label:  "Database connection",
        status: "error",
        detail: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  } else {
    checks.push({
      id:     "db-connection",
      label:  "Database connection",
      status: "error",
      detail: "Supabase env vars not set — cannot test connection.",
      fixHint: "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    });
  }

  // ── Email transport ───────────────────────────────────────────────────────
  //
  // Resolution order (mirrors lib/email-transport.ts):
  //   1. platform_settings DB row  (configured via Integrations → Email)
  //   2. Environment variables      (RESEND_API_KEY / SMTP_HOST)
  //
  // One DB call handles both the checklist check AND per-var isSetViaDb flags.
  {
    const envResend = Boolean(process.env["RESEND_API_KEY"]?.trim());
    const envSmtp   = Boolean(process.env["SMTP_HOST"]?.trim());

    let dbConfigured    = false;
    let dbTransportType = "none";

    try {
      const emailResult = await getPlatformEmailSettings();
      if (emailResult.ok) {
        const f = emailPlatformFlags(emailResult.data);
        dbConfigured    = f.configured;
        dbTransportType = f.transportType;

        // Mark each var individually — only those actually present in the DB row.
        // EMAIL_ENCRYPTION_KEY is env-only and is intentionally excluded.
        const mark = (key: string, hasValue: boolean) => {
          if (!hasValue) return;
          const entry = envVars.find((v) => v.key === key);
          if (entry) entry.isSetViaDb = true;
        };
        mark("RESEND_API_KEY",    f.hasResendKey);
        mark("SMTP_HOST",         Boolean(f.smtpHost));
        mark("SMTP_PORT",         Boolean(f.smtpPort));
        mark("SMTP_USER",         Boolean(f.smtpUsername));
        mark("SMTP_PASS",         f.hasSmtpPassword);
        mark("MAIL_FROM_ADDRESS", Boolean(f.fromEmail));
        mark("BACKOFFICE_EMAIL",  Boolean(f.backofficeEmail));
      }
    } catch {
      // platform_settings not available — fall through to env var check
    }

    const configured    = dbConfigured || envResend || envSmtp;
    const transportLabel =
      dbConfigured ? (dbTransportType === "resend" ? "Resend" : "SMTP") + " (platform settings)"
      : envResend  ? "Resend (env var)"
      : envSmtp    ? "SMTP (env var)"
      : null;

    checks.push({
      id:     "email",
      label:  "Email transport",
      status: configured ? "ok" : "warning",
      detail: configured
        ? `${transportLabel} is configured.`
        : "No email transport configured — form notification emails will be skipped.",
      fixHint: !configured
        ? "Configure email in Integrations → Email, or set RESEND_API_KEY / SMTP_HOST env vars."
        : undefined,
    });
  }

  // ── Storage ───────────────────────────────────────────────────────────────
  //
  // Resolution order (mirrors lib/assets/storage-adapter.ts):
  //   1. platform_settings DB row  (configured via Integrations → Storage)
  //   2. Environment variables      (R2_ACCOUNT_ID, etc.)
  //
  // One DB call handles both the checklist check AND per-var isSetViaDb flags.
  {
    const envR2 = Boolean(process.env["R2_ACCOUNT_ID"]?.trim());

    let dbR2Configured = false;
    let dbProvider     = "supabase_storage";

    try {
      const storageResult = await getPlatformStorageSettings();
      if (storageResult.ok) {
        const flags = storageProviderFlags(storageResult.data);
        dbR2Configured = flags.r2Configured;
        dbProvider     = storageResult.data.activeProvider ?? "supabase_storage";

        // Mark each R2 var individually based on whether that field is in DB.
        const r2 = storageResult.data.cloudflareR2 ?? {};
        const mark = (key: string, hasValue: boolean) => {
          if (!hasValue) return;
          const entry = envVars.find((v) => v.key === key);
          if (entry) entry.isSetViaDb = true;
        };
        mark("R2_ACCOUNT_ID",        Boolean(r2.accountId));
        mark("R2_ACCESS_KEY_ID",     Boolean(r2.accessKeyId));
        mark("R2_SECRET_ACCESS_KEY", Boolean(r2.secretAccessKey));
        mark("R2_BUCKET_NAME",       Boolean(r2.bucketName));
        mark("R2_PUBLIC_URL",        Boolean(r2.publicUrl));
      }
    } catch {
      // platform_settings not available — fall through to env var check
    }

    const r2Ok   = dbR2Configured || envR2;
    const source = dbR2Configured ? " (platform settings)" : envR2 ? " (env var)" : "";

    checks.push({
      id:     "storage",
      label:  "Asset storage (R2)",
      status: r2Ok ? "ok" : "warning",
      detail: r2Ok
        ? `Cloudflare R2 is configured${source}. Active provider: ${dbProvider}.`
        : "R2 not configured — asset uploads will fall back to Supabase Storage.",
      fixHint: !r2Ok
        ? "Configure R2 in Integrations → Storage, or set R2_ACCOUNT_ID + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY + R2_BUCKET_NAME + R2_PUBLIC_URL env vars."
        : undefined,
    });
  }

  // ── CMS ──────────────────────────────────────────────────────────────────
  const hasSanity     = Boolean(process.env["SANITY_PROJECT_ID"]?.trim());
  const hasStoryblok  = Boolean(process.env["STORYBLOK_ACCESS_TOKEN"]?.trim());
  checks.push({
    id:     "cms",
    label:  "CMS connection",
    status: hasSanity || hasStoryblok ? "ok" : "warning",
    detail: hasSanity    ? "Sanity CMS is configured."
          : hasStoryblok ? "Storyblok CMS is configured."
          : "No CMS configured — app will use built-in mock content.",
    fixHint: !hasSanity && !hasStoryblok
      ? "Set SANITY_PROJECT_ID (and SANITY_DATASET, SANITY_API_VERSION) to enable live CMS content."
      : undefined,
  });

  // ── Sanity platform variant seed ──────────────────────────────────────────
  //
  // When Sanity is configured, probe whether the shared platform variant
  // documents exist.  We spot-check 4 representative _id values (one per
  // document type) — if none of them exist the dataset is almost certainly
  // unseeded.
  if (hasSanity && dbConnected) {
    const sanityUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];  // not Sanity
    const sanityProjectId = process.env["SANITY_PROJECT_ID"] ?? process.env["NEXT_PUBLIC_SANITY_PROJECT_ID"];
    const sanityDataset   = process.env["SANITY_DATASET"] ?? process.env["NEXT_PUBLIC_SANITY_DATASET"] ?? "production";
    const sanityToken     = process.env["SANITY_READ_TOKEN"];
    const hasWriteToken   = Boolean(process.env["SANITY_API_TOKEN"]?.trim());
    void sanityUrl; // suppress unused warning — not used below

    if (sanityProjectId) {
      try {
        const { createClient } = await import("@sanity/client");
        const probe = createClient({
          projectId:  sanityProjectId,
          dataset:    sanityDataset,
          apiVersion: process.env["SANITY_API_VERSION"] ?? "2024-01-01",
          useCdn:     false,
          token:      sanityToken,
        });

        // Probe all known hero page banner variant IDs to detect missing ones.
        // The list is extended whenever new banner variants are added to platform-seed.ts.
        const spotIds = [
          "hero_direct_brand",
          "hero_page_banner",
          "hero_page_banner_how_it_works",
          "hero_page_banner_why_personalisation",
          "hero_page_banner_the_engine",
          "hero_page_banner_features",
          "hero_page_banner_features_segments",
          "hero_page_banner_features_intent",
          "hero_page_banner_features_enrichment",
          "hero_page_banner_features_testing",
          "hero_page_banner_features_analytics",
          "hero_page_banner_features_agency",
          "hero_page_banner_integrations",
          "hero_page_banner_security",
          "hero_page_banner_demo",
          "hero_page_banner_pricing",
          "hero_page_banner_order",
          "hero_page_banner_use_cases",
          "hero_page_banner_cases",
          "hero_page_banner_blog",
          "hero_page_banner_partners",
          "hero_page_banner_high_intent",
          "hero_page_banner_consideration",
          "hero_page_banner_returning",
          "hero_page_banner_enterprise",
          "hero_page_banner_awareness",
          "proof_default",
          "cta_guide",
          "feature_grid_primary",
          "conversion_demo",
        ];

        const result = await probe.fetch<Array<{ _id: string }>>(
          `*[_id in $ids]{ _id }`,
          { ids: spotIds },
        );

        const found      = result.length;
        const total      = spotIds.length;
        const allPresent = found === total;
        const missing    = spotIds.filter((id) => !result.some((r) => r._id === id));

        checks.push({
          id:         "sanity-variants",
          label:      "Sanity platform variant seed",
          status:     allPresent ? "ok" : "warning",
          detail:     allPresent
            ? `All ${total} platform variant documents are present.`
            : `${found}/${total} variants found — ${missing.length} missing (${missing.slice(0, 3).join(", ")}${missing.length > 3 ? "…" : ""}). Re-seed to add them.`,
          fixHint:    !allPresent
            ? hasWriteToken
              ? "Click 'Seed platform variants' to create or update all shared variant documents."
              : "Set SANITY_API_TOKEN (write token) and then click 'Seed platform variants'."
            : undefined,
          // Always show the button when a write token is present — new variants
          // may have been added to platform-seed.ts even when the check passes.
          actionable: hasWriteToken,
          actionId:   "seed-platform-variants",
        });
      } catch {
        checks.push({
          id:     "sanity-variants",
          label:  "Sanity platform variant seed",
          status: "unknown",
          detail: "Could not probe Sanity for variant documents — check your Sanity credentials.",
        });
      }
    }
  } else if (hasSanity) {
    // Sanity is configured but DB isn't connected — skip the probe
    checks.push({
      id:     "sanity-variants",
      label:  "Sanity platform variant seed",
      status: "unknown",
      detail: "Sanity is configured but DB is not connected — skipping variant check.",
    });
  }

  return {
    envVars,
    checks,
    dbConnected,
    enrichmentPricingRows,
    enrichmentPricingZeroRows,
    migrationCount,
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DeploymentPage() {
  await getRequiredAdminSession();

  const data = await collectDeploymentData();

  return (
    <div className="max-w-4xl p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-900">Deployment</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Setup checklist, environment variable status, and deployment guide for
          Vercel + Supabase Cloud.
        </p>
      </div>

      <DeploymentDashboard data={data} />
    </div>
  );
}
