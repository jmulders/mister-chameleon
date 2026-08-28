/**
 * Admin — Platform › Demo Importer
 *
 * Central configuration and diagnostics hub for the Prospect Demo Generator.
 * Accessible at /admin/platform/demo-importer.
 *
 * ─── What this page manages ───────────────────────────────────────────────────
 *
 *   • Provider readiness  — Analyzer, AI Content
 *   • Import behavior     — pages to crawl, signal detection toggles
 *   • Output defaults     — site type, scenario pack, theme, expiry
 *   • Recent runs         — last 20 demo_instances with status
 *   • Test generator      — run analysis-only or full dry-run / real generation
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   Server actions verify the admin session before executing.
 *   No secrets cross the server→client boundary — only boolean presence flags
 *   and non-secret config values are passed to the client component.
 */

import Link                             from "next/link";
import {
  getDemoImporterStatusAction,
  getDemoImporterSettingsAction,
} from "./actions";
import { DemoImporterClient }           from "./_components/DemoImporterClient";


export default async function DemoImporterPage() {
  const [statusResult, settingsResult] = await Promise.all([
    getDemoImporterStatusAction(),
    getDemoImporterSettingsAction(),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Demo Importer</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Configure, monitor, and test the Prospect Demo Generator. Use{" "}
            <Link href="/admin/demo/new" className="text-brand-600 hover:underline font-medium">
              Admin → Demo → New
            </Link>{" "}
            to generate demos for prospects.
          </p>
        </div>
        <Link
          href="/admin/demo/new"
          className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors"
        >
          Generate demo ↗
        </Link>
      </div>

      {/* Auth error */}
      {!statusResult.ok && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">Access error</p>
          <p className="mt-0.5 text-xs text-amber-700">{statusResult.error}</p>
          <Link
            href="/admin/login"
            className="mt-2 inline-block text-xs font-medium text-amber-700 hover:underline"
          >
            Log in →
          </Link>
        </div>
      )}

      {/* Main client component — receives safe, non-secret data only */}
      {statusResult.ok && (
        <DemoImporterClient
          status={statusResult.status}
          settings={settingsResult.ok ? settingsResult.settings : null}
          settingsUpdatedAt={settingsResult.ok ? settingsResult.updatedAt : null}
          settingsError={settingsResult.ok ? null : settingsResult.error}
          renderApiKeyPresent={settingsResult.ok ? settingsResult.renderApiKeyPresent : false}
        />
      )}

    </div>
  );
}
