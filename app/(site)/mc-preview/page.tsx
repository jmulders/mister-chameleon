/**
 * Live Preview route  —  app/(site)/mc-preview/page.tsx
 *
 * Renders a Statamic CP Live Preview draft (?mcdraft=TOKEN). The Statamic
 * bridge refreshes this iframe on every edit/reorder.
 *
 * Intentionally LIGHTWEIGHT: it maps the draft blocks straight to sections and
 * renders them, WITHOUT the personalisation decision engine (rules / experiments
 * / AI), without enrichment, analytics or billing. That keeps each refresh fast
 * and avoids burning platform/AI budget on preview renders. Context slots show
 * their CMS-authored fallback variant; full per-visitor variant resolution is a
 * runtime concern for the live site, not the editor preview.
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
      {/*
        Tell the Live Preview bridge (parent window) that this preview has
        rendered, so it can hide the loading text immediately — without waiting
        for the full `load` event that slow sub-resources (YouTube) delay.
      */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "try{if(window.parent!==window)window.parent.postMessage({name:'mc-preview-ready'},'*');}catch(e){}",
        }}
      />
    </main>
  );
}
