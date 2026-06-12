/**
 * Contact page  —  app/(site)/contact/page.tsx
 *
 * Server component: the page itself runs on the server so it can read
 * searchParams (including _mc_draft for Statamic Live Preview) and is
 * compatible with Next.js App Router metadata exports.
 *
 * Only the form is interactive — ContactForm handles state and the
 * POST to /api/contact.  Keeping the form as a client island avoids
 * making the entire page a client bundle.
 *
 * ─── Three rendering paths ────────────────────────────────────────────────────
 *
 *  1. Statamic Live Preview draft  (_mc_draft=TOKEN, development only)
 *     Builds PageData from the unsaved in-memory draft so every CP change
 *     (add/toggle/reorder blocks) is visible live in the preview iframe.
 *
 *  2. CMS path  (Statamic file on disk, STATAMIC_CMS_PATH is set)
 *     Reads contact.md from the Statamic CMS directory, maps page_blocks to
 *     sections, and renders via TemplateRenderer — same result as path 1 after
 *     saving.  This makes localhost:3000/contact match the CP Live Preview.
 *
 *  3. Hardcoded fallback
 *     Shown when no STATAMIC_CMS_PATH is set or contact.md has no CMS blocks.
 *     Keeps the classic hero + ContactForm layout.
 */

export const dynamic = "force-dynamic";

import fs             from "fs";
import * as nodePath  from "path";
import { parse as parseYaml } from "yaml";
import Link            from "next/link";
import type { Metadata } from "next";
import { ContactForm } from "@/components/contact/ContactForm";
import { getDraft }    from "@/lib/statamic-draft-store";
import type { PageData, CmsPageContextConfig } from "@/cms/types";
import { mapStatamicPageBlocksToSections } from "@/cms/mappers/statamic";
import { mapPageDataToPageConfig } from "@/cms/mappers/page-config-mapper";
import { TemplateRenderer } from "@/components/platform/TemplateRenderer";
import { getActiveTenant, getTenantById } from "@/tenant/server";
import { resolveSlugPageConfig } from "@/lib/cms-page-decision";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "Contact",
  description: "Neem contact op met Mister Chameleon. We helpen je graag met een demo of beantwoorden je vragen over website-personalisatie.",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reads contact.md from the Statamic CMS directory (STATAMIC_CMS_PATH) and
 * maps it to a minimal PageData.  Returns null when STATAMIC_CMS_PATH is not
 * set, the file doesn't exist, or parsing fails.
 *
 * Mirrors the readStatamicPageFromDisk() helper in [slug]/page.tsx.
 */
