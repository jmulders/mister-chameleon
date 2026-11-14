/**
 * Contact page  —  app/(site)/contact/page.tsx
 *
 * Server component: the page itself runs on the server so it can read
 * searchParams (including _mc_draft for Statamic Live Preview) and is
 * compatible with Next.js App Router metadata exports.
 *
 * ─── Three rendering paths ────────────────────────────────────────────────────
 *
 *  1. Statamic Live Preview draft  (_mc_draft=TOKEN)
 *     Builds PageData from the unsaved in-memory draft so every CP change
 *     (add/toggle/reorder blocks) is visible live in the preview iframe.
 *
 *  2. CMS path  (the tenant's CMS has a contact page)
 *     Asks the tenant's CMS provider for the page with slug "contact" and
 *     renders its blocks via TemplateRenderer: the same provider path as
 *     app/(site)/[slug]/page.tsx. This route used to read contact.md from disk
 *     (STATAMIC_CMS_PATH) instead. Production reaches the CMS over its REST
 *     API, so the published page was never shown there.
 *
 *  3. Built-in page
 *     Shown when the CMS has no contact page, the page has no blocks, the CMS
 *     cannot be reached, or the tenant runs on the mock CMS. Keeps the classic
 *     heading + ContactForm layout.
 *
 * ─── The form ─────────────────────────────────────────────────────────────────
 *
 *  The built-in page uses ContactForm (POST /api/contact). On the CMS path the
 *  form is a form section block: FormSectionBlock renders the platform contact
 *  form and posts to /api/forms/contact. A CMS page without a usable form
 *  section gets that form added, see withContactForm().
 */

export const dynamic = "force-dynamic";

import { cache }       from "react";
import Link            from "next/link";
import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { ContactForm } from "@/components/contact/ContactForm";
import { getDraft }    from "@/lib/statamic-draft-store";
import { createCMSProvider } from "@/cms";
import type { PageData, CmsPageContextConfig } from "@/cms/types";
import { mapStatamicPageBlocksToSections } from "@/cms/mappers/statamic";
import { mapPageDataToPageConfig } from "@/cms/mappers/page-config-mapper";
import { resolvePageConfigItems } from "@/cms/collection-resolver";
import { TemplateRenderer } from "@/components/platform/TemplateRenderer";
import { PageTitleHeader }  from "@/components/site/PageTitleHeader";
import { getActiveTenant, getTenantById } from "@/tenant/server";
import { resolveSlugPageConfig } from "@/lib/cms-page-decision";
import { loadCmsContactPage, withContactForm } from "@/lib/contact-page";
import { isSupportedLocale, DEFAULT_LOCALE, LOCALE_COOKIE } from "@/lib/locale";
import { pageNeedsTitleHeading } from "@/lib/page-title";
import { PLATFORM_EMAIL } from "@/lib/platform-contact";

const FALLBACK_TITLE       = "Contact | Mister Chameleon";
const FALLBACK_DESCRIPTION = "Stel je vraag over het product, de prijzen of een demo. Je krijgt binnen één werkdag antwoord.";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The tenant's CMS contact page, fetched once per request and shared between
 * the page component and generateMetadata. Null means: show the built-in page.
 *
 * A tenant on the mock CMS keeps the built-in page. The mock provider does
 * answer for "contact", but with the demo content of a made-up company.
 */
const getCmsContactPage = cache(async (): Promise<PageData | null> => {
  const { tenantId } = await getActiveTenant();
  const tenant       = await getTenantById(tenantId ?? "");
  if (tenant?.cms?.provider === "mock") return null;

  const cookieStore = await cookies();
  const localeRaw   = cookieStore.get(LOCALE_COOKIE)?.value ?? "";
  const locale      = isSupportedLocale(localeRaw) ? localeRaw : DEFAULT_LOCALE;

  const page = await loadCmsContactPage(createCMSProvider(tenant?.cms, tenantId), locale);
  return page ? withContactForm(page) : null;
});

export async function generateMetadata(): Promise<Metadata> {
  const page = await getCmsContactPage();
  if (!page) return { title: FALLBACK_TITLE, description: FALLBACK_DESCRIPTION };

  // What the editor filled in wins. An empty field keeps the built-in text.
  return {
    title:       page.seoTitle       ?? FALLBACK_TITLE,
    description: page.seoDescription ?? FALLBACK_DESCRIPTION,
    robots:      (page.robots?.noindex || page.robots?.nofollow)
                   ? { index: !page.robots.noindex, follow: !page.robots.nofollow }
                   : undefined,
    alternates:  page.canonicalUrl ? { canonical: page.canonicalUrl } : undefined,
  };
}

/**
 * Shared helper: maps a PageData + resolves slug page config, returns JSX
 * rendered by TemplateRenderer.  Used by both the draft path and the CMS path.
 * Mirrors the render steps of app/(site)/[slug]/page.tsx.
 */
