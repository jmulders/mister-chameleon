"use client";

/**
 * CmsDeployCard
 *
 * One-click deploy of the Statamic CMS instance via its Ploi deploy webhook.
 * POSTing to the webhook runs the instance's deploy script (git pull + composer
 * install + `php please mc:sync` + cache clear), keeping the platform-managed
 * fieldsets in sync.
 *
 * The webhook URL is a capability URL (a secret) — it is stored server-side only
 * and never sent back to the client (the input shows a masked placeholder once set).
 */

import { useState, useTransition } from "react";
import { saveCmsDeployHookAction, triggerCmsDeployAction } from "../actions";

export function CmsDeployCard({ configured }: { configured: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [hasHook, setHasHook] = useState(configured);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  function save(formData: FormData) {
    startTransition(async () => {
      const r = await saveCmsDeployHookAction(formData);
      setResult({ ok: r.ok, msg: r.ok ? (r.detail ?? "Saved.") : (r.error ?? "Failed.") });
      if (r.ok) setHasHook(Boolean(String(formData.get("cmsDeployHookUrl") ?? "").trim()));
    });
  }

  function deploy() {
    startTransition(async () => {
      const r = await triggerCmsDeployAction();
      setResult({ ok: r.ok, msg: r.ok ? (r.detail ?? "Triggered.") : (r.error ?? "Failed.") });
    });
  }

  return (
    <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-neutral-900">CMS deploy (Statamic / Ploi)</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Deploys the Statamic instance: <code className="font-mono">git pull</code> +{" "}
        <code className="font-mono">composer install</code> +{" "}
        <code className="font-mono">php please mc:sync</code> + cache clear, via the Ploi deploy webhook.
      </p>

      <form action={save} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="url"
          name="cmsDeployHookUrl"
          placeholder={hasHook ? "•••••• saved — paste to replace, leave empty to clear" : "https://… Ploi deploy webhook URL"}
          className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-300 disabled:opacity-50"
        >
          Save webhook
        </button>
      </form>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={deploy}
          disabled={isPending || !hasHook}
          className="rounded bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {isPending ? "Working…" : "Deploy CMS now"}
        </button>
        {!hasHook && (
          <span className="text-xs text-amber-700">Add the Ploi deploy webhook URL first.</span>
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
        Find it in Ploi → Application → Settings → Deploy Webhook.
      </p>
    </div>
  );
}
