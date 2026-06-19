"use client";

/**
 * TenantProvisionCard
 *
 * One-click provisioning for a Statamic tenant: generates the per-tenant GitHub
 * repo from the template (Fase 1) and creates the Ploi Cloud application via the
 * IaC API (Fase 2). Shown on the tenant Setup page for Statamic tenants.
 *
 * Requires GitHub + Ploi tokens configured in Platform → Integrations →
 * Provisioning. Supports a dry-run (repo still created; Ploi previewed only).
 */

import { useState, useTransition } from "react";
import { provisionTenantCmsAction } from "@/app/admin/tenants/[tenantId]/actions";

export function TenantProvisionCard({ tenantId }: { tenantId: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{
    ok: boolean; text: string; repoUrl?: string; changes?: string[];
  } | null>(null);

  function run(dryRun: boolean) {
    setResult(null);
    start(async () => {
      const r = await provisionTenantCmsAction(tenantId, { dryRun });
      setResult({
        ok: r.ok,
        text: r.ok ? (r.detail ?? "Done.") : (r.error ?? "Failed."),
        repoUrl: r.repoUrl,
        changes: r.changes,
      });
    });
  }

  return (
    <section className="mb-8 rounded-lg border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-neutral-900">Provision CMS instance (automated)</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Creates this tenant&apos;s GitHub repo from the template (full copy, incl. fieldsets)
        and its Ploi Cloud application in one step. No <code className="font-mono">mc:sync</code> needed —
        fieldsets bake into the image. Configure tokens in{" "}
        <a href="/admin/platform/integrations/provisioning" className="font-medium text-blue-600 underline">Integrations → Provisioning</a>.
      </p>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(false)}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Provisioning…" : "Provision repo + Ploi app"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(true)}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 disabled:opacity-50"
        >
          Dry run
        </button>
      </div>

      {result && (
        <div className={`mt-3 rounded-md border px-3 py-2 text-xs ${result.ok ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>
          <p>{result.text}</p>
          {result.repoUrl && (
            <p className="mt-1">
              Repo: <a href={result.repoUrl} target="_blank" rel="noreferrer" className="underline">{result.repoUrl}</a>
            </p>
          )}
          {result.changes && result.changes.length > 0 && (
            <ul className="mt-1 list-disc pl-4">
              {result.changes.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
