/**
 * StatamicDeployPanel
 *
 * Admin panel for deploying a new Statamic site on Laravel Forge for a tenant.
 *
 * Shown on the tenant Setup page when:
 *   • The tenant's CMS provider is "statamic" (or not yet set), AND
 *   • Forge is configured at Platform → Integrations → Forge.
 *
 * ─── Flow ─────────────────────────────────────────────────────────────────────
 *
 *   1. Operator enters the domain and (optionally) server override.
 *   2. Clicks "Deploy Statamic site".
 *   3. The action clones the starter repo, deploys, pushes .env, and seeds.
 *   4. On success the panel shows each step and the resulting site URL.
 *
 * ─── What it doesn't do ───────────────────────────────────────────────────────
 *
 *   This panel only deploys a FRESH site.  For re-initialising an existing
 *   Statamic site (blueprint sync, nav seeding, etc.) use the "Initialize site"
 *   button in CreateSitePanel.
 */

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deployStatamicSiteAction }  from "@/app/admin/tenants/[tenantId]/actions";
import type { DeployStatamicResult, DeployStatamicStep } from "@/app/admin/tenants/[tenantId]/types";

// ── Helpers ────────────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: DeployStatamicStep["status"] | "running" }) {
  if (status === "running")  return <span className="inline-block size-2 rounded-full bg-blue-400 animate-pulse" />;
  if (status === "ok")       return <span className="inline-block size-2 rounded-full bg-green-500" />;
  if (status === "warn")     return <span className="inline-block size-2 rounded-full bg-amber-400" />;
  if (status === "failed")   return <span className="inline-block size-2 rounded-full bg-red-500" />;
  return                            <span className="inline-block size-2 rounded-full bg-neutral-300" />;
}

function StepRow({ s }: { s: DeployStatamicStep }) {
  return (
    <li className="flex items-start gap-2.5 py-1">
      <StatusDot status={s.status} />
      <span className="flex-1 text-xs text-neutral-700">{s.step}</span>
      {s.message && (
        <span className={`ml-2 text-[11px] ${s.status === "warn" || s.status === "failed" ? "text-amber-700" : "text-neutral-400"}`}>
          {s.message}
        </span>
      )}
    </li>
  );
}

// ── Root component ─────────────────────────────────────────────────────────────

interface StatamicDeployPanelProps {
  tenantId:        string;
  /** If the tenant already has a Statamic site configured, show it here. */
  existingBaseUrl?: string;
  /** Platform default Forge server ID (for display only). */
  defaultServerId?: number | null;
  /** Whether Forge is configured at the platform level. */
  forgeConfigured:  boolean;
}

type DeployState =
  | { mode: "idle" }
  | { mode: "deploying" }
  | { mode: "success"; result: Extract<DeployStatamicResult, { ok: true }> }
  | { mode: "error";   result: Extract<DeployStatamicResult, { ok: false }> };

