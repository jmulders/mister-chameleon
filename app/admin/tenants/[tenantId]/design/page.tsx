/**
 * Admin — Tenant Design
 *
 * Thin server shell: fetches tenant + rules data, then hands off to the
 * client-side tab layout (DesignPageClient).
 *
 * Four tabs are exposed to operators:
 *
 *   Presets            — categorized complete-look preset gallery (default)
 *   Automatic switching — contextual rule → theme mappings
 *   Typography          — font stack, role mappings, and base sizing
 *   Advanced            — full token editor + JSON import/export
 */

import { Suspense }      from "react";
import { notFound }      from "next/navigation";
import { getTenantById } from "@/tenant/server";
import { normalizeThemeKey } from "@/tenant";
import { listDesignTokenSets } from "@/lib/design-token-sets/design-token-sets-store";
import { listDesignEffectSets } from "@/lib/design-effect-sets/effect-sets-store";
import { DesignPageClient }  from "./_components/DesignPageClient";

export default async function TenantDesignPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tenant = await getTenantById(tenantId);
  if (!tenant) notFound();

  // Saved token sets for this tenant (plus platform-wide sets).
  const tokenSets = await listDesignTokenSets(tenantId);
  // Saved effect sets (declarative-effect library) for this tenant.
  const effectSets = await listDesignEffectSets(tenantId);

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

      {/* The tab strip is rendered by TenantSubNav (shared secondary row), so it
          sits in the same place and at the same size as the sub-nav on Content
          etc. Selection travels via ?tab=…; each panel renders its own header. */}
      <Suspense fallback={null}>
        <DesignPageClient
          tenantId={tenantId}
          activeTheme={safeThemeKey}
          design={safeDesign}
          branding={tenant.branding}
          tokenSets={tokenSets}
          effectSets={effectSets}
        />
      </Suspense>

    </div>
  );
}