async function renderCmsContactPage(page: PageData) {
  const pageConfig   = mapPageDataToPageConfig(page);
  const { tenantId } = await getActiveTenant();
  const tenant       = await getTenantById(tenantId ?? "");
  const headerStore  = await headers();
  const proto        = headerStore.get("x-forwarded-proto") ?? "http";

  const { pageConfig: resolvedPageConfig, tokenContext } = await resolveSlugPageConfig(
    new Request(
      `${proto}://${headerStore.get("host") ?? "localhost"}/contact`,
      { headers: headerStore },
    ),
    headerStore.get("cookie"),
    "contact",
    pageConfig,
    tenant,
    tenantId ?? "",
  );

  // Blocks that list a collection (news, related content) arrive with no
  // items. Fill them the way the [slug] route does.
  const finalPageConfig = await resolvePageConfigItems(
    createCMSProvider(tenant?.cms, tenantId),
    resolvedPageConfig,
  );

  return (
    <main>
      {/* A page without a hero has no h1 of its own: its title becomes the heading. */}
      {pageNeedsTitleHeading(finalPageConfig.contextSlots, finalPageConfig.contentBlocks) && page.title && (
        <PageTitleHeader title={page.title} />
      )}
      <TemplateRenderer
        pageConfig={finalPageConfig}
        tokenContext={tokenContext ?? undefined}
      />
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default async function ContactPage({ searchParams }: PageProps) {

  // ── Path 1: Statamic Live Preview draft (development only) ──────────────────
  //
  // When the Antlers template POSTs page_blocks to /api/statamic-draft and
  // loads the iframe with ?_mc_draft=TOKEN, render the unsaved draft so every
  // CP change (add/toggle/reorder blocks) is visible live.
  {
    const sp         = await searchParams;
    const draftToken =
      typeof sp._mc_draft === "string" ? sp._mc_draft :
      typeof sp.mcdraft   === "string" ? sp.mcdraft   : null;
    const draftEntry = draftToken ? await getDraft(draftToken) : null;

    if (draftEntry) {
      type RawBlock = Record<string, unknown>;
      const blocks = (draftEntry.blocks ?? []) as RawBlock[];

      const contextConfigObj: Record<string, { fallbackVariantKey: string }> = {};
      for (const block of blocks) {
        if (
          block.type === "context_slot" &&
          block.is_active !== false &&
          block.enabled !== false
        ) {
          const slotType = block.slot_type as string | undefined;
          if (slotType === "hero" || slotType === "proof" || slotType === "cta") {
            contextConfigObj[slotType] = {
              fallbackVariantKey: (block.variant_key as string) ?? `${slotType}_default`,
            };
          }
        }
      }

      const hasSlots = Object.keys(contextConfigObj).length > 0;
      const page: PageData = {
        id:             "contact",
        title:          draftEntry.title ?? "Contact",
        slug:           "contact",
        seoDescription: draftEntry.seoDescription,
        sections:       mapStatamicPageBlocksToSections(blocks),
        templateKey:    hasSlots ? "marketing-page" : "article-page",
        contextConfig:  hasSlots ? (contextConfigObj as CmsPageContextConfig) : undefined,
      };

      return renderCmsContactPage(page);
    }
  }

  // ── Path 2: CMS path — the tenant's own contact page ───────────────────────
  //
  // Same provider the [slug] route uses, so this works wherever the CMS is
  // reached: over its REST API in production, from disk in local development.
  const cmsPage = await getCmsContactPage();
  if (cmsPage) {
    return renderCmsContactPage(cmsPage);
  }

  // ── Path 3: Built-in page ───────────────────────────────────────────────────
  //
  // Shown when the CMS has no contact page or did not answer.
  // Preserves the classic heading + ContactForm layout.
  return (
    <div className="min-h-screen bg-[var(--bg)]">

      {/* ── HEADING ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pb-12 pt-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-[color:var(--text)] sm:text-5xl">
          Neem contact op
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-[color:var(--text-muted)]">
          Een vraag over het product, de prijzen of een demo?
          Je krijgt binnen één werkdag antwoord.
        </p>
      </section>

      {/* ── CONTENT ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">

          {/* Left: the form */}
          <div>
            <h2 className="mb-6 text-lg font-semibold text-[color:var(--text)]">Stuur ons een bericht</h2>
            <ContactForm />
          </div>

          {/* Right: other ways to reach us */}
          <div className="space-y-8">
            <div>
              <h2 className="mb-4 text-lg font-semibold text-[color:var(--text)]">Liever mailen?</h2>
              <a
                href={`mailto:${PLATFORM_EMAIL}`}
                className="flex items-center gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--bg-subtle)] px-4 py-3 text-sm text-[color:var(--text)] transition-colors hover:border-[var(--text-muted)]"
              >
                <span aria-hidden className="text-xl">✉️</span>
                {PLATFORM_EMAIL}
              </a>
            </div>

            <hr className="border-[var(--card-border)]" />

            <div>
              <h2 className="mb-2 text-lg font-semibold text-[color:var(--text)]">Zie het liever werken?</h2>
              <p className="mb-4 text-sm text-[color:var(--text-muted)]">
                In een demo van dertig minuten laten we zien hoe jouw site eruitziet
                voor verschillende bezoekers.
              </p>
              <Link
                href="/demo"
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--text)] px-5 py-2.5 text-sm font-semibold text-[color:var(--text)] transition-colors hover:bg-[var(--bg-inverse)] hover:text-[color:var(--text-inverse)]"
              >
                Plan een demo
              </Link>
            </div>

            <hr className="border-[var(--card-border)]" />

            <div>
              <h2 className="mb-2 text-lg font-semibold text-[color:var(--text)]">Een vraag over de prijs?</h2>
              <p className="mb-4 text-sm text-[color:var(--text-muted)]">
                De pakketten en wat je ervoor krijgt staan op een rij.
              </p>
              <Link
                href="/prijzen"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--text)] hover:underline"
              >
                Bekijk de prijzen
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
