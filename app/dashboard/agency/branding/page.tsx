"use client";

/**
 * Dashboard — Agency White-label Branding
 *
 * Lets Pro agency owners customise the look of their white-label product:
 * agency name, logo, favicon, brand colour, custom domain, support email,
 * and footer text.
 *
 * This is a client component so we can show a live colour preview and
 * optimistic save feedback without a full server round-trip.
 */

import { useEffect, useState, useTransition } from "react";
import { getAgencyBranding, saveAgencyBranding, type AgencyBranding } from "../actions";

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEFAULT_BRANDING: AgencyBranding = {
  agency_name:     null,
  logo_url:        null,
  favicon_url:     null,
  primary_color:   "#006BA6",
  custom_domain:   null,
  domain_verified: false,
  support_email:   null,
  footer_text:     null,
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AgencyBrandingPage() {
  const [tenantId, setTenantId]         = useState<string | null>(null);
  const [branding, setBranding]         = useState<AgencyBranding>(DEFAULT_BRANDING);
  const [loading, setLoading]           = useState(true);
  const [saveError, setSaveError]       = useState<string | null>(null);
  const [saved, setSaved]               = useState(false);
  const [isPending, startTransition]    = useTransition();

  // ── Resolve tenant from URL / cookie on mount ─────────────────────────────
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get("tenant") ?? "";
    setTenantId(id || null);

    if (!id) {
      setLoading(false);
      return;
    }

    getAgencyBranding(id).then((b) => {
      setBranding(b);
      setLoading(false);
    });
  }, []);

  function handleChange(key: keyof AgencyBranding, value: string | boolean) {
    setBranding((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    setSaveError(null);
    setSaved(false);

    startTransition(async () => {
      const result = await saveAgencyBranding(tenantId, branding);
      if (result.ok) {
        setSaved(true);
      } else {
        setSaveError(result.error ?? "Save failed.");
      }
    });
  }

  if (loading) {
    return (
      <div className="px-8 py-8 max-w-2xl">
        <div className="h-7 w-48 bg-neutral-100 rounded animate-pulse mb-6" />
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-neutral-50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!tenantId) {
    return (
      <div className="px-8 py-8 max-w-2xl">
        <h1 className="text-xl font-bold text-neutral-900 mb-4">White-label Branding</h1>
        <p className="text-sm text-neutral-500">
          No tenant context found. Access this page from your agency dashboard or
          add <code className="font-mono text-xs bg-neutral-100 px-1 rounded">?tenant=your_id</code> to the URL.
        </p>
        <a href="/dashboard/agency" className="mt-4 inline-block text-sm text-brand-600 hover:underline">
          ← Back to agency
        </a>
      </div>
    );
  }

  return (
    <div className="px-8 py-8 max-w-2xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">White-label Branding</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Customise how your agency&apos;s product appears to clients.
          </p>
        </div>
        <a
          href="/dashboard/agency"
          className="text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
        >
          ← Agency
        </a>
      </div>

      {/* Live colour preview strip */}
      <div
        className="rounded-xl mb-6 px-5 py-4 flex items-center gap-4 text-white"
        style={{ backgroundColor: branding.primary_color || "#006BA6" }}
      >
        {branding.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logo_url}
            alt="Agency logo preview"
            className="h-8 w-auto object-contain rounded"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="h-8 w-8 rounded bg-white/20 flex items-center justify-center text-sm font-bold">
            {(branding.agency_name ?? "A").charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <p className="font-semibold text-sm">{branding.agency_name || "Your Agency Name"}</p>
          {branding.custom_domain && (
            <p className="text-[11px] text-white/70">{branding.custom_domain}</p>
          )}
        </div>
        <div className="ml-auto text-[11px] text-white/60 italic">Live preview</div>
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="flex flex-col gap-5">

        {/* Agency name */}
        <Field label="Agency name" htmlFor="agency_name">
          <input
            id="agency_name"
            type="text"
            value={branding.agency_name ?? ""}
            onChange={(e) => handleChange("agency_name", e.target.value)}
            placeholder="Acme Digital"
            className={inputCls}
          />
        </Field>

        {/* Logo URL */}
        <Field label="Logo URL" htmlFor="logo_url" hint="Hosted image URL, shown in header. Recommended: SVG or PNG on transparent background.">
          <input
            id="logo_url"
            type="url"
            value={branding.logo_url ?? ""}
            onChange={(e) => handleChange("logo_url", e.target.value)}
            placeholder="https://cdn.example.com/logo.svg"
            className={inputCls}
          />
        </Field>

        {/* Favicon URL */}
        <Field label="Favicon URL" htmlFor="favicon_url" hint="32×32 or 64×64 PNG/ICO. Shown in browser tab.">
          <input
            id="favicon_url"
            type="url"
            value={branding.favicon_url ?? ""}
            onChange={(e) => handleChange("favicon_url", e.target.value)}
            placeholder="https://cdn.example.com/favicon.ico"
            className={inputCls}
          />
        </Field>

        {/* Primary colour */}
        <Field label="Primary colour" htmlFor="primary_color">
          <div className="flex items-center gap-3">
            <input
              id="primary_color"
              type="color"
              value={branding.primary_color}
              onChange={(e) => handleChange("primary_color", e.target.value)}
              className="h-9 w-16 cursor-pointer rounded-lg border border-neutral-200 p-1"
            />
            <input
              type="text"
              value={branding.primary_color}
              onChange={(e) => {
                const v = e.target.value;
                if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) handleChange("primary_color", v);
              }}
              placeholder="#006BA6"
              className={`${inputCls} w-32 font-mono`}
            />
            <span className="text-xs text-neutral-400">Used for buttons, links, and accents.</span>
          </div>
        </Field>

        {/* Custom domain */}
        <Field
          label="Custom domain"
          htmlFor="custom_domain"
          hint="CNAME your domain to the platform DNS target. Domain verification happens automatically within 24 h."
        >
          <div className="flex items-center gap-3">
            <input
              id="custom_domain"
              type="text"
              value={branding.custom_domain ?? ""}
              onChange={(e) => handleChange("custom_domain", e.target.value)}
              placeholder="personalise.acme.com"
              className={`${inputCls} flex-1`}
            />
            {branding.domain_verified ? (
              <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                ✓ Verified
              </span>
            ) : branding.custom_domain ? (
              <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                Pending
              </span>
            ) : null}
          </div>
        </Field>

        {/* Support email */}
        <Field label="Support email" htmlFor="support_email" hint="Shown to your clients in error messages and help text.">
          <input
            id="support_email"
            type="email"
            value={branding.support_email ?? ""}
            onChange={(e) => handleChange("support_email", e.target.value)}
            placeholder="support@acme.com"
            className={inputCls}
          />
        </Field>

        {/* Footer text */}
        <Field label="Footer text" htmlFor="footer_text" hint="Short line shown at the bottom of client-facing pages. Supports plain text.">
          <input
            id="footer_text"
            type="text"
            value={branding.footer_text ?? ""}
            onChange={(e) => handleChange("footer_text", e.target.value)}
            placeholder="© 2025 Acme Digital. Powered by Chameleon."
            className={inputCls}
          />
        </Field>

        {/* Feedback */}
        {saveError && (
          <p className="text-sm text-red-600 font-medium">{saveError}</p>
        )}
        {saved && !isPending && (
          <p className="text-sm text-emerald-700 font-medium">✓ Branding saved successfully.</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors disabled:opacity-60"
          >
            {isPending ? "Saving…" : "Save branding"}
          </button>
          <a
            href="/dashboard/agency"
            className="text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-300 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400";

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-neutral-700 mb-1">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-neutral-400">{hint}</p>}
    </div>
  );
}
