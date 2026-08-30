/**
 * Admin — Integrations › Forge
 *
 * Platform-wide Laravel Forge settings for automated Statamic site deployment.
 * Accessible at /admin/platform/integrations/forge.
 *
 * ─── What this page manages ───────────────────────────────────────────────────
 *
 *   apiKey          — Forge Personal API Token (server-only secret)
 *   defaultServerId — Default Forge server to deploy to (non-secret)
 *   gitRepository   — GitHub repo containing the Statamic starter (non-secret)
 *   gitBranch       — Branch to deploy (non-secret)
 *   phpVersion      — PHP version for new Forge sites (non-secret)
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   The server component strips the API key before passing to the client.
 *   Only `hasApiKey` (boolean) crosses the server→client boundary.
 */

import { getPlatformForgeSettingsAction } from "@/app/admin/platform/integrations/forge/actions";
import { ForgePlatformClient }            from "./_components/ForgePlatformClient";

export default async function IntegrationsForgesPage() {
  const result = await getPlatformForgeSettingsAction();

  return (
    <div className="mx-auto max-w-xl space-y-5 p-8">

      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Forge: Deployment Settings</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Laravel Forge credentials and defaults for automated Statamic site deployment.
          Configure once here; use the <strong>Deploy Statamic</strong> button on a
          tenant's Setup page to provision a new site.
        </p>
      </div>

      {/* Error loading settings */}
      {!result.ok && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-800">Failed to load Forge settings</p>
          <p className="mt-1 text-xs text-red-700">{result.error}</p>
        </div>
      )}

      {/* Settings form */}
      {result.ok && (
        <ForgePlatformClient
          hasApiKey={result.hasApiKey}
          defaultServerId={result.defaultServerId}
          gitRepository={result.gitRepository}
          gitBranch={result.gitBranch}
          phpVersion={result.phpVersion}
          isConfigured={result.isConfigured}
          updatedAt={result.updatedAt}
        />
      )}

    </div>
  );
}
