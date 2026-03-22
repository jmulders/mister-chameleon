/**
 * Page store — Supabase-backed
 *
 * Supabase implementation of the admin-editable page store.
 * Replaces the original sync fs + JSON file backend so the platform
 * runs safely on Vercel and any other serverless environment with a
 * read-only filesystem.
 *
 * ─── Architecture role ────────────────────────────────────────────────────────
 *
 *   Admin editor (UI)
 *        ↓  savePage() / getAllPages() / getPageById()
 *   Page store (this file)                   ← YOU ARE HERE
 *        ↓  toPageConfig()
 *   PageConfig (platform-internal, renderer-ready)
 *        ↓  <TemplateRenderer pageConfig={…} />
 *   Rendered page
 *
 * ─── Storage ──────────────────────────────────────────────────────────────────
 *
 *   Pages are persisted in the `pages` Supabase table.  Each row stores
 *   the full EditablePage object as JSONB under the `page` column, plus
 *   extracted `tenant_id` and `slug` columns for efficient indexed lookups.
 *
 *   SQL schema:
 *     supabase/migrations/20240101000011_create_pages.sql
 *
 * ─── Seeding ──────────────────────────────────────────────────────────────────
 *
 *   Unlike the file-backed version, this store does NOT auto-seed on first
 *   access.  In a shared database (staging / production), auto-seeding would
 *   race across instances.  Use `resetStore()` explicitly in local dev or tests
 *   to populate the database with seed pages from MockCMSProvider.
 *
 * ─── Server-only ──────────────────────────────────────────────────────────────
 *
 *   This module imports `@/data/db` which carries a "server-only" guard.
 *   Never import this module from Client Components or Edge Middleware.
 *
 * ─── Public API ───────────────────────────────────────────────────────────────
 *
 *   getAllPages()                → Promise<EditablePage[]>
 *   getPagesByTenant(tenantId)  → Promise<EditablePage[]>
 *   getPageById(id, tenantId?)  → Promise<EditablePage | undefined>
 *   getPageBySlug(slug, tid?)   → Promise<EditablePage | undefined>
 *   savePage(page)              → Promise<EditablePage>   (create or update)
 *   deletePage(id)              → Promise<boolean>
 *   listPageSlugs()             → Promise<string[]>
 *   resetStore()                → Promise<void>  (dev / test use only)
 */

import type { EditablePage }  from "./types";
import { getSeedPages }       from "./seed";
import { getDb }              from "@/data/db";

// ── Typed query helper ────────────────────────────────────────────────────────
//
// The hand-authored Database type does not include the `PostgrestVersion`
// discriminant that @supabase/supabase-js v2 needs for full column-type
// resolution, causing `.select()` to produce `data: never[] | null` in strict
// mode.  This is the same pre-existing root cause as insert errors elsewhere.
// Workaround: assert the result to the known Row type immediately after the
// query.  The assertion is safe because Database.Tables IS correct.

type SelectResult<T> = { data: T[] | null; error: { message: string } | null };
type SingleResult<T> = { data: T | null;   error: { message: string } | null };

function asRows<T>(result: unknown): SelectResult<T> {
  return result as SelectResult<T>;
}

function asSingle<T>(result: unknown): SingleResult<T> {
  return result as SingleResult<T>;
}

// ── Backward-compatibility constant ───────────────────────────────────────────

/**
 * Pages stored before tenantId was introduced are treated as belonging to this
 * tenant.  Kept for consistency with the previous file-backed store.
 */
const DEFAULT_TENANT = "workengine";

// ── Internal helper ───────────────────────────────────────────────────────────

/**
 * Coerce a raw DB row's `page` JSONB column to EditablePage, normalising
 * legacy rows that pre-date the `tenantId` field.
 */
function toEditablePage(raw: Record<string, unknown>): EditablePage {
  // Cast via unknown first — Database JSONB columns are typed as
  // Record<string, unknown> but the stored shape IS an EditablePage.
  const page = (raw as unknown) as EditablePage & { tenantId?: string };
  return page.tenantId ? (page as EditablePage) : { ...page, tenantId: DEFAULT_TENANT };
}

// ═════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Return all pages in insertion order.
 *
 * @example
 * const pages = await getAllPages();
 * pages.forEach(p => console.log(p.slug, p.title));
 */
export async function getAllPages(): Promise<EditablePage[]> {
  const { data, error } = asRows<{ page: Record<string, unknown> }>(
    await getDb()
      .from("pages")
      .select("page")
      .order("created_at", { ascending: true }),
  );

  if (error) {
    console.error("[page-store] getAllPages DB error:", error.message);
    return [];
  }

  return (data ?? []).map((row) => toEditablePage(row.page));
}

/**
 * Return all pages that belong to a specific tenant.
 *
 * @example
 * const pages = await getPagesByTenant("workengine");
 */
export async function getPagesByTenant(tenantId: string): Promise<EditablePage[]> {
  const { data, error } = asRows<{ page: Record<string, unknown> }>(
    await getDb()
      .from("pages")
      .select("page")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true }),
  );

  if (error) {
    console.error("[page-store] getPagesByTenant DB error:", error.message);
    return [];
  }

  return (data ?? []).map((row) => toEditablePage(row.page));
}

