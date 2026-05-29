/**
 * TenantCmsSeedPanel
 *
 * Per-tenant CMS seed panel rendered on the tenant Content tab
 * (/admin/tenants/[tenantId]/content).
 *
 * Shows a seed section appropriate for the tenant's active CMS provider:
 *   • Sanity     → "Seed Sanity content" (pages + variant documents)
 *   • Storyblok  → "Seed Storyblok content" (variants + pages + articles + site-settings)
 *   • Other      → nothing rendered
 *
 * ─── Why this exists ──────────────────────────────────────────────────────────
 *
 *   Seed operations used to live on the platform-level CMS settings page
 *   (/admin/platform/integrations/cms).  That placement was wrong: clicking
 *   the seed button there would re-seed content for ALL tenants sharing the
 *   same CMS, not just the one the operator intended to seed.
 *
 *   Moving seed here ties the operation to a specific tenant so operators can
 *   confidently re-seed one tenant without touching another.
 *
 * ─── Idempotency ──────────────────────────────────────────────────────────────
 *
 *   Both actions use create-or-replace / upsert semantics.  Safe to re-run at
 *   any time; existing content is overwritten with the seed values.
 *
 * ─── Auto nav reset ───────────────────────────────────────────────────────────
 *
 *   The seed actions automatically rebuild the tenant nav from the seeded
 *   site-settings document.  No separate "Reset navigation" step is required.
 */

"use client";

import { useState, useTransition }               from "react";
import { seedTenantSanityAction, seedTenantStoryblokAction } from "../seed-actions";
import type { SeedMarketingSiteResult, SeedStoryblokSpaceResult } from "@/app/admin/platform/cms/actions";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TenantCmsSeedPanelProps {
  tenantId:           string;
  cmsProvider:        string;
  // Sanity
  hasWriteToken?:     boolean;
  // Storyblok
  hasManagementToken?: boolean;
  hasSpaceId?:         boolean;
}

type SeedPhase = "idle" | "confirming" | "running" | "done" | "error";

// ── Sanity seed section ────────────────────────────────────────────────────────

