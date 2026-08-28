/**
 * Admin — Tenant › Personalization › Theme switching
 *
 * Maps contextual decision rules to themes: when a rule fires, visitors see the
 * paired theme for their session. Moved out of the Design page (which now owns
 * the visual token system) into Personalization, where rule-driven behaviour
 * lives.
 */

import { notFound }            from "next/navigation";
import { getTenantById }       from "@/tenant/server";
import { normalizeThemeKey }   from "@/tenant";
import { isThemePresetKey }    from "@/design-system/theme/presets";
import { getTenantRulesAction } from "@/app/admin/tenants/[tenantId]/rules/actions";
import { ThemeRulesEditor }     from "@/app/admin/tenants/[tenantId]/design/_components/ThemeRulesEditor";

export default async function ThemeSwitchingPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const [tenant, rulesResult] = await Promise.all([
    getTenantById(tenantId),
    getTenantRulesAction(tenantId),
  ]);

  if (!tenant) notFound();

  const rulesConfig  = rulesResult.ok ? rulesResult.config : undefined;
  const safeThemeKey = normalizeThemeKey(tenant.design?.theme ?? "default");

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-900">Theme switching</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Map decision rules to themes. When a rule fires, the visitor sees the
          paired theme for the duration of their session.
        </p>
      </div>

      <ThemeRulesEditor
        tenantId={tenantId}
        rulesConfig={rulesConfig}
        defaultTheme={isThemePresetKey(safeThemeKey) ? safeThemeKey : "modern-saas"}
      />
    </div>
  );
}
