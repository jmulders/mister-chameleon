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
import { TemplateRenderer } from "@/components/platform/TemplateRenderer";
import { getDraft, type StatamicDraftEntry } from "@/lib/statamic-draft-store";
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
  const mcdraftToken =
    typeof sp.mcdraft === "string" ? sp.mcdraft :
    typeof sp._mc_draft === "string" ? sp._mc_draft : null;
  // Statamic's native Live Preview appends ?live-preview=ID&token=TOKEN.
  const statamicToken = typeof sp.token === "string" ? sp.token : null;

  let draftEntry: StatamicDraftEntry | null = mcdraftToken ? await getDraft(mcdraftToken) : null;

  // Direct (no-bridge) flow: the Statamic CP loads this page itself with the
  // native token. We fetch the current UNSAVED entry server-side from the
  // Statamic /mc-live-preview-data endpoint (server-to-server → no CORS), so the
  // CP renders the preview in a single iframe without any bridge/nesting.
  if (!draftEntry && statamicToken) {
    try {
      // Use the tenant's configured Statamic base URL (the live Ploi host where
      // the /mc-live-preview-data route lives) — NOT env STATAMIC_API_URL, which
      // may point at an older deployment.
      const { tenantId } = await getActiveTenant();
      const tenant = await getTenantById(tenantId ?? "");
      const rawBase =
        (tenant as { cms?: { statamicBaseUrl?: string } } | null)?.cms?.statamicBaseUrl ??
        process.env.STATAMIC_API_URL ?? "";
      const base = rawBase.replace(/\/api\/?$/, "").replace(/\/$/, "");
      if (base) {
        const res = await fetch(
          `${base}/mc-live-preview-data?token=${encodeURIComponent(statamicToken)}`,
          { cache: "no-store" },
        );
        if (res.ok) {
          const d = (await res.json()) as {
            collection?: string; slug?: string; title?: string;
            seoDescription?: string; pageBlocks?: unknown[]; error?: string;
          };
          if (!d.error) {
            draftEntry = {
              collection: d.collection ?? "pages",
              slug: d.slug ?? "home",
              title: d.title,
              seoDescription: d.seoDescription,
              blocks: Array.isArray(d.pageBlocks) ? d.pageBlocks : [],
            };
          }
        }
      }
    } catch {
      // fall through to the empty state below
    }
  }

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

  // Disable video autoplay in the preview. Autoplaying YouTube embeds reload on
  // every preview refresh, flooding the console and slowing the iframe down for
  // no benefit to the editor.
  const stripAutoplay = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stripAutoplay);
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = k === "autoplay" || k === "video_autoplay" ? false : stripAutoplay(v);
      }
      return out;
    }
    return value;
  };
  const rawBlocks = (draftEntry.blocks ?? []) as unknown[];
  const safeBlocks = stripAutoplay(rawBlocks) as unknown[];
  const blocks = safeBlocks as Array<Record<string, unknown>>;

  const draftProvider = createDraftStatamicProvider(safeBlocks);

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

  // NOTE: we intentionally do NOT call resolvePageConfigItems() here. That
  // hydrates collection-driven blocks (listing / related_content / team) by
  // firing one Statamic API call per block — several round-trips that make the
  // preview too slow to settle inside the nested CP iframe. For a fast editor
  // preview we render the structure directly; those few collection blocks show
  // empty. TemplateRenderer still receives the draft provider for context slots.

  return (
    <main>
      <TemplateRenderer pageConfig={pageConfig} cmsProvider={draftProvider} />
      {/*
        Headless Live Preview client glue:
          1. Signal the parent (Statamic CP) that the preview has rendered.
          2. Listen for Statamic's `statamic.preview.updated` message (sent on
             every edit when the preview target uses refresh:false). Each message
             carries a fresh token for the current UNSAVED state, so we reload
             this page with it — giving true live, pre-save preview. Debounced so
             rapid edits collapse into one reload.
      */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){
            try{ if(window.parent!==window) window.parent.postMessage({name:'mc-preview-ready'},'*'); }catch(e){}
            var pending=null, timer=null;
            window.addEventListener('message', function(e){
              var m=e.data; if(!m||typeof m!=='object') return;
              if(m.name==='statamic.preview.updated' || m.type==='statamic.preview.updated'){
                var t=m.token||(m.data&&m.data.token); if(!t) return;
                pending=t; if(timer) clearTimeout(timer);
                timer=setTimeout(function(){
                  try{
                    var u=new URL(window.location.href);
                    if(u.searchParams.get('token')!==pending){
                      u.searchParams.set('token',pending);
                      window.location.replace(u.toString());
                    }
                  }catch(err){}
                }, 400);
              }
            });
          })();`,
        }}
      />
    </main>
  );
}
