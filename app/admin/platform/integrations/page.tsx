/**
 * Admin — Platform Integrations Hub
 *
 * Landing page for all platform-wide integrations.
 * Accessible at /admin/platform/integrations.
 *
 * ─── Integration sections ─────────────────────────────────────────────────────
 *
 *   CMS         — content management (Sanity · Storyblok · Statamic)
 *   CRM         — customer enrichment (HubSpot)
 *   AI          — LLM provider keys (Anthropic · OpenAI)
 *   Enrichment  — visitor & company enrichment (MaxMind GeoIP · KvK API · OpenKvK)
 *   Domains     — custom domain management (Vercel Domains API)
 *
 * ─── Status display ───────────────────────────────────────────────────────────
 *
 *   Each card shows whether the integration has live credentials configured.
 *   Status is fetched server-side — no secrets cross the server→client boundary.
 *
 * ─── Adding a new integration ─────────────────────────────────────────────────
 *
 *   1. Create  app/admin/platform/integrations/<name>/page.tsx
 *   2. Add the corresponding store section in platform/platform-store.ts
 *   3. Add a card entry to the INTEGRATIONS factory in this file
 *   4. Add a sub-item under "Integrations" in components/admin/AdminNav.tsx
 */

import Link from "next/link";
import { getPlatformSettingsAction } from "@/app/admin/platform/settings/actions";
import { getCmsPlatformSettingsAction, getCmsStoryblokSettingsAction, getCmsStatamicSettingsAction } from "@/app/admin/platform/cms/actions";
import { getCrmPlatformSettingsAction }           from "@/app/admin/platform/crm/actions";
import { getPlatformEmailAction }                 from "@/app/admin/platform/integrations/email/actions";
import { getStripePlatformSettingsAction }        from "@/app/admin/platform/integrations/stripe/actions";
import { getStorageSettingsAction }               from "@/app/admin/platform/integrations/storage/actions";
import { getGoogleCalendarSettingsAction }        from "@/app/admin/platform/integrations/calendar/actions";
import { getEnrichmentPlatformSettingsAction }   from "@/app/admin/platform/integrations/enrichment/actions";

// ── Types ─────────────────────────────────────────────────────────────────────

interface IntegrationCard {
  /** Display name shown as the card heading. */
  name: string;
  /** One-line description of what this integration does. */
  description: string;
  /**
   * Active providers / technologies shown as badges.
   * Empty array shows no badges.
   */
  providers: { label: string; variant: "blue" | "orange" | "purple" | "teal" | "amber" | "neutral" }[];
  /** URL of the settings sub-page. */
  href: string;
  /** Whether the integration has been configured with live credentials. */
  configured: boolean;
}

// ── Provider labels ────────────────────────────────────────────────────────────

const PROVIDER_LABELS: Record<string, string> = {
  sanity_assets:    "Sanity Assets",
  supabase_storage: "Supabase Storage",
  cloudflare_r2:    "Cloudflare R2",
};

// ── Badge colours ─────────────────────────────────────────────────────────────

const BADGE_CLASSES = {
  blue:    "bg-blue-50   text-blue-700   ring-blue-200",
  orange:  "bg-orange-50 text-orange-700 ring-orange-200",
  purple:  "bg-purple-50 text-purple-700 ring-purple-200",
  teal:    "bg-teal-50   text-teal-700   ring-teal-200",
  amber:   "bg-amber-50  text-amber-700  ring-amber-200",
  neutral: "bg-neutral-100 text-neutral-600 ring-neutral-200",
} as const;

// ── Hub page ──────────────────────────────────────────────────────────────────

