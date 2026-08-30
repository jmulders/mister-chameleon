/**
 * Admin — Integrations › AI
 *
 * Platform-wide AI provider settings page.
 * Accessible at /admin/platform/integrations/ai.
 *
 * ─── What this page manages ───────────────────────────────────────────────────
 *
 *   Platform-level fallback API keys for AI providers:
 *
 *     Anthropic API key — used by the AI decision engine when no tenant key set
 *     OpenAI API key    — secondary provider / fallback
 *
 *   Tenant-level keys configured in the tenant workspace take precedence over
 *   the platform keys stored here.
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   This server component calls getPlatformSettingsAction() which strips all
 *   secret values before returning.  Only boolean flags and timestamps are
 *   passed to the client component.
 */

import Link                         from "next/link";
import { getPlatformSettingsAction } from "@/app/admin/platform/settings/actions";
import { AiPlatformClient }         from "./_components/AiPlatformClient";

export default async function IntegrationsAiPage() {
  const result = await getPlatformSettingsAction();

  return (
    <div className="mx-auto max-w-xl space-y-5 p-8">

      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">AI: Platform Credentials</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Platform-level fallback API keys for AI providers. These are used when a tenant
          has not set their own key. This page stores <strong>secrets only</strong>: AI mode,
          provider selection, and model settings are configured per-tenant.
        </p>
      </div>

      {/* Delegation note */}
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
        <strong>Tenant usage config</strong> (mode, provider, model, confidence threshold)
        is managed in each tenant's{" "}
        <Link href="/admin/tenants" className="font-medium text-brand-600 hover:underline">
          Integrations workspace tab
        </Link>
        .
      </div>

      {/* Security callout */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800">
        <strong>Secrets stay server-side.</strong> API keys are stored encrypted at rest
        and never returned to the browser after saving. The UI shows only whether
        a key is configured, not its value.
      </div>

      {/* Error loading settings */}
      {!result.ok && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-800">Failed to load AI settings</p>
          <p className="mt-1 text-xs text-red-700">{result.error}</p>
        </div>
      )}

      {/* Settings form */}
      {result.ok && (
        <AiPlatformClient
          hasAnthropicKey={result.ai.hasAnthropicKey}
          hasOpenaiKey={result.ai.hasOpenaiKey}
          hasDemoSiteKey={result.ai.hasDemoSiteKey}
          updatedAt={result.ai.updatedAt}
        />
      )}

    </div>
  );
}
