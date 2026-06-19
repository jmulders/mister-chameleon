"use client";

/**
 * TenantFinalizeCard
 *
 * Step 2 of provisioning (after the repo + Ploi app exist): wire the tenant to
 * its Statamic host + public domain. Writes statamicBaseUrl + tenant_domains +
 * the repo's sites.yaml, then shows the exact DNS records and Ploi env vars the
 * operator still has to set by hand (Vercel + Strato + Ploi).
 */

import { useState, useTransition } from "react";
import { finalizeTenantProvisioningAction } from "@/app/admin/tenants/[tenantId]/actions";

type Result = Awaited<ReturnType<typeof finalizeTenantProvisioningAction>>;

const inputCls = "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500";

export function TenantFinalizeCard({ tenantId, currentBaseUrl }: { tenantId: string; currentBaseUrl?: string }) {
  const [ploiHost, setPloiHost] = useState(currentBaseUrl ?? "");
  const [domain, setDomain]     = useState("");
  const [pending, start]        = useTransition();
  const [result, setResult]     = useState<Result | null>(null);

  return (
    <section className="mb-8 rounded-lg border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-neutral-900">Finalize: wire host + domain</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Run this after the Ploi app exists. Sets <code className="font-mono">statamicBaseUrl</code>,
        maps the domain, points the repo&apos;s <code className="font-mono">sites.yaml</code> at it, and
        registers the domain in <strong>Vercel</strong>. Then set the DNS records + Ploi env it prints.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-600">Ploi host</span>
          <input className={inputCls} value={ploiHost} onChange={(e) => setPloiHost(e.target.value)} placeholder="mc-cms-acme-xxxx.ams1-t.preview.ploi.it" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-600">Public domain (apex)</span>
          <input className={inputCls} value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="steunles.nl" />
        </label>
      </div>

      <button
        type="button"
        disabled={pending || !ploiHost || !domain}
        onClick={() => { setResult(null); start(async () => setResult(await finalizeTenantProvisioningAction(tenantId, { ploiHost, domain }))); }}
        className="mt-3 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Wiring…" : "Finalize wiring"}
      </button>

      {result && (
        <div className={`mt-4 rounded-md border px-3 py-3 text-xs ${result.ok ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
          <p className={result.ok ? "text-green-800" : "text-amber-800"}>{result.detail ?? result.error}</p>

          {result.steps && (
            <ul className="mt-2 space-y-0.5">
              {result.steps.map((s, i) => (
                <li key={i} className="text-neutral-700">
                  <span className={s.ok ? "text-green-600" : "text-amber-600"}>{s.ok ? "✓" : "!"}</span>{" "}
                  <strong>{s.label}</strong> — {s.note}
                </li>
              ))}
            </ul>
          )}

          {result.dns && (
            <div className="mt-3">
              <p className="font-semibold text-neutral-800">DNS at your registrar (Strato):</p>
              <table className="mt-1 w-full text-left">
                <thead><tr className="text-neutral-500"><th className="pr-3 font-medium">Type</th><th className="pr-3 font-medium">Name</th><th className="font-medium">Value</th></tr></thead>
                <tbody className="font-mono">
                  {result.dns.map((d, i) => (
                    <tr key={i}><td className="pr-3">{d.type}</td><td className="pr-3">{d.name}</td><td>{d.value}</td></tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-1 text-[11px] text-neutral-400">Add the domain in Vercel first — its panel shows the authoritative values (and any TXT verification).</p>
            </div>
          )}

          {result.ploiEnv && (
            <div className="mt-3">
              <p className="font-semibold text-neutral-800">Set on the Ploi app, then redeploy:</p>
              <pre className="mt-1 overflow-x-auto rounded bg-neutral-900 p-2 text-green-300">{result.ploiEnv.map((e) => `${e.key}=${e.value}`).join("\n")}</pre>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
