"use client";

/**
 * StorageTenantClient
 *
 * Provider selector card for tenant-level storage override.
 * Shows the three providers with availability badges and a
 * "Platform default" option that clears the override.
 */

import { useState, useTransition }         from "react";
import { setTenantStorageProviderAction }  from "../actions";
import type { TenantStorageState, StorageProviderKey } from "../actions";

// ── Provider definitions ──────────────────────────────────────────────────────

const PROVIDERS: Array<{
  key:         StorageProviderKey;
  label:       string;
  description: string;
  icon:        React.ReactNode;
  requiresConfig?: "r2" | "sanity";
}> = [
  {
    key:         null,
    label:       "Platform default",
    description: "Use whatever provider the platform administrator configured. Recommended for most tenants.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
  },
  {
    key:            "supabase_storage",
    label:          "Supabase Storage",
    description:    "Built-in Supabase Storage. Always available — no extra configuration required.",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M21.362 9.354H12V.396a.396.396 0 0 0-.716-.233L2.203 12.424l-.401.562a1.04 1.04 0 0 0 .836 1.659H12v8.959a.396.396 0 0 0 .716.233l9.081-12.261.401-.562a1.04 1.04 0 0 0-.836-1.66z"/>
      </svg>
    ),
  },
  {
    key:            "cloudflare_r2",
    label:          "Cloudflare R2",
    description:    "Zero egress-cost object storage. Requires R2 credentials configured at platform level.",
    requiresConfig: "r2",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 16v-5H7l5-9v5h4l-5 9z"/>
      </svg>
    ),
  },
  {
    key:            "sanity_assets",
    label:          "Sanity Assets",
    description:    "Sanity CDN asset storage. Requires Sanity project configured at platform level.",
    requiresConfig: "sanity",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M5.069 4A1 1 0 0 0 4 5.069v13.862A1 1 0 0 0 5.069 20h13.862A1 1 0 0 0 20 18.931V5.069A1 1 0 0 0 18.931 4H5.069zm5.557 3.001c1.563 0 2.823.783 3.501 1.934l-1.411.814c-.397-.701-1.151-1.17-2.09-1.17-1.391 0-2.474 1.052-2.474 2.438 0 1.387 1.083 2.438 2.474 2.438.939 0 1.693-.468 2.09-1.17l1.411.813c-.678 1.151-1.938 1.934-3.501 1.934-2.264 0-4.048-1.744-4.048-4.015 0-2.27 1.784-4.016 4.048-4.016zm3.924 2.375h1.494v1.187h1.452v1.46H16.044v1.187h-1.494v-1.187h-1.452v-1.46h1.452V9.376z"/>
      </svg>
    ),
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  tenantId:     string;
  initialState: TenantStorageState;
}

export function StorageTenantClient({ tenantId, initialState }: Props) {
  const [selected, setSelected]  = useState<StorageProviderKey>(initialState.tenantProvider);
  const [saved,    setSaved]     = useState(false);
  const [error,    setError]     = useState<string | null>(null);
  const [isPending, startTrans]  = useTransition();

  function isAvailable(provider: typeof PROVIDERS[number]): boolean {
    if (!provider.requiresConfig) return true;
    if (provider.requiresConfig === "r2")     return initialState.r2Configured;
    if (provider.requiresConfig === "sanity") return initialState.sanityConfigured;
    return false;
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTrans(async () => {
      const res = await setTenantStorageProviderAction(tenantId, selected);
      if (!res.ok) {
        setError(res.error);
      } else {
        setSaved(true);
      }
    });
  }

  return (
    <div className="space-y-6">

      {/* Provider cards */}
      <div className="space-y-3">
        {PROVIDERS.map((provider) => {
          const active    = selected === provider.key;
          const available = isAvailable(provider);

          return (
            <button
              key={String(provider.key)}
              type="button"
              onClick={() => available && setSelected(provider.key)}
              disabled={!available}
              className={[
                "w-full flex items-start gap-4 rounded-xl border-2 px-5 py-4 text-left transition-all",
                active
                  ? "border-brand-500 bg-brand-50/50 shadow-sm"
                  : available
                    ? "border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-sm"
                    : "border-neutral-100 bg-neutral-50 opacity-50 cursor-not-allowed",
              ].join(" ")}
            >
              {/* Radio indicator */}
              <div className={[
                "mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 transition-colors",
                active
                  ? "border-brand-500 bg-brand-500"
                  : "border-neutral-300 bg-white",
              ].join(" ")}>
                {active && (
                  <div className="h-full w-full rounded-full flex items-center justify-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-white" />
                  </div>
                )}
              </div>

              {/* Icon */}
              <span className={active ? "text-brand-600 mt-0.5" : "text-neutral-400 mt-0.5"}>
                {provider.icon}
              </span>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-semibold ${active ? "text-brand-700" : "text-neutral-900"}`}>
                    {provider.label}
                  </span>
                  {/* Badges */}
                  {provider.key === null && (
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 ring-1 ring-blue-200">
                      {initialState.platformProvider.replace("_", " ")}
                    </span>
                  )}
                  {provider.key !== null && !available && (
                    <span className="inline-flex items-center rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 ring-1 ring-neutral-200">
                      not configured
                    </span>
                  )}
                  {provider.key !== null && available && (
                    <span className="inline-flex items-center rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-600 ring-1 ring-green-200">
                      configured
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-neutral-500 leading-relaxed">
                  {provider.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Effective provider callout */}
      <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
        <span className="font-semibold text-neutral-700">Effective provider for uploads:</span>{" "}
        {selected !== null
          ? PROVIDERS.find((p) => p.key === selected)?.label ?? selected
          : `Platform default (${initialState.platformProvider.replace(/_/g, " ")})`}
      </div>

      {/* Save / feedback */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className={[
            "rounded-lg px-5 py-2 text-sm font-semibold text-white transition-colors",
            isPending
              ? "cursor-not-allowed bg-brand-300"
              : "bg-brand-500 hover:bg-brand-600 active:bg-brand-700",
          ].join(" ")}
        >
          {isPending ? "Saving…" : "Save storage settings"}
        </button>

        {saved && !isPending && (
          <span className="text-sm text-green-600 font-medium">✓ Saved</span>
        )}
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