export default async function IntegrationsHubPage() {
  // Fetch all integration statuses in parallel.
  const [platformResult, sanityResult, storyblokResult, statamicResult, crmResult, emailResult, stripeResult, storageResult, calendarResult, enrichmentResult] =
    await Promise.all([
      getPlatformSettingsAction(),
      getCmsPlatformSettingsAction(),
      getCmsStoryblokSettingsAction(),
      getCmsStatamicSettingsAction(),
      getCrmPlatformSettingsAction(),
      getPlatformEmailAction(),
      getStripePlatformSettingsAction(),
      getStorageSettingsAction(),
      getGoogleCalendarSettingsAction(),
      getEnrichmentPlatformSettingsAction(),
    ]);

  // Determine CMS configured state: any provider with credentials counts.
  const cmsConfigured =
    (sanityResult.ok    && (!!sanityResult.projectId    || sanityResult.hasWriteToken))  ||
    (storyblokResult.ok && storyblokResult.hasAccessToken)                               ||
    (statamicResult.ok  && (!!statamicResult.baseUrl    || statamicResult.hasApiKey));

  // Build active CMS provider badges.
  const cmsBadges: IntegrationCard["providers"] = [];
  if (sanityResult.ok && (sanityResult.hasWriteToken || !!sanityResult.projectId)) {
    cmsBadges.push({ label: "Sanity", variant: "blue" });
  }
  if (storyblokResult.ok && storyblokResult.hasAccessToken) {
    cmsBadges.push({ label: "Storyblok", variant: "teal" });
  }
  if (statamicResult.ok && (statamicResult.hasApiKey || !!statamicResult.baseUrl)) {
    cmsBadges.push({ label: "Statamic", variant: "amber" });
  }
  if (cmsBadges.length === 0) {
    cmsBadges.push({ label: "Sanity · Storyblok · Statamic", variant: "neutral" });
  }

  const integrations: IntegrationCard[] = [
    {
      name:        "CMS",
      description: "Write tokens and access tokens for CMS providers. Per-tenant provider selection and config overrides are in each tenant's Integrations tab.",
      providers:   cmsBadges,
      href:        "/admin/platform/integrations/cms",
      configured:  cmsConfigured,
    },
    {
      name:        "CRM",
      description: "HubSpot Private App access token for company-by-domain enrichment. Whether CRM runs for a specific tenant is controlled per-tenant.",
      providers:   [{ label: "HubSpot", variant: "orange" }],
      href:        "/admin/platform/integrations/crm",
      configured:  crmResult.ok && crmResult.hasAccessToken,
    },
    {
      name:        "AI",
      description: "Platform-level fallback API keys (Anthropic, OpenAI). AI mode, provider, and model are configured per-tenant in each tenant's Integrations tab.",
      providers:   [{ label: "Anthropic · OpenAI", variant: "purple" }],
      href:        "/admin/platform/integrations/ai",
      configured:  platformResult.ok &&
                   (platformResult.ai.hasAnthropicKey || platformResult.ai.hasOpenaiKey),
    },
    {
      name:        "Enrichment",
      description: "Visitor & company enrichment: IP geolocation (MaxMind), company lookup via KvK.nl and OpenKvK. Per-tenant enrichment is controlled in each tenant's Integrations tab.",
      providers:   (() => {
        const badges: IntegrationCard["providers"] = [];
        if (platformResult.ok && platformResult.maxmind.hasLicenseKey)
          badges.push({ label: "MaxMind GeoIP", variant: "teal" });
        if (enrichmentResult.ok && enrichmentResult.hasKvkApiKey)
          badges.push({ label: "KvK API", variant: "blue" });
        if (enrichmentResult.ok && enrichmentResult.hasOvioApiKey)
          badges.push({ label: "OpenKvK", variant: "neutral" });
        if (badges.length === 0)
          badges.push({ label: "MaxMind · KvK · OpenKvK", variant: "neutral" });
        return badges;
      })(),
      href:        "/admin/platform/integrations/enrichment",
      configured:  (platformResult.ok && platformResult.maxmind.hasLicenseKey) ||
                   (enrichmentResult.ok && (enrichmentResult.hasOvioApiKey || enrichmentResult.hasKvkApiKey)),
    },
    {
      name:        "Domains",
      description: "Vercel API token and team ID for domain provisioning. Per-tenant Vercel project mapping is configured in each tenant's Integrations tab.",
      providers:   [{ label: "Vercel", variant: "neutral" }],
      href:        "/admin/platform/integrations/domains",
      configured:  platformResult.ok && platformResult.vercel.hasApiToken,
    },
    {
      name:        "Email",
      description: "Default email transport (Resend or SMTP) for form notifications and confirmations. Individual tenants can override this in their own Forms settings.",
      providers:   [{ label: "Resend · SMTP", variant: "teal" }],
      href:        "/admin/platform/integrations/email",
      configured:  emailResult.ok && emailResult.config.configured,
    },
    {
      name:        "Stripe",
      description: "Platform-level Stripe credentials (publishable key, secret key, webhook secret) for subscription billing and payment processing.",
      providers:   [{ label: "Stripe", variant: "purple" }],
      href:        "/admin/platform/integrations/stripe",
      configured:  stripeResult.ok && (stripeResult.hasSecretKey || Boolean(stripeResult.publishableKey)),
    },
    {
      name:        "Storage",
      description: "Asset storage backend for the Tenant Asset Library. Choose between Sanity Assets (default), Supabase Storage (built-in), or Cloudflare R2 (zero-egress).",
      providers:   storageResult.ok
        ? [{ label: PROVIDER_LABELS[storageResult.config.effectiveProvider] ?? "Auto", variant: "teal" as const }]
        : [{ label: "Sanity · Supabase · R2", variant: "neutral" as const }],
      href:        "/admin/platform/integrations/storage",
      configured:  storageResult.ok,
    },
    {
      name:        "Google Calendar",
      description: "Service Account credentials voor de /book-demo pagina. Checkt je agenda op bezette tijden en toont alleen vrije slots.",
      providers:   [{ label: "Google Calendar", variant: "blue" as const }],
      href:        "/admin/platform/integrations/calendar",
      configured:  calendarResult.ok && calendarResult.config.isConfigured,
    },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">

      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Platform Integrations</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Platform-level secrets and infrastructure defaults. Each section stores
          the API keys or tokens that the platform needs to communicate with the
          integration.
        </p>
      </div>

      {/* Layering note */}
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
        <strong>This page: secrets + infrastructure defaults only.</strong>
        {" "}Which integrations are active for each tenant, and any per-tenant config
        overrides, are managed in each tenant's{" "}
        <Link href="/admin/tenants" className="font-medium text-brand-600 hover:underline">
          Integrations workspace tab
        </Link>
        .
      </div>

      {/* Integration cards */}
      <div className="space-y-3">
        {integrations.map((integration) => (
          <IntegrationCard key={integration.name} {...integration} />
        ))}
      </div>

    </div>
  );
}

