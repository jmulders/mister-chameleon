/**
 * Admin — Integrations › CRM
 *
 * Platform-wide CRM integration settings page.
 * Accessible at /admin/platform/integrations/crm.
 *
 * ─── Relationship to /admin/platform/crm ─────────────────────────────────────
 *
 *   This page is the canonical location for CRM settings under the new
 *   Integrations information architecture.  The legacy /admin/platform/crm
 *   route now redirects here.
 *
 *   All logic lives in the existing actions and client component:
 *     app/admin/platform/crm/actions.ts
 *     app/admin/platform/crm/_components/CrmPlatformClient.tsx
 *
 *   Nothing is duplicated — this page is a thin RSC wrapper that calls those
 *   actions, passes the safe (non-secret) props to the client component, and
 *   adds the breadcrumb back to the Integrations hub.
 *
 * ─── What this page manages ───────────────────────────────────────────────────
 *
 *   HubSpot Private App token used for company-by-domain enrichment.
 *
 *   The enrichment pipeline uses this token to look up a company in HubSpot
 *   when the visitor's email domain is known (e.g. from a form submission).
 *   Resolved fields are available to the rules engine and AI decision provider.
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   This server component calls getCrmPlatformSettingsAction() which strips
 *   all secret values before they leave the server.  Only boolean flags and
 *   non-secret strings (provider) are passed to the client component.
 */

import Link                           from "next/link";
import { getCrmPlatformSettingsAction } from "@/app/admin/platform/crm/actions";
import { CrmPlatformClient }           from "@/app/admin/platform/crm/_components/CrmPlatformClient";

export default async function IntegrationsCrmPage() {
  const result = await getCrmPlatformSettingsAction();

  return (
    <div className="mx-auto max-w-xl space-y-5 p-8">

      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">CRM — Platform Credentials</h1>
        <p className="mt-1 text-sm text-neutral-500">
          HubSpot Private App access token for company-by-domain enrichment.
          This page stores <strong>the shared access token only</strong> — whether the CRM
          integration is active for a specific tenant is configured in each tenant's
          Integrations workspace tab.
        </p>
      </div>

      {/* Delegation note */}
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
        <strong>Enable CRM per tenant</strong> in each tenant's{" "}
        <Link href="/admin/tenants" className="font-medium text-brand-600 hover:underline">
          Integrations workspace tab
        </Link>
        . The access token here is the shared credential; the tenant toggle controls
        whether it is exercised for that tenant's traffic.
      </div>

      {/* Security callout */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800">
        <strong>Read-only integration.</strong> This connector reads company data
        from HubSpot to enrich visitor context. It never writes back to HubSpot
        and performs no bidirectional sync.
        The access token is stored server-side only and never returned to the browser.
      </div>

      {/* Error loading settings */}
      {!result.ok && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-800">Failed to load CRM settings</p>
          <p className="mt-1 text-xs text-red-700">{result.error}</p>
          <p className="mt-2 text-xs text-red-600">
            Ensure the{" "}
            <code className="rounded bg-red-100 px-1 font-mono">platform_settings</code>{" "}
            table exists in Supabase.
          </p>
        </div>
      )}

      {/* Settings form + test connection */}
      {result.ok && (
        <CrmPlatformClient
          provider={result.provider}
          hasAccessToken={result.hasAccessToken}
          updatedAt={result.updatedAt}
        />
      )}

    </div>
  );
}
