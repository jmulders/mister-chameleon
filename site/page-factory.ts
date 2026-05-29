/**
 * site/page-factory.ts
 *
 * Creates EditablePage rows in the `pages` Supabase table from a blueprint's
 * page list, seeding each page's content blocks with scaffold data derived
 * from the operator's intake form.
 *
 * ─── Page structure ───────────────────────────────────────────────────────────
 *
 *   templateKey   "marketing-page" for all blueprint pages (supports the
 *                 standard hero / proof / cta context slot trio + unlimited
 *                 content blocks).
 *
 *   contextSlots  Empty — the runtime uses the template's default fallback
 *                 keys until the operator sets explicit variant overrides.
 *
 *   contentBlocks Generated from blueprint.pages[n].blocks with scaffold
 *                 data from generateBlockData().  No empty blocks.
 *
 * ─── Idempotency ──────────────────────────────────────────────────────────────
 *
 *   When overwrite = false (default), a page whose (tenant_id, slug) already
 *   exists in the DB is skipped and reported with status "skipped".
 *
 *   When overwrite = true, the page is replaced (upsert with ON CONFLICT
 *   DO UPDATE) and reported with status "overwritten".
 *
 * ─── Server-only ──────────────────────────────────────────────────────────────
 *
 *   Uses the service-role Supabase client (getDb).  Do NOT import in client
 *   components.
 */

import "server-only";

import { randomUUID }         from "crypto";
import { getDb }              from "@/data/db";
import { generateBlockData }  from "./content-generator";
import type { BlueprintPage } from "@/blueprints/blueprint-types";
import type { CreatedPageResult } from "./types";
import type { SiteIntakeData }    from "./types";

// ── Options ───────────────────────────────────────────────────────────────────

export interface CreatePagesOptions {
  tenantId:  string;
  pages:     BlueprintPage[];
  intake:    SiteIntakeData;
  overwrite: boolean;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Upsert all blueprint pages into the `pages` table for a tenant.
 *
 * Returns one result per blueprint page describing whether it was created,
 * overwritten, or skipped.  Never throws — individual page failures are
 * captured in the result's status and do not abort the remaining pages.
 */
export async function createPagesFromBlueprint(
  opts: CreatePagesOptions,
): Promise<CreatedPageResult[]> {
  const { tenantId, pages, intake, overwrite } = opts;
  const results: CreatedPageResult[] = [];

  // Load existing slugs once to avoid N repeated SELECT queries.
  const existingSlugs = await loadExistingSlugs(tenantId);

  for (let i = 0; i < pages.length; i++) {
    const bp     = pages[i];
    // Normalise slug: leading "/" maps to "" in the pages table (homepage).
    const slug   = normaliseSlug(bp.slug);
    const pageId = randomUUID();

    const alreadyExists = existingSlugs.has(slug);

    if (alreadyExists && !overwrite) {
      results.push({ pageId: "", slug: bp.slug, title: bp.title, status: "skipped" });
      continue;
    }

    const editablePage = buildEditablePage({
      id:       pageId,
      tenantId,
      slug,
      title:    bp.title,
      blocks:   bp.blocks,
      intake,
    });

    try {
      if (alreadyExists && overwrite) {
        // UPDATE existing row — preserve the original created_at.
        const { error } = await getDb()
          .from("pages")
          .update({
            page:       editablePage as never,
            title:      bp.title,
            updated_at: new Date().toISOString(),
          } as never)
          .eq("tenant_id", tenantId as never)
          .eq("slug",      slug      as never);

        if (error) {
          results.push({ pageId: "", slug: bp.slug, title: bp.title, status: "skipped" });
          continue;
        }

        results.push({ pageId, slug: bp.slug, title: bp.title, status: "overwritten" });
      } else {
        // INSERT new row.
        const { error } = await getDb()
          .from("pages")
          .insert({
            id:        pageId,
            tenant_id: tenantId,
            slug,
            title:     bp.title,
            page:      editablePage as never,
          } as never);

        if (error) {
          // Duplicate key on a race condition — treat as skipped.
          if (error.code === "23505") {
            results.push({ pageId: "", slug: bp.slug, title: bp.title, status: "skipped" });
          } else {
            results.push({ pageId: "", slug: bp.slug, title: bp.title, status: "skipped" });
          }
          continue;
        }

        results.push({ pageId, slug: bp.slug, title: bp.title, status: "created" });
      }
    } catch {
      results.push({ pageId: "", slug: bp.slug, title: bp.title, status: "skipped" });
    }
  }

  return results;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Normalise a blueprint slug to the pages-table convention (no leading slash, "" for root). */
function normaliseSlug(slug: string): string {
  if (slug === "/") return "";
  return slug.startsWith("/") ? slug.slice(1) : slug;
}

/** Load the set of slugs already present for a tenant (for idempotency check). */
async function loadExistingSlugs(tenantId: string): Promise<Set<string>> {
  try {
    const { data } = await getDb()
      .from("pages")
      .select("slug")
      .eq("tenant_id", tenantId as never);
    return new Set((data ?? []).map((r: { slug: string }) => r.slug));
  } catch {
    return new Set();
  }
}

// ── EditablePage builder ──────────────────────────────────────────────────────

interface BuildPageInput {
  id:       string;
  tenantId: string;
  slug:     string;
  title:    string;
  blocks:   import("@/blueprints/blueprint-types").BlueprintBlock[];
  intake:   SiteIntakeData;
}

function buildEditablePage(input: BuildPageInput): Record<string, unknown> {
  const { id, tenantId, slug, title, blocks, intake } = input;
  const isHomepage = slug === "";
  const displaySlug = isHomepage ? "/" : `/${slug}`;
  const now = new Date().toISOString();

  const contentBlocks = blocks.map((block, idx) => ({
    id:        randomUUID(),
    blockType: block.type,
    variant:   "default",
    order:     idx,
    // Generate scaffold data from intake — never empty.
    data: generateBlockData(block.type, intake, {
      isHomepage,
      pageTitle: title,
      slug:      displaySlug,
    }),
  }));

  return {
    id,
    tenantId,
    slug,
    title,
    // All blueprint pages use the standard marketing template.
    templateKey:   "marketing-page",
    // Context slots are left empty — defaults apply at render time.
    contextSlots:  [],
    contentBlocks,
    seo: {
      title:       title,
      description: intake.description,
    },
    createdAt: now,
    updatedAt: now,
  };
}
