/**
 * Editable page model — pages/types.ts
 *
 * Defines the mutable, admin-layer representation of a page.  This is the
 * canonical shape stored by the page store and manipulated by the page builder.
 *
 * ─── Relationship to PageConfig ───────────────────────────────────────────────
 *
 *   EditablePage is the long-lived, persistable counterpart of the runtime
 *   PageConfig.  They share the same structural fields but differ in:
 *
 *   1. Mutability: EditablePage has no `readonly` qualifiers — fields can be
 *      updated freely in the admin editor.
 *
 *   2. Data typing: EditableContentBlock.data is typed as
 *      `Record<string, unknown>` rather than as a per-block discriminated type.
 *      This intentional looseness makes the editor generic (it doesn't need to
 *      import every block data interface) while still being safe at runtime
 *      (the renderer narrows `data` via the `blockType` discriminant).
 *
 *   3. Timestamps: EditablePage carries `createdAt` / `updatedAt` for auditing
 *      and optimistic UI state; PageConfig has neither.
 *
 * ─── Conversion helpers ───────────────────────────────────────────────────────
 *
 *   toPageConfig(page)        EditablePage → PageConfig (runtime consumption)
 *   fromPageConfig(config)    PageConfig → EditablePage (seeding / import)
 *
 * ─── Architecture position ───────────────────────────────────────────────────
 *
 *   CMS provider  →  PageData
 *        ↓  mapPageDataToPageConfig()
 *   PageConfig  ←────────────────────  fromPageConfig()
 *        ↓  toPageConfig()             ↑
 *   EditablePage  (pages/store.ts)  ───┘
 */

import type {
  TemplateKey,
  ContextSlotId,
  ContextSlotPosition,
  PageConfig,
  ResolvedContextSlot,
  ContentBlock,
} from "@/page-config";
import type { ContentBlockKey } from "@/tenant/types";

// ═════════════════════════════════════════════════════════════════════════════
// EDITABLE CONTEXT SLOT
// ═════════════════════════════════════════════════════════════════════════════

/**
 * A mutable context slot entry inside an EditablePage.
 *
 * Mirrors ResolvedContextSlot but without `readonly`:
 *
 *   slotId            — which adaptive slot this is ("hero" | "proof" | "cta")
 *   variantKey        — the fallback variant key used when the decision engine
 *                       does not resolve a specific variant for this visitor.
 *                       null = slot is inactive on this page.
 *   position          — rendering position relative to content blocks.
 *   allowedVariantKeys — operator-configured governance envelope: the subset of
 *                        the slot's full vocabulary that this page may serve.
 *                        undefined = no restriction (full vocabulary allowed).
 *                        [] = slot effectively disabled for engine selection.
 *                        The decision engine always makes the final per-visitor
 *                        choice at request time — this field only constrains
 *                        which options the engine may consider for this page.
 */
export interface EditableContextSlot {
  slotId:              ContextSlotId;
  variantKey:          string | null;
  position:            ContextSlotPosition;
  allowedVariantKeys?: string[];
}

// ═════════════════════════════════════════════════════════════════════════════
// EDITABLE CONTENT BLOCK
// ═════════════════════════════════════════════════════════════════════════════

/**
 * A mutable content block entry inside an EditablePage.
 *
 * id        — Stable block identifier (CMS _key or generated UUID).
 * blockType — Discriminant matching the ContentBlockKey union.
 * variant   — Optional visual variant (forwarded to the renderer).
 * data      — Block-specific field values. Intentionally typed as
 *             `Record<string, unknown>` so the editor is generic across
 *             all block types without importing every data interface.
 *             The renderer narrows `data` by `blockType` at render time.
 */
export interface EditableContentBlock {
  id:        string;
  blockType: ContentBlockKey;
  variant?:  string;
  // Intentionally loose-typed for editor generality.
  // The renderer narrows this via the blockType discriminant.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data:      Record<string, any>;
}

// ═════════════════════════════════════════════════════════════════════════════
// EDITABLE PAGE
// ═════════════════════════════════════════════════════════════════════════════