function readContactPageFromDisk(): PageData | null {
  try {
    const cmsFsPath = process.env.STATAMIC_CMS_PATH;
    if (!cmsFsPath) return null;

    const absRoot  = nodePath.resolve(process.cwd(), cmsFsPath);
    const filePath = nodePath.join(absRoot, "content", "collections", "pages", "contact.md");

    if (!fs.existsSync(filePath)) return null;

    const raw   = fs.readFileSync(filePath, "utf-8");
    const match = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;

    const data       = parseYaml(match[1]) as Record<string, unknown>;
    const pageBlocks = Array.isArray(data.page_blocks)
      ? (data.page_blocks as Array<Record<string, unknown>>)
      : [];

    // Only render via TemplateRenderer when there are CMS-authored blocks.
    if (pageBlocks.length === 0) return null;

    // Build contextConfig from context_slot blocks.
    const contextConfigObj: Record<string, { fallbackVariantKey: string }> = {};
    for (const block of pageBlocks) {
      if (
        block.type === "context_slot" &&
        block.is_active !== false &&
        block.enabled !== false
      ) {
        const slotType   = block.slot_type as string | undefined;
        const variantKey = block.variant_key as string | undefined;
        if (slotType === "hero" || slotType === "proof" || slotType === "cta") {
          contextConfigObj[slotType] = {
            fallbackVariantKey: variantKey ?? `${slotType}_default`,
          };
        }
      }
    }

    const hasSlots = Object.keys(contextConfigObj).length > 0;

    return {
      id:             "contact",
      title:          typeof data.title          === "string" ? data.title          : "Contact",
      slug:           "contact",
      seoDescription: typeof data.seo_description === "string" ? data.seo_description : undefined,
      sections:       mapStatamicPageBlocksToSections(pageBlocks),
      templateKey:    hasSlots ? "marketing-page" : "article-page",
      contextConfig:  hasSlots ? (contextConfigObj as CmsPageContextConfig) : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Shared helper: maps a PageData + resolves slug page config, returns JSX
 * rendered by TemplateRenderer.  Used by both the draft path and the CMS path.
 */
async function renderCmsContactPage(page: PageData) {
  const pageConfig   = mapPageDataToPageConfig(page);
  const { tenantId } = await getActiveTenant();
  const tenant       = await getTenantById(tenantId ?? "");
  const headerStore  = await headers();

  const { pageConfig: resolvedPageConfig, tokenContext } = await resolveSlugPageConfig(
    new Request(
      `http://${headerStore.get("host") ?? "localhost"}/contact`,
      { headers: headerStore },
    ),
    headerStore.get("cookie"),
    "contact",
    pageConfig,
    tenant,
    tenantId ?? "",
  );

  return (
    <main>
      <TemplateRenderer
        pageConfig={resolvedPageConfig}
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
  if (process.env.NODE_ENV === "development") {
    const sp         = await searchParams;
    const draftToken = typeof sp._mc_draft === "string" ? sp._mc_draft : null;
    const draftEntry = draftToken ? getDraft(draftToken) : null;

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

  // ── Path 2: CMS path — read saved Statamic content from disk ───────────────
  //
  // Reads contact.md from the Statamic CMS directory so that
  // localhost:3000/contact shows the same content as the CP Live Preview
  // after saving.  Falls through to the hardcoded fallback when no CMS blocks
  // are present (e.g. STATAMIC_CMS_PATH not set, or empty page_blocks).
  const cmsPage = readContactPageFromDisk();
  if (cmsPage) {
    return renderCmsContactPage(cmsPage);
  }

  // ── Path 3: Hardcoded fallback ──────────────────────────────────────────────
  //
  // Shown when STATAMIC_CMS_PATH is not configured or contact.md has no
  // page_blocks.  Preserves the classic hero + ContactForm layout.
  return (
    <div className="min-h-screen bg-white">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pt-20 pb-12 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-500 mb-6">
          <span>🦎</span> Get in touch
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl">
          Let&apos;s talk personalisation
        </h1>
        <p className="mt-5 text-lg text-neutral-500 max-w-xl mx-auto">
          Questions about the platform, a custom plan, or just want to see a demo?
          We respond within one business day.
        </p>
      </section>

      {/* ── CONTENT ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">

          {/* Left — form */}
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 mb-6">Send us a message</h2>
            <ContactForm />
          </div>

          {/* Right — contact details + options */}
          <div className="space-y-8">
            {/* Email */}
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">Direct contact</h2>
              <a
                href="mailto:hello@mister-chameleon.io"
                className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700 hover:border-neutral-400 transition-colors"
              >
                <span className="text-xl">✉️</span>
                hello@mister-chameleon.io
              </a>
            </div>

            <hr className="border-neutral-200" />

            {/* Book a demo */}
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 mb-2">Book a demo</h2>
              <p className="text-sm text-neutral-500 mb-4">
                Prefer to see it live? Book a 20-minute walkthrough — we&apos;ll show you
                how to go live on your site in one afternoon.
              </p>
              <Link
                href="/book-demo"
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-900 px-5 py-2.5 text-sm font-semibold text-neutral-900 hover:bg-neutral-900 hover:text-white transition-colors"
              >
                📅 Book a 20-min demo
              </Link>
            </div>

            <hr className="border-neutral-200" />

            {/* FAQ pointer */}
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 mb-2">Common questions</h2>
              <p className="text-sm text-neutral-500 mb-4">
                Have a billing or pricing question? Check our FAQ first.
              </p>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-900 hover:underline"
              >
                See pricing &amp; FAQ →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
