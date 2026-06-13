/**
 * Lightweight Live Preview route  —  app/(site)/mc-preview/page.tsx
 *
 * Renders a Statamic CP Live Preview draft (?mcdraft=TOKEN) using ONLY the
 * CMS block → section → TemplateRenderer path. It deliberately SKIPS the full
 * homepage personalisation pipeline (decision engine, enrichment, GA4 history,
 * analytics/billing side-effects, extra homepage collection sections).
 *
 * Why: the Statamic CP bridge refreshes this iframe on every edit/reorder. The
 * full homepage render is far too heavy to run on each keystroke, so the bridge
 * points here instead — every update is near-instant. Slot variants resolve to
 * their CMS-authored fallback keys (no per-visitor engine), which is exactly
 * what an editor wants to preview.
 */

export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { createDraftStatamicProvider } from "@/cms";
import { mapPageDataToPageConfig } from "@/cms/mappers/page-config-mapper";
import { mapStatamicPageBlocksToSections } from "@/cms/mappers/statamic";
import { resolvePageConfigItems } from "@/cms/collection-resolver";
import { TemplateRenderer } from "@/components/platform/TemplateRenderer";
import { getDraft } from "@/lib/statamic-draft-store";
import { isSupportedLocale, DEFAULT_LOCALE, LOCALE_COOKIE } from "@/lib/locale";
import type { PageData, CmsPageContextConfig } from "@/cms/types";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Build hero/proof/cta context config from context_slot blocks. */
function buildContextConfig(blocks: Array<Record<string, unknown>>) {
  const cfg: Record<string, { fallbackVariantKey: string }> = {};
  for (const b of blocks) {
    if (b.type === "context_slot" && b.is_active !== false && b.enabled !== false) {
      const slot = b.slot_type as string | undefined;
      if (slot === "hero" || slot === "proof" || slot === "cta") {
        cfg[slot] = { fallbackVariantKey: (b.variant_key as string) ?? `${slot}_default` };
      }
    }
  }
  return cfg;
}

export default async function McPreviewPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const token =
    typeof sp.mcdraft === "string" ? sp.mcdraft :
    typeof sp._mc_draft === "string" ? sp._mc_draft : null;

  const draftEntry = token ? await getDraft(token) : null;

  if (!draftEntry) {
    return (
      <main style={{ padding: 24, font: "14px/1.5 system-ui, sans-serif", color: "#6b7280" }}>
        Geen live-preview data — het token is verlopen. Sla op of heropen de Live Preview.
      </main>
    );
  }

  const c = await cookies();
  const cookieLocale = c.get(LOCALE_COOKIE)?.value;
  const locale = cookieLocale && isSupportedLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  const slug   = draftEntry.slug || "home";
  const blocks = (draftEntry.blocks ?? []) as Array<Record<string, unknown>>;

  const draftProvider = createDraftStatamicProvider(draftEntry.blocks ?? []);

  // Preferred path — full mapper (resolves FAQ sources, related_content, etc.).
  // Falls back to a direct block→section build if the entry can't be resolved.
  let page: PageData | null = await draftProvider.getPageBySlug(slug, locale);

  if (!page) {
    const ctx = buildContextConfig(blocks);
    const hasSlots = Object.keys(ctx).length > 0;
    page = {
      id:             slug,
      title:          draftEntry.title ?? slug,
      slug,
      seoDescription: draftEntry.seoDescription,
      sections:       mapStatamicPageBlocksToSections(blocks),
      templateKey:    hasSlots ? "marketing-page" : "article-page",
      contextConfig:  hasSlots ? (ctx as CmsPageContextConfig) : undefined,
    };
  }

  const pageConfig      = mapPageDataToPageConfig(page);
  const finalPageConfig = await resolvePageConfigItems(draftProvider, pageConfig);

  return (
    <main>
      <TemplateRenderer pageConfig={finalPageConfig} cmsProvider={draftProvider} />
    </main>
  );
}
