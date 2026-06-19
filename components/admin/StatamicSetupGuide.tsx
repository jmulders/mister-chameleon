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
    <><strong>Provision</strong> (card above → “Provision repo + Ploi app”): generates the per-tenant
      repo from the template <code className="rounded bg-neutral-100 px-1 font-mono text-xs">{templateRepo}</code>{" "}
      (full copy, incl. committed fieldsets) and creates the Ploi Cloud app. No <code className="rounded bg-neutral-100 px-1 font-mono text-xs">mc:sync</code> — fieldsets bake into the image.</>,
    <>In Ploi, open the new app and copy its <strong>host</strong> (e.g. <code className="font-mono text-xs">…ams1-t.preview.ploi.it</code>). Wait until the first deploy is healthy.</>,
    <><strong>Finalize</strong> (card above → enter the Ploi host + this tenant&apos;s domain): sets{" "}
      <code className="rounded bg-neutral-100 px-1 font-mono text-xs">statamicBaseUrl</code>, maps the domain, and points the repo&apos;s <code className="rounded bg-neutral-100 px-1 font-mono text-xs">sites.yaml</code> at it.</>,
    <>Add the domain in <strong>Vercel</strong> (platform project → Domains) and set the <strong>DNS</strong> records that the Finalize card prints (A on the apex, CNAME on www).</>,
    <>Set the two <strong>Ploi env</strong> vars the Finalize card prints (<code className="font-mono text-xs">APP_URL</code> + <code className="font-mono text-xs">MC_PREVIEW_FRONTEND_URL</code>) on the app, then <strong>redeploy the Ploi app</strong>.</>,
    <><strong>Redeploy the platform on Vercel</strong> so the cached tenant config picks up the new host + domain.</>,
    <>Smoke test: open <code className="font-mono text-xs">https://www.&lt;domain&gt;</code> → real nav + content (no fallback); CP <code className="font-mono text-xs">/cp</code> opens; Live Preview &amp; “Visit URL” target the tenant&apos;s own domain.</>,
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
