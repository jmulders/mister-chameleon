/**
 * Tenant block — live preview surface (iframe target)
 *
 * Renders a SINGLE adaptive block at full fidelity using the real production
 * block components (HeroBlock / ProofBlock / CTABlock / FeatureGridBlock via
 * AdaptiveSlotPreview), so the block editor drawer can show a live, accurate
 * preview — including layout variant, media, carousel, and per-block design
 * tokens — exactly as a visitor would see it.
 *
 * The in-progress (unsaved) variant is passed base64url-encoded in `?v`, and the
 * block key in `?key`. The tenant's fully-resolved theme is applied as inline
 * CSS variables on a `data-site` wrapper, because this route lives outside the
 * tenant's own `[data-site]` site layout.
 *
 * This route is OUTSIDE /admin (so no admin chrome leaks into the iframe); auth
 * is therefore enforced explicitly here.
 */

import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { getRequiredAdminSession, assertTenantAccess } from "@/lib/admin-auth/authorization";
import { getTenantById } from "@/tenant/server";
import { resolveThemeForTenant, resolvedThemeToCSS, cssDeclarationsToRecord } from "@/tenant/resolve-theme";
import { AdaptiveSlotPreview } from "@/components/platform/TemplateRenderer";
import { adaptiveVariantToContextEntry } from "@/lib/tokens/adaptive-variant-to-context";
import type { AdaptiveVariantContent } from "@/cms/types";
import type { ContextSlotData, ContextSlotId } from "@/page-config";

export const dynamic = "force-dynamic";

const SLOT_PREFIXES = ["hero_", "proof_", "cta_", "feature_", "conversion_", "notification_"];
function slotFromKey(key: string): string {
  for (const p of SLOT_PREFIXES) if (key.startsWith(p)) return p.slice(0, -1);
  return "hero";
}

/** Decode the base64url-encoded variant draft from the query string. */
function decodeVariant(v: string | undefined): AdaptiveVariantContent {
  const empty: AdaptiveVariantContent = { title: "", subtitle: "" };
  if (!v) return empty;
  try {
    const parsed = JSON.parse(Buffer.from(v, "base64url").toString("utf8"));
    if (parsed && typeof parsed === "object") return parsed as AdaptiveVariantContent;
  } catch { /* fall through to empty */ }
  return empty;
}

interface Props {
  params:       Promise<{ tenantId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BlockPreviewPage({ params, searchParams }: Props) {
  const { tenantId } = await params;
  const sp = await searchParams;

  // This route is not under /admin, so enforce access here.
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, tenantId);

  const tenant = await getTenantById(tenantId);
  if (!tenant) notFound();

  const key     = typeof sp.key === "string" ? sp.key : "hero_default";
  const slotId  = slotFromKey(key);
  const content = decodeVariant(typeof sp.v === "string" ? sp.v : undefined);

  // Full resolved tenant theme as inline CSS vars — mirrors the production
  // [data-site] cascade so colours, radii, and fonts match the live site.
  let themeVars: Record<string, string> = {};
  try {
    themeVars = cssDeclarationsToRecord(resolvedThemeToCSS(resolveThemeForTenant(tenant, null)));
  } catch { /* fall back to the block components' own defaults */ }

  const entry          = adaptiveVariantToContextEntry(slotId, content, key);
  const blockTokenSets = tenant.design?.blockTokenSets ?? [];

  return (
    <div data-site style={themeVars as CSSProperties} className="min-h-screen bg-white text-neutral-900">
      {entry ? (
        <AdaptiveSlotPreview
          slotId={slotId as ContextSlotId}
          contextData={entry as ContextSlotData}
          blockTokenSets={blockTokenSets}
        />
      ) : (
        <div className="flex min-h-screen items-center justify-center p-8 text-center text-sm text-neutral-500">
          No live preview for this block type yet — content and design tokens still save normally.
        </div>
      )}
    </div>
  );
}