// ── Card component ────────────────────────────────────────────────────────────

function IntegrationCard({
  name,
  description,
  providers,
  href,
  configured,
}: IntegrationCard) {
  return (
    <Link
      href={href}
      className="group block rounded-lg border border-neutral-200 bg-white px-4 py-4 transition-colors hover:border-brand-200 hover:bg-brand-50/30"
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left — name + badges + description */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-neutral-900">{name}</span>
            {providers.map((p) => (
              <span
                key={p.label}
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${BADGE_CLASSES[p.variant]}`}
              >
                {p.label}
              </span>
            ))}
          </div>
          <p className="mt-1 text-xs text-neutral-500 leading-relaxed">{description}</p>
        </div>

        {/* Right — status + Configure arrow */}
        <div className="shrink-0 flex flex-col items-end gap-2">
          <span
            className={`flex items-center gap-1 text-[11px] font-medium ${
              configured ? "text-green-700" : "text-neutral-400"
            }`}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                configured ? "bg-green-500" : "bg-neutral-300"
              }`}
            />
            {configured ? "Configured" : "Not configured"}
          </span>
          <span className="text-[11px] font-medium text-brand-600 group-hover:text-brand-700 group-hover:underline">
            Configure →
          </span>
        </div>
      </div>
    </Link>
  );
}
