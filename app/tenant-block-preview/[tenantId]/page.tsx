/**
 * Tenant block — live preview surface (iframe target)
 *
 * Renders a SINGLE adaptive block at full fidelity using the real production
 * block components, so the block editor drawer can show a live, accurate
 * preview (layout variant, media, carousel, per-block design tokens) exactly as
 * a visitor would see it.
 *
 *   hero / proof / cta / feature  render through AdaptiveSlotPreview (they are
 *                                 ContextSlotData shapes).
 *   conversion / notification     render directly with ConversionBlock /
 *                                 NotificationBlock, because they are overlays
 *                                 with their own data contract, not context
 *                                 slots. The notification is anchored inside a
 *                                 bounded stage (preview mode) so the otherwise
 *                                 fixed overlay is visible; the book-demo
 *                                 conversion shows a static placeholder instead
 *                                 of the live availability calendar.
 *
 * The in-progress (unsaved) variant is passed base64url-encoded in `?v`, and the
 * block key in `?key`. The tenant's fully-resolved theme is applied as inline
 * CSS variables on a `data-site` wrapper, because this route lives outside the
 * tenant's own `[data-site]` site layout.
 *
 * This route is OUTSIDE /admin (so no admin chrome leaks into the iframe); auth
 * is therefore enforced explicitly here.
 */

import type { CSSProperties, ComponentProps } from "react";
import { notFound } from "next/navigation";
import { getRequiredAdminSession, assertTenantAccess } from "@/lib/admin-auth/authorization";
import { getTenantById } from "@/tenant/server";
import { resolveThemeForTenant, resolvedThemeToCSS, cssDeclarationsToRecord } from "@/tenant/resolve-theme";
import { AdaptiveSlotPreview } from "@/components/platform/TemplateRenderer";
import { adaptiveVariantToContextEntry } from "@/lib/tokens/adaptive-variant-to-context";
import {
  adaptiveVariantToConversionData,
  adaptiveVariantToNotificationData,
} from "@/lib/blocks/adaptive-variant-to-overlay";
import { ConversionBlock } from "@/components/blocks/ConversionBlock";
import { NotificationBlock } from "@/components/blocks/NotificationBlock";
import type { AdaptiveVariantContent, NotificationBlockData } from "@/cms/types";
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

  const blockTokenSets = tenant.design?.blockTokenSets ?? [];

  return (
    <div data-site style={themeVars as CSSProperties} className="min-h-screen bg-white text-neutral-900">
      {renderPreview(slotId, content, key, blockTokenSets)}
    </div>
  );
}

// ── Per-slot preview render ────────────────────────────────────────────────────

function renderPreview(
  slotId: string,
  content: AdaptiveVariantContent,
  key: string,
  blockTokenSets: ComponentProps<typeof AdaptiveSlotPreview>["blockTokenSets"],
) {
  // Conversion and notification are overlays with their own data contract (not
  // ContextSlotData), so they render here with the real block components rather
  // than through AdaptiveSlotPreview. See adaptiveVariantToContextEntry.
  if (slotId === "conversion") {
    const data = adaptiveVariantToConversionData(content, key);
    return <ConversionBlock data={data} preview />;
  }

  if (slotId === "notification") {
    const data = adaptiveVariantToNotificationData(content, key);
    if (!data) return <EmptyHint text="Add a message to preview this notification." />;
    return <NotificationOverlayPreview data={data} />;
  }

  // Hero / proof / cta / feature render at full fidelity through the production
  // block components via the shared context adapter.
  const entry = adaptiveVariantToContextEntry(slotId, content, key);
  if (!entry) return <EmptyHint text="No live preview for this block type yet. Content and design tokens still save normally." />;
  return (
    <AdaptiveSlotPreview
      slotId={slotId as ContextSlotId}
      contextData={entry as ContextSlotData}
      blockTokenSets={blockTokenSets}
    />
  );
}

/**
 * Bounded stage for the notification overlay. On the live site the notification
 * is `position: fixed` against the viewport; here it renders with `preview` set,
 * which anchors it (`absolute`) inside this bounded, `relative` stage so it is
 * fully visible in the drawer iframe. A caption states where it floats live.
 */
function NotificationOverlayPreview({ data }: { data: NotificationBlockData }) {
  const pos = data.position ?? "top";
  const posLabel: Record<string, string> = {
    top:            "fixed banner across the top",
    bottom:         "fixed banner across the bottom",
    left:           "floating toast, bottom-left corner",
    right:          "floating toast, bottom-right corner",
    "bottom-right": "floating toast, bottom-right corner",
    center:         "centered modal with a backdrop",
  };
  return (
    <div className="p-6">
      <p className="mb-3 text-xs text-neutral-500">
        Preview shown in place. On the live site this floats as a {posLabel[pos] ?? pos}.
      </p>
      <div className="relative h-[70vh] min-h-[420px] w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
        <NotificationBlock {...data} preview />
      </div>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-8 text-center text-sm text-neutral-500">
      {text}
    </div>
  );
}