/**
 * The editable, persistable representation of a CMS page.
 *
 * Stored in the page store (pages/store.ts) and consumed by the admin
 * page builder.  Aligned with runtime PageConfig but mutable.
 *
 * ─── Field descriptions ───────────────────────────────────────────────────────
 *
 *   id            — Stable identifier.  Matches the CMS document _id for
 *                   CMS-originated pages; generated UUID for admin-created pages.
 *   slug          — URL slug without leading slash (e.g. "about-us").
 *   title         — Internal page title.  Fallback for seo.title if absent.
 *   templateKey   — Structural template: which context slots are available.
 *   contextSlots  — Ordered context slot definitions with fallback variant keys.
 *   contentBlocks — Ordered content block definitions.
 *   seo           — Per-page SEO overrides; absent fields fall back to site defaults.
 *   createdAt     — ISO 8601 timestamp of first save.
 *   updatedAt     — ISO 8601 timestamp of most recent save.
 */
export interface EditablePage {
  id:            string;
  /** Owning tenant slug, e.g. "workengine". Legacy pages without this field
   *  are normalised to DEFAULT_TENANT by the store on read. */
  tenantId:      string;
  slug:          string;
  title:         string;
  templateKey:   TemplateKey;
  contextSlots:  EditableContextSlot[];
  contentBlocks: EditableContentBlock[];
  seo: {
    title?:       string;
    description?: string;
  };
  createdAt: string;
  updatedAt: string;
}

// ═════════════════════════════════════════════════════════════════════════════
// CONVERSION HELPERS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Convert an EditablePage to a runtime PageConfig.
 *
 * Called by:
 *   - Page builder preview renderer (renders the edited page in real-time)
 *   - Admin page-CMS provider bridge (serves edited pages to the frontend)
 *
 * The `contentBlocks` cast is intentional: EditableContentBlock.data is typed
 * as `Record<string, unknown>` but structurally matches the specific BlockData
 * type for each blockType at runtime.  The renderer narrows safely via
 * the blockType discriminant and never accesses data fields unchecked.
 */
export function toPageConfig(page: EditablePage): PageConfig {
  const contextSlots: readonly ResolvedContextSlot[] = page.contextSlots.map((slot) => ({
    slotId:     slot.slotId,
    variantKey: slot.variantKey,
    position:   slot.position,
  }));

  return {
    pageId:       page.id,
    slug:         page.slug.startsWith("/") ? page.slug : `/${page.slug}`,
    title:        page.title,
    templateKey:  page.templateKey,
    contextSlots,
    // Safe widening cast: EditableContentBlock is structurally compatible with
    // ContentBlock at runtime — blockType and data always match.
    contentBlocks: page.contentBlocks as unknown as readonly ContentBlock[],
    seo: {
      title:       page.seo.title,
      description: page.seo.description,
    },
  };
}

/**
 * Internal helper: cast a ContentBlock union member to an accessible shape
 * without exhaustive narrowing.
 *
 * All ContentBlock variants have id, blockType, variant?, and data fields —
 * this cast lets us access them without a full switch statement.
 */
type AnyBlock = {
  readonly id:        string;
  readonly blockType: string;
  readonly variant?:  string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly data:      Record<string, any>;
};

/**
 * Convert a runtime PageConfig to an EditablePage.
 *
 * Called by:
 *   - Seed builder (initialises the page store from mock provider data)
 *   - Future CMS sync import (import a live page into the editor)
 *
 * @param config   Platform PageConfig to convert.
 * @param options  Optional overrides for tenantId and audit timestamps.
 */
export function fromPageConfig(
  config:   PageConfig,
  options?: { tenantId?: string; createdAt?: string; updatedAt?: string },
): EditablePage {
  const now = new Date().toISOString();

  const contextSlots: EditableContextSlot[] = config.contextSlots.map((slot) => ({
    slotId:     slot.slotId,
    variantKey: slot.variantKey,
    position:   slot.position ?? "before-content",
  }));

  // Cast the ContentBlock union to AnyBlock for generic field access.
  // Safe: all ContentBlock variants carry id, blockType, variant?, and data.
  const contentBlocks: EditableContentBlock[] = (config.contentBlocks as readonly AnyBlock[]).map(
    (block) => ({
      id:        block.id,
      blockType: block.blockType as ContentBlockKey,
      variant:   block.variant,
      data:      block.data,
    }),
  );

  return {
    id:            config.pageId,
    tenantId:      options?.tenantId ?? "workengine",
    slug:          config.slug.replace(/^\//, ""),
    title:         config.title,
    templateKey:   config.templateKey,
    contextSlots,
    contentBlocks,
    seo: {
      title:       config.seo?.title,
      description: config.seo?.description,
    },
    createdAt: options?.createdAt ?? now,
    updatedAt: options?.updatedAt ?? now,
  };
}
