/**
 * Admin — Tenant-scoped page editor
 *
 * Single-page editor view scoped to a specific tenant.  Server component shell that:
 *   1. Loads the page from the store, verifying it belongs to the tenant.
 *   2. Builds serialisable BlockDefInfo[] and SlotVocabulary from platform registries.
 *   3. Binds tenant-scoped server actions and passes them as `onSave` props to the
 *      client editor components — the tenantId and pageId are embedded in the
 *      function reference and are never sent from the browser.
 *   4. Renders three clearly separated sections:
 *        a. Identity      — editable title + slug (PageMetaForm).
 *        b. Context slots — interactive ContextSlotsEditor (allowed keys + fallback).
 *        c. Content flow  — interactive ContentFlowEditor (add/remove/reorder/edit).
 */

import { notFound }  from "next/navigation";
import Link          from "next/link";
import { getPageById } from "@/page-store";
import type { EditablePage } from "@/page-store";
import { getTenantById } from "@/tenant/tenant-store";
import { getAllBlockDefinitions, REGISTERED_CONTENT_BLOCK_TYPES } from "@/page-config";
import { SLOT_VOCABULARY } from "@/decision/types";
import { Badge }        from "@/components/ui/Badge";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Text }         from "@/components/primitives/Text";
import { PageMetaForm }       from "@/app/admin/pages/[pageId]/PageMetaForm";
import { ContentFlowEditor }  from "@/app/admin/pages/[pageId]/ContentFlowEditor";
import { ContextSlotsEditor } from "@/app/admin/pages/[pageId]/ContextSlotsEditor";
import type { BlockDefInfo }  from "@/app/admin/pages/[pageId]/ContentFlowEditor";
import type { SlotVocabulary } from "@/app/admin/pages/[pageId]/ContextSlotsEditor";
import {
  savePageMetaAction,
  saveContentBlocksAction,
  saveContextSlotsAction,
} from "./actions";

// ── URL helpers ─────────────────────────────────────────────────────────────────

function resolvePageUrl(slug: string): string {
  if (!slug || slug === "home") return "/";
  return `/${slug}`;
}

// ── Label / variant maps ─────────────────────────────────────────────────────────

const TEMPLATE_LABEL: Record<string, string> = {
  "marketing-page": "Marketing",
  "landing-page":   "Landing",
  "article-page":   "Article",
  "listing-page":   "Listing",
  "detail-page":    "Detail",
};

type BadgeVariant = "default" | "primary" | "success" | "warning" | "error" | "outline";

const TEMPLATE_VARIANT: Record<string, BadgeVariant> = {
  "marketing-page": "primary",
  "landing-page":   "success",
  "article-page":   "default",
  "listing-page":   "warning",
  "detail-page":    "outline",
};

// ── Read-only meta row ───────────────────────────────────────────────────────────

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
        {label}
      </span>
      <div className="text-sm text-neutral-700">{children}</div>
    </div>
  );
}

// ── Section wrapper ──────────────────────────────────────────────────────────────

