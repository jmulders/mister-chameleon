"use client";

/**
 * TenantCmsDeployCard
 *
 * Per-tenant one-click deploy of a Statamic instance via its own Ploi deploy
 * webhook. Each Statamic tenant runs its own Ploi app, so the webhook URL is
 * stored per tenant (tenant_settings.deploy.cmsDeployHookUrl) and never sent
 * back to the client.
 *
 * Only rendered for Statamic tenants (Sanity/Storyblok are hosted SaaS — there
 * is no instance to redeploy).
 */

import { useState, useTransition } from "react";
import {
  saveTenantDeployHookAction,
  triggerTenantCmsDeployAction,
} from "@/app/admin/tenants/[tenantId]/actions";

export function TenantCmsDeployCard({
  tenantId,
  configured,
}: {
  tenantId: string;
  configured: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [hasHook, setHasHook] = useState(configured);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  function save(formData: FormData) {
    startTransition(async () => {
      const r = await saveTenantDeployHookAction(tenantId, formData);
      setResult({ ok: r.ok, msg: r.ok ? (r.detail ?? "Saved.") : (r.error ?? "Failed.") });
      if (r.ok) setHasHook(Boolean(String(formData.get("cmsDeployHookUrl") ?? "").trim()));
    });
  }

  function deploy() {
    startTransition(async () => {
      const r = await triggerTenantCmsDeployAction(tenantId);
      setResult({ ok: r.ok, msg: r.ok ? (r.detail ?? "Triggered.") : (r.error ?? "Failed.") });
    });
  }

  return (
    <section className="mb-8 rounded-lg border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-neutral-900">Deploy CMS</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Redeploys this tenant&apos;s Statamic instance: <code className="font-mono">git pull</code> +{" "}
        <code className="font-mono">composer install</code> +{" "}
        <code className="font-mono">php please mc:sync</code> + cache clear, via its Ploi deploy webhook.
      </p>

      <form action={save} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="url"
          name="cmsDeployHookUrl"
          placeholder={hasHook ? "•••••• saved — paste to replace, empty to clear" : "https://… Ploi deploy webhook URL"}
          className="w-full flex-1 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 placeholder:text-neutral-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
        />
        <button
          type="submit"
          disabled={isPending}
          className="shrink-0 rounded-md bg-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-300 disabled:opacity-50"
        >
          Save webhook
        </button>
      </form>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={deploy}
          disabled={isPending || !hasHook}
          className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {isPending ? "Working…" : "Deploy CMS now"}
        </button>
        {!hasHook && (
          <span className="text-xs text-amber-700">Add this tenant&apos;s Ploi deploy webhook URL first.</span>
        )}
      </div>

      {result && (
        <div
          className={`mt-3 rounded-md px-3 py-2 text-xs ${
            result.ok
              ? "border border-green-200 bg-green-50 text-green-800"
              : "border border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {result.msg}
        </div>
      )}

      <p className="mt-3 text-[11px] text-neutral-400">
        Find it in Ploi → Application → Settings → Deploy Webhook (per instance).
      </p>
    </section>
  );
}
