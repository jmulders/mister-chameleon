"use client";

/**
 * StatamicSetupGuide
 *
 * A clear, per-tenant checklist for standing up a new Statamic instance on Ploi
 * and wiring it to this tenant. Shown on the tenant Setup page for Statamic
 * tenants. The env block is pre-filled with this tenant's siteKey and has a
 * copy button, so the operator can paste it straight into the Ploi app.
 */

import { useState } from "react";

interface Props {
  tenantId:        string;
  siteKey?:        string;
  platformApiUrl?: string;
  templateRepo?:   string;
}

export function StatamicSetupGuide({
  tenantId,
  siteKey,
  platformApiUrl = "https://www.misterchameleon.nl",
  templateRepo   = "jmulders/mister-chameleon-cms",
}: Props) {
  const [copied, setCopied] = useState(false);

  const envBlock = [
    "APP_URL=https://<your-ploi-app-host>",
    "STATAMIC_API_ENABLED=true",
    "STATAMIC_PRO_ENABLED=true",
    `MISTER_CHAMELEON_API_URL=${platformApiUrl}`,
    `MISTER_CHAMELEON_TENANT_KEY=${siteKey ?? "<generate on the Snippet tab>"}`,
    `MC_PREVIEW_FRONTEND_URL=${platformApiUrl}`,
  ].join("\n");

  function copyEnv() {
    navigator.clipboard?.writeText(envBlock).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const steps = [
    <>Create a <strong>per-tenant copy</strong> of the template repo{" "}
      <code className="rounded bg-neutral-100 px-1 font-mono text-xs">{templateRepo}</code>{" "}
      (GitHub → “Use this template”). Each tenant needs its own repo so content &amp; Git Sync don&apos;t collide.</>,
    <>In Ploi, create an application (framework: <strong>Statamic</strong>) pointing at that per-tenant repo.</>,
    <>Paste the env vars below into the Ploi app (the siteKey is already filled in for this tenant).</>,
    <>Set the Ploi <strong>deploy script</strong> to run <code className="rounded bg-neutral-100 px-1 font-mono text-xs">php please mc:sync</code> + cache clear — the repo ships a ready-to-use <code className="rounded bg-neutral-100 px-1 font-mono text-xs">deploy.sh</code>.</>,
    <>Seed the starter pages: <code className="rounded bg-neutral-100 px-1 font-mono text-xs">cp -R seed/content/. content/</code> (see <code className="font-mono text-xs">seed/README.md</code>).</>,
    <>Set this tenant&apos;s <strong>CMS base URL</strong> to the Ploi app host (CMS credentials panel below / Forge deploy panel).</>,
    <>Paste the Ploi <strong>deploy webhook</strong> into the “Deploy CMS” card below, then hit <strong>Deploy CMS now</strong>.</>,
    <>Map the tenant&apos;s domain (Domains panel below) + DNS, then redeploy the platform on Vercel.</>,
  ];

  return (
    <section className="mb-8 rounded-lg border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-neutral-900">Statamic instance — setup steps</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Stand up a fresh Statamic instance on Ploi and wire it to this tenant. Full guide:{" "}
        <a href="/admin/platform/docs/provision-statamic-tenant" className="font-medium text-blue-600 underline hover:text-blue-800">
          provision-statamic-tenant
        </a>.
      </p>

      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-xs text-neutral-700 marker:text-neutral-400">
        {steps.map((s, i) => <li key={i}>{s}</li>)}
      </ol>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-neutral-600">Ploi environment (copy → paste)</span>
          <button
            type="button"
            onClick={copyEnv}
            className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 hover:bg-neutral-200"
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
        <pre className="overflow-x-auto rounded-md bg-neutral-900 p-3 text-xs leading-relaxed text-green-300">{envBlock}</pre>
        {!siteKey && (
          <p className="mt-1 text-xs text-amber-700">
            No siteKey yet — generate one on the <strong>Snippet</strong> tab, then it auto-fills here.
          </p>
        )}
      </div>

      <p className="mt-3 text-[11px] text-neutral-400">
        Tenant: <code className="font-mono">{tenantId}</code>. The siteKey is a public identifier; the env also holds
        secrets (license, app key) — set those in Ploi.
      </p>
    </section>
  );
}