function EditorSection({
  title,
  description,
  children,
}: {
  title:        string;
  description?: string;
  children:     React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <Text variant="h4">{title}</Text>
        {description && (
          <p className="mt-0.5 text-xs text-neutral-400">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────────

export default async function TenantPageEditorPage({
  params,
}: {
  params: Promise<{ tenantId: string; pageId: string }>;
}) {
  const { tenantId, pageId } = await params;

  // Tenant-scoped lookup — returns undefined if page belongs to a different tenant.
  const page: EditablePage | undefined = await getPageById(pageId, tenantId);
  if (!page) notFound();

  // Tenant's named block token sets — power the per-block "Design tokens" controls.
  const tenant = await getTenantById(tenantId);
  const blockTokenSets = tenant?.design?.blockTokenSets;

  // ── Bind tenant-scoped server actions ────────────────────────────────────────
  //
  // Each action is pre-filled with tenantId + pageId so the client components
  // only need to pass the mutable payload (title/slug, blocks, or slots).
  // This is the Next.js "bound server action" pattern — the bound arguments are
  // resolved on the server and never travel through the browser.
  const boundSaveMeta     = savePageMetaAction.bind(null, tenantId, pageId);
  const boundSaveBlocks   = saveContentBlocksAction.bind(null, tenantId, pageId);
  const boundSaveSlots    = saveContextSlotsAction.bind(null, tenantId, pageId);

  // ── Block defs — live registry only ─────────────────────────────────────────
  const liveKeys  = new Set(REGISTERED_CONTENT_BLOCK_TYPES as readonly string[]);
  const blockDefs: BlockDefInfo[] = getAllBlockDefinitions()
    .filter((d) => liveKeys.has(d.key))
    .map((d) => ({
      key:             d.key,
      displayName:     d.displayName,
      category:        d.category,
      allowedVariants: [...(d.allowedVariants ?? [])],
    }));

  // ── Slot vocabulary — serialisable ──────────────────────────────────────────
  const vocabulary: SlotVocabulary = {
    hero:  [...SLOT_VOCABULARY.hero],
    proof: [...SLOT_VOCABULARY.proof],
    cta:   [...SLOT_VOCABULARY.cta],
  };

  return (
    <div className="p-8 max-w-4xl">

      {/* Back link */}
      <div className="mb-4">
        <Link
          href={`/admin/tenants/${tenantId}/pages`}
          className="text-xs text-neutral-400 transition-colors hover:text-brand-700"
        >
          ← All pages
        </Link>
      </div>

      {/* Page header */}
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-neutral-900">{page.title}</h1>
        <Badge
          variant={TEMPLATE_VARIANT[page.templateKey] ?? "default"}
          size="md"
        >
          {TEMPLATE_LABEL[page.templateKey] ?? page.templateKey}
        </Badge>

        {/* Spacer */}
        <div className="flex-1" />

        {/* View page link */}
        <Link
          href={resolvePageUrl(page.slug)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-xs transition-colors hover:border-brand-300 hover:text-brand-700"
        >
          View page
          <span aria-hidden="true" className="text-neutral-400">↗</span>
        </Link>
      </div>

      {/* ── Three sections ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-10">

        {/* 1 · Identity */}
        <EditorSection
          title="Identity"
          description="Core metadata for this page. Title and slug are editable."
        >
          <Card>
            <CardHeader>
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-neutral-100 mb-4">
                <MetaRow label="Page ID">
                  <code className="font-mono text-xs text-neutral-500">{page.id}</code>
                </MetaRow>
                <MetaRow label="Template">
                  <Badge
                    variant={TEMPLATE_VARIANT[page.templateKey] ?? "default"}
                    size="sm"
                  >
                    {TEMPLATE_LABEL[page.templateKey] ?? page.templateKey}
                  </Badge>
                </MetaRow>
              </div>
            </CardHeader>
            <CardContent>
              <PageMetaForm
                pageId={page.id}
                initialTitle={page.title}
                initialSlug={page.slug}
                onSave={boundSaveMeta}
              />
            </CardContent>
          </Card>
        </EditorSection>

        {/* 2 · Context slots */}
        <EditorSection
          title="Context slots"
          description="Adaptive slots rendered before or after the content flow. Configure the allowed variant envelope and fallback. The decision engine selects the final per-visitor variant at request time."
        >
          <div className="text-right -mt-1 mb-1">
            <Link
              href="/admin/platform/variants"
              className="text-xs text-neutral-400 hover:text-brand-700 transition-colors"
            >
              What does each variant mean for AI? →
            </Link>
          </div>
          <ContextSlotsEditor
            pageId={page.id}
            initialSlots={page.contextSlots}
            vocabulary={vocabulary}
            onSave={boundSaveSlots}
          />
        </EditorSection>

        {/* 3 · Content flow */}
        <EditorSection
          title="Content flow"
          description="Ordered content blocks for this page. Add, remove, reorder, and edit block props."
        >
          <ContentFlowEditor
            pageId={page.id}
            initialBlocks={page.contentBlocks}
            blockDefs={blockDefs}
            onSave={boundSaveBlocks}
            tenantId={tenantId}
            blockTokenSets={blockTokenSets}
          />
        </EditorSection>

      </div>
    </div>
  );
}
