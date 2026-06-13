/**
 * Live Preview route  —  app/(site)/mc-preview/page.tsx
 *
 * Renders a Statamic CP Live Preview draft (?mcdraft=TOKEN). The Statamic
 * bridge refreshes this iframe on every edit/reorder.
 *
 * It uses the draft blocks for page STRUCTURE (so reordering/toggling is
 * reflected live) and runs the LIGHTWEIGHT decision pipeline
 * (resolveSlugPageConfig — rules + experiments + AI on the session, no
 * enrichment) for slot CONTENT. This matches what the live page renders, so
 * context-slot pages (features, about, …) preview with real variant content
 * instead of empty slots — those variant keys only resolve through the engine.
 *
 * It deliberately skips the heavy homepage personalisation pipeline, analytics,
 * billing and homepage-only collection sections, so each refresh stays light.
 */

export const dynamic = "force-dynamic";

import { headers, cookies } from "next/headers";
import { createDraftStatamicProvider } from "@/cms";
import { mapPageDataToPageConfig } from "@/cms/mappers/page-config-mapper";
import { mapStatamicPageBlocksToSections } from "@/cms/mappers/statamic";
import { resolvePageConfigItems } from "@/cms/collection-resolver";
import { resolveSlugPageConfig } from "@/lib/cms-page-decision";
import { TemplateRenderer } from "@/components/platform/TemplateRenderer";
import { getDraft } from "@/lib/statamic-draft-store";
import { getActiveTenant, getTenantById } from "@/tenant/server";
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

  const headerStore = await headers();
  const c = await cookies();
  const cookieLocale = c.get(LOCALE_COOKIE)?.value;
  const locale = cookieLocale && isSupportedLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  const slug   = draftEntry.slug || "home";
  const blocks = (draftEntry.blocks ?? []) as Array<Record<string, unknown>>;

  const draftProvider = createDraftStatamicProvider(draftEntry.blocks ?? []);

  // Page structure from the draft (preferred mapper, then a direct fallback).
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

  const pageConfig = mapPageDataToPageConfig(page);

  // Resolve slot variants through the lightweight decision engine so context
  // slots render the same content as the live page (variant keys like
  // hero_features only resolve via the engine, not as raw CMS entries).
  const { tenantId } = await getActiveTenant();
  const tenant       = await getTenantById(tenantId ?? "");
  const request      = new Request(
    `http://${headerStore.get("host") ?? "localhost"}/${slug}`,
    { headers: headerStore },
  );

  let resolvedPageConfig = pageConfig;
  let tokenContext = undefined as Awaited<ReturnType<typeof resolveSlugPageConfig>>["tokenContext"];
  try {
    const res = await resolveSlugPageConfig(
      request,
      headerStore.get("cookie"),
      slug,
      pageConfig,
      tenant,
      tenantId ?? "",
    );
    resolvedPageConfig = res.pageConfig;
    tokenContext = res.tokenContext;
  } catch {
    // On any engine error, fall back to the unresolved config (slots use their
    // fallback variant keys) rather than failing the preview.
  }

  const finalPageConfig = await resolvePageConfigItems(draftProvider, resolvedPageConfig);

  return (
    <main>
      <TemplateRenderer
        pageConfig={finalPageConfig}
        tokenContext={tokenContext ?? undefined}
        cmsProvider={draftProvider}
      />
      {/*
        Tell the Live Preview bridge (parent window) that this preview has
        rendered, so it can swap the double-buffered iframe immediately —
        without waiting for the full `load` event, which slow sub-resources
        (autoplay YouTube embeds) can delay by several seconds.
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
