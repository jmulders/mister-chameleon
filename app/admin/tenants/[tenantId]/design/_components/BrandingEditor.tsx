"use client";

/**
 * BrandingEditor — tenant-owned brand logos (light / dark) for the chrome.
 *
 * These are the PRIMARY logo source for the Header and Footer (falling back to
 * the CMS site settings, then /logo.svg). The dark variant renders on dark
 * surfaces (headerBg / footerBg luminance); the light/primary logo everywhere
 * else. This makes the light/dark logo switch work for platform-hosted tenants
 * whose cms_provider is null (e.g. statamic), which return no logoDark from the
 * CMS.
 */

import { useState, useTransition } from "react";
import { loadAssetsForPickerAction } from "@/lib/assets/asset-picker-action";
import { uploadForPickerClient }      from "@/lib/assets/upload-for-picker-client";
import { AssetPickerModal }           from "@/components/admin/AssetPickerModal";
import { saveBrandingAction }         from "@/app/admin/tenants/[tenantId]/actions";
import type { TenantBrandingSettings } from "@/tenant/types";

interface LogoState {
  url: string;
  alt: string;
}

const emptyLogo: LogoState = { url: "", alt: "" };

function toState(logo: { url: string; alt?: string } | undefined): LogoState {
  return logo?.url ? { url: logo.url, alt: logo.alt ?? "" } : { ...emptyLogo };
}

/** Serialise a LogoState to the stored shape, or undefined when no URL is set. */
function toStored(s: LogoState): { url: string; alt?: string } | undefined {
  if (!s.url.trim()) return undefined;
  return { url: s.url.trim(), ...(s.alt.trim() ? { alt: s.alt.trim() } : {}) };
}

// ── One logo variant row ────────────────────────────────────────────────────────

function LogoField({
  tenantId,
  label,
  hint,
  darkPreview,
  value,
  onChange,
}: {
  tenantId:    string;
  label:       string;
  hint:        string;
  /** Preview the logo on a dark swatch (for the dark variant). */
  darkPreview: boolean;
  value:       LogoState;
  onChange:    (next: LogoState) => void;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <div className="mb-1 text-sm font-medium text-neutral-800">{label}</div>
      <p className="mb-3 text-xs text-neutral-500">{hint}</p>

      <AssetPickerModal
        tenantId={tenantId}
        mode="image"
        loadAssets={loadAssetsForPickerAction}
        uploadAsset={uploadForPickerClient}
        currentUrl={value.url}
        onSelect={(asset) => onChange({ url: asset.publicUrl, alt: value.alt || (asset.altText ?? "") })}
        trigger={
          value.url ? (
            <div
              className={[
                "relative flex h-20 cursor-pointer items-center justify-center overflow-hidden rounded-lg border px-4",
                darkPreview ? "border-neutral-700 bg-neutral-900" : "border-neutral-200 bg-neutral-50",
              ].join(" ")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- admin preview, arbitrary tenant CDN */}
              <img src={value.url} alt="" className="max-h-14 max-w-full object-contain" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity hover:opacity-100">
                <span className="text-xs font-semibold text-white">Change logo</span>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-xs font-medium text-neutral-500 transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-600"
            >
              Pick logo from library or upload
            </button>
          )
        }
      />

      {value.url && (
        <>
          <label className="mt-3 block text-xs font-medium text-neutral-700">Alt text</label>
          <input
            type="text"
            value={value.alt}
            onChange={(e) => onChange({ ...value, alt: e.target.value })}
            placeholder="Describe the logo for screen readers"
            className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
          <button
            type="button"
            onClick={() => onChange({ ...emptyLogo })}
            className="mt-1 text-[10px] text-neutral-400 transition-colors hover:text-red-500"
          >
            Remove logo
          </button>
        </>
      )}
    </div>
  );
}

// ── Editor ──────────────────────────────────────────────────────────────────────

export function BrandingEditor({
  tenantId,
  branding,
}: {
  tenantId:  string;
  branding?: TenantBrandingSettings;
}) {
  const [logo, setLogo]         = useState<LogoState>(toState(branding?.logo));
  const [logoDark, setLogoDark] = useState<LogoState>(toState(branding?.logoDark));
  const [status, setStatus]     = useState<"idle" | "saved" | "error">("idle");
  const [error, setError]       = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setStatus("idle");
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveBrandingAction(tenantId, {
          ...(toStored(logo)     ? { logo:     toStored(logo)! }     : {}),
          ...(toStored(logoDark) ? { logoDark: toStored(logoDark)! } : {}),
        });
        if (result?.success === false) {
          setStatus("error");
          setError(result.error ?? "Could not save branding.");
          return;
        }
        setStatus("saved");
      } catch (e) {
        setStatus("error");
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <LogoField
          tenantId={tenantId}
          label="Logo (light / primary)"
          hint="Shown on light header/footer surfaces and as the default."
          darkPreview={false}
          value={logo}
          onChange={(v) => { setLogo(v); setStatus("idle"); }}
        />
        <LogoField
          tenantId={tenantId}
          label="Logo — dark surface"
          hint="A white / knockout variant. Shown when the header or footer background is dark."
          darkPreview
          value={logoDark}
          onChange={(v) => { setLogoDark(v); setStatus("idle"); }}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save branding"}
        </button>
        {status === "saved" && <span className="text-xs font-medium text-green-600">Saved.</span>}
        {status === "error" && <span className="text-xs font-medium text-red-600">{error}</span>}
      </div>
    </div>
  );
}
