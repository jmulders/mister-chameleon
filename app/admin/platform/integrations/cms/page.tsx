/**
 * Admin — Integrations › CMS
 *
 * Provider-agnostic CMS integration settings page.
 * Accessible at /admin/platform/integrations/cms.
 *
 * ─── Providers shown ─────────────────────────────────────────────────────────
 *
 *   ● Sanity     — platform-wide Sanity project credentials + test connection
 *   ● Storyblok  — access token, region, and content version
 *   ● Statamic   — base URL and API key
 *
 *   Each provider section is independent — configure only the one you use.
 *   The CMSProvider factory uses the first configured provider in priority order:
 *   Sanity → Storyblok → Statamic → Mock.
 *
 * ─── Relationship to /admin/platform/cms ─────────────────────────────────────
 *
 *   This is the canonical location for CMS settings under the Integrations IA.
 *   The legacy /admin/platform/cms route redirects here.
 *
 *   Actions and client component live in:
 *     app/admin/platform/cms/actions.ts
 *     app/admin/platform/cms/_components/CmsPlatformClient.tsx
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   Server actions strip all secret values before returning.  Only boolean
 *   flags and non-secret strings cross the server→client boundary.
 */

import Link                               from "next/link";
import {
  getCmsPlatformSettingsAction,
  getCmsStoryblokSettingsAction,
  getCmsStatamicSettingsAction,
} from "@/app/admin/platform/cms/actions";
import { CmsPlatformClient }              from "@/app/admin/platform/cms/_components/CmsPlatformClient";

export default async function IntegrationsCmsPage() {
  // Fetch all three provider settings in parallel.
  const [sanityResult, storyblokResult, statamicResult] = await Promise.all([
    getCmsPlatformSettingsAction(),
    getCmsStoryblokSettingsAction(),
    getCmsStatamicSettingsAction(),
  ]);

  const loadError =
    (!sanityResult.ok    && sanityResult.error)    ||
    (!storyblokResult.ok && storyblokResult.error) ||
    (!statamicResult.ok  && statamicResult.error)  ||
    null;

  return (
    <div className="mx-auto max-w-xl space-y-5 p-8">

      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">CMS — Platform Credentials</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Platform-wide CMS credentials and infrastructure defaults.
          Configure write tokens and access tokens for the CMS providers you use.
          Env vars remain as fallback when database settings are empty.
          This page stores <strong>secrets and shared defaults only</strong> — per-tenant
          provider selection and config overrides are set in each tenant's Integrations tab.
        </p>
      </div>

      {/* Delegation note */}
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
        <strong>Per-tenant CMS config</strong> (provider choice, projectId overrides,
        Storyblok region/version, Statamic base URL) is managed in each tenant's{" "}
        <Link href="/admin/tenants" className="font-medium text-brand-600 hover:underline">
          Integrations workspace tab
        </Link>
        .
      </div>

      {/* Security callout */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800">
        <strong>Secrets stay server-side.</strong> Tokens and API keys are stored
        encrypted at rest and never returned to the browser after saving.
        The UI shows only whether a credential is configured, not its value.
      </div>

      {/* Error loading settings */}
      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-800">Failed to load CMS settings</p>
          <p className="mt-1 text-xs text-red-700">{loadError}</p>
          <p className="mt-2 text-xs text-red-600">
            Ensure the{" "}
            <code className="rounded bg-red-100 px-1 font-mono">platform_settings</code>{" "}
            table exists in Supabase.
          </p>
        </div>
      )}

      {/* Provider settings — rendered when all loads succeed */}
      {sanityResult.ok && storyblokResult.ok && statamicResult.ok && (
        <CmsPlatformClient
          projectId={sanityResult.projectId}
          dataset={sanityResult.dataset}
          hasWriteToken={sanityResult.hasWriteToken}
          updatedAt={sanityResult.updatedAt}
          storyblok={{
            region:              storyblokResult.region,
            version:             storyblokResult.version,
            spaceId:             storyblokResult.spaceId,
            hasAccessToken:      storyblokResult.hasAccessToken,
            hasManagementToken:  storyblokResult.hasManagementToken,
            updatedAt:           storyblokResult.updatedAt,
          }}
          statamic={{
            baseUrl:   statamicResult.baseUrl,
            hasApiKey: statamicResult.hasApiKey,
            updatedAt: statamicResult.updatedAt,
          }}
        />
      )}

    </div>
  );
}