/**
 * Return the page with the given stable identifier, or `undefined` when not found.
 *
 * When `tenantId` is supplied the page is only returned if it belongs to that
 * tenant — an id match on a different tenant's page returns `undefined`.
 *
 * @example
 * const page = await getPageById("homepage", "workengine");
 * if (!page) redirect("/not-found");
 */
export async function getPageById(id: string, tenantId?: string): Promise<EditablePage | undefined> {
  let query = getDb()
    .from("pages")
    .select("page")
    .eq("id", id);

  if (tenantId !== undefined) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data, error } = asSingle<{ page: Record<string, unknown> }>(
    await query.maybeSingle(),
  );

  if (error) {
    console.error("[page-store] getPageById DB error:", error.message);
    return undefined;
  }

  if (!data) return undefined;
  return toEditablePage(data.page);
}

/**
 * Return the page whose slug matches the given value, or `undefined`.
 *
 * The slug is compared without leading slash.
 * When `tenantId` is supplied only pages belonging to that tenant are searched.
 *
 * @example
 * const page = await getPageBySlug("about-us", "workengine");
 */
export async function getPageBySlug(slug: string, tenantId?: string): Promise<EditablePage | undefined> {
  const normalised = slug.replace(/^\//, "");

  let query = getDb()
    .from("pages")
    .select("page")
    .eq("slug", normalised);

  if (tenantId !== undefined) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data, error } = asSingle<{ page: Record<string, unknown> }>(
    await query.maybeSingle(),
  );

  if (error) {
    console.error("[page-store] getPageBySlug DB error:", error.message);
    return undefined;
  }

  if (!data) return undefined;
  return toEditablePage(data.page);
}

/**
 * Create or update a page in the store.
 *
 * If a page with the same `id` already exists it is replaced.
 * `updatedAt` is always set to the current timestamp.
 * `createdAt` is set only when creating a new page.
 *
 * @returns The saved page (with updated timestamps).
 *
 * @example
 * const saved = await savePage({ ...page, title: "New Title" });
 */
export async function savePage(
  page: Omit<EditablePage, "createdAt" | "updatedAt"> & Partial<Pick<EditablePage, "createdAt" | "updatedAt">>,
): Promise<EditablePage> {
  const now = new Date().toISOString();

  // Fetch the existing record to preserve createdAt when updating.
  const existing = await getPageById(page.id);

  const saved: EditablePage = {
    ...page,
    createdAt: page.createdAt ?? existing?.createdAt ?? now,
    updatedAt: now,
  };

  const normalised = saved.slug.replace(/^\//, "");

  const { error } = await getDb()
    .from("pages")
    .upsert(
      {
        id:         saved.id,
        tenant_id:  saved.tenantId,
        slug:       normalised,
        page:       { ...saved, slug: normalised } as unknown as Record<string, unknown>,
        created_at: saved.createdAt,
        updated_at: saved.updatedAt,
      },
      { onConflict: "id" },
    );

  if (error) {
    console.error("[page-store] savePage DB error:", error.message);
    throw new Error(`[page-store] savePage failed: ${error.message}`);
  }

  return { ...saved, slug: normalised };
}

/**
 * Remove the page with the given identifier from the store.
 *
 * @returns `true` when a page was found and removed; `false` when not found.
 *
 * @example
 * const removed = await deletePage("about-us");
 */
export async function deletePage(id: string): Promise<boolean> {
  // Check for existence first so we can return the correct boolean.
  const existing = await getPageById(id);
  if (!existing) return false;

  const { error } = await getDb()
    .from("pages")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[page-store] deletePage DB error:", error.message);
    return false;
  }

  return true;
}

/**
 * Return an ordered array of all page slugs.
 *
 * Useful for Next.js `generateStaticParams()` and sitemap generation.
 *
 * @example
 * export async function generateStaticParams() {
 *   const slugs = await listPageSlugs();
 *   return slugs.map((slug) => ({ slug }));
 * }
 */
export async function listPageSlugs(): Promise<string[]> {
  const { data, error } = asRows<{ slug: string }>(
    await getDb()
      .from("pages")
      .select("slug")
      .order("created_at", { ascending: true }),
  );

  if (error) {
    console.error("[page-store] listPageSlugs DB error:", error.message);
    return [];
  }

  return (data ?? []).map((row) => row.slug);
}

/**
 * Reset the store to its initial seeded state.
 *
 * Deletes all rows from the `pages` table and re-inserts the seed pages
 * built from MockCMSProvider.
 *
 * ⚠️  For development and test use only.  Never call this in production.
 */
export async function resetStore(): Promise<void> {
  // Delete all existing pages.
  const { error: deleteError } = await getDb()
    .from("pages")
    .delete()
    .neq("id", ""); // Supabase requires a filter; neq("id", "") matches all rows.

  if (deleteError) {
    console.error("[page-store] resetStore delete error:", deleteError.message);
    throw new Error(`[page-store] resetStore failed: ${deleteError.message}`);
  }

  // Re-seed with MockCMSProvider pages.
  console.info("[page-store] Seeding with seed pages…");
  try {
    const seed = await getSeedPages();

    for (const page of seed) {
      await savePage(page);
    }

    console.info(`[page-store] Seeded ${seed.length} page(s).`);
  } catch (err) {
    console.error("[page-store] Seed failed — store will be empty:", err);
  }
}
