/**
 * Admin — Integrations › Provisioning
 *
 * Platform-wide GitHub + Ploi Cloud credentials used to AUTO-create a new
 * tenant's CMS instance (per-tenant repo from template + Ploi Cloud app).
 * Tokens are stored in platform_settings; env GITHUB_TOKEN / PLOI_CLOUD_TOKEN
 * act as fallbacks. Secrets never cross to the client (only hasToken flags).
 */

import { getProvisioningSettingsAction } from "./actions";
import { ProvisioningClient }            from "./_components/ProvisioningClient";

export default async function IntegrationsProvisioningPage() {
  const result = await getProvisioningSettingsAction();

  return (
    <div className="mx-auto max-w-xl space-y-5 p-8">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Provisioning — GitHub &amp; Ploi Cloud</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Credentials for automated tenant CMS provisioning. Configure once here;
          use <strong>Provision CMS</strong> on a tenant&apos;s Setup page to create
          its repo (from the template) and Ploi Cloud application in one click.
        </p>
      </div>

      {!result.ok && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-800">Failed to load provisioning settings</p>
          <p className="mt-1 text-xs text-red-700">{result.error}</p>
        </div>
      )}

      {result.ok && <ProvisioningClient github={result.github} ploi={result.ploi} />}
    </div>
  );
}
