/**
 * Admin — Integrations › Domains
 *
 * Platform-wide domain management settings page.
 * Accessible at /admin/platform/integrations/domains.
 *
 * ─── What this page manages ───────────────────────────────────────────────────
 *
 *   Vercel Domains API credentials for custom tenant domain management:
 *
 *     teamId    — Vercel team ID (non-secret; leave blank for personal accounts)
 *     apiToken  — Vercel API token (server-only secret)
 *
 *   These credentials are used to add, verify, and remove custom domains for
 *   tenant sites when a tenant is provisioned with a custom domain.
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   This server component calls getPlatformSettingsAction() which strips all
 *   secret values before returning.  Only boolean flags and the non-secret
 *   teamId string are passed to the client component.
 */

import Link                         from "next/link";
import { getPlatformSettingsAction } from "@/app/admin/platform/settings/actions";
import { DomainsPlatformClient }    from "./_components/DomainsPlatformClient";

export default async function IntegrationsDomainsPage() {
  const result = await getPlatformSettingsAction();

  return (
    <div className="mx-auto max-w-xl space-y-5 p-8">

      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Domains: Platform Credentials</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Vercel Domains API credentials (team ID + API token). This page stores
          <strong> infrastructure credentials only</strong>: per-tenant Vercel project
          mapping and domain lists are configured in each tenant's Integrations workspace tab.
        </p>
      </div>

      {/* Delegation note */}
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
        <strong>Per-tenant domain config</strong> (Vercel project ID, domains) is managed in
        each tenant's{" "}
        <Link href="/admin/tenants" className="font-medium text-brand-600 hover:underline">
          Integrations workspace tab
        </Link>
        . The API token here is the shared credential used for all tenant provisioning.
      </div>

      {/* Security callout */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800">
        <strong>Secrets stay server-side.</strong> The API token is stored encrypted
        at rest and never returned to the browser after saving.
        The UI shows only whether a token is configured, not its value.
      </div>

      {/* Error loading settings */}
      {!result.ok && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-800">Failed to load domain settings</p>
          <p className="mt-1 text-xs text-red-700">{result.error}</p>
        </div>
      )}

      {/* Settings form */}
      {result.ok && (
        <DomainsPlatformClient
          teamId={result.vercel.teamId}
          hasApiToken={result.vercel.hasApiToken}
          updatedAt={result.vercel.updatedAt}
        />
      )}

    </div>
  );
}
