/**
 * Admin — Tenant Design
 *
 * Thin server shell: fetches tenant + rules data, then hands off to the
 * client-side tab layout (DesignPageClient).
 *
 * Four tabs are exposed to operators:
 *
 *   Style              — stepped family → preset → live preview flow (default)
 *   Automatic switching — contextual rule → theme mappings
 *   Typography          — font stack, role mappings, and base sizing
 *   Advanced            — full token editor + JSON import/export
 */

import { notFound }      from "next/navigation";
import { getTenantById } from "@/tenant/server";
import { normalizeThemeKey } from "@/tenant";
import { DesignPageClient }  from "./_components/DesignPageClient";

export default async function TenantDesignPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tenant = await getTenantById(tenantId);
  if (!tenant) notFound();

  // Normalize the stored theme key before passing to client components.
  // normalizeThemeKey() applies the LEGACY_THEME_MAP and falls back to
  // "default" for any stale/unrecognised value, guaranteeing that no client
  // component ever receives a theme key that isn't in DESIGN_PRESETS.
  const safeThemeKey = normalizeThemeKey(tenant.design?.theme ?? "default");
  const safeDesign = safeThemeKey !== (tenant.design?.theme ?? "default")
    ? { ...tenant.design, theme: safeThemeKey }
    : (tenant.design ?? { theme: safeThemeKey });

  return (
    <div className="p-8 max-w-5xl">

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-900">Design</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Choose a theme and fine-tune its tokens. Theme switching by rule now
          lives under Personalisatie → Thema-switching.
        </p>
      </div>

      {/* Tab layout — all interactivity lives here */}
      <DesignPageClient
        tenantId={tenantId}
        activeTheme={safeThemeKey}
        design={safeDesign}
      />

    </div>
  );
}