function SanitySeedSection({
  tenantId,
  hasWriteToken,
}: {
  tenantId:      string;
  hasWriteToken: boolean;
}) {
  const [phase,   setPhase]   = useState<SeedPhase>("idle");
  const [results, setResults] = useState<SeedMarketingSiteResult | null>(null);
  const [errMsg,  setErrMsg]  = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRun() {
    setPhase("running");
    setResults(null);
    setErrMsg(null);
    startTransition(async () => {
      const res = await seedTenantSanityAction(tenantId);
      if (!res.ok) {
        setErrMsg(res.error);
        setPhase("error");
        return;
      }
      setResults(res);
      setPhase(res.failed > 0 ? "error" : "done");
    });
  }

  return (
    <div className="mt-5 border-t border-neutral-100 pt-4">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold text-neutral-700">Sanity content seed</p>
        <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200">
          Sanity
        </span>
      </div>
      <p className="mb-4 text-xs text-neutral-500 leading-relaxed">
        Creates or replaces all marketing pages and variant documents for{" "}
        <code className="rounded bg-neutral-100 px-1 font-mono text-[11px]">{tenantId}</code>{" "}
        in Sanity. Safe to re-run — uses{" "}
        <code className="rounded bg-neutral-100 px-1 font-mono text-[11px]">createOrReplace</code>,
        so existing content is updated, not duplicated. Stale variant documents
        that no longer exist in the seed are automatically removed.
        Uses the write token configured in Platform → CMS settings.
      </p>

      {!hasWriteToken && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <strong>Write token not configured.</strong>{" "}
          Add a Sanity write token in{" "}
          <a href="/admin/platform/integrations/cms" className="underline hover:text-amber-900">
            Platform → CMS settings
          </a>{" "}
          before seeding.
        </div>
      )}

      {phase === "idle" && (
        <button
          onClick={() => setPhase("confirming")}
          disabled={!hasWriteToken}
          className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Seed Sanity content →
        </button>
      )}

      {phase === "confirming" && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="mb-1 text-xs font-semibold text-amber-900">
            ⚠️ This will create or replace all pages and variant documents in Sanity for{" "}
            <code className="font-mono">{tenantId}</code>.
          </p>
          <p className="mb-3 text-xs text-amber-800">
            Manually edited page content will be overwritten by the seed values.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleRun}
              disabled={isPending}
              className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              Yes, seed content
            </button>
            <button
              onClick={() => setPhase("idle")}
              className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {phase === "running" && (
        <div className="flex items-center gap-2 text-xs text-neutral-600">
          <svg className="h-4 w-4 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Seeding pages… this may take 15–30 seconds.
        </div>
      )}

      {phase === "error" && errMsg && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800">
          <p className="font-semibold mb-1">Seed failed</p>
          <p>{errMsg}</p>
          <button
            onClick={() => { setPhase("idle"); setErrMsg(null); }}
            className="mt-2 text-[11px] text-neutral-500 underline hover:text-neutral-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {results && results.ok && (phase === "done" || (phase === "error" && !errMsg)) && (
        <div className="space-y-3">
          <div className={`rounded-md border px-3 py-2.5 text-xs font-semibold ${
            results.failed === 0
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}>
            {results.failed === 0
              ? `✅  All ${results.seeded} pages seeded. Navigation updated.`
              : `⚠️  ${results.seeded} succeeded, ${results.failed} failed.`}
          </div>
          {results.results.some((r) => !r.ok) && (
            <div className="max-h-40 overflow-y-auto rounded-md border border-neutral-200 bg-neutral-50 p-2">
              {results.results.filter((r) => !r.ok).map((r) => (
                <div key={r.id} className="py-1 text-[11px] text-red-700">
                  <span className="font-mono">/{r.slug}</span>
                  {r.error && <span className="ml-2 text-red-500">— {r.error}</span>}
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => { setPhase("idle"); setResults(null); }}
              className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
            >
              Reset
            </button>
            <button
              onClick={() => setPhase("confirming")}
              className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
            >
              Seed again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Storyblok seed section ─────────────────────────────────────────────────────

function StoryblokSeedSection({
  tenantId,
  hasManagementToken,
  hasSpaceId,
}: {
  tenantId:           string;
  hasManagementToken: boolean;
  hasSpaceId:         boolean;
}) {
  const [phase,   setPhase]   = useState<SeedPhase>("idle");
  const [results, setResults] = useState<SeedStoryblokSpaceResult | null>(null);
  const [errMsg,  setErrMsg]  = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isReady = hasManagementToken && hasSpaceId;

  function handleRun() {
    setPhase("running");
    setResults(null);
    setErrMsg(null);
    startTransition(async () => {
      const res = await seedTenantStoryblokAction(tenantId);
      if (!res.ok) {
        setErrMsg(res.error);
        setPhase("error");
        return;
      }
      setResults(res);
      setPhase(res.failed > 0 ? "error" : "done");
    });
  }

  return (
    <div className="mt-5 border-t border-neutral-100 pt-4">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold text-neutral-700">Storyblok content seed</p>
        <span className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700 ring-1 ring-inset ring-teal-200">
          Storyblok
        </span>
      </div>
      <p className="mb-4 text-xs text-neutral-500 leading-relaxed">
        Creates or updates stories in the configured Storyblok space for{" "}
        <code className="rounded bg-neutral-100 px-1 font-mono text-[11px]">{tenantId}</code>:{" "}
        adaptive variant stories (hero / proof / CTA),{" "}
        page stories (home, approach, services, cases, about, contact), article stories (case studies
        and insights), and a{" "}
        <code className="rounded bg-neutral-100 px-1 font-mono text-[11px]">site-settings</code>{" "}
        story with the navigation menu. Safe to re-run — existing stories are updated, not
        duplicated. Uses the Management API token and Space ID from{" "}
        <a href="/admin/platform/integrations/cms" className="underline hover:text-neutral-700">
          Platform → CMS settings
        </a>.
      </p>

      {!isReady && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <strong>Provisioning credentials not fully configured.</strong>{" "}
          Add a{!hasManagementToken ? " Management API token and" : ""}{!hasSpaceId ? " Space ID and" : ""}{" "}
          in{" "}
          <a href="/admin/platform/integrations/cms" className="underline hover:text-amber-900">
            Platform → CMS settings
          </a>.
        </div>
      )}

      {phase === "idle" && (
        <button
          onClick={() => setPhase("confirming")}
          disabled={!isReady}
          className="rounded bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Seed stories →
        </button>
      )}

      {phase === "confirming" && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="mb-1 text-xs font-semibold text-amber-900">
            ⚠️ This will create or replace stories in your Storyblok space for{" "}
            <code className="font-mono">{tenantId}</code>.
          </p>
          <p className="mb-3 text-xs text-amber-800">
            Manually edited story content will be overwritten by the seed values.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleRun}
              disabled={isPending}
              className="rounded bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              Yes, seed stories
            </button>
            <button
              onClick={() => setPhase("idle")}
              className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {phase === "running" && (
        <div className="flex items-center gap-2 text-xs text-neutral-600">
          <svg className="h-4 w-4 animate-spin text-teal-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Seeding stories… this may take 10–20 seconds.
        </div>
      )}

      {phase === "error" && errMsg && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800">
          <p className="font-semibold mb-1">Seed failed</p>
          <p>{errMsg}</p>
          <button
            onClick={() => { setPhase("idle"); setErrMsg(null); }}
            className="mt-2 text-[11px] text-neutral-500 underline hover:text-neutral-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {results && results.ok && (phase === "done" || (phase === "error" && !errMsg)) && (
        <div className="space-y-3">
          <div className={`rounded-md border px-3 py-2.5 text-xs font-semibold ${
            results.failed === 0
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}>
            {results.failed === 0
              ? `✅  All ${results.seeded} stories seeded. Navigation updated.`
              : `⚠️  ${results.seeded} succeeded, ${results.failed} failed.`}
          </div>
          {results.results.some((r) => !r.ok) && (
            <div className="max-h-40 overflow-y-auto rounded-md border border-neutral-200 bg-neutral-50 p-2">
              {results.results.filter((r) => !r.ok).map((r) => (
                <div key={r.id} className="py-1 text-[11px] text-red-700">
                  <span className="font-mono">{r.slug}</span>
                  {r.error && <span className="ml-2 text-red-500">— {r.error}</span>}
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => { setPhase("idle"); setResults(null); }}
              className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
            >
              Reset
            </button>
            <button
              onClick={() => setPhase("confirming")}
              className="rounded bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 transition-colors"
            >
              Seed again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Root export ────────────────────────────────────────────────────────────────

/**
 * Renders the appropriate CMS seed section based on the tenant's active
 * provider.  Returns null for providers that don't have a seed operation
 * (platform, statamic, mock).
 *
 * Nav is rebuilt automatically after a successful seed — no separate step needed.
 */
export function TenantCmsSeedPanel({
  tenantId,
  cmsProvider,
  hasWriteToken     = false,
  hasManagementToken = false,
  hasSpaceId        = false,
}: TenantCmsSeedPanelProps) {
  if (cmsProvider === "sanity") {
    return <SanitySeedSection tenantId={tenantId} hasWriteToken={hasWriteToken} />;
  }

  if (cmsProvider === "storyblok") {
    return (
      <StoryblokSeedSection
        tenantId={tenantId}
        hasManagementToken={hasManagementToken}
        hasSpaceId={hasSpaceId}
      />
    );
  }

  return null;
}