export function StatamicDeployPanel({
  tenantId,
  existingBaseUrl,
  defaultServerId,
  forgeConfigured,
}: StatamicDeployPanelProps) {
  const [domain,     setDomain]     = useState("");
  const [serverIdOverride, setServerIdOverride] = useState("");
  const [deployState, setDeployState] = useState<DeployState>({ mode: "idle" });
  const [isPending, startTransition] = useTransition();

  const isDeploying = isPending || deployState.mode === "deploying";

  function handleDeploy() {
    const trimmedDomain = domain.trim();
    if (!trimmedDomain) return;

    const serverIdNum = serverIdOverride.trim()
      ? parseInt(serverIdOverride.trim(), 10)
      : undefined;

    startTransition(async () => {
      setDeployState({ mode: "deploying" });
      const result = await deployStatamicSiteAction(tenantId, trimmedDomain, serverIdNum);
      if (result.ok) {
        setDeployState({ mode: "success", result });
      } else {
        setDeployState({ mode: "error", result });
      }
    });
  }

  return (
    <div className="mb-8">
      <div className="mb-3 border-b border-neutral-100 pb-2">
        <h2 className="text-sm font-semibold text-neutral-900">Deploy Statamic site</h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          Clone the Mister Chameleon CMS starter onto Laravel Forge and initialize
          the site automatically. Only needed for <strong>new</strong> deployments.
        </p>
      </div>

      {/* Already deployed — show current URL */}
      {existingBaseUrl && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2">
          <span className="inline-block size-2 rounded-full bg-green-500 shrink-0" />
          <span className="text-xs text-green-800">
            Statamic is already deployed at{" "}
            <a
              href={existingBaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline"
            >
              {existingBaseUrl}
            </a>
            . You can deploy again to a new domain below, or use{" "}
            <strong>Initialize site</strong> to re-seed content.
          </span>
        </div>
      )}

      {/* Forge not configured */}
      {!forgeConfigured && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-xs text-amber-800">
            Forge is not configured yet. Go to{" "}
            <Link href="/admin/platform/integrations/forge" className="font-medium underline">
              Platform → Integrations → Forge
            </Link>{" "}
            to add your API token and deployment defaults.
          </p>
        </div>
      )}

      {/* Deployment form */}
      <div className="space-y-4">

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-700">
            Statamic domain
          </label>
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="cms.client.nl"
            disabled={isDeploying}
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 placeholder:text-neutral-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 disabled:bg-neutral-50 disabled:text-neutral-400"
          />
          <p className="mt-0.5 text-[11px] text-neutral-400">
            The (sub)domain where this Statamic site will be hosted. Point DNS to the Forge server before deploying.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-700">
            Server ID override{" "}
            <span className="font-normal text-neutral-400">(optional)</span>
          </label>
          <input
            type="text"
            value={serverIdOverride}
            onChange={(e) => setServerIdOverride(e.target.value)}
            placeholder={defaultServerId ? `Default: ${defaultServerId}` : "e.g. 123456"}
            disabled={isDeploying}
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 placeholder:text-neutral-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 disabled:bg-neutral-50 disabled:text-neutral-400"
          />
          <p className="mt-0.5 text-[11px] text-neutral-400">
            Leave blank to use the platform default server.
            Fill in to deploy to a dedicated Forge server for this client.
          </p>
        </div>
      </div>

      {/* Deploy button */}
      <div className="mt-4">
        <button
          onClick={handleDeploy}
          disabled={isDeploying || !domain.trim() || !forgeConfigured}
          className="rounded bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isDeploying ? (
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Deploying… (this takes a few minutes)
            </span>
          ) : (
            "Deploy Statamic site"
          )}
        </button>
      </div>

      {/* Deploying — progress note */}
      {isDeploying && (
        <div className="mt-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2">
          <p className="text-xs text-blue-800">
            Deploying to Forge. This typically takes 2–5 minutes. Do not close this page.
          </p>
        </div>
      )}

      {/* Success result */}
      {deployState.mode === "success" && (
        <div className="mt-4 space-y-3">
          <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2">
            <p className="text-xs font-semibold text-green-800">
              ✓ Deployed successfully to{" "}
              <a
                href={deployState.result.siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {deployState.result.siteUrl}
              </a>
            </p>
            {deployState.result.warnings.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {deployState.result.warnings.map((w, i) => (
                  <li key={i} className="text-[11px] text-amber-700">⚠ {w}</li>
                ))}
              </ul>
            )}
          </div>
          <StepList steps={deployState.result.steps} />
        </div>
      )}

      {/* Error result */}
      {deployState.mode === "error" && (
        <div className="mt-4 space-y-3">
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
            <p className="text-xs font-semibold text-red-800">
              Deployment failed{deployState.result.failedStep ? ` at step: ${deployState.result.failedStep}` : ""}
            </p>
            <p className="mt-0.5 text-xs text-red-700">{deployState.result.error}</p>
          </div>
          {deployState.result.completedSteps.length > 0 && (
            <StepList steps={deployState.result.completedSteps} />
          )}
          <button
            onClick={() => setDeployState({ mode: "idle" })}
            className="text-[11px] text-neutral-400 underline hover:text-neutral-600"
          >
            Dismiss and try again
          </button>
        </div>
      )}
    </div>
  );
}

function StepList({ steps }: { steps: DeployStatamicStep[] }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Deployment steps</p>
      <ul className="space-y-0.5">
        {steps.map((s, i) => (
          <StepRow key={i} s={s} />
        ))}
      </ul>
    </div>
  );
}
